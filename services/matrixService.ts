
import { User, MatrixNode, Utility, UtilityType, AvatarConfig } from '../types';
import { supabase, isDbConfigured } from './supabaseClient';
import { googleSheetsClient, GOOGLE_SCRIPT_URL } from './googleSheetsAdapter';

const STORAGE_KEY = 'matrix_users_v1';
const CURRENT_USER_KEY = 'matrix_current_user';

// --- CONFIGURAZIONE DATABASE ---
const DB_MODE: string = 'GOOGLE_SHEETS';

// Helper per verificare se GS è pronto
const isGsConfigured = () => !GOOGLE_SCRIPT_URL.includes('INSERISCI_QUI');

// --- LOCAL STORAGE HELPERS (FALLBACK) ---
const getLocalUsers = (): User[] => {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    const users: User[] = JSON.parse(existing);
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

const getRootUser = (): User => {
    const users = getLocalUsers();
    return users.find(u => u.id === 'root-001') || users[0];
};

const saveLocalUsers = (users: User[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
};

// --- CORE SERVICE (ASYNC API) ---

export const getUsers = async (): Promise<User[]> => {
  // 1. Google Sheets
  if (DB_MODE === 'GOOGLE_SHEETS' && isGsConfigured()) {
      // Tentativo di fetch con timeout gestito dall'adapter
      const data = await googleSheetsClient.get('getUsers');
      
      if (Array.isArray(data)) {
          // AUTO-SEED: Se il DB online è vuoto (0 utenti) ma non dà errore, carichiamo l'admin locale
          if (data.length === 0) {
              console.log("Cloud DB vuoto. Tentativo inizializzazione Admin...");
              const localRoot = getRootUser();
              // Non aspettiamo (fire and forget) per non bloccare la UI, tanto il fallback locale lo mostrerà
              googleSheetsClient.post('register', localRoot).catch(console.error);
              return [localRoot];
          }
          return data as User[];
      }
      // Se data è null (timeout o errore), fallisce silenziosamente verso il locale
      console.warn("Cloud non disponibile, uso dati locali.");
  }

  // 2. Supabase
  if (DB_MODE === 'SUPABASE' && isDbConfigured()) {
    const { data, error } = await supabase.from('users').select(`*, utilities(*)`);
    if (!error && data) return data as any;
  }

  // 3. Local Fallback (Sempre sicuro)
  // Piccolo delay per simulare async ed evitare race condition UI
  await new Promise(r => setTimeout(r, 50)); 
  return getLocalUsers();
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
  const effectiveSponsor = sponsor || users.find(u => u.id === 'root-001') || users[0] || getRootUser(); 

  const parentId = findPlacementParent(users, effectiveSponsor.id);
  const parent = users.find(u => u.id === parentId);

  // Safety check se parent è null (caso limite db corrotto)
  const safeLevel = parent ? parent.level : 0;

  if (safeLevel >= 10) {
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
    level: safeLevel + 1,
    utilities: [],
    avatarConfig: { style: 'bottts-neutral', seed: username, backgroundColor: 'transparent' }
  };

  if (DB_MODE === 'GOOGLE_SHEETS' && isGsConfigured()) {
      const res = await googleSheetsClient.post('register', newUser);
      if (!res || res.error) {
          // Errore specifico dal server o timeout
          return { success: false, message: res?.error || 'Errore salvataggio Cloud. Riprova.' };
      }
  } else if (DB_MODE === 'SUPABASE' && isDbConfigured()) {
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
  if (DB_MODE === 'GOOGLE_SHEETS' && isGsConfigured()) {
      await googleSheetsClient.post('updateUser', { id: userId, ...updates });
      // GS è lento a riflettere l'aggiornamento. Aggiorniamo ottimisticamente la sessione locale.
      const users = await getUsers(); 
      const existing = users.find(u => u.id === userId);
      // Fallback: se cloud non lo trova, prendilo dal local storage/sessione corrente
      const target = existing || getCurrentUser();

      if (target) {
           const merged = { ...target, ...updates };
           updateLocalSession(merged);
           return merged;
      }
      return null;
  }

  if (DB_MODE === 'SUPABASE' && isDbConfigured()) {
      const { data, error } = await supabase.from('users').update(updates).eq('id', userId).select();
      if (error || !data) return null;
      updateLocalSession(data[0] as User);
      return data[0] as User;
  }
  
  // Local
  const users = getLocalUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) return null;
  users[index] = { ...users[index], ...updates };
  saveLocalUsers(users);
  updateLocalSession(users[index]);
  return users[index];
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

  if (DB_MODE === 'GOOGLE_SHEETS' && isGsConfigured()) {
      const res = await googleSheetsClient.post('addUtility', { ...newUtility, userId });
      if (res && res.error) {
          console.error("Add Utility Error:", res.error);
          return null;
      }
      
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === userId) {
          const updatedUser = { ...currentUser, utilities: [...(currentUser.utilities || []), newUtility] };
          updateLocalSession(updatedUser);
          return updatedUser;
      }
      return null;
  }

  if (DB_MODE === 'SUPABASE' && isDbConfigured()) {
      const { error } = await supabase.from('utilities').insert([{ ...newUtility, user_id: userId }]);
      if (error) return null;
      const users = await getUsers();
      return users.find(u => u.id === userId) || null;
  } 

  // Local
  const users = getLocalUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) return null;
  users[userIndex].utilities = [...(users[userIndex].utilities || []), newUtility];
  saveLocalUsers(users);
  updateLocalSession(users[userIndex]);
  return users[userIndex];
};

export const updateUtilityStatus = async (
  userId: string,
  utilityId: string,
  newStatus: Utility['status']
): Promise<User | null> => {
  
  if (DB_MODE === 'SUPABASE' && isDbConfigured()) {
      await supabase.from('utilities').update({ status: newStatus }).eq('id', utilityId);
      const users = await getUsers();
      return users.find(u => u.id === userId) || null;
  }

  if (DB_MODE === 'GOOGLE_SHEETS' && isGsConfigured()) {
       // Per semplicità UI in questa demo, aggiorniamo solo la sessione locale ottimisticamente
       const currentUser = getCurrentUser();
       if (currentUser && currentUser.id === userId) {
            const utilities = [...(currentUser.utilities || [])];
            const utilIndex = utilities.findIndex(u => u.id === utilityId);
            if (utilIndex > -1) {
                utilities[utilIndex] = { ...utilities[utilIndex], status: newStatus };
                const updatedUser = { ...currentUser, utilities };
                updateLocalSession(updatedUser);
                return updatedUser;
            }
       }
       return currentUser;
  }

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
};

export const loginUser = async (username: string, password: string): Promise<User | null> => {
  const users = await getUsers();
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    return user;
  }
  return null;
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

export const getReferralLink = (username: string): string => {
  const baseUrl = window.location.href.split('?')[0];
  return `${baseUrl}?ref=${username}`;
};

export const buildTree = async (rootId: string): Promise<MatrixNode | null> => {
  const users = await getUsers();
  const root = users.find(u => u.id === rootId);
  if (!root) return null;

  const userMap = new Map(users.map(u => [u.id, u.username]));

  const buildNode = (user: User): MatrixNode => {
    const childrenUsers = users.filter(u => u.parentId === user.id);
    const childrenNodes = childrenUsers.map(buildNode);
    
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
    totalUtilities: users.reduce((acc, u) => acc + (u.utilities?.length || 0), 0),
    nextEmptySpot: 'Auto'
  };
};
