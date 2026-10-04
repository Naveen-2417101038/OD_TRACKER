import React from 'react';
import { Navigate } from 'react-router-dom';

export const SubjectHandlerLogin: React.FC = () => {
  return <Navigate to="/login" replace />;
};
