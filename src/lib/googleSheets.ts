import { OrderItem, InvoiceRecord, NoteItem, PaymentStatus, DeliveryStatus, PeriodSummaryStats } from '../types';
import { parseIndonesianNumber, formatTanggalBackend, formatJamBackend } from './formatters';
import {
  checkSupabaseStatus,
  mapRawOrder,
  buildPesananPayload,
  mapRawInvoice,
  buildTransaksiPayload,
  mapRawNote,
  buildNotesPayload,
  fetchOrdersFromDb,
  saveOrderToDb,
  updateOrderInDb,
  batchUpdateStatusInDb,
  deleteOrderFromDb,
  deleteOrdersFromDb,
  fetchTransactionsFromDb,
  saveTransactionToDb,
  deleteTransactionFromDb,
  fetchNotesFromDb,
  saveNoteToDb,
  updateNoteInDb,
  deleteNoteFromDb,
  fetchPeriodSummaryFromDb,
} from './supabaseDb';

export type SheetName = 'pesanan' | 'transaksi' | 'notes';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
  count?: number;
  [key: string]: any;
}

/**
 * Checks connection status to Supabase (PostgreSQL)
 * Replaces the old Google Sheets API connection check
 */
export async function checkGoogleSheetsConnection(): Promise<{
  success: boolean;
  configured: boolean;
  title?: string;
  clientEmail?: string | null;
  spreadsheetId?: string | null;
  sheets?: string[];
  tablesReady?: boolean;
  error?: string;
}> {
  try {
    const status = await checkSupabaseStatus();
    return {
      success: status.success,
      configured: status.configured,
      tablesReady: status.tablesReady,
      title: 'Supabase PostgreSQL Database',
      clientEmail: status.url || 'Supabase Cloud',
      spreadsheetId: status.url,
      sheets: ['pesanan', 'transaksi', 'notes'],
      error: status.message || status.errors?.join(', '),
    };
  } catch (err: any) {
    return {
      success: false,
      configured: false,
      error: err?.message || 'Gagal menghubungi server Supabase',
    };
  }
}

/**
 * Normalizes date values to YYYY-MM-DD
 */
export function normalizeDate(dateVal: any): string {
  if (!dateVal) return new Date().toISOString().split('T')[0];
  const str = String(dateVal).trim();
  if (!str) return new Date().toISOString().split('T')[0];

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }

  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Fetch data for a table from Supabase
 */
export async function fetchSheetData<T = any>(
  sheet: SheetName,
  options?: {
    period?: 'hari_ini' | 'mingguan' | 'bulan_ini' | 'all_time';
    date?: string;
    limit?: number;
    page?: number;
    forceRefresh?: boolean;
  }
): Promise<{ data: T[]; configured: boolean; error: string | null }> {
  try {
    if (sheet === 'pesanan') {
      const res = await fetchOrdersFromDb({
        period: options?.period || 'all_time',
        date: options?.date,
        limit: options?.limit || 100,
        page: options?.page,
        forceRefresh: options?.forceRefresh,
      });
      return {
        data: res.orders as unknown as T[],
        configured: true,
        error: res.error || null,
      };
    } else if (sheet === 'transaksi') {
      const res = await fetchTransactionsFromDb(options?.limit || 50, options?.page || 1, options?.forceRefresh);
      return {
        data: res.transactions as unknown as T[],
        configured: true,
        error: res.error || null,
      };
    } else if (sheet === 'notes') {
      const res = await fetchNotesFromDb(options?.forceRefresh);
      return {
        data: res.notes as unknown as T[],
        configured: true,
        error: res.error || null,
      };
    }
    return { data: [], configured: true, error: null };
  } catch (err: any) {
    return {
      data: [],
      configured: false,
      error: err?.message || 'Gagal memuat data dari Supabase',
    };
  }
}

/**
 * Add row via Supabase
 */
export async function addRow(
  sheet: SheetName,
  data: Record<string, any>
): Promise<ApiResponse> {
  try {
    if (sheet === 'pesanan') {
      const res = await saveOrderToDb(data as any);
      return { success: res.success, error: res.error, data: res.data };
    } else if (sheet === 'transaksi') {
      const res = await saveTransactionToDb(data as any);
      return { success: res.success, error: res.error };
    } else if (sheet === 'notes') {
      const res = await saveNoteToDb(data as any);
      return { success: res.success, error: res.error, data: res.data };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal menambahkan data ke Supabase' };
  }
}

/**
 * Update row via Supabase by ID
 */
export async function updateRow(
  sheet: SheetName,
  arg2?: any,
  arg3?: any,
  _arg4?: any
): Promise<ApiResponse> {
  try {
    let targetId: string | undefined;
    let updatePayload: Record<string, any> = {};

    if (arg2 && typeof arg2 === 'object' && ('id' in arg2 || 'match' in arg2 || 'data' in arg2)) {
      targetId = arg2.id || arg2.match?.id || arg2.match?.ID || arg2.data?.id;
      updatePayload = arg2.data || arg2;
    } else {
      // (sheet, match, data) signature
      targetId = arg2?.id || arg2?.ID;
      updatePayload = arg3 || {};
    }

    if (!targetId && arg2?.items && Array.isArray(arg2.items)) {
      const ids = arg2.items.map((i: any) => i.id).filter(Boolean);
      if (ids.length > 0) {
        const res = await batchUpdateStatusInDb(ids, updatePayload);
        return { success: res.success, error: res.error };
      }
    }

    if (!targetId) {
      // Try to find targetId from payload
      targetId = updatePayload.id;
    }

    if (sheet === 'pesanan') {
      if (targetId) {
        const res = await updateOrderInDb(String(targetId), updatePayload);
        return { success: res.success, error: res.error };
      }
    } else if (sheet === 'notes') {
      if (targetId) {
        const res = await updateNoteInDb(String(targetId), updatePayload);
        return { success: res.success, error: res.error };
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal update data di Supabase' };
  }
}

/**
 * Update group status (batch status update) via Supabase
 */
export async function updateGroupStatus(
  _sheetOrOpts: any,
  arg2?: any,
  arg3?: any,
  arg4?: any
): Promise<ApiResponse> {
  try {
    let ids: string[] = [];
    let updates: any = {};

    if (_sheetOrOpts && typeof _sheetOrOpts === 'object' && _sheetOrOpts.items) {
      ids = _sheetOrOpts.items.map((i: any) => i.id).filter(Boolean);
      if (_sheetOrOpts.type === 'payment') {
        updates = { paymentStatus: _sheetOrOpts.status };
      } else {
        updates = { deliveryStatus: _sheetOrOpts.status };
      }
    } else if (arg2 && typeof arg2 === 'object') {
      if (Array.isArray(arg4)) {
        ids = arg4.map(String);
      } else if (arg2.items) {
        ids = arg2.items.map((i: any) => i.id).filter(Boolean);
      }
      updates = arg3 || {};
    }

    if (ids.length > 0) {
      const res = await batchUpdateStatusInDb(ids, updates);
      return { success: res.success, error: res.error };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal update status batch di Supabase' };
  }
}

/**
 * Delete row or batch rows via Supabase
 */
export async function deleteRow(
  sheet: SheetName,
  optionsOrMatch: any,
  _rowIndex?: any
): Promise<ApiResponse> {
  try {
    const opts = optionsOrMatch || {};
    const targetId = opts.id || opts.match?.id;
    const targetIds = opts.ids || opts.rowIndices;

    if (sheet === 'pesanan') {
      if (targetIds && Array.isArray(targetIds) && targetIds.length > 0) {
        const res = await deleteOrdersFromDb(targetIds.map(String));
        return { success: res.success, error: res.error };
      } else if (targetId) {
        const res = await deleteOrderFromDb(String(targetId));
        return { success: res.success, error: res.error };
      }
    } else if (sheet === 'transaksi') {
      if (targetId) {
        const res = await deleteTransactionFromDb(String(targetId));
        return { success: res.success, error: res.error };
      }
    } else if (sheet === 'notes') {
      if (targetId) {
        const res = await deleteNoteFromDb(String(targetId));
        return { success: res.success, error: res.error };
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal menghapus data dari Supabase' };
  }
}

export async function deleteOldTransactions(): Promise<{ success: boolean; deletedCount: number }> {
  return { success: true, deletedCount: 0 };
}

export async function cleanupTransactionsBeyondDate(): Promise<{ success: boolean; deletedCount: number }> {
  return { success: true, deletedCount: 0 };
}

// Re-export mapper functions and types
export {
  mapRawOrder,
  buildPesananPayload,
  mapRawInvoice,
  buildTransaksiPayload,
  mapRawNote,
  buildNotesPayload,
  fetchOrdersFromDb,
  saveOrderToDb,
  updateOrderInDb,
  batchUpdateStatusInDb,
  deleteOrderFromDb,
  deleteOrdersFromDb,
  fetchTransactionsFromDb,
  saveTransactionToDb,
  deleteTransactionFromDb,
  fetchNotesFromDb,
  saveNoteToDb,
  updateNoteInDb,
  deleteNoteFromDb,
  fetchPeriodSummaryFromDb,
};
