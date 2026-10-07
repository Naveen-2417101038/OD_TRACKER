import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Search, Upload, Edit3, 
  CheckCircle2, XCircle, AlertTriangle, ShieldCheck, 
  RefreshCw, FileSpreadsheet, Eye, X, Award
} from 'lucide-react';
import { 
  apiGetAdminAcademic, 
  apiUpdateAdminStudentAcademic 
} from '../../services/api';
import { AcademicDataUpload } from '../../components/AcademicDataUpload';
import { useToast } from '../../components/Toast';

export const AdminAcademic: React.FC = () => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'roster' | 'upload'>('roster');
  const [academicList, setAcademicList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');

  // Edit modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    cgpa: 8.0,
    overall_attendance: 85,
    od_days_used: 0,
    max_od_days: 12
  });

  const loadAcademicRoster = async () => {
    try {
      setLoading(true);
      const res = await apiGetAdminAcademic({
        search: search || undefined,
        department: department || undefined,
        year: year || undefined,
        section: section || undefined
      });
      if (res && res.success) {
        setAcademicList(res.data || []);
      }
    } catch {
      showToast('Failed to load academic records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAcademicRoster();
  }, [department, year, section]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadAcademicRoster();
  };

  const handleOpenEdit = (item: any) => {
    setSelectedItem(item);
    setEditForm({
      cgpa: item.cgpa || 8.0,
      overall_attendance: item.overall_attendance || item.attendance || 85,
      od_days_used: item.od_days_used || 0,
      max_od_days: item.max_od_days || 12
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      const res = await apiUpdateAdminStudentAcademic(selectedItem.student_id, editForm);
      if (res && res.success) {
        showToast('Academic metrics updated successfully', 'success');
        setIsEditOpen(false);
        loadAcademicRoster();
      } else {
        showToast(res?.error || 'Failed to update academic record', 'error');
      }
    } catch {
      showToast('Error saving academic changes', 'error');
    }
  };

  const getEligibilityBadge = (statusLabel: string) => {
    if (statusLabel === 'No Limit — CGPA Above 8.5') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-200">
          <Award className="w-3 h-3 text-purple-600" />
          No Limit — CGPA &gt; 8.5
        </span>
      );
    }
    if (statusLabel === 'Eligible') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Eligible
        </span>
      );
    }
    if (statusLabel === '10% Limit Exceeded') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          10% Limit Exceeded
        </span>
      );
    }
    if (statusLabel === 'Attendance Below 75%') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-200">
          <XCircle className="w-3 h-3 text-rose-600" />
          Attendance Below 75%
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-800">
        {statusLabel || 'Not Eligible'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header & Tab Switcher */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <BookOpen className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Academic Data & Policy Enforcement</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Monitor student CGPA, attendance, CAT marks, and automated 10% OD allowance policy enforcement.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'roster'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Academic Roster ({academicList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Excel Batch Upload</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Academic Roster */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          
          {/* Policy Banner */}
          <div className="p-4 bg-gradient-to-r from-teal-50 via-emerald-50 to-blue-50 rounded-2xl border border-teal-200/70 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-extrabold text-teal-950 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                Active Institutional OD Rule Parameters
              </p>
              <p className="text-[11px] text-teal-800/90 mt-0.5">
                • Students with CGPA ≥ 8.5: No 10% OD allowance limit &nbsp;|&nbsp;
                • CGPA &lt; 8.5: Capped at 10% total semester working days &nbsp;|&nbsp;
                • Attendance &lt; 75%: Ineligible for OD
              </p>
            </div>
            <button
              type="button"
              onClick={loadAcademicRoster}
              className="p-2 rounded-xl bg-white border border-teal-200 hover:bg-teal-50 text-teal-700 font-bold self-start sm:self-auto cursor-pointer"
              title="Refresh Roster"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Search & Filter */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search student name or register number..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
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
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
                >
                  <option value="">All Years</option>
                  <option value="I Year">I Year</option>
                  <option value="II Year">II Year</option>
                  <option value="III Year">III Year</option>
                  <option value="IV Year">IV Year</option>
                </select>

                <input
                  type="text"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="Section (e.g. A)"
                  className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
                />

                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
                >
                  Filter
                </button>
              </div>
            </form>
          </div>

          {/* Roster Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Department & Class</th>
                    <th className="py-3 px-4">CGPA</th>
                    <th className="py-3 px-4">Attendance</th>
                    <th className="py-3 px-4">OD Days Used</th>
                    <th className="py-3 px-4">Policy Eligibility</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Loading academic metrics...
                      </td>
                    </tr>
                  ) : academicList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No student academic records found.
                      </td>
                    </tr>
                  ) : (
                    academicList.map((item) => {
                      const att = item.overall_attendance ?? item.attendance ?? 0;
                      const cgpa = item.cgpa ?? 0;
                      const statusLabel = item.eligibility_status_label || item.eligibility_label || 'Eligible';

                      return (
                        <tr key={item.student_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-800">{item.name}</p>
                            <p className="text-[11px] font-mono text-slate-400">{item.registerNumber}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-700">{item.department}</p>
                            <p className="text-[10px] text-slate-400">{item.year} • Sec {item.section}</p>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {cgpa ? cgpa.toFixed(2) : 'N/A'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 font-bold ${
                              att >= 75 ? 'text-emerald-700' : 'text-rose-600'
                            }`}>
                              {att}%
                              {att < 75 && <span className="text-[10px] font-semibold text-rose-500">(Low)</span>}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-800">{item.od_days_used || 0}</span>
                            <span className="text-slate-400 text-[11px]"> / {item.max_od_days || 12} max</span>
                          </td>
                          <td className="py-3 px-4">
                            {getEligibilityBadge(statusLabel)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                              title="Edit Academic Marks & Attendance"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
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

      {/* Tab 2: Excel Batch Upload Component */}
      {activeTab === 'upload' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
          <AcademicDataUpload onUpdateSuccess={loadAcademicRoster} />
        </div>
      )}

      {/* Edit Academic Record Modal */}
      {isEditOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900">Edit Academic Record</h3>
                <p className="text-slate-500 font-mono text-[11px]">{selectedItem.name} ({selectedItem.registerNumber})</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Cumulative GPA (CGPA)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  required
                  value={editForm.cgpa}
                  onChange={(e) => setEditForm({ ...editForm, cgpa: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">If ≥ 8.5, student is automatically exempted from the 10% OD allowance cap.</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Overall Attendance (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  value={editForm.overall_attendance}
                  onChange={(e) => setEditForm({ ...editForm, overall_attendance: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Minimum mandatory threshold is 75%.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">OD Days Used</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={editForm.od_days_used}
                    onChange={(e) => setEditForm({ ...editForm, od_days_used: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Max OD Allowance</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.max_od_days}
                    onChange={(e) => setEditForm({ ...editForm, max_od_days: parseInt(e.target.value) || 12 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700"
                >
                  Save Metrics
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
