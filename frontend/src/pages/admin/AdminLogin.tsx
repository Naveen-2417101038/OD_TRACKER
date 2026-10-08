import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ShieldCheck, Lock, Mail, Eye, EyeOff, AlertCircle, 
  ArrowRight, Landmark, ArrowLeft, KeyRound, 
  CheckCircle2, ShieldAlert, Cpu
} from 'lucide-react';
import { useToast } from '../../components/Toast';
import { authenticateUserAsync, getAuthSession } from '../../data/mockData';

export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // If already authenticated as Admin, auto-navigate to /admin/dashboard
  useEffect(() => {
    const session = getAuthSession();
    if (session && session.role === 'Admin') {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleFillDemoAdmin = () => {
    setIdentifier('admin@rajalakshmi.edu.in');
    setPassword('password123');
    setError(null);
    showToast('Demo Administrator credentials populated', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError('Please provide an Admin ID or Institutional Email.');
      return;
    }
    if (!password) {
      setError('Please provide your administrator password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authenticateUserAsync('Admin', identifier.trim(), password);

      if (res.session && res.session.role === 'Admin') {
        showToast('Administrator session established successfully', 'success');
        navigate(res.dashboardUrl || '/admin/dashboard', { replace: true });
      } else {
        setError(res.error || 'Access Denied: Invalid administrator credentials or role mismatch.');
      }
    } catch {
      setError('Connection failure: Unable to establish secure session with institutional authentication services.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950 font-sans relative overflow-hidden">
      
      {/* Background Ambient Glows & Tech Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(245,158,11,0.15),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-amber-600/10 via-indigo-600/10 to-transparent blur-[120px] rounded-full pointer-events-none" />
      
      {/* Top Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/25">
              <Landmark className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm tracking-tight text-white uppercase">Rajalakshmi Engineering College</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ADMIN PORTAL
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Institutional On-Duty Governance & System Administration</p>
            </div>
          </div>

          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Academic Portal</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-lg w-full mx-auto px-4 py-8 sm:py-12 flex-1 flex flex-col justify-center">
        
        {/* Security Alert Header */}
        <div className="mb-6 text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-2 shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            System Administration Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
            Restricted institutional control center. Enter authorized administrative credentials to access system telemetry, user lifecycles, and configuration.
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          
          {/* Subtle Top Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />

          {/* Quick Demo Fill Bar */}
          <div className="mb-6 p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-left">
                <p className="text-[11px] font-bold text-slate-200">Demo Administrator Account</p>
                <p className="text-[10px] text-slate-400">admin@rajalakshmi.edu.in</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleFillDemoAdmin}
              className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all cursor-pointer whitespace-nowrap"
            >
              Autofill Credentials
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Identifier Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Admin Identifier / Institutional Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="admin@rajalakshmi.edu.in or ADM001"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Admin Password
                </label>
                <span className="text-[11px] text-slate-500 font-medium">Secured with bcrypt</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-10 pr-10 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500/20 cursor-pointer"
                />
                <span>Maintain trusted session</span>
              </label>
              <span className="text-[11px] text-amber-400/80 font-semibold flex items-center gap-1">
                <Cpu className="w-3 h-3" /> System Level
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm tracking-wide transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Admin Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>

          {/* Compliance & Security Disclaimer */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-start gap-2.5 text-[11px] text-slate-500 leading-normal">
            <ShieldAlert className="w-4 h-4 text-amber-500/70 shrink-0 mt-0.5" />
            <p>
              Access restricted to REC Institutional Administrators. All actions, configuration changes, and roster updates are immutably logged for audit compliance.
            </p>
          </div>

        </div>

        {/* Return to Academic Portal */}
        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors"
          >
            <span>Looking for student or faculty portal? Go to Common Login</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 bg-slate-950/60 px-4 py-4 text-center text-xs text-slate-500">
        <p>© 2026 Rajalakshmi Engineering College. Institutional OD Tracker — System Operations.</p>
      </footer>

    </div>
  );
};
