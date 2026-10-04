import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div 
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-soft p-5 md:p-6 transition-all duration-300 ${className}`} 
      {...props}
    >
      {children}
    </div>
  );
};
