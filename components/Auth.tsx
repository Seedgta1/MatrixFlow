import React, { useState, useEffect } from 'react';
import { loginUser, registerUser } from '../services/matrixService';
import { User } from '../types';
import MatrixBackground from './MatrixBackground';
import { UserPlus, LogIn, Hexagon, Link, ArrowRight, Mail, Phone, Loader2 } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', password: '', sponsor: '', email: '', phone: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [refSponsor, setRefSponsor] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setIsLogin(false);
      setFormData(prev => ({ ...prev, sponsor: ref }));
      setRefSponsor(ref);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
        if (isLogin) {
            const user = await loginUser(formData.username, formData.password);
            if (user) {
                onLogin(user);
            } else {
                setError('Credenziali non valide.');
            }
        } else {
            if (!formData.email || !formData.phone) {
                setError("Email e Telefono sono obbligatori.");
                setLoading(false);
                return;
            }
            const result = await registerUser(formData.username, formData.password, formData.sponsor, formData.email, formData.phone);
            if (result.success) {
                setSuccess(result.message);
                setTimeout(() => setIsLogin(true), 1500);
            } else {
                setError(result.message);
            }
        }
    } catch (err) {
        setError('Si è verificato un errore di rete.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Animated Background */}
      <div className="absolute inset-0 z-0">
          <MatrixBackground />
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] animate-float"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] animate-float" style={{animationDelay: '4s'}}></div>
      </div>
      
      <div className="relative w-full max-w-md glass-card p-8 rounded-3xl shadow-2xl animate-enter z-10 border border-white/10">
        
        <div className="text-center mb-10 flex flex-col items-center">
          {/* Animated Floating Logo */}
          <div className="relative w-24 h-24 mb-6 animate-float">
            {/* Glow behind */}
            <div className="absolute inset-0 bg-indigo-500/30 blur-2xl rounded-full"></div>
            
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]">
               <defs>
                 <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                   <stop offset="0%" stopColor="#6366f1" />
                   <stop offset="100%" stopColor="#a855f7" />
                 </linearGradient>
               </defs>
               
               {/* Outer Rotating Hexagon Ring */}
               <g className="origin-center animate-spin-slow">
                 <path d="M50 5 L93.3 30 V80 L50 105 L6.7 80 V30 Z" fill="none" stroke="url(#logoGrad)" strokeWidth="1.5" strokeDasharray="10 5" opacity="0.6" transform="scale(0.8) translate(12.5, 12.5)" />
               </g>

               {/* Inner Counter-Rotating Circle */}
               <g className="origin-center animate-spin-reverse-slow">
                 <circle cx="50" cy="50" r="32" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
                 <circle cx="50" cy="50" r="28" fill="none" stroke="url(#logoGrad)" strokeWidth="0.5" opacity="0.5" />
               </g>

               {/* Central Core Structure (The Matrix 3) */}
               <g className="origin-center">
                  <path d="M50 30 L32 65 L68 65 Z" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.8" />
                  
                  {/* Top Node */}
                  <circle cx="50" cy="30" r="4" fill="#fff" className="animate-pulse">
                     <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                  </circle>
                  
                  {/* Bottom Nodes */}
                  <circle cx="32" cy="65" r="3" fill="#6366f1" />
                  <circle cx="68" cy="65" r="3" fill="#a855f7" />
                  
                  {/* Center Dot */}
                  <circle cx="50" cy="53" r="2" fill="#fff" opacity="0.5" />
               </g>
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">MatrixFlow</h1>
          <p className="text-slate-400">Next Gen Network Management</p>
        </div>

        {refSponsor && !isLogin && (
          <div className="mb-6 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center gap-3 text-indigo-200 text-sm animate-pulse-soft">
             <div className="p-1.5 bg-indigo-500/20 rounded-full">
                <Link className="w-4 h-4" />
             </div>
             <span>Invitato da <b className="text-white">{refSponsor}</b></span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Username</label>
            <input
              type="text"
              required
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
              placeholder="Inserisci username"
              value={formData.username}
              onChange={e => setFormData({ ...formData, username: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Password</label>
            <input
              type="password"
              required
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
              placeholder="••••••••"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          {!isLogin && (
            <>
              <div className="grid grid-cols-2 gap-3 animate-enter">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><Mail className="w-3 h-3"/> Email</label>
                    <input
                      type="email"
                      required
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                      placeholder="tua@email.com"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1"><Phone className="w-3 h-3"/> Telefono</label>
                    <input
                      type="tel"
                      required
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                      placeholder="+39..."
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
              </div>

              <div className="space-y-1 animate-enter">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Sponsor</label>
                <input
                  type="text"
                  required
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                  placeholder="Username dello sponsor"
                  value={formData.sponsor}
                  readOnly={!!refSponsor}
                  onChange={e => setFormData({ ...formData, sponsor: e.target.value })}
                />
              </div>
            </>
          )}

          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm text-center">{error}</div>}
          {success && <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-sm text-center">{success}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 mt-4 disabled:opacity-70"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  {isLogin ? "Accedi alla Dashboard" : "Crea il tuo Account"}
                  <ArrowRight className="w-5 h-5 opacity-70" />
                </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
            className="text-slate-500 hover:text-white text-sm transition-colors font-medium"
          >
            {isLogin ? "Non hai un account? Registrati ora" : "Hai già un account? Accedi"}
          </button>
        </div>
      </div>
      
      <div className