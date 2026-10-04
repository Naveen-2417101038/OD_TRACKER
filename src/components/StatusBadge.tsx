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

  if (cleanStatus.includes('approved') || cleanStatus === 'verified') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (cleanStatus.includes('pending') || cleanStatus.includes('awaiting')) {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (cleanStatus.includes('rejected') || cleanStatus.includes('declined')) {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  } else {
    colorClasses = 'bg-slate-50 text-slate-500 border-slate-200';
  }

  const isApproved = cleanStatus.includes('approved') || cleanStatus === 'verified';
  const isPending = cleanStatus.includes('pending') || cleanStatus.includes('awaiting');
  const isRejected = cleanStatus.includes('rejected') || cleanStatus.includes('declined');

  return (
    <span className={`inline-flex items-center rounded-full border ${sizeClasses} ${colorClasses}`}>
      {isApproved && (
        <span className="w-1.5 h-1.5 mr-1.5 bg-emerald-500 rounded-full animate-pulse" />
      )}
      {isPending && (
        <span className="w-1.5 h-1.5 mr-1.5 bg-amber-500 rounded-full animate-pulse" />
      )}
      {isRejected && (
        <span className="w-1.5 h-1.5 mr-1.5 bg-rose-500 rounded-full" />
      )}
      {status}
    </span>
  );
};
