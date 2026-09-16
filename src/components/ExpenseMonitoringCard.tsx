import React from 'react';
import { StoreExpenseBreakdown } from '../types';
import { formatRupiah, getTokoBadgeStyle } from '../lib/formatters';

interface ExpenseMonitoringCardProps {
  periodLabel: string;
  totalPengeluaran: number;
  totalQty: number;
  storeBreakdowns: StoreExpenseBreakdown[];
  selectedStoreFilter?: string;
  onFilterStore?: (toko: string) => void;
}

export const ExpenseMonitoringCard: React.FC<ExpenseMonitoringCardProps> = ({
  periodLabel,
  totalPengeluaran,
  totalQty,
  storeBreakdowns,
  selectedStoreFilter,
  onFilterStore,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-3 font-sans shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Monitoring Pengeluaran PO
          </h2>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Uang keluar ke supplier/pengepul ({periodLabel})
          </span>
        </div>
        <div className="text-right">
          <span className="text-base sm:text-lg font-bold font-nominal text-rose-700 dark:text-rose-400 block leading-tight">
            {formatRupiah(totalPengeluaran)}
          </span>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
            {totalQty.toLocaleString('id-ID')} Qty Total
          </span>
        </div>
      </div>

      {/* Store Breakdown List */}
      {storeBreakdowns.length === 0 ? (
        <div className="py-4 text-center text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
          Belum ada data pengeluaran PO pada periode ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {storeBreakdowns.map((store) => {
            const isSelected = selectedStoreFilter === store.toko;
            return (
              <div
                key={store.toko}
                onClick={() => onFilterStore && onFilterStore(isSelected ? 'all' : store.toko)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer min-h-[44px] flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                    : 'border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-800 active:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs border ${getTokoBadgeStyle(store.toko)}`}>
                    {store.toko}
                  </span>
                  <span className="text-sm font-bold font-nominal text-slate-900 dark:text-slate-100">
                    {formatRupiah(store.totalBeli)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-2">
                  <span>{store.totalQty.toLocaleString('id-ID')} Qty ({store.orderCount} item)</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.round(store.percentageOfTotalBeli)}%</span>
                </div>

                <div className="mt-1.5 w-full bg-slate-200/70 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-slate-800 dark:bg-slate-300 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(3, store.percentageOfTotalBeli))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
