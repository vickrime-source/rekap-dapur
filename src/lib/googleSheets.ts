import { OrderItem, InvoiceRecord, NoteItem, PaymentStatus, DeliveryStatus } from '../types';

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
 * Checks connection status to Google Sheets API (Service Account)
 */
export async function checkGoogleSheetsConnection(): Promise<{
  success: boolean;
  configured: boolean;
  title?: string;
  clientEmail?: string | null;
  spreadsheetId?: string | null;
  sheets?: string[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/sheets-status');
    const json = await res.json();
    return json;
  } catch (err: any) {
    return {
      success: false,
      configured: false,
      error: err?.message || 'Gagal menghubungi backend Google Sheets API',
    };
  }
}

/**
 * Normalizes date values from various spreadsheet formats to YYYY-MM-DD
 */
export function normalizeDate(dateVal: any): string {
  if (!dateVal) return new Date().toISOString().split('T')[0];
  const str = String(dateVal).trim();
  if (!str) return new Date().toISOString().split('T')[0];

  // If already standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // If ISO string like 2026-08-11T17:00:00.000Z
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return str.split('T')[0];
  }

  // If format DD/MM/YYYY or DD-MM-YYYY
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY/MM/DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      // DD/MM/YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  // Indonesian text date format e.g. "10 Agustus 2026"
  const indonesianMonths: Record<string, string> = {
    januari: '01', jan: '01',
    februari: '02', feb: '02',
    maret: '03', mar: '03',
    april: '04', apr: '04',
    mei: '05', may: '05',
    juni: '06', jun: '06',
    juli: '07', jul: '07',
    agustus: '08', ags: '08', agu: '08',
    september: '09', sep: '09',
    oktober: '10', okt: '10',
    november: '11', nov: '11',
    desember: '12', des: '12',
  };

  const idMatch = str.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (idMatch) {
    const day = idMatch[1].padStart(2, '0');
    const monthKey = idMatch[2].toLowerCase();
    const month = indonesianMonths[monthKey] || '01';
    const year = idMatch[3];
    return `${year}-${month}-${day}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return str;
}

/**
 * Fetch rows from Google Sheets via backend /api/sheets-get (sheets.spreadsheets.values.get)
 */
export async function fetchSheetData<T = any>(
  sheet: SheetName,
  range?: string
): Promise<{ data: T[]; configured?: boolean; error: string | null }> {
  try {
    const url = `/api/sheets-get?sheet=${encodeURIComponent(sheet)}${range ? `&range=${encodeURIComponent(range)}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const json: ApiResponse<T[]> = await response.json();

    if (!response.ok || !json.success) {
      return {
        data: [],
        configured: json.configured ?? false,
        error: json.error || `HTTP ${response.status}: Gagal mengambil data dari Google Sheets`,
      };
    }

    return {
      data: (json.data || []) as T[],
      configured: json.configured ?? false,
      error: null,
    };
  } catch (err: any) {
    console.warn(`[GoogleSheets API] Warn fetchSheetData (${sheet}):`, err);
    return {
      data: [],
      configured: false,
      error: err?.message || 'Gagal terhubung ke backend Google Sheets API',
    };
  }
}

/**
 * Add row via backend /api/sheets-add (sheets.spreadsheets.values.append)
 */
export async function addRow(
  sheet: SheetName,
  data: Record<string, any>
): Promise<ApiResponse> {
  try {
    const response = await fetch('/api/sheets-add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sheet,
        data,
      }),
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      return {
        success: false,
        error: json.error || `HTTP ${response.status}: Gagal menambahkan data`,
      };
    }

    return {
      success: true,
      message: json.message,
      data: json.data,
      updatedRange: json.updatedRange,
    };
  } catch (err: any) {
    console.error(`[GoogleSheets API] Error addRow (${sheet}):`, err);
    return {
      success: false,
      error: err?.message || 'Gagal terhubung ke backend Google Sheets API',
    };
  }
}

/**
 * Update row or cell via backend /api/sheets-update (sheets.spreadsheets.values.update)
 */
export async function updateRow(
  sheet: SheetName,
  match: Record<string, any>,
  data: Record<string, any>,
  rowIndex?: number
): Promise<ApiResponse> {
  try {
    const response = await fetch('/api/sheets-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sheet,
        match,
        data,
        rowIndex,
      }),
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      return {
        success: false,
        error: json.error || `HTTP ${response.status}: Gagal mengupdate data`,
      };
    }

    return {
      success: true,
      message: json.message,
      updatedRows: json.updatedRows,
    };
  } catch (err: any) {
    console.error(`[GoogleSheets API] Error updateRow (${sheet}):`, err);
    return {
      success: false,
      error: err?.message || 'Gagal terhubung ke backend Google Sheets API',
    };
  }
}

/**
 * Direct specific cell update (e.g. range "pesanan!G5", value "PAID")
 */
export async function updateCell(
  sheet: SheetName,
  cellRange: string,
  value: any
): Promise<ApiResponse> {
  try {
    const response = await fetch('/api/sheets-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sheet,
        range: cellRange,
        value,
      }),
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      return {
        success: false,
        error: json.error || `HTTP ${response.status}: Gagal update cell`,
      };
    }

    return {
      success: true,
      message: json.message,
      updatedCells: json.updatedCells,
    };
  } catch (err: any) {
    console.error(`[GoogleSheets API] Error updateCell (${sheet}):`, err);
    return {
      success: false,
      error: err?.message || 'Gagal terhubung ke backend Google Sheets API',
    };
  }
}

/**
 * Update whole group of orders (Dapur + Toko + Date) atomically
 */
export async function updateGroupStatus(
  sheet: 'pesanan',
  match: { DATE?: string; DAPUR?: string; TOKO?: string; [key: string]: any },
  data: { PAYMENT?: string; DILEVERY?: string; STATUS?: string; [key: string]: any },
  rowIndices?: number[]
): Promise<ApiResponse> {
  try {
    const response = await fetch('/api/sheets-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sheet,
        action: 'updateGroup',
        match,
        data,
        rowIndices,
      }),
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      return {
        success: false,
        error: json.error || `HTTP ${response.status}: Gagal update status group`,
      };
    }

    return {
      success: true,
      message: json.message,
      updatedRows: json.updatedRows,
    };
  } catch (err: any) {
    console.error(`[GoogleSheets API] Error updateGroupStatus (${sheet}):`, err);
    return {
      success: false,
      error: err?.message || 'Gagal terhubung ke backend Google Sheets API',
    };
  }
}

/**
 * Delete row from Google Sheets
 */
export async function deleteRow(
  sheet: SheetName,
  match: Record<string, any>,
  rowIndex?: number
): Promise<ApiResponse> {
  try {
    const response = await fetch('/api/sheets-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sheet,
        match,
        rowIndex,
      }),
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      return {
        success: false,
        error: json.error || `HTTP ${response.status}: Gagal menghapus baris`,
      };
    }

    return {
      success: true,
      message: json.message,
    };
  } catch (err: any) {
    console.error(`[GoogleSheets API] Error deleteRow (${sheet}):`, err);
    return {
      success: false,
      error: err?.message || 'Gagal terhubung ke backend Google Sheets API',
    };
  }
}

/**
 * Builder helper untuk membuat payload "data" sheet "pesanan"
 * Header: DAPUR, ITEM, DATE, QTY, TOKO, PAYMENT, DILEVERY, H. JUAL, H. BELI, PEMASOK, STATUS
 */
export function buildPesananPayload(item: Partial<OrderItem> & {
  tujuanDapur?: string;
  namaBarang?: string;
  tanggal?: string;
  qty?: number;
  toko?: string;
  pemasok?: string;
  paymentStatus?: string;
  deliveryStatus?: string;
  status?: string;
  hargaJual?: number;
  hargaBeli?: number;
}) {
  const payStatus = item.paymentStatus || (item.status === 'selesai' ? 'PAID' : 'UNPAID');
  const delStatus = item.deliveryStatus || (item.status === 'selesai' ? 'DONE' : 'PENDING');
  const orderStatus = payStatus === 'PAID' && delStatus === 'DONE' ? 'selesai' : (item.status || 'pending');

  return {
    DAPUR: item.tujuanDapur || '',
    ITEM: item.namaBarang || '',
    DATE: item.tanggal ? normalizeDate(item.tanggal) : new Date().toISOString().split('T')[0],
    QTY: Number(item.qty) || 0,
    TOKO: item.toko || '',
    PAYMENT: payStatus,
    DILEVERY: delStatus,
    'H. JUAL': Number(item.hargaJual) || 0,
    'H. BELI': Number(item.hargaBeli) || 0,
    PEMASOK: item.pemasok || 'Pemasok 1',
    STATUS: orderStatus,
  };
}

/**
 * Builder helper untuk membuat payload "data" sheet "notes"
 * Header: ID, DAPUR, ITEM, CATATAN, STATUS, CREATED_AT
 */
export function buildNotesPayload(note: Partial<NoteItem>) {
  return {
    ID: note.id || `note-${Date.now()}`,
    DAPUR: note.tujuanDapur || 'Siliragung',
    ITEM: note.namaBarang || '',
    CATATAN: note.catatan || '',
    STATUS: note.isDone ? 'DONE' : 'FOLLOW UP',
    CREATED_AT: note.createdAt || new Date().toISOString(),
  };
}

/**
 * Builder helper untuk membuat payload "data" sheet "transaksi"
 * Header: TANGGAL, PEMASOK, BARANG, TOKO, QTY, H. BELI, TOTAL, STATUS
 */
export function buildTransaksiPayload(invoice: {
  tanggalPrint?: string;
  tanggal?: string;
  toko?: string;
  totalBeli?: number;
  totalJual?: number;
  items?: OrderItem[];
  pemasok?: string;
  status?: string;
}) {
  const items = invoice.items || [];
  const totalQty = items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
  const barangSummary = items.map((i) => `${i.namaBarang} (${i.qty})`).join(', ');
  const pemasokName = invoice.pemasok || items[0]?.pemasok || 'Pemasok 1';

  return {
    TANGGAL: invoice.tanggalPrint || invoice.tanggal || '',
    PEMASOK: pemasokName,
    BARANG: barangSummary,
    TOKO: invoice.toko || '',
    QTY: totalQty,
    'H. BELI': Number(invoice.totalBeli) || 0,
    TOTAL: Number(invoice.totalJual) || 0,
    STATUS: invoice.status || 'LUNAS',
  };
}

/**
 * Normalizes payment status string from various spreadsheet representations
 */
export function normalizePaymentStatus(val: any, fallbackStatus: string = 'pending'): PaymentStatus {
  if (!val) {
    return fallbackStatus.toLowerCase() === 'selesai' ? 'PAID' : 'UNPAID';
  }
  const clean = String(val).trim().toUpperCase();
  if (['PAID', 'LUNAS', 'SUDAH', 'DONE', 'YES', '1', 'TRUE'].includes(clean)) {
    return 'PAID';
  }
  return 'UNPAID';
}

/**
 * Normalizes delivery status string from various spreadsheet representations
 */
export function normalizeDeliveryStatus(val: any, fallbackStatus: string = 'pending'): DeliveryStatus {
  if (!val) {
    return fallbackStatus.toLowerCase() === 'selesai' ? 'DONE' : 'PENDING';
  }
  const clean = String(val).trim().toUpperCase();
  if (['DONE', 'SELESAI', 'TERKIRIM', 'SUDAH', 'YES', '1', 'TRUE'].includes(clean)) {
    return 'DONE';
  }
  return 'PENDING';
}

/**
 * Mapper helper untuk baris raw dari Sheet Pesanan ke TypeScript OrderItem
 */
export function mapRawOrder(row: any): OrderItem {
  const statusStr = (row.STATUS || row.status || 'pending').toString().toLowerCase();
  const rawPay = row.PAYMENT ?? row.paymentStatus ?? row.payment_status ?? row.Status_Bayar;
  const rawDel = row.DILEVERY ?? row.DELIVERY ?? row.deliveryStatus ?? row.delivery_status ?? row.Status_Kirim;

  const paymentStatus = normalizePaymentStatus(rawPay, statusStr);
  const deliveryStatus = normalizeDeliveryStatus(rawDel, statusStr);

  const status =
    paymentStatus === 'PAID' && deliveryStatus === 'DONE'
      ? 'selesai'
      : statusStr === 'selesai' || statusStr === 'done'
      ? 'selesai'
      : 'pending';

  const rawDate = row.DATE || row.date || row.tanggal || row.Tanggal || '';
  const normalizedTanggal = normalizeDate(rawDate);

  return {
    id: (row.NO || row.no || row.id || row.ID || `ord-${row.rowIndex || Date.now()}-${Math.floor(Math.random() * 1000)}`).toString(),
    namaBarang: (row.ITEM || row.item || row.namaBarang || row.nama_barang || row['Nama Barang'] || '').toString(),
    qty: Number(row.QTY || row.qty || row.Qty || row.jumlah) || 0,
    hargaBeli: Number(row['H. BELI'] || row['H.BELI'] || row.hargaBeli || row.harga_beli || row['Harga Beli']) || 0,
    hargaJual: Number(row['H. JUAL'] || row['H.JUAL'] || row.hargaJual || row.harga_jual || row['Harga Jual']) || 0,
    toko: (row.TOKO || row.toko || row.Toko || '').toString(),
    tujuanDapur: (row.DAPUR || row.dapur || row.tujuanDapur || row.tujuan_dapur || row['Tujuan Dapur'] || '').toString(),
    pemasok: (row.PEMASOK || row.pemasok || row.Pemasok || 'Pemasok 1').toString(),
    status,
    paymentStatus,
    deliveryStatus,
    tanggal: normalizedTanggal,
    createdAt: (row.createdAt || row.created_at || new Date().toISOString()).toString(),
    catatan: (row.catatan || row.Catatan || '').toString(),
    rowIndex: row.rowIndex ? Number(row.rowIndex) : undefined,
  };
}

/**
 * Mapper helper untuk baris raw dari Sheet Notes ke TypeScript NoteItem
 */
export function mapRawNote(row: any): NoteItem {
  const statusStr = String(row.STATUS || row.status || row.isDone || '').toUpperCase().trim();
  const isDone = statusStr === 'DONE' || statusStr === 'SELESAI' || statusStr === 'TRUE' || statusStr === '1' || row.isDone === true;

  return {
    id: String(row.ID || row.id || row.NO || row.no || `note-${row.rowIndex || Date.now()}-${Math.floor(Math.random() * 1000)}`),
    tujuanDapur: String(row.DAPUR || row.dapur || row.tujuanDapur || 'Siliragung'),
    namaBarang: (row.ITEM || row.item || row.namaBarang || row.nama_barang) ? String(row.ITEM || row.item || row.namaBarang || row.nama_barang) : undefined,
    catatan: String(row.CATATAN || row.catatan || row.NOTE || row.note || ''),
    isDone,
    createdAt: String(row.CREATED_AT || row.created_at || row.TANGGAL || row.tanggal || new Date().toISOString()),
  };
}

/**
 * Mapper helper untuk baris raw dari Sheet Transaksi ke TypeScript InvoiceRecord
 */
export function mapRawInvoice(row: any): InvoiceRecord {
  let items: OrderItem[] = [];
  if (typeof row.items === 'string') {
    try {
      items = JSON.parse(row.items);
    } catch {
      items = [];
    }
  } else if (Array.isArray(row.items)) {
    items = row.items.map(mapRawOrder);
  } else if (row.BARANG || row.barang) {
    // Parse summary string like "ayam (1), bayem (2)"
    const summary = String(row.BARANG || row.barang || '');
    const parts = summary.split(',').map((p) => p.trim()).filter(Boolean);
    items = parts.map((part, idx) => {
      const match = part.match(/^(.*?)(?:\s*\((\d+(?:\.\d+)?)\))?$/);
      const name = match ? match[1].trim() : part;
      const qty = match && match[2] ? parseFloat(match[2]) : 1;
      return {
        id: `synth-${row.NO || row.id || row.rowIndex || idx}-${idx}`,
        namaBarang: name,
        qty: qty,
        hargaBeli: 0,
        hargaJual: 0,
        toko: (row.TOKO || row.toko || '').toString(),
        tujuanDapur: (row.DAPUR || row.dapur || '').toString(),
        pemasok: (row.PEMASOK || row.pemasok || 'Pemasok 1').toString(),
        status: 'selesai',
        paymentStatus: 'PAID' as const,
        deliveryStatus: 'DONE' as const,
        tanggal: normalizeDate(row.TANGGAL || row.tanggal),
        createdAt: new Date().toISOString(),
      };
    });
  }

  const rawDate = row.TANGGAL || row.tanggal || row.tanggalPrint || row.tanggal_print || row['Tanggal Print'] || '';

  return {
    id: (row.NO || row.no || row.id || row.ID || `inv-${row.rowIndex || Date.now()}-${Math.floor(Math.random() * 1000)}`).toString(),
    invoiceNumber: (row.NO || row.no || row.invoiceNumber || row.invoice_number || row['Nomor Invoice'] || `INV-${row.NO || Date.now()}`).toString(),
    tanggalPrint: rawDate ? String(rawDate) : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    createdAt: (row.createdAt || row.created_at || new Date().toISOString()).toString(),
    tujuanDapur: (row.DAPUR || row.dapur || row.tujuanDapur || row.tujuan_dapur || '').toString(),
    toko: (row.TOKO || row.toko || row.Toko || '').toString(),
    items,
    totalBeli: Number(row['H. BELI'] || row.totalBeli || row.total_beli) || 0,
    totalJual: Number(row.TOTAL || row.totalJual || row.total_jual) || 0,
    totalProfit: Number(row.totalProfit || row.total_profit) || 0,
    rowIndex: row.rowIndex ? Number(row.rowIndex) : undefined,
    pemasok: (row.PEMASOK || row.pemasok || items[0]?.pemasok || 'Pemasok 1').toString(),
    status: (row.STATUS || row.status || 'PAID').toString(),
  };
}
