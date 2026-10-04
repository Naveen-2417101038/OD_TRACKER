import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Landmark, GraduationCap, UserCheck, Users, 
  Building2, ArrowRight, ShieldCheck, 
  CheckCircle2, FileCheck, Award, Sparkles, LogOut
} from 'lucide-react';
import { getAuthSession, getRoleDashboardPath, clearAuthSession } from '../data/mockData';
import { AuthSession } from '../types/types';

export const PortalGateway: React.FC = () => {
  const navigate = useNavigate();
  const [currentSession, setCurrentSession] = useState<AuthSession | null>(getAuthSession());

  useEffect(() => {
    const handleAuthChange = () => {
      setCurrentSession(getAuthSession());
    };
    window.addEventListener('odAuthStateChanged', handleAuthChange);
    return () => window.removeEventListener('odAuthStateChanged', handleAuthChange);
  }, []);

  const portals = [
    {
      role: 'Student',
      title: 'Student Portal',
      description: 'Apply for On-Duty leave, upload event proofs, track live multi-stage approval statuses, and verify certificates.',
      loginPath: '/student/login',
      dashboardPath: '/student/dashboard',
      icon: GraduationCap,
      color: 'bg-blue-600 text-white',
      badge: 'Register No: 23CSD001',
      accentBorder: 'hover:border-blue-500 hover:shadow-blue-500/10',
      sampleUser: 'Naveen (III Year CSD)',
    },
    {
      role: 'Mentor',
      title: 'Mentor Portal',
      description: 'Review assigned mentee OD applications, preview event invitations, recommend approvals with remarks, and verify certificates.',
      loginPath: '/mentor/login',
      dashboardPath: '/mentor/dashboard',
      icon: UserCheck,
      color: 'bg-indigo-600 text-white',
      badge: 'Faculty ID: FAC001',
      accentBorder: 'hover:border-indigo-400 hover:shadow-indigo-500/20',
      sampleUser: 'Dr. A. Rajesh (ASP/CSD)',
      cardBg: 'bg-gradient-to-br from-indigo-50 via-indigo-50/80 to-violet-50 border-indigo-200/60',
      textColor: 'text-indigo-900',
      descColor: 'text-indigo-700/70',
      badgeBg: 'bg-indigo-100 border-indigo-200 text-indigo-700',
      sampleBg: 'bg-indigo-100/60 border-indigo-200/50 text-indigo-800',
      sampleLabel: 'text-indigo-500',
      loginBg: 'bg-indigo-900 hover:bg-indigo-700',
    },
    {
      role: 'Class Incharge',
      title: 'Class Incharge Portal',
      description: 'Monitor section-wide student attendance thresholds (>75%), evaluate CAT 1 / CAT 2 marks, and endorse forwarded ODs.',
      loginPath: '/class-incharge/login',
      dashboardPath: '/class-incharge/dashboard',
      icon: Users,
      color: 'bg-teal-600 text-white',
      badge: 'Faculty ID: FAC002',
      accentBorder: 'hover:border-teal-400 hover:shadow-teal-500/20',
      sampleUser: 'Mrs. K. Shanthi (AP/CSD)',
      cardBg: 'bg-gradient-to-br from-teal-50 via-teal-50/80 to-emerald-50 border-teal-200/60',
      textColor: 'text-teal-900',
      descColor: 'text-teal-700/70',
      badgeBg: 'bg-teal-100 border-teal-200 text-teal-700',
      sampleBg: 'bg-teal-100/60 border-teal-200/50 text-teal-800',
      sampleLabel: 'text-teal-500',
      loginBg: 'bg-teal-900 hover:bg-teal-700',
    },
    {
      role: 'HOD',
      title: 'HOD Executive Portal',
      description: 'Departmental OD analytics, final institutional approval sign-offs, compensatory attendance credit sanction, and audit reports.',
      loginPath: '/hod/login',
      dashboardPath: '/hod/dashboard',
      icon: Building2,
      color: 'bg-purple-700 text-white',
      badge: 'HOD ID: FAC004',
      accentBorder: 'hover:border-purple-400 hover:shadow-purple-500/20',
      sampleUser: 'Dr. V. Karpagam (Prof & HOD)',
      cardBg: 'bg-gradient-to-br from-purple-50 via-purple-50/80 to-fuchsia-50 border-purple-200/60',
      textColor: 'text-purple-900',
      descColor: 'text-purple-700/70',
      badgeBg: 'bg-purple-100 border-purple-200 text-purple-700',
      sampleBg: 'bg-purple-100/60 border-purple-200/50 text-purple-800',
      sampleLabel: 'text-purple-500',
      loginBg: 'bg-purple-900 hover:bg-purple-700',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans antialiased text-slate-800 selection:bg-primary-500 selection:text-white">
      
      {/* College Institutional Navigation Bar */}
      <header className="bg-white border-b border-slate-200/80 px-4 sm:px-8 py-4 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary-950 to-primary-700 flex items-center justify-center text-white shadow-md shadow-primary-950/20">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900">
                  RAJALAKSHMI ENGINEERING COLLEGE
                </span>
                <span className="hidden sm:inline-block px-2.5 py-0.5 text-[11px] font-extrabold bg-amber-100 text-amber-900 rounded-full border border-amber-300">
                  AUTONOMOUS
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold">
                Department of Computer Science and Design &bull; Official Digital Portal Gateway
              </p>
            </div>
          </div>

          {/* Active Session Status or Login indicator */}
          <div className="flex items-center gap-3">
            {currentSession ? (
              <div className="flex items-center gap-3 bg-slate-100 py-1.5 px-3 rounded-2xl border border-slate-200">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-900 leading-tight">{currentSession.name}</p>
                  <span className="text-[10px] text-primary-700 font-bold uppercase">{currentSession.role} Active</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(getRoleDashboardPath(currentSession.role))}
                  className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all"
                >
                  My Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearAuthSession();
                    setCurrentSession(null);
                  }}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">Official Stakeholder Login Directory</span>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Main Gateway Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        
        {/* Hero Banner Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-50 border border-primary-200/80 text-primary-700 text-xs font-bold shadow-xs">
            <Sparkles className="w-4 h-4 text-primary-600" />
            <span>REC Digital Campus Governance Initiative</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Digital On-Duty (OD) <br />
            <span className="bg-gradient-to-r from-primary-700 via-sky-600 to-teal-600 bg-clip-text text-transparent">
              Tracking & Approval Portal
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
            Select your dedicated institutional portal below to access your secure dashboard, or launch the unified multi-role command center to access all dashboards simultaneously.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/portal"
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-primary-900 via-slate-900 to-indigo-900 hover:from-primary-950 hover:to-indigo-950 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2.5 shadow-xl hover:shadow-2xl transition-all transform hover:scale-[1.02]"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Launch All Dashboards Unified Portal</span>
              <ArrowRight className="w-4 h-4 text-primary-300" />
            </Link>
          </div>
        </div>

        {/* 4 Dedicated Stakeholder Login Gateway Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {portals.map((portal) => {
            const Icon = portal.icon;
            return (
              <div
                key={portal.role}
                className={`rounded-3xl p-6 border shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden group ${
                  (portal as any).cardBg
                    ? `${(portal as any).cardBg} ${portal.accentBorder}`
                    : `bg-white border-slate-200/90 ${portal.accentBorder}`
                }`}
              >
                <div className="space-y-4">
                  
                  {/* Icon & Role Header */}
                  <div className="flex items-center justify-between">
                    <div className={`p-3.5 rounded-2xl shadow-md ${portal.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      (portal as any).badgeBg ?? 'text-slate-500 bg-slate-100 border-slate-200/60'
                    }`}>
                      {portal.badge}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-2">
                    <h2 className={`text-lg font-black tracking-tight transition-colors ${
                      (portal as any).textColor ?? 'text-slate-900 group-hover:text-primary-700'
                    }`}>
                      {portal.title}
                    </h2>
                    <p className={`text-xs leading-relaxed ${
                      (portal as any).descColor ?? 'text-slate-500'
                    }`}>
                      {portal.description}
                    </p>
                  </div>

                  {/* Default Demo User */}
                  <div className={`p-2.5 rounded-xl border text-[11px] ${
                    (portal as any).sampleBg ?? 'bg-slate-50 border-slate-100 text-slate-600'
                  }`}>
                    <span className={`text-[10px] font-bold uppercase block ${
                      (portal as any).sampleLabel ?? 'text-slate-400'
                    }`}>Authorized Persona</span>
                    <strong>{portal.sampleUser}</strong>
                  </div>

                </div>

                {/* Login Button */}
                <div className="pt-6">
                  <Link
                    to={portal.loginPath}
                    className={`w-full py-3 px-4 rounded-xl text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all group-hover:scale-[1.02] ${
                      (portal as any).loginBg ?? 'bg-slate-900 hover:bg-primary-700'
                    }`}
                  >
                    <span>Login to {portal.role}</span>
                    <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>

              </div>
            );
          })}
        </div>

        {/* 4-Stage Workflow Diagram */}
        <div className="bg-gradient-to-r from-primary-950 via-slate-900 to-primary-900 text-white rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <span className="text-xs font-bold text-primary-400 uppercase tracking-widest">
                  Streamlined Operational Pipeline
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                  4-Tier Automated OD Approval Workflow
                </h3>
              </div>
              <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-slate-300 border border-white/10 self-start sm:self-auto">
                Real-Time Attendance Sync
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white font-black text-xs flex items-center justify-center">1</span>
                  <h4 className="font-bold text-sm text-white">Student Submission</h4>
                </div>
                <p className="text-xs text-slate-300">
                  Student submits OD request with event brochure/letter. Initial status logged as Pending.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-500 text-white font-black text-xs flex items-center justify-center">2</span>
                  <h4 className="font-bold text-sm text-white">Mentor Review</h4>
                </div>
                <p className="text-xs text-slate-300">
                  Mentor audits purpose, student eligibility, and verifies supporting proof before recommendation.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-500 text-white font-black text-xs flex items-center justify-center">3</span>
                  <h4 className="font-bold text-sm text-white">Class Incharge Endorsement</h4>
                </div>
                <p className="text-xs text-slate-300">
                  Class Incharge checks attendance threshold & CAT performance before endorsing to HOD.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-500 text-white font-black text-xs flex items-center justify-center">4</span>
                  <h4 className="font-bold text-sm text-white">HOD Final Sanction</h4>
                </div>
                <p className="text-xs text-slate-300">
                  HOD grants final approval, triggering automatic attendance credit and student notification.
                </p>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* College Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-6 px-4 text-center text-xs text-slate-500 space-y-1">
        <p className="font-bold text-slate-700">
          OD Tracking Application &bull; Rajalakshmi Engineering College &copy; {new Date().getFullYear()}
        </p>
        <p className="text-[11px] text-slate-400">
          Autonomous Institution Affiliated to Anna University &bull; Approved by AICTE &bull; NAAC 'A++' Accredited
        </p>
      </footer>

    </div>
  );
};
