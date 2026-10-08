import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, FileSpreadsheet, Filter, 
  Calendar, Layers, CheckCircle2, Clock, XCircle, 
  TrendingUp, Building2, RefreshCw, Sparkles, Eye, X, User
} from 'lucide-react';
import { 
  apiGetAdminReportsSummary, 
  apiGetAdminODRequests,
  apiDownloadAdminReportExcel 
} from '../../services/api';
import { ODRequest } from '../../types/types';
import { StatusBadge } from '../../components/StatusBadge';
import { ODDetailModal } from '../../components/ODDetailModal';
import { useToast } from '../../components/Toast';

export const AdminReports: React.FC = () => {
  const { showToast } = useToast();

  const [allRequests, setAllRequests] = useState<ODRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Export & Table Scope Filters
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Selected request for inspection modal
  const [selectedRequest, setSelectedRequest] = useState<ODRequest | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const reqRes = await apiGetAdminODRequests();
      if (reqRes && reqRes.success) {
        setAllRequests(reqRes.data || []);
      }
    } catch {
      showToast('Network error loading reports data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered requests computed live across all 4 scope filters
  const filteredRequests = useMemo(() => {
    return allRequests.filter((req) => {
      // 1. Department filter
      const reqDept = (req.department || req.studentDepartment || '').trim();
      if (department) {
        if (reqDept.toLowerCase() !== department.toLowerCase() && 
            !reqDept.toLowerCase().includes(department.toLowerCase()) &&
            !department.toLowerCase().includes(reqDept.toLowerCase())) {
          return false;
        }
      }

      // 2. Status filter
      const reqStatus = (req.status || '').trim();
      if (status) {
        if (status === 'Pending') {
          if (!['Pending', 'Mentor Approved', 'Class Incharge Approved'].includes(reqStatus)) {
            return false;
          }
        } else if (status === 'Approved') {
          if (!reqStatus.includes('Approved') || reqStatus.includes('Rejected')) {
            return false;
          }
        } else if (status === 'Rejected') {
          if (!reqStatus.includes('Rejected') && !reqStatus.includes('Declined')) {
            return false;
          }
        } else if (reqStatus.toLowerCase() !== status.toLowerCase()) {
          return false;
        }
      }

      // 3. From Date filter (event / OD dates on or after From Date)
      const odStart = req.fromDate || req.eventDate || '';
      const odEnd = req.toDate || req.fromDate || req.eventDate || '';
      if (fromDate) {
        if (odEnd && odEnd < fromDate) {
          return false;
        }
      }

      // 4. To Date filter (event / OD dates on or before To Date)
      if (toDate) {
        if (odStart && odStart > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [allRequests, department, status, fromDate, toDate]);

  // Dynamic summary analytics derived live from the filtered scope
  const summary = useMemo(() => {
    const totalODRequests = filteredRequests.length;
    const totalApproved = filteredRequests.filter(r => (r.status || '').includes('Approved') && !(r.status || '').includes('Rejected')).length;
    const totalPending = filteredRequests.filter(r => ['Pending', 'Mentor Approved', 'Class Incharge Approved'].includes(r.status || '')).length;
    const totalRejected = filteredRequests.filter(r => (r.status || '').includes('Rejected')).length;
    const totalVerifiedCertificates = filteredRequests.filter(r => String(r.certificateStatus || '').toLowerCase() === 'verified').length;

    const deptCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    const classCounts: Record<string, number> = {};
    const eventCounts: Record<string, number> = {};

    filteredRequests.forEach((r) => {
      const d = r.department || r.studentDepartment || 'Computer Science and Design';
      deptCounts[d] = (deptCounts[d] || 0) + 1;

      const st = r.status || 'Pending';
      statusCounts[st] = (statusCounts[st] || 0) + 1;

      const yr = r.year || r.studentYear || 'III Year';
      const sec = r.section || r.studentSection || 'A';
      const cls = `${yr} Sec ${sec}`;
      classCounts[cls] = (classCounts[cls] || 0) + 1;

      const ev = r.eventName || 'Academic OD';
      eventCounts[ev] = (eventCounts[ev] || 0) + 1;
    });

    return {
      totalODRequests,
      totalApproved,
      totalPending,
      totalRejected,
      totalVerifiedCertificates,
      departmentBreakdown: deptCounts,
      statusBreakdown: statusCounts,
      classBreakdown: classCounts,
      eventBreakdown: eventCounts,
    };
  }, [filteredRequests]);

  const handleClearFilters = () => {
    setDepartment('');
    setStatus('');
    setFromDate('');
    setToDate('');
  };

  const hasActiveFilters = Boolean(department || status || fromDate || toDate);

  const handleExportExcel = async () => {
    setDownloading(true);
    try {
      const params: Record<string, string> = {};
      if (department) params.department = department;
      if (status) params.status = status;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const res = await apiDownloadAdminReportExcel(params);
      if (res && res.success) {
        showToast(`Excel workbook exported successfully (${filteredRequests.length} records)!`, 'success');
      } else {
        showToast(res?.error || 'Failed to download Excel report', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error exporting Excel file', 'error');
    } finally {
      setDownloading(false);
    }
  };

  // Distinct department list
  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    allRequests.forEach(r => {
      const d = r.department || r.studentDepartment;
      if (d) set.add(d);
    });
    if (set.size === 0) {
      set.add('Computer Science and Design');
      set.add('Computer Science and Engineering');
      set.add('Information Technology');
    }
    return Array.from(set);
  }, [allRequests]);

  return (
    <div className="space-y-6">
      
      {/* Header & Export Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Institutional System Reports</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Live filterable student OD records, analytics breakdown, and matching Excel workbook export.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportExcel}
          disabled={downloading || filteredRequests.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <FileSpreadsheet className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
          <span>{downloading ? 'Generating Excel...' : `Export Filtered to Excel (${filteredRequests.length})`}</span>
        </button>
      </div>

      {/* Filter Parameters For Website Table & Excel Export */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Export Scope Filters
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500 font-medium">
              Showing <strong className="text-slate-800">{filteredRequests.length}</strong> of {allRequests.length} records
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Department Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Departments</option>
              {availableDepartments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending (All Pipeline)</option>
              <option value="Approved">Approved (All Sanctions)</option>
              <option value="Rejected">Rejected</option>
              <option value="HOD Approved">HOD Approved</option>
              <option value="HOD Rejected">HOD Rejected</option>
              <option value="Mentor Approved">Mentor Approved</option>
              <option value="Class Incharge Approved">Class Incharge Approved</option>
              <option value="HOD Approved - Certificate Pending">HOD Approved - Certificate Pending</option>
              <option value="Certificate Submitted">Certificate Submitted</option>
            </select>
          </div>

          {/* From Date Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              title="From OD Date"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* To Date Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              title="To OD Date"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Scope Filtered Student OD Applications Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Filtered Student OD Applications Table
            </h2>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            {filteredRequests.length} Matched Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3 whitespace-nowrap">Student</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Department &amp; Class</th>
                <th className="py-2.5 px-3">Event Details</th>
                <th className="py-2.5 px-3 whitespace-nowrap">OD Dates</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Duration</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Approval Stage</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Overall Status</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Certificate</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading scoped OD records...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-500">No OD applications match the selected scope filters.</p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="mt-2 text-xs text-amber-600 hover:text-amber-700 font-bold underline cursor-pointer"
                      >
                        Reset filters to view all records
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <p className="font-bold text-slate-800 text-xs">{req.studentName}</p>
                      <p className="text-[10px] font-mono text-slate-400">{req.studentRegisterNo}</p>
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="text-slate-800 font-semibold text-[11px] leading-tight line-clamp-1 max-w-[140px]" title={req.department || req.studentDepartment}>
                        {req.department || req.studentDepartment}
                      </p>
                      <p className="text-[10px] text-slate-400 whitespace-nowrap">
                        {(req.year || req.studentYear) ? `Year ${req.year || req.studentYear}` : ''} {(req.section || req.studentSection) ? `• Sec ${req.section || req.studentSection}` : ''}
                      </p>
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-slate-800 text-xs leading-tight line-clamp-1 max-w-[200px]" title={req.eventName}>
                        {req.eventName}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[180px]" title={req.venue}>
                        {req.venue}
                      </p>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap text-[11px]">
                      {req.fromDate || req.eventDate} to {req.toDate || req.fromDate || req.eventDate}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap text-xs">
                      {req.numberOfDays || 1} {(req.numberOfDays || 1) === 1 ? 'day' : 'days'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {req.approvalStage || req.currentStage || 'Mentor'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <StatusBadge status={req.status} size="sm" />
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        req.certificateStatus === 'Verified' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        req.certificateStatus === 'Pending Verification' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {req.certificateStatus || 'Not Uploaded'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRequest(req);
                          setIsDetailModalOpen(true);
                        }}
                        title="View application details"
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-500 hover:text-white text-slate-700 font-bold transition-all text-[11px] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scope Filtered KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Filtered ODs</p>
          <p className="text-xl font-black text-slate-900 mt-1">{summary.totalODRequests}</p>
          <span className="text-[10px] text-slate-400 font-medium">In selected scope</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
          <p className="text-[10px] font-bold text-emerald-600 uppercase">Approved ODs</p>
          <p className="text-xl font-black text-emerald-950 mt-1">{summary.totalApproved}</p>
          <span className="text-[10px] text-emerald-600 font-medium">Sanctioned</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
          <p className="text-[10px] font-bold text-amber-600 uppercase">In Pipeline</p>
          <p className="text-xl font-black text-amber-950 mt-1">{summary.totalPending}</p>
          <span className="text-[10px] text-amber-600 font-medium">Pending Review</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
          <p className="text-[10px] font-bold text-rose-600 uppercase">Rejected</p>
          <p className="text-xl font-black text-rose-950 mt-1">{summary.totalRejected}</p>
          <span className="text-[10px] text-rose-600 font-medium">Declined</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-[10px] font-bold text-violet-600 uppercase">Verified Certs</p>
          <p className="text-xl font-black text-violet-950 mt-1">{summary.totalVerifiedCertificates}</p>
          <span className="text-[10px] text-violet-600 font-medium">Post-Event Verified</span>
        </div>
      </div>

      {/* Analytical Breakdown Tables for Filtered Scope */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Department-wise Report */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Department-Wise Distribution
            </h3>
            <span className="text-[11px] text-slate-400">Filtered Count</span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold text-[10px] uppercase">
                  <th className="py-2">Department</th>
                  <th className="py-2 text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {Object.entries(summary.departmentBreakdown).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-slate-400">No records in current scope.</td>
                  </tr>
                ) : (
                  Object.entries(summary.departmentBreakdown).map(([dept, count]: any) => (
                    <tr key={dept}>
                      <td className="py-2.5 text-slate-800 font-semibold">{dept}</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">{count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Status Report */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Approval Status Distribution
            </h3>
            <span className="text-[11px] text-slate-400">Filtered Count</span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold text-[10px] uppercase">
                  <th className="py-2">Current Status</th>
                  <th className="py-2 text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {Object.entries(summary.statusBreakdown).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-slate-400">No records in current scope.</td>
                  </tr>
                ) : (
                  Object.entries(summary.statusBreakdown).map(([st, count]: any) => (
                    <tr key={st}>
                      <td className="py-2.5 text-slate-800 font-semibold">{st}</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">{count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Detail Modal */}
      {selectedRequest && (
        <ODDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          request={selectedRequest}
          faculty={undefined}
        />
      )}

    </div>
  );
};
