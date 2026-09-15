-- ============================================================================
-- MIGRATION: Tambah kolom catatan ke tabel transaksi di Supabase
-- Tanggal: 2026-09-14
-- Deskripsi: Menambahkan kolom catatan untuk menyimpan keterangan transaksi
-- ============================================================================

ALTER TABLE public.transaksi 
ADD COLUMN IF NOT EXISTS catatan TEXT DEFAULT '';

-- Tambahkan komentar dokumentasi kolom
COMMENT ON COLUMN public.transaksi.catatan IS 'Catatan transaksi atau keterangan tambahan dari order';
