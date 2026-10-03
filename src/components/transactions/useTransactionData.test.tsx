// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InvoiceRecord, OrderItem } from '../../types';
import { useTransactionData } from './useTransactionData';

const order: OrderItem = {
  id: 'ord-1',
  notaId: 'nota-123',
  nota_id: 'nota-123',
  namaBarang: 'Apel',
  qty: 1,
  hargaBeli: 85585,
  hargaJual: 785142,
  toko: 'LB / Luweng Boga',
  tujuanDapur: 'Siliragung',
  pemasok: 'Bu Tiah',
  status: 'pending',
  tanggal: '2026-10-03',
};

const invoice: InvoiceRecord = {
  id: 'tx-1',
  invoiceNumber: 'TRX-1',
  tanggalPrint: '2026-10-03',
  createdAt: '2026-10-03T05:00:00.000Z',
  tujuanDapur: 'Siliragung',
  toko: 'LB / Luweng Boga',
  pemasok: 'Bu Tiah',
  items: [{ ...order }],
  totalBeli: 85585,
  totalJual: 785142,
  totalProfit: 699557,
};

describe('rekap transaksi pesanan dan snapshot invoice', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const renderData = async (orders: OrderItem[], invoices: InvoiceRecord[]) => {
    let result: ReturnType<typeof useTransactionData> | undefined;
    function Harness() {
      result = useTransactionData({
        orders,
        invoices,
        selectedMonth: '2026-10',
        activePeriod: 'all_time',
        customRange: null,
        selectedStoreFilter: 'all',
        selectedPemasok: 'all',
        selectedDapurFilter: 'all',
        selectedStatusFilter: 'all',
        searchQuery: '',
      });
      return null;
    }
    await act(async () => root.render(<Harness />));
    return result!;
  };

  it('menampilkan satu baris dengan tanggal asli dan tidak menggandakan total', async () => {
    const data = await renderData([order], [invoice]);
    expect(data.filteredBatches).toHaveLength(1);
    expect(data.filteredBatches[0].tanggal).toBe('2026-10-03');
    expect(data.filteredBatches[0].tujuanDapur).toBe('Siliragung');
    expect(data.summaryTotals.totalQty).toBe(1);
    expect(data.summaryTotals.totalBeli).toBe(85585);
    expect(data.summaryTotals.totalJual).toBe(785142);
  });

  it('mengenali snapshot walau ID item berubah tetapi ID nota sama', async () => {
    const data = await renderData([order], [{ ...invoice, items: [{ ...order, id: 'old-item-id' }] }]);
    expect(data.filteredBatches).toHaveLength(1);
  });

  it('tetap menampilkan invoice yang memang tidak memiliki pesanan terkait', async () => {
    const standalone = { ...invoice, id: 'tx-standalone', items: [{ ...order, id: 'ord-other', notaId: 'nota-other', nota_id: 'nota-other' }] };
    const data = await renderData([order], [invoice, standalone]);
    expect(data.filteredBatches).toHaveLength(2);
    expect(data.summaryTotals.totalJual).toBe(785142 * 2);
  });
});
