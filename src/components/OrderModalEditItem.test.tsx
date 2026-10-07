// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { OrderModal } from './OrderModal';
import { OrderItem } from '../types';

describe('OrderModal - Edit Pesanan dengan Fitur Tambah Item Baru', () => {
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

  const mockExistingOrder: OrderItem = {
    id: 'ord-123',
    namaBarang: 'Daging Ayam Fillet',
    qty: 10,
    satuan: 'Kg',
    hargaBeli: 35000,
    hargaJual: 45000,
    toko: 'HTG',
    tujuanDapur: 'Dapur Siliragung',
    pemasok: 'Pemasok Ayam Jaya',
    status: 'pending',
    tanggal: '2026-10-06',
    paymentStatus: 'UNPAID',
    deliveryStatus: 'PENDING',
    notaId: 'nota-999',
    invoiceNumber: 'HTG/001/X/2026',
    catatan: 'Catatan ayam',
  };

  it('menampilkan tombol Tambah Item Baru di mode Edit Pesanan dan dapat menambah item baru', async () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    await act(async () => {
      root.render(
        <OrderModal
          isOpen={true}
          onClose={handleClose}
          onSave={handleSave}
          initialData={mockExistingOrder}
          kitchens={[{ id: 'k1', nama: 'Dapur Siliragung', lokasi: 'Siliragung' }]}
          stores={[{ id: 's1', nama: 'HTG' }]}
          pemasokList={['Pemasok Ayam Jaya']}
          selectedDate="2026-10-06"
        />
      );
    });

    // 1. Memastikan judul modal adalah 'Edit Pesanan'
    expect(container.textContent).toContain('Edit Pesanan');

    // 2. Tombol tambah item barang harus tersedia di mode edit pesanan
    const btnTambah = container.querySelector('#btn-tambah-item-barang') as HTMLButtonElement;
    expect(btnTambah).not.toBeNull();
    expect(btnTambah.textContent).toContain('Tambah Item Baru');

    // 3. Tombol header tambah item juga tersedia
    const btnHeaderTambah = container.querySelector('#btn-header-tambah-item') as HTMLButtonElement;
    expect(btnHeaderTambah).not.toBeNull();

    // 4. Klik tombol tambah item
    await act(async () => {
      btnTambah.click();
    });

    // 5. Sekarang terdapat 2 item dalam daftar/tab
    expect(container.textContent).toContain('Item #2 dari 2');
    expect(container.textContent).toContain('Daftar Barang (2 Item)');

    // 6. Isi item kedua menggunakan native input setter
    const inputNama = container.querySelector('#input-nama-barang') as HTMLInputElement;
    expect(inputNama).not.toBeNull();
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      nativeSetter?.call(inputNama, 'Bawang Merah Super');
      inputNama.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // 7. Simpan pesanan
    const btnSimpan = container.querySelector('#btn-simpan-pesanan') as HTMLButtonElement;
    expect(btnSimpan).not.toBeNull();
    expect(btnSimpan.textContent).toContain('Simpan Perubahan (2 Item)');

    await act(async () => {
      btnSimpan.click();
    });

    // 8. onSave dipanggil dengan array berisi kedua item dan editId ord-123
    expect(handleSave).toHaveBeenCalledTimes(1);
    const [savedData, editId] = handleSave.mock.calls[0];
    expect(editId).toBe('ord-123');
    expect(Array.isArray(savedData)).toBe(true);
    expect(savedData.length).toBe(2);
    expect(savedData[0].namaBarang).toBe('Daging Ayam Fillet');
    expect(savedData[1].namaBarang).toBe('Bawang Merah Super');
    expect(savedData[0].notaId).toBe('nota-999');
    expect(savedData[1].notaId).toBe('nota-999');
  });
});
