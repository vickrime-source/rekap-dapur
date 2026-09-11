import React from 'react';

export interface FormSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  subtitle,
  icon,
  children,
  className = '',
  action,
}) => {
  return (
    <div
      className={`bg-slate-50/70 border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 transition-all ${className}`}
    >
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/70">
        <div className="flex items-center gap-2">
          {icon && (
            <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[10.5px] text-slate-500 font-medium">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
};
