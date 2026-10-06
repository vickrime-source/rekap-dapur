import { describe, it, expect } from 'vitest';
import { OrderItem } from '../types';
import { 
  computeAndValidateDashboardSummary, 
  filterOrdersByStatus, 
  groupOrdersByBatch 
} from '../lib/orderValidation';

describe('Dashboard Status Metrics Validation', () => {
  const computeMetrics = (orders: OrderItem[]) => {
    const batchMap = new Map<string, { allDone: boolean; allPaid: boolean }>();

    orders.forEach((item) => {
      const isPaid =
        item.paymentStatus === 'PAID' ||
        item.status_pembayaran?.toUpperCase() === 'PAID' ||
        (item.status === 'selesai' && !item.paymentStatus);
      const isDone =
        item.deliveryStatus === 'DONE' ||
        item.status_pengiriman?.toUpperCase() === 'DONE' ||
        (item.status === 'selesai' && !item.deliveryStatus);

      const batchKey = item.notaId || item.nota_id || `${item.tanggal}||${item.tujuanDapur}||${item.toko}`;
      if (!batchMap.has(batchKey)) {
        batchMap.set(batchKey, { allDone: isDone, allPaid: isPaid });
      } else {
        const b = batchMap.get(batchKey)!;
        if (!isDone) b.allDone = false;
        if (!isPaid) b.allPaid = false;
      }
    });

    let deliveredTrx = 0;
    let pendingTrx = 0;
    let paidTrx = 0;
    let unpaidTrx = 0;

    batchMap.forEach((b) => {
      if (b.allDone) deliveredTrx++;
      else pendingTrx++;
      if (b.allPaid) paidTrx++;
      else unpaidTrx++;
    });

    return {
      totalTrx: batchMap.size,
      deliveredTrx,
      pendingTrx,
      paidTrx,
      unpaidTrx,
      totalItems: orders.length,
    };
  };

  it('memastikan jumlah delivery hijau + pending merah sama persis dengan total pesanan', () => {
    const mockOrders: OrderItem[] = [
      // Batch 1: DONE & PAID (Delivery Selesai)
      {
        id: 'ord-1',
        namaBarang: 'Ayam',
        qty: 10,
        satuan: 'Kg',
        hargaBeli: 20000,
        hargaJual: 25000,
        toko: 'HTG',
        tujuanDapur: 'Dapur A',
        pemasok: 'Pemasok X',
        status: 'selesai',
        tanggal: '2026-10-06',
        paymentStatus: 'PAID',
        deliveryStatus: 'DONE',
        notaId: 'nota-1',
      },
      // Batch 2: PENDING Delivery (Belum Selesai)
      {
        id: 'ord-2',
        namaBarang: 'Bebek',
        qty: 5,
        satuan: 'Kg',
        hargaBeli: 30000,
        hargaJual: 35000,
        toko: 'HTG',
        tujuanDapur: 'Dapur B',
        pemasok: 'Pemasok Y',
        status: 'pending',
        tanggal: '2026-10-06',
        paymentStatus: 'PAID',
        deliveryStatus: 'PENDING',
        notaId: 'nota-2',
      },
      // Batch 3: UNPAID & PENDING (Pending Merah)
      {
        id: 'ord-3',
        namaBarang: 'Ikan Gurame',
        qty: 8,
        satuan: 'Kg',
        hargaBeli: 40000,
        hargaJual: 45000,
        toko: 'PROHE',
        tujuanDapur: 'Dapur C',
        pemasok: 'Pemasok Z',
        status: 'pending',
        tanggal: '2026-10-06',
        paymentStatus: 'UNPAID',
        deliveryStatus: 'PENDING',
        notaId: 'nota-3',
      },
    ];

    const metrics = computeMetrics(mockOrders);
    expect(metrics.totalTrx).toBe(3);
    expect(metrics.deliveredTrx).toBe(1);
    expect(metrics.pendingTrx).toBe(2);
    // Menjumlah persis sesuai status pemesanan
    expect(metrics.deliveredTrx + metrics.pendingTrx).toBe(metrics.totalTrx);
  });

  it('mendukung field status_pengiriman & status_pembayaran snake_case dari database', () => {
    const mockOrders: OrderItem[] = [
      {
        id: 'ord-10',
        namaBarang: 'Daging Sapi',
        qty: 4,
        satuan: 'Kg',
        hargaBeli: 100000,
        hargaJual: 120000,
        toko: 'HTG',
        tujuanDapur: 'Dapur Utama',
        pemasok: 'Pemasok Sapi',
        status: 'pending',
        tanggal: '2026-10-06',
        status_pembayaran: 'PAID',
        status_pengiriman: 'DONE',
        notaId: 'nota-10',
      },
    ];

    const metrics = computeMetrics(mockOrders);
    expect(metrics.totalTrx).toBe(1);
    expect(metrics.deliveredTrx).toBe(1);
    expect(metrics.pendingTrx).toBe(0);
    expect(metrics.deliveredTrx + metrics.pendingTrx).toBe(metrics.totalTrx);
  });

  it('validasi data ketat: computeAndValidateDashboardSummary sinkron sempurna dengan filterOrdersByStatus', () => {
    const mockOrders: OrderItem[] = [
      // Batch 1: 2 items, all DONE & PAID (Delivered)
      {
        id: 'ord-1a',
        namaBarang: 'Beras',
        qty: 25,
        satuan: 'Kg',
        hargaBeli: 12000,
        hargaJual: 14000,
        toko: 'HTG',
        tujuanDapur: 'Dapur 1',
        pemasok: 'Pemasok Beras',
        status: 'selesai',
        tanggal: '2026-10-06',
        paymentStatus: 'PAID',
        deliveryStatus: 'DONE',
        notaId: 'nota-100',
      },
      {
        id: 'ord-1b',
        namaBarang: 'Minyak Goreng',
        qty: 10,
        satuan: 'Ltr',
        hargaBeli: 15000,
        hargaJual: 17000,
        toko: 'HTG',
        tujuanDapur: 'Dapur 1',
        pemasok: 'Pemasok Minyak',
        status: 'selesai',
        tanggal: '2026-10-06',
        paymentStatus: 'PAID',
        deliveryStatus: 'DONE',
        notaId: 'nota-100',
      },
      // Batch 2: 1 item, PENDING Delivery (Pending)
      {
        id: 'ord-2a',
        namaBarang: 'Tepung Terigu',
        qty: 50,
        satuan: 'Kg',
        hargaBeli: 9000,
        hargaJual: 11000,
        toko: 'LA',
        tujuanDapur: 'Dapur 2',
        pemasok: 'Pemasok Tepung',
        status: 'pending',
        tanggal: '2026-10-06',
        paymentStatus: 'PAID',
        deliveryStatus: 'PENDING',
        notaId: 'nota-200',
      },
      // Batch 3: 1 item, UNPAID & PENDING (Pending)
      {
        id: 'ord-3a',
        namaBarang: 'Gula Pasir',
        qty: 20,
        satuan: 'Kg',
        hargaBeli: 16000,
        hargaJual: 18000,
        toko: 'PROHE',
        tujuanDapur: 'Dapur 3',
        pemasok: 'Pemasok Gula',
        status: 'pending',
        tanggal: '2026-10-06',
        paymentStatus: 'UNPAID',
        deliveryStatus: 'PENDING',
        notaId: 'nota-300',
      },
    ];

    // 1. Skenario Filter: 'all'
    const displayedAll = filterOrdersByStatus(mockOrders, 'all');
    const summaryAll = computeAndValidateDashboardSummary(mockOrders, displayedAll, 'all');

    expect(summaryAll.totalTrx).toBe(3);
    expect(summaryAll.deliveredTrx).toBe(1);
    expect(summaryAll.pendingTrx).toBe(2);
    // delivered + pending must strictly equal total
    expect(summaryAll.deliveredTrx + summaryAll.pendingTrx).toBe(summaryAll.totalTrx);
    expect(summaryAll.displayedTrx).toBe(3);
    expect(summaryAll.displayedItems).toBe(4);
    expect(summaryAll.isValid).toBe(true);
    expect(summaryAll.discrepancies).toEqual([]);

    // 2. Skenario Filter: 'delivered'
    const displayedDelivered = filterOrdersByStatus(mockOrders, 'delivered');
    const summaryDelivered = computeAndValidateDashboardSummary(mockOrders, displayedDelivered, 'delivered');

    expect(summaryDelivered.displayedTrx).toBe(summaryDelivered.deliveredTrx);
    expect(summaryDelivered.displayedTrx).toBe(1);
    expect(summaryDelivered.displayedItems).toBe(2);
    expect(displayedDelivered.every((it) => it.notaId === 'nota-100')).toBe(true);
    expect(summaryDelivered.isValid).toBe(true);
    expect(summaryDelivered.discrepancies).toEqual([]);

    // 3. Skenario Filter: 'pending'
    const displayedPending = filterOrdersByStatus(mockOrders, 'pending');
    const summaryPending = computeAndValidateDashboardSummary(mockOrders, displayedPending, 'pending');

    expect(summaryPending.displayedTrx).toBe(summaryPending.pendingTrx);
    expect(summaryPending.displayedTrx).toBe(2);
    expect(summaryPending.displayedItems).toBe(2);
    expect(displayedPending.every((it) => it.deliveryStatus === 'PENDING')).toBe(true);
    expect(summaryPending.isValid).toBe(true);
    expect(summaryPending.discrepancies).toEqual([]);

    // 4. Skenario Mismatch / Anomali terdeteksi oleh validasi
    // Jika dipaksa menampilkan order yang tidak cocok (misal 0 item saat filter pending harusnya 2)
    const summaryAnomaly = computeAndValidateDashboardSummary(mockOrders, [], 'pending');
    expect(summaryAnomaly.isValid).toBe(false);
    expect(summaryAnomaly.discrepancies.length).toBeGreaterThan(0);
  });
});
