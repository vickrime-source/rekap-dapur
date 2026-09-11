-- =============================================================================
-- SQL QUERY MASTER DATA: DAPUR, TOKO, DAN PEMASOK (SUPABASE / POSTGRESQL)
-- =============================================================================
-- Skrip ini siap dijalankan langsung di:
-- Supabase Dashboard -> Project Anda -> SQL Editor -> Tempel & Klik "Run"
-- =============================================================================

-- 1. Pastikan ekstensi pgcrypto aktif untuk pembuatan UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 2. PEMBUATAN TABEL MASTER
-- -----------------------------------------------------------------------------

-- A. TABEL MASTER TOKO
CREATE TABLE IF NOT EXISTS public.toko (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nama TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- B. TABEL MASTER PEMASOK
CREATE TABLE IF NOT EXISTS public.pemasok (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nama TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- C. TABEL MASTER DAPUR
CREATE TABLE IF NOT EXISTS public.dapur (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nama TEXT NOT NULL UNIQUE,
  alamat TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. PEMBUATAN INDEX PENCARIAN CEPAT
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_toko_nama ON public.toko (nama);
CREATE INDEX IF NOT EXISTS idx_pemasok_nama ON public.pemasok (nama);
CREATE INDEX IF NOT EXISTS idx_dapur_nama ON public.dapur (nama);

-- -----------------------------------------------------------------------------
-- 4. TRIGGER OTOMATIS UPDATED_AT
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_toko_updated_at ON public.toko;
CREATE TRIGGER trg_toko_updated_at
  BEFORE UPDATE ON public.toko
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

DROP TRIGGER IF EXISTS trg_pemasok_updated_at ON public.pemasok;
CREATE TRIGGER trg_pemasok_updated_at
  BEFORE UPDATE ON public.pemasok
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

DROP TRIGGER IF EXISTS trg_dapur_updated_at ON public.dapur;
CREATE TRIGGER trg_dapur_updated_at
  BEFORE UPDATE ON public.dapur
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column();

-- -----------------------------------------------------------------------------
-- 5. SEED DATA AWAL (MASTER TOKO, PEMASOK, & 21 DAPUR)
-- -----------------------------------------------------------------------------

-- Masukkan Data Master Toko
INSERT INTO public.toko (nama) VALUES
  ('LB / Luweng Boga'),
  ('HTG'),
  ('LA / Lumbung Adifruta'),
  ('PW / Prohe')
ON CONFLICT (nama) DO NOTHING;

-- Hapus Data Pemasok 1-4 lama jika ada
DELETE FROM public.pemasok WHERE nama IN ('Pemasok 1', 'Pemasok 2', 'Pemasok 3', 'Pemasok 4');

-- Masukkan Data Master Pemasok Baru (34 Pemasok)
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

-- Masukkan Data 21 Master Dapur beserta Wilayah / Alamat
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

-- -----------------------------------------------------------------------------
-- 6. MIGRASI DATA LAMA (JIKA SUDAH ADA TRANSAKSI / PESANAN SEBELUMNYA)
-- Otomatis mendata toko/pemasok/dapur yang sudah pernah dicatat di pesanan
-- -----------------------------------------------------------------------------
INSERT INTO public.toko (nama)
SELECT DISTINCT TRIM(toko) FROM public.pesanan 
WHERE TRIM(toko) <> ''
ON CONFLICT (nama) DO NOTHING;

INSERT INTO public.pemasok (nama)
SELECT DISTINCT TRIM(pemasok) FROM public.pesanan 
WHERE TRIM(pemasok) <> ''
ON CONFLICT (nama) DO NOTHING;

INSERT INTO public.dapur (nama)
SELECT DISTINCT TRIM(REPLACE(dapur, 'Dapur ', '')) FROM public.pesanan 
WHERE TRIM(dapur) <> ''
ON CONFLICT (nama) DO NOTHING;

-- Hubungkan Foreign Key pada tabel pesanan jika kolom ada
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pesanan') THEN
    ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS toko_id TEXT REFERENCES public.toko(id) ON DELETE RESTRICT;
    ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS pemasok_id TEXT REFERENCES public.pemasok(id) ON DELETE RESTRICT;
    ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS dapur_id TEXT REFERENCES public.dapur(id) ON DELETE RESTRICT;

    -- Update relasi FK
    UPDATE public.pesanan p
    SET toko_id = t.id
    FROM public.toko t
    WHERE (p.toko = t.nama OR p.toko ILIKE '%' || t.nama || '%') AND p.toko_id IS NULL;

    UPDATE public.pesanan p
    SET pemasok_id = s.id
    FROM public.pemasok s
    WHERE p.pemasok = s.nama AND p.pemasok_id IS NULL;

    UPDATE public.pesanan p
    SET dapur_id = d.id
    FROM public.dapur d
    WHERE (p.dapur = d.nama OR p.dapur = 'Dapur ' || d.nama) AND p.dapur_id IS NULL;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 7. PENGATURAN HAK AKSES & KEAMANAN (ROW LEVEL SECURITY)
-- -----------------------------------------------------------------------------
ALTER TABLE public.toko ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pemasok ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dapur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access toko" ON public.toko;
CREATE POLICY "Public access toko" ON public.toko FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access pemasok" ON public.pemasok;
CREATE POLICY "Public access pemasok" ON public.pemasok FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access dapur" ON public.dapur;
CREATE POLICY "Public access dapur" ON public.dapur FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 8. AKTIFKAN SUPABASE REALTIME REPLICATION
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.toko, public.pemasok, public.dapur;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
