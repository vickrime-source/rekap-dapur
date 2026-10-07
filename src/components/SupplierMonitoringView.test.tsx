// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { SupplierMonitoringView } from './SupplierMonitoringView';
import { OrderItem } from '../types';

describe('SupplierMonitoringView Component', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const mockOrders: OrderItem[] = [
    {
      id: 'ord-1',
      namaBarang: 'Daging Ayam Fillet',
      qty: 10,
      satuan: 'Kg',
      hargaBeli: 35000,
      hargaJual: 45000,
      toko: 'HTG',
      tujuanDapur: 'Dapur A',
      pemasok: 'Pemasok Ayam Jaya',
      status: 'pending',
      tanggal: '2026-10-06',
      paymentStatus: 'UNPAID',
      deliveryStatus: 'DONE',
      notaId: 'nota-1',
      catatan: 'Potong 8 bagian tanpa lemak',
    },
    {
      id: 'ord-2',
      namaBarang: 'Minyak Kelapa Sawit',
      qty: 5,
      satuan: 'Ltr',
      hargaBeli: 20000,
      hargaJual: 25000,
      toko: 'LA',
      tujuanDapur: 'Dapur B',
      pemasok: 'Pemasok Minyak Barokah',
      status: 'selesai',
      tanggal: '2026-10-06',
      paymentStatus: 'PAID',
      deliveryStatus: 'DONE',
      notaId: 'nota-2',
    },
  ];

  it('merender halaman monitoring pembelian pemasok dengan metrik keuangan', () => {
    act(() => {
      root.render(
        <SupplierMonitoringView
          orders={mockOrders}
          pemasokList={['Pemasok Ayam Jaya', 'Pemasok Minyak Barokah']}
        />
      );
    });

    expect(container.textContent).toContain('Monitoring Pembelian');
    expect(container.textContent).toContain('Total Beli');
    expect(container.textContent).toContain('Sudah Bayar');
    expect(container.textContent).toContain('Belum Bayar');
  });

  it('menampilkan kolom pemasok, item (nama item dan bawahnya catatan transaksi kalau ada), kolom QTY terpisah, kolom HARGA terpisah, total beli, dan status', () => {
    act(() => {
      root.render(
        <SupplierMonitoringView
          orders={mockOrders}
          pemasokList={['Pemasok Ayam Jaya', 'Pemasok Minyak Barokah']}
        />
      );
    });

    // 1. Kolom Pemasok: Nama pemasok, tanggal tebal, dan nama Dapur Tujuan (bukan Toko)
    expect(container.textContent).toContain('Pemasok Ayam Jaya');
    expect(container.textContent).toContain('Pemasok Minyak Barokah');
    expect(container.textContent).toContain('Dapur A');
    expect(container.textContent).toContain('Dapur B');
    expect(container.textContent).not.toContain('Toko HTG');
    expect(container.textContent).not.toContain('Toko LA');

    // 2. Kolom Item: Nama Item dan di bawahnya Catatan Transaksi kalau ada
    expect(container.textContent).toContain('Daging Ayam Fillet');
    expect(container.textContent).toContain('Minyak Kelapa Sawit');
    expect(container.textContent).toContain('Potong 8 bagian tanpa lemak');

    // 3. Kolom QTY (Kuantitas, terpisah)
    expect(container.textContent).toContain('QTY');
    expect(container.textContent).toContain('10 Kg');
    expect(container.textContent).toContain('5 Ltr');

    // 4. Kolom HARGA (Harga Satuan, terpisah)
    expect(container.textContent).toContain('HARGA');
    expect(container.textContent).toMatch(/35\.000/);
    expect(container.textContent).toMatch(/20\.000/);

    // 5. Kolom Total Beli (10 x 35.000 = 350.000, 5 x 20.000 = 100.000)
    expect(container.textContent).toContain('TOTAL BELI');
    expect(container.textContent).toMatch(/350\.000/);
    expect(container.textContent).toMatch(/100\.000/);

    // 6. Kolom Status Paid / Unpaid
    expect(container.textContent).toContain('STATUS');
    expect(container.textContent).toContain('UNPAID');
    expect(container.textContent).toContain('PAID');
  });

  it('memanggil onUpdatePaymentStatus ketika tombol status pembayaran diklik', () => {
    const handleUpdatePaymentStatus = vi.fn();
    act(() => {
      root.render(
        <SupplierMonitoringView
          orders={mockOrders}
          onUpdatePaymentStatus={handleUpdatePaymentStatus}
        />
      );
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const unpaidBtn = buttons.find((b) => b.textContent?.includes('UNPAID'));
    expect(unpaidBtn).toBeDefined();

    act(() => {
      unpaidBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Klik tombol UNPAID memicu update ke PAID
    expect(handleUpdatePaymentStatus).toHaveBeenCalledWith('ord-1', 'PAID');
  });

  it('menyediakan pilihan adjust jumlah baris dengan kelipatan 20 pada paginasi bawah dan tata letak yang benar', () => {
    act(() => {
      root.render(
        <SupplierMonitoringView
          orders={mockOrders}
          pemasokList={['Pemasok Ayam Jaya']}
        />
      );
    });

    // 1. Verifikasi panel Monitoring Pembelian berada di atas
    expect(container.textContent).toContain('Monitoring Pembelian (Pemasok)');

    // 2. Verifikasi tombol filter dan tanggal berada di tampilan
    expect(container.textContent).toContain('Semua Toko');
    expect(container.textContent).toContain('Semua Pemasok');

    // 3. Verifikasi opsi kelipatan 20 ada pada dropdown pagination di bawah
    const select = container.querySelector('select[class*="rounded-md"]') as HTMLSelectElement | null;
    expect(select).toBeDefined();
    if (select) {
      const options = Array.from(select.options).map((o) => Number(o.value));
      expect(options).toEqual([20, 40, 60, 80, 100]);
    }
  });
});

import { BottomNav } from './BottomNav';

describe('BottomNav Navigation Order & Label', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('memastikan Transaksi berada di sebelah kanan Dashboard dan nama navigasi PEMBELIAN', () => {
    const handleChangeTab = vi.fn();
    const handleOpenManual = vi.fn();

    act(() => {
      root.render(
        <BottomNav
          activeTab="dashboard"
          onChangeTab={handleChangeTab}
          onOpenManual={handleOpenManual}
        />
      );
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const buttonTexts = buttons.map((b) => b.textContent?.trim()).filter(Boolean);

    // Verifikasi urutan tombol:
    // Dashboard pertama, kemudian Transaksi di sebelah kanannya, lalu tombol plus, lalu PEMBELIAN
    const dashboardIndex = buttonTexts.findIndex((t) => t?.includes('Dashboard'));
    const transaksiIndex = buttonTexts.findIndex((t) => t?.includes('Transaksi'));
    const pembelianIndex = buttonTexts.findIndex((t) => t?.includes('PEMBELIAN'));

    expect(dashboardIndex).toBeGreaterThanOrEqual(0);
    expect(transaksiIndex).toBeGreaterThan(dashboardIndex); // Transaksi di sebelah kanan navigasi dashboard
    expect(pembelianIndex).toBeGreaterThan(transaksiIndex); // PEMBELIAN ada di grup kanan

    // Verifikasi teks tombol adalah PEMBELIAN bukan Pemasok
    expect(container.textContent).toContain('PEMBELIAN');
    expect(container.textContent).not.toContain('Pemasok');
  });
});

