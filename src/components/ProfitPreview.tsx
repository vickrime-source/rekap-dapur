import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { formatIDR } from './MoneyInput';

export interface ProfitPreviewProps {
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
}

export const ProfitPreview: React.FC<ProfitPreviewProps> = ({
  quantity,
  purchasePrice,
  sellingPrice,
}) => {
  const qty = Math.max(0, quantity || 0);
  const hargaBeli = Math.max(0, purchasePrice || 0);
  const hargaJual = Math.max(0, sellingPrice || 0);

  const totalBeli = qty * hargaBeli;
  const totalJual = qty * hargaJual;
  const profit = totalJual - totalBeli;
  const margin =
    totalJual > 0 ? Math.round((profit / totalJual) * 10000) / 100 : 0;

  const isRugi = profit < 0 && hargaBeli > 0 && hargaJual > 0;
  const isPositif = profit > 0;

  return (
    <div className="pt-2 border-t border-slate-200/80 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Estimasi Profit
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            {profit >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            )}
            <span
              className={`text-xs sm:text-sm font-black font-mono ${
                isRugi
                  ? 'text-rose-600'
                  : isPositif
                  ? 'text-emerald-700'
                  : 'text-slate-700'
              }`}
            >
              {isPositif ? `+ ${formatIDR(profit)}` : isRugi ? `- ${formatIDR(Math.abs(profit))}` : formatIDR(profit)}
            </span>
          </div>
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
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            {margin.toFixed(1)}%
          </span>
        </div>
      </div>

      {isRugi && (
        <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1.5 text-rose-700 text-[11px] font-bold">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>Harga jual lebih rendah dari modal!</span>
        </div>
      )}
    </div>
  );
};
