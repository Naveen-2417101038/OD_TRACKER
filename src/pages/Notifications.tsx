import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { Mail, ShieldCheck, CheckCircle2, ArrowRight, ListTodo, Send, Clock, AlertCircle } from 'lucide-react';
import { getStudentProfile } from '../data/mockData';

export const Notifications: React.FC = () => {
  const student = getStudentProfile();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-primary-600 p-2.5 rounded-2xl text-white shadow-md shadow-primary-600/30">
          <Mail className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Institutional Email Notifications</h1>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
            Primary & Only Official Communication Channel
          </p>
        </div>
      </div>

      {/* Main Notice Card */}
      <Card className="p-6 sm:p-8 space-y-6 border border-slate-200 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200 shrink-0">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-black text-slate-900">Email-Only Notification Policy Active</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              All OD application approvals, mentor recommendations, class incharge endorsements, HOD sanctions, certificate submission verifications, and security alerts are delivered directly to your official college email:
            </p>
            <div className="pt-2">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-900">
                <Mail className="w-3.5 h-3.5 text-primary-600" />
                {student?.email || 'student@rajalakshmi.edu.in'}
              </span>
            </div>
          </div>
        </div>

        {/* Workflow Delivery Breakdown */}
        <div className="border-t border-slate-100 pt-6 space-y-3">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Automated Notification Triggers Sent To Your Inbox:
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">OD Submission & Stage Forwarding</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Instant delivery when application progresses through Mentor, Class Incharge, and HOD.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">Final Sanctions & Attendance Credit</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Immediate receipt of HOD approval remarks and attendance update confirmations.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">Certificate Verifications & Reminders</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Automated reminders before the 5-day upload deadline expires and review updates.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">Security & Authentication Alerts</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Expiring 6-digit verification OTPs and instant password change confirmation notices.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="border-t border-slate-100 pt-6 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">
            Check your official inbox or spam folder if you do not receive an expected message.
          </span>
          <div className="flex gap-2">
            <Link
              to="/student/requests"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold transition-all shadow-sm shadow-primary-600/20"
            >
              <ListTodo className="w-3.5 h-3.5" />
              <span>View My OD Requests</span>
            </Link>
            <Link
              to="/student/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              <span>Back to Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
};
