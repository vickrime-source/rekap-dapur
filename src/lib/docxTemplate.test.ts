import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getTemplateUrlForStore,
  getCustomTemplateUrl,
  setCustomTemplateUrl,
  prepareScopedInvoiceData,
  sanitizeDocxXml,
  TEMPLATE_URLS,
} from './docxTemplate';
import { compressDocxImagesClient } from './clientDocxCompressor';
import {
  generateInvoiceNumber,
  formatRupiah,
  parseIndonesianNumber,
  formatTanggalInvoice,
  formatSppgKitchenName,
  resolveRecipientSppgName,
} from './formatters';
import { generateInvoiceHtmlString } from './htmlInvoicePdf';
import JSZip from 'jszip';
import PizZip from 'pizzip';

describe('Invoice Processing & Template TDD Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Template URL Resolution (getTemplateUrlForStore)', () => {
    it('should map LUWENG BOGA / LB store variants correctly', () => {
      expect(getTemplateUrlForStore('LUWENG BOGA')).toBe(TEMPLATE_URLS['LUWENG BOGA']);
      expect(getTemplateUrlForStore('Luweng Boga Dapur')).toBe(TEMPLATE_URLS['LUWENG BOGA']);
      expect(getTemplateUrlForStore('LB')).toBe(TEMPLATE_URLS['LUWENG BOGA']);
    });

    it('should map PROHE / PW store variants correctly', () => {
      expect(getTemplateUrlForStore('PROHE')).toBe(TEMPLATE_URLS['PROHE']);
      expect(getTemplateUrlForStore('Prohe PW')).toBe(TEMPLATE_URLS['PROHE']);
    });

    it('should map LUMBUNG ADIFRUTA / LA store variants correctly', () => {
      expect(getTemplateUrlForStore('LUMBUNG ADIFRUTA')).toBe(TEMPLATE_URLS['LUMBUNG ADIFRUTA']);
      expect(getTemplateUrlForStore('LA Adifruita')).toBe(TEMPLATE_URLS['LUMBUNG ADIFRUTA']);
      expect(getTemplateUrlForStore('Lumbung')).toBe(TEMPLATE_URLS['LUMBUNG ADIFRUTA']);
    });

    it('should default to HTG for unrecognized or HTG stores', () => {
      expect(getTemplateUrlForStore('HTG')).toBe(TEMPLATE_URLS['HTG']);
      expect(getTemplateUrlForStore('Toko Sampel')).toBe(TEMPLATE_URLS['HTG']);
    });

    it('should allow setting and clearing custom template URL', () => {
      const customUrl = 'https://docs.google.com/document/d/custom123/export?format=docx';
      setCustomTemplateUrl(customUrl, 'Custom Template');
      expect(getCustomTemplateUrl()).toBe(customUrl);
      expect(getTemplateUrlForStore('HTG')).toBe(customUrl);

      setCustomTemplateUrl(null);
      expect(getCustomTemplateUrl()).toBeNull();
      expect(getTemplateUrlForStore('HTG')).toBe(TEMPLATE_URLS['HTG']);
    });
  });

  describe('Invoice Payload Preparation (prepareScopedInvoiceData)', () => {
    const mockOrderItems = [
      {
        id: '1',
        toko: 'PROHE',
        tujuanDapur: 'Cluring',
        namaBarang: 'Ayam Potong',
        qty: 50,
        hargaJual: 32000,
        hargaBeli: 28000,
        tanggal: '2026-08-11',
        catatan: 'Fresh',
      },
      {
        id: '2',
        toko: 'PROHE',
        tujuanDapur: 'Cluring',
        namaBarang: 'Telur Ayam',
        qty: 100,
        hargaJual: 2000,
        hargaBeli: 1800,
        tanggal: '2026-08-11',
      },
      {
        id: '3',
        toko: 'HTG',
        tujuanDapur: 'Srono',
        namaBarang: 'Bawang Merah',
        qty: 10,
        hargaJual: 25000,
        tanggal: '2026-08-11',
      },
    ];

    it('should correctly filter items by store, kitchen, and date', () => {
      const result = prepareScopedInvoiceData({
        storeName: 'PROHE',
        kitchenName: 'Cluring',
        dateStr: '2026-08-11',
        items: mockOrderItems as any,
        bayar: 1500000,
      });

      expect(result.validItems.length).toBe(2);
      expect(result.validItems[0].namaBarang).toBe('Ayam Potong');
      expect(result.validItems[1].namaBarang).toBe('Telur Ayam');
    });

    it('should calculate grandTotal, payment, and remaining sisa correctly', () => {
      // Item 1: 50 * 32,000 = 1,600,000
      // Item 2: 100 * 2,000 = 200,000
      // Total: 1,800,000
      // Bayar: 1,500,000
      // Sisa: 300,000
      const result = prepareScopedInvoiceData({
        storeName: 'PROHE',
        kitchenName: 'Cluring',
        dateStr: '2026-08-11',
        items: mockOrderItems as any,
        bayar: 1500000,
      });

      expect(result.grandTotal).toBe(1800000);
      expect(result.parsedBayar).toBe(1500000);
      expect(result.sisa).toBe(300000);

      // Check docxtemplater tags
      expect(result.dataContext.TOTAL).toBe(formatRupiah(1800000));
      expect(result.dataContext.BAYAR).toBe('0');
      expect(result.dataContext.SISA).toBe('');
    });

    it('should format item table rows with correct numeric and text attributes', () => {
      const result = prepareScopedInvoiceData({
        storeName: 'PROHE',
        kitchenName: 'Cluring',
        dateStr: '2026-08-11',
        items: mockOrderItems as any,
      });

      const firstItem = result.itemsFormatted[0];
      expect(firstItem.no).toBe(1);
      expect(firstItem.qty).toBe(50);
      expect(firstItem.namaBarang).toBe('Ayam Potong');
      expect(firstItem.harga).toBe(formatRupiah(32000));
      expect(firstItem.jumlah).toBe(formatRupiah(1600000));
    });
  });

  describe('XML Sanitization (sanitizeDocxXml)', () => {
    it('should clean spaced tag typos like {{#it em s}}{ into {{#items}} and fix {no} into {{no}}', () => {
      const pzip = new PizZip();
      const mockXml = '<w:document><w:body><w:t>{{#it em s}}{</w:t><w:t>{no}</w:t><w:t xml:space="preserve">}</w:t><w:t>{{/it em s}}</w:t></w:body></w:document>';
      pzip.file('word/document.xml', mockXml);

      sanitizeDocxXml(pzip);

      const cleanedXml = pzip.file('word/document.xml')?.asText();
      expect(cleanedXml).toBe('<w:document><w:body><w:t>{{#items}}</w:t><w:t>{{no}}</w:t><w:t xml:space="preserve"></w:t><w:t>{{/items}}</w:t></w:body></w:document>');
    });

    it('should NOT corrupt valid tags like {{#items}}{{no}} in HTG template', () => {
      const pzip = new PizZip();
      const mockXml = '<w:document><w:body><w:t xml:space="preserve">Tanggal : {{tgl}}</w:t><w:t xml:space="preserve">{{#items}}{{no}}</w:t><w:t xml:space="preserve">{{qty}}</w:t><w:t xml:space="preserve">{{jumlah}}{{/items}}</w:t></w:body></w:document>';
      pzip.file('word/document.xml', mockXml);

      sanitizeDocxXml(pzip);

      const cleanedXml = pzip.file('word/document.xml')?.asText();
      expect(cleanedXml).toBe(mockXml);
    });
  });

  describe('Client DOCX Compressor (compressDocxImagesClient)', () => {
    it('should handle non-image DOCX zip archive gracefully without throwing', async () => {
      const zip = new JSZip();
      zip.file('word/document.xml', '<w:document><w:body/></w:document>');
      const docxArrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });

      const compressedBlob = await compressDocxImagesClient(docxArrayBuffer);
      expect(compressedBlob).toBeDefined();
      expect(compressedBlob.size).toBeGreaterThan(0);
    });
  });

  describe('Invoice Number Auto Generation (generateInvoiceNumber)', () => {
    it('should generate valid invoice number format with date stamp', () => {
      const invNo = generateInvoiceNumber('Cluring');
      expect(invNo).toMatch(/^INV\//);
      expect(invNo).toContain('CLUR');
    });
  });

  describe('Invoice Date & SPPG Kitchen Name Formatting (User Specific Guidelines)', () => {
    it('should format date with day name in uppercase and full month (SENIN, 27 Juli 2026)', () => {
      expect(formatTanggalInvoice('2026-07-27')).toBe('SENIN, 27 Juli 2026');
      expect(formatTanggalInvoice('2026-08-11')).toBe('SELASA, 11 Agustus 2026');
    });

    it('should resolve kitchen names to uppercase SPPG {NAMA DAPUR}', () => {
      expect(formatSppgKitchenName('Cluring')).toBe('SPPG CLURING');
      expect(formatSppgKitchenName('siliragung')).toBe('SPPG SILIRAGUNG');
      expect(formatSppgKitchenName('Rejoagung')).toBe('SPPG REJOAGUNG');
      expect(formatSppgKitchenName('SPPG Cluring')).toBe('SPPG CLURING');
      expect(formatSppgKitchenName('')).toBe('SPPG');

      // resolveRecipientSppgName should ignore '-' or generic 'dapur' and use actual kitchen
      expect(resolveRecipientSppgName('-', 'Cluring')).toBe('SPPG CLURING');
      expect(resolveRecipientSppgName('', 'Siliragung')).toBe('SPPG SILIRAGUNG');
      expect(resolveRecipientSppgName('Rejoagung', undefined)).toBe('SPPG REJOAGUNG');
    });

    it('should render exact format in HTML template across HTG, ADIFRUITA, LUWENG BOGA, PROHE', () => {
      const stores = ['HTG', 'ADIFRUITA', 'LUWENG BOGA', 'PROHE'];

      for (const store of stores) {
        const html = generateInvoiceHtmlString({
          storeName: store,
          kitchenName: 'Cluring',
          items: [
            {
              id: '1',
              namaBarang: 'Beras Super',
              qty: 10,
              hargaJual: 14000,
              toko: store,
              tujuanDapur: 'Cluring',
              tanggal: '2026-07-27',
            } as any,
          ],
          invoiceNumber: 'INV/TEST/001',
          customTanggal: '2026-07-27',
        });

        // Tanggal with Day
        expect(html).toContain('Tanggal :</strong> SENIN, 27 Juli 2026');

        // Top-right recipient format:
        // Kepada Yth.
        // SPPG CLURING
        // -
        expect(html).toContain('Kepada Yth.');
        expect(html).toContain('SPPG CLURING');
        expect(html).toContain('>-<');

        // Tanda Terima:
        // Tanda Terima
        // (SPPG CLURING)
        expect(html).toContain('Tanda Terima');
        expect(html).toContain('(SPPG CLURING)');
      }
    });

    it('should render PROHE invoice with single combined stamp and signature and footer policy note', () => {
      const html = generateInvoiceHtmlString({
        storeName: 'UD PROHE WANGI',
        kitchenName: 'Cluring',
        items: [
          {
            id: '1',
            namaBarang: 'Beras Super',
            qty: 10,
            hargaJual: 14000,
            toko: 'PROHE',
            tujuanDapur: 'Cluring',
            tanggal: '2026-07-27',
          } as any,
        ],
        invoiceNumber: 'INV/PROHE/001',
        customTanggal: '2026-07-27',
        bayar: 100000,
      });

      // 1. Static store details
      expect(html).toContain('UD PROHE WANGI');
      expect(html).toContain('Dusun Glowong Rt 2 Rw 1 Desa Wringinagung');
      expect(html).toContain('085792083866');
      expect(html).toContain('Bank : <strong>BNI</strong>');
      expect(html).toContain('2098103145');
      expect(html).toContain('Prima Dana Nirwana');

      // 2. Single combined stamp and signature image
      expect(html).toContain('alt="Stempel & Tanda Tangan"');

      // 3. Footer policy note
      expect(html).toContain('Barang yang sudah dibeli tidak dapat ditukar/dikembalikan');

      // 4. Financial calculations
      expect(html).toContain('TOTAL');
      expect(html).toContain('BAYAR');
      expect(html).toContain('SISA');
    });
  });
});
