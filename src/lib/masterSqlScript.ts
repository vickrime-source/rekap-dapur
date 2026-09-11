/**
 * Skrip SQL Master Dapur, Toko, dan Pemasok untuk Supabase / PostgreSQL.
 * Digunakan untuk export / copy-paste langsung ke Supabase SQL Editor.
 */

export const MASTER_TABLES_SQL = `-- =============================================================================
-- SKEMA SQL MASTER DATA: DAPUR, TOKO, DAN PEMASOK (SUPABASE / POSTGRESQL)
-- =============================================================================
-- Jalankan skrip ini di: Supabase Dashboard -> Project Anda -> SQL Editor -> Run

-- 1. Ekstensi pgcrypto untuk fungsi UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABEL MASTER TOKO
CREATE TABLE IF NOT EXISTS public.toko (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nama TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABEL MASTER PEMASOK
CREATE TABLE IF NOT EXISTS public.pemasok (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nama TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABEL MASTER DAPUR
CREATE TABLE IF NOT EXISTS public.dapur (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nama TEXT NOT NULL UNIQUE,
  alamat TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. INDEX PENCARIAN CEPAT
CREATE INDEX IF NOT EXISTS idx_toko_nama ON public.toko (nama);
CREATE INDEX IF NOT EXISTS idx_pemasok_nama ON public.pemasok (nama);
CREATE INDEX IF NOT EXISTS idx_dapur_nama ON public.dapur (nama);

-- 6. DATA AWAL (SEED) TOKO, PEMASOK, & 21 DAPUR
INSERT INTO public.toko (nama) VALUES
  ('LB / Luweng Boga'),
  ('HTG'),
  ('LA / Lumbung Adifruta'),
  ('PW / Prohe')
ON CONFLICT (nama) DO NOTHING;

-- Hapus pemasok dummy lama jika ada
DELETE FROM public.pemasok WHERE nama IN ('Pemasok 1', 'Pemasok 2', 'Pemasok 3', 'Pemasok 4');

INSERT INTO public.pemasok (nama) VALUES
  ('Ajeng fruits'),
  ('Sari buah'),
  ('Buah mulyo'),
  ('Arnis buah'),
  ('PMB'),
  ('Diah Buah'),
  ('Pak Jarwo'),
  ('Handoyo'),
  ('Pak nyoto'),
  ('Pak bahtiar'),
  ('Salak senepo'),
  ('Crystal fruits'),
  ('indo sayur'),
  ('Toko daging sapi banyuwangi'),
  ('Raja ayam'),
  ('Bu Tiah'),
  ('Vazio'),
  ('Pak Hadi'),
  ('Yogo'),
  ('Roti Pradana'),
  ('Pak Toha'),
  ('Nur Cavendish'),
  ('Juhari Cavendish'),
  ('Mecca'),
  ('Lontong sempu'),
  ('Ladju snack'),
  ('Pak adi edamame'),
  ('Pak wargito Ndok Asin'),
  ('Suparti'),
  ('Eko lele'),
  ('King'),
  ('Nur patin'),
  ('Nanik tuna'),
  ('Rambo Jambu citra')
ON CONFLICT (nama) DO NOTHING;

INSERT INTO public.dapur (nama, alamat) VALUES
  ('Kedayunan', 'Kec. Kabat, Banyuwangi'),
  ('Siliragung', 'Kec. Siliragung, Banyuwangi'),
  ('Banjarsari 2', 'Kec. Glagah, Banyuwangi'),
  ('Wringinputih 2', 'Kec. Muncar, Banyuwangi'),
  ('Wringinputih 4', 'Kec. Muncar, Banyuwangi'),
  ('Singojuruh', 'Kec. Singojuruh, Banyuwangi'),
  ('Cluring', 'Kec. Cluring, Banyuwangi'),
  ('Tamansari', 'Kec. Licin, Banyuwangi'),
  ('Wongsorejo', 'Kec. Wongsorejo, Banyuwangi'),
  ('Sumberagung', 'Kec. Pesanggaran, Banyuwangi'),
  ('Mojoroto', 'Banyuwangi'),
  ('Tapanrejo', 'Kec. Muncar, Banyuwangi'),
  ('Kendalrejo', 'Kec. Tegaldlimo, Banyuwangi'),
  ('Gambiran', 'Kec. Gambiran, Banyuwangi'),
  ('Pidis', 'Banyuwangi'),
  ('Kesilir 2', 'Kec. Siliragung, Banyuwangi'),
  ('Mufid', 'Banyuwangi'),
  ('Rejoagung', 'Kec. Srono, Banyuwangi'),
  ('Ajeng', 'Banyuwangi'),
  ('Pesanggaran', 'Kec. Pesanggaran, Banyuwangi'),
  ('Bangorejo', 'Kec. Bangorejo, Banyuwangi')
ON CONFLICT (nama) DO NOTHING;

-- 7. MIGRASI DARI PESANAN LAMA (JIKA ADA)
INSERT INTO public.toko (nama)
SELECT DISTINCT TRIM(toko) FROM public.pesanan WHERE TRIM(toko) <> ''
ON CONFLICT (nama) DO NOTHING;

INSERT INTO public.pemasok (nama)
SELECT DISTINCT TRIM(pemasok) FROM public.pesanan WHERE TRIM(pemasok) <> ''
ON CONFLICT (nama) DO NOTHING;

INSERT INTO public.dapur (nama)
SELECT DISTINCT TRIM(REPLACE(dapur, 'Dapur ', '')) FROM public.pesanan WHERE TRIM(dapur) <> ''
ON CONFLICT (nama) DO NOTHING;

-- 8. KEAMANAN ROW LEVEL SECURITY (RLS)
ALTER TABLE public.toko ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pemasok ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dapur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access toko" ON public.toko;
CREATE POLICY "Public access toko" ON public.toko FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access pemasok" ON public.pemasok;
CREATE POLICY "Public access pemasok" ON public.pemasok FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access dapur" ON public.dapur;
CREATE POLICY "Public access dapur" ON public.dapur FOR ALL USING (true) WITH CHECK (true);
`;
