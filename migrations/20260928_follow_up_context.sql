-- Menjaga konteks sumber Follow Up tanpa mengubah atau menghapus data lama.
-- Jalankan setelah memeriksa schema public.notes di project Supabase.

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS tanggal DATE;

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS batch_id TEXT;

CREATE INDEX IF NOT EXISTS idx_notes_tanggal ON public.notes (tanggal);
CREATE INDEX IF NOT EXISTS idx_notes_batch_id ON public.notes (batch_id);
