import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { formatIDR } from './MoneyInput';

export interface ProfitSummaryProps {
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  className?: string;
}

export const ProfitSummary: React.FC<ProfitSummaryProps> = ({
  quantity,
  purchasePrice,
  sellingPrice,
  className = '',
}) => {
  const safeQty = Math.max(0, quantity || 0);
  const safeBeli = Math.max(0, purchasePrice || 0);
  const safeJual = Math.max(0, sellingPrice || 0);

  const totalModal = safeBeli * safeQty;
  const totalPenjualan = safeJual * safeQty;
  const profit = totalPenjualan - totalModal;

  const margin =
    totalPenjualan > 0
      ? Math.round((profit / totalPenjualan) * 10000) / 100
      : 0;

  const isRugi = profit < 0 && safeJual > 0 && safeBeli > 0;
  const isPositive = profit > 0;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Warning jika rugi */}
      {isRugi && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start gap-2.5 text-rose-800 dark:text-rose-200 text-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <span className="font-bold block text-rose-900 dark:text-rose-200">
              Harga jual lebih rendah dari modal!
            </span>
            <span className="text-[11px] text-rose-700 dark:text-rose-300">
              Harga jual ({formatIDR(safeJual)}) lebih kecil dari modal ({formatIDR(safeBeli)}). Estimasi kerugian sebesar {formatIDR(Math.abs(profit))}.
            </span>
          </div>
        </div>
      )}

      {/* Grid Summary Kartu */}
      <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 rounded-2xl shadow-2xs grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Modal */}
        <div className="border-r border-slate-100 dark:border-slate-700 pr-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block">
            Total Modal
          </span>
          <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 font-mono">
            {formatIDR(totalModal)}
          </span>
        </div>

        {/* Total Penjualan */}
        <div className="sm:border-r border-slate-100 dark:border-slate-700 pr-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Total Penjualan
          </span>
          <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 font-mono">
            {formatIDR(totalPenjualan)}
          </span>
        </div>

        {/* Estimasi Profit */}
        <div className="border-r border-slate-100 dark:border-slate-700 pr-2 pt-2 sm:pt-0 border-t sm:border-t-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Estimasi Profit
          </span>
          <div className="flex items-center gap-1 mt-0.5">
            {profit >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span
              className={`text-xs sm:text-sm font-black font-mono ${
                profit < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : isPositive
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              {profit < 0 ? `-${formatIDR(Math.abs(profit))}` : formatIDR(profit)}
            </span>
          </div>
        </div>

        {/* Margin */}
        <div className="pt-2 sm:pt-0 border-t border-slate-100 dark:border-slate-700 sm:border-t-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
            Margin
          </span>
          <span
            className={`inline-block text-[11px] font-black px-2 py-0.5 rounded-md ${
              isRugi
                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                : margin > 0
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {margin.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
};
