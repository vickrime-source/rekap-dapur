export interface SupabasePage<T> {
  data: T[] | null;
  error: unknown;
  count?: number | null;
}

/**
 * Read every row from a range-limited API, advancing by the number actually
 * returned so server-side max-row caps smaller than pageSize are safe too.
 */
export async function fetchAllRowsInBatches<T>(
  fetchPage: (offset: number, pageSize: number) => Promise<SupabasePage<T>>,
  pageSize = 1000,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error('pageSize harus berupa bilangan bulat positif.');
  }

  const rows: T[] = [];
  let offset = 0;
  let expectedCount: number | null = null;

  while (true) {
    const page = await fetchPage(offset, pageSize);
    if (page.error) throw page.error;
    if (expectedCount === null && typeof page.count === 'number') {
      expectedCount = page.count;
    }

    const pageRows = page.data || [];
    if (pageRows.length === 0) {
      if (expectedCount !== null && offset < expectedCount) {
        throw new Error(`Pemuatan data terpotong: ${offset} dari ${expectedCount} baris berhasil dibaca.`);
      }
      return rows;
    }

    rows.push(...pageRows);
    offset += pageRows.length;
    if (expectedCount !== null && offset >= expectedCount) return rows;
  }
}
