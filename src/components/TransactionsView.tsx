import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Trash2, 
  Truck, 
  Store as StoreIcon, 
  MoreVertical, 
  X, 
  Receipt, 
  ChevronDown, 
  Filter, 
  Activity,
  Download,
  Settings,
  RefreshCw
} from 'lucide-react';
import { 
  OrderItem, 
  Kitchen, 
  PaymentStatus, 
  DeliveryStatus, 
  Store as StoreType, 
  DashboardPeriod,
  PeriodSummaryStats,
  StoreExpenseBreakdown
} from '../types';
import { 
  formatRupiah, 
  formatTanggalDisatuin, 
  getTokoBadgeStyle, 
  getWeekRange, 
  isOrderToday, 
  isOrderThisWeek, 
  isOrderThisMonth, 
  parseIndonesianNumber,
  getTodayWIB
} from '../lib/formatters';
import { fetchPeriodSummaryFromDb } from '../lib/supabaseDb';
import { Pagination } from './Pagination';
import { TableSkeleton } from './TableSkeleton';
import { ActionMenuPortal } from './ActionMenuPortal';
import { PeriodSegmentedControl } from './PeriodSegmentedControl';
import { WeeklyReportCard } from './WeeklyReportCard';
import { ExpenseMonitoringCard } from './ExpenseMonitoringCard';
import { MonthlySyncModal } from './MonthlySyncModal';

export interface TransactionBatch {
  id: string;
  batchIndex: number;
  tanggal: string;
  createdAt?: string;
  tujuanDapur: string;
  toko: string;
  pemasok: string;
  payStatus: PaymentStatus;
  delStatus: DeliveryStatus;
  totalQty: number;
  totalBeli: number;
  totalJual?: number;
  items: OrderItem[];
  rowIndex?: number;
}

interface TransactionsViewProps {
  orders: OrderItem[];
  kitchens: Kitchen[];
  stores?: StoreType[];
  isLoading?: boolean;
  invoices?: any[];
  selectedDate?: string;
  onDateChange?: (date: string) => void;
  period?: DashboardPeriod;
  onPeriodChange?: (period: DashboardPeriod) => void;
  onToggleStatus: (id: string) => void;
  onUpdatePaymentStatus?: (id: string, status: PaymentStatus) => void;
  onUpdateDeliveryStatus?: (id: string, status: DeliveryStatus) => void;
  onUpdateGroupPaymentStatus?: (groupItems: OrderItem[], status: PaymentStatus) => void;
  onUpdateGroupDeliveryStatus?: (groupItems: OrderItem[], status: DeliveryStatus) => void;
  onToggleBatchStatus: (kitchenName: string, date: string, targetStatus: 'pending' | 'selesai') => void;
  onEditOrder: (item: OrderItem) => void;
  onDuplicateOrder?: (item: OrderItem) => void;
  onDeleteOrder: (id: string) => void;
  onDeleteKitchenOrders: (kitchenName: string, date: string) => void;
  onOpenInvoiceModal: (items: OrderItem[], kitchenName?: string, storeName?: string) => void;
  onExportInvoicePdf?: (items: OrderItem[], kitchenName: string, storeName: string, dateStr?: string) => void;
  onDeleteInvoice?: (id: string) => void;
  onDeleteTransaction?: (batch: TransactionBatch) => void;
  onOpenAddModal: (prefilledKitchen?: string) => void;
  onOpenSettings?: (initialTab?: any) => void;
  onOpenExportHistory?: () => void;
  isExportingActive?: boolean;
  exportHistoryCount?: number;
  onOpenSyncSheet?: () => void;
  pendingSyncCount?: number;
  isOnline?: boolean;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  orders,
  invoices = [],
  stores = [],
  isLoading = false,
  selectedDate,
  period: periodProp,
  onPeriodChange,
  onUpdatePaymentStatus,
  onUpdateDeliveryStatus,
  onUpdateGroupPaymentStatus,
  onUpdateGroupDeliveryStatus,
  onEditOrder,
  onDuplicateOrder,
  onDeleteOrder,
  onDeleteInvoice,
  onDeleteTransaction,
  onOpenSettings,
  onOpenExportHistory,
  isExportingActive = false,
  exportHistoryCount = 0,
  onOpenSyncSheet,
  pendingSyncCount = 0,
  isOnline = true,
}) => {
  // Period control state (synchronized with props or internal fallback)
  const [internalPeriod, setInternalPeriod] = useState<DashboardPeriod>(() => {
    try {
      const saved = localStorage.getItem('gas_dashboard_period');
      if (saved && ['hari_ini', 'mingguan', 'bulan_ini', 'all_time'].includes(saved)) {
        return saved as DashboardPeriod;
      }
    } catch {
      // ignore
    }
    return 'mingguan';
  });

  const activePeriod = periodProp ?? internalPeriod;
  const handleSetPeriod = (p: DashboardPeriod) => {
    if (onPeriodChange) {
      onPeriodChange(p);
    } else {
      setInternalPeriod(p);
    }
    try {
      localStorage.setItem('gas_dashboard_period', p);
    } catch {
      // ignore
    }
  };

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPemasok, setSelectedPemasok] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'PAID' | 'UNPAID'>('all');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [isMonthlySyncOpen, setIsMonthlySyncOpen] = useState(false);

  // Pagination state (max 15 batches per page)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Active 3-dots action menu tracking (Rendered via ActionMenuPortal)
  const [activeMenu, setActiveMenu] = useState<{
    id: string;
    rect: DOMRect;
    batch: TransactionBatch;
  } | null>(null);

  // Mobile Cards (< 640px) expansion states
  const [expandedBatchIds, setExpandedBatchIds] = useState<Set<string>>(new Set());

  const toggleExpandBatch = (id: string) => {
    setExpandedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Week range based on selectedDate
  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);

  // Unique list of suppliers (pemasok)
  const pemasokList = useMemo(() => {
    const list = new Set<string>();
    orders.forEach((o) => {
      if (o.pemasok) list.add(o.pemasok);
    });
    return Array.from(list);
  }, [orders]);

  // Unique list of stores (toko)
  const storeNames = useMemo(() => {
    if (stores && stores.length > 0) {
      return stores.map(s => s.nama);
    }
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.toko) set.add(o.toko);
    });
    return Array.from(set);
  }, [stores, orders]);

  // Database-aggregated statistics from Supabase
  const [dbStats, setDbStats] = useState<PeriodSummaryStats | null>(null);

  useEffect(() => {
    let isMounted = true;
    const targetDate = activePeriod === 'hari_ini' ? getTodayWIB() : (selectedDate || getTodayWIB());
    fetchPeriodSummaryFromDb(activePeriod, targetDate).then((res) => {
      if (isMounted && res.success && res.stats) {
        setDbStats(res.stats);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [activePeriod, selectedDate, orders.length]);

  // Compute period statistics (Total Qty, Pendapatan, Pengeluaran PO, Profit Bersih, and Store Breakdowns)
  const periodStats = useMemo<PeriodSummaryStats>(() => {
    const todayStr = getTodayWIB();
    const periodOrders = orders.filter((item) => {
      if (activePeriod === 'hari_ini') {
        return isOrderToday(item, todayStr);
      } else if (activePeriod === 'mingguan') {
        return isOrderThisWeek(item, weekRange);
      } else if (activePeriod === 'bulan_ini') {
        return isOrderThisMonth(item, selectedDate);
      }
      return true; // all_time
    });

    let totalQty = 0;
    let totalPendapatan = 0;
    let totalPengeluaran = 0;
    const storeMap: Record<string, { 
      totalQty: number; 
      totalBeli: number; 
      totalJual: number; 
      count: number;
      pemasokSet: Set<string>;
      batchKeys: Set<string>;
    }> = {};
    const globalBatchKeys = new Set<string>();

    for (const item of periodOrders) {
      const qty = parseIndonesianNumber(item.qty) || 0;
      const beli = parseIndonesianNumber(item.hargaBeli) || 0;
      const jual = parseIndonesianNumber(item.hargaJual) || 0;

      totalQty += qty;
      totalPendapatan += (qty * jual);
      totalPengeluaran += (qty * beli);

      const tokoKey = (item.toko || 'Lainnya').trim() || 'Lainnya';
      if (!storeMap[tokoKey]) {
        storeMap[tokoKey] = { 
          totalQty: 0, 
          totalBeli: 0, 
          totalJual: 0, 
          count: 0,
          pemasokSet: new Set<string>(),
          batchKeys: new Set<string>(),
        };
      }
      storeMap[tokoKey].totalQty += qty;
      storeMap[tokoKey].totalBeli += (qty * beli);
      storeMap[tokoKey].totalJual += (qty * jual);
      storeMap[tokoKey].count += 1;
      if (item.pemasok && item.pemasok.trim() && item.pemasok.trim() !== '-') {
        storeMap[tokoKey].pemasokSet.add(item.pemasok.trim());
      }

      const bKey = `${item.tanggal}_${item.tujuanDapur}_${item.toko}`;
      storeMap[tokoKey].batchKeys.add(bKey);
      globalBatchKeys.add(bKey);
    }

    const storeBreakdowns: StoreExpenseBreakdown[] = Object.entries(storeMap)
      .map(([toko, val]) => {
        const profit = val.totalJual - val.totalBeli;
        const marginPercent = val.totalJual > 0 ? Math.round((profit / val.totalJual) * 100) : 0;
        return {
          toko,
          totalQty: val.totalQty,
          totalBeli: val.totalBeli,
          totalJual: val.totalJual,
          profit,
          orderCount: val.count,
          transactionCount: val.batchKeys.size || val.count,
          pemasokList: Array.from(val.pemasokSet),
          percentageOfTotalBeli: totalPengeluaran > 0 ? (val.totalBeli / totalPengeluaran) * 100 : 0,
          percentageOfTotalJual: totalPendapatan > 0 ? (val.totalJual / totalPendapatan) * 100 : 0,
          marginPercent,
        };
      })
      .sort((a, b) => b.totalJual - a.totalJual);

    return {
      totalQty,
      totalTransactions: globalBatchKeys.size || periodOrders.length,
      totalPendapatan,
      totalPengeluaran,
      profitBersih: totalPendapatan - totalPengeluaran,
      storeBreakdowns,
    };
  }, [orders, activePeriod, selectedDate, weekRange]);

  // Group raw orders & invoices into distinct transaction batches
  const transactionBatches = useMemo<TransactionBatch[]>(() => {
    const groups: Record<string, OrderItem[]> = {};

    orders.forEach((o) => {
      const tanggal = o.tanggal || o.createdAt?.split('T')[0] || '';
      const dapur = o.tujuanDapur || 'Siliragung';
      const toko = o.toko || '';
      const pemasok = o.pemasok || 'Pemasok 1';
      const key = `${tanggal}||${dapur}||${toko}||${pemasok}`;

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(o);
    });

    let idx = 1;
    const batches: TransactionBatch[] = Object.entries(groups).map(([key, items]) => {
      const [tanggal, tujuanDapur, toko, pemasok] = key.split('||');
      const allPaid = items.every((i) => (i.paymentStatus || '').toUpperCase() === 'PAID');
      const allDelivered = items.every((i) => (i.deliveryStatus || '').toUpperCase() === 'DONE');

      const totalQty = items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
      const totalBeli = items.reduce((sum, i) => sum + (Number(i.qty) || 0) * (Number(i.hargaBeli) || 0), 0);
      const totalJual = items.reduce((sum, i) => sum + (Number(i.qty) || 0) * (Number(i.hargaJual || i.hargaBeli) || 0), 0);

      return {
        id: key,
        batchIndex: idx++,
        tanggal,
        createdAt: items[0]?.createdAt,
        tujuanDapur,
        toko,
        pemasok,
        payStatus: allPaid ? 'PAID' : 'UNPAID',
        delStatus: allDelivered ? 'DONE' : 'PENDING',
        totalQty,
        totalBeli,
        totalJual,
        items,
        rowIndex: items[0]?.rowIndex,
      };
    });

    // Invoices integration (if any stand-alone invoices exist)
    if (invoices && invoices.length > 0) {
      invoices.forEach((inv) => {
        const invDate = inv.tanggalPrint || inv.tanggal || inv.createdAt?.split('T')[0] || '';
        const invDapur = inv.tujuanDapur || inv.items?.[0]?.tujuanDapur || 'Siliragung';
        const invToko = inv.toko || inv.items?.[0]?.toko || '';
        const invPemasok = inv.pemasok || inv.PEMASOK || inv.items?.[0]?.pemasok || 'Pemasok 1';
        const key = `${invDate}||${invDapur}||${invToko}||${invPemasok}`;

        const existing = batches.find((b) => b.id === key || b.id === inv.id);
        if (!existing) {
          const isPaid = (inv.status || inv.STATUS || '').toUpperCase() === 'PAID' || 
                         (inv.status || inv.STATUS || '').toUpperCase() === 'LUNAS' ||
                         (inv.status || inv.STATUS || '').toUpperCase() === 'DONE';
          const payStatus: PaymentStatus = isPaid ? 'PAID' : 'UNPAID';
          const items: OrderItem[] = inv.items && inv.items.length > 0 ? inv.items : [];
          const totalQty = items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0) || Number(inv.qty || inv.QTY || 1);
          const totalBeli = Number(inv.totalBeli || inv['H. BELI'] || 0) || items.reduce((sum, i) => sum + (Number(i.qty) || 0) * (Number(i.hargaBeli) || 0), 0);
          const totalJual = Number(inv.totalAmount || inv.totalJual || inv.TOTAL || 0) || items.reduce((sum, i) => sum + (Number(i.qty) || 0) * (Number(i.hargaJual || i.hargaBeli) || 0), 0) || totalBeli;

          batches.push({
            id: inv.id || key,
            batchIndex: idx++,
            tanggal: invDate,
            createdAt: inv.createdAt,
            tujuanDapur: invDapur,
            toko: invToko,
            pemasok: invPemasok,
            payStatus,
            delStatus: 'DONE',
            totalQty,
            totalBeli,
            totalJual,
            items,
            rowIndex: inv.rowIndex,
          });
        }
      });
    }

    return batches;
  }, [orders, invoices]);

  // Filter transaction batches with Period, Store breakdown, Supplier, Status, and Search query
  const filteredBatches = useMemo(() => {
    const todayStr = getTodayWIB();
    return transactionBatches.filter((batch) => {
      // 1. Period filter (Hari Ini, Mingguan, Bulanan, All Time)
      if (activePeriod === 'hari_ini') {
        const isMatch = (batch.items && batch.items.length > 0 && batch.items.some(i => isOrderToday(i, todayStr))) ||
          isOrderToday({ tanggal: batch.tanggal, createdAt: batch.createdAt }, todayStr);
        if (!isMatch) return false;
      } else if (activePeriod === 'mingguan') {
        const isMatch = (batch.items && batch.items.length > 0 && batch.items.some(i => isOrderThisWeek(i, weekRange))) ||
          isOrderThisWeek({ tanggal: batch.tanggal, createdAt: batch.createdAt }, weekRange);
        if (!isMatch) return false;
      } else if (activePeriod === 'bulan_ini') {
        const isMatch = (batch.items && batch.items.length > 0 && batch.items.some(i => isOrderThisMonth(i, selectedDate))) ||
          isOrderThisMonth({ tanggal: batch.tanggal, createdAt: batch.createdAt }, selectedDate);
        if (!isMatch) return false;
      }

      // 2. Store filter (Integrated with Breakdown Toko & Pengepul click)
      if (selectedStoreFilter !== 'all' && batch.toko !== selectedStoreFilter) {
        return false;
      }

      // 3. Search query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesSearch =
          batch.tujuanDapur.toLowerCase().includes(q) ||
          batch.toko.toLowerCase().includes(q) ||
          batch.pemasok.toLowerCase().includes(q) ||
          batch.items.some((i) => i.namaBarang.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // 4. Supplier filter
      if (selectedPemasok !== 'all' && batch.pemasok !== selectedPemasok) {
        return false;
      }

      // 5. Payment status filter
      if (selectedStatusFilter !== 'all' && batch.payStatus !== selectedStatusFilter) {
        return false;
      }

      return true;
    });
  }, [
    transactionBatches, 
    activePeriod, 
    selectedDate, 
    weekRange, 
    selectedStoreFilter, 
    searchQuery, 
    selectedPemasok, 
    selectedStatusFilter
  ]);

  const totalPages = Math.ceil(filteredBatches.length / pageSize);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [filteredBatches.length, totalPages, currentPage]);

  const paginatedBatches = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredBatches.slice(startIndex, startIndex + pageSize);
  }, [filteredBatches, currentPage, pageSize]);

  const handleToggleBatchPayment = (batch: TransactionBatch) => {
    const nextStatus: PaymentStatus = batch.payStatus === 'PAID' ? 'UNPAID' : 'PAID';
    if (onUpdateGroupPaymentStatus) {
      onUpdateGroupPaymentStatus(batch.items, nextStatus);
    } else if (onUpdatePaymentStatus) {
      batch.items.forEach((it) => onUpdatePaymentStatus(it.id, nextStatus));
    }
  };

  const handleToggleBatchDelivery = (batch: TransactionBatch) => {
    const nextStatus: DeliveryStatus = batch.delStatus === 'DONE' ? 'PENDING' : 'DONE';
    if (onUpdateGroupDeliveryStatus) {
      onUpdateGroupDeliveryStatus(batch.items, nextStatus);
    } else if (onUpdateDeliveryStatus) {
      batch.items.forEach((it) => onUpdateDeliveryStatus(it.id, nextStatus));
    }
  };

  return (
    <div className="space-y-4 pt-1 pb-36 sm:pb-24 font-sans text-slate-900">
      {/* 
        ========================================================================
        1. TOP HEADER & FINANCIAL SUMMARY (REPLACING HEADERBANER ON TRANSAKSI PAGE)
        Menampilkan Title, Toggle Periode, Laporan Mingguan & Breakdown Toko/Pengepul
        ========================================================================
      */}
      <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xs space-y-3.5">
        {/* Top Bar: Title, Period Toggle, and Global Action Buttons (Identik dengan Lampiran Pertama) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Left: Purple Circular Badge & Page Title (NO DESKRIPSI) */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
              Transaksi &amp; Rekap Keuangan
            </h1>
          </div>

          {/* Right: Period Segmented Control [Hari Ini | Mingguan | Bulanan | All Time] & Circular Action Buttons */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 justify-between md:justify-end">
            <PeriodSegmentedControl
              value={activePeriod}
              onChange={handleSetPeriod}
              layoutIdPrefix="trx-period"
              rounded="full"
              className="w-full sm:w-auto"
            />

            {/* Circular Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Tombol Simpan ke Sheets / Docs / CSV */}
              <button
                type="button"
                onClick={() => setIsMonthlySyncOpen(true)}
                className="w-10 h-10 rounded-full border border-slate-200/90 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-2xs shrink-0"
                title="Simpan / Update Rekapan Bulanan ke Google Sheets, Docs, atau CSV"
              >
                <Download className="w-4 h-4" />
              </button>

              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="w-10 h-10 rounded-full border border-slate-200/90 text-slate-600 hover:text-slate-900 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-2xs shrink-0"
                  title="Pengaturan"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Financial Report & Breakdown Toko/Pengepul */}
        {activePeriod === 'mingguan' ? (
          <WeeklyReportCard
            stats={dbStats || periodStats}
            weekRange={weekRange}
            period="mingguan"
            selectedStoreFilter={selectedStoreFilter}
            onFilterStore={(toko) => {
              setSelectedStoreFilter((prev) => (prev === toko ? 'all' : toko));
            }}
          />
        ) : (
          <WeeklyReportCard
            stats={dbStats || periodStats}
            weekRange={weekRange}
            period={activePeriod}
            selectedDate={selectedDate}
            selectedStoreFilter={selectedStoreFilter}
            onFilterStore={(toko) => {
              setSelectedStoreFilter((prev) => (prev === toko ? 'all' : toko));
            }}
          />
        )}
      </div>

      {/* 
        ========================================================================
        2. INTEGRATED FILTER TOOLBAR (TOKO, PEMASOK, STATUS & SEARCH)
        Terintegrasi langsung dengan pilihan Breakdown Toko di atas
        ========================================================================
      */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Pill 1: Store Filter Pill (Active Highlight if clicked from breakdown) */}
          <div className="relative inline-flex items-center">
            <div className={`rounded-full px-3.5 py-2 border shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
              selectedStoreFilter !== 'all'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold ring-1 ring-indigo-300'
                : 'bg-white border-slate-200/90 text-slate-800 hover:border-indigo-300'
            }`}>
              <StoreIcon className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="text-xs font-bold whitespace-nowrap">
                {selectedStoreFilter === 'all' ? 'Semua Toko' : `Toko ${selectedStoreFilter}`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </div>
            <select
              value={selectedStoreFilter}
              onChange={(e) => setSelectedStoreFilter(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs"
              aria-label="Filter Toko"
            >
              <option value="all">Semua Toko ({storeNames.length})</option>
              {storeNames.map((st) => (
                <option key={st} value={st}>
                  Toko {st}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Clear Store Filter Button */}
          {selectedStoreFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedStoreFilter('all')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer min-h-[44px]"
              title="Kembali tampilkan semua toko"
            >
              <span>Reset Toko</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Pill 2: Filter Pemasok */}
          <div className="relative inline-flex items-center">
            <div className="rounded-full px-3.5 py-2 bg-white border border-slate-200/90 shadow-2xs hover:border-indigo-300 transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px]">
              <Filter className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                {selectedPemasok === 'all' ? 'Semua Pemasok' : selectedPemasok}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </div>
            <select
              value={selectedPemasok}
              onChange={(e) => setSelectedPemasok(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs"
              aria-label="Filter Pemasok"
            >
              <option value="all">Semua Pemasok ({pemasokList.length})</option>
              {pemasokList.map((p) => (
                <option key={p} value={p}>
                  Pemasok: {p}
                </option>
              ))}
            </select>
          </div>

          {/* Pill 3: Filter Status (PAID / UNPAID) */}
          <div className="relative inline-flex items-center">
            <div className="rounded-full px-3.5 py-2 bg-white border border-slate-200/90 shadow-2xs hover:border-indigo-300 transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px]">
              <Activity className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                {selectedStatusFilter === 'all'
                  ? 'Semua Status'
                  : selectedStatusFilter === 'PAID'
                  ? 'Status: LUNAS (PAID)'
                  : 'Status: BELUM LUNAS (UNPAID)'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </div>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs"
              aria-label="Filter Status"
            >
              <option value="all">Semua Status (PAID &amp; UNPAID)</option>
              <option value="UNPAID">UNPAID (Belum Lunas)</option>
              <option value="PAID">PAID (Lunas)</option>
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari barang, pemasok, toko, dapur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-7 py-2.5 bg-white border border-slate-200/90 rounded-full text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs transition-all min-h-[44px]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 
        ========================================================================
        3. CARD LIST KHUSUS MOBILE (< 640px: block sm:hidden)
        Terfilter otomatis sesuai periode dan breakdown toko
        ========================================================================
      */}
      <div className="block sm:hidden space-y-2.5">
        {isLoading && filteredBatches.length === 0 ? (
          <TableSkeleton rows={4} />
        ) : paginatedBatches.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-500 text-xs shadow-xs space-y-1">
            <p className="font-bold text-slate-700">Tidak ada transaksi yang sesuai filter</p>
            {selectedStoreFilter !== 'all' && (
              <p className="text-[11px] text-indigo-600">
                Filter aktif: Toko {selectedStoreFilter}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {paginatedBatches.map((batch) => {
              const isExpanded = expandedBatchIds.has(batch.id);
              const isMenuOpen = activeMenu?.id === batch.id;
              const isPaid = batch.payStatus === 'PAID';
              const isDelivered = batch.delStatus === 'DONE';
              const visibleItems = isExpanded ? batch.items : batch.items.slice(0, 2);
              const hiddenCount = batch.items.length - 2;

              return (
                <div
                  key={`mobile-batch-card-${batch.id}`}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3.5 space-y-2.5 relative"
                >
                  {/* Baris Atas: Tanggal, Dapur, Pemasok, Toko, Action Buttons */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-800 text-[9px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80">
                        {formatTanggalDisatuin(batch.tanggal)}
                      </span>
                      <span className="bg-indigo-50 text-indigo-900 font-black px-1.5 py-0.5 rounded text-[9.5px] border border-indigo-200">
                        Dapur {batch.tujuanDapur}
                      </span>
                      {batch.pemasok && (
                        <span className="bg-emerald-50 text-emerald-900 font-bold px-1.5 py-0.5 rounded text-[9px] border border-emerald-200">
                          {batch.pemasok}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[9px] border font-bold ${getTokoBadgeStyle(batch.toko)}`}>
                        {batch.toko}
                      </span>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onDeleteTransaction) {
                            onDeleteTransaction(batch);
                          } else if (onDeleteInvoice) {
                            onDeleteInvoice(batch.id);
                          } else {
                            onDeleteOrder(batch.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 active:scale-95 transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="Hapus Transaksi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setActiveMenu(activeMenu?.id === batch.id ? null : { id: batch.id, rect, batch });
                        }}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center ${
                          isMenuOpen
                            ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 ring-2 ring-indigo-500/20 shadow-2xs'
                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 active:scale-95'
                        }`}
                        title="Menu Aksi"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Status Badges & Total */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      {/* Payment Status 1-Click Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleBatchPayment(batch)}
                        className={`px-2.5 py-1 rounded-full text-[9px] font-black border transition-all active:scale-95 cursor-pointer min-h-[32px] flex items-center ${
                          isPaid
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                        title="Klik untuk ubah Payment (PAID / UNPAID)"
                      >
                        {isPaid ? 'PAID' : 'UNPAID'}
                      </button>

                      {/* Delivery Status 1-Click Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleBatchDelivery(batch)}
                        className={`px-2.5 py-1 rounded-full text-[9px] font-black border transition-all active:scale-95 cursor-pointer min-h-[32px] flex items-center ${
                          isDelivered
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        }`}
                        title="Klik untuk ubah Delivery (DONE / PENDING)"
                      >
                        {isDelivered ? 'DONE' : 'PENDING'}
                      </button>
                    </div>

                    {/* Total Rupiah */}
                    <div className="text-right">
                      <span className="text-[9px] text-slate-500 block font-medium">Total Beli</span>
                      <span className="font-black font-nominal text-xs text-slate-900">
                        {formatRupiah(batch.totalBeli)}
                      </span>
                    </div>
                  </div>

                  {/* List Item di dalam Card */}
                  <div className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-100 space-y-1">
                    {visibleItems.map((it) => (
                      <div key={`card-item-${it.id}`} className="flex items-center justify-between text-[10px] gap-2">
                        <div className="font-bold text-slate-800 truncate">
                          • {it.namaBarang}
                        </div>
                        <div className="text-[9.5px] font-nominal font-bold text-slate-600 whitespace-nowrap">
                          {it.qty} × {formatRupiah(it.hargaBeli)}
                        </div>
                      </div>
                    ))}

                    {/* Expand / Collapse Button jika lebih dari 2 item */}
                    {batch.items.length > 2 && (
                      <button
                        type="button"
                        onClick={() => toggleExpandBatch(batch.id)}
                        className="w-full text-center text-[10px] font-bold text-indigo-600 hover:text-indigo-800 pt-1 flex items-center justify-center gap-1 cursor-pointer min-h-[30px]"
                      >
                        <span>{isExpanded ? 'Sembunyikan' : `Lihat ${hiddenCount} item lainnya`}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Mobile Pagination */}
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
        )}
      </div>

      {/* 
        ========================================================================
        4. TRANSACTIONS TABLE (DESKTOP / TABLET >= 640px)
        Terintegrasi dengan fungsi Breakdown Toko Pengepul
        ========================================================================
      */}
      <div className="hidden sm:block">
        {isLoading && filteredBatches.length === 0 ? (
          <TableSkeleton rows={6} />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredBatches.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <Receipt className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Tidak Ada Transaksi Ditemukan
                </h3>
                <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                  {selectedStoreFilter !== 'all' 
                    ? `Tidak ada transaksi untuk Toko ${selectedStoreFilter} pada periode ini.`
                    : 'Coba sesuaikan pilihan periode, filter status, atau kata kunci pencarian.'}
                </p>
                {selectedStoreFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedStoreFilter('all')}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-100 cursor-pointer transition-all"
                  >
                    <span>Tampilkan Semua Toko</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="w-full overflow-x-auto max-h-[70vh] sm:max-h-[75vh] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-[9.5px] relative">
                    <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 shadow-2xs">
                      <tr className="text-[8.5px] font-black text-slate-700 uppercase tracking-wider">
                        <th className="py-2.5 px-1.5 text-center w-8 bg-slate-100 sticky top-0">NO</th>
                        <th className="py-2.5 px-2 whitespace-nowrap bg-slate-100 sticky top-0 min-w-[75px]">TANGGAL</th>
                        <th className="py-2.5 px-2 whitespace-nowrap bg-slate-100 sticky top-0 min-w-[90px]">PEMASOK</th>
                        <th className="py-2.5 px-2.5 bg-slate-100 sticky top-0 min-w-[160px]">BARANG &amp; TUJUAN</th>
                        <th className="py-2.5 px-2 text-center whitespace-nowrap bg-slate-100 sticky top-0 min-w-[75px]">TOKO</th>
                        <th className="py-2.5 px-1.5 text-center w-10 bg-slate-100 sticky top-0">QTY</th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap bg-slate-100 sticky top-0 min-w-[90px]">H. BELI</th>
                        <th className="py-2.5 px-2.5 text-right whitespace-nowrap bg-slate-100 sticky top-0 min-w-[90px]">TOTAL (JUAL)</th>
                        <th className="py-2.5 px-2 text-center whitespace-nowrap bg-slate-100 sticky top-0 min-w-[80px]">STATUS</th>
                        <th className="py-2.5 px-1.5 text-center w-16 bg-slate-100 sticky top-0">AKSI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800 bg-white">
                      {paginatedBatches.map((batch) => {
                        const isPaid = batch.payStatus === 'PAID';
                        const isMenuOpen = activeMenu?.id === batch.id;

                        return (
                          <tr key={batch.id} className="hover:bg-slate-50/90 transition-colors">
                            {/* 1. NO */}
                            <td className="py-2.5 px-1.5 text-center font-mono text-[9px] font-bold text-slate-400 align-middle">
                              {batch.batchIndex}
                            </td>

                            {/* 2. TANGGAL */}
                            <td className="py-2.5 px-2 whitespace-nowrap align-middle">
                              <span className="font-bold text-slate-800 text-[9px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80">
                                {formatTanggalDisatuin(batch.tanggal)}
                              </span>
                            </td>

                            {/* 3. PEMASOK */}
                            <td className="py-2.5 px-2 align-middle">
                              <span className="inline-flex items-center gap-1 font-extrabold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[9px] border border-slate-200/80 truncate max-w-[120px]">
                                <Truck className="w-3 h-3 text-indigo-600 shrink-0" />
                                <span className="truncate">{batch.pemasok}</span>
                              </span>
                            </td>

                            {/* 4. BARANG (ITEM TRANSAKSI & DAPUR) */}
                            <td className="py-2.5 px-2.5 align-middle">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="inline-block bg-indigo-50 text-indigo-900 font-black px-1.5 py-0.5 rounded text-[8.5px] border border-indigo-200">
                                  Dapur {batch.tujuanDapur}
                                </span>
                              </div>
                              <div className="space-y-1">
                                {batch.items.map((it, itIdx) => (
                                  <div key={it.id || itIdx} className="flex items-center justify-between gap-2 text-[9.5px]">
                                    <div className="font-bold text-slate-900 truncate">
                                      • {it.namaBarang}
                                    </div>
                                    <div className="text-[8.5px] font-nominal font-semibold text-slate-500 whitespace-nowrap">
                                      {it.qty} × {formatRupiah(it.hargaBeli)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>

                            {/* 5. TOKO */}
                            <td className="py-2.5 px-2 text-center whitespace-nowrap align-middle">
                              <span className={`inline-block px-2 py-0.5 rounded text-[9px] border ${getTokoBadgeStyle(batch.toko)}`}>
                                {batch.toko}
                              </span>
                            </td>

                            {/* 6. QTY */}
                            <td className="py-2.5 px-1.5 text-center font-black font-nominal text-[10px] text-slate-900 align-middle">
                              {batch.totalQty}
                            </td>

                            {/* 7. H. BELI */}
                            <td className="py-2.5 px-2.5 text-right font-black font-nominal text-[10px] text-rose-700 align-middle whitespace-nowrap">
                              {formatRupiah(batch.totalBeli)}
                            </td>

                            {/* 8. TOTAL */}
                            <td className="py-2.5 px-2.5 text-right font-black font-nominal text-[10px] text-emerald-800 align-middle whitespace-nowrap">
                              {formatRupiah(batch.totalJual || batch.totalBeli)}
                            </td>

                            {/* 9. STATUS PAYMENT 1-CLICK TOGGLE */}
                            <td className="py-2.5 px-2 text-center whitespace-nowrap align-middle">
                              <button
                                type="button"
                                onClick={() => handleToggleBatchPayment(batch)}
                                className={`px-2.5 py-1 rounded-md text-[8.5px] font-black cursor-pointer transition-all active:scale-95 border ${
                                  isPaid
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                    : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                                }`}
                                title="Klik untuk ubah status Payment (PAID / UNPAID)"
                              >
                                {isPaid ? 'PAID' : 'UNPAID'}
                              </button>
                            </td>

                            {/* 10. AKSI: Quick Delete & 3-Dots */}
                            <td className="py-2.5 px-1.5 text-center align-middle">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onDeleteTransaction) {
                                      onDeleteTransaction(batch);
                                    } else if (onDeleteInvoice) {
                                      onDeleteInvoice(batch.id);
                                    } else {
                                      onDeleteOrder(batch.id);
                                    }
                                  }}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent transition-all cursor-pointer active:scale-95"
                                  title="Hapus Transaksi"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setActiveMenu(activeMenu?.id === batch.id ? null : { id: batch.id, rect, batch });
                                  }}
                                  className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                                    isMenuOpen
                                      ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 ring-2 ring-indigo-500/20 shadow-2xs'
                                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-transparent active:scale-95'
                                  }`}
                                  title="Menu Aksi"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Component */}
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Spacer bawah khusus mobile agar tidak overlap dengan bottom navigation */}
      <div className="h-24 sm:h-0 block sm:hidden pointer-events-none" aria-hidden="true" />

      {/* Floating Portal Action Menu */}
      <ActionMenuPortal
        isOpen={!!activeMenu}
        targetRect={activeMenu?.rect || null}
        onClose={() => setActiveMenu(null)}
        title="Detail Transaksi"
        batchNumber={activeMenu?.batch.batchIndex}
        items={activeMenu?.batch.items || []}
        onEdit={onEditOrder}
        onDuplicate={onDuplicateOrder}
        onDelete={onDeleteOrder}
        onDeleteBatch={() => {
          if (activeMenu?.batch) {
            if (onDeleteTransaction) {
              onDeleteTransaction(activeMenu.batch);
            } else if (onDeleteInvoice) {
              onDeleteInvoice(activeMenu.batch.id);
            } else {
              onDeleteOrder(activeMenu.batch.id);
            }
          }
        }}
      />

      {/* Modal Simpan / Update Rekapan Bulanan ke Google Sheets & CSV */}
      <MonthlySyncModal
        isOpen={isMonthlySyncOpen}
        onClose={() => setIsMonthlySyncOpen(false)}
        orders={orders}
        stats={periodStats}
        selectedDate={selectedDate}
        onOpenSettings={() => {
          if (onOpenSettings) {
            onOpenSettings('googlesheets');
          }
        }}
      />
    </div>
  );
};
