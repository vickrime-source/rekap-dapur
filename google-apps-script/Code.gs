/**
 * ============================================================================
 * GOOGLE APPS SCRIPT: REKAP DAPUR PRO - 2-WAY REALTIME SYNC (PESANAN, NOTES & TRANSAKSI)
 * ============================================================================
 * Fitur:
 * 1. Sheet "pesanan": NO, DATE, DAPUR, ITEM, QTY, H. JUAL, H. BELI, TOKO, PEMASOK, PAYMENT, DILEVERY, STATUS
 * 2. Sheet "notes": ID, DAPUR, ITEM, CATATAN, STATUS, CREATED_AT (Status: FOLLOW UP / DONE)
 * 3. Sheet "transaksi": NO, TANGGAL, PEMASOK, BARANG, TOKO, QTY, H. BELI, TOTAL, STATUS
 * 4. Sinkronisasi Realtime Status PAID / UNPAID & DONE / PENDING
 * 5. Update Group Status (1-Click Toggle per Grup Tanggal + Dapur + Toko)
 * ============================================================================
 */

const TOKEN = "Gakusah";

// Header default untuk setiap sheet
const SCHEMA = {
  pesanan: [
    "NO",
    "DATE",
    "DAPUR",
    "ITEM",
    "QTY",
    "H. JUAL",
    "H. BELI",
    "TOKO",
    "PEMASOK",
    "PAYMENT",
    "DILEVERY",
    "STATUS"
  ],
  notes: [
    "ID",
    "DAPUR",
    "ITEM",
    "CATATAN",
    "STATUS",
    "CREATED_AT"
  ],
  transaksi: [
    "NO",
    "TANGGAL",
    "PEMASOK",
    "BARANG",
    "TOKO",
    "QTY",
    "H. BELI",
    "TOTAL",
    "STATUS"
  ]
};

/**
 * Normalisasi nama kolom untuk pencocokan fleksibel (case-insensitive & abaikan spasi/simbol)
 */
function cleanKey(k) {
  if (!k) return "";
  return String(k).toUpperCase().replace(/[\s\.\_\-\:\/\\]/g, "");
}

/**
 * Cari index kolom dari daftar headers
 */
function findColIndex(headers, colName) {
  const target = cleanKey(colName);
  return headers.findIndex(h => cleanKey(h) === target);
}

/**
 * Inisialisasi sheet dan header jika belum ada
 */
function getOrCreateSheet(ss, sheetName) {
  const name = sheetName || "pesanan";
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const defaultHeaders = SCHEMA[name] || SCHEMA.pesanan;
    sheet.appendRow(defaultHeaders);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * GET Endpoint: Membaca data dari spreadsheet
 * Parameter: ?sheet=pesanan | notes | transaksi & token=Gakusah
 */
function doGet(e) {
  try {
    const sheetName = (e && e.parameter && e.parameter.sheet) || "pesanan";
    const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.getActive();
    
    // Auto setup sheet jika belum ada
    const sheet = getOrCreateSheet(ss, sheetName);
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const headers = data[0].map(h => String(h).trim());
    const tz = ss.getSpreadsheetTimeZone() || "Asia/Jakarta";

    const rows = data.slice(1).map((row, i) => {
      let obj = { rowIndex: i + 2 };
      headers.forEach((h, idx) => {
        let val = row[idx];
        if (val instanceof Date) {
          val = Utilities.formatDate(val, tz, "yyyy-MM-dd");
        }
        if (h) {
          obj[h] = val;
        }
      });
      return obj;
    }).filter(r => {
      // Filter out baris kosong
      return (
        r.ITEM || 
        r.BARANG || 
        r.CATATAN || 
        r.DAPUR || 
        r.TOKO || 
        r.ID || 
        r.NO || 
        r.DATE || 
        r.TANGGAL
      );
    });

    return ContentService.createTextOutput(JSON.stringify(rows))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST Endpoint: Menulis, mengubah, dan menghapus data secara 2-Way Realtime
 */
function doPost(e) {
  // Mencegah error jika ditekan Run di editor Apps Script secara manual
  if (!e || !e.postData || !e.postData.contents) {
    return ContentService.createTextOutput(JSON.stringify({ 
      error: "Endpoint ini menerima request POST dari Web/HP. Jangan klik Run di editor Apps Script!" 
    })).setMimeType(ContentService.MimeType.JSON);
  }

  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Invalid JSON format" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Validasi Token jika dikirim
  if (body.token && body.token !== TOKEN && body.token !== "GANTI_TOKEN_RAHASIA_INI") {
    return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized token" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const sheetName = body.sheet || "pesanan";
    const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.getActive();
    const sheet = getOrCreateSheet(ss, sheetName);

    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    let headers = values.length > 0 ? values[0].map(h => String(h).trim()) : [];

    if (headers.length === 0) {
      headers = SCHEMA[sheetName] || Object.keys(body.data || {});
      sheet.appendRow(headers);
    }

    const action = body.action || "add";

    // ------------------------------------------------------------------------
    // 1. ACTION: ADD (Tambah data baru ke pesanan / notes / transaksi)
    // ------------------------------------------------------------------------
    if (action === "add") {
      const dataObj = body.data || {};
      const lastRow = sheet.getLastRow() + 1;

      const newRow = headers.map(h => {
        const hClean = cleanKey(h);
        
        // Cek direct key
        if (dataObj[h] !== undefined && dataObj[h] !== null) {
          return dataObj[h];
        }

        // Cek fuzzy key
        for (const k in dataObj) {
          if (cleanKey(k) === hClean) {
            return dataObj[k];
          }
        }

        // Default helpers
        if (hClean === "NO" && sheetName === "pesanan") {
          return dataObj.id || dataObj.NO || (lastRow - 1);
        }
        if (hClean === "ID" && sheetName === "notes") {
          return dataObj.id || dataObj.ID || `note-${Date.now()}`;
        }
        if (hClean === "STATUS" && sheetName === "notes") {
          return dataObj.isDone ? "DONE" : "FOLLOW UP";
        }
        if (hClean === "TOTAL" && sheetName === "transaksi") {
          const qty = Number(dataObj.QTY || dataObj.qty) || 0;
          const hbeli = Number(dataObj["H. BELI"] || dataObj.hargaBeli) || 0;
          return dataObj.TOTAL !== undefined ? dataObj.TOTAL : (qty * hbeli);
        }

        return "";
      });

      sheet.appendRow(newRow);
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        status: "success", 
        action: "add", 
        rowIndex: sheet.getLastRow() 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ------------------------------------------------------------------------
    // 2. ACTION: UPDATE (Update kolom spesifik atau match criteria - STATUS/PAID)
    // ------------------------------------------------------------------------
    if (action === "update" || action === "updateStatus" || action === "updateRow") {
      const updateData = body.data || {};
      // Mendukung legacy format { column, value }
      if (body.column && body.value !== undefined) {
        updateData[body.column] = body.value;
      }

      const matchCriteria = body.match || body.criteria || {};
      const targetRowIndex = Number(body.rowIndex);
      let rowsUpdated = 0;

      // Update langsung berdasarkan rowIndex
      if (targetRowIndex && targetRowIndex >= 2 && targetRowIndex <= values.length) {
        for (const [key, val] of Object.entries(updateData)) {
          const colIdx = findColIndex(headers, key);
          if (colIdx !== -1) {
            sheet.getRange(targetRowIndex, colIdx + 1).setValue(val);
          }
        }
        rowsUpdated++;
      } else {
        // Update berdasarkan matching field (misal: ID untuk notes, atau ITEM + DATE + DAPUR + TOKO untuk pesanan)
        for (let i = 1; i < values.length; i++) {
          const row = values[i];
          let isMatch = true;

          for (const [critKey, critVal] of Object.entries(matchCriteria)) {
            const colIdx = findColIndex(headers, critKey);
            if (colIdx !== -1) {
              const cellVal = String(row[colIdx] || "").trim().toLowerCase();
              const expectedVal = String(critVal || "").trim().toLowerCase();
              if (cellVal !== expectedVal) {
                isMatch = false;
                break;
              }
            }
          }

          if (isMatch && Object.keys(matchCriteria).length > 0) {
            for (const [key, val] of Object.entries(updateData)) {
              const colIdx = findColIndex(headers, key);
              if (colIdx !== -1) {
                sheet.getRange(i + 1, colIdx + 1).setValue(val);
              }
            }
            rowsUpdated++;
            // Jika match menggunakan ID spesifik, selesai setelah 1 baris
            if (matchCriteria.ID || matchCriteria.id || matchCriteria.NO || matchCriteria.no) {
              break;
            }
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        status: "success", 
        action: "update", 
        rowsUpdated 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ------------------------------------------------------------------------
    // 3. ACTION: UPDATE GROUP (Update status PAID / DONE seluruh grup pesanan)
    // ------------------------------------------------------------------------
    if (action === "updateGroup") {
      const matchCriteria = body.match || {};
      const updateData = body.data || {};
      let rowsUpdated = 0;

      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        let isMatch = true;

        for (const [critKey, critVal] of Object.entries(matchCriteria)) {
          const colIdx = findColIndex(headers, critKey);
          if (colIdx !== -1) {
            const cellVal = String(row[colIdx] || "").trim().toLowerCase();
            const expectedVal = String(critVal || "").trim().toLowerCase();
            if (cellVal !== expectedVal) {
              isMatch = false;
              break;
            }
          }
        }

        if (isMatch && Object.keys(matchCriteria).length > 0) {
          for (const [key, val] of Object.entries(updateData)) {
            const colIdx = findColIndex(headers, key);
            if (colIdx !== -1) {
              sheet.getRange(i + 1, colIdx + 1).setValue(val);
            }
          }
          rowsUpdated++;
        }
      }

      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        status: "success", 
        action: "updateGroup", 
        rowsUpdated 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ------------------------------------------------------------------------
    // 4. ACTION: DELETE (Hapus baris pesanan atau catatan)
    // ------------------------------------------------------------------------
    if (action === "delete") {
      const matchCriteria = body.match || body.criteria || {};
      const targetRowIndex = Number(body.rowIndex);
      let deleted = false;

      if (targetRowIndex && targetRowIndex >= 2 && targetRowIndex <= values.length) {
        sheet.deleteRow(targetRowIndex);
        deleted = true;
      } else {
        // Loop dari bawah ke atas agar index baris tidak bergeser saat delete
        for (let i = values.length - 1; i >= 1; i--) {
          const row = values[i];
          let isMatch = true;

          for (const [critKey, critVal] of Object.entries(matchCriteria)) {
            const colIdx = findColIndex(headers, critKey);
            if (colIdx !== -1) {
              const cellVal = String(row[colIdx] || "").trim().toLowerCase();
              const expectedVal = String(critVal || "").trim().toLowerCase();
              if (cellVal !== expectedVal) {
                isMatch = false;
                break;
              }
            }
          }

          if (isMatch && Object.keys(matchCriteria).length > 0) {
            sheet.deleteRow(i + 1);
            deleted = true;
            break;
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        status: "success", 
        action: "delete", 
        deleted 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ------------------------------------------------------------------------
    // 5. ACTION: SYNC ALL (Sinkronisasi massal seluruh baris)
    // ------------------------------------------------------------------------
    if (action === "syncAll" && Array.isArray(body.rows)) {
      sheet.clearContents();
      const defaultHeaders = SCHEMA[sheetName] || headers;
      sheet.appendRow(defaultHeaders);
      sheet.setFrozenRows(1);

      body.rows.forEach(r => {
        const rowData = defaultHeaders.map(h => {
          if (r[h] !== undefined) return r[h];
          for (const k in r) {
            if (cleanKey(k) === cleanKey(h)) return r[k];
          }
          return "";
        });
        sheet.appendRow(rowData);
      });

      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        status: "success", 
        action: "syncAll", 
        count: body.rows.length 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ------------------------------------------------------------------------
    // 6. ACTION: SETUP DATABASE (Bersihkan sheet lama dan inisialisasi sheet baru)
    // ------------------------------------------------------------------------
    if (action === "setupDatabase") {
      Object.keys(SCHEMA).forEach(sName => {
        getOrCreateSheet(ss, sName);
      });
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        status: "success", 
        message: "Database sheets (pesanan, notes, transaksi) siap digunakan!" 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ error: "Unknown action: " + action }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
