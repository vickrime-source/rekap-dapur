-- =============================================================================
-- MIGRATION: Phase A Data Integrity & Consistency
-- Menambahkan kolom retur, qty_beli, dan nota_id ke tabel pesanan
-- =============================================================================

-- 1. Tambah kolom retur (default 0)
ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS retur NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- 2. Tambah kolom qty_beli (default sama dengan qty untuk data eksisting)
ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS qty_beli NUMERIC(12, 2);

-- 3. Tambah kolom nota_id untuk grouping nota per batch pesanan
ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS nota_id TEXT;

-- 4. Indeks untuk query grouping berdasarkan nota_id
CREATE INDEX IF NOT EXISTS idx_pesanan_nota_id ON public.pesanan (nota_id);
