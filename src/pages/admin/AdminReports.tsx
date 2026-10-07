import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Download, FileSpreadsheet, Filter, 
  Calendar, Layers, CheckCircle2, Clock, XCircle, 
  TrendingUp, Building2, RefreshCw, Sparkles
} from 'lucide-react';
import { 
  apiGetAdminReportsSummary, 
  apiDownloadAdminReportExcel 
} from '../../services/api';
import { useToast } from '../../components/Toast';

export const AdminReports: React.FC = () => {
  const { showToast } = useToast();

  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Export filters
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadSummary = async () => {
    try {
      setLoading(true);
      const res = await apiGetAdminReportsSummary();
      if (res && res.success) {
        setSummary(res.data);
      } else {
        showToast('Failed to load reports summary', 'error');
      }
    } catch {
      showToast('Network error loading reports', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

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
        showToast('Excel report generated and downloaded successfully!', 'success');
      } else {
        showToast(res?.error || 'Failed to download Excel report', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error exporting Excel file', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const s = summary || {
    totalODRequests: 0,
    totalApproved: 0,
    totalPending: 0,
    totalRejected: 0,
    totalVerifiedCertificates: 0,
    departmentBreakdown: {},
    statusBreakdown: {},
    classBreakdown: {},
    eventBreakdown: {}
  };

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
            Aggregated analytics across student applications, approval performance, and Excel audit export.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportExcel}
          disabled={downloading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <FileSpreadsheet className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
          <span>{downloading ? 'Generating Excel Workbook...' : 'Export Real Data to Excel (.xlsx)'}</span>
        </button>
      </div>

      {/* Filter Parameters For Excel Export */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-2">
        <div className="flex items-center justify-between pb-1">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Export Scope Filters
          </span>
          <span className="text-[11px] text-slate-400">Excel contains real database row entries</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
          >
            <option value="">All Departments</option>
            <option value="Computer Science and Design">Computer Science and Design</option>
            <option value="Computer Science and Engineering">Computer Science and Engineering</option>
            <option value="Information Technology">Information Technology</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            title="From OD Date"
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            title="To OD Date"
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Total ODs</p>
          <p className="text-xl font-black text-slate-900 mt-1">{s.totalODRequests}</p>
          <span className="text-[10px] text-slate-400 font-medium">All applications</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
          <p className="text-[10px] font-bold text-emerald-600 uppercase">Approved ODs</p>
          <p className="text-xl font-black text-emerald-950 mt-1">{s.totalApproved}</p>
          <span className="text-[10px] text-emerald-600 font-medium">Sanctioned</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
          <p className="text-[10px] font-bold text-amber-600 uppercase">In Pipeline</p>
          <p className="text-xl font-black text-amber-950 mt-1">{s.totalPending}</p>
          <span className="text-[10px] text-amber-600 font-medium">Pending Review</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
          <p className="text-[10px] font-bold text-rose-600 uppercase">Rejected</p>
          <p className="text-xl font-black text-rose-950 mt-1">{s.totalRejected}</p>
          <span className="text-[10px] text-rose-600 font-medium">Declined</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-[10px] font-bold text-violet-600 uppercase">Verified Certs</p>
          <p className="text-xl font-black text-violet-950 mt-1">{s.totalVerifiedCertificates}</p>
          <span className="text-[10px] text-violet-600 font-medium">Post-Event Verified</span>
        </div>
      </div>

      {/* Analytical Breakdown Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Department-wise Report */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Department-Wise OD Analytics
            </h3>
            <span className="text-[11px] text-slate-400">Total Requests</span>
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
                {Object.entries(s.departmentBreakdown).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-slate-400">No records found.</td>
                  </tr>
                ) : (
                  Object.entries(s.departmentBreakdown).map(([dept, rawCount]: any) => {
                    const count = typeof rawCount === 'object' && rawCount !== null ? (rawCount.total ?? rawCount.count ?? 0) : rawCount;
                    return (
                      <tr key={dept}>
                        <td className="py-2.5 text-slate-800 font-semibold">{dept}</td>
                        <td className="py-2.5 text-right font-bold text-slate-900">{count}</td>
                      </tr>
                    );
                  })
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
            <span className="text-[11px] text-slate-400">Total Requests</span>
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
                {Object.entries(s.statusBreakdown).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-slate-400">No records found.</td>
                  </tr>
                ) : (
                  Object.entries(s.statusBreakdown).map(([st, count]: any) => (
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

        {/* Class-wise Report */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Class & Section OD Breakdown
            </h3>
            <span className="text-[11px] text-slate-400">Applications</span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold text-[10px] uppercase">
                  <th className="py-2">Class Section</th>
                  <th className="py-2 text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {Object.entries(s.classBreakdown).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-slate-400">No records found.</td>
                  </tr>
                ) : (
                  Object.entries(s.classBreakdown).map(([cls, count]: any) => (
                    <tr key={cls}>
                      <td className="py-2.5 text-slate-800 font-semibold">{cls}</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">{count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Event-wise Report */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Event Popularity Breakdown
            </h3>
            <span className="text-[11px] text-slate-400">Participants</span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold text-[10px] uppercase">
                  <th className="py-2">Event Name</th>
                  <th className="py-2 text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {Object.entries(s.eventBreakdown).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-slate-400">No records found.</td>
                  </tr>
                ) : (
                  Object.entries(s.eventBreakdown).map(([ev, count]: any) => (
                    <tr key={ev}>
                      <td className="py-2.5 text-slate-800 font-semibold truncate max-w-[200px]">{ev}</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">{count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};
