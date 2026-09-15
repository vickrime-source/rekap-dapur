-- =============================================================================
-- SQL MIGRATION: MASTER SATUAN (SUPABASE / POSTGRESQL)
-- =============================================================================
-- Skrip ini disiapkan untuk dieksekusi di Supabase SQL Editor.
-- Jangan jalankan otomatis, tampilkan ke user untuk dieksekusi saat siap.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Buat tabel master satuan
CREATE TABLE IF NOT EXISTS public.satuan (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nama TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Index pencarian cepat untuk nama satuan
CREATE INDEX IF NOT EXISTS idx_satuan_nama ON public.satuan (nama);

-- 3. Trigger otomatis updated_at jika ada helper set_updated_at_column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_column') THEN
    DROP TRIGGER IF EXISTS trg_satuan_updated_at ON public.satuan;
    CREATE TRIGGER trg_satuan_updated_at
      BEFORE UPDATE ON public.satuan
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();
  END IF;
END $$;

-- 4. Seed satuan umum awal
INSERT INTO public.satuan (nama) VALUES
  ('Kg'),
  ('Gram'),
  ('Pcs'),
  ('Ikat'),
  ('Tray'),
  ('Pack'),
  ('Liter'),
  ('Box'),
  ('Karung'),
  ('Ekor'),
  ('Krat'),
  ('Dus'),
  ('Bungkus')
ON CONFLICT (nama) DO NOTHING;
