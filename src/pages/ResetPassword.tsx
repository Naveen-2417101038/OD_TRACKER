import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Landmark, ArrowRight } from 'lucide-react';
import { useToast } from '../components/Toast';

export const ResetPassword: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (!token) {
      setError('Missing reset token.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      setIsLoading(false);

      if (res.ok && data.success) {
        setIsSuccess(true);
        showToast('Password reset successfully! You can now log in.', 'success');
      } else {
        setError(data.error || 'Failed to reset password. Link may be expired or invalid.');
      }
    } catch {
      setIsLoading(false);
      setError('Network error. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 font-sans text-slate-800">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-navy-900 to-primary-700 p-6 text-center text-white">
          <div className="flex justify-center mb-3">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <KeyRound className="w-8 h-8 text-amber-400" />
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Reset Account Password</h1>
          <p className="text-xs text-slate-200 mt-1">Rajalakshmi Engineering College OD Portal</p>
        </div>

        {/* Form Body */}
        <div className="p-8">
          {isSuccess ? (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Password Updated!</h2>
                <p className="text-sm text-slate-600 mt-2">
                  Your password has been reset successfully. You can now log in to the OD tracking portal with your new credentials.
                </p>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl shadow-lg shadow-primary-600/30 transition-all flex items-center justify-center gap-2"
              >
                Go to Login <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-slate-600 text-center mb-4">
                Enter your new secure password below to complete the reset process.
              </p>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min. 6 chars)"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl shadow-lg shadow-primary-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? 'Updating Password...' : 'Reset Password'}
              </button>

              <div className="text-center pt-2">
                <Link to="/login" className="text-xs text-slate-500 hover:text-primary-600 transition-colors">
                  Remember password? Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>

        <div className="bg-slate-50 border-t border-slate-100 p-4 text-center text-xs text-slate-500">
          Official Institutional Portal &bull; @rajalakshmi.edu.in
        </div>
      </div>
    </div>
  );
};
