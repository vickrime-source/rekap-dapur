import {
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
  checkSupabaseStatus,
} from '../../server/supabaseService.js';

function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

export default async function handler(req: any, res: any) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse path segments: req.query.path can be string or array
  const rawPath = req.query.path;
  const segments: string[] = Array.isArray(rawPath)
    ? rawPath
    : typeof rawPath === 'string'
    ? rawPath.split('/').filter(Boolean)
    : [];

  const mainPath = segments[0] || '';
  const subPath = segments[1] || '';

  // Body fallback
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      // keep string
    }
  }
  body = body || {};

  try {
    // 1. CONFIG
    if (mainPath === 'config') {
      const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      return res.status(200).json({
        url,
        anonKey,
        configured: Boolean(url && (anonKey || serviceRoleKey)),
      });
    }

    // 2. STATUS
    if (mainPath === 'status') {
      const status = await checkSupabaseStatus();
      return res.status(200).json(status);
    }

    // 3. PESANAN
    if (mainPath === 'pesanan') {
      if (req.method === 'GET') {
        const period = ((req.query.period as string) || 'all_time') as any;
        const date = req.query.date as string | undefined;
        const toko = req.query.toko as string | undefined;
        const dapur = req.query.dapur as string | undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
        const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;

        const result = await getOrdersFromDb({ period, date, toko, dapur, limit, page });
        return res.status(200).json({
          success: true,
          data: result,
          count: Array.isArray(result) ? result.length : 0,
        });
      }

      if (req.method === 'POST') {
        const orderData = body.data || body;
        const created = await createOrdersInDb(orderData);
        return res.status(200).json({
          success: true,
          data: Array.isArray(created) ? created : [created],
          count: Array.isArray(created) ? created.length : 1,
          message: 'Pesanan berhasil disimpan ke Supabase',
        });
      }

      if (req.method === 'PUT' || req.method === 'PATCH') {
        const id = (req.query.id || body.id) as string;
        if (!id) {
          return res.status(400).json({ success: false, error: 'ID pesanan wajib disertakan.' });
        }
        const updated = await updateOrderInDb(id, body);
        return res.status(200).json({
          success: true,
          data: updated,
          message: 'Pesanan berhasil diperbarui di Supabase',
        });
      }

      if (req.method === 'DELETE') {
        const id = (req.query.id || body.id) as string;
        const ids = (body.ids || (id ? [id] : [])) as string[];
        if (!ids || ids.length === 0) {
          return res.status(400).json({ success: false, error: 'ID pesanan wajib disertakan.' });
        }
        const result = await deleteOrdersFromDb(ids);
        return res.status(200).json({
          success: true,
          ...result,
          message: 'Pesanan berhasil dihapus dari Supabase',
        });
      }
    }

    // 4. BATCH STATUS
    if (mainPath === 'batch-status') {
      if (req.method === 'POST') {
        const ids = body.ids || [];
        const status = body.status;
        const paymentStatus = body.paymentStatus;
        const deliveryStatus = body.deliveryStatus;

        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ success: false, error: 'Array IDs pesanan wajib disertakan.' });
        }

        const updates: any = {};
        if (status) updates.status = status;
        if (paymentStatus) updates.status_pembayaran = paymentStatus;
        if (deliveryStatus) updates.status_pengiriman = deliveryStatus;

        const result = await updateBatchOrdersInDb(ids, updates);
        return res.status(200).json({
          success: true,
          ...result,
          message: `${ids.length} pesanan berhasil diupdate statusnya`,
        });
      }
    }

    // 5. TRANSAKSI
    if (mainPath === 'transaksi') {
      if (req.method === 'GET') {
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
        const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
        const result = await getTransactionsFromDb(limit, page);
        return res.status(200).json({
          success: true,
          data: result,
          count: Array.isArray(result) ? result.length : 0,
        });
      }

      if (req.method === 'POST') {
        const tx = await createTransactionInDb(body.data || body);
        return res.status(200).json({
          success: true,
          data: tx,
          message: 'Transaksi berhasil disimpan ke Supabase',
        });
      }

      if (req.method === 'DELETE') {
        const id = (req.query.id || body.id) as string;
        const ids = (body.ids || (id ? [id] : [])) as string[];
        if (!ids || ids.length === 0) {
          return res.status(400).json({ success: false, error: 'ID transaksi wajib disertakan.' });
        }
        const result = await deleteTransactionsFromDb(ids);
        return res.status(200).json({
          success: true,
          ...result,
          message: 'Transaksi berhasil dihapus dari Supabase',
        });
      }
    }

    // 6. NOTES
    if (mainPath === 'notes') {
      if (req.method === 'GET') {
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
        const notes = await getNotesFromDb(limit);
        return res.status(200).json({
          success: true,
          data: notes,
          count: notes.length,
        });
      }

      if (req.method === 'POST') {
        const note = await createNoteInDb(body.data || body);
        return res.status(200).json({
          success: true,
          data: note,
          message: 'Catatan berhasil disimpan ke Supabase',
        });
      }

      if (req.method === 'PUT' || req.method === 'PATCH') {
        const id = (req.query.id || body.id) as string;
        if (!id) {
          return res.status(400).json({ success: false, error: 'ID catatan wajib disertakan.' });
        }
        const updated = await updateNoteInDb(id, body);
        return res.status(200).json({
          success: true,
          data: updated,
          message: 'Catatan berhasil diperbarui di Supabase',
        });
      }

      if (req.method === 'DELETE') {
        const id = (req.query.id || body.id) as string;
        if (!id) {
          return res.status(400).json({ success: false, error: 'ID catatan wajib disertakan.' });
        }
        const result = await deleteNoteFromDb(id);
        return res.status(200).json({
          success: true,
          ...result,
          message: 'Catatan berhasil dihapus dari Supabase',
        });
      }
    }

    // 7. MASTER DATA
    if (mainPath === 'master') {
      if (subPath === 'check-usage') {
        const type = (req.query.type as 'toko' | 'pemasok' | 'dapur') || 'toko';
        const id = (req.query.id as string) || '';
        const name = (req.query.name as string) || '';
        const result = await checkMasterUsageInDb(type, id, name);
        return res.status(200).json({ success: true, ...result });
      }

      if (subPath === 'toko') {
        if (req.method === 'GET') {
          const data = await getMasterTokoFromDb();
          return res.status(200).json({ success: true, data, count: data.length });
        }
        if (req.method === 'POST') {
          const nama = (body.nama || body.name || '').trim();
          if (!nama) {
            return res.status(400).json({ success: false, error: 'Nama toko wajib diisi.' });
          }
          const item = await createMasterTokoInDb(nama);
          return res.status(200).json({ success: true, data: item, message: 'Toko berhasil ditambahkan' });
        }
        if (req.method === 'DELETE') {
          const id = (req.query.id || body.id) as string;
          if (!id) {
            return res.status(400).json({ success: false, error: 'ID toko wajib disertakan.' });
          }
          await deleteMasterTokoInDb(id);
          return res.status(200).json({ success: true, message: 'Toko berhasil dihapus' });
        }
      }

      if (subPath === 'pemasok') {
        if (req.method === 'GET') {
          const data = await getMasterPemasokFromDb();
          return res.status(200).json({ success: true, data, count: data.length });
        }
        if (req.method === 'POST') {
          const nama = (body.nama || body.name || '').trim();
          if (!nama) {
            return res.status(400).json({ success: false, error: 'Nama pemasok wajib diisi.' });
          }
          const item = await createMasterPemasokInDb(nama);
          return res.status(200).json({ success: true, data: item, message: 'Pemasok berhasil ditambahkan' });
        }
        if (req.method === 'DELETE') {
          const id = (req.query.id || body.id) as string;
          if (!id) {
            return res.status(400).json({ success: false, error: 'ID pemasok wajib disertakan.' });
          }
          await deleteMasterPemasokInDb(id);
          return res.status(200).json({ success: true, message: 'Pemasok berhasil dihapus' });
        }
      }

      if (subPath === 'dapur') {
        if (req.method === 'GET') {
          const data = await getMasterDapurFromDb();
          return res.status(200).json({ success: true, data, count: data.length });
        }
        if (req.method === 'POST') {
          const nama = (body.nama || body.name || '').trim();
          const alamat = (body.alamat || '').trim();
          if (!nama) {
            return res.status(400).json({ success: false, error: 'Nama dapur wajib diisi.' });
          }
          const item = await createMasterDapurInDb(nama, alamat);
          return res.status(200).json({ success: true, data: item, message: 'Dapur berhasil ditambahkan' });
        }
        if (req.method === 'DELETE') {
          const id = (req.query.id || body.id) as string;
          if (!id) {
            return res.status(400).json({ success: false, error: 'ID dapur wajib disertakan.' });
          }
          await deleteMasterDapurInDb(id);
          return res.status(200).json({ success: true, message: 'Dapur berhasil dihapus' });
        }
      }
    }

    // 8. PERIOD SUMMARY
    if (mainPath === 'period-summary') {
      if (req.method === 'GET') {
        const period = (req.query.period as string) || 'mingguan';
        const date = req.query.date as string | undefined;
        const summary = await getPeriodSummaryFromDb(period, date);
        return res.status(200).json({ success: true, data: summary });
      }
    }

    // 9. SCHEMA SQL
    if (mainPath === 'schema-sql') {
      return res.status(200).json({
        success: true,
        schemaFile: 'supabase_schema.sql',
        message: 'Jalankan file supabase_schema.sql di Supabase SQL Editor',
      });
    }

    // Path not handled
    return res.status(404).json({
      success: false,
      error: `Endpoint /api/supabase/${segments.join('/')} tidak ditemukan.`,
    });
  } catch (err: any) {
    console.error(`[Vercel API /api/supabase/${segments.join('/')} Error]:`, err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal Server Error',
    });
  }
}
