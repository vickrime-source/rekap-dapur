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
      expect(html).toContain('padding: 8px 12px');
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

    it('guarantees explicit 8px 12px padding, vertical-align middle, and normal font-weight on BAYAR & SISA', () => {
      const html = generateInvoiceHtmlString({
        storeName: 'HTG',
        kitchenName: 'Genteng',
        items: mockItems,
        invoiceNumber: 'INV/HTG/002',
        bayar: 50000,
      });

      // Explicit padding and vertical-align
      expect(html).toContain('padding: 8px 12px');
      expect(html).toContain('vertical-align: middle');

      // Table body cells must have font-weight: normal
      expect(html).toContain('font-weight: normal');

      // TOTAL must be bold
      expect(html).toContain('TOTAL');
      expect(html).toContain('class="is-bold"');

      // BAYAR and SISA must be normal font-weight
      expect(html).toContain('class="is-normal"');
      expect(html).toContain('BAYAR');
      expect(html).toContain('SISA');
    });
  });
});
