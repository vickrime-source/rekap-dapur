import React from 'react';
import { formatRupiah, getTokoBadgeStyle } from '../lib/formatters';

export interface TokoBreakdownItem {
  toko: string;
  totalJual: number;
  totalBeli: number;
  profit: number;
  marginPercent: number;
  totalQty: number;
  transactionCount: number;
  orderCount?: number;
  pemasokList?: string[];
  percentageOfTotalBeli?: number;
  percentageOfTotalJual?: number;
}

export interface BreakdownTokoProps {
  items: TokoBreakdownItem[];
  selectedStoreFilter?: string;
  onFilterStore?: (toko: string) => void;
  className?: string;
}

export const BreakdownToko: React.FC<BreakdownTokoProps> = ({
  items,
  selectedStoreFilter,
  onFilterStore,
  className = '',
}) => {
  if (items.length === 0) {
    return (
      <div className={`py-8 text-center text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 ${className}`}>
        Tidak ada transaksi pesanan toko pada periode ini.
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 shadow-2xs transition-colors duration-200">
        {/* Table Header on Desktop */}
        <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
          <div className="col-span-4">Toko & Pemasok</div>
          <div className="col-span-2 text-center">Trx & Qty</div>
          <div className="col-span-2 text-right">Omset (H.Jual)</div>
          <div className="col-span-2 text-right">Modal (H.Beli)</div>
          <div className="col-span-2 text-right">Profit Bersih</div>
        </div>

        {/* Toko Breakdown Rows */}
        {items.map((item) => {
          const isSelected = selectedStoreFilter === item.toko;
          const trxCount = item.transactionCount ?? item.orderCount ?? 0;
          const pemasokStr = item.pemasokList && item.pemasokList.length > 0
            ? item.pemasokList.join(', ')
            : null;

          return (
            <div
              key={item.toko}
              onClick={() => onFilterStore && onFilterStore(isSelected ? 'all' : item.toko)}
              className={`p-3 transition-colors cursor-pointer min-h-[52px] ${
                isSelected
                  ? 'bg-indigo-50/80 dark:bg-indigo-950/60 ring-1 ring-inset ring-indigo-500'
                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800'
              }`}
            >
              {/* Desktop Layout (Grid) */}
              <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
                {/* Toko & Pemasok */}
                <div className="col-span-4 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold border ${getTokoBadgeStyle(item.toko)}`}>
                      {item.toko}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/80 px-1.5 py-0.5 rounded">
                        Aktif
                      </span>
                    )}
                  </div>
                  {pemasokStr && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate mt-0.5" title={pemasokStr}>
                      Pemasok: <strong className="font-medium text-slate-700 dark:text-slate-300">{pemasokStr}</strong>
                    </span>
                  )}
                </div>

                {/* Trx & Qty */}
                <div className="col-span-2 text-center">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block leading-tight">
                    {trxCount} Trx
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 block mt-0.5">
                    ({item.totalQty.toLocaleString('id-ID')} Qty)
                  </span>
                </div>

                {/* Omset (H.Jual) */}
                <div className="col-span-2 text-right">
                  <span className="text-xs sm:text-sm font-bold font-nominal text-slate-900 dark:text-slate-100 block leading-tight truncate">
                    {formatRupiah(item.totalJual)}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                    {item.percentageOfTotalJual ? `${Math.round(item.percentageOfTotalJual)}% omset` : ''}
                  </span>
                </div>

                {/* Modal / Pembelian PO (H.Beli) */}
                <div className="col-span-2 text-right">
                  <span className="text-xs sm:text-sm font-bold font-nominal text-rose-700 dark:text-rose-400 block leading-tight truncate">
                    {formatRupiah(item.totalBeli)}
                  </span>
                  <span className="text-[10px] text-rose-500/80 dark:text-rose-400/80 block">
                    {item.percentageOfTotalBeli ? `${Math.round(item.percentageOfTotalBeli)}% PO` : ''}
                  </span>
                </div>

                {/* Profit Bersih & Margin */}
                <div className="col-span-2 text-right">
                  <span className={`text-xs sm:text-sm font-bold font-nominal block leading-tight truncate ${
                    item.profit < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-800 dark:text-emerald-300'
                  }`}>
                    {item.profit >= 0 ? `+${formatRupiah(item.profit)}` : formatRupiah(item.profit)}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 block mt-0.5">
                    Margin {item.marginPercent}%
                  </span>
                </div>
              </div>

              {/* Mobile Layout (Stacked & 3-Col Metric Comparison) */}
              <div className="sm:hidden space-y-2">
                {/* Row 1: Toko Badge + Trx (Qty) */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold border ${getTokoBadgeStyle(item.toko)}`}>
                      {item.toko}
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {trxCount} Trx
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">
                      ({item.totalQty.toLocaleString('id-ID')} Qty)
                    </span>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/80 px-1.5 py-0.5 rounded shrink-0">
                      Aktif
                    </span>
                  )}
                </div>

                {pemasokStr && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate" title={pemasokStr}>
                    Pemasok: <strong className="font-medium text-slate-700 dark:text-slate-300">{pemasokStr}</strong>
                  </span>
                )}

                {/* Row 2: 3-Col Financial Comparison: Omset, Modal, Profit */}
                <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg text-center">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Omset
                    </span>
                    <span className="text-xs font-bold font-nominal text-slate-900 dark:text-slate-100 block truncate mt-0.5">
                      {formatRupiah(item.totalJual)}
                    </span>
                  </div>

                  <div className="bg-rose-50/60 dark:bg-rose-950/40 p-2 rounded-lg text-center">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                      Modal
                    </span>
                    <span className="text-xs font-bold font-nominal text-rose-700 dark:text-rose-400 block truncate mt-0.5">
                      {formatRupiah(item.totalBeli)}
                    </span>
                  </div>

                  <div className="bg-emerald-50/60 dark:bg-emerald-950/40 p-2 rounded-lg text-center">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                      Profit ({item.marginPercent}%)
                    </span>
                    <span className={`text-xs font-bold font-nominal block truncate mt-0.5 ${
                      item.profit < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-800 dark:text-emerald-300'
                    }`}>
                      {item.profit >= 0 ? `+${formatRupiah(item.profit)}` : formatRupiah(item.profit)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Comparative Progress Bar */}
              {typeof item.percentageOfTotalBeli === 'number' && (
                <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(2, item.percentageOfTotalBeli))}%` }}
                    title={`Porsi Pembelian/Modal: ${Math.round(item.percentageOfTotalBeli)}%`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
