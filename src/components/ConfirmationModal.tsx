import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';
import { ODRequest } from '../types/types';

interface ApproveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (remarks: string) => void;
  requestId?: string;
  eventName?: string;
  studentName?: string;
  role?: string;
  request?: ODRequest | null;
}

export const ApproveModal: React.FC<ApproveModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  requestId,
  eventName,
  studentName,
  role,
  request,
}) => {
  const [remarks, setRemarks] = useState('');

  if (!isOpen) return null;

  const displayReqId = requestId || request?.id || 'OD Request';
  const displayEventName = eventName || request?.eventName || 'Event';
  const displayStudentName = studentName || request?.studentName || 'Student';
  const displayRole = role || 'Reviewer';

  const handleConfirm = () => {
    onConfirm(remarks);
    setRemarks('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100 animate-scale-up z-10 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Approve OD Request</h3>
              <p className="text-xs font-semibold text-slate-400">{displayReqId} &bull; {displayEventName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 text-xs space-y-2">
          <p className="text-slate-700 font-medium leading-relaxed">
            Are you sure you want to approve this OD request for <strong className="text-slate-900 font-bold">{displayStudentName}</strong>?
          </p>
          <p className="text-[11px] text-slate-500">
            Acting as <span className="font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100">{displayRole}</span>. This will record your approval and forward the request to the next stage in the academic pipeline.
          </p>
        </div>

        {/* Remarks / Comments Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Approval Remarks / Comments (Optional)
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g., Verified registration documents. Recommended for OD concession."
            rows={3}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-200 transition-all flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm Approval</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface RejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  requestId?: string;
  eventName?: string;
  studentName?: string;
  role?: string;
  request?: ODRequest | null;
}

export const RejectModal: React.FC<RejectModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  requestId,
  eventName,
  studentName,
  role,
  request,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const displayReqId = requestId || request?.id || 'OD Request';
  const displayEventName = eventName || request?.eventName || 'Event';
  const displayStudentName = studentName || request?.studentName || 'Student';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Reason for rejection is required.');
      return;
    }
    onConfirm(reason.trim());
    setReason('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100 animate-scale-up z-10 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-50 rounded-2xl text-rose-600 border border-rose-100">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Reject OD Request</h3>
              <p className="text-xs font-semibold text-slate-400">{displayReqId} &bull; {displayEventName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-4 text-xs space-y-1.5">
            <p className="text-rose-800 font-medium">
              You are declining the OD application submitted by <strong className="font-bold text-rose-950">{displayStudentName}</strong>.
            </p>
            <p className="text-[11px] text-rose-600">
              A clear reason is required. This feedback will be sent directly to the student portal and saved in the academic history log.
            </p>
          </div>

          {/* Rejection Reason Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              Reason for Rejection (Mandatory)
            </label>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(''); }}
              placeholder="e.g., Supporting certificate/invitation missing. Please resubmit."
              rows={3}
              className={`w-full bg-slate-50 border rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 resize-none ${
                error ? 'border-rose-400 focus:ring-rose-500/20' : 'border-slate-200 focus:ring-rose-500/20 focus:border-rose-500'
              }`}
            />
            {error && (
              <p className="text-rose-500 text-[10px] font-bold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>{error}</span>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-200 transition-all flex items-center gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              <span>Confirm Rejection</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
