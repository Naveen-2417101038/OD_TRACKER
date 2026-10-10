import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Landmark, GraduationCap, UserCheck, Users, 
  Building2, Lock, User, Eye, EyeOff, 
  AlertCircle, ArrowRight, ShieldCheck,
  CheckCircle2, HelpCircle, Sparkles, RefreshCw, Mail, KeyRound
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { 
  authenticateUserAsync, 
  getAuthSession, 
  getRoleDashboardPath,
  forgotPasswordAsync,
  registerUserAsync 
} from '../data/mockData';
import { apiSendOtp, apiResetPasswordOtp } from '../services/api';

import { UserRole } from '../types/types';

interface RoleOption {
  role: UserRole;
  label: string;
  badge: string;
  icon: React.FC<{ className?: string }>;
  idLabel: string;
  placeholder: string;
  subtitle: string;
  features: string[];
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'Student',
    label: 'Student',
    badge: 'UG / PG Students',
    icon: GraduationCap,
    idLabel: 'Register Number / Student ID',
    placeholder: 'Enter Register Number (e.g. 23CSD001)',
    subtitle: 'Apply for On-Duty leave, upload event proofs, track live 4-stage approval workflow, and verify certificates.',
    features: ['Instant OD Submission', 'Live Workflow Tracker', 'Attendance Sync View', 'Certificate Repository']
  },
  {
    role: 'Mentor',
    label: 'Faculty / Mentor',
    badge: 'Faculty Mentor',
    icon: UserCheck,
    idLabel: 'Faculty ID / Employee ID',
    placeholder: 'Enter Faculty ID (e.g. FAC001)',
    subtitle: 'Review assigned mentee OD applications, audit eligibility criteria, verify proofs, and endorse applications.',
    features: ['Mentee Queue Management', 'Proof & Brochure Inspection', 'One-Click Endorsement', 'Attendance Monitoring']
  },
  {
    role: 'Class Incharge',
    label: 'Class Incharge',
    badge: 'Section Incharge',
    icon: Users,
    idLabel: 'Faculty ID / Employee ID',
    placeholder: 'Enter Faculty ID (e.g. FAC002)',
    subtitle: 'Monitor section attendance thresholds (>75%), verify CAT marks, and forward applications to HOD.',
    features: ['Attendance Threshold Auditing', 'CAT 1/2 Marks Verification', 'Section-wide OD Batching', 'Forwarding to HOD']
  },
  {
    role: 'HOD',
    label: 'HOD Executive',
    badge: 'Department Head',
    icon: Building2,
    idLabel: 'HOD ID / Executive ID',
    placeholder: 'Enter HOD ID (e.g. FAC004)',
    subtitle: 'Department analytics, final institutional approval sign-offs, compensatory attendance sanctions, and audits.',
    features: ['Final OD Sanction Sign-Off', 'Compensatory Attendance Credit', 'Department Analytics', 'Official Audit Logs']
  }
];

const ROLE_THEMES: Record<UserRole, {
  pageBg: string;
  leftGradient: string;
  orb1: string;
  orb2: string;
  titleGradient: string;
  tagBg: string;
  tagText: string;
  activeBtn: string;
  submitBtn: string;
  focusRing: string;
  roleBadge: string;
}> = {
  Student: {
    pageBg: 'bg-slate-100',
    leftGradient: 'from-primary-950 via-slate-900 to-primary-900',
    orb1: 'bg-primary-500/15',
    orb2: 'bg-blue-600/15',
    titleGradient: 'from-primary-400 via-sky-300 to-teal-300',
    tagBg: 'bg-blue-500/20 border-blue-400/30',
    tagText: 'text-blue-200',
    activeBtn: 'bg-blue-600 text-white shadow-md shadow-blue-600/25 scale-[1.02]',
    submitBtn: 'bg-slate-900 hover:bg-blue-700 shadow-slate-900/15',
    focusRing: 'focus:border-blue-500 focus:ring-blue-500/15',
    roleBadge: 'bg-blue-600 text-white',
  },
  Mentor: {
    pageBg: 'bg-gradient-to-br from-indigo-50/70 via-slate-50 to-violet-50/50',
    leftGradient: 'from-indigo-950 via-slate-900 to-indigo-900',
    orb1: 'bg-indigo-500/25',
    orb2: 'bg-violet-600/20',
    titleGradient: 'from-indigo-300 via-violet-200 to-purple-300',
    tagBg: 'bg-indigo-500/20 border-indigo-400/30',
    tagText: 'text-indigo-200',
    activeBtn: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-[1.02]',
    submitBtn: 'bg-indigo-900 hover:bg-indigo-700 shadow-indigo-900/20',
    focusRing: 'focus:border-indigo-500 focus:ring-indigo-500/15',
    roleBadge: 'bg-indigo-600 text-white',
  },
  'Class Incharge': {
    pageBg: 'bg-gradient-to-br from-teal-50/70 via-slate-50 to-emerald-50/50',
    leftGradient: 'from-teal-950 via-slate-900 to-teal-900',
    orb1: 'bg-teal-500/25',
    orb2: 'bg-emerald-600/20',
    titleGradient: 'from-teal-300 via-emerald-200 to-cyan-300',
    tagBg: 'bg-teal-500/20 border-teal-400/30',
    tagText: 'text-teal-200',
    activeBtn: 'bg-teal-600 text-white shadow-md shadow-teal-600/30 scale-[1.02]',
    submitBtn: 'bg-teal-900 hover:bg-teal-700 shadow-teal-900/20',
    focusRing: 'focus:border-teal-500 focus:ring-teal-500/15',
    roleBadge: 'bg-teal-600 text-white',
  },
  HOD: {
    pageBg: 'bg-gradient-to-br from-purple-50/70 via-slate-50 to-fuchsia-50/50',
    leftGradient: 'from-purple-950 via-slate-900 to-purple-900',
    orb1: 'bg-purple-500/25',
    orb2: 'bg-fuchsia-600/20',
    titleGradient: 'from-purple-300 via-fuchsia-200 to-pink-300',
    tagBg: 'bg-purple-500/20 border-purple-400/30',
    tagText: 'text-purple-200',
    activeBtn: 'bg-purple-700 text-white shadow-md shadow-purple-700/30 scale-[1.02]',
    submitBtn: 'bg-purple-900 hover:bg-purple-700 shadow-purple-900/20',
    focusRing: 'focus:border-purple-500 focus:ring-purple-500/15',
    roleBadge: 'bg-purple-700 text-white',
  },
  Admin: {
    pageBg: 'bg-gradient-to-br from-amber-50/70 via-slate-50 to-orange-50/50',
    leftGradient: 'from-slate-950 via-zinc-900 to-amber-950',
    orb1: 'bg-amber-500/20',
    orb2: 'bg-orange-600/15',
    titleGradient: 'from-amber-300 via-orange-200 to-yellow-300',
    tagBg: 'bg-amber-500/20 border-amber-400/30',
    tagText: 'text-amber-200',
    activeBtn: 'bg-amber-600 text-white shadow-md shadow-amber-600/30 scale-[1.02]',
    submitBtn: 'bg-slate-900 hover:bg-amber-700 shadow-slate-900/20',
    focusRing: 'focus:border-amber-500 focus:ring-amber-500/15',
    roleBadge: 'bg-amber-600 text-white',
  }
};

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [selectedRole, setSelectedRole] = useState<UserRole>('Student');
  const activeRoleConfig = ROLE_OPTIONS.find(r => r.role === selectedRole) || ROLE_OPTIONS[0];
  const currentTheme = ROLE_THEMES[selectedRole] || ROLE_THEMES.Student;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'otp'>('email');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPass, setShowForgotNewPass] = useState(false);
  const [showForgotConfirmPass, setShowForgotConfirmPass] = useState(false);
  const [forgotTimer, setForgotTimer] = useState(300);
  const [forgotCanResend, setForgotCanResend] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(60);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  // OTP Countdown timer
  useEffect(() => {
    let interval: any = null;
    if (isForgotModalOpen && forgotStep === 'otp' && forgotTimer > 0) {
      interval = setInterval(() => {
        setForgotTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isForgotModalOpen, forgotStep, forgotTimer]);

  // OTP Resend cooldown timer
  useEffect(() => {
    let interval: any = null;
    if (isForgotModalOpen && forgotStep === 'otp' && forgotCooldown > 0) {
      interval = setInterval(() => {
        setForgotCooldown((prev) => {
          if (prev <= 1) {
            setForgotCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isForgotModalOpen, forgotStep, forgotCooldown]);

  // Open forgot modal helper
  const openForgotModal = () => {
    setForgotStep('email');
    setForgotEmail('');
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotError(null);
    setForgotTimer(300);
    setForgotCanResend(false);
    setForgotCooldown(60);
    setIsForgotModalOpen(true);
  };

  // Dispatch OTP
  const handleSendForgotOtp = async () => {
    if (!forgotEmail || !forgotEmail.includes('@')) {
      setForgotError('Please enter a valid official college email.');
      return;
    }
    setForgotError(null);
    setIsForgotLoading(true);
    try {
      const res = await apiSendOtp(forgotEmail);
      if (res.success) {
        setForgotStep('otp');
        setForgotTimer(300);
        setForgotCanResend(false);
        setForgotCooldown(60);
        showToast('6-digit verification OTP sent to your institutional email!', 'success');
      } else {
        setForgotError(res.error || 'Failed to dispatch OTP. Please verify email.');
      }
    } catch {
      setForgotError('Unable to connect to server. Please verify network.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  // Verify OTP and reset password
  const handleVerifyForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    const cleanOtp = forgotOtp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setForgotError('Please enter a valid 6-digit OTP code.');
      return;
    }
    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setForgotError('New password must be at least 6 characters long.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('New password and confirmation do not match.');
      return;
    }
    if (forgotTimer <= 0) {
      setForgotError('OTP has expired. Please request a new code.');
      return;
    }

    setIsForgotLoading(true);
    try {
      const res = await apiResetPasswordOtp({
        otp: cleanOtp,
        newPassword: forgotNewPassword,
        confirmPassword: forgotConfirmPassword,
        email: forgotEmail,
      });

      if (res.success) {
        showToast('Password reset successfully! You can now sign in with your new credentials.', 'success');
        setIsForgotModalOpen(false);
      } else {
        setForgotError(res.error || 'Failed to reset password. Please check OTP.');
      }
    } catch {
      setForgotError('Unable to connect to server. Please try again.');
    } finally {
      setIsForgotLoading(false);
    }
  };


  // Registration Modal State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regRegisterNumber, setRegRegisterNumber] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('Student');
  const [regIsLoading, setRegIsLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Auto redirect if user already has an active authenticated session
  useEffect(() => {
    const session = getAuthSession();
    if (session) {
      navigate(getRoleDashboardPath(session.role), { replace: true });
    }
  }, [navigate]);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setError(null);
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError(`${activeRoleConfig.idLabel} is required.`);
      return;
    }

    if (!password) {
      setError('Password is required.');
      return;
    }

    setIsLoading(true);

    try {
      // Authenticate against backend
      const result = await authenticateUserAsync(selectedRole, identifier, password);
      setIsLoading(false);

      if (result.session) {
        showToast(
          `Welcome back, ${result.session.name}! Authenticated as ${result.session.role}. Redirecting...`, 
          'success'
        );
        const destination = result.dashboardUrl || getRoleDashboardPath(result.session.role);
        navigate(destination, { replace: true });
      } else {
        const errMsg = result.error || 'Invalid email or password.';
        setError(errMsg);
        showToast(errMsg, 'error');
      }
    } catch {
      setIsLoading(false);
      setError('An unexpected error occurred during authentication. Please try again.');
      showToast('Authentication error.', 'error');
    }
  };



  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!regEmail || !regPassword || !regConfirmPassword || !regFullName) {
      setRegError('All required registration fields must be completed.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match.');
      return;
    }

    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters long.');
      return;
    }

    if (!regEmail.toLowerCase().endsWith('@rajalakshmi.edu.in')) {
      setRegError('Only official @rajalakshmi.edu.in institutional email addresses are permitted.');
      return;
    }

    setRegIsLoading(true);
    const result = await registerUserAsync({
      email: regEmail,
      password: regPassword,
      confirmPassword: regConfirmPassword,
      fullName: regFullName,
      registerNumber: regRegisterNumber,
      role: regRole,
    });
    setRegIsLoading(false);

    if (result.success) {
      showToast(result.message || 'Account registered! Please check your email to verify your account.', 'success');
      setIsRegisterModalOpen(false);
      setRegEmail('');
      setRegPassword('');
      setRegConfirmPassword('');
      setRegFullName('');
      setRegRegisterNumber('');
    } else {
      setRegError(result.error || 'Registration failed.');
    }
  };

  return (
    <div className={`min-h-screen ${currentTheme.pageBg} flex flex-col justify-between font-sans antialiased text-slate-800 transition-colors duration-500 selection:bg-primary-500 selection:text-white`}>
      
      {/* College Institutional Navigation Bar */}
      <header className="bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3.5 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-950 to-primary-700 flex items-center justify-center text-white shadow-md shadow-primary-950/20">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900">
                  RAJALAKSHMI ENGINEERING COLLEGE
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-extrabold bg-amber-100 text-amber-900 rounded-full border border-amber-300">
                  AUTONOMOUS
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-semibold">
                Department of Computer Science and Design &bull; Unified OD Tracking Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Common Institutional Portal
            </span>
          </div>

        </div>
      </header>

      {/* Main Single Login Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-2xl shadow-slate-200/60 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
          
          {/* Left Column: Institutional Information & Dynamic Role Highlights */}
          <div className={`lg:col-span-5 bg-gradient-to-br ${currentTheme.leftGradient} p-8 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden transition-all duration-500`}>
            
            {/* Background Aesthetic Orbs */}
            <div className={`absolute top-0 right-0 w-80 h-80 ${currentTheme.orb1} rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 transition-all duration-500`} />
            <div className={`absolute bottom-0 left-0 w-80 h-80 ${currentTheme.orb2} rounded-full blur-2xl pointer-events-none -ml-20 -mb-20 transition-all duration-500`} />

            <div className="relative z-10 flex items-center justify-center h-full">
              
              {/* Title & Role Indicator */}
              <div className="space-y-3 text-center">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${currentTheme.tagBg} ${currentTheme.tagText} border text-xs font-bold transition-all duration-300`}>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{activeRoleConfig.badge}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
                  DIGITAL OD <br />
                  <span className={`bg-gradient-to-r ${currentTheme.titleGradient} bg-clip-text text-transparent`}>
                    TRACKING SYSTEM
                  </span>
                </h1>
                <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed pt-1">
                  {activeRoleConfig.subtitle}
                </p>
              </div>

            </div>

          </div>

          {/* Right Column: Role Options & Login Form */}
          <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 bg-white flex flex-col justify-center">
            
            <div className="max-w-md w-full mx-auto space-y-6">
              
              {/* Role Options Header & Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Select Role
                  </span>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    Unified Login for All Roles
                  </span>
                </div>

                {/* 4 Role Option Buttons */}
                <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 w-full">
                  {ROLE_OPTIONS.map((r) => {
                    const Icon = r.icon;
                    const isActive = selectedRole === r.role;
                    return (
                      <button
                        key={r.role}
                        type="button"
                        onClick={() => handleRoleSelect(r.role)}
                        className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isActive
                            ? currentTheme.activeBtn
                            : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
                        }`}
                      >
                        <Icon className={`w-4 h-4 mb-1 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span className="text-[11px] leading-tight text-center truncate w-full">{r.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-700 font-semibold leading-relaxed">{error}</p>
                </div>
              )}

              {/* Login Form (Clean inputs without autofilling) */}
              <form onSubmit={handleLogin} className="space-y-4">
                
                {/* Identifier Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {activeRoleConfig.idLabel}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={activeRoleConfig.placeholder}
                      required
                      autoComplete="username"
                      className={`w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-3 transition-all uppercase ${currentTheme.focusRing}`}
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsForgotModalOpen(true)}
                      className="text-xs font-bold text-primary-600 hover:text-primary-700 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      required
                      autoComplete="current-password"
                      className={`w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-10 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-3 transition-all ${currentTheme.focusRing}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password Link */}
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center gap-2 text-slate-600 font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-[18px] h-[18px] min-w-[18px] min-h-[18px] max-w-[18px] max-h-[18px] rounded border border-slate-300 accent-primary-600 text-primary-600 focus:ring-2 focus:ring-primary-500/20 cursor-pointer shrink-0"
                    />
                    <span className="text-xs text-slate-600 font-semibold leading-tight">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={openForgotModal}
                    className="text-xs font-bold text-primary-600 hover:text-primary-800 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-3.5 px-4 rounded-xl text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer ${currentTheme.submitBtn}`}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Authenticating & Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Login to {activeRoleConfig.label} Dashboard</span>
                      <ArrowRight className="w-4 h-4 text-primary-300" />
                    </>
                  )}
                </button>

                {/* Create Account / Register Action */}
                <div className="pt-2 text-center">
                  <span className="text-xs text-slate-500 font-medium">Don't have an account yet? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRegError(null);
                      setIsRegisterModalOpen(true);
                    }}
                    className="text-xs font-bold text-primary-600 hover:text-primary-800 hover:underline cursor-pointer"
                  >
                    Create Account / Register
                  </button>
                </div>

              </form>

              {/* Security Note */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5 text-[11px] text-slate-400 font-medium">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Academic Workflow Portal</span>
                </div>
                <Link
                  to="/admin/login"
                  className="inline-flex items-center gap-1.5 font-bold text-amber-700 hover:text-amber-800 transition-colors bg-amber-50 hover:bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200/60"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>Admin Console →</span>
                </Link>
              </div>

            </div>

          </div>

        </div>
      </main>

      {/* Forgot Password Modal (Method B: Email OTP Verification) */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Reset Portal Password</h3>
                <p className="text-xs text-slate-500">
                  {forgotStep === 'email' ? 'Enter your registered college email' : 'Verify OTP code & set new password'}
                </p>
              </div>
            </div>

            {forgotError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotStep === 'email' ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Official College Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="e.g. yourname@rajalakshmi.edu.in"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    A cryptographically secure 6-digit OTP will be dispatched to this address.
                  </p>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendForgotOtp}
                    disabled={isForgotLoading}
                    className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isForgotLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending OTP...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5" />
                        <span>Send 6-Digit OTP</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleVerifyForgotOtp} className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-900">
                  Verification OTP dispatched to <span className="font-bold">{forgotEmail}</span>. Code expires in{' '}
                  <span className="font-mono font-bold text-rose-600">
                    {Math.floor(forgotTimer / 60)}:{(forgotTimer % 60) < 10 ? '0' : ''}{forgotTimer % 60}
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Enter 6-Digit OTP</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center text-base tracking-widest font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSendForgotOtp}
                      disabled={!forgotCanResend || isForgotLoading}
                      className="px-3 py-2 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl disabled:opacity-40 whitespace-nowrap"
                    >
                      {forgotCanResend ? 'Resend' : `${forgotCooldown}s`}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">New Password</label>
                  <div className="relative">
                    <input
                      type={showForgotNewPass ? 'text' : 'password'}
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-3 pr-9 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotNewPass(!showForgotNewPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showForgotNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showForgotConfirmPass ? 'text' : 'password'}
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-3 pr-9 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotConfirmPass(!showForgotConfirmPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showForgotConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep('email')}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isForgotLoading || forgotTimer <= 0}
                    className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isForgotLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Reset Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Account Registration Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-primary-50 text-primary-600 border border-primary-200">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Create Institutional Account</h3>
                  <p className="text-xs text-slate-500">Only @rajalakshmi.edu.in emails allowed</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                &times;
              </button>
            </div>

            {regError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{regError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Official College Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="e.g. name@rajalakshmi.edu.in"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Register No. / Employee ID
                  </label>
                  <input
                    type="text"
                    value={regRegisterNumber}
                    onChange={(e) => setRegRegisterNumber(e.target.value)}
                    placeholder="e.g. 23CSD001 / FAC101"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Role Type
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none font-medium"
                  >
                    <option value="Student">Student</option>
                    <option value="Mentor">Faculty / Mentor</option>
                    <option value="Class Incharge">Class Incharge</option>
                    <option value="Counsellor">Counsellor</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
                <strong>Verification Notice:</strong> A verification link will be sent to your official college email. You must click the verification link to activate your account before logging in.
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={regIsLoading}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {regIsLoading ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* College Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-4 px-4 text-center text-xs text-slate-500 space-y-0.5">
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
