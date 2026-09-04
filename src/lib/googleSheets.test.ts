import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  mapRawOrder, 
  mapRawInvoice, 
  addRow, 
  buildPesananPayload, 
  buildTransaksiPayload, 
  normalizeDate, 
  fetchSheetData 
} from './googleSheets';

describe('Google Sheets API Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Payload Builders (Exact Google Sheet Header Matching)', () => {
    it('buildPesananPayload should create data object with exact headers for sheet "pesanan"', () => {
      const orderItem = {
        id: 'ord-12345',
        tujuanDapur: 'Dapur Utama',
        namaBarang: 'Beli Cabai Rawit',
        tanggal: '2026-08-09',
        qty: 15,
        toko: 'HTG',
        pemasok: 'Pemasok 1',
        paymentStatus: 'UNPAID' as const,
        deliveryStatus: 'PENDING' as const,
        hargaJual: 45000,
        hargaBeli: 40000,
        createdAt: '2026-08-09T10:00:00.000Z',
      };

      const payload = buildPesananPayload(orderItem);

      expect(payload).toEqual({
        DAPUR: 'Dapur Utama',
        ITEM: 'Beli Cabai Rawit',
        DATE: '2026-08-09',
        QTY: 15,
        TOKO: 'HTG',
        PAYMENT: 'UNPAID',
        DILEVERY: 'PENDING',
        'H. JUAL': 45000,
        'H. BELI': 40000,
        PEMASOK: 'Pemasok 1',
        STATUS: 'pending',
      });
    });

    it('buildTransaksiPayload should create data object with exact headers for sheet "transaksi"', () => {
      const invoiceData = {
        tanggalPrint: '2026-08-09',
        toko: 'Toko Bintang',
        totalBeli: 150000,
        totalJual: 180000,
        items: [
          { namaBarang: 'Bawang Merah', qty: 10, pemasok: 'Pemasok Subur' } as any,
          { namaBarang: 'Bawang Putih', qty: 5, pemasok: 'Pemasok Subur' } as any,
        ],
      };

      const payload = buildTransaksiPayload(invoiceData);

      expect(payload).toEqual({
        TANGGAL: '2026-08-09',
        PEMASOK: 'Pemasok Subur',
        BARANG: 'Bawang Merah (10), Bawang Putih (5)',
        TOKO: 'Toko Bintang',
        QTY: 15,
        'H. BELI': 150000,
        TOTAL: 180000,
        STATUS: 'LUNAS',
      });
    });
  });

  describe('mapRawOrder', () => {
    it('should correctly map Google Sheets "pesanan" header keys to OrderItem', () => {
      const rawRow = {
        NO: 'ord-101',
        DAPUR: 'Siliragung',
        ITEM: 'Bawang Merah',
        DATE: '2026-08-09',
        QTY: 50,
        TOKO: 'HTG',
        PEMASOK: 'Pemasok Utama',
        PAYMENT: 'PAID',
        DILEVERY: 'DONE',
        'H. JUAL': 25000,
        'H. BELI': 20000,
        STATUS: 'selesai',
      };

      const mapped = mapRawOrder(rawRow);

      expect(mapped).toEqual({
        id: 'ord-101',
        namaBarang: 'Bawang Merah',
        qty: 50,
        hargaBeli: 20000,
        hargaJual: 25000,
        toko: 'HTG',
        tujuanDapur: 'Siliragung',
        pemasok: 'Pemasok Utama',
        status: 'selesai',
        paymentStatus: 'PAID',
        deliveryStatus: 'DONE',
        tanggal: '2026-08-09',
        createdAt: expect.any(String),
        catatan: '',
      });
    });
  });

  describe('mapRawInvoice', () => {
    it('should correctly map Google Sheets "transaksi" header keys to InvoiceRecord', () => {
      const rawRow = {
        NO: 'INV/2026/08/001',
        TANGGAL: '2026-08-09',
        PEMASOK: 'Pemasok A',
        BARANG: 'Bawang Merah (50)',
        TOKO: 'HTG',
        QTY: 50,
        'H. BELI': 1000000,
        TOTAL: 1250000,
        DAPUR: 'Siliragung',
        STATUS: 'LUNAS',
      };

      const mapped = mapRawInvoice(rawRow);

      expect(mapped.id).toBe('INV/2026/08/001');
      expect(mapped.invoiceNumber).toBe('INV/2026/08/001');
      expect(mapped.tanggalPrint).toBe('2026-08-09');
      expect(mapped.toko).toBe('HTG');
      expect(mapped.totalBeli).toBe(1000000);
      expect(mapped.totalJual).toBe(1250000);
    });
  });

  describe('normalizeDate', () => {
    it('should normalize ISO date string to YYYY-MM-DD', () => {
      const iso = '2026-08-11T17:00:00.000Z';
      const normalized = normalizeDate(iso);
      expect(normalized).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should preserve standard YYYY-MM-DD', () => {
      expect(normalizeDate('2026-08-15')).toBe('2026-08-15');
    });

    it('should parse Indonesian text dates', () => {
      expect(normalizeDate('10 Agustus 2026')).toBe('2026-08-10');
    });
  });

  describe('API Calls (Backend Endpoints)', () => {
    it('addRow should post to /api/sheets-add', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ success: true, message: 'Row added' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const orderData = {
        DAPUR: 'Cluring',
        ITEM: 'Ayam Potong',
        DATE: '2026-08-09',
        QTY: 100,
        TOKO: 'PROHE',
        PAYMENT: 'UNPAID',
        DILEVERY: 'PENDING',
        'H. JUAL': 32000,
        'H. BELI': 30000,
      };

      const response = await addRow('pesanan', orderData);

      expect(response.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalled();
      const [calledUrl, calledOptions] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe('/api/sheets-add');
      expect(calledOptions.method).toBe('POST');
      expect(JSON.parse(calledOptions.body as string)).toEqual({
        sheet: 'pesanan',
        data: orderData,
      });
    });

    it('fetchSheetData should get from /api/sheets-get', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: [{ ITEM: 'Beras' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const response = await fetchSheetData('pesanan');

      expect(response.data).toEqual([{ ITEM: 'Beras' }]);
      expect(fetchSpy).toHaveBeenCalled();
      const [calledUrl] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe('/api/sheets-get?sheet=pesanan');
    });
  });
});
