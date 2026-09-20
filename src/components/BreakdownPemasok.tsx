import React from 'react';
import { Truck, Package, Store } from 'lucide-react';
import { formatRupiah, getTokoBadgeStyle } from '../lib/formatters';

export interface PemasokBreakdownItem {
  pemasok: string;
  totalBeli: number;
  transactionCount: number;
  orderCount: number;
  totalQty: number;
  rawQty?: number;
  returQty?: number;
  ditagihkanQty?: number;
  topItemName: string;
  topItemQty: number;
  topItemUnit?: string;
  tokoList?: string[];
  percentageOfTotalBeli?: number;
}

export interface BreakdownPemasokProps {
  items: PemasokBreakdownItem[];
  selectedPemasokFilter?: string;
  onFilterPemasok?: (pemasok: string) => void;
  className?: string;
}

export const BreakdownPemasok: React.FC<BreakdownPemasokProps> = ({
  items,
  selectedPemasokFilter,
  onFilterPemasok,
  className = '',
}) => {
  if (items.length === 0) {
    return (
      <div className={`py-8 text-center text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 ${className}`}>
        Tidak ada data transaksi pemasok pada periode ini.
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 shadow-2xs transition-colors duration-200">
        {/* Table Header on Desktop */}
        <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
          <div className="col-span-4">Nama Pemasok</div>
          <div className="col-span-2 text-center">Jumlah Transaksi</div>
          <div className="col-span-3 text-right">Total Nilai Pembelian</div>
          <div className="col-span-3 text-left pl-2">Barang Terbanyak</div>
        </div>

        {/* Pemasok Breakdown Rows */}
        {items.map((item) => {
          const isSelected = selectedPemasokFilter === item.pemasok;
          const topItemDisplay = item.topItemName
            ? `${item.topItemName} (${item.topItemQty.toLocaleString('id-ID')}${item.topItemUnit ? ` ${item.topItemUnit}` : ''})`
            : '-';

          return (
            <div
              key={item.pemasok}
              onClick={() => onFilterPemasok && onFilterPemasok(isSelected ? 'all' : item.pemasok)}
              className={`p-3 transition-colors min-h-[52px] ${
                onFilterPemasok ? 'cursor-pointer' : ''
              } ${
                isSelected
                  ? 'bg-indigo-50/80 dark:bg-indigo-950/60 ring-1 ring-inset ring-indigo-500'
                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/60 active:bg-slate-100 dark:active:bg-slate-800'
              }`}
            >
              {/* Desktop Layout (Grid) */}
              <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
                {/* Pemasok Name & Partner Stores */}
                <div className="col-span-4 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <Truck className="w-3 h-3 text-emerald-700 dark:text-emerald-400 shrink-0" />
                      <span className="truncate max-w-[200px]">{item.pemasok}</span>
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/80 px-1.5 py-0.5 rounded">
                        Aktif
                      </span>
                    )}
                  </div>

                  {item.tokoList && item.tokoList.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Toko:</span>
                      {item.tokoList.map((toko) => (
                        <span
                          key={toko}
                          className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${getTokoBadgeStyle(toko)}`}
                        >
                          {toko}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Transaksi & Total Qty */}
                <div className="col-span-2 text-center">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block leading-tight">
                    {item.transactionCount} Transaksi
                  </span>
                  {item.returQty && item.returQty > 0 ? (
                    <span className="text-[9.5px] font-semibold text-slate-600 dark:text-slate-300 block mt-0.5 whitespace-nowrap">
                      <span className="line-through text-slate-400">{item.rawQty ?? item.totalQty} Qty</span> → Retur <span className="text-rose-600 dark:text-rose-400 font-bold">{item.returQty}</span> → Ditagihkan <span className="font-bold text-slate-900 dark:text-slate-100">{item.ditagihkanQty ?? ((item.rawQty ?? item.totalQty) - item.returQty)}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 block mt-0.5">
                      ({item.totalQty.toLocaleString('id-ID')} Qty total)
                    </span>
                  )}
                </div>

                {/* Total Nilai Pembelian (PO) */}
                <div className="col-span-3 text-right">
                  <span className="text-xs sm:text-sm font-bold font-nominal text-rose-700 dark:text-rose-400 block leading-tight truncate">
                    {formatRupiah(item.totalBeli)}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                    {typeof item.percentageOfTotalBeli === 'number'
                      ? `${Math.round(item.percentageOfTotalBeli)}% total PO`
                      : ''}
                  </span>
                </div>

                {/* Barang Terbanyak */}
                <div className="col-span-3 text-left pl-2 min-w-0">
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-lg text-amber-900 dark:text-amber-200 text-xs font-semibold max-w-full">
                    <Package className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="truncate" title={topItemDisplay}>
                      {topItemDisplay}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mobile Layout */}
              <div className="sm:hidden space-y-2">
                {/* Header: Nama Pemasok + Jumlah Transaksi */}
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 min-w-0">
                    <Truck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">{item.pemasok}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 shrink-0">
                    {item.transactionCount} Trx
                  </span>
                </div>

                {/* Row 2: Nilai Pembelian + Total Qty */}
                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="bg-rose-50/60 dark:bg-rose-950/40 p-2 rounded-lg">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                      Total Pembelian
                    </span>
                    <span className="text-xs font-bold font-nominal text-rose-700 dark:text-rose-300 block truncate mt-0.5">
                      {formatRupiah(item.totalBeli)}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Total Qty Barang
                    </span>
                    {item.returQty && item.returQty > 0 ? (
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 block mt-0.5">
                        <span className="line-through text-slate-400">{item.rawQty ?? item.totalQty}</span> → Retur <span className="text-rose-600 dark:text-rose-400 font-bold">{item.returQty}</span> → Ditagihkan <span className="font-bold text-slate-900 dark:text-slate-100">{item.ditagihkanQty ?? ((item.rawQty ?? item.totalQty) - item.returQty)}</span>
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate mt-0.5">
                        {item.totalQty.toLocaleString('id-ID')} unit
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 3: Barang Terbanyak */}
                <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/60 p-2 rounded-lg flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[9.5px] font-bold text-amber-800 dark:text-amber-300 uppercase block tracking-wider">
                      Barang Terbanyak:
                    </span>
                    <span className="text-xs font-bold text-amber-950 dark:text-amber-100 truncate block">
                      {topItemDisplay}
                    </span>
                  </div>
                </div>

                {/* Toko List Tags */}
                {item.tokoList && item.tokoList.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    <Store className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Untuk Toko:</span>
                    {item.tokoList.map((toko) => (
                      <span
                        key={toko}
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getTokoBadgeStyle(toko)}`}
                      >
                        {toko}
                      </span>
                    ))}
                  </div>
                )}

                {/* Progress bar % belanja PO */}
                {typeof item.percentageOfTotalBeli === 'number' && (
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-600 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(3, item.percentageOfTotalBeli))}%` }}
                      title={`Porsi Pembelian: ${Math.round(item.percentageOfTotalBeli)}%`}
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
