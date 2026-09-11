import {
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

  const type = ((req.query.type || body.type || '') as string).toLowerCase();
  const action = ((req.query.action || body.action || '') as string).toLowerCase();

  try {
    // 1. Check Usage across orders & transactions
    if (action === 'check_usage' || action === 'check-usage' || type === 'check_usage') {
      const targetType = (req.query.targetType || req.query.type || 'toko') as 'toko' | 'pemasok' | 'dapur';
      const id = (req.query.id as string) || '';
      const name = (req.query.name as string) || '';
      const result = await checkMasterUsageInDb(targetType, id, name);
      return res.status(200).json({ success: true, ...result });
    }

    // 2. TOKO CRUD
    if (type === 'toko') {
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

    // 3. PEMASOK CRUD
    if (type === 'pemasok') {
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

    // 4. DAPUR CRUD
    if (type === 'dapur') {
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

    return res.status(400).json({
      success: false,
      error: 'Tipe master data tidak valid. Gunakan ?type=toko, ?type=pemasok, atau ?type=dapur',
    });
  } catch (err: any) {
    console.error('[API /api/master Error]:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal Server Error',
    });
  }
}
