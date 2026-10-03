import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OrderItem } from '../types';
import { getStoreInvoiceConfig } from '../lib/invoiceStyles';
import { getStoreProfile } from '../lib/storeProfiles';
import { InvoicePaperA4 } from './InvoicePaperA4';

describe('tampilan invoice A4', () => {
  it('menampilkan bayar 0 dan sisa kosong tanpa mengubah total', () => {
    const item: OrderItem = {
      id: 'test-1',
      namaBarang: 'Ayam Fillet bersih',
      qty: 205,
      hargaBeli: 50000,
      hargaJual: 54000,
      toko: 'LA / Lumbung Adifruta',
      tujuanDapur: 'Rejoagung',
      pemasok: 'Bu Tiah',
      status: 'pending',
      tanggal: '2026-10-03',
    };
    const html = renderToStaticMarkup(<InvoicePaperA4
      profile={getStoreProfile(item.toko)}
      styleConfig={getStoreInvoiceConfig(item.toko)}
      items={[item]}
      invoiceNumber="INV-1"
      invoiceDate="3 Oktober 2026"
      recipientName="SPPG Rejoagung"
      totalJual={11070000}
      bayar={11070000}
      sisa={0}
    />);

    expect(html).toContain('11.070.000');
    expect(html).toMatch(/>BAYAR<\/td><td[^>]*>0<\/td>/);
    expect(html).toMatch(/>SISA<\/td><td[^>]*><\/td>/);
  });
});
