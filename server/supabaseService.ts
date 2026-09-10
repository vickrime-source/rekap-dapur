import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  getLocalOrders,
  createLocalOrders,
  updateLocalOrder,
  updateBatchLocalOrders,
  deleteLocalOrders,
  getLocalTransactions,
  createLocalTransaction,
  deleteLocalTransactions,
  getLocalNotes,
  createLocalNote,
  updateLocalNote,
  deleteLocalNote,
  getLocalPeriodSummary,
  getMasterToko as getLocalMasterToko,
  createMasterToko as createLocalMasterToko,
  deleteMasterToko as deleteLocalMasterToko,
  getMasterPemasok as getLocalMasterPemasok,
  createMasterPemasok as createLocalMasterPemasok,
  deleteMasterPemasok as deleteLocalMasterPemasok,
  getMasterDapur as getLocalMasterDapur,
  createMasterDapur as createLocalMasterDapur,
  deleteMasterDapur as deleteLocalMasterDapur,
  checkMasterUsage as checkLocalMasterUsage,
} from './localDbFallback';

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
    const serviceRoleKey = (
      process.env.SUPABASE_SERVICE_ROLE_KEY || 
      process.env.VITE_SUPABASE_ANON_KEY || 
      process.env.SUPABASE_ANON_KEY || 
      ''
    ).trim();

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('VITE_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_ANON_KEY harus dikonfigurasi di environment variables.');
    }

    supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient;
}

export function isSupabaseConfigured(): boolean {
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  return Boolean(url && key);
}

/**
 * Checks whether an error from Supabase indicates that a table/relation has not been created yet in the schema cache.
 */
export function isTableMissingError(err: any): boolean {
  if (!err) return false;
  const code = (err.code || err.status || '').toString();
  const message = (err.message || err.details || '').toString().toLowerCase();
  return (
    code === 'PGRST205' ||
    code === 'PGRST202' ||
    code === '42P01' ||
    code === '404' ||
    message.includes('schema cache') ||
    message.includes('not found in the schema cache') ||
    (message.includes('relation') && message.includes('does not exist')) ||
    message.includes('could not find the table') ||
    message.includes('could not find the function')
  );
}

export async function checkSupabaseStatus() {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      configured: false,
      error: 'Environment variable VITE_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diisi.',
    };
  }

  try {
    const supabase = getSupabase();
    
    // Check tables existence & counts
    const [pesananRes, transaksiRes, notesRes] = await Promise.all([
      supabase.from('pesanan').select('id', { count: 'exact', head: true }),
      supabase.from('transaksi').select('id', { count: 'exact', head: true }),
      supabase.from('notes').select('id', { count: 'exact', head: true }),
    ]);

    const errors: string[] = [];
    if (pesananRes.error) errors.push(`Tabel pesanan: ${pesananRes.error.message}`);
    if (transaksiRes.error) errors.push(`Tabel transaksi: ${transaksiRes.error.message}`);
    if (notesRes.error) errors.push(`Tabel notes: ${notesRes.error.message}`);

    const hasTables = !pesananRes.error && !transaksiRes.error && !notesRes.error;

    return {
      success: hasTables,
      configured: true,
      tablesReady: hasTables,
      url: (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)?.replace(/^(https?:\/\/[^\/]+).*$/, '$1'),
      counts: {
        pesanan: pesananRes.count || 0,
        transaksi: transaksiRes.count || 0,
        notes: notesRes.count || 0,
      },
      errors: errors.length > 0 ? errors : undefined,
      message: hasTables 
        ? 'Database Supabase PostgreSQL siap dan terhubung!' 
        : 'Tabel database belum dibuat di Supabase. Silakan jalankan skrip supabase_schema.sql di Supabase SQL Editor.',
    };
  } catch (err: any) {
    return {
      success: false,
      configured: true,
      tablesReady: false,
      error: err?.message || 'Gagal menghubungi database Supabase',
    };
  }
}

// =============================================================================
// HELPER: Date calculations for period filters in database queries
// =============================================================================
export function getDateRangeForPeriod(period: string, refDateStr?: string): { startDate?: string; endDate?: string } {
  const refDate = refDateStr ? new Date(refDateStr) : new Date();
  const validRef = isNaN(refDate.getTime()) ? new Date() : refDate;

  // Normalizer YYYY-MM-DD
  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (period === 'hari_ini') {
    const today = formatYMD(validRef);
    return { startDate: today, endDate: today };
  }

  if (period === 'mingguan') {
    // Senin s/d Minggu
    const day = validRef.getDay(); // 0 is Sunday
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(validRef);
    monday.setDate(validRef.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      startDate: formatYMD(monday),
      endDate: formatYMD(sunday),
    };
  }

  if (period === 'bulan_ini') {
    const year = validRef.getFullYear();
    const month = validRef.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    return {
      startDate: formatYMD(firstDay),
      endDate: formatYMD(lastDay),
    };
  }

  // 'all_time' or default
  return {};
}

// =============================================================================
// ORDERS (pesanan) CRUD
// =============================================================================

// DEFINISI KOLOM SPESIFIK: Menghemat Egress/Bandwidth (Jangan select *)
export const ORDER_COLUMNS = 'id,dapur,dapur_id,item,tanggal,qty,satuan,toko,toko_id,status_pembayaran,status_pengiriman,status,harga_jual,harga_beli,pemasok,pemasok_id,catatan,created_at';
export const TRANSACTION_COLUMNS = 'id,invoice_number,tanggal,tanggal_print,pemasok,pemasok_id,barang,toko,toko_id,dapur,dapur_id,qty,harga_beli,total,total_profit,status_pembayaran,items,created_at';
export const NOTE_COLUMNS = 'id,dapur,item,qty,satuan,catatan,status,is_done,order_id,created_at';
export const TOKO_COLUMNS = 'id,nama,created_at';
export const PEMASOK_COLUMNS = 'id,nama,created_at';
export const DAPUR_COLUMNS = 'id,nama,alamat,created_at';

export interface OrderFilterOptions {
  period?: 'hari_ini' | 'mingguan' | 'bulan_ini' | 'all_time';
  date?: string;
  toko?: string;
  dapur?: string;
  pemasok?: string;
  status?: string;
  limit?: number;
  page?: number;
  offset?: number;
}

export async function getOrdersFromDb(filters: OrderFilterOptions = {}) {
  try {
    const supabase = getSupabase();
    
    // Default limit 100 baris, max 200 baris per fetch untuk cegah over-egress
    const limit = Math.min(filters.limit || 100, 200);
    const offset = filters.offset !== undefined 
      ? filters.offset 
      : (filters.page ? (filters.page - 1) * limit : 0);

    let query = supabase
      .from('pesanan')
      .select(ORDER_COLUMNS)
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false });

    // Filter periode (Hari Ini/Mingguan/Bulanan) di level DATABASE pakai .gte()/.lte()
    if (filters.period && filters.period !== 'all_time') {
      const { startDate, endDate } = getDateRangeForPeriod(filters.period, filters.date);
      if (startDate && endDate) {
        if (startDate === endDate) {
          query = query.eq('tanggal', startDate);
        } else {
          query = query.gte('tanggal', startDate).lte('tanggal', endDate);
        }
      }
    } else if (filters.date) {
      query = query.eq('tanggal', filters.date);
    }

    if (filters.toko) {
      query = query.eq('toko', filters.toko);
    }
    if (filters.dapur) {
      query = query.eq('dapur', filters.dapur);
    }
    if (filters.pemasok) {
      query = query.eq('pemasok', filters.pemasok);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    // Selalu sertakan pagination/range query di database
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) {
      if (isTableMissingError(error)) {
        return getLocalOrders(filters);
      }
      throw error;
    }
    return data || [];
  } catch (err: any) {
    if (isTableMissingError(err)) {
      return getLocalOrders(filters);
    }
    throw err;
  }
}

export async function createOrdersInDb(ordersData: any[] | any) {
  const list = Array.isArray(ordersData) ? ordersData : [ordersData];

  const records = list.map((item) => {
    const payStatus = (item.status_pembayaran || item.paymentStatus || (item.status === 'selesai' ? 'PAID' : 'UNPAID')).toString().toUpperCase();
    const delStatus = (item.status_pengiriman || item.deliveryStatus || (item.status === 'selesai' ? 'DONE' : 'PENDING')).toString().toUpperCase();
    const orderStatus = (payStatus === 'PAID' && delStatus === 'DONE') ? 'selesai' : (item.status || 'pending');

    return {
      ...(item.id ? { id: String(item.id) } : {}),
      dapur: item.dapur || item.tujuanDapur || '',
      item: item.item || item.namaBarang || '',
      tanggal: item.tanggal || new Date().toISOString().split('T')[0],
      qty: Number(item.qty) || 1,
      satuan: item.satuan || 'Kg',
      toko: item.toko || '',
      pemasok: item.pemasok || 'Pemasok 1',
      status_pembayaran: ['PAID', 'UNPAID'].includes(payStatus) ? payStatus : 'UNPAID',
      status_pengiriman: ['DONE', 'PENDING'].includes(delStatus) ? delStatus : 'PENDING',
      status: ['pending', 'selesai'].includes(orderStatus) ? orderStatus : 'pending',
      harga_jual: Number(item.harga_jual !== undefined ? item.harga_jual : item.hargaJual) || 0,
      harga_beli: Number(item.harga_beli !== undefined ? item.harga_beli : item.hargaBeli) || 0,
      catatan: item.catatan || '',
      created_at: item.created_at || item.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('pesanan').insert(records).select(ORDER_COLUMNS);
    if (error) {
      if (isTableMissingError(error)) {
        return createLocalOrders(records);
      }
      throw error;
    }
    return data || [];
  } catch (err: any) {
    if (isTableMissingError(err)) {
      return createLocalOrders(records);
    }
    throw err;
  }
}

export async function updateOrderInDb(id: string, updates: any) {
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.dapur !== undefined || updates.tujuanDapur !== undefined) {
    payload.dapur = updates.dapur || updates.tujuanDapur;
  }
  if (updates.item !== undefined || updates.namaBarang !== undefined) {
    payload.item = updates.item || updates.namaBarang;
  }
  if (updates.tanggal !== undefined) payload.tanggal = updates.tanggal;
  if (updates.qty !== undefined) payload.qty = Number(updates.qty);
  if (updates.satuan !== undefined) payload.satuan = updates.satuan;
  if (updates.toko !== undefined) payload.toko = updates.toko;
  if (updates.pemasok !== undefined) payload.pemasok = updates.pemasok;
  if (updates.catatan !== undefined) payload.catatan = updates.catatan;

  if (updates.status_pembayaran !== undefined || updates.paymentStatus !== undefined) {
    payload.status_pembayaran = (updates.status_pembayaran || updates.paymentStatus).toString().toUpperCase();
  }
  if (updates.status_pengiriman !== undefined || updates.deliveryStatus !== undefined) {
    payload.status_pengiriman = (updates.status_pengiriman || updates.deliveryStatus).toString().toUpperCase();
  }
  if (updates.status !== undefined) {
    payload.status = updates.status;
  } else if (payload.status_pembayaran === 'PAID' && payload.status_pengiriman === 'DONE') {
    payload.status = 'selesai';
  }

  if (updates.harga_jual !== undefined || updates.hargaJual !== undefined) {
    payload.harga_jual = Number(updates.harga_jual !== undefined ? updates.harga_jual : updates.hargaJual);
  }
  if (updates.harga_beli !== undefined || updates.hargaBeli !== undefined) {
    payload.harga_beli = Number(updates.harga_beli !== undefined ? updates.harga_beli : updates.hargaBeli);
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('pesanan')
      .update(payload)
      .eq('id', id)
      .select(ORDER_COLUMNS);

    if (error) {
      if (isTableMissingError(error)) {
        return updateLocalOrder(id, payload);
      }
      throw error;
    }
    return data?.[0] || null;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      return updateLocalOrder(id, payload);
    }
    throw err;
  }
}

export async function updateBatchOrdersInDb(ids: string[], updates: any) {
  if (!ids || ids.length === 0) return [];
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status_pembayaran !== undefined || updates.paymentStatus !== undefined) {
    payload.status_pembayaran = (updates.status_pembayaran || updates.paymentStatus).toString().toUpperCase();
  }
  if (updates.status_pengiriman !== undefined || updates.deliveryStatus !== undefined) {
    payload.status_pengiriman = (updates.status_pengiriman || updates.deliveryStatus).toString().toUpperCase();
  }
  if (updates.status !== undefined) {
    payload.status = updates.status;
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('pesanan')
      .update(payload)
      .in('id', ids)
      .select('id,status_pembayaran,status_pengiriman,status,updated_at');

    if (error) {
      if (isTableMissingError(error)) {
        return updateBatchLocalOrders(ids, payload);
      }
      throw error;
    }
    return data || [];
  } catch (err: any) {
    if (isTableMissingError(err)) {
      return updateBatchLocalOrders(ids, payload);
    }
    throw err;
  }
}

export async function deleteOrdersFromDb(idOrIds: string | string[]) {
  const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
  if (ids.length === 0) return { deletedCount: 0 };

  try {
    const supabase = getSupabase();
    const { error, count } = await supabase
      .from('pesanan')
      .delete({ count: 'exact' })
      .in('id', ids);

    if (error) {
      if (isTableMissingError(error)) {
        return deleteLocalOrders(ids);
      }
      throw error;
    }
    return { deletedCount: count || ids.length };
  } catch (err: any) {
    if (isTableMissingError(err)) {
      return deleteLocalOrders(ids);
    }
    throw err;
  }
}

// =============================================================================
// TRANSACTIONS (transaksi) CRUD
// =============================================================================
export async function getTransactionsFromDb(limit: number = 50, page: number = 1) {
  const safeLimit = Math.min(limit || 50, 100);
  const offset = (page - 1) * safeLimit;

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('transaksi')
      .select(TRANSACTION_COLUMNS)
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + safeLimit - 1);

    if (error) {
      if (isTableMissingError(error)) {
        return getLocalTransactions(safeLimit);
      }
      throw error;
    }
    return data || [];
  } catch (err: any) {
    if (isTableMissingError(err)) {
      return getLocalTransactions(safeLimit);
    }
    throw err;
  }
}

export async function createTransactionInDb(tx: any) {
  const record = {
    ...(tx.id ? { id: String(tx.id) } : {}),
    invoice_number: tx.invoice_number || tx.invoiceNumber || `INV-${Date.now()}`,
    tanggal: tx.tanggal || new Date().toISOString().split('T')[0],
    tanggal_print: tx.tanggal_print || tx.tanggalPrint || new Date().toLocaleDateString('id-ID'),
    pemasok: tx.pemasok || 'Pemasok 1',
    barang: tx.barang || (Array.isArray(tx.items) ? tx.items.map((i: any) => `${i.namaBarang || i.item} (${i.qty})`).join(', ') : ''),
    toko: tx.toko || '',
    dapur: tx.dapur || tx.tujuanDapur || '',
    qty: Number(tx.qty) || (Array.isArray(tx.items) ? tx.items.reduce((s: number, i: any) => s + (Number(i.qty) || 0), 0) : 0),
    harga_beli: Number(tx.harga_beli !== undefined ? tx.harga_beli : tx.totalBeli) || 0,
    total: Number(tx.total !== undefined ? tx.total : tx.totalJual) || 0,
    total_profit: Number(tx.total_profit !== undefined ? tx.total_profit : tx.totalProfit) || 0,
    status_pembayaran: tx.status_pembayaran || tx.status || 'PAID',
    items: Array.isArray(tx.items) ? tx.items : [],
    created_at: tx.created_at || tx.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('transaksi').insert(record).select(TRANSACTION_COLUMNS);
    if (error) {
      if (isTableMissingError(error)) {
        return createLocalTransaction(record);
      }
      throw error;
    }
    return data?.[0] || null;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      return createLocalTransaction(record);
    }
    throw err;
  }
}

export async function deleteTransactionsFromDb(idOrIds: string | string[]) {
  const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
  if (ids.length === 0) return { deletedCount: 0 };

  try {
    const supabase = getSupabase();
    const { error, count } = await supabase
      .from('transaksi')
      .delete({ count: 'exact' })
      .in('id', ids);

    if (error) {
      if (isTableMissingError(error)) {
        return deleteLocalTransactions(ids);
      }
      throw error;
    }
    return { deletedCount: count || ids.length };
  } catch (err: any) {
    if (isTableMissingError(err)) {
      return deleteLocalTransactions(ids);
    }
    throw err;
  }
}

// =============================================================================
// NOTES (notes) CRUD
// =============================================================================
export async function getNotesFromDb(limit: number = 100) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('notes')
      .select(NOTE_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isTableMissingError(error)) {
        return getLocalNotes();
      }
      throw error;
    }
    return data || [];
  } catch (err: any) {
    if (isTableMissingError(err)) {
      return getLocalNotes();
    }
    throw err;
  }
}

export async function createNoteInDb(note: any) {
  const record = {
    ...(note.id ? { id: String(note.id) } : {}),
    dapur: note.dapur || note.tujuanDapur || '',
    item: note.item || note.namaBarang || '',
    qty: note.qty !== undefined && note.qty !== null ? Number(note.qty) : null,
    satuan: note.satuan || 'Kg',
    catatan: note.catatan || '',
    status: note.status || (note.isDone ? 'DONE' : 'FOLLOW UP'),
    is_done: Boolean(note.is_done !== undefined ? note.is_done : note.isDone),
    order_id: note.order_id || note.orderId || null,
    created_at: note.created_at || note.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('notes').insert(record).select(NOTE_COLUMNS);
    if (error) {
      if (isTableMissingError(error)) {
        return createLocalNote(record);
      }
      throw error;
    }
    return data?.[0] || null;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      return createLocalNote(record);
    }
    throw err;
  }
}

export async function updateNoteInDb(id: string, updates: any) {
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.is_done !== undefined || updates.isDone !== undefined) {
    const isDone = Boolean(updates.is_done !== undefined ? updates.is_done : updates.isDone);
    payload.is_done = isDone;
    payload.status = isDone ? 'DONE' : 'FOLLOW UP';
  }
  if (updates.catatan !== undefined) payload.catatan = updates.catatan;
  if (updates.item !== undefined || updates.namaBarang !== undefined) payload.item = updates.item || updates.namaBarang;
  if (updates.qty !== undefined) payload.qty = Number(updates.qty);
  if (updates.satuan !== undefined) payload.satuan = updates.satuan;
  if (updates.dapur !== undefined || updates.tujuanDapur !== undefined) payload.dapur = updates.dapur || updates.tujuanDapur;

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('notes').update(payload).eq('id', id).select(NOTE_COLUMNS);
    if (error) {
      if (isTableMissingError(error)) {
        return updateLocalNote(id, payload);
      }
      throw error;
    }
    return data?.[0] || null;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      return updateLocalNote(id, payload);
    }
    throw err;
  }
}

export async function deleteNoteFromDb(id: string) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) {
      if (isTableMissingError(error)) {
        return deleteLocalNote(id);
      }
      throw error;
    }
    return { success: true };
  } catch (err: any) {
    if (isTableMissingError(err)) {
      return deleteLocalNote(id);
    }
    throw err;
  }
}

// =============================================================================
// DATABASE AGGREGATION: Period Summary & Weekly Store Breakdown
// (Calculated inside Postgres/Supabase directly, not in frontend)
// =============================================================================
export async function getPeriodSummaryFromDb(period: string = 'mingguan', dateStr?: string) {
  const targetDate = dateStr || new Date().toISOString().split('T')[0];

  try {
    const supabase = getSupabase();
    // 1. Try calling the PostgreSQL RPC function get_period_summary
    try {
      const { data, error } = await supabase.rpc('get_period_summary', {
        p_period: period,
        p_date: targetDate,
      });

      if (!error && data) {
        return data;
      }
    } catch {
      // Fallback below
    }

    // 2. Direct Supabase Query aggregation (Hanya tarik kolom kalkulasi, hemat egress!)
    const { startDate, endDate } = getDateRangeForPeriod(period, targetDate);
    let query = supabase.from('pesanan').select('tanggal,dapur,toko,qty,harga_jual,harga_beli,pemasok');

    if (startDate && endDate) {
      if (startDate === endDate) {
        query = query.eq('tanggal', startDate);
      } else {
        query = query.gte('tanggal', startDate).lte('tanggal', endDate);
      }
    }

    const { data: rawOrders, error } = await query;
    if (error) {
      if (isTableMissingError(error)) {
        return getLocalPeriodSummary(period, targetDate);
      }
      throw error;
    }

    const orders = rawOrders || [];
    let totalQty = 0;
    let totalPendapatan = 0;
    let totalPengeluaran = 0;
    const storeMap: Record<string, {
      totalQty: number;
      totalBeli: number;
      totalJual: number;
      count: number;
      pemasokSet: Set<string>;
      batchKeys: Set<string>;
    }> = {};
    const globalBatchKeys = new Set<string>();

    for (const item of orders) {
      const qty = Number(item.qty) || 0;
      const beli = Number(item.harga_beli) || 0;
      const jual = Number(item.harga_jual) || 0;

      totalQty += qty;
      totalPendapatan += (qty * jual);
      totalPengeluaran += (qty * beli);

      const tokoKey = (item.toko || 'Lainnya').trim() || 'Lainnya';
      if (!storeMap[tokoKey]) {
        storeMap[tokoKey] = {
          totalQty: 0,
          totalBeli: 0,
          totalJual: 0,
          count: 0,
          pemasokSet: new Set<string>(),
          batchKeys: new Set<string>(),
        };
      }
      storeMap[tokoKey].totalQty += qty;
      storeMap[tokoKey].totalBeli += (qty * beli);
      storeMap[tokoKey].totalJual += (qty * jual);
      storeMap[tokoKey].count += 1;
      if (item.pemasok && item.pemasok.trim() && item.pemasok.trim() !== '-') {
        storeMap[tokoKey].pemasokSet.add(item.pemasok.trim());
      }

      const bKey = `${item.tanggal}_${item.dapur}_${item.toko}`;
      storeMap[tokoKey].batchKeys.add(bKey);
      globalBatchKeys.add(bKey);
    }

    const storeBreakdowns = Object.entries(storeMap)
      .map(([toko, val]) => {
        const profit = val.totalJual - val.totalBeli;
        const marginPercent = val.totalJual > 0 ? Math.round((profit / val.totalJual) * 100) : 0;
        return {
          toko,
          totalQty: val.totalQty,
          totalBeli: val.totalBeli,
          totalJual: val.totalJual,
          profit,
          orderCount: val.count,
          transactionCount: val.batchKeys.size || val.count,
          pemasokList: Array.from(val.pemasokSet),
          percentageOfTotalBeli: totalPengeluaran > 0 ? (val.totalBeli / totalPengeluaran) * 100 : 0,
          percentageOfTotalJual: totalPendapatan > 0 ? (val.totalJual / totalPendapatan) * 100 : 0,
          marginPercent,
        };
      })
      .sort((a, b) => b.totalJual - a.totalJual);

    return {
      period,
      startDate,
      endDate,
      totalQty,
      totalTransactions: globalBatchKeys.size || orders.length,
      totalPendapatan,
      totalPengeluaran,
      profitBersih: totalPendapatan - totalPengeluaran,
      storeBreakdowns,
    };
  } catch (err: any) {
    if (isTableMissingError(err)) {
      return getLocalPeriodSummary(period, targetDate);
    }
    throw err;
  }
}

// =============================================================================
// MASTER DATA (toko, pemasok, dapur) CRUD & DEPENDENCY CHECK
// =============================================================================

export async function getMasterTokoFromDb() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('toko')
      .select(TOKO_COLUMNS)
      .order('nama', { ascending: true });

    if (error) {
      if (isTableMissingError(error)) return getLocalMasterToko();
      throw error;
    }
    return data || [];
  } catch (err: any) {
    if (isTableMissingError(err)) return getLocalMasterToko();
    throw err;
  }
}

export async function createMasterTokoInDb(nama: string) {
  const cleanName = (nama || '').trim();
  if (!cleanName) throw new Error('Nama toko wajib diisi.');

  try {
    const supabase = getSupabase();
    // Check existing
    const { data: existing } = await supabase
      .from('toko')
      .select(TOKO_COLUMNS)
      .ilike('nama', cleanName)
      .maybeSingle();

    if (existing) return existing;

    const { data, error } = await supabase
      .from('toko')
      .insert({ nama: cleanName })
      .select(TOKO_COLUMNS)
      .single();

    if (error) {
      if (isTableMissingError(error)) return createLocalMasterToko(cleanName);
      throw error;
    }
    return data;
  } catch (err: any) {
    if (isTableMissingError(err)) return createLocalMasterToko(cleanName);
    throw err;
  }
}

export async function deleteMasterTokoInDb(id: string) {
  if (!id) throw new Error('ID toko wajib disertakan.');

  // Check usage first
  const usage = await checkMasterUsageInDb('toko', id);
  if (usage.isUsed) {
    throw new Error(usage.message);
  }

  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('toko')
      .delete()
      .eq('id', id);

    if (error) {
      if (isTableMissingError(error)) return deleteLocalMasterToko(id);
      throw error;
    }
    return { success: true, message: 'Toko berhasil dihapus.' };
  } catch (err: any) {
    if (isTableMissingError(err)) return deleteLocalMasterToko(id);
    throw err;
  }
}

export async function getMasterPemasokFromDb() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('pemasok')
      .select(PEMASOK_COLUMNS)
      .order('nama', { ascending: true });

    if (error) {
      if (isTableMissingError(error)) return getLocalMasterPemasok();
      throw error;
    }
    return data || [];
  } catch (err: any) {
    if (isTableMissingError(err)) return getLocalMasterPemasok();
    throw err;
  }
}

export async function createMasterPemasokInDb(nama: string) {
  const cleanName = (nama || '').trim();
  if (!cleanName) throw new Error('Nama pemasok wajib diisi.');

  try {
    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from('pemasok')
      .select(PEMASOK_COLUMNS)
      .ilike('nama', cleanName)
      .maybeSingle();

    if (existing) return existing;

    const { data, error } = await supabase
      .from('pemasok')
      .insert({ nama: cleanName })
      .select(PEMASOK_COLUMNS)
      .single();

    if (error) {
      if (isTableMissingError(error)) return createLocalMasterPemasok(cleanName);
      throw error;
    }
    return data;
  } catch (err: any) {
    if (isTableMissingError(err)) return createLocalMasterPemasok(cleanName);
    throw err;
  }
}

export async function deleteMasterPemasokInDb(id: string) {
  if (!id) throw new Error('ID pemasok wajib disertakan.');

  // Check usage first
  const usage = await checkMasterUsageInDb('pemasok', id);
  if (usage.isUsed) {
    throw new Error(usage.message);
  }

  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('pemasok')
      .delete()
      .eq('id', id);

    if (error) {
      if (isTableMissingError(error)) return deleteLocalMasterPemasok(id);
      throw error;
    }
    return { success: true, message: 'Pemasok berhasil dihapus.' };
  } catch (err: any) {
    if (isTableMissingError(err)) return deleteLocalMasterPemasok(id);
    throw err;
  }
}

export async function getMasterDapurFromDb() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('dapur')
      .select(DAPUR_COLUMNS)
      .order('nama', { ascending: true });

    if (error) {
      if (isTableMissingError(error)) return getLocalMasterDapur();
      throw error;
    }
    return data || [];
  } catch (err: any) {
    if (isTableMissingError(err)) return getLocalMasterDapur();
    throw err;
  }
}

export async function createMasterDapurInDb(nama: string, alamat?: string) {
  const cleanName = (nama || '').trim().replace(/^Dapur\s+/i, '');
  if (!cleanName) throw new Error('Nama dapur wajib diisi.');

  try {
    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from('dapur')
      .select(DAPUR_COLUMNS)
      .ilike('nama', cleanName)
      .maybeSingle();

    if (existing) {
      if (alamat && !existing.alamat) {
        await supabase.from('dapur').update({ alamat: alamat.trim() }).eq('id', existing.id);
        existing.alamat = alamat.trim();
      }
      return existing;
    }

    const { data, error } = await supabase
      .from('dapur')
      .insert({ nama: cleanName, alamat: (alamat || '').trim() })
      .select(DAPUR_COLUMNS)
      .single();

    if (error) {
      if (isTableMissingError(error)) return createLocalMasterDapur(cleanName, alamat);
      throw error;
    }
    return data;
  } catch (err: any) {
    if (isTableMissingError(err)) return createLocalMasterDapur(cleanName, alamat);
    throw err;
  }
}

export async function deleteMasterDapurInDb(id: string) {
  if (!id) throw new Error('ID dapur wajib disertakan.');

  // Check usage first
  const usage = await checkMasterUsageInDb('dapur', id);
  if (usage.isUsed) {
    throw new Error(usage.message);
  }

  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('dapur')
      .delete()
      .eq('id', id);

    if (error) {
      if (isTableMissingError(error)) return deleteLocalMasterDapur(id);
      throw error;
    }
    return { success: true, message: 'Dapur berhasil dihapus.' };
  } catch (err: any) {
    if (isTableMissingError(err)) return deleteLocalMasterDapur(id);
    throw err;
  }
}

export async function checkMasterUsageInDb(
  type: 'toko' | 'pemasok' | 'dapur',
  id: string,
  name?: string
): Promise<{ isUsed: boolean; orderCount: number; transaksiCount: number; message: string }> {
  try {
    const supabase = getSupabase();

    // Get the name if not provided
    let entityName = name;
    if (!entityName && id) {
      const table = type === 'toko' ? 'toko' : type === 'pemasok' ? 'pemasok' : 'dapur';
      const { data } = await supabase.from(table).select('nama').eq('id', id).maybeSingle();
      if (data?.nama) entityName = data.nama;
    }

    let orderCount = 0;
    let transaksiCount = 0;

    if (type === 'toko') {
      const p1 = supabase.from('pesanan').select('id', { count: 'exact', head: true }).eq('toko_id', id);
      const p2 = supabase.from('transaksi').select('id', { count: 'exact', head: true }).eq('toko_id', id);
      const [r1, r2] = await Promise.all([p1, p2]);
      orderCount = r1.count || 0;
      transaksiCount = r2.count || 0;

      if (entityName && orderCount === 0 && transaksiCount === 0) {
        const p3 = supabase.from('pesanan').select('id', { count: 'exact', head: true }).ilike('toko', `%${entityName}%`);
        const p4 = supabase.from('transaksi').select('id', { count: 'exact', head: true }).ilike('toko', `%${entityName}%`);
        const [r3, r4] = await Promise.all([p3, p4]);
        orderCount += (r3.count || 0);
        transaksiCount += (r4.count || 0);
      }
    } else if (type === 'pemasok') {
      const p1 = supabase.from('pesanan').select('id', { count: 'exact', head: true }).eq('pemasok_id', id);
      const p2 = supabase.from('transaksi').select('id', { count: 'exact', head: true }).eq('pemasok_id', id);
      const [r1, r2] = await Promise.all([p1, p2]);
      orderCount = r1.count || 0;
      transaksiCount = r2.count || 0;

      if (entityName && orderCount === 0 && transaksiCount === 0) {
        const p3 = supabase.from('pesanan').select('id', { count: 'exact', head: true }).eq('pemasok', entityName);
        const p4 = supabase.from('transaksi').select('id', { count: 'exact', head: true }).eq('pemasok', entityName);
        const [r3, r4] = await Promise.all([p3, p4]);
        orderCount += (r3.count || 0);
        transaksiCount += (r4.count || 0);
      }
    } else if (type === 'dapur') {
      const p1 = supabase.from('pesanan').select('id', { count: 'exact', head: true }).eq('dapur_id', id);
      const p2 = supabase.from('transaksi').select('id', { count: 'exact', head: true }).eq('dapur_id', id);
      const [r1, r2] = await Promise.all([p1, p2]);
      orderCount = r1.count || 0;
      transaksiCount = r2.count || 0;

      if (entityName && orderCount === 0 && transaksiCount === 0) {
        const cleanD = entityName.replace(/^Dapur\s+/i, '');
        const p3 = supabase.from('pesanan').select('id', { count: 'exact', head: true }).or(`dapur.ilike.%${cleanD}%,dapur.eq.${entityName}`);
        const p4 = supabase.from('transaksi').select('id', { count: 'exact', head: true }).or(`dapur.ilike.%${cleanD}%,dapur.eq.${entityName}`);
        const [r3, r4] = await Promise.all([p3, p4]);
        orderCount += (r3.count || 0);
        transaksiCount += (r4.count || 0);
      }
    }

    const isUsed = (orderCount + transaksiCount) > 0;
    let message = '';
    if (isUsed) {
      const parts: string[] = [];
      if (orderCount > 0) parts.push(`${orderCount} pesanan`);
      if (transaksiCount > 0) parts.push(`${transaksiCount} transaksi`);
      message = `Perhatian: "${entityName || id}" masih terhubung dengan ${parts.join(' dan ')}. Menghapus master data ini akan merusak riwayat transaksi lama. Hapus atau pindahkan pesanan/transaksi terkait terlebih dahulu!`;
    }

    return { isUsed, orderCount, transaksiCount, message };
  } catch (err: any) {
    if (isTableMissingError(err)) {
      return checkLocalMasterUsage(type, id, name);
    }
    return checkLocalMasterUsage(type, id, name);
  }
}
