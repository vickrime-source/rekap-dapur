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
  const hasCashback = totalKeKoperasi !== undefined && totalKeKoperasi > 0;
  const profit = totalLabaBersih !== undefined ? totalLabaBersih : (safeJual - safeBeli);
  const margin = safeJual > 0 ? Math.round((profit / safeJual) * 10000) / 100 : 0;
  const isPositif = profit > 0;
  const isRugi = profit < 0 && safeBeli > 0;

  return (
    <div
      className={`p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2.5 ${className}`}
    >
      <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-200">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Total Penjualan
          </span>
          <span className="text-xs sm:text-sm font-black text-slate-900 font-mono">
            {formatIDR(safeJual)}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Total Beli
          </span>
          <span className="text-xs sm:text-sm font-black text-slate-900 font-mono">
            {formatIDR(safeBeli)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-0.5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Estimasi Profit
          </span>
          <span
            className={`text-xs sm:text-sm font-black font-mono ${
              isRugi
                ? 'text-rose-600'
                : isPositif
                ? 'text-emerald-700'
                : 'text-slate-800'
            }`}
          >
            {isPositif ? `+ ${formatIDR(profit)}` : isRugi ? `- ${formatIDR(Math.abs(profit))}` : formatIDR(profit)}
          </span>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
            Margin
          </span>
          <span
            className={`inline-block text-[10.5px] font-black px-2 py-0.5 rounded-md ${
              isRugi
                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                : margin > 0
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {margin.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
};
