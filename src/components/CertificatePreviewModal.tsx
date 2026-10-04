import React, { useState } from 'react';
import { 
  FileText, Download, CheckCircle, XCircle, 
  ShieldCheck, AlertCircle, X, Award, ExternalLink 
} from 'lucide-react';
import { ODRequest, Faculty, CertificateItem } from '../types/types';
import { verifyCertificateByFaculty, getCurrentFaculty } from '../data/mockData';
import { useToast } from './Toast';

interface CertificatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  request?: ODRequest | null;
  certificate?: CertificateItem | null;
  faculty?: Faculty;
  onVerified?: () => void;
  onVerify?: (certId: string, status: 'Verified' | 'Rejected') => void;
}

export const CertificatePreviewModal: React.FC<CertificatePreviewModalProps> = ({
  isOpen,
  onClose,
  request,
  certificate,
  faculty,
  onVerified,
  onVerify,
}) => {
  const { showToast } = useToast();
  const [remarks, setRemarks] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (!isOpen) return null;

  const currentFaculty = faculty || getCurrentFaculty();

  const certId = certificate?.id || request?.id || 'cert';
  const eventName = certificate?.eventName || request?.eventName || 'Event Certificate';
  const certName = certificate?.certificateName || request?.documentUrl || 'Certificate_Document.pdf';
  const studentName = certificate?.studentName || request?.studentName || 'Student';
  const certStatus = certificate?.status || request?.certificateStatus || 'Pending Verification';

  const handleVerify = (status: 'Verified' | 'Rejected') => {
    if (onVerify && certificate) {
      onVerify(certificate.id, status);
      onClose();
      return;
    }

    if (certificate) {
      verifyCertificateByFaculty(certificate.id, status, currentFaculty, remarks);
    } else if (request) {
      verifyCertificateByFaculty(request.id, status, currentFaculty, remarks);
    }

    showToast(
      `Certificate ${status === 'Verified' ? 'verified successfully' : 'marked as rejected'}.`,
      status === 'Verified' ? 'success' : 'error'
    );
    if (onVerified) onVerified();
    onClose();
  };

  const handleDownload = () => {
    showToast(`Downloading certificate: ${certName}`, 'info');
  };

  const isVerified = certStatus === 'Verified';
  const isRejected = certStatus === 'Rejected';
  const isPending = certStatus === 'Pending Verification' || !certStatus;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200/80 animate-scale-up z-10 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl text-amber-400 backdrop-blur-sm">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">Event Certificate Verification</h3>
              <p className="text-xs text-slate-400">{eventName} &bull; {studentName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Certificate Metadata Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Document Filename</span>
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary-600" />
                <span>{certName}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                isVerified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                isRejected ? 'bg-rose-50 text-rose-700 border-rose-200' :
                'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {certStatus}
              </span>
              <button
                type="button"
                onClick={handleDownload}
                className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold transition-colors flex items-center gap-1"
                title="Download file"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Visual Certificate Paper Mock */}
          <div className="border-2 border-dashed border-slate-200 rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-amber-50/20 via-white to-slate-50 relative text-center space-y-4 shadow-inner">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary-50 border border-primary-200 text-xs font-bold text-primary-800">
              <ShieldCheck className="w-4 h-4 text-primary-600" />
              <span>Rajalakshmi Engineering College &bull; Verified Digital Document</span>
            </div>

            <div className="space-y-1">
              <h4 className="text-xl font-black text-slate-900 tracking-tight">CERTIFICATE OF PARTICIPATION</h4>
              <p className="text-xs text-slate-500 font-medium">This is to certify that</p>
              <p className="text-lg font-extrabold text-primary-700">{studentName}</p>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Has actively participated in <strong className="text-slate-900">{eventName}</strong>.
              </p>
            </div>

            {isVerified && (
              <div className="pt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700">
                <CheckCircle className="w-4 h-4" />
                <span>Verified by {currentFaculty.name} ({currentFaculty.role})</span>
              </div>
            )}
          </div>

          {/* Rejection input box if opened */}
          {showRejectInput && (
            <div className="space-y-2 animate-slide-in">
              <label className="block text-xs font-bold text-slate-600">Rejection Reason</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="State clearly why this certificate is rejected (e.g. illegible scan, wrong event name)..."
                rows={2}
                className="w-full bg-slate-50 border border-rose-300 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>

          {isPending && (
            <div className="flex items-center gap-2">
              {!showRejectInput ? (
                <button
                  type="button"
                  onClick={() => setShowRejectInput(true)}
                  className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors"
                >
                  Reject Certificate
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleVerify('Rejected')}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors"
                >
                  Confirm Rejection
                </button>
              )}

              <button
                type="button"
                onClick={() => handleVerify('Verified')}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-200 transition-all flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Verify & Approve Certificate</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
