import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, CheckSquare, ListFilter, History, 
  Bell, User, LogOut, Menu, X, Landmark, Building2, 
  BarChart3, ShieldCheck, ExternalLink, GraduationCap, ChevronDown
} from 'lucide-react';
import { 
  getCurrentFaculty, getFacultyNotifications, 
  markFacultyNotificationAsRead, markAllFacultyNotificationsAsRead,
  getFacultyODRequests, logoutFaculty
} from '../data/mockData';
import { Faculty, NotificationItem } from '../types/types';
import { RoleSwitcher } from '../components/RoleSwitcher';
import { useToast } from '../components/Toast';

interface FacultyLayoutProps {
  children: React.ReactNode;
}

export const FacultyLayout: React.FC<FacultyLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [faculty, setFaculty] = useState<Faculty>(getCurrentFaculty());
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const loadData = () => {
    const curr = getCurrentFaculty();
    setFaculty(curr);
    const notifs = getFacultyNotifications(curr.faculty_id);
    setNotifications(notifs);
    const { pending } = getFacultyODRequests(curr);
    setPendingCount(pending.length);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('odFacultyStateUpdated', handleUpdate);
    window.addEventListener('odStateUpdated', handleUpdate);
    return () => {
      window.removeEventListener('odFacultyStateUpdated', handleUpdate);
      window.removeEventListener('odStateUpdated', handleUpdate);
    };
  }, [location.pathname]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isHOD = faculty.role === 'HOD';

  // Base navigation items
  const menuItems = [
    { name: 'Dashboard', path: '/faculty/dashboard', icon: LayoutDashboard },
    { 
      name: 'Pending Approvals', 
      path: '/faculty/pending', 
      icon: CheckSquare, 
      badge: pendingCount > 0 ? pendingCount : null 
    },
    { name: 'All OD Requests', path: '/faculty/requests', icon: ListFilter },
    { name: 'OD History', path: '/faculty/od-history', icon: History },
    { name: 'Notifications', path: '/faculty/notifications', icon: Bell },
    { name: 'Profile', path: '/faculty/profile', icon: User },
  ];

  // Additional HOD-only navigation items
  const hodMenuItems = [
    { name: 'Department Overview', path: '/faculty/department', icon: Building2 },
    { name: 'OD Analytics', path: '/faculty/analytics', icon: BarChart3 },
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    markFacultyNotificationAsRead(id);
    loadData();
    showToast('Notification marked as read', 'info');
  };

  const handleMarkAllRead = () => {
    markAllFacultyNotificationsAsRead(faculty.faculty_id);
    loadData();
    setIsNotifOpen(false);
    showToast('All notifications marked as read', 'success');
  };

  const handleLogout = () => {
    logoutFaculty();
    showToast('Logged out of Faculty Portal', 'info');
    navigate('/faculty/login');
  };

  const handleSwitchToStudent = () => {
    localStorage.setItem('od_track_logged_in', 'true');
    showToast('Switched to Student Portal', 'info');
    navigate('/student/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      
      {/* 1. Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 fixed h-full z-30">
        
        {/* Logo Section */}
        <div className="h-16 flex items-center gap-2.5 px-6 border-b border-slate-200 bg-slate-900 text-white">
          <div className="bg-primary-600 p-1.5 rounded-lg text-white shadow-sm shadow-primary-900">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base text-white tracking-tight leading-none">OD Track</h1>
            <span className="text-[10px] text-primary-400 font-bold tracking-wider uppercase">Faculty Portal</span>
          </div>
        </div>

        {/* Current Faculty Role Card in Sidebar */}
        <div className="p-4 mx-3 my-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-3">
          <img
            src={faculty.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80'}
            alt={faculty.name}
            className="w-10 h-10 rounded-full object-cover border border-slate-200"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-slate-800 truncate">{faculty.name}</p>
            <span className="inline-block text-[10px] font-bold text-primary-700 bg-primary-100/60 px-2 py-0.5 rounded-md mt-0.5 truncate max-w-full">
              {faculty.role}
            </span>
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 block mb-1">
            Faculty Operations
          </span>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive 
                    ? 'bg-primary-600 text-white shadow-sm shadow-primary-200' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.name}</span>
                {item.badge && item.badge > 0 && (
                  <span className={`ml-auto font-black text-[10px] px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-white text-primary-600' : 'bg-amber-500 text-white animate-pulse'
                  }`}>
                    {item.badge}
                  </span>
                )}
                {item.name === 'Notifications' && unreadCount > 0 && (
                  <span className={`ml-auto font-black text-[10px] px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-white text-primary-600' : 'bg-rose-500 text-white'
                  }`}>
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}

          {/* HOD Specific Section */}
          {isHOD && (
            <div className="pt-4 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 block mb-1">
                HOD Governance
              </span>
              {hodMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      isActive 
                        ? 'bg-purple-700 text-white shadow-sm shadow-purple-200' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-200 space-y-1 bg-slate-50">
          <button
            onClick={handleSwitchToStudent}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-white hover:text-primary-600 transition-colors border border-transparent hover:border-slate-200"
          >
            <GraduationCap className="w-4 h-4 text-slate-400" />
            <span>Switch to Student Portal</span>
            <ExternalLink className="w-3 h-3 text-slate-400 ml-auto" />
          </button>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4 text-rose-500" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Workspace Shell */}
      <div className="flex-1 flex flex-col lg:pl-64 min-h-screen">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-20 shadow-xs">
          
          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-xl"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Header Title / Scope Badge */}
          <div className="hidden sm:flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-slate-800 text-sm md:text-base leading-tight">Faculty Portal</h2>
                <span className="text-[10px] font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100">
                  {faculty.role}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold">{faculty.department} • {faculty.assigned_section}</p>
            </div>
          </div>

          {/* Right Header Action Items */}
          <div className="flex items-center gap-3 ml-auto">
            
            {/* 1-Click Role Switcher Demo Component */}
            <RoleSwitcher />

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setIsNotifOpen(!isNotifOpen); setIsProfileOpen(false); }}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-rose-500 text-white font-black text-[9px] rounded-full h-4 w-4 flex items-center justify-center border-2 border-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 min-w-[18rem] sm:min-w-[22rem] max-w-sm sm:max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl z-50 overflow-hidden animate-slide-in">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Faculty Notifications</h4>
                      <p className="text-[10px] text-slate-400">{unreadCount} pending action alerts</p>
                    </div>
                    {unreadCount > 0 && (
                      <button 
                        onClick={handleMarkAllRead}
                        className="text-xs text-primary-600 hover:underline font-bold"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 font-medium">
                        No faculty notifications at this time.
                      </div>
                    ) : (
                      notifications.slice(0, 5).map((notif) => (
                        <div 
                          key={notif.id}
                          onClick={() => { navigate('/faculty/notifications'); setIsNotifOpen(false); }}
                          className={`p-3.5 text-xs hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 ${!notif.read ? 'bg-primary-50/20' : ''}`}
                        >
                          <span className={`h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${
                            notif.type === 'success' ? 'bg-emerald-500' :
                            notif.type === 'error' ? 'bg-rose-500' :
                            notif.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-700 font-medium leading-normal">{notif.message}</p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {!notif.read && (
                            <button
                              onClick={(e) => handleMarkAsRead(notif.id, e)}
                              className="text-[10px] text-primary-600 hover:text-primary-800 font-bold self-start mt-0.5 ml-2 flex-shrink-0"
                            >
                              Read
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <Link
                    to="/faculty/notifications"
                    onClick={() => setIsNotifOpen(false)}
                    className="block p-3 border-t border-slate-100 text-center text-xs font-bold text-primary-600 hover:bg-slate-50 bg-slate-50/50"
                  >
                    View all notifications
                  </Link>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setIsProfileOpen(!isProfileOpen); setIsNotifOpen(false); }}
                className="flex items-center gap-2.5 p-1.5 hover:bg-slate-100 rounded-full md:rounded-2xl transition-colors"
              >
                <img
                  src={faculty.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80'}
                  alt={faculty.name}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200"
                />
                <div className="hidden md:block text-left">
                  <p className="font-bold text-xs text-slate-800 leading-tight">{faculty.name}</p>
                  <p className="text-[10px] text-primary-600 font-semibold">{faculty.designation}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200 rounded-3xl shadow-xl z-50 overflow-hidden animate-slide-in p-1.5">
                  <div className="p-3 border-b border-slate-100 bg-slate-50/50 rounded-2xl mb-1">
                    <p className="font-bold text-xs text-slate-900 truncate">{faculty.name}</p>
                    <p className="text-[11px] text-slate-500 break-all leading-snug">{faculty.email}</p>
                    <span className="inline-block mt-1 text-[9px] font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100 max-w-full">
                      {faculty.role} • {faculty.employee_id}
                    </span>
                  </div>

                  <Link
                    to="/faculty/profile"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span>My Profile</span>
                  </Link>

                  <button
                    onClick={() => { setIsProfileOpen(false); handleSwitchToStudent(); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <GraduationCap className="w-4 h-4 text-slate-400" />
                    <span>Student Portal Demo</span>
                  </button>

                  <div className="pt-1 mt-1 border-t border-slate-100">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* Page Main Content Area */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24">
          {children}
        </main>
      </div>

      {/* 3. Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          <aside className="w-72 bg-white h-full relative z-10 flex flex-col shadow-2xl animate-slide-right">
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <div className="bg-primary-600 p-1 rounded-md text-white">
                  <Landmark className="w-5 h-5" />
                </div>
                <span className="font-bold text-sm text-white">OD Track Faculty</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                      isActive 
                        ? 'bg-primary-600 text-white shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                    {item.badge && item.badge > 0 && (
                      <span className="ml-auto bg-amber-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}

              {isHOD && (
                <div className="pt-4 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 block mb-1">
                    HOD Governance
                  </span>
                  {hodMenuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.name}
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                          isActive 
                            ? 'bg-purple-700 text-white shadow-sm' 
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </nav>

            <div className="p-4 border-t border-slate-200 space-y-2">
              <button 
                onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

    </div>
  );
};
