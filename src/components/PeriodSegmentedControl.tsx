import React from 'react';
import { motion } from 'motion/react';
import { DashboardPeriod } from '../types';

interface PeriodSegmentedControlProps {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
  layoutIdPrefix?: string;
  className?: string;
  size?: 'sm' | 'md';
  rounded?: 'lg' | 'full';
}

const PERIOD_OPTIONS: { id: DashboardPeriod; label: string }[] = [
  { id: 'hari_ini', label: 'Hari Ini' },
  { id: 'mingguan', label: 'Mingguan' },
  { id: 'bulan_ini', label: 'Bulanan' },
  { id: 'all_time', label: 'All Time' },
];

export const PeriodSegmentedControl: React.FC<PeriodSegmentedControlProps> = ({
  value,
  onChange,
  layoutIdPrefix = 'period',
  className = '',
  size = 'md',
  rounded = 'full',
}) => {
  const isPill = rounded === 'full';

  return (
    <div
      role="tablist"
      aria-label="Pilih Periode"
      className={`relative flex items-center bg-slate-100/95 p-0.5 ${
        isPill ? 'rounded-full' : 'rounded-xl'
      } border border-slate-200/80 shadow-2xs w-full sm:w-auto justify-between sm:justify-start select-none ${className}`}
    >
      {PERIOD_OPTIONS.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.id)}
            className={`relative flex-1 sm:flex-none px-2.5 sm:px-3.5 py-1 text-xs font-bold transition-colors duration-200 whitespace-nowrap text-center cursor-pointer select-none ${
              isPill ? 'rounded-full' : 'rounded-lg'
            } ${
              isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId={`${layoutIdPrefix}-pill`}
                className={`absolute inset-0 bg-indigo-600 ${
                  isPill ? 'rounded-full' : 'rounded-lg'
                } shadow-xs shadow-indigo-600/30`}
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
