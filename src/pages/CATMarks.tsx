import React, { useState, useEffect } from 'react';
import { getCATMarks, getAuthSession } from '../data/mockData';
import { apiGetMyAcademic } from '../services/api';
import { CATMarksEntry } from '../types/types';
import { Card } from '../components/Card';
import { GraduationCap, Award, CheckCircle, BarChart3, TrendingUp, Sparkles } from 'lucide-react';
import { useToast } from '../components/Toast';

export const CATMarks: React.FC = () => {
  const { showToast } = useToast();
  const [marks, setMarks] = useState<CATMarksEntry[]>([]);
  const [liveAcademic, setLiveAcademic] = useState<{
    cat1: number | null;
    cat2: number | null;
    cat3: number | null;
    lastUpdated?: string;
  } | null>(null);

  useEffect(() => {
    setMarks(getCATMarks());
    const session = getAuthSession();
    apiGetMyAcademic(session?.token).then(res => {
      if (res.success && (res.cat1_marks !== undefined || res.cat2_marks !== undefined || res.cat3_marks !== undefined)) {
        setLiveAcademic({
          cat1: res.cat1_marks ?? null,
          cat2: res.cat2_marks ?? null,
          cat3: res.cat3_marks ?? null,
          lastUpdated: res.last_updated
        });
      }
    }).catch(() => {});
  }, []);

  const overallAverage = marks.length > 0 
    ? (marks.reduce((sum, m) => sum + m.average, 0) / marks.length).toFixed(1)
    : '0.0';

  const getScoreRating = (avg: number) => {
    if (avg >= 85) return { label: 'Excellent', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' };
    if (avg >= 80) return { label: 'Good', color: 'text-primary-700 bg-primary-50 border-primary-100' };
    return { label: 'Average', color: 'text-amber-700 bg-amber-50 border-amber-100' };
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary-600 p-2 rounded-xl text-white">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">CAT Examination Marks</h1>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Academic grading logs for Continuous Assessment Tests</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Overall Score Card */}
        <Card className="flex items-center gap-4">
          <div className="bg-primary-50 p-4 rounded-2xl text-primary-600 border border-primary-100">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall CAT Average</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{overallAverage} / 100</h3>
          </div>
        </Card>

        {/* Top Performer Card */}
        <Card className="flex items-center gap-4">
          <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600 border border-emerald-100">
            <Award className="w-6 h-6 animate-bounce" style={{ animationDuration: '4s' }} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Highest Scored Subject</p>
            <h3 className="text-base font-black text-slate-800 mt-1">Design Thinking</h3>
            <p className="text-[10px] text-slate-500 font-semibold">Average: 87.0%</p>
          </div>
        </Card>

        {/* Exams Status Card */}
        <Card className="flex items-center gap-4">
          <div className="bg-blue-50 p-4 rounded-2xl text-blue-600 border border-blue-100">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Exams Status</p>
            <h3 className="text-base font-black text-slate-800 mt-1">CAT 1 & CAT 2 Completed</h3>
            <p className="text-[10px] text-slate-500 font-semibold">Semester Exam eligible</p>
          </div>
        </Card>

      </div>

      {/* Confirmed Academic Marks Banner from Class Incharge */}
      {liveAcademic && (
        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-teal-600 text-white p-3 rounded-2xl shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] bg-teal-200/60 text-teal-800 font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                Class Incharge Confirmed
              </span>
              <h3 className="text-base font-black text-slate-900 mt-1">Official Continuous Assessment Scores</h3>
              <p className="text-xs text-slate-600">
                Synchronized directly from the institutional academic ledger • {liveAcademic.lastUpdated ? `Updated ${liveAcademic.lastUpdated}` : 'Current Semester'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white px-4 py-2.5 rounded-2xl border border-teal-100 text-center shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CAT 1</span>
              <span className="text-lg font-black text-slate-800">{liveAcademic.cat1 !== null ? `${liveAcademic.cat1}` : '—'}</span>
            </div>
            <div className="bg-white px-4 py-2.5 rounded-2xl border border-teal-100 text-center shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CAT 2</span>
              <span className="text-lg font-black text-slate-800">{liveAcademic.cat2 !== null ? `${liveAcademic.cat2}` : '—'}</span>
            </div>
            <div className="bg-white px-4 py-2.5 rounded-2xl border border-teal-100 text-center shadow-xs">
              <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">CAT 3</span>
              <span className="text-lg font-black text-teal-700">{liveAcademic.cat3 !== null ? `${liveAcademic.cat3}` : '—'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Marks Table Layout */}
      <Card>
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <BarChart3 className="w-5 h-5 text-slate-500" />
          <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wider">Internal Marksheet</h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="pb-3">Subject Name</th>
                <th className="pb-3 text-center">CAT 1 (100)</th>
                <th className="pb-3 text-center">CAT 2 (100)</th>
                <th className="pb-3 text-center">CAT 3 (100)</th>
                <th className="pb-3 text-center">Average Scored</th>
                <th className="pb-3 hidden sm:table-cell text-center">Performance Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {marks.map((entry) => {
                const rating = getScoreRating(entry.average);
                return (
                  <tr key={entry.id} className="hover:bg-slate-50/40">
                    <td className="py-4 text-slate-800 font-bold">{entry.subjectName}</td>
                    <td className="py-4 text-center text-slate-600 font-medium">{entry.cat1 ?? '-'}</td>
                    <td className="py-4 text-center text-slate-600 font-medium">{entry.cat2 ?? '-'}</td>
                    <td className="py-4 text-center text-slate-600 font-medium">{entry.cat3 ?? (liveAcademic?.cat3 ?? '-')}</td>
                    <td className="py-4 text-center">
                      <span className="text-primary-600 font-bold">{entry.average}%</span>
                    </td>
                    <td className="py-4 hidden sm:table-cell text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${rating.color}`}>
                        {rating.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
};
