import React, { useState, useEffect } from 'react';
import { 
  Award, Search, Filter, Eye, CheckCircle2, 
  Clock, XCircle, AlertCircle, RefreshCw, Calendar, 
  FileText, ExternalLink
} from 'lucide-react';
import { apiGetAdminCertificates } from '../../services/api';
import { CertificatePreviewModal } from '../../components/CertificatePreviewModal';
import { useToast } from '../../components/Toast';

export const AdminCertificates: React.FC = () => {
  const { showToast } = useToast();

  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');

  // Preview Modal
  const [selectedCert, setSelectedCert] = useState<any | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const loadCertificates = async () => {
    try {
      setLoading(true);
      const res = await apiGetAdminCertificates({
        search: search || undefined,
        status: status || undefined,
        department: department || undefined
      });
      if (res && res.success) {
        setCertificates(res.data || []);
      }
    } catch {
      showToast('Failed to load certificates registry', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertificates();
  }, [status, department]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadCertificates();
  };

  const handleOpenPreview = (cert: any) => {
    setSelectedCert(cert);
    setIsPreviewOpen(true);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-violet-50 text-violet-600">
              <Award className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Certificate Repository</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            System-level audit of all student post-event participation and merit certificates.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
            Total Certificates: {certificates.length}
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student name, register number, or event..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Verification Statuses</option>
              <option value="Verified">Verified</option>
              <option value="Pending Verification">Pending Verification</option>
              <option value="Rejected">Rejected</option>
            </select>

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

            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Certificates Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[1050px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4 min-w-[150px] whitespace-nowrap">Student</th>
                <th className="py-3.5 px-4 min-w-[240px]">Event Details</th>
                <th className="py-3.5 px-4 min-w-[140px] whitespace-nowrap">Submitted Date</th>
                <th className="py-3.5 px-4 min-w-[160px] whitespace-nowrap">Verification Status</th>
                <th className="py-3.5 px-4 min-w-[140px] whitespace-nowrap">Verified By</th>
                <th className="py-3.5 px-4 min-w-[140px] whitespace-nowrap">Verification Date</th>
                <th className="py-3.5 px-4 min-w-[120px] text-right whitespace-nowrap">Inspect Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading certificate repository...
                  </td>
                </tr>
              ) : certificates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No certificates found matching criteria.
                  </td>
                </tr>
              ) : (
                certificates.map((cert) => (
                  <tr key={cert.id || cert._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 min-w-[150px]">
                      <p className="font-bold text-slate-800 whitespace-nowrap">{cert.studentName}</p>
                      <p className="text-[11px] font-mono text-slate-400 whitespace-nowrap">{cert.studentRegNo || cert.studentRegisterNo}</p>
                    </td>
                    <td className="py-3.5 px-4 min-w-[240px]">
                      <p className="font-bold text-slate-700 leading-snug break-words">{cert.eventName}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 break-words">{cert.certificateName || 'Proof PDF'}</p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap min-w-[140px]">
                      {cert.uploadDate || cert.submittedAt || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 min-w-[160px] whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        cert.status === 'Verified' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        cert.status === 'Pending Verification' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {cert.status === 'Verified' ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> :
                         cert.status === 'Pending Verification' ? <Clock className="w-3 h-3 text-amber-600" /> :
                         <XCircle className="w-3 h-3 text-rose-600" />}
                        {cert.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap min-w-[140px]">
                      {cert.verifiedBy || 'Pending Review'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px] whitespace-nowrap min-w-[140px]">
                      {cert.verifiedDate || cert.verifiedAt || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right min-w-[120px] whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenPreview(cert)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-violet-600 hover:text-white text-slate-700 font-bold transition-all text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                        <span>View Certificate</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Certificate Preview Modal */}
      {selectedCert && (
        <CertificatePreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          certificate={selectedCert}
        />
      )}

    </div>
  );
};
