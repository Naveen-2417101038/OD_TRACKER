import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, GraduationCap, Users, FileSpreadsheet, 
  BookOpen, Award, BarChart3, History, Settings, 
  Bell, LogOut, Menu, X, Landmark, ShieldCheck, ChevronRight
} from 'lucide-react';
import { getAuthSession } from '../data/mockData';
import { apiGetAdminStats } from '../services/api';
import { useToast } from '../components/Toast';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [session, setSession] = useState(getAuthSession());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [pendingODCount, setPendingODCount] = useState<number>(0);
  const [pendingCertCount, setPendingCertCount] = useState<number>(0);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Sync session and stats
  useEffect(() => {
    const s = getAuthSession();
    setSession(s);

    const fetchSummary = async () => {
      const res = await apiGetAdminStats(s?.token);
      if (res && res.success && res.data) {
        setPendingODCount(res.data.pendingODRequests || 0);
        setPendingCertCount(res.data.pendingCertificates || 0);
      }
    };
    fetchSummary();
  }, [location.pathname]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem('od_track_auth_session_v2');
      localStorage.removeItem('od_auth_session');
      localStorage.removeItem('od_current_user');
      window.dispatchEvent(new Event('odAuthStateChanged'));
    } catch {}
    showToast('Logged out of Admin Portal successfully', 'info');
    navigate('/admin/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Student Management', path: '/admin/students', icon: GraduationCap },
    { name: 'Faculty Management', path: '/admin/faculty', icon: Users },
    { 
      name: 'OD Requests', 
      path: '/admin/od-requests', 
      icon: FileSpreadsheet,
      badge: pendingODCount > 0 ? `${pendingODCount} Pending` : undefined,
      badgeColor: 'bg-amber-100 text-amber-800'
    },
    { name: 'Academic Data', path: '/admin/academic', icon: BookOpen },
    { 
      name: 'Certificates', 
      path: '/admin/certificates', 
      icon: Award,
      badge: pendingCertCount > 0 ? `${pendingCertCount} Verify` : undefined,
      badgeColor: 'bg-indigo-100 text-indigo-800'
    },
    { name: 'System Reports', path: '/admin/reports', icon: BarChart3 },
    { name: 'Audit Logs', path: '/admin/audit-logs', icon: History },
    { name: 'System Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Left: Mobile Toggle & Brand Identity */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Toggle navigation menu"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <Link to="/admin/dashboard" className="flex items-center gap-3 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                      Rajalakshmi Engineering College
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                      <ShieldCheck className="w-3 h-3 text-amber-600" />
                      Admin Portal
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                    OD Tracking System • System-Level Operations & Governance
                  </p>
                </div>
              </Link>
            </div>

            {/* Right: Notification & Admin Profile Dropdown */}
            <div className="flex items-center gap-3">
              
              {/* Notifications Popover */}
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="relative p-2.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {(pendingODCount > 0 || pendingCertCount > 0) && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
                  )}
                </button>

                {isNotifOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">System Alerts</h4>
                      <span className="text-[11px] font-medium text-slate-400">Live Status</span>
                    </div>
                    <div className="mt-3 space-y-2.5">
                      <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 flex items-start gap-2.5">
                        <FileSpreadsheet className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-amber-900">{pendingODCount} Active OD Requests</p>
                          <p className="text-[11px] text-amber-700">Currently traversing the Mentor → Incharge → HOD approval pipeline.</p>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-2.5">
                        <Award className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-indigo-900 leading-snug">{pendingCertCount} Pending Certificate Verifications</p>
                          <p className="text-[11px] text-indigo-700">Certificates awaiting faculty mentor review.</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 text-center">
                      <Link 
                        to="/admin/od-requests" 
                        onClick={() => setIsNotifOpen(false)}
                        className="inline-flex items-center justify-center text-xs font-bold text-amber-600 hover:text-amber-700 whitespace-nowrap"
                      >
                        Inspect All Pipeline Requests →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2.5 p-1.5 pl-2 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-amber-400 font-black text-xs flex items-center justify-center shadow-inner">
                    AD
                  </div>
                  <div className="text-left hidden md:block">
                    <p className="text-xs font-bold text-slate-800 leading-tight">
                      {session?.name || 'Administrator'}
                    </p>
                    <p className="text-[10px] font-semibold text-amber-700">
                      System Governance
                    </p>
                  </div>
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-2.5 bg-slate-50 rounded-xl mb-2">
                      <p className="text-xs font-bold text-slate-900 truncate">{session?.name || 'Super Administrator'}</p>
                      <p className="text-[11px] text-slate-500 font-mono break-all leading-snug">{session?.email || 'admin@rajalakshmi.edu.in'}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded bg-amber-100 text-amber-800">
                        Admin Role
                      </span>
                    </div>

                    <div className="space-y-1">
                      <Link
                        to="/admin/settings"
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <Settings className="w-4 h-4 text-slate-400" />
                        System Settings
                      </Link>
                      <Link
                        to="/admin/audit-logs"
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <History className="w-4 h-4 text-slate-400" />
                        Audit Trails
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        Log Out
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      </header>

      {/* Main Body Layout: Sidebar + Page Container */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6">
        
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <nav className="sticky top-24 space-y-1 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-sm">
            <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Admin Governance
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20 translate-x-1'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            <div className="pt-4 mt-4 border-t border-slate-100">
              <div className="p-3 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200/60">
                <p className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  Approval Workflow Note
                </p>
                <p className="text-[10px] text-amber-800/90 mt-1 leading-relaxed">
                  Student → Mentor → Class Incharge → HOD. Admin maintains governance and cannot bypass approval stages.
                </p>
              </div>
            </div>
          </nav>
        </aside>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="relative bg-white w-72 max-w-[80vw] h-full shadow-2xl flex flex-col p-4 z-10 animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900">Admin Portal</h3>
                    <p className="text-[10px] text-slate-400">Navigation Menu</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path || (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out of Admin
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Page Content Outlet */}
        <main className="flex-1 min-w-0 w-full">
          {children}
        </main>

      </div>
    </div>
  );
};
