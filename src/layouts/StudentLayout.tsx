import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, FilePlus2, ListTodo, History, Percent, 
  GraduationCap, Award, Bell, User, LogOut, Menu, X, Landmark, ShieldCheck
} from 'lucide-react';
import { getStudentProfile, getNotifications, markNotificationAsRead, markAllNotificationsAsRead, clearAuthSession } from '../data/mockData';
import { Student, NotificationItem } from '../types/types';
import { useToast } from '../components/Toast';

interface StudentLayoutProps {
  children: React.ReactNode;
}

export const StudentLayout: React.FC<StudentLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [student, setStudent] = useState<Student | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const loadData = () => {
    setStudent(getStudentProfile());
    setNotifications(getNotifications());
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => {
      loadData();
    };
    window.addEventListener('odStateUpdated', handleUpdate);
    return () => window.removeEventListener('odStateUpdated', handleUpdate);
  }, []);

  // Close menus on click outside
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

  const menuItems = [
    { name: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
    { name: 'Apply for OD', path: '/student/apply', icon: FilePlus2 },
    { name: 'My OD Requests', path: '/student/requests', icon: ListTodo },
    { name: 'OD History', path: '/student/history', icon: History },
    { name: 'Attendance', path: '/student/attendance', icon: Percent },
    { name: 'CAT Marks', path: '/student/marks', icon: GraduationCap },
    { name: 'Certificates', path: '/student/certificates', icon: Award },
    { name: 'Notifications', path: '/student/notifications', icon: Bell },
    { name: 'Profile', path: '/student/profile', icon: User },
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    markNotificationAsRead(id);
    loadData();
    showToast('Notification marked as read', 'info');
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead();
    loadData();
    setIsNotifOpen(false);
    showToast('All notifications marked as read', 'success');
  };

  const handleLogout = () => {
    clearAuthSession();
    showToast('Logged out from Student Portal successfully', 'info');
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans antialiased text-slate-800">
      {/* 1. Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 fixed h-full z-30">
        {/* Logo Section */}
        <div className="h-16 flex items-center gap-2.5 px-6 border-b border-slate-200">
          <div className="bg-primary-600 p-2 rounded-xl text-white shadow-sm shadow-primary-600/30">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black text-base text-slate-900 tracking-tight leading-none">OD-TRACKER</h1>
            <span className="text-[10px] text-primary-700 font-bold tracking-wider uppercase">Student Portal</span>
          </div>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 block mb-1">
            Student Menu
          </span>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path === '/student/requests' && location.pathname.startsWith('/student/requests/'));
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
                {item.name === 'Notifications' && unreadCount > 0 && (
                  <span className={`ml-auto font-black text-[10px] px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-white text-primary-600' : 'bg-rose-500 text-white animate-pulse'
                  }`}>
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50">
          <button 
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4 text-rose-500" />
            <span>Logout from Student Portal</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Work Area Wrapper */}
      <div className="flex-1 flex flex-col lg:pl-64 min-h-screen">
        {/* Desktop & Mobile Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-20 shadow-xs">
          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-xl"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Current Page Title */}
          <div className="hidden sm:block">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Rajalakshmi Engineering College &bull; Autonomous
            </span>
            <h2 className="font-black text-sm text-slate-900 leading-tight">Digital OD Application Portal</h2>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            {/* Link to Unified Portal */}
            <Link
              to="/portal"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 text-xs font-bold transition-all shadow-2xs"
            >
              <Landmark className="w-3.5 h-3.5 text-amber-600" />
              <span>All Dashboards Hub</span>
            </Link>

            {/* Notification Bell Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => { setIsNotifOpen(!isNotifOpen); setIsProfileOpen(false); }}
                className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-rose-500 text-white rounded-full text-[10px] font-bold w-4 h-4 flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 md:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-slide-in" style={{maxWidth:'24rem'}}>
                  <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <span className="font-bold text-xs text-slate-800">Notifications ({unreadCount} new)</span>
                    {unreadCount > 0 && (
                      <button 
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[10px] text-primary-600 hover:underline font-bold"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 font-medium">No notifications yet.</div>
                    ) : (
                      notifications.slice(0, 5).map((notif) => (
                        <div 
                          key={notif.id} 
                          onClick={() => { navigate('/student/notifications'); setIsNotifOpen(false); }}
                          className={`p-3 text-xs leading-normal hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 ${!notif.read ? 'bg-primary-50/40 font-semibold' : ''}`}
                        >
                          <span className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                            notif.type === 'success' ? 'bg-emerald-500' :
                            notif.type === 'error' ? 'bg-rose-500' :
                            notif.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                          }`} />
                          <div className="flex-1">
                            <p className="text-slate-800 text-[11px] leading-relaxed">{notif.message}</p>
                            <span className="text-[9px] text-slate-400 mt-1 block">
                              {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(notif.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          {!notif.read && (
                            <button
                              type="button"
                              onClick={(e) => handleMarkAsRead(notif.id, e)}
                              className="text-[10px] text-primary-600 hover:text-primary-800 font-bold self-start mt-0.5 ml-2"
                              title="Mark read"
                            >
                              Mark Read
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  <Link
                    to="/student/notifications"
                    onClick={() => setIsNotifOpen(false)}
                    className="block p-2.5 border-t border-slate-100 text-center text-xs font-bold text-primary-600 hover:bg-slate-50 bg-slate-50/50"
                  >
                    View all notifications
                  </Link>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => { setIsProfileOpen(!isProfileOpen); setIsNotifOpen(false); }}
                className="flex items-center gap-2.5 p-1.5 hover:bg-slate-100 rounded-xl transition-colors text-left cursor-pointer"
                aria-label="User Profile"
              >
                <img
                  src={student?.profilePhoto || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&h=150&q=80'}
                  alt={student?.name || 'Student'}
                  className="w-9 h-9 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0"
                />
                <div className="hidden md:block text-left">
                  <p className="font-bold text-xs text-slate-900 leading-tight">{student?.name || 'Loading...'}</p>
                  <p className="text-[10px] text-slate-400 font-semibold">{student?.registerNumber}</p>
                </div>
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-slide-in">
                  <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-slate-50/70">
                    <p className="font-bold text-xs text-slate-900 leading-tight truncate" title={student?.name}>
                      {student?.name || 'Student'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 break-all leading-snug" title={student?.email}>
                      {student?.email || 'student@rajalakshmi.edu.in'}
                    </p>
                    <div className="mt-2.5 flex items-center flex-wrap gap-1.5">
                      {student?.department && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold text-primary-700 bg-primary-50 rounded-full border border-primary-100 max-w-full">
                          {student.department}
                        </span>
                      )}
                      {student?.year && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold text-slate-600 bg-slate-100 rounded-full border border-slate-200">
                          Year {student.year}
                        </span>
                      )}
                      {student?.section && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold text-slate-600 bg-slate-100 rounded-full border border-slate-200">
                          Sec {student.section}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <Link
                      to="/student/profile"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                    >
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>My Profile</span>
                    </Link>
                  </div>
                  <div className="p-1.5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Digital OD Tracking System Banner – Student (Sky Blue) */}
        <div className="bg-gradient-to-r from-sky-950 via-blue-900 to-cyan-900 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-sky-400/20 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none -ml-16 -mb-10" />
          <div className="relative z-10 px-4 md:px-6 lg:px-8 py-3.5 flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-400/20 border border-sky-400/30 text-sky-200 text-[10px] font-bold shrink-0">
              <ShieldCheck className="w-3 h-3" />
              <span>UG / PG Student Portal</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-white font-black text-base sm:text-lg tracking-tight leading-tight">DIGITAL OD</span>
              <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-blue-300 bg-clip-text text-transparent font-black text-base sm:text-lg tracking-tight leading-tight">TRACKING SYSTEM</span>
            </div>
          </div>
        </div>

        {/* 3. Page Router Container */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* 4. Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
          />

          <aside className="w-64 bg-white h-full relative z-10 flex flex-col shadow-2xl animate-slide-right">
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="bg-primary-600 p-2 rounded-xl text-white">
                  <Landmark className="w-5 h-5" />
                </div>
                <span className="font-black text-sm text-slate-900">Student Portal</span>
              </div>
              <button 
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold ${
                      isActive 
                        ? 'bg-primary-600 text-white' 
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-3 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50"
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
