import { google } from 'googleapis';

export const SHEET_SCHEMAS: Record<string, string[]> = {
  pesanan: ['NO', 'DAPUR', 'ITEM', 'DATE', 'QTY', 'TOKO', 'PAYMENT', 'DILEVERY', 'H. JUAL', 'H. BELI', 'CREATED AT'],
  transaksi: ['NO', 'TANGGAL', 'PEMASOK', 'BARANG', 'TOKO', 'QTY', 'H. BELI', 'TOTAL', 'STATUS', 'CREATED AT'],
  notes: ['ID', 'DAPUR', 'ITEM', 'CATATAN', 'STATUS', 'CREATED_AT'],
};

const HEADER_ALIASES: Record<string, string[]> = {
  PAYMENT: ['PAYMENT', 'BAYAR', 'STATUSBAYAR', 'STATUS_BAYAR', 'PAYMENTSTATUS', 'PAYMENT_STATUS', 'STATUSPEMBAYARAN'],
  DILEVERY: ['DILEVERY', 'DELIVERY', 'KIRIM', 'STATUSKIRIM', 'STATUS_KIRIM', 'PENGIRIMAN', 'DELIVERYSTATUS', 'DELIVERY_STATUS', 'STATUSPENGIRIMAN'],
  DELIVERY: ['DELIVERY', 'DILEVERY', 'KIRIM', 'STATUSKIRIM', 'STATUS_KIRIM', 'PENGIRIMAN', 'DELIVERYSTATUS', 'DELIVERY_STATUS', 'STATUSPENGIRIMAN'],
  STATUS: ['STATUS', 'STATUSPESANAN', 'STATUS_PESANAN', 'ORDERSTATUS', 'ORDER_STATUS'],
  ITEM: ['ITEM', 'BARANG', 'NAMABARANG', 'NAMA_BARANG', 'NAMA'],
  BARANG: ['BARANG', 'ITEM', 'NAMABARANG', 'NAMA_BARANG', 'NAMA'],
  DATE: ['DATE', 'TANGGAL', 'TGL'],
  TANGGAL: ['TANGGAL', 'DATE', 'TGL'],
  DAPUR: ['DAPUR', 'TUJUANDAPUR', 'TUJUAN_DAPUR'],
  TOKO: ['TOKO', 'TOKOKITA', 'STORE'],
  PEMASOK: ['PEMASOK', 'SUPPLIER'],
  QTY: ['QTY', 'JUMLAH', 'KUANTITAS'],
  'H. BELI': ['HBELI', 'HARGABELI', 'HARGA_BELI', 'H.BELI', 'TOTALBELI'],
  'H. JUAL': ['HJUAL', 'HARGAJUAL', 'HARGA_JUAL', 'H.JUAL', 'TOTALJUAL'],
  TOTAL: ['TOTAL', 'TOTALHARGA', 'TOTALJUAL', 'TOTAL_JUAL'],
  ID: ['ID', 'NO', 'KODE'],
  NO: ['NO', 'ID', 'INVOICENUMBER', 'NOMORINVOICE'],
  CATATAN: ['CATATAN', 'NOTE', 'NOTES', 'KETERANGAN'],
  'CREATED AT': ['CREATED AT', 'CREATED_AT', 'JAM', 'TIME', 'TIMESTAMP', 'WAKTU', 'CREATEDAT'],
};

export function cleanHeaderKey(key: string): string {
  if (!key) return '';
  return String(key).toUpperCase().replace(/[\s\.\_\-\:\/\\]/g, '');
}

/**
 * Normalizes any date representation (YYYY-MM-DD, DD/MM/YYYY, Indonesian dates) to YYYY-MM-DD
 */
function normalizeDateStr(dateStr?: any): string {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (!str) return '';

  // 1. ISO format: 2026-09-02 or 2026-09-02T...
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Slash format: DD/MM/YYYY or D/M/YYYY
  const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slashMatch) {
    const d = slashMatch[1].padStart(2, '0');
    const m = slashMatch[2].padStart(2, '0');
    const y = slashMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Fallback date parse
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {
    // ignore
  }

  return str.toLowerCase();
}

export function colIndexToLetter(index: number): string {
  let temp = index;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export function isSheetsConfigured(): boolean {
  let clientEmail = (process.env.GOOGLE_SHEETS_CLIENT_EMAIL || '').trim();
  let privateKey = (process.env.GOOGLE_SHEETS_PRIVATE_KEY || '').trim();
  const spreadsheetId = (process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '').trim();

  // If privateKey contains the full service account JSON, clientEmail and private_key can be extracted
  if (privateKey.startsWith('{')) {
    try {
      const parsed = JSON.parse(privateKey);
      if (parsed.client_email && !clientEmail) clientEmail = parsed.client_email;
      if (parsed.private_key) privateKey = parsed.private_key;
    } catch {
      // ignore
    }
  }

  return !!(clientEmail && privateKey && spreadsheetId);
}

export function getSheetsClient() {
  let clientEmail = (process.env.GOOGLE_SHEETS_CLIENT_EMAIL || '').trim();
  let privateKey = (process.env.GOOGLE_SHEETS_PRIVATE_KEY || '').trim();
  const spreadsheetId = (process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '').trim();

  // Robust parsing: If the user pasted the entire Service Account JSON file into GOOGLE_SHEETS_PRIVATE_KEY
  if (privateKey.startsWith('{')) {
    try {
      const parsed = JSON.parse(privateKey);
      if (parsed.client_email && !clientEmail) {
        clientEmail = parsed.client_email;
      }
      if (parsed.private_key) {
        privateKey = parsed.private_key;
      }
    } catch {
      // ignore JSON parse failure, fallback to raw string
    }
  }

  // Also support if clientEmail itself contains the JSON
  if (clientEmail.startsWith('{')) {
    try {
      const parsed = JSON.parse(clientEmail);
      if (parsed.client_email) clientEmail = parsed.client_email;
      if (parsed.private_key && !privateKey) privateKey = parsed.private_key;
    } catch {
      // ignore
    }
  }

  const missing: string[] = [];
  if (!clientEmail) missing.push('GOOGLE_SHEETS_CLIENT_EMAIL');
  if (!privateKey) missing.push('GOOGLE_SHEETS_PRIVATE_KEY');
  if (!spreadsheetId) missing.push('GOOGLE_SHEETS_SPREADSHEET_ID');

  if (missing.length > 0) {
    throw new Error(
      `Konfigurasi Google Sheets Service Account belum lengkap di environment variables: ${missing.join(', ')}. ` +
      `Pastikan variabel ini telah diatur di Settings atau Vercel / hosting.`
    );
  }

  // Sanitize private key: remove wrapping quotes and normalize escaped newlines
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  } else if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  return { sheets, spreadsheetId, clientEmail };
}

export function findColIdx(colName: string, headers: string[]): number {
  if (!colName || !headers || headers.length === 0) return -1;
  const cleanTarget = cleanHeaderKey(colName);

  // 1. Direct exact cleaned match
  const directIdx = headers.findIndex((h) => cleanHeaderKey(h) === cleanTarget);
  if (directIdx !== -1) return directIdx;

  // 2. Look up known aliases
  const aliases = HEADER_ALIASES[cleanTarget] || HEADER_ALIASES[colName.toUpperCase()] || [];
  for (const alias of aliases) {
    const cleanAlias = cleanHeaderKey(alias);
    const aliasIdx = headers.findIndex((h) => cleanHeaderKey(h) === cleanAlias);
    if (aliasIdx !== -1) return aliasIdx;
  }

  // 3. Substring match fallback (e.g. "STATUS_BAYAR" contains "BAYAR")
  return headers.findIndex((h) => {
    const cleanH = cleanHeaderKey(h);
    return cleanH.length >= 3 && cleanTarget.length >= 3 && (cleanH.includes(cleanTarget) || cleanTarget.includes(cleanH));
  });
}

/**
 * Known default sheet IDs for fast zero-read lookups
 */
export const KNOWN_SHEET_IDS: Record<string, number> = {
  pesanan: 0,
  transaksi: 104141443,
  notes: 1699387554,
};

interface SheetMetaInfo {
  title: string;
  sheetId: number;
}

interface SpreadsheetMetaCache {
  title: string;
  sheets: SheetMetaInfo[];
  timestamp: number;
}

let metaCache: SpreadsheetMetaCache | null = null;
const META_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache for spreadsheet structure

interface CachedRows {
  rows: any[];
  timestamp: number;
}
const rowsCache: Record<string, CachedRows> = {};
const ROWS_CACHE_TTL_MS = 4000; // 4 seconds cache to deduplicate rapid consecutive calls

export function invalidateSheetCache(sheetName?: string) {
  if (sheetName) {
    const key = sheetName.trim().toLowerCase();
    delete rowsCache[key];
    delete rowsCache[`${key}_default`];
    for (const k of Object.keys(rowsCache)) {
      if (k.startsWith(`${key}_`)) {
        delete rowsCache[k];
      }
    }
  } else {
    for (const k of Object.keys(rowsCache)) {
      delete rowsCache[k];
    }
  }
}

/**
 * Executes a Google Sheets API call with automatic retry on 429 / Quota Exceeded
 */
export async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, baseDelayMs = 1500): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const isQuota =
        err?.status === 429 ||
        err?.code === 429 ||
        (typeof err?.message === 'string' &&
          (err.message.includes('Quota exceeded') ||
            err.message.includes('RATE_LIMIT_EXCEEDED') ||
            err.message.includes('userRateLimitExceeded')));

      if (isQuota && attempt <= retries) {
        const jitter = Math.floor(Math.random() * 500);
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
        console.warn(
          `[Google Sheets API] Rate limit/Quota 429 hit. Retrying attempt ${attempt}/${retries} in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

export async function getOrFetchMetadata(forceRefresh = false): Promise<SpreadsheetMetaCache> {
  const now = Date.now();
  if (!forceRefresh && metaCache && now - metaCache.timestamp < META_CACHE_TTL_MS) {
    return metaCache;
  }

  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await callWithRetry(() => sheets.spreadsheets.get({ spreadsheetId }));
  const sheetList: SheetMetaInfo[] = (res.data.sheets || [])
    .map((s) => ({
      title: s.properties?.title || '',
      sheetId: s.properties?.sheetId ?? 0,
    }))
    .filter((s) => s.title);

  metaCache = {
    title: res.data.properties?.title || 'Spreadsheet Tanpa Judul',
    sheets: sheetList,
    timestamp: now,
  };

  return metaCache;
}

/**
 * Checks connection and returns metadata about the connected spreadsheet
 */
export async function getSheetsStatus() {
  try {
    const { clientEmail, spreadsheetId } = getSheetsClient();
    const meta = await getOrFetchMetadata(false);
    const sheetTitles = meta.sheets.map((s) => s.title);

    return {
      success: true,
      configured: true,
      clientEmail,
      spreadsheetId,
      title: meta.title || 'Spreadsheet Tanpa Judul',
      sheets: sheetTitles,
    };
  } catch (err: any) {
    let clientEmail = (process.env.GOOGLE_SHEETS_CLIENT_EMAIL || '').trim();
    let privateKey = (process.env.GOOGLE_SHEETS_PRIVATE_KEY || '').trim();
    const spreadsheetId = (process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '').trim();

    if (privateKey.startsWith('{')) {
      try {
        const parsed = JSON.parse(privateKey);
        if (parsed.client_email) clientEmail = parsed.client_email;
      } catch {
        // ignore
      }
    }

    return {
      success: false,
      configured: !!(clientEmail && spreadsheetId),
      clientEmail: clientEmail || null,
      spreadsheetId: spreadsheetId || null,
      error: err?.message || 'Gagal terhubung ke Google Sheets API',
    };
  }
}

/**
 * Helper to ensure a specific sheet tab exists and has headers if empty.
 * Returns the exact title found in the spreadsheet.
 */
export async function ensureSheet(sheetName: string): Promise<string> {
  const cleanTarget = sheetName.trim().toLowerCase();

  // 1. If it's a known default sheet, return immediately! Zero read requests!
  if (KNOWN_SHEET_IDS[cleanTarget] !== undefined) {
    return cleanTarget;
  }

  // 2. Check metadata cache
  let meta: SpreadsheetMetaCache | null = null;
  try {
    meta = await getOrFetchMetadata(false);
  } catch (err) {
    console.warn('[ensureSheet] Failed to get metadata, using fallback:', err);
  }

  const existing = meta?.sheets.find((s) => s.title.trim().toLowerCase() === cleanTarget);
  if (existing) {
    return existing.title;
  }

  // 3. Genuine new sheet tab creation (rare)
  const { sheets, spreadsheetId } = getSheetsClient();
  await callWithRetry(() =>
    sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: cleanTarget,
              },
            },
          },
        ],
      },
    })
  );

  metaCache = null;

  const defaultHeaders = SHEET_SCHEMAS[cleanTarget] || SHEET_SCHEMAS.pesanan;
  await callWithRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${cleanTarget}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [defaultHeaders],
      },
    })
  );

  return cleanTarget;
}

/**
 * GET Sheet data converted to array of objects with rowIndex
 */
export async function getSheetRows(sheetName: string, customRange?: string, forceRefresh = false) {
  if (!isSheetsConfigured()) {
    return [];
  }

  const cleanTarget = sheetName.trim().toLowerCase();
  const cacheKey = `${cleanTarget}_${customRange || 'default'}`;
  const now = Date.now();

  if (!forceRefresh && rowsCache[cacheKey] && now - rowsCache[cacheKey].timestamp < ROWS_CACHE_TTL_MS) {
    return rowsCache[cacheKey].rows;
  }

  const { sheets, spreadsheetId } = getSheetsClient();
  const exactTitle = await ensureSheet(sheetName);

  // Default range covering all columns
  const range = customRange || `'${exactTitle}'!A:Z`;

  try {
    const response = await callWithRetry(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: 'FORMATTED_VALUE',
      })
    );

    const rawValues = response.data.values || [];
    if (rawValues.length <= 1) {
      rowsCache[cacheKey] = { rows: [], timestamp: now };
      return [];
    }

    const headers = rawValues[0].map((h) => String(h || '').trim());

    const rows = rawValues.slice(1).map((row, idx) => {
      const rowIndex = idx + 2; // Row 1 is header, so row index in Sheets is idx + 2
      const obj: Record<string, any> = { rowIndex };

      headers.forEach((header, colIdx) => {
        if (header) {
          const val = row[colIdx] !== undefined ? row[colIdx] : '';
          obj[header] = val;

          const clean = cleanHeaderKey(header);
          if (['HJUAL', 'HARGAJUAL', 'HGAJUAL', 'HARGA_JUAL', 'TOTALJUAL', 'SALESPRICE', 'JUAL'].includes(clean)) {
            obj['H. JUAL'] = val;
            obj['hargaJual'] = val;
          } else if (['HBELI', 'HARGABELI', 'HGABELI', 'HARGA_BELI', 'TOTALBELI', 'BUYPRICE', 'BELI', 'MODAL'].includes(clean)) {
            obj['H. BELI'] = val;
            obj['hargaBeli'] = val;
          } else if (['QTY', 'JUMLAH', 'KUANTITAS', 'COUNT', 'BANYAK'].includes(clean)) {
            obj['QTY'] = val;
            obj['qty'] = val;
          } else if (['ITEM', 'BARANG', 'NAMABARANG', 'NAMA_BARANG', 'NAMA', 'PRODUK'].includes(clean)) {
            obj['ITEM'] = val;
            obj['namaBarang'] = val;
          } else if (['DATE', 'TANGGAL', 'TGL'].includes(clean)) {
            obj['DATE'] = val;
            obj['tanggal'] = val;
          } else if (['DAPUR', 'TUJUANDAPUR', 'TUJUAN_DAPUR', 'KITCHEN'].includes(clean)) {
            obj['DAPUR'] = val;
            obj['tujuanDapur'] = val;
          } else if (['TOKO', 'TOKOKITA', 'STORE'].includes(clean)) {
            obj['TOKO'] = val;
            obj['toko'] = val;
          } else if (['PEMASOK', 'SUPPLIER', 'VENDOR'].includes(clean)) {
            obj['PEMASOK'] = val;
            obj['pemasok'] = val;
          } else if (['PAYMENT', 'BAYAR', 'STATUSBAYAR', 'STATUS_BAYAR', 'PAYMENTSTATUS'].includes(clean)) {
            obj['PAYMENT'] = val;
            obj['paymentStatus'] = val;
          } else if (['DILEVERY', 'DELIVERY', 'KIRIM', 'STATUSKIRIM', 'STATUS_KIRIM', 'DELIVERYSTATUS'].includes(clean)) {
            obj['DILEVERY'] = val;
            obj['deliveryStatus'] = val;
          } else if (['CREATEDAT', 'CREATED_AT', 'JAM', 'TIME', 'TIMESTAMP', 'WAKTU'].includes(clean)) {
            obj['CREATED AT'] = val;
            obj['createdAt'] = val;
          }
        }
      });

      return obj;
    });

    const filtered = rows.filter((r) => {
      return (
        r.ITEM ||
        r.BARANG ||
        r.CATATAN ||
        r.DAPUR ||
        r.TOKO ||
        r.ID ||
        r.NO ||
        r.DATE ||
        r.TANGGAL ||
        r.PEMASOK ||
        r.TOTAL ||
        r.namaBarang
      );
    });

    rowsCache[cacheKey] = { rows: filtered, timestamp: now };
    return filtered;
  } catch (err: any) {
    if (rowsCache[cacheKey] && (err?.status === 429 || err?.message?.includes('Quota exceeded'))) {
      console.warn(`[getSheetRows] Google Sheets Quota exceeded, returning cached data for "${sheetName}"`);
      return rowsCache[cacheKey].rows;
    }
    throw err;
  }
}

/**
 * ADD row using sheets.spreadsheets.values.append
 */
export async function addSheetRow(sheetName: string, rowData: Record<string, any>) {
  if (!isSheetsConfigured()) {
    return {
      success: true,
      configured: false,
      message: 'Google Sheets Service Account belum dikonfigurasi. Data tersimpan secara lokal.',
    };
  }
  const { sheets, spreadsheetId } = getSheetsClient();
  const exactTitle = await ensureSheet(sheetName);

  // Read current headers from row 1
  const headerRes = await callWithRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${exactTitle}'!1:1`,
    })
  );

  let headers = (headerRes.data.values?.[0] || []).map((h) => String(h || '').trim());

  if (headers.length === 0) {
    headers = SHEET_SCHEMAS[sheetName.toLowerCase()] || Object.keys(rowData);
    // Write headers
    await callWithRetry(() =>
      sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${exactTitle}'!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [headers],
        },
      })
    );
  }

  // If pesanan sheet is missing CREATED AT in header, append CREATED AT column header
  if (sheetName.toLowerCase() === 'pesanan' && findColIdx('CREATED AT', headers) === -1) {
    headers.push('CREATED AT');
    const colLetter = colIndexToLetter(headers.length - 1);
    try {
      await callWithRetry(() =>
        sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${exactTitle}'!${colLetter}1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['CREATED AT']],
          },
        })
      );
    } catch {
      // ignore if header update fails
    }
  }

  // Prepare normalized rowData
  const normalizedData = { ...rowData };
  if (sheetName.toLowerCase() === 'pesanan') {
    if (!normalizedData['CREATED AT'] && !normalizedData['createdAt']) {
      const now = new Date();
      normalizedData['CREATED AT'] = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    }
  }

  // Map data to ordered row values using findColIdx
  const rowValues = new Array(headers.length).fill('');
  for (const [key, val] of Object.entries(normalizedData)) {
    if (val !== undefined && val !== null) {
      const idx = findColIdx(key, headers);
      if (idx !== -1) {
        rowValues[idx] = val;
      }
    }
  }

  const appendRes = await callWithRetry(() =>
    sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${exactTitle}'!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowValues],
      },
    })
  );

  invalidateSheetCache(sheetName);

  return {
    success: true,
    action: 'add',
    updatedRange: appendRes.data.updates?.updatedRange,
    updatedRows: appendRes.data.updates?.updatedRows,
  };
}

/**
 * UPDATE cell or row using sheets.spreadsheets.values.update
 */
export async function updateSheetRows(
  sheetName: string,
  options: {
    range?: string;
    rowIndex?: number;
    rowIndices?: number[];
    column?: string;
    value?: any;
    data?: Record<string, any>;
    match?: Record<string, any>;
    action?: 'update' | 'updateGroup';
  }
) {
  if (!isSheetsConfigured()) {
    return {
      success: true,
      configured: false,
      message: 'Google Sheets Service Account belum dikonfigurasi. Data tersimpan secara lokal.',
    };
  }
  const { sheets, spreadsheetId } = getSheetsClient();
  const exactTitle = await ensureSheet(sheetName);

  // 1. Direct cell range update (e.g. 'pesanan!J5' or 'J5')
  if (options.range && options.value !== undefined) {
    const targetRange = options.range.includes('!') ? options.range : `'${exactTitle}'!${options.range}`;
    const updateRes = await callWithRetry(() =>
      sheets.spreadsheets.values.update({
        spreadsheetId,
        range: targetRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[options.value]],
        },
      })
    );
    invalidateSheetCache(sheetName);
    return { success: true, updatedCells: updateRes.data.updatedCells, range: targetRange };
  }

  // Get sheet headers & all current values for matching
  const allRes = await callWithRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${exactTitle}'!A:Z`,
    })
  );
  const allValues = allRes.data.values || [];
  if (allValues.length === 0) {
    throw new Error(`Sheet "${exactTitle}" masih kosong, belum ada data untuk diupdate.`);
  }

  const headers = allValues[0].map((h) => String(h || '').trim());
  const updatePayload = { ...(options.data || {}) };
  if (options.column && options.value !== undefined) {
    updatePayload[options.column] = options.value;
  }

  const isGroup = options.action === 'updateGroup';
  let targetRowIndices: number[] = [];

  // A. If rowIndices (array) provided:
  if (Array.isArray(options.rowIndices) && options.rowIndices.length > 0) {
    targetRowIndices = options.rowIndices.filter((idx) => typeof idx === 'number' && idx >= 2);
  }
  // B. If single rowIndex provided:
  else if (options.rowIndex && options.rowIndex >= 2) {
    targetRowIndices.push(options.rowIndex);
  }
  // C. If match criteria provided:
  else if (options.match && Object.keys(options.match).length > 0) {
    const matchCriteria = options.match;
    for (let r = 1; r < allValues.length; r++) {
      const row = allValues[r];
      let matches = true;

      for (const [mKey, mVal] of Object.entries(matchCriteria)) {
        if (mVal === undefined || mVal === null || mVal === '') continue;
        const colIdx = findColIdx(mKey, headers);
        if (colIdx !== -1) {
          const cellVal = String(row[colIdx] || '').trim();
          const expectedVal = String(mVal || '').trim();

          const cleanKey = cleanHeaderKey(mKey);
          if (cleanKey === 'DATE' || cleanKey === 'TANGGAL' || cleanKey === 'TGL') {
            if (normalizeDateStr(cellVal) !== normalizeDateStr(expectedVal)) {
              matches = false;
              break;
            }
          } else {
            if (cellVal.toLowerCase() !== expectedVal.toLowerCase()) {
              matches = false;
              break;
            }
          }
        }
      }

      if (matches) {
        targetRowIndices.push(r + 1); // 1-based index in sheet
        if (!isGroup) {
          break; // Stop at first match if not group
        }
      }
    }
  }

  if (targetRowIndices.length === 0) {
    return {
      success: false,
      updatedRows: 0,
      error: `Tidak ada baris yang cocok di sheet "${exactTitle}" untuk diupdate. Pastikan data ada di Google Sheets.`,
    };
  }

  // Prepare cell updates
  const batchData: { range: string; values: any[][] }[] = [];

  for (const rIdx of targetRowIndices) {
    for (const [colName, val] of Object.entries(updatePayload)) {
      const colIdx = findColIdx(colName, headers);
      if (colIdx !== -1) {
        const colLetter = colIndexToLetter(colIdx);
        batchData.push({
          range: `'${exactTitle}'!${colLetter}${rIdx}`,
          values: [[val]],
        });
      }
    }
  }

  if (batchData.length === 0) {
    return { 
      success: false, 
      updatedRows: 0, 
      error: `Kolom tujuan update (${Object.keys(updatePayload).join(', ')}) tidak ditemukan di sheet "${exactTitle}".` 
    };
  }

  // Optimize: single cell update via values.update
  if (batchData.length === 1) {
    const single = batchData[0];
    const singleRes = await callWithRetry(() =>
      sheets.spreadsheets.values.update({
        spreadsheetId,
        range: single.range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: single.values,
        },
      })
    );

    invalidateSheetCache(sheetName);

    return {
      success: true,
      updatedRows: 1,
      totalUpdatedCells: singleRes.data.updatedCells || 1,
      range: single.range,
      rowIndices: targetRowIndices,
    };
  }

  // Multiple cells update via batchUpdate
  const batchRes = await callWithRetry(() =>
    sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: batchData,
      },
    })
  );

  invalidateSheetCache(sheetName);

  return {
    success: true,
    updatedRows: targetRowIndices.length,
    totalUpdatedCells: batchRes.data.totalUpdatedCells,
    rowIndices: targetRowIndices,
  };
}

/**
 * DELETE row(s) from spreadsheet
 */
export async function deleteSheetRow(
  sheetName: string,
  options: {
    rowIndex?: number;
    rowIndices?: number[];
    match?: Record<string, any>;
    deleteAllMatches?: boolean;
  }
) {
  if (!isSheetsConfigured()) {
    return {
      success: true,
      configured: false,
      message: 'Google Sheets Service Account belum dikonfigurasi. Data tersimpan secara lokal.',
    };
  }

  const cleanName = sheetName.trim().toLowerCase();

  // 1. Resolve numericSheetId without triggering extra read requests
  let numericSheetId: number | undefined = KNOWN_SHEET_IDS[cleanName];

  if (numericSheetId === undefined) {
    try {
      const meta = await getOrFetchMetadata(false);
      const sheetObj = meta.sheets.find((s) => s.title.trim().toLowerCase() === cleanName);
      numericSheetId = sheetObj?.sheetId;
    } catch (e) {
      console.warn('[deleteSheetRow] Error resolving sheetId from metadata:', e);
    }
  }

  if (numericSheetId === undefined) {
    throw new Error(`Sheet "${sheetName}" tidak ditemukan atau sheetId tidak valid.`);
  }

  let targetRowIndices: number[] = [];

  // A. Fast-path: rowIndices provided directly -> ZERO READ REQUESTS!
  if (Array.isArray(options.rowIndices) && options.rowIndices.length > 0) {
    targetRowIndices = options.rowIndices
      .map(Number)
      .filter((idx) => !isNaN(idx) && idx >= 2);
  }
  // B. Fast-path: single rowIndex provided directly -> ZERO READ REQUESTS!
  else if (options.rowIndex !== undefined && Number(options.rowIndex) >= 2) {
    targetRowIndices.push(Number(options.rowIndex));
  }
  // C. Fallback: match criteria provided -> search in cached rows first
  else if (options.match && Object.keys(options.match).length > 0) {
    const allRows = await getSheetRows(cleanName);
    for (const r of allRows) {
      let matches = true;
      for (const [mKey, mVal] of Object.entries(options.match)) {
        if (mVal === undefined || mVal === null || mVal === '') continue;
        const cleanKey = cleanHeaderKey(mKey);
        let cellVal = r[mKey] ?? r[cleanKey];

        if (cellVal === undefined) {
          const foundKey = Object.keys(r).find((k) => cleanHeaderKey(k) === cleanKey);
          cellVal = foundKey ? r[foundKey] : '';
        }

        const strCell = String(cellVal || '').trim();
        const strExpected = String(mVal || '').trim();

        if (cleanKey === 'DATE' || cleanKey === 'TANGGAL' || cleanKey === 'TGL') {
          if (normalizeDateStr(strCell) !== normalizeDateStr(strExpected)) {
            matches = false;
            break;
          }
        } else if (cleanKey === 'BARANG' || cleanKey === 'ITEM' || cleanKey === 'NAMABARANG') {
          const cLower = strCell.toLowerCase();
          const eLower = strExpected.toLowerCase();
          if (cLower !== eLower && !cLower.includes(eLower) && !eLower.includes(cLower)) {
            matches = false;
            break;
          }
        } else {
          if (strCell.toLowerCase() !== strExpected.toLowerCase()) {
            matches = false;
            break;
          }
        }
      }

      if (matches && r.rowIndex && r.rowIndex >= 2) {
        targetRowIndices.push(r.rowIndex);
        if (!options.deleteAllMatches) {
          break;
        }
      }
    }
  }

  if (targetRowIndices.length === 0) {
    return { success: false, error: 'Baris tidak ditemukan di Google Sheets untuk dihapus.' };
  }

  // Sort descending so deletion doesn't shift earlier indices!
  targetRowIndices = Array.from(new Set(targetRowIndices)).sort((a, b) => b - a);

  const { sheets, spreadsheetId } = getSheetsClient();

  const requests = targetRowIndices.map((rIdx) => ({
    deleteDimension: {
      range: {
        sheetId: numericSheetId,
        dimension: 'ROWS',
        startIndex: rIdx - 1, // 0-indexed
        endIndex: rIdx,
      },
    },
  }));

  await callWithRetry(() =>
    sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    })
  );

  invalidateSheetCache(cleanName);

  return {
    success: true,
    deletedRowIndices: targetRowIndices,
    deletedCount: targetRowIndices.length,
    message: `Berhasil menghapus ${targetRowIndices.length} baris secara permanen dari sheet "${sheetName}".`,
  };
}
