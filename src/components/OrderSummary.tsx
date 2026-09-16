import React from 'react';
import { formatIDR } from './MoneyInput';

export interface OrderSummaryProps {
  totalPenjualan: number;
  totalBeli: number;
  totalLabaBersih?: number;
  totalKeKoperasi?: number;
  className?: string;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  totalPenjualan,
  totalBeli,
  totalLabaBersih,
  totalKeKoperasi,
  className = '',
}) => {
  const safeJual = Math.max(0, totalPenjualan || 0);
  const safeBeli = Math.max(0, totalBeli || 0);
  const safeKoperasi = Math.max(0, totalKeKoperasi || 0);
  const hasKoperasi = safeKoperasi > 0;
  const profit = totalLabaBersih !== undefined ? totalLabaBersih : (safeJual - safeBeli);
  const margin = safeJual > 0 ? Math.round((profit / safeJual) * 10000) / 100 : 0;
  const isPositif = profit > 0;
  const isRugi = profit < 0 && safeBeli > 0;

  return (
    <div
      className={`p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3 ${className}`}
    >
      <div className="grid grid-cols-2 gap-3 pb-2.5 border-b border-slate-200">
        <div>
          <span className="text-[10.5px] font-medium uppercase tracking-wider text-slate-500 block">
            Total Penjualan
          </span>
          <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
            {formatIDR(safeJual)}
          </span>
        </div>

        <div>
          <span className="text-[10.5px] font-medium uppercase tracking-wider text-slate-500 block">
            Total Beli
          </span>
          <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
            {formatIDR(safeBeli)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 items-center gap-2">
        <div>
          <span className="text-[10.5px] font-medium uppercase tracking-wider text-slate-500 block">
            Laba Bersih
          </span>
          <span
            className={`text-xs sm:text-sm font-bold font-mono ${
              isRugi
                ? 'text-rose-600'
                : isPositif
                ? 'text-emerald-700'
                : 'text-slate-800'
            }`}
          >
            {isRugi ? `- ${formatIDR(Math.abs(profit))}` : formatIDR(profit)}
          </span>
        </div>

        <div>
          <span className="text-[10.5px] font-medium uppercase tracking-wider text-slate-500 block">
            Ke Koperasi
          </span>
          <span className="text-xs sm:text-sm font-bold text-amber-800 font-mono">
            {formatIDR(safeKoperasi)}
          </span>
        </div>

        <div className="flex flex-col items-end justify-center">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block mb-1">
            Margin
          </span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
              isRugi
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : margin > 0
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            {margin.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
};
