import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Unified Single Login Page
import { Login } from './pages/Login';
import { VerifyEmail } from './pages/VerifyEmail';
import { ResetPassword } from './pages/ResetPassword';

// 4 Dedicated Role Dashboards
import { Dashboard as StudentDashboard } from './pages/Dashboard';
import { MentorDashboard } from './pages/dashboards/MentorDashboard';
import { ClassInchargeDashboard } from './pages/dashboards/ClassInchargeDashboard';
import { HODDashboard } from './pages/dashboards/HODDashboard';

// Student Sub-Pages & Layout
import { ApplyOD } from './pages/ApplyOD';
import { ODRequests } from './pages/ODRequests';
import { ODHistory } from './pages/ODHistory';
import { Attendance } from './pages/Attendance';
import { CATMarks } from './pages/CATMarks';
import { Certificates } from './pages/Certificates';
import { Notifications } from './pages/Notifications';
import { Profile } from './pages/Profile';
import { StudentLayout } from './layouts/StudentLayout';

// Admin Sub-Pages & Layout
import { AdminLayout } from './layouts/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminStudents } from './pages/admin/AdminStudents';
import { AdminFaculty } from './pages/admin/AdminFaculty';
import { AdminODRequests } from './pages/admin/AdminODRequests';
import { AdminAcademic } from './pages/admin/AdminAcademic';
import { AdminCertificates } from './pages/admin/AdminCertificates';
import { AdminReports } from './pages/admin/AdminReports';
import { AdminAuditLogs } from './pages/admin/AdminAuditLogs';
import { AdminSettings } from './pages/admin/AdminSettings';
import { AdminLogin } from './pages/admin/AdminLogin';

// Toast & Auth Helpers
import { ToastProvider } from './components/Toast';
import { getAuthSession, getRoleDashboardPath } from './data/mockData';
import { UserRole } from './types/types';

// Protected Route Enforcing Strict Role-Based Access Control
interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const session = getAuthSession();

  // 1. Unauthenticated users -> redirect to dedicated portal
  if (!session) {
    if (allowedRoles.includes('Admin')) {
      return <Navigate to="/admin/login" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // 2. Unauthorized role access -> redirect to user's authorized role dashboard
  if (!allowedRoles.includes(session.role)) {
    if (allowedRoles.includes('Admin')) {
      return <Navigate to="/admin/login" replace />;
    }
    const targetDashboard = getRoleDashboardPath(session.role);
    return <Navigate to={targetDashboard} replace />;
  }

  // 3. Authorized -> render requested page
  return <>{children}</>;
};

// Root index redirect based on authentication state
const RootRedirect: React.FC = () => {
  const session = getAuthSession();
  if (session) {
    return <Navigate to={getRoleDashboardPath(session.role)} replace />;
  }
  return <Navigate to="/login" replace />;
};

// Main App Shell Router
const AppShell: React.FC = () => {
  const location = useLocation();
  const [session, setSession] = useState(getAuthSession());

  useEffect(() => {
    const handleAuth = () => setSession(getAuthSession());
    window.addEventListener('odAuthStateChanged', handleAuth);
    return () => window.removeEventListener('odAuthStateChanged', handleAuth);
  }, []);

  useEffect(() => {
    setSession(getAuthSession());
  }, [location.pathname]);

  return (
    <Routes>
      {/* 1. Root & Common Login Route */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/verify-email/:token" element={<VerifyEmail />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      {/* Redirect all legacy individual login URLs to the ONE Common Login Page */}
      <Route path="/student/login" element={<Navigate to="/login" replace />} />
      <Route path="/mentor/login" element={<Navigate to="/login" replace />} />
      <Route path="/faculty/login" element={<Navigate to="/login" replace />} />
      <Route path="/class-incharge/login" element={<Navigate to="/login" replace />} />
      <Route path="/hod/login" element={<Navigate to="/login" replace />} />
      <Route path="/counsellor/login" element={<Navigate to="/login" replace />} />
      <Route path="/directory" element={<Navigate to="/login" replace />} />
      <Route path="/portal" element={<Navigate to="/login" replace />} />
      <Route path="/all-dashboards" element={<Navigate to="/login" replace />} />
      <Route path="/unified" element={<Navigate to="/login" replace />} />

      {/* 2. STUDENT DEDICATED PROTECTED ROUTES */}
      <Route
        path="/student/*"
        element={
          <ProtectedRoute allowedRoles={['Student']}>
            <StudentLayout>
              <Routes>
                <Route path="dashboard" element={<StudentDashboard />} />
                <Route path="apply" element={<ApplyOD />} />
                <Route path="requests" element={<ODRequests />} />
                <Route path="requests/:id" element={<ODRequests />} />
                <Route path="history" element={<ODHistory />} />
                <Route path="attendance" element={<Attendance />} />
                <Route path="marks" element={<CATMarks />} />
                <Route path="certificates" element={<Certificates />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="profile" element={<Profile />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Routes>
            </StudentLayout>
          </ProtectedRoute>
        }
      />

      {/* 3. FACULTY / MENTOR DEDICATED PROTECTED ROUTES */}
      <Route
        path="/faculty/*"
        element={
          <ProtectedRoute allowedRoles={['Mentor']}>
            <Routes>
              <Route path="dashboard" element={<MentorDashboard />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </ProtectedRoute>
        }
      />
      <Route
        path="/mentor/*"
        element={
          <ProtectedRoute allowedRoles={['Mentor']}>
            <Routes>
              <Route path="dashboard" element={<MentorDashboard />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </ProtectedRoute>
        }
      />

      {/* 4. CLASS INCHARGE DEDICATED PROTECTED ROUTES */}
      <Route
        path="/class-incharge/*"
        element={
          <ProtectedRoute allowedRoles={['Class Incharge']}>
            <Routes>
              <Route path="dashboard" element={<ClassInchargeDashboard />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </ProtectedRoute>
        }
      />

      {/* 5. HOD DEDICATED PROTECTED ROUTES */}
      <Route
        path="/hod/*"
        element={
          <ProtectedRoute allowedRoles={['HOD']}>
            <Routes>
              <Route path="dashboard" element={<HODDashboard />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </ProtectedRoute>
        }
      />

      {/* 6. ADMIN DEDICATED PROTECTED ROUTES */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <AdminLayout>
              <Routes>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="students" element={<AdminStudents />} />
                <Route path="faculty" element={<AdminFaculty />} />
                <Route path="od-requests" element={<AdminODRequests />} />
                <Route path="academic" element={<AdminAcademic />} />
                <Route path="certificates" element={<AdminCertificates />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="audit-logs" element={<AdminAuditLogs />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Routes>
            </AdminLayout>
          </ProtectedRoute>
        }
      />

      {/* 7. Catch-all fallback */}
      <Route 
        path="*" 
        element={
          session 
            ? <Navigate to={getRoleDashboardPath(session.role)} replace /> 
            : <Navigate to="/login" replace />
        } 
      />
    </Routes>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <Router>
        <AppShell />
      </Router>
    </ToastProvider>
  );
}
