import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Landmark, GraduationCap, UserCheck, Users, 
  Building2, Layers, CheckCircle2, Clock, AlertCircle, 
  ArrowRight, ShieldCheck, Sparkles, ChevronRight,
  TrendingUp, Calendar, Award, FileText, Check, X,
  Search, Filter, PlusCircle, RefreshCw, Eye, Percent
} from 'lucide-react';
import { 
  getAuthSession, switchPersona, getODRequests, 
  getStudentProfile, getFacultyList, getClassStudents, 
  getDepartmentStats, approveODRequestByFaculty, 
  rejectODRequestByFaculty, saveODRequest
} from '../data/mockData';
import { UserRole, AuthSession, ODRequest, Student, Faculty, ClassStudentInfo } from '../types/types';
import { StatusBadge } from '../components/StatusBadge';
import { ODDetailModal } from '../components/ODDetailModal';
import { ApproveModal, RejectModal } from '../components/ConfirmationModal';
import { useToast } from '../components/Toast';

// Sub-Dashboards for Full Tabbed Embed Mode
import { Dashboard as StudentDashboard } from './Dashboard';
import { MentorDashboard } from './dashboards/MentorDashboard';
import { ClassInchargeDashboard } from './dashboards/ClassInchargeDashboard';
import { HODDashboard } from './dashboards/HODDashboard';

// Student Subpages for inside tab
import { ApplyOD } from './ApplyOD';
import { ODRequests } from './ODRequests';
import { ODHistory } from './ODHistory';
import { Attendance } from './Attendance';
import { CATMarks } from './CATMarks';
import { Certificates } from './Certificates';
import { Profile } from './Profile';

type PortalViewTab = 'MATRIX' | 'STUDENT' | 'MENTOR' | 'CLASS_INCHARGE' | 'HOD';

export const UnifiedPortal: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  const tabParam = searchParams.get('tab');
  const initialTab: PortalViewTab = 
    tabParam === 'student' ? 'STUDENT' :
    tabParam === 'mentor' ? 'MENTOR' :
    tabParam === 'incharge' ? 'CLASS_INCHARGE' :
    tabParam === 'hod' ? 'HOD' : 'MATRIX';

  const [activeTab, setActiveTab] = useState<PortalViewTab>(initialTab);
  const [studentSubTab, setStudentSubTab] = useState<'dashboard' | 'apply' | 'requests' | 'history' | 'attendance' | 'marks' | 'certificates' | 'profile'>('dashboard');
  
  const [session, setSession] = useState<AuthSession | null>(getAuthSession());
  const [requests, setRequests] = useState<ODRequest[]>([]);
  const [student, setStudent] = useState<Student>(getStudentProfile());
  const [faculties, setFaculties] = useState<Faculty[]>(getFacultyList());
  const [studentsRoster, setStudentsRoster] = useState<ClassStudentInfo[]>(getClassStudents());
  const [stats, setStats] = useState(getDepartmentStats());

  // Modal states for Matrix actions
  const [selectedRequest, setSelectedRequest] = useState<ODRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [actionReq, setActionReq] = useState<ODRequest | null>(null);
  const [actionRole, setActionRole] = useState<UserRole>('Mentor');
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  // Search & Filter in Matrix
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Pending' | 'Approved' | 'Rejected'>('ALL');

  const loadAllData = () => {
    setSession(getAuthSession());
    setRequests(getODRequests());
    setStudent(getStudentProfile());
    setFaculties(getFacultyList());
    setStudentsRoster(getClassStudents());
    setStats(getDepartmentStats());
  };

  useEffect(() => {
    loadAllData();
    const handleUpdate = () => loadAllData();
    window.addEventListener('odStateUpdated', handleUpdate);
    window.addEventListener('odFacultyStateUpdated', handleUpdate);
    window.addEventListener('odAuthStateChanged', handleUpdate);
    return () => {
      window.removeEventListener('odStateUpdated', handleUpdate);
      window.removeEventListener('odFacultyStateUpdated', handleUpdate);
      window.removeEventListener('odAuthStateChanged', handleUpdate);
    };
  }, []);

  const handleTabChange = (tab: PortalViewTab) => {
    setActiveTab(tab);
    const param = 
      tab === 'STUDENT' ? 'student' :
      tab === 'MENTOR' ? 'mentor' :
      tab === 'CLASS_INCHARGE' ? 'incharge' :
      tab === 'HOD' ? 'hod' : 'matrix';
    setSearchParams({ tab: param });

    // Sync session persona when switching to a dedicated dashboard tab
    if (tab === 'STUDENT') switchPersona('Student');
    if (tab === 'MENTOR') switchPersona('Mentor');
    if (tab === 'CLASS_INCHARGE') switchPersona('Class Incharge');
    if (tab === 'HOD') switchPersona('HOD');
  };

  const handleSwitchPersona = (role: UserRole) => {
    const newSession = switchPersona(role);
    setSession(newSession);
    showToast(`Switched active persona to ${role} (${newSession.name})`, 'success');
  };

  // Matrix Fast Approvals
  const handleQuickApprove = (req: ODRequest, role: UserRole) => {
    setActionReq(req);
    setActionRole(role);
    setIsApproveOpen(true);
  };

  const handleQuickReject = (req: ODRequest, role: UserRole) => {
    setActionReq(req);
    setActionRole(role);
    setIsRejectOpen(true);
  };

  const handleApproveConfirm = (remarks: string) => {
    if (!actionReq) return;
    const fac = faculties.find(f => f.role === actionRole) || faculties[0];
    approveODRequestByFaculty(actionReq.id, fac, remarks);
    showToast(`OD Request ${actionReq.id} approved by ${actionRole}!`, 'success');
    setIsApproveOpen(false);
    setActionReq(null);
    loadAllData();
  };

  const handleRejectConfirm = (reason: string) => {
    if (!actionReq) return;
    const fac = faculties.find(f => f.role === actionRole) || faculties[0];
    rejectODRequestByFaculty(actionReq.id, fac, reason);
    showToast(`OD Request ${actionReq.id} rejected by ${actionRole}`, 'error');
    setIsRejectOpen(false);
    setActionReq(null);
    loadAllData();
  };

  // Instant Test OD Application Creator for Simulator
  const handleCreateTestOD = () => {
    const newOD = saveODRequest({
      studentId: student.registerNumber,
      studentName: student.name,
      studentRegisterNo: student.registerNumber,
      studentDepartment: student.department,
      studentYear: student.year,
      studentSection: student.section,
      studentPhone: student.phone,
      studentEmail: student.email,
      eventName: `REC Innovation Challenge ${Math.floor(Math.random() * 900 + 100)}`,
      eventType: 'Hackathon',
      eventOrganizer: 'Center for Innovation & AI',
      venue: 'REC Tech Park Auditorium',
      eventDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      fromTime: '09:00',
      toTime: '17:00',
      reason: 'Prototype presentation and technical project evaluation.',
      description: 'National Level Tech Showcase representing Computer Science & Design.',
      documentUrl: 'demo_invitation.pdf',
      certificateStatus: 'Not Uploaded',
      impactedSubjects: [
        { subjectCode: 'CS3401', subjectName: 'Design and Analysis of Algorithms', facultyName: 'Dr. M. Senthil', periods: 2 },
        { subjectCode: 'CS3402', subjectName: 'Operating Systems & System Software', facultyName: 'Dr. M. Senthil', periods: 2 },
      ],
    });

    showToast(`Created new test OD Request ${newOD.id}! Ready for Mentor review.`, 'success');
    loadAllData();
  };

  // Filtered requests for Matrix
  const filteredRequests = requests.filter(r => {
    const matchesSearch = 
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.studentRegisterNo || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = 
      statusFilter === 'ALL' ? true :
      statusFilter === 'Pending' ? (r.status === 'Pending' || r.status.includes('Approved') && r.status !== 'Approved') :
      statusFilter === 'Approved' ? (r.status === 'Approved') :
      (r.status === 'Rejected' || r.status.includes('Rejected'));

    return matchesSearch && matchesStatus;
  });

  const mentorPending = requests.filter(r => r.status === 'Pending' && r.approvalStage === 'Mentor');
  const classInchargePending = requests.filter(r => r.approvalStage === 'Class Incharge');
  const hodPending = requests.filter(r => r.approvalStage === 'HOD');

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased text-slate-800 selection:bg-primary-500 selection:text-white">
      
      {/* 1. Master Institutional Navigation Bar */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between gap-4">
            
            {/* Institution Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-950 via-slate-900 to-primary-700 flex items-center justify-center text-white shadow-md shadow-primary-950/20">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm sm:text-base text-slate-900 tracking-tight">
                    RAJALAKSHMI ENGINEERING COLLEGE
                  </span>
                  <span className="hidden md:inline-block px-2 py-0.5 text-[10px] font-extrabold bg-amber-100 text-amber-900 rounded-full border border-amber-300">
                    AUTONOMOUS
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
                  <span className="text-primary-700 font-bold">Unified Digital OD Portal</span>
                  <span>&bull; All 4 Stakeholder Dashboards in One Place</span>
                </p>
              </div>
            </div>

            {/* Persona Quick Switcher Badges */}
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                  Active Persona:
                </span>
                
                <button
                  type="button"
                  onClick={() => handleSwitchPersona('Student')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    session?.role === 'Student'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                  title="Switch to Student: Naveen"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Student</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchPersona('Mentor')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    session?.role === 'Mentor'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                  title="Switch to Mentor: Dr. A. Rajesh"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Mentor</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchPersona('Class Incharge')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    session?.role === 'Class Incharge'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                  title="Switch to Class Incharge: Mrs. K. Shanthi"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Incharge</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchPersona('HOD')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    session?.role === 'HOD'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                  title="Switch to HOD: Dr. V. Karpagam"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>HOD</span>
                </button>
              </div>

              {/* Reset/Refresh button */}
              <button
                type="button"
                onClick={() => {
                  loadAllData();
                  showToast('Live dashboard data refreshed!', 'info');
                }}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Refresh all data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>

        {/* 2. Top Portal Master Tab Switcher */}
        <div className="bg-slate-50 border-t border-slate-200/80 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar py-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              
              {/* Tab 1: All-in-One 360 Matrix */}
              <button
                type="button"
                onClick={() => handleTabChange('MATRIX')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'MATRIX'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/25'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>360° All Dashboards Matrix</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                  activeTab === 'MATRIX' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  Live Hub
                </span>
              </button>

              {/* Tab 2: Student Dashboard */}
              <button
                type="button"
                onClick={() => handleTabChange('STUDENT')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'STUDENT'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Student Dashboard</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                  activeTab === 'STUDENT' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {student.name}
                </span>
              </button>

              {/* Tab 3: Mentor Dashboard */}
              <button
                type="button"
                onClick={() => handleTabChange('MENTOR')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'MENTOR'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Mentor Dashboard</span>
                {mentorPending.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                    activeTab === 'MENTOR' ? 'bg-white text-indigo-700' : 'bg-rose-500 text-white animate-pulse'
                  }`}>
                    {mentorPending.length}
                  </span>
                )}
              </button>

              {/* Tab 4: Class Incharge Dashboard */}
              <button
                type="button"
                onClick={() => handleTabChange('CLASS_INCHARGE')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'CLASS_INCHARGE'
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-500/25'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Class Incharge Dashboard</span>
                {classInchargePending.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                    activeTab === 'CLASS_INCHARGE' ? 'bg-white text-teal-700' : 'bg-teal-700 text-white'
                  }`}>
                    {classInchargePending.length}
                  </span>
                )}
              </button>

              {/* Tab 5: HOD Executive Dashboard */}
              <button
                type="button"
                onClick={() => handleTabChange('HOD')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'HOD'
                    ? 'bg-purple-700 text-white shadow-md shadow-purple-500/25'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>HOD Executive Dashboard</span>
                {hodPending.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                    activeTab === 'HOD' ? 'bg-white text-purple-800' : 'bg-purple-800 text-white'
                  }`}>
                    {hodPending.length}
                  </span>
                )}
              </button>

            </div>

            {/* Direct Gateway directory link */}
            <button
              type="button"
              onClick={() => navigate('/directory')}
              className="text-xs font-bold text-slate-500 hover:text-primary-700 whitespace-nowrap pl-4 hidden sm:block cursor-pointer"
            >
              Standalone Login Portals &rarr;
            </button>
          </div>
        </div>
      </header>

      {/* 3. Main Dashboard Work Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        
        {/* ==================================================== */}
        {/* VIEW 1: 360° ALL-DASHBOARDS MATRIX COMMAND CENTER   */}
        {/* ==================================================== */}
        {activeTab === 'MATRIX' && (
          <div className="space-y-8">
            
            {/* Hero Welcome & Simulation Banner */}
            <div className="bg-gradient-to-r from-primary-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-white/10">
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2.5 max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>All-in-One Master OD Control Center</span>
                  </div>
                  <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                    Multi-Stakeholder OD Governance Portal
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Monitor, simulate, and manage all four approval levels—Student, Mentor, Class Incharge, and HOD—in a single unified matrix with zero login barriers.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCreateTestOD}
                    className="px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Generate New Test OD</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabChange('STUDENT')}
                    className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Open Student Full View</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 4 Multi-Role Live KPI Command Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              
              {/* Card 1: Student Overview */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                      Student Hub
                    </span>
                  </div>

                  <div>
                    <h3 className="font-black text-slate-900 text-base">{student.name}</h3>
                    <p className="text-xs text-slate-500 font-semibold">{student.registerNumber} &bull; III CSD</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <span className="text-[10px] text-slate-400 font-bold block">Attendance</span>
                      <strong className="text-emerald-700 font-black text-sm">{student.attendancePercent}%</strong>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <span className="text-[10px] text-slate-400 font-bold block">Total ODs</span>
                      <strong className="text-blue-700 font-black text-sm">{requests.length} Requests</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleTabChange('STUDENT')}
                    className="w-full py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>View Student Dashboard</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Card 2: Mentor Overview */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full">
                      Mentor Hub
                    </span>
                  </div>

                  <div>
                    <h3 className="font-black text-slate-900 text-base">Dr. A. Rajesh</h3>
                    <p className="text-xs text-slate-500 font-semibold">Associate Professor &bull; FAC001</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <span className="text-[10px] text-slate-400 font-bold block">Pending Review</span>
                      <strong className="text-amber-600 font-black text-sm">{mentorPending.length} Mentees</strong>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <span className="text-[10px] text-slate-400 font-bold block">Assigned Section</span>
                      <strong className="text-indigo-700 font-black text-xs">III CSD - Sec A</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleTabChange('MENTOR')}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>View Mentor Dashboard</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Card 3: Class Incharge Overview */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-2xl bg-teal-50 text-teal-600 border border-teal-100">
                      <Users className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-teal-100 text-teal-800 rounded-full">
                      Class Incharge Hub
                    </span>
                  </div>

                  <div>
                    <h3 className="font-black text-slate-900 text-base">Mrs. K. Shanthi</h3>
                    <p className="text-xs text-slate-500 font-semibold">Assistant Professor &bull; FAC002</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <span className="text-[10px] text-slate-400 font-bold block">Endorse Queue</span>
                      <strong className="text-teal-700 font-black text-sm">{classInchargePending.length} ODs</strong>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <span className="text-[10px] text-slate-400 font-bold block">Class Roster</span>
                      <strong className="text-slate-800 font-black text-sm">{studentsRoster.length} Students</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleTabChange('CLASS_INCHARGE')}
                    className="w-full py-2 px-3 rounded-xl bg-teal-50 hover:bg-teal-600 text-teal-700 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>View Incharge Dashboard</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Card 4: HOD Executive Overview */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full">
                      HOD Command Hub
                    </span>
                  </div>

                  <div>
                    <h3 className="font-black text-slate-900 text-base">Dr. V. Karpagam</h3>
                    <p className="text-xs text-slate-500 font-semibold">Professor & Head &bull; FAC004</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <span className="text-[10px] text-slate-400 font-bold block">Final Sanction</span>
                      <strong className="text-purple-700 font-black text-sm">{hodPending.length} ODs</strong>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <span className="text-[10px] text-slate-400 font-bold block">Dept OD Sanctioned</span>
                      <strong className="text-emerald-700 font-black text-sm">{stats.totalODsSanctioned} Grants</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleTabChange('HOD')}
                    className="w-full py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-700 text-purple-800 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>View HOD Dashboard</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>

            {/* 4-Stage Live Workflow Visualizer */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary-600" />
                    <span>Real-Time 4-Tier Approval Flow & Stage Progress</span>
                  </h3>
                  <p className="text-xs text-slate-500">Live operational state across all active applications</p>
                </div>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
                  {requests.length} Total Applications in Database
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Stage 1 */}
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">1</span>
                    <span className="text-[11px] font-bold text-blue-900">Student Submission</span>
                  </div>
                  <p className="text-xs text-slate-600">Student uploads event brochure, details period impact.</p>
                  <div className="pt-2 text-[11px] font-bold text-blue-700">
                    Active Submissions: {requests.length}
                  </div>
                </div>

                {/* Stage 2 */}
                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center">2</span>
                    <span className="text-[11px] font-bold text-indigo-900">Mentor Review</span>
                  </div>
                  <p className="text-xs text-slate-600">Audits student eligibility and validates supporting proofs.</p>
                  <div className="pt-2 text-[11px] font-bold text-indigo-700 flex items-center justify-between">
                    <span>Awaiting: {mentorPending.length}</span>
                    {mentorPending.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleTabChange('MENTOR')}
                        className="text-indigo-600 underline text-[10px] cursor-pointer"
                      >
                        Review
                      </button>
                    )}
                  </div>
                </div>

                {/* Stage 3 */}
                <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-teal-600 text-white font-black text-xs flex items-center justify-center">3</span>
                    <span className="text-[11px] font-bold text-teal-900">Incharge Endorsement</span>
                  </div>
                  <p className="text-xs text-slate-600">Cross-checks attendance &gt;75% &amp; CAT exam eligibility.</p>
                  <div className="pt-2 text-[11px] font-bold text-teal-700 flex items-center justify-between">
                    <span>Awaiting: {classInchargePending.length}</span>
                    {classInchargePending.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleTabChange('CLASS_INCHARGE')}
                        className="text-teal-600 underline text-[10px] cursor-pointer"
                      >
                        Endorse
                      </button>
                    )}
                  </div>
                </div>

                {/* Stage 4 */}
                <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-purple-700 text-white font-black text-xs flex items-center justify-center">4</span>
                    <span className="text-[11px] font-bold text-purple-900">HOD Final Sanction</span>
                  </div>
                  <p className="text-xs text-slate-600">Grants institutional approval &amp; credits attendance sync.</p>
                  <div className="pt-2 text-[11px] font-bold text-purple-700 flex items-center justify-between">
                    <span>Awaiting: {hodPending.length}</span>
                    {hodPending.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleTabChange('HOD')}
                        className="text-purple-700 underline text-[10px] cursor-pointer"
                      >
                        Sanction
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Central Live OD Applications Table with 1-Click Multi-Role Actions */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-4 p-6">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary-600" />
                    <span>Live Central Applications Queue (Multi-Role Action Matrix)</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Take instant approval actions as Mentor, Class Incharge, or HOD without leaving this screen
                  </p>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search OD ID, event, student..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-primary-500 focus:bg-white w-48 sm:w-60 transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    {(['ALL', 'Pending', 'Approved', 'Rejected'] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setStatusFilter(filter)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          statusFilter === filter
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                      <th className="py-3 px-4">OD Request ID</th>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Event Details</th>
                      <th className="py-3 px-4">Event Date</th>
                      <th className="py-3 px-4">Current Stage</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Unified Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No matching OD applications found in database.
                        </td>
                      </tr>
                    ) : (
                      filteredRequests.map((req) => {
                        const isPendingMentor = req.status === 'Pending' && req.approvalStage === 'Mentor';
                        const isPendingIncharge = req.approvalStage === 'Class Incharge';
                        const isPendingHOD = req.approvalStage === 'HOD';

                        return (
                          <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-primary-700">
                              {req.id}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900">{req.studentName}</div>
                              <div className="text-[10px] text-slate-400 font-semibold">{req.studentRegisterNo} &bull; {req.studentSection}</div>
                            </td>
                            <td className="py-3.5 px-4 max-w-xs">
                              <div className="font-bold text-slate-800 truncate">{req.eventName}</div>
                              <div className="text-[10px] text-slate-400 truncate">{req.eventType} &bull; {req.eventOrganizer}</div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                              {req.eventDate}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                req.approvalStage === 'Mentor' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                                req.approvalStage === 'Class Incharge' ? 'bg-teal-100 text-teal-800 border border-teal-200' :
                                req.approvalStage === 'HOD' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                                req.approvalStage === 'Approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}>
                                {req.approvalStage}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <StatusBadge status={req.status} />
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                
                                {/* View Details Modal */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedRequest(req);
                                    setIsDetailOpen(true);
                                  }}
                                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                  title="View Full Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                {/* Fast Mentor Approve */}
                                {isPendingMentor && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickApprove(req, 'Mentor')}
                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                    title="Approve as Mentor"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Mentor Approve</span>
                                  </button>
                                )}

                                {/* Fast Incharge Endorse */}
                                {isPendingIncharge && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickApprove(req, 'Class Incharge')}
                                    className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[10px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                    title="Endorse as Class Incharge"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Incharge Endorse</span>
                                  </button>
                                )}

                                {/* Fast HOD Sanction */}
                                {isPendingHOD && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickApprove(req, 'HOD')}
                                    className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-[10px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                    title="Final Approval by HOD"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>HOD Sanction</span>
                                  </button>
                                )}

                                {/* Reject Button if in review */}
                                {(isPendingMentor || isPendingIncharge || isPendingHOD) && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickReject(req, isPendingMentor ? 'Mentor' : isPendingIncharge ? 'Class Incharge' : 'HOD')}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Reject application"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}

                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>

          </div>
        )}

        {/* ==================================================== */}
        {/* VIEW 2: FULL EMBEDDED STUDENT DASHBOARD TAB         */}
        {/* ==================================================== */}
        {activeTab === 'STUDENT' && (
          <div className="space-y-6">
            
            {/* Student Navigation Sub-bar */}
            <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-xs flex items-center justify-between overflow-x-auto gap-2">
              <div className="flex items-center gap-1">
                {[
                  { id: 'dashboard', label: 'Dashboard Overview' },
                  { id: 'apply', label: 'Apply for OD' },
                  { id: 'requests', label: 'My OD Requests' },
                  { id: 'history', label: 'OD History' },
                  { id: 'attendance', label: 'Attendance' },
                  { id: 'marks', label: 'CAT Marks' },
                  { id: 'certificates', label: 'Certificates' },
                  { id: 'profile', label: 'Profile' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStudentSubTab(item.id as typeof studentSubTab)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      studentSubTab === item.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="text-right pr-2 hidden sm:block">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Student Persona</span>
                <span className="text-xs font-bold text-slate-800">{student.name} ({student.registerNumber})</span>
              </div>
            </div>

            {/* Embedded Subpage */}
            <div className="bg-transparent">
              {studentSubTab === 'dashboard' && <StudentDashboard />}
              {studentSubTab === 'apply' && <ApplyOD />}
              {studentSubTab === 'requests' && <ODRequests />}
              {studentSubTab === 'history' && <ODHistory />}
              {studentSubTab === 'attendance' && <Attendance />}
              {studentSubTab === 'marks' && <CATMarks />}
              {studentSubTab === 'certificates' && <Certificates />}
              {studentSubTab === 'profile' && <Profile />}
            </div>

          </div>
        )}

        {/* ==================================================== */}
        {/* VIEW 3: FULL EMBEDDED MENTOR DASHBOARD TAB          */}
        {/* ==================================================== */}
        {activeTab === 'MENTOR' && (
          <div className="space-y-4">
            <MentorDashboard />
          </div>
        )}

        {/* ==================================================== */}
        {/* VIEW 4: FULL EMBEDDED CLASS INCHARGE DASHBOARD TAB   */}
        {/* ==================================================== */}
        {activeTab === 'CLASS_INCHARGE' && (
          <div className="space-y-4">
            <ClassInchargeDashboard />
          </div>
        )}

        {/* ==================================================== */}
        {/* VIEW 5: FULL EMBEDDED HOD EXECUTIVE DASHBOARD TAB   */}
        {/* ==================================================== */}
        {activeTab === 'HOD' && (
          <div className="space-y-4">
            <HODDashboard />
          </div>
        )}

      </main>

      {/* OD Detail Modal */}
      {selectedRequest && (
        <ODDetailModal
          request={selectedRequest}
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedRequest(null);
          }}
        />
      )}

      {/* Confirmation Modals for Matrix actions */}
      <ApproveModal
        isOpen={isApproveOpen}
        onClose={() => {
          setIsApproveOpen(false);
          setActionReq(null);
        }}
        onConfirm={handleApproveConfirm}
        requestId={actionReq?.id || ''}
      />

      <RejectModal
        isOpen={isRejectOpen}
        onClose={() => {
          setIsRejectOpen(false);
          setActionReq(null);
        }}
        onConfirm={handleRejectConfirm}
        requestId={actionReq?.id || ''}
      />

      {/* College Institutional Footer */}
      <footer className="bg-white border-t border-slate-200/90 py-5 px-4 sm:px-8 text-center text-xs text-slate-500 space-y-1">
        <p className="font-bold text-slate-700">
          OD Tracking Application &bull; Rajalakshmi Engineering College &copy; {new Date().getFullYear()}
        </p>
        <p className="text-[11px] text-slate-400">
          Autonomous Institution Affiliated to Anna University &bull; Approved by AICTE &bull; NAAC 'A++' Accredited
        </p>
      </footer>

    </div>
  );
};
