import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Trash2, 
  Truck,
  Edit2,
  Copy,
  Store as StoreIcon,
  MoreVertical,
  X,
  Receipt,
  Utensils,
  Package,
  ChevronDown,
  ChevronUp,
  Filter,
  Activity
} from 'lucide-react';
import { OrderItem, Kitchen, PaymentStatus, DeliveryStatus } from '../types';
import { formatRupiah, formatTanggalDisatuin, getTokoBadgeStyle, formatJam } from '../lib/formatters';
import { motion, AnimatePresence } from 'motion/react';
import { Pagination } from './Pagination';
import { TableSkeleton } from './TableSkeleton';
import { ActionMenuPortal } from './ActionMenuPortal';

interface TransactionBatch {
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
  isLoading?: boolean;
  invoices?: any[];
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
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  orders,
  invoices = [],
  isLoading = false,
  onUpdatePaymentStatus,
  onUpdateDeliveryStatus,
  onUpdateGroupPaymentStatus,
  onUpdateGroupDeliveryStatus,
  onEditOrder,
  onDuplicateOrder,
  onDeleteOrder,
  onOpenInvoiceModal,
  onExportInvoicePdf,
  onDeleteInvoice,
  onDeleteTransaction,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPemasok, setSelectedPemasok] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'PAID' | 'UNPAID'>('all');

  // Pagination state (max 15 batches per page)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Active 3-dots action menu tracking (Rendered via ActionMenuPortal)
  const [activeMenu, setActiveMenu] = useState<{
    id: string;
    rect: DOMRect;
    batch: TransactionBatch;
  } | null>(null);

  // Mobile Cards (< 640px) States
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

  // Extract unique suppliers (Pemasok)
  const pemasokList = useMemo(() => {
    const fromOrders = orders.map((o) => o.pemasok);
    const fromInvoices = (invoices || []).map((inv) => (inv as any).pemasok || (inv as any).PEMASOK || inv.items?.[0]?.pemasok);
    const list = Array.from(new Set([...fromOrders, ...fromInvoices])).filter(Boolean);
    return list.sort();
  }, [orders, invoices]);

  // Helper getters for payment status
  const getPayStatus = (item: OrderItem): 'PAID' | 'UNPAID' => {
    if (item.paymentStatus) {
      return item.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID';
    }
    return item.status === 'selesai' ? 'PAID' : 'UNPAID';
  };

  /* 
    REVISION REQUIREMENT 4 & GOOGLE SHEETS "transaksi" SYNC:
    Merge transaction into 1 transaction per order batch matching the initial order input
    (grouped by Tanggal + Dapur + Toko + Pemasok) + rows from sheet "transaksi"
  */
  const transactionBatches = useMemo(() => {
    const map = new Map<string, OrderItem[]>();

    orders.forEach((item) => {
      const key = `${item.tanggal}||${item.tujuanDapur}||${item.toko}||${item.pemasok}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    });

    const batches: TransactionBatch[] = [];
    let idx = 1;

    map.forEach((items, key) => {
      const first = items[0];
      const allPaid = items.every((i) => getPayStatus(i) === 'PAID');
      const payStatus: PaymentStatus = allPaid ? 'PAID' : 'UNPAID';

      const allDelivered = items.every((i) =>
        i.deliveryStatus ? i.deliveryStatus === 'DONE' : i.status === 'selesai'
      );
      const delStatus: DeliveryStatus = allDelivered ? 'DONE' : 'PENDING';

      const totalQty = items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
      const totalBeli = items.reduce((sum, i) => sum + (Number(i.qty) || 0) * (Number(i.hargaBeli) || 0), 0);
      const totalJual = items.reduce((sum, i) => sum + (Number(i.qty) || 0) * (Number(i.hargaJual || i.hargaBeli) || 0), 0);

      batches.push({
        id: key,
        batchIndex: idx++,
        tanggal: first.tanggal,
        createdAt: first.createdAt,
        tujuanDapur: first.tujuanDapur,
        toko: first.toko,
        pemasok: first.pemasok,
        payStatus,
        delStatus,
        totalQty,
        totalBeli,
        totalJual,
        items,
      });
    });

    // Also include rows fetched directly from sheet "transaksi" (invoices)
    if (invoices && invoices.length > 0) {
      invoices.forEach((inv: any) => {
        const invDate = inv.tanggalPrint || inv.tanggal || inv.createdAt?.split('T')[0] || '';
        const invDapur = inv.tujuanDapur || inv.items?.[0]?.tujuanDapur || 'Siliragung';
        const invToko = inv.toko || inv.items?.[0]?.toko || '';
        const invPemasok = inv.pemasok || inv.PEMASOK || inv.items?.[0]?.pemasok || 'Pemasok 1';
        const key = `${invDate}||${invDapur}||${invToko}||${invPemasok}`;

        // Check if already represented by an order batch
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


  // Filter transaction batches
  const filteredBatches = useMemo(() => {
    return transactionBatches.filter((batch) => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesSearch =
          batch.tujuanDapur.toLowerCase().includes(q) ||
          batch.toko.toLowerCase().includes(q) ||
          batch.pemasok.toLowerCase().includes(q) ||
          batch.items.some((i) => i.namaBarang.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      if (selectedPemasok !== 'all' && batch.pemasok !== selectedPemasok) {
        return false;
      }

      if (selectedStatusFilter !== 'all' && batch.payStatus !== selectedStatusFilter) {
        return false;
      }

      return true;
    });
  }, [transactionBatches, searchQuery, selectedPemasok, selectedStatusFilter]);

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
        CARD LIST KHUSUS MOBILE (viewport < 640px: block sm:hidden)
        Langsung menampilkan daftar transaksi secara bersih tanpa section tambahan
        ========================================================================
      */}
      <div className="block sm:hidden space-y-2.5">
        {paginatedBatches.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center text-slate-500 text-xs shadow-xs">
            Tidak ada data transaksi yang sesuai filter
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
                  {/* Baris Atas: Tanggal, Dapur, Pemasok, Toko, dan Tombol Menu Titik Tiga (Tanpa Print) */}
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

                    {/* Quick Action Button: Titik Tiga & Hapus Cepat (Floating Portal) */}
                    <div className="flex items-center gap-1 flex-shrink-0">
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
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 active:scale-95 transition-all cursor-pointer"
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
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
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

                  {/* Status Badges (Soft Colors) & Total */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      {/* Payment Status Badge 1-Click Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleBatchPayment(batch)}
                        className={`px-2 py-0.5 rounded-full text-[8.5px] font-black border transition-all active:scale-95 cursor-pointer ${
                          isPaid
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                        title="Klik untuk ubah Payment (PAID / UNPAID)"
                      >
                        {isPaid ? 'PAID' : 'UNPAID'}
                      </button>

                      {/* Delivery Status Badge 1-Click Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleBatchDelivery(batch)}
                        className={`px-2 py-0.5 rounded-full text-[8.5px] font-black border transition-all active:scale-95 cursor-pointer ${
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
                      <span className="text-[8px] text-slate-600 block font-medium">Total Beli</span>
                      <span className="font-black font-nominal text-[11px] text-slate-900">
                        {formatRupiah(batch.totalBeli)}
                      </span>
                    </div>
                  </div>

                  {/* List Item di dalam Card (Maksimal 2 baris, expand jika lebih) */}
                  <div className="bg-slate-50/90 rounded-xl p-2 border border-slate-100 space-y-1">
                    {visibleItems.map((it) => (
                      <div key={`card-item-${it.id}`} className="flex items-center justify-between text-[9.5px] gap-2">
                        <div className="font-bold text-slate-800 truncate">
                          • {it.namaBarang}
                        </div>
                        <div className="text-[9px] font-nominal font-bold text-slate-600 whitespace-nowrap">
                          {it.qty} × {formatRupiah(it.hargaBeli)}
                        </div>
                      </div>
                    ))}

                    {/* Expand / Collapse Button jika lebih dari 2 item */}
                    {batch.items.length > 2 && (
                      <button
                        type="button"
                        onClick={() => toggleExpandBatch(batch.id)}
                        className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-0.5 cursor-pointer transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            <span>Sembunyikan</span>
                            <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            <span>+{hiddenCount} item lainnya</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Search & Filter Toolbar (Matching Pill Design from User Reference) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Pill Filters Group */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Pill 1: Filter Pemasok with Purple Filter Icon */}
          <div className="relative inline-flex items-center">
            <div className="rounded-full px-4 py-2 bg-white border border-indigo-200/90 shadow-2xs hover:border-indigo-400 hover:shadow-xs transition-all flex items-center gap-2 cursor-pointer">
              <Filter className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                {selectedPemasok === 'all' ? 'Semua Pemasok' : selectedPemasok}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            </div>
            <select
              value={selectedPemasok}
              onChange={(e) => setSelectedPemasok(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs"
            >
              <option value="all">Semua Pemasok ({pemasokList.length})</option>
              {pemasokList.map((p) => (
                <option key={p} value={p}>
                  Pemasok: {p}
                </option>
              ))}
            </select>
          </div>

          {/* Pill 2: Filter Status with Purple Activity Icon */}
          <div className="relative inline-flex items-center">
            <div className="rounded-full px-4 py-2 bg-white border border-indigo-200/90 shadow-2xs hover:border-indigo-400 hover:shadow-xs transition-all flex items-center gap-2 cursor-pointer">
              <Activity className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                {selectedStatusFilter === 'all'
                  ? 'Semua Status'
                  : selectedStatusFilter === 'PAID'
                  ? 'Status: LUNAS (PAID)'
                  : 'Status: BELUM LUNAS (UNPAID)'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            </div>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs"
            >
              <option value="all">Semua Status (PAID &amp; UNPAID)</option>
              <option value="UNPAID">UNPAID (Belum Lunas)</option>
              <option value="PAID">PAID (Lunas)</option>
            </select>
          </div>
        </div>

        {/* Search Input in pill aesthetic */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari transaksi, barang, pemasok, dapur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-7 py-2 bg-white border border-slate-200/90 rounded-full text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* MERGED OUTCOME TRANSACTIONS TABLE */}
      {isLoading && filteredBatches.length === 0 ? (
        <TableSkeleton rows={6} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {filteredBatches.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-extrabold text-slate-900">
                Tidak Ada Transaksi Ditemukan
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Coba sesuaikan kata kunci pencarian atau filter di atas.
              </p>
            </div>
          ) : (
            <>
              <div className="w-full overflow-x-auto max-h-[70vh] sm:max-h-[75vh] overflow-y-auto">
              <table className="w-full text-left border-collapse text-[9.5px] relative">
                <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 shadow-2xs">
                  <tr className="text-[8.5px] font-black text-slate-700 uppercase tracking-wider">
                    <th className="py-2 px-1.5 text-center w-6 bg-slate-100 sticky top-0">NO</th>
                    <th className="py-2 px-1.5 whitespace-nowrap bg-slate-100 sticky top-0 min-w-[70px]">TANGGAL</th>
                    <th className="py-2 px-1.5 whitespace-nowrap bg-slate-100 sticky top-0 min-w-[85px]">PEMASOK</th>
                    <th className="py-2 px-2 bg-slate-100 sticky top-0 min-w-[150px]">BARANG</th>
                    <th className="py-2 px-1.5 text-center whitespace-nowrap bg-slate-100 sticky top-0 min-w-[70px]">TOKO</th>
                    <th className="py-2 px-1 text-center w-8 bg-slate-100 sticky top-0">QTY</th>
                    <th className="py-2 px-2 text-right whitespace-nowrap bg-slate-100 sticky top-0 min-w-[85px]">H. BELI</th>
                    <th className="py-2 px-2 text-right whitespace-nowrap bg-slate-100 sticky top-0 min-w-[85px]">TOTAL</th>
                    <th className="py-2 px-1.5 text-center whitespace-nowrap bg-slate-100 sticky top-0 min-w-[75px]">STATUS</th>
                    <th className="py-2 px-1 text-center w-14 bg-slate-100 sticky top-0">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800 bg-white">
                  {paginatedBatches.map((batch) => {
                    const isPaid = batch.payStatus === 'PAID';
                    const isMenuOpen = activeMenu?.id === batch.id;

                    return (
                      <tr key={batch.id} className="hover:bg-slate-50/90 transition-colors">
                        {/* 1. NO */}
                        <td className="py-2 px-1.5 text-center font-mono text-[9px] font-bold text-slate-400 align-middle">
                          {batch.batchIndex}
                        </td>

                        {/* 2. TANGGAL */}
                        <td className="py-2 px-1.5 whitespace-nowrap align-middle">
                          <span className="font-bold text-slate-800 text-[9px] bg-slate-100 px-1 py-0.5 rounded border border-slate-200/80">
                            {formatTanggalDisatuin(batch.tanggal)}
                          </span>
                        </td>

                        {/* 3. PEMASOK */}
                        <td className="py-2 px-1.5 align-middle">
                          <span className="inline-flex items-center gap-1 font-extrabold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[9px] border border-slate-200/80 truncate max-w-[120px]">
                            <Truck className="w-3 h-3 text-indigo-600 flex-shrink-0" />
                            <span className="truncate">{batch.pemasok}</span>
                          </span>
                        </td>

                        {/* 4. BARANG (ITEM TRANSAKSI & DAPUR) */}
                        <td className="py-2 px-2 align-middle">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="inline-block bg-indigo-50 text-indigo-900 font-black px-1.5 py-0.2 rounded text-[8.5px] border border-indigo-200">
                              {batch.tujuanDapur}
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
                        <td className="py-2 px-1.5 text-center whitespace-nowrap align-middle">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] border ${getTokoBadgeStyle(batch.toko)}`}>
                            {batch.toko}
                          </span>
                        </td>

                        {/* 6. QTY */}
                        <td className="py-2 px-1 text-center font-black font-nominal text-[10px] text-slate-900 align-middle">
                          {batch.totalQty}
                        </td>

                        {/* 7. H. BELI */}
                        <td className="py-2 px-2 text-right font-black font-nominal text-[10px] text-slate-900 align-middle whitespace-nowrap">
                          {formatRupiah(batch.totalBeli)}
                        </td>

                        {/* 8. TOTAL */}
                        <td className="py-2 px-2 text-right font-black font-nominal text-[10px] text-emerald-800 align-middle whitespace-nowrap">
                          {formatRupiah(batch.totalJual || batch.totalBeli)}
                        </td>

                        {/* 9. STATUS PAYMENT 1-CLICK TOGGLE */}
                        <td className="py-2 px-1.5 text-center whitespace-nowrap align-middle">
                          <button
                            type="button"
                            onClick={() => handleToggleBatchPayment(batch)}
                            className={`px-2 py-0.5 rounded text-[8.5px] font-black cursor-pointer transition-all active:scale-95 border ${
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
                        <td className="py-2 px-1 text-center align-middle">
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

    {/* Spacer bawah khusus mobile agar tidak overlap dengan floating button "+" dan bottom nav bar */}
    <div className="h-24 sm:h-0 block sm:hidden pointer-events-none" aria-hidden="true" />

    {/* Floating Portal Action Menu (Minimalist & Professional, renders outside table) */}
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
  </div>
);
};
