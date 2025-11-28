
import React, { useEffect, useState } from 'react';
import { User, MatrixNode, UtilityType, AvatarConfig, Utility } from '../types';
import { buildTree, logoutUser, registerUser, getNetworkStats, addUtility, getReferralLink, updateUser, updateUtilityStatus } from '../services/matrixService';
import { analyzeNetwork, extractBillData } from '../services/geminiService';
import TreeVisualizer from './TreeVisualizer';
import MatrixBackground from './MatrixBackground';
import { Activity, Users, GitMerge, LogOut, Cpu, Search, UserPlus, Zap, Flame, PlusCircle, LayoutDashboard, Upload, FileText, Loader2, Paperclip, Link, Copy, Check, Settings, ShieldCheck, User as UserIcon, Mail, Phone, Palette, Dices, Save, Pencil, X, ChevronDown, RefreshCcw, Cloud, CloudOff, AlertTriangle, Trash2 } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'network' | 'utilities' | 'settings'>('network');
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
  const [isProcessingFile, setIsProcessingFile] = useState(false);

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

  const refreshData = async () => {
    setLoadError(false);
    try {
      const tree = await buildTree(currentUser.id);
      
      setCloudStatus('connected'); 
      
      setTreeData(tree);
      const networkStats = await getNetworkStats();
      setStats(networkStats);
      setReferralLink(getReferralLink(currentUser.username));
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
  }, [currentUser.id]);

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
      setSelectedFile(file);
      setIsProcessingFile(true);
      setUtilMessage("Analisi documento con Gemini AI in corso...");

      const reader = new FileReader();
      reader.onload = async () => {
        try {
            const base64String = (reader.result as string).split(',')[1];
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
            selectedFile?.type
        );

        if (updatedUser) {
            setCurrentUser(updatedUser);
            setUtilMessage('Utenza inserita con successo!');
            setUtilProvider('');
            setSelectedFile(null);
            setTimeout(() => setUtilMessage(''), 2000);
        } else {
            setUtilMessage('Errore inserimento (Verifica connessione).');
        }
    } catch (e) {
        setUtilMessage('Errore di rete.');
    }
  };

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
          <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white relative">
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

  return (
    <div className="min-h-screen bg-[#020617] relative overflow-hidden text-slate-200">
      
      {/* Dynamic Background with Matrix Effect */}
      <div className="fixed inset-0 z-0">
         <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-indigo-600/20 rounded-full blur-[120px] animate-float"></div>
         <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-purple-600/10 rounded-full blur-[120px] animate-float" style={{animationDelay: '3s'}}></div>
         <MatrixBackground />
         <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
      </div>

      <div className="relative z-10 pb-36 md:pb-8"> 
        
        {/* Navbar */}
        <nav className="border-b border-white/5 bg-slate-900/60 sticky top-0 z-40 backdrop-blur-xl safe-area-top">
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
                                <div className="relative group">
                                    <input type="file" accept="image/*,application/pdf" onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                    <div className="bg-slate-900/50 border-2 border-dashed border-slate-600 rounded-xl p-4 flex items-center justify-center gap-3 group-hover:border-indigo-500 transition-colors">
                                        <Upload className="w-5 h-5 text-slate-400 group-hover:text-indigo-400" />
                                        <span className="text-sm text-slate-400 group-hover:text-white truncate">
                                            {selectedFile ? selectedFile.name : "Trascina o clicca per caricare"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="hidden md:block text-slate-600 font-bold">O</div>
                            <div className="flex-1 w-full space-y-3">
                                <form onSubmit={handleAddUtility}>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <select value={utilType} onChange={(e) => setUtilType(e.target.value as UtilityType)} className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white">
                                            <option value="Luce">Luce</option>
                                            <option value="Gas">Gas</option>
                                        </select>
                                        <input type="text" placeholder="Fornitore (es. Enel)" value={utilProvider} onChange={e => setUtilProvider(e.target.value)} className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white" />
                                    </div>
                                    <button type="submit" disabled={isProcessingFile} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                                        {isProcessingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        {isProcessingFile ? 'Analisi...' : 'Salva Utenza'}
                                    </button>
                                </form>
                            </div>
                        </div>
                        {utilMessage && <div className="mt-3 text-center text-sm text-indigo-300 font-medium animate-pulse">{utilMessage}</div>}
                    </div>
                 </div>

                 {/* List Utilities */}
                 <div className="grid grid-cols-1 gap-4">
                    {currentUser.utilities.length === 0 ? (
                        <div className="text-center p-10 text-slate-500">Nessuna utenza inserita.</div>
                    ) : (
                        currentUser.utilities.map(util => (
                            <div key={util.id} className="glass-card p-5 rounded-xl border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full ${util.type === 'Luce' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                        {util.type === 'Luce' ? <Zap className="w-6 h-6" /> : <Flame className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white text-lg">{util.provider}</div>
                                        <div className="text-xs text-slate-400 flex items-center gap-2">
                                            <span>Inserito il {new Date(util.dateAdded).toLocaleDateString()}</span>
                                            {util.attachmentName && (
                                                <span className="flex items-center gap-1 text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded text-[10px]">
                                                    <Paperclip className="w-3 h-3" /> {util.attachmentName}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                                        util.status === 'Attiva' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                                        util.status === 'Rifiutata' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                        'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                    }`}>
                                        {util.status}
                                    </span>
                                    {/* Mock Admin Action */}
                                    {util.status === 'In Lavorazione' && (
                                        <div className="flex gap-1">
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

          {activeTab === 'settings' && (
              <div className="animate-enter max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Avatar Editor */}
                  <div className="glass-card p-6 rounded-2xl border border-white/5">
                      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                          <Palette className="w-6 h-6 text-purple-400" /> Personalizza Avatar
                      </h2>
                      
                      <div className="flex flex-col items-center mb-8">
                          <div className="relative w-32 h-32 mb-4">
                              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full blur-xl opacity-50"></div>
                              <img src={getAvatarUrl(avatarConfig)} alt="Preview" className="relative w-32 h-32 rounded-full border-4 border-slate-800 bg-slate-800" />
                              <button onClick={randomizeAvatar} className="absolute bottom-0 right-0 p-2 bg-white text-slate-900 rounded-full hover:bg-indigo-100 transition-colors shadow-lg">
                                  <Dices className="w-5 h-5" />
                              </button>
                          </div>
                      </div>

                      <div className="space-y-4">
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Stile</label>
                              <div className="grid grid-cols-3 gap-2">
                                  {AVATAR_STYLES.map(style => (
                                      <button 
                                        key={style.id}
                                        onClick={() => setAvatarConfig({...avatarConfig, style: style.id})}
                                        className={`px-2 py-2 text-xs rounded-lg border transition-all ${avatarConfig.style === style.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                                      >
                                          {style.name}
                                      </button>
                                  ))}
                              </div>
                          </div>
                          
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Sfondo</label>
                              <div className="flex gap-2 flex-wrap">
                                  {BG_COLORS.map(bg => (
                                      <button 
                                        key={bg.id}
                                        onClick={() => setAvatarConfig({...avatarConfig, backgroundColor: bg.id})}
                                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${avatarConfig.backgroundColor === bg.id ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`}
                                        style={{backgroundColor: bg.color}}
                                        title={bg.label}
                                      />
                                  ))}
                              </div>
                          </div>

                          <button 
                            onClick={handleSaveAvatar} 
                            className="w-full py-3 mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
                          >
                            {isSavingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salva Avatar
                          </button>
                      </div>
                  </div>

                  {/* Profile Info */}
                  <div className="glass-card p-6 rounded-2xl border border-white/5">
                      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                          <Settings className="w-6 h-6 text-slate-400" /> Impostazioni Profilo
                      </h2>
                      
                      <div className="space-y-6">
                           <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                               <div className="text-xs text-slate-500 uppercase font-bold mb-1">Username</div>
                               <div className="text-white font-mono text-lg">{currentUser.username}</div>
                           </div>

                           <form onSubmit={handleUpdateContact} className="space-y-4">
                               <div>
                                   <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Email</label>
                                   <div className="flex gap-2">
                                       <div className="relative flex-1">
                                            <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                           <input 
                                              type="email" 
                                              value={editEmail} 
                                              onChange={(e) => setEditEmail(e.target.value)}
                                              disabled={!isEditingContact}
                                              className={`w-full bg-slate-900/50 border rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none ${isEditingContact ? 'border-indigo-500' : 'border-slate-700 opacity-70'}`}
                                           />
                                       </div>
                                   </div>
                               </div>

                               <div>
                                   <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Telefono</label>
                                   <div className="flex gap-2">
                                       <div className="relative flex-1">
                                            <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                           <input 
                                              type="tel" 
                                              value={editPhone} 
                                              onChange={(e) => setEditPhone(e.target.value)}
                                              disabled={!isEditingContact}
                                              className={`w-full bg-slate-900/50 border rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none ${isEditingContact ? 'border-indigo-500' : 'border-slate-700 opacity-70'}`}
                                           />
                                       </div>
                                   </div>
                               </div>

                               <div className="pt-2 flex gap-3">
                                   {!isEditingContact ? (
                                       <button type="button" onClick={() => setIsEditingContact(true)} className="flex-1 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
                                           <Pencil className="w-4 h-4" /> Modifica
                                       </button>
                                   ) : (
                                       <>
                                         <button type="button" onClick={() => { setIsEditingContact(false); setEditEmail(currentUser.email); setEditPhone(currentUser.phone); }} className="px-4 py-2 bg-slate-800 text-slate-300 font-bold rounded-lg hover:bg-slate-700">Annulla</button>
                                         <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 transition-colors">Salva Modifiche</button>
                                       </>
                                   )}
                               </div>
                               {contactMessage && <div className="text-center text-sm text-emerald-400">{contactMessage}</div>}
                           </form>
                      </div>
                  </div>
              </div>
          )}

        </main>
        
        {/* Mobile Bottom Navigation - Premium Dock Style */}
        <div className="md:hidden fixed bottom-6 left-6 right-6 h-[72px] rounded-3xl z-50 flex items-center justify-around border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl bg-[#0f172a]/80 safe-area-bottom overflow-hidden ring-1 ring-white/5">
            {/* Background blur/noise layer */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>

            {[
            { id: 'network', icon: GitMerge, label: 'Network' },
            { id: 'utilities', icon: Zap, label: 'Utenze' },
            { id: 'settings', icon: Settings, label: 'Opzioni' }
            ].map((item) => {
            const isActive = activeTab === item.id;
            return (
                <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className="relative flex flex-col items-center justify-center w-full h-full group"
                >
                    {/* Active Light Splash - Neon Effect */}
                    <div className={`absolute -top-12 left-1/2 -translate-x-1/2 w-12 h-12 bg-indigo-500 rounded-full blur-[30px] transition-all duration-500 ${isActive ? 'opacity-60' : 'opacity-0'}`}></div>

                    {/* Icon Container with Elastic Animation */}
                    <div 
                        className={`relative z-10 flex flex-col items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isActive ? '-translate-y-2' : 'translate-y-1'}`}
                    >
                        <item.icon 
                        className={`w-6 h-6 transition-all duration-300 ${isActive ? 'text-white fill-indigo-500/20 stroke-indigo-400' : 'text-slate-500 group-active:scale-90'}`} 
                        strokeWidth={isActive ? 2.5 : 2}
                        />
                    </div>

                    {/* Label Animation */}
                    <span 
                    className={`absolute bottom-3 text-[10px] font-bold tracking-wider transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0 text-indigo-100' : 'opacity-0 translate-y-3'}`}
                    >
                        {item.label}
                    </span>
                    
                    {/* Active Indicator Dot */}
                    <div className={`absolute bottom-1.5 w-1 h-1 rounded-full bg-indigo-400 transition-all duration-300 ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}></div>
                </button>
            )
            })}
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
