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
      className={`bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-3.5 sm:p-4 transition-all ${className}`}
    >
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/70 dark:border-slate-700/70">
        <div className="flex items-center gap-2">
          {icon && (
            <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
};
