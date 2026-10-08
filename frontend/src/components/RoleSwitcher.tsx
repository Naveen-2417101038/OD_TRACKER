import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Users, UserCheck, GraduationCap, Building2, 
  Sparkles, Check, ChevronDown, ShieldAlert 
} from 'lucide-react';
import { getFacultyList, setCurrentFaculty, getCurrentFaculty } from '../data/mockData';
import { Faculty } from '../types/types';
import { useToast } from './Toast';

export const RoleSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const faculties = getFacultyList();
  const currentFaculty = getCurrentFaculty();
  const isStudentPortal = location.pathname.startsWith('/student');
  const isFacultyPortal = location.pathname.startsWith('/faculty') && location.pathname !== '/faculty/login';

  const handleSwitchToStudent = () => {
    localStorage.setItem('od_track_logged_in', 'true');
    setIsOpen(false);
    showToast('Switched to Student Portal (Naveen - 23CSD001)', 'info');
    navigate('/student/dashboard');
  };

  const handleSwitchToFaculty = (faculty: Faculty) => {
    setCurrentFaculty(faculty);
    localStorage.setItem('od_track_faculty_logged_in', 'true');
    setIsOpen(false);
    showToast(`Switched role to ${faculty.name} (${faculty.role})`, 'success');
    navigate('/faculty/dashboard');
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all border border-slate-200/80 shadow-xs"
        title="Quick Role Switcher for Design Thinking Demonstration"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
        <span className="hidden sm:inline">Role:</span>
        <span className="text-primary-700 font-black">
          {isStudentPortal ? 'Student (Naveen)' : `${currentFaculty.name} (${currentFaculty.role})`}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-slide-in p-2 space-y-1">
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-xl">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                Design Thinking Demo Switcher
              </span>
              <p className="text-[11px] text-slate-600 font-medium">Switch stakeholder view instantly:</p>
            </div>

            {/* Option 1: Student */}
            <button
              onClick={handleSwitchToStudent}
              className={`flex items-center gap-3 w-full p-2.5 rounded-xl text-left text-xs transition-colors ${
                isStudentPortal 
                  ? 'bg-primary-50 text-primary-800 font-bold border border-primary-100' 
                  : 'hover:bg-slate-50 text-slate-700 font-semibold'
              }`}
            >
              <div className="p-2 bg-blue-100 text-blue-700 rounded-lg flex-shrink-0">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate font-bold">Naveen (23CSD001)</p>
                <p className="text-[10px] text-slate-400">Student Portal</p>
              </div>
              {isStudentPortal && <Check className="w-4 h-4 text-primary-600" />}
            </button>

            {/* Faculty Roles */}
            {faculties.map((f) => {
              const isCurrent = isFacultyPortal && currentFaculty.faculty_id === f.faculty_id;
              return (
                <button
                  key={f.faculty_id}
                  onClick={() => handleSwitchToFaculty(f)}
                  className={`flex items-center gap-3 w-full p-2.5 rounded-xl text-left text-xs transition-colors ${
                    isCurrent 
                      ? 'bg-primary-50 text-primary-800 font-bold border border-primary-100' 
                      : 'hover:bg-slate-50 text-slate-700 font-semibold'
                  }`}
                >
                  <img
                    src={f.avatar}
                    alt={f.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-bold">{f.name}</p>
                    <p className="text-[10px] text-primary-600 font-semibold truncate">{f.role}</p>
                  </div>
                  {isCurrent && <Check className="w-4 h-4 text-primary-600" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
