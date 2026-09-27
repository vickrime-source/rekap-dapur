import {
  clearAssistantChatMessages,
  createAssistantChatMessage,
  getAssistantChatMessages,
} from '../server/supabaseService.js';

function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,DELETE,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const sessionId = String(req.query?.sessionId || body.sessionId || '').trim();
  if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId wajib diisi.' });

  try {
    if (req.method === 'GET') {
      const data = await getAssistantChatMessages(sessionId);
      return res.status(200).json({ success: true, data });
    }
    if (req.method === 'POST') {
      const role = body.role === 'user' ? 'user' : 'assistant';
      const data = await createAssistantChatMessage({ sessionId, role, content: String(body.content || ''), metadata: body.metadata });
      return res.status(200).json({ success: true, data });
    }
    if (req.method === 'DELETE') {
      await clearAssistantChatMessages(sessionId);
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('[API /api/assistant-chat Error]:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Gagal memproses riwayat chat.' });
  }
}
