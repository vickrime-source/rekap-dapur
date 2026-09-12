import { checkSupabaseStatus } from '../server/supabaseService';

export default async function handler(req: any, res: any) {
  try {
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
    const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (type === 'config') {
      return res.status(200).json({
        url,
        anonKey,
        configured: Boolean(url && (anonKey || serviceRoleKey)),
      });
    }

    const dbStatus = await checkSupabaseStatus();
    return res.status(200).json({
      status: 'ok',
      time: new Date().toISOString(),
      url,
      anonKey,
      ...dbStatus,
    });
  } catch (err: any) {
    console.error('[API /api/status Error]:', err);
    try {
      return res.status(200).json({
        status: 'error',
        success: false,
        error: err?.message || 'Gagal mengecek status Database',
      });
    } catch {
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
}

