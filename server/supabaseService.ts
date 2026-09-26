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
  getMasterSatuan as getLocalMasterSatuan,
  createMasterSatuan as createLocalMasterSatuan,
  deleteMasterSatuan as deleteLocalMasterSatuan,
  checkMasterUsage as checkLocalMasterUsage,
} from './localDbFallback.js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    // Backend (server-side & /api/*) HARUS gunakan SUPABASE_URL (tanpa prefix VITE_)
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    // Backend gunakan SUPABASE_SERVICE_ROLE_KEY (akses penuh server-side)
    const serviceRoleKey = (
      process.env.SUPABASE_SERVICE_ROLE_KEY || 
      process.env.SUPABASE_ANON_KEY || 
      process.env.VITE_SUPABASE_ANON_KEY || 
      ''
    ).trim();

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus dikonfigurasi di environment variables server.');
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
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
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
    message.includes('could not find the function') ||
    message.includes('harus dikonfigurasi') ||
    message.includes('konfigurasi') ||
    message.includes('supabase_url') ||
    message.includes('supabase_service_role_key') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('enotfound') ||
    message.includes('econnrefused')
  );
}

export async function checkSupabaseStatus() {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      configured: false,
      error: 'Environment variable SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diisi di server.',
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
      url: (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.replace(/^(https?:\/\/[^\/]+).*$/, '$1'),
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
export const ORDER_COLUMNS = 'id,dapur,item,tanggal,qty,satuan,toko,status_pembayaran,status_pengiriman,status,harga_jual,harga_beli,pemasok,catatan,created_at,cashback,retur,qty_beli,nota_id,toko_id,pemasok_id,dapur_id';
export const ORDER_COLUMNS_LEGACY = 'id,dapur,item,tanggal,qty,satuan,toko,status_pembayaran,status_pengiriman,status,harga_jual,harga_beli,pemasok,catatan,created_at,cashback,retur';
export const TRANSACTION_COLUMNS = 'id,invoice_number,tanggal,tanggal_print,pemasok,barang,toko,dapur,qty,harga_beli,total,total_profit,status_pembayaran,items,catatan,created_at';
export const TRANSACTION_COLUMNS_LEGACY = 'id,invoice_number,tanggal,tanggal_print,pemasok,barang,toko,dapur,qty,harga_beli,total,total_profit,status_pembayaran,items,created_at';
export const NOTE_COLUMNS = 'id,dapur,item,qty,satuan,catatan,status,is_done,order_id,created_at,items';
export const NOTE_COLUMNS_LEGACY = 'id,dapur,item,qty,satuan,catatan,status,is_done,order_id,created_at';
export const TOKO_COLUMNS = 'id,nama,created_at';
export const PEMASOK_COLUMNS = 'id,nama,created_at';
export const DAPUR_COLUMNS = 'id,nama,alamat,created_at';
export const SATUAN_COLUMNS = 'id,nama,created_at,updated_at';

export interface OrderFilterOptions {
  period?: 'hari_ini' | 'mingguan' | 'bulan_ini' | 'all_time';
  date?: string;
  startDate?: string;
  endDate?: string;
  toko?: string;
  dapur?: string;
  pemasok?: string;
  status?: string;
  limit?: number;
  page?: number;
  offset?: number;
}

export async function getOrdersFromDb(filters: OrderFilterOptions = {}) {
  if (!isSupabaseConfigured()) {
    return getLocalOrders(filters);
  }
  try {
    const supabase = getSupabase();
    
    // FIX LIMIT PAGINASI: Jangan potong data periode dengan limit 100 hardcoded.
    // Jika filters.limit diminta, hormati hingga 10.000. Jika tidak dispesifikasikan, ambil hingga 10.000 agar data periode lengkap.
    const limit = filters.limit ? Math.min(filters.limit, 10000) : 10000;
    const offset = filters.offset !== undefined 
      ? filters.offset 
      : (filters.page ? (filters.page - 1) * limit : 0);

    let query = supabase
      .from('pesanan')
      .select(ORDER_COLUMNS)
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false });

    // Filter periode (Hari Ini/Mingguan/Bulanan/Custom Range) di level DATABASE pakai .gte()/.lte()
    if (filters.startDate && filters.endDate) {
      if (filters.startDate === filters.endDate) {
        query = query.eq('tanggal', filters.startDate);
      } else {
        query = query.gte('tanggal', filters.startDate).lte('tanggal', filters.endDate);
      }
    } else if (filters.period && filters.period !== 'all_time') {
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

    let { data, error } = await query;
    if (error) {
      // Fallback jika kolom baru belum ada di schema database Supabase pengguna
      if (error.code === '42703' || (error.message && (error.message.includes('status_pembatalan') || error.message.includes('cancelled_at')))) {
        let fallbackQuery = supabase
          .from('pesanan')
          .select(ORDER_COLUMNS_LEGACY)
          .order('tanggal', { ascending: false })
          .order('created_at', { ascending: false });

        if (filters.startDate && filters.endDate) {
          if (filters.startDate === filters.endDate) {
            fallbackQuery = fallbackQuery.eq('tanggal', filters.startDate);
          } else {
            fallbackQuery = fallbackQuery.gte('tanggal', filters.startDate).lte('tanggal', filters.endDate);
          }
        } else if (filters.period && filters.period !== 'all_time') {
          const { startDate, endDate } = getDateRangeForPeriod(filters.period, filters.date);
          if (startDate && endDate) {
            if (startDate === endDate) {
              fallbackQuery = fallbackQuery.eq('tanggal', startDate);
            } else {
              fallbackQuery = fallbackQuery.gte('tanggal', startDate).lte('tanggal', endDate);
            }
          }
        } else if (filters.date) {
          fallbackQuery = fallbackQuery.eq('tanggal', filters.date);
        }
        if (filters.toko) fallbackQuery = fallbackQuery.eq('toko', filters.toko);
        if (filters.dapur) fallbackQuery = fallbackQuery.eq('dapur', filters.dapur);
        if (filters.pemasok) fallbackQuery = fallbackQuery.eq('pemasok', filters.pemasok);
        if (filters.status) fallbackQuery = fallbackQuery.eq('status', filters.status);
        fallbackQuery = fallbackQuery.range(offset, offset + limit - 1);

        const fallbackRes = await fallbackQuery;
        if (!fallbackRes.error) {
          return fallbackRes.data || [];
        }
      }

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
  // 1. Normalize and unwrap items if payload is wrapped in { items: [...] } or { data: [...] }
  let rawList: any[];
  if (Array.isArray(ordersData)) {
    rawList = ordersData;
  } else if (ordersData && typeof ordersData === 'object') {
    if (Array.isArray(ordersData.items)) {
      rawList = ordersData.items;
    } else if (Array.isArray(ordersData.data)) {
      rawList = ordersData.data;
    } else {
      rawList = [ordersData];
    }
  } else {
    rawList = [];
  }

  // 2. Flatten in case of nested arrays or wrapper objects
  const list: any[] = [];
  for (const entry of rawList) {
    if (Array.isArray(entry)) {
      list.push(...entry);
    } else if (entry && typeof entry === 'object' && Array.isArray(entry.items)) {
      list.push(...entry.items);
    } else if (entry && typeof entry === 'object' && Array.isArray(entry.data)) {
      list.push(...entry.data);
    } else if (entry && typeof entry === 'object') {
      list.push(entry);
    }
  }

  // 3. Filter out placeholder/empty rows and validate
  const validItems = list.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    const d = (item.dapur || item.tujuanDapur || item.tujuan_dapur || '').toString().trim();
    const it = (item.item || item.namaBarang || item.nama_barang || '').toString().trim();
    return it.length > 0 && d.length > 0;
  });

  if (validItems.length === 0) {
    throw new Error('Validasi gagal: Nama barang dan Dapur tujuan tidak boleh kosong.');
  }

  // 2. NOTA_ID: Pastikan semua item dalam 1 batch nota punya nota_id yang sama dan tidak NULL
  const sharedNotaId =
    validItems.find((i: any) => i.nota_id || i.notaId)?.nota_id ||
    validItems.find((i: any) => i.nota_id || i.notaId)?.notaId ||
    `nota-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const records = validItems
    .map((item) => {
      const payStatus = (item.status_pembayaran || item.paymentStatus || (item.status === 'selesai' ? 'PAID' : 'UNPAID')).toString().toUpperCase();
      const delStatus = (item.status_pengiriman || item.deliveryStatus || (item.status === 'selesai' ? 'DONE' : 'PENDING')).toString().toUpperCase();
      const orderStatus = (payStatus === 'PAID' && delStatus === 'DONE') ? 'selesai' : (item.status || 'pending');

      const dapur = (item.dapur || item.tujuanDapur || item.tujuan_dapur || '').toString().trim();
      const itemName = (item.item || item.namaBarang || item.nama_barang || '').toString().trim();

      const rawQty = Number(item.qty);
      const validQty = !isNaN(rawQty) ? rawQty : 0;
      const rawQtyBeli = item.qty_beli !== undefined ? Number(item.qty_beli) : (item.qtyBeli !== undefined ? Number(item.qtyBeli) : validQty);
      const notaId = item.nota_id || item.notaId || sharedNotaId;

      const parseBigIntOrNull = (val: any) => {
        if (val === undefined || val === null || val === '') return null;
        const n = Number(val);
        return !isNaN(n) && Number.isInteger(n) ? n : null;
      };

      const STORE_MAP: Record<string, string> = {
        '1': 'LB / Luweng Boga',
        '2': 'HTG',
        '3': 'LA / Lumbung Adifruta',
        '4': 'PW / Prohe',
      };

      const STORE_REVERSE_MAP: Record<string, number> = {
        'lb / luweng boga': 1,
        'luweng boga': 1,
        'htg': 2,
        'la / lumbung adifruta': 3,
        'lumbung adifruta': 3,
        'pw / prohe': 4,
        'prohe': 4,
      };

      let rawToko = (item.toko || '').toString().trim();
      let tokoId = parseBigIntOrNull(item.toko_id ?? item.tokoId);

      if (STORE_MAP[rawToko]) {
        if (!tokoId) tokoId = Number(rawToko);
        rawToko = STORE_MAP[rawToko];
      } else if (!tokoId && STORE_REVERSE_MAP[rawToko.toLowerCase()]) {
        tokoId = STORE_REVERSE_MAP[rawToko.toLowerCase()];
      } else if (!rawToko && tokoId && STORE_MAP[String(tokoId)]) {
        rawToko = STORE_MAP[String(tokoId)];
      }

      const pemasokId = parseBigIntOrNull(item.pemasok_id ?? item.pemasokId);
      const dapurId = parseBigIntOrNull(item.dapur_id ?? item.dapurId);

      const record: Record<string, any> = {
        ...(item.id ? { id: String(item.id) } : {}),
        toko_id: tokoId,
        pemasok_id: pemasokId,
        dapur_id: dapurId,
        dapur,
        item: itemName,
        tanggal: item.tanggal || new Date().toISOString().split('T')[0],
        qty: validQty,
        satuan: (item.satuan || '').toString().trim() || 'Kg',
        toko: rawToko,
        pemasok: (item.pemasok || '').toString().trim(),
        status_pembayaran: ['PAID', 'UNPAID'].includes(payStatus) ? payStatus : 'UNPAID',
        status_pengiriman: ['DONE', 'PENDING', 'SHIPPED'].includes(delStatus) ? delStatus : 'PENDING',
        status: ['pending', 'selesai'].includes(orderStatus) ? orderStatus : 'pending',
        harga_jual: Math.max(0, Number(item.harga_jual !== undefined ? item.harga_jual : item.hargaJual) || 0),
        harga_beli: Math.max(0, Number(item.harga_beli !== undefined ? item.harga_beli : item.hargaBeli) || 0),
        cashback: Math.max(0, Number(item.cashback) || 0),
        retur: Math.max(0, Number(item.retur) || 0),
        catatan: (item.catatan || '').toString().trim(),
        created_at: item.created_at || item.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (rawQtyBeli !== undefined && !isNaN(rawQtyBeli)) {
        record.qty_beli = rawQtyBeli;
      }
      if (notaId) {
        record.nota_id = notaId;
      }

      console.log('SUBMIT ITEM', item);
      console.log('PESANAN PAYLOAD', record);

      return record;
    })
    .filter((record) => record.item.length > 0 && record.dapur.length > 0);

  console.log('FINAL ITEMS TO INSERT', records);

  if (records.length === 0) {
    throw new Error('Validasi gagal: Tidak ada item pesanan valid untuk disimpan.');
  }

  if (!isSupabaseConfigured()) {
    return createLocalOrders(records);
  }

  try {
    const supabase = getSupabase();
    let { data, error } = await supabase.from('pesanan').insert(records).select(ORDER_COLUMNS);
    if (error) {
      if (isTableMissingError(error)) {
        return createLocalOrders(records);
      }
      // If error is code 42703 (undefined column) or specific columns missing
      if (error.code === '42703' || (error.message && (error.message.includes('column') || error.message.includes('does not exist') || error.message.includes('cancelled_at') || error.message.includes('nota_id') || error.message.includes('qty_beli') || error.message.includes('toko_id') || error.message.includes('pemasok_id') || error.message.includes('dapur_id') || error.message.includes('bigint') || error.code === 'PGRST204'))) {
        const cleanedRecords = records.map(({ nota_id, qty_beli, toko_id, pemasok_id, dapur_id, ...rest }) => rest);
        const retryRes = await supabase.from('pesanan').insert(cleanedRecords).select(ORDER_COLUMNS_LEGACY);
        if (!retryRes.error) {
          return retryRes.data || [];
        }
        const basicRes = await supabase.from('pesanan').insert(cleanedRecords).select();
        if (!basicRes.error) {
          return basicRes.data || [];
        }
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

  const parseBigIntOrNull = (val: any) => {
    if (val === undefined || val === null || val === '') return null;
    const n = Number(val);
    return !isNaN(n) && Number.isInteger(n) ? n : null;
  };
  if (updates.toko_id !== undefined || updates.tokoId !== undefined) {
    payload.toko_id = parseBigIntOrNull(updates.toko_id ?? updates.tokoId);
  }
  if (updates.pemasok_id !== undefined || updates.pemasokId !== undefined) {
    payload.pemasok_id = parseBigIntOrNull(updates.pemasok_id ?? updates.pemasokId);
  }
  if (updates.dapur_id !== undefined || updates.dapurId !== undefined) {
    payload.dapur_id = parseBigIntOrNull(updates.dapur_id ?? updates.dapurId);
  }

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
  if (updates.cashback !== undefined) {
    payload.cashback = Math.max(0, Number(updates.cashback) || 0);
  }
  if (updates.retur !== undefined) {
    payload.retur = Math.max(0, Number(updates.retur) || 0);
  }
  if (updates.nota_id !== undefined || updates.notaId !== undefined) {
    payload.nota_id = updates.nota_id || updates.notaId;
  }
  if (updates.qty_beli !== undefined || updates.qtyBeli !== undefined) {
    payload.qty_beli = Number(updates.qty_beli !== undefined ? updates.qty_beli : updates.qtyBeli);
  }

  if (!isSupabaseConfigured()) {
    return updateLocalOrder(id, payload);
  }

  try {
    const supabase = getSupabase();
    let { data, error } = await supabase
      .from('pesanan')
      .update(payload)
      .eq('id', id)
      .select(ORDER_COLUMNS);

    if (error && (error.code === '42703' || error.message?.includes('does not exist') || error.message?.includes('nota_id') || error.message?.includes('qty_beli') || error.code === 'PGRST204')) {
      const { nota_id, qty_beli, ...cleaned } = payload;
      const retryRes = await supabase
        .from('pesanan')
        .update(cleaned)
        .eq('id', id)
        .select(ORDER_COLUMNS_LEGACY);
      data = retryRes.data as any;
      error = retryRes.error;
    }

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

  if (!isSupabaseConfigured()) {
    return updateBatchLocalOrders(ids, payload);
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

  if (!isSupabaseConfigured()) {
    return deleteLocalOrders(ids);
  }

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
    return { deletedCount: count || ids.length, success: true };
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
export async function getTransactionsFromDb(limit: number = 500, page: number = 1) {
  // Menghapus limit 100 terpotong: izinkan hingga 5000 transaksi
  const safeLimit = Math.min(limit || 500, 5000);
  const offset = (page - 1) * safeLimit;

  if (!isSupabaseConfigured()) {
    return getLocalTransactions(safeLimit);
  }

  try {
    const supabase = getSupabase();
    let query = supabase
      .from('transaksi')
      .select(TRANSACTION_COLUMNS)
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + safeLimit - 1);

    const { data, error } = await query;

    if (error) {
      if (isTableMissingError(error)) {
        return getLocalTransactions(safeLimit);
      }
      // If error is caused by missing 'catatan' column before migration is run, fallback to legacy columns
      if (error.message && (error.message.includes('catatan') || error.code === 'PGRST204')) {
        const fallbackRes = await supabase
          .from('transaksi')
          .select(TRANSACTION_COLUMNS_LEGACY)
          .order('tanggal', { ascending: false })
          .order('created_at', { ascending: false })
          .range(offset, offset + safeLimit - 1);
        if (!fallbackRes.error) {
          return fallbackRes.data || [];
        }
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
  const itemsCatatan = Array.isArray(tx.items) ? tx.items.map((i: any) => i.catatan).filter(Boolean).join('; ') : '';
  const record: any = {
    ...(tx.id ? { id: String(tx.id) } : {}),
    invoice_number: tx.invoice_number || tx.invoiceNumber || `INV-${Date.now()}`,
    tanggal: tx.tanggal || new Date().toISOString().split('T')[0],
    tanggal_print: tx.tanggal_print || tx.tanggalPrint || new Date().toLocaleDateString('id-ID'),
    pemasok: tx.pemasok || '',
    barang: tx.barang || (Array.isArray(tx.items) ? tx.items.map((i: any) => `${i.namaBarang || i.item} (${i.qty})`).join(', ') : ''),
    toko: tx.toko || '',
    dapur: tx.dapur || tx.tujuanDapur || '',
    qty: Number(tx.qty) || (Array.isArray(tx.items) ? tx.items.reduce((s: number, i: any) => s + (Number(i.qty) || 0), 0) : 0),
    harga_beli: Number(tx.harga_beli !== undefined ? tx.harga_beli : tx.totalBeli) || 0,
    total: Number(tx.total !== undefined ? tx.total : tx.totalJual) || 0,
    total_profit: Number(tx.total_profit !== undefined ? tx.total_profit : tx.totalProfit) || 0,
    status_pembayaran: tx.status_pembayaran || tx.status || 'PAID',
    items: Array.isArray(tx.items) ? tx.items : [],
    catatan: tx.catatan || itemsCatatan || '',
    created_at: tx.created_at || tx.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    return createLocalTransaction(record);
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('transaksi').insert(record).select(TRANSACTION_COLUMNS);
    if (error) {
      if (isTableMissingError(error)) {
        return createLocalTransaction(record);
      }
      // If error because column 'catatan' does not exist yet, retry without 'catatan'
      if (error.message && (error.message.includes('catatan') || error.code === 'PGRST204')) {
        const { catatan: _, ...recordWithoutCatatan } = record;
        const retryRes = await supabase.from('transaksi').insert(recordWithoutCatatan).select(TRANSACTION_COLUMNS_LEGACY);
        if (!retryRes.error) {
          return retryRes.data?.[0] || null;
        }
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

  if (!isSupabaseConfigured()) {
    return deleteLocalTransactions(ids);
  }

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
  if (!isSupabaseConfigured()) {
    return getLocalNotes();
  }
  try {
    const supabase = getSupabase();
    let result: any = await supabase
      .from('notes')
      .select(NOTE_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Fallback if items column does not exist yet
    if (result.error && (result.error.code === '42703' || result.error.message?.includes('items'))) {
      result = await supabase
        .from('notes')
        .select(NOTE_COLUMNS_LEGACY)
        .order('created_at', { ascending: false })
        .limit(limit);
    }

    if (result.error) {
      if (isTableMissingError(result.error)) {
        return getLocalNotes();
      }
      throw result.error;
    }
    return result.data || [];
  } catch (err: any) {
    if (isTableMissingError(err)) {
      return getLocalNotes();
    }
    throw err;
  }
}

export async function createNoteInDb(note: any) {
  // Extract items array if provided
  let itemsArray = Array.isArray(note.items) ? note.items : [];
  
  // If itemsArray is empty but single item provided, wrap it
  if (itemsArray.length === 0 && (note.item || note.namaBarang)) {
    itemsArray = [{
      id: `item-${Date.now()}`,
      namaBarang: note.item || note.namaBarang,
      qty: note.qty !== undefined && note.qty !== null ? Number(note.qty) : 1,
      satuan: note.satuan || 'Kg',
      pemasok: note.pemasok || '',
      catatan: note.catatan || '',
    }];
  }

  // Summary fields for backward compatibility
  const firstItem = itemsArray[0];
  const summaryItem = firstItem ? firstItem.namaBarang : (note.item || note.namaBarang || '');
  const summaryQty = firstItem ? firstItem.qty : (note.qty !== undefined && note.qty !== null ? Number(note.qty) : null);
  const summarySatuan = firstItem ? firstItem.satuan : (note.satuan || 'Kg');

  const record: Record<string, any> = {
    ...(note.id ? { id: String(note.id) } : {}),
    dapur: note.dapur || note.tujuanDapur || '',
    item: summaryItem,
    qty: summaryQty,
    satuan: summarySatuan,
    catatan: note.catatan || '',
    status: note.status || (note.isDone ? 'DONE' : 'FOLLOW UP'),
    is_done: Boolean(note.is_done !== undefined ? note.is_done : note.isDone),
    order_id: note.order_id || note.orderId || null,
    created_at: note.created_at || note.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: itemsArray,
  };

  if (!isSupabaseConfigured()) {
    return createLocalNote(record);
  }

  try {
    const supabase = getSupabase();
    let data: any = null;
    let error: any = null;
    const initialRes = await supabase.from('notes').insert(record).select(NOTE_COLUMNS);
    data = initialRes.data;
    error = initialRes.error;

    if (error && (error.code === '42703' || error.message?.includes('items'))) {
      const legacyRecord = { ...record };
      delete legacyRecord.items;
      const res = await supabase.from('notes').insert(legacyRecord).select(NOTE_COLUMNS_LEGACY);
      data = res.data;
      error = res.error;
    }
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
  if (updates.order_id !== undefined || updates.orderId !== undefined) payload.order_id = updates.order_id || updates.orderId;

  if (updates.items !== undefined) {
    payload.items = Array.isArray(updates.items) ? updates.items : [];
    if (payload.items.length > 0 && !payload.item) {
      payload.item = payload.items[0].namaBarang;
      if (payload.qty === undefined) payload.qty = payload.items[0].qty;
      if (payload.satuan === undefined) payload.satuan = payload.items[0].satuan;
    }
  }

  if (!isSupabaseConfigured()) {
    return updateLocalNote(id, payload);
  }

  try {
    const supabase = getSupabase();
    let data: any = null;
    let error: any = null;
    const initialRes = await supabase.from('notes').update(payload).eq('id', id).select(NOTE_COLUMNS);
    data = initialRes.data;
    error = initialRes.error;

    if (error && (error.code === '42703' || error.message?.includes('items'))) {
      const legacyPayload = { ...payload };
      delete legacyPayload.items;
      const res = await supabase.from('notes').update(legacyPayload).eq('id', id).select(NOTE_COLUMNS_LEGACY);
      data = res.data;
      error = res.error;
    }
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
  if (!isSupabaseConfigured()) {
    return deleteLocalNote(id);
  }

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
export async function getPeriodSummaryFromDb(
  period: string = 'mingguan',
  dateStr?: string,
  customStartDate?: string,
  customEndDate?: string
) {
  const targetDate = dateStr || new Date().toISOString().split('T')[0];

  if (!isSupabaseConfigured()) {
    return getLocalPeriodSummary(period, targetDate, customStartDate, customEndDate);
  }

  try {
    const supabase = getSupabase();
    // 1. Try calling the PostgreSQL RPC function get_period_summary (hanya jika bukan rentang kustom)
    if (!customStartDate && !customEndDate) {
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
    }

    // 2. Direct Supabase Query aggregation
    // REVENUE RECOGNITION (BASIS AKRUAL):
    // Omzet diakui saat pesanan dibuat/dikirim ke dapur (seluruh pesanan non-CANCELLED, baik status PAID maupun UNPAID).
    let startDate = customStartDate;
    let endDate = customEndDate;
    if (!startDate || !endDate) {
      const range = getDateRangeForPeriod(period, targetDate);
      startDate = startDate || range.startDate;
      endDate = endDate || range.endDate;
    }

    let query = supabase
      .from('pesanan')
      .select('tanggal,dapur,toko,qty,qty_beli,retur,harga_jual,harga_beli,pemasok,cashback,status')
      .neq('status', 'CANCELLED');

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
        return getLocalPeriodSummary(period, targetDate, startDate, endDate);
      }
      throw error;
    }

    const orders = (rawOrders as any[]) || [];
    let totalQty = 0;
    let totalPendapatan = 0;
    let totalPengeluaran = 0;
    let totalLabaBersih = 0;
    let totalKeKoperasi = 0;

    const storeMap: Record<string, {
      totalQty: number;
      totalBeli: number;
      totalJual: number;
      totalLabaBersih: number;
      totalKeKoperasi: number;
      count: number;
      pemasokSet: Set<string>;
      batchKeys: Set<string>;
    }> = {};
    const globalBatchKeys = new Set<string>();

    for (const item of orders) {
      if (item.status === 'CANCELLED') continue;

      const rawQtyJual = Number(item.qty) || 0;
      const rawQtyBeli = (item as any).qty_beli !== undefined && (item as any).qty_beli !== null
        ? Number((item as any).qty_beli)
        : ((item as any).qtyBeli !== undefined && (item as any).qtyBeli !== null
          ? Number((item as any).qtyBeli)
          : rawQtyJual);
      const returQty = Math.max(0, Number(item.retur) || 0);
      const qtyFinal = Math.max(0, rawQtyJual - returQty);
      const qtyBeliEfektif = Math.max(0, rawQtyBeli - returQty);

      const beli = Number(item.harga_beli || (item as any).hargaBeli) || 0;
      const jual = Number(item.harga_jual || (item as any).hargaJual) || 0;
      const cb = Number(item.cashback) || 0;

      // FORMULA BISNIS FINAL:
      // omzet = harga_jual * qty_final
      // modal = harga_beli * qty_beli_efektif
      // cashback <= 0: laba_bersih = omzet - modal, ke_koperasi = 0
      // cashback > 0: laba_bersih = (cashback - harga_beli) * qty_final, ke_koperasi = (harga_jual - cashback) * qty_final
      const omzetItem = jual * qtyFinal;
      const modalItem = beli * qtyBeliEfektif;
      const labaBersihItem = cb > 0 ? (cb - beli) * qtyFinal : (omzetItem - modalItem);
      const keKoperasiItem = cb > 0 ? (jual - cb) * qtyFinal : 0;

      // Retur ditanggung PENUH oleh PEMASOK, TIDAK membebani modal toko.
      const modalTokoItem = rawQtyBeli * beli;

      totalQty += qtyFinal;
      totalPendapatan += omzetItem;
      totalPengeluaran += modalItem;
      totalLabaBersih += labaBersihItem;
      totalKeKoperasi += keKoperasiItem;

      const tokoKey = (item.toko || 'Lainnya').trim() || 'Lainnya';
      if (!storeMap[tokoKey]) {
        storeMap[tokoKey] = {
          totalQty: 0,
          totalBeli: 0,
          totalJual: 0,
          totalLabaBersih: 0,
          totalKeKoperasi: 0,
          count: 0,
          pemasokSet: new Set<string>(),
          batchKeys: new Set<string>(),
        };
      }
      storeMap[tokoKey].totalQty += qtyFinal;
      storeMap[tokoKey].totalBeli += modalTokoItem;
      storeMap[tokoKey].totalJual += omzetItem;
      storeMap[tokoKey].totalLabaBersih += labaBersihItem;
      storeMap[tokoKey].totalKeKoperasi += keKoperasiItem;
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
        const profit = val.totalLabaBersih;
        const marginPercent = val.totalJual > 0 ? Math.round((profit / val.totalJual) * 100) : 0;
        return {
          toko,
          totalQty: val.totalQty,
          totalBeli: val.totalBeli,
          totalJual: val.totalJual,
          profit,
          totalKeKoperasi: val.totalKeKoperasi,
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
      profitBersih: totalLabaBersih,
      totalLabaBersih,
      totalKeKoperasi,
      storeBreakdowns,
    };
  } catch (err: any) {
    if (isTableMissingError(err)) {
      return getLocalPeriodSummary(period, targetDate, customStartDate, customEndDate);
    }
    throw err;
  }
}

// =============================================================================
// MASTER DATA (toko, pemasok, dapur) CRUD & DEPENDENCY CHECK
// =============================================================================

export async function getMasterTokoFromDb() {
  if (!isSupabaseConfigured()) {
    return getLocalMasterToko();
  }
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

  if (!isSupabaseConfigured()) {
    return createLocalMasterToko(cleanName);
  }

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

  if (!isSupabaseConfigured()) {
    return deleteLocalMasterToko(id);
  }

  try {
    const supabase = getSupabase();
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
    let query = supabase.from('toko').delete();
    if (isUUID) {
      query = query.eq('id', id.trim());
    } else {
      query = query.ilike('nama', id.trim());
    }
    const { error } = await query;

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
  if (!isSupabaseConfigured()) {
    return getLocalMasterPemasok();
  }
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

  if (!isSupabaseConfigured()) {
    return createLocalMasterPemasok(cleanName);
  }

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

  if (!isSupabaseConfigured()) {
    return deleteLocalMasterPemasok(id);
  }

  try {
    const supabase = getSupabase();
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
    let query = supabase.from('pemasok').delete();
    if (isUUID) {
      query = query.eq('id', id.trim());
    } else {
      query = query.ilike('nama', id.trim());
    }
    const { error } = await query;

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
  if (!isSupabaseConfigured()) {
    return getLocalMasterDapur();
  }
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

  if (!isSupabaseConfigured()) {
    return createLocalMasterDapur(cleanName, alamat);
  }

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

  if (!isSupabaseConfigured()) {
    return deleteLocalMasterDapur(id);
  }

  try {
    const supabase = getSupabase();
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
    let query = supabase.from('dapur').delete();
    if (isUUID) {
      query = query.eq('id', id.trim());
    } else {
      const cleanName = id.trim().replace(/^Dapur\s+/i, '');
      query = query.or(`nama.eq.${cleanName},nama.eq.${id.trim()}`);
    }
    const { error } = await query;

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
  if (!isSupabaseConfigured()) {
    return checkLocalMasterUsage(type, id, name);
  }

  try {
    const supabase = getSupabase();

    // Get the name if not provided
    let entityName = name;
    if (!entityName && id) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
      if (isUUID) {
        const table = type === 'toko' ? 'toko' : type === 'pemasok' ? 'pemasok' : 'dapur';
        const { data } = await supabase.from(table).select('nama').eq('id', id.trim()).maybeSingle();
        if (data?.nama) entityName = data.nama;
      } else {
        entityName = id.trim();
      }
    }

    let orderCount = 0;
    let transaksiCount = 0;

    if (type === 'toko' && entityName) {
      const p3 = supabase.from('pesanan').select('id', { count: 'exact', head: true }).ilike('toko', `%${entityName}%`);
      const p4 = supabase.from('transaksi').select('id', { count: 'exact', head: true }).ilike('toko', `%${entityName}%`);
      const [r3, r4] = await Promise.all([p3, p4]);
      orderCount = r3.count || 0;
      transaksiCount = r4.count || 0;
    } else if (type === 'pemasok' && entityName) {
      const p3 = supabase.from('pesanan').select('id', { count: 'exact', head: true }).eq('pemasok', entityName);
      const p4 = supabase.from('transaksi').select('id', { count: 'exact', head: true }).eq('pemasok', entityName);
      const [r3, r4] = await Promise.all([p3, p4]);
      orderCount = r3.count || 0;
      transaksiCount = r4.count || 0;
    } else if (type === 'dapur' && entityName) {
      const cleanD = entityName.replace(/^Dapur\s+/i, '');
      const p3 = supabase.from('pesanan').select('id', { count: 'exact', head: true }).or(`dapur.ilike.%${cleanD}%,dapur.eq.${entityName}`);
      const p4 = supabase.from('transaksi').select('id', { count: 'exact', head: true }).or(`dapur.ilike.%${cleanD}%,dapur.eq.${entityName}`);
      const [r3, r4] = await Promise.all([p3, p4]);
      orderCount = r3.count || 0;
      transaksiCount = r4.count || 0;
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

export async function getMasterSatuanFromDb() {
  if (!isSupabaseConfigured()) {
    return getLocalMasterSatuan();
  }
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('satuan')
      .select(SATUAN_COLUMNS)
      .order('nama', { ascending: true });

    if (error) {
      if (isTableMissingError(error)) return getLocalMasterSatuan();
      throw error;
    }
    return data || [];
  } catch (err: any) {
    if (isTableMissingError(err)) return getLocalMasterSatuan();
    throw err;
  }
}

export async function createMasterSatuanInDb(nama: string) {
  const cleanName = (nama || '').trim();
  if (!cleanName) throw new Error('Nama satuan wajib diisi.');

  if (!isSupabaseConfigured()) {
    return createLocalMasterSatuan(cleanName);
  }

  try {
    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from('satuan')
      .select(SATUAN_COLUMNS)
      .ilike('nama', cleanName)
      .maybeSingle();

    if (existing) return existing;

    const { data, error } = await supabase
      .from('satuan')
      .insert({ nama: cleanName })
      .select(SATUAN_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        const { data: dup } = await supabase
          .from('satuan')
          .select(SATUAN_COLUMNS)
          .ilike('nama', cleanName)
          .maybeSingle();
        if (dup) return dup;
      }
      if (isTableMissingError(error)) return createLocalMasterSatuan(cleanName);
      throw error;
    }
    return data;
  } catch (err: any) {
    if (isTableMissingError(err)) return createLocalMasterSatuan(cleanName);
    throw err;
  }
}

export async function deleteMasterSatuanInDb(id: string) {
  if (!id) throw new Error('ID satuan wajib disertakan.');

  if (!isSupabaseConfigured()) {
    return deleteLocalMasterSatuan(id);
  }

  try {
    const supabase = getSupabase();
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
    let query = supabase.from('satuan').delete();
    if (isUUID) {
      query = query.eq('id', id.trim());
    } else {
      query = query.ilike('nama', id.trim());
    }
    const { error } = await query;

    if (error) {
      if (isTableMissingError(error)) return deleteLocalMasterSatuan(id);
      throw error;
    }
    return { success: true, message: 'Satuan berhasil dihapus.' };
  } catch (err: any) {
    if (isTableMissingError(err)) return deleteLocalMasterSatuan(id);
    throw err;
  }
}
