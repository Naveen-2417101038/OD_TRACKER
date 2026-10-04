import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ArrowRight, Landmark } from 'lucide-react';

export const VerifyEmail: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      setIsSuccess(false);
      setMessage('No verification token provided.');
      return;
    }

    const performVerification = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email/${token}`);
        const data = await res.json().catch(() => ({}));

        setIsLoading(false);
        if (res.ok && data.success) {
          setIsSuccess(true);
          setMessage(data.message || 'Your college email address has been verified successfully!');
        } else {
          setIsSuccess(false);
          setMessage(data.error || 'Failed to verify email. The token may be invalid or expired.');
        }
      } catch {
        setIsLoading(false);
        setIsSuccess(false);
        setMessage('Network error while verifying email. Please check your connection.');
      }
    };

    performVerification();
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 font-sans text-slate-800">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-navy-900 to-primary-700 p-6 text-center text-white">
          <div className="flex justify-center mb-3">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <Landmark className="w-8 h-8 text-amber-400" />
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Rajalakshmi Engineering College</h1>
          <p className="text-xs text-slate-200 mt-1">On-Duty (OD) Tracking Portal</p>
        </div>

        {/* Content */}
        <div className="p-8 text-center">
          {isLoading ? (
            <div className="py-8 space-y-4">
              <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto" />
              <h2 className="text-lg font-semibold text-slate-800">Verifying Email Address...</h2>
              <p className="text-sm text-slate-500">Communicating with institutional verification server.</p>
            </div>
          ) : isSuccess ? (
            <div className="space-y-6">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Email Verified!</h2>
                <p className="text-sm text-slate-600 mt-2">{message}</p>
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                  Your account status is now <strong>ACTIVE</strong>. You can now log in using your college email and password.
                </div>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl shadow-lg shadow-primary-600/30 transition-all flex items-center justify-center gap-2"
              >
                Proceed to Login <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <XCircle className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Verification Failed</h2>
                <p className="text-sm text-rose-600 mt-2">{message}</p>
              </div>
              <div className="pt-2 flex flex-col gap-3">
                <Link
                  to="/login"
                  className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-xl transition-all block"
                >
                  Return to Login
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 border-t border-slate-100 p-4 text-center text-xs text-slate-500">
          Official Institutional Portal &bull; @rajalakshmi.edu.in
        </div>
      </div>
    </div>
  );
};
