import React, { useState, useMemo } from 'react';
import { 
  PeriodSummaryStats, 
  OrderItem 
} from '../types';
import { 
  formatRupiah, 
  WeekRange, 
  getTodayWIB, 
  parseIndonesianNumber 
} from '../lib/formatters';
import { ReportPeriodPicker, CustomDateRange } from './ReportPeriodPicker';
import { BreakdownTabs, BreakdownTabType } from './BreakdownTabs';
import { BreakdownToko, TokoBreakdownItem } from './BreakdownToko';
import { BreakdownPemasok, PemasokBreakdownItem } from './BreakdownPemasok';
import { BreakdownDapur, DapurBreakdownItem } from './BreakdownDapur';

interface WeeklyReportCardProps {
  stats: PeriodSummaryStats;
  weekRange: WeekRange;
  onFilterStore?: (toko: string) => void;
  selectedStoreFilter?: string;
  onFilterPemasok?: (pemasok: string) => void;
  selectedPemasokFilter?: string;
  onFilterDapur?: (dapur: string) => void;
  selectedDapurFilter?: string;
  period?: 'hari_ini' | 'mingguan' | 'bulan_ini' | 'all_time';
  selectedDate?: string;
  selectedMonth?: string;
  customRange?: CustomDateRange | null;
  onSelectMonth?: (month: string) => void;
  onSelectCustomRange?: (range: CustomDateRange) => void;
  onClearCustomRange?: () => void;
  periodOrders?: OrderItem[];
}

export const WeeklyReportCard: React.FC<WeeklyReportCardProps> = ({
  stats,
  weekRange,
  onFilterStore,
  selectedStoreFilter,
  onFilterPemasok,
  selectedPemasokFilter,
  onFilterDapur,
  selectedDapurFilter,
  period = 'mingguan',
  selectedDate,
  selectedMonth,
  customRange,
  onSelectMonth,
  onSelectCustomRange,
  onClearCustomRange,
  periodOrders,
}) => {
  // Tab Breakdown aktif (Default: 'toko')
  const [activeBreakdownTab, setActiveBreakdownTab] = useState<BreakdownTabType>('toko');

  const marginPercent = stats.totalPendapatan > 0
    ? Math.round((stats.profitBersih / stats.totalPendapatan) * 100)
    : 0;

  let title = 'Laporan Mingguan';
  let subtitle = 'Closing Bisnis Mingguan (Senin – Minggu)';

  if (customRange) {
    title = 'Laporan Kustom';
    subtitle = 'Rekap Transaksi Rentang Tanggal Terpilih';
  } else if (period === 'hari_ini') {
    title = 'Rekap Harian';
    subtitle = 'Transaksi & Pengeluaran Khusus Hari Ini';
  } else if (period === 'bulan_ini') {
    title = 'Laporan Bulanan';
    subtitle = 'Closing Bisnis Bulanan';
  } else if (period === 'all_time') {
    title = 'Rekap Seluruh Waktu';
    subtitle = 'Akumulasi Semua Data Transaksi';
  }

  const effectiveMonth = selectedMonth || (selectedDate ? selectedDate.slice(0, 7) : getTodayWIB().slice(0, 7));

  // 1. Data Breakdown Toko (Omset, Modal PO, Profit Bersih, Margin %)
  const tokoItems = useMemo<TokoBreakdownItem[]>(() => {
    if (periodOrders && periodOrders.length > 0) {
      let totalAllBeli = 0;
      let totalAllJual = 0;
      const map: Record<string, {
        totalQty: number;
        totalBeli: number;
        totalJual: number;
        totalLabaBersih: number;
        totalKeKoperasi: number;
        orderCount: number;
        batchKeys: Set<string>;
        pemasokSet: Set<string>;
      }> = {};

      for (const item of periodOrders) {
        const qty = parseIndonesianNumber(item.qty) || 0;
        const beli = parseIndonesianNumber(item.hargaBeli) || 0;
        const jual = parseIndonesianNumber(item.hargaJual) || 0;
        const cb = parseIndonesianNumber(item.cashback) || 0;
        const itemBeli = qty * beli;
        const itemJual = qty * jual;
        const labaBersihItem = cb > 0 ? (cb - beli) * qty : (jual - beli) * qty;
        const keKoperasiItem = cb > 0 ? (jual - cb) * qty : 0;

        totalAllBeli += itemBeli;
        totalAllJual += itemJual;

        const tokoKey = (item.toko || 'Lainnya').trim() || 'Lainnya';
        if (!map[tokoKey]) {
          map[tokoKey] = {
            totalQty: 0,
            totalBeli: 0,
            totalJual: 0,
            totalLabaBersih: 0,
            totalKeKoperasi: 0,
            orderCount: 0,
            batchKeys: new Set<string>(),
            pemasokSet: new Set<string>(),
          };
        }
        map[tokoKey].totalQty += qty;
        map[tokoKey].totalBeli += itemBeli;
        map[tokoKey].totalJual += itemJual;
        map[tokoKey].totalLabaBersih += labaBersihItem;
        map[tokoKey].totalKeKoperasi += keKoperasiItem;
        map[tokoKey].orderCount += 1;
        if (item.pemasok && item.pemasok.trim() && item.pemasok.trim() !== '-') {
          map[tokoKey].pemasokSet.add(item.pemasok.trim());
        }
        const bKey = `${item.tanggal || item.createdAt || ''}_${item.tujuanDapur || ''}_${tokoKey}`;
        map[tokoKey].batchKeys.add(bKey);
      }

      return Object.entries(map).map(([toko, val]) => {
        const profit = val.totalLabaBersih;
        const mPercent = val.totalJual > 0 ? Math.round((profit / val.totalJual) * 100) : 0;
        return {
          toko,
          totalJual: val.totalJual,
          totalBeli: val.totalBeli,
          profit,
          marginPercent: mPercent,
          totalQty: val.totalQty,
          transactionCount: val.batchKeys.size || val.orderCount,
          orderCount: val.orderCount,
          pemasokList: Array.from(val.pemasokSet),
          percentageOfTotalBeli: totalAllBeli > 0 ? (val.totalBeli / totalAllBeli) * 100 : 0,
          percentageOfTotalJual: totalAllJual > 0 ? (val.totalJual / totalAllJual) * 100 : 0,
        };
      }).sort((a, b) => b.totalJual - a.totalJual);
    }

    // Fallback dari stats.storeBreakdowns jika data periodOrders kosong
    return (stats.storeBreakdowns || []).map((store) => ({
      toko: store.toko,
      totalJual: store.totalJual,
      totalBeli: store.totalBeli,
      profit: store.profit,
      marginPercent: store.marginPercent ?? (store.totalJual > 0 ? Math.round((store.profit / store.totalJual) * 100) : 0),
      totalQty: store.totalQty,
      transactionCount: store.transactionCount ?? store.orderCount ?? 0,
      orderCount: store.orderCount,
      pemasokList: store.pemasokList,
      percentageOfTotalBeli: store.percentageOfTotalBeli,
      percentageOfTotalJual: store.percentageOfTotalJual,
    }));
  }, [periodOrders, stats.storeBreakdowns]);

  // 2. Data Breakdown Pemasok (Nilai Pembelian, Jumlah Trx, Barang Terbanyak)
  const pemasokItems = useMemo<PemasokBreakdownItem[]>(() => {
    if (!periodOrders || periodOrders.length === 0) return [];

    let totalAllBeli = 0;
    const map: Record<string, {
      totalQty: number;
      totalBeli: number;
      orderCount: number;
      batchKeys: Set<string>;
      itemQtyMap: Record<string, { qty: number; unit?: string }>;
      tokoSet: Set<string>;
    }> = {};

    for (const item of periodOrders) {
      const qty = parseIndonesianNumber(item.qty) || 0;
      const beli = parseIndonesianNumber(item.hargaBeli) || 0;
      const itemBeli = qty * beli;
      totalAllBeli += itemBeli;

      let pKey = (item.pemasok || '').trim();
      if (!pKey || pKey === '-') {
        pKey = 'Tanpa Pemasok';
      }

      if (!map[pKey]) {
        map[pKey] = {
          totalQty: 0,
          totalBeli: 0,
          orderCount: 0,
          batchKeys: new Set<string>(),
          itemQtyMap: {},
          tokoSet: new Set<string>(),
        };
      }

      map[pKey].totalQty += qty;
      map[pKey].totalBeli += itemBeli;
      map[pKey].orderCount += 1;

      const bKey = `${item.tanggal || item.createdAt || ''}_${item.tujuanDapur || ''}_${pKey}`;
      map[pKey].batchKeys.add(bKey);

      if (item.toko && item.toko.trim()) {
        map[pKey].tokoSet.add(item.toko.trim());
      }

      const itemName = (item.namaBarang || '').trim() || 'Barang Lainnya';
      if (!map[pKey].itemQtyMap[itemName]) {
        map[pKey].itemQtyMap[itemName] = { qty: 0, unit: item.satuan };
      }
      map[pKey].itemQtyMap[itemName].qty += qty;
    }

    return Object.entries(map).map(([pemasok, val]) => {
      let topItemName = '-';
      let topItemQty = 0;
      let topItemUnit: string | undefined = undefined;

      for (const [name, data] of Object.entries(val.itemQtyMap)) {
        if (data.qty > topItemQty) {
          topItemQty = data.qty;
          topItemName = name;
          topItemUnit = data.unit;
        }
      }

      return {
        pemasok,
        totalBeli: val.totalBeli,
        transactionCount: val.batchKeys.size || val.orderCount,
        orderCount: val.orderCount,
        totalQty: val.totalQty,
        topItemName,
        topItemQty,
        topItemUnit,
        tokoList: Array.from(val.tokoSet),
        percentageOfTotalBeli: totalAllBeli > 0 ? (val.totalBeli / totalAllBeli) * 100 : 0,
      };
    }).sort((a, b) => b.totalBeli - a.totalBeli);
  }, [periodOrders]);

  // 3. Data Breakdown Dapur (Total Pesanan, Tagihan Dapur, Omset, Modal, Profit)
  const dapurItems = useMemo<DapurBreakdownItem[]>(() => {
    if (!periodOrders || periodOrders.length === 0) return [];

    let totalAllTagihan = 0;
    const map: Record<string, {
      totalQty: number;
      totalBeli: number;
      totalJual: number;
      orderCount: number;
      batchKeys: Set<string>;
    }> = {};

    for (const item of periodOrders) {
      const qty = parseIndonesianNumber(item.qty) || 0;
      const beli = parseIndonesianNumber(item.hargaBeli) || 0;
      const jual = parseIndonesianNumber(item.hargaJual) || 0;
      const itemBeli = qty * beli;
      const itemJual = qty * jual;

      totalAllTagihan += itemJual;

      const dapurKey = (item.tujuanDapur || 'Lainnya').trim() || 'Lainnya';
      if (!map[dapurKey]) {
        map[dapurKey] = {
          totalQty: 0,
          totalBeli: 0,
          totalJual: 0,
          orderCount: 0,
          batchKeys: new Set<string>(),
        };
      }

      map[dapurKey].totalQty += qty;
      map[dapurKey].totalBeli += itemBeli;
      map[dapurKey].totalJual += itemJual;
      map[dapurKey].orderCount += 1;

      const bKey = `${item.tanggal || item.createdAt || ''}_${dapurKey}_${item.toko || ''}`;
      map[dapurKey].batchKeys.add(bKey);
    }

    return Object.entries(map).map(([dapur, val]) => {
      const profit = val.totalJual - val.totalBeli;
      const mPercent = val.totalJual > 0 ? Math.round((profit / val.totalJual) * 100) : 0;

      return {
        dapur,
        orderCount: val.orderCount,
        transactionCount: val.batchKeys.size || val.orderCount,
        totalTagihan: val.totalJual,
        totalJual: val.totalJual,
        totalBeli: val.totalBeli,
        profit,
        marginPercent: mPercent,
        totalQty: val.totalQty,
        percentageOfTotalTagihan: totalAllTagihan > 0 ? (val.totalJual / totalAllTagihan) * 100 : 0,
      };
    }).sort((a, b) => b.totalTagihan - a.totalTagihan);
  }, [periodOrders]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 space-y-4 font-sans shadow-2xs">
      {/* Header with Title & Period Selector Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            {title}
          </h2>
          <span className="text-[11px] font-semibold text-slate-500">
            {subtitle}
          </span>
        </div>

        {/* Dropdown Bulan & Custom Date Range */}
        <ReportPeriodPicker
          period={period}
          selectedMonth={effectiveMonth}
          customRange={customRange || null}
          onSelectMonth={onSelectMonth || (() => {})}
          onSelectCustomRange={onSelectCustomRange || (() => {})}
          onClearCustomRange={onClearCustomRange}
          weekRangeLabel={weekRange.label}
        />
      </div>

      {/* 4 Financial Metric Cards (Flat, Clean, High Legibility) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 tablet-landscape-grid-4 gap-2.5">
        {/* Metric 1: Total Pesanan Masuk */}
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

      {/* Breakdown Section with Tabs (Toko, Pemasok, Dapur) */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div>
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Breakdown Toko, Pemasok & Dapur
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              {activeBreakdownTab === 'toko' && 'Perbandingan Omset (H.Jual), Modal (H.Beli), Profit & Margin per Toko'}
              {activeBreakdownTab === 'pemasok' && 'Total Nilai Pembelian, Jumlah Transaksi, dan Barang Terbanyak per Pemasok'}
              {activeBreakdownTab === 'dapur' && 'Total Pesanan, Total Tagihan Dapur, Modal Bahan & Profit per Dapur'}
            </span>
          </div>

          {/* Reset Filter Button for active category */}
          {activeBreakdownTab === 'toko' && selectedStoreFilter && selectedStoreFilter !== 'all' && (
            <button
              type="button"
              onClick={() => onFilterStore && onFilterStore('all')}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 self-start sm:self-auto cursor-pointer"
            >
              Reset Filter Toko ({selectedStoreFilter})
            </button>
          )}
          {activeBreakdownTab === 'pemasok' && selectedPemasokFilter && selectedPemasokFilter !== 'all' && (
            <button
              type="button"
              onClick={() => onFilterPemasok && onFilterPemasok('all')}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 self-start sm:self-auto cursor-pointer"
            >
              Reset Filter Pemasok ({selectedPemasokFilter})
            </button>
          )}
          {activeBreakdownTab === 'dapur' && selectedDapurFilter && selectedDapurFilter !== 'all' && (
            <button
              type="button"
              onClick={() => onFilterDapur && onFilterDapur('all')}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 self-start sm:self-auto cursor-pointer"
            >
              Reset Filter Dapur ({selectedDapurFilter})
            </button>
          )}
        </div>

        {/* Tab Navigation: [ Breakdown Toko ] [ Breakdown Pemasok ] [ Breakdown Dapur ] */}
        <BreakdownTabs
          activeTab={activeBreakdownTab}
          onChangeTab={(tab) => setActiveBreakdownTab(tab)}
          counts={{
            toko: tokoItems.length,
            pemasok: pemasokItems.length,
            dapur: dapurItems.length,
          }}
        />

        {/* Tab 1: Breakdown Toko */}
        {activeBreakdownTab === 'toko' && (
          <BreakdownToko
            items={tokoItems}
            selectedStoreFilter={selectedStoreFilter}
            onFilterStore={onFilterStore}
          />
        )}

        {/* Tab 2: Breakdown Pemasok */}
        {activeBreakdownTab === 'pemasok' && (
          <BreakdownPemasok
            items={pemasokItems}
            selectedPemasokFilter={selectedPemasokFilter}
            onFilterPemasok={onFilterPemasok}
          />
        )}

        {/* Tab 3: Breakdown Dapur */}
        {activeBreakdownTab === 'dapur' && (
          <BreakdownDapur
            items={dapurItems}
            selectedDapurFilter={selectedDapurFilter}
            onFilterDapur={onFilterDapur}
          />
        )}
      </div>
    </div>
  );
};
