import React, { useState, useMemo, useCallback } from 'react';
import { 
  Wallet, 
  Search, 
  Store as StoreIcon, 
  ChevronDown, 
  X, 
  Building2, 
  CheckCircle2, 
  Clock, 
  Filter,
  Package
} from 'lucide-react';
import { OrderItem, PaymentStatus, Store as StoreType } from '../types';
import { 
  formatRupiah, 
  parseIndonesianNumber, 
  formatTanggalDisatuin, 
  normalizeDateSimple,
  formatTanggalSimple,
  getTodayWIB
} from '../lib/formatters';
import { DateFilterPill, DateFilterValue } from './DateFilterPill';
import { Pagination } from './Pagination';

const PAGE_SIZE_OPTIONS = [20, 40, 60, 80, 100];

interface SupplierMonitoringViewProps {
  orders: OrderItem[];
  stores?: StoreType[];
  pemasokList?: string[];
  onUpdatePaymentStatus?: (id: string, status: PaymentStatus) => void;
  onUpdateGroupPaymentStatus?: (groupItems: OrderItem[], status: PaymentStatus) => void;
}

export const SupplierMonitoringView: React.FC<SupplierMonitoringViewProps> = React.memo(({
  orders,
  stores = [],
  pemasokList = [],
  onUpdatePaymentStatus,
}) => {
  // Filter States
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [selectedPemasok, setSelectedPemasok] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'UNPAID' | 'PAID'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({
    startDate: '',
    endDate: '',
  });

  // Pagination State (Kelipatan 20, default 20)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Normalizer status pembayaran ke pemasok
  const getItemPayStatus = useCallback((item: OrderItem): PaymentStatus => {
    if (item.paymentStatus) {
      return item.paymentStatus.toUpperCase() === 'PAID' ? 'PAID' : 'UNPAID';
    }
    if (item.status_pembayaran) {
      return item.status_pembayaran.toUpperCase() === 'PAID' ? 'PAID' : 'UNPAID';
    }
    return item.status === 'selesai' ? 'PAID' : 'UNPAID';
  }, []);

  // Filter orders according to date, store, supplier, status, and search
  const filteredOrders = useMemo(() => {
    return orders.filter((item) => {
      // 1. Rentang Tanggal (jika diisi)
      if (dateFilter.startDate || dateFilter.endDate) {
        const itemDate = item.tanggal
          ? normalizeDateSimple(item.tanggal)
          : (item.createdAt ? normalizeDateSimple(item.createdAt) : null);
        if (!itemDate) return false;
        if (dateFilter.startDate && itemDate < dateFilter.startDate) return false;
        if (dateFilter.endDate && itemDate > dateFilter.endDate) return false;
      }

      // 2. Filter Toko
      if (selectedStoreFilter !== 'all' && item.toko !== selectedStoreFilter) {
        return false;
      }

      // 3. Filter Pemasok
      if (selectedPemasok !== 'all' && item.pemasok !== selectedPemasok) {
        return false;
      }

      // 4. Filter Status (PAID vs UNPAID)
      const payStatus = getItemPayStatus(item);
      if (statusFilter !== 'all' && payStatus !== statusFilter) {
        return false;
      }

      // 5. Pencarian
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchItem = item.namaBarang?.toLowerCase().includes(q);
        const matchPemasok = item.pemasok?.toLowerCase().includes(q);
        const matchToko = item.toko?.toLowerCase().includes(q);
        const matchDapur = item.tujuanDapur?.toLowerCase().includes(q);
        const matchNota = (item.notaId || (item as any).nota_id || '')?.toLowerCase().includes(q);
        if (!matchItem && !matchPemasok && !matchToko && !matchDapur && !matchNota) return false;
      }

      return true;
    });
  }, [
    orders,
    dateFilter,
    selectedStoreFilter,
    selectedPemasok,
    statusFilter,
    searchQuery,
    getItemPayStatus,
  ]);

  // Reset pagination saat filter berubah
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedStoreFilter, selectedPemasok, statusFilter, searchQuery, dateFilter]);

  // Financial Metrics: Total Beli, Sudah Bayar, Belum Bayar
  const metrics = useMemo(() => {
    let totalBeliSemua = 0;
    let totalBeliPaid = 0;
    let totalBeliUnpaid = 0;
    let countPaid = 0;
    let countUnpaid = 0;

    // Filter berdasarkan pool tanggal & toko
    const baseOrders = orders.filter((item) => {
      if (dateFilter.startDate || dateFilter.endDate) {
        const itemDate = item.tanggal
          ? normalizeDateSimple(item.tanggal)
          : (item.createdAt ? normalizeDateSimple(item.createdAt) : null);
        if (!itemDate) return false;
        if (dateFilter.startDate && itemDate < dateFilter.startDate) return false;
        if (dateFilter.endDate && itemDate > dateFilter.endDate) return false;
      }
      if (selectedStoreFilter !== 'all' && item.toko !== selectedStoreFilter) {
        return false;
      }
      return true;
    });

    baseOrders.forEach((item) => {
      const rawQtyJual = parseIndonesianNumber(item.qty) || 0;
      const returQty = Math.min(rawQtyJual, Math.max(0, Number(item.retur) || 0));
      const rawQtyBeli = item.qtyBeli !== undefined && item.qtyBeli !== null
        ? parseIndonesianNumber(item.qtyBeli)
        : (item.qty_beli !== undefined && item.qty_beli !== null
            ? parseIndonesianNumber(item.qty_beli)
            : rawQtyJual);
      const finalQtyBeli = Math.max(0, rawQtyBeli - returQty);
      const hBeli = parseIndonesianNumber(item.hargaBeli) || 0;
      const subtotalBeli = finalQtyBeli * hBeli;

      totalBeliSemua += subtotalBeli;
      const payStatus = getItemPayStatus(item);
      if (payStatus === 'PAID') {
        totalBeliPaid += subtotalBeli;
        countPaid++;
      } else {
        totalBeliUnpaid += subtotalBeli;
        countUnpaid++;
      }
    });

    return {
      totalBeliSemua,
      totalBeliPaid,
      totalBeliUnpaid,
      countPaid,
      countUnpaid,
      totalCount: baseOrders.length,
    };
  }, [orders, dateFilter, selectedStoreFilter, getItemPayStatus]);

  // Totals dari item yang sedang terfilter di tabel
  const tableSummary = useMemo(() => {
    let totalQty = 0;
    let totalBeli = 0;

    filteredOrders.forEach((item) => {
      const rawQtyJual = parseIndonesianNumber(item.qty) || 0;
      const returQty = Math.min(rawQtyJual, Math.max(0, Number(item.retur) || 0));
      const rawQtyBeli = item.qtyBeli !== undefined && item.qtyBeli !== null
        ? parseIndonesianNumber(item.qtyBeli)
        : (item.qty_beli !== undefined && item.qty_beli !== null
            ? parseIndonesianNumber(item.qty_beli)
            : rawQtyJual);
      const finalQtyBeli = Math.max(0, rawQtyBeli - returQty);
      const hBeli = parseIndonesianNumber(item.hargaBeli) || 0;
      totalQty += finalQtyBeli;
      totalBeli += finalQtyBeli * hBeli;
    });

    return { totalQty, totalBeli };
  }, [filteredOrders]);

  // Pagination slice
  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Toggle handler status bayar ke pemasok
  const handleTogglePayment = useCallback((item: OrderItem) => {
    const currentPay = getItemPayStatus(item);
    const nextPay: PaymentStatus = currentPay === 'PAID' ? 'UNPAID' : 'PAID';
    if (onUpdatePaymentStatus) {
      onUpdatePaymentStatus(item.id, nextPay);
    }
  }, [getItemPayStatus, onUpdatePaymentStatus]);

  return (
    <div className="space-y-4 pt-1 pb-36 sm:pb-24 font-sans text-slate-800 dark:text-slate-200 transition-colors">
      {/* 1. Header Toolbar Filter */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Filter Toko */}
          <div className="relative inline-flex items-center">
            <div
              className={`rounded-full px-3.5 py-2 border shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
                selectedStoreFilter !== 'all'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 font-bold ring-1 ring-indigo-300 dark:ring-indigo-700'
                  : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-indigo-300'
              }`}
            >
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
              <option value="all">Semua Toko ({stores.length})</option>
              {stores.map((st) => (
                <option key={st.id} value={st.nama}>
                  Toko {st.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Pemasok Dropdown */}
          <div className="relative inline-flex items-center">
            <div
              className={`rounded-full px-3.5 py-2 border shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
                selectedPemasok !== 'all'
                  ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200 font-bold ring-1 ring-rose-300 dark:ring-rose-700'
                  : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-rose-300'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="text-xs font-bold whitespace-nowrap">
                {selectedPemasok === 'all' ? 'Semua Pemasok' : selectedPemasok}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
            </div>
            <select
              value={selectedPemasok}
              onChange={(e) => setSelectedPemasok(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              aria-label="Filter Pemasok"
            >
              <option value="all">Semua Pemasok ({pemasokList.length})</option>
              {pemasokList.map((pem) => (
                <option key={pem} value={pem}>
                  {pem}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Tanggal */}
          <DateFilterPill value={dateFilter} onChange={setDateFilter} />

          {/* Reset Filters jika ada yang aktif */}
          {(selectedStoreFilter !== 'all' || selectedPemasok !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSelectedStoreFilter('all');
                setSelectedPemasok('all');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer min-h-[44px]"
            >
              <span>Reset Filter</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Kolom Pencarian */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari barang, pemasok, nota..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-7 py-2.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-full text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 shadow-2xs transition-all min-h-[44px]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Panel Ringkasan Finansial Pengeluaran Pembelian (Pemasok) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800 shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 truncate">
              Monitoring Pembelian (Pemasok)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Monitoring status pelunasan uang beli barang ke pemasok/supplier
            </p>
          </div>
        </div>

        {/* 3 Kotak Finansial: Total Beli, Sudah Bayar, Belum Bayar */}
        <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
          {/* Total Beli */}
          <div className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 min-w-[110px]">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight block">
              Total Beli
            </span>
            <span className="text-xs sm:text-sm font-black font-nominal text-slate-900 dark:text-slate-100 block truncate">
              {formatRupiah(metrics.totalBeliSemua)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
              {metrics.totalCount} item
            </span>
          </div>

          {/* Sudah Bayar (PAID) */}
          <div className="p-2 sm:px-3 sm:py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/80 min-w-[110px]">
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-tight block">
              Sudah Bayar
            </span>
            <span className="text-xs sm:text-sm font-black font-nominal text-emerald-800 dark:text-emerald-200 block truncate">
              {formatRupiah(metrics.totalBeliPaid)}
            </span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block truncate">
              {metrics.countPaid} lunas
            </span>
          </div>

          {/* Belum Bayar (UNPAID) */}
          <div className="p-2 sm:px-3 sm:py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700/80 min-w-[110px]">
            <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-tight block">
              Belum Bayar
            </span>
            <span className="text-xs sm:text-sm font-black font-nominal text-rose-800 dark:text-rose-200 block truncate">
              {formatRupiah(metrics.totalBeliUnpaid)}
            </span>
            <span className="text-[10px] text-rose-700 dark:text-rose-400 block truncate">
              {metrics.countUnpaid} tagihan
            </span>
          </div>
        </div>
      </div>

      {/* 3. Bar Filter Status Cepat & Selector Tampilan Baris (Kelipatan 20) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Filter Status Cepat */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Semua ({metrics.totalCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('UNPAID')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              statusFilter === 'UNPAID'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-rose-700 dark:text-rose-300 hover:bg-rose-100/50 dark:hover:bg-rose-950/40'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Belum Bayar ({metrics.countUnpaid})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PAID')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              statusFilter === 'PAID'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/40'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Sudah Bayar ({metrics.countPaid})</span>
          </button>
        </div>

        {/* Selector Tampilan Baris (Kelipatan 20: 20, 40, 60, 80, 100) */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            Tampil Baris:
          </span>
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  pageSize === size
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={`Tampilkan ${size} baris data (Kelipatan 20)`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Tabel Monitoring Pengeluaran Pembelian */}
      {/* Kolom yang diminta:
          1. PEMASOK
          2. ITEM (Nama item, di bawahnya catatan dari transaksi kalau ada)
          3. JUMLAH KUANTITAS & HARGA SATUAN BELI
          4. TOTAL BELI
          5. STATUS (PAID / UNPAID)
      */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-xs table-fixed min-w-[760px] sm:min-w-0">
            <colgroup>
              <col style={{ width: '23%' }} />
              <col style={{ width: '31%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-2xs">
              <tr className="text-[10px] sm:text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {/* 1. PEMASOK */}
                <th className="py-3 px-3">PEMASOK</th>
                {/* 2. ITEM */}
                <th className="py-3 px-3">ITEM</th>
                {/* 3. JUMLAH KUANTITAS & HARGA SATUAN BELI */}
                <th className="py-3 px-2 text-center">KUANTITAS & HARGA BELI</th>
                {/* 4. TOTAL BELI */}
                <th className="py-3 px-3 text-right">TOTAL BELI</th>
                {/* 5. STATUS PAID / UNPAID */}
                <th className="py-3 px-2 text-center">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 px-4 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <Package className="w-6 h-6" />
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                        Tidak Ada Data Pengeluaran Pembelian
                      </h3>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        Tidak ditemukan catatan pembelian pada filter ini. Coba sesuaikan filter status, pemasok, atau tanggal.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((item) => {
                  const rawQtyJual = parseIndonesianNumber(item.qty) || 0;
                  const returQty = Math.min(rawQtyJual, Math.max(0, Number(item.retur) || 0));
                  const finalQtyJual = Math.max(0, rawQtyJual - returQty);

                  const rawQtyBeli = item.qtyBeli !== undefined && item.qtyBeli !== null
                    ? parseIndonesianNumber(item.qtyBeli)
                    : (item.qty_beli !== undefined && item.qty_beli !== null
                        ? parseIndonesianNumber(item.qty_beli)
                        : rawQtyJual);
                  const finalQtyBeli = Math.max(0, rawQtyBeli - returQty);

                  const hargaBeli = parseIndonesianNumber(item.hargaBeli) || 0;
                  const subtotalBeli = finalQtyBeli * hargaBeli;
                  const payStatus = getItemPayStatus(item);
                  const isPaid = payStatus === 'PAID';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {/* 1. KOLOM PEMASOK */}
                      <td className="py-3 px-3 align-middle">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-extrabold text-slate-900 dark:text-slate-100 text-xs leading-snug break-words">
                            {item.pemasok || '-'}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                            {item.tanggal && (
                              <span className="font-bold font-mono text-slate-700 dark:text-slate-300">
                                {formatTanggalDisatuin(item.tanggal)}
                              </span>
                            )}
                            {(item.tujuanDapur || (item as any).dapur) && (
                              <span className="font-bold text-purple-700 dark:text-purple-400">
                                · {(item.tujuanDapur || (item as any).dapur).toLowerCase().startsWith('dapur')
                                  ? (item.tujuanDapur || (item as any).dapur)
                                  : `Dapur ${item.tujuanDapur || (item as any).dapur}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. KOLOM ITEM (Nama item di atas, di bawahnya CATATAN DARI TRANSAKSI KALAU ADA) */}
                      <td className="py-3 px-3 align-middle">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-black text-slate-900 dark:text-slate-100 text-xs leading-snug break-words">
                            {item.namaBarang}
                          </span>
                          {/* Di bawah nama item: Catatan dari transaksi kalau ada */}
                          {item.catatan && item.catatan.trim().length > 0 ? (
                            <div className="text-[10px] sm:text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200/70 dark:border-amber-800/70 font-medium inline-flex items-center gap-1 w-fit mt-0.5 max-w-full">
                              <span className="font-bold shrink-0">Catatan:</span>
                              <span className="truncate">{item.catatan}</span>
                            </div>
                          ) : null}
                        </div>
                      </td>

                      {/* 3. KOLOM JUMLAH KUANTITAS BARANG & HARGA SATUAN BELI */}
                      <td className="py-3 px-2 text-center align-middle whitespace-nowrap">
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className="inline-block px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold font-nominal text-xs text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            {finalQtyBeli} {item.satuan || ''}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-nominal">
                            @{formatRupiah(hargaBeli)}
                          </span>
                        </div>
                      </td>

                      {/* 4. KOLOM TOTAL BELI */}
                      <td className="py-3 px-3 text-right align-middle whitespace-nowrap">
                        <span className="font-black text-slate-900 dark:text-slate-100 font-nominal text-xs sm:text-[13px]">
                          {formatRupiah(subtotalBeli)}
                        </span>
                      </td>

                      {/* 5. KOLOM STATUS PAID / UNPAID (TOGGLE 1-KLIK) */}
                      <td className="py-3 px-2 text-center align-middle whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleTogglePayment(item)}
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all active:scale-95 cursor-pointer min-h-[32px] ${
                            isPaid
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 shadow-2xs'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700 hover:bg-rose-100 shadow-2xs'
                          }`}
                          title={
                            isPaid
                              ? 'Status LUNAS ke pemasok (Klik untuk ubah ke UNPAID)'
                              : 'Status BELUM DIBAYAR ke pemasok (Klik untuk ubah ke PAID)'
                          }
                        >
                          {isPaid ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>PAID</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                              <span>UNPAID</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* TFOOT TOTAL REKAP */}
            {filteredOrders.length > 0 && (
              <tfoot className="sticky bottom-0 z-10 bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-700 shadow-2xs">
                <tr className="text-slate-900 dark:text-slate-100 text-xs font-bold">
                  <td colSpan={2} className="py-3 px-3 uppercase tracking-wider font-extrabold text-[11px] truncate">
                    TOTAL ({filteredOrders.length} Barang Terfilter) :
                  </td>
                  <td className="py-3 px-2 text-center font-black font-nominal text-xs">
                    {tableSummary.totalQty}
                  </td>
                  <td className="py-3 px-3 text-right font-black font-nominal text-xs sm:text-[13px] text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {formatRupiah(tableSummary.totalBeli)}
                  </td>
                  <td className="py-3 px-2 text-center text-slate-400 dark:text-slate-500 font-medium text-[10px]">
                    -
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredOrders.length > 0 && (
          <div className="p-3 border-t border-slate-100 dark:border-slate-800">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredOrders.length}
              pageSize={pageSize}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          </div>
        )}
      </div>
    </div>
  );
});
