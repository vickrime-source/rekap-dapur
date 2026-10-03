// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteItem, OrderItem } from '../types';

const db = vi.hoisted(() => ({
  saveOrderToDb: vi.fn(),
  saveNoteToDb: vi.fn(),
  updateNoteInDb: vi.fn(),
  deleteNoteFromDb: vi.fn(),
}));
vi.mock('../lib/supabaseDb', () => db);

import { useNotesOperations } from './useNotesOperations';

const note = (items?: NoteItem['items']): NoteItem => ({
  id: 'note-1',
  tujuanDapur: 'Siliragung',
  namaBarang: items?.[0]?.namaBarang || 'Apel',
  qty: items?.[0]?.qty || 10,
  satuan: 'Kg',
  catatan: 'Pesanan buah',
  isDone: false,
  createdAt: '2026-10-03T00:00:00.000Z',
  items,
});

const input = (itemIndex = 0) => ({
  noteId: 'note-1',
  itemIndex,
  namaBarang: itemIndex === 1 ? 'Jeruk' : 'Apel',
  qty: 10,
  satuan: 'Kg',
  toko: 'HTG',
  pemasok: 'Pemasok A',
  tujuanDapur: 'Siliragung',
  hargaBeli: 7000,
  hargaJual: 10000,
  tanggal: '2026-10-03',
});

describe('konversi Follow Up menjadi pesanan', () => {
  let root: Root;
  let container: HTMLDivElement;
  let currentNotes: NoteItem[];
  let currentOrders: OrderItem[];
  let convert: ReturnType<typeof useNotesOperations>['handleCompleteFollowUpNote'];

  const renderHook = async (initialNotes: NoteItem[]) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    function Harness() {
      const [notes, setNotes] = useState(initialNotes);
      const [orders, setOrders] = useState<OrderItem[]>([]);
      const operations = useNotesOperations({
        notes,
        setNotes,
        orders,
        setOrders,
        masterToko: [],
        masterPemasok: [],
        masterDapur: [],
        selectedDate: '2026-10-03',
        showToast: vi.fn(),
      });
      currentNotes = notes;
      currentOrders = orders;
      convert = operations.handleCompleteFollowUpNote;
      return null;
    }

    await act(async () => root.render(<Harness />));
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    db.saveOrderToDb.mockImplementation(async (order: OrderItem) => ({ success: true, data: order }));
    db.deleteNoteFromDb.mockResolvedValue({ success: true });
    db.updateNoteInDb.mockResolvedValue({ success: true });
  });

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    container?.remove();
  });

  it('menghapus Follow Up tunggal hanya setelah pesanan tersimpan', async () => {
    await renderHook([note()]);
    await act(async () => { await convert(input()); });
    expect(db.saveOrderToDb).toHaveBeenCalledOnce();
    expect(db.deleteNoteFromDb).toHaveBeenCalledWith('note-1');
    expect(db.saveOrderToDb.mock.invocationCallOrder[0]).toBeLessThan(db.deleteNoteFromDb.mock.invocationCallOrder[0]);
    expect(currentOrders).toHaveLength(1);
    expect(currentNotes).toHaveLength(0);
  });

  it('mempertahankan Follow Up jika pesanan gagal disimpan', async () => {
    db.saveOrderToDb.mockResolvedValue({ success: false, error: 'Server gagal' });
    await renderHook([note()]);
    let failed = false;
    await act(async () => {
      try { await convert(input()); } catch { failed = true; }
    });
    expect(failed).toBe(true);
    expect(db.deleteNoteFromDb).not.toHaveBeenCalled();
    expect(currentOrders).toHaveLength(0);
    expect(currentNotes).toHaveLength(1);
  });

  it('hanya mengeluarkan item yang diproses dari Follow Up multi-item', async () => {
    await renderHook([note([
      { id: 'apel', namaBarang: 'Apel', qty: 10, satuan: 'Kg' },
      { id: 'jeruk', namaBarang: 'Jeruk', qty: 5, satuan: 'Kg' },
    ])]);
    await act(async () => { await convert(input(1)); });
    expect(db.deleteNoteFromDb).not.toHaveBeenCalled();
    expect(db.updateNoteInDb).toHaveBeenCalledWith('note-1', expect.objectContaining({
      items: [expect.objectContaining({ id: 'apel' })],
    }));
    expect(currentOrders).toHaveLength(1);
    expect(currentNotes[0].items).toHaveLength(1);
    expect(currentNotes[0].namaBarang).toBe('Apel');
  });
});
