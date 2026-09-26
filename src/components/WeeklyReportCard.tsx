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
import { 
  Wallet, 
  TrendingUp, 
  Tag, 
  CheckCircle2 
} from 'lucide-react';
import { AnimatedCounter } from './AnimatedCounter';

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

  if (customRange) {
    title = 'Laporan Kustom';
  } else if (period === 'hari_ini') {
    title = 'Rekap Harian';
  } else if (period === 'bulan_ini') {
    title = 'Laporan Bulanan';
  } else if (period === 'all_time') {
    title = 'Rekap Seluruh Waktu';
  }

  // Dynamic calculations for accounting metrics: Modal, Omset, Koperasi, Laba Bersih
  const { totalModal, totalOmset, totalKeKoperasi, totalLabaBersih } = useMemo(() => {
    if (periodOrders && periodOrders.length > 0) {
      let modal = 0;
      let omset = 0;
      let keKoperasi = 0;
      let labaBersih = 0;

      for (let i = 0; i < periodOrders.length; i++) {
        const item = periodOrders[i];
        if (item.status === 'CANCELLED') continue;

        const rawQtyJual = parseIndonesianNumber(item.qty) || 0;
        const rawQtyBeli = (item as any).qtyBeli !== undefined && (item as any).qtyBeli !== null
          ? parseIndonesianNumber((item as any).qtyBeli)
          : ((item as any).qty_beli !== undefined && (item as any).qty_beli !== null
            ? parseIndonesianNumber((item as any).qty_beli)
            : rawQtyJual);
        const returQty = Math.max(0, Number(item.retur) || 0);
        const qtyFinal = Math.max(0, rawQtyJual - returQty);
        const qtyBeliEfektif = Math.max(0, rawQtyBeli - returQty);
        const beli = parseIndonesianNumber(item.hargaBeli) || 0;
        const jual = parseIndonesianNumber(item.hargaJual) || 0;
        const cb = parseIndonesianNumber(item.cashback) || 0;

        const modalItem = qtyBeliEfektif * beli;
        const omzetItem = qtyFinal * jual;
        const labaItem = cb > 0 ? ((cb - beli) * qtyFinal) : (omzetItem - modalItem);
        const kopItem = cb > 0 ? ((jual - cb) * qtyFinal) : 0;

        modal += modalItem;
        omset += omzetItem;
        keKoperasi += kopItem;
        labaBersih += labaItem;
      }

      return {
        totalModal: modal,
        totalOmset: omset,
        totalKeKoperasi: keKoperasi,
        totalLabaBersih: labaBersih,
      };
    }

    return {
      totalModal: stats.totalPengeluaran || 0,
      totalOmset: stats.totalPendapatan || 0,
      totalKeKoperasi: stats.totalKeKoperasi || 0,
      totalLabaBersih: stats.totalLabaBersih !== undefined ? stats.totalLabaBersih : (stats.profitBersih || 0),
    };
  }, [periodOrders, stats]);

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
        if (item.status === 'CANCELLED') continue;

        const rawQtyJual = parseIndonesianNumber(item.qty) || 0;
        const rawQtyBeli = (item as any).qtyBeli !== undefined && (item as any).qtyBeli !== null
          ? parseIndonesianNumber((item as any).qtyBeli)
          : ((item as any).qty_beli !== undefined && (item as any).qty_beli !== null
            ? parseIndonesianNumber((item as any).qty_beli)
            : rawQtyJual);
        const returQty = Math.max(0, Number(item.retur) || 0);
        const qtyFinal = Math.max(0, rawQtyJual - returQty);
        const qtyBeliEfektif = Math.max(0, rawQtyBeli - returQty);
        const beli = parseIndonesianNumber(item.hargaBeli) || 0;
        const jual = parseIndonesianNumber(item.hargaJual) || 0;
        const cb = parseIndonesianNumber(item.cashback) || 0;
        // Retur ditanggung pemasok, tidak membebani modal toko:
        const itemBeli = rawQtyBeli * beli;
        const itemJual = qtyFinal * jual;
        const labaBersihItem = cb > 0 ? ((cb - beli) * qtyFinal) : (itemJual - (qtyBeliEfektif * beli));
        const keKoperasiItem = cb > 0 ? ((jual - cb) * qtyFinal) : 0;

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
        map[tokoKey].totalQty += qtyFinal;
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
      rawQty: number;
      returQty: number;
      ditagihkanQty: number;
      totalBeli: number;
      orderCount: number;
      batchKeys: Set<string>;
      itemQtyMap: Record<string, { qty: number; unit?: string }>;
      tokoSet: Set<string>;
    }> = {};

    for (const item of periodOrders) {
      if (item.status === 'CANCELLED') continue;
      const rawQtyJual = parseIndonesianNumber(item.qty) || 0;
      const rawQtyBeli = (item as any).qtyBeli !== undefined && (item as any).qtyBeli !== null
        ? parseIndonesianNumber((item as any).qtyBeli)
        : ((item as any).qty_beli !== undefined && (item as any).qty_beli !== null
          ? parseIndonesianNumber((item as any).qty_beli)
          : rawQtyJual);
      const returQty = Math.max(0, Number(item.retur) || 0);
      const qBeliEfektif = Math.max(0, rawQtyBeli - returQty);
      const beli = parseIndonesianNumber(item.hargaBeli) || 0;
      const itemBeli = qBeliEfektif * beli;
      totalAllBeli += itemBeli;

      let pKey = (item.pemasok || '').trim();
      if (!pKey || pKey === '-') {
        pKey = 'Tanpa Pemasok';
      }

      if (!map[pKey]) {
        map[pKey] = {
          totalQty: 0,
          rawQty: 0,
          returQty: 0,
          ditagihkanQty: 0,
          totalBeli: 0,
          orderCount: 0,
          batchKeys: new Set<string>(),
          itemQtyMap: {},
          tokoSet: new Set<string>(),
        };
      }

      map[pKey].totalQty += qBeliEfektif;
      map[pKey].rawQty += rawQtyBeli;
      map[pKey].returQty += returQty;
      map[pKey].ditagihkanQty += qBeliEfektif;
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
      map[pKey].itemQtyMap[itemName].qty += qBeliEfektif;
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
        totalQty: val.ditagihkanQty,
        rawQty: val.rawQty,
        returQty: val.returQty,
        ditagihkanQty: val.ditagihkanQty,
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
      totalLabaBersih: number;
      orderCount: number;
      batchKeys: Set<string>;
    }> = {};

    for (const item of periodOrders) {
      if (item.status === 'CANCELLED') continue;
      const rawQtyJual = parseIndonesianNumber(item.qty) || 0;
      const rawQtyBeli = (item as any).qtyBeli !== undefined && (item as any).qtyBeli !== null
        ? parseIndonesianNumber((item as any).qtyBeli)
        : ((item as any).qty_beli !== undefined && (item as any).qty_beli !== null
          ? parseIndonesianNumber((item as any).qty_beli)
          : rawQtyJual);
      const returQty = Math.max(0, Number(item.retur) || 0);
      const qtyFinal = Math.max(0, rawQtyJual - returQty);
      const qtyBeliEfektif = Math.max(0, rawQtyBeli - returQty);
      const beli = parseIndonesianNumber(item.hargaBeli) || 0;
      const jual = parseIndonesianNumber(item.hargaJual) || 0;
      const cb = parseIndonesianNumber(item.cashback) || 0;
      const itemBeli = qtyBeliEfektif * beli;
      const itemJual = qtyFinal * jual;
      const itemLaba = cb > 0 ? ((cb - beli) * qtyFinal) : (itemJual - itemBeli);

      totalAllTagihan += itemJual;

      const dapurKey = (item.tujuanDapur || 'Lainnya').trim() || 'Lainnya';
      if (!map[dapurKey]) {
        map[dapurKey] = {
          totalQty: 0,
          totalBeli: 0,
          totalJual: 0,
          totalLabaBersih: 0,
          orderCount: 0,
          batchKeys: new Set<string>(),
        };
      }

      map[dapurKey].totalQty += qtyFinal;
      map[dapurKey].totalBeli += itemBeli;
      map[dapurKey].totalJual += itemJual;
      map[dapurKey].totalLabaBersih += itemLaba;
      map[dapurKey].orderCount += 1;

      const bKey = `${item.tanggal || item.createdAt || ''}_${dapurKey}_${item.toko || ''}`;
      map[dapurKey].batchKeys.add(bKey);
    }

    return Object.entries(map).map(([dapur, val]) => {
      const profit = val.totalLabaBersih;
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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-4 font-sans shadow-2xs transition-colors duration-200">
      {/* Header with Title & Period Selector Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {title}
          </h2>
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

      {/* 4 Summary Cards: MODAL, OMSET, KOPERASI, LABA BERSIH */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5">
        {/* 1. MODAL */}
        <div className="bg-slate-50/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              Modal
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          </div>
          <div className="mt-1.5 min-w-0">
            <div className="text-sm sm:text-base md:text-lg lg:text-xl font-black font-nominal text-slate-900 dark:text-slate-100 leading-tight truncate">
              <AnimatedCounter value={totalModal} format="rupiah" />
            </div>
          </div>
        </div>

        {/* 2. OMSET */}
        <div className="bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Omset
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          </div>
          <div className="mt-1.5 min-w-0">
            <div className="text-sm sm:text-base md:text-lg lg:text-xl font-black font-nominal text-indigo-950 dark:text-indigo-100 leading-tight truncate">
              <AnimatedCounter value={totalOmset} format="rupiah" />
            </div>
          </div>
        </div>

        {/* 3. CASHBACK */}
        <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/60 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-2xs hover:border-amber-300 dark:hover:border-amber-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Cashback
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          </div>
          <div className="mt-1.5 min-w-0">
            <div className="text-sm sm:text-base md:text-lg lg:text-xl font-black font-nominal text-amber-950 dark:text-amber-100 leading-tight truncate">
              <AnimatedCounter value={totalKeKoperasi} format="rupiah" />
            </div>
          </div>
        </div>

        {/* 4. LABA BERSIH */}
        <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800/60 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Laba Bersih
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-1.5 min-w-0">
            <div className="text-sm sm:text-base md:text-lg lg:text-xl font-black font-nominal text-emerald-950 dark:text-emerald-100 leading-tight truncate">
              <AnimatedCounter value={totalLabaBersih} format="rupiah" />
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown Section with Tabs (Toko, Pemasok, Dapur) */}
      <div className="space-y-3 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider block">
              Breakdown Toko, Pemasok &amp; Dapur
            </span>
          </div>

          {/* Reset Filter Button for active category */}
          {activeBreakdownTab === 'toko' && selectedStoreFilter && selectedStoreFilter !== 'all' && (
            <button
              type="button"
              onClick={() => onFilterStore && onFilterStore('all')}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 self-start sm:self-auto cursor-pointer"
            >
              Reset Filter Toko ({selectedStoreFilter})
            </button>
          )}
          {activeBreakdownTab === 'pemasok' && selectedPemasokFilter && selectedPemasokFilter !== 'all' && (
            <button
              type="button"
              onClick={() => onFilterPemasok && onFilterPemasok('all')}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 self-start sm:self-auto cursor-pointer"
            >
              Reset Filter Pemasok ({selectedPemasokFilter})
            </button>
          )}
          {activeBreakdownTab === 'dapur' && selectedDapurFilter && selectedDapurFilter !== 'all' && (
            <button
              type="button"
              onClick={() => onFilterDapur && onFilterDapur('all')}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 self-start sm:self-auto cursor-pointer"
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
