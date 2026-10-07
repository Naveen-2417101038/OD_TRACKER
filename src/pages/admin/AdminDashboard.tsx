import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, GraduationCap, UserCheck, Building2, 
  FileSpreadsheet, Clock, CheckCircle2, XCircle, 
  Award, ArrowUpRight, BarChart3, TrendingUp, 
  Layers, RefreshCw, AlertCircle, ShieldAlert, Sparkles
} from 'lucide-react';
import { apiGetAdminStats } from '../../services/api';
import { AdminStats, ODRequest } from '../../types/types';
import { StatusBadge } from '../../components/StatusBadge';
import { useToast } from '../../components/Toast';

export const AdminDashboard: React.FC = () => {
  const { showToast } = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await apiGetAdminStats();
      if (res && res.success && res.data) {
        setStats(res.data);
      } else {
        showToast(res?.error || 'Failed to load live admin statistics', 'error');
      }
    } catch {
      showToast('Network error loading dashboard statistics', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-3">
        <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Querying live MongoDB system metrics...</p>
      </div>
    );
  }

  const s = stats || {
    totalStudents: 0,
    totalMentors: 0,
    totalClassIncharges: 0,
    totalHODs: 0,
    totalODRequests: 0,
    pendingODRequests: 0,
    approvedODRequests: 0,
    rejectedODRequests: 0,
    pendingCertificates: 0,
    statusDistribution: {},
    monthlyDistribution: {},
    departmentDistribution: {},
    recentActivities: [],
    recentODRequests: []
  };

  const statCards = [
    {
      title: 'Total Students',
      value: s.totalStudents,
      subtitle: 'Enrolled across departments',
      icon: GraduationCap,
      color: 'from-blue-500 to-indigo-600',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      link: '/admin/students'
    },
    {
      title: 'Total Mentors',
      value: s.totalMentors,
      subtitle: 'Faculty first-line reviewers',
      icon: UserCheck,
      color: 'from-indigo-500 to-purple-600',
      textColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      link: '/admin/faculty'
    },
    {
      title: 'Class Incharges',
      value: s.totalClassIncharges,
      subtitle: 'Section coordinators',
      icon: Users,
      color: 'from-teal-500 to-emerald-600',
      textColor: 'text-teal-600',
      bgColor: 'bg-teal-50',
      link: '/admin/faculty'
    },
    {
      title: 'Total HODs',
      value: s.totalHODs,
      subtitle: 'Department executive heads',
      icon: Building2,
      color: 'from-purple-500 to-fuchsia-600',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      link: '/admin/faculty'
    },
    {
      title: 'Total OD Requests',
      value: s.totalODRequests,
      subtitle: 'All historical applications',
      icon: FileSpreadsheet,
      color: 'from-slate-700 to-slate-900',
      textColor: 'text-slate-800',
      bgColor: 'bg-slate-100',
      link: '/admin/od-requests'
    },
    {
      title: 'Pending OD Requests',
      value: s.pendingODRequests,
      subtitle: 'Currently in review pipeline',
      icon: Clock,
      color: 'from-amber-500 to-orange-600',
      textColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      link: '/admin/od-requests?status=Pending'
    },
    {
      title: 'Approved Requests',
      value: s.approvedODRequests,
      subtitle: 'Sanctioned with attendance credits',
      icon: CheckCircle2,
      color: 'from-emerald-500 to-teal-600',
      textColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      link: '/admin/od-requests?status=Approved'
    },
    {
      title: 'Rejected Requests',
      value: s.rejectedODRequests,
      subtitle: 'Declined during review',
      icon: XCircle,
      color: 'from-rose-500 to-red-600',
      textColor: 'text-rose-600',
      bgColor: 'bg-rose-50',
      link: '/admin/od-requests?status=Rejected'
    },
    {
      title: 'Pending Certificates',
      value: s.pendingCertificates,
      subtitle: 'Submitted post-event',
      icon: Award,
      color: 'from-violet-500 to-indigo-600',
      textColor: 'text-violet-600',
      bgColor: 'bg-violet-50',
      link: '/admin/certificates?status=Pending'
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Quick Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-zinc-900 to-amber-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              System Executive Dashboard
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Institutional OD Overview
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Real-time monitoring of all student OD applications, faculty approval stages, academic roster syncs, and compliance parameters.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold transition-all backdrop-blur-sm cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
            <Link
              to="/admin/reports"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition-all shadow-lg shadow-amber-500/25"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Export Reports</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 9 Summary Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700">
            System Key Performance Indicators
          </h2>
          <span className="text-xs text-slate-400 font-semibold">Live Database Records</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <Link
                key={idx}
                to={card.link}
                className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-amber-400/60 transition-all group flex flex-col justify-between"
              >
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${card.bgColor} ${card.textColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-slate-400 group-hover:text-amber-600 transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-500">{card.title}</p>
                  <p className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                    {card.value}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">{card.subtitle}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Status Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">OD Requests by Approval Status</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">Pipeline Distribution</span>
          </div>

          <div className="mt-5 space-y-3">
            {Object.entries(s.statusDistribution).length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No status data recorded yet.</p>
            ) : (
              Object.entries(s.statusDistribution).map(([status, rawCount]: any) => {
                const count = typeof rawCount === 'object' && rawCount !== null ? (rawCount.total ?? rawCount.count ?? 0) : Number(rawCount || 0);
                const total = s.totalODRequests || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700">{status}</span>
                      <span className="text-slate-500">{count} requests ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          status.includes('Approved') ? 'bg-emerald-500' :
                          status.includes('Rejected') ? 'bg-rose-500' :
                          'bg-amber-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Department-wise Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Department-wise OD Requests</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">Department breakdown</span>
          </div>

          <div className="mt-5 space-y-3">
            {Object.entries(s.departmentDistribution).length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No department data recorded yet.</p>
            ) : (
              Object.entries(s.departmentDistribution).map(([dept, rawCount]: any) => {
                const count = typeof rawCount === 'object' && rawCount !== null ? (rawCount.total ?? rawCount.count ?? 0) : Number(rawCount || 0);
                const total = s.totalODRequests || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={dept} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700 truncate max-w-[200px]">{dept}</span>
                      <span className="text-slate-500">{count} ODs ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-blue-600 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Recent System Activity & Recent OD Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent OD Requests Table (2 Cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Recent System OD Applications</h3>
            <Link to="/admin/od-requests" className="text-xs font-bold text-amber-600 hover:text-amber-700">
              View All ({s.totalODRequests}) →
            </Link>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">Event Details</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Stage</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {s.recentODRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No recent OD requests found in database.
                    </td>
                  </tr>
                ) : (
                  s.recentODRequests.map((req: any) => (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-800">{req.studentName}</p>
                        <p className="text-[11px] text-slate-400">{req.studentRegisterNo}</p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-700 max-w-[180px] truncate">{req.eventName}</p>
                        <p className="text-[10px] text-slate-400">{req.eventDate}</p>
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {req.numberOfDays} {req.numberOfDays === 1 ? 'day' : 'days'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {req.approvalStage || req.currentStage}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={req.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Administrative & Audit Activities (1 Col) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Recent Audit Activities</h3>
              <Link to="/admin/audit-logs" className="text-xs font-bold text-amber-600 hover:text-amber-700">
                Full Log →
              </Link>
            </div>

            <div className="mt-4 space-y-3.5">
              {s.recentActivities.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No audit activities logged yet.</p>
              ) : (
                s.recentActivities.slice(0, 6).map((act, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-800">{act.action}</p>
                      <p className="text-[11px] text-slate-500 leading-tight">{act.details}</p>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">{act.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link
              to="/admin/settings"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
            >
              Configure Institutional Thresholds
            </Link>
          </div>
        </div>

      </div>

    </div>
  );
};
