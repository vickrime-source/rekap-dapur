import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { 
  checkSupabaseStatus,
  isSupabaseConfigured,
  getOrdersFromDb,
  createOrdersInDb,
  updateOrderInDb,
  updateBatchOrdersInDb,
  deleteOrdersFromDb,
  getTransactionsFromDb,
  createTransactionInDb,
  deleteTransactionsFromDb,
  getNotesFromDb,
  createNoteInDb,
  updateNoteInDb,
  deleteNoteFromDb,
  getPeriodSummaryFromDb,
  getMasterTokoFromDb,
  createMasterTokoInDb,
  deleteMasterTokoInDb,
  getMasterPemasokFromDb,
  createMasterPemasokInDb,
  deleteMasterPemasokInDb,
  getMasterDapurFromDb,
  createMasterDapurInDb,
  deleteMasterDapurInDb,
  checkMasterUsageInDb,
} from './server/supabaseService.js';
import { parseVoiceOrderWithGemini } from './server/geminiService.js';

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
        const { compressDocxImages } = await import('./server/lib/compressDocxImages.js');
        docxBuffer = await compressDocxImages(docxBuffer);
      } catch (cErr) {
        console.warn('[Server convert-to-pdf] Compression warning:', cErr);
      }

      const apiKey = (process.env.CLOUDCONVERT_API_KEY || customApiKey || '').trim();
      if (!apiKey) {
        return res.status(400).json({ error: 'CLOUDCONVERT_API_KEY tidak dikonfigurasi di environment variable server.' });
      }

      const { convertDocxToPdfWithCloudConvert } = await import('./server/lib/cloudConvert.js');
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
  // SUPABASE POSTGRESQL DATABASE REST ENDPOINTS
  // =========================================================================

  // 1. Connection and Status Check
  const handleStatusOrConfig = async (req: express.Request, res: express.Response) => {
    const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (req.query.type === 'config') {
      return res.json({
        url,
        anonKey,
        configured: Boolean(url && (anonKey || serviceRoleKey)),
      });
    }

    try {
      const status = await checkSupabaseStatus();
      res.json({
        status: 'ok',
        time: new Date().toISOString(),
        url,
        anonKey,
        ...status,
      });
    } catch (err: any) {
      res.json({
        status: 'error',
        success: false,
        configured: Boolean(url && (anonKey || serviceRoleKey)),
        error: err?.message || 'Gagal memeriksa status koneksi Supabase',
      });
    }
  };

  app.get('/api/status', handleStatusOrConfig);
  app.get('/api/supabase-status', handleStatusOrConfig);
  app.get('/api/db-status', handleStatusOrConfig);
  app.get('/api/sheets-status', handleStatusOrConfig); // Compatibility alias

  // Client Supabase Config (Anon Key & URL untuk Supabase Realtime Subscription)
  app.get('/api/supabase/config', (req, res) => {
    const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    res.json({
      url,
      anonKey,
      configured: Boolean(url && (anonKey || serviceRoleKey)),
    });
  });

  // 2. Orders (pesanan) Endpoints
  // GET: filter period / date / toko / dapur directly in database with pagination!
  const handleGetOrders = async (req: express.Request, res: express.Response) => {
    try {
      const action = req.query.action;
      if (action === 'period_summary' || action === 'summary') {
        const period = (req.query.period as string) || 'mingguan';
        const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
        const startDate = req.query.startDate as string | undefined;
        const endDate = req.query.endDate as string | undefined;
        const summary = await getPeriodSummaryFromDb(period, date, startDate, endDate);
        return res.json({ success: true, data: summary });
      }

      const { period, date, startDate, endDate, toko, dapur, pemasok, status, limit, page, offset } = req.query;
      const orders = await getOrdersFromDb({
        period: period as any,
        date: date as string,
        startDate: startDate as string,
        endDate: endDate as string,
        toko: toko as string,
        dapur: dapur as string,
        pemasok: pemasok as string,
        status: status as string,
        limit: limit ? Number(limit) : 100,
        page: page ? Number(page) : undefined,
        offset: offset ? Number(offset) : undefined,
      });

      res.json({
        success: true,
        data: orders,
        count: orders.length,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  };

  app.get('/api/pesanan', handleGetOrders);
  app.get('/api/supabase/pesanan', handleGetOrders);

  // POST: Add new order(s) OR batch update status
  const handlePostOrders = async (req: express.Request, res: express.Response) => {
    try {
      const action = req.query.action || req.body.action;
      if (action === 'batch_status' || Array.isArray(req.body.ids)) {
        const { ids, paymentStatus, deliveryStatus, status_pembayaran, status_pengiriman, status } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ success: false, error: 'Daftar ID pesanan wajib disertakan.' });
        }

        const updated = await updateBatchOrdersInDb(ids, {
          paymentStatus: paymentStatus || status_pembayaran,
          deliveryStatus: deliveryStatus || status_pengiriman,
          status,
        });

        return res.json({
          success: true,
          data: updated,
          count: updated.length,
          message: `${updated.length} pesanan berhasil diperbarui statusnya`,
        });
      }

      const items = req.body.items || req.body.data || req.body;
      const created = await createOrdersInDb(items);
      res.json({
        success: true,
        data: created,
        count: created.length,
        message: 'Pesanan berhasil disimpan ke database Supabase',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  };

  app.post('/api/pesanan', handlePostOrders);
  app.post('/api/supabase/pesanan', handlePostOrders);

  // PUT/PATCH: Update order by ID
  const handleUpdateOrder = async (req: express.Request, res: express.Response) => {
    try {
      const action = req.query.action || req.body.action;
      if (action === 'batch_status' || (Array.isArray(req.body.ids) && req.body.ids.length > 0)) {
        const { ids, paymentStatus, deliveryStatus, status_pembayaran, status_pengiriman, status } = req.body;
        const updated = await updateBatchOrdersInDb(ids, {
          paymentStatus: paymentStatus || status_pembayaran,
          deliveryStatus: deliveryStatus || status_pengiriman,
          status,
        });
        return res.json({
          success: true,
          data: updated,
          count: updated.length,
          message: `${updated.length} pesanan berhasil diperbarui statusnya`,
        });
      }

      const id = (req.query.id || req.body.id) as string;
      if (!id) {
        return res.status(400).json({ success: false, error: 'Parameter "id" pesanan wajib disertakan.' });
      }

      const updated = await updateOrderInDb(id, req.body);
      res.json({
        success: true,
        data: updated,
        message: 'Pesanan berhasil diperbarui di Supabase',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  };

  app.put('/api/pesanan', handleUpdateOrder);
  app.patch('/api/pesanan', handleUpdateOrder);
  app.put('/api/supabase/pesanan', handleUpdateOrder);
  app.patch('/api/supabase/pesanan', handleUpdateOrder);

  // POST: Batch update status (paymentStatus / deliveryStatus)
  app.post('/api/supabase/batch-status', async (req, res) => {
    try {
      const { ids, paymentStatus, deliveryStatus, status_pembayaran, status_pengiriman, status } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'Daftar ID pesanan wajib disertakan.' });
      }

      const updated = await updateBatchOrdersInDb(ids, {
        paymentStatus: paymentStatus || status_pembayaran,
        deliveryStatus: deliveryStatus || status_pengiriman,
        status,
      });

      res.json({
        success: true,
        data: updated,
        count: updated.length,
        message: `${updated.length} pesanan berhasil diperbarui statusnya`,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  });

  // DELETE: Delete order(s) by ID or list of IDs
  const handleDeleteOrders = async (req: express.Request, res: express.Response) => {
    try {
      const id = (req.query.id || req.body.id) as string;
      const ids = (req.body.ids || (id ? [id] : [])) as string[];

      if (!ids || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'ID pesanan yang akan dihapus wajib disertakan.' });
      }

      const result = await deleteOrdersFromDb(ids);
      res.json({
        success: true,
        ...result,
        message: `${result.deletedCount} pesanan berhasil dihapus dari Supabase`,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  };

  app.delete('/api/pesanan', handleDeleteOrders);
  app.delete('/api/supabase/pesanan', handleDeleteOrders);

  // 3. Transactions (transaksi) Endpoints
  const handleGetTransactions = async (req: express.Request, res: express.Response) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const page = req.query.page ? Number(req.query.page) : 1;
      const txs = await getTransactionsFromDb(limit, page);
      res.json({
        success: true,
        data: txs,
        count: txs.length,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  };

  app.get('/api/transaksi', handleGetTransactions);
  app.get('/api/supabase/transaksi', handleGetTransactions);

  const handlePostTransaction = async (req: express.Request, res: express.Response) => {
    try {
      const tx = await createTransactionInDb(req.body.data || req.body);
      res.json({
        success: true,
        data: tx,
        message: 'Transaksi berhasil disimpan ke Supabase',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  };

  app.post('/api/transaksi', handlePostTransaction);
  app.post('/api/supabase/transaksi', handlePostTransaction);

  const handleDeleteTransactions = async (req: express.Request, res: express.Response) => {
    try {
      const id = (req.query.id || req.body.id) as string;
      const ids = (req.body.ids || (id ? [id] : [])) as string[];

      if (!ids || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'ID transaksi wajib disertakan.' });
      }

      const result = await deleteTransactionsFromDb(ids);
      res.json({
        success: true,
        ...result,
        message: 'Transaksi berhasil dihapus dari Supabase',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  };

  app.delete('/api/transaksi', handleDeleteTransactions);
  app.delete('/api/supabase/transaksi', handleDeleteTransactions);

  // 4. Notes (notes) Endpoints
  const handleGetNotes = async (req: express.Request, res: express.Response) => {
    try {
      const notes = await getNotesFromDb();
      res.json({
        success: true,
        data: notes,
        count: notes.length,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  };

  app.get('/api/notes', handleGetNotes);
  app.get('/api/supabase/notes', handleGetNotes);

  const handlePostNote = async (req: express.Request, res: express.Response) => {
    try {
      const note = await createNoteInDb(req.body.data || req.body);
      res.json({
        success: true,
        data: note,
        message: 'Catatan berhasil disimpan ke Supabase',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  };

  app.post('/api/notes', handlePostNote);
  app.post('/api/supabase/notes', handlePostNote);

  const handleUpdateNote = async (req: express.Request, res: express.Response) => {
    try {
      const id = (req.query.id || req.body.id) as string;
      if (!id) {
        return res.status(400).json({ success: false, error: 'ID catatan wajib disertakan.' });
      }
      const updated = await updateNoteInDb(id, req.body);
      res.json({
        success: true,
        data: updated,
        message: 'Catatan berhasil diperbarui di Supabase',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  };

  app.put('/api/notes', handleUpdateNote);
  app.patch('/api/notes', handleUpdateNote);
  app.put('/api/supabase/notes', handleUpdateNote);
  app.patch('/api/supabase/notes', handleUpdateNote);

  const handleDeleteNote = async (req: express.Request, res: express.Response) => {
    try {
      const id = (req.query.id || req.body.id) as string;
      if (!id) {
        return res.status(400).json({ success: false, error: 'ID catatan wajib disertakan.' });
      }
      const result = await deleteNoteFromDb(id);
      res.json({
        success: true,
        ...result,
        message: 'Catatan berhasil dihapus dari Supabase',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  };

  app.delete('/api/notes', handleDeleteNote);
  app.delete('/api/supabase/notes', handleDeleteNote);

  // ---------------------------------------------------------------------------
  // 5. MASTER DATA (toko, pemasok, dapur) Endpoints
  // ---------------------------------------------------------------------------

  // Unified master endpoint /api/master (by ?type=toko|pemasok|dapur or ?action=check_usage)
  app.get('/api/master', async (req, res) => {
    try {
      const type = ((req.query.type || '') as string).toLowerCase();
      const action = ((req.query.action || '') as string).toLowerCase();

      if (action === 'check_usage' || action === 'check-usage' || type === 'check_usage') {
        const targetType = (req.query.targetType || req.query.type || 'toko') as 'toko' | 'pemasok' | 'dapur';
        const id = (req.query.id as string) || '';
        const name = (req.query.name as string) || '';
        const result = await checkMasterUsageInDb(targetType, id, name);
        return res.json({ success: true, ...result });
      }

      if (type === 'toko') {
        const data = await getMasterTokoFromDb();
        return res.json({ success: true, data, count: data.length });
      }
      if (type === 'pemasok') {
        const data = await getMasterPemasokFromDb();
        return res.json({ success: true, data, count: data.length });
      }
      if (type === 'dapur') {
        const data = await getMasterDapurFromDb();
        return res.json({ success: true, data, count: data.length });
      }

      return res.status(400).json({ success: false, error: 'Parameter type (toko, pemasok, dapur) diperlukan' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  });

  app.post('/api/master', async (req, res) => {
    try {
      const type = ((req.query.type || req.body.type || '') as string).toLowerCase();
      if (type === 'toko') {
        const nama = req.body.nama || req.body.name;
        if (!nama || !nama.trim()) return res.status(400).json({ success: false, error: 'Nama toko wajib diisi' });
        const data = await createMasterTokoInDb(nama);
        return res.json({ success: true, data, message: 'Toko berhasil ditambahkan' });
      }
      if (type === 'pemasok') {
        const nama = req.body.nama || req.body.name;
        if (!nama || !nama.trim()) return res.status(400).json({ success: false, error: 'Nama pemasok wajib diisi' });
        const data = await createMasterPemasokInDb(nama);
        return res.json({ success: true, data, message: 'Pemasok berhasil ditambahkan' });
      }
      if (type === 'dapur') {
        const nama = req.body.nama || req.body.name;
        const alamat = req.body.alamat || req.body.address || '';
        if (!nama || !nama.trim()) return res.status(400).json({ success: false, error: 'Nama dapur wajib diisi' });
        const data = await createMasterDapurInDb(nama, alamat);
        return res.json({ success: true, data, message: 'Dapur berhasil ditambahkan' });
      }
      return res.status(400).json({ success: false, error: 'Parameter type (toko, pemasok, dapur) diperlukan' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  });

  app.delete('/api/master', async (req, res) => {
    try {
      const type = ((req.query.type || req.body.type || '') as string).toLowerCase();
      const id = (req.query.id || req.body.id) as string;
      if (!id) return res.status(400).json({ success: false, error: 'ID wajib disertakan' });

      if (type === 'toko') {
        const result = await deleteMasterTokoInDb(id);
        return res.json({ success: true, ...result });
      }
      if (type === 'pemasok') {
        const result = await deleteMasterPemasokInDb(id);
        return res.json({ success: true, ...result });
      }
      if (type === 'dapur') {
        const result = await deleteMasterDapurInDb(id);
        return res.json({ success: true, ...result });
      }
      return res.status(400).json({ success: false, error: 'Parameter type (toko, pemasok, dapur) diperlukan' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  });

  // CHECK USAGE (Cek ketergantungan sebelum menghapus)
  app.get('/api/supabase/master/check-usage', async (req, res) => {
    try {
      const type = (req.query.type as 'toko' | 'pemasok' | 'dapur') || 'toko';
      const id = (req.query.id as string) || '';
      const name = (req.query.name as string) || '';

      const result = await checkMasterUsageInDb(type, id, name);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  });

  // TOKO
  app.get('/api/supabase/master/toko', async (req, res) => {
    try {
      const data = await getMasterTokoFromDb();
      res.json({ success: true, data, count: data.length });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  });

  app.post('/api/supabase/master/toko', async (req, res) => {
    try {
      const nama = req.body.nama || req.body.name;
      if (!nama || !nama.trim()) {
        return res.status(400).json({ success: false, error: 'Nama toko wajib diisi' });
      }
      const data = await createMasterTokoInDb(nama);
      res.json({ success: true, data, message: 'Toko berhasil ditambahkan' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  });

  app.delete('/api/supabase/master/toko', async (req, res) => {
    try {
      const id = (req.query.id || req.body.id) as string;
      if (!id) {
        return res.status(400).json({ success: false, error: 'ID toko wajib disertakan' });
      }
      const result = await deleteMasterTokoInDb(id);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  });

  // PEMASOK
  app.get('/api/supabase/master/pemasok', async (req, res) => {
    try {
      const data = await getMasterPemasokFromDb();
      res.json({ success: true, data, count: data.length });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  });

  app.post('/api/supabase/master/pemasok', async (req, res) => {
    try {
      const nama = req.body.nama || req.body.name;
      if (!nama || !nama.trim()) {
        return res.status(400).json({ success: false, error: 'Nama pemasok wajib diisi' });
      }
      const data = await createMasterPemasokInDb(nama);
      res.json({ success: true, data, message: 'Pemasok berhasil ditambahkan' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  });

  app.delete('/api/supabase/master/pemasok', async (req, res) => {
    try {
      const id = (req.query.id || req.body.id) as string;
      if (!id) {
        return res.status(400).json({ success: false, error: 'ID pemasok wajib disertakan' });
      }
      const result = await deleteMasterPemasokInDb(id);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  });

  // DAPUR
  app.get('/api/supabase/master/dapur', async (req, res) => {
    try {
      const data = await getMasterDapurFromDb();
      res.json({ success: true, data, count: data.length });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  });

  app.post('/api/supabase/master/dapur', async (req, res) => {
    try {
      const nama = req.body.nama || req.body.name;
      const alamat = req.body.alamat || req.body.address || '';
      if (!nama || !nama.trim()) {
        return res.status(400).json({ success: false, error: 'Nama dapur wajib diisi' });
      }
      const data = await createMasterDapurInDb(nama, alamat);
      res.json({ success: true, data, message: 'Dapur berhasil ditambahkan' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  });

  app.delete('/api/supabase/master/dapur', async (req, res) => {
    try {
      const id = (req.query.id || req.body.id) as string;
      if (!id) {
        return res.status(400).json({ success: false, error: 'ID dapur wajib disertakan' });
      }
      const result = await deleteMasterDapurInDb(id);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : error
      });
    }
  });

  // 6. DATABASE AGGREGATION: Period Summary & Weekly Store Report (Query Supabase Langsung!)
  app.get('/api/supabase/period-summary', async (req, res) => {
    try {
      const period = (req.query.period as string) || 'mingguan';
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

      const summary = await getPeriodSummaryFromDb(period, date);
      res.json({
        success: true,
        data: summary,
      });
    } catch (err: any) {
      console.warn('[Supabase PERIOD SUMMARY]:', err?.message || err);
      res.json({
        success: true,
        data: {
          period: req.query.period || 'mingguan',
          totalQty: 0,
          totalTransactions: 0,
          totalPendapatan: 0,
          totalPengeluaran: 0,
          profitBersih: 0,
          storeBreakdowns: [],
        },
        warning: err?.message,
      });
    }
  });

  // 6. SQL Schema Provider
  app.get('/api/supabase/schema-sql', (req, res) => {
    try {
      const sqlPath = path.join(process.cwd(), 'supabase_schema.sql');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.sendFile(sqlPath);
    } catch (e: any) {
      res.status(500).send('-- ' + (e?.message || 'Gagal membaca skrip schema'));
    }
  });

  // =========================================================================
  // BACKWARD COMPATIBILITY ADAPTERS (Reroute legacy /api/sheets-* to Supabase)
  // =========================================================================
  app.get('/api/sheets-get', async (req, res) => {
    try {
      const sheet = (req.query.sheet as string) || 'pesanan';
      if (sheet === 'transaksi') {
        const data = await getTransactionsFromDb();
        return res.json({ success: true, sheet, data, count: data.length });
      } else if (sheet === 'notes') {
        const data = await getNotesFromDb();
        return res.json({ success: true, sheet, data, count: data.length });
      } else {
        const data = await getOrdersFromDb();
        return res.json({ success: true, sheet, data, count: data.length });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error', data: [] });
    }
  });

  app.post('/api/sheets-add', async (req, res) => {
    try {
      const sheet = (req.body.sheet || req.query.sheet || 'pesanan') as string;
      const data = req.body.data || req.body;

      if (sheet === 'transaksi') {
        const created = await createTransactionInDb(data);
        return res.json({ success: true, message: 'Disimpan ke Supabase', data: created });
      } else if (sheet === 'notes') {
        const created = await createNoteInDb(data);
        return res.json({ success: true, message: 'Disimpan ke Supabase', data: created });
      } else {
        const created = await createOrdersInDb(data);
        return res.json({ success: true, message: 'Disimpan ke Supabase', data: created });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error' });
    }
  });

  app.post('/api/sheets-update', async (req, res) => {
    try {
      const sheet = (req.body.sheet || req.query.sheet || 'pesanan') as string;
      const { id, match, data, column, value, action } = req.body;

      // Extract ID from body, match, or data
      const targetId = id || match?.ID || match?.id || data?.id || data?.ID;

      if (sheet === 'pesanan') {
        if (targetId) {
          const updatePayload = { ...(data || {}) };
          if (column && value !== undefined) {
            updatePayload[column] = value;
          }
          await updateOrderInDb(String(targetId), updatePayload);
          return res.json({ success: true, message: 'Diperbarui di Supabase' });
        } else if (match && action === 'update_status') {
          // If match by toko, tanggal, dapur
          const orders = await getOrdersFromDb({
            date: match.DATE || match.tanggal,
            dapur: match.DAPUR || match.dapur,
            toko: match.TOKO || match.toko,
          });
          const ids = orders.map((o: any) => o.id);
          if (ids.length > 0) {
            await updateBatchOrdersInDb(ids, data || {});
          }
          return res.json({ success: true, message: 'Batch status updated di Supabase' });
        }
      } else if (sheet === 'notes') {
        if (targetId) {
          await updateNoteInDb(String(targetId), data || {});
          return res.json({ success: true, message: 'Note updated di Supabase' });
        }
      }

      res.json({ success: true, message: 'Supabase update processed' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error' });
    }
  });

  app.post('/api/sheets-delete', async (req, res) => {
    try {
      const sheet = (req.body.sheet || req.query.sheet || 'pesanan') as string;
      const { id, ids, match } = req.body;

      const targetIds: string[] = [];
      if (id) targetIds.push(String(id));
      if (Array.isArray(ids)) targetIds.push(...ids.map(String));

      if (sheet === 'pesanan') {
        if (targetIds.length > 0) {
          await deleteOrdersFromDb(targetIds);
        } else if (match) {
          const matching = await getOrdersFromDb({
            date: match.DATE || match.tanggal,
            dapur: match.DAPUR || match.dapur,
            toko: match.TOKO || match.toko,
          });
          const matchingIds = matching.map((o: any) => o.id);
          if (matchingIds.length > 0) {
            await deleteOrdersFromDb(matchingIds);
          }
        }
      } else if (sheet === 'transaksi') {
        if (targetIds.length > 0) {
          await deleteTransactionsFromDb(targetIds);
        }
      } else if (sheet === 'notes') {
        if (id) {
          await deleteNoteFromDb(String(id));
        }
      }

      res.json({ success: true, message: 'Dihapus dari Supabase' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error' });
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
