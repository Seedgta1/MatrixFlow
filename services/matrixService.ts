
import { User, MatrixNode, Utility, UtilityType, AvatarConfig } from '../types';
import { supabase, isDbConfigured } from './supabaseClient';
import { googleSheetsClient, GOOGLE_SCRIPT_URL } from './googleSheetsAdapter';

const STORAGE_KEY = 'matrix_users_v1';
const CURRENT_USER_KEY = 'matrix_current_user';

// --- CONFIGURAZIONE DATABASE ---
const DB_MODE: string = 'GOOGLE_SHEETS';

// Helper per verificare se GS è pronto
const isGsConfigured = () => !GOOGLE_SCRIPT_URL.includes('INSERISCI_QUI');

// --- LOCAL STORAGE HELPERS (SAFE MODE) ---

// Helper cruciale: Rimuove i dati pesanti (immagini) prima di salvare nel LocalStorage
// per evitare il crash "QuotaExceededError". In memoria l'app userà i dati completi.
const sanitizeForStorage = (user: User): User => ({
  ...user,
  utilities: user.utilities.map(u => ({
    ...u,
    // Se l'allegato supera i 50KB, non lo salviamo in locale (resta nel Cloud)
    attachmentData: (u.attachmentData && u.attachmentData.length < 50000) 
        ? u.attachmentData 
        : undefined
  }))
});

const getLocalUsers = (): User[] => {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    try {
      const users: User[] = JSON.parse(existing);
      return users.map(u => ({
        ...u,
        id: String(u.id),
        username: String(u.username),
        password: u.password ? String(u.password) : '',
        utilities: Array.isArray(u.utilities) ? u.utilities : [],
        email: u.email || 'unknown@example.com',
        phone: u.phone || '',
        avatarConfig: u.avatarConfig || { style: 'bottts-neutral', seed: u.username, backgroundColor: 'transparent' }
      }));
    } catch (e) {
      console.error("Errore parsing local users", e);
      return initLocalRoot();
    }
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
  try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([rootUser]));
  } catch(e) { console.error("Init Root Failed", e); }
  return [rootUser];
};

const getRootUser = (): User => {
    const users = getLocalUsers();
    return users.find(u => u.id === 'root-001') || users[0];
};

const saveLocalUsers = (users: User[]) => {
  try {
      // Salviamo solo la versione "leggera" per non intasare la memoria del telefono
      const safeUsers = users.map(sanitizeForStorage);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUsers));
  } catch (e) {
      console.error("ERRORE CRITICO: LocalStorage pieno.", e);
  }
};

const updateLocalSession = (user: User) => {
    try {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sanitizeForStorage(user)));
    } catch (e) {
        console.error("Failed to update session storage", e);
    }
}

// --- CORE SERVICE (ASYNC API) ---

export const getUsers = async (): Promise<User[]> => {
  // 1. Google Sheets
  if (DB_MODE === 'GOOGLE_SHEETS' && isGsConfigured()) {
      const response = await googleSheetsClient.get('getUsers');
      
      let cloudRawData: any[] = [];
      
      if (Array.isArray(response)) {
          cloudRawData = response;
      } else if (response && typeof response === 'object') {
          if (Array.isArray(response.data)) cloudRawData = response.data;
          else if (Array.isArray(response.users)) cloudRawData = response.users;
      }

      if (cloudRawData.length > 0 || (response && cloudRawData.length === 0)) {
          const normalizedCloudUsers: User[] = cloudRawData.map((u: any) => ({
             ...u,
             id: String(u.id), 
             username: String(u.username),
             password: u.password !== undefined ? String(u.password) : '',
             sponsorId: u.sponsorId ? String(u.sponsorId) : null,
             parentId: u.parentId ? String(u.parentId) : null,
             level: Number(u.level) || 0,
             utilities: Array.isArray(u.utilities) ? u.utilities : [],
             avatarConfig: u.avatarConfig || { style: 'bottts-neutral', seed: String(u.username), backgroundColor: 'transparent' }
          }));

          if (normalizedCloudUsers.length === 0) {
              const localRoot = getRootUser();
              googleSheetsClient.post('register', localRoot).catch(console.error);
              return [localRoot];
          }

          const currentLocal = getLocalUsers();
          const cloudIds = new Set(normalizedCloudUsers.map(u => u.id));
          const now = Date.now();
          const RECENT_THRESHOLD = 15 * 60 * 1000; 

          const pendingUsers = currentLocal.filter(u => {
              if (!cloudIds.has(String(u.id))) {
                  const joinTime = new Date(u.joinedAt).getTime();
                  if (!isNaN(joinTime) && (now - joinTime) < RECENT_THRESHOLD) {
                      return true;
                  }
              }
              return false;
          });

          // Uniamo i dati: Cloud (che potrebbe avere immagini pesanti) + Locali pendenti
          const mergedData = [...normalizedCloudUsers, ...pendingUsers];
          
          // Salviamo in locale la versione "lite" (senza immagini pesanti)
          saveLocalUsers(mergedData);
          
          // Ma ritorniamo all'app la versione "full" (con immagini dal cloud)
          return mergedData;
      }
      
      console.warn("Cloud non disponibile o formato non valido, uso dati locali.");
  }

  // 2. Supabase
  if (DB_MODE === 'SUPABASE' && isDbConfigured()) {
    const { data, error } = await supabase.from('users').select(`*, utilities(*)`);
    if (!error && data) return data as any;
  }

  // 3. Local Fallback
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
    if (children.length < 10) return currentId; 
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
  
  const cleanUsername = username.trim();
  const cleanPassword = password.trim(); 
  const cleanEmail = email.trim();
  const cleanPhone = phone.trim();

  const users = await getUsers();
  
  if (users.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
    return { success: false, message: 'Username già in uso.' };
  }

  const sponsor = users.find(u => u.username.toLowerCase() === sponsorUsername.toLowerCase());
  const effectiveSponsor = sponsor || users.find(u => u.id === 'root-001') || users[0] || getRootUser(); 

  const parentId = findPlacementParent(users, effectiveSponsor.id);
  const parent = users.find(u => u.id === parentId);
  const safeLevel = parent ? parent.level : 0;

  if (safeLevel >= 10) {
     return { success: false, message: 'Limite profondità 10 raggiunto.' };
  }

  const newUser: User = {
    id: `user-${Date.now()}`,
    username: cleanUsername,
    password: cleanPassword, 
    email: cleanEmail,
    phone: cleanPhone,
    sponsorId: effectiveSponsor.id,
    parentId: parentId,
    joinedAt: new Date().toISOString(),
    level: safeLevel + 1,
    utilities: [],
    avatarConfig: { style: 'bottts-neutral', seed: cleanUsername, backgroundColor: 'transparent' }
  };

  if (DB_MODE === 'GOOGLE_SHEETS' && isGsConfigured()) {
      const localUsers = getLocalUsers();
      if (!localUsers.find(u => u.id === newUser.id)) {
          localUsers.push(newUser);
          saveLocalUsers(localUsers);
      }
      
      const res = await googleSheetsClient.post('register', newUser);
      
      if (!res || res.error) {
          console.warn("Salvataggio cloud fallito, utente salvato solo in locale:", res?.error);
          return { success: true, message: 'Registrazione completata (Offline mode).', user: newUser };
      }
      
  } else if (DB_MODE === 'SUPABASE' && isDbConfigured()) {
      const { error } = await supabase.from('users').insert([{
          id: newUser.id,
          username: newUser.username,
          password: newUser.password,
          email: cleanEmail,
          phone: cleanPhone,
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
      googleSheetsClient.post('updateUser', { id: userId, ...updates }).catch(console.error);
      
      const users = await getUsers(); 
      const target = users.find(u => u.id === userId) || getCurrentUser();

      if (target) {
           const merged = { ...target, ...updates };
           updateLocalSession(merged);
           
           const localUsers = getLocalUsers();
           const idx = localUsers.findIndex(u => u.id === userId);
           if (idx !== -1) {
               localUsers[idx] = { ...localUsers[idx], ...updates };
               saveLocalUsers(localUsers);
           }
           
           return merged;
      }
      return null;
  }
  
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
  attachmentType?: string,
  attachmentData?: string
): Promise<User | null> => {

  const newUtility: Utility = {
    id: `util-${Date.now()}`,
    type,
    provider,
    dateAdded: new Date().toISOString(),
    status: 'In Lavorazione',
    attachmentName,
    attachmentType,
    attachmentData // Manteniamo i dati completi per il Cloud/Memoria
  };

  if (DB_MODE === 'GOOGLE_SHEETS' && isGsConfigured()) {
      // 1. Inviamo TUTTI i dati al Cloud (Google Scripts gestirà eventuali limiti o Drive)
      // NON blocchiamo l'upload qui.
      googleSheetsClient.post('addUtility', { ...newUtility, userId })
          .catch(err => console.error("Cloud save failed (Utility)", err));
      
      const currentUser = getCurrentUser();
      // Cerchiamo di recuperare l'utente anche se getCurrentUser (da storage) è lite
      // Ma per l'update immediato usiamo quello che abbiamo
      if (currentUser && currentUser.id === userId) {
          const updatedUser = { ...currentUser, utilities: [...(currentUser.utilities || []), newUtility] };
          
          // 2. Aggiorniamo la sessione (Memoria + Storage Lite)
          updateLocalSession(updatedUser);
          
          // 3. Aggiorniamo la lista utenti locale (Storage Lite)
          const localUsers = getLocalUsers();
          const idx = localUsers.findIndex(u => u.id === userId);
          if (idx !== -1) {
             // Dobbiamo assicurarci di avere la struttura corretta
             const userToSave = { ...localUsers[idx], utilities: [...localUsers[idx].utilities, newUtility] };
             localUsers[idx] = userToSave;
             saveLocalUsers(localUsers);
          }
          return updatedUser;
      }
      return null;
  }
  
  // Local Fallback (Offline puro)
  // Qui dobbiamo fare attenzione se il file è enorme >5MB crasha tutto.
  if (attachmentData && attachmentData.length > 2 * 1024 * 1024) {
      console.warn("File troppo grande per modalità offline. Salvataggio metadati only.");
      newUtility.attachmentData = undefined;
      newUtility.attachmentName += " (Non salvato localmente: troppo grande)";
  }

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
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.id === userId) {
        const utilities = [...(currentUser.utilities || [])];
        const utilIndex = utilities.findIndex(u => u.id === utilityId);
        
        if (utilIndex > -1) {
            utilities[utilIndex] = { ...utilities[utilIndex], status: newStatus };
            const updatedUser = { ...currentUser, utilities };
            updateLocalSession(updatedUser);
            
            if (DB_MODE === 'GOOGLE_SHEETS' && isGsConfigured()) {
                 googleSheetsClient.post('updateUtilityStatus', { 
                     userId, 
                     utilityId, 
                     status: newStatus 
                 }).catch(err => console.error("Failed to sync utility status", err));
            }
            
            return updatedUser;
        }
  }
  return currentUser;
};

export const adminUpdateUtilityStatus = async (
  targetUserId: string,
  utilityId: string,
  newStatus: Utility['status']
): Promise<boolean> => {
  
  const localUsers = getLocalUsers();
  const userIndex = localUsers.findIndex(u => u.id === targetUserId);
  
  if (userIndex > -1) {
      const user = localUsers[userIndex];
      const utilIndex = user.utilities.findIndex(u => u.id === utilityId);
      
      if (utilIndex > -1) {
          user.utilities[utilIndex].status = newStatus;
          localUsers[userIndex] = user;
          saveLocalUsers(localUsers);
          
          const currentUser = getCurrentUser();
          if (currentUser && currentUser.id === targetUserId) {
              updateLocalSession(user);
          }
      }
  }

  if (DB_MODE === 'GOOGLE_SHEETS' && isGsConfigured()) {
      try {
          await googleSheetsClient.post('updateUtilityStatus', { 
               userId: targetUserId, 
               utilityId, 
               status: newStatus 
           });
           return true;
      } catch (err) {
          console.error("Failed to sync utility status (Admin)", err);
          return false;
      }
  }
  
  return true;
};

export const loginUser = async (username: string, password: string): Promise<User | null> => {
  const safeUsername = username.trim().toLowerCase();
  const safePassword = password.trim();

  // 1. Fetch Utenti (Smart: Cloud + Merge Local Pending)
  // Questo scarica le immagini dal cloud se presenti
  const users = await getUsers();
  
  const user = users.find(u => 
      String(u.username).toLowerCase() === safeUsername && 
      String(u.password) === safePassword
  );
  
  if (user) {
    // Salviamo in sessione (versione lite) ma ritorniamo full in memoria
    updateLocalSession(user);
    return user;
  }

  // 3. EXTREME FALLBACK
  if (DB_MODE === 'GOOGLE_SHEETS') {
      const localUsers = getLocalUsers();
      const localUser = localUsers.find(u => 
          String(u.username).toLowerCase() === safeUsername && 
          String(u.password) === safePassword
      );
      if (localUser) {
          updateLocalSession(localUser);
          return localUser;
      }
  }

  return null;
};

export const logoutUser = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUser = (): User | null => {
  const stored = localStorage.getItem(CURRENT_USER_KEY);
  if (!stored) return null;
  try {
      return JSON.parse(stored);
  } catch {
      return null;
  }
};

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
