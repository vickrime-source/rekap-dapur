import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Printer, 
  MoreVertical, 
  Edit2, 
  Copy, 
  Trash2, 
  Package,
  ChevronDown,
  ChevronUp,
  Eye,
  Truck,
  FileText
} from 'lucide-react';
import { OrderItem, PaymentStatus, DeliveryStatus, InvoicePriceVariant } from '../types';
import { formatRupiah, formatTanggalDisatuin, getTokoBadgeStyle, parseIndonesianNumber, formatJam } from '../lib/formatters';
import { motion, AnimatePresence } from 'motion/react';
import { Pagination } from './Pagination';
import { TableSkeleton } from './TableSkeleton';
import { ActionMenuPortal } from './ActionMenuPortal';
import { PrintVariantDropdownPortal } from './PrintVariantDropdownPortal';

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

interface OrderRowProps {
  item: OrderItem;
  itemIdx: number;
  rowSpan: number;
  group: OrderGroup;
  isActiveMenu: boolean;
  onToggleActiveMenu: (id: string, rect: DOMRect, group: OrderGroup) => void;
  onGroupPaymentChange: (groupItems: OrderItem[], status: PaymentStatus) => void;
  onGroupDeliveryChange: (groupItems: OrderItem[], status: DeliveryStatus) => void;
  onOpenInvoiceModal: (items: OrderItem[], kitchenName: string, storeName: string) => void;
  onExportInvoicePdf?: (items: OrderItem[], kitchenName: string, storeName: string, dateStr?: string, variant?: InvoicePriceVariant) => void;
  onViewInvoice?: (items: OrderItem[], kitchenName: string, storeName: string, dateStr?: string) => void;
  onEditOrder?: (order: OrderItem, batchItems?: OrderItem[]) => void;
}

const getKeKoperasi = (item: OrderItem): number => {
  const rawQty = parseIndonesianNumber(item.qty) || 0;
  const returQty = Math.min(rawQty, Math.max(0, Number(item.retur) || 0));
  const finalQty = Math.max(0, rawQty - returQty);
  const hargaJual = parseIndonesianNumber(item.hargaJual) || 0;
  const cashback = parseIndonesianNumber(item.cashback) || 0;
  return cashback > 0 ? (hargaJual - cashback) * finalQty : 0;
};

const OrderRow: React.FC<OrderRowProps> = React.memo(({
  item,
  itemIdx,
  rowSpan,
  group,
  isActiveMenu,
  onToggleActiveMenu,
  onGroupPaymentChange,
  onGroupDeliveryChange,
  onOpenInvoiceModal,
  onExportInvoicePdf,
  onViewInvoice,
  onEditOrder,
}) => {
  const [printMenuRect, setPrintMenuRect] = useState<DOMRect | null>(null);
  const isFirst = itemIdx === 0;
  const isLastInGroup = itemIdx === rowSpan - 1;
  const hasCashback = group.items.some((it) => Number(it.cashback) > 0);

  const handleExportVariant = (variant: InvoicePriceVariant) => {
    if (onExportInvoicePdf) {
      onExportInvoicePdf(group.items, group.tujuanDapur, group.toko, group.tanggal, variant);
    } else {
      onOpenInvoiceModal(group.items, group.tujuanDapur, group.toko);
    }
  };

  const handlePrintClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (hasCashback) {
      const rect = e.currentTarget.getBoundingClientRect();
      setPrintMenuRect(rect);
    } else {
      handleExportVariant('ori');
    }
  };

  return (
    <tr
      key={item.id}
      className={`hover:bg-slate-50/90 dark:hover:bg-slate-800/60 transition-colors group ${
        isLastInGroup ? 'border-b-2 border-slate-200 dark:border-slate-700' : 'border-b border-slate-100 dark:border-slate-800'
      }`}
    >
      {/* 1. NO (MERGED PER GROUP) */}
      {isFirst && (
        <td
          rowSpan={rowSpan}
          className="py-2.5 px-2 text-center font-mono text-xs font-bold text-slate-400 dark:text-slate-500 align-middle border-r border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40"
        >
          {group.groupIndex}
        </td>
      )}

      {/* 2. DAPUR (MERGED PER GROUP) */}
      {isFirst && (
        <td
          rowSpan={rowSpan}
          className="py-2.5 px-1 text-center align-middle border-r border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40"
        >
          <span className="inline-block max-w-full break-words bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 font-extrabold px-1.5 py-0.5 rounded text-[10px] leading-tight border border-indigo-200 dark:border-indigo-800 shadow-2xs">
            {group.tujuanDapur}
          </span>
          {(group.items[0]?.invoiceNumber || (group.items[0] as any)?.invoice_number) && (
            <div className="mt-1 font-mono text-[9.5px] font-bold text-slate-500 dark:text-slate-400 select-all tracking-tight" title="Nomor Invoice">
              {group.items[0]?.invoiceNumber || (group.items[0] as any)?.invoice_number}
            </div>
          )}
        </td>
      )}

      {/* 3. ITEM (PER ROW ITEM) */}
      <td className="py-2.5 px-2 align-middle min-w-0">
        <div className="font-bold break-words text-slate-900 dark:text-slate-100 text-xs leading-snug">
          {item.namaBarang}
        </div>
      </td>

      {/* 3.5. PEMASOK (PER ROW ITEM - Mengikuti masing-masing barang) */}
      <td className="py-2.5 px-1 text-center align-middle border-r border-slate-100 dark:border-slate-800">
        <span className="inline-flex max-w-full items-center gap-0.5 font-extrabold text-[10px] px-1.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-2xs" title={item.pemasok || 'Pemasok belum ada'}>
          <Truck className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="min-w-0 truncate">{item.pemasok || '-'}</span>
        </span>
      </td>

      {/* 4. DATE (MERGED PER GROUP WITH DAY ON TOP) */}
      {isFirst && (
        <td
          rowSpan={rowSpan}
          className="py-2.5 px-1 text-center align-middle border-r border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40"
        >
          <div className="flex flex-col items-center justify-center gap-0.5 leading-none">
            <span className="max-w-full whitespace-normal break-words font-bold text-slate-800 dark:text-slate-200 text-[10px] leading-tight bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200/80 dark:border-slate-700" title={formatTanggalDisatuin(group.tanggal)}>
              {formatTanggalDisatuin(group.tanggal)}
            </span>
            {(group.createdAt || group.items[0]?.createdAt) && formatJam(group.createdAt || group.items[0]?.createdAt) ? (
              <span className="text-[9.5px] font-mono text-slate-500 dark:text-slate-400 font-medium tracking-tight">
                {formatJam(group.createdAt || group.items[0]?.createdAt)}
              </span>
            ) : null}
          </div>
        </td>
      )}

      {/* 5. QTY (PER ROW ITEM) */}
      <td className="py-2.5 px-2 text-center align-middle border-r border-slate-100 dark:border-slate-800">
        {Number(item.retur) > 0 ? (
          <div className="flex flex-col items-center justify-center gap-0.5">
            <div className="flex items-center gap-1 font-nominal text-xs sm:text-[12px] leading-tight">
              <span className="line-through text-slate-400 dark:text-slate-500 font-semibold">{item.qty}</span>
              <span className="text-slate-400 text-[10px]">→</span>
              <span className="font-extrabold text-slate-900 dark:text-slate-100">
                Final {Math.max(0, (parseIndonesianNumber(item.qty) || 0) - (Number(item.retur) || 0))}
              </span>
            </div>
            <span className="inline-block px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              RETUR {item.retur}
            </span>
          </div>
        ) : (
          <span className="font-black font-nominal text-xs sm:text-[13px] text-slate-900 dark:text-slate-100">
            {item.qty}
          </span>
        )}
      </td>

      {/* 6. TOKO (MERGED PER GROUP) */}
      {isFirst && (
        <td
          rowSpan={rowSpan}
          className="py-2.5 px-1 text-center align-middle border-r border-slate-100 dark:border-slate-800"
        >
          {(() => {
            const STORE_MAP: Record<string, string> = {
              '1': 'LB / Luweng Boga',
              '2': 'HTG',
              '3': 'LA / Lumbung Adifruta',
              '4': 'PW / Prohe',
            };
            const tokoName = STORE_MAP[group.toko] || group.toko;
            return (
              <span className={`inline-block max-w-full break-words px-1.5 py-0.5 rounded text-[10px] leading-tight font-bold border ${getTokoBadgeStyle(tokoName)}`}>
                {tokoName}
              </span>
            );
          })()}
        </td>
      )}

      {/* 7. PAYMENT (MERGED PER GROUP WITH 1-CLICK TOGGLE) */}
      {isFirst && (
        <td
          rowSpan={rowSpan}
          className="py-2.5 px-2 text-center whitespace-nowrap align-middle border-r border-slate-100 dark:border-slate-800"
        >
          <button
            type="button"
            onClick={() => {
              const nextStatus: PaymentStatus = group.payStatus === 'PAID' ? 'UNPAID' : 'PAID';
              onGroupPaymentChange(group.items, nextStatus);
            }}
            className={`text-[9.5px] sm:text-[10px] font-black px-2 py-1 rounded-md border cursor-pointer transition-all active:scale-95 ${
              group.payStatus === 'PAID'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 shadow-2xs'
                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/60 shadow-2xs'
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
          className="py-2.5 px-2 text-center whitespace-nowrap align-middle border-r border-slate-100 dark:border-slate-800"
        >
          <button
            type="button"
            onClick={() => {
              const nextStatus: DeliveryStatus = group.delStatus === 'DONE' ? 'PENDING' : 'DONE';
              onGroupDeliveryChange(group.items, nextStatus);
            }}
            className={`text-[9.5px] sm:text-[10px] font-black px-2 py-1 rounded-md border cursor-pointer transition-all active:scale-95 ${
              group.delStatus === 'DONE'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 shadow-2xs'
                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/60 shadow-2xs'
            }`}
            title="Klik untuk ubah Delivery (DONE / PENDING)"
          >
            {group.delStatus === 'DONE' ? 'DONE' : 'PENDING'}
          </button>
        </td>
      )}

      {/* 9. H. JUAL (PER ROW ITEM) */}
      {(() => {
        const rawQty = parseIndonesianNumber(item.qty) || 0;
        const returQty = Math.min(rawQty, Math.max(0, Number(item.retur) || 0));
        const finalQty = Math.max(0, rawQty - returQty);
        const hjNum = parseIndonesianNumber(item.hargaJual) || 0;
        const totalJual = finalQty * hjNum;

        return (
          <td className="py-2.5 px-1.5 text-right whitespace-nowrap align-middle">
            <div className="font-bold text-slate-900 dark:text-slate-100 font-nominal text-xs sm:text-[12.5px]">
              {formatRupiah(totalJual)}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-nominal">
              @{formatRupiah(hjNum)}
            </div>
          </td>
        );
      })()}

      {/* 10. H. BELI (PER ROW ITEM) */}
      {(() => {
        const rawQtyJual = parseIndonesianNumber(item.qty) || 0;
        const rawQtyBeli = item.qtyBeli !== undefined && item.qtyBeli !== null
          ? parseIndonesianNumber(item.qtyBeli)
          : (item.qty_beli !== undefined && item.qty_beli !== null ? parseIndonesianNumber(item.qty_beli) : rawQtyJual);
        const returQty = Math.max(0, Number(item.retur) || 0);
        const qtyBeliEfektif = Math.max(0, rawQtyBeli - returQty);
        const hbNum = parseIndonesianNumber(item.hargaBeli) || 0;
        const totalBeli = qtyBeliEfektif * hbNum;

        return (
          <td className="py-2.5 px-1.5 text-right whitespace-nowrap align-middle border-r border-slate-100 dark:border-slate-800">
            <div className="font-semibold text-slate-600 dark:text-slate-300 font-nominal text-xs sm:text-[12.5px]">
              {formatRupiah(totalBeli)}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-nominal">
              @{formatRupiah(hbNum)}
            </div>
          </td>
        );
      })()}

      {/* 11. CASHBACK (PER ROW ITEM) */}
      {(() => {
        const totalCashback = getKeKoperasi(item);
        return (
          <td className="py-2.5 px-1.5 text-right whitespace-nowrap align-middle border-r border-slate-100 dark:border-slate-800">
            {totalCashback > 0 ? (
              <span className="inline-block text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200/90 dark:border-amber-800 font-bold font-nominal text-xs">
                +{formatRupiah(totalCashback)}
              </span>
            ) : (
              <span className="text-slate-300 dark:text-slate-600 font-medium block text-center">-</span>
            )}
          </td>
        );
      })()}

      {/* 12. CATATAN (PER ROW ITEM) */}
      <td className="py-2.5 px-2 text-left align-middle border-r border-slate-100 dark:border-slate-800 min-w-0">
        {item.catatan?.trim() ? (
          <span
            className="inline-flex max-w-full items-center gap-1 text-[11px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-medium align-middle"
            title={item.catatan.trim()}
          >
            <FileText className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{item.catatan.trim()}</span>
          </span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600 font-medium text-center block">-</span>
        )}
      </td>

      {/* 13. AKSI (MERGED PER GROUP) */}
      {isFirst && (
        <td
          rowSpan={rowSpan}
          className="py-2.5 px-1 text-center relative align-middle border-l border-slate-100 dark:border-slate-800"
        >
          <div className="flex items-center justify-center gap-0.5">
            {/* Tombol Lihat/Preview Invoice A4 View-Only (Screenshot Bukti) */}
            <button
              type="button"
              onClick={() => {
                if (onViewInvoice) {
                  onViewInvoice(group.items, group.tujuanDapur, group.toko, group.tanggal);
                } else {
                  onOpenInvoiceModal(group.items, group.tujuanDapur, group.toko);
                }
              }}
              className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-extrabold shadow-2xs transition-all active:scale-95 border border-sky-200 dark:border-sky-800 cursor-pointer"
              title={`Lihat Bukti Invoice Dapur ${group.tujuanDapur}`}
            >
              <Eye className="w-4 h-4 stroke-[2.2]" />
            </button>

            {/* Tombol Cetak / Export PDF: Ada cashback -> popup varian, tidak ada -> langsung cetak Ori */}
            <button
              type="button"
              onClick={handlePrintClick}
              className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-900 font-extrabold shadow-2xs transition-all active:scale-95 border border-amber-500/80 cursor-pointer"
              title={hasCashback ? `Pilih Varian Invoice Dapur ${group.tujuanDapur} (Ada Cashback)` : `Cetak Invoice PDF Dapur ${group.tujuanDapur}`}
            >
              <Printer className="w-4 h-4 stroke-[2.2]" />
            </button>

            {/* Tombol Edit Langsung Seluruh Pesanan */}
            {onEditOrder && (
              <button
                type="button"
                id={`btn-edit-pesanan-row-${group.id}`}
                onClick={() => onEditOrder(group.items[0], group.items)}
                className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-extrabold shadow-2xs transition-all active:scale-95 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                title={`Edit Seluruh Pesanan Dapur ${group.tujuanDapur} (${group.items.length} Item)`}
              >
                <Edit2 className="w-4 h-4 stroke-[2.2]" />
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                onToggleActiveMenu(group.id, rect, group);
              }}
              className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                isActiveMenu
                  ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-500/20 shadow-2xs'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent active:scale-95'
              }`}
              title="Menu Aksi"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* Portal Popup Pilihan Varian */}
          <PrintVariantDropdownPortal
            isOpen={!!printMenuRect}
            targetRect={printMenuRect}
            onClose={() => setPrintMenuRect(null)}
            onSelectVariant={handleExportVariant}
            hasCashbackItem={hasCashback}
          />
        </td>
      )}
    </tr>
  );
});

interface OrdersTableViewProps {
  orders: OrderItem[];
  totalUnfilteredOrders?: number;
  currentFilterLabel?: string;
  onResetFilter?: () => void;
  isLoading?: boolean;
  onUpdatePaymentStatus: (id: string, status: PaymentStatus) => void;
  onUpdateDeliveryStatus: (id: string, status: DeliveryStatus) => void;
  onUpdateGroupPaymentStatus?: (groupItems: OrderItem[], status: PaymentStatus) => void;
  onUpdateGroupDeliveryStatus?: (groupItems: OrderItem[], status: DeliveryStatus) => void;
  onEditOrder: (order: OrderItem, batchItems?: OrderItem[]) => void;
  onDuplicateOrder: (order: OrderItem) => void;
  onDeleteOrder: (id: string) => void;
  onDeleteBatchOrders?: (items: OrderItem[]) => void;
  onOpenInvoiceModal: (items: OrderItem[], kitchenName: string, storeName: string) => void;
  onExportInvoicePdf?: (items: OrderItem[], kitchenName: string, storeName: string, dateStr?: string, variant?: InvoicePriceVariant) => void;
  onViewInvoice?: (items: OrderItem[], kitchenName: string, storeName: string, dateStr?: string) => void;
}

export const OrdersTableView: React.FC<OrdersTableViewProps> = React.memo(({
  orders,
  totalUnfilteredOrders = 0,
  currentFilterLabel,
  onResetFilter,
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
  onViewInvoice,
}) => {
  // Pagination State (Default 10 groups per page for better screen fitting)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Dropdown open state tracking (Rendered via ActionMenuPortal)
  const [activeMenu, setActiveMenu] = useState<{
    id: string;
    rect: DOMRect;
    group: OrderGroup;
  } | null>(null);

  // Helper getters for status fields
  const getPayStatus = (item: OrderItem): PaymentStatus => {
    if (item.paymentStatus) return item.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID';
    if (item.status_pembayaran) return item.status_pembayaran.toUpperCase() === 'PAID' ? 'PAID' : 'UNPAID';
    return item.status === 'selesai' ? 'PAID' : 'UNPAID';
  };

  const getDelStatus = (item: OrderItem): DeliveryStatus => {
    if (item.deliveryStatus) return item.deliveryStatus === 'DONE' ? 'DONE' : 'PENDING';
    if (item.status_pengiriman) return item.status_pengiriman.toUpperCase() === 'DONE' ? 'DONE' : 'PENDING';
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
      const key = item.notaId || item.nota_id || `${item.tanggal}||${item.tujuanDapur}||${item.toko}`;
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

  const handleToggleActiveMenu = useCallback((id: string, rect: DOMRect, group: OrderGroup) => {
    setActiveMenu((prev) => (prev?.id === id ? null : { id, rect, group }));
  }, []);

  const handleGroupPaymentChange = useCallback((groupItems: OrderItem[], newStatus: PaymentStatus) => {
    if (onUpdateGroupPaymentStatus) {
      onUpdateGroupPaymentStatus(groupItems, newStatus);
    } else {
      groupItems.forEach((it) => onUpdatePaymentStatus(it.id, newStatus));
    }
  }, [onUpdateGroupPaymentStatus, onUpdatePaymentStatus]);

  const handleGroupDeliveryChange = useCallback((groupItems: OrderItem[], newStatus: DeliveryStatus) => {
    if (onUpdateGroupDeliveryStatus) {
      onUpdateGroupDeliveryStatus(groupItems, newStatus);
    } else {
      groupItems.forEach((it) => onUpdateDeliveryStatus(it.id, newStatus));
    }
  }, [onUpdateGroupDeliveryStatus, onUpdateDeliveryStatus]);

  const hasAnyOrders = orders.length > 0;

  if (isLoading && !hasAnyOrders) {
    return <TableSkeleton rows={7} />;
  }

  if (!hasAnyOrders) {
    if (totalUnfilteredOrders > 0) {
      return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 text-center my-4 space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto border border-indigo-100 dark:border-indigo-800/60">
            <Package className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Tidak Ada Pesanan untuk Filter {currentFilterLabel ? `"${currentFilterLabel}"` : 'Ini'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Data Anda tersimpan aman di Supabase! Ada <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{totalUnfilteredOrders} pesanan</strong> pada tanggal/periode lain.
            </p>
          </div>
          {onResetFilter && (
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={onResetFilter}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>Tampilkan Semua Pesanan (All Time)</span>
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center my-4 space-y-2 shadow-xs">
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500">
          <Package className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Belum Ada Transaksi Pesanan</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Tambah pesanan baru untuk mulai mengelola data supplier, toko, dan dapur.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans text-slate-800 dark:text-slate-200">
      {/* 
        ========================================================================
        TABEL TRANSAKSI PESANAN
        Struktur kolom: NO, DAPUR, ITEM, PEMASOK, DATE, QTY, TOKO, PAYMENT, DELIVERY, H. JUAL, H. BELI, CASHBACK, CATATAN, AKSI
        ========================================================================
      */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden font-sans">
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[1300px] xl:min-w-0 table-fixed text-left border-collapse text-xs relative">
            <colgroup>
              {[3, 7, 11, 8, 8, 4.5, 7.5, 7, 7, 8.5, 8.5, 7.5, 13.5, 7].map((width, index) => (
                <col key={index} style={{ width: `${width}%` }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-2xs">
              <tr className="text-[10px] sm:text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {/* 1. NO */}
                <th className="py-3 px-2 text-center w-10 bg-slate-100 dark:bg-slate-800 sticky top-0">
                  NO
                </th>
                {/* 2. DAPUR */}
                <th className="py-3 px-2 text-center whitespace-nowrap bg-slate-100 dark:bg-slate-800 sticky top-0">
                  DAPUR
                </th>
                {/* 3. ITEM */}
                <th className="py-3 px-2 bg-slate-100 dark:bg-slate-800 sticky top-0">
                  ITEM
                </th>
                {/* 3.5. PEMASOK */}
                <th className="py-3 px-1 text-center bg-slate-100 dark:bg-slate-800 sticky top-0">
                  PEMASOK
                </th>
                {/* 4. DATE */}
                <th className="py-3 px-2 text-center whitespace-nowrap bg-slate-100 dark:bg-slate-800 sticky top-0">
                  DATE
                </th>
                {/* 5. QTY */}
                <th className="py-3 px-2 text-center w-12 bg-slate-100 dark:bg-slate-800 sticky top-0">
                  QTY
                </th>
                {/* 6. TOKO */}
                <th className="py-3 px-2 text-center whitespace-nowrap bg-slate-100 dark:bg-slate-800 sticky top-0">
                  TOKO
                </th>
                {/* 7. PAYMENT */}
                <th className="py-3 px-2 text-center whitespace-nowrap bg-slate-100 dark:bg-slate-800 sticky top-0">
                  PAYMENT
                </th>
                {/* 8. DILEVERY */}
                <th className="py-3 px-2 text-center whitespace-nowrap bg-slate-100 dark:bg-slate-800 sticky top-0">
                  DILEVERY
                </th>
                {/* 9. H. JUAL */}
                <th className="py-3 px-1.5 text-right whitespace-nowrap bg-slate-100 dark:bg-slate-800 sticky top-0">
                  H. JUAL
                </th>
                {/* 10. H. BELI */}
                <th className="py-3 px-1.5 text-right whitespace-nowrap bg-slate-100 dark:bg-slate-800 sticky top-0">
                  H. BELI
                </th>
                {/* 11. CASHBACK */}
                <th className="py-3 px-1.5 text-right whitespace-nowrap bg-slate-100 dark:bg-slate-800 sticky top-0 text-amber-700 dark:text-amber-400">
                  CASHBACK
                </th>
                {/* 12. CATATAN */}
                <th className="py-3 px-2 text-left whitespace-nowrap bg-slate-100 dark:bg-slate-800 sticky top-0 text-slate-700 dark:text-slate-300">
                  CATATAN
                </th>
                {/* 13. AKSI */}
                <th className="py-3 px-1 text-center whitespace-nowrap bg-slate-100 dark:bg-slate-800 sticky top-0">
                  AKSI
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
              {paginatedGroups.map((group) => {
                const rowSpan = group.items.length;
                return group.items.map((item, itemIdx) => (
                  <OrderRow
                    key={item.id}
                    item={item}
                    itemIdx={itemIdx}
                    rowSpan={rowSpan}
                    group={group}
                    isActiveMenu={activeMenu?.id === group.id}
                    onToggleActiveMenu={handleToggleActiveMenu}
                    onGroupPaymentChange={handleGroupPaymentChange}
                    onGroupDeliveryChange={handleGroupDeliveryChange}
                    onOpenInvoiceModal={onOpenInvoiceModal}
                    onExportInvoicePdf={onExportInvoicePdf}
                    onViewInvoice={onViewInvoice}
                    onEditOrder={onEditOrder}
                  />
                ));
              })}
            </tbody>
          </table>
        </div>

        {/* PAGINATION - Selalu muncul & dilengkapi info baris serta pilihan page size */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={orderGroups.length}
          pageSize={pageSize}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Spacer bawah agar tidak overlap dengan floating bottom nav bar */}
      <div className="h-20 sm:h-12 pointer-events-none" aria-hidden="true" />

    {/* Floating Portal Action Menu (Minimalist & Professional, renders outside table) */}
    <ActionMenuPortal
      isOpen={!!activeMenu}
      targetRect={activeMenu?.rect || null}
      onClose={() => setActiveMenu(null)}
      title="Detail Pesanan"
      batchNumber={activeMenu?.group.groupIndex}
      items={activeMenu?.group.items || []}
      onEdit={(item, batchItems) => onEditOrder(item, batchItems || activeMenu?.group.items)}
      onEditBatch={(items) => onEditOrder(items[0], items)}
      onDuplicate={() => {
        if (activeMenu?.group) {
          onDuplicateOrder(activeMenu.group.items);
        }
      }}
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
});
