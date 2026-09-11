import {
  getNotesFromDb,
  createNoteInDb,
  updateNoteInDb,
  deleteNoteFromDb,
} from '../server/supabaseService.js';

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
    // 1. GET: Fetch Notes
    if (req.method === 'GET') {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      const notes = await getNotesFromDb(limit);
      return res.status(200).json({
        success: true,
        data: notes,
        count: notes.length,
      });
    }

    // 2. POST: Create Note
    if (req.method === 'POST') {
      const note = await createNoteInDb(body.data || body);
      return res.status(200).json({
        success: true,
        data: note,
        message: 'Catatan berhasil disimpan ke Supabase',
      });
    }

    // 3. PUT / PATCH: Update Note
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const id = (req.query.id || body.id) as string;
      if (!id) {
        return res.status(400).json({ success: false, error: 'ID catatan wajib disertakan.' });
      }
      const updated = await updateNoteInDb(id, body);
      return res.status(200).json({
        success: true,
        data: updated,
        message: 'Catatan berhasil diperbarui di Supabase',
      });
    }

    // 4. DELETE: Delete Note
    if (req.method === 'DELETE') {
      const id = (req.query.id || body.id) as string;
      if (!id) {
        return res.status(400).json({ success: false, error: 'ID catatan wajib disertakan.' });
      }
      const result = await deleteNoteFromDb(id);
      return res.status(200).json({
        success: true,
        ...result,
        message: 'Catatan berhasil dihapus dari Supabase',
      });
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[API /api/notes Error]:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal Server Error',
    });
  }
}
