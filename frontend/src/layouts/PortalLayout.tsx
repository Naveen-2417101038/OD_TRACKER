import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Landmark, LogOut, ShieldCheck, Zap, KeyRound
} from 'lucide-react';
import { 
  getAuthSession, clearAuthSession, getRoleLoginPath 
} from '../data/mockData';
import { UserRole } from '../types/types';
import { useToast } from '../components/Toast';
import { ChangePasswordModal } from '../components/ChangePasswordModal';

interface PortalLayoutProps {
  role: UserRole;
  children: React.ReactNode;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({ role, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const session = getAuthSession();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const handleLogout = () => {
    clearAuthSession();
    showToast(`Logged out from OD Portal successfully.`, 'info');
    navigate('/login', { replace: true });
  };


  // Define role badge color
  const getRoleBadgeStyle = (r: UserRole) => {
    switch (r) {
      case 'Mentor':
        return 'bg-indigo-600 text-white';
      case 'Class Incharge':
        return 'bg-teal-600 text-white';
      case 'HOD':
        return 'bg-purple-700 text-white';
      default:
        return 'bg-sky-600 text-white';
    }
  };

  // Role-specific theme config for the Digital OD banner
  const getRoleTheme = (r: UserRole) => {
    switch (r) {
      case 'Student':
        return {
          gradient: 'from-sky-950 via-blue-900 to-cyan-900',
          pageBg: 'bg-slate-100',
          orb1: 'bg-sky-400/20',
          orb2: 'bg-cyan-500/15',
          badge: 'bg-sky-400/20 border-sky-400/30 text-sky-200',
          titleGradient: 'from-sky-300 via-cyan-200 to-blue-300',
          accent: 'text-sky-300',
          stepColors: ['text-sky-300 font-black', '', '', ''],
          pipelineBg: 'bg-white/5 border-white/10',
          tag: 'UG / PG Student Portal',
          desc: 'Submit OD requests, upload event proofs & track live 4-stage approval.',
        };
      case 'Mentor':
        return {
          gradient: 'from-indigo-950 via-violet-900 to-indigo-900',
          pageBg: 'bg-gradient-to-br from-indigo-50/60 via-slate-50 to-violet-50/40',
          orb1: 'bg-indigo-400/20',
          orb2: 'bg-violet-500/15',
          badge: 'bg-indigo-400/20 border-indigo-400/30 text-indigo-200',
          titleGradient: 'from-indigo-300 via-violet-200 to-purple-300',
          accent: 'text-indigo-300',
          stepColors: ['', 'text-indigo-300 font-black', '', ''],
          pipelineBg: 'bg-white/5 border-white/10',
          tag: 'Faculty Mentor Portal',
          desc: 'Review mentee OD applications, verify proofs & endorse to Class Incharge.',
        };
      case 'Class Incharge':
        return {
          gradient: 'from-teal-950 via-emerald-900 to-teal-900',
          pageBg: 'bg-gradient-to-br from-teal-50/60 via-slate-50 to-emerald-50/40',
          orb1: 'bg-teal-400/20',
          orb2: 'bg-emerald-500/15',
          badge: 'bg-teal-400/20 border-teal-400/30 text-teal-200',
          titleGradient: 'from-teal-300 via-emerald-200 to-green-300',
          accent: 'text-teal-300',
          stepColors: ['', '', 'text-teal-300 font-black', ''],
          pipelineBg: 'bg-white/5 border-white/10',
          tag: 'Section Incharge Portal',
          desc: 'Audit attendance thresholds, verify CAT marks & forward to HOD.',
        };
      case 'HOD':
        return {
          gradient: 'from-purple-950 via-fuchsia-900 to-purple-900',
          pageBg: 'bg-gradient-to-br from-purple-50/60 via-slate-50 to-fuchsia-50/40',
          orb1: 'bg-purple-400/20',
          orb2: 'bg-fuchsia-500/15',
          badge: 'bg-purple-400/20 border-purple-400/30 text-purple-200',
          titleGradient: 'from-purple-300 via-fuchsia-200 to-pink-300',
          accent: 'text-purple-300',
          stepColors: ['', '', '', 'text-fuchsia-300 font-black'],
          pipelineBg: 'bg-white/5 border-white/10',
          tag: 'Department Head Portal',
          desc: 'Final sanction sign-offs, department analytics & institutional audit logs.',
        };
      default:
        return {
          gradient: 'from-slate-900 via-slate-800 to-slate-900',
          pageBg: 'bg-slate-100',
          orb1: 'bg-slate-400/20',
          orb2: 'bg-slate-500/15',
          badge: 'bg-white/10 border-white/20 text-slate-200',
          titleGradient: 'from-slate-300 via-white to-slate-200',
          accent: 'text-slate-300',
          stepColors: ['', '', '', ''],
          pipelineBg: 'bg-white/5 border-white/10',
          tag: 'Portal',
          desc: '',
        };
    }
  };

  const theme = getRoleTheme(role);
  const stages = [
    { label: '1. Student', idx: 0 },
    { label: '2. Mentor', idx: 1 },
    { label: '3. Incharge', idx: 2 },
    { label: '4. HOD', idx: 3 },
  ];

  return (
    <div className={`min-h-screen ${theme.pageBg} flex flex-col font-sans antialiased text-slate-800 transition-colors duration-300`}>
      
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Institution & Portal Title */}
          <div className="flex items-center gap-3.5">
            <Link to={getRoleLoginPath(role)} className="flex items-center gap-3 group" title="Return to Portal Homepage">
              <img 
                src="/rec_logo.png" 
                alt="Rajalakshmi Engineering College" 
                className="h-9 sm:h-10 w-auto object-contain group-hover:scale-102 transition-transform drop-shadow-xs" 
              />
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getRoleBadgeStyle(role)} shrink-0`}>
                {role} Portal
              </span>
            </Link>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            
            {/* System Status Tag */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold whitespace-nowrap shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>System Status: Active</span>
            </div>

            {/* Change Password Button */}
            <button
              type="button"
              onClick={() => setIsChangePasswordOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors border border-slate-200/80 cursor-pointer"
              title="Change Password"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Change Password</span>
            </button>



            {/* User Profile info */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <img 
                src={session?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80'} 
                alt={session?.name || role}
                className="w-9 h-9 rounded-xl object-cover border border-slate-200 shadow-xs"
              />
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 leading-tight">
                  {session?.name || 'Faculty User'}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {session?.role || role}
                </span>
              </div>
            </div>

            {/* Role Dedicated Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 font-bold text-xs transition-colors border border-slate-200/80 hover:border-rose-200"
              title={`Logout from ${role} Portal`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>

          </div>

        </div>
      </header>

      {/* Digital OD Tracking System Banner */}
      <div className={`bg-gradient-to-r ${theme.gradient} relative overflow-hidden`}>
        {/* Decorative Orbs */}
        <div className={`absolute top-0 right-0 w-72 h-72 ${theme.orb1} rounded-full blur-3xl pointer-events-none -mr-16 -mt-16`} />
        <div className={`absolute bottom-0 left-0 w-60 h-60 ${theme.orb2} rounded-full blur-2xl pointer-events-none -ml-16 -mb-10`} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center gap-3">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${theme.badge} border text-[10px] font-bold shrink-0`}>
            <ShieldCheck className="w-3 h-3" />
            <span>{theme.tag}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-white font-black text-base sm:text-lg tracking-tight leading-tight">DIGITAL OD</span>
            <span className={`bg-gradient-to-r ${theme.titleGradient} bg-clip-text text-transparent font-black text-base sm:text-lg tracking-tight leading-tight`}>TRACKING SYSTEM</span>
          </div>
        </div>
      </div>

      {/* Main Role Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 sm:px-8 text-center text-xs text-slate-500">
        <p className="font-semibold">
          OD Tracking Application &bull; Rajalakshmi Engineering College &copy; {new Date().getFullYear()}
        </p>
      </footer>
      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        userEmail={session?.email}
      />
    </div>
  );
};

