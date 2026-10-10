import React, { useState, useEffect } from 'react';
import { 
  KeyRound, Mail, ShieldCheck, Lock, Eye, EyeOff, 
  AlertCircle, CheckCircle2, RefreshCw, X, ArrowRight, ShieldAlert 
} from 'lucide-react';
import { apiChangePassword, apiSendOtp, apiVerifyOtp, apiResetPasswordOtp } from '../services/api';
import { useToast } from './Toast';
import { getAuthSession } from '../data/mockData';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  onSuccess?: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  onSuccess
}) => {
  const { showToast } = useToast();
  const session = getAuthSession();
  const currentEmail = userEmail || session?.email || '';

  const [activeTab, setActiveTab] = useState<'current_password' | 'email_otp'>('current_password');

  // Method A State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPasswordA, setNewPasswordA] = useState('');
  const [confirmPasswordA, setConfirmPasswordA] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPasswordA, setShowNewPasswordA] = useState(false);
  const [showConfirmA, setShowConfirmA] = useState(false);
  const [isSubmittingA, setIsSubmittingA] = useState(false);
  const [errorA, setErrorA] = useState<string | null>(null);

  // Method B State
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [newPasswordB, setNewPasswordB] = useState('');
  const [confirmPasswordB, setConfirmPasswordB] = useState('');
  const [showNewPasswordB, setShowNewPasswordB] = useState(false);
  const [showConfirmB, setShowConfirmB] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isSubmittingB, setIsSubmittingB] = useState(false);
  const [errorB, setErrorB] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(300); // 5 minutes
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);

  // Reset form when opened/closed
  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPasswordA('');
      setConfirmPasswordA('');
      setErrorA(null);

      setOtpSent(false);
      setOtpCode('');
      setNewPasswordB('');
      setConfirmPasswordB('');
      setErrorB(null);
      setTimerSeconds(300);
      setCanResend(false);
      setResendCooldown(60);

      // Mask email for display
      if (currentEmail) {
        const parts = currentEmail.split('@');
        if (parts.length === 2) {
          const name = parts[0];
          const maskedName = name.length > 3 ? `${name.slice(0, 2)}***${name.slice(-1)}` : `${name}***`;
          setMaskedEmail(`${maskedName}@${parts[1]}`);
        } else {
          setMaskedEmail(currentEmail);
        }
      }
    }
  }, [isOpen, currentEmail]);

  // Countdown timer for OTP expiry
  useEffect(() => {
    let interval: any = null;
    if (otpSent && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [otpSent, timerSeconds]);

  // Cooldown timer for OTP resend
  useEffect(() => {
    let interval: any = null;
    if (otpSent && resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [otpSent, resendCooldown]);

  if (!isOpen) return null;

  // Format timer MM:SS
  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Handle Method A: Change with Current Password
  const handleSubmitMethodA = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorA(null);

    if (!currentPassword) {
      setErrorA('Please enter your current password.');
      return;
    }
    if (!newPasswordA || newPasswordA.length < 6) {
      setErrorA('New password must be at least 6 characters long.');
      return;
    }
    if (newPasswordA !== confirmPasswordA) {
      setErrorA('New password and confirmation do not match.');
      return;
    }
    if (currentPassword === newPasswordA) {
      setErrorA('New password must be different from your current password.');
      return;
    }

    setIsSubmittingA(true);
    try {
      const res = await apiChangePassword(currentPassword, newPasswordA, confirmPasswordA);
      if (res.success) {
        showToast('Password changed successfully! A confirmation has been sent to your email.', 'success');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorA(res.error || 'Failed to update password.');
      }
    } catch {
      setErrorA('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmittingA(false);
    }
  };

  // Handle Method B: Dispatch OTP
  const handleSendOtp = async () => {
    setErrorB(null);
    setIsSendingOtp(true);
    try {
      const res = await apiSendOtp(currentEmail);
      if (res.success) {
        setOtpSent(true);
        setTimerSeconds(300);
        setCanResend(false);
        setResendCooldown(60);
        showToast('6-digit OTP code sent to your registered college email!', 'success');
      } else {
        setErrorB(res.error || 'Failed to send OTP. Please try again.');
      }
    } catch {
      setErrorB('Network error sending OTP. Please verify your connection.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Handle Method B: Submit OTP & Reset Password
  const handleSubmitMethodB = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorB(null);

    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setErrorB('Please enter a valid 6-digit verification code.');
      return;
    }
    if (!newPasswordB || newPasswordB.length < 6) {
      setErrorB('New password must be at least 6 characters long.');
      return;
    }
    if (newPasswordB !== confirmPasswordB) {
      setErrorB('New password and confirmation do not match.');
      return;
    }
    if (timerSeconds <= 0) {
      setErrorB('The OTP code has expired. Please request a new one.');
      return;
    }

    setIsSubmittingB(true);
    try {
      const res = await apiResetPasswordOtp({
        otp: cleanOtp,
        newPassword: newPasswordB,
        confirmPassword: confirmPasswordB,
        email: currentEmail,
      });

      if (res.success) {
        showToast('Password updated securely via Email OTP verification!', 'success');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorB(res.error || 'Failed to verify OTP or update password.');
      }
    } catch {
      setErrorB('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmittingB(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-lg border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-primary-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/15">
              <KeyRound className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Security & Change Password</h3>
              <p className="text-[11px] text-slate-300">Choose your preferred verification method</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('current_password')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'current_password'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-black'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-primary-600" />
            <span>Method A: Current Password</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('email_otp')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'email_otp'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-black'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-amber-600" />
            <span>Method B: Email OTP</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* METHOD A: CURRENT PASSWORD */}
          {activeTab === 'current_password' && (
            <form onSubmit={handleSubmitMethodA} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 leading-relaxed">
                Provide your active password and set a new password of at least 6 characters. A security alert will be dispatched to your registered college email.
              </div>

              {errorA && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorA}</span>
                </div>
              )}

              {/* Current Password */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Current Password</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-3.5 pr-10 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPasswordA ? 'text' : 'password'}
                    value={newPasswordA}
                    onChange={(e) => setNewPasswordA(e.target.value)}
                    placeholder="Minimum 6 characters"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-3.5 pr-10 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPasswordA(!showNewPasswordA)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPasswordA ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmA ? 'text' : 'password'}
                    value={confirmPasswordA}
                    onChange={(e) => setConfirmPasswordA(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-3.5 pr-10 text-xs font-medium focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmA(!showConfirmA)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmA ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Match Indicator */}
              {confirmPasswordA && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                  {newPasswordA === confirmPasswordA ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                    </span>
                  ) : (
                    <span className="text-rose-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match
                    </span>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingA}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {isSubmittingA ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* METHOD B: EMAIL OTP VERIFICATION */}
          {activeTab === 'email_otp' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
                A 6-digit cryptographically secure verification code will be sent to your registered institutional email: <strong className="font-mono text-slate-900">{maskedEmail || 'your registered email'}</strong>. The code expires in 5 minutes.
              </div>

              {errorB && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorB}</span>
                </div>
              )}

              {/* Step 1: Request OTP */}
              {!otpSent ? (
                <div className="text-center py-4 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center border border-amber-200 shadow-inner">
                    <Mail className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Dispatch Security OTP</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Click below to send a 6-digit verification code to your email.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isSendingOtp}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md shadow-amber-600/25 transition-all disabled:opacity-50"
                  >
                    {isSendingOtp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Dispatching OTP...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5" />
                        <span>Send 6-Digit OTP</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Step 2: Enter OTP & Set New Password */
                <form onSubmit={handleSubmitMethodB} className="space-y-4">
                  {/* OTP Input with Timer */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Enter 6-Digit Email OTP</span>
                      <span className={`text-[11px] ${timerSeconds < 60 ? 'text-rose-600 animate-pulse' : 'text-slate-500'}`}>
                        Expires in: {formatTimer(timerSeconds)}
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-center text-base tracking-widest font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={!canResend || isSendingOtp}
                        className="px-3 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl whitespace-nowrap disabled:opacity-40 transition-colors"
                        title={canResend ? 'Resend code' : `Wait ${resendCooldown}s to resend`}
                      >
                        {isSendingOtp ? 'Sending...' : canResend ? 'Resend OTP' : `Resend (${resendCooldown}s)`}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPasswordB ? 'text' : 'password'}
                        value={newPasswordB}
                        onChange={(e) => setNewPasswordB(e.target.value)}
                        placeholder="Minimum 6 characters"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-3.5 pr-10 text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPasswordB(!showNewPasswordB)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPasswordB ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmB ? 'text' : 'password'}
                        value={confirmPasswordB}
                        onChange={(e) => setConfirmPasswordB(e.target.value)}
                        placeholder="Re-enter new password"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-3.5 pr-10 text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmB(!showConfirmB)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmB ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Match Indicator */}
                  {confirmPasswordB && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                      {newPasswordB === confirmPasswordB ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                        </span>
                      ) : (
                        <span className="text-rose-500 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match
                        </span>
                      )}
                    </div>
                  )}

                  <div className="pt-2 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingB || timerSeconds <= 0}
                      className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition-all disabled:opacity-50"
                    >
                      {isSubmittingB ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying & Updating...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Verify OTP & Change Password</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>

        {/* Footer Note */}
        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-100 text-center">
          <span className="text-[10px] text-slate-400 font-semibold">
            All password changes trigger an instant security notification to your registered institutional inbox.
          </span>
        </div>

      </div>
    </div>
  );
};
