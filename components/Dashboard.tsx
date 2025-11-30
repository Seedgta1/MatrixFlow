
import React, { useEffect, useState } from 'react';
import { User, MatrixNode, UtilityType, AvatarConfig, Utility } from '../types';
import { buildTree, logoutUser, registerUser, getNetworkStats, addUtility, getReferralLink, updateUser, updateUtilityStatus, getUsers, adminUpdateUtilityStatus } from '../services/matrixService';
import { analyzeNetwork, extractBillData } from '../services/geminiService';
import TreeVisualizer from './TreeVisualizer';
import MatrixBackground from './MatrixBackground';
import { Activity, Users, GitMerge, LogOut, Cpu, Search, UserPlus, Zap, Flame, PlusCircle, LayoutDashboard, Upload, FileText, Loader2, Paperclip, Link, Copy, Check, Settings, ShieldCheck, User as UserIcon, Mail, Phone, Palette, Dices, Save, Pencil, X, ChevronDown, RefreshCcw, Cloud, CloudOff, AlertTriangle, Trash2, Eye, Shield } from 'lucide-react';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const AVATAR_STYLES = [
  { id: 'bottts-neutral', name: 'Robots' },
  { id: 'avataaars', name: 'Humans' },
  { id: 'shapes', name: 'Abstract' },
  { id: 'adventurer', name: 'Adventurer' },
  { id: 'fun-emoji', name: 'Emoji' },
  { id: 'lorelei', name: 'Artistic' }
];

const BG_COLORS = [
  { id: 'transparent', color: 'transparent', label: 'None' },
  { id: 'b6e3f4', color: '#b6e3f4', label: 'Blue' },
  { id: 'c0aede', color: '#c0aede', label: 'Purple' },
  { id: 'd1d4f9', color: '#d1d4f9', label: 'Indigo' },
  { id: 'ffd5dc', color: '#ffd5dc', label: 'Pink' },
  { id: 'ffdfbf', color: '#ffdfbf', label: 'Orange' },
];

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [treeData, setTreeData] = useState<MatrixNode | null>(null);
  const [stats, setStats] = useState({ totalUsers: 0, matrixDepth: 0, totalUtilities: 0 });
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [activeTab, setActiveTab] = useState<'network' | 'utilities' | 'settings' | 'admin'>('network');
  const [referralLink, setReferralLink] = useState('');
  const [copied, setCopied] = useState(false);
  
  const [newUsername, setNewUsername] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [addMessage, setAddMessage] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const [utilType, setUtilType] = useState<UtilityType>('Luce');
  const [utilProvider, setUtilProvider] = useState('');
  const [utilMessage, setUtilMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Modal View Utility
  const [viewingUtility, setViewingUtility] = useState<Utility | null>(null);

  const [currentUser, setCurrentUser] = useState<User>(user);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadingTimer, setLoadingTimer] = useState(0);
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'offline'>('offline');

  // Avatar Editor State
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(user.avatarConfig || { style: 'bottts-neutral', seed: user.username, backgroundColor: 'transparent' });
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);

  // Profile Edit State
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editEmail, setEditEmail] = useState(user.email);
  const [editPhone, setEditPhone] = useState(user.phone);
  const [contactMessage, setContactMessage] = useState('');

  // Admin State
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [adminSearch, setAdminSearch] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const refreshData = async () => {
    setLoadError(false);
    try {
      // 1. Fetch fresh data (Cloud prioritized)
      // This ensures we get the full attachments if they were stripped locally
      const allFetchedUsers = await getUsers();
      
      const freshMe = allFetchedUsers.find(u => u.id === currentUser.id);
      if (freshMe) {
          setCurrentUser(freshMe);
      }

      setCloudStatus('connected'); 
      
      // 2. Build Tree
      const tree = await buildTree(currentUser.id);
      setTreeData(tree);

      const networkStats = await getNetworkStats();
      setStats(networkStats);
      setReferralLink(getReferralLink(currentUser.username));

      if (activeTab === 'admin' && currentUser.username === 'admin') {
          setAllUsers(allFetchedUsers);
      }
    } catch (e) {
      console.error("Error refreshing data", e);
      setCloudStatus('offline');
      setLoadError(true);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    refreshData();
    const timer = setInterval(() => {
        setLoadingTimer(prev => prev + 1);
    }, 1000);
    
    setEditEmail(currentUser.email);
    setEditPhone(currentUser.phone);
    return () => clearInterval(timer);
  }, [currentUser.id, activeTab]);

  const handleAiAnalyze = async () => {
    if (!treeData) return;
    setIsAnalyzing(true);
    setAiAnalysis("L'IA sta analizzando la tua matrice e il portafoglio utenze...");
    const result = await analyzeNetwork(treeData);
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPhone) {
        setAddMessage("Email e Telefono sono obbligatori");
        return;
    }
    setIsRegistering(true);
    setAddMessage(''); 
    try {
        const res = await registerUser(newUsername, newUserPass, currentUser.username, newUserEmail, newUserPhone);
        if (res.success) {
          setAddMessage(res.message);
          setNewUsername('');
          setNewUserPass('');
          setNewUserEmail('');
          setNewUserPhone('');
          await refreshData();
          setTimeout(() => setShowAddUser(false), 1500);
        } else {
          setAddMessage(`Errore: ${res.message}`);
          setCloudStatus('offline'); 
        }
    } catch (error) {
        setAddMessage("Errore imprevisto durante la registrazione.");
    } finally {
        setIsRegistering(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Warning only, no longer blocking
      if (file.size > 5 * 1024 * 1024) {
          alert("Nota: Il file è grande (>5MB). Potrebbe richiedere più tempo per il caricamento.");
      }

      setSelectedFile(file);
      setIsProcessingFile(true);
      setUtilMessage("Analisi documento con Gemini AI in corso...");

      const reader = new FileReader();
      reader.onload = async () => {
        try {
            const base64String = (reader.result as string).split(',')[1];
            setFilePreview(reader.result as string); // Save preview for UI

            const result = await extractBillData(base64String, file.type);
            
            if (result.error) {
               setUtilMessage("Analisi fallita: inserisci i dati manualmente.");
            } else {
               if (result.provider) setUtilProvider(result.provider);
               if (result.type) setUtilType(result.type);
               setUtilMessage("Dati estratti automaticamente dalla bolletta! Verifica e conferma.");
            }
        } catch (err) {
            setUtilMessage("Errore caricamento file.");
        } finally {
            setIsProcessingFile(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const clearUpload = () => {
      setSelectedFile(null);
      setFilePreview(null);
      setUtilProvider('');
      setUtilMessage('');
      setIsProcessingFile(false);
  };

  const handleAddUtility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utilProvider.trim()) return;

    setUtilMessage("Salvataggio in corso...");
    try {
        const updatedUser = await addUtility(
            currentUser.id, 
            utilType, 
            utilProvider, 
            selectedFile?.name, 
            selectedFile?.type,
            filePreview || undefined // Pass the base64 data to store
        );

        if (updatedUser) {
            setCurrentUser(updatedUser);
            setUtilMessage('Utenza inserita con successo!');
            setUtilProvider('');
            setSelectedFile(null);
            setFilePreview(null);
            setTimeout(() => setUtilMessage(''), 2000);
        } else {
            setUtilMessage('Errore inserimento (Verifica connessione).');
        }
    } catch (e) {
        console.error(e);
        setUtilMessage('Errore critico di sistema durante il salvataggio.');
    }
  };

  // User Self-Management
  const handleStatusChange = async (utilityId: string, newStatus: string) => {
    const updatedUser = await updateUtilityStatus(
      currentUser.id,
      utilityId,
      newStatus as Utility['status']
    );
    if (updatedUser) {
      setCurrentUser(updatedUser);
    }
  };

  // Admin Management
  const handleAdminStatusChange = async (targetUserId: string, utilityId: string, newStatus: string) => {
      const success = await adminUpdateUtilityStatus(targetUserId, utilityId, newStatus as Utility['status']);
      if (success) {
          // Refresh list locally
          setAllUsers(prev => prev.map(u => {
              if (u.id === targetUserId) {
                  return {
                      ...u,
                      utilities: u.utilities.map(util => 
                          util.id === utilityId ? { ...util, status: newStatus as Utility['status'] } : util
                      )
                  };
              }
              return u;
          }));
      }
  };

  const handleSaveAvatar = async () => {
    setIsSavingAvatar(true);
    const updated = await updateUser(currentUser.id, { avatarConfig });
    if (updated) {
        setCurrentUser(updated);
    }
    setTimeout(() => setIsSavingAvatar(false), 800);
  };

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = await updateUser(currentUser.id, { email: editEmail, phone: editPhone });
    if (updated) {
      setCurrentUser(updated);
      setContactMessage('Contatti aggiornati!');
      setTimeout(() => {
        setContactMessage('');
        setIsEditingContact(false);
      }, 1000);
    } else {
      setContactMessage('Errore aggiornamento.');
    }
  };

  const handleHardReset = () => {
    if(confirm("Attenzione: questo cancellerà i dati locali e ti disconnetterà. Utile se l'app è bloccata. Continuare?")) {
        localStorage.clear();
        window.location.reload();
    }
  };

  const randomizeAvatar = () => {
    setAvatarConfig(prev => ({
        ...prev,
        seed: Math.random().toString(36).substring(7)
    }));
  };

  const getAvatarUrl = (config: AvatarConfig) => {
    return `https://api.dicebear.com/9.x/${config.style}/svg?seed=${config.seed}&backgroundColor=${config.backgroundColor}`;
  };

  const currentAvatarUrl = getAvatarUrl(currentUser.avatarConfig || { style: 'bottts-neutral', seed: currentUser.username, backgroundColor: 'transparent' });

  if (isLoadingData) {
      return (
          <div className="min-h-screen bg-black flex items-center justify-center text-white relative">
              <div className="flex flex-col items-center gap-6 p-8 glass-card rounded-2xl">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-white mb-1">Connessione Matrix in corso...</p>
                    <p className="text-xs text-slate-500">Sincronizzazione dati cloud</p>
                  </div>
                  
                  {loadingTimer > 8 && (
                      <div className="animate-enter flex flex-col items-center gap-3 mt-2">
                        <p className="text-xs text-amber-400">Rilevata latenza elevata.</p>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => { logoutUser(); onLogout(); }}
                                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                            >
                                <LogOut className="w-3 h-3" /> Logout
                            </button>
                            <button 
                                onClick={handleHardReset}
                                className="px-3 py-2 bg-red-900/50 hover:bg-red-800 text-red-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Trash2 className="w-3 h-3" /> Reset App
                            </button>
                        </div>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  const filteredUsers = allUsers.filter(u => 
      u.username.toLowerCase().includes(adminSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(adminSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-black relative overflow-hidden text-slate-200">
      
      {/* Dynamic Background with Matrix Effect */}
      <div className="fixed inset-0 z-0">
         <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-indigo-600/20 rounded-full blur-[120px] animate-float"></div>
         <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-purple-600/10 rounded-full blur-[120px] animate-float" style={{animationDelay: '3s'}}></div>
         <MatrixBackground />
         <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
      </div>

      <div className="relative z-10 pb-36 md:pb-8"> 
        
        {/* Navbar */}
        <nav className="border-b border-white/5 bg-black/60 sticky top-0 z-40 backdrop-blur-xl safe-area-top">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                {/* Small Animated Logo - Clickable to Home */}
                <button 
                   onClick={() => setActiveTab('network')}
                   className="w-10 h-10 relative cursor-pointer hover:scale-105 transition-transform"
                   title="Home Network"
                >
                   <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]">
                      <defs>
                        <linearGradient id="logoNavGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                      </defs>
                      <g className="origin-center animate-spin-slow">
                        <path d="M50 5 L93.3 30 V80 L50 105 L6.7 80 V30 Z" fill="none" stroke="url(#logoNavGrad)" strokeWidth="3" strokeDasharray="10 5" transform="scale(0.8) translate(12.5, 12.5)" />
                      </g>
                      <g className="origin-center">
                        <circle cx="50" cy="50" r="10" fill="url(#logoNavGrad)" className="animate-pulse" />
                      </g>
                   </svg>
                </button>
                {/* Hide Text on small mobile to save space */}
                <span className="hidden sm:block text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                  MatrixFlow
                </span>
                
                {/* Cloud Status Indicator */}
                <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-full border border-white/5 ml-2">
                    {cloudStatus === 'connected' ? (
                        <>
                           <Cloud className="w-3 h-3 text-emerald-400" />
                           <span className="text-[10px] text-emerald-400 font-bold hidden md:inline">ONLINE</span>
                        </>
                    ) : (
                        <>
                           <CloudOff className="w-3 h-3 text-red-400" />
                           <span className="text-[10px] text-red-400 font-bold hidden md:inline">OFFLINE</span>
                        </>
                    )}
                </div>

              </div>
              <div className="flex items-center gap-4 md:gap-6">
                {/* Desktop Tabs */}
                <div className="hidden md:flex gap-1 bg-white/5 p-1 rounded-lg border border-white/5">
                    {['network', 'utilities', 'settings'].map((tab) => (
                        <button 
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-300 capitalize ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                        >
                            {tab === 'network' ? 'Network' : tab === 'utilities' ? 'Portafoglio' : 'Impostazioni'}
                        </button>
                    ))}
                    {currentUser.username === 'admin' && (
                        <button 
                            onClick={() => setActiveTab('admin')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-1 ${activeTab === 'admin' ? 'bg-red-600/80 text-white shadow-lg shadow-red-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <Shield className="w-3 h-3" /> Admin
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3 md:gap-4 pl-4 md:border-l border-white/10">
                    <div className="flex items-center gap-2">
                        <img src={currentAvatarUrl} alt="User" className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-slate-800 border border-white/20" />
                        <div className="flex flex-col text-right">
                           <span className="text-xs font-bold text-white leading-tight max-w-[80px] truncate">{currentUser.username}</span>
                           <span className="text-[10px] text-emerald-400 font-mono hidden sm:inline-block">LIVELLO {currentUser.level}</span>
                        </div>
                    </div>
                    <button 
                      onClick={() => { logoutUser(); onLogout(); }}
                      className="p-2 rounded-full hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
                      title="Logout"
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          
          {/* TABS CONTENT */}
          {activeTab === 'network' && (
             <div className="space-y-6 animate-enter">
                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div className="glass-card p-5 rounded-2xl flex items-center gap-4 border border-white/5">
                      <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400">
                         <Users className="w-6 h-6" />
                      </div>
                      <div>
                         <div className="text-sm text-slate-400 font-medium">Totale Utenti</div>
                         <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
                      </div>
                   </div>
                   <div className="glass-card p-5 rounded-2xl flex items-center gap-4 border border-white/5">
                      <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400">
                         <GitMerge className="w-6 h-6" />
                      </div>
                      <div>
                         <div className="text-sm text-slate-400 font-medium">Profondità Matrice</div>
                         <div className="text-2xl font-bold text-white">{stats.matrixDepth} / 10</div>
                      </div>
                   </div>
                   <div className="glass-card p-5 rounded-2xl flex items-center gap-4 border border-white/5">
                      <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400">
                         <Activity className="w-6 h-6" />
                      </div>
                      <div>
                         <div className="text-sm text-slate-400 font-medium">Utenze Totali</div>
                         <div className="text-2xl font-bold text-white">{stats.totalUtilities}</div>
                      </div>
                   </div>
                </div>

                {/* AI Analysis & Actions */}
                <div className="flex flex-col md:flex-row gap-4">
                   <div className="flex-1 glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 opacity-10">
                         <Cpu className="w-24 h-24" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                         <Cpu className="w-5 h-5 text-indigo-400" /> Analisi AI Gemini
                      </h3>
                      <p className="text-slate-300 text-sm leading-relaxed mb-4 min-h-[60px]">
                         {aiAnalysis || "Clicca su analizza per ricevere un report strategico sulla tua rete dalla nostra IA."}
                      </p>
                      <button 
                         onClick={handleAiAnalyze}
                         disabled={isAnalyzing}
                         className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                         {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                         {isAnalyzing ? 'Analisi in corso...' : 'Analizza Rete'}
                      </button>
                   </div>

                   <div className="flex-1 glass-card p-6 rounded-2xl border border-white/5 flex flex-col justify-center">
                       <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                          <UserPlus className="w-5 h-5 text-emerald-400" /> Referral
                       </h3>
                       <div className="flex items-center gap-2 bg-slate-900/50 p-3 rounded-xl border border-slate-700 mb-3">
                          <Link className="w-4 h-4 text-slate-500" />
                          <input type="text" readOnly value={referralLink} className="bg-transparent border-none text-slate-300 text-xs w-full focus:outline-none" />
                          <button onClick={copyToClipboard} className="text-slate-400 hover:text-white">
                              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                       </div>
                       <button 
                         onClick={() => setShowAddUser(!showAddUser)}
                         className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition-all"
                       >
                         Registra Nuovo Utente Manualmente
                       </button>
                   </div>
                </div>
                
                {/* Add User Form (Collapsible) */}
                {showAddUser && (
                    <div className="glass-card p-6 rounded-2xl border border-white/5 animate-enter">
                        <h3 className="text-lg font-bold text-white mb-4">Registrazione Manuale</h3>
                        <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input type="text" placeholder="Username" required value={newUsername} onChange={e => setNewUsername(e.target.value)} className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white" />
                            <input type="password" placeholder="Password" required value={newUserPass} onChange={e => setNewUserPass(e.target.value)} className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white" />
                            <input type="email" placeholder="Email" required value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white" />
                            <input type="tel" placeholder="Telefono" required value={newUserPhone} onChange={e => setNewUserPhone(e.target.value)} className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white" />
                            <div className="md:col-span-2">
                                <button type="submit" disabled={isRegistering} className="px-6 py-2 bg-white text-slate-900 font-bold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
                                    {isRegistering && <Loader2 className="w-4 h-4 animate-spin"/>} Registra
                                </button>
                                {addMessage && <span className={`ml-4 text-sm font-medium ${addMessage.startsWith('Errore') ? 'text-red-400' : 'text-emerald-400'}`}>{addMessage}</span>}
                            </div>
                        </form>
                    </div>
                )}

                {/* Tree Visualization */}
                <div className="h-[600px] w-full">
                    {treeData && <TreeVisualizer data={treeData} />}
                </div>
             </div>
          )}

          {activeTab === 'utilities' && (
              <div className="animate-enter max-w-4xl mx-auto space-y-6">
                 {/* Add Utility */}
                 <div className="glass-card p-6 rounded-2xl border border-white/5">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <PlusCircle className="w-6 h-6 text-indigo-400" /> Aggiungi Utenza
                    </h2>
                    
                    <div className="mb-6 p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-xl">
                        <div className="flex flex-col md:flex-row items-center gap-4">
                            <div className="flex-1 w-full">
                                <label className="block text-xs font-bold text-indigo-300 uppercase mb-2">Carica Bolletta (AI Scan)</label>
                                
                                {!filePreview ? (
                                    <div className="relative group h-40">
                                        <input type="file" accept="image/*,application/pdf" onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                        <div className="w-full h-full bg-slate-900/50 border-2 border-dashed border-slate-600 rounded-xl p-4 flex flex-col items-center justify-center gap-3 group-hover:border-indigo-500 transition-colors">
                                            <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-400" />
                                            <div className="text-center">
                                                <span className="block text-sm text-slate-400 group-hover:text-white font-medium">Trascina o clicca</span>
                                                <span className="text-[10px] text-slate-500">PDF o Immagine</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative h-40 bg-slate-900 rounded-xl overflow-hidden border border-slate-700 group">
                                        {/* Preview Image or Icon */}
                                        {selectedFile?.type.includes('image') ? (
                                            <img src={filePreview} alt="Preview" className="w-full h-full object-cover opacity-80" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-800">
                                                <FileText className="w-12 h-12 text-slate-400" />
                                                <span className="text-xs text-slate-300">{selectedFile?.name}</span>
                                            </div>
                                        )}
                                        
                                        {/* Overlay Actions */}
                                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                             <button onClick={clearUpload} className="bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-full mb-2">
                                                 <X className="w-5 h-5" />
                                             </button>
                                             <span className="text-xs font-bold text-white">Rimuovi File</span>
                                        </div>

                                        {/* Loading Overlay */}
                                        {isProcessingFile && (
                                            <div className="absolute inset-0 bg-indigo-900/80 flex flex-col items-center justify-center z-20">
                                                <Loader2 className="w-8 h-8 animate-spin text-white mb-2" />
                                                <span className="text-xs font-bold text-white animate-pulse">Analisi IA in corso...</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            <div className="hidden md:block text-slate-600 font-bold self-center">O</div>
                            
                            <div className="flex-1 w-full space-y-3">
                                <form onSubmit={handleAddUtility}>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Tipo Utenza</label>
                                            <select value={utilType} onChange={(e) => setUtilType(e.target.value as UtilityType)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none">
                                                <option value="Luce">Luce</option>
                                                <option value="Gas">Gas</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Fornitore</label>
                                            <input type="text" placeholder="Es. Enel, Eni" value={utilProvider} onChange={e => setUtilProvider(e.target.value)} className={`w-full bg-slate-900/50 border rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none ${isProcessingFile ? 'animate-pulse' : 'border-slate-700'}`} />
                                        </div>
                                    </div>
                                    <button type="submit" disabled={isProcessingFile} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20">
                                        {isProcessingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        {isProcessingFile ? 'Analisi...' : 'Salva Utenza'}
                                    </button>
                                </form>
                            </div>
                        </div>
                        {utilMessage && (
                            <div className={`mt-3 text-center text-xs font-bold px-3 py-2 rounded-lg ${utilMessage.includes('Errore') || utilMessage.includes('fallita') ? 'bg-red-500/10 text-red-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
                                {utilMessage}
                            </div>
                        )}
                    </div>
                 </div>

                 {/* List Utilities */}
                 <div className="grid grid-cols-1 gap-4">
                    {currentUser.utilities.length === 0 ? (
                        <div className="text-center p-10 text-slate-500 border border-dashed border-slate-700 rounded-xl">
                            <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                            Nessuna utenza inserita.
                        </div>
                    ) : (
                        currentUser.utilities.map(util => (
                            <div key={util.id} className="glass-card p-5 rounded-xl border border-white/5 flex items-center justify-between group hover:border-white/10 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full ${util.type === 'Luce' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                        {util.type === 'Luce' ? <Zap className="w-6 h-6" /> : <Flame className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white text-lg">{util.provider}</div>
                                        <div className="text-xs text-slate-400 flex items-center gap-2">
                                            <span>{new Date(util.dateAdded).toLocaleDateString()}</span>
                                            {util.attachmentName && (
                                                <span className="flex items-center gap-1 text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded text-[10px] max-w-[100px] truncate">
                                                    <Paperclip className="w-3 h-3" /> {util.attachmentName}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className="flex items-center gap-2">
                                        {/* View Attachment Button */}
                                        {(util.attachmentData || util.attachmentName) && (
                                            <button 
                                                onClick={() => setViewingUtility(util)}
                                                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                title="Vedi Bolletta"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        )}
                                        
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                                            util.status === 'Attiva' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                                            util.status === 'Rifiutata' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                            'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                        }`}>
                                            {util.status}
                                        </span>
                                    </div>
                                    
                                    {/* Admin Action Only */}
                                    {currentUser.username === 'admin' && util.status === 'In Lavorazione' && (
                                        <div className="flex gap-1 animate-enter">
                                            <button onClick={() => handleStatusChange(util.id, 'Attiva')} className="p-1 hover:bg-emerald-500/20 rounded text-emerald-500"><Check className="w-4 h-4"/></button>
                                            <button onClick={() => handleStatusChange(util.id, 'Rifiutata')} className="p-1 hover:bg-red-500/20 rounded text-red-500"><X className="w-4 h-4"/></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                 </div>
              </div>
          )}

          {activeTab === 'admin' && currentUser.username === 'admin' && (
              <div className="animate-enter max-w-5xl mx-auto">
                  <div className="glass-card p-6 rounded-2xl border border-white/5 mb-6">
                      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                          <h2 className="text-xl font-bold text-white flex items-center gap-2">
                              <Shield className="w-6 h-6 text-red-500" /> Pannello Admin Master
                          </h2>
                          <div className="relative w-full md:w-64">
                              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                              <input 
                                type="text" 
                                placeholder="Cerca utente..." 
                                value={adminSearch}
                                onChange={(e) => setAdminSearch(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-red-500"
                              />
                          </div>
                      </div>

                      <div className="space-y-4">
                          {filteredUsers.length === 0 ? (
                              <div className="text-center py-8 text-slate-500">Nessun utente trovato</div>
                          ) : (
                              filteredUsers.map(u => (
                                  <div key={u.id} className="bg-slate-900/40 rounded-xl border border-white/5 overflow-hidden">
                                      <div 
                                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                                          onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                                      >
                                          <div className="flex items-center gap-4">
                                              <img src={getAvatarUrl(u.avatarConfig || { style: 'bottts-neutral', seed: u.username, backgroundColor: 'transparent' })} className="w-10 h-10 rounded-full bg-slate-800" />
                                              <div>
                                                  <div className="font-bold text-white">{u.username} <span className="text-slate-500 text-xs font-normal">({u.id})</span></div>
                                                  <div className="text-xs text-slate-400 flex gap-3">
                                                      <span className="flex items-center gap-1"><Mail className="w-3 h-3"/> {u.email}</span>
                                                      <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> {u.phone}</span>
                                                  </div>
                                              </div>
                                          </div>
                                          <div className="flex items-center gap-4">
                                              <div className="text-right">
                                                  <div className="text-xs text-slate-500 uppercase font-bold">Utenze</div>
                                                  <div className="text-lg font-bold text-white">{u.utilities.length}</div>
                                              </div>
                                              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedUser === u.id ? 'rotate-180' : ''}`} />
                                          </div>
                                      </div>

                                      {expandedUser === u.id && (
                                          <div className="p-4 bg-black/20 border-t border-white/5 space-y-3">
                                              {u.utilities.length === 0 ? (
                                                  <div className="text-center text-xs text-slate-600 py-2">Nessuna utenza caricata da questo utente.</div>
                                              ) : (
                                                  u.utilities.map(util => (
                                                      <div key={util.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-white/5">
                                                          <div className="flex items-center gap-3">
                                                              <div className={`p-2 rounded-full ${util.type === 'Luce' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                                  {util.type === 'Luce' ? <Zap className="w-4 h-4" /> : <Flame className="w-4 h-4" />}
                                                              </div>
                                                              <div>
                                                                  <div className="font-bold text-white text-sm">{util.provider}</div>
                                                                  <div className="text-[10px] text-slate-400">{new Date(util.dateAdded).toLocaleDateString()}</div>
                                                              </div>
                                                          </div>
                                                          
                                                          <div className="flex items-center gap-3">
                                                              {/* File View */}
                                                              {(util.attachmentData || util.attachmentName) && (
                                                                  <button 
                                                                      onClick={(e) => { e.stopPropagation(); setViewingUtility(util); }}
                                                                      className="flex items-center gap-1 text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-slate-300"
                                                                  >
                                                                      <Eye className="w-3 h-3" /> Vedi Doc
                                                                  </button>
                                                              )}

                                                              <div className="flex items-center gap-1">
                                                                  {util.status === 'In Lavorazione' ? (
                                                                      <>
                                                                          <button onClick={() => handleAdminStatusChange(u.id, util.id, 'Attiva')} className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-md transition-colors" title="Approva">
                                                                              <Check className="w-4 h-4" />
                                                                          </button>
                                                                          <button onClick={() => handleAdminStatusChange(u.id, util.id, 'Rifiutata')} className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-md transition-colors" title="Rifiuta">
                                                                              <X className="w-4 h-4" />
                                                                          </button>
                                                                      </>
                                                                  ) : (
                                                                      <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                                                                          util.status === 'Attiva' ? 'border-emerald-500/30 text-emerald-400' : 'border-red-500/30 text-red-400'
                                                                      }`}>
                                                                          {util.status}
                                                                      </span>
                                                                  )}
                                                              </div>
                                                          </div>
                                                      </div>
                                                  ))
                                              )}
                                          </div>
                                      )}
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'settings' && (
              <div className="animate-enter max-w-2xl mx-auto space-y-6">
                  {/* Profile & Avatar */}
                  <div className="glass-card p-6 rounded-2xl border border-white/5">
                      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                          <UserIcon className="w-6 h-6 text-indigo-400" /> Profilo & Avatar
                      </h2>

                      <div className="flex flex-col items-center mb-6">
                          <div className="relative group cursor-pointer" onClick={randomizeAvatar}>
                             <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-indigo-500 overflow-hidden mb-3 shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                                 <img src={currentAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                             </div>
                             <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Dices className="w-8 h-8 text-white" />
                             </div>
                          </div>
                          
                          <div className="flex gap-2 mb-4 overflow-x-auto w-full justify-center pb-2">
                              {AVATAR_STYLES.map(style => (
                                  <button
                                      key={style.id}
                                      onClick={() => setAvatarConfig({...avatarConfig, style: style.id})}
                                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${avatarConfig.style === style.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                  >
                                      {style.name}
                                  </button>
                              ))}
                          </div>
                          
                          <button 
                             onClick={handleSaveAvatar} 
                             disabled={isSavingAvatar}
                             className="px-4 py-2 bg-white text-black text-sm font-bold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
                          >
                             {isSavingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                             Salva Avatar
                          </button>
                      </div>
                  </div>

                  {/* Contacts */}
                  <div className="glass-card p-6 rounded-2xl border border-white/5">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                              <Mail className="w-5 h-5 text-purple-400" /> Contatti
                          </h3>
                          <button onClick={() => setIsEditingContact(!isEditingContact)} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1">
                              <Pencil className="w-3 h-3" /> Modifica
                          </button>
                      </div>

                      {isEditingContact ? (
                          <form onSubmit={handleUpdateContact} className="space-y-4">
                              <div>
                                  <label className="text-xs text-slate-500 uppercase font-bold">Email</label>
                                  <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white mt-1" />
                              </div>
                              <div>
                                  <label className="text-xs text-slate-500 uppercase font-bold">Telefono</label>
                                  <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white mt-1" />
                              </div>
                              <div className="flex gap-2">
                                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-bold text-sm">Salva</button>
                                  <button type="button" onClick={() => setIsEditingContact(false)} className="flex-1 bg-slate-800 text-slate-400 py-2 rounded-lg font-bold text-sm">Annulla</button>
                              </div>
                          </form>
                      ) : (
                          <div className="space-y-3">
                              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-white/5">
                                  <span className="text-sm text-slate-400">Email</span>
                                  <span className="text-sm text-white font-mono">{currentUser.email}</span>
                              </div>
                              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-white/5">
                                  <span className="text-sm text-slate-400">Telefono</span>
                                  <span className="text-sm text-white font-mono">{currentUser.phone}</span>
                              </div>
                          </div>
                      )}
                      {contactMessage && <div className="mt-3 text-center text-xs text-emerald-400 font-bold">{contactMessage}</div>}
                  </div>

                  {/* Danger Zone */}
                  <div className="glass-card p-6 rounded-2xl border border-red-900/30 bg-red-950/10">
                      <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" /> Zona Pericolo
                      </h3>
                      <p className="text-xs text-slate-400 mb-4">Se l'applicazione non risponde o i dati sembrano corrotti, puoi forzare un reset locale. Questo ti disconnetterà.</p>
                      <button onClick={handleHardReset} className="w-full py-3 bg-red-900/50 hover:bg-red-800 text-red-200 font-bold rounded-lg transition-colors border border-red-700/50 flex items-center justify-center gap-2">
                          <Trash2 className="w-4 h-4" /> Reset Applicazione
                      </button>
                  </div>
              </div>
          )}

          {/* Utility Viewer Modal */}
          {viewingUtility && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-enter">
                  <div className="bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-white/10 shadow-2xl">
                      <div className="flex justify-between items-center p-4 border-b border-white/5">
                          <h3 className="font-bold text-white flex items-center gap-2">
                              <FileText className="w-5 h-5 text-indigo-400" />
                              {viewingUtility.attachmentName || 'Documento'}
                          </h3>
                          <button onClick={() => setViewingUtility(null)} className="text-slate-400 hover:text-white p-1">
                              <X className="w-6 h-6" />
                          </button>
                      </div>
                      
                      <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/50">
                          {viewingUtility.attachmentData ? (
                              viewingUtility.attachmentType?.includes('image') ? (
                                  <img src={viewingUtility.attachmentData} alt="Bill" className="max-w-full rounded-lg shadow-lg" />
                              ) : (
                                  <iframe src={viewingUtility.attachmentData} className="w-full h-[500px] rounded-lg border-none" title="PDF Preview"></iframe>
                              )
                          ) : (
                              <div className="text-center py-10 text-slate-500">
                                  <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                  Anteprima non disponibile (File troppo grande o rimosso).
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          )}

        </main>
        
        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/10 safe-area-bottom">
            <div className="flex justify-around items-center h-16 px-2">
                <button 
                    onClick={() => setActiveTab('network')}
                    className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'network' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <div className={`p-1 rounded-full ${activeTab === 'network' ? 'bg-indigo-500/20' : ''}`}>
                        <LayoutDashboard className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-medium">Network</span>
                </button>

                <button 
                    onClick={() => setActiveTab('utilities')}
                    className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'utilities' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                     <div className={`p-1 rounded-full ${activeTab === 'utilities' ? 'bg-indigo-500/20' : ''}`}>
                        <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-medium">Utenze</span>
                </button>

                {currentUser.username === 'admin' && (
                    <button 
                        onClick={() => setActiveTab('admin')}
                        className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'admin' ? 'text-red-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                         <div className={`p-1 rounded-full ${activeTab === 'admin' ? 'bg-red-500/20' : ''}`}>
                            <Shield className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-medium">Admin</span>
                    </button>
                )}

                <button 
                    onClick={() => setActiveTab('settings')}
                    className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'settings' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                     <div className={`p-1 rounded-full ${activeTab === 'settings' ? 'bg-indigo-500/20' : ''}`}>
                        <Settings className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-medium">Opzioni</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
