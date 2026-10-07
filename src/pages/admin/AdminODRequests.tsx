import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  FileSpreadsheet, Search, Filter, Eye, Calendar, 
  MapPin, Clock, CheckCircle2, XCircle, AlertCircle, 
  RefreshCw, Building2, User
} from 'lucide-react';
import { apiGetAdminODRequests, apiGetAdminODRequestDetail } from '../../services/api';
import { ODRequest } from '../../types/types';
import { StatusBadge } from '../../components/StatusBadge';
import { ODDetailModal } from '../../components/ODDetailModal';
import { useToast } from '../../components/Toast';

export const AdminODRequests: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const [requests, setRequests] = useState<ODRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [stage, setStage] = useState('');
  const [department, setDepartment] = useState('');
  const [certificateStatus, setCertificateStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Selected request for modal
  const [selectedRequest, setSelectedRequest] = useState<ODRequest | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await apiGetAdminODRequests({
        search: search || undefined,
        status: status || undefined,
        stage: stage || undefined,
        department: department || undefined,
        certificate_status: certificateStatus || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined
      });
      if (res && res.success) {
        setRequests(res.data || []);
      }
    } catch {
      showToast('Failed to load OD applications pipeline', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [status, stage, department, certificateStatus, fromDate, toDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadRequests();
  };

  const handleOpenDetail = (req: ODRequest) => {
    setSelectedRequest(req);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Institutional OD Pipeline</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            System-wide audit view of all OD requests across all departments, years, and 4-tier approval stages.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
            Total Records: {requests.length}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by student name, reg no, event name, or venue..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer self-start sm:self-auto"
            >
              Search
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending (Any)</option>
              <option value="Mentor Approved">Mentor Approved</option>
              <option value="Class Incharge Approved">Class Incharge Approved</option>
              <option value="Approved">Fully Approved</option>
              <option value="Rejected">Rejected</option>
            </select>

            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Approval Stages</option>
              <option value="Mentor">Mentor Stage</option>
              <option value="Class Incharge">Class Incharge Stage</option>
              <option value="HOD">HOD Stage</option>
              <option value="Approved">Completed / Approved</option>
              <option value="Rejected">Rejected</option>
            </select>

            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Departments</option>
              <option value="Computer Science and Design">CSD</option>
              <option value="Computer Science and Engineering">CSE</option>
              <option value="Information Technology">IT</option>
            </select>

            <select
              value={certificateStatus}
              onChange={(e) => setCertificateStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="">Certificate Status</option>
              <option value="Verified">Verified</option>
              <option value="Pending Verification">Pending Verification</option>
              <option value="Not Uploaded">Not Uploaded</option>
            </select>

            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              title="From OD Date"
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
            />

            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              title="To OD Date"
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
            />
          </div>
        </form>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Department & Class</th>
                <th className="py-3 px-4">Event Details</th>
                <th className="py-3 px-4">OD Dates</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Approval Stage</th>
                <th className="py-3 px-4">Overall Status</th>
                <th className="py-3 px-4">Certificate</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Querying OD pipeline applications...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No OD requests match the selected filters.
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-800">{req.studentName}</p>
                      <p className="text-[11px] font-mono text-slate-400">{req.studentRegisterNo}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-800 font-semibold">{req.department}</p>
                      <p className="text-[10px] text-slate-400">{req.year} • Sec {req.section}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-800 max-w-[180px] truncate">{req.eventName}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{req.venue}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {req.fromDate} to {req.toDate}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {req.numberOfDays} {req.numberOfDays === 1 ? 'day' : 'days'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {req.approvalStage || req.currentStage}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        req.certificateStatus === 'Verified' ? 'bg-emerald-100 text-emerald-800' :
                        req.certificateStatus === 'Pending Verification' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {req.certificateStatus || 'Not Uploaded'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(req)}
                        title="View complete application & approval timeline"
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-amber-500 hover:text-white text-slate-700 font-bold transition-all text-[11px] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
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

      {/* OD Request Detail Modal (View Only - No Approval Bypass) */}
      {selectedRequest && (
        <ODDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          request={selectedRequest}
          faculty={undefined} // Undefined faculty prevents action buttons, keeping it strictly view-only!
        />
      )}

    </div>
  );
};
