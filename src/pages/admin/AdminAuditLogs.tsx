import React, { useState, useEffect } from 'react';
import { 
  History, Search, ShieldCheck, User, Calendar, 
  RefreshCw, Filter, Clock, FileText, CheckCircle2
} from 'lucide-react';
import { apiGetAdminAuditLogs } from '../../services/api';
import { AdminAuditLog } from '../../types/types';
import { useToast } from '../../components/Toast';

export const AdminAuditLogs: React.FC = () => {
  const { showToast } = useToast();

  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await apiGetAdminAuditLogs(100);
      if (res && res.success) {
        setLogs(res.data || []);
      } else {
        showToast('Failed to load system audit trails', 'error');
      }
    } catch {
      showToast('Network error loading audit logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      !search ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.details?.toLowerCase().includes(search.toLowerCase()) ||
      log.user_id?.toLowerCase().includes(search.toLowerCase());
    const matchesAction = 
      !filterAction || 
      log.action?.toLowerCase().includes(filterAction.toLowerCase());
    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-800">
              <History className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">System Audit & Governance Logs</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Immutable tracking of user modifications, status toggles, academic roster updates, Excel syncs, and system configuration changes.
          </p>
        </div>

        <button
          type="button"
          onClick={loadLogs}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Audit Trail</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action, operator ID, or affected record..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
          >
            <option value="">All Action Categories</option>
            <option value="USER">User Management</option>
            <option value="ACADEMIC">Academic Updates</option>
            <option value="SETTINGS">System Settings</option>
            <option value="AUTH">Authentication</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Operator / User</th>
                <th className="py-3 px-4">Administrative Action</th>
                <th className="py-3 px-4">Affected Record & Details</th>
                <th className="py-3 px-4 text-right">Security Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Querying immutable audit logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No administrative audit activities logged yet.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-600 font-mono whitespace-nowrap">
                      {log.created_at || 'Recently'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-slate-900 text-amber-400 font-black text-[10px] flex items-center justify-center shrink-0">
                          AD
                        </div>
                        <span className="font-bold text-slate-800">{log.user_id || 'System Admin'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-md">
                      <p className="font-semibold text-slate-800 leading-tight">{log.details}</p>
                      {log.changes && (
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                          {JSON.stringify(log.changes)}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
