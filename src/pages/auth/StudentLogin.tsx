import React from 'react';
import { Navigate } from 'react-router-dom';

export const StudentLogin: React.FC = () => {
  return <Navigate to="/login" replace />;
};
