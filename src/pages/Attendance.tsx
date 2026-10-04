import React, { useState, useEffect } from 'react';
import { getAttendance, getAuthSession } from '../data/mockData';
import { apiGetMyAcademic } from '../services/api';
import { AttendanceSubject } from '../types/types';
import { Card } from '../components/Card';
import { Percent, Check, AlertTriangle, ShieldCheck, Award } from 'lucide-react';
import { useToast } from '../components/Toast';

export const Attendance: React.FC = () => {
  const { showToast } = useToast();
  const [attendance, setAttendance] = useState<AttendanceSubject[]>([]);
  const [officialAttendance, setOfficialAttendance] = useState<number | null>(null);
  const [odEligibility, setOdEligibility] = useState<any>(null);

  const loadData = () => {
    setAttendance(getAttendance());
    const session = getAuthSession();
    apiGetMyAcademic(session?.token).then(res => {
      if (res.success && res.attendance_percentage !== undefined) {
        setOfficialAttendance(res.attendance_percentage);
        if (res.eligibility) setOdEligibility(res.eligibility);
      }
    }).catch(() => {});
  };

  useEffect(() => {
    loadData();
    window.addEventListener('odStateUpdated', loadData);
    return () => window.removeEventListener('odStateUpdated', loadData);
  }, []);

  // Compute Overall Attendance
  const totalClassesSum = attendance.reduce((sum, sub) => sum + sub.totalClasses, 0);
  const totalCreditedSum = attendance.reduce((sum, sub) => sum + sub.attended, 0); 
  const calculatedPercent = totalClassesSum > 0 ? Math.round((totalCreditedSum / totalClassesSum) * 100) : 0;
  const overallPercent = officialAttendance !== null ? officialAttendance : calculatedPercent;

  const getProgressColor = (percent: number) => {
    if (percent >= 85) return 'text-emerald-500 stroke-emerald-500 bg-emerald-500';
    if (percent >= 75) return 'text-primary-600 stroke-primary-600 bg-primary-600';
    return 'text-rose-500 stroke-rose-500 bg-rose-500';
  };

  const getProgressBgColor = (percent: number) => {
    if (percent >= 85) return 'bg-emerald-500/10';
    if (percent >= 75) return 'bg-primary-500/10';
    return 'bg-rose-500/10';
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary-600 p-2 rounded-xl text-white">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Academic Attendance</h1>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Summary of subject-wise attendance and OD credits</p>
          </div>
        </div>
      </div>

      {/* Top Banner: Overall Attendance Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* Overall Percent Card */}
        <Card className="md:col-span-1 bg-gradient-to-br from-primary-600 to-blue-800 text-white border-none flex flex-col justify-between p-6">
          <div className="space-y-1">
            <span className="text-[10px] bg-white/20 text-white font-bold uppercase tracking-wider px-2 py-0.5 rounded">ERP Standard</span>
            <p className="text-slate-200 text-xs font-bold uppercase tracking-widest mt-2">Overall Attendance</p>
          </div>

          <div className="my-6">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-black">{overallPercent}%</span>
              <span className="text-sm font-semibold text-slate-300">credited</span>
            </div>
            <p className="text-xs text-slate-200 mt-2 font-medium">
              Required threshold: <span className="font-bold text-white">75%</span> for exam eligibility.
            </p>
          </div>

          <div className="text-xs bg-white/10 rounded-xl p-3 border border-white/10">
            ✅ Status: <strong className="text-white font-bold">Eligible</strong> for End-Semester examinations.
          </div>
        </Card>

        {/* OD Compensation Summary Card */}
        <Card className="md:col-span-2 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-2">OD Compensation Stats</h3>
            <p className="text-xs text-slate-400 font-semibold mb-4">How approved On-Duty requests affect your attendance</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/50 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Classes</span>
              <p className="text-2xl font-black text-slate-800 mt-1">{totalClassesSum}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/50 text-center">
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Attended</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {attendance.reduce((sum, sub) => sum + (sub.attended - sub.odApproved), 0)}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/50 text-center">
              <span className="text-[10px] font-bold text-primary-600 uppercase">OD Approved</span>
              <p className="text-2xl font-black text-primary-600 mt-1">
                {attendance.reduce((sum, sub) => sum + sub.odApproved, 0)}
              </p>
            </div>
          </div>

          {odEligibility && (
            <div className="mt-4 p-3 bg-teal-50 border border-teal-200/80 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-teal-900">10% Academic OD Allowance:</span>
                <span className="text-teal-700">Max allowed: <strong>{odEligibility.max_od_allowed_days} days</strong> ({odEligibility.max_od_allowed_percent}% based on attendance)</span>
              </div>
              <div className="text-teal-800 font-semibold text-[11px]">
                Consumed: <strong className="text-teal-950">{odEligibility.od_used_days}d</strong> • Remaining: <strong className="text-emerald-700">{odEligibility.remaining_od_days}d</strong>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400 mt-3 italic font-medium">
            * Note: Approved OD credits are integrated into the "Attended" count to protect your eligibility.
          </p>
        </Card>
      </div>

      {/* Subject-wise Cards Layout */}
      <div className="space-y-4">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Subject Breakdown</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {attendance.map((subject) => {
            const isEligible = subject.attendancePercent >= 75;
            const progressColor = getProgressColor(subject.attendancePercent);
            
            return (
              <Card key={subject.id} className="hover:scale-[1.005] hover:border-slate-300">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-slate-800">{subject.subjectName}</h4>
                    <span className="text-[10px] text-slate-400 font-semibold">CSD Department</span>
                  </div>

                  {/* Circular/Text Progress badge */}
                  <div className={`px-2.5 py-1 rounded-full text-xs font-black border flex items-center gap-1 ${
                    isEligible 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    <span>{subject.attendancePercent}%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4 w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      subject.attendancePercent >= 85 ? 'bg-emerald-500' :
                      subject.attendancePercent >= 75 ? 'bg-primary-600' :
                      'bg-rose-500'
                    }`}
                    style={{ width: `${subject.attendancePercent}%` }}
                  />
                </div>

                {/* Stats Breakdown Grid */}
                <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Total</p>
                    <p className="text-sm font-bold text-slate-700">{subject.totalClasses}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-emerald-600 uppercase">Attended</p>
                    <p className="text-sm font-bold text-emerald-600">{subject.attended - subject.odApproved}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-rose-500 uppercase">Absent</p>
                    <p className="text-sm font-bold text-rose-500">{subject.absent}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-primary-600 uppercase">OD Credit</p>
                    <p className="text-sm font-bold text-primary-600">{subject.odApproved}</p>
                  </div>
                </div>

              </Card>
            );
          })}
        </div>
      </div>

    </div>
  );
};
