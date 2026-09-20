import React, { useState } from 'react';
import { Eye, Printer, Trash2, MoreVertical } from 'lucide-react';
import { OrderItem, InvoicePriceVariant } from '../../types';
import { formatRupiah, formatTanggalDisatuin, getTokoBadgeStyle } from '../../lib/formatters';
import { TransactionBatch } from './types';
import { PrintVariantDropdownPortal } from '../PrintVariantDropdownPortal';

interface TransactionsMobileCardProps {
  batch: TransactionBatch;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isMenuOpen: boolean;
  onToggleBatchPayment: (batch: TransactionBatch) => void;
  onToggleBatchDelivery: (batch: TransactionBatch) => void;
  onViewInvoice?: (items: OrderItem[], kitchenName?: string, storeName?: string, dateStr?: string) => void;
  onOpenInvoiceModal?: (items: OrderItem[], kitchenName?: string, storeName?: string) => void;
  onExportInvoicePdf?: (items: OrderItem[], kitchenName: string, storeName: string, dateStr?: string, variant?: InvoicePriceVariant) => void;
  onDeleteTransaction?: (batch: TransactionBatch) => void;
  onDeleteInvoice?: (id: string) => void;
  onDeleteOrder: (id: string) => void;
  onOpenActionMenu: (rect: DOMRect, batch: TransactionBatch) => void;
}

export const TransactionsMobileCard: React.FC<TransactionsMobileCardProps> = ({
  batch,
  isExpanded,
  onToggleExpand,
  isMenuOpen,
  onToggleBatchPayment,
  onToggleBatchDelivery,
  onViewInvoice,
  onOpenInvoiceModal,
  onExportInvoicePdf,
  onDeleteTransaction,
  onDeleteInvoice,
  onDeleteOrder,
  onOpenActionMenu,
}) => {
  const [printMenuRect, setPrintMenuRect] = useState<DOMRect | null>(null);
  const isPaid = batch.payStatus === 'PAID';
  const isDelivered = batch.delStatus === 'DONE';
  const visibleItems = isExpanded ? batch.items : batch.items.slice(0, 2);
  const hiddenCount = batch.items.length - 2;
  const hasCashback = batch.items.some((it) => Number(it.cashback) > 0);

  const handleView = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onViewInvoice) {
      onViewInvoice(batch.items, batch.tujuanDapur, batch.toko, batch.tanggal);
    } else if (onOpenInvoiceModal) {
      onOpenInvoiceModal(batch.items, batch.tujuanDapur, batch.toko);
    }
  };

  const handleExportVariant = (variant: InvoicePriceVariant) => {
    if (onExportInvoicePdf) {
      onExportInvoicePdf(batch.items, batch.tujuanDapur, batch.toko, batch.tanggal, variant);
    } else if (onOpenInvoiceModal) {
      onOpenInvoiceModal(batch.items, batch.tujuanDapur, batch.toko);
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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteTransaction) {
      onDeleteTransaction(batch);
    } else if (onDeleteInvoice) {
      onDeleteInvoice(batch.id);
    } else {
      onDeleteOrder(batch.id);
    }
  };

  return (
    <div className={`rounded-2xl border shadow-xs p-3.5 space-y-2.5 relative transition-colors ${
      batch.isCancelled
        ? 'opacity-65 bg-slate-100/70 dark:bg-slate-900/70 border-slate-300 dark:border-slate-800'
        : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800'
    }`}>
      {/* Baris Atas: Tanggal, Dapur, Pemasok, Toko, Action Buttons */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold text-slate-800 dark:text-slate-200 text-[9px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/80 dark:border-slate-700">
            {formatTanggalDisatuin(batch.tanggal)}
          </span>
          <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 font-black px-1.5 py-0.5 rounded text-[9.5px] border border-indigo-200 dark:border-indigo-800">
            Dapur {batch.tujuanDapur}
          </span>
          {batch.isCancelled && (
            <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black px-1.5 py-0.5 rounded text-[8.5px] border border-slate-300 dark:border-slate-600 uppercase">
              DIBATALKAN
            </span>
          )}
          {batch.pemasok && (
            <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded text-[9px] border border-emerald-200 dark:border-emerald-800">
              {batch.pemasok}
            </span>
          )}
          <span className={`px-1.5 py-0.5 rounded text-[9px] border font-bold ${getTokoBadgeStyle(batch.toko)}`}>
            {batch.toko}
          </span>
        </div>

        {/* Quick Action Buttons: Eye View, Print, Delete & 3-Dots */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleView}
            className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 active:scale-95 transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            title={`Lihat Bukti Invoice Dapur ${batch.tujuanDapur}`}
          >
            <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
          {/* Tombol Cetak / Export PDF: Ada cashback -> popup varian, tidak ada -> langsung cetak Ori */}
          <button
            type="button"
            onClick={handlePrintClick}
            className="p-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-900 border border-amber-500/80 active:scale-95 transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center font-extrabold shadow-2xs"
            title={hasCashback ? `Pilih Varian Invoice Dapur ${batch.tujuanDapur} (Ada Cashback)` : `Cetak Invoice PDF Dapur ${batch.tujuanDapur}`}
          >
            <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            title="Hapus Transaksi"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              onOpenActionMenu(rect, batch);
            }}
            className={`p-1.5 rounded-lg transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center ${
              isMenuOpen
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-500/20 shadow-2xs'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 active:scale-95'
            }`}
            title="Menu Aksi"
          >
            <MoreVertical className="w-3.5 h-3.5" />
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
      </div>

      {/* Status Badges & Total */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          {batch.isCancelled ? (
            <span className="px-2.5 py-1 rounded-full text-[9px] font-black bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600">
              TRANSAKSI DIBATALKAN
            </span>
          ) : (
            <>
              {/* Payment Status 1-Click Toggle */}
              <button
                type="button"
                onClick={() => onToggleBatchPayment(batch)}
                className={`px-2.5 py-1 rounded-full text-[9px] font-black border transition-all active:scale-95 cursor-pointer min-h-[32px] flex items-center ${
                  isPaid
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                }`}
                title="Klik untuk ubah Payment (PAID / UNPAID)"
              >
                {isPaid ? 'PAID' : 'UNPAID'}
              </button>

              {/* Delivery Status 1-Click Toggle */}
              <button
                type="button"
                onClick={() => onToggleBatchDelivery(batch)}
                className={`px-2.5 py-1 rounded-full text-[9px] font-black border transition-all active:scale-95 cursor-pointer min-h-[32px] flex items-center ${
                  isDelivered
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                }`}
                title="Klik untuk ubah Delivery (DONE / PENDING)"
              >
                {isDelivered ? 'DONE' : 'PENDING'}
              </button>
            </>
          )}
        </div>

        {/* Total Rupiah */}
        <div className="text-right">
          <span className="text-[9px] text-slate-500 dark:text-slate-400 block font-medium">Total Beli</span>
          <span className="font-black font-nominal text-xs text-slate-900 dark:text-slate-100 block">
            {formatRupiah(batch.totalBeli)}
          </span>
          {batch.totalKeKoperasi && batch.totalKeKoperasi > 0 ? (
            <span className="text-[8.5px] text-amber-700 dark:text-amber-400 font-bold block">
              CB: +{formatRupiah(batch.totalKeKoperasi)}
            </span>
          ) : null}
        </div>
      </div>

      {/* Catatan Transaksi Mobile */}
      {batch.catatan && (
        <div className="bg-slate-100/90 dark:bg-slate-800/80 rounded-lg px-2.5 py-1.5 border border-slate-200/80 dark:border-slate-700 text-[9.5px] text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
          <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0 uppercase text-[8.5px]">Catatan:</span>
          <span className="line-clamp-2 font-medium">{batch.catatan}</span>
        </div>
      )}

      {/* List Item di dalam Card */}
      <div className="bg-slate-50/90 dark:bg-slate-800/50 rounded-xl p-2.5 border border-slate-100 dark:border-slate-800 space-y-1">
        {visibleItems.map((it) => {
          const rawQ = Number(it.qty) || 0;
          const retQ = Math.min(rawQ, Math.max(0, Number(it.retur) || 0));
          const finQ = Math.max(0, rawQ - retQ);
          return (
            <div key={`card-item-${it.id}`} className="flex items-center justify-between text-[10px] gap-2">
              <div className="font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1">
                <span>• {it.namaBarang}</span>
                {retQ > 0 && (
                  <span className="text-[7.5px] font-black uppercase text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-1 py-0.2 rounded border border-rose-200 dark:border-rose-800">
                    RETUR {retQ}
                  </span>
                )}
              </div>
              <div className="text-[9.5px] font-nominal font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                {retQ > 0 ? (
                  <span>
                    <span className="line-through text-slate-400 font-normal">{rawQ}</span> → Final {finQ}
                  </span>
                ) : (
                  <span>{it.qty} × {formatRupiah(it.hargaBeli)}</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Expand / Collapse Button jika lebih dari 2 item */}
        {batch.items.length > 2 && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="w-full text-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 pt-1 flex items-center justify-center gap-1 cursor-pointer min-h-[30px]"
          >
            <span>{isExpanded ? 'Sembunyikan' : `Lihat ${hiddenCount} item lainnya`}</span>
          </button>
        )}
      </div>
    </div>
  );
};
