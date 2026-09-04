import { addSheetRow, isSheetsConfigured } from './lib/sheetsService.js';

function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

function parseBody(req: any) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req: any, res: any) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const body = parseBody(req);
    const sheet = (body.sheet || req.query?.sheet || 'pesanan') as string;
    const data = body.data || body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Data baris baru harus berupa objek valid.',
      });
    }

    if (!isSheetsConfigured()) {
      return res.status(200).json({
        success: true,
        configured: false,
        message: 'Google Sheets Service Account belum dikonfigurasi. Data tersimpan di browser lokal.',
      });
    }

    const result = await addSheetRow(sheet, data);
    return res.status(200).json({
      success: true,
      configured: true,
      message: `Data berhasil ditambahkan ke sheet "${sheet}" via Google Sheets API`,
      ...result,
    });
  } catch (err: any) {
    console.warn('[Vercel API /api/sheets-add Warning]:', err?.message || err);
    return res.status(200).json({
      success: false,
      error: err?.message || 'Gagal menambahkan baris ke Google Sheets API',
    });
  }
}
