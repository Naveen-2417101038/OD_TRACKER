import React from 'react';
import { ApprovalStatus } from '../types/types';

interface StatusBadgeProps {
  status: ApprovalStatus | 'Pending' | 'Approved' | 'Rejected' | 'Pending Verification' | 'Verified' | 'Mentor Approved' | 'Mentor Rejected' | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs font-semibold' : 'px-2.5 py-1 text-sm font-bold';
  
  let colorClasses = '';
  const cleanStatus = (status || '').toLowerCase();

  const isExpired = cleanStatus.includes('expired') || cleanStatus.includes('rejected') || cleanStatus.includes('declined');
  const isCompleted = cleanStatus === 'completed' || cleanStatus === 'verified' || cleanStatus === 'approved';
  const isSubmitted = cleanStatus.includes('submitted');
  const isCertPending = cleanStatus.includes('certificate pending') || cleanStatus.includes('upload required');
  const isPending = !isExpired && !isCompleted && !isSubmitted && !isCertPending && (cleanStatus.includes('pending') || cleanStatus.includes('awaiting'));
  const isApproved = !isExpired && !isCompleted && !isCertPending && cleanStatus.includes('approved');

  if (isExpired) {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (isCompleted) {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (isSubmitted) {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (isCertPending) {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-300';
  } else if (isApproved) {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (isPending) {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else {
    colorClasses = 'bg-slate-50 text-slate-500 border-slate-200';
  }

  return (
    <span className={`inline-flex items-center rounded-full border ${sizeClasses} ${colorClasses}`}>
      {isCompleted && (
        <span className="w-1.5 h-1.5 mr-1.5 bg-emerald-500 rounded-full" />
      )}
      {isApproved && (
        <span className="w-1.5 h-1.5 mr-1.5 bg-emerald-500 rounded-full animate-pulse" />
      )}
      {(isPending || isCertPending) && (
        <span className="w-1.5 h-1.5 mr-1.5 bg-amber-500 rounded-full animate-pulse" />
      )}
      {isSubmitted && (
        <span className="w-1.5 h-1.5 mr-1.5 bg-blue-500 rounded-full animate-pulse" />
      )}
      {isExpired && (
        <span className="w-1.5 h-1.5 mr-1.5 bg-rose-500 rounded-full" />
      )}
      {status}
    </span>
  );
};
