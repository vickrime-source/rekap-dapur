import { checkSupabaseStatus } from '../server/supabaseService.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const status = await checkSupabaseStatus();
    return res.status(200).json(status);
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      configured: false,
      error: err?.message || 'Gagal mengecek status Database',
    });
  }
}
