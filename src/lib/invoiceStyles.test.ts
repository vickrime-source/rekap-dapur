import { describe, it, expect } from 'vitest';
import {
  getStoreInvoiceConfig,
  STORE_INVOICE_CONFIGS,
  StoreInvoiceStyleConfig,
} from './invoiceStyles';
import { generateInvoiceHtmlString } from './htmlInvoicePdf';
import { OrderItem } from '../types';

describe('Invoice Store Styling & Layout Configuration', () => {
  describe('Store Config Resolution (getStoreInvoiceConfig)', () => {
    it('resolves HTG store configuration correctly', () => {
      const cfg = getStoreInvoiceConfig('HTG');
      expect(cfg.storeKey).toBe('HTG');
      expect(cfg.fontFamily).toContain('Arial');
      expect(cfg.headerBg.toLowerCase()).toBe('#d9e2f3');
      expect(cfg.layoutSwap).toBe(false);

      const cfgFull = getStoreInvoiceConfig('CV. HANDAI TOLAN GROUP');
      expect(cfgFull.storeKey).toBe('HTG');
    });

    it('resolves PROHE store configuration correctly', () => {
      const cfg = getStoreInvoiceConfig('PROHE');
      expect(cfg.storeKey).toBe('PROHE');
      expect(cfg.fontFamily).toContain('Calibri');
      expect(cfg.headerBg.toUpperCase()).toBe('#E8F5E9');
      expect(cfg.headerText.toUpperCase()).toBe('#2E7D32');
      expect(cfg.layoutSwap).toBe(false);

      const cfgPw = getStoreInvoiceConfig('PW PROHE');
      expect(cfgPw.storeKey).toBe('PROHE');
    });

    it('resolves LUWENG BOGA (LB) store configuration correctly', () => {
      const cfg = getStoreInvoiceConfig('LUWENG BOGA');
      expect(cfg.storeKey).toBe('LUWENG_BOGA');
      expect(cfg.fontFamily).toContain('Times New Roman');
      expect(cfg.headerBg.toUpperCase()).toBe('#E0F2E9');
      expect(cfg.headerText.toUpperCase()).toBe('#1B5E3F');
      expect(cfg.layoutSwap).toBe(true);

      const cfgLb = getStoreInvoiceConfig('LB');
      expect(cfgLb.storeKey).toBe('LUWENG_BOGA');
    });

    it('resolves LUMBUNG ADIFRUTA (LA) store configuration correctly', () => {
      const cfg = getStoreInvoiceConfig('LUMBUNG ADIFRUTA');
      expect(cfg.storeKey).toBe('LUMBUNG_ADIFRUTA');
      expect(cfg.fontFamily).toContain('Georgia');
      expect(cfg.headerBg.toUpperCase()).toBe('#ECEFF1');
      expect(cfg.headerText.toUpperCase()).toBe('#37474F');
      expect(cfg.layoutSwap).toBe(true);

      const cfgLa = getStoreInvoiceConfig('LA');
      expect(cfgLa.storeKey).toBe('LUMBUNG_ADIFRUTA');

      const cfgAdifruita = getStoreInvoiceConfig('ADIFRUITA');
      expect(cfgAdifruita.storeKey).toBe('LUMBUNG_ADIFRUTA');
    });
  });

  describe('HTML Invoice Rendering & Cell Formatting', () => {
    const mockItems: OrderItem[] = [
      {
        id: '1',
        namaBarang: 'Beras Premium',
        qty: 5,
        hargaJual: 15000,
        toko: 'HTG',
        tujuanDapur: 'Genteng',
        tanggal: '2026-07-28',
      } as any,
      {
        id: '2',
        namaBarang: 'Minyak Goreng 1L',
        qty: 2,
        hargaJual: 18000,
        toko: 'HTG',
        tujuanDapur: 'Genteng',
        tanggal: '2026-07-28',
      } as any,
    ];

    it('renders HTG with Arial, #d9e2f3 header, bank on left, and signature on right', () => {
      const html = generateInvoiceHtmlString({
        storeName: 'HTG',
        kitchenName: 'Genteng',
        items: mockItems,
        invoiceNumber: 'INV/HTG/001',
        bayar: 100000,
      });

      expect(html).toContain('font-family: Arial');
      expect(html).toContain('background-color: #d9e2f3');
      expect(html).toContain('padding: 7px 12px');
      expect(html).toContain('vertical-align: middle');
      expect(html).toContain('border: 1px solid #000000');

      // Check baseline layout (bank left, ttd right)
      expect(html).toContain('Baseline Layout (HTG & PROHE)');
    });

    it('renders PROHE with Calibri, #E8F5E9 header, bank on left, and signature on right', () => {
      const html = generateInvoiceHtmlString({
        storeName: 'PROHE',
        kitchenName: 'Genteng',
        items: mockItems,
        invoiceNumber: 'INV/PROHE/001',
        bayar: 100000,
      });

      expect(html).toContain('Calibri');
      expect(html).toContain('background-color: #E8F5E9');
      expect(html).toContain('color: #2E7D32');
      expect(html).toContain('Baseline Layout (HTG & PROHE)');
    });

    it('renders LUWENG BOGA with Times New Roman, #E0F2E9 header, bank on right, and signature on left', () => {
      const html = generateInvoiceHtmlString({
        storeName: 'LUWENG BOGA',
        kitchenName: 'Genteng',
        items: mockItems,
        invoiceNumber: 'INV/LB/001',
        bayar: 100000,
      });

      expect(html).toContain('Times New Roman');
      expect(html).toContain('background-color: #E0F2E9');
      expect(html).toContain('color: #1B5E3F');
      expect(html).toContain('Swapped Layout (LB & LA)');
    });

    it('renders LUMBUNG ADIFRUTA with Georgia, #ECEFF1 header, bank on right, and signature on left', () => {
      const html = generateInvoiceHtmlString({
        storeName: 'LUMBUNG ADIFRUTA',
        kitchenName: 'Genteng',
        items: mockItems,
        invoiceNumber: 'INV/LA/001',
        bayar: 100000,
      });

      expect(html).toContain('Georgia');
      expect(html).toContain('background-color: #ECEFF1');
      expect(html).toContain('color: #37474F');
      expect(html).toContain('Swapped Layout (LB & LA)');
    });

    it('guarantees explicit 7px 12px padding, vertical-align middle, and proper styling on BAYAR & SISA', () => {
      const html = generateInvoiceHtmlString({
        storeName: 'HTG',
        kitchenName: 'Genteng',
        items: mockItems,
        invoiceNumber: 'INV/HTG/002',
        bayar: 50000,
      });

      // Explicit padding and vertical-align
      expect(html).toContain('padding: 7px 12px');
      expect(html).toContain('vertical-align: middle');

      // Table body cells must have vertical-align: middle
      expect(html).toContain('vertical-align: middle');

      // TOTAL must be bold
      expect(html).toContain('TOTAL');
      expect(html).toContain('is-bold');

      // BAYAR is normal, SISA is bold and red
      expect(html).toContain('is-normal');
      expect(html).toContain('BAYAR');
      expect(html).toContain('is-sisa');
      expect(html).toContain('SISA');
      expect(html).toContain('#be123c');
    });

    it('renders retur format "70 - 20 = 50" with red 20 in BANYAKNYA and red Retur label in NAMA ITEM', () => {
      const html = generateInvoiceHtmlString({
        storeName: 'HTG',
        kitchenName: 'Genteng',
        items: [
          {
            id: 'item-retur-1',
            namaBarang: 'Beras Super Rojo',
            qty: 70,
            retur: 20,
            hargaJual: 10000,
            toko: 'HTG',
            tujuanDapur: 'Genteng',
            tanggal: '2026-07-27',
          } as any,
        ],
        invoiceNumber: 'INV/HTG/RETUR',
      });

      // Kolom BANYAKNYA: shows 70 - 20 = 50 with red 20
      expect(html).toContain('>70</span>');
      expect(html).toContain('color: #dc2626; font-size: 10pt; font-weight: bold;">20</span>');
      expect(html).toContain('>50</span>');
      expect(html).not.toContain('line-through');
      expect(html).not.toContain('&gt;');

      // Kolom NAMA ITEM: shows item name and red "Retur" label without big background
      expect(html).toContain('Beras Super Rojo');
      expect(html).toContain('color: #dc2626; font-size: 8.5pt; font-weight: bold; vertical-align: middle; white-space: nowrap; margin-left: 8px;">Retur</span>');

      // Total must be 50 * 10000 = 500.000
      expect(html).toContain('500.000');
    });

    it('guarantees table headers are centered horizontally and vertically', () => {
      const html = generateInvoiceHtmlString({
        storeName: 'HTG',
        kitchenName: 'Genteng',
        items: mockItems,
        invoiceNumber: 'INV/HTG/003',
      });

      expect(html).toContain('vertical-align: middle');
      expect(html).toContain('text-align: center');
      expect(html).toContain('>NO</th>');
      expect(html).toContain('>BANYAKNYA</th>');
      expect(html).toContain('>NAMA ITEM</th>');
      expect(html).toContain('>HARGA</th>');
      expect(html).toContain('>JUMLAH</th>');
    });

    it('supports priceVariant cashback: uses cashback if >0 else fallback to hargaJual', () => {
      const html = generateInvoiceHtmlString({
        storeName: 'HTG',
        kitchenName: 'Genteng',
        items: [
          {
            id: 'cb-1',
            namaBarang: 'Beras Cashback',
            qty: 10,
            hargaJual: 15000,
            cashback: 12000,
            toko: 'HTG',
            tujuanDapur: 'Genteng',
            tanggal: '2026-07-27',
          } as any,
          {
            id: 'cb-2',
            namaBarang: 'Beras Normal',
            qty: 5,
            hargaJual: 20000,
            cashback: 0,
            toko: 'HTG',
            tujuanDapur: 'Genteng',
            tanggal: '2026-07-27',
          } as any,
        ],
        invoiceNumber: 'INV/HTG/CB',
        priceVariant: 'cashback',
      });

      // Item 1 uses cashback 12.000 -> 10 * 12.000 = 120.000
      expect(html).toContain('12.000');
      expect(html).toContain('120.000');

      // Item 2 fallback to hargaJual 20.000 -> 5 * 20.000 = 100.000
      expect(html).toContain('20.000');
      expect(html).toContain('100.000');

      // Total = 120.000 + 100.000 = 220.000
      expect(html).toContain('220.000');
    });
  });
});
