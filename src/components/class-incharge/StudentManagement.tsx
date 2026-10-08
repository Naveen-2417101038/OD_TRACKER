import React, { useState, useEffect } from 'react';
import {
  Users, Calendar, Award, Upload, Download, Search, Filter,
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, Eye, Edit3,
  Key, ToggleLeft, ToggleRight, FileText, ChevronRight, UserPlus,
  ArrowUpRight, ArrowDownRight, Clock, ShieldCheck, Database,
  FileSpreadsheet, AlertCircle, X, Check, Trash2, HelpCircle
} from 'lucide-react';
import {
  apiCIListStudents,
  apiCICreateStudent,
  apiCIUpdateStudent,
  apiCIToggleStudentStatus,
  apiCIResetStudentPassword,
  apiCIGetStudentProfile,
  apiCIPreviewStudentsUpload,
  apiCIConfirmStudentsUpload,
  apiCIPreviewAttendanceUpload,
  apiCIConfirmAttendanceUpload,
  apiCIPreviewMarksUpload,
  apiCIConfirmMarksUpload,
  apiCIGetHistory,
  apiCIDownloadTemplate,
  apiCIExportFailedReport
} from '../../services/api';
import { getAuthSession } from '../../data/mockData';
import { useToast } from '../Toast';

interface StudentItem {
  id: string;
  register_number: string;
  name: string;
  email: string;
  department: string;
  section: string;
  class: string;
  year: string;
  phone: string;
  cgpa: number;
  attendance: number;
  cat1: number | null;
  cat2: number | null;
  cat3: number | null;
  status: 'ACTIVE' | 'DISABLED' | 'UNVERIFIED';
  avatar?: string;
  created_at?: string;
}

interface UploadHistoryItem {
  id: string;
  file_name: string;
  uploaded_by_id: string;
  uploaded_by_name: string;
  upload_date: string;
  week_date?: string;
  total_records?: number;
  total_students?: number;
  successful_count?: number;
  updated_count?: number;
  failed_count?: number;
  details?: any[];
}

export const StudentManagement: React.FC = () => {
  const { showToast } = useToast();
  const session = getAuthSession();
  const token = session?.token;

  // Sub-tabs: 'students' | 'attendance' | 'marks'
  const [subTab, setSubTab] = useState<'students' | 'attendance' | 'marks'>('students');

  // Students list state
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [isSingleAddOpen, setIsSingleAddOpen] = useState(false);
  const [isBulkStudentOpen, setIsBulkStudentOpen] = useState(false);
  const [isEditStudentOpen, setIsEditStudentOpen] = useState(false);
  const [isResetPwdOpen, setIsResetPwdOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [studentProfileData, setStudentProfileData] = useState<any | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Single Add form
  const [addForm, setAddForm] = useState({
    register_number: '',
    name: '',
    email: '',
    department: 'Computer Science and Design',
    section: 'A',
    year: 'III Year',
    phone: '',
    cgpa: '8.5',
    attendance: '85.0',
    password: 'password123'
  });

  // Edit form
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    department: '',
    section: '',
    year: '',
    cgpa: '',
    attendance: '',
    cat1: '',
    cat2: '',
    cat3: ''
  });

  // Reset password form
  const [newPassword, setNewPassword] = useState('password123');

  // Bulk Student Upload State
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [studentPreview, setStudentPreview] = useState<any | null>(null);
  const [studentPreviewLoading, setStudentPreviewLoading] = useState(false);
  const [studentImporting, setStudentImporting] = useState(false);

  // Weekly Attendance Upload State
  const [attFile, setAttFile] = useState<File | null>(null);
  const [attWeek, setAttWeek] = useState<string>(`Week ${Math.ceil(new Date().getDate() / 7)}`);
  const [attPreview, setAttPreview] = useState<any | null>(null);
  const [attPreviewLoading, setAttPreviewLoading] = useState(false);
  const [attUpdating, setAttUpdating] = useState(false);
  const [attHistory, setAttHistory] = useState<UploadHistoryItem[]>([]);
  const [loadingAttHistory, setLoadingAttHistory] = useState(false);
  const [selectedAttHistoryDetails, setSelectedAttHistoryDetails] = useState<UploadHistoryItem | null>(null);

  // Marks Upload State
  const [marksFile, setMarksFile] = useState<File | null>(null);
  const [marksPreview, setMarksPreview] = useState<any | null>(null);
  const [marksPreviewLoading, setMarksPreviewLoading] = useState(false);
  const [marksUpdating, setMarksUpdating] = useState(false);
  const [marksHistory, setMarksHistory] = useState<UploadHistoryItem[]>([]);
  const [loadingMarksHistory, setLoadingMarksHistory] = useState(false);
  const [selectedMarksHistoryDetails, setSelectedMarksHistoryDetails] = useState<UploadHistoryItem | null>(null);

  // Fetch Students list
  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (search.trim()) params.search = search.trim();
      if (sectionFilter) params.section = sectionFilter;
      if (yearFilter) params.year = yearFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await apiCIListStudents(params, token);
      if (res.success && Array.isArray(res.students)) {
        setStudents(res.students);
      } else {
        showToast(res.error || 'Failed to fetch student accounts', 'error');
      }
    } catch (err: any) {
      showToast('Error fetching students', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Attendance History
  const fetchAttendanceHistory = async () => {
    setLoadingAttHistory(true);
    try {
      const res = await apiCIGetHistory('attendance', 30, token);
      if (res.success && Array.isArray(res.history)) {
        setAttHistory(res.history);
      }
    } finally {
      setLoadingAttHistory(false);
    }
  };

  // Fetch Marks History
  const fetchMarksHistory = async () => {
    setLoadingMarksHistory(true);
    try {
      const res = await apiCIGetHistory('marks', 30, token);
      if (res.success && Array.isArray(res.history)) {
        setMarksHistory(res.history);
      }
    } finally {
      setLoadingMarksHistory(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [search, sectionFilter, yearFilter, statusFilter]);

  useEffect(() => {
    if (subTab === 'attendance') {
      fetchAttendanceHistory();
    } else if (subTab === 'marks') {
      fetchMarksHistory();
    }
  }, [subTab]);

  // Handle Single Student Create
  const handleSingleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.register_number.trim() || !addForm.name.trim() || !addForm.email.trim()) {
      showToast('Please fill all mandatory fields.', 'error');
      return;
    }

    const res = await apiCICreateStudent({
      ...addForm,
      cgpa: parseFloat(addForm.cgpa) || 0.0,
      attendance: parseFloat(addForm.attendance) || 85.0
    }, token);

    if (res.success) {
      showToast(`Student ${addForm.name} (${addForm.register_number}) added successfully!`, 'success');
      setIsSingleAddOpen(false);
      setAddForm({
        register_number: '',
        name: '',
        email: '',
        department: 'Computer Science and Design',
        section: 'A',
        year: 'III Year',
        phone: '',
        cgpa: '8.5',
        attendance: '85.0',
        password: 'password123'
      });
      fetchStudents();
      window.dispatchEvent(new CustomEvent('odStateUpdated'));
    } else {
      showToast(res.error || 'Failed to create student account.', 'error');
    }
  };

  // Handle Edit Student
  const handleEditOpen = (s: StudentItem) => {
    setSelectedStudent(s);
    setEditForm({
      name: s.name,
      phone: s.phone || '',
      department: s.department,
      section: s.section,
      year: s.year,
      cgpa: String(s.cgpa ?? ''),
      attendance: String(s.attendance ?? ''),
      cat1: s.cat1 != null ? String(s.cat1) : '',
      cat2: s.cat2 != null ? String(s.cat2) : '',
      cat3: s.cat3 != null ? String(s.cat3) : ''
    });
    setIsEditStudentOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    const res = await apiCIUpdateStudent(selectedStudent.register_number, {
      name: editForm.name,
      phone: editForm.phone,
      department: editForm.department,
      section: editForm.section,
      year: editForm.year,
      cgpa: editForm.cgpa ? parseFloat(editForm.cgpa) : undefined,
      attendance: editForm.attendance ? parseFloat(editForm.attendance) : undefined,
      cat1: editForm.cat1 ? parseFloat(editForm.cat1) : null,
      cat2: editForm.cat2 ? parseFloat(editForm.cat2) : null,
      cat3: editForm.cat3 ? parseFloat(editForm.cat3) : null
    }, token);

    if (res.success) {
      showToast(`Student ${selectedStudent.register_number} updated successfully!`, 'success');
      setIsEditStudentOpen(false);
      fetchStudents();
      window.dispatchEvent(new CustomEvent('odStateUpdated'));
      window.dispatchEvent(new CustomEvent('odFacultyStateUpdated'));
    } else {
      showToast(res.error || 'Failed to update student.', 'error');
    }
  };

  // Handle Status Toggle
  const handleToggleStatus = async (s: StudentItem) => {
    const nextStatus = s.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    const res = await apiCIToggleStudentStatus(s.register_number, nextStatus, token);
    if (res.success) {
      showToast(`Student account ${s.register_number} is now ${nextStatus}`, 'success');
      setStudents(prev => prev.map(item => item.id === s.id ? { ...item, status: nextStatus } : item));
    } else {
      showToast(res.error || 'Failed to change student status', 'error');
    }
  };

  // Handle Password Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    const res = await apiCIResetStudentPassword(selectedStudent.register_number, newPassword, token);
    if (res.success) {
      showToast(`Password reset successfully for ${selectedStudent.register_number}!`, 'success');
      setIsResetPwdOpen(false);
      setNewPassword('password123');
    } else {
      showToast(res.error || 'Failed to reset password.', 'error');
    }
  };

  // Handle View Profile
  const handleViewProfile = async (s: StudentItem) => {
    setSelectedStudent(s);
    setIsProfileOpen(true);
    setLoadingProfile(true);
    try {
      const res = await apiCIGetStudentProfile(s.register_number, token);
      if (res.success) {
        setStudentProfileData(res.profile);
      } else {
        showToast(res.error || 'Failed to fetch student profile.', 'error');
      }
    } finally {
      setLoadingProfile(false);
    }
  };

  // ─── Bulk Student Upload Handlers ──────────────────────────────────────────
  const handleStudentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setStudentFile(e.target.files[0]);
      setStudentPreview(null);
    }
  };

  const handleStudentPreview = async () => {
    if (!studentFile) {
      showToast('Please select a file first.', 'error');
      return;
    }
    setStudentPreviewLoading(true);
    try {
      const res = await apiCIPreviewStudentsUpload(studentFile, token);
      if (res.success) {
        setStudentPreview(res);
        showToast(`Preview loaded: ${res.summary.ready_to_import} ready to import.`, 'info');
      } else {
        showToast(res.error || 'Failed to process Excel file.', 'error');
      }
    } finally {
      setStudentPreviewLoading(false);
    }
  };

  const handleStudentImportConfirm = async () => {
    if (!studentPreview || !studentPreview.rows) return;
    setStudentImporting(true);
    try {
      const res = await apiCIConfirmStudentsUpload(studentPreview.rows, studentPreview.filename, token);
      if (res.success) {
        showToast(`Successfully imported ${res.imported_count} student accounts!`, 'success');
        setIsBulkStudentOpen(false);
        setStudentFile(null);
        setStudentPreview(null);
        fetchStudents();
        window.dispatchEvent(new CustomEvent('odStateUpdated'));
      } else {
        showToast(res.error || 'Failed to import student accounts.', 'error');
      }
    } finally {
      setStudentImporting(false);
    }
  };

  // ─── Attendance Upload Handlers ───────────────────────────────────────────
  const handleAttFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttFile(e.target.files[0]);
      setAttPreview(null);
    }
  };

  const handleAttPreview = async () => {
    if (!attFile) {
      showToast('Please select an attendance Excel file.', 'error');
      return;
    }
    setAttPreviewLoading(true);
    try {
      const res = await apiCIPreviewAttendanceUpload(attFile, token);
      if (res.success) {
        setAttPreview(res);
        showToast(`Attendance preview: ${res.summary.ready_to_update} matched students.`, 'info');
      } else {
        showToast(res.error || 'Failed to process attendance Excel.', 'error');
      }
    } finally {
      setAttPreviewLoading(false);
    }
  };

  const handleAttConfirm = async () => {
    if (!attPreview || !attPreview.rows) return;
    setAttUpdating(true);
    try {
      const res = await apiCIConfirmAttendanceUpload(attPreview.rows, attPreview.filename, attWeek, token);
      if (res.success) {
        showToast(`Weekly attendance updated for ${res.updated_count} students!`, 'success');
        setAttFile(null);
        setAttPreview(null);
        fetchStudents();
        fetchAttendanceHistory();
        window.dispatchEvent(new CustomEvent('odStateUpdated'));
        window.dispatchEvent(new CustomEvent('odFacultyStateUpdated'));
      } else {
        showToast(res.error || 'Failed to update attendance.', 'error');
      }
    } finally {
      setAttUpdating(false);
    }
  };

  // ─── Marks Upload Handlers ────────────────────────────────────────────────
  const handleMarksFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setMarksFile(e.target.files[0]);
      setMarksPreview(null);
    }
  };

  const handleMarksPreview = async () => {
    if (!marksFile) {
      showToast('Please select a CAT marks Excel file.', 'error');
      return;
    }
    setMarksPreviewLoading(true);
    try {
      const res = await apiCIPreviewMarksUpload(marksFile, token);
      if (res.success) {
        setMarksPreview(res);
        showToast(`Marks preview: ${res.summary.ready_to_update} matched students.`, 'info');
      } else {
        showToast(res.error || 'Failed to process marks Excel.', 'error');
      }
    } finally {
      setMarksPreviewLoading(false);
    }
  };

  const handleMarksConfirm = async () => {
    if (!marksPreview || !marksPreview.rows) return;
    setMarksUpdating(true);
    try {
      const res = await apiCIConfirmMarksUpload(marksPreview.rows, marksPreview.filename, token);
      if (res.success) {
        showToast(`CAT marks updated for ${res.updated_count} students!`, 'success');
        setMarksFile(null);
        setMarksPreview(null);
        fetchStudents();
        fetchMarksHistory();
        window.dispatchEvent(new CustomEvent('odStateUpdated'));
        window.dispatchEvent(new CustomEvent('odFacultyStateUpdated'));
      } else {
        showToast(res.error || 'Failed to update marks.', 'error');
      }
    } finally {
      setMarksUpdating(false);
    }
  };

  // Export Failed Rows
  const handleExportFailedRows = async (rows: any[], type: string) => {
    const failed = rows.filter(r => r.status !== 'valid' && r.status !== 'matched');
    if (failed.length === 0) {
      showToast('No failed or invalid rows to export.', 'info');
      return;
    }
    await apiCIExportFailedReport(failed, type, token);
    showToast('Failed rows report downloaded.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Sub-Tabs Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl">
          <button
            type="button"
            onClick={() => setSubTab('students')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'students'
                ? 'bg-teal-600 text-white shadow-sm shadow-teal-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Students ({students.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('attendance')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'attendance'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Attendance (Weekly)</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('marks')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'marks'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Marks (CAT)</span>
          </button>
        </div>

        <div className="flex items-center gap-2 px-2">
          {subTab === 'students' && (
            <>
              <button
                type="button"
                onClick={() => setIsSingleAddOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Add Student</span>
              </button>
              <button
                type="button"
                onClick={() => setIsBulkStudentOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 shadow-sm shadow-teal-200 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Bulk Import Excel</span>
              </button>
            </>
          )}

          {subTab === 'attendance' && (
            <button
              type="button"
              onClick={() => apiCIDownloadTemplate('attendance', token)}
              className="px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Attendance Template</span>
            </button>
          )}

          {subTab === 'marks' && (
            <button
              type="button"
              onClick={() => apiCIDownloadTemplate('marks', token)}
              className="px-3.5 py-2 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Marks Template</span>
            </button>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 1. SUB-TAB: STUDENTS (Account Management & Table)                       */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {subTab === 'students' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Register Number or Student Name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-teal-500"
              >
                <option value="">All Sections</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
              </select>

              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-teal-500"
              >
                <option value="">All Years</option>
                <option value="I Year">I Year</option>
                <option value="II Year">II Year</option>
                <option value="III Year">III Year</option>
                <option value="IV Year">IV Year</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-teal-500"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
              </select>

              <button
                type="button"
                onClick={fetchStudents}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                title="Refresh student list"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Student Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-4 px-4">Register No</th>
                    <th className="py-4 px-4">Name</th>
                    <th className="py-4 px-4">Class</th>
                    <th className="py-4 px-4">Year</th>
                    <th className="py-4 px-4 text-center">CGPA</th>
                    <th className="py-4 px-4 text-center">Attendance</th>
                    <th className="py-4 px-4 text-center">CAT 1</th>
                    <th className="py-4 px-4 text-center">CAT 2</th>
                    <th className="py-4 px-4 text-center">Status</th>
                    <th className="py-4 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                        Loading student accounts...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        No students found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    students.map((s) => {
                      const isLowAtt = s.attendance < 75.0;
                      return (
                        <tr key={s.id || s.register_number} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {s.register_number}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center shrink-0">
                                {s.name.charAt(0)}
                              </span>
                              <div>
                                <p className="font-bold text-slate-800 leading-tight">{s.name}</p>
                                <p className="text-[10px] text-slate-400">{s.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 font-medium">
                            {s.section ? `Sec ${s.section}` : s.class}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {s.year}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                              s.cgpa >= 8.5 ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-slate-50 text-slate-700'
                            }`}>
                              {s.cgpa ? s.cgpa.toFixed(2) : '—'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                              isLowAtt
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {s.attendance != null ? `${s.attendance.toFixed(1)}%` : '—'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                            {s.cat1 != null ? s.cat1 : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                            {s.cat2 != null ? s.cat2 : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(s)}
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold transition-all ${
                                s.status === 'ACTIVE'
                                  ? 'bg-emerald-100/70 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              }`}
                              title="Click to toggle account status"
                            >
                              {s.status}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleViewProfile(s)}
                                className="p-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                                title="View Complete Profile"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditOpen(s)}
                                className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                                title="Edit Student Data"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStudent(s);
                                  setIsResetPwdOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                                title="Reset Student Password"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>
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

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 2. SUB-TAB: ATTENDANCE (Weekly Attendance Upload & History)             */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {subTab === 'attendance' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Weekly Attendance Synchronization
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload the official college weekly attendance Excel. The system matches students by <strong>Register Number</strong> and automatically syncs all dashboards and OD eligibility rules.
                </p>
              </div>

              <button
                type="button"
                onClick={() => apiCIDownloadTemplate('attendance', token)}
                className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold flex items-center gap-2 shrink-0 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download Sample Template</span>
              </button>
            </div>

            {/* Upload Box */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="md:col-span-2 border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/30 rounded-2xl p-6 text-center transition-all">
                <input
                  type="file"
                  id="attFileInput"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleAttFileSelect}
                  className="hidden"
                />
                <label htmlFor="attFileInput" className="cursor-pointer space-y-2 block">
                  <Upload className="w-8 h-8 text-blue-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">
                    {attFile ? attFile.name : 'Click to select Weekly Attendance (.xlsx, .xls, .csv)'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Must contain columns: Register Number, Student Name, Attendance Percentage
                  </p>
                </label>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Week / Upload Label</label>
                  <input
                    type="text"
                    value={attWeek}
                    onChange={(e) => setAttWeek(e.target.value)}
                    placeholder="e.g. Week 5 (2026-10-08)"
                    className="w-full mt-1 px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAttPreview}
                  disabled={!attFile || attPreviewLoading}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs shadow-sm shadow-blue-200 flex items-center justify-center gap-2 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${attPreviewLoading ? 'animate-spin' : ''}`} />
                  <span>Preview Attendance Data</span>
                </button>
              </div>
            </div>

            {/* Attendance Preview Table */}
            {attPreview && (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Preview Summary:</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                      Total: {attPreview.summary.total_records}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Ready to Update: {attPreview.summary.ready_to_update}
                    </span>
                    {attPreview.summary.unmatched_count > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                        Unmatched: {attPreview.summary.unmatched_count}
                      </span>
                    )}
                    {attPreview.summary.invalid_count > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                        Invalid: {attPreview.summary.invalid_count}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {(attPreview.summary.unmatched_count > 0 || attPreview.summary.invalid_count > 0) && (
                      <button
                        type="button"
                        onClick={() => handleExportFailedRows(attPreview.rows, 'Attendance')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export Failed Rows</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleAttConfirm}
                      disabled={attUpdating || attPreview.summary.ready_to_update === 0}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold shadow-sm shadow-emerald-200 flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>{attUpdating ? 'Updating...' : `Confirm Update (${attPreview.summary.ready_to_update})`}</span>
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Row</th>
                        <th className="p-3">Register Number</th>
                        <th className="p-3">Student Name</th>
                        <th className="p-3 text-center">Previous Att %</th>
                        <th className="p-3 text-center">New Att %</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3">Remarks / Failure Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {attPreview.rows.map((r: any) => (
                        <tr key={r.row_number} className="hover:bg-slate-50/70">
                          <td className="p-3 font-mono text-slate-400">{r.row_number}</td>
                          <td className="p-3 font-mono font-bold text-slate-900">{r.register_number}</td>
                          <td className="p-3 font-bold text-slate-800">{r.student_name}</td>
                          <td className="p-3 text-center font-bold text-slate-500">
                            {r.previous_attendance != null ? `${r.previous_attendance}%` : '—'}
                          </td>
                          <td className="p-3 text-center font-bold">
                            {r.new_attendance != null ? (
                              <span className={`px-2 py-0.5 rounded-md ${
                                r.new_attendance < 75.0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                {r.new_attendance}%
                              </span>
                            ) : '—'}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              r.status === 'matched'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'unmatched'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {r.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 text-[11px]">
                            {r.reason || 'Ready for database synchronization'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Attendance History Section */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Attendance Upload History Logs
            </h4>

            {loadingAttHistory ? (
              <p className="text-xs text-slate-400 py-4 text-center">Loading attendance history...</p>
            ) : attHistory.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No attendance update history recorded yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Upload Date / Time</th>
                      <th className="p-3">File Name</th>
                      <th className="p-3">Week Label</th>
                      <th className="p-3">Uploaded By</th>
                      <th className="p-3 text-center">Total Students</th>
                      <th className="p-3 text-center">Updated</th>
                      <th className="p-3 text-center">Failed</th>
                      <th className="p-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {attHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/70">
                        <td className="p-3 font-mono text-slate-600">{h.upload_date}</td>
                        <td className="p-3 font-bold text-slate-900">{h.file_name}</td>
                        <td className="p-3 font-semibold text-blue-700">{h.week_date || '—'}</td>
                        <td className="p-3 text-slate-600">{h.uploaded_by_name || 'Class Incharge'}</td>
                        <td className="p-3 text-center font-bold">{h.total_students ?? h.total_records ?? 0}</td>
                        <td className="p-3 text-center font-bold text-emerald-700">{h.updated_count ?? h.successful_count ?? 0}</td>
                        <td className="p-3 text-center font-bold text-rose-600">{h.failed_count ?? 0}</td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedAttHistoryDetails(h)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-bold"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 3. SUB-TAB: MARKS (CAT Marks Management & History)                      */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {subTab === 'marks' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-600" />
                  Student Marks & CAT Management
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload CAT 1, CAT 2, CAT 3, and internal assignment marks through Excel. Matched by <strong>Register Number</strong> and updated across Student Dashboards and Academic profiles.
                </p>
              </div>

              <button
                type="button"
                onClick={() => apiCIDownloadTemplate('marks', token)}
                className="px-4 py-2 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-xs font-bold flex items-center gap-2 shrink-0 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download Sample Template</span>
              </button>
            </div>

            {/* Upload Box */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="md:col-span-2 border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/30 rounded-2xl p-6 text-center transition-all">
                <input
                  type="file"
                  id="marksFileInput"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleMarksFileSelect}
                  className="hidden"
                />
                <label htmlFor="marksFileInput" className="cursor-pointer space-y-2 block">
                  <Upload className="w-8 h-8 text-purple-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">
                    {marksFile ? marksFile.name : 'Click to select Student Marks Excel (.xlsx, .xls, .csv)'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Columns: Register Number, Student Name, CAT 1, CAT 2, CAT 3, Assignment
                  </p>
                </label>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleMarksPreview}
                  disabled={!marksFile || marksPreviewLoading}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs shadow-sm shadow-purple-200 flex items-center justify-center gap-2 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${marksPreviewLoading ? 'animate-spin' : ''}`} />
                  <span>Preview Marks Data</span>
                </button>
              </div>
            </div>

            {/* Marks Preview Table */}
            {marksPreview && (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Preview Summary:</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                      Total: {marksPreview.summary.total_records}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Ready to Update: {marksPreview.summary.ready_to_update}
                    </span>
                    {marksPreview.summary.unmatched_count > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                        Unmatched: {marksPreview.summary.unmatched_count}
                      </span>
                    )}
                    {marksPreview.summary.invalid_count > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                        Invalid: {marksPreview.summary.invalid_count}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {(marksPreview.summary.unmatched_count > 0 || marksPreview.summary.invalid_count > 0) && (
                      <button
                        type="button"
                        onClick={() => handleExportFailedRows(marksPreview.rows, 'Marks')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export Failed Rows</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleMarksConfirm}
                      disabled={marksUpdating || marksPreview.summary.ready_to_update === 0}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold shadow-sm shadow-emerald-200 flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>{marksUpdating ? 'Updating...' : `Confirm Update (${marksPreview.summary.ready_to_update})`}</span>
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Row</th>
                        <th className="p-3">Register Number</th>
                        <th className="p-3">Student Name</th>
                        <th className="p-3 text-center">New CAT 1</th>
                        <th className="p-3 text-center">New CAT 2</th>
                        <th className="p-3 text-center">New CAT 3</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3">Remarks / Failure Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {marksPreview.rows.map((r: any) => (
                        <tr key={r.row_number} className="hover:bg-slate-50/70">
                          <td className="p-3 font-mono text-slate-400">{r.row_number}</td>
                          <td className="p-3 font-mono font-bold text-slate-900">{r.register_number}</td>
                          <td className="p-3 font-bold text-slate-800">{r.student_name}</td>
                          <td className="p-3 text-center font-bold text-slate-800">{r.new_marks?.cat1 ?? '—'}</td>
                          <td className="p-3 text-center font-bold text-slate-800">{r.new_marks?.cat2 ?? '—'}</td>
                          <td className="p-3 text-center font-bold text-slate-800">{r.new_marks?.cat3 ?? '—'}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              r.status === 'matched'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'unmatched'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {r.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 text-[11px]">
                            {r.reason || 'Ready for marks update'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Marks History Section */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              Marks Upload History Logs
            </h4>

            {loadingMarksHistory ? (
              <p className="text-xs text-slate-400 py-4 text-center">Loading marks history...</p>
            ) : marksHistory.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No marks upload history recorded yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Upload Date / Time</th>
                      <th className="p-3">File Name</th>
                      <th className="p-3">Uploaded By</th>
                      <th className="p-3 text-center">Total Students</th>
                      <th className="p-3 text-center">Updated</th>
                      <th className="p-3 text-center">Failed</th>
                      <th className="p-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {marksHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/70">
                        <td className="p-3 font-mono text-slate-600">{h.upload_date}</td>
                        <td className="p-3 font-bold text-slate-900">{h.file_name}</td>
                        <td className="p-3 text-slate-600">{h.uploaded_by_name || 'Class Incharge'}</td>
                        <td className="p-3 text-center font-bold">{h.total_students ?? 0}</td>
                        <td className="p-3 text-center font-bold text-emerald-700">{h.updated_count ?? 0}</td>
                        <td className="p-3 text-center font-bold text-rose-600">{h.failed_count ?? 0}</td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedMarksHistoryDetails(h)}
                            className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 text-[11px] font-bold"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: BULK STUDENT ACCOUNT CREATION                                    */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {isBulkStudentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Bulk Student Account Creation</h3>
                  <p className="text-xs text-slate-500">Upload Excel/CSV roster with duplicate detection</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBulkStudentOpen(false);
                  setStudentFile(null);
                  setStudentPreview(null);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Download & File Picker */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="md:col-span-2 border-2 border-dashed border-teal-200 hover:border-teal-400 bg-teal-50/20 rounded-2xl p-6 text-center">
                <input
                  type="file"
                  id="studentBulkFileInput"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleStudentFileSelect}
                  className="hidden"
                />
                <label htmlFor="studentBulkFileInput" className="cursor-pointer space-y-2 block">
                  <Upload className="w-8 h-8 text-teal-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">
                    {studentFile ? studentFile.name : 'Choose Excel / CSV student file'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Fields: Register Number, Student Name, Email, Department, Section, Year, CGPA, Attendance
                  </p>
                </label>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => apiCIDownloadTemplate('students', token)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Sample Template</span>
                </button>

                <button
                  type="button"
                  onClick={handleStudentPreview}
                  disabled={!studentFile || studentPreviewLoading}
                  className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm shadow-teal-200"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${studentPreviewLoading ? 'animate-spin' : ''}`} />
                  <span>Preview Data</span>
                </button>
              </div>
            </div>

            {/* Preview & Duplicate Summary */}
            {studentPreview && (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Import Summary</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Total Records</p>
                      <p className="text-base font-extrabold text-slate-800">{studentPreview.summary.total_records}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <p className="text-[10px] text-emerald-600 uppercase font-bold">Ready to Add</p>
                      <p className="text-base font-extrabold text-emerald-700">{studentPreview.summary.ready_to_import}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                      <p className="text-[10px] text-amber-600 uppercase font-bold">Already Exists</p>
                      <p className="text-base font-extrabold text-amber-700">{studentPreview.summary.already_existing}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200">
                      <p className="text-[10px] text-orange-600 uppercase font-bold">Duplicate in File</p>
                      <p className="text-base font-extrabold text-orange-700">{studentPreview.summary.duplicate_records}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                      <p className="text-[10px] text-rose-600 uppercase font-bold">Invalid Records</p>
                      <p className="text-base font-extrabold text-rose-700">{studentPreview.summary.invalid_records}</p>
                    </div>
                  </div>
                </div>

                {/* Table of Preview rows */}
                <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Row</th>
                        <th className="p-3">Register Number</th>
                        <th className="p-3">Name</th>
                        <th className="p-3">Email</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3">Remarks / Failure Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {studentPreview.rows.map((r: any) => (
                        <tr key={r.row_number} className="hover:bg-slate-50/70">
                          <td className="p-3 font-mono text-slate-400">{r.row_number}</td>
                          <td className="p-3 font-mono font-bold text-slate-900">{r.register_number}</td>
                          <td className="p-3 font-bold text-slate-800">{r.student_name}</td>
                          <td className="p-3 text-slate-500">{r.email}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              r.status === 'valid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'existing'
                                ? 'bg-amber-100 text-amber-800'
                                : r.status === 'duplicate'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {r.status === 'valid' ? 'READY' : r.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 text-[11px]">
                            {r.reason || 'Verified'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  {(studentPreview.summary.already_existing > 0 || studentPreview.summary.duplicate_records > 0 || studentPreview.summary.invalid_records > 0) && (
                    <button
                      type="button"
                      onClick={() => handleExportFailedRows(studentPreview.rows, 'Students')}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Failed-Row Report</span>
                    </button>
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setStudentFile(null);
                        setStudentPreview(null);
                      }}
                      className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
                    >
                      Clear / Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleStudentImportConfirm}
                      disabled={studentImporting || studentPreview.summary.ready_to_import === 0}
                      className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs shadow-sm shadow-teal-200 flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>{studentImporting ? 'Importing...' : `Import Students (${studentPreview.summary.ready_to_import})`}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: SINGLE STUDENT ADD                                               */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {isSingleAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-teal-600" />
                Add New Student Account
              </h3>
              <button
                type="button"
                onClick={() => setIsSingleAddOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSingleAddSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Register Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 23CSD010"
                    value={addForm.register_number}
                    onChange={(e) => setAddForm({ ...addForm, register_number: e.target.value.toUpperCase() })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Student Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700">College Email *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. rahul.23csd@rajalakshmi.edu.in"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Section</label>
                  <input
                    type="text"
                    value={addForm.section}
                    onChange={(e) => setAddForm({ ...addForm, section: e.target.value.toUpperCase() })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Year</label>
                  <input
                    type="text"
                    value={addForm.year}
                    onChange={(e) => setAddForm({ ...addForm, year: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">CGPA</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={addForm.cgpa}
                    onChange={(e) => setAddForm({ ...addForm, cgpa: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Initial Attendance %</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={addForm.attendance}
                    onChange={(e) => setAddForm({ ...addForm, attendance: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Initial Password</label>
                  <input
                    type="text"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSingleAddOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-sm shadow-teal-200"
                >
                  Create Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: EDIT STUDENT DATA                                                */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {isEditStudentOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                Edit Student ({selectedStudent.register_number})
              </h3>
              <button
                type="button"
                onClick={() => setIsEditStudentOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Student Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">CGPA</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={editForm.cgpa}
                    onChange={(e) => setEditForm({ ...editForm, cgpa: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Attendance %</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={editForm.attendance}
                    onChange={(e) => setEditForm({ ...editForm, attendance: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700">CAT 1</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="—"
                    value={editForm.cat1}
                    onChange={(e) => setEditForm({ ...editForm, cat1: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">CAT 2</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="—"
                    value={editForm.cat2}
                    onChange={(e) => setEditForm({ ...editForm, cat2: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">CAT 3</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="—"
                    value={editForm.cat3}
                    onChange={(e) => setEditForm({ ...editForm, cat3: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditStudentOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm shadow-indigo-200"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: RESET PASSWORD                                                   */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {isResetPwdOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-600" />
                Reset Student Password
              </h3>
              <button
                type="button"
                onClick={() => setIsResetPwdOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <p className="text-slate-600">
                Set a new password for student <strong>{selectedStudent.name}</strong> ({selectedStudent.register_number}):
              </p>

              <div>
                <label className="font-bold text-slate-700">New Password</label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Default recommendation: password123</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetPwdOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-sm shadow-amber-200"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: VIEW FULL STUDENT PROFILE                                        */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 font-bold text-lg flex items-center justify-center">
                  {studentProfileData?.basic_info?.name?.charAt(0) || 'S'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {studentProfileData?.basic_info?.name || 'Student Profile'}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {studentProfileData?.basic_info?.register_number} &bull; {studentProfileData?.basic_info?.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  setStudentProfileData(null);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingProfile || !studentProfileData ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                Loading comprehensive student profile...
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Basic Demographics */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-teal-600" />
                    Basic Information
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Department</span>
                      <span className="font-bold text-slate-800">{studentProfileData.basic_info.department}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Class / Section</span>
                      <span className="font-bold text-slate-800">Section {studentProfileData.basic_info.section}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Academic Year</span>
                      <span className="font-bold text-slate-800">{studentProfileData.basic_info.year}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Account Status</span>
                      <span className="font-extrabold text-emerald-700">{studentProfileData.basic_info.status}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Academic Information */}
                <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-200 space-y-2">
                  <h4 className="text-xs font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-teal-700" />
                    Academic Performance & OD Allowance
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-xl bg-white border border-teal-100">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">CGPA</span>
                      <span className="text-base font-extrabold text-purple-700">
                        {studentProfileData.academics.cgpa ? studentProfileData.academics.cgpa.toFixed(2) : '—'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-teal-100">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Attendance</span>
                      <span className="text-base font-extrabold text-emerald-700">
                        {studentProfileData.academics.attendance_percentage ? `${studentProfileData.academics.attendance_percentage}%` : '—'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-teal-100">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">CAT 1</span>
                      <span className="text-base font-extrabold text-slate-800">
                        {studentProfileData.academics.cat1_marks ?? '—'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-teal-100">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">CAT 2</span>
                      <span className="text-base font-extrabold text-slate-800">
                        {studentProfileData.academics.cat2_marks ?? '—'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-teal-100">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">CAT 3</span>
                      <span className="text-base font-extrabold text-slate-800">
                        {studentProfileData.academics.cat3_marks ?? '—'}
                      </span>
                    </div>
                  </div>

                  {studentProfileData.academics.eligibility && (
                    <div className="mt-2 p-3 rounded-xl bg-white border border-teal-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">OD Eligibility Status</span>
                        <span className={`font-bold ${studentProfileData.academics.eligibility.eligible ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {studentProfileData.academics.eligibility.eligible ? 'Eligible for On-Duty (OD)' : 'Not Eligible for OD'}
                        </span>
                        {!studentProfileData.academics.eligibility.eligible && studentProfileData.academics.eligibility.rejection_reason && (
                          <p className="text-[11px] text-rose-600 mt-0.5">{studentProfileData.academics.eligibility.rejection_reason}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Remaining OD Allowance</span>
                        <span className="font-extrabold text-slate-800">
                          {studentProfileData.academics.eligibility.remaining_od_days ?? 0} Days
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. OD History Summary */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      On-Duty Request History ({studentProfileData.od_summary.total_requests})
                    </h4>
                    <div className="flex items-center gap-2 text-[10px] font-bold">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Approved: {studentProfileData.od_summary.approved_requests}</span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">Rejected: {studentProfileData.od_summary.rejected_requests}</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Pending: {studentProfileData.od_summary.pending_requests}</span>
                    </div>
                  </div>

                  {studentProfileData.od_summary.history.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">No OD requests submitted yet by this student.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100">
                      {studentProfileData.od_summary.history.map((req: any) => (
                        <div key={req.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50">
                          <div>
                            <p className="font-bold text-slate-800">{req.eventName || req.event_name || 'Event'}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{req.id} &bull; {req.eventDate || req.event_date}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            String(req.status).includes('Approved')
                              ? 'bg-emerald-100 text-emerald-800'
                              : String(req.status).includes('Rejected')
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {req.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: INSPECT ATTENDANCE LOG DETAILS                                    */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {selectedAttHistoryDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Attendance Upload Log Details</h3>
                <p className="text-xs text-slate-500">{selectedAttHistoryDetails.file_name} &bull; {selectedAttHistoryDetails.upload_date}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAttHistoryDetails(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Register No</th>
                    <th className="p-3">Student Name</th>
                    <th className="p-3 text-center">Previous %</th>
                    <th className="p-3 text-center">New %</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {(selectedAttHistoryDetails.details || []).map((d: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="p-3 font-mono font-bold text-slate-900">{d.register_number}</td>
                      <td className="p-3 text-slate-800">{d.student_name}</td>
                      <td className="p-3 text-center font-bold text-slate-400">{d.previous_attendance != null ? `${d.previous_attendance}%` : '—'}</td>
                      <td className="p-3 text-center font-bold text-emerald-700">{d.new_attendance != null ? `${d.new_attendance}%` : '—'}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          d.status === 'Updated' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: INSPECT MARKS LOG DETAILS                                         */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {selectedMarksHistoryDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Marks Upload Log Details</h3>
                <p className="text-xs text-slate-500">{selectedMarksHistoryDetails.file_name} &bull; {selectedMarksHistoryDetails.upload_date}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMarksHistoryDetails(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Register No</th>
                    <th className="p-3">Student Name</th>
                    <th className="p-3 text-center">CAT 1</th>
                    <th className="p-3 text-center">CAT 2</th>
                    <th className="p-3 text-center">CAT 3</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {(selectedMarksHistoryDetails.details || []).map((d: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="p-3 font-mono font-bold text-slate-900">{d.register_number}</td>
                      <td className="p-3 text-slate-800">{d.student_name}</td>
                      <td className="p-3 text-center font-bold text-slate-800">{d.marks?.cat1 ?? '—'}</td>
                      <td className="p-3 text-center font-bold text-slate-800">{d.marks?.cat2 ?? '—'}</td>
                      <td className="p-3 text-center font-bold text-slate-800">{d.marks?.cat3 ?? '—'}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          d.status === 'Updated' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
