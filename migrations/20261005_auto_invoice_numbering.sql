-- =============================================================================
-- MIGRASI SISTEM PENOMORAN INVOICE OTOMATIS (GLOBAL PER TAHUN)
-- Format: PREFIX/SEQ/ROMAWI/TAHUN (Contoh: PH/1/X/2026, LA/2/X/2026, LB/20/XI/2026)
-- =============================================================================

-- 1. Tambah kolom kode_invoice pada tabel public.toko
ALTER TABLE public.toko ADD COLUMN IF NOT EXISTS kode_invoice TEXT;

-- Update pemetaan kode resmi 4 toko
UPDATE public.toko SET kode_invoice = 'LA' WHERE nama ILIKE '%lumbung%' OR nama ILIKE '%adifru%' OR nama ILIKE '%adifra%' OR nama = 'LA';
UPDATE public.toko SET kode_invoice = 'LB' WHERE nama ILIKE '%luweng%' OR nama ILIKE '%boga%' OR nama = 'LB';
UPDATE public.toko SET kode_invoice = 'PH' WHERE nama ILIKE '%prohe%' OR nama ILIKE '%pw%' OR nama = 'PW' OR nama = 'PH';
UPDATE public.toko SET kode_invoice = 'HTG' WHERE nama ILIKE '%handai%' OR nama ILIKE '%htg%' OR nama = 'HTG';

-- 2. Tambah kolom invoice_number pada tabel pesanan
ALTER TABLE public.pesanan ADD COLUMN IF NOT EXISTS invoice_number TEXT;
CREATE INDEX IF NOT EXISTS idx_pesanan_invoice_number ON public.pesanan (invoice_number);

-- 3. Tabel counter global per tahun
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  tahun INT PRIMARY KEY,
  last_seq INT NOT NULL DEFAULT 0
);

-- 4. Tabel penyimpanan nomor invoice (1 nota_id = 1 nomor)
CREATE TABLE IF NOT EXISTS public.invoice_numbers (
  nota_id TEXT PRIMARY KEY,
  tahun_seq INT NOT NULL,
  seq INT NOT NULL,
  toko_id TEXT NOT NULL,
  nomor TEXT NOT NULL,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  diubah_pada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_invoice_tahun_seq UNIQUE (tahun_seq, seq)
);

CREATE INDEX IF NOT EXISTS idx_invoice_numbers_nomor ON public.invoice_numbers (nomor);
CREATE INDEX IF NOT EXISTS idx_invoice_numbers_toko_id ON public.invoice_numbers (toko_id);

-- 5. Tabel log audit perubahan nomor invoice
CREATE TABLE IF NOT EXISTS public.invoice_number_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waktu TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_info TEXT DEFAULT 'system',
  nota_id TEXT NOT NULL,
  nomor_lama TEXT NOT NULL,
  nomor_baru TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_number_log_nota_id ON public.invoice_number_log (nota_id);

-- 6. Fungsi RPC Atomik: Generate atau Ambil Nomor Invoice
CREATE OR REPLACE FUNCTION public.generate_or_get_invoice_number(
  p_nota_id TEXT,
  p_toko_id TEXT,
  p_tanggal DATE,
  p_user_info TEXT DEFAULT 'system'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tahun INT;
  v_bulan INT;
  v_romawi TEXT;
  v_romawi_arr TEXT[] := ARRAY['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  v_prefix TEXT;
  v_seq INT;
  v_nomor_baru TEXT;
  v_existing RECORD;
BEGIN
  -- Validasi Toko & Prefix (wajib ada, tidak ada default prefix)
  SELECT kode_invoice INTO v_prefix FROM public.toko WHERE id::text = p_toko_id;
  IF v_prefix IS NULL OR trim(v_prefix) = '' THEN
    RAISE EXCEPTION 'Toko tidak valid atau kode_invoice belum diatur untuk toko_id: %', p_toko_id;
  END IF;

  v_tahun := EXTRACT(YEAR FROM p_tanggal)::INT;
  v_bulan := EXTRACT(MONTH FROM p_tanggal)::INT;
  v_romawi := v_romawi_arr[v_bulan];

  -- Cek apakah nota_id sudah memiliki nomor
  SELECT * INTO v_existing FROM public.invoice_numbers WHERE nota_id = p_nota_id;

  IF FOUND THEN
    -- Kasus A: Tahun sama -> SEQ TETAP, Prefix & Bulan Romawi disesuaikan
    IF v_existing.tahun_seq = v_tahun THEN
      v_nomor_baru := v_prefix || '/' || v_existing.seq || '/' || v_romawi || '/' || v_tahun;
      
      IF v_existing.nomor <> v_nomor_baru THEN
        UPDATE public.invoice_numbers
        SET toko_id = p_toko_id,
            nomor = v_nomor_baru,
            diubah_pada = NOW()
        WHERE nota_id = p_nota_id;

        INSERT INTO public.invoice_number_log (nota_id, nomor_lama, nomor_baru, user_info)
        VALUES (p_nota_id, v_existing.nomor, v_nomor_baru, p_user_info);
      END IF;

      RETURN jsonb_build_object(
        'nomor', v_nomor_baru,
        'seq', v_existing.seq,
        'tahun', v_tahun,
        'is_new', false
      );
    ELSE
      -- Kasus B: Tahun berubah -> SEQ BARU dari urutan tahun baru, SEQ lama hangus
      INSERT INTO public.invoice_counters (tahun, last_seq)
      VALUES (v_tahun, 1)
      ON CONFLICT (tahun) DO UPDATE 
        SET last_seq = invoice_counters.last_seq + 1 
      RETURNING last_seq INTO v_seq;

      v_nomor_baru := v_prefix || '/' || v_seq || '/' || v_romawi || '/' || v_tahun;

      UPDATE public.invoice_numbers
      SET tahun_seq = v_tahun,
          seq = v_seq,
          toko_id = p_toko_id,
          nomor = v_nomor_baru,
          diubah_pada = NOW()
      WHERE nota_id = p_nota_id;

      INSERT INTO public.invoice_number_log (nota_id, nomor_lama, nomor_baru, user_info)
      VALUES (p_nota_id, v_existing.nomor, v_nomor_baru, p_user_info);

      RETURN jsonb_build_object(
        'nomor', v_nomor_baru,
        'seq', v_seq,
        'tahun', v_tahun,
        'is_new', true
      );
    END IF;
  ELSE
    -- Kasus C: Pesanan Baru -> Ambil SEQ baru atomik
    INSERT INTO public.invoice_counters (tahun, last_seq)
    VALUES (v_tahun, 1)
    ON CONFLICT (tahun) DO UPDATE 
      SET last_seq = invoice_counters.last_seq + 1 
    RETURNING last_seq INTO v_seq;

    v_nomor_baru := v_prefix || '/' || v_seq || '/' || v_romawi || '/' || v_tahun;

    INSERT INTO public.invoice_numbers (nota_id, tahun_seq, seq, toko_id, nomor)
    VALUES (p_nota_id, v_tahun, v_seq, p_toko_id, v_nomor_baru);

    RETURN jsonb_build_object(
      'nomor', v_nomor_baru,
      'seq', v_seq,
      'tahun', v_tahun,
      'is_new', true
    );
  END IF;
END;
$$;

-- 7. Atur RLS: Hanya service role / server yang bisa memanggil atau mengubah tabel counter & nomor
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_number_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.invoice_counters FROM anon, authenticated;
REVOKE ALL ON public.invoice_numbers FROM anon, authenticated;
REVOKE ALL ON public.invoice_number_log FROM anon, authenticated;
