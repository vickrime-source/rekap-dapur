import {
  getOrdersFromDb,
  createOrdersInDb,
  updateOrderInDb,
  updateBatchOrdersInDb,
  deleteOrdersFromDb,
  getPeriodSummaryFromDb,
} from '../server/supabaseService.js';

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

  // Parse body safely
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      // keep original
    }
  }
  body = body || {};

  try {
    // 1. GET: Fetch Orders OR Period Summary
    if (req.method === 'GET') {
      const action = req.query.action;
      if (action === 'period_summary' || action === 'summary') {
        const period = (req.query.period as string) || 'mingguan';
        const date = req.query.date as string | undefined;
        const summary = await getPeriodSummaryFromDb(period, date);
        return res.status(200).json({ success: true, data: summary });
      }

      const period = ((req.query.period as string) || 'all_time') as any;
      const date = req.query.date as string | undefined;
      const toko = req.query.toko as string | undefined;
      const dapur = req.query.dapur as string | undefined;
      const pemasok = req.query.pemasok as string | undefined;
      const status = req.query.status as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;

      const result = await getOrdersFromDb({ period, date, toko, dapur, pemasok, status, limit, page });
      return res.status(200).json({
        success: true,
        data: result,
        count: Array.isArray(result) ? result.length : 0,
      });
    }

    // 2. POST: Create Orders OR Batch Update Status
    if (req.method === 'POST') {
      const action = req.query.action || body.action;
      if (action === 'batch_status' || Array.isArray(body.ids)) {
        const ids = body.ids || [];
        const status = body.status;
        const paymentStatus = body.paymentStatus || body.status_pembayaran;
        const deliveryStatus = body.deliveryStatus || body.status_pengiriman;

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

      const orderData = body.data || body;
      const created = await createOrdersInDb(orderData);
      return res.status(200).json({
        success: true,
        data: Array.isArray(created) ? created : [created],
        count: Array.isArray(created) ? created.length : 1,
        message: 'Pesanan berhasil disimpan ke Supabase',
      });
    }

    // 3. PUT / PATCH: Update Single Order OR Batch Status
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const action = req.query.action || body.action;
      if (action === 'batch_status' || (Array.isArray(body.ids) && body.ids.length > 0)) {
        const ids = body.ids;
        const updates: any = {};
        if (body.status) updates.status = body.status;
        if (body.paymentStatus || body.status_pembayaran) {
          updates.status_pembayaran = body.paymentStatus || body.status_pembayaran;
        }
        if (body.deliveryStatus || body.status_pengiriman) {
          updates.status_pengiriman = body.deliveryStatus || body.status_pengiriman;
        }
        const result = await updateBatchOrdersInDb(ids, updates);
        return res.status(200).json({
          success: true,
          ...result,
          message: `${ids.length} pesanan berhasil diupdate statusnya`,
        });
      }

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

    // 4. DELETE: Delete Order(s)
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

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[API /api/pesanan Error]:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal Server Error',
    });
  }
}
