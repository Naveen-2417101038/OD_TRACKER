import React, { useState, useEffect } from 'react';
import { 
  ODRequest, Faculty 
} from '../types/types';
import { 
  approveODRequestByFaculty, rejectODRequestByFaculty, getAuthSession 
} from '../data/mockData';
import { 
  apiApproveODRequestByMentor, apiRejectODRequestByMentor,
  apiApproveODRequestByClassIncharge, apiRejectODRequestByClassIncharge,
  apiGetStudentAcademic
} from '../services/api';
import { Timeline } from './Timeline';
import { StatusBadge } from './StatusBadge';
import { ApproveModal, RejectModal } from './ConfirmationModal';
import { CertificatePreviewModal } from './CertificatePreviewModal';
import { useToast } from './Toast';
import { 
  User, Calendar, Clock, MapPin, Building, 
  FileText, Shield, CheckCircle2, XCircle, X, 
  Eye, Mail, Phone, GraduationCap, ExternalLink, Download
} from 'lucide-react';

interface ODDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ODRequest;
  faculty?: Faculty;
  onActionComplete?: () => void;
  onApproveClick?: () => void;
  onRejectClick?: () => void;
}

export const ODDetailModal: React.FC<ODDetailModalProps> = ({
  isOpen,
  onClose,
  request,
  faculty,
  onActionComplete,
}) => {
  const { showToast } = useToast();

  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [academic, setAcademic] = useState<{
    attendance_percentage?: number;
    cat1_marks?: number | null;
    cat2_marks?: number | null;
    cat3_marks?: number | null;
    eligibility?: any;
    updated_at?: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !request) return;
    const session = getAuthSession();
    const studentIdentifier = request.studentRegisterNo || request.studentId || '';
    if (studentIdentifier) {
      apiGetStudentAcademic(studentIdentifier, session?.token).then((res) => {
        if (res.success && res.academic) {
          setAcademic(res.academic);
        }
      });
    }
  }, [isOpen, request]);

  if (!isOpen) return null;

  const handleApproveConfirm = async (remarks: string) => {
    if (!faculty) {
      showToast('Faculty session required to approve request.', 'error');
      return;
    }
    const session = getAuthSession();

    if (faculty.role === 'Mentor') {
      const res = await apiApproveODRequestByMentor(request.id, remarks, session?.token);
      if (res.success) {
        showToast(res.message || `OD Request ${request.id} approved successfully!`, 'success');
        approveODRequestByFaculty(request.id, faculty, remarks);
      } else {
        showToast(res.error || `Failed to approve OD request ${request.id}.`, 'error');
      }
    } else if (faculty.role === 'Class Incharge') {
      const res = await apiApproveODRequestByClassIncharge(request.id, remarks, session?.token);
      if (res.success) {
        showToast(res.message || `OD Request ${request.id} endorsed and forwarded to HOD!`, 'success');
        approveODRequestByFaculty(request.id, faculty, remarks);
      } else {
        showToast(res.error || `Failed to approve OD request ${request.id}.`, 'error');
      }
    } else {
      approveODRequestByFaculty(request.id, faculty, remarks);
      showToast(`OD Request ${request.id} approved successfully!`, 'success');
    }

    if (onActionComplete) onActionComplete();
    onClose();
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!faculty) {
      showToast('Faculty session required to reject request.', 'error');
      return;
    }
    if (!reason || !reason.trim()) {
      showToast('Rejection reason / remark is mandatory.', 'error');
      return;
    }
    const session = getAuthSession();

    if (faculty.role === 'Mentor') {
      const res = await apiRejectODRequestByMentor(request.id, reason, session?.token);
      if (res.success) {
        showToast(res.message || `OD Request ${request.id} rejected. Reason logged.`, 'error');
        rejectODRequestByFaculty(request.id, faculty, reason);
      } else {
        showToast(res.error || `Failed to reject OD request ${request.id}.`, 'error');
      }
    } else if (faculty.role === 'Class Incharge') {
      const res = await apiRejectODRequestByClassIncharge(request.id, reason, session?.token);
      if (res.success) {
        showToast(res.message || `OD Request ${request.id} rejected. Reason logged.`, 'error');
        rejectODRequestByFaculty(request.id, faculty, reason);
      } else {
        showToast(res.error || `Failed to reject OD request ${request.id}.`, 'error');
      }
    } else {
      rejectODRequestByFaculty(request.id, faculty, reason);
      showToast(`OD Request ${request.id} rejected. Reason logged.`, 'error');
    }

    if (onActionComplete) onActionComplete();
    onClose();
  };

  // Determine if this faculty can approve/reject this request right now
  const canAct = (() => {
    if (!faculty) return false;
    const currentStage = (request as any).currentStage || request.approvalStage;
    if (faculty.role === 'Mentor' && request.status === 'Pending' && currentStage === 'Mentor') return true;
    if (faculty.role === 'Class Incharge' && (request.status === 'Mentor Approved' || (request.status === 'Pending' && currentStage === 'Class Incharge')) && currentStage === 'Class Incharge') return true;
    if (faculty.role === 'HOD' && currentStage === 'HOD') return true;
    return false;
  })();

  const isVerified = request.certificateStatus === 'Verified';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />

        {/* Modal Window */}
        <div className="relative bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-slate-200/90 animate-scale-up z-10 overflow-hidden flex flex-col max-h-[92vh]">
          
          {/* Header */}
          <div className="p-5 md:p-6 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-primary-600/30 border border-primary-500/30 rounded-2xl text-primary-400">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-black text-primary-400 uppercase tracking-widest">{request.id}</span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-full border border-slate-700">
                    {request.eventType}
                  </span>
                  <StatusBadge status={request.status} size="sm" />
                </div>
                <h2 className="text-lg md:text-xl font-black text-white tracking-tight mt-0.5">{request.eventName}</h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
            
            {/* Section 1: Student Information Card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <User className="w-4 h-4 text-primary-600" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">Student Profile Information</h4>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Student Name</span>
                  <p className="font-bold text-slate-800 mt-0.5">{request.studentName || 'Naveen'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Register Number</span>
                  <p className="font-bold text-primary-600 mt-0.5">{request.studentRegisterNo || '23CSD001'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Department</span>
                  <p className="font-semibold text-slate-700 mt-0.5">{request.studentDepartment || 'Computer Science and Design'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Class / Section</span>
                  <p className="font-semibold text-slate-700 mt-0.5">{request.studentYear || 'III Year'} - Sec {request.studentSection || 'A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-100">
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{request.studentEmail || 'naveen.23csd@rajalakshmi.edu.in'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{request.studentPhone || '+91 98765 43210'}</span>
                </div>
              </div>

              {/* Student Academic Standing Strip */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Academic Standing & OD Allowance
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Source: Class Incharge Academic Record</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                  <div className="bg-white p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Attendance</span>
                    <span className="text-sm font-black text-primary-700">
                      {academic ? `${academic.attendance_percentage}%` : '91%'}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">CAT 1</span>
                    <span className="text-sm font-black text-slate-800">
                      {academic?.cat1_marks ?? 78}/100
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">CAT 2</span>
                    <span className="text-sm font-black text-slate-800">
                      {academic?.cat2_marks ?? 82}/100
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">CAT 3</span>
                    <span className="text-sm font-black text-slate-800">
                      {academic?.cat3_marks ?? 75}/100
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-1 bg-purple-50 p-2 rounded-lg border border-purple-100">
                    <span className="text-[9px] text-purple-600 font-bold uppercase block">10% OD Cap</span>
                    <span className="text-xs font-black text-purple-700">
                      {academic?.eligibility?.remaining_od_days !== undefined
                        ? `${academic.eligibility.remaining_od_days}d left`
                        : '9d left'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Event Details */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Calendar className="w-4 h-4 text-primary-600" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">Event & OD Purpose Details</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="flex items-start gap-2.5">
                  <Building className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Organizing Body</span>
                    <p className="font-bold text-slate-800">{request.eventOrganizer}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Venue</span>
                    <p className="font-bold text-slate-800">{request.venue}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Date & Timing</span>
                    <p className="font-bold text-slate-800">{request.eventDate}</p>
                    <p className="text-[11px] text-slate-500 font-medium">{request.fromTime} - {request.toTime}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Purpose / Objective</span>
                  <p className="text-xs text-slate-700 mt-0.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 font-medium">
                    {request.reason}
                  </p>
                </div>
                {request.description && (
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Detailed Scope</span>
                    <p className="text-xs text-slate-600 mt-0.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 leading-relaxed">
                      {request.description}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Document Verification Card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary-600" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">Registration Proof / Certificate</h4>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isVerified ? 'bg-emerald-100 text-emerald-800' :
                  request.certificateStatus === 'Pending Verification' ? 'bg-amber-100 text-amber-800' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {request.certificateStatus || 'Pending Verification'}
                </span>
              </div>

              {request.documentUrl ? (
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{request.documentUrl}</p>
                      <span className="text-[10px] text-slate-400">PDF Document Proof Attached</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const url = request.documentUrl || (request as any).odLetterUrl;
                        if (url && url.startsWith('/api/')) {
                          window.open(url, '_blank');
                        } else {
                          const endpoint = faculty?.role === 'Class Incharge'
                            ? `/api/class-incharge/od-requests/${request.id}/letter`
                            : `/api/mentor/od-requests/${request.id}/letter`;
                          window.open(endpoint, '_blank');
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-100 shadow-xs transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Inspect Letter</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCertModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition-all"
                    >
                      <Eye className="w-3.5 h-3.5 text-primary-600" />
                      <span>Preview</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No certificate or registration document was attached for this request.
                </div>
              )}
            </div>

            {/* Section 4: Approval Progress Timeline */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Shield className="w-4 h-4 text-primary-600" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">Official Multi-Stage Approval Timeline</h4>
              </div>

              <Timeline stages={request.stages} />

              {/* Rejection notice */}
              {request.status === 'Rejected' && (
                <div className="mt-4 p-4 border border-rose-200 bg-rose-50 rounded-2xl flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-xs text-rose-800 uppercase tracking-wider">Rejection Reason</h5>
                    <p className="text-xs text-rose-700 font-medium mt-1 leading-normal">
                      {request.rejectionReason || request.stages.mentor?.feedback || 'Application declined by faculty.'}
                    </p>
                    {request.rejectedByFacultyName && (
                      <span className="text-[10px] text-rose-500 font-semibold block mt-1">
                        Rejected by {request.rejectedByFacultyName} on {request.rejectedAt}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Footer with Actions */}
          <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between flex-wrap gap-3">
            <div className="text-xs text-slate-500 font-medium">
              {canAct ? (
                <span className="text-amber-600 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  Awaiting your action as {faculty?.role}
                </span>
              ) : (
                <span>Current Stage: <strong className="text-slate-700">{request.approvalStage}</strong></span>
              )}
            </div>

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors"
              >
                Close
              </button>

              {canAct && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsRejectOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition-all"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsApproveOpen(true)}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-200 transition-all hover:scale-[1.02]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Request</span>
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Confirmation Modals */}
      <ApproveModal
        isOpen={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        onConfirm={handleApproveConfirm}
        requestId={request.id}
        eventName={request.eventName}
        studentName={request.studentName}
        role={faculty?.role || 'Faculty'}
      />

      <RejectModal
        isOpen={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        onConfirm={handleRejectConfirm}
        requestId={request.id}
        eventName={request.eventName}
        studentName={request.studentName}
        role={faculty?.role || 'Faculty'}
      />

      <CertificatePreviewModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        request={request}
        faculty={faculty}
        onVerified={() => {
          if (onActionComplete) onActionComplete();
        }}
      />
    </>
  );
};
