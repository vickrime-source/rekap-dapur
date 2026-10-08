// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { ActionMenuPortal } from './ActionMenuPortal';
import { OrderItem } from '../types';

describe('ActionMenuPortal - Langsung Edit Pesanan (Bukan Satu-Satu)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  const mockItems: OrderItem[] = [
    {
      id: 'item-1',
      namaBarang: 'Beras Pandan Wangi',
      qty: 25,
      satuan: 'Kg',
      hargaBeli: 14000,
      hargaJual: 16000,
      toko: 'HTG',
      tujuanDapur: 'Dapur Utama',
      pemasok: 'Pemasok Sembako',
      status: 'pending',
      tanggal: '2026-10-06',
      createdAt: '2026-10-06T00:00:00Z',
    },
    {
      id: 'item-2',
      namaBarang: 'Minyak Goreng 2L',
      qty: 10,
      satuan: 'Pcs',
      hargaBeli: 32000,
      hargaJual: 36000,
      toko: 'HTG',
      tujuanDapur: 'Dapur Utama',
      pemasok: 'Pemasok Sembako',
      status: 'pending',
      tanggal: '2026-10-06',
      createdAt: '2026-10-06T00:00:00Z',
    },
  ];

  it('menyediakan tombol Edit Pesanan langsung untuk semua item dan tidak menampilkan tombol edit satuan yang terpisah', async () => {
    const root = createRoot(container);
    const mockOnEdit = vi.fn();
    const mockOnEditBatch = vi.fn();
    const mockOnClose = vi.fn();

    const dummyRect = {
      bottom: 200,
      top: 150,
      left: 100,
      right: 200,
      width: 100,
      height: 50,
      x: 100,
      y: 150,
      toJSON: () => {},
    } as DOMRect;

    await act(async () => {
      root.render(
        <ActionMenuPortal
          isOpen={true}
          targetRect={dummyRect}
          onClose={mockOnClose}
          items={mockItems}
          onEdit={mockOnEdit}
          onEditBatch={mockOnEditBatch}
          onDelete={vi.fn()}
        />
      );
    });

    // 1. Tombol Edit Langsung Pesanan tersedia
    const editBtn = document.querySelector('#btn-edit-pesanan-portal') as HTMLButtonElement;
    expect(editBtn).not.toBeNull();
    expect(editBtn.textContent).toContain('Edit Pesanan (2 Item)');

    // 2. Klik tombol Edit Pesanan memanggil onEditBatch dengan semua item
    await act(async () => {
      editBtn.click();
    });

    expect(mockOnEditBatch).toHaveBeenCalledWith(mockItems);
    expect(mockOnClose).toHaveBeenCalled();

    // 3. Pastikan tidak ada tombol edit individual per-item di dalam list
    const allEditButtons = Array.from(document.querySelectorAll('button')).filter((b) =>
      b.textContent?.trim() === 'Edit'
    );
    expect(allEditButtons.length).toBe(0);
  });
});
