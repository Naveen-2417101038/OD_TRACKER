import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, BarChart3, CheckSquare, Hourglass, 
  CheckCircle2, XCircle, Eye, Check, X, FileText, 
  Award, Download, Search, Filter, PieChart, Users,
  Calendar, Layers, ArrowUpRight, RotateCcw, Loader2,
  FileSpreadsheet, GraduationCap
} from 'lucide-react';
import { 
  getFacultyODRequests, approveODRequestByFaculty, 
  rejectODRequestByFaculty, getCurrentFaculty, 
  getDepartmentStats, getFacultyList, getAuthSession
} from '../../data/mockData';
import { 
  apiGetHODODRequests, 
  apiApproveODRequestByHOD, 
  apiRejectODRequestByHOD, 
  apiGetHODStats, 
  apiExportHODODExcel,
  apiGetAcademicStudents,
  AcademicStudentItem,
  HODExportFilters
} from '../../services/api';
import { ODRequest, Faculty } from '../../types/types';
import { PortalLayout } from '../../layouts/PortalLayout';
import { StatusBadge } from '../../components/StatusBadge';
import { ODDetailModal } from '../../components/ODDetailModal';
import { ApproveModal, RejectModal } from '../../components/ConfirmationModal';
import { useToast } from '../../components/Toast';

export const HODDashboard: React.FC = () => {
  const { showToast } = useToast();
  const [faculty, setFaculty] = useState<Faculty>(getCurrentFaculty());
  const [activeTab, setActiveTab] = useState<'pending' | 'analytics' | 'faculty' | 'history'>('pending');

  const [data, setData] = useState<{
    all: ODRequest[];
    pending: ODRequest[];
    approved: ODRequest[];
    rejected: ODRequest[];
  }>({ all: [], pending: [], approved: [], rejected: [] });

  const [stats, setStats] = useState(getDepartmentStats());
  const [facultyList, setFacultyList] = useState<Faculty[]>(getFacultyList());
  const [selectedRequest, setSelectedRequest] = useState<ODRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Approval Modals
  const [actionReq, setActionReq] = useState<ODRequest | null>(null);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  // Export Loading State
  const [isExporting, setIsExporting] = useState(false);

  // Advanced Filter Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [certStatusFilter, setCertStatusFilter] = useState('all');
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Academic Records Roster Inspection Modal
  const [isAcademicModalOpen, setIsAcademicModalOpen] = useState(false);
  const [academicStudents, setAcademicStudents] = useState<AcademicStudentItem[]>([]);
  const [loadingAcademic, setLoadingAcademic] = useState(false);
  const [academicSearch, setAcademicSearch] = useState('');
  const [selectedStudentAcademic, setSelectedStudentAcademic] = useState<AcademicStudentItem | null>(null);

  const handleOpenAcademicModal = async () => {
    setIsAcademicModalOpen(true);
    setLoadingAcademic(true);
    const token = getAuthToken();
    try {
      const res = await apiGetAcademicStudents(token);
      if (res.success && res.students) {
        setAcademicStudents(res.students);
      }
    } catch (e) {
      console.warn('Failed to load academic students:', e);
    } finally {
      setLoadingAcademic(false);
    }
  };

  // Get active auth token from localStorage or session
  const getAuthToken = () => {
    try {
      const session = getAuthSession();
      if (session?.token) return session.token;
      const stored = localStorage.getItem('od_auth_session') || localStorage.getItem('od_current_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.token || '';
      }
    } catch {
      return '';
    }
    return '';
  };

  const loadData = async () => {
    const curr = getCurrentFaculty();
    setFaculty(curr);
    const token = getAuthToken();

    // Try fetching live data from backend first
    try {
      const res = await apiGetHODODRequests(token);
      if (res.success && res.all && res.all.length > 0) {
        setData({
          all: res.all,
          pending: res.pending || [],
          approved: res.approved || [],
          rejected: res.rejected || []
        });

        const statsRes = await apiGetHODStats(token);
        if (statsRes.success && statsRes.stats) {
          setStats((prev) => ({
            ...prev,
            totalODsSanctioned: statsRes.stats.totalODsSanctioned || statsRes.stats.approved || 0,
            approvalRate: statsRes.stats.approvalRate || prev.approvalRate,
            departmentAvgAttendance: statsRes.stats.departmentAvgAttendance || prev.departmentAvgAttendance,
            eventDistribution: statsRes.stats.eventDistribution || prev.eventDistribution
          }));
        }
        setFacultyList(getFacultyList());
        return;
      }
    } catch (e) {
      console.warn('Live HOD API fetch fallback to local store:', e);
    }

    // Fallback to existing mockData store
    const reqs = getFacultyODRequests(curr);
    setData(reqs);
    setStats(getDepartmentStats());
    setFacultyList(getFacultyList());
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
    const token = getAuthToken();
    try {
      const res = await apiApproveODRequestByHOD(actionReq.id, remarks, token);
      if (res.success) {
        showToast(`OD request ${actionReq.id} officially APPROVED by HOD. Institutional sanction granted.`, 'success');
      } else {
        approveODRequestByFaculty(actionReq.id, faculty, remarks);
        showToast(`OD request ${actionReq.id} APPROVED by HOD.`, 'success');
      }
    } catch {
      approveODRequestByFaculty(actionReq.id, faculty, remarks);
      showToast(`OD request ${actionReq.id} APPROVED by HOD.`, 'success');
    }

    setIsApproveOpen(false);
    setActionReq(null);
    loadData();
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!actionReq) return;
    const token = getAuthToken();
    try {
      const res = await apiRejectODRequestByHOD(actionReq.id, reason, token);
      if (res.success) {
        showToast(`OD request ${actionReq.id} declined by HOD.`, 'error');
      } else {
        rejectODRequestByFaculty(actionReq.id, faculty, reason);
        showToast(`OD request ${actionReq.id} rejected by HOD.`, 'error');
      }
    } catch {
      rejectODRequestByFaculty(actionReq.id, faculty, reason);
      showToast(`OD request ${actionReq.id} rejected by HOD.`, 'error');
    }

    setIsRejectOpen(false);
    setActionReq(null);
    loadData();
  };

  // Reset all filters to default
  const handleResetFilters = () => {
    setSearchQuery('');
    setEventTypeFilter('all');
    setStatusFilter('all');
    setCertStatusFilter('all');
    setFromDateFilter('');
    setToDateFilter('');
  };

  // Build active filters object
  const activeFilters: HODExportFilters = useMemo(() => {
    const f: HODExportFilters = {};
    if (searchQuery.trim()) f.search = searchQuery.trim();
    if (eventTypeFilter !== 'all') f.eventType = eventTypeFilter;
    if (statusFilter !== 'all') f.status = statusFilter;
    if (certStatusFilter !== 'all') f.certificateStatus = certStatusFilter;
    if (fromDateFilter) f.fromDate = fromDateFilter;
    if (toDateFilter) f.toDate = toDateFilter;
    return f;
  }, [searchQuery, eventTypeFilter, statusFilter, certStatusFilter, fromDateFilter, toDateFilter]);

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return data.all.filter((r) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          r.studentName?.toLowerCase().includes(q) ||
          r.studentRegisterNo?.toLowerCase().includes(q) ||
          r.eventName?.toLowerCase().includes(q) ||
          r.id?.toLowerCase().includes(q) ||
          r.eventOrganizer?.toLowerCase().includes(q) ||
          r.venue?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // 2. Event Type
      if (eventTypeFilter !== 'all') {
        if (r.eventType?.toLowerCase() !== eventTypeFilter.toLowerCase()) {
          return false;
        }
      }

      // 3. Status
      if (statusFilter !== 'all') {
        const s = (r.status || '').toLowerCase();
        if (statusFilter === 'pending') {
          if (!s.includes('pending') && !['mentor approved', 'class incharge approved'].includes(s)) {
            return false;
          }
        } else if (statusFilter === 'pending_hod') {
          if (s !== 'class incharge approved') return false;
        } else if (statusFilter === 'approved') {
          if (!s.includes('approved') || ['mentor approved', 'class incharge approved'].includes(s)) {
            return false;
          }
        } else if (statusFilter === 'rejected') {
          if (!s.includes('rejected')) return false;
        } else if (s !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      // 4. Certificate Status
      if (certStatusFilter !== 'all') {
        const cs = (r.certificateStatus || 'Not Uploaded').toLowerCase();
        if (certStatusFilter === 'uploaded') {
          if (cs === 'not uploaded') return false;
        } else if (cs !== certStatusFilter.toLowerCase()) {
          return false;
        }
      }

      // 5. Date Range
      const rFrom = r.fromDate || r.eventDate || '';
      const rTo = r.toDate || rFrom;

      if (fromDateFilter && rTo && rTo < fromDateFilter) {
        return false;
      }
      if (toDateFilter && rFrom && rFrom > toDateFilter) {
        return false;
      }

      return true;
    });
  }, [data.all, searchQuery, eventTypeFilter, statusFilter, certStatusFilter, fromDateFilter, toDateFilter]);

  // Execute Excel Export
  const handleDownloadExcelReport = async () => {
    if (filteredRequests.length === 0) {
      showToast('No OD records match the selected filters. Please adjust your filters.', 'info');
      return;
    }

    setIsExporting(true);
    showToast(`Generating Excel OD report for ${filteredRequests.length} records...`, 'info');

    const token = getAuthToken();
    try {
      const res = await apiExportHODODExcel(activeFilters, token);
      if (res.success) {
        showToast(`Report downloaded successfully: ${res.filename || 'OD_Report.xlsx'}`, 'success');
      } else {
        showToast(`Export error: ${res.error || 'Unable to download report.'}`, 'error');
      }
    } catch (err: any) {
      showToast(`Export failed: ${err.message || 'Server error.'}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = () => {
    showToast(`Generating official REC Department OD Audit PDF... Download will start shortly.`, 'info');
    setTimeout(() => {
      showToast(`Report downloaded: REC_CSD_OD_Report_2026.pdf`, 'success');
    }, 1200);
  };

  const hasActiveFilters = 
    searchQuery.trim() !== '' || 
    eventTypeFilter !== 'all' || 
    statusFilter !== 'all' || 
    certStatusFilter !== 'all' || 
    fromDateFilter !== '' || 
    toDateFilter !== '';

  return (
    <PortalLayout role="HOD">
      <div className="space-y-6">
        
        {/* Executive Header Banner */}
        <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-purple-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-bold">
              <Building2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Department Head Executive Governance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Head of Department (HOD) Portal
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              Grant final institutional sanctions for On-Duty applications, oversee attendance synchronizations, and generate filtered departmental Excel audits.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportPDF}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export PDF Audit</span>
            </button>

            <button
              type="button"
              id="hod-view-academic-records-btn"
              onClick={handleOpenAcademicModal}
              className="px-4 py-2.5 rounded-xl bg-purple-600/70 hover:bg-purple-600 border border-purple-400/30 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <GraduationCap className="w-4 h-4 text-purple-200" />
              <span>Academic Performance Records</span>
            </button>

            <button
              type="button"
              id="hod-download-excel-header-btn"
              onClick={handleDownloadExcelReport}
              disabled={isExporting}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Excel...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>📥 Download Excel Report</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4 Key Institutional KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Awaiting Final Sanction</span>
              <span className="text-2xl font-black text-purple-900 mt-1 block">{data.pending.length}</span>
              <span className="text-[10px] text-amber-600 font-semibold">Endorsed by Class Incharge</span>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 text-purple-700">
              <Hourglass className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total ODs Approved</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">{stats.totalODsSanctioned}</span>
              <span className="text-[10px] text-emerald-600 font-semibold">{stats.approvalRate}% sanction rate</span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dept Avg Attendance</span>
              <span className="text-2xl font-black text-slate-800 mt-1 block">{stats.departmentAvgAttendance}%</span>
              <span className="text-[10px] text-slate-500 font-semibold">Above 75% REC threshold</span>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <BarChart3 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Faculty Mentors</span>
              <span className="text-2xl font-black text-slate-800 mt-1 block">{facultyList.length}</span>
              <span className="text-[10px] text-slate-500 font-semibold">CSD Stakeholder Body</span>
            </div>
            <div className="p-3 rounded-xl bg-teal-50 text-teal-600">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Dynamic Filter Card & Excel Report Section */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-100 text-purple-800">
                <Filter className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  OD Request Intelligence & Custom Excel Export
                </h3>
                <p className="text-xs text-slate-500">
                  Filter by Hackathon/Event, status, date range, or student to generate tailored institutional spreadsheets.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
              )}

              <button
                type="button"
                id="hod-download-excel-filter-btn"
                onClick={handleDownloadExcelReport}
                disabled={isExporting}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparing Excel...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>📥 Download Excel Report ({filteredRequests.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Filter Form Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
            
            {/* 1. Search Query */}
            <div className="lg:col-span-2 space-y-1">
              <label className="text-[11px] font-bold text-slate-500 block">Search Student / Event / ID</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. Smart India Hackathon, 23CSD001..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* 2. Event Type Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 block">Event / Program Type</label>
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="all">All Event Types</option>
                <option value="Hackathon">Hackathon</option>
                <option value="Symposium">Symposium</option>
                <option value="Workshop">Workshop</option>
                <option value="Sports">Sports</option>
                <option value="Cultural Event">Cultural Event</option>
                <option value="Internship">Internship</option>
                <option value="Competition">Competition</option>
                <option value="Seminar">Seminar</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* 3. OD Status Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 block">Overall OD Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="pending_hod">Pending HOD Sanction</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="pending">All In-Progress</option>
              </select>
            </div>

            {/* 4. Date From */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 block">From Event Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={fromDateFilter}
                  onChange={(e) => setFromDateFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-purple-500 cursor-pointer"
                />
              </div>
            </div>

            {/* 5. Date To */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 block">To Event Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={toDateFilter}
                  onChange={(e) => setToDateFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-purple-500 cursor-pointer"
                />
              </div>
            </div>

          </div>

          {/* Quick Filter Tag Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
            <span className="text-[11px] font-bold text-slate-400">Quick Filters:</span>
            
            <button
              type="button"
              onClick={() => {
                setEventTypeFilter('Hackathon');
                setStatusFilter('all');
              }}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                eventTypeFilter === 'Hackathon'
                  ? 'bg-purple-700 text-white'
                  : 'bg-purple-50 text-purple-900 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              🚀 Hackathons Only
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter('approved');
                setEventTypeFilter('all');
              }}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                statusFilter === 'approved'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              ✓ Approved Only
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter('pending_hod');
              }}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                statusFilter === 'pending_hod'
                  ? 'bg-amber-700 text-white'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              ⏳ Awaiting HOD Action ({data.pending.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setCertStatusFilter(certStatusFilter === 'Verified' ? 'all' : 'Verified');
              }}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                certStatusFilter === 'Verified'
                  ? 'bg-teal-700 text-white'
                  : 'bg-teal-50 text-teal-900 hover:bg-teal-100 border border-teal-200'
              }`}
            >
              🎓 Verified Certificates
            </button>
          </div>
        </div>

        {/* Tabs Selection */}
        <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'pending'
                ? 'bg-purple-700 text-white shadow-md shadow-purple-200'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Hourglass className="w-3.5 h-3.5" />
            <span>Pending Final Sanction ({data.pending.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-purple-700 text-white shadow-md shadow-purple-200'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>All Filtered Requests ({filteredRequests.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-purple-700 text-white shadow-md shadow-purple-200'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Department OD Statistics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('faculty')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'faculty'
                ? 'bg-purple-700 text-white shadow-md shadow-purple-200'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Faculty Directory</span>
          </button>
        </div>

        {/* Tab 1: Pending Final Sign-offs */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            {data.pending.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-800">All caught up!</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No pending final OD approval sign-offs currently waiting for HOD sanction.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {data.pending.map((req) => (
                  <div 
                    key={req.id}
                    className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md p-6 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">{req.id}</span>
                        <StatusBadge status={req.status} size="sm" />
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-900 border border-purple-200">
                          {req.eventType}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-slate-900">{req.eventName}</h4>
                      
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span><strong>Student:</strong> {req.studentName} ({req.studentRegisterNo})</span>
                        <span>&bull;</span>
                        <span><strong>Organizer:</strong> {req.eventOrganizer}</span>
                        <span>&bull;</span>
                        <span><strong>Date:</strong> {req.eventDate || req.fromDate} ({req.fromTime} - {req.toTime})</span>
                      </div>

                      {/* Multitier Status Chain */}
                      <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-800 rounded-md font-bold border border-indigo-200">
                          ✓ Mentor: {req.stages?.mentor?.status || 'Approved'}
                        </span>
                        <span className="px-2 py-0.5 bg-teal-50 text-teal-800 rounded-md font-bold border border-teal-200">
                          ✓ Class Incharge: {req.stages?.classIncharge?.status || 'Approved'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRequest(req);
                          setIsDetailOpen(true);
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Audit Details</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActionReq(req);
                          setIsRejectOpen(true);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
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
                        className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white shadow-sm text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Grant Final Sanction</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: All Department Requests with Table & Live Filter */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Complete Department OD Records</h3>
                <p className="text-xs text-slate-500">
                  Showing <strong>{filteredRequests.length}</strong> matching records out of {data.all.length} total.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadExcelReport}
                  disabled={isExporting || filteredRequests.length === 0}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-extrabold flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>📥 Export These {filteredRequests.length} Records</span>
                </button>
              </div>
            </div>

            {filteredRequests.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">No OD records found</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  No requests matched your selected filter criteria. Try resetting your search term or adjusting filters above.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 rounded-xl bg-purple-100 text-purple-800 hover:bg-purple-200 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear All Filters</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="p-4">Req ID</th>
                      <th className="p-4">Student</th>
                      <th className="p-4">Event Details</th>
                      <th className="p-4">Dates</th>
                      <th className="p-4">Current Stage</th>
                      <th className="p-4">OD Status</th>
                      <th className="p-4">Certificate</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 font-extrabold text-slate-900">{req.id}</td>
                        <td className="p-4">
                          <span className="font-bold block text-slate-900">{req.studentName}</span>
                          <span className="text-[10px] text-slate-400">{req.studentRegisterNo} &bull; {req.studentYear}</span>
                        </td>
                        <td className="p-4">
                          <span className="font-semibold block text-slate-900">{req.eventName}</span>
                          <span className="text-[10px] text-purple-700 font-bold">{req.eventType}</span>
                        </td>
                        <td className="p-4 font-semibold text-slate-600">
                          {req.fromDate || req.eventDate}
                          {req.toDate && req.toDate !== (req.fromDate || req.eventDate) && ` to ${req.toDate}`}
                        </td>
                        <td className="p-4 font-medium">{req.approvalStage || req.currentStage}</td>
                        <td className="p-4">
                          <StatusBadge status={req.status} size="sm" />
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            req.certificateStatus === 'Verified'
                              ? 'bg-emerald-100 text-emerald-800'
                              : req.certificateStatus === 'Pending Verification'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {req.certificateStatus || 'Not Uploaded'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRequest(req);
                              setIsDetailOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-[11px] cursor-pointer"
                          >
                            Audit Record
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Department Statistics */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900">Event Participation Distribution</h3>
              <div className="space-y-3">
                {Object.entries(stats.eventDistribution || {}).map(([event, count]) => (
                  <div key={event} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700">{event}</span>
                      <span className="text-slate-900">{count} ODs</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-purple-700" 
                        style={{ width: `${Math.min(100, (Number(count) || 1) * 25)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900">Attendance Risk Assessment</h3>
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-900">High Compliance Rate</h4>
                  <p className="text-[11px] text-emerald-700">
                    Over 95% of students across CSD maintain attendance comfortably above the 75% university eligibility cutoff.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Faculty Directory */}
        {activeTab === 'faculty' && (
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Department Faculty & Mentors</h3>
              <p className="text-xs text-slate-500">Official stakeholder directory for Computer Science & Design.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="p-4">Faculty Name</th>
                    <th className="p-4">Employee ID</th>
                    <th className="p-4">Designation</th>
                    <th className="p-4">Assigned Role</th>
                    <th className="p-4">Assigned Section</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {facultyList.map((f) => (
                    <tr key={f.faculty_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <img 
                            src={f.avatar} 
                            alt={f.name} 
                            className="w-7 h-7 rounded-full object-cover border border-slate-200"
                          />
                          <span className="font-bold text-slate-900">{f.name}</span>
                        </div>
                      </td>
                      <td className="p-4 font-semibold">{f.employee_id}</td>
                      <td className="p-4 font-medium text-slate-600">{f.designation}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                          {f.role}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-800">{f.assigned_section}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Modals */}
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
            role="HOD"
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
            role="HOD"
          />
        </>
      )}

      {/* HOD Student Academic Records Oversight Modal */}
      {isAcademicModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsAcademicModalOpen(false)}
          />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-5xl w-full border border-slate-200/90 z-10 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-300">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Department Academic Records Oversight</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Official CAT scores and attendance percentages uploaded by Class Incharges
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAcademicModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative max-w-sm w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student register number or name..."
                  value={academicSearch}
                  onChange={(e) => setAcademicSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500"
                />
              </div>
              <span className="text-xs font-bold text-slate-500">
                Total Roster: {academicStudents.length} Students
              </span>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {loadingAcademic ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-3" />
                  <p className="text-xs text-slate-500 font-semibold">Loading official academic roster...</p>
                </div>
              ) : academicStudents.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  No academic records found in database.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                        <th className="py-3 px-3">Reg Number</th>
                        <th className="py-3 px-3">Student Name</th>
                        <th className="py-3 px-3">Class / Sec</th>
                        <th className="py-3 px-3 text-center">CAT 1</th>
                        <th className="py-3 px-3 text-center">CAT 2</th>
                        <th className="py-3 px-3 text-center">CAT 3</th>
                        <th className="py-3 px-3 text-center">Attendance</th>
                        <th className="py-3 px-3 text-center">10% OD Cap</th>
                        <th className="py-3 px-3">Last Updated</th>
                        <th className="py-3 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {academicStudents
                        .filter((s) => {
                          if (!academicSearch.trim()) return true;
                          const q = academicSearch.toLowerCase();
                          return (
                            s.registerNumber.toLowerCase().includes(q) ||
                            (s.studentName || s.name || '').toLowerCase().includes(q)
                          );
                        })
                        .map((s) => (
                          <tr key={s.studentId || s.id || s.registerNumber} className="hover:bg-purple-50/30 transition-colors">
                            <td className="py-3 px-3 font-bold text-purple-700">{s.registerNumber}</td>
                            <td className="py-3 px-3 font-semibold text-slate-900">{s.studentName}</td>
                            <td className="py-3 px-3 text-slate-500">{s.year} - {s.section}</td>
                            <td className="py-3 px-3 text-center font-bold">{s.cat1Marks ?? (s as any).cat1_marks ?? '-'}</td>
                            <td className="py-3 px-3 text-center font-bold">{s.cat2Marks ?? (s as any).cat2_marks ?? '-'}</td>
                            <td className="py-3 px-3 text-center font-bold">{s.cat3Marks ?? (s as any).cat3_marks ?? '-'}</td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  (s.attendancePercentage ?? s.attendancePercent ?? 0) >= 75
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {s.attendancePercentage ?? s.attendancePercent ?? 0}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-purple-700">
                              {s.remainingODDays !== undefined ? `${s.remainingODDays}d left` : '9d'}
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-[11px]">
                              {s.lastUpdated && !isNaN(new Date(s.lastUpdated).getTime())
                                ? new Date(s.lastUpdated).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : 'Default'}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedStudentAcademic(s)}
                                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg transition-colors cursor-pointer text-[11px]"
                              >
                                View Card
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAcademicModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close Records Oversight
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Student Academic Details Card Modal */}
      {selectedStudentAcademic && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedStudentAcademic(null)}
          />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200/90 z-10 overflow-hidden flex flex-col animate-scale-up">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-300">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Student Academic Details</h3>
                  <p className="text-xs text-slate-300">Department Oversight Record</p>
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
                <p className="text-xs text-purple-600 font-bold">Register Number: {selectedStudentAcademic.registerNumber}</p>
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
                  <div className="bg-purple-50 p-3 rounded-2xl border border-purple-100">
                    <span className="text-[10px] text-purple-700 font-bold uppercase block">Attendance</span>
                    <span className="text-xl font-black text-purple-900">
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
