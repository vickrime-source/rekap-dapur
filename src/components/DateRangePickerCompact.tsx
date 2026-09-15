import React from 'react';
import { Calendar, X } from 'lucide-react';

export interface DateRange {
  start: string;
  end: string;
}

interface DateRangePickerCompactProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

export const DateRangePickerCompact: React.FC<DateRangePickerCompactProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const isFiltered = Boolean(value.start || value.end);

  const handleClear = () => {
    onChange({ start: '', end: '' });
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border ${
        isFiltered
          ? 'border-indigo-300 ring-2 ring-indigo-500/15 bg-indigo-50/40 text-indigo-950'
          : 'border-slate-200/90 text-slate-700 hover:border-slate-300'
      } rounded-xl shadow-2xs transition-all text-xs ${className}`}
    >
      <div className="flex items-center gap-1.5 text-slate-500 shrink-0">
        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
          Rentang:
        </span>
      </div>

      {/* Tanggal Mulai */}
      <input
        type="date"
        value={value.start}
        onChange={(e) => onChange({ ...value, start: e.target.value })}
        aria-label="Tanggal mulai"
        title="Pilih tanggal mulai"
        className="bg-transparent border-b border-dashed border-slate-300 hover:border-indigo-500 focus:border-indigo-600 text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer py-0.5 px-1 max-w-[125px]"
      />

      <span className="text-slate-400 text-[11px] font-medium select-none">s/d</span>

      {/* Tanggal Selesai */}
      <input
        type="date"
        value={value.end}
        min={value.start || undefined}
        onChange={(e) => onChange({ ...value, end: e.target.value })}
        aria-label="Tanggal selesai"
        title="Pilih tanggal selesai"
        className="bg-transparent border-b border-dashed border-slate-300 hover:border-indigo-500 focus:border-indigo-600 text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer py-0.5 px-1 max-w-[125px]"
      />

      {/* Reset button when range is set */}
      {isFiltered ? (
        <button
          type="button"
          onClick={handleClear}
          title="Reset ke Seluruh Data"
          className="ml-0.5 p-0.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      ) : (
        <span className="text-[10px] text-slate-400 italic pr-0.5 select-none">
          (Semua data)
        </span>
      )}
    </div>
  );
};
