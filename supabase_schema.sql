-- =============================================================================
-- SKEMA DATABASE SUPABASE (POSTGRESQL) - REKAP DAPUR & KATERING
-- =============================================================================
-- Jalankan skrip ini di: Supabase Dashboard -> SQL Editor -> Run
-- =============================================================================

-- Aktifkan ekstensi pgcrypto untuk fungsi gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. TABEL MASTER: toko, pemasok, dapur
-- Master data terstruktur untuk referensi toko kita, pemasok supplier, dan dapur
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.toko (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nama TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pemasok (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nama TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dapur (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nama TEXT NOT NULL UNIQUE,
  alamat TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing Tabel Master
CREATE INDEX IF NOT EXISTS idx_toko_nama ON public.toko (nama);
CREATE INDEX IF NOT EXISTS idx_pemasok_nama ON public.pemasok (nama);
CREATE INDEX IF NOT EXISTS idx_dapur_nama ON public.dapur (nama);

-- -----------------------------------------------------------------------------
-- 2. TABEL: pesanan
-- Struktur data item pesanan bahan makanan dari dapur ke toko/pemasok
-- Menggunakan referensi FOREIGN KEY toko_id, pemasok_id, dapur_id
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pesanan (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dapur TEXT NOT NULL DEFAULT '',
  dapur_id TEXT REFERENCES public.dapur(id) ON DELETE RESTRICT,
  item TEXT NOT NULL DEFAULT '',
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  qty NUMERIC(12, 2) NOT NULL DEFAULT 1,
  satuan TEXT NOT NULL DEFAULT 'Kg',
  toko TEXT NOT NULL DEFAULT '',
  toko_id TEXT REFERENCES public.toko(id) ON DELETE RESTRICT,
  status_pembayaran TEXT NOT NULL DEFAULT 'UNPAID' CHECK (status_pembayaran IN ('UNPAID', 'PAID')),
  status_pengiriman TEXT NOT NULL DEFAULT 'PENDING' CHECK (status_pengiriman IN ('PENDING', 'DONE')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'selesai')),
  harga_jual NUMERIC(15, 2) NOT NULL DEFAULT 0,
  harga_beli NUMERIC(15, 2) NOT NULL DEFAULT 0,
  cashback NUMERIC(15, 2) NOT NULL DEFAULT 0,
  pemasok TEXT NOT NULL DEFAULT 'Pemasok 1',
  pemasok_id TEXT REFERENCES public.pemasok(id) ON DELETE RESTRICT,
  catatan TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kolom referensi jika tabel pesanan sudah pernah dibuat
ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS toko_id TEXT REFERENCES public.toko(id) ON DELETE RESTRICT;
ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS pemasok_id TEXT REFERENCES public.pemasok(id) ON DELETE RESTRICT;
ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS dapur_id TEXT REFERENCES public.dapur(id) ON DELETE RESTRICT;
ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS cashback NUMERIC(15, 2) NOT NULL DEFAULT 0;

-- Indexing untuk query cepat berdasarkan tanggal, toko, dapur, dan status
CREATE INDEX IF NOT EXISTS idx_pesanan_tanggal ON public.pesanan (tanggal);
CREATE INDEX IF NOT EXISTS idx_pesanan_toko ON public.pesanan (toko);
CREATE INDEX IF NOT EXISTS idx_pesanan_toko_id ON public.pesanan (toko_id);
CREATE INDEX IF NOT EXISTS idx_pesanan_dapur ON public.pesanan (dapur);
CREATE INDEX IF NOT EXISTS idx_pesanan_dapur_id ON public.pesanan (dapur_id);
CREATE INDEX IF NOT EXISTS idx_pesanan_pemasok ON public.pesanan (pemasok);
CREATE INDEX IF NOT EXISTS idx_pesanan_pemasok_id ON public.pesanan (pemasok_id);
CREATE INDEX IF NOT EXISTS idx_pesanan_status ON public.pesanan (status_pembayaran, status_pengiriman, status);

-- -----------------------------------------------------------------------------
-- 3. TABEL: transaksi
-- Struktur data batch transaksi / invoice rekap pesanan ke pemasok atau toko
-- Menggunakan referensi FOREIGN KEY toko_id, pemasok_id, dapur_id
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transaksi (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  invoice_number TEXT,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  tanggal_print TEXT,
  pemasok TEXT NOT NULL DEFAULT 'Pemasok 1',
  pemasok_id TEXT REFERENCES public.pemasok(id) ON DELETE RESTRICT,
  barang TEXT NOT NULL DEFAULT '',
  toko TEXT NOT NULL DEFAULT '',
  toko_id TEXT REFERENCES public.toko(id) ON DELETE RESTRICT,
  dapur TEXT NOT NULL DEFAULT '',
  dapur_id TEXT REFERENCES public.dapur(id) ON DELETE RESTRICT,
  qty NUMERIC(12, 2) NOT NULL DEFAULT 0,
  harga_beli NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_profit NUMERIC(15, 2) NOT NULL DEFAULT 0,
  status_pembayaran TEXT NOT NULL DEFAULT 'PAID',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kolom referensi jika tabel transaksi sudah pernah dibuat
ALTER TABLE public.transaksi ADD COLUMN IF NOT EXISTS toko_id TEXT REFERENCES public.toko(id) ON DELETE RESTRICT;
ALTER TABLE public.transaksi ADD COLUMN IF NOT EXISTS pemasok_id TEXT REFERENCES public.pemasok(id) ON DELETE RESTRICT;
ALTER TABLE public.transaksi ADD COLUMN IF NOT EXISTS dapur_id TEXT REFERENCES public.dapur(id) ON DELETE RESTRICT;

-- Indexing transaksi
CREATE INDEX IF NOT EXISTS idx_transaksi_tanggal ON public.transaksi (tanggal);
CREATE INDEX IF NOT EXISTS idx_transaksi_toko ON public.transaksi (toko);
CREATE INDEX IF NOT EXISTS idx_transaksi_toko_id ON public.transaksi (toko_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_pemasok ON public.transaksi (pemasok);
CREATE INDEX IF NOT EXISTS idx_transaksi_pemasok_id ON public.transaksi (pemasok_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_dapur_id ON public.transaksi (dapur_id);

-- -----------------------------------------------------------------------------
-- 4. TABEL: notes
-- Struktur data catatan/memo cepat follow up pesanan dapur
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dapur TEXT NOT NULL DEFAULT '',
  item TEXT NOT NULL DEFAULT '',
  qty NUMERIC(12, 2),
  satuan TEXT DEFAULT 'Kg',
  catatan TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'FOLLOW UP',
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  order_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing notes
CREATE INDEX IF NOT EXISTS idx_notes_dapur ON public.notes (dapur);
CREATE INDEX IF NOT EXISTS idx_notes_is_done ON public.notes (is_done);

-- -----------------------------------------------------------------------------
-- 5. DATA AWAL (SEED) & MIGRASI DATA LAMA
-- Toko (LB, HTG, LA, PW), Pemasok standar, dan Dapur-dapur lama
-- -----------------------------------------------------------------------------
INSERT INTO public.toko (nama) VALUES
  ('LB / Luweng Boga'),
  ('HTG'),
  ('LA / Lumbung Adifruta'),
  ('PW / Prohe')
ON CONFLICT (nama) DO NOTHING;

INSERT INTO public.pemasok (nama) VALUES
  ('Pemasok 1'),
  ('Pemasok 2'),
  ('Pemasok 3'),
  ('Pemasok 4')
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

-- Migrasi nama toko/pemasok/dapur dari data pesanan/transaksi yang belum terdaftar
INSERT INTO public.toko (nama)
SELECT DISTINCT TRIM(toko) FROM public.pesanan WHERE TRIM(toko) <> ''
ON CONFLICT (nama) DO NOTHING;

INSERT INTO public.pemasok (nama)
SELECT DISTINCT TRIM(pemasok) FROM public.pesanan WHERE TRIM(pemasok) <> ''
ON CONFLICT (nama) DO NOTHING;

INSERT INTO public.dapur (nama)
SELECT DISTINCT TRIM(REPLACE(dapur, 'Dapur ', '')) FROM public.pesanan WHERE TRIM(dapur) <> ''
ON CONFLICT (nama) DO NOTHING;

-- Sinkronisasi Foreign Key pada data pesanan yang sudah ada
UPDATE public.pesanan p
SET toko_id = t.id
FROM public.toko t
WHERE (p.toko = t.nama OR p.toko ILIKE '%' || t.nama || '%')
  AND p.toko_id IS NULL;

UPDATE public.pesanan p
SET pemasok_id = s.id
FROM public.pemasok s
WHERE p.pemasok = s.nama
  AND p.pemasok_id IS NULL;

UPDATE public.pesanan p
SET dapur_id = d.id
FROM public.dapur d
WHERE (p.dapur = d.nama OR p.dapur = 'Dapur ' || d.nama)
  AND p.dapur_id IS NULL;

-- Sinkronisasi Foreign Key pada data transaksi yang sudah ada
UPDATE public.transaksi tr
SET toko_id = t.id
FROM public.toko t
WHERE (tr.toko = t.nama OR tr.toko ILIKE '%' || t.nama || '%')
  AND tr.toko_id IS NULL;

UPDATE public.transaksi tr
SET pemasok_id = s.id
FROM public.pemasok s
WHERE tr.pemasok = s.nama
  AND tr.pemasok_id IS NULL;

UPDATE public.transaksi tr
SET dapur_id = d.id
FROM public.dapur d
WHERE (tr.dapur = d.nama OR tr.dapur = 'Dapur ' || d.nama)
  AND tr.dapur_id IS NULL;

-- -----------------------------------------------------------------------------
-- 6. KEAMANAN: ROW LEVEL SECURITY (RLS) & POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.toko ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pemasok ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dapur ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesanan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaksi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access toko" ON public.toko;
CREATE POLICY "Public access toko" ON public.toko FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access pemasok" ON public.pemasok;
CREATE POLICY "Public access pemasok" ON public.pemasok FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access dapur" ON public.dapur;
CREATE POLICY "Public access dapur" ON public.dapur FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access pesanan" ON public.pesanan;
CREATE POLICY "Public access pesanan" ON public.pesanan FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access transaksi" ON public.transaksi;
CREATE POLICY "Public access transaksi" ON public.transaksi FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access notes" ON public.notes;
CREATE POLICY "Public access notes" ON public.notes FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 7. FUNCTION AGREGASI DATABASE: get_period_summary
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_period_summary(
  p_period TEXT,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_result JSONB;
BEGIN
  IF p_period = 'hari_ini' THEN
    v_start_date := p_date;
    v_end_date := p_date;
  ELSIF p_period = 'mingguan' THEN
    v_start_date := date_trunc('week', p_date)::DATE;
    v_end_date := (date_trunc('week', p_date) + INTERVAL '6 days')::DATE;
  ELSIF p_period = 'bulan_ini' THEN
    v_start_date := date_trunc('month', p_date)::DATE;
    v_end_date := (date_trunc('month', p_date) + INTERVAL '1 month - 1 day')::DATE;
  ELSE
    v_start_date := '2000-01-01'::DATE;
    v_end_date := '2099-12-31'::DATE;
  END IF;

  WITH filtered_pesanan AS (
    SELECT *
    FROM public.pesanan
    WHERE tanggal >= v_start_date AND tanggal <= v_end_date
  ),
  totals AS (
    SELECT
      COALESCE(SUM(qty), 0) AS total_qty,
      COUNT(id) AS total_transactions,
      COALESCE(SUM(harga_jual * qty), 0) AS total_pendapatan,
      COALESCE(SUM(harga_beli * qty), 0) AS total_pengeluaran,
      COALESCE(SUM((harga_jual - harga_beli) * qty), 0) AS profit_bersih
    FROM filtered_pesanan
  ),
  store_agg AS (
    SELECT
      COALESCE(NULLIF(toko, ''), 'Tanpa Toko') AS toko,
      COALESCE(SUM(qty), 0) AS total_qty,
      COALESCE(SUM(harga_beli * qty), 0) AS total_beli,
      COALESCE(SUM(harga_jual * qty), 0) AS total_jual,
      COALESCE(SUM((harga_jual - harga_beli) * qty), 0) AS profit,
      COUNT(id) AS order_count,
      COUNT(id) AS transaction_count,
      ARRAY_AGG(DISTINCT pemasok) FILTER (WHERE pemasok IS NOT NULL AND pemasok <> '') AS pemasok_list
    FROM filtered_pesanan
    GROUP BY COALESCE(NULLIF(toko, ''), 'Tanpa Toko')
  )
  SELECT jsonb_build_object(
    'totalQty', (SELECT total_qty FROM totals),
    'totalTransactions', (SELECT total_transactions FROM totals),
    'totalPendapatan', (SELECT total_pendapatan FROM totals),
    'totalPengeluaran', (SELECT total_pengeluaran FROM totals),
    'profitBersih', (SELECT profit_bersih FROM totals),
    'storeBreakdowns', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'toko', s.toko,
          'totalQty', s.total_qty,
          'totalBeli', s.total_beli,
          'totalJual', s.total_jual,
          'profit', s.profit,
          'orderCount', s.order_count,
          'transactionCount', s.transaction_count,
          'pemasokList', s.pemasok_list,
          'percentageOfTotalBeli', CASE WHEN (SELECT total_pengeluaran FROM totals) > 0 THEN (s.total_beli / (SELECT total_pengeluaran FROM totals)) * 100 ELSE 0 END,
          'percentageOfTotalJual', CASE WHEN (SELECT total_pendapatan FROM totals) > 0 THEN (s.total_jual / (SELECT total_pendapatan FROM totals)) * 100 ELSE 0 END,
          'marginPercent', CASE WHEN s.total_jual > 0 THEN ROUND((s.profit / s.total_jual) * 100) ELSE 0 END
        ) ORDER BY s.total_jual DESC
      )
      FROM store_agg s
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. AKTIFKAN SUPABASE REALTIME (Hemat Bandwidth: Master Data, Pesanan, Transaksi)
-- -----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.toko, public.pemasok, public.dapur, public.pesanan, public.transaksi, public.notes;
