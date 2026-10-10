import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileSpreadsheet, Download, CheckCircle2, 
  AlertTriangle, XCircle, Info, RefreshCw, Eye, 
  FileText, ArrowRight, ShieldCheck, Check, X, Clock
} from 'lucide-react';
import { 
  apiDownloadAcademicTemplate, 
  apiUploadAcademicExcel, 
  apiConfirmAcademicUpdate, 
  apiGetAcademicUploadHistory,
  AcademicRowPreview, 
  AcademicUploadSummary, 
  AcademicValidationError,
  AcademicUploadHistoryItem 
} from '../services/api';
import { getAuthSession, getClassStudents } from '../data/mockData';
import { useToast } from './Toast';

interface AcademicDataUploadProps {
  onUpdateSuccess?: () => void;
}

export const AcademicDataUpload: React.FC<AcademicDataUploadProps> = ({ onUpdateSuccess }) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File selection
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  // Preview & Validation State
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [summary, setSummary] = useState<AcademicUploadSummary | null>(null);
  const [previewRows, setPreviewRows] = useState<AcademicRowPreview[]>([]);
  const [errors, setErrors] = useState<AcademicValidationError[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [successResult, setSuccessResult] = useState<{ count: number; message: string } | null>(null);

  // Upload History State
  const [history, setHistory] = useState<AcademicUploadHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<AcademicUploadHistoryItem | null>(null);

  const loadUploadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const session = getAuthSession();
      const res = await apiGetAcademicUploadHistory(session?.token);
      if (res.success && Array.isArray(res.history)) {
        setHistory(res.history);
      }
    } catch (err) {
      console.warn('Failed to load upload history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadUploadHistory();
  }, []);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Download Sample Template
  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    const session = getAuthSession();
    const res = await apiDownloadAcademicTemplate(session?.token);
    setIsDownloadingTemplate(false);
    if (res.success) {
      showToast('Sample Excel template downloaded successfully.', 'success');
    } else {
      showToast(res.error || 'Failed to download template.', 'error');
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      showToast('Invalid file format. Please upload a .xlsx or .xls file only.', 'error');
      return;
    }
    setSelectedFile(file);
    setPreviewToken(null);
    setSummary(null);
    setPreviewRows([]);
    setErrors([]);
    setSuccessResult(null);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewToken(null);
    setSummary(null);
    setPreviewRows([]);
    setErrors([]);
    setSuccessResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload & Preview
  const handleUploadAndPreview = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setSuccessResult(null);

    const session = getAuthSession();
    const res = await apiUploadAcademicExcel(selectedFile, session?.token);
    setIsUploading(false);

    if (res.success && res.summary) {
      setPreviewToken(res.preview_token || null);
      setSummary(res.summary);
      setPreviewRows(res.rows || []);
      setErrors(res.errors || []);

      if (res.errors && res.errors.length > 0) {
        showToast(`Validation found ${res.errors.length} error(s). Please review row corrections below.`, 'error');
      } else {
        showToast(`Parsed ${res.summary.total_rows} row(s). ${res.summary.matched_count} student(s) matched. Ready to confirm.`, 'success');
      }
    } else {
      showToast(res.error || 'Failed to process Excel spreadsheet.', 'error');
      setErrors(res.errors || []);
    }
  };

  // Confirm Database Update
  const handleConfirmUpdate = async () => {
    if (!previewToken && previewRows.length === 0) return;
    setIsConfirming(true);

    const session = getAuthSession();
    const res = await apiConfirmAcademicUpdate(previewToken || undefined, previewRows, session?.token);
    setIsConfirming(false);

    if (res.success) {
      const updatedCount = res.updated_count || previewRows.filter(r => r.match_status === 'Matched' && r.validation_status === 'Valid').length;
      setSuccessResult({
        count: updatedCount,
        message: res.message || `Academic data updated successfully. ${updatedCount} student record(s) updated.`
      });

      // Update local storage so that offline mock records also mirror the changes
      try {
        const localStudents = getClassStudents();
        const updatedLocal = localStudents.map(st => {
          const matchedRow = previewRows.find(
            r => r.register_number.trim().toUpperCase() === st.registerNumber.trim().toUpperCase()
          );
          if (matchedRow && matchedRow.match_status === 'Matched' && matchedRow.validation_status === 'Valid') {
            return {
              ...st,
              attendancePercent: matchedRow.attendance !== null ? matchedRow.attendance : st.attendancePercent,
              cat1Average: matchedRow.cat1 !== null ? matchedRow.cat1 : st.cat1Average,
              cat2Average: matchedRow.cat2 !== null ? matchedRow.cat2 : st.cat2Average,
            };
          }
          return st;
        });
        localStorage.setItem('rec_od_class_students', JSON.stringify(updatedLocal));
      } catch (err) {
        console.warn('Could not sync local student storage:', err);
      }

      showToast(`✓ Academic data updated successfully. ${updatedCount} student records updated.`, 'success');

      // Refresh upload history and notify parent
      loadUploadHistory();
      if (onUpdateSuccess) {
        onUpdateSuccess();
      }
      window.dispatchEvent(new CustomEvent('odStateUpdated'));
      window.dispatchEvent(new CustomEvent('odFacultyStateUpdated'));
    } else {
      showToast(res.error || 'Database transaction update failed.', 'error');
    }
  };

  return (
    <div className="space-y-6">

      {/* ─── Top Header Card ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 md:p-8 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="bg-teal-50 text-teal-700 border border-teal-200 text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Class Incharge Exclusive
              </span>
              <span className="text-xs text-slate-400 font-bold">Continuous Assessment & Attendance</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Academic Data Upload</h2>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Upload section Excel sheets with student Continuous Assessment Test scores (CAT 1, CAT 2, CAT 3) 
              and current attendance percentages. The system parses the spreadsheet, validates marks, matches registered student profiles, 
              and transactionally updates the live attendance used for university exam &amp; 10% OD eligibility calculations.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 self-start md:self-center shrink-0">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={isDownloadingTemplate}
              className="px-4 py-2.5 rounded-xl border border-teal-200 bg-teal-50/80 hover:bg-teal-100 text-teal-800 text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              {isDownloadingTemplate ? (
                <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
              ) : (
                <Download className="w-4 h-4 text-teal-600" />
              )}
              <span>Download Sample Excel Template</span>
            </button>
          </div>
        </div>

        {/* Column Specs & Guide Banner */}
        <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Info className="w-4 h-4 text-teal-600" />
              <span>Expected Excel Column Structure</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-medium text-slate-600 border border-slate-200 rounded-lg overflow-hidden bg-white">
                <thead className="bg-slate-100 font-bold text-slate-700 text-left">
                  <tr>
                    <th className="p-1.5 border-b border-slate-200">Register Number</th>
                    <th className="p-1.5 border-b border-slate-200">Student Name</th>
                    <th className="p-1.5 border-b border-slate-200">CAT 1</th>
                    <th className="p-1.5 border-b border-slate-200">CAT 2</th>
                    <th className="p-1.5 border-b border-slate-200">CAT 3</th>
                    <th className="p-1.5 border-b border-slate-200">Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="p-1.5 font-bold text-teal-700">23CSD001</td>
                    <td className="p-1.5">Naveen</td>
                    <td className="p-1.5">86</td>
                    <td className="p-1.5">91</td>
                    <td className="p-1.5">88</td>
                    <td className="p-1.5 font-bold text-emerald-600">88.5</td>
                  </tr>
                  <tr>
                    <td className="p-1.5 font-bold text-teal-700">23CSD002</td>
                    <td className="p-1.5">Priya S</td>
                    <td className="p-1.5">94</td>
                    <td className="p-1.5">96</td>
                    <td className="p-1.5">92</td>
                    <td className="p-1.5 font-bold text-emerald-600">92.1</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 text-xs space-y-2 flex flex-col justify-center">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Safety &amp; Compliance Rules
            </span>
            <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
              <li><strong>Student Matching:</strong> Uses Register Number / Student ID. Never creates duplicate student accounts.</li>
              <li><strong>Mark Bounds:</strong> CAT scores must be numeric between 0 and 100. Blank cells are handled safely.</li>
              <li><strong>Attendance Range:</strong> Attendance percentage must be strictly between 0.0% and 100.0%.</li>
              <li><strong>Preview First:</strong> All records are previewed and verified before database confirmation.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ─── Upload Area ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 md:p-8 shadow-xs space-y-6">
        <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
          <Upload className="w-4 h-4 text-teal-600" />
          <span>Upload Spreadsheet</span>
        </h3>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-8 md:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-3 ${
            isDragging
              ? 'border-teal-500 bg-teal-50/50 scale-[1.005]'
              : selectedFile
              ? 'border-emerald-400 bg-emerald-50/20'
              : 'border-slate-200 hover:border-teal-400 hover:bg-slate-50/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform ${
            selectedFile ? 'bg-emerald-100 text-emerald-700' : 'bg-teal-50 text-teal-600'
          }`}>
            <FileSpreadsheet className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-800">
              {selectedFile ? 'Selected File Ready' : 'Drag & drop Excel spreadsheet here'}
            </h4>
            <p className="text-xs text-slate-500">
              {selectedFile ? 'Click or drag another file to replace' : 'or click Browse to choose from your computer'}
            </p>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <span>Accepted formats: .XLSX, .XLS</span>
            <span>•</span>
            <span>Max Size: 16 MB</span>
          </div>
        </div>

        {/* Selected File Details Bar */}
        {selectedFile && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-teal-600 text-white p-2 rounded-xl">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-xs">{selectedFile.name}</p>
                <p className="text-[11px] text-slate-500 font-medium">Size: {formatFileSize(selectedFile.size)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={handleClearFile}
                className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>

              <button
                type="button"
                onClick={handleUploadAndPreview}
                disabled={isUploading}
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-sm"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Validating &amp; Matching...</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Upload &amp; Preview</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Validation Failure Banner ────────────────────────────────────── */}
      {errors.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-black text-rose-900 text-sm">Upload validation failed. Please correct the following rows.</h4>
              <p className="text-xs text-rose-700 mt-0.5">
                The database update has been withheld. To prevent partial or corrupt student records, 
                please fix the indicated issues in your Excel spreadsheet and upload again.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto bg-white rounded-2xl border border-rose-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-rose-100/60 text-rose-900 font-bold uppercase tracking-wider text-[10px] border-b border-rose-200">
                <tr>
                  <th className="p-3">Row No</th>
                  <th className="p-3">Register Number</th>
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Problem Detected</th>
                  <th className="p-3">Suggested Correction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100 font-medium">
                {errors.map((err, idx) => (
                  <tr key={idx} className="hover:bg-rose-50/50">
                    <td className="p-3 font-bold text-rose-800">Row {err.row}</td>
                    <td className="p-3 font-mono font-bold text-slate-800">{err.register_number}</td>
                    <td className="p-3 text-slate-700">{err.student_name}</td>
                    <td className="p-3 text-rose-700 font-semibold">{err.problem}</td>
                    <td className="p-3 text-slate-600">{err.correction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Success Confirmation Alert ───────────────────────────────────── */}
      {successResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-black text-emerald-900 text-sm">✓ Academic data updated successfully.</h4>
              <p className="text-xs text-emerald-700 mt-1 font-medium">
                {successResult.count} student record(s) updated in the database. Attendance percentages, CAT marks, 
                and 10% OD allowances are now actively synchronized across all Student, Faculty, Class Incharge, and HOD views.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearFile}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 transition-colors"
          >
            Upload Another
          </button>
        </div>
      )}

      {/* ─── Preview Table & Summary ──────────────────────────────────────── */}
      {summary && previewRows.length > 0 && !successResult && (
        <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs space-y-6 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-black text-base text-slate-900">Upload Summary &amp; Verification Preview</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review matched student records below before committing changes to the permanent database.
              </p>
            </div>

            {summary.can_confirm && (
              <button
                type="button"
                onClick={handleConfirmUpdate}
                disabled={isConfirming}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                {isConfirming ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Writing to Database...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm &amp; Update Students ({summary.matched_count})</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Records</span>
              <span className="text-xl font-black text-slate-800 mt-0.5 block">{summary.total_rows}</span>
            </div>
            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Matched Students</span>
              <span className="text-xl font-black text-emerald-700 mt-0.5 block">{summary.matched_count}</span>
            </div>
            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-center">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Unmatched</span>
              <span className="text-xl font-black text-amber-700 mt-0.5 block">{summary.unmatched_count}</span>
            </div>
            <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 text-center">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Invalid Rows</span>
              <span className="text-xl font-black text-rose-700 mt-0.5 block">{summary.invalid_count}</span>
            </div>
          </div>

          {/* Preview Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Row</th>
                  <th className="p-3.5">Register Number</th>
                  <th className="p-3.5">Student Name</th>
                  <th className="p-3.5 text-center">CAT 1</th>
                  <th className="p-3.5 text-center">CAT 2</th>
                  <th className="p-3.5 text-center">CAT 3</th>
                  <th className="p-3.5 text-center">Attendance %</th>
                  <th className="p-3.5 text-center">Match Status</th>
                  <th className="p-3.5 text-center">Validation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {previewRows.map((r, idx) => (
                  <tr key={idx} className={r.validation_status === 'Error' ? 'bg-rose-50/40' : 'hover:bg-slate-50/80'}>
                    <td className="p-3.5 font-bold text-slate-500">#{r.row_number}</td>
                    <td className="p-3.5 font-mono font-bold text-slate-800">{r.register_number}</td>
                    <td className="p-3.5 font-bold text-slate-900">{r.student_name}</td>
                    <td className="p-3.5 text-center font-semibold text-slate-700">{r.cat1 !== null ? `${r.cat1}` : '—'}</td>
                    <td className="p-3.5 text-center font-semibold text-slate-700">{r.cat2 !== null ? `${r.cat2}` : '—'}</td>
                    <td className="p-3.5 text-center font-semibold text-slate-700">{r.cat3 !== null ? `${r.cat3}` : '—'}</td>
                    <td className="p-3.5 text-center">
                      {r.attendance !== null ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                          r.attendance >= 85 ? 'bg-emerald-100 text-emerald-800' :
                          r.attendance >= 75 ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {r.attendance}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-3.5 text-center">
                      {r.match_status === 'Matched' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Matched
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <AlertTriangle className="w-3 h-3" /> Not Found
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      {r.validation_status === 'Valid' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                          Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200" title={r.errors?.join('; ')}>
                          <XCircle className="w-3 h-3" /> Error
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Confirmation Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <span className="text-xs text-slate-500 font-medium">
              {summary.can_confirm ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Ready to update. Click the button to commit.
                </span>
              ) : (
                <span className="text-rose-700 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Fix invalid rows before confirming database update.
                </span>
              )}
            </span>

            {summary.can_confirm && (
              <button
                type="button"
                onClick={handleConfirmUpdate}
                disabled={isConfirming}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                {isConfirming ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Writing to Database...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm &amp; Update Students ({summary.matched_count})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Upload History Section (Requirement 11) ──────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              <span>Academic Upload History Archive</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Audit log of all past Excel marksheets uploaded and committed by Class Incharge.</p>
          </div>
          <button
            type="button"
            onClick={loadUploadHistory}
            disabled={isLoadingHistory}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-bold transition-colors"
            title="Refresh history"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin text-teal-600' : ''}`} />
          </button>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 font-medium">
            No previous academic upload archives found. Upload your first Excel file above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-4">Upload Date</th>
                  <th className="p-4">Uploaded By</th>
                  <th className="p-4">File Name</th>
                  <th className="p-4 text-center">Total Rows</th>
                  <th className="p-4 text-center">Successful Updates</th>
                  <th className="p-4 text-center">Unmatched</th>
                  <th className="p-4 text-center">Invalid Rows</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-bold text-slate-700">{item.upload_date}</td>
                    <td className="p-4 text-slate-900 font-semibold">{item.uploaded_by_name || 'Class Incharge'}</td>
                    <td className="p-4 font-mono text-slate-700 text-[11px]">{item.file_name}</td>
                    <td className="p-4 text-center font-bold text-slate-800">{item.total_rows}</td>
                    <td className="p-4 text-center font-bold text-emerald-700">{item.successful_updates}</td>
                    <td className="p-4 text-center font-bold text-amber-700">{item.unmatched_count}</td>
                    <td className="p-4 text-center font-bold text-rose-700">{item.invalid_count}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        item.status === 'Completed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : item.status.includes('warning')
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedHistoryItem(item)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs"
                      >
                        View Logs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── History Item Detail Modal ────────────────────────────────────── */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-black text-slate-900 text-sm">Upload Audit Details: {selectedHistoryItem.file_name}</h4>
                <p className="text-xs text-slate-500">{selectedHistoryItem.upload_date} • By {selectedHistoryItem.uploaded_by_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoryItem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total</span>
                  <span className="font-black text-slate-800 text-base">{selectedHistoryItem.total_rows}</span>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-emerald-600 uppercase font-bold block">Updated</span>
                  <span className="font-black text-emerald-700 text-base">{selectedHistoryItem.successful_updates}</span>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-[10px] text-amber-600 uppercase font-bold block">Unmatched</span>
                  <span className="font-black text-amber-700 text-base">{selectedHistoryItem.unmatched_count}</span>
                </div>
                <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200">
                  <span className="text-[10px] text-rose-600 uppercase font-bold block">Invalid</span>
                  <span className="font-black text-rose-700 text-base">{selectedHistoryItem.invalid_count}</span>
                </div>
              </div>

              {selectedHistoryItem.details && selectedHistoryItem.details.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b">
                      <tr>
                        <th className="p-2.5">Row</th>
                        <th className="p-2.5">Reg No</th>
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5 text-center">Att %</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                      {selectedHistoryItem.details.map((d: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-500">#{d.row_number || idx + 1}</td>
                          <td className="p-2.5 font-mono font-bold text-slate-800">{d.register_number || 'N/A'}</td>
                          <td className="p-2.5">{d.student_name || 'N/A'}</td>
                          <td className="p-2.5 text-center font-bold">{d.attendance !== undefined ? `${d.attendance}%` : '—'}</td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              d.match_status === 'Matched' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {d.match_status || 'Processed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">No granular row logs recorded for this transaction.</p>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedHistoryItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
