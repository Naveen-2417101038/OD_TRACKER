import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  GraduationCap, UserCheck, Users, Building2, 
  Layers, ChevronDown, Sparkles, Check
} from 'lucide-react';
import { getAuthSession, switchPersona } from '../data/mockData';
import { UserRole, AuthSession } from '../types/types';
import { useToast } from './Toast';

interface RoleQuickSwitcherProps {
  variant?: 'floating' | 'inline' | 'compact';
  onRoleChange?: (role: UserRole | 'ALL') => void;
  activeRoleOverride?: UserRole | 'ALL';
}

export const RoleQuickSwitcher: React.FC<RoleQuickSwitcherProps> = ({ 
  variant = 'floating',
  onRoleChange,
  activeRoleOverride
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  
  const [session, setSession] = useState<AuthSession | null>(getAuthSession());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleAuthChange = () => setSession(getAuthSession());
    window.addEventListener('odAuthStateChanged', handleAuthChange);
    return () => window.removeEventListener('odAuthStateChanged', handleAuthChange);
  }, []);

  const roles: {
    role: UserRole;
    title: string;
    persona: string;
    dept: string;
    path: string;
    icon: React.ElementType;
    color: string;
    activeBg: string;
    badgeBg: string;
  }[] = [
    {
      role: 'Student',
      title: 'Student Dashboard',
      persona: 'Naveen (23CSD001)',
      dept: 'III Year CSD',
      path: '/student/dashboard',
      icon: GraduationCap,
      color: 'text-blue-600',
      activeBg: 'bg-blue-50 border-blue-200 text-blue-900',
      badgeBg: 'bg-blue-600 text-white',
    },
    {
      role: 'Mentor',
      title: 'Mentor Dashboard',
      persona: 'Dr. A. Rajesh (FAC001)',
      dept: 'Associate Professor',
      path: '/mentor/dashboard',
      icon: UserCheck,
      color: 'text-indigo-600',
      activeBg: 'bg-indigo-50 border-indigo-200 text-indigo-900',
      badgeBg: 'bg-indigo-600 text-white',
    },
    {
      role: 'Class Incharge',
      title: 'Class Incharge Dashboard',
      persona: 'Mrs. K. Shanthi (FAC002)',
      dept: 'Assistant Professor / Sec A',
      path: '/class-incharge/dashboard',
      icon: Users,
      color: 'text-teal-600',
      activeBg: 'bg-teal-50 border-teal-200 text-teal-900',
      badgeBg: 'bg-teal-600 text-white',
    },
    {
      role: 'HOD',
      title: 'HOD Executive Dashboard',
      persona: 'Dr. V. Karpagam (FAC004)',
      dept: 'Professor & Head of Dept',
      path: '/hod/dashboard',
      icon: Building2,
      color: 'text-purple-600',
      activeBg: 'bg-purple-50 border-purple-200 text-purple-900',
      badgeBg: 'bg-purple-700 text-white',
    },
  ];

  const handleSelectRole = (targetRole: UserRole) => {
    switchPersona(targetRole);
    showToast(`Switched persona to ${targetRole}`, 'success');
    if (onRoleChange) {
      onRoleChange(targetRole);
    } else {
      const target = roles.find(r => r.role === targetRole);
      if (target) navigate(target.path);
    }
    setIsOpen(false);
  };

  const handleSelectAll = () => {
    if (onRoleChange) {
      onRoleChange('ALL');
    } else {
      navigate('/portal');
    }
    setIsOpen(false);
  };

  const currentRole = activeRoleOverride || session?.role || 'Student';

  // Inline Variant (for portal header bar or banner)
  if (variant === 'inline') {
    return (
      <div className="bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-2xl p-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 pl-2">
          <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/80">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-slate-700 hidden sm:inline">1-Click Role Switcher:</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <button
            type="button"
            onClick={handleSelectAll}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              currentRole === 'ALL'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Dashboards Hub</span>
          </button>

          {roles.map((r) => {
            const Icon = r.icon;
            const isSelected = currentRole === r.role;
            return (
              <button
                key={r.role}
                type="button"
                onClick={() => handleSelectRole(r.role)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? `${r.badgeBg} shadow-md`
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title={`Switch to ${r.persona}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{r.role}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Floating Variant (Fixed bottom-right quick tool)
  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans antialiased">
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-2xs z-40"
        />
      )}

      <div className="relative z-50">
        {isOpen && (
          <div className="absolute bottom-14 right-0 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden animate-slide-in mb-2 p-3 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 px-2 pt-1">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Unified OD Portal</span>
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Instant Dashboard Persona Switcher</span>
                </h4>
              </div>
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold hover:bg-amber-100 transition-colors cursor-pointer"
              >
                All-in-One Hub
              </button>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {roles.map((r) => {
                const Icon = r.icon;
                const isSelected = currentRole === r.role;
                return (
                  <button
                    key={r.role}
                    type="button"
                    onClick={() => handleSelectRole(r.role)}
                    className={`w-full p-2.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? `${r.activeBg} font-bold shadow-xs`
                        : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${r.badgeBg}`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black truncate">{r.title}</span>
                        {isSelected && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{r.persona}</p>
                      <span className="text-[10px] text-slate-400 block">{r.dept}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between px-2 text-[10px] text-slate-400">
              <span>Current Session: <strong className="text-slate-700">{session?.name || 'Guest'}</strong></span>
              <button
                type="button"
                onClick={() => navigate('/portal')}
                className="text-primary-600 hover:underline font-bold cursor-pointer"
              >
                Open Unified Portal &rarr;
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white shadow-xl hover:shadow-2xl border border-slate-700/80 transition-all transform hover:scale-105 cursor-pointer"
        >
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-xs shadow-xs">
            <Layers className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="text-left hidden sm:block">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block leading-tight font-bold">Portal Switcher</span>
            <span className="text-xs font-bold leading-tight flex items-center gap-1">
              {currentRole === 'ALL' ? 'All Dashboards' : `${currentRole} View`}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};
