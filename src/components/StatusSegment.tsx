import React from 'react';

export interface StatusSegmentOption<T extends string = string> {
  value: T;
  label: string;
  activeColor?: string; // Tailwind class like "bg-emerald-600 text-white" or "bg-rose-600 text-white"
}

export interface StatusSegmentProps<T extends string = string> {
  label: string;
  options: StatusSegmentOption<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
  idPrefix?: string;
}

export function StatusSegment<T extends string = string>({
  label,
  options,
  value,
  onChange,
  className = '',
  idPrefix = 'status-seg',
}: StatusSegmentProps<T>) {
  return (
    <div className={`w-full ${className}`}>
      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1">
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              id={`${idPrefix}-${opt.value.toLowerCase()}`}
              onClick={() => onChange(opt.value)}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center select-none ${
                isSelected
                  ? opt.activeColor || 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
