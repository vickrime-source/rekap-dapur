import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatIDR } from './MoneyInput';

export interface ProfitPreviewProps {
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  cashback?: number;
}

export const ProfitPreview: React.FC<ProfitPreviewProps> = ({
  quantity,
  purchasePrice,
  sellingPrice,
  cashback,
}) => {
  const qty = Math.max(0, quantity || 0);
  const hargaBeli = Math.max(0, purchasePrice || 0);
  const hargaJual = Math.max(0, sellingPrice || 0);
  const cb = cashback !== undefined && cashback !== null && Number(cashback) > 0 ? Number(cashback) : 0;

  // Logika hitungan per item:
  // Kalau cashback KOSONG / 0: laba_bersih_item = harga_jual - harga_beli, ke_koperasi_item = 0
  // Kalau cashback DIISI: laba_bersih_item = cashback - harga_beli, ke_koperasi_item = harga_jual - cashback
  const labaBersihPerItem = cb > 0 ? (cb - hargaBeli) : (hargaJual - hargaBeli);
  const keKoperasiPerItem = cb > 0 ? (hargaJual - cb) : 0;

  const totalLabaBersih = labaBersihPerItem * qty;
  const totalKeKoperasi = keKoperasiPerItem * qty;
  const totalJual = qty * hargaJual;

  const margin =
    totalJual > 0 ? Math.round((totalLabaBersih / totalJual) * 10000) / 100 : 0;

  const isRugi = totalLabaBersih < 0 && hargaBeli > 0;
  const isPositif = totalLabaBersih > 0;

  return (
    <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-2">
      {/* Clean & Modern Summary Card */}
      <div className="p-3 sm:p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 rounded-xl space-y-2">
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

          {/* Ke Koperasi */}
          <div>
            <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Ke Koperasi
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

