import { OrderItem, InvoiceRecord, NoteItem, FollowUpItemRow, PeriodSummaryStats, MasterToko, MasterPemasok, MasterDapur, MasterSatuan } from '../types';
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

  const STORE_MAP: Record<string, string> = {
    '1': 'LB / Luweng Boga',
    '2': 'HTG',
    '3': 'LA / Lumbung Adifruta',
    '4': 'PW / Prohe',
  };

  let rawToko = (typeof row.toko === 'object' && row.toko !== null) ? (row.toko.nama || '') : (row.toko || '');
  if (STORE_MAP[String(rawToko).trim()]) {
    rawToko = STORE_MAP[String(rawToko).trim()];
  }
  const tokoNama = rawToko;
  const pemasokNama = (typeof row.pemasok === 'object' && row.pemasok !== null) ? (row.pemasok.nama || '') : (row.pemasok || '');
  const dapurNama = (typeof row.dapur === 'object' && row.dapur !== null) ? (row.dapur.nama || '') : (row.dapur || row.tujuanDapur || row.tujuan_dapur || '');

  const cleanId = (val: any) => {
    if (val === undefined || val === null || val === '') return null;
    const n = Number(val);
    return !isNaN(n) && Number.isInteger(n) ? n : val;
  };

  const tokoId = cleanId(row.toko_id || (typeof row.toko === 'object' && row.toko !== null ? row.toko.id : undefined));
  const pemasokId = cleanId(row.pemasok_id || (typeof row.pemasok === 'object' && row.pemasok !== null ? row.pemasok.id : undefined));
  const dapurId = cleanId(row.dapur_id || (typeof row.dapur === 'object' && row.dapur !== null ? row.dapur.id : undefined));

  const rawQty = Number(row.qty) || 0;
  const rawQtyBeli = row.qty_beli !== undefined && row.qty_beli !== null
    ? Number(row.qty_beli)
    : (row.qtyBeli !== undefined && row.qtyBeli !== null ? Number(row.qtyBeli) : rawQty);
  const rawNotaId = row.nota_id || row.notaId || null;

  return {
    id: String(row.id || `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
    namaBarang: row.item || row.namaBarang || row.nama_barang || '',
    qty: rawQty,
    qtyBeli: rawQtyBeli,
    qty_beli: rawQtyBeli,
    notaId: rawNotaId,
    nota_id: rawNotaId,
    satuan: row.satuan || 'Kg',
    hargaBeli: Number(row.harga_beli !== undefined ? row.harga_beli : row.hargaBeli) || 0,
    hargaJual: Number(row.harga_jual !== undefined ? row.harga_jual : row.hargaJual) || 0,
    toko: tokoNama,
    toko_id: tokoId,
    tujuanDapur: dapurNama,
    dapur_id: dapurId,
    pemasok: pemasokNama,
    pemasok_id: pemasokId,
    status: (row.status === 'CANCELLED' ? 'CANCELLED' : (orderStatus as 'pending' | 'selesai')),
    statusPembatalan: row.status_pembatalan || row.statusPembatalan,
    status_pembatalan: row.status_pembatalan || row.statusPembatalan,
    cancelledAt: row.cancelled_at || row.cancelledAt,
    cancelled_at: row.cancelled_at || row.cancelledAt,
    cancelledReason: row.cancelled_reason || row.cancelledReason,
    cancelled_reason: row.cancelled_reason || row.cancelledReason,
    paymentStatus: ['PAID', 'UNPAID'].includes(payStatus) ? (payStatus as 'PAID' | 'UNPAID') : 'UNPAID',
    deliveryStatus: ['DONE', 'PENDING'].includes(delStatus) ? (delStatus as 'DONE' | 'PENDING') : 'PENDING',
    tanggal: row.tanggal ? String(row.tanggal).split('T')[0] : new Date().toISOString().split('T')[0],
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    catatan: row.catatan || '',
    cashback: row.cashback !== undefined && row.cashback !== null ? Number(row.cashback) : 0,
    retur: row.retur !== undefined && row.retur !== null ? Math.max(0, Number(row.retur) || 0) : 0,
    invoiceNumber: row.invoice_number || row.invoiceNumber || undefined,
    invoice_number: row.invoice_number || row.invoiceNumber || undefined,
  };
}

export function buildPesananPayload(item: Partial<OrderItem>) {
  const payStatus = (item.paymentStatus || (item.status === 'selesai' ? 'PAID' : 'UNPAID')).toUpperCase();
  const delStatus = (item.deliveryStatus || (item.status === 'selesai' ? 'DONE' : 'PENDING')).toUpperCase();

  const finalDapur = ((item.tujuanDapur || (item as any).dapur || (item as any).tujuan_dapur || '') as string).trim();
  const finalItem = ((item.namaBarang || (item as any).item || (item as any).nama_barang || '') as string).trim();

  // VALIDASI KETAT: Tolak jika nama barang atau dapur kosong (jangan izinkan item kosong masuk)
  if (!finalItem) {
    throw new Error('Validasi gagal: Nama barang tidak boleh kosong.');
  }
  if (!finalDapur) {
    throw new Error('Validasi gagal: Dapur tujuan tidak boleh kosong.');
  }

  const rawQty = Number(item.qty);
  const validQty = !isNaN(rawQty) ? rawQty : 0;
  const rawQtyBeli = item.qtyBeli !== undefined ? Number(item.qtyBeli) : (item.qty_beli !== undefined ? Number(item.qty_beli) : validQty);
  const notaId = item.nota_id || item.notaId || null;

  const cleanId = (val: any) => {
    if (val === undefined || val === null || val === '') return null;
    const n = Number(val);
    return !isNaN(n) && Number.isInteger(n) ? n : val;
  };

  const payload: Record<string, any> = {
    ...(item.id ? { id: item.id } : {}),
    toko_id: cleanId(item.toko_id || (item as any).tokoId),
    pemasok_id: cleanId(item.pemasok_id || (item as any).pemasokId),
    dapur_id: cleanId(item.dapur_id || (item as any).dapurId),
    dapur: finalDapur,
    tujuanDapur: finalDapur,
    tujuan_dapur: finalDapur,
    item: finalItem,
    namaBarang: finalItem,
    nama_barang: finalItem,
    tanggal: item.tanggal || new Date().toISOString().split('T')[0],
    qty: validQty,
    satuan: (item.satuan || '').trim() || 'Kg',
    toko: (item.toko || '').trim(),
    pemasok: (item.pemasok || '').trim(),
    status_pembayaran: ['PAID', 'UNPAID'].includes(payStatus) ? payStatus : 'UNPAID',
    status_pengiriman: ['DONE', 'PENDING'].includes(delStatus) ? delStatus : 'PENDING',
    status: (payStatus === 'PAID' && delStatus === 'DONE') ? 'selesai' : (item.status || 'pending'),
    harga_jual: Number(item.hargaJual !== undefined ? item.hargaJual : (item as any).harga_jual) || 0,
    harga_beli: Number(item.hargaBeli !== undefined ? item.hargaBeli : (item as any).harga_beli) || 0,
    cashback: Number(item.cashback) || 0,
    retur: Math.max(0, Number(item.retur) || 0),
    catatan: (item.catatan || '').trim(),
  };

  if (rawQtyBeli !== undefined && !isNaN(rawQtyBeli)) {
    payload.qty_beli = rawQtyBeli;
  }
  if (notaId) {
    payload.nota_id = notaId;
  }
  if (item.invoiceNumber || item.invoice_number) {
    payload.invoice_number = item.invoiceNumber || item.invoice_number;
  }

  console.log('SUBMIT ITEM', item);
  console.log('PESANAN PAYLOAD', payload);

  return payload;
}

export function mapRawInvoice(row: any): InvoiceRecord {
  const cleanId = (val: any) => {
    if (val === undefined || val === null || val === '') return null;
    const n = Number(val);
    return !isNaN(n) && Number.isInteger(n) ? n : val;
  };

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
    dapur_id: cleanId(row.dapur_id || (typeof row.dapur === 'object' ? row.dapur?.id : undefined)),
    toko: tokoNama,
    toko_id: cleanId(row.toko_id || (typeof row.toko === 'object' ? row.toko?.id : undefined)),
    pemasok: pemasokNama,
    pemasok_id: cleanId(row.pemasok_id || (typeof row.pemasok === 'object' ? row.pemasok?.id : undefined)),
    items: items,
    totalBeli: Number(row.harga_beli !== undefined ? row.harga_beli : row.totalBeli) || 0,
    totalJual: Number(row.total !== undefined ? row.total : row.totalJual) || 0,
    totalProfit: Number(row.total_profit !== undefined ? row.total_profit : row.totalProfit) || 0,
    catatan: row.catatan || row.keterangan || (items.map((i) => i.catatan).filter(Boolean).join('; ')) || '',
    status: row.status_pembayaran || row.status || 'PAID',
  };
}

export function buildTransaksiPayload(record: Partial<InvoiceRecord>) {
  const cleanId = (val: any) => {
    if (val === undefined || val === null || val === '') return null;
    const n = Number(val);
    return !isNaN(n) && Number.isInteger(n) ? n : val;
  };

  const itemsCatatan = (record.items || []).map((i) => i.catatan).filter(Boolean).join('; ');
  return {
    ...(record.id ? { id: record.id } : {}),
    invoice_number: record.invoiceNumber || (record as any).invoice_number || '',
    tanggal: record.createdAt ? record.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
    tanggal_print: record.tanggalPrint || new Date().toLocaleDateString('id-ID'),
    pemasok_id: cleanId(record.pemasok_id || (record as any).pemasokId),
    pemasok: record.pemasok || '',
    toko_id: cleanId(record.toko_id || (record as any).tokoId),
    toko: record.toko || '',
    dapur_id: cleanId(record.dapur_id || (record as any).dapurId),
    dapur: record.tujuanDapur || '',
    barang: (record.items || []).map((i) => `${i.namaBarang} (${i.qty})`).join(', '),
    qty: (record.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0),
    harga_beli: Number(record.totalBeli) || 0,
    total: Number(record.totalJual) || 0,
    total_profit: Number(record.totalProfit) || 0,
    status_pembayaran: record.status || 'PAID',
    catatan: record.catatan || itemsCatatan || '',
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

  // Parse items JSONB as primary source of multi-item
  let items: FollowUpItemRow[] = [];
  if (Array.isArray(row.items) && row.items.length > 0) {
    items = row.items.map((it: any, idx: number) => ({
      id: String(it.id || `item-${idx + 1}`),
      namaBarang: String(it.namaBarang || it.item || it.nama || '').trim(),
      pemasok: (it.pemasok || pemasok || '').trim(),
      qty: Number(it.qty) || 1,
      satuan: String(it.satuan || 'Kg').trim(),
      catatan: String(it.catatan || '').trim(),
    }));
  } else if (row.item || row.namaBarang) {
    // Legacy single item fallback -> wrap as array
    items = [{
      id: 'item-1',
      namaBarang: String(row.item || row.namaBarang || '').trim(),
      pemasok: pemasok || '',
      qty: row.qty !== undefined && row.qty !== null ? Number(row.qty) : 1,
      satuan: String(row.satuan || 'Kg').trim(),
      catatan: rawCatatan,
    }];
  }

  const firstItem = items[0];

  return {
    id: String(row.id || `note-${Date.now()}`),
    tujuanDapur: row.dapur || row.tujuanDapur || '',
    toko: toko || undefined,
    pemasok: (firstItem?.pemasok || pemasok) || undefined,
    namaBarang: (firstItem?.namaBarang || row.item || row.namaBarang) || '',
    qty: firstItem ? firstItem.qty : (row.qty !== undefined && row.qty !== null ? Number(row.qty) : undefined),
    satuan: (firstItem?.satuan || row.satuan) || 'Kg',
    catatan: rawCatatan,
    items: items,
    status: row.status || (row.is_done ? 'DONE' : 'FOLLOW UP'),
    isDone: Boolean(row.is_done !== undefined ? row.is_done : row.isDone),
    orderId: row.order_id || row.orderId,
    tanggal: row.tanggal || row.tanggal_pesanan || undefined,
    batchId: row.batch_id || row.batchId || undefined,
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

  let itemsArray: FollowUpItemRow[] = Array.isArray(note.items) ? note.items : [];
  if (itemsArray.length === 0 && (note.namaBarang || finalCatatan)) {
    itemsArray = [{
      id: `item-${Date.now()}`,
      namaBarang: note.namaBarang || '',
      pemasok: pemasokVal,
      qty: note.qty !== undefined && note.qty !== null ? Number(note.qty) : 1,
      satuan: note.satuan || 'Kg',
      catatan: finalCatatan,
    }];
  }

  const firstItem = itemsArray[0];

  return {
    ...(note.id ? { id: note.id } : {}),
    dapur: note.tujuanDapur || '',
    item: firstItem ? firstItem.namaBarang : (note.namaBarang || ''),
    qty: firstItem ? firstItem.qty : (note.qty !== undefined && note.qty !== null ? Number(note.qty) : null),
    satuan: firstItem ? firstItem.satuan : (note.satuan || 'Kg'),
    catatan: finalCatatan,
    status: note.status || (note.isDone ? 'DONE' : 'FOLLOW UP'),
    is_done: Boolean(note.isDone),
    order_id: note.orderId || null,
    tanggal: note.tanggal || null,
    batch_id: note.batchId || null,
    items: itemsArray,
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
    const finalItem = ((order.namaBarang || (order as any).item || (order as any).nama_barang || '') as string).trim();
    const finalDapur = ((order.tujuanDapur || (order as any).dapur || (order as any).tujuan_dapur || '') as string).trim();

    if (!finalItem || !finalDapur) {
      console.warn('[saveOrderToDb] Dibatalkan: Item atau Dapur kosong.', { finalItem, finalDapur });
      return { success: false, error: 'Nama barang dan Dapur wajib diisi, tidak boleh kosong.' };
    }

    const validItems = [order];
    console.log('FINAL ITEMS TO INSERT', validItems);

    const payload = buildPesananPayload(order);
    const res = await fetch('/api/pesanan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      const errDetail = json.error || json.message || `HTTP ${res.status}: Gagal menyimpan pesanan ke Supabase`;
      console.error('[saveOrderToDb Error Detail]:', errDetail, json);
      return { success: false, error: errDetail };
    }
    // Invalidate pesanan and summary cache
    invalidateCache('pesanan');
    invalidateCache('summary');
    const createdItem = json.data?.[0] ? mapRawOrder(json.data[0]) : order;
    return { success: true, data: createdItem };
  } catch (err: any) {
    console.error('[saveOrderToDb Exception]:', err);
    return { success: false, error: err?.message || 'Error saat menyimpan pesanan' };
  }
}

export async function saveOrdersBatchToDb(orders: OrderItem[]): Promise<{ success: boolean; error?: string; count?: number; data?: OrderItem[] }> {
  try {
    if (!orders || orders.length === 0) return { success: true, count: 0, data: [] };

    // WAJIB: Filter / buang placeholder item kosong sebelum submit ke Supabase
    const validItems = orders.filter((o) => {
      const finalItem = ((o.namaBarang || (o as any).item || (o as any).nama_barang || '') as string).trim();
      const finalDapur = ((o.tujuanDapur || (o as any).dapur || (o as any).tujuan_dapur || '') as string).trim();
      return finalItem.length > 0 && finalDapur.length > 0;
    });

    console.log('FINAL ITEMS TO INSERT', validItems);

    if (validItems.length === 0) {
      console.warn('[saveOrdersBatchToDb] Dibatalkan: Tidak ada item valid dengan namaBarang dan dapur.', orders);
      return { success: false, error: 'Tidak ada item pesanan yang valid untuk disimpan.' };
    }

    const payloads = validItems.map(buildPesananPayload);
    const res = await fetch('/api/pesanan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: payloads }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      const errDetail = json.error || json.message || `HTTP ${res.status}: Gagal menyimpan batch pesanan ke Supabase`;
      console.error('[saveOrdersBatchToDb Error Detail]:', errDetail, json);
      return { success: false, error: errDetail };
    }
    invalidateCache('pesanan');
    invalidateCache('summary');
    const returnedData = json.data ? (Array.isArray(json.data) ? json.data.map(mapRawOrder) : [mapRawOrder(json.data)]) : undefined;
    return { success: true, count: json.count || validItems.length, data: returnedData };
  } catch (err: any) {
    console.error('[saveOrdersBatchToDb Exception]:', err);
    return { success: false, error: err?.message || 'Error saat menyimpan batch pesanan' };
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
      const errStr = typeof json.error === 'string' ? json.error : (json.error?.message || json.message || 'Gagal menghapus pesanan dari Supabase');
      return { success: false, error: errStr };
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
      const errStr = typeof json.error === 'string' ? json.error : (json.error?.message || json.message || 'Gagal menghapus pesanan dari Supabase');
      return { success: false, error: errStr };
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
export async function fetchTransactionsFromDb(limit: number = 500, page: number = 1, forceRefresh = false): Promise<{ success: boolean; transactions: InvoiceRecord[]; error?: string }> {
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

export async function fetchMasterSatuanFromDb(): Promise<{ success: boolean; data: import('../types').MasterSatuan[]; error?: string }> {
  try {
    const res = await fetch(`/api/master?type=satuan&_t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, data: [], error: json.error || 'Gagal memuat data satuan' };
    }
    return { success: true, data: json.data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err?.message || 'Koneksi error' };
  }
}

export async function saveMasterSatuanToDb(nama: string): Promise<{ success: boolean; data?: import('../types').MasterSatuan; error?: string }> {
  try {
    const res = await fetch('/api/master?type=satuan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama: nama.trim() }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal menambahkan satuan' };
    }
    return { success: true, data: json.data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Koneksi error' };
  }
}

export async function deleteMasterSatuanFromDb(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`/api/master?type=satuan&id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Gagal menghapus satuan' };
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
