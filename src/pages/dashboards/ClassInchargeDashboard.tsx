import React, { useState, useEffect } from 'react';
import { 
  Users, CheckCircle2, XCircle, Hourglass, 
  Eye, Check, X, Search, Filter, Calendar, 
  FileText, TrendingUp, AlertTriangle, ArrowRight,
  ShieldCheck, Award, Sparkles, BookOpen, ExternalLink,
  Upload
} from 'lucide-react';
import { 
  getFacultyODRequests, approveODRequestByFaculty, 
  rejectODRequestByFaculty, getCurrentFaculty, 
  getClassStudents, getAuthSession 
} from '../../data/mockData';
import { 
  apiGetClassInchargeODRequests, 
  apiApproveODRequestByClassIncharge, 
  apiRejectODRequestByClassIncharge,
  apiGetAcademicStudents
} from '../../services/api';
import { ODRequest, Faculty, ClassStudentInfo } from '../../types/types';
import { PortalLayout } from '../../layouts/PortalLayout';
import { StatusBadge } from '../../components/StatusBadge';
import { ODDetailModal } from '../../components/ODDetailModal';
import { ApproveModal, RejectModal } from '../../components/ConfirmationModal';
import { AcademicDataUpload } from '../../components/AcademicDataUpload';
import { useToast } from '../../components/Toast';

export const ClassInchargeDashboard: React.FC = () => {
  const { showToast } = useToast();
  const [faculty, setFaculty] = useState<Faculty>(getCurrentFaculty());
  const [activeTab, setActiveTab] = useState<'pending' | 'students' | 'history' | 'upload'>('pending');
  const [data, setData] = useState<{
    all: ODRequest[];
    pending: ODRequest[];
    approved: ODRequest[];
    rejected: ODRequest[];
  }>({ all: [], pending: [], approved: [], rejected: [] });

  const [students, setStudents] = useState<ClassStudentInfo[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ODRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Actions
  const [actionReq, setActionReq] = useState<ODRequest | null>(null);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    const curr = getCurrentFaculty();
    setFaculty(curr);
    const session = getAuthSession();
    
    // First set local state as fallback
    const localReqs = getFacultyODRequests(curr);
    setData(localReqs);
    setStudents(getClassStudents());

    // Sync from Flask Backend API
    try {
      const backendRes = await apiGetClassInchargeODRequests(session?.token);
      if (backendRes.success && Array.isArray(backendRes.requests)) {
        setData({
          all: backendRes.requests,
          pending: backendRes.pending || backendRes.requests.filter(r => r.status === 'Mentor Approved'),
          approved: backendRes.approved || backendRes.requests.filter(r => (r.status || '').includes('Approved')),
          rejected: backendRes.rejected || backendRes.requests.filter(r => (r.status || '').includes('Rejected')),
        });
      }

      // Sync academic students roster directly from central database
      const acadRes = await apiGetAcademicStudents(session?.token);
      if (acadRes.success && Array.isArray(acadRes.students) && acadRes.students.length > 0) {
        setStudents(prev => {
          return acadRes.students!.map(s => {
            const existing = prev.find(u => u.registerNumber.toUpperCase() === s.registerNumber.toUpperCase());
            return {
              id: (s as any).studentId || s.id || (existing ? existing.id : 'STUD'),
              rollNo: s.rollNo || s.registerNumber,
              name: (s as any).studentName || s.name || (existing ? existing.name : 'Unknown'),
              registerNumber: s.registerNumber,
              department: s.department || (existing ? existing.department : 'Computer Science and Design'),
              year: s.year || (existing ? existing.year : 'III Year'),
              section: s.section || (existing ? existing.section : 'A'),
              mentorId: existing?.mentorId || 'FAC001',
              mentorName: existing?.mentorName || 'Dr. A. Rajesh',
              attendancePercent: s.attendancePercentage != null ? s.attendancePercentage : (s.attendancePercent != null ? s.attendancePercent : (existing?.attendancePercent || 85)),
              totalODsTaken: existing?.totalODsTaken || 0,
              cat1Average: s.cat1Marks != null ? s.cat1Marks : ((s as any).cat1_marks != null ? (s as any).cat1_marks : (s.cat1Average != null ? s.cat1Average : (existing?.cat1Average ?? null))),
              cat2Average: s.cat2Marks != null ? s.cat2Marks : ((s as any).cat2_marks != null ? (s as any).cat2_marks : (s.cat2Average != null ? s.cat2Average : (existing?.cat2Average ?? null))),
              cat3Average: s.cat3Marks != null ? s.cat3Marks : ((s as any).cat3_marks != null ? (s as any).cat3_marks : (s.cat3Average != null ? s.cat3Average : (existing?.cat3Average ?? null))),
              avatar: s.avatar || existing?.avatar,
            };
          });
        });
      }
    } catch (err) {
      console.warn('Could not sync Class Incharge data from backend:', err);
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

    const res = await apiApproveODRequestByClassIncharge(actionReq.id, remarks, session?.token);
    if (res.success) {
      showToast(res.message || `OD request ${actionReq.id} endorsed and forwarded to HOD for final sanction!`, 'success');
      approveODRequestByFaculty(actionReq.id, faculty, remarks);
    } else {
      showToast(res.error || `Failed to endorse OD request ${actionReq.id}.`, 'error');
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

    const res = await apiRejectODRequestByClassIncharge(actionReq.id, reason, session?.token);
    if (res.success) {
      showToast(res.message || `OD request ${actionReq.id} rejected. Reason logged.`, 'error');
      rejectODRequestByFaculty(actionReq.id, faculty, reason);
    } else {
      showToast(res.error || `Failed to reject OD request ${actionReq.id}.`, 'error');
    }

    setIsRejectOpen(false);
    setActionReq(null);
    loadData();
  };

  const handleViewODLetter = (req: ODRequest) => {
    const letterUrl = req.documentUrl || (req as any).odLetterUrl;
    if (letterUrl && letterUrl.startsWith('/api/')) {
      window.open(letterUrl, '_blank');
    } else {
      window.open(`/api/class-incharge/od-requests/${req.id}/letter`, '_blank');
    }
  };

  const filteredPending = data.pending.filter(r =>
    r.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.studentRegisterNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.registerNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PortalLayout role="Class Incharge">
      <div className="space-y-6">
        
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-4">
            <img 
              src={faculty.avatar || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&h=150&q=80'} 
              alt={faculty.name} 
              className="w-14 h-14 rounded-2xl object-cover border-2 border-teal-400/40 shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  {faculty.role}
                </span>
                <span className="text-xs text-slate-300 font-semibold">{faculty.department}</span>
              </div>
              <h2 className="text-xl font-black text-white mt-0.5">{faculty.name}</h2>
              <p className="text-xs text-slate-300 font-medium">Assigned: <strong className="text-teal-200">{faculty.assigned_section}</strong></p>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-xs px-4 py-2.5 rounded-2xl border border-white/10 text-center">
              <span className="text-xs text-slate-300 font-bold uppercase tracking-wider block">Class Strength</span>
              <span className="text-lg font-black text-white">{students.length} Students</span>
            </div>
            <div className="bg-teal-500/20 backdrop-blur-xs px-4 py-2.5 rounded-2xl border border-teal-400/30 text-center">
              <span className="text-xs text-teal-300 font-bold uppercase tracking-wider block">Forwarded ODs</span>
              <span className="text-lg font-black text-teal-200">{data.pending.length} Pending</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs & Search Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'pending'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-200'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Hourglass className="w-3.5 h-3.5" />
              <span>Pending Endorsements ({data.pending.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('students')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'students'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-200'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Class Students & Attendance ({students.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-200'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>OD History & Records ({data.all.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'upload'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-200'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Academic Data Upload</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search student or request..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        {/* Tab 1: Pending OD Requests */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            {filteredPending.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-800">All caught up!</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No pending OD requests waiting for Class Incharge endorsement right now.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredPending.map((req) => (
                  <div 
                    key={req.id}
                    className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md p-6 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">{req.id}</span>
                        <StatusBadge status={req.status} size="sm" />
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
                          {req.eventType}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-slate-900">{req.eventName}</h4>
                      
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span><strong>Student:</strong> {req.studentName} ({req.studentRegisterNo})</span>
                        <span>&bull;</span>
                        <span><strong>Organizer:</strong> {req.eventOrganizer}</span>
                        <span>&bull;</span>
                        <span><strong>Date:</strong> {req.eventDate} ({req.fromTime} - {req.toTime})</span>
                      </div>

                      {/* Mentor Recommendation Remarks */}
                      {(req.stages?.mentor?.feedback || (req as any).mentorRemarks) && (
                        <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900">
                          <strong>Mentor Remarks {req.stages?.mentor?.faculty_name ? `(${req.stages.mentor.faculty_name})` : ''}:</strong> "{req.stages?.mentor?.feedback || (req as any).mentorRemarks}"
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleViewODLetter(req)}
                        className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                        title="Inspect uploaded OD Request Letter"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Letter</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRequest(req);
                          setIsDetailOpen(true);
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Details</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActionReq(req);
                          setIsRejectOpen(true);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
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
                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Endorse & Forward to HOD</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Class Students Roster & Academic Marks */}
        {activeTab === 'students' && (
          <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-base text-slate-900">Student Academic Details & Roster</h3>
                <p className="text-xs text-slate-500 mt-0.5">Central database records of student CAT marks and verified attendance percentages.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-4">Register Number</th>
                    <th className="p-4">Student Name</th>
                    <th className="p-4 text-center">CAT 1</th>
                    <th className="p-4 text-center">CAT 2</th>
                    <th className="p-4 text-center">CAT 3</th>
                    <th className="p-4 text-center">Attendance</th>
                    <th className="p-4">Assigned Mentor</th>
                    <th className="p-4 text-center">OD Eligibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        Academic data not available yet. Upload class data using the "Academic Data Upload" tab.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <tr key={s.registerNumber} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 font-bold text-teal-800">{s.registerNumber}</td>
                        <td className="p-4 font-bold text-slate-900 flex items-center gap-2.5">
                          <img 
                            src={s.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80'} 
                            alt={s.name} 
                            className="w-7 h-7 rounded-full object-cover border"
                          />
                          <span>{s.name}</span>
                        </td>
                        <td className="p-4 text-center font-bold text-slate-800">
                          {s.cat1Average !== undefined && s.cat1Average !== null ? s.cat1Average : '—'}
                        </td>
                        <td className="p-4 text-center font-bold text-slate-800">
                          {s.cat2Average !== undefined && s.cat2Average !== null ? s.cat2Average : '—'}
                        </td>
                        <td className="p-4 text-center font-bold text-slate-800">
                          {s.cat3Average !== undefined && s.cat3Average !== null ? s.cat3Average : '—'}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                            s.attendancePercent >= 85 ? 'bg-emerald-100 text-emerald-800' :
                            s.attendancePercent >= 75 ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800 animate-pulse'
                          }`}>
                            {s.attendancePercent != null ? `${s.attendancePercent}%` : '—'}
                          </span>
                        </td>
                        <td className="p-4 text-indigo-700 font-bold">{s.mentorName || 'Dr. A. Rajesh'}</td>
                        <td className="p-4 text-center">
                          {s.attendancePercent >= 75 ? (
                            <span className="text-emerald-600 font-bold text-xs flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Eligible
                            </span>
                          ) : (
                            <span className="text-rose-600 font-bold text-xs flex items-center justify-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Shortage
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: History */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-black text-base text-slate-900">Class Incharge OD History Archive</h3>
              <p className="text-xs text-slate-500">Record of all previous applications reviewed and endorsed by Class Incharge.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-4">OD Request ID</th>
                    <th className="p-4">Student</th>
                    <th className="p-4">Event Name</th>
                    <th className="p-4">Event Date</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {data.all.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-bold text-teal-700">{r.id}</td>
                      <td className="p-4 font-bold text-slate-800">{r.studentName} ({r.studentRegisterNo})</td>
                      <td className="p-4">{r.eventName}</td>
                      <td className="p-4 text-slate-600">{r.eventDate}</td>
                      <td className="p-4"><StatusBadge status={r.status} size="sm" /></td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRequest(r);
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

        {/* Tab 4: Academic Data Upload */}
        {activeTab === 'upload' && (
          <AcademicDataUpload onUpdateSuccess={loadData} />
        )}

      </div>

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
            role="Class Incharge"
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
            role="Class Incharge"
          />
        </>
      )}
    </PortalLayout>
  );
};
