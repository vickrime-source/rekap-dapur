import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, X, ChevronDown } from 'lucide-react';
import { getTodayWIB, getYesterdayWIB, formatTanggalSimple } from '../lib/formatters';

export interface DateFilterValue {
  startDate?: string; // YYYY-MM-DD (empty = no filter / all time)
  endDate?: string;   // YYYY-MM-DD (empty = no filter / all time)
  type?: string;
  specificDate?: string;
}

interface DateFilterPillProps {
  value: DateFilterValue;
  onChange: (val: DateFilterValue) => void;
  className?: string;
  labelPrefix?: string;
}

export function getThisWeekRange(): { start: string; end: string } {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const wib = new Date(utc + 7 * 3600000);
  const day = wib.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(wib);
  monday.setDate(wib.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayStr}`;
  };
  return { start: fmt(monday), end: fmt(sunday) };
}

export function getThisMonthRange(): { start: string; end: string } {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const wib = new Date(utc + 7 * 3600000);
  const y = wib.getFullYear();
  const m = wib.getMonth();
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);

  const fmt = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${dayStr}`;
  };
  return { start: fmt(firstDay), end: fmt(lastDay) };
}

export function getLastMonthRange(): { start: string; end: string } {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const wib = new Date(utc + 7 * 3600000);
  const y = wib.getFullYear();
  const m = wib.getMonth();
  const firstDay = new Date(y, m - 1, 1);
  const lastDay = new Date(y, m, 0);

  const fmt = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${dayStr}`;
  };
  return { start: fmt(firstDay), end: fmt(lastDay) };
}

export const DateFilterPill: React.FC<DateFilterPillProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const todayStr = useMemo(() => getTodayWIB(), []);
  const yesterdayStr = useMemo(() => getYesterdayWIB(), []);

  // Filter is active if either start or end date is set
  const isFiltered = Boolean(value.startDate || value.endDate);

  // Close menu on outside click
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value;
    onChange({
      ...value,
      startDate: newStart,
      endDate: value.endDate && value.endDate < newStart ? newStart : value.endDate,
    });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = e.target.value;
    onChange({
      ...value,
      startDate: value.startDate && value.startDate > newEnd ? newEnd : value.startDate,
      endDate: newEnd,
    });
  };

  const handleClear = () => {
    onChange({
      startDate: '',
      endDate: '',
      type: 'all_time',
      specificDate: '',
    });
    setIsMenuOpen(false);
  };

  const handlePreset = (preset: 'all_time' | 'hari_ini' | 'kemarin' | 'mingguan' | 'bulan_ini' | 'bulan_lalu' | '7_hari' | '30_hari') => {
    if (preset === 'all_time') {
      handleClear();
    } else if (preset === 'hari_ini') {
      onChange({ startDate: todayStr, endDate: todayStr, type: 'hari_ini' });
    } else if (preset === 'kemarin') {
      onChange({ startDate: yesterdayStr, endDate: yesterdayStr, type: 'kemarin' });
    } else if (preset === 'mingguan') {
      const { start, end } = getThisWeekRange();
      onChange({ startDate: start, endDate: end, type: 'mingguan' });
    } else if (preset === 'bulan_ini') {
      const { start, end } = getThisMonthRange();
      onChange({ startDate: start, endDate: end, type: 'bulan_ini' });
    } else if (preset === 'bulan_lalu') {
      const { start, end } = getLastMonthRange();
      onChange({ startDate: start, endDate: end, type: 'bulan_lalu' });
    } else if (preset === '7_hari') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      onChange({ startDate: `${y}-${m}-${day}`, endDate: todayStr, type: '7_hari' });
    } else if (preset === '30_hari') {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      onChange({ startDate: `${y}-${m}-${day}`, endDate: todayStr, type: '30_hari' });
    }
    setIsMenuOpen(false);
  };

  return (
    <div className={`relative inline-flex items-center gap-1.5 flex-wrap ${className}`} ref={menuRef}>
      {/* Container Langsung Rentang Tanggal Kustom (Mulai - Berakhir) */}
      <div
        className={`rounded-full px-3 py-1.5 border shadow-2xs transition-all flex items-center gap-2 min-h-[44px] ${
          isFiltered
            ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 font-bold ring-1 ring-indigo-300 dark:ring-indigo-700'
            : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-600'
        }`}
      >
        {/* Icon & Label Rentang */}
        <div className="flex items-center gap-1.5 shrink-0 text-slate-700 dark:text-slate-300">
          <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
          <span className="text-xs font-bold whitespace-nowrap">
            Rentang:
          </span>
        </div>

        {/* Input Tanggal Mulai */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 select-none">
            Mulai:
          </span>
          <input
            type="date"
            value={value.startDate || ''}
            onChange={handleStartDateChange}
            aria-label="Tanggal mulai"
            title="Pilih tanggal mulai"
            className="bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-500 focus:border-indigo-600 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer py-0.5 px-1 max-w-[110px] sm:max-w-[125px] dark:[color-scheme:dark]"
          />
        </div>

        <span className="text-slate-400 dark:text-slate-500 text-[11px] font-semibold select-none">
          s/d
        </span>

        {/* Input Tanggal Berakhir */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 select-none">
            Berakhir:
          </span>
          <input
            type="date"
            value={value.endDate || ''}
            min={value.startDate || undefined}
            onChange={handleEndDateChange}
            aria-label="Tanggal berakhir"
            title="Pilih tanggal berakhir"
            className="bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-500 focus:border-indigo-600 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer py-0.5 px-1 max-w-[110px] sm:max-w-[125px] dark:[color-scheme:dark]"
          />
        </div>

        {/* Tombol Preset Cepat (Dropdown Panah) */}
        <button
          type="button"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="p-1 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Pilihan Preset Periode"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Tombol Reset Cepat (X) jika filter aktif */}
        {isFiltered ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-full text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
            title="Reset ke Semua Tanggal (All Time)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium italic pr-0.5 select-none hidden sm:inline">
            (All Time)
          </span>
        )}
      </div>

      {/* Dropdown Menu Preset Cepat */}
      {isMenuOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2 space-y-1 font-sans animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Pilihan Periode Cepat
          </div>

          <button
            type="button"
            onClick={() => handlePreset('all_time')}
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer ${
              !isFiltered
                ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <span>Semua Tanggal (All Time)</span>
            {!isFiltered && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
          </button>

          <button
            type="button"
            onClick={() => handlePreset('hari_ini')}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span>Hari Ini ({formatTanggalSimple(todayStr)})</span>
          </button>

          <button
            type="button"
            onClick={() => handlePreset('kemarin')}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span>Kemarin ({formatTanggalSimple(yesterdayStr)})</span>
          </button>

          <button
            type="button"
            onClick={() => handlePreset('mingguan')}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span>Minggu Ini</span>
          </button>

          <button
            type="button"
            onClick={() => handlePreset('bulan_ini')}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span>Bulan Ini</span>
          </button>

          <button
            type="button"
            onClick={() => handlePreset('bulan_lalu')}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span>Bulan Lalu</span>
          </button>

          <button
            type="button"
            onClick={() => handlePreset('7_hari')}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span>7 Hari Terakhir</span>
          </button>

          <button
            type="button"
            onClick={() => handlePreset('30_hari')}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span>30 Hari Terakhir</span>
          </button>
        </div>
      )}
    </div>
  );
};
