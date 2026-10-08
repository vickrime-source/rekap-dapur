// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { DriverDeliveryView } from './DriverDeliveryView';
import { BottomNav } from './BottomNav';
import { OrderItem } from '../types';
import { getTodayWIB } from '../lib/formatters';

describe('DriverDeliveryView - Halaman Khusus Pengiriman Driver', () => {
  let container: HTMLDivElement;
  const today = getTodayWIB();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  const mockOrders: OrderItem[] = [
    {
      id: 'ord-1',
      namaBarang: 'Beras Pandan Wangi 25Kg',
      qty: 2,
      satuan: 'Karung',
      hargaBeli: 320000,
      hargaJual: 350000,
      toko: 'HTG',
      tujuanDapur: 'Dapur Siliragung',
      pemasok: 'Pemasok Beras',
      status: 'pending',
      deliveryStatus: 'DRIVER',
      status_pengiriman: 'DRIVER',
      tanggal: today,
      createdAt: '2026-10-07T00:00:00Z',
    },
    {
      id: 'ord-2',
      namaBarang: 'Minyak Goreng 2L',
      qty: 6,
      satuan: 'Pcs',
      hargaBeli: 32000,
      hargaJual: 36000,
      toko: 'HTG',
      tujuanDapur: 'Dapur Siliragung',
      pemasok: 'Pemasok Sembako',
      status: 'pending',
      deliveryStatus: 'DRIVER',
      status_pengiriman: 'DRIVER',
      tanggal: today,
      createdAt: '2026-10-07T00:00:00Z',
    },
    {
      id: 'ord-3',
      namaBarang: 'Ayam Potong Broiler',
      qty: 15,
      satuan: 'Kg',
      hargaBeli: 35000,
      hargaJual: 42000,
      toko: 'HTG',
      tujuanDapur: 'Dapur Melati',
      pemasok: 'Pemasok Unggas',
      status: 'pending',
      deliveryStatus: 'PEMASOK', // BUKAN DRIVER -> Tidak boleh muncul
      status_pengiriman: 'PEMASOK',
      tanggal: today,
      createdAt: '2026-10-07T00:00:00Z',
    },
  ];

  it('hanya menampilkan item berstatus pengirim DRIVER dan tidak menampilkan item PEMASOK', async () => {
    const root = createRoot(container);
    const mockUpdateStatus = vi.fn();

    await act(async () => {
      root.render(
        <DriverDeliveryView
          orders={mockOrders}
          selectedDate="2026-10-07"
          onDateChange={vi.fn()}
          onUpdateDeliveryStatus={mockUpdateStatus}
          kitchens={[{ id: '1', nama: 'Dapur Siliragung', lokasi: 'Siliragung' }]}
        />
      );
    });

    const textContent = container.textContent || '';

    // Item DRIVER harus muncul
    expect(textContent).toContain('Beras Pandan Wangi 25Kg');
    expect(textContent).toContain('Minyak Goreng 2L');
    expect(textContent).toContain('Dapur Siliragung');

    // Item PEMASOK tidak boleh muncul
    expect(textContent).not.toContain('Ayam Potong Broiler');
  });

  it('memungkinkan driver mengklik tombol Tandai Selesai dan memanggil onUpdateDeliveryStatus dengan DONE', async () => {
    const root = createRoot(container);
    const mockUpdateStatus = vi.fn();

    await act(async () => {
      root.render(
        <DriverDeliveryView
          orders={mockOrders}
          selectedDate="2026-10-07"
          onDateChange={vi.fn()}
          onUpdateDeliveryStatus={mockUpdateStatus}
          kitchens={[{ id: '1', nama: 'Dapur Siliragung', lokasi: 'Siliragung' }]}
        />
      );
    });

    // Cari tombol "Tandai Selesai"
    const doneButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Tandai Selesai')
    );
    expect(doneButtons.length).toBeGreaterThan(0);

    // Klik tombol done item pertama
    await act(async () => {
      doneButtons[0].click();
    });

    expect(mockUpdateStatus).toHaveBeenCalledWith('ord-1', 'DONE');
  });

  it('memastikan BottomNav TIDAK memuat tombol DRIVER / Pengiriman dan hanya untuk navigasi utama', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <BottomNav
          activeTab="dashboard"
          onChangeTab={vi.fn()}
          onOpenManual={vi.fn()}
        />
      );
    });

    const text = container.textContent || '';
    expect(text).not.toContain('DRIVER');
    expect(text).toContain('Dashboard');
    expect(text).toContain('Transaksi');
    expect(text).toContain('PEMBELIAN');
  });

  it('memastikan tombol akses ke halaman utama dihapus dan hanya mengambil data dengan delivery status DRIVER', async () => {
    const mixedOrders: OrderItem[] = [
      {
        id: 'ord-driver',
        namaBarang: 'Cabai Rawit Merah',
        qty: 5,
        hargaBeli: 20000,
        hargaJual: 25000,
        toko: 'HTG',
        tujuanDapur: 'Dapur Banyuwangi',
        pemasok: 'Pemasok Cabai',
        status: 'pending',
        deliveryStatus: 'DRIVER',
        tanggal: today,
      },
      {
        id: 'ord-pemasok',
        namaBarang: 'Bawang Merah',
        qty: 10,
        hargaBeli: 15000,
        hargaJual: 18000,
        toko: 'HTG',
        tujuanDapur: 'Dapur Banyuwangi',
        pemasok: 'Pemasok Bawang',
        status: 'pending',
        deliveryStatus: 'PEMASOK',
        tanggal: today,
      },
      {
        id: 'ord-legacy-pending',
        namaBarang: 'Garam Dapur',
        qty: 2,
        hargaBeli: 5000,
        hargaJual: 6000,
        toko: 'HTG',
        tujuanDapur: 'Dapur Banyuwangi',
        pemasok: 'Pemasok Garam',
        status: 'pending',
        deliveryStatus: 'PENDING' as any,
        status_pengiriman: 'PENDING',
        tanggal: today,
      },
    ];

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <DriverDeliveryView
          orders={mixedOrders}
          selectedDate={today}
          onDateChange={vi.fn()}
          onUpdateDeliveryStatus={vi.fn()}
        />
      );
    });

    const text = container.textContent || '';
    // Tombol ke halaman utama harus tidak ada
    expect(text).not.toContain('Ke Halaman Utama');
    expect(container.querySelector('a')).toBeNull();

    // Hanya item DRIVER yang muncul
    expect(text).toContain('Cabai Rawit Merah');
    expect(text).not.toContain('Bawang Merah');
    expect(text).not.toContain('Garam Dapur');
  });
});
