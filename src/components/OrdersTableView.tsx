import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Printer, 
  MoreVertical, 
  Edit2, 
  Copy, 
  Trash2, 
  Package,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { OrderItem, PaymentStatus, DeliveryStatus } from '../types';
import { formatRupiah, formatTanggalDisatuin, getTokoBadgeStyle, parseIndonesianNumber, formatJam } from '../lib/formatters';
import { motion, AnimatePresence } from 'motion/react';
import { Pagination } from './Pagination';
import { TableSkeleton } from './TableSkeleton';
import { ActionMenuPortal } from './ActionMenuPortal';

interface OrderGroup {
  id: string;
  groupIndex: number;
  tujuanDapur: string;
  tanggal: string;
  createdAt?: string;
  toko: string;
  payStatus: PaymentStatus;
  delStatus: DeliveryStatus;
  items: OrderItem[];
}

interface OrdersTableViewProps {
  orders: OrderItem[];
  isLoading?: boolean;
  onUpdatePaymentStatus: (id: string, status: PaymentStatus) => void;
  onUpdateDeliveryStatus: (id: string, status: DeliveryStatus) => void;
  onUpdateGroupPaymentStatus?: (groupItems: OrderItem[], status: PaymentStatus) => void;
  onUpdateGroupDeliveryStatus?: (groupItems: OrderItem[], status: DeliveryStatus) => void;
  onEditOrder: (order: OrderItem) => void;
  onDuplicateOrder: (order: OrderItem) => void;
  onDeleteOrder: (id: string) => void;
  onDeleteBatchOrders?: (items: OrderItem[]) => void;
  onOpenInvoiceModal: (items: OrderItem[], kitchenName: string, storeName: string) => void;
  onExportInvoicePdf?: (items: OrderItem[], kitchenName: string, storeName: string, dateStr?: string) => void;
}

export const OrdersTableView: React.FC<OrdersTableViewProps> = ({
  orders,
  isLoading = false,
  onUpdatePaymentStatus,
  onUpdateDeliveryStatus,
  onUpdateGroupPaymentStatus,
  onUpdateGroupDeliveryStatus,
  onEditOrder,
  onDuplicateOrder,
  onDeleteOrder,
  onDeleteBatchOrders,
  onOpenInvoiceModal,
  onExportInvoicePdf,
}) => {
  // Pagination State (Max 15 groups per page)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Dropdown open state tracking (Rendered via ActionMenuPortal)
  const [activeMenu, setActiveMenu] = useState<{
    id: string;
    rect: DOMRect;
    group: OrderGroup;
  } | null>(null);

  // Mobile Cards (< 640px) States
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

  const toggleExpandCard = (id: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Helper getters for status fields
  const getPayStatus = (item: OrderItem): PaymentStatus => {
    if (item.paymentStatus) return item.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID';
    return item.status === 'selesai' ? 'PAID' : 'UNPAID';
  };

  const getDelStatus = (item: OrderItem): DeliveryStatus => {
    if (item.deliveryStatus) return item.deliveryStatus;
    return item.status === 'selesai' ? 'DONE' : 'PENDING';
  };

  // Group items hierarchically:
  // Group 1: ATAS -> UNPAID payment + PENDING delivery
  // Group 2: TENGAH -> PAID payment + PENDING delivery (or UNPAID payment + DONE delivery)
  // Group 3: BAWAH -> PAID payment + DONE delivery
  const sortedOrders = useMemo(() => {
    const groupAtas = orders.filter((item) => {
      const pay = getPayStatus(item);
      const del = getDelStatus(item);
      return pay === 'UNPAID' && del === 'PENDING';
    });

    const groupTengah = orders.filter((item) => {
      const pay = getPayStatus(item);
      const del = getDelStatus(item);
      return (pay === 'PAID' && del === 'PENDING') || (pay === 'UNPAID' && del === 'DONE');
    });

    const groupBawah = orders.filter((item) => {
      const pay = getPayStatus(item);
      const del = getDelStatus(item);
      return pay === 'PAID' && del === 'DONE';
    });

    return [...groupAtas, ...groupTengah, ...groupBawah];
  }, [orders]);

  // Group sorted items into OrderGroup objects by Date + Dapur + Toko
  const orderGroups = useMemo(() => {
    const map = new Map<string, OrderItem[]>();

    sortedOrders.forEach((item) => {
      const key = `${item.tanggal}||${item.tujuanDapur}||${item.toko}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    });

    const groups: OrderGroup[] = [];
    let idx = 1;

    map.forEach((items, key) => {
      const first = items[0];

      const payStatuses = items.map(getPayStatus);
      const delStatuses = items.map(getDelStatus);

      const payStatus: PaymentStatus = payStatuses.every((s) => s === 'PAID')
        ? 'PAID'
        : 'UNPAID';

      const delStatus: DeliveryStatus = delStatuses.every((s) => s === 'DONE')
        ? 'DONE'
        : 'PENDING';

      groups.push({
        id: key,
        groupIndex: idx++,
        tujuanDapur: first.tujuanDapur,
        tanggal: first.tanggal,
        createdAt: first.createdAt,
        toko: first.toko,
        payStatus,
        delStatus,
        items,
      });
    });

    return groups;
  }, [sortedOrders]);

  const totalPages = Math.ceil(orderGroups.length / pageSize);

  // Reset page to 1 if filter reduces totalPages below currentPage
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [orderGroups.length, totalPages, currentPage]);

  const paginatedGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return orderGroups.slice(startIndex, startIndex + pageSize);
  }, [orderGroups, currentPage, pageSize]);

  const handleGroupPaymentChange = (groupItems: OrderItem[], newStatus: PaymentStatus) => {
    if (onUpdateGroupPaymentStatus) {
      onUpdateGroupPaymentStatus(groupItems, newStatus);
    } else {
      groupItems.forEach((it) => onUpdatePaymentStatus(it.id, newStatus));
    }
  };

  const handleGroupDeliveryChange = (groupItems: OrderItem[], newStatus: DeliveryStatus) => {
    if (onUpdateGroupDeliveryStatus) {
      onUpdateGroupDeliveryStatus(groupItems, newStatus);
    } else {
      groupItems.forEach((it) => onUpdateDeliveryStatus(it.id, newStatus));
    }
  };

  const hasAnyOrders = orders.length > 0;

  if (isLoading && !hasAnyOrders) {
    return <TableSkeleton rows={7} />;
  }

  if (!hasAnyOrders) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center my-4 space-y-2 shadow-xs">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <Package className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-slate-900">Belum Ada Transaksi Pesanan</h3>
          <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
            Tambah pesanan baru untuk mulai mengelola data supplier, toko, dan dapur.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans text-slate-800">
      {/* 
        ========================================================================
        CARD LIST KHUSUS MOBILE (viewport < 640px: block sm:hidden)
        Langsung menampilkan daftar pesanan secara bersih tanpa section tambahan
        ========================================================================
      */}
      <div className="block sm:hidden space-y-2.5">
        {paginatedGroups.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center text-slate-500 text-xs shadow-xs">
            Tidak ada data pesanan
          </div>
        ) : (
          <div className="space-y-2.5">
            {paginatedGroups.map((group) => {
              const isExpanded = expandedCardIds.has(group.id);
              const isMenuOpen = activeMenu?.id === group.id;
              const isPaid = group.payStatus === 'PAID';
              const isDelivered = group.delStatus === 'DONE';
              const totalHjual = group.items.reduce(
                (sum, it) =>
                  sum + (parseIndonesianNumber(it.qty) || 0) * (parseIndonesianNumber(it.hargaJual) || 0),
                0
              );
              const visibleItems = isExpanded ? group.items : group.items.slice(0, 2);
              const hiddenCount = group.items.length - 2;

              return (
                <div
                  key={`mobile-card-${group.id}`}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3.5 space-y-2.5 relative"
                >
                  {/* Baris Atas: Tanggal, Dapur, Toko, dan Tombol Aksi Cepat (Print + Titik Tiga) */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-800 text-[9px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80">
                        {formatTanggalDisatuin(group.tanggal)}
                      </span>
                      <span className="bg-indigo-50 text-indigo-900 font-black px-1.5 py-0.5 rounded text-[9.5px] border border-indigo-200">
                        Dapur {group.tujuanDapur}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] border font-bold ${getTokoBadgeStyle(group.toko)}`}>
                        {group.toko}
                      </span>
                    </div>

                    {/* Quick Action Buttons (Pojok Kanan Atas) */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* 1-Click Instant Invoice PDF Download */}
                      <button
                        type="button"
                        onClick={() => {
                          if (onExportInvoicePdf) {
                            onExportInvoicePdf(group.items, group.tujuanDapur, group.toko, group.tanggal);
                          } else {
                            onOpenInvoiceModal(group.items, group.tujuanDapur, group.toko);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-900 font-extrabold shadow-2xs border border-amber-500/80 active:scale-95 transition-all cursor-pointer"
                        title={`1-Click Cetak Invoice PDF Dapur ${group.tujuanDapur}`}
                      >
                        <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>

                      {/* Menu Titik Tiga (Floating Portal) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setActiveMenu(activeMenu?.id === group.id ? null : { id: group.id, rect, group });
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
                        onClick={() => {
                          const nextStatus: PaymentStatus = isPaid ? 'UNPAID' : 'PAID';
                          handleGroupPaymentChange(group.items, nextStatus);
                        }}
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
                        onClick={() => {
                          const nextStatus: DeliveryStatus = isDelivered ? 'PENDING' : 'DONE';
                          handleGroupDeliveryChange(group.items, nextStatus);
                        }}
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
                      <span className="text-[8px] text-slate-600 block font-medium">Total Jual</span>
                      <span className="font-black font-nominal text-[11px] text-slate-900">
                        {formatRupiah(totalHjual)}
                      </span>
                    </div>
                  </div>

                  {/* List Item di dalam Card (Maksimal 2 baris, expand jika lebih) */}
                  <div className="bg-slate-50/90 rounded-xl p-2 border border-slate-100 space-y-1">
                    {visibleItems.map((it) => (
                      <div key={`card-item-${it.id}`} className="flex items-center justify-between text-[9.5px] gap-2">
                        <div className="font-bold text-slate-800 truncate">
                          • {it.namaBarang}
                          {it.pemasok && (
                            <span className="text-[8px] text-slate-600 ml-1 font-normal">
                              ({it.pemasok})
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] font-nominal font-bold text-slate-600 whitespace-nowrap">
                          {it.qty} × {formatRupiah(parseIndonesianNumber(it.hargaJual) || 0)}
                        </div>
                      </div>
                    ))}

                    {/* Expand / Collapse Button jika lebih dari 2 item */}
                    {group.items.length > 2 && (
                      <button
                        type="button"
                        onClick={() => toggleExpandCard(group.id)}
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

      {/* 
        ========================================================================
        TABEL LENGKAP YANG SUDAH ADA SEKARANG (TIDAK DIUBAH STRUKTURNYA)
        Tetap sama persis: semua transaksi, semua status, tanpa filter.
        ========================================================================
      */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden font-sans">
      {/* 
        REVISION REQUIREMENT 2:
        Table structure from Left to Right:
        DATE -> DAPUR -> ITEM -> QTY -> H. JUAL -> H. BELI -> TOKO -> PAYMENT & DELIVERY -> AKSI
      */}
      <div className="overflow-x-auto max-h-[70vh] sm:max-h-[75vh] overflow-y-auto">
        <table className="w-full text-left border-collapse text-[9.5px] relative">
          <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 shadow-2xs">
            <tr className="text-[8.5px] font-black text-slate-700 uppercase tracking-tight">
              {/* 1. NO */}
              <th className="py-2 px-1 text-center w-6 bg-slate-100 sticky top-0">
                NO
              </th>
              {/* 2. DAPUR */}
              <th className="py-2 px-1 text-center whitespace-nowrap bg-slate-100 sticky top-0 min-w-[85px]">
                DAPUR
              </th>
              {/* 3. ITEM */}
              <th className="py-2 px-1.5 bg-slate-100 sticky top-0 min-w-[120px]">
                ITEM
              </th>
              {/* 4. DATE */}
              <th className="py-2 px-1 text-center whitespace-nowrap bg-slate-100 sticky top-0 min-w-[70px]">
                DATE
              </th>
              {/* 5. QTY */}
              <th className="py-2 px-1 text-center w-7 bg-slate-100 sticky top-0">
                QTY
              </th>
              {/* 6. TOKO */}
              <th className="py-2 px-1 text-center whitespace-nowrap bg-slate-100 sticky top-0 min-w-[70px]">
                TOKO
              </th>
              {/* 7. PAYMENT */}
              <th className="py-2 px-1.5 text-center whitespace-nowrap bg-slate-100 sticky top-0 min-w-[65px]">
                PAYMENT
              </th>
              {/* 8. DILEVERY */}
              <th className="py-2 px-1.5 text-center whitespace-nowrap bg-slate-100 sticky top-0 min-w-[65px]">
                DILEVERY
              </th>
              {/* 9. H. JUAL */}
              <th className="py-2 px-1.5 text-right whitespace-nowrap bg-slate-100 sticky top-0 min-w-[80px]">
                H. JUAL
              </th>
              {/* 10. H. BELI */}
              <th className="py-2 px-1.5 text-right whitespace-nowrap bg-slate-100 sticky top-0 min-w-[80px]">
                H. BELI
              </th>
              {/* 11. AKSI */}
              <th className="py-2 px-1 text-center w-12 bg-slate-100 sticky top-0">
                AKSI
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
            {paginatedGroups.map((group) => {
              const rowSpan = group.items.length;
              return group.items.map((item, itemIdx) => {
                const isFirst = itemIdx === 0;
                const isLastInGroup = itemIdx === rowSpan - 1;

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/90 transition-colors group ${
                      isLastInGroup ? 'border-b-2 border-slate-200' : 'border-b border-slate-100'
                    }`}
                  >
                    {/* 1. NO (MERGED PER GROUP) */}
                    {isFirst && (
                      <td
                        rowSpan={rowSpan}
                        className="py-1 px-1 text-center font-mono text-[9px] font-bold text-slate-400 align-middle border-r border-slate-100 bg-slate-50/30"
                      >
                        {group.groupIndex}
                      </td>
                    )}

                    {/* 2. DAPUR (MERGED PER GROUP) */}
                    {isFirst && (
                      <td
                        rowSpan={rowSpan}
                        className="py-1 px-1 text-center whitespace-nowrap align-middle border-r border-slate-100 bg-slate-50/30"
                      >
                        <span className="inline-block bg-indigo-50 text-indigo-900 font-black px-1.5 py-0.5 rounded text-[9px] border border-indigo-200">
                          {group.tujuanDapur}
                        </span>
                      </td>
                    )}

                    {/* 3. ITEM (PER ROW ITEM) */}
                    <td className="py-1 px-1.5 align-middle">
                      <div className="font-bold text-slate-900 text-[9.5px] leading-tight">
                        {item.namaBarang}
                      </div>
                      <div className="text-[8px] text-slate-500 font-mono font-medium">
                        {item.pemasok}
                      </div>
                    </td>

                    {/* 4. DATE (MERGED PER GROUP WITH DAY ON TOP) */}
                    {isFirst && (
                      <td
                        rowSpan={rowSpan}
                        className="py-1 px-1 text-center whitespace-nowrap align-middle border-r border-slate-100 bg-slate-50/30"
                      >
                        <div className="flex flex-col items-center justify-center gap-0.5 leading-none">
                          <span className="font-bold text-slate-800 text-[9px] bg-slate-100 px-1 py-0.5 rounded border border-slate-200/80">
                            {formatTanggalDisatuin(group.tanggal)}
                          </span>
                          {(group.createdAt || group.items[0]?.createdAt) && formatJam(group.createdAt || group.items[0]?.createdAt) ? (
                            <span className="text-[8px] font-mono text-slate-500 font-medium tracking-tight">
                              {formatJam(group.createdAt || group.items[0]?.createdAt)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    )}

                    {/* 5. QTY (PER ROW ITEM) */}
                    <td className="py-1 px-1 text-center font-black font-nominal text-[9.5px] text-slate-900 align-middle border-r border-slate-100">
                      {item.qty}
                    </td>

                    {/* 6. TOKO (MERGED PER GROUP) */}
                    {isFirst && (
                      <td
                        rowSpan={rowSpan}
                        className="py-1 px-1 text-center whitespace-nowrap align-middle border-r border-slate-100"
                      >
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] border ${getTokoBadgeStyle(group.toko)}`}>
                          {group.toko}
                        </span>
                      </td>
                    )}

                    {/* 7. PAYMENT (MERGED PER GROUP WITH 1-CLICK TOGGLE) */}
                    {isFirst && (
                      <td
                        rowSpan={rowSpan}
                        className="py-1 px-1 text-center whitespace-nowrap align-middle border-r border-slate-100"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const nextStatus: PaymentStatus = group.payStatus === 'PAID' ? 'UNPAID' : 'PAID';
                            handleGroupPaymentChange(group.items, nextStatus);
                          }}
                          className={`text-[8px] font-black px-1.5 py-0.5 rounded border cursor-pointer transition-all active:scale-95 ${
                            group.payStatus === 'PAID'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                          }`}
                          title="Klik untuk ubah Payment (PAID / UNPAID)"
                        >
                          {group.payStatus === 'PAID' ? 'PAID' : 'UNPAID'}
                        </button>
                      </td>
                    )}

                    {/* 8. DILEVERY (MERGED PER GROUP WITH 1-CLICK TOGGLE) */}
                    {isFirst && (
                      <td
                        rowSpan={rowSpan}
                        className="py-1 px-1 text-center whitespace-nowrap align-middle border-r border-slate-100"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const nextStatus: DeliveryStatus = group.delStatus === 'DONE' ? 'PENDING' : 'DONE';
                            handleGroupDeliveryChange(group.items, nextStatus);
                          }}
                          className={`text-[8px] font-black px-1.5 py-0.5 rounded border cursor-pointer transition-all active:scale-95 ${
                            group.delStatus === 'DONE'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                          }`}
                          title="Klik untuk ubah Delivery (DONE / PENDING)"
                        >
                          {group.delStatus === 'DONE' ? 'DONE' : 'PENDING'}
                        </button>
                      </td>
                    )}

                    {/* 9. H. JUAL (PER ROW ITEM) */}
                    <td className="py-1 px-1.5 text-right whitespace-nowrap align-middle">
                      <div className="font-bold text-slate-900 font-nominal text-[9px]">
                        {formatRupiah(
                          (parseIndonesianNumber(item.qty) || 0) * (parseIndonesianNumber(item.hargaJual) || 0)
                        )}
                      </div>
                      <div className="text-[7.5px] text-slate-400 font-nominal">
                        @{formatRupiah(parseIndonesianNumber(item.hargaJual) || 0)}
                      </div>
                    </td>

                    {/* 10. H. BELI (PER ROW ITEM) */}
                    <td className="py-1 px-1.5 text-right whitespace-nowrap align-middle">
                      <div className="font-semibold text-slate-600 font-nominal text-[9px]">
                        {formatRupiah(
                          (parseIndonesianNumber(item.qty) || 0) * (parseIndonesianNumber(item.hargaBeli) || 0)
                        )}
                      </div>
                      <div className="text-[7.5px] text-slate-400 font-nominal">
                        @{formatRupiah(parseIndonesianNumber(item.hargaBeli) || 0)}
                      </div>
                    </td>

                    {/* 11. AKSI (MERGED PER GROUP) */}
                    {isFirst && (
                      <td
                        rowSpan={rowSpan}
                        className="py-1 px-0.5 text-center relative align-middle border-l border-slate-100"
                      >
                        <div className="flex items-center justify-center space-x-0.5">
                          {/* 
                            1-Click Instant Invoice PDF Download
                          */}
                          <button
                            onClick={() => {
                              if (onExportInvoicePdf) {
                                onExportInvoicePdf(group.items, group.tujuanDapur, group.toko, group.tanggal);
                              } else {
                                onOpenInvoiceModal(group.items, group.tujuanDapur, group.toko);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-900 font-extrabold shadow-2xs transition-all active:scale-95 border border-amber-500/80 cursor-pointer"
                            title={`1-Click Export Invoice PDF Dapur ${group.tujuanDapur}`}
                          >
                            <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>

                          {/* 3-dots Menu for Edit / Duplicate / Delete (Floating Portal) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setActiveMenu(activeMenu?.id === group.id ? null : { id: group.id, rect, group });
                            }}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                              activeMenu?.id === group.id
                                ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 ring-2 ring-indigo-500/20 shadow-2xs'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-transparent active:scale-95'
                            }`}
                            title="Menu Aksi"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>

    {/* Spacer bawah khusus mobile agar tidak overlap dengan floating button "+" dan bottom nav bar */}
    <div className="h-24 sm:h-0 block sm:hidden pointer-events-none" aria-hidden="true" />

    {/* Floating Portal Action Menu (Minimalist & Professional, renders outside table) */}
    <ActionMenuPortal
      isOpen={!!activeMenu}
      targetRect={activeMenu?.rect || null}
      onClose={() => setActiveMenu(null)}
      title="Detail Pesanan"
      batchNumber={activeMenu?.group.groupIndex}
      items={activeMenu?.group.items || []}
      onEdit={onEditOrder}
      onDuplicate={onDuplicateOrder}
      onDelete={onDeleteOrder}
      onDeleteBatch={() => {
        if (activeMenu?.group) {
          if (onDeleteBatchOrders) {
            onDeleteBatchOrders(activeMenu.group.items);
          } else {
            activeMenu.group.items.forEach((it) => onDeleteOrder(it.id));
          }
        }
      }}
    />
  </div>
);
};
