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

  try {
    // 1. GET: Fetch Transactions
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

    // 2. POST: Create Transaction
    if (req.method === 'POST') {
      const tx = await createTransactionInDb(body.data || body);
      return res.status(200).json({
        success: true,
        data: tx,
        message: 'Transaksi berhasil disimpan ke Supabase',
      });
    }

    // 3. DELETE: Delete Transaction(s)
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

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[API /api/transaksi Error]:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal Server Error',
    });
  }
}
