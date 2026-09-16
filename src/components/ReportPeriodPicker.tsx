import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  ChevronDown, 
  Check, 
  RotateCcw, 
  SlidersHorizontal, 
  X, 
  ArrowRight,
  CalendarRange
} from 'lucide-react';
import { getTodayWIB, formatTanggalSimple } from '../lib/formatters';

export interface CustomDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface ReportPeriodPickerProps {
  period: 'hari_ini' | 'mingguan' | 'bulan_ini' | 'all_time';
  selectedMonth: string; // "YYYY-MM", e.g. "2026-09"
  customRange: CustomDateRange | null;
  onSelectMonth: (monthStr: string) => void; // e.g. "2026-08"
  onSelectCustomRange: (range: CustomDateRange) => void;
  onClearCustomRange?: () => void;
  weekRangeLabel?: string;
  className?: string;
}

const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/**
 * Format string "YYYY-MM" menjadi "September 2026"
 */
export function formatMonthYearIndonesian(yearMonthStr: string): string {
  if (!yearMonthStr || !yearMonthStr.includes('-')) return yearMonthStr;
  const parts = yearMonthStr.split('-');
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthName = INDONESIAN_MONTHS[monthIdx] || parts[1];
  return `${monthName} ${year}`;
}

/**
 * Format rentang tanggal singkat, contoh: "01 Sep – 15 Sep 2026"
 */
function formatShortDateRange(startDate: string, endDate: string): string {
  const startFmt = formatTanggalSimple(startDate);
  const endFmt = formatTanggalSimple(endDate);
  if (!startFmt || !endFmt) return `${startDate} – ${endDate}`;
  return `${startFmt} – ${endFmt}`;
}

export const ReportPeriodPicker: React.FC<ReportPeriodPickerProps> = ({
  period,
  selectedMonth,
  customRange,
  onSelectMonth,
  onSelectCustomRange,
  onClearCustomRange,
  weekRangeLabel,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'bulan' | 'kustom'>('bulan');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Form input dates for custom range
  const todayWIB = getTodayWIB();
  const [startDateInput, setStartDateInput] = useState<string>(() => {
    return customRange ? customRange.startDate : todayWIB;
  });
  const [endDateInput, setEndDateInput] = useState<string>(() => {
    return customRange ? customRange.endDate : todayWIB;
  });

  const popoverRef = useRef<HTMLDivElement>(null);

  // Synchronize inputs when customRange prop changes
  useEffect(() => {
    if (customRange) {
      setStartDateInput(customRange.startDate);
      setEndDateInput(customRange.endDate);
      setActiveTab('kustom');
    } else {
      setActiveTab('bulan');
    }
  }, [customRange]);

  // Click outside to close popover
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setValidationError(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Generate 18 bulan terakhir secara dinamis
  const availableMonths = useMemo(() => {
    const list: Array<{ value: string; label: string }> = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11

    // 18 bulan ke belakang
    for (let i = 0; i < 18; i++) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const val = `${y}-${m}`;
      const label = formatMonthYearIndonesian(val);
      list.push({ value: val, label });
    }
    return list;
  }, []);

  // Preset shortcut helpers
  const handleApplyPreset = (preset: '7_hari' | '30_hari' | 'bulan_ini' | 'bulan_lalu') => {
    const today = new Date();
    const formatYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (preset === '7_hari') {
      const past = new Date();
      past.setDate(today.getDate() - 6);
      const s = formatYMD(past);
      const e = formatYMD(today);
      setStartDateInput(s);
      setEndDateInput(e);
      setValidationError(null);
    } else if (preset === '30_hari') {
      const past = new Date();
      past.setDate(today.getDate() - 29);
      const s = formatYMD(past);
      const e = formatYMD(today);
      setStartDateInput(s);
      setEndDateInput(e);
      setValidationError(null);
    } else if (preset === 'bulan_ini') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const s = formatYMD(firstDay);
      const e = formatYMD(lastDay);
      setStartDateInput(s);
      setEndDateInput(e);
      setValidationError(null);
    } else if (preset === 'bulan_lalu') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      const s = formatYMD(firstDay);
      const e = formatYMD(lastDay);
      setStartDateInput(s);
      setEndDateInput(e);
      setValidationError(null);
    }
  };

  // Submit custom range
  const handleApplyCustomRange = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!startDateInput || !endDateInput) {
      setValidationError('Tanggal mulai dan selesai harus diisi');
      return;
    }
    if (startDateInput > endDateInput) {
      setValidationError('Tanggal mulai tidak boleh lebih besar dari tanggal selesai');
      return;
    }
    setValidationError(null);
    onSelectCustomRange({
      startDate: startDateInput,
      endDate: endDateInput,
    });
    setIsOpen(false);
  };

  // Label badge display on trigger button
  const displayBadgeText = useMemo(() => {
    if (customRange) {
      return formatShortDateRange(customRange.startDate, customRange.endDate);
    }
    if (period === 'bulan_ini') {
      return formatMonthYearIndonesian(selectedMonth);
    }
    if (period === 'mingguan') {
      return weekRangeLabel || 'Minggu Ini';
    }
    if (period === 'hari_ini') {
      return formatTanggalSimple(todayWIB) || 'Hari Ini';
    }
    return 'Semua Waktu';
  }, [customRange, period, selectedMonth, weekRangeLabel, todayWIB]);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={popoverRef}>
      {/* Trigger Button: Styled seamlessly as existing badge */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 self-start sm:self-auto px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-2xs select-none ${
          customRange
            ? 'bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-200 dark:ring-indigo-800'
            : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/90 dark:hover:bg-slate-700 border border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200'
        }`}
        title="Klik untuk memilih bulan atau rentang tanggal kustom"
        aria-expanded={isOpen}
      >
        <Calendar className={`w-3.5 h-3.5 shrink-0 ${customRange ? 'text-indigo-700 dark:text-indigo-300' : 'text-indigo-600 dark:text-indigo-400'}`} />
        <span className="truncate max-w-[160px] sm:max-w-[220px]">
          {displayBadgeText}
        </span>
        <ChevronDown 
          className={`w-3 h-3 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Floating Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-76 sm:w-84 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-3 space-y-3 font-sans animate-in fade-in zoom-in-95 duration-150 transition-colors duration-200">
          {/* Header & Tabs */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('bulan');
                  setValidationError(null);
                }}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'bulan'
                    ? 'bg-white dark:bg-slate-700 text-indigo-900 dark:text-white font-bold shadow-2xs'
                    : 'hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Pilih Bulan
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('kustom');
                  setValidationError(null);
                }}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab === 'kustom'
                    ? 'bg-white dark:bg-slate-700 text-indigo-900 dark:text-white font-bold shadow-2xs'
                    : 'hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Rentang Kustom</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              title="Tutup"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* TAB 1: PILIH BULAN */}
          {activeTab === 'bulan' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Daftar Bulan
                </span>
                {customRange && onClearCustomRange && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearCustomRange();
                      setIsOpen(false);
                    }}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Kustom
                  </button>
                )}
              </div>

              {/* Scrollable grid of months */}
              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                {availableMonths.map((item) => {
                  const isSelected = !customRange && selectedMonth === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        onSelectMonth(item.value);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 font-bold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>{item.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: RENTANG TANGGAL KUSTOM */}
          {activeTab === 'kustom' && (
            <form onSubmit={handleApplyCustomRange} className="space-y-3">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Pilihan Cepat
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('7_hari')}
                    className="px-2 py-1 text-[11px] font-medium bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700 text-center cursor-pointer transition-colors"
                  >
                    7 Hari Terakhir
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('30_hari')}
                    className="px-2 py-1 text-[11px] font-medium bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700 text-center cursor-pointer transition-colors"
                  >
                    30 Hari Terakhir
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('bulan_ini')}
                    className="px-2 py-1 text-[11px] font-medium bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700 text-center cursor-pointer transition-colors"
                  >
                    Bulan Ini Penuh
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('bulan_lalu')}
                    className="px-2 py-1 text-[11px] font-medium bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700 text-center cursor-pointer transition-colors"
                  >
                    Bulan Lalu Penuh
                  </button>
                </div>
              </div>

              {/* Start & End Date Inputs */}
              <div className="space-y-2 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={startDateInput}
                    onChange={(e) => {
                      setStartDateInput(e.target.value);
                      setValidationError(null);
                    }}
                    className="w-full text-xs font-semibold px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    value={endDateInput}
                    onChange={(e) => {
                      setEndDateInput(e.target.value);
                      setValidationError(null);
                    }}
                    className="w-full text-xs font-semibold px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* Validation error notice if any */}
              {validationError && (
                <div className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-2 rounded-lg font-medium">
                  {validationError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                {customRange && onClearCustomRange ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClearCustomRange();
                      setIsOpen(false);
                    }}
                    className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1.5 cursor-pointer"
                  >
                    Reset
                  </button>
                ) : (
                  <div />
                )}

                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
                >
                  <CalendarRange className="w-3.5 h-3.5" />
                  <span>Terapkan Rentang</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
