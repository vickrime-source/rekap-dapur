import {
  getTransactionsFromDb,
  createTransactionInDb,
  deleteTransactionsFromDb,
} from '../server/supabaseService.js';

function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,DELETE,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

export default async function handler(req: any, res: any) {
  try {
    setCors(res);

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // keep original
      }
    }
    body = body || {};
    const query = req.query || {};

    // 1. GET: Fetch Transactions
    if (req.method === 'GET') {
      const limit = query.limit ? parseInt(query.limit as string, 10) : 50;
      const page = query.page ? parseInt(query.page as string, 10) : 1;
      const fetchAll = query.all === 'true' || (!query.limit && !query.page);
      const result = await getTransactionsFromDb(limit, page, fetchAll);
      return res.status(200).json({
        success: true,
        data: result,
        count: Array.isArray(result) ? result.length : 0,
      });
    }

    // 2. POST: Create Transaction
    if (req.method === 'POST') {
      const tx = await createTransactionInDb(body.data || body);
      return res.status(200).json({
        success: true,
        data: tx,
        message: 'Transaksi berhasil disimpan ke database',
      });
    }

    // 3. DELETE: Delete Transaction(s)
    if (req.method === 'DELETE') {
      const id = (query.id || body.id) as string;
      const ids = (body.ids || (id ? [id] : [])) as string[];
      if (!ids || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'ID transaksi wajib disertakan.' });
      }
      const result = await deleteTransactionsFromDb(ids);
      return res.status(200).json({
        success: true,
        ...result,
        message: 'Transaksi berhasil dihapus dari database',
      });
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[API /api/transaksi Error]:', err);
    try {
      setCors(res);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Terjadi kesalahan pada serverless function /api/transaksi',
        detail: typeof err === 'object' ? String(err?.stack || err) : String(err),
      });
    } catch {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Internal Server Error',
      });
    }
  }
}
