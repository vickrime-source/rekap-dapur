import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Store as StoreIcon, 
  Utensils, 
  ChevronDown, 
  X,
  ShoppingBag,
  Truck,
  Clock
} from 'lucide-react';
import { 
  OrderItem, 
  Kitchen, 
  Store as StoreType, 
  PaymentStatus, 
  DeliveryStatus,
  InvoiceRecord,
  DashboardPeriod,
  InvoicePriceVariant
} from '../types';
import { OrdersTableView } from './OrdersTableView';
import { 
  isOrderToday,
  isOrderThisWeek,
  isOrderThisMonth,
  getWeekRange,
  getTodayWIB,
  getYesterdayWIB,
  normalizeDateSimple,
  formatTanggalSimple
} from '../lib/formatters';
import { DateFilterPill, DateFilterValue, getThisWeekRange, getThisMonthRange } from './DateFilterPill';
import { 
  filterOrdersByStatus, 
  computeAndValidateDashboardSummary, 
  DashboardStatusFilter 
} from '../lib/orderValidation';

export type TimeFilterOption = 'all_time' | 'hari_ini' | 'mingguan' | 'bulan_ini';

interface DashboardViewProps {
  orders: OrderItem[];
  invoices?: InvoiceRecord[];
  isLoading?: boolean;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onToggleStatus?: (id: string) => void;
  onUpdatePaymentStatus: (id: string, status: PaymentStatus) => void;
  onUpdateDeliveryStatus: (id: string, status: DeliveryStatus) => void;
  onUpdateGroupPaymentStatus?: (groupItems: OrderItem[], status: PaymentStatus) => void;
  onUpdateGroupDeliveryStatus?: (groupItems: OrderItem[], status: DeliveryStatus) => void;
  onDuplicateOrder: (item: OrderItem) => void;
  onToggleBatchStatus?: (kitchenName: string, date: string, targetStatus: 'pending' | 'selesai') => void;
  onEditOrder: (item: OrderItem) => void;
  onDeleteOrder: (id: string) => void;
  onDeleteBatchOrders?: (items: OrderItem[]) => void;
  onDeleteKitchenOrders?: (kitchenName: string, date: string) => void;
  onOpenAddModal: (prefilledKitchen?: string) => void;
  onOpenInvoiceModal: (items: OrderItem[], kitchenName?: string, storeName?: string) => void;
  onExportInvoicePdf?: (items: OrderItem[], kitchenName: string, storeName: string, dateStr?: string, variant?: InvoicePriceVariant) => void;
  onViewInvoice?: (items: OrderItem[], kitchenName: string, storeName: string, dateStr?: string) => void;
  onOpenExportModal?: () => void;
  kitchens: Kitchen[];
  stores: StoreType[];
  pemasokList?: string[];
  period?: DashboardPeriod;
  onPeriodChange?: (period: DashboardPeriod) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = React.memo(({
  orders,
  isLoading = false,
  selectedDate,
  onDateChange,
  period = 'mingguan',
  onPeriodChange,
  onUpdatePaymentStatus,
  onUpdateDeliveryStatus,
  onUpdateGroupPaymentStatus,
  onUpdateGroupDeliveryStatus,
  onDuplicateOrder,
  onEditOrder,
  onDeleteOrder,
  onDeleteBatchOrders,
  onOpenInvoiceModal,
  onExportInvoicePdf,
  onViewInvoice,
  kitchens,
  stores,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [selectedKitchenFilter, setSelectedKitchenFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<DashboardStatusFilter>('all');

  const todayStr = useMemo(() => getTodayWIB(), []);
  const yesterdayStr = useMemo(() => getYesterdayWIB(), []);

  const [dateFilter, setDateFilter] = useState<DateFilterValue>(() => {
    if (period === 'hari_ini') {
      const today = getTodayWIB();
      return { startDate: today, endDate: today };
    }
    return { startDate: '', endDate: '' };
  });

  // Sinkronisasi otomatis hanya jika period dari HeaderBanner / App benar-benar berubah secara eksternal
  const prevPeriodRef = useRef(period);
  useEffect(() => {
    if (prevPeriodRef.current !== period) {
      prevPeriodRef.current = period;
      if (period === 'all_time') {
        setDateFilter({ startDate: '', endDate: '' });
      } else if (period === 'hari_ini') {
        const today = getTodayWIB();
        setDateFilter({ startDate: today, endDate: today });
      } else if (period === 'mingguan') {
        const { start, end } = getThisWeekRange();
        setDateFilter({ startDate: start, endDate: end });
      } else if (period === 'bulan_ini') {
        const { start, end } = getThisMonthRange();
        setDateFilter({ startDate: start, endDate: end });
      }
    }
  }, [period]);

  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);

  // Handler saat filter tanggal berubah
  const handleDateFilterChange = (val: DateFilterValue) => {
    setDateFilter(val);
    if (val.startDate && onDateChange) {
      onDateChange(val.startDate);
    }
    if (onPeriodChange) {
      if (!val.startDate && !val.endDate) {
        onPeriodChange('all_time');
      }
    }
  };

  // Filter orders according to dateFilter, store, kitchen, and search (Base Filtered)
  const baseFilteredOrders = useMemo(() => {
    return orders.filter((item) => {
      // 1. Filter Rentang Tanggal Langsung (Default: Kosong = All Time)
      if (dateFilter.startDate || dateFilter.endDate) {
        const itemDate = item.tanggal
          ? normalizeDateSimple(item.tanggal)
          : (item.createdAt ? normalizeDateSimple(item.createdAt) : null);
        if (!itemDate) return false;
        if (dateFilter.startDate && itemDate < dateFilter.startDate) return false;
        if (dateFilter.endDate && itemDate > dateFilter.endDate) return false;
      }
      // Kosong -> lolos semua tanggal (ALL TIME)

      // 2. Search query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const invNum = ((item.invoiceNumber || (item as any).invoice_number || '') as string).toLowerCase();
        const notaId = ((item.notaId || (item as any).nota_id || '') as string).toLowerCase();
        const matchesSearch =
          item.namaBarang.toLowerCase().includes(q) ||
          item.pemasok.toLowerCase().includes(q) ||
          item.toko.toLowerCase().includes(q) ||
          item.tujuanDapur.toLowerCase().includes(q) ||
          invNum.includes(q) ||
          notaId.includes(q) ||
          (item.catatan && item.catatan.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // 3. Store filter
      if (selectedStoreFilter !== 'all' && item.toko !== selectedStoreFilter) {
        return false;
      }

      // 4. Kitchen filter
      if (selectedKitchenFilter !== 'all' && item.tujuanDapur !== selectedKitchenFilter) {
        return false;
      }

      return true;
    });
  }, [
    orders,
    dateFilter,
    searchQuery,
    selectedStoreFilter,
    selectedKitchenFilter,
  ]);

  // Orders filtered additionally by active status filter (Strict Data Validation Check)
  const displayedOrders = useMemo(() => {
    return filterOrdersByStatus(baseFilteredOrders, statusFilter);
  }, [baseFilteredOrders, statusFilter]);

  // Label filter aktif untuk tampilan state kosong dan header panel
  const currentFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (selectedStoreFilter !== 'all') parts.push(`Toko ${selectedStoreFilter}`);
    if (selectedKitchenFilter !== 'all') parts.push(`Dapur ${selectedKitchenFilter}`);
    if (dateFilter.startDate && dateFilter.endDate) {
      if (dateFilter.startDate === dateFilter.endDate) {
        parts.push(`Tanggal: ${formatTanggalSimple(dateFilter.startDate)}`);
      } else {
        parts.push(`${formatTanggalSimple(dateFilter.startDate)} - ${formatTanggalSimple(dateFilter.endDate)}`);
      }
    } else if (dateFilter.startDate) {
      parts.push(`Mulai: ${formatTanggalSimple(dateFilter.startDate)}`);
    } else if (dateFilter.endDate) {
      parts.push(`Sampai: ${formatTanggalSimple(dateFilter.endDate)}`);
    }
    if (searchQuery) parts.push(`"${searchQuery}"`);
    if (statusFilter === 'delivered') parts.push('Status: Delivery Selesai');
    if (statusFilter === 'pending') parts.push('Status: Pending');
    return parts.length > 0 ? parts.join(', ') : 'All Time';
  }, [selectedStoreFilter, selectedKitchenFilter, dateFilter, searchQuery, statusFilter]);

  // Status Pemesanan Metrics (Satu Blok: Total Pesanan, Delivery Hijau, Pending Merah)
  // Menjalankan validasi ketat sehingga delivered + pending strictly menjumlah ke total pesanan,
  // dan setiap pesanan yang ditampilkan di summary secara presisi cocok dengan status pemesanan.
  const dashboardMetrics = useMemo(() => {
    return computeAndValidateDashboardSummary(baseFilteredOrders, displayedOrders, statusFilter);
  }, [baseFilteredOrders, displayedOrders, statusFilter]);

  return (
    <div className="space-y-3 pt-1 pb-36 sm:pb-24 font-sans text-slate-800 dark:text-slate-200 transition-colors duration-200">
      {/* Filter Pills Bar (Store, Kitchen, Calendar & Search) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Pill Filters Group */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Pill 1: Store Icon + Dropdown */}
          <div className="relative inline-flex items-center">
            <div className={`rounded-full px-3.5 py-2 border shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
              selectedStoreFilter !== 'all' 
                ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 font-bold'
                : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-600'
            }`}>
              <StoreIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span className="text-xs font-bold whitespace-nowrap">
                {selectedStoreFilter === 'all' ? 'Semua Toko' : `Toko ${selectedStoreFilter}`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
            </div>
            <select
              value={selectedStoreFilter}
              onChange={(e) => setSelectedStoreFilter(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              aria-label="Filter Toko"
            >
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="all">Semua Toko ({stores.length})</option>
              {stores.map((st) => (
                <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" key={st.id} value={st.nama}>
                  Toko {st.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Pill 2: Kitchen Icon + Dropdown */}
          <div className="relative inline-flex items-center">
            <div className={`rounded-full px-3.5 py-2 border shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
              selectedKitchenFilter !== 'all'
                ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 font-bold'
                : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-600'
            }`}>
              <Utensils className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span className="text-xs font-bold whitespace-nowrap">
                {selectedKitchenFilter === 'all' ? 'Semua Dapur' : `Dapur ${selectedKitchenFilter}`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
            </div>
            <select
              value={selectedKitchenFilter}
              onChange={(e) => setSelectedKitchenFilter(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              aria-label="Filter Dapur"
            >
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="all">Semua Dapur ({kitchens.length})</option>
              {kitchens.map((k) => (
                <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" key={k.id} value={k.nama}>
                  Dapur {k.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Pill 3: Filter Tanggal Dinamis (All Time, Hari Ini, Kemarin, Pilih Tanggal, Minggu, Bulan, Rentang) */}
          <DateFilterPill
            value={dateFilter}
            onChange={handleDateFilterChange}
          />

          {/* Reset active store filter if clicked from breakdown */}
          {selectedStoreFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedStoreFilter('all')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold cursor-pointer min-h-[44px]"
              title="Hapus Filter Toko"
            >
              <span>Reset Toko</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari barang, toko, dapur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-7 py-2.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-full text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 shadow-2xs transition-all min-h-[44px]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Panel Status Pemesanan Terpadu (Satu Blok: Total Pesanan, Delivery Hijau, Pending Merah) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shrink-0">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5 truncate">
              <span>Status Pemesanan ({currentFilterLabel})</span>
              {statusFilter !== 'all' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                  Filter: {statusFilter === 'delivered' ? 'Delivery' : 'Pending'}
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {statusFilter === 'all'
                ? `${dashboardMetrics.totalItems} barang dalam ${dashboardMetrics.totalTrx} nota keberangkatan`
                : statusFilter === 'delivered'
                ? `Menampilkan ${dashboardMetrics.displayedItems} barang dalam ${dashboardMetrics.displayedTrx} nota delivery selesai (dari ${dashboardMetrics.totalTrx} total)`
                : `Menampilkan ${dashboardMetrics.displayedItems} barang dalam ${dashboardMetrics.displayedTrx} nota pending (dari ${dashboardMetrics.totalTrx} total)`}
            </div>
          </div>
        </div>

        {/* 3 Informasi: Total, Delivery Selesai (Hijau), Pending (Merah) - Interaktif & Tervalidasi */}
        <div className="flex items-center gap-1.5 sm:gap-2 self-start sm:self-auto overflow-x-auto w-full sm:w-auto">
          {/* 1. Total Pesanan */}
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shrink-0 transition-all cursor-pointer min-h-[38px] ${
              statusFilter === 'all'
                ? 'bg-slate-200 dark:bg-slate-700 border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/30 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-750'
            }`}
            title="Klik untuk melihat semua status pesanan"
          >
            <span className="text-[10px] font-bold uppercase tracking-tight">Total:</span>
            <span className="text-xs font-black font-nominal text-slate-900 dark:text-slate-100">{dashboardMetrics.totalTrx}</span>
          </button>

          {/* 2. Delivery Hijau */}
          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === 'delivered' ? 'all' : 'delivered'))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shrink-0 transition-all cursor-pointer min-h-[38px] ${
              statusFilter === 'delivered'
                ? 'bg-emerald-100 dark:bg-emerald-900/80 border-emerald-500 dark:border-emerald-400 ring-2 ring-emerald-500/40 text-emerald-900 dark:text-emerald-100 shadow-2xs font-bold'
                : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700/80 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50 shadow-2xs'
            }`}
            title="Klik untuk filter hanya pesanan Delivery Selesai (Hijau)"
          >
            <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-tight">Delivery:</span>
            <span className="text-xs font-black font-nominal">{dashboardMetrics.deliveredTrx}</span>
          </button>

          {/* 3. Pending Merah */}
          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === 'pending' ? 'all' : 'pending'))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shrink-0 transition-all cursor-pointer min-h-[38px] ${
              statusFilter === 'pending'
                ? 'bg-rose-100 dark:bg-rose-900/80 border-rose-500 dark:border-rose-400 ring-2 ring-rose-500/40 text-rose-900 dark:text-rose-100 shadow-2xs font-bold'
                : dashboardMetrics.pendingTrx > 0
                ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700/80 text-rose-800 dark:text-rose-200 hover:bg-rose-100/70 dark:hover:bg-rose-900/50 shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-750'
            }`}
            title="Klik untuk filter hanya pesanan Pending (Merah)"
          >
            <Clock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span className="text-[10px] font-black uppercase tracking-tight">Pending:</span>
            <span className="text-xs font-black font-nominal">{dashboardMetrics.pendingTrx}</span>
          </button>

          {/* Reset Status Filter Button jika sedang aktif */}
          {statusFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[38px]"
              title="Reset filter status pesanan"
            >
              <span>Reset</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Orders Table View */}
      <OrdersTableView
        orders={displayedOrders}
        totalUnfilteredOrders={orders.length}
        currentFilterLabel={currentFilterLabel}
        onResetFilter={() => {
          setDateFilter({ type: 'all_time' });
          setSelectedStoreFilter('all');
          setSelectedKitchenFilter('all');
          setSearchQuery('');
          setStatusFilter('all');
          if (onPeriodChange) {
            onPeriodChange('all_time');
          }
        }}
        isLoading={isLoading}
        onUpdatePaymentStatus={onUpdatePaymentStatus}
        onUpdateDeliveryStatus={onUpdateDeliveryStatus}
        onUpdateGroupPaymentStatus={onUpdateGroupPaymentStatus}
        onUpdateGroupDeliveryStatus={onUpdateGroupDeliveryStatus}
        onEditOrder={onEditOrder}
        onDuplicateOrder={onDuplicateOrder}
        onDeleteOrder={onDeleteOrder}
        onDeleteBatchOrders={onDeleteBatchOrders}
        onOpenInvoiceModal={onOpenInvoiceModal}
        onExportInvoicePdf={onExportInvoicePdf}
        onViewInvoice={onViewInvoice}
      />
    </div>
  );
});
