import React from 'react';
import { ODRequestStages } from '../types/types';
import { Check, Hourglass, X, CircleDot } from 'lucide-react';

interface TimelineProps {
  stages: ODRequestStages;
}

interface TimelineStep {
  key: keyof ODRequestStages;
  label: string;
  sublabel: string;
}

export const Timeline: React.FC<TimelineProps> = ({ stages }) => {
  const steps: TimelineStep[] = [
    { key: 'submitted', label: 'OD Submitted', sublabel: 'Student Portal' },
    { key: 'mentor', label: 'Mentor Review', sublabel: 'Recommendation' },
    { key: 'classIncharge', label: 'Class Incharge', sublabel: 'Endorsement' },
    { key: 'hod', label: 'HOD Sanction', sublabel: 'Final Approval' },
  ];

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'Approved':
        return <Check className="w-5 h-5 text-emerald-600" />;
      case 'Pending':
        return <Hourglass className="w-5 h-5 text-amber-500 animate-spin" style={{ animationDuration: '3s' }} />;
      case 'Rejected':
        return <X className="w-5 h-5 text-rose-600" />;
      case 'Unreached':
      default:
        return <CircleDot className="w-5 h-5 text-slate-300" />;
    }
  };

  const getStepColorClass = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'border-emerald-500 bg-emerald-50';
      case 'Pending':
        return 'border-amber-500 bg-amber-50';
      case 'Rejected':
        return 'border-rose-500 bg-rose-50';
      case 'Unreached':
      default:
        return 'border-slate-200 bg-white';
    }
  };

  const getLineColorClass = (fromStatus: string, toStatus: string) => {
    if (fromStatus === 'Approved' && toStatus !== 'Unreached') {
      if (toStatus === 'Approved') return 'bg-emerald-500';
      if (toStatus === 'Pending') return 'bg-amber-400';
      if (toStatus === 'Rejected') return 'bg-rose-400';
    }
    return 'bg-slate-200';
  };

  return (
    <div className="w-full py-6">
      {/* Desktop Horizontal Timeline */}
      <div className="hidden md:flex items-start justify-between relative w-full px-4">
        {steps.map((step, idx) => {
          const detail = stages[step.key] || { status: 'Unreached' };
          const isLast = idx === steps.length - 1;
          const nextStepKey = !isLast ? steps[idx + 1].key : null;
          const nextDetail = nextStepKey ? stages[nextStepKey] : null;
          
          const iconBorder = getStepColorClass(detail.status);
          const lineBg = nextDetail ? getLineColorClass(detail.status, nextDetail.status) : 'bg-slate-200';

          return (
            <div key={step.key} className="flex-1 flex flex-col items-center relative text-center">
              {/* Connector Line */}
              {!isLast && (
                <div 
                  className={`absolute top-5 left-1/2 right-[-50%] h-0.5 z-0 transition-colors duration-300 ${lineBg}`}
                />
              )}

              {/* Step Circle */}
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center z-10 transition-all duration-300 shadow-sm ${iconBorder}`}>
                {getStepIcon(detail.status)}
              </div>

              {/* Labels */}
              <div className="mt-3 px-2 z-10">
                <p className="font-bold text-slate-800 text-sm">{step.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{step.sublabel}</p>
                
                {detail.faculty_name && (
                  <p className="text-[11px] text-primary-700 font-bold mt-1 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100/60 inline-block">
                    {detail.faculty_name}
                  </p>
                )}

                {detail.date && (
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    {detail.date} <span className="text-slate-400">{detail.time}</span>
                  </p>
                )}
                
                {detail.feedback && (
                  <div className="mt-2 p-1.5 bg-slate-50 rounded border border-slate-100 text-[11px] text-slate-600 max-w-[160px] mx-auto italic">
                    "{detail.feedback}"
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Vertical Timeline */}
      <div className="flex flex-col md:hidden space-y-6 px-2">
        {steps.map((step, idx) => {
          const detail = stages[step.key] || { status: 'Unreached' };
          const isLast = idx === steps.length - 1;
          const nextStepKey = !isLast ? steps[idx + 1].key : null;
          const nextDetail = nextStepKey ? stages[nextStepKey] : null;

          const iconBorder = getStepColorClass(detail.status);
          const lineBg = nextDetail ? getLineColorClass(detail.status, nextDetail.status) : 'bg-slate-200';

          return (
            <div key={step.key} className="flex items-start relative">
              {/* Connector Line */}
              {!isLast && (
                <div 
                  className={`absolute top-10 bottom-[-24px] left-5 w-0.5 z-0 transition-colors duration-300 ${lineBg}`}
                />
              )}

              {/* Step Circle */}
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center z-10 transition-all duration-300 shadow-sm flex-shrink-0 ${iconBorder}`}>
                {getStepIcon(detail.status)}
              </div>

              {/* Labels */}
              <div className="ml-4 flex-1 pt-1 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-800 text-sm">{step.label}</p>
                  {detail.date && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      {detail.date} {detail.time}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{step.sublabel}</p>

                {detail.faculty_name && (
                  <p className="text-[11px] text-primary-700 font-bold mt-1.5 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100 inline-block">
                    By: {detail.faculty_name} {detail.faculty_role ? `(${detail.faculty_role})` : ''}
                  </p>
                )}

                {detail.feedback && (
                  <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-100 text-xs text-slate-600 italic">
                    "{detail.feedback}"
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
