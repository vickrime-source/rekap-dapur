import React from 'react';
import { Receipt, Download, Settings } from 'lucide-react';
import { DashboardPeriod, PeriodSummaryStats, OrderItem } from '../../types';
import { PeriodSegmentedControl } from '../PeriodSegmentedControl';
import { WeeklyReportCard } from '../WeeklyReportCard';
import { CustomDateRange } from '../ReportPeriodPicker';
import { ThemeToggle } from '../ThemeToggle';

interface TransactionsHeaderProps {
  activePeriod: DashboardPeriod;
  onSetPeriod: (p: DashboardPeriod) => void;
  onOpenMonthlySync: () => void;
  onOpenSettings?: (initialTab?: any) => void;
  stats: PeriodSummaryStats;
  weekRange: { start: string; end: string };
  selectedDate?: string;
  selectedMonth: string;
  customRange: CustomDateRange | null;
  onSelectMonth: (month: string) => void;
  onSelectCustomRange: (range: CustomDateRange | null) => void;
  onClearCustomRange: () => void;
  selectedStoreFilter: string;
  onFilterStore: (toko: string) => void;
  selectedPemasokFilter: string;
  onFilterPemasok: (pemasok: string) => void;
  selectedDapurFilter: string;
  onFilterDapur: (dapur: string) => void;
  periodOrders: OrderItem[];
}

export const TransactionsHeader: React.FC<TransactionsHeaderProps> = ({
  activePeriod,
  onSetPeriod,
  onOpenMonthlySync,
  onOpenSettings,
  stats,
  weekRange,
  selectedDate,
  selectedMonth,
  customRange,
  onSelectMonth,
  onSelectCustomRange,
  onClearCustomRange,
  selectedStoreFilter,
  onFilterStore,
  selectedPemasokFilter,
  onFilterPemasok,
  selectedDapurFilter,
  onFilterDapur,
  periodOrders,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xs space-y-3.5 transition-colors duration-200">
      {/* Top Bar: Title, Period Toggle, and Global Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        {/* Left: Purple Circular Badge & Page Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
            Transaksi &amp; Rekap Keuangan
          </h1>
        </div>

        {/* Right: Period Segmented Control & Circular Action Buttons */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 justify-between md:justify-end">
          <PeriodSegmentedControl
            value={activePeriod}
            onChange={onSetPeriod}
            layoutIdPrefix="trx-period"
            rounded="full"
            className="w-full sm:w-auto"
          />

          {/* Circular Action Buttons: Dark Mode | Download | Settings */}
          <div className="flex items-center gap-1.5 shrink-0">
            <ThemeToggle variant="circle" />

            {/* Tombol Simpan ke Sheets / Docs / CSV */}
            <button
              type="button"
              onClick={onOpenMonthlySync}
              className="w-10 h-10 rounded-full border border-slate-200/90 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-2xs shrink-0"
              title="Simpan / Update Rekapan Bulanan ke Google Sheets, Docs, atau CSV"
            >
              <Download className="w-4 h-4" />
            </button>

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="w-10 h-10 rounded-full border border-slate-200/90 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-2xs shrink-0"
                title="Pengaturan"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Financial Report & Breakdown Toko/Pengepul */}
      <WeeklyReportCard
        stats={stats}
        weekRange={weekRange}
        period={activePeriod}
        selectedDate={selectedDate}
        selectedMonth={selectedMonth}
        customRange={customRange}
        onSelectMonth={onSelectMonth}
        onSelectCustomRange={onSelectCustomRange}
        onClearCustomRange={onClearCustomRange}
        selectedStoreFilter={selectedStoreFilter}
        onFilterStore={onFilterStore}
        selectedPemasokFilter={selectedPemasokFilter}
        onFilterPemasok={onFilterPemasok}
        selectedDapurFilter={selectedDapurFilter}
        onFilterDapur={onFilterDapur}
        periodOrders={periodOrders}
      />
    </div>
  );
};
