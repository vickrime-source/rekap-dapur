import { OrderItem, InvoiceRecord, NoteItem, PeriodSummaryStats, MasterToko, MasterPemasok, MasterDapur } from '../types';
import { getFromCache, setInCache, invalidateCache } from './cacheManager';

export interface SupabaseStatusResult {
  success: boolean;
  configured: boolean;
  tablesReady?: boolean;
  url?: string;
  counts?: {
    pesanan: number;
    transaksi: number;
    notes: number;
  };
  errors?: string[];
  message?: string;
}

// -----------------------------------------------------------------------------
// Status & Health Check
// -----------------------------------------------------------------------------
export async function checkSupabaseStatus(): Promise<SupabaseStatusResult> {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) {
      return {
        success: false,
        configured: false,
        message: `HTTP Error ${res.status}: Gagal menghubungi server Supabase`,
      };
    }
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      configured: false,
      message: err?.message || 'Gagal memeriksa status koneksi Supabase',
    };
  }
}

// -----------------------------------------------------------------------------
// Mapper Functions: Convert between Database columns & TypeScript interfaces
// -----------------------------------------------------------------------------
export function mapRawOrder(row: any): OrderItem {
  const payStatus = (row.status_pembayaran || row.paymentStatus || 'UNPAID').toString().toUpperCase();
  const delStatus = (row.status_pengiriman || row.deliveryStatus || 'PENDING').toString().toUpperCase();
  const orderStatus = (payStatus === 'PAID' && delStatus === 'DONE') ? 'selesai' : (row.status || 'pending');

  const tokoNama = (typeof row.toko === 'object' && row.toko !== null) ? (row.toko.nama || '') : (row.toko || '');
  const pemasokNama = (typeof row.pemasok === 'object' && row.pemasok !== null) ? (row.pemasok.nama || '') : (row.pemasok || '');
  const dapurNama = (typeof row.dapur === 'object' && row.dapur !== null) ? (row.dapur.nama || '') : (row.dapur || row.tujuanDapur || row.tujuan_dapur || '');

  const tokoId = row.toko_id || row.tokoId || (typeof row.toko === 'object' && row.toko !== null ? row.toko.id : undefined);
  const pemasokId = row.pemasok_id || row.pemasokId || (typeof row.pemasok === 'object' && row.pemasok !== null ? row.pemasok.id : undefined);
  const dapurId = row.dapur_id || row.dapurId || (typeof row.dapur === 'object' && row.dapur !== null ? row.dapur.id : undefined);

  return {
    id: String(row.id || `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
    namaBarang: row.item || row.namaBarang || row.nama_barang || '',
    qty: Number(row.qty) || 0,
    satuan: row.satuan || 'Kg',
    hargaBeli: Number(row.harga_beli !== undefined ? row.harga_beli : row.hargaBeli) || 0,
    hargaJual: Number(row.harga_jual !== undefined ? row.harga_jual : row.hargaJual) || 0,
    toko: tokoNama,
    toko_id: tokoId,
    tokoId: tokoId,
    tujuanDapur: dapurNama,
    dapur_id: dapurId,
    dapurId: dapurId,
    pemasok: pemasokNama,
    pemasok_id: pemasokId,
    pemasokId: pemasokId,
    status: orderStatus as 'pending' | 'selesai',
    paymentStatus: ['PAID', 'UNPAID'].includes(payStatus) ? (payStatus as 'PAID' | 'UNPAID') : 'UNPAID',
    deliveryStatus: ['DONE', 'PENDING'].includes(delStatus) ? (delStatus as 'DONE' | 'PENDING') : 'PENDING',
    tanggal: row.tanggal ? String(row.tanggal).split('T')[0] : new Date().toISOString().split('T')[0],
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    catatan: row.catatan || '',
    cashback: row.cashback !== undefined && row.cashback !== null ? Number(row.cashback) : 0,
  };
}

export function buildPesananPayload(item: Partial<OrderItem>) {
  const payStatus = (item.paymentStatus || (item.status === 'selesai' ? 'PAID' : 'UNPAID')).toUpperCase();
  const delStatus = (item.deliveryStatus || (item.status === 'selesai' ? 'DONE' : 'PENDING')).toUpperCase();

  return {
    ...(item.id ? { id: item.id } : {}),
    toko_id: item.toko_id || item.tokoId || null,
    pemasok_id: item.pemasok_id || item.pemasokId || null,
    dapur_id: item.dapur_id || item.dapurId || null,
    dapur: item.tujuanDapur || '',
    item: item.namaBarang || '',
    tanggal: item.tanggal || new Date().toISOString().split('T')[0],
    qty: Number(item.qty) || 1,
    satuan: item.satuan || 'Kg',
    toko: item.toko || '',
    pemasok: item.pemasok || '',
    status_pembayaran: ['PAID', 'UNPAID'].includes(payStatus) ? payStatus : 'UNPAID',
    status_pengiriman: ['DONE', 'PENDING'].includes(delStatus) ? delStatus : 'PENDING',
    status: (payStatus === 'PAID' && delStatus === 'DONE') ? 'selesai' : (item.status || 'pending'),
    harga_jual: Number(item.hargaJual) || 0,
    harga_beli: Number(item.hargaBeli) || 0,
    cashback: Number(item.cashback) || 0,
    catatan: item.catatan || '',
  };
}

export function mapRawInvoice(row: any): InvoiceRecord {
  const items = Array.isArray(row.items) ? row.items.map(mapRawOrder) : [];
  const tokoNama = (typeof row.toko === 'object' && row.toko !== null) ? (row.toko.nama || '') : (row.toko || '');
  const pemasokNama = (typeof row.pemasok === 'object' && row.pemasok !== null) ? (row.pemasok.nama || '') : (row.pemasok || '');
  const dapurNama = (typeof row.dapur === 'object' && row.dapur !== null) ? (row.dapur.nama || '') : (row.dapur || row.tujuanDapur || '');

  return {
    id: String(row.id || `inv-${Date.now()}`),
    invoiceNumber: row.invoice_number || row.invoiceNumber || '',
    tanggalPrint: row.tanggal_print || row.tanggalPrint || new Date().toLocaleDateString('id-ID'),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    tujuanDapur: dapurNama,
    dapur_id: row.dapur_id || row.dapurId || (typeof row.dapur === 'object' ? row.dapur?.id : undefined),
    dapurId: row.dapur_id || row.dapurId || (typeof row.dapur === 'object' ? row.dapur?.id : undefined),
    toko: tokoNama,
    toko_id: row.toko_id || row.tokoId || (typeof row.toko === 'object' ? row.toko?.id : undefined),
    tokoId: row.toko_id || row.tokoId || (typeof row.toko === 'object' ? row.toko?.id : undefined),
    pemasok: pemasokNama,
    pemasok_id: row.pemasok_id || row.pemasokId || (typeof row.pemasok === 'object' ? row.pemasok?.id : undefined),
    pemasokId: row.pemasok_id || row.pemasokId || (typeof row.pemasok === 'object' ? row.pemasok?.id : undefined),
    items: items,
    totalBeli: Number(row.harga_beli !== undefined ? row.harga_beli : row.totalBeli) || 0,
    totalJual: Number(row.total !== undefined ? row.total : row.totalJual) || 0,
    totalProfit: Number(row.total_profit !== undefined ? row.total_profit : row.totalProfit) || 0,
    status: row.status_pembayaran || row.status || 'PAID',
  };
}

export function buildTransaksiPayload(record: Partial<InvoiceRecord>) {
  return {
    ...(record.id ? { id: record.id } : {}),
    invoice_number: record.invoiceNumber || `INV-${Date.now()}`,
    tanggal: record.createdAt ? record.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
    tanggal_print: record.tanggalPrint || new Date().toLocaleDateString('id-ID'),
    pemasok_id: record.pemasok_id || record.pemasokId || null,
    pemasok: record.pemasok || '',
    toko_id: record.toko_id || record.tokoId || null,
    toko: record.toko || '',
    dapur_id: record.dapur_id || record.dapurId || null,
    dapur: record.tujuanDapur || '',
    barang: (record.items || []).map((i) => `${i.namaBarang} (${i.qty})`).join(', '),
    qty: (record.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0),
    harga_beli: Number(record.totalBeli) || 0,
    total: Number(record.totalJual) || 0,
    total_profit: Number(record.totalProfit) || 0,
    status_pembayaran: record.status || 'PAID',
    items: record.items || [],
  };
}

export function mapRawNote(row: any): NoteItem {
  let rawCatatan = row.catatan || '';
  let toko = row.toko || '';
  let pemasok = row.pemasok || '';

  // Ekstrak meta toko/pemasok jika tersimpan di catatan
  const metaMatch = rawCatatan.match(/^\[META:TOKO=([^|]*)\|PEMASOK=([^\]]*)\]\s*/);
  if (metaMatch) {
    if (!toko) toko = metaMatch[1];
    if (!pemasok) pemasok = metaMatch[2];
    rawCatatan = rawCatatan.replace(metaMatch[0], '').trim();
  }

  return {
    id: String(row.id || `note-${Date.now()}`),
    tujuanDapur: row.dapur || row.tujuanDapur || '',
    toko: toko || undefined,
    pemasok: pemasok || undefined,
    namaBarang: row.item || row.namaBarang || '',
    qty: row.qty !== undefined && row.qty !== null ? Number(row.qty) : undefined,
    satuan: row.satuan || 'Kg',
    catatan: rawCatatan,
    status: row.status || (row.is_done ? 'DONE' : 'FOLLOW UP'),
    isDone: Boolean(row.is_done !== undefined ? row.is_done : row.isDone),
    orderId: row.order_id || row.orderId,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
  };
}

export function buildNotesPayload(note: Partial<NoteItem>) {
  let finalCatatan = (note.catatan || '').trim();
  const tokoVal = (note.toko || '').trim();
  const pemasokVal = (note.pemasok || '').trim();

  // Simpan metadata toko & pemasok di awal catatan agar persist aman
  if ((tokoVal || pemasokVal) && !finalCatatan.startsWith('[META:TOKO=')) {
    finalCatatan = `[META:TOKO=${tokoVal}|PEMASOK=${pemasokVal}] ${finalCatatan}`.trim();
  }

  return {
    ...(note.id ? { id: note.id } : {}),
    dapur: note.tujuanDapur || '',
    item: note.namaBarang || '',
    qty: note.qty !== undefined && note.qty !== null ? Number(note.qty) : null,
    satuan: note.satuan || 'Kg',
    catatan: finalCatatan,
    status: note.status || (note.isDone ? 'DONE' : 'FOLLOW UP'),
    is_done: Boolean(note.isDone),
    order_id: note.orderId || null,
  };
}

// -----------------------------------------------------------------------------
// Orders (pesanan) CRUD via Supabase API
// -----------------------------------------------------------------------------
export async function fetchOrdersFromDb(params?: {
  period?: 'hari_ini' | 'mingguan' | 'bulan_ini' | 'all_time';
  date?: string;
  startDate?: string;
  endDate?: string;
  toko?: string;
  dapur?: string;
  limit?: number;
  page?: number;
  forceRefresh?: boolean;
}): Promise<{ success: boolean; orders: OrderItem[]; error?: string }> {
  // Always fetch fresh from Supabase - bypass cacheManager completely for /api/pesanan
  try {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.set('period', params.period);
    if (params?.date) searchParams.set('date', params.date);
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    if (params?.toko) searchParams.set('toko', params.toko);
    if (params?.dapur) searchParams.set('dapur', params.dapur);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.page) searchParams.set('page', String(params.page));
    // Cache buster parameter to prevent any browser/service worker HTTP caching
    searchParams.set('_t', String(Date.now()));

    const url = `/api/pesanan?${searchParams.toString()}`;
    const res = await fetch(url, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      return { success: false, orders: [], error: json.error || 'Gagal memuat pesanan dari Supabase' };
    }

    const orders = (json.data || []).map(mapRawOrder);
    return { success: true, orders };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Koneksi ke Supabase terputus';
    return { success: false, orders: [], error: msg };
  }
}

export async function saveOrderToDb(order: OrderItem): Promise<{ success: boolean; error?: string; data?: OrderItem }> {
  try {
    const payload = buildPesananPayload(order);
    const res = await fetch('/api/pesanan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal menyimpan pesanan ke Supabase' };
    }
    // Invalidate pesanan and summary cache
    invalidateCache('pesanan');
    invalidateCache('summary');
    const createdItem = json.data?.[0] ? mapRawOrder(json.data[0]) : order;
    return { success: true, data: createdItem };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error saat menyimpan pesanan' };
  }
}

export async function updateOrderInDb(id: string, updates: Partial<OrderItem>): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = buildPesananPayload(updates);
    const res = await fetch(`/api/pesanan?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal memperbarui pesanan di Supabase' };
    }
    // Invalidate pesanan and summary cache
    invalidateCache('pesanan');
    invalidateCache('summary');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error saat update pesanan' };
  }
}

export async function batchUpdateStatusInDb(
  ids: string[],
  updates: { paymentStatus?: 'PAID' | 'UNPAID'; deliveryStatus?: 'DONE' | 'PENDING' | 'SHIPPED'; status?: 'pending' | 'selesai' }
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/pesanan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'batch_status', ids, ...updates }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal update status batch di Supabase' };
    }
    invalidateCache('pesanan');
    invalidateCache('summary');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error saat update status batch' };
  }
}

export async function deleteOrderFromDb(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/pesanan?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal menghapus pesanan dari Supabase' };
    }
    invalidateCache('pesanan');
    invalidateCache('summary');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error saat menghapus pesanan' };
  }
}

export async function deleteOrdersFromDb(ids: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/pesanan', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal menghapus pesanan dari Supabase' };
    }
    invalidateCache('pesanan');
    invalidateCache('summary');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error saat menghapus pesanan' };
  }
}

// -----------------------------------------------------------------------------
// Transactions (transaksi) CRUD via Supabase API
// -----------------------------------------------------------------------------
export async function fetchTransactionsFromDb(limit: number = 50, page: number = 1, forceRefresh = false): Promise<{ success: boolean; transactions: InvoiceRecord[]; error?: string }> {
  const cacheKey = `transaksi_${limit}_${page}`;
  if (!forceRefresh) {
    const cached = getFromCache<InvoiceRecord[]>(cacheKey);
    if (cached) {
      return { success: true, transactions: cached };
    }
  }

  try {
    const res = await fetch(`/api/transaksi?limit=${limit}&page=${page}`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, transactions: [], error: json.error || 'Gagal memuat transaksi' };
    }
    const transactions = (json.data || []).map(mapRawInvoice);
    setInCache(cacheKey, transactions);
    return { success: true, transactions };
  } catch (err: any) {
    return { success: false, transactions: [], error: err?.message || 'Koneksi ke Supabase terputus' };
  }
}

export async function saveTransactionToDb(record: InvoiceRecord): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = buildTransaksiPayload(record);
    const res = await fetch('/api/transaksi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal menyimpan transaksi ke Supabase' };
    }
    invalidateCache('transaksi');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error saat menyimpan transaksi' };
  }
}

export async function deleteTransactionFromDb(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/transaksi?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal menghapus transaksi dari Supabase' };
    }
    invalidateCache('transaksi');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error saat menghapus transaksi' };
  }
}

// -----------------------------------------------------------------------------
// Notes (notes) CRUD via Supabase API
// -----------------------------------------------------------------------------
export async function fetchNotesFromDb(forceRefresh = false): Promise<{ success: boolean; notes: NoteItem[]; error?: string }> {
  const cacheKey = 'notes_all';
  if (!forceRefresh) {
    const cached = getFromCache<NoteItem[]>(cacheKey);
    if (cached) {
      return { success: true, notes: cached };
    }
  }

  try {
    const res = await fetch('/api/notes');
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, notes: [], error: json.error || 'Gagal memuat catatan' };
    }
    const notes = (json.data || []).map(mapRawNote);
    setInCache(cacheKey, notes);
    return { success: true, notes };
  } catch (err: any) {
    return { success: false, notes: [], error: err?.message || 'Koneksi ke Supabase terputus' };
  }
}

export async function saveNoteToDb(note: NoteItem): Promise<{ success: boolean; error?: string; data?: NoteItem }> {
  try {
    const payload = buildNotesPayload(note);
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal menyimpan catatan ke Supabase' };
    }
    invalidateCache('notes');
    const createdNote = json.data ? mapRawNote(json.data) : note;
    return { success: true, data: createdNote };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error saat menyimpan catatan' };
  }
}

export async function updateNoteInDb(id: string, updates: Partial<NoteItem>): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = buildNotesPayload(updates);
    const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal memperbarui catatan di Supabase' };
    }
    invalidateCache('notes');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error saat memperbarui catatan' };
  }
}

export async function deleteNoteFromDb(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal menghapus catatan dari Supabase' };
    }
    invalidateCache('notes');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error saat menghapus catatan' };
  }
}

// -----------------------------------------------------------------------------
// Database-Side Period Summary & Weekly Store Report (Query Supabase Langsung!)
// -----------------------------------------------------------------------------
export async function fetchPeriodSummaryFromDb(
  period: 'hari_ini' | 'mingguan' | 'bulan_ini' | 'all_time' | 'custom' = 'mingguan',
  date?: string,
  startDate?: string,
  endDate?: string,
  forceRefresh = false
): Promise<{ success: boolean; stats?: PeriodSummaryStats; error?: string }> {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const cacheKey = `summary_${period}_${targetDate}_${startDate || ''}_${endDate || ''}`;

  if (!forceRefresh) {
    const cached = getFromCache<PeriodSummaryStats>(cacheKey);
    if (cached) {
      return { success: true, stats: cached };
    }
  }

  try {
    const params = new URLSearchParams({
      action: 'period_summary',
      period,
      date: targetDate,
    });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    const res = await fetch(`/api/pesanan?${params.toString()}`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal menghitung statistik di database' };
    }
    const stats = json.data as PeriodSummaryStats;
    setInCache(cacheKey, stats);
    return { success: true, stats };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal memuat rekap periode dari database';
    return { success: false, error: msg };
  }
}

// -----------------------------------------------------------------------------
// BACKWARD COMPATIBILITY EXPORTS (To seamlessly replace legacy googleSheets.ts)
// -----------------------------------------------------------------------------
export async function fetchSheetData(sheetName: 'pesanan' | 'transaksi' | 'notes'): Promise<any[]> {
  if (sheetName === 'pesanan') {
    const res = await fetchOrdersFromDb({ period: 'all_time' });
    return res.orders;
  } else if (sheetName === 'transaksi') {
    const res = await fetchTransactionsFromDb();
    return res.transactions;
  } else {
    const res = await fetchNotesFromDb();
    return res.notes;
  }
}

export async function addRow(sheetName: 'pesanan' | 'transaksi' | 'notes', rowData: any) {
  if (sheetName === 'pesanan') {
    return await saveOrderToDb(rowData);
  } else if (sheetName === 'transaksi') {
    return await saveTransactionToDb(rowData);
  } else {
    return await saveNoteToDb(rowData);
  }
}

export async function updateRow(sheetName: 'pesanan' | 'transaksi' | 'notes', options: any) {
  const targetId = options.id || options.match?.id || options.match?.ID || options.data?.id;
  if (sheetName === 'pesanan' && targetId) {
    return await updateOrderInDb(String(targetId), options.data || {});
  } else if (sheetName === 'notes' && targetId) {
    return await updateNoteInDb(String(targetId), options.data || {});
  }
  return { success: true };
}

export async function deleteRow(sheetName: 'pesanan' | 'transaksi' | 'notes', options: any) {
  const targetId = options.id || options.match?.id;
  const targetIds = options.ids || options.rowIndices;
  if (sheetName === 'pesanan') {
    if (targetIds && targetIds.length > 0) {
      return await deleteOrdersFromDb(targetIds.map(String));
    } else if (targetId) {
      return await deleteOrderFromDb(String(targetId));
    }
  } else if (sheetName === 'transaksi') {
    if (targetId) return await deleteTransactionFromDb(String(targetId));
  } else if (sheetName === 'notes') {
    if (targetId) return await deleteNoteFromDb(String(targetId));
  }
  return { success: true };
}

export async function updateGroupStatus(
  options: {
    match: { DATE: string; DAPUR: string; TOKO: string };
    type: 'payment' | 'delivery';
    status: 'PAID' | 'UNPAID' | 'DONE' | 'PENDING';
    items?: OrderItem[];
  }
) {
  const ids = (options.items || []).map((i) => i.id).filter(Boolean);
  if (ids.length > 0) {
    if (options.type === 'payment') {
      return await batchUpdateStatusInDb(ids, { paymentStatus: options.status as 'PAID' | 'UNPAID' });
    } else {
      return await batchUpdateStatusInDb(ids, { deliveryStatus: options.status as 'DONE' | 'PENDING' });
    }
  }
  return { success: true };
}

// -----------------------------------------------------------------------------
// MASTER DATA (toko, pemasok, dapur) Client APIs
// -----------------------------------------------------------------------------

export async function fetchMasterTokoFromDb(): Promise<{ success: boolean; data: MasterToko[]; error?: string }> {
  try {
    const res = await fetch(`/api/master?type=toko&_t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, data: [], error: json.error || 'Gagal memuat data toko' };
    }
    return { success: true, data: json.data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err?.message || 'Koneksi error' };
  }
}

export async function saveMasterTokoToDb(nama: string): Promise<{ success: boolean; data?: MasterToko; error?: string }> {
  try {
    const res = await fetch('/api/master?type=toko', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: nama.trim() }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal menambahkan toko' };
    }
    return { success: true, data: json.data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Koneksi error' };
  }
}

export async function deleteMasterTokoFromDb(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`/api/master?type=toko&id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal menghapus toko' };
    }
    return { success: true, message: json.message };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Koneksi error' };
  }
}

export async function fetchMasterPemasokFromDb(): Promise<{ success: boolean; data: MasterPemasok[]; error?: string }> {
  try {
    const res = await fetch(`/api/master?type=pemasok&_t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, data: [], error: json.error || 'Gagal memuat data pemasok' };
    }
    return { success: true, data: json.data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err?.message || 'Koneksi error' };
  }
}

export async function saveMasterPemasokToDb(nama: string): Promise<{ success: boolean; data?: MasterPemasok; error?: string }> {
  try {
    const res = await fetch('/api/master?type=pemasok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: nama.trim() }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal menambahkan pemasok' };
    }
    return { success: true, data: json.data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Koneksi error' };
  }
}

export async function deleteMasterPemasokFromDb(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`/api/master?type=pemasok&id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal menghapus pemasok' };
    }
    return { success: true, message: json.message };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Koneksi error' };
  }
}

export async function fetchMasterDapurFromDb(): Promise<{ success: boolean; data: MasterDapur[]; error?: string }> {
  try {
    const res = await fetch(`/api/master?type=dapur&_t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, data: [], error: json.error || 'Gagal memuat data dapur' };
    }
    return { success: true, data: json.data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err?.message || 'Koneksi error' };
  }
}

export async function saveMasterDapurToDb(nama: string, alamat?: string): Promise<{ success: boolean; data?: MasterDapur; error?: string }> {
  try {
    const res = await fetch('/api/master?type=dapur', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: nama.trim(), alamat: alamat?.trim() || '' }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal menambahkan dapur' };
    }
    return { success: true, data: json.data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Koneksi error' };
  }
}

export async function deleteMasterDapurFromDb(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`/api/master?type=dapur&id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal menghapus dapur' };
    }
    return { success: true, message: json.message };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Koneksi error' };
  }
}

export async function checkMasterUsageFromDb(
  type: 'toko' | 'pemasok' | 'dapur',
  id: string,
  name?: string
): Promise<{ success: boolean; isUsed: boolean; orderCount: number; transaksiCount: number; message: string }> {
  try {
    const q = new URLSearchParams({ type, id, name: name || '' });
    const res = await fetch(`/api/master?action=check_usage&${q.toString()}`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      return {
        success: false,
        isUsed: false,
        orderCount: 0,
        transaksiCount: 0,
        message: json.error || 'Gagal memeriksa penggunaan data',
      };
    }
    return json;
  } catch (err: any) {
    return {
      success: false,
      isUsed: false,
      orderCount: 0,
      transaksiCount: 0,
      message: err?.message || 'Error memeriksa ketergantungan data',
    };
  }
}
