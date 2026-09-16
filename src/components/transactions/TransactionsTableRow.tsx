import React from 'react';
import { Truck, Eye, Printer, Trash2, MoreVertical } from 'lucide-react';
import { OrderItem } from '../../types';
import { formatRupiah, formatTanggalDisatuin, getTokoBadgeStyle } from '../../lib/formatters';
import { TransactionBatch } from './types';

interface TransactionsTableRowProps {
  batch: TransactionBatch;
  isMenuOpen: boolean;
  onToggleBatchPayment: (batch: TransactionBatch) => void;
  onViewInvoice?: (items: OrderItem[], kitchenName?: string, storeName?: string, dateStr?: string) => void;
  onOpenInvoiceModal?: (items: OrderItem[], kitchenName?: string, storeName?: string) => void;
  onExportInvoicePdf?: (items: OrderItem[], kitchenName: string, storeName: string, dateStr?: string) => void;
  onDeleteTransaction?: (batch: TransactionBatch) => void;
  onDeleteInvoice?: (id: string) => void;
  onDeleteOrder: (id: string) => void;
  onOpenActionMenu: (rect: DOMRect, batch: TransactionBatch) => void;
}

export const TransactionsTableRow: React.FC<TransactionsTableRowProps> = ({
  batch,
  isMenuOpen,
  onToggleBatchPayment,
  onViewInvoice,
  onOpenInvoiceModal,
  onExportInvoicePdf,
  onDeleteTransaction,
  onDeleteInvoice,
  onDeleteOrder,
  onOpenActionMenu,
}) => {
  const isPaid = batch.payStatus === 'PAID';
  const labaBersih =
    batch.totalLabaBersih !== undefined ? batch.totalLabaBersih : (batch.totalJual || 0) - batch.totalBeli;
  const keKoperasi = batch.totalKeKoperasi || 0;

  const handleView = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onViewInvoice) {
      onViewInvoice(batch.items, batch.tujuanDapur, batch.toko, batch.tanggal);
    } else if (onOpenInvoiceModal) {
      onOpenInvoiceModal(batch.items, batch.tujuanDapur, batch.toko);
    }
  };

  const handleExportPdf = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onExportInvoicePdf) {
      onExportInvoicePdf(batch.items, batch.tujuanDapur, batch.toko, batch.tanggal);
    } else if (onOpenInvoiceModal) {
      onOpenInvoiceModal(batch.items, batch.tujuanDapur, batch.toko);
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
    <tr className="hover:bg-slate-50/90 dark:hover:bg-slate-800/60 transition-colors">
      {/* 1. NO */}
      <td className="py-2.5 px-1.5 text-center font-mono text-[9px] font-bold text-slate-400 dark:text-slate-500 align-middle">
        {batch.batchIndex}
      </td>

      {/* 2. TANGGAL */}
      <td className="py-2.5 px-2 whitespace-nowrap align-middle">
        <span className="font-bold text-slate-800 dark:text-slate-200 text-[9px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/80 dark:border-slate-700">
          {formatTanggalDisatuin(batch.tanggal)}
        </span>
      </td>

      {/* 3. PEMASOK */}
      <td className="py-2.5 px-2 align-middle">
        <span className="inline-flex items-center gap-1 font-extrabold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[9px] border border-slate-200/80 dark:border-slate-700 truncate max-w-[120px]">
          <Truck className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="truncate">{batch.pemasok}</span>
        </span>
      </td>

      {/* 4. BARANG (ITEM TRANSAKSI & DAPUR) */}
      <td className="py-2.5 px-2.5 align-middle">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="inline-block bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 font-black px-1.5 py-0.5 rounded text-[8.5px] border border-indigo-200 dark:border-indigo-800">
            Dapur {batch.tujuanDapur}
          </span>
        </div>
        <div className="space-y-1">
          {batch.items.map((it, itIdx) => (
            <div key={it.id || itIdx} className="flex items-center justify-between gap-2 text-[9.5px]">
              <div className="font-bold text-slate-900 dark:text-slate-100 truncate">• {it.namaBarang}</div>
              <div className="text-[8.5px] font-nominal font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap flex items-center gap-1">
                <span>
                  {it.qty} × {formatRupiah(it.hargaBeli)}
                </span>
                {it.cashback && Number(it.cashback) > 0 ? (
                  <span
                    className="text-[8px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1 py-0.5 rounded border border-amber-200 dark:border-amber-800"
                    title={`Cashback: ${formatRupiah(it.cashback)}`}
                  >
                    CB: {formatRupiah(it.cashback)}
                  </span>
                ) : null}
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
      <td className="py-2.5 px-1.5 text-center font-black font-nominal text-[10px] text-slate-900 dark:text-slate-100 align-middle">
        {batch.totalQty}
      </td>

      {/* 7. H. BELI */}
      <td className="py-2.5 px-2.5 text-right font-black font-nominal text-[10px] text-rose-700 dark:text-rose-400 align-middle whitespace-nowrap">
        {formatRupiah(batch.totalBeli)}
      </td>

      {/* 8. TOTAL */}
      <td className="py-2.5 px-2.5 text-right font-black font-nominal text-[10px] text-emerald-800 dark:text-emerald-400 align-middle whitespace-nowrap">
        {formatRupiah(batch.totalJual || batch.totalBeli)}
      </td>

      {/* 9. CASHBACK / KE KOPERASI */}
      <td className="py-2.5 px-2 text-right font-black font-nominal text-[10px] align-middle whitespace-nowrap">
        {keKoperasi > 0 ? (
          <span className="text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200/90 dark:border-amber-800 font-bold">
            +{formatRupiah(keKoperasi)}
          </span>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 font-medium block text-center">-</span>
        )}
      </td>

      {/* 9b. CATATAN */}
      <td className="py-2.5 px-2 text-left align-middle max-w-[140px]">
        {batch.catatan ? (
          <span
            className="inline-block text-[9px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/90 dark:border-slate-700 font-medium truncate max-w-[130px] align-middle"
            title={batch.catatan}
          >
            {batch.catatan}
          </span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600 font-medium text-center block">-</span>
        )}
      </td>

      {/* 10. LABA BERSIH */}
      <td className="py-2.5 px-2 text-right font-black font-nominal text-[10px] align-middle whitespace-nowrap">
        <span className={labaBersih >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
          {labaBersih >= 0 ? `+${formatRupiah(labaBersih)}` : `-${formatRupiah(Math.abs(labaBersih))}`}
        </span>
      </td>

      {/* 11. STATUS PAYMENT 1-CLICK TOGGLE */}
      <td className="py-2.5 px-2 text-center whitespace-nowrap align-middle">
        <button
          type="button"
          onClick={() => onToggleBatchPayment(batch)}
          className={`px-2.5 py-1 rounded-md text-[8.5px] font-black cursor-pointer transition-all active:scale-95 border ${
            isPaid
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/60'
          }`}
          title="Klik untuk ubah status Payment (PAID / UNPAID)"
        >
          {isPaid ? 'PAID' : 'UNPAID'}
        </button>
      </td>

      {/* 12. AKSI */}
      <td className="py-2.5 px-1.5 text-center align-middle">
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={handleView}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-extrabold shadow-2xs transition-all active:scale-95 border border-sky-200 dark:border-sky-800 cursor-pointer"
            title={`Lihat Bukti Invoice Dapur ${batch.tujuanDapur}`}
          >
            <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-900 font-extrabold shadow-2xs transition-all active:scale-95 border border-amber-500/80 cursor-pointer"
            title={`1-Click Export Invoice PDF Dapur ${batch.tujuanDapur}`}
          >
            <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent transition-all cursor-pointer active:scale-95"
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
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
              isMenuOpen
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-500/20 shadow-2xs'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent active:scale-95'
            }`}
            title="Menu Aksi"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};
