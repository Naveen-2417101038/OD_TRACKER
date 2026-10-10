import React from 'react';
import { Navigate } from 'react-router-dom';

export const HODAnalytics: React.FC = () => <Navigate to="/hod/dashboard" replace />;
export const HODDepartment: React.FC = () => <Navigate to="/hod/dashboard" replace />;
export const FacultyProfile: React.FC = () => <Navigate to="/mentor/dashboard" replace />;
export const PendingApprovals: React.FC = () => <Navigate to="/mentor/dashboard" replace />;
export const FacultyNotifications: React.FC = () => <Navigate to="/mentor/dashboard" replace />;
export const FacultyODHistory: React.FC = () => <Navigate to="/mentor/dashboard" replace />;
export const FacultyODRequests: React.FC = () => <Navigate to="/mentor/dashboard" replace />;
