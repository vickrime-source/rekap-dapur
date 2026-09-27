import { useMemo, useState, useEffect } from 'react';
import { 
  OrderItem, 
  Store as StoreType, 
  DashboardPeriod, 
  PeriodSummaryStats, 
  StoreExpenseBreakdown,
  PaymentStatus 
} from '../../types';
import { 
  getWeekRange, 
  isOrderToday, 
  isOrderThisWeek, 
  isOrderThisMonth, 
  parseIndonesianNumber, 
  getTodayWIB 
} from '../../lib/formatters';
import { CustomDateRange } from '../ReportPeriodPicker';
import { TransactionBatch, SummaryTotals } from './types';

interface UseTransactionDataParams {
  orders: OrderItem[];
  invoices?: any[];
  stores?: StoreType[];
  selectedDate?: string;
  selectedMonth: string;
  activePeriod: DashboardPeriod;
  customRange: CustomDateRange | null;
  selectedStoreFilter: string;
  selectedPemasok: string;
  selectedDapurFilter: string;
  selectedStatusFilter: 'all' | 'PAID' | 'UNPAID';
  searchQuery: string;
  pageSize?: number;
}

export function useTransactionData({
  orders,
  invoices = [],
  stores = [],
  selectedDate,
  selectedMonth,
  activePeriod,
  customRange,
  selectedStoreFilter,
  selectedPemasok,
  selectedDapurFilter,
  selectedStatusFilter,
  searchQuery,
  pageSize = 15,
}: UseTransactionDataParams) {
  const [currentPage, setCurrentPage] = useState(1);

  // Week range based on selectedDate
  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);

  // Unique list of suppliers (pemasok)
  const pemasokList = useMemo(() => {
    const list = new Set<string>();
    orders.forEach((o) => {
      if (o.pemasok) list.add(o.pemasok);
    });
    return Array.from(list);
  }, [orders]);

  // Unique list of stores (toko)
  const storeNames = useMemo(() => {
    if (stores && stores.length > 0) {
      return stores.map((s) => s.nama);
    }
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.toko) set.add(o.toko);
    });
    return Array.from(set);
  }, [stores, orders]);

  // Orders filtered by active period (Hari Ini, Mingguan, Bulan Ini, Custom Range, All Time)
  const periodOrders = useMemo(() => {
    const todayStr = getTodayWIB();
    return orders.filter((item) => {
      if (customRange) {
        const itemDate = item.tanggal || (item.createdAt ? item.createdAt.split('T')[0] : '');
        return itemDate >= customRange.startDate && itemDate <= customRange.endDate;
      }
      if (activePeriod === 'hari_ini') {
        return isOrderToday(item, todayStr);
      } else if (activePeriod === 'mingguan') {
        return isOrderThisWeek(item, weekRange);
      } else if (activePeriod === 'bulan_ini') {
        return isOrderThisMonth(item, selectedMonth);
      }
      return true; // all_time
    });
  }, [orders, activePeriod, selectedMonth, customRange, weekRange]);

  // Compute period statistics (Total Qty, Pendapatan, Pengeluaran PO, Profit Bersih, and Store Breakdowns)
  const periodStats = useMemo<PeriodSummaryStats>(() => {
    let totalQty = 0;
    let totalPendapatan = 0;
    let totalPengeluaran = 0;
    let totalLabaBersih = 0;
    let totalKeKoperasi = 0;
    const storeMap: Record<
      string,
      {
        totalQty: number;
        totalBeli: number;
        totalJual: number;
        totalLabaBersih: number;
        totalKeKoperasi: number;
        count: number;
        pemasokSet: Set<string>;
        batchKeys: Set<string>;
      }
    > = {};
    const globalBatchKeys = new Set<string>();

    for (const item of periodOrders) {
      if (item.status === 'CANCELLED') continue;

      const rawQtyJual = parseIndonesianNumber(item.qty) || 0;
      const rawQtyBeli = item.qtyBeli !== undefined && item.qtyBeli !== null
        ? parseIndonesianNumber(item.qtyBeli)
        : (item.qty_beli !== undefined && item.qty_beli !== null ? parseIndonesianNumber(item.qty_beli) : rawQtyJual);
      const returQty = Math.max(0, Number(item.retur) || 0);
      const qtyFinal = Math.max(0, rawQtyJual - returQty);
      const qtyBeliEfektif = Math.max(0, rawQtyBeli - returQty);
      const beli = parseIndonesianNumber(item.hargaBeli) || 0;
      const jual = parseIndonesianNumber(item.hargaJual) || 0;
      const cb = parseIndonesianNumber(item.cashback) || 0;

      // FORMULA BISNIS FINAL:
      // omzet = harga_jual * qty_final
      // modal = harga_beli * qty_beli_efektif
      // cashback <= 0: laba_bersih = omzet - modal, ke_koperasi = 0
      // cashback > 0: laba_bersih = (cashback - harga_beli) * qty_final, ke_koperasi = (harga_jual - cashback) * qty_final
      const modalItem = qtyBeliEfektif * beli;
      const omzetItem = qtyFinal * jual;
      const labaBersihItem = cb > 0 ? ((cb - beli) * qtyFinal) : (omzetItem - modalItem);
      const keKoperasiItem = cb > 0 ? ((jual - cb) * qtyFinal) : 0;

      // Retur berarti bagian tersebut tidak jadi dibeli/terjual.
      const modalTokoItem = modalItem;

      totalQty += qtyFinal;
      totalPendapatan += omzetItem;
      totalPengeluaran += modalItem;
      totalLabaBersih += labaBersihItem;
      totalKeKoperasi += keKoperasiItem;

      const tokoKey = (item.toko || 'Lainnya').trim() || 'Lainnya';
      if (!storeMap[tokoKey]) {
        storeMap[tokoKey] = {
          totalQty: 0,
          totalBeli: 0,
          totalJual: 0,
          totalLabaBersih: 0,
          totalKeKoperasi: 0,
          count: 0,
          pemasokSet: new Set<string>(),
          batchKeys: new Set<string>(),
        };
      }
      storeMap[tokoKey].totalQty += qtyFinal;
      storeMap[tokoKey].totalBeli += modalTokoItem;
      storeMap[tokoKey].totalJual += omzetItem;
      storeMap[tokoKey].totalLabaBersih += labaBersihItem;
      storeMap[tokoKey].totalKeKoperasi += keKoperasiItem;
      storeMap[tokoKey].count += 1;
      if (item.pemasok && item.pemasok.trim() && item.pemasok.trim() !== '-') {
        storeMap[tokoKey].pemasokSet.add(item.pemasok.trim());
      }

      const bKey = item.notaId || item.nota_id || `${item.tanggal}_${item.tujuanDapur}_${item.toko}_${item.createdAt || ''}`;
      storeMap[tokoKey].batchKeys.add(bKey);
      globalBatchKeys.add(bKey);
    }

    const storeBreakdowns: StoreExpenseBreakdown[] = Object.entries(storeMap)
      .map(([toko, val]) => {
        const profit = val.totalLabaBersih;
        const marginPercent = val.totalJual > 0 ? Math.round((profit / val.totalJual) * 100) : 0;
        return {
          toko,
          totalQty: val.totalQty,
          totalBeli: val.totalBeli,
          totalJual: val.totalJual,
          profit,
          totalKeKoperasi: val.totalKeKoperasi,
          orderCount: val.count,
          transactionCount: val.batchKeys.size || val.count,
          pemasokList: Array.from(val.pemasokSet),
          percentageOfTotalBeli: totalPengeluaran > 0 ? (val.totalBeli / totalPengeluaran) * 100 : 0,
          percentageOfTotalJual: totalPendapatan > 0 ? (val.totalJual / totalPendapatan) * 100 : 0,
          marginPercent,
        };
      })
      .sort((a, b) => b.totalJual - a.totalJual);

    return {
      totalQty,
      totalTransactions: globalBatchKeys.size || periodOrders.length,
      totalPendapatan,
      totalPengeluaran,
      profitBersih: totalLabaBersih,
      totalKeKoperasi,
      totalLabaBersih,
      storeBreakdowns,
    };
  }, [periodOrders]);

  // Group raw orders & invoices into distinct transaction batches
  const transactionBatches = useMemo<TransactionBatch[]>(() => {
    const groups: Record<string, OrderItem[]> = {};

    orders.forEach((o) => {
      const tanggal = o.tanggal || o.createdAt?.split('T')[0] || '';
      const dapur = o.tujuanDapur || 'Siliragung';
      const toko = o.toko || '';
      const pemasok = o.pemasok || '-';
      const key = `${tanggal}||${dapur}||${toko}||${pemasok}`;

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(o);
    });

    let idx = 1;
    const batches: TransactionBatch[] = Object.entries(groups).map(([key, items]) => {
      const [tanggal, tujuanDapur, toko, pemasok] = key.split('||');
      const allPaid = items.every((i) => (i.paymentStatus || '').toUpperCase() === 'PAID');
      const allDelivered = items.every((i) => (i.deliveryStatus || '').toUpperCase() === 'DONE');
      const isBatchCancelled = items.length > 0 && items.every((i) => i.status === 'CANCELLED');

      const nonCancelledItems = items.filter((i) => i.status !== 'CANCELLED');
      const calculationItems = nonCancelledItems.length > 0 ? nonCancelledItems : items;

      const totalQty = calculationItems.reduce((sum, i) => {
        const rawQ = Number(i.qty) || 0;
        const ret = Math.max(0, Number(i.retur) || 0);
        return sum + Math.max(0, rawQ - ret);
      }, 0);
      const totalBeli = calculationItems.reduce((sum, i) => {
        const rawQBeli = i.qtyBeli !== undefined && i.qtyBeli !== null
          ? Number(i.qtyBeli)
          : (i.qty_beli !== undefined && i.qty_beli !== null ? Number(i.qty_beli) : (Number(i.qty) || 0));
        const ret = Math.max(0, Number(i.retur) || 0);
        const qBeliEfektif = Math.max(0, rawQBeli - ret);
        return sum + qBeliEfektif * (Number(i.hargaBeli) || 0);
      }, 0);
      const totalJual = calculationItems.reduce(
        (sum, i) => {
          const rawQ = Number(i.qty) || 0;
          const ret = Math.max(0, Number(i.retur) || 0);
          const qFinal = Math.max(0, rawQ - ret);
          return sum + qFinal * (Number(i.hargaJual) || 0);
        },
        0
      );

      let totalLabaBersih = 0;
      let totalKeKoperasi = 0;
      calculationItems.forEach((i) => {
        const rawQ = Number(i.qty) || 0;
        const rawQBeli = i.qtyBeli !== undefined && i.qtyBeli !== null
          ? Number(i.qtyBeli)
          : (i.qty_beli !== undefined && i.qty_beli !== null ? Number(i.qty_beli) : rawQ);
        const ret = Math.max(0, Number(i.retur) || 0);
        const qFinal = Math.max(0, rawQ - ret);
        const qBeliEfektif = Math.max(0, rawQBeli - ret);
        const hb = Number(i.hargaBeli) || 0;
        const hj = Number(i.hargaJual) || 0;
        const cb = Number(i.cashback) || 0;
        const modal = qBeliEfektif * hb;
        const omzet = qFinal * hj;

        if (cb > 0) {
          totalLabaBersih += ((cb - hb) * qFinal);
          totalKeKoperasi += ((hj - cb) * qFinal);
        } else {
          totalLabaBersih += (omzet - modal);
        }
      });

      return {
        id: key,
        batchIndex: idx++,
        tanggal,
        createdAt: items[0]?.createdAt,
        tujuanDapur,
        toko,
        pemasok,
        payStatus: allPaid ? 'PAID' : 'UNPAID',
        delStatus: allDelivered ? 'DONE' : 'PENDING',
        totalQty: isBatchCancelled ? 0 : totalQty,
        totalBeli: isBatchCancelled ? 0 : totalBeli,
        totalJual: isBatchCancelled ? 0 : totalJual,
        totalLabaBersih: isBatchCancelled ? 0 : totalLabaBersih,
        totalKeKoperasi: isBatchCancelled ? 0 : totalKeKoperasi,
        isCancelled: isBatchCancelled,
        status: isBatchCancelled ? 'CANCELLED' : undefined,
        items,
        catatan: items.map((i) => i.catatan).filter(Boolean).join('; ') || '',
        rowIndex: items[0]?.rowIndex,
      };
    });

    // Invoices integration (if any stand-alone invoices exist)
    if (invoices && invoices.length > 0) {
      invoices.forEach((inv) => {
        const invDate = inv.tanggalPrint || inv.tanggal || inv.createdAt?.split('T')[0] || '';
        const invDapur = inv.tujuanDapur || inv.items?.[0]?.tujuanDapur || 'Siliragung';
        const invToko = inv.toko || inv.items?.[0]?.toko || '';
        const invPemasok = inv.pemasok || inv.PEMASOK || inv.items?.[0]?.pemasok || '-';
        const key = `${invDate}||${invDapur}||${invToko}||${invPemasok}`;

        const existing = batches.find((b) => b.id === key || b.id === inv.id);
        if (!existing) {
          const isPaid =
            (inv.status || inv.STATUS || '').toUpperCase() === 'PAID' ||
            (inv.status || inv.STATUS || '').toUpperCase() === 'LUNAS' ||
            (inv.status || inv.STATUS || '').toUpperCase() === 'DONE';
          const payStatus: PaymentStatus = isPaid ? 'PAID' : 'UNPAID';
          const items: OrderItem[] = inv.items && inv.items.length > 0 ? inv.items : [];
          const totalQty =
            items.reduce((sum, i) => {
              const rq = Number(i.qty) || 0;
              const rt = Math.min(rq, Math.max(0, Number(i.retur) || 0));
              return sum + Math.max(0, rq - rt);
            }, 0) || Number(inv.qty || inv.QTY || 1);
          const totalBeli =
            Number(inv.totalBeli || inv['H. BELI'] || 0) ||
            items.reduce((sum, i) => {
              const rq = Number(i.qty) || 0;
              const rawQBeli = i.qtyBeli !== undefined && i.qtyBeli !== null
                ? Number(i.qtyBeli)
                : (i.qty_beli !== undefined && i.qty_beli !== null ? Number(i.qty_beli) : rq);
              const rt = Math.max(0, Number(i.retur) || 0);
              const qBeliEfektif = Math.max(0, rawQBeli - rt);
              return sum + qBeliEfektif * (Number(i.hargaBeli) || 0);
            }, 0);
          const totalJual =
            Number(inv.totalAmount || inv.totalJual || inv.TOTAL || 0) ||
            items.reduce((sum, i) => {
              const rq = Number(i.qty) || 0;
              const rt = Math.max(0, Number(i.retur) || 0);
              const qf = Math.max(0, rq - rt);
              return sum + qf * (Number(i.hargaJual) || 0);
            }, 0) ||
            totalBeli;

          let totalLabaBersih = 0;
          let totalKeKoperasi = 0;
          if (items.length > 0) {
            items.forEach((i) => {
              const rq = Number(i.qty) || 0;
              const rawQBeli = i.qtyBeli !== undefined && i.qtyBeli !== null
                ? Number(i.qtyBeli)
                : (i.qty_beli !== undefined && i.qty_beli !== null ? Number(i.qty_beli) : rq);
              const rt = Math.max(0, Number(i.retur) || 0);
              const q = Math.max(0, rq - rt);
              const qBeliEfektif = Math.max(0, rawQBeli - rt);
              const hb = Number(i.hargaBeli) || 0;
              const hj = Number(i.hargaJual) || 0;
              const cb = Number(i.cashback) || 0;
              const modal = qBeliEfektif * hb;
              if (cb > 0) {
                totalLabaBersih += (cb * q - modal);
                totalKeKoperasi += (hj - cb) * q;
              } else {
                totalLabaBersih += (hj * q - modal);
              }
            });
          } else {
            totalLabaBersih = totalJual - totalBeli;
          }

          const invCatatan =
            inv.catatan ||
            inv.keterangan ||
            items.map((i) => i.catatan).filter(Boolean).join('; ') ||
            '';

          batches.push({
            id: inv.id || key,
            batchIndex: idx++,
            tanggal: invDate,
            createdAt: inv.createdAt,
            tujuanDapur: invDapur,
            toko: invToko,
            pemasok: invPemasok,
            payStatus,
            delStatus: 'DONE',
            totalQty,
            totalBeli,
            totalJual,
            totalLabaBersih,
            totalKeKoperasi,
            items,
            catatan: invCatatan,
            rowIndex: inv.rowIndex,
          });
        }
      });
    }

    return batches;
  }, [orders, invoices]);

  // Filter transaction batches with Period, Store breakdown, Supplier, Status, and Search query
  const filteredBatches = useMemo(() => {
    const todayStr = getTodayWIB();
    return transactionBatches.filter((batch) => {
      // 1. Period filter (Hari Ini, Mingguan, Bulanan, All Time, atau Rentang Kustom)
      if (customRange) {
        const batchDate = batch.tanggal || (batch.createdAt ? batch.createdAt.split('T')[0] : '');
        const isMatch =
          (batchDate >= customRange.startDate && batchDate <= customRange.endDate) ||
          (batch.items &&
            batch.items.some((i) => {
              const d = i.tanggal || (i.createdAt ? i.createdAt.split('T')[0] : '');
              return d >= customRange.startDate && d <= customRange.endDate;
            }));
        if (!isMatch) return false;
      } else if (activePeriod === 'hari_ini') {
        const isMatch =
          (batch.items && batch.items.length > 0 && batch.items.some((i) => isOrderToday(i, todayStr))) ||
          isOrderToday({ tanggal: batch.tanggal, createdAt: batch.createdAt }, todayStr);
        if (!isMatch) return false;
      } else if (activePeriod === 'mingguan') {
        const isMatch =
          (batch.items && batch.items.length > 0 && batch.items.some((i) => isOrderThisWeek(i, weekRange))) ||
          isOrderThisWeek({ tanggal: batch.tanggal, createdAt: batch.createdAt }, weekRange);
        if (!isMatch) return false;
      } else if (activePeriod === 'bulan_ini') {
        const isMatch =
          (batch.items && batch.items.length > 0 && batch.items.some((i) => isOrderThisMonth(i, selectedMonth))) ||
          isOrderThisMonth({ tanggal: batch.tanggal, createdAt: batch.createdAt }, selectedMonth);
        if (!isMatch) return false;
      }

      // 2. Store filter (Integrated with Breakdown Toko & Pengepul click)
      if (selectedStoreFilter !== 'all' && batch.toko !== selectedStoreFilter) {
        return false;
      }

      // 3. Search query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesSearch =
          batch.tujuanDapur.toLowerCase().includes(q) ||
          batch.toko.toLowerCase().includes(q) ||
          batch.pemasok.toLowerCase().includes(q) ||
          batch.items.some((i) => i.namaBarang.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // 4. Supplier filter
      if (selectedPemasok !== 'all' && batch.pemasok !== selectedPemasok) {
        return false;
      }

      // 5. Dapur filter (Integrated with Breakdown Dapur click)
      if (selectedDapurFilter !== 'all' && batch.tujuanDapur !== selectedDapurFilter) {
        return false;
      }

      // 6. Payment status filter
      if (selectedStatusFilter !== 'all' && batch.payStatus !== selectedStatusFilter) {
        return false;
      }

      return true;
    });
  }, [
    transactionBatches,
    activePeriod,
    selectedDate,
    selectedMonth,
    customRange,
    weekRange,
    selectedStoreFilter,
    searchQuery,
    selectedPemasok,
    selectedDapurFilter,
    selectedStatusFilter,
  ]);

  const totalPages = Math.ceil(filteredBatches.length / pageSize);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [filteredBatches.length, totalPages, currentPage]);

  const paginatedBatches = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredBatches.slice(startIndex, startIndex + pageSize);
  }, [filteredBatches, currentPage, pageSize]);

  // Rekap Total Akumulasi Transaksi Terfilter (termasuk Total Ke Koperasi & Total Laba Bersih)
  // Transaksi CANCELLED tidak masuk ke hitungan finansial
  const summaryTotals = useMemo<SummaryTotals>(() => {
    return filteredBatches.reduce(
      (acc, b) => {
        if (b.isCancelled || b.status === 'CANCELLED') return acc;
        acc.totalQty += b.totalQty || 0;
        acc.totalBeli += b.totalBeli || 0;
        acc.totalJual += b.totalJual || b.totalBeli || 0;
        acc.totalKeKoperasi += b.totalKeKoperasi || 0;
        acc.totalLabaBersih +=
          b.totalLabaBersih !== undefined ? b.totalLabaBersih : (b.totalJual || 0) - b.totalBeli;
        return acc;
      },
      { totalQty: 0, totalBeli: 0, totalJual: 0, totalKeKoperasi: 0, totalLabaBersih: 0 }
    );
  }, [filteredBatches]);

  return {
    weekRange,
    pemasokList,
    storeNames,
    periodOrders,
    periodStats,
    transactionBatches,
    filteredBatches,
    paginatedBatches,
    summaryTotals,
    currentPage,
    totalPages,
    setCurrentPage,
  };
}
