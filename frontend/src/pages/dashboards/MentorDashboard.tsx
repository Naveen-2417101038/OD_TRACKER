import React, { useState, useEffect } from 'react';
import { 
  UserCheck, Hourglass, CheckCircle2, XCircle, 
  Eye, Check, X, FileText, Award, Calendar, 
  Users, MessageSquare, AlertCircle, Sparkles,
  Search, Filter, ExternalLink, Download, GraduationCap
} from 'lucide-react';
import { 
  getFacultyODRequests, approveODRequestByFaculty, 
  rejectODRequestByFaculty, getCurrentFaculty, 
  getCertificates, verifyCertificateByFaculty,
  getAuthSession, updateODRequest
} from '../../data/mockData';
import { 
  apiGetMentorODRequests, 
  apiApproveODRequestByMentor, 
  apiRejectODRequestByMentor,
  apiGetAcademicStudents,
  AcademicStudentItem
} from '../../services/api';
import { ODRequest, CertificateItem, Faculty } from '../../types/types';
import { PortalLayout } from '../../layouts/PortalLayout';
import { StatusBadge } from '../../components/StatusBadge';
import { ODDetailModal } from '../../components/ODDetailModal';
import { ApproveModal, RejectModal } from '../../components/ConfirmationModal';
import { CertificatePreviewModal } from '../../components/CertificatePreviewModal';
import { useToast } from '../../components/Toast';

export const MentorDashboard: React.FC = () => {
  const { showToast } = useToast();
  const [faculty, setFaculty] = useState<Faculty>(getCurrentFaculty());
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'certificates' | 'academic'>('pending');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    all: ODRequest[];
    pending: ODRequest[];
    approved: ODRequest[];
    rejected: ODRequest[];
  }>({ all: [], pending: [], approved: [], rejected: [] });

  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [academicStudents, setAcademicStudents] = useState<AcademicStudentItem[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ODRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Approval Modals
  const [actionReq, setActionReq] = useState<ODRequest | null>(null);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  // Certificate Preview Modal
  const [previewCert, setPreviewCert] = useState<CertificateItem | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  // Selected Student Academic Details Modal
  const [selectedStudentAcademic, setSelectedStudentAcademic] = useState<AcademicStudentItem | null>(null);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    const curr = getCurrentFaculty();
    setFaculty(curr);
    const session = getAuthSession();
    
    // First set local state
    const localReqs = getFacultyODRequests(curr);
    setData(localReqs);
    setCertificates(getCertificates());

    // Sync from Flask Backend API
    try {
      const backendRes = await apiGetMentorODRequests(session?.token);
      if (backendRes.success && Array.isArray(backendRes.requests)) {
        setData({
          all: backendRes.requests,
          pending: backendRes.pending || backendRes.requests.filter(r => r.status === 'Pending'),
          approved: backendRes.approved || backendRes.requests.filter(r => 'Approved' in r.status),
          rejected: backendRes.rejected || backendRes.requests.filter(r => 'Rejected' in r.status),
        });
      }
    } catch (err) {
      console.warn('Could not sync mentor requests from backend:', err);
    }

    // Sync academic records
    try {
      const acadRes = await apiGetAcademicStudents(session?.token);
      if (acadRes.success && acadRes.students) {
        setAcademicStudents(acadRes.students);
      }
    } catch (err) {
      console.warn('Could not sync academic records:', err);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('odFacultyStateUpdated', handleUpdate);
    window.addEventListener('odStateUpdated', handleUpdate);
    return () => {
      window.removeEventListener('odFacultyStateUpdated', handleUpdate);
      window.removeEventListener('odStateUpdated', handleUpdate);
    };
  }, []);

  const handleApproveConfirm = async (remarks: string) => {
    if (!actionReq) return;
    const session = getAuthSession();
    
    // Submit to Flask Backend API
    const res = await apiApproveODRequestByMentor(actionReq.id, remarks, session?.token);
    if (res.success) {
      showToast(res.message || `OD request ${actionReq.id} approved and forwarded to Class Incharge!`, 'success');
      // Also update mock state fallback
      approveODRequestByFaculty(actionReq.id, faculty, remarks);
    } else {
      showToast(res.error || `Failed to approve OD request ${actionReq.id}.`, 'error');
    }

    setIsApproveOpen(false);
    setActionReq(null);
    loadData();
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!actionReq) return;
    if (!reason || !reason.trim()) {
      showToast('Rejection reason / remark is mandatory.', 'error');
      return;
    }
    const session = getAuthSession();

    // Submit to Flask Backend API
    const res = await apiRejectODRequestByMentor(actionReq.id, reason, session?.token);
    if (res.success) {
      showToast(res.message || `OD request ${actionReq.id} rejected. Reason logged.`, 'error');
      // Also update mock state fallback
      rejectODRequestByFaculty(actionReq.id, faculty, reason);
    } else {
      showToast(res.error || `Failed to reject OD request ${actionReq.id}.`, 'error');
    }

    setIsRejectOpen(false);
    setActionReq(null);
    loadData();
  };

  const handleViewODLetter = (req: ODRequest) => {
    const letterUrl = req.documentUrl || req.odLetterUrl;
    if (letterUrl && letterUrl.startsWith('/api/')) {
      window.open(letterUrl, '_blank');
    } else {
      // Open backend letter endpoint
      window.open(`/api/mentor/od-requests/${req.id}/letter`, '_blank');
    }
  };

  const handleVerifyCert = (cert: CertificateItem, status: 'Verified' | 'Rejected') => {
    verifyCertificateByFaculty(cert.id, faculty, status);
    showToast(`Certificate ${cert.id} marked as ${status}`, status === 'Verified' ? 'success' : 'error');
    loadData();
  };

  const filteredPending = data.pending.filter(r => 
    r.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredHistory = data.all.filter(r => 
    r.approvalStage !== 'Mentor' &&
    (r.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
     r.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     r.id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <PortalLayout role="Mentor">
      
      {/* 1. Header Overview Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-bold">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Assigned Mentorship Ward: III Year CSD &bull; Section A</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Mentor Review Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-2xl">
              Evaluate your assigned mentees' OD applications, verify event brochure documents, and recommend valid requests for Class Incharge endorsement.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center min-w-[120px]">
              <span className="text-2xl sm:text-3xl font-black text-amber-400 block">{data.pending.length}</span>
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Awaiting Review</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center min-w-[120px]">
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 block">{data.approved.length}</span>
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Total Endorsed</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'pending'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Hourglass className="w-4 h-4" />
            <span>Pending Mentee ODs</span>
            {data.pending.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'pending' ? 'bg-white text-indigo-600' : 'bg-amber-500 text-white animate-pulse'
              }`}>
                {data.pending.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Reviewed OD Archive</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('certificates')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'certificates'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Participation Certificates</span>
            {certificates.filter(c => c.status === 'Pending Verification').length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                {certificates.filter(c => c.status === 'Pending Verification').length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('academic')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'academic'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Student Academic Details</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by event or student name..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 outline-hidden transition-all shadow-xs"
          />
        </div>

      </div>

      {/* 3. Tab Content 1: Pending Mentee Requests */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {filteredPending.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">All Mentee ODs Reviewed</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                There are no pending On-Duty applications from your assigned mentees awaiting mentor verification right now.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredPending.map((req) => (
                <div 
                  key={req.id}
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-md hover:border-indigo-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                >
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                        {req.id}
                      </span>
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {req.eventType}
                      </span>
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                        <Hourglass className="w-3.5 h-3.5 animate-spin" />
                        Awaiting Mentor Approval
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                        {req.eventName}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Applied by <strong className="text-slate-800 font-bold">{req.studentName}</strong> ({req.studentRegisterNo}) &bull; {req.studentYear} - Sec {req.studentSection}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 pt-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Date: <strong className="text-slate-800">{req.eventDate}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>Organizer: <strong className="text-slate-800">{req.eventOrganizer}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>Proof: <strong className="text-slate-800">{req.documentUrl || 'Letter Attached'}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center gap-2 self-end lg:self-center shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 w-full lg:w-auto justify-end flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRequest(req);
                        setIsDetailOpen(true);
                      }}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                      title="View complete request and student details"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>View Details</span>
                    </button>

                    {(req.documentUrl || req.odLetterUrl) && (
                      <button
                        type="button"
                        onClick={() => handleViewODLetter(req)}
                        className="px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                        title="Inspect uploaded OD letter document"
                      >
                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                        <span>View OD Letter</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setActionReq(req);
                        setIsRejectOpen(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActionReq(req);
                        setIsApproveOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all flex items-center gap-1.5 hover:scale-[1.02]"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approve</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Tab Content 2: Reviewed OD Archive */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Mentee Historical OD Archive</h3>
            <p className="text-xs text-slate-500">Record of previously reviewed applications across your mentorship ward.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-4">OD Request ID</th>
                  <th className="p-4">Student</th>
                  <th className="p-4">Event & Type</th>
                  <th className="p-4">Event Date</th>
                  <th className="p-4">Workflow Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredHistory.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-bold text-indigo-600">{req.id}</td>
                    <td className="p-4 font-bold text-slate-800">{req.studentName} <span className="text-slate-400 font-normal">({req.studentRegisterNo})</span></td>
                    <td className="p-4">
                      <p className="font-bold text-slate-800">{req.eventName}</p>
                      <span className="text-[10px] text-slate-400">{req.eventType}</span>
                    </td>
                    <td className="p-4 text-slate-600">{req.eventDate}</td>
                    <td className="p-4">
                      <StatusBadge status={req.status} size="sm" />
                    </td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRequest(req);
                          setIsDetailOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs"
                      >
                        View Record
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Tab Content 3: Certificates */}
      {activeTab === 'certificates' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {certificates.map((cert) => (
              <div key={cert.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {cert.requestId}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      cert.status === 'Verified' ? 'bg-emerald-100 text-emerald-800' :
                      cert.status === 'Pending Verification' ? 'bg-amber-100 text-amber-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {cert.status}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{cert.eventName}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Student: <strong>{cert.studentName}</strong> ({cert.studentRegNo})</p>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{cert.certificateName}</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2 justify-end border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewCert(cert);
                      setIsCertModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold"
                  >
                    Inspect File
                  </button>

                  {cert.status === 'Pending Verification' && (
                    <button
                      type="button"
                      onClick={() => handleVerifyCert(cert, 'Verified')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                    >
                      Verify
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Tab Content 4: Student Academic Details */}
      {activeTab === 'academic' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-base text-slate-900">Mentees Academic Standing & Attendance</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Live academic records and attendance percentages uploaded by Class Incharge
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
              {academicStudents.length} Students Enrolled
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <th className="py-3 px-3">Reg Number</th>
                  <th className="py-3 px-3">Student Name</th>
                  <th className="py-3 px-3">Class / Sec</th>
                  <th className="py-3 px-3 text-center">CAT 1</th>
                  <th className="py-3 px-3 text-center">CAT 2</th>
                  <th className="py-3 px-3 text-center">CAT 3</th>
                  <th className="py-3 px-3 text-center">Attendance %</th>
                  <th className="py-3 px-3 text-center">10% Academic OD Cap</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {academicStudents.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
                      Academic data not available yet.
                    </td>
                  </tr>
                ) : (
                  academicStudents
                    .filter((s) => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase();
                      return (
                        s.registerNumber.toLowerCase().includes(q) ||
                        (s.studentName || s.name || '').toLowerCase().includes(q)
                      );
                    })
                    .map((s) => (
                      <tr key={s.studentId || s.id || s.registerNumber} className="hover:bg-indigo-50/20 transition-colors">
                        <td className="py-3.5 px-3 font-bold text-indigo-700">{s.registerNumber}</td>
                        <td className="py-3.5 px-3 font-semibold text-slate-900">{s.studentName}</td>
                        <td className="py-3.5 px-3 text-slate-500">{s.year} - {s.section}</td>
                        <td className="py-3.5 px-3 text-center font-bold">{s.cat1Marks != null ? s.cat1Marks : ((s as any).cat1_marks != null ? (s as any).cat1_marks : '—')}</td>
                        <td className="py-3.5 px-3 text-center font-bold">{s.cat2Marks != null ? s.cat2Marks : ((s as any).cat2_marks != null ? (s as any).cat2_marks : '—')}</td>
                        <td className="py-3.5 px-3 text-center font-bold">{s.cat3Marks != null ? s.cat3Marks : ((s as any).cat3_marks != null ? (s as any).cat3_marks : '—')}</td>
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              (s.attendancePercentage ?? s.attendancePercent ?? 0) >= 75
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {s.attendancePercentage != null ? `${s.attendancePercentage}%` : (s.attendancePercent != null ? `${s.attendancePercent}%` : '—')}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-purple-700">
                          {s.remainingODDays !== undefined ? `${s.remainingODDays}d left` : '9d'}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              s.isEligible !== false
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {s.isEligible !== false ? 'OD Eligible' : 'OD Restrained'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedStudentAcademic(s)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white font-bold text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View Card</span>
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRequest && (
        <ODDetailModal
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedRequest(null);
          }}
          request={selectedRequest}
          faculty={faculty}
          onActionComplete={loadData}
        />
      )}

      {/* Confirmation Modals */}
      {actionReq && (
        <>
          <ApproveModal
            isOpen={isApproveOpen}
            onClose={() => {
              setIsApproveOpen(false);
              setActionReq(null);
            }}
            onConfirm={handleApproveConfirm}
            requestId={actionReq.id}
            eventName={actionReq.eventName}
            studentName={actionReq.studentName}
            role="Mentor"
          />

          <RejectModal
            isOpen={isRejectOpen}
            onClose={() => {
              setIsRejectOpen(false);
              setActionReq(null);
            }}
            onConfirm={handleRejectConfirm}
            requestId={actionReq.id}
            eventName={actionReq.eventName}
            studentName={actionReq.studentName}
            role="Mentor"
          />
        </>
      )}

      {/* Certificate Preview Modal */}
      {previewCert && (
        <CertificatePreviewModal
          isOpen={isCertModalOpen}
          onClose={() => {
            setIsCertModalOpen(false);
            setPreviewCert(null);
          }}
          request={data.all.find(r => r.id === previewCert.requestId) || data.all[0]}
          faculty={faculty}
          onVerified={loadData}
        />
      )}

      {/* Student Academic Details Card Modal */}
      {selectedStudentAcademic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedStudentAcademic(null)}
          />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200/90 z-10 overflow-hidden flex flex-col animate-scale-up">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-300">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Student Academic Details</h3>
                  <p className="text-xs text-slate-300">Central Academic Record</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentAcademic(null)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1 border-b border-slate-100 pb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Student Profile</span>
                <p className="text-base font-bold text-slate-900">Student: {selectedStudentAcademic.studentName}</p>
                <p className="text-xs text-indigo-600 font-bold">Register Number: {selectedStudentAcademic.registerNumber}</p>
              </div>

              {!selectedStudentAcademic.has_academic_data && selectedStudentAcademic.cat1Marks == null && selectedStudentAcademic.cat2Marks == null && selectedStudentAcademic.cat3Marks == null ? (
                <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Academic data not available yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">CAT 1</span>
                    <span className="text-xl font-black text-slate-800">
                      {selectedStudentAcademic.cat1Marks !== null && selectedStudentAcademic.cat1Marks !== undefined ? selectedStudentAcademic.cat1Marks : '—'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">CAT 2</span>
                    <span className="text-xl font-black text-slate-800">
                      {selectedStudentAcademic.cat2Marks !== null && selectedStudentAcademic.cat2Marks !== undefined ? selectedStudentAcademic.cat2Marks : '—'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">CAT 3</span>
                    <span className="text-xl font-black text-slate-800">
                      {selectedStudentAcademic.cat3Marks !== null && selectedStudentAcademic.cat3Marks !== undefined ? selectedStudentAcademic.cat3Marks : '—'}
                    </span>
                  </div>
                  <div className="bg-primary-50 p-3 rounded-2xl border border-primary-100">
                    <span className="text-[10px] text-primary-700 font-bold uppercase block">Attendance</span>
                    <span className="text-xl font-black text-primary-900">
                      {selectedStudentAcademic.attendancePercentage != null ? `${selectedStudentAcademic.attendancePercentage}%` : '—'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedStudentAcademic(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </PortalLayout>
  );
};
