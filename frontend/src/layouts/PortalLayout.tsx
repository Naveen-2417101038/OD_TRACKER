import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Landmark, Bell, LogOut, ShieldCheck, Zap
} from 'lucide-react';
import { 
  getAuthSession, clearAuthSession, getRoleLoginPath, 
  getFacultyNotifications, markFacultyNotificationAsRead, 
  markAllFacultyNotificationsAsRead
} from '../data/mockData';
import { UserRole, NotificationItem } from '../types/types';
import { useToast } from '../components/Toast';

interface PortalLayoutProps {
  role: UserRole;
  children: React.ReactNode;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({ role, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const session = getAuthSession();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);

  const loadNotifications = () => {
    const notifs = getFacultyNotifications(session?.userId, role);
    setNotifications(notifs);
  };

  useEffect(() => {
    loadNotifications();
    const handleUpdate = () => loadNotifications();
    window.addEventListener('odFacultyStateUpdated', handleUpdate);
    window.addEventListener('odStateUpdated', handleUpdate);
    return () => {
      window.removeEventListener('odFacultyStateUpdated', handleUpdate);
      window.removeEventListener('odStateUpdated', handleUpdate);
    };
  }, [role, session?.userId]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    showToast(`Logged out from OD Portal successfully.`, 'info');
    navigate('/login', { replace: true });
  };

  const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    markFacultyNotificationAsRead(id);
    loadNotifications();
  };

  const handleMarkAllAsRead = () => {
    markAllFacultyNotificationsAsRead(session?.userId);
    loadNotifications();
    showToast('All notifications marked as read', 'info');
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

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className={`min-h-screen ${theme.pageBg} flex flex-col font-sans antialiased text-slate-800 transition-colors duration-300`}>
      
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Institution & Portal Title */}
          <div className="flex items-center gap-3.5">
            <Link to={location.pathname} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-950 to-primary-700 flex items-center justify-center text-white shadow-md shadow-primary-950/20">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm sm:text-base text-slate-900 tracking-tight">
                    RAJALAKSHMI ENGINEERING COLLEGE
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${getRoleBadgeStyle(role)}`}>
                    {role} Dashboard
                  </span>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">&bull; OD Tracking ERP</span>
                </div>
              </div>
            </Link>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            
            {/* System Status Tag */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Session Active</span>
            </div>

            {/* Notifications Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                aria-label="Notifications"
                className="relative p-2.5 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-slide-in" style={{maxWidth:'24rem'}}>
                  <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-primary-600" />
                      <span className="text-xs font-bold text-slate-900">Notifications ({unreadCount} new)</span>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllAsRead}
                        className="text-[10px] font-bold text-primary-600 hover:text-primary-800"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 font-medium">
                        No notifications found.
                      </div>
                    ) : (
                      notifications.slice(0, 6).map((notif) => (
                        <div 
                          key={notif.id} 
                          onClick={(e) => handleMarkAsRead(notif.id, e)}
                          className={`p-3 text-xs cursor-pointer transition-colors ${notif.read ? 'bg-white opacity-70 hover:opacity-100' : 'bg-primary-50/40 hover:bg-primary-50/80 font-semibold'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-slate-800 text-[11px] leading-relaxed">
                              {notif.message}
                            </p>
                            {!notif.read && (
                              <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0 mt-1" />
                            )}
                          </div>
                          <span className="text-[9px] text-slate-400 block mt-1">
                            {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(notif.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

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

    </div>
  );
};
