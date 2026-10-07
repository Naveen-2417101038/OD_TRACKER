import React, { useState, useEffect } from 'react';
import { 
  Settings, Save, ShieldCheck, Bell, 
  Calendar, CheckCircle2, AlertCircle, RefreshCw, 
  Info, Sliders, Database, KeyRound
} from 'lucide-react';
import { apiGetAdminSettings, apiUpdateAdminSettings } from '../../services/api';
import { AdminSystemSettings } from '../../types/types';
import { useToast } from '../../components/Toast';

export const AdminSettings: React.FC = () => {
  const { showToast } = useToast();

  const [settings, setSettings] = useState<AdminSystemSettings>({
    id: 'SYSTEM_CONFIG',
    min_attendance_percent: 75.0,
    cgpa_exemption_threshold: 8.5,
    max_od_allowance_percent: 10.0,
    academic_year: '2025-2026',
    semester_working_days: 120,
    email_notifications_enabled: true,
    sms_notifications_enabled: false,
    auto_escalate_hours: 48
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await apiGetAdminSettings();
      if (res && res.success && res.data) {
        setSettings(res.data);
      } else {
        showToast('Failed to load system settings', 'error');
      }
    } catch {
      showToast('Network error loading settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiUpdateAdminSettings(settings);
      if (res && res.success) {
        showToast('Institutional policies & system settings saved successfully!', 'success');
        if (res.data) setSettings(res.data);
      } else {
        showToast(res?.error || 'Failed to update system settings', 'error');
      }
    } catch {
      showToast('Error updating settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Querying central system policy parameters...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Settings className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Institutional System Settings</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Centralized policy thresholds for OD eligibility, CGPA exemptions, notification triggers, and semester calendar configurations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Connected to Central Backend Engine
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Section 1: OD Eligibility & Academic Thresholds */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sliders className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              1. OD Eligibility & Academic Rules
            </h2>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            These rules are evaluated in real-time when students apply for OD, and when Mentors and Class Incharges audit eligibility.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
            
            {/* Min Attendance */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <label className="block font-bold text-slate-800">
                Minimum Attendance Threshold (%)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                required
                value={settings.min_attendance_percent}
                onChange={(e) => setSettings({ ...settings, min_attendance_percent: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-900 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[11px] text-slate-500">
                Students below this threshold receive <span className="font-semibold text-rose-600">"Attendance Below 75%"</span> and cannot apply.
              </p>
            </div>

            {/* CGPA Exemption */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <label className="block font-bold text-slate-800">
                CGPA Exemption Threshold
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                required
                value={settings.cgpa_exemption_threshold}
                onChange={(e) => setSettings({ ...settings, cgpa_exemption_threshold: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-900 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[11px] text-slate-500">
                Students with CGPA &ge; this value receive <span className="font-semibold text-purple-700">"No Limit — CGPA Above 8.5"</span> exemption.
              </p>
            </div>

            {/* Max OD Allowance */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <label className="block font-bold text-slate-800">
                Max OD Percentage Limit (%)
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="50"
                required
                value={settings.max_od_allowance_percent}
                onChange={(e) => setSettings({ ...settings, max_od_allowance_percent: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-900 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[11px] text-slate-500">
                Percentage of total semester working days allowed for OD ({settings.semester_working_days * (settings.max_od_allowance_percent / 100)} days).
              </p>
            </div>

          </div>
        </div>

        {/* Section 2: Academic Calendar & Semester Metrics */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Calendar className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              2. Academic Calendar & Duration Limits
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Active Academic Year
              </label>
              <input
                type="text"
                required
                value={settings.academic_year}
                onChange={(e) => setSettings({ ...settings, academic_year: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                placeholder="2025-2026"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Semester Total Working Days
              </label>
              <input
                type="number"
                min="60"
                max="200"
                required
                value={settings.semester_working_days}
                onChange={(e) => setSettings({ ...settings, semester_working_days: parseInt(e.target.value) || 120 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Notification & Escalation Triggers */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Bell className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              3. Automated Notifications & Workflow Settings
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.email_notifications_enabled}
                onChange={(e) => setSettings({ ...settings, email_notifications_enabled: e.target.checked })}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
              <div>
                <p className="font-bold text-slate-800">Enable Email Notifications</p>
                <p className="text-[11px] text-slate-500">Send automatic updates when OD applications are submitted or approved.</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.sms_notifications_enabled}
                onChange={(e) => setSettings({ ...settings, sms_notifications_enabled: e.target.checked })}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
              <div>
                <p className="font-bold text-slate-800">Enable SMS Alerts (Fast Broadcast)</p>
                <p className="text-[11px] text-slate-500">Urgent SMS notifications for event day OD sanctions.</p>
              </div>
            </label>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={loadSettings}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            Reset Form
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-md shadow-amber-600/25 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving System Parameters...' : 'Save Configuration Changes'}</span>
          </button>
        </div>

      </form>

    </div>
  );
};
