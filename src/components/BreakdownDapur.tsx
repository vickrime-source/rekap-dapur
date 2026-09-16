import React from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { formatRupiah } from '../lib/formatters';

export interface DapurBreakdownItem {
  dapur: string;
  orderCount: number;
  transactionCount: number;
  totalTagihan: number; // Nilai jual tagihan ke dapur
  totalJual: number;
  totalBeli: number;
  profit: number;
  marginPercent: number;
  totalQty: number;
  percentageOfTotalTagihan?: number;
}

export interface BreakdownDapurProps {
  items: DapurBreakdownItem[];
  selectedDapurFilter?: string;
  onFilterDapur?: (dapur: string) => void;
  className?: string;
}

export const BreakdownDapur: React.FC<BreakdownDapurProps> = ({
  items,
  selectedDapurFilter,
  onFilterDapur,
  className = '',
}) => {
  if (items.length === 0) {
    return (
      <div className={`py-8 text-center text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 ${className}`}>
        Tidak ada data transaksi dapur pada periode ini.
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 shadow-2xs transition-colors duration-200">
        {/* Table Header on Desktop */}
        <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
          <div className="col-span-4">Nama Dapur</div>
          <div className="col-span-2 text-center">Total Pesanan</div>
          <div className="col-span-2 text-right">Total Tagihan (Omset)</div>
          <div className="col-span-2 text-right">Modal Bahan</div>
          <div className="col-span-2 text-right">Profit Bersih</div>
        </div>

        {/* Dapur Breakdown Rows */}
        {items.map((item) => {
          const isSelected = selectedDapurFilter === item.dapur;
          const pesananCount = item.transactionCount || item.orderCount;

          return (
            <div
              key={item.dapur}
              onClick={() => onFilterDapur && onFilterDapur(isSelected ? 'all' : item.dapur)}
              className={`p-3 transition-colors min-h-[52px] ${
                onFilterDapur ? 'cursor-pointer' : ''
              } ${
                isSelected
                  ? 'bg-indigo-50/80 dark:bg-indigo-950/60 ring-1 ring-inset ring-indigo-500'
                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800'
              }`}
            >
              {/* Desktop Layout (Grid) */}
              <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
                {/* Nama Dapur */}
                <div className="col-span-4 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      <UtensilsCrossed className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400 shrink-0" />
                      <span className="truncate">Dapur {item.dapur}</span>
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/80 px-1.5 py-0.5 rounded">
                        Aktif
                      </span>
                    )}
                  </div>
                </div>

                {/* Total Pesanan & Qty */}
                <div className="col-span-2 text-center">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block leading-tight">
                    {pesananCount} Pesanan
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 block mt-0.5">
                    ({item.totalQty.toLocaleString('id-ID')} Qty)
                  </span>
                </div>

                {/* Total Tagihan (Omset H.Jual) */}
                <div className="col-span-2 text-right">
                  <span className="text-xs sm:text-sm font-bold font-nominal text-slate-900 dark:text-slate-100 block leading-tight truncate">
                    {formatRupiah(item.totalTagihan)}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                    {typeof item.percentageOfTotalTagihan === 'number'
                      ? `${Math.round(item.percentageOfTotalTagihan)}% omset`
                      : ''}
                  </span>
                </div>

                {/* Modal Bahan (H.Beli) */}
                <div className="col-span-2 text-right">
                  <span className="text-xs sm:text-sm font-bold font-nominal text-rose-700 dark:text-rose-400 block leading-tight truncate">
                    {formatRupiah(item.totalBeli)}
                  </span>
                  <span className="text-[10px] text-rose-500/80 dark:text-rose-400/80 block">
                    Modal PO
                  </span>
                </div>

                {/* Profit & Margin */}
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

              {/* Mobile Layout */}
              <div className="sm:hidden space-y-2">
                {/* Header: Nama Dapur + Total Pesanan */}
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 min-w-0">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400 shrink-0" />
                    <span className="truncate">Dapur {item.dapur}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                      {pesananCount} Pesanan
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                      ({item.totalQty.toLocaleString('id-ID')} Qty)
                    </span>
                  </div>
                </div>

                {/* Row 2: 3-Col Financial Metrics: Tagihan (Omset), Modal, Profit */}
                <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg text-center">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Tagihan Dapur
                    </span>
                    <span className="text-xs font-bold font-nominal text-slate-900 dark:text-slate-100 block truncate mt-0.5">
                      {formatRupiah(item.totalTagihan)}
                    </span>
                  </div>

                  <div className="bg-rose-50/60 dark:bg-rose-950/40 p-2 rounded-lg text-center">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                      Modal Bahan
                    </span>
                    <span className="text-xs font-bold font-nominal text-rose-700 dark:text-rose-300 block truncate mt-0.5">
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

                {/* Progress bar % dari total tagihan */}
                {typeof item.percentageOfTotalTagihan === 'number' && (
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
                    <div
                      className="bg-indigo-600 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(3, item.percentageOfTotalTagihan))}%` }}
                      title={`Porsi Tagihan: ${Math.round(item.percentageOfTotalTagihan)}%`}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
