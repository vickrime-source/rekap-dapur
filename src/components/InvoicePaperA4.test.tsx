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
    expect(html).toContain('No. Invoice :');
    expect(html).toContain('INV-1');
  });

  it('selalu menampilkan baris No. Invoice tepat di atas Tanggal dengan nomor resmi', () => {
    const item: OrderItem = {
      id: 'test-2',
      namaBarang: 'Nila Utuh',
      qty: 20,
      hargaBeli: 27000,
      hargaJual: 30000,
      toko: 'PW / Prohe',
      tujuanDapur: 'Pak Cip',
      pemasok: 'Nur patin',
      status: 'pending',
      tanggal: '2026-10-08',
      invoiceNumber: 'PH/1/X/2026',
    };

    const htmlOri = renderToStaticMarkup(<InvoicePaperA4
      profile={getStoreProfile(item.toko)}
      styleConfig={getStoreInvoiceConfig(item.toko)}
      items={[item]}
      invoiceNumber="PH/1/X/2026"
      invoiceDate="KAMIS, 8 Oktober 2026"
      recipientName="SPPG PAK CIP"
      totalJual={600000}
      bayar={0}
      sisa={600000}
      priceVariant="ori"
    />);

    const htmlCashback = renderToStaticMarkup(<InvoicePaperA4
      profile={getStoreProfile(item.toko)}
      styleConfig={getStoreInvoiceConfig(item.toko)}
      items={[item]}
      invoiceNumber="PH/1/X/2026"
      invoiceDate="KAMIS, 8 Oktober 2026"
      recipientName="SPPG PAK CIP"
      totalJual={600000}
      bayar={0}
      sisa={600000}
      priceVariant="cashback"
    />);

    // Keduanya menampilkan nomor resmi yang sama persis di atas tanggal
    expect(htmlOri).toContain('No. Invoice :');
    expect(htmlOri).toContain('PH/1/X/2026');
    expect(htmlCashback).toContain('No. Invoice :');
    expect(htmlCashback).toContain('PH/1/X/2026');

    // Posisi No. Invoice sebelum Tanggal
    const idxInv = htmlOri.indexOf('No. Invoice :');
    const idxDate = htmlOri.indexOf('Tanggal :');
    expect(idxInv).toBeGreaterThan(-1);
    expect(idxDate).toBeGreaterThan(-1);
    expect(idxInv).toBeLessThan(idxDate);
  });

  it('jika nota belum memiliki nomor invoice, menampilkan strip "-" tanpa menyembunyikan barisnya', () => {
    const item: OrderItem = {
      id: 'test-3',
      namaBarang: 'Nila Utuh',
      qty: 20,
      hargaBeli: 27000,
      hargaJual: 30000,
      toko: 'PW / Prohe',
      tujuanDapur: 'Pak Cip',
      pemasok: 'Nur patin',
      status: 'pending',
      tanggal: '2026-10-08',
    };

    const html = renderToStaticMarkup(<InvoicePaperA4
      profile={getStoreProfile(item.toko)}
      styleConfig={getStoreInvoiceConfig(item.toko)}
      items={[item]}
      invoiceNumber=""
      invoiceDate="KAMIS, 8 Oktober 2026"
      recipientName="SPPG PAK CIP"
      totalJual={600000}
      bayar={0}
      sisa={600000}
    />);

    expect(html).toContain('No. Invoice :');
    expect(html).toContain('-');
  });
});
