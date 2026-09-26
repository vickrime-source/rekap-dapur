import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatIDR } from './MoneyInput';

export interface ProfitPreviewProps {
  quantity: number;
  qtyBeli?: number;
  retur?: number;
  purchasePrice: number;
  sellingPrice: number;
  cashback?: number;
}

export const ProfitPreview: React.FC<ProfitPreviewProps> = ({
  quantity,
  qtyBeli,
  retur = 0,
  purchasePrice,
  sellingPrice,
  cashback,
}) => {
  const rawQty = Math.max(0, quantity || 0);
  const rawQtyBeli = qtyBeli !== undefined && qtyBeli !== null ? Math.max(0, qtyBeli) : rawQty;
  const rawRetur = Math.max(0, retur || 0);
  const validRetur = Math.min(rawQty, rawRetur);
  const qtyFinal = Math.max(0, rawQty - validRetur);
  const qtyBeliEfektif = Math.max(0, rawQtyBeli - validRetur);

  const hargaBeli = Math.max(0, purchasePrice || 0);
  const hargaJual = Math.max(0, sellingPrice || 0);
  const cb = cashback !== undefined && cashback !== null && Number(cashback) > 0 ? Number(cashback) : 0;

  // Logic Retur:
  // qty_final_jual = max(0, qty - retur)
  // qty_beli_efektif = max(0, qty_beli - retur)
  // omzet = qty_final_jual × harga_jual
  // modal = qty_beli_efektif × harga_beli
  // laba = omzet - modal
  const totalJual = qtyFinal * hargaJual;
  const totalBeli = qtyBeliEfektif * hargaBeli;
  const totalLabaBersih = cb > 0 ? (cb * qtyFinal - totalBeli) : (totalJual - totalBeli);
  const totalKeKoperasi = cb > 0 ? (hargaJual - cb) * qtyFinal : 0;

  const margin =
    totalJual > 0 ? Math.round((totalLabaBersih / totalJual) * 10000) / 100 : 0;

  const isRugi = totalLabaBersih < 0 && hargaBeli > 0;
  const isPositif = totalLabaBersih > 0;

  return (
    <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-2">
      {/* Clean & Modern Summary Card */}
      <div className="p-3 sm:p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 rounded-xl space-y-2">
        {validRetur > 0 && (
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70 dark:border-slate-700/70 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                RETUR {validRetur}
              </span>
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {rawQty} → <strong className="font-bold text-emerald-700 dark:text-emerald-400">Final {qtyFinal}</strong>
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Omzet dihitung dari Qty Final</span>
          </div>
        )}
        <div className="grid grid-cols-3 items-center gap-2">
          {/* Laba Bersih */}
          <div>
            <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Laba Bersih
            </span>
            <div
              className={`text-sm sm:text-base font-bold font-mono tracking-tight mt-0.5 ${
                isRugi
                  ? 'text-rose-600 dark:text-rose-400'
                  : isPositif
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {isRugi ? `- ${formatIDR(Math.abs(totalLabaBersih))}` : formatIDR(totalLabaBersih)}
            </div>
          </div>

          {/* Cashback */}
          <div>
            <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Cashback
            </span>
            <div
              className={`text-sm sm:text-base font-bold font-mono tracking-tight mt-0.5 ${
                totalKeKoperasi > 0 ? 'text-amber-800 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {formatIDR(totalKeKoperasi)}
            </div>
          </div>

          {/* Margin Pill */}
          <div className="flex flex-col items-end justify-center">
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              Margin
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                isRugi
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  : margin > 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {margin.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {isRugi && (
        <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>Harga beli lebih besar dari pendapatan / cashback</span>
        </div>
      )}
    </div>
  );
};

