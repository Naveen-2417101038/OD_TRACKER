import React, { useState } from 'react';
import { 
  FileText, Download, CheckCircle, XCircle, 
  ShieldCheck, AlertCircle, X, Award, ExternalLink, Image as ImageIcon,
  Clock, ShieldAlert
} from 'lucide-react';
import { ODRequest, Faculty, CertificateItem } from '../types/types';
import { verifyCertificateByFaculty, getCurrentFaculty } from '../data/mockData';
import { useToast } from './Toast';

export interface CertificatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  request?: ODRequest | null;
  certificate?: CertificateItem | null;
  faculty?: Faculty;
  onVerified?: () => void;
  onVerify?: (certId: string, status: 'Verified' | 'Rejected', remarks?: string) => Promise<void> | void;
  readOnly?: boolean;
}

export const CertificatePreviewModal: React.FC<CertificatePreviewModalProps> = ({
  isOpen,
  onClose,
  request,
  certificate,
  faculty,
  onVerified,
  onVerify,
  readOnly = false,
}) => {
  const { showToast } = useToast();
  const [remarks, setRemarks] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentFaculty = faculty || getCurrentFaculty();

  const certId = certificate?.id || request?.id || 'cert';
  const reqId = certificate?.requestId || request?.id || '';
  const eventName = certificate?.eventName || request?.eventName || 'Event Certificate';
  const certName = certificate?.certificateName || (request?.certificateUrl ? request.certificateUrl.split('/').pop() : '') || request?.documentUrl || 'Certificate_Document.pdf';
  const studentName = certificate?.studentName || request?.studentName || 'Student';
  const studentReg = certificate?.studentRegNo || request?.studentRegisterNo || request?.studentId || '';
  const certStatus = certificate?.status || request?.certificateStatus || 'Pending Verification';

  // Resolve actual uploaded file URL
  const resolveFileUrl = (): string => {
    const raw = certificate?.fileUrl || (certificate as any)?.certificateUrl || (certificate as any)?.certificate_file_url || request?.certificateUrl || (request as any)?.certificate_file_url || '';
    if (raw && (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('blob:') || raw.startsWith('/api/'))) {
      return raw;
    }
    if (certName && certName !== 'Certificate_Document.pdf' && !certName.startsWith('blob:')) {
      return `/api/od-requests/uploads/certificates/${certName}`;
    }
    return raw || '/api/od-requests/uploads/certificates/cert_20260925211826_10f32430.pdf';
  };

  const fileUrl = resolveFileUrl();
  const isImage = (url: string, name: string): boolean => {
    const test = `${url} ${name}`.toLowerCase();
    return test.includes('.png') || test.includes('.jpg') || test.includes('.jpeg') || test.includes('.webp') || test.includes('.gif') || test.startsWith('data:image');
  };

  const imageDoc = isImage(fileUrl, certName);

  const handleOpenNewTab = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  const handleDownload = () => {
    if (!fileUrl) return;
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = certName || 'certificate.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Downloading certificate: ${certName}`, 'info');
  };

  const handleVerifyAction = async (status: 'Verified' | 'Rejected') => {
    if (status === 'Rejected' && !remarks.trim()) {
      showToast('Please state a rejection reason before confirming.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (onVerify) {
        await onVerify(reqId || certId, status, remarks);
      } else {
        if (certificate) {
          verifyCertificateByFaculty(certificate.id, status, currentFaculty, remarks);
        } else if (request) {
          verifyCertificateByFaculty(request.id, status, currentFaculty, remarks);
        }
      }

      showToast(
        status === 'Verified' 
          ? `Certificate verified successfully! OD request marked as Sanctioned.` 
          : `Certificate marked as rejected. OD request has been rejected.`,
        status === 'Verified' ? 'success' : 'error'
      );
      if (onVerified) onVerified();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Error processing certificate verification.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isVerified = certStatus === 'Verified';
  const isRejected = certStatus === 'Rejected';
  const isPending = certStatus === 'Pending Verification' || !certStatus;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-[96vw] max-w-6xl h-[92vh] max-h-[92vh] border border-slate-200/90 animate-scale-up z-10 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-teal-500/20 border border-teal-400/30 rounded-2xl text-teal-300 backdrop-blur-sm shrink-0">
              <Award className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-extrabold tracking-tight truncate">Certificate Inspection</h3>
                {reqId && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/10 text-slate-300 font-bold">
                    {reqId}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 truncate">
                {studentName} {studentReg ? `(${studentReg})` : ''} &bull; <strong className="text-white">{eventName}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenNewTab}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Open file in new browser window"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Download file"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-3 sm:p-4 flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden bg-slate-50/50">
          
          {/* Certificate Metadata Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-xs shrink-0">
            <div className="space-y-0.5">
              <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Uploaded Document</span>
              <p className="font-bold text-slate-800 flex items-center gap-1.5 truncate">
                {imageDoc ? <ImageIcon className="w-4 h-4 text-teal-600 shrink-0" /> : <FileText className="w-4 h-4 text-primary-600 shrink-0" />}
                <span className="truncate">{certName}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                isVerified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                isRejected ? 'bg-rose-50 text-rose-700 border-rose-200' :
                'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {isVerified ? 'Verified • OD Sanctioned' :
                 isRejected ? 'Verification Rejected' :
                 'Pending Class Incharge Verification'}
              </span>
            </div>
          </div>

          {/* Actual Document Viewer (PDF iframe or Image) - Covers entire allocated space */}
          <div className="relative flex-1 min-h-0 w-full bg-slate-200/70 rounded-2xl border border-slate-300 shadow-inner overflow-hidden">
            {imageDoc ? (
              <div className="absolute inset-0 w-full h-full flex items-center justify-center p-3 bg-slate-900/5 overflow-auto">
                <img 
                  src={fileUrl} 
                  alt={certName} 
                  className="max-h-full max-w-full object-contain rounded-xl shadow-md border border-slate-200"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1579389083078-4e7018379f7e?auto=format&fit=crop&w=800&q=80';
                  }}
                />
              </div>
            ) : (
              <iframe
                src={`${fileUrl}#view=FitH&toolbar=1`}
                title={certName}
                className="absolute inset-0 w-full h-full border-0 block"
                style={{ width: '100%', height: '100%', minHeight: '100%', border: 'none', display: 'block' }}
              />
            )}
          </div>

          {/* Quick Toolbar helper */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1 shrink-0">
            <span className="text-[11px] font-semibold text-slate-400">
              Document source: <strong className="text-slate-600 font-mono text-[10px]">{fileUrl}</strong>
            </span>
            <button
              type="button"
              onClick={handleOpenNewTab}
              className="text-teal-700 hover:text-teal-900 font-bold hover:underline flex items-center gap-1 text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Full Screen / New Tab</span>
            </button>
          </div>

          {/* Verification Status Feedback / Rejection Info */}
          {isVerified && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2.5 shrink-0">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <strong>Officially Verified:</strong> Participation certificate confirmed valid. OD has been formally sanctioned with compensatory attendance granted.
              </div>
            </div>
          )}

          {isRejected && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2.5 shrink-0">
              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <div>
                <strong>Certificate Rejected:</strong> OD request has been rejected. 
                {request?.rejectionReason && <span className="block mt-0.5 text-rose-900 font-semibold">Reason: "{request.rejectionReason}"</span>}
              </div>
            </div>
          )}

          {/* Rejection Remarks input box when faculty clicks Reject */}
          {showRejectInput && !readOnly && isPending && (
            <div className="space-y-1.5 p-3 bg-rose-50/70 border border-rose-200 rounded-2xl animate-slide-in shrink-0">
              <label className="block text-xs font-bold text-rose-900 uppercase tracking-wider">
                Reason for Rejecting Certificate & OD *
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="State clearly why this certificate is rejected (e.g., student name mismatch, wrong event certificate, unreadable scan, fake certificate)..."
                rows={2}
                className="w-full bg-white border border-rose-300 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>

          {/* Role-based verification controls (Visible only to Class Incharge / Faculty and NOT in student portal) */}
          {!readOnly && isPending && (
            <div className="flex items-center gap-2 flex-wrap">
              {!showRejectInput ? (
                <button
                  type="button"
                  onClick={() => setShowRejectInput(true)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject OD</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(false)}
                    className="px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerifyAction('Rejected')}
                    disabled={isSubmitting}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-rose-200"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Confirm Rejection</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleVerifyAction('Verified')}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-200 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                <span>Verify Certificate & Sanction OD</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
