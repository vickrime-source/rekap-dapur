import React from 'react';
import { Truck, Trash2, MoreVertical } from 'lucide-react';
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
  onDeleteTransaction,
  onDeleteInvoice,
  onDeleteOrder,
  onOpenActionMenu,
}) => {
  const isPaid = batch.payStatus === 'PAID';
  const labaBersih =
    batch.totalLabaBersih !== undefined ? batch.totalLabaBersih : (batch.totalJual || 0) - batch.totalBeli;
  const keKoperasi = batch.totalKeKoperasi || 0;

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
    <tr
      className={`border-b border-slate-100 dark:border-slate-800/80 transition-colors ${
        batch.isCancelled
          ? 'opacity-60 bg-slate-100/50 dark:bg-slate-900/50'
          : 'hover:bg-indigo-50/30 dark:hover:bg-slate-800/40'
      }`}
    >
      {/* 1. NO */}
      <td className="py-3 px-2 text-center font-mono text-xs font-semibold text-slate-400 dark:text-slate-500 align-middle">
        {batch.batchIndex}
      </td>

      {/* 2. TANGGAL */}
      <td className="py-3 px-2.5 whitespace-nowrap align-middle">
        <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
          {formatTanggalDisatuin(batch.tanggal)}
        </span>
      </td>

      {/* 3. PEMASOK */}
      <td className="py-3 px-2.5 align-middle">
        <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs truncate max-w-[130px]">
          <Truck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="truncate">{batch.pemasok}</span>
        </span>
      </td>

      {/* 4. BARANG & TUJUAN */}
      <td className="py-3 px-3 align-middle min-w-[200px]">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="inline-block bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-extrabold px-2 py-0.5 rounded-md text-[10px] border border-indigo-200 dark:border-indigo-800">
            Dapur {batch.tujuanDapur}
          </span>
          {batch.isCancelled && (
            <span className="inline-block bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black px-1.5 py-0.5 rounded text-[9px] border border-slate-300 dark:border-slate-600 uppercase">
              Dibatalkan
            </span>
          )}
        </div>
        <div className="space-y-1">
          {batch.items.map((it, itIdx) => {
            const rawQ = Number(it.qty) || 0;
            const retQ = Math.min(rawQ, Math.max(0, Number(it.retur) || 0));
            const finQ = Math.max(0, rawQ - retQ);
            return (
              <div key={it.id || itIdx} className="flex items-center justify-between gap-2 text-xs">
                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5 flex-wrap">
                  <span>• {it.namaBarang}</span>
                  {it.pemasok && (
                    <span className="text-[9px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800 flex items-center gap-0.5">
                      <Truck className="w-2.5 h-2.5 text-blue-500" />
                      {it.pemasok}
                    </span>
                  )}
                  {retQ > 0 && (
                    <span className="text-[9px] font-black uppercase text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-1 py-0.2 rounded border border-rose-200 dark:border-rose-800">
                      RETUR {retQ}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-nominal font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap flex items-center gap-1.5">
                  {retQ > 0 ? (
                    <span title={`Qty Awal: ${rawQ}, Retur: ${retQ}, Ditagihkan: ${finQ}`}>
                      <span className="line-through text-slate-400">{rawQ}</span> → <strong className="font-bold text-slate-800 dark:text-slate-200">Ditagihkan {finQ}</strong> × {formatRupiah(it.hargaBeli)}
                    </span>
                  ) : (
                    <span>
                      {it.qty} × {formatRupiah(it.hargaBeli)}
                    </span>
                  )}
                  {it.cashback && Number(it.cashback) > 0 ? (
                    <span
                      className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800"
                      title={`Cashback: ${formatRupiah(it.cashback)}`}
                    >
                      CB: {formatRupiah(it.cashback)}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </td>

      {/* 5. TOKO */}
      <td className="py-3 px-2 text-center whitespace-nowrap align-middle">
        <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold border ${getTokoBadgeStyle(batch.toko)}`}>
          {batch.toko}
        </span>
      </td>

      {/* 6. QTY */}
      <td className="py-3 px-2 text-center font-bold font-nominal text-xs text-slate-900 dark:text-slate-100 align-middle">
        {batch.totalQty}
      </td>

      {/* 7. H. BELI */}
      <td className="py-3 px-2.5 text-right font-bold font-nominal text-xs text-rose-600 dark:text-rose-400 align-middle whitespace-nowrap">
        {formatRupiah(batch.totalBeli)}
      </td>

      {/* 8. TOTAL */}
      <td className="py-3 px-2.5 text-right font-bold font-nominal text-xs text-emerald-700 dark:text-emerald-400 align-middle whitespace-nowrap">
        {formatRupiah(batch.totalJual || batch.totalBeli)}
      </td>

      {/* 9. CASHBACK / KE KOPERASI */}
      <td className="py-3 px-2 text-right font-semibold font-nominal text-xs align-middle whitespace-nowrap">
        {keKoperasi > 0 ? (
          <span className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200/90 dark:border-amber-800 font-bold">
            +{formatRupiah(keKoperasi)}
          </span>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 font-medium block text-center">-</span>
        )}
      </td>

      {/* 10. CATATAN */}
      <td className="py-3 px-2 text-left align-middle max-w-[130px]">
        {batch.catatan ? (
          <span
            className="inline-block text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-medium truncate max-w-[120px] align-middle"
            title={batch.catatan}
          >
            {batch.catatan}
          </span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600 font-medium text-center block">-</span>
        )}
      </td>

      {/* 11. LABA BERSIH */}
      <td className="py-3 px-2.5 text-right font-bold font-nominal text-xs align-middle whitespace-nowrap">
        <span className={labaBersih >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
          {labaBersih >= 0 ? `+${formatRupiah(labaBersih)}` : `-${formatRupiah(Math.abs(labaBersih))}`}
        </span>
      </td>

      {/* 12. STATUS PAYMENT 1-CLICK TOGGLE */}
      <td className="py-3 px-2 text-center whitespace-nowrap align-middle">
        {batch.isCancelled ? (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 inline-block">
            CANCELLED
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onToggleBatchPayment(batch)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold cursor-pointer transition-all active:scale-95 border ${
              isPaid
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/60'
            }`}
            title="Klik untuk ubah status Payment (PAID / UNPAID)"
          >
            {isPaid ? 'PAID' : 'UNPAID'}
          </button>
        )}
      </td>

      {/* 13. AKSI: Bersih & Ringkas (Hapus & Menu Lainnya) */}
      <td className="py-3 px-2 text-center align-middle">
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={handleDelete}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700/80 transition-all cursor-pointer active:scale-95"
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
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 active:scale-95'
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
