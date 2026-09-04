import { getSheetRows, isSheetsConfigured } from './lib/sheetsService.js';

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
    const sheet = (req.query?.sheet as string) || 'pesanan';
    const range = req.query?.range as string | undefined;

    if (!isSheetsConfigured()) {
      return res.status(200).json({
        success: true,
        configured: false,
        sheet,
        data: [],
        count: 0,
        message: 'Google Sheets Service Account belum dikonfigurasi di environment variables. Aplikasi berjalan dalam mode data lokal.',
      });
    }

    const rows = await getSheetRows(sheet, range);
    return res.status(200).json({
      success: true,
      configured: true,
      sheet,
      data: rows,
      count: rows.length,
    });
  } catch (err: any) {
    console.warn('[Vercel API /api/sheets-get Warning]:', err?.message || err);
    return res.status(200).json({
      success: false,
      configured: false,
      error: err?.message || 'Gagal membaca data dari Google Sheets API',
      data: [],
    });
  }
}
