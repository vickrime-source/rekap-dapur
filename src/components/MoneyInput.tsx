import React, { useState, useEffect } from 'react';

export interface MoneyInputProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  id?: string;
  className?: string;
  onBlur?: () => void;
  helperText?: string;
  disabled?: boolean;
}

// Format integer to IDR: "Rp 150.000"
export const formatIDR = (val: number): string => {
  if (val === undefined || val === null || val === 0) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
};

// Parse numeric input from string to number
export const parseIDR = (input: string): number => {
  const digitsOnly = input.replace(/\D/g, '');
  return digitsOnly ? parseInt(digitsOnly, 10) : 0;
};

export const MoneyInput: React.FC<MoneyInputProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Rp 0',
  required = false,
  error,
  id,
  className = '',
  onBlur,
  helperText,
  disabled = false,
}) => {
  const [displayValue, setDisplayValue] = useState<string>(() => (value > 0 ? formatIDR(value) : ''));

  useEffect(() => {
    setDisplayValue(value > 0 ? formatIDR(value) : '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const num = parseIDR(raw);
    onChange(num);
    setDisplayValue(num > 0 ? formatIDR(num) : '');
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (value === 0) {
      setDisplayValue('');
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setDisplayValue(value > 0 ? formatIDR(value) : '');
    onBlur?.();
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          id={id}
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all ${
            error ? 'border-rose-400 dark:border-rose-500 bg-rose-50/20 dark:bg-rose-950/20' : 'border-slate-300 dark:border-slate-700'
          } ${disabled ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 cursor-not-allowed' : ''}`}
        />
      </div>
      {error ? (
        <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{helperText}</p>
      ) : null}
    </div>
  );
};
