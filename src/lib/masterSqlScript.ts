/**
 * Skrip SQL Master Dapur, Toko, dan Pemasok untuk Supabase / PostgreSQL.
 * Digunakan untuk export / copy-paste langsung ke Supabase SQL Editor.
 */

export const MASTER_TABLES_SQL = `-- =============================================================================
-- SKEMA SQL MASTER DATA: DAPUR, TOKO, DAN PEMASOK (SUPABASE / POSTGRESQL)
-- DENGAN PRIMARY KEY BIGINT IDENTITY (AUTO-INCREMENT INTEGER EFISIEN)
-- =============================================================================
-- Jalankan skrip ini di: Supabase Dashboard -> Project Anda -> SQL Editor -> Run

-- 1. TABEL MASTER TOKO (BIGINT PRIMARY KEY)
CREATE TABLE IF NOT EXISTS public.toko (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nama TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABEL MASTER PEMASOK (BIGINT PRIMARY KEY)
CREATE TABLE IF NOT EXISTS public.pemasok (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nama TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABEL MASTER DAPUR (BIGINT PRIMARY KEY)
CREATE TABLE IF NOT EXISTS public.dapur (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nama TEXT NOT NULL UNIQUE,
  alamat TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. INDEX PENCARIAN CEPAT
CREATE INDEX IF NOT EXISTS idx_toko_nama ON public.toko (nama);
CREATE INDEX IF NOT EXISTS idx_pemasok_nama ON public.pemasok (nama);
CREATE INDEX IF NOT EXISTS idx_dapur_nama ON public.dapur (nama);

-- 5. DATA AWAL (SEED) TOKO, PEMASOK, & 21 DAPUR
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

-- 6. KEAMANAN ROW LEVEL SECURITY (RLS)
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

export const MIGRATION_UUID_TO_BIGINT_SQL = `-- =============================================================================
-- SINKRONISASI RELASI BIGINT MASTER DATA (TOKO, PEMASOK, DAPUR)
-- =============================================================================
-- Skrip ini memastikan seluruh relasi di tabel pesanan & transaksi
-- terisi sesuai master data ID (BIGINT) yang sudah ada di database Anda.
-- Jalankan di: Supabase Dashboard -> SQL Editor -> Run

-- 1. Pastikan tabel master data tersedia dengan format BIGINT
CREATE TABLE IF NOT EXISTS public.toko (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nama TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pemasok (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nama TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dapur (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nama TEXT NOT NULL UNIQUE,
  alamat TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Pastikan kolom foreign key & soft-delete ada di tabel pesanan
ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS toko_id BIGINT;
ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS pemasok_id BIGINT;
ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS dapur_id BIGINT;
ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS qty_beli NUMERIC;
ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS nota_id TEXT;
ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS status_pembatalan TEXT;
ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- 3. Sinkronkan ID Toko ke tabel pesanan
UPDATE public.pesanan p
SET toko_id = t.id
FROM public.toko t
WHERE (p.toko_id IS NULL)
  AND (TRIM(LOWER(p.toko)) = TRIM(LOWER(t.nama)));

-- 4. Sinkronkan ID Pemasok ke tabel pesanan
UPDATE public.pesanan p
SET pemasok_id = s.id
FROM public.pemasok s
WHERE (p.pemasok_id IS NULL)
  AND (TRIM(LOWER(p.pemasok)) = TRIM(LOWER(s.nama)));

-- 5. Sinkronkan ID Dapur ke tabel pesanan
UPDATE public.pesanan p
SET dapur_id = d.id
FROM public.dapur d
WHERE (p.dapur_id IS NULL)
  AND (
    TRIM(LOWER(p.dapur)) = TRIM(LOWER(d.nama))
    OR TRIM(LOWER(p.dapur)) = TRIM(LOWER('Dapur ' || d.nama))
  );

-- 6. Tambahkan Index untuk mempercepat query
CREATE INDEX IF NOT EXISTS idx_pesanan_toko_id ON public.pesanan (toko_id);
CREATE INDEX IF NOT EXISTS idx_pesanan_pemasok_id ON public.pesanan (pemasok_id);
CREATE INDEX IF NOT EXISTS idx_pesanan_dapur_id ON public.pesanan (dapur_id);

-- 7. Data Awal Standar (Jika Belum Ada)
INSERT INTO public.toko (nama) VALUES
  ('LB / Luweng Boga'),
  ('HTG'),
  ('LA / Lumbung Adifruta'),
  ('PW / Prohe')
ON CONFLICT (nama) DO NOTHING;

DELETE FROM public.pemasok WHERE nama IN ('Pemasok 1', 'Pemasok 2', 'Pemasok 3', 'Pemasok 4');

INSERT INTO public.pemasok (nama) VALUES
  ('Ajeng fruits'), ('Sari buah'), ('Buah mulyo'), ('Arnis buah'), ('PMB'),
  ('Diah Buah'), ('Pak Jarwo'), ('Handoyo'), ('Pak nyoto'), ('Pak bahtiar'),
  ('Salak senepo'), ('Crystal fruits'), ('indo sayur'), ('Toko daging sapi banyuwangi'),
  ('Raja ayam'), ('Bu Tiah'), ('Vazio'), ('Pak Hadi'), ('Yogo'), ('Roti Pradana'),
  ('Pak Toha'), ('Nur Cavendish'), ('Juhari Cavendish'), ('Mecca'), ('Lontong sempu'),
  ('Ladju snack'), ('Pak adi edamame'), ('Pak wargito Ndok Asin'), ('Suparti'),
  ('Eko lele'), ('King'), ('Nur patin'), ('Nanik tuna'), ('Rambo Jambu citra')
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

-- 8. Keamanan RLS
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
