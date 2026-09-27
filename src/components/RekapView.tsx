import React, { useState, useEffect, useMemo } from 'react';
import { 
  OrderItem, 
  Store as StoreType, 
  Kitchen, 
  DashboardPeriod, 
  PeriodSummaryStats 
} from '../types';
import { 
  getTodayWIB, 
  getWeekRange, 
  isOrderToday, 
  isOrderThisWeek, 
  isOrderThisMonth,
  parseIndonesianNumber 
} from '../lib/formatters';
import { fetchPeriodSummaryFromDb } from '../lib/supabaseDb';
import { WeeklyReportCard } from './WeeklyReportCard';
import { PeriodSegmentedControl } from './PeriodSegmentedControl';
import { CustomDateRange } from './ReportPeriodPicker';
import { ThemeToggle } from './ThemeToggle';
import { BarChart3, Download, Settings } from 'lucide-react';

const MonthlySyncModal = React.lazy(() => import('./MonthlySyncModal').then((m) => ({ default: m.MonthlySyncModal })));

interface RekapViewProps {
  orders: OrderItem[];
  stores?: StoreType[];
  kitchens?: Kitchen[];
  invoices?: any[];
  selectedDate?: string;
  period?: DashboardPeriod;
  onPeriodChange?: (period: DashboardPeriod) => void;
  onOpenSettings?: (initialTab?: any) => void;
  onOpenExportHistory?: () => void;
  isExportingActive?: boolean;
  exportHistoryCount?: number;
  isOnline?: boolean;
}

export const RekapView: React.FC<RekapViewProps> = React.memo(({
  orders,
  stores = [],
  kitchens = [],
  invoices = [],
  selectedDate,
  period: periodProp = 'all_time',
  onPeriodChange,
  onOpenSettings,
}) => {
  // Period control state (synchronized with global dashboardPeriod)
  const [internalPeriod, setInternalPeriod] = useState<DashboardPeriod>(periodProp);
  const activePeriod = periodProp ?? internalPeriod;

  const handleSetPeriod = (p: DashboardPeriod) => {
    setCustomRange(null);
    if (onPeriodChange) {
      onPeriodChange(p);
    } else {
      setInternalPeriod(p);
    }
  };

  // State dropdown bulan & custom date range
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return selectedDate ? selectedDate.slice(0, 7) : getTodayWIB().slice(0, 7);
  });
  const [customRange, setCustomRange] = useState<CustomDateRange | null>(null);

  // Filters within breakdown
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [selectedPemasok, setSelectedPemasok] = useState<string>('all');
  const [selectedDapurFilter, setSelectedDapurFilter] = useState<string>('all');
  const [isMonthlySyncOpen, setIsMonthlySyncOpen] = useState(false);

  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);

  // Orders filtered for the active period
  const periodOrders = useMemo(() => {
    return orders.filter((item) => {
      if (customRange) {
        if (!item.tanggal) return false;
        return item.tanggal >= customRange.startDate && item.tanggal <= customRange.endDate;
      }
      if (activePeriod === 'hari_ini') {
        return isOrderToday(item, selectedDate);
      }
      if (activePeriod === 'mingguan') {
        return isOrderThisWeek(item, weekRange);
      }
      if (activePeriod === 'bulan_ini') {
        return isOrderThisMonth(item, `${selectedMonth}-01`);
      }
      return true; // all_time
    });
  }, [orders, activePeriod, selectedDate, selectedMonth, weekRange, customRange]);

  // Aggregated summary stats from Supabase
  const [dbStats, setDbStats] = useState<PeriodSummaryStats | null>(null);

  useEffect(() => {
    let isMounted = true;
    let periodQuery: 'hari_ini' | 'mingguan' | 'bulan_ini' | 'all_time' | 'custom' = activePeriod;
    let targetDate = activePeriod === 'hari_ini' ? getTodayWIB() : (selectedDate || getTodayWIB());
    let startDate: string | undefined = undefined;
    let endDate: string | undefined = undefined;

    if (customRange) {
      periodQuery = 'custom';
      startDate = customRange.startDate;
      endDate = customRange.endDate;
      targetDate = customRange.startDate;
    } else if (activePeriod === 'bulan_ini') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      startDate = `${selectedMonth}-01`;
      endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
      targetDate = startDate;
    }

    fetchPeriodSummaryFromDb(periodQuery, targetDate, startDate, endDate).then((res) => {
      if (isMounted && res.success && res.stats) {
        setDbStats(res.stats);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [activePeriod, selectedDate, selectedMonth, customRange, orders.length]);

  // Client-side fallback stats calculation
  const fallbackStats = useMemo<PeriodSummaryStats>(() => {
    let totalPendapatan = 0;
    let totalPengeluaran = 0;
    let profitBersih = 0;
    let totalKeKoperasi = 0;

    for (let i = 0; i < periodOrders.length; i++) {
      const item = periodOrders[i];
      if (item.status === 'CANCELLED') continue;

      const rawQtyJual = parseIndonesianNumber(item.qty) || 0;
      const rawQtyBeli = (item as any).qtyBeli !== undefined && (item as any).qtyBeli !== null
        ? parseIndonesianNumber((item as any).qtyBeli)
        : ((item as any).qty_beli !== undefined && (item as any).qty_beli !== null
          ? parseIndonesianNumber((item as any).qty_beli)
          : rawQtyJual);
      const returQty = Math.max(0, Number(item.retur) || 0);
      const qtyFinal = Math.max(0, rawQtyJual - returQty);
      const qtyBeliEfektif = Math.max(0, rawQtyBeli - returQty);
      const beli = parseIndonesianNumber(item.hargaBeli) || 0;
      const jual = parseIndonesianNumber(item.hargaJual) || 0;
      const cb = parseIndonesianNumber(item.cashback) || 0;

      const modalItem = qtyBeliEfektif * beli;
      const omzetItem = qtyFinal * jual;
      const labaItem = cb > 0 ? ((cb - beli) * qtyFinal) : (omzetItem - modalItem);
      const kopItem = cb > 0 ? ((jual - cb) * qtyFinal) : 0;

      totalPengeluaran += modalItem;
      totalPendapatan += omzetItem;
      profitBersih += labaItem;
      totalKeKoperasi += kopItem;
    }

    return {
      totalPendapatan,
      totalPengeluaran,
      profitBersih,
      totalKeKoperasi,
      totalTrx: periodOrders.length,
      storeBreakdowns: [],
    };
  }, [periodOrders]);

  return (
    <div className="space-y-4 pt-1 pb-36 sm:pb-24 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. TOP HEADER BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xs space-y-3.5 transition-colors duration-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          {/* Left: Purple Circular Badge & Page Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                Rekap &amp; Analisis Keuangan
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Breakdown detail performa per toko, pemasok, dapur &amp; total koperasi
              </p>
            </div>
          </div>

          {/* Right: Period Segmented Control & Action Buttons */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 justify-between md:justify-end">
            <PeriodSegmentedControl
              value={activePeriod}
              onChange={handleSetPeriod}
              layoutIdPrefix="rekap-period"
              rounded="full"
              className="w-full sm:w-auto"
            />

            <div className="flex items-center gap-1.5 shrink-0">
              <ThemeToggle variant="circle" />

              <button
                type="button"
                onClick={() => setIsMonthlySyncOpen(true)}
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
      </div>

      {/* 2. REKAP LAPORAN MINGGUAN & BREAKDOWN TOKO/PEMASOK/DAPUR */}
      <WeeklyReportCard
        stats={dbStats || fallbackStats}
        weekRange={weekRange}
        period={activePeriod}
        selectedDate={selectedDate}
        selectedMonth={selectedMonth}
        customRange={customRange}
        onSelectMonth={(month) => {
          setCustomRange(null);
          setSelectedMonth(month);
          if (activePeriod !== 'bulan_ini') {
            handleSetPeriod('bulan_ini');
          }
        }}
        onSelectCustomRange={(range) => {
          setCustomRange(range);
        }}
        onClearCustomRange={() => {
          setCustomRange(null);
        }}
        selectedStoreFilter={selectedStoreFilter}
        onFilterStore={(toko) => {
          setSelectedStoreFilter((prev) => (prev === toko ? 'all' : toko));
        }}
        selectedPemasokFilter={selectedPemasok}
        onFilterPemasok={(pemasok) => {
          setSelectedPemasok((prev) => (prev === pemasok ? 'all' : pemasok));
        }}
        selectedDapurFilter={selectedDapurFilter}
        onFilterDapur={(dapur) => {
          setSelectedDapurFilter((prev) => (prev === dapur ? 'all' : dapur));
        }}
        periodOrders={periodOrders}
      />

      {/* Monthly Sync & Export Modal */}
      {isMonthlySyncOpen && (
        <React.Suspense fallback={null}>
          <MonthlySyncModal
            isOpen={isMonthlySyncOpen}
            onClose={() => setIsMonthlySyncOpen(false)}
            orders={orders}
            invoices={invoices}
            selectedDate={selectedDate || getTodayWIB()}
          />
        </React.Suspense>
      )}
    </div>
  );
});
