import { describe, expect, it } from 'vitest';
import { fetchAllRowsInBatches } from './paginatedFetch';

describe('fetchAllRowsInBatches', () => {
  it('memuat seluruh hasil ketika server membatasi respons pada 100 baris', async () => {
    const rows = Array.from({ length: 237 }, (_, id) => ({ id }));
    const offsets: number[] = [];

    const result = await fetchAllRowsInBatches(async (offset, pageSize) => {
      offsets.push(offset);
      return {
        data: rows.slice(offset, offset + Math.min(pageSize, 100)),
        error: null,
        count: rows.length,
      };
    });

    expect(result).toEqual(rows);
    expect(result).toHaveLength(237);
    expect(offsets).toEqual([0, 100, 200]);
  });

  it('memuat seluruh hasil lebih dari 1000 baris tanpa duplikat atau terpotong', async () => {
    const rows = Array.from({ length: 2107 }, (_, id) => ({ id }));
    const offsets: number[] = [];

    const result = await fetchAllRowsInBatches(async (offset, pageSize) => {
      offsets.push(offset);
      return {
        data: rows.slice(offset, offset + Math.min(pageSize, 1000)),
        error: null,
        count: rows.length,
      };
    });

    expect(result).toEqual(rows);
    expect(result).toHaveLength(2107);
    expect(new Set(result.map((row) => row.id)).size).toBe(2107);
    expect(offsets).toEqual([0, 1000, 2000]);
  });

  it('tetap membaca sampai halaman kosong jika total count tidak tersedia', async () => {
    const rows = Array.from({ length: 125 }, (_, id) => id);
    const result = await fetchAllRowsInBatches(async (offset, pageSize) => ({
      data: rows.slice(offset, offset + Math.min(pageSize, 50)),
      error: null,
    }));

    expect(result).toEqual(rows);
  });
});
