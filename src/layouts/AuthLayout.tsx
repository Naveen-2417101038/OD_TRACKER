import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Landmark, ShieldCheck, CheckCircle2, 
  FileCheck, Award, ArrowLeft
} from 'lucide-react';
import { UserRole } from '../types/types';

interface AuthLayoutProps {
  role: UserRole;
  roleSubtitle: string;
  roleBadgeColor: string;
  roleIcon: React.ReactNode;
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  role,
  roleSubtitle,
  roleBadgeColor,
  roleIcon,
  children,
}) => {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between font-sans antialiased text-slate-800 selection:bg-primary-500 selection:text-white">
      
      {/* Top Header Bar with College Emblem & Portal Gateway Link */}
      <header className="bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3 shadow-xs sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Institution Header */}
          <Link to="/" className="flex items-center gap-3.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-900 to-primary-700 flex items-center justify-center text-white shadow-md shadow-primary-900/20 group-hover:scale-105 transition-transform">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900">
                  RAJALAKSHMI ENGINEERING COLLEGE
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                  AUTONOMOUS
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Affiliated to Anna University &bull; Chennai
              </p>
            </div>
          </Link>

          {/* Quick Institutional Gateway Link */}
          <Link 
            to="/" 
            className="flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800 bg-primary-50 hover:bg-primary-100/70 px-3 py-1.5 rounded-lg border border-primary-200/60 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Portal Directory</span>
          </Link>
        </div>
      </header>

      {/* Main Split Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-2xl shadow-slate-200/60 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
          
          {/* Left Column: OD Tracking Application & Institutional Hero Branding */}
          <div className="lg:col-span-6 bg-gradient-to-br from-primary-950 via-slate-900 to-primary-900 p-8 sm:p-12 text-white flex flex-col justify-between relative overflow-hidden">
            
            {/* Background Aesthetic Elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/10 rounded-full blur-2xl pointer-events-none -ml-20 -mb-20" />

            <div className="relative z-10 space-y-6">
              
              {/* College & Department Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-primary-200">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Department of Computer Science & Design</span>
              </div>

              {/* Application Main Title */}
              <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
                  OD TRACKING <br />
                  <span className="bg-gradient-to-r from-primary-400 via-sky-300 to-teal-300 bg-clip-text text-transparent">
                    APPLICATION
                  </span>
                </h1>
                <p className="text-sm sm:text-base font-medium text-slate-300">
                  Digital On-Duty Request, Approval & Certificate Tracking System
                </p>
              </div>

              {/* Key System Value Pillars */}
              <div className="pt-2 space-y-3.5">
                <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
                  <div className="p-2 rounded-xl bg-primary-600/30 text-primary-300 border border-primary-400/20">
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-white">4-Tier Digital Approval Workflow</h2>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Student ➔ Mentor ➔ Class Incharge ➔ HOD streamlined pipeline.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
                  <div className="p-2 rounded-xl bg-emerald-600/30 text-emerald-300 border border-emerald-400/20">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-white">Automated Attendance Credit</h2>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Instant compensatory attendance synchronization upon HOD sanction.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
                  <div className="p-2 rounded-xl bg-amber-600/30 text-amber-300 border border-amber-400/20">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-white">Digital Certificate Verification</h2>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Secure document upload, faculty audit & verified credential records.
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Institutional Info */}
            <div className="relative z-10 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-slate-300">REC Portal Network Live</span>
              </div>
              <span>Rajalakshmi Nagar, Thandalam, Chennai</span>
            </div>

          </div>

          {/* Right Column: Dedicated Role Login Card */}
          <div className="lg:col-span-6 p-6 sm:p-10 lg:p-12 bg-white flex flex-col justify-center">
            
            <div className="max-w-md w-full mx-auto space-y-6">
              
              {/* Role Indicator Banner */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-2xl shadow-sm ${roleBadgeColor}`}>
                    {roleIcon}
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-primary-700 tracking-wider uppercase">
                      Dedicated Stakeholder Portal
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {role} Login
                    </h2>
                  </div>
                </div>
              </div>

              {/* Role Subtitle / Description */}
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                {roleSubtitle}
              </p>

              {/* Login Card Form Content */}
              {children}

            </div>

          </div>

        </div>
      </main>

      {/* College Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-4 px-4 text-center text-xs text-slate-500">
        <p className="font-medium">
          OD Tracking Application &bull; Rajalakshmi Engineering College &copy; {new Date().getFullYear()}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          Autonomous Institution Affiliated to Anna University &bull; Approved by AICTE &bull; NAAC 'A++' Grade
        </p>
      </footer>

    </div>
  );
};
