import React, { useState, useEffect } from 'react';
import { getStudentProfile, saveStudentProfile } from '../data/mockData';
import { Student } from '../types/types';
import { Card } from '../components/Card';
import { User, Phone, Mail, Award, BookOpen, Shield, Edit2, CheckCircle, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { useToast } from '../components/Toast';
import { ChangePasswordModal } from '../components/ChangePasswordModal';

export const Profile: React.FC = () => {
  const { showToast } = useToast();
  
  const [student, setStudent] = useState<Student | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    profilePhoto: '',
  });


  const loadData = () => {
    const data = getStudentProfile();
    setStudent(data);
    setEditForm({
      name: data.name,
      email: data.email,
      phone: data.phone,
      profilePhoto: data.profilePhoto,
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    if (!editForm.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    if (!editForm.email.includes('@')) {
      showToast('Please enter a valid email', 'error');
      return;
    }

    const updatedStudent: Student = {
      ...student,
      name: editForm.name,
      email: editForm.email,
      phone: editForm.phone,
      profilePhoto: editForm.profilePhoto || student.profilePhoto,
    };

    saveStudentProfile(updatedStudent);
    setStudent(updatedStudent);
    setIsEditing(false);
    showToast('Profile updated successfully!', 'success');
    
    // Dispatch custom event to sync layout header
    window.dispatchEvent(new CustomEvent('odStateUpdated'));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-primary-600 p-2 rounded-xl text-white">
          <User className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Student Profile</h1>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">ERP database registry information</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Profile Card Left */}
        <Card className="md:col-span-4 flex flex-col items-center text-center p-6 space-y-4">
          <div className="relative group">
            <img
              src={student?.profilePhoto}
              alt={student?.name}
              className="w-32 h-32 rounded-full object-cover border-4 border-primary-50 shadow-md"
            />
            {isEditing && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                Change URL
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-black text-slate-800 leading-tight">{student?.name}</h2>
            <p className="text-xs text-slate-400 font-bold tracking-wider mt-0.5">{student?.registerNumber}</p>
          </div>

          <div className="w-full pt-4 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 font-medium">
              <span>Overall Attendance</span>
              <strong className="text-emerald-600">{student?.attendancePercent || 88.5}%</strong>
            </div>
            <div className="flex justify-between text-slate-600 font-medium">
              <span>Cumulative CGPA</span>
              <strong className="text-primary-600">{student?.cgpa || 8.92}</strong>
            </div>
          </div>

          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-colors mt-2"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Contact Info</span>
            </button>
          )}
        </Card>

        {/* Profile Details Right */}
        <Card className="md:col-span-8 p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <h3 className="font-black text-sm uppercase tracking-wider text-slate-800">Academic & Mentorship Registry</h3>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Enrolled Active
            </span>
          </div>

          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-slate-400 font-bold uppercase">Full Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-bold uppercase">Official Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-bold uppercase">Mobile Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-bold uppercase">Avatar Image URL</label>
                  <input
                    type="text"
                    value={editForm.profilePhoto}
                    onChange={(e) => setEditForm({ ...editForm, profilePhoto: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md shadow-primary-200"
                >
                  Save Profile
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4 text-xs font-semibold text-slate-700">
              
              {/* Department */}
              <div className="flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Department</p>
                  <p className="text-slate-800 mt-0.5 font-bold">{student?.department}</p>
                </div>
              </div>

              {/* Year & Sec */}
              <div className="flex items-start gap-3">
                <Award className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Academic Placement</p>
                  <p className="text-slate-800 mt-0.5 font-bold">{student?.year} - Section {student?.section}</p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Email Address</p>
                  <a href={`mailto:${student?.email}`} className="text-primary-600 hover:underline mt-0.5 block font-bold">
                    {student?.email}
                  </a>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Contact Number</p>
                  <p className="text-slate-800 mt-0.5 font-bold">{student?.phone}</p>
                </div>
              </div>

              {/* Faculty Mentor */}
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Assigned Faculty Mentor</p>
                  <p className="text-slate-800 mt-0.5 font-bold">{student?.mentor || 'Dr. A. Rajesh (ASP/CSD)'}</p>
                </div>
              </div>

              {/* Class Incharge */}
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Class Incharge</p>
                  <p className="text-slate-800 mt-0.5 font-bold">{student?.classIncharge || 'Mrs. K. Shanthi (AP/CSD)'}</p>
                </div>
              </div>

            </div>
          )}
        </Card>

      </div>

      {/* Account Security & Password Management Card */}
      <Card className="p-6 border border-slate-200">
        <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 border border-amber-200">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Account Security & Password</h3>
              <p className="text-xs text-slate-400">Manage your institutional account authentication credentials</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsChangePasswordOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm shadow-amber-600/20 cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            <span>Change Password</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Lock className="w-4 h-4 text-primary-600" />
              <span>Method A: Current Password</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Verify your active password and set a new password of at least 6 characters. Instant security confirmation delivered to email.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Mail className="w-4 h-4 text-amber-600" />
              <span>Method B: Email OTP Verification</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Dispatch a 6-digit cryptographically secure OTP to your registered college email ({student?.email}). Valid for 5 minutes.
            </p>
          </div>
        </div>
      </Card>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        userEmail={student?.email}
      />

    </div>
  );
};
