import React from 'react';
import { formatRupiah } from '../../lib/formatters';
import { SummaryTotals } from './types';

interface TransactionsSummaryBarProps {
  totalCount: number;
  summaryTotals: SummaryTotals;
}

export const TransactionsSummaryBar: React.FC<TransactionsSummaryBarProps> = ({
  totalCount,
  summaryTotals,
}) => {
  return (
    <div className="bg-slate-50 border-t border-slate-200 px-3 sm:px-4 py-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
            Rekap Total ({totalCount} Transaksi Terfilter)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-nominal">
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Modal:</span>
            <span className="font-black text-rose-700">{formatRupiah(summaryTotals.totalBeli)}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Omset:</span>
            <span className="font-black text-emerald-800">{formatRupiah(summaryTotals.totalJual)}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 shadow-2xs">
            <span className="text-[10px] font-bold text-amber-800 uppercase">Total Ke Koperasi:</span>
            <span className="font-black text-amber-900">+{formatRupiah(summaryTotals.totalKeKoperasi)}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-800 uppercase">Total Laba Bersih:</span>
            <span
              className={`font-black ${
                summaryTotals.totalLabaBersih >= 0 ? 'text-emerald-900' : 'text-rose-700'
              }`}
            >
              {summaryTotals.totalLabaBersih >= 0
                ? `+${formatRupiah(summaryTotals.totalLabaBersih)}`
                : `-${formatRupiah(Math.abs(summaryTotals.totalLabaBersih))}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
