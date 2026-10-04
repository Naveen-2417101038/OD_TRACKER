import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Hourglass, CheckCircle, XCircle, FilePlus2, 
  Search, Calendar, Award, Percent, ChevronRight, GraduationCap
} from 'lucide-react';
import { getStudentProfile, getODRequests, syncODRequestsFromBackend, getAuthSession } from '../data/mockData';
import { Student, ODRequest } from '../types/types';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { apiGetMyAcademic } from '../services/api';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [requests, setRequests] = useState<ODRequest[]>([]);
  const [academic, setAcademic] = useState<{
    attendancePercentage: number | null;
    cat1Marks: number | null;
    cat2Marks: number | null;
    cat3Marks: number | null;
    hasAcademicData?: boolean;
    maxODAllowedDays?: number;
    remainingODDays?: number;
    consumedODDays?: number;
    isEligible?: boolean;
    lastUpdated?: string;
  } | null>(null);

  const loadData = () => {
    setStudent(getStudentProfile());
    setRequests(getODRequests());
  };

  useEffect(() => {
    loadData();
    syncODRequestsFromBackend().then((backendReqs) => {
      if (backendReqs) setRequests(backendReqs);
    });

    const session = getAuthSession();
    apiGetMyAcademic(session?.token).then((res: any) => {
      if (res && res.success) {
        const acad = res.academic || res;
        setAcademic({
          attendancePercentage: acad.attendance_percentage ?? null,
          cat1Marks: acad.cat1_marks ?? null,
          cat2Marks: acad.cat2_marks ?? null,
          cat3Marks: acad.cat3_marks ?? null,
          hasAcademicData: acad.has_academic_data ?? (acad.cat1_marks != null || acad.attendance_percentage != null),
          maxODAllowedDays: acad.eligibility?.max_od_allowed_days,
          remainingODDays: acad.eligibility?.remaining_od_days,
          consumedODDays: acad.eligibility?.consumed_od_days,
          isEligible: acad.eligibility?.is_eligible,
          lastUpdated: acad.last_updated,
        });
      }
    }).catch(err => console.warn('Could not load student academic data:', err));

    // Refresh dashboard on updates
    window.addEventListener('odStateUpdated', loadData);
    return () => window.removeEventListener('odStateUpdated', loadData);
  }, []);

  const totalRequests = requests.length;
  const pendingRequests = requests.filter(r => r.status === 'Pending').length;
  const approvedRequests = requests.filter(r => r.status === 'Approved' || r.status === 'Mentor Approved' || r.status === 'Class Incharge Approved').length;
  const rejectedRequests = requests.filter(r => r.status === 'Rejected' || r.status === 'Mentor Rejected' || r.status === 'Class Incharge Rejected').length;

  const quickActions = [
    { label: 'Apply for OD', icon: FilePlus2, path: '/student/apply', color: 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200/50' },
    { label: 'Track Requests', icon: Search, path: '/student/requests', color: 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200/50' },
    { label: 'Upload Certificate', icon: Award, path: '/student/certificates', color: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200/50' },
    { label: 'View Attendance', icon: Percent, path: '/student/attendance', color: 'bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200/50' },
  ];

  return (
    <div className="space-y-6">
      
      {/* 1. Welcoming Hero Banner */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-blue-800 text-white rounded-3xl p-6 md:p-8 shadow-lg relative overflow-hidden border border-primary-500/20">
        <div className="absolute right-0 bottom-0 top-0 opacity-10 flex items-center justify-center pointer-events-none">
          <GraduationCap className="w-80 h-80 -mr-16" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="bg-primary-500/30 text-primary-100 border border-primary-400/25 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              Academic Year 2026 - 2027
            </span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-1">Welcome back, {student?.name || 'Naveen'} 👋</h1>
            <p className="text-sm text-primary-100 max-w-xl">
              Track your On-Duty requests, check your attendance, upload participation certificates, and review your CAT examination marks.
            </p>
          </div>

          {/* Mini Student Info Badge */}
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-xs font-medium space-y-1.5 self-start min-w-[200px]">
            <div className="flex justify-between border-b border-white/10 pb-1.5 mb-1.5">
              <span className="text-white/60">Reg Number</span>
              <span className="font-bold text-white">{student?.registerNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Department</span>
              <span className="font-bold text-white text-right ml-4">{student?.department}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Year & Sec</span>
              <span className="font-bold text-white">{student?.year} - {student?.section}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Academic Performance Section */}
      <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-primary-50 text-primary-600 rounded-lg">
                <GraduationCap className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-slate-800 text-sm md:text-base">Academic Performance</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Official attendance and CAT scores uploaded and verified by Class Incharge
              {academic?.lastUpdated && !isNaN(new Date(academic.lastUpdated).getTime()) && ` • Updated ${new Date(academic.lastUpdated).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => navigate('/student/attendance')}
              className="text-xs text-primary-600 hover:text-primary-800 font-bold hover:underline"
            >
              Attendance Details →
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => navigate('/student/marks')}
              className="text-xs text-primary-600 hover:text-primary-800 font-bold hover:underline"
            >
              CAT Marksheet →
            </button>
          </div>
        </div>

        {!academic || (academic.cat1Marks == null && academic.cat2Marks == null && academic.cat3Marks == null && academic.attendancePercentage == null) ? (
          <div className="py-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 mt-4 space-y-1">
            <p className="text-slate-600 font-bold text-xs">Academic data not available yet.</p>
            <p className="text-[11px] text-slate-400">Official CAT marks and attendance will appear here once uploaded by your Class Incharge.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-4">
            <div className="bg-primary-50/50 border border-primary-100/60 rounded-2xl p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700">Attendance</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-primary-800">
                  {academic.attendancePercentage != null ? `${academic.attendancePercentage}%` : '—'}
                </span>
                {academic.attendancePercentage != null && (
                  <span className="text-[10px] font-bold text-primary-600">
                    {academic.attendancePercentage >= 75 ? 'Eligible' : 'Low'}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">CAT 1</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-slate-800">
                  {academic.cat1Marks != null ? academic.cat1Marks : '—'}
                </span>
                {academic.cat1Marks != null && <span className="text-[10px] text-slate-400 font-bold">/ 100</span>}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">CAT 2</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-slate-800">
                  {academic.cat2Marks != null ? academic.cat2Marks : '—'}
                </span>
                {academic.cat2Marks != null && <span className="text-[10px] text-slate-400 font-bold">/ 100</span>}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">CAT 3</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-slate-800">
                  {academic.cat3Marks != null ? academic.cat3Marks : '—'}
                </span>
                {academic.cat3Marks != null && <span className="text-[10px] text-slate-400 font-bold">/ 100</span>}
              </div>
            </div>

            <div className="col-span-2 md:col-span-1 bg-purple-50/60 border border-purple-100/60 rounded-2xl p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">10% Academic OD Cap</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-purple-800">
                  {academic.remainingODDays !== undefined ? `${academic.remainingODDays}d` : '—'}
                </span>
                {academic.maxODAllowedDays !== undefined && (
                  <span className="text-[10px] text-purple-600 font-semibold">
                    left of {academic.maxODAllowedDays}d
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Summary Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <Card className="hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total OD Requests</p>
              <h3 className="text-2xl md:text-3xl font-black text-slate-800 mt-2">{totalRequests}</h3>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-slate-600">
              <FileText className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-[10px] md:text-xs text-slate-500 font-medium">
            <span className="text-slate-700 font-bold mr-1">All applications</span>
            <span>in system</span>
          </div>
        </Card>

        <Card className="hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Pending</p>
              <h3 className="text-2xl md:text-3xl font-black text-amber-600 mt-2">{pendingRequests}</h3>
            </div>
            <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl text-amber-600">
              <Hourglass className="w-6 h-6 animate-pulse" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-[10px] md:text-xs text-amber-600 font-medium">
            <span className="font-bold mr-1">Requires</span>
            <span>staff review</span>
          </div>
        </Card>

        <Card className="hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Approved</p>
              <h3 className="text-2xl md:text-3xl font-black text-emerald-600 mt-2">{approvedRequests}</h3>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl text-emerald-600">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-[10px] md:text-xs text-emerald-600 font-medium">
            <span className="font-bold mr-1">Attendance</span>
            <span>records updated</span>
          </div>
        </Card>

        <Card className="hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Rejected</p>
              <h3 className="text-2xl md:text-3xl font-black text-rose-600 mt-2">{rejectedRequests}</h3>
            </div>
            <div className="bg-rose-50 border border-rose-100 p-3 rounded-2xl text-rose-600">
              <XCircle className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-[10px] md:text-xs text-rose-600 font-medium">
            <span className="font-bold mr-1">Check feedback</span>
            <span>and resubmit</span>
          </div>
        </Card>

      </div>

      {/* 3. Quick Actions */}
      <Card>
        <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wider mb-4">Quick Actions</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl font-bold text-xs transition-all space-y-2 text-center hover:scale-[1.02] shadow-sm ${action.color}`}
              >
                <Icon className="w-6 h-6" />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* 4. Recent OD Requests */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wider">Recent OD Requests</h4>
          <button 
            onClick={() => navigate('/student/requests')} 
            className="text-xs text-primary-600 hover:text-primary-800 font-bold flex items-center gap-1 hover:underline"
          >
            <span>View All Requests</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {requests.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            No OD requests found. Click "Apply for OD" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 pr-2">Request ID</th>
                  <th className="pb-3 pr-2">Event</th>
                  <th className="pb-3 pr-2 hidden md:table-cell">Date</th>
                  <th className="pb-3 pr-2 hidden sm:table-cell">Type</th>
                  <th className="pb-3 pr-2">Status</th>
                  <th className="pb-3 pr-2 hidden lg:table-cell">Approval Stage</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {requests.slice(0, 4).map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 text-primary-600 font-bold">{req.id}</td>
                    <td className="py-3.5 pr-2 max-w-[120px] md:max-w-none truncate">{req.eventName}</td>
                    <td className="py-3.5 pr-2 hidden md:table-cell">
                      {new Date(req.eventDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 pr-2 hidden sm:table-cell">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                        {req.eventType}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <StatusBadge status={req.status} size="sm" />
                    </td>
                    <td className="py-3.5 hidden lg:table-cell">
                      <span className="text-slate-500 font-medium">{req.approvalStage}</span>
                    </td>
                    <td className="py-3.5 text-right">
                      <button
                        onClick={() => navigate(`/student/requests/${req.id}`)}
                        className="bg-primary-50 text-primary-600 hover:bg-primary-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
};
