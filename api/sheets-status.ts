import { getSheetsStatus } from './lib/sheetsService.js';

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

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed. Use GET.' });
  }

  try {
    const status = await getSheetsStatus();
    return res.status(200).json(status);
  } catch (err: any) {
    console.warn('[Vercel API /api/sheets-status Warning]:', err?.message || err);
    return res.status(200).json({
      success: false,
      configured: false,
      error: err?.message || 'Gagal memeriksa status koneksi Google Sheets API',
    });
  }
}
