import { User, MatrixNode, Utility, UtilityType, AvatarConfig } from '../types';
import { supabase, isDbConfigured } from './supabaseClient';

const STORAGE_KEY = 'matrix_users_v1';
const CURRENT_USER_KEY = 'matrix_current_user';

// --- SWITCH DATABASE MODE ---
// Imposta su TRUE quando hai inserito le chiavi in services/supabaseClient.ts
const USE_CLOUD_DB = false; 

// --- LOCAL STORAGE HELPERS (LEGACY/OFFLINE) ---
const getLocalUsers = (): User[] => {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    const users: User[] = JSON.parse(existing);
    // Migration logic on read
    return users.map(u => ({
      ...u,
      utilities: u.utilities || [],
      email: u.email || 'unknown@example.com',
      phone: u.phone || '',
      avatarConfig: u.avatarConfig || { style: 'bottts-neutral', seed: u.username, backgroundColor: 'transparent' }
    }));
  }
  return initLocalRoot();
};

const initLocalRoot = (): User[] => {
  const rootUser: User = {
    id: 'root-001',
    username: 'admin',
    password: 'password',
    email: 'admin@matrixflow.com',
    phone: '+390000000000',
    sponsorId: null,
    parentId: null,
    joinedAt: new Date().toISOString(),
    level: 0,
    utilities: [],
    avatarConfig: { style: 'bottts-neutral', seed: 'admin', backgroundColor: 'transparent' }
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([rootUser]));
  return [rootUser];
};

const saveLocalUsers = (users: User[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
};

// --- CORE SERVICE (ASYNC API) ---

export const getUsers = async (): Promise<User[]> => {
  if (USE_CLOUD_DB && isDbConfigured()) {
    // SUPABASE IMPLEMENTATION
    const { data, error } = await supabase
        .from('users')
        .select(`*, utilities(*)`);
    
    if (error) {
        console.error("DB Error", error);
        return [];
    }
    
    // Map DB snake_case to CamelCase types if needed, depends on your table structure
    // For now assuming we map manually or data structure matches
    return data as any; 
  } else {
    // LOCAL MOCK
    await new Promise(r => setTimeout(r, 100)); // Simulate latency
    return getLocalUsers();
  }
};

const findPlacementParent = (users: User[], rootSponsorId: string): string => {
  const parentMap: Record<string, User[]> = {};
  users.forEach(u => {
    if (u.parentId) {
      if (!parentMap[u.parentId]) parentMap[u.parentId] = [];
      parentMap[u.parentId].push(u);
    }
  });

  const queue = [rootSponsorId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = parentMap[currentId] || [];
    if (children.length < 10) return currentId; // 10x10 Matrix Limit
    children.forEach(child => queue.push(child.id));
  }
  return rootSponsorId; 
};

export const registerUser = async (
  username: string, 
  password: string, 
  sponsorUsername: string,
  email: string,
  phone: string
): Promise<{ success: boolean; message: string; user?: User }> => {
  
  const users = await getUsers();
  
  if (users.find(u => u.username === username)) {
    return { success: false, message: 'Username già in uso.' };
  }

  const sponsor = users.find(u => u.username === sponsorUsername);
  const effectiveSponsor = sponsor || users.find(u => u.id === 'root-001')!; 

  const parentId = findPlacementParent(users, effectiveSponsor.id);
  const parent = users.find(u => u.id === parentId)!;

  if (parent.level >= 10) {
     return { success: false, message: 'Limite profondità 10 raggiunto.' };
  }

  const newUser: User = {
    id: `user-${Date.now()}`,
    username,
    password, 
    email,
    phone,
    sponsorId: effectiveSponsor.id,
    parentId: parentId,
    joinedAt: new Date().toISOString(),
    level: parent.level + 1,
    utilities: [],
    avatarConfig: { style: 'bottts-neutral', seed: username, backgroundColor: 'transparent' }
  };

  if (USE_CLOUD_DB && isDbConfigured()) {
      // DB Insert
      const { error } = await supabase.from('users').insert([{
          id: newUser.id,
          username: newUser.username,
          password: newUser.password,
          email,
          phone,
          sponsor_id: newUser.sponsorId,
          parent_id: newUser.parentId,
          level: newUser.level,
          avatar_config: newUser.avatarConfig
      }]);
      if (error) return { success: false, message: 'Errore Database: ' + error.message };
  } else {
      users.push(newUser);
      saveLocalUsers(users);
  }

  return { success: true, message: 'Registrazione completata!', user: newUser };
};

export const updateUser = async (userId: string, updates: Partial<User>): Promise<User | null> => {
  if (USE_CLOUD_DB && isDbConfigured()) {
      const { data, error } = await supabase.from('users').update(updates).eq('id', userId).select();
      if (error || !data) return null;
      // Sync local session just in case
      updateLocalSession(data[0] as User);
      return data[0] as User;
  } else {
      const users = getLocalUsers();
      const index = users.findIndex(u => u.id === userId);
      if (index === -1) return null;
      users[index] = { ...users[index], ...updates };
      saveLocalUsers(users);
      updateLocalSession(users[index]);
      return users[index];
  }
};

export const addUtility = async (
  userId: string, 
  type: UtilityType, 
  provider: string, 
  attachmentName?: string, 
  attachmentType?: string
): Promise<User | null> => {
  const newUtility: Utility = {
    id: `util-${Date.now()}`,
    type,
    provider,
    dateAdded: new Date().toISOString(),
    status: 'In Lavorazione',
    attachmentName,
    attachmentType
  };

  if (USE_CLOUD_DB && isDbConfigured()) {
      const { error } = await supabase.from('utilities').insert([{
          ...newUtility,
          user_id: userId
      }]);
      if (error) return null;
      // Re-fetch user to get updated list
      const users = await getUsers();
      return users.find(u => u.id === userId) || null;
  } else {
      const users = getLocalUsers();
      const userIndex = users.findIndex(u => u.id === userId);
      if (userIndex === -1) return null;
      users[userIndex].utilities = [...(users[userIndex].utilities || []), newUtility];
      saveLocalUsers(users);
      updateLocalSession(users[userIndex]);
      return users[userIndex];
  }
};

export const updateUtilityStatus = async (
  userId: string,
  utilityId: string,
  newStatus: Utility['status']
): Promise<User | null> => {
  if (USE_CLOUD_DB && isDbConfigured()) {
      await supabase.from('utilities').update({ status: newStatus }).eq('id', utilityId);
      const users = await getUsers();
      return users.find(u => u.id === userId) || null;
  } else {
      const users = getLocalUsers();
      const userIndex = users.findIndex(u => u.id === userId);
      if (userIndex === -1) return null;
      const utilities = [...(users[userIndex].utilities || [])];
      const utilIndex = utilities.findIndex(u => u.id === utilityId);
      if (utilIndex === -1) return null;
      utilities[utilIndex] = { ...utilities[utilIndex], status: newStatus };
      users[userIndex].utilities = utilities;
      saveLocalUsers(users);
      updateLocalSession(users[userIndex]);
      return users[userIndex];
  }
};

export const loginUser = async (username: string, password: string): Promise<User | null> => {
  if (USE_CLOUD_DB && isDbConfigured()) {
      const { data } = await supabase.from('users').select(`*, utilities(*)`).eq('username', username).eq('password', password).single();
      if (data) {
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(data));
          return data as User;
      }
      return null;
  } else {
      // Async simulation
      await new Promise(r => setTimeout(r, 200));
      const users = getLocalUsers();
      const user = users.find(u => u.username === username && u.password === password);
      if (user) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        return user;
      }
      return null;
  }
};

export const logoutUser = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUser = (): User | null => {
  const stored = localStorage.getItem(CURRENT_USER_KEY);
  if (!stored) return null;
  return JSON.parse(stored);
};

const updateLocalSession = (user: User) => {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    if (stored) {
        const current = JSON.parse(stored);
        if (current.id === user.id) {
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        }
    }
}

// Generate a referral link based on current location
export const getReferralLink = (username: string): string => {
  const baseUrl = window.location.href.split('?')[0];
  return `${baseUrl}?ref=${username}`;
};

// Build tree structure for visualization
export const buildTree = async (rootId: string): Promise<MatrixNode | null> => {
  const users = await getUsers();
  const root = users.find(u => u.id === rootId);
  if (!root) return null;

  // Map for quick username lookup
  const userMap = new Map(users.map(u => [u.id, u.username]));

  const buildNode = (user: User): MatrixNode => {
    const childrenUsers = users.filter(u => u.parentId === user.id);
    const childrenNodes = childrenUsers.map(buildNode);
    
    // Calculate total downline count recursively
    const downlineCount = childrenNodes.reduce((acc, child) => acc + 1 + child.totalDownline, 0);
    const downlineUtilities = childrenNodes.reduce((acc, child) => acc + (child.utilities?.length || 0) + child.totalUtilities, 0);

    return {
      ...user,
      children: childrenNodes,
      totalDownline: downlineCount,
      totalUtilities: downlineUtilities,
      sponsorUsername: user.sponsorId ? (userMap.get(user.sponsorId) || 'Sconosciuto') : 'N/A'
    };
  };

  return buildNode(root);
};

export const getNetworkStats = async () => {
  const users = await getUsers();
  return {
    totalUsers: users.length,
    matrixDepth: users.length > 0 ? Math.max(...users.map(u => u.level)) : 0,
    totalUtilities: users.reduce((acc, u) => acc + (u.utilities?.length || 0), 0)
  };
};
