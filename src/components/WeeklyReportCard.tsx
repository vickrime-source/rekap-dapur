import React from 'react';
import { 
  StoreExpenseBreakdown, 
  PeriodSummaryStats 
} from '../types';
import { 
  formatRupiah, 
  getTokoBadgeStyle, 
  WeekRange, 
  formatTanggalSimple, 
  getTodayWIB, 
  parseDateSafe 
} from '../lib/formatters';

interface WeeklyReportCardProps {
  stats: PeriodSummaryStats;
  weekRange: WeekRange;
  onFilterStore?: (toko: string) => void;
  selectedStoreFilter?: string;
  period?: 'hari_ini' | 'mingguan' | 'bulan_ini' | 'all_time';
  selectedDate?: string;
}

export const WeeklyReportCard: React.FC<WeeklyReportCardProps> = ({
  stats,
  weekRange,
  onFilterStore,
  selectedStoreFilter,
  period = 'mingguan',
  selectedDate,
}) => {
  const marginPercent = stats.totalPendapatan > 0
    ? Math.round((stats.profitBersih / stats.totalPendapatan) * 100)
    : 0;

  let title = 'Laporan Mingguan';
  let subtitle = 'Closing Bisnis Mingguan (Senin – Minggu)';
  let dateBadge = weekRange.label;

  if (period === 'hari_ini') {
    title = 'Rekap Harian';
    subtitle = 'Transaksi & Pengeluaran Khusus Hari Ini';
    const targetDate = getTodayWIB();
    dateBadge = formatTanggalSimple(targetDate) || 'Hari Ini';
  } else if (period === 'bulan_ini') {
    title = 'Laporan Bulanan';
    subtitle = 'Closing Bisnis Bulan Ini';
    const targetDate = selectedDate || getTodayWIB();
    const d = parseDateSafe(targetDate) || new Date();
    dateBadge = d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
  } else if (period === 'all_time') {
    title = 'Rekap Seluruh Waktu';
    subtitle = 'Akumulasi Semua Data Transaksi';
    dateBadge = 'Semua Waktu';
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 space-y-4 font-sans shadow-2xs">
      {/* Header with Title & Date Range */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2.5 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            {title}
          </h2>
          <span className="text-[11px] font-semibold text-slate-500">
            {subtitle}
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 self-start sm:self-auto px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700">
          <span>{dateBadge}</span>
        </div>
      </div>

      {/* 4 Financial Metric Cards (Flat, Clean, High Legibility) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Metric 1: Total Pesanan Masuk (Transaksi di atas, Qty di bawah) */}
        <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between min-h-[82px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Pesanan Masuk
          </span>
          <div className="mt-1">
            <span className="text-base sm:text-lg font-bold font-nominal text-slate-900 block leading-tight">
              {stats.totalTransactions.toLocaleString('id-ID')}
              <span className="text-xs font-semibold text-slate-500 ml-1">Transaksi</span>
            </span>
            <span className="text-[11px] font-medium text-slate-500 block mt-0.5">
              {stats.totalQty.toLocaleString('id-ID')} Total Qty
            </span>
          </div>
        </div>

        {/* Metric 2: Total Pendapatan (H.JUAL) */}
        <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between min-h-[82px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Pendapatan (H.Jual)
          </span>
          <div className="mt-1">
            <span className="text-base sm:text-lg font-bold font-nominal text-slate-900 block leading-tight truncate">
              {formatRupiah(stats.totalPendapatan)}
            </span>
            <span className="text-[11px] font-medium text-slate-500 block mt-0.5">
              Total tagihan dapur
            </span>
          </div>
        </div>

        {/* Metric 3: Total Pengeluaran (H.BELI) */}
        <div className="bg-rose-50/60 border border-rose-200/80 rounded-xl p-3 flex flex-col justify-between min-h-[82px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
            Pengeluaran PO (H.Beli)
          </span>
          <div className="mt-1">
            <span className="text-base sm:text-lg font-bold font-nominal text-rose-700 block leading-tight truncate">
              {formatRupiah(stats.totalPengeluaran)}
            </span>
            <span className="text-[11px] font-medium text-rose-600/80 block mt-0.5">
              Uang keluar ke supplier
            </span>
          </div>
        </div>

        {/* Metric 4: Profit Bersih */}
        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 flex flex-col justify-between min-h-[82px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            Profit Bersih
          </span>
          <div className="mt-1">
            <span className={`text-base sm:text-lg font-bold font-nominal block leading-tight truncate ${
              stats.profitBersih < 0 ? 'text-rose-700' : 'text-emerald-900'
            }`}>
              {formatRupiah(stats.profitBersih)}
            </span>
            <span className="text-[11px] font-semibold text-emerald-700 block mt-0.5">
              Margin {marginPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Breakdown per Toko & Pemasok (Fokus Laba, Omset, Pengeluaran & Trx sbg Pembanding) */}
      <div className="space-y-2 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Breakdown Toko & Pemasok
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              Perbandingan Omset, Pengeluaran (H.Beli), dan Laba per Toko
            </span>
          </div>
          {selectedStoreFilter && selectedStoreFilter !== 'all' && (
            <button
              type="button"
              onClick={() => onFilterStore && onFilterStore('all')}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 self-start sm:self-auto cursor-pointer"
            >
              Reset Filter Toko
            </button>
          )}
        </div>

        {stats.storeBreakdowns.length === 0 ? (
          <div className="py-6 text-center text-xs font-medium text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            Tidak ada transaksi pesanan pada periode ini.
          </div>
        ) : (
          <div className="border border-slate-200/90 rounded-xl overflow-hidden bg-white divide-y divide-slate-100">
            {/* Table Header on Desktop */}
            <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
              <div className="col-span-4">Toko & Pemasok</div>
              <div className="col-span-2 text-center">Trx & Qty</div>
              <div className="col-span-2 text-right">Omset (H.Jual)</div>
              <div className="col-span-2 text-right">Pengeluaran (H.Beli)</div>
              <div className="col-span-2 text-right">Laba Bersih</div>
            </div>

            {/* Store Breakdown Rows */}
            {stats.storeBreakdowns.map((store) => {
              const isSelected = selectedStoreFilter === store.toko;
              const trxCount = store.transactionCount ?? store.orderCount;
              const pemasokStr = store.pemasokList && store.pemasokList.length > 0 
                ? store.pemasokList.join(', ') 
                : null;

              return (
                <div
                  key={store.toko}
                  onClick={() => onFilterStore && onFilterStore(isSelected ? 'all' : store.toko)}
                  className={`p-3 transition-colors cursor-pointer min-h-[50px] ${
                    isSelected 
                      ? 'bg-indigo-50/80 ring-1 ring-inset ring-indigo-500' 
                      : 'hover:bg-slate-50/80 active:bg-slate-100'
                  }`}
                >
                  {/* Desktop Layout (Grid) */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
                    {/* Toko & Pemasok */}
                    <div className="col-span-4 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold border ${getTokoBadgeStyle(store.toko)}`}>
                          {store.toko}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                            Aktif
                          </span>
                        )}
                      </div>
                      {pemasokStr && (
                        <span className="text-[11px] text-slate-500 block truncate mt-0.5" title={pemasokStr}>
                          Pemasok: <strong className="font-medium text-slate-700">{pemasokStr}</strong>
                        </span>
                      )}
                    </div>

                    {/* Trx & Qty (Fokus ke Trx, bukan ke Qty) */}
                    <div className="col-span-2 text-center">
                      <span className="text-xs font-bold text-slate-900 block leading-tight">
                        {trxCount} Trx
                      </span>
                      <span className="text-[10px] font-medium text-slate-400 block mt-0.5">
                        ({store.totalQty.toLocaleString('id-ID')} Qty)
                      </span>
                    </div>

                    {/* Omset (H.Jual) */}
                    <div className="col-span-2 text-right">
                      <span className="text-xs sm:text-sm font-bold font-nominal text-slate-900 block leading-tight truncate">
                        {formatRupiah(store.totalJual)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {store.percentageOfTotalJual ? `${Math.round(store.percentageOfTotalJual)}% omset` : ''}
                      </span>
                    </div>

                    {/* Pengeluaran (H.Beli) */}
                    <div className="col-span-2 text-right">
                      <span className="text-xs sm:text-sm font-bold font-nominal text-rose-700 block leading-tight truncate">
                        {formatRupiah(store.totalBeli)}
                      </span>
                      <span className="text-[10px] text-rose-500/80 block">
                        {store.percentageOfTotalBeli ? `${Math.round(store.percentageOfTotalBeli)}% PO` : ''}
                      </span>
                    </div>

                    {/* Laba Bersih & Margin */}
                    <div className="col-span-2 text-right">
                      <span className={`text-xs sm:text-sm font-bold font-nominal block leading-tight truncate ${
                        store.profit < 0 ? 'text-rose-700' : 'text-emerald-800'
                      }`}>
                        {store.profit >= 0 ? `+${formatRupiah(store.profit)}` : formatRupiah(store.profit)}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-700 block mt-0.5">
                        Margin {store.marginPercent ?? 0}%
                      </span>
                    </div>
                  </div>

                  {/* Mobile Layout (Stacked & 3-Col Metric Comparison) */}
                  <div className="sm:hidden space-y-2">
                    {/* Row 1: Toko Badge + Trx (Qty) + Pemasok */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold border ${getTokoBadgeStyle(store.toko)}`}>
                          {store.toko}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {trxCount} Trx
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          ({store.totalQty.toLocaleString('id-ID')} Qty)
                        </span>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded shrink-0">
                          Aktif
                        </span>
                      )}
                    </div>

                    {pemasokStr && (
                      <span className="text-[10px] text-slate-500 block truncate" title={pemasokStr}>
                        Pemasok: <strong className="font-medium text-slate-700">{pemasokStr}</strong>
                      </span>
                    )}

                    {/* Row 2: 3-Col Financial Comparison (Omset, Pengeluaran, Laba) */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-100">
                      <div className="bg-slate-50 p-1.5 rounded-lg text-center">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                          Omset
                        </span>
                        <span className="text-xs font-bold font-nominal text-slate-900 block truncate mt-0.5">
                          {formatRupiah(store.totalJual)}
                        </span>
                      </div>
                      <div className="bg-rose-50/50 p-1.5 rounded-lg text-center">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-rose-500 block">
                          Pengeluaran
                        </span>
                        <span className="text-xs font-bold font-nominal text-rose-700 block truncate mt-0.5">
                          {formatRupiah(store.totalBeli)}
                        </span>
                      </div>
                      <div className="bg-emerald-50/50 p-1.5 rounded-lg text-center">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 block">
                          Laba ({store.marginPercent ?? 0}%)
                        </span>
                        <span className={`text-xs font-bold font-nominal block truncate mt-0.5 ${
                          store.profit < 0 ? 'text-rose-700' : 'text-emerald-800'
                        }`}>
                          {store.profit >= 0 ? `+${formatRupiah(store.profit)}` : formatRupiah(store.profit)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Comparative Progress Bar */}
                  <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex">
                    <div
                      className="bg-indigo-600 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(2, store.percentageOfTotalBeli))}%` }}
                      title={`Porsi Pengeluaran: ${Math.round(store.percentageOfTotalBeli)}%`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
