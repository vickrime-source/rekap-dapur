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

  const type = req.query?.type;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (type === 'config') {
    return res.status(200).json({
      url,
      anonKey,
      configured: Boolean(url && (anonKey || serviceRoleKey)),
    });
  }

  try {
    const dbStatus = await checkSupabaseStatus();
    return res.status(200).json({
      status: 'ok',
      time: new Date().toISOString(),
      url,
      anonKey,
      ...dbStatus,
    });
  } catch (err: any) {
    return res.status(200).json({
      status: 'error',
      success: false,
      configured: Boolean(url && (anonKey || serviceRoleKey)),
      error: err?.message || 'Gagal mengecek status Database',
    });
  }
}
