import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
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
    <div className="pt-2.5 border-t border-slate-200/80 space-y-2">
      {/* Single Breakdown Banner: Laba Bersih: Rp x | Ke Koperasi: Rp y */}
      <div className="p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="font-semibold text-slate-600">Laba Bersih:</span>
          <span
            className={`font-black font-mono ${
              isRugi
                ? 'text-rose-600'
                : isPositif
                ? 'text-emerald-700'
                : 'text-slate-700'
            }`}
          >
            {isPositif ? `+Rp ${formatIDR(totalLabaBersih)}` : isRugi ? `-Rp ${formatIDR(Math.abs(totalLabaBersih))}` : `Rp ${formatIDR(totalLabaBersih)}`}
          </span>

          <span className="text-slate-300 font-bold px-1">|</span>

          <span className="font-semibold text-slate-600">Ke Koperasi:</span>
          <span
            className={`font-black font-mono ${
              totalKeKoperasi > 0 ? 'text-amber-700' : 'text-slate-500'
            }`}
          >
            {totalKeKoperasi > 0 ? `+Rp ${formatIDR(totalKeKoperasi)}` : 'Rp 0'}
          </span>
        </div>

        {/* Margin Pill */}
        <div className="flex items-center gap-1 text-[11px]">
          <span className="text-slate-400 font-medium">Margin:</span>
          <span
            className={`font-black px-1.5 py-0.5 rounded text-[10px] ${
              isRugi
                ? 'bg-rose-100 text-rose-800'
                : margin > 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {margin.toFixed(1)}%
          </span>
        </div>
      </div>

      {cb > 0 && (
        <div className="text-[10px] text-slate-400 font-medium px-1 flex flex-wrap items-center justify-between gap-1">
          <span>Laba: (Rp {formatIDR(cb)} - Rp {formatIDR(hargaBeli)}) × {qty}</span>
          <span>Koperasi: (Rp {formatIDR(hargaJual)} - Rp {formatIDR(cb)}) × {qty}</span>
        </div>
      )}

      {isRugi && (
        <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1.5 text-rose-700 text-[11px] font-bold">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>Harga beli lebih besar dari pendapatan/cashback!</span>
        </div>
      )}
    </div>
  );
};
