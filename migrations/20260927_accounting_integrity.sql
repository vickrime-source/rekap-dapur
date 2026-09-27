-- Aman dijalankan setelah audit data. Tidak menghapus atau mengubah data lama.
-- Constraint dibuat NOT VALID agar baris historis yang sudah ada tidak terblokir.
-- Baris baru dan baris yang diedit tetap wajib mengikuti aturan ini.

ALTER TABLE public.pesanan
  ALTER COLUMN pemasok SET DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pesanan_qty_nonnegative_check'
  ) THEN
    ALTER TABLE public.pesanan
      ADD CONSTRAINT pesanan_qty_nonnegative_check
      CHECK (qty >= 0 AND COALESCE(qty_beli, 0) >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pesanan_retur_valid_check'
  ) THEN
    ALTER TABLE public.pesanan
      ADD CONSTRAINT pesanan_retur_valid_check
      CHECK (
        retur >= 0
        AND retur <= qty
        AND (qty_beli IS NULL OR retur <= qty_beli)
      ) NOT VALID;
  END IF;
END $$;

-- Jalankan setelah data lama dibersihkan dan lolos audit:
-- ALTER TABLE public.pesanan VALIDATE CONSTRAINT pesanan_qty_nonnegative_check;
-- ALTER TABLE public.pesanan VALIDATE CONSTRAINT pesanan_retur_valid_check;
