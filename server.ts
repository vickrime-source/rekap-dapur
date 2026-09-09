import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { 
  getSheetRows, 
  addSheetRow, 
  updateSheetRows, 
  deleteSheetRow, 
  getSheetsStatus,
  isSheetsConfigured
} from './server/sheetsService';
import { parseVoiceOrderWithGemini } from './server/geminiService';

const TEMPLATE_URLS: Record<string, string> = {
  "LUWENG BOGA": "https://docs.google.com/document/d/1vCwDWoGEQhmyujqTF0l0VVJU3cH8nyxn/export?format=docx",
  "HTG": "https://docs.google.com/document/d/1km9cBqcqqfWoHdI8tg7ATjw2ZSAsL4gZ/export?format=docx",
  "LUMBUNG ADIFRUTA": "https://docs.google.com/document/d/1AvbWhAIgCgyHBqeaZ-qpw3MSrKazoXoh/export?format=docx",
  "PROHE": "https://docs.google.com/document/d/1uzoTVnveItdYGgHoZcFedec1KMf-D0LX/export?format=docx"
};

function getGoogleDocTemplateUrl(storeName: string): string {
  const norm = (storeName || '').trim().toUpperCase();
  if (norm.includes('LUWENG') || norm.includes('LEMBUNG') || norm.includes('BOGA') || norm.includes('LB')) {
    return TEMPLATE_URLS["LUWENG BOGA"];
  }
  if (norm.includes('PROHE') || norm.includes('PW')) {
    return TEMPLATE_URLS["PROHE"];
  }
  if (norm.includes('LUMBUNG') || norm.includes('ADIFRUTA') || norm.includes('FRUITA') || norm.includes('LA')) {
    return TEMPLATE_URLS["LUMBUNG ADIFRUTA"];
  }
  return TEMPLATE_URLS["HTG"];
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Proxy endpoint to fetch Google Docs template as binary docx
  app.get('/api/fetch-template', async (req, res) => {
    try {
      const tokoQuery = (req.query.toko as string) || 'HTG';
      const targetUrl = getGoogleDocTemplateUrl(tokoQuery);

      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({
          error: `Gagal mengambil template dari Google Docs (${response.statusText})`,
        });
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="template_${tokoQuery.replace(/\s+/g, '_')}.docx"`);
      res.send(buffer);
    } catch (err: any) {
      console.error('[Proxy Server Error]:', err);
      res.status(500).json({ error: err?.message || 'Server error proxying Google Docs template' });
    }
  });

  // Convert DOCX to PDF endpoint via CloudConvert with image compression
  app.post('/api/convert-to-pdf', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
    try {
      let downloadName = 'Invoice.pdf';
      let customApiKey = '';
      if (req.query?.fileName) downloadName = decodeURIComponent(req.query.fileName as string);
      if (req.query?.apiKey) customApiKey = decodeURIComponent(req.query.apiKey as string);

      let docxBuffer = req.body;
      if (typeof req.body === 'string' || (Buffer.isBuffer(req.body) && req.headers['content-type']?.includes('application/json'))) {
        try {
          const parsed = JSON.parse(req.body.toString());
          if (parsed.docxBase64) docxBuffer = Buffer.from(parsed.docxBase64, 'base64');
          if (parsed.fileName) downloadName = parsed.fileName;
          if (parsed.apiKey) customApiKey = parsed.apiKey;
        } catch (_) {}
      }

      if (!docxBuffer || docxBuffer.length === 0) {
        return res.status(400).json({ error: 'Data DOCX tidak ditemukan dalam request.' });
      }

      // Safely compress images using sharp with Promise.all to avoid race conditions
      try {
        const { compressDocxImages } = await import('./api/lib/compressDocxImages.js');
        docxBuffer = await compressDocxImages(docxBuffer);
      } catch (cErr) {
        console.warn('[Server convert-to-pdf] Compression warning:', cErr);
      }

      const apiKey = (process.env.CLOUDCONVERT_API_KEY || customApiKey || '').trim();
      if (!apiKey) {
        return res.status(400).json({ error: 'CLOUDCONVERT_API_KEY tidak dikonfigurasi di environment variable server.' });
      }

      const { convertDocxToPdfWithCloudConvert } = await import('./api/lib/cloudConvert.js');
      const pdfBuffer = await convertDocxToPdfWithCloudConvert(docxBuffer, apiKey);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error('[Server convert-to-pdf error]:', err);
      res.status(500).json({ error: err?.message || 'Gagal konversi PDF' });
    }
  });

  // =========================================================================
  // OFFICIAL GOOGLE SHEETS API ENDPOINTS (Service Account JWT Authentication)
  // =========================================================================

  // 1. Connection and Status Check
  app.get('/api/sheets-status', async (req, res) => {
    try {
      const status = await getSheetsStatus();
      res.json(status);
    } catch (err: any) {
      console.warn('[Sheets Status Warning]:', err?.message || err);
      res.json({
        success: false,
        configured: false,
        error: err?.message || 'Gagal memeriksa status koneksi Google Sheets API',
      });
    }
  });

  // 2. GET: Read Sheet Rows (Method: sheets.spreadsheets.values.get)
  app.get('/api/sheets-get', async (req, res) => {
    try {
      const sheet = (req.query.sheet as string) || 'pesanan';
      const range = req.query.range as string | undefined;

      if (!isSheetsConfigured()) {
        return res.json({
          success: true,
          configured: false,
          sheet,
          data: [],
          count: 0,
          message: 'Google Sheets Service Account belum dikonfigurasi di environment variables. Aplikasi berjalan dalam mode data lokal.',
        });
      }

      const rows = await getSheetRows(sheet, range);
      res.json({
        success: true,
        configured: true,
        sheet,
        data: rows,
        count: rows.length,
      });
    } catch (err: any) {
      console.warn('[Sheets GET Warning]:', err?.message || err);
      res.json({
        success: false,
        configured: false,
        error: err?.message || 'Gagal membaca data dari Google Sheets API',
        data: [],
      });
    }
  });

  // 3. ADD: Append New Row (Method: sheets.spreadsheets.values.append)
  app.post('/api/sheets-add', async (req, res) => {
    try {
      const sheet = (req.body.sheet || req.query.sheet || 'pesanan') as string;
      const data = req.body.data || req.body;

      if (!data || typeof data !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Data baris baru harus berupa objek valid.',
        });
      }

      if (!isSheetsConfigured()) {
        return res.json({
          success: true,
          configured: false,
          message: 'Google Sheets Service Account belum dikonfigurasi. Data tersimpan di browser lokal.',
        });
      }

      const result = await addSheetRow(sheet, data);
      res.json({
        success: true,
        configured: true,
        message: `Data berhasil ditambahkan ke sheet "${sheet}" via Google Sheets API`,
        ...result,
      });
    } catch (err: any) {
      console.warn('[Sheets ADD Warning]:', err?.message || err);
      res.json({
        success: false,
        error: err?.message || 'Gagal menambahkan baris ke Google Sheets API',
      });
    }
  });

  // 4. UPDATE: Update Specific Cell or Row (Method: sheets.spreadsheets.values.update)
  app.post('/api/sheets-update', async (req, res) => {
    try {
      const sheet = (req.body.sheet || req.query.sheet || 'pesanan') as string;
      const { range, rowIndex, rowIndices, column, value, data, match, action } = req.body;

      if (!isSheetsConfigured()) {
        return res.json({
          success: true,
          configured: false,
          message: 'Google Sheets Service Account belum dikonfigurasi. Data tersimpan di browser lokal.',
        });
      }

      const result = await updateSheetRows(sheet, {
        range,
        rowIndex: rowIndex ? Number(rowIndex) : undefined,
        rowIndices: Array.isArray(rowIndices) ? rowIndices.map(Number) : undefined,
        column,
        value,
        data,
        match,
        action,
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error || `Gagal update baris di sheet "${sheet}"`,
          ...result,
        });
      }

      res.json({
        success: true,
        configured: true,
        message: `Berhasil update data di sheet "${sheet}"`,
        ...result,
      });
    } catch (err: any) {
      console.warn('[Sheets UPDATE Warning]:', err?.message || err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Gagal mengupdate baris di Google Sheets API',
      });
    }
  });

  // 5. DELETE: Delete Row Permanently (Method: sheets.spreadsheets.batchUpdate deleteDimension)
  app.post('/api/sheets-delete', async (req, res) => {
    try {
      const sheet = (req.body.sheet || req.query.sheet || 'pesanan') as string;
      const { rowIndex, rowIndices, match, deleteAllMatches } = req.body;

      if (!sheet) {
        return res.status(400).json({
          success: false,
          error: 'Nama sheet ("pesanan" atau "transaksi") wajib disertakan.',
        });
      }

      if (!isSheetsConfigured()) {
        return res.json({
          success: true,
          configured: false,
          message: 'Google Sheets Service Account belum dikonfigurasi. Data tersimpan di browser lokal.',
        });
      }

      const result = await deleteSheetRow(sheet, {
        rowIndex: rowIndex !== undefined && rowIndex !== null && rowIndex !== '' ? Number(rowIndex) : undefined,
        rowIndices: Array.isArray(rowIndices) ? rowIndices.map(Number) : undefined,
        match,
        deleteAllMatches: !!deleteAllMatches,
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error || `Gagal menghapus baris dari sheet "${sheet}"`,
          ...result,
        });
      }

      res.json({
        success: true,
        configured: true,
        message: result.message || `Baris berhasil dihapus permanen dari sheet "${sheet}"`,
        ...result,
      });
    } catch (err: any) {
      console.error('[Sheets DELETE Error]:', err?.message || err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Gagal menghapus baris dari Google Sheets API',
      });
    }
  });

  // 6. AI GEMINI VOICE ORDER PARSER
  app.post('/api/parse-voice-order', async (req, res) => {
    try {
      const { text, kitchens, stores, pemasokList } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Parameter "text" teks suara diperlukan.',
        });
      }

      const parsed = await parseVoiceOrderWithGemini(
        text,
        Array.isArray(kitchens) ? kitchens : [],
        Array.isArray(stores) ? stores : [],
        Array.isArray(pemasokList) ? pemasokList : []
      );

      if (parsed) {
        return res.json({
          success: true,
          source: 'gemini',
          data: parsed,
        });
      }

      // If Gemini is not configured or failed, client falls back to local Indonesian parser
      return res.json({
        success: false,
        source: 'none',
        message: 'Gemini AI tidak tersedia, gunakan parser lokal.',
      });
    } catch (err: any) {
      console.warn('[Server voice parse error]:', err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Gagal memproses suara dengan Gemini',
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
