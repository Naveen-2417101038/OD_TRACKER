import React from 'react';
import { Navigate } from 'react-router-dom';

export const FacultyDashboard: React.FC = () => {
  return <Navigate to="/mentor/dashboard" replace />;
};
