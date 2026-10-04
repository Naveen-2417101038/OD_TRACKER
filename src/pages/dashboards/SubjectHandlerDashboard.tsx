import React from 'react';
import { Navigate } from 'react-router-dom';

export const SubjectHandlerDashboard: React.FC = () => {
  return <Navigate to="/mentor/dashboard" replace />;
};
