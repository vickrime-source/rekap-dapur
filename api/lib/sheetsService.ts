import { google } from 'googleapis';

export const SHEET_SCHEMAS: Record<string, string[]> = {
  pesanan: ['NO', 'DATE', 'DAPUR', 'ITEM', 'QTY', 'H. JUAL', 'H. BELI', 'TOKO', 'PEMASOK', 'PAYMENT', 'DILEVERY', 'STATUS'],
  transaksi: ['NO', 'TANGGAL', 'PEMASOK', 'BARANG', 'TOKO', 'QTY', 'H. BELI', 'TOTAL', 'STATUS'],
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
 * Checks connection and returns metadata about the connected spreadsheet
 */
export async function getSheetsStatus() {
  try {
    const { sheets, spreadsheetId, clientEmail } = getSheetsClient();
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetTitles = (res.data.sheets || []).map((s) => s.properties?.title || '').filter(Boolean);

    return {
      success: true,
      configured: true,
      clientEmail,
      spreadsheetId,
      title: res.data.properties?.title || 'Spreadsheet Tanpa Judul',
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
  const { sheets, spreadsheetId } = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const cleanTarget = sheetName.trim().toLowerCase();
  const sheetObj = meta.data.sheets?.find(
    (s) => (s.properties?.title || '').trim().toLowerCase() === cleanTarget
  );

  if (!sheetObj) {
    // Add sheet tab with exact lowercase title
    await sheets.spreadsheets.batchUpdate({
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
    });

    // Append default headers
    const defaultHeaders = SHEET_SCHEMAS[cleanTarget] || SHEET_SCHEMAS.pesanan;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${cleanTarget}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [defaultHeaders],
      },
    });

    return cleanTarget;
  }

  return sheetObj.properties?.title || cleanTarget;
}

/**
 * GET Sheet data converted to array of objects with rowIndex
 */
export async function getSheetRows(sheetName: string, customRange?: string) {
  if (!isSheetsConfigured()) {
    return [];
  }
  const { sheets, spreadsheetId } = getSheetsClient();
  const exactTitle = await ensureSheet(sheetName);

  // Default range covering all columns
  const range = customRange || `'${exactTitle}'!A:Z`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const rawValues = response.data.values || [];
  if (rawValues.length <= 1) {
    return [];
  }

  const headers = rawValues[0].map((h) => String(h || '').trim());

  const rows = rawValues.slice(1).map((row, idx) => {
    const rowIndex = idx + 2; // Row 1 is header, so row index in Sheets is idx + 2
    const obj: Record<string, any> = { rowIndex };

    headers.forEach((header, colIdx) => {
      if (header) {
        obj[header] = row[colIdx] !== undefined ? row[colIdx] : '';
      }
    });

    return obj;
  });

  return rows.filter((r) => {
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
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${exactTitle}'!1:1`,
  });

  let headers = (headerRes.data.values?.[0] || []).map((h) => String(h || '').trim());

  if (headers.length === 0) {
    headers = SHEET_SCHEMAS[sheetName.toLowerCase()] || Object.keys(rowData);
    // Write headers
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${exactTitle}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [headers],
      },
    });
  }

  // Map data to ordered row values using findColIdx
  const rowValues = new Array(headers.length).fill('');
  for (const [key, val] of Object.entries(rowData)) {
    if (val !== undefined && val !== null) {
      const idx = findColIdx(key, headers);
      if (idx !== -1) {
        rowValues[idx] = val;
      }
    }
  }

  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${exactTitle}'!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [rowValues],
    },
  });

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
    const updateRes = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: targetRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[options.value]],
      },
    });
    return { success: true, updatedCells: updateRes.data.updatedCells, range: targetRange };
  }

  // Get sheet headers & all current values for matching
  const allRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${exactTitle}'!A:Z`,
  });
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
    const singleRes = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: single.range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: single.values,
      },
    });

    return {
      success: true,
      updatedRows: 1,
      totalUpdatedCells: singleRes.data.updatedCells || 1,
      range: single.range,
      rowIndices: targetRowIndices,
    };
  }

  // Multiple cells update via batchUpdate
  const batchRes = await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: batchData,
    },
  });

  return {
    success: true,
    updatedRows: targetRowIndices.length,
    totalUpdatedCells: batchRes.data.totalUpdatedCells,
    rowIndices: targetRowIndices,
  };
}

/**
 * DELETE row from spreadsheet
 */
export async function deleteSheetRow(
  sheetName: string,
  options: {
    rowIndex?: number;
    match?: Record<string, any>;
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
  await ensureSheet(sheetName);

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetObj = meta.data.sheets?.find(
    (s) => (s.properties?.title || '').toLowerCase() === sheetName.toLowerCase()
  );

  if (!sheetObj || sheetObj.properties?.sheetId === undefined) {
    throw new Error(`Sheet ${sheetName} tidak ditemukan.`);
  }
  const numericSheetId = sheetObj.properties.sheetId;

  let targetRowIndex = options.rowIndex;

  if (!targetRowIndex && options.match && Object.keys(options.match).length > 0) {
    const allRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A:Z`,
    });
    const allValues = allRes.data.values || [];
    if (allValues.length > 1) {
      const headers = allValues[0].map((h) => String(h || '').trim());
      const findColIdx = (colName: string): number => {
        const cleanTarget = cleanHeaderKey(colName);
        return headers.findIndex((h) => cleanHeaderKey(h) === cleanTarget);
      };

      for (let r = 1; r < allValues.length; r++) {
        const row = allValues[r];
        let matches = true;
        for (const [mKey, mVal] of Object.entries(options.match)) {
          const colIdx = findColIdx(mKey);
          if (colIdx !== -1) {
            const cellVal = String(row[colIdx] || '').trim().toLowerCase();
            const expectedVal = String(mVal || '').trim().toLowerCase();
            if (cellVal !== expectedVal) {
              matches = false;
              break;
            }
          }
        }
        if (matches) {
          targetRowIndex = r + 1; // 1-based index
          break;
        }
      }
    }
  }

  if (!targetRowIndex || targetRowIndex < 2) {
    return { success: false, error: 'Baris tidak ditemukan untuk dihapus.' };
  }

  // Delete row using deleteDimension
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: numericSheetId,
              dimension: 'ROWS',
              startIndex: targetRowIndex - 1, // 0-indexed
              endIndex: targetRowIndex,
            },
          },
        },
      ],
    },
  });

  return { success: true, deletedRowIndex: targetRowIndex };
}
