import React from 'react';
import { Receipt, X } from 'lucide-react';
import { OrderItem } from '../../types';
import { formatRupiah } from '../../lib/formatters';
import { TableSkeleton } from '../TableSkeleton';
import { Pagination } from '../Pagination';
import { TransactionsTableRow } from './TransactionsTableRow';
import { TransactionsSummaryBar } from './TransactionsSummaryBar';
import { TransactionBatch, SummaryTotals } from './types';

interface TransactionsTableProps {
  isLoading: boolean;
  filteredBatches: TransactionBatch[];
  paginatedBatches: TransactionBatch[];
  summaryTotals: SummaryTotals;
  selectedStoreFilter: string;
  onResetStoreFilter: () => void;
  activeMenuId?: string | null;
  onToggleBatchPayment: (batch: TransactionBatch) => void;
  onViewInvoice?: (items: OrderItem[], kitchenName?: string, storeName?: string, dateStr?: string) => void;
  onOpenInvoiceModal?: (items: OrderItem[], kitchenName?: string, storeName?: string) => void;
  onExportInvoicePdf?: (items: OrderItem[], kitchenName: string, storeName: string, dateStr?: string) => void;
  onDeleteTransaction?: (batch: TransactionBatch) => void;
  onDeleteInvoice?: (id: string) => void;
  onDeleteOrder: (id: string) => void;
  onOpenActionMenu: (rect: DOMRect, batch: TransactionBatch) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const TransactionsTable: React.FC<TransactionsTableProps> = ({
  isLoading,
  filteredBatches,
  paginatedBatches,
  summaryTotals,
  selectedStoreFilter,
  onResetStoreFilter,
  activeMenuId,
  onToggleBatchPayment,
  onViewInvoice,
  onOpenInvoiceModal,
  onExportInvoicePdf,
  onDeleteTransaction,
  onDeleteInvoice,
  onDeleteOrder,
  onOpenActionMenu,
  currentPage,
  totalPages,
  onPageChange,
}) => {
  if (isLoading && filteredBatches.length === 0) {
    return <TableSkeleton rows={6} />;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {filteredBatches.length === 0 ? (
        <div className="p-10 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Receipt className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-900">Tidak Ada Transaksi Ditemukan</h3>
          <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
            {selectedStoreFilter !== 'all'
              ? `Tidak ada transaksi untuk Toko ${selectedStoreFilter} pada periode ini.`
              : 'Coba sesuaikan pilihan periode, filter status, atau kata kunci pencarian.'}
          </p>
          {selectedStoreFilter !== 'all' && (
            <button
              type="button"
              onClick={onResetStoreFilter}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-100 cursor-pointer transition-all"
            >
              <span>Tampilkan Semua Toko</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs relative">
              <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 shadow-2xs">
                <tr className="text-[10px] sm:text-[11px] font-black text-slate-700 uppercase tracking-wider">
                  <th className="py-3 px-2 text-center w-10 bg-slate-100 sticky top-0">NO</th>
                  <th className="py-3 px-2.5 whitespace-nowrap bg-slate-100 sticky top-0">TANGGAL</th>
                  <th className="py-3 px-2.5 whitespace-nowrap bg-slate-100 sticky top-0">PEMASOK</th>
                  <th className="py-3 px-3 bg-slate-100 sticky top-0 min-w-[140px]">BARANG &amp; TUJUAN</th>
                  <th className="py-3 px-2.5 text-center whitespace-nowrap bg-slate-100 sticky top-0">TOKO</th>
                  <th className="py-3 px-2 text-center w-12 bg-slate-100 sticky top-0">QTY</th>
                  <th className="py-3 px-2.5 text-right whitespace-nowrap bg-slate-100 sticky top-0">H. BELI</th>
                  <th className="py-3 px-2.5 text-right whitespace-nowrap bg-slate-100 sticky top-0">TOTAL (JUAL)</th>
                  <th className="py-3 px-2.5 text-right whitespace-nowrap bg-slate-100 sticky top-0 text-amber-800">CASHBACK</th>
                  <th className="py-3 px-2.5 text-left whitespace-nowrap bg-slate-100 sticky top-0 text-slate-700">CATATAN</th>
                  <th className="py-3 px-2.5 text-right whitespace-nowrap bg-slate-100 sticky top-0 text-emerald-800">LABA BERSIH</th>
                  <th className="py-3 px-2.5 text-center whitespace-nowrap bg-slate-100 sticky top-0">STATUS</th>
                  <th className="py-3 px-2.5 text-center whitespace-nowrap min-w-[95px] bg-slate-100 sticky top-0">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800 bg-white">
                {paginatedBatches.map((batch) => (
                  <TransactionsTableRow
                    key={batch.id}
                    batch={batch}
                    isMenuOpen={activeMenuId === batch.id}
                    onToggleBatchPayment={onToggleBatchPayment}
                    onViewInvoice={onViewInvoice}
                    onOpenInvoiceModal={onOpenInvoiceModal}
                    onExportInvoicePdf={onExportInvoicePdf}
                    onDeleteTransaction={onDeleteTransaction}
                    onDeleteInvoice={onDeleteInvoice}
                    onDeleteOrder={onDeleteOrder}
                    onOpenActionMenu={onOpenActionMenu}
                  />
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 bg-slate-100 border-t-2 border-slate-300 shadow-2xs">
                <tr className="text-slate-900 text-[9px] font-black">
                  <td colSpan={5} className="py-2.5 px-3 text-right uppercase tracking-wider text-slate-700 font-extrabold">
                    TOTAL REKAP ({filteredBatches.length} Transaksi) :
                  </td>
                  <td className="py-2.5 px-1.5 text-center font-black font-nominal text-[10px] text-slate-900">
                    {summaryTotals.totalQty}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-black font-nominal text-[10px] text-rose-700 whitespace-nowrap">
                    {formatRupiah(summaryTotals.totalBeli)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-black font-nominal text-[10px] text-emerald-800 whitespace-nowrap">
                    {formatRupiah(summaryTotals.totalJual)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-black font-nominal text-[10px] text-amber-800 whitespace-nowrap">
                    {summaryTotals.totalKeKoperasi > 0 ? `+${formatRupiah(summaryTotals.totalKeKoperasi)}` : 'Rp 0'}
                  </td>
                  <td className="py-2.5 px-2 text-center text-slate-400 font-medium text-[9px]">
                    -
                  </td>
                  <td className="py-2.5 px-2 text-right font-black font-nominal text-[10px] whitespace-nowrap">
                    <span className={summaryTotals.totalLabaBersih >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                      {summaryTotals.totalLabaBersih >= 0
                        ? `+${formatRupiah(summaryTotals.totalLabaBersih)}`
                        : `-${formatRupiah(Math.abs(summaryTotals.totalLabaBersih))}`}
                    </span>
                  </td>
                  <td colSpan={2} className="py-2.5 px-2 text-center text-slate-400 font-medium">
                    -
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Baris Rekap Total Bawah Halaman Transaksi */}
          <TransactionsSummaryBar totalCount={filteredBatches.length} summaryTotals={summaryTotals} />

          {/* Pagination Component */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            totalItems={filteredBatches.length}
          />
        </>
      )}
    </div>
  );
};
