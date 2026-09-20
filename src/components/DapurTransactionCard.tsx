import React, { useMemo, useState } from 'react';
import { 
  Trash2, 
  Plus, 
  Check, 
  AlertCircle, 
  Edit2, 
  X, 
  Truck,
  Printer,
  Eye
} from 'lucide-react';
import { OrderItem, InvoicePriceVariant } from '../types';
import { formatRupiah, formatTanggalDisatuin, parseIndonesianNumber } from '../lib/formatters';
import { motion } from 'motion/react';
import { PrintVariantDropdownPortal } from './PrintVariantDropdownPortal';

interface DapurTransactionCardProps {
  storeName: string;
  date: string;
  items: OrderItem[];
  onToggleStatus: (id: string) => void;
  onToggleBatchStatus: (storeName: string, date: string, targetStatus: 'pending' | 'selesai') => void;
  onEditOrder: (item: OrderItem) => void;
  onDeleteOrder: (id: string) => void;
  onDeleteKitchenOrders: (storeName: string, date: string) => void;
  onOpenInvoiceModal: (items: OrderItem[], kitchenName?: string, storeName?: string) => void;
  onExportInvoicePdf?: (items: OrderItem[], kitchenName: string, storeName: string, dateStr?: string, variant?: InvoicePriceVariant) => void;
  onViewInvoice?: (items: OrderItem[], kitchenName: string, storeName: string, dateStr?: string) => void;
  onAddItemToKitchen: (storeName: string) => void;
}

export const DapurTransactionCard: React.FC<DapurTransactionCardProps> = React.memo(({
  storeName,
  date,
  items,
  onToggleBatchStatus,
  onEditOrder,
  onDeleteOrder,
  onDeleteKitchenOrders,
  onOpenInvoiceModal,
  onExportInvoicePdf,
  onViewInvoice,
  onAddItemToKitchen,
}) => {
  const [activePrintGroup, setActivePrintGroup] = useState<{
    rect: DOMRect;
    kitchenItems: OrderItem[];
    kitchenName: string;
    hasCashback: boolean;
  } | null>(null);
  // Calculate Totals for this Store (Memoized in single pass)
  const { totalJual, totalBeli, totalProfit, isAllDone } = useMemo(() => {
    let jual = 0;
    let beli = 0;
    let allDone = items.length > 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rawQJual = parseIndonesianNumber(item.qty);
      const rawQBeli = (item as any).qtyBeli !== undefined && (item as any).qtyBeli !== null
        ? parseIndonesianNumber((item as any).qtyBeli)
        : ((item as any).qty_beli !== undefined && (item as any).qty_beli !== null
          ? parseIndonesianNumber((item as any).qty_beli)
          : rawQJual);
      const returQty = Math.max(0, Number(item.retur) || 0);
      const qFinal = Math.max(0, rawQJual - returQty);
      const qBeliEfektif = Math.max(0, rawQBeli - returQty);
      const hj = parseIndonesianNumber(item.hargaJual);
      const hb = parseIndonesianNumber(item.hargaBeli);
      jual += qFinal * hj;
      beli += qBeliEfektif * hb;
      if (item.status !== 'selesai') {
        allDone = false;
      }
    }
    return {
      totalJual: jual,
      totalBeli: beli,
      totalProfit: jual - beli,
      isAllDone: allDone,
    };
  }, [items]);

  const handleToggleCardStatus = () => {
    const nextStatus = isAllDone ? 'pending' : 'selesai';
    onToggleBatchStatus(storeName, date, nextStatus);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="clay-card p-3 sm:p-4 space-y-3 font-sans text-slate-800 dark:text-slate-200 bg-white/95 dark:bg-slate-900/95 border border-white/80 dark:border-slate-800 transition-colors duration-200"
    >
      {/* 1. TOP HEADER - LAMPIRAN 1: Date + Store Name Badge + Status + Switch + Delete (NO Printer/Docx in top header) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-indigo-100/60 dark:border-slate-800">
        <div className="flex items-center flex-wrap gap-1.5">
          {/* Merged Day & Date Pill (Green) */}
          <span className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-[11px] sm:text-xs px-2.5 py-1 rounded-xl uppercase tracking-wider shadow-xs">
            {formatTanggalDisatuin(date)}
          </span>

          {/* Toko Title Pill (Monochrome) */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-2.5 py-1 rounded-xl font-black text-xs sm:text-sm shadow-2xs uppercase">
            <span>TOKO : {storeName}</span>
          </div>

          {/* Status Badge Pill */}
          <button
            onClick={handleToggleCardStatus}
            className={`flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-extrabold rounded-xl transition-all active:scale-95 cursor-pointer ${
              isAllDone ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700' : 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
            }`}
          >
            {isAllDone ? (
              <>
                <Check className="w-3 h-3 stroke-[3]" />
                <span>SELESAI</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 stroke-[2.5]" />
                <span>PENDING</span>
              </>
            )}
          </button>
        </div>

        {/* Right Side Control Buttons: Switch Toggle + Hapus Card (Removed Printer & DOCX icons per Lampiran 1) */}
        <div className="flex items-center space-x-1.5">
          {/* Direct Switch Toggle */}
          <button
            type="button"
            onClick={handleToggleCardStatus}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none ${
              isAllDone ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-300 dark:bg-slate-700 border-slate-200 dark:border-slate-600'
            }`}
            title={isAllDone ? 'Ubah ke Pending' : 'Tandai Selesai'}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out my-0.5 ${
                isAllDone ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>

          {/* Delete Store Orders Button */}
          <button
            onClick={() => onDeleteKitchenOrders(storeName, date)}
            className="p-1.5 clay-btn text-rose-500 hover:text-rose-700 transition-all active:scale-95 rounded-xl cursor-pointer"
            title="Hapus Semua Pesanan Toko Ini"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. TABLE - LAMPIRAN 1: BARANG | DAPUR (Yellow) | QTY | H.JUAL | H.BELI | AKSI */}
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-indigo-100 dark:border-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              <th className="py-2 px-1 w-[28%]">BARANG</th>
              <th className="py-2 px-1 text-center w-[20%] bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-t">DAPUR</th>
              <th className="py-2 px-1 text-center w-[10%]">QTY</th>
              <th className="py-2 px-1 text-right w-[20%]">H.JUAL</th>
              <th className="py-2 px-1 text-right w-[14%]">H.BELI</th>
              <th className="py-2 px-1 text-center w-[8%]">AKSI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
            {items.map((item) => {
              const rawQJual = parseIndonesianNumber(item.qty);
              const rawQBeli = (item as any).qtyBeli !== undefined && (item as any).qtyBeli !== null
                ? parseIndonesianNumber((item as any).qtyBeli)
                : ((item as any).qty_beli !== undefined && (item as any).qty_beli !== null
                  ? parseIndonesianNumber((item as any).qty_beli)
                  : rawQJual);
              const returQty = Math.max(0, Number(item.retur) || 0);
              const qFinal = Math.max(0, rawQJual - returQty);
              const qBeliEfektif = Math.max(0, rawQBeli - returQty);
              const hj = parseIndonesianNumber(item.hargaJual);
              const hb = parseIndonesianNumber(item.hargaBeli);
              const itemTotalJual = qFinal * hj;
              const itemTotalBeli = qBeliEfektif * hb;

              return (
                <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  {/* BARANG Column */}
                  <td className="py-2 px-1">
                    <div className="font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-snug uppercase">
                      {item.namaBarang}
                    </div>
                    {/* Supplier Tag only (Toko tag removed per Lampiran 1) */}
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="flex items-center gap-0.5 text-slate-700 dark:text-slate-300 font-semibold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                        <Truck className="w-2.5 h-2.5" />
                        {item.pemasok}
                      </span>
                    </div>

                    {/* Catatan pill */}
                    {item.catatan && (
                      <div className="mt-1 text-[10px] font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700 truncate max-w-[140px]">
                        {item.catatan}
                      </div>
                    )}
                  </td>

                  {/* DAPUR Column */}
                  <td className="py-2 px-1 text-center">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-extrabold px-2.5 py-1 rounded-xl text-[11px] uppercase tracking-wider shadow-2xs border border-slate-300 dark:border-slate-700 inline-block">
                      {item.tujuanDapur}
                    </span>
                  </td>

                  {/* QTY Column */}
                  <td className="py-2 px-1 text-center font-bold text-slate-900 dark:text-slate-100">
                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-slate-100">
                      {returQty > 0 ? (
                        <span title={`Qty Awal: ${rawQJual}, Retur: ${returQty}, Ditagihkan: ${qFinal}`}>
                          <span className="line-through text-slate-400 text-[10px] mr-1">{rawQJual}</span>
                          <span>{qFinal}</span>
                        </span>
                      ) : (
                        item.qty
                      )}
                    </span>
                  </td>

                  {/* H.JUAL Column */}
                  <td className="py-2 px-1 text-right">
                    <div className="font-black text-slate-900 dark:text-slate-100">
                      {formatRupiah(itemTotalJual)}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">
                      @ {formatRupiah(item.hargaJual).replace('Rp ', '')}
                    </div>
                  </td>

                  {/* H.BELI Column */}
                  <td className="py-2 px-1 text-right">
                    <div className="font-medium text-slate-600 dark:text-slate-400">
                      {formatRupiah(itemTotalBeli)}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">
                      @ {formatRupiah(item.hargaBeli).replace('Rp ', '')}
                    </div>
                  </td>

                  {/* AKSI Column - Edit, Delete, & IKON CETAK (Yellow Button) */}
                  <td className="py-2 px-1 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onEditOrder(item)}
                        className="p-1 rounded text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                        title="Edit Item"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteOrder(item.id)}
                        className="p-1 rounded text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Hapus Item"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      {/* IKON LIHAT (Preview Invoice A4 View-Only / Screenshot Bukti) */}
                      <button
                        type="button"
                        onClick={() => {
                          const kitchenItems = items.filter((it) => it.tujuanDapur === item.tujuanDapur);
                          if (onViewInvoice) {
                            onViewInvoice(kitchenItems, item.tujuanDapur, storeName, item.tanggal);
                          } else {
                            onOpenInvoiceModal(kitchenItems, item.tujuanDapur, storeName);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-extrabold shadow-2xs transition-all active:scale-95 border border-sky-200 dark:border-sky-800 cursor-pointer"
                        title="Lihat Bukti Invoice Dapur Ini"
                      >
                        <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>

                      {/* IKON CETAK (Export PDF Invoice) */}
                      <button
                        onClick={(e) => {
                          const kitchenItems = items.filter((it) => it.tujuanDapur === item.tujuanDapur);
                          const hasCashback = kitchenItems.some((it) => Number(it.cashback) > 0);
                          if (hasCashback) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setActivePrintGroup({
                              rect,
                              kitchenItems,
                              kitchenName: item.tujuanDapur,
                              hasCashback,
                            });
                          } else {
                            if (onExportInvoicePdf) {
                              onExportInvoicePdf(kitchenItems, item.tujuanDapur, storeName, item.tanggal, 'ori');
                            } else {
                              onOpenInvoiceModal(kitchenItems, item.tujuanDapur, storeName);
                            }
                          }
                        }}
                        className="p-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-900 font-extrabold shadow-2xs transition-all active:scale-95 border border-amber-500/80 cursor-pointer"
                        title="IKON CETAK: Export PDF Invoice Pesanan Dapur Ini"
                      >
                        <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Portal Popup Pilihan Varian */}
      <PrintVariantDropdownPortal
        isOpen={!!activePrintGroup}
        targetRect={activePrintGroup?.rect || null}
        onClose={() => setActivePrintGroup(null)}
        onSelectVariant={(variant) => {
          if (!activePrintGroup) return;
          if (onExportInvoicePdf) {
            onExportInvoicePdf(
              activePrintGroup.kitchenItems,
              activePrintGroup.kitchenName,
              storeName,
              date,
              variant
            );
          } else {
            onOpenInvoiceModal(activePrintGroup.kitchenItems, activePrintGroup.kitchenName, storeName);
          }
        }}
        hasCashbackItem={activePrintGroup?.hasCashback}
      />

      {/* 3. ADD ITEM BUTTON - Dynamic to Store Name */}
      <button
        onClick={() => onAddItemToKitchen(storeName)}
        className="w-full clay-btn py-2 text-indigo-700 dark:text-indigo-400 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1 active:scale-[0.99] border border-indigo-200 dark:border-indigo-900/60 cursor-pointer"
      >
        <Plus className="w-4 h-4 stroke-[3]" />
        <span>+ Tambah Barang ke {storeName}</span>
      </button>

      {/* 4. CARD FOOTER WITH TOTAL JUAL & PROFIT NET */}
      <div className="flex items-center justify-between pt-2 border-t border-indigo-100/60 dark:border-slate-800 text-xs font-semibold">
        <div>
          <span className="block text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-black">
            TOTAL JUAL
          </span>
          <span className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {formatRupiah(totalJual)}
          </span>
        </div>

        <div className="text-right">
          <span className="block text-[9px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-black">
            PROFIT NET
          </span>
          <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
            {formatRupiah(totalProfit)}
          </span>
        </div>
      </div>
    </motion.div>
  );
});

