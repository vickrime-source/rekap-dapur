import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateOrGetLocalInvoiceNumber,
  loadDb,
  saveDb,
} from './localDbFallback';
import { getRomanMonth, formatInvoiceNumber } from '../src/lib/formatters';

describe('Sistem Penomoran Invoice Otomatis (Global Per Tahun: PREFIX/SEQ/ROMAWI/TAHUN)', () => {
  beforeEach(() => {
    // Reset counters and logs before each test
    const db = loadDb();
    db.invoice_counters = {};
    db.invoice_numbers = [];
    db.invoice_number_log = [];
    saveDb();
  });

  // 1. 12 bulan romawi benar
  it('1. Memetakan 12 bulan romawi dengan benar (1=I, 2=II, ... 12=XII)', () => {
    const expected = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    for (let m = 1; m <= 12; m++) {
      expect(getRomanMonth(m)).toBe(expected[m - 1]);
    }
  });

  // 2. Pesanan dari 4 toko berbeda berurutan: SEQ global naik 1,2,3,4 lintas toko
  it('2. Satu urutan SEQ global per tahun dipakai bersama semua toko (1, 2, 3, 4)', () => {
    const res1 = generateOrGetLocalInvoiceNumber('nota-1', 'toko-lb', '2026-10-05');
    expect(res1.nomor).toBe('LB/1/X/2026');
    expect(res1.seq).toBe(1);

    const res2 = generateOrGetLocalInvoiceNumber('nota-2', 'toko-htg', '2026-10-05');
    expect(res2.nomor).toBe('HTG/2/X/2026');
    expect(res2.seq).toBe(2);

    const res3 = generateOrGetLocalInvoiceNumber('nota-3', 'toko-la', '2026-10-06');
    expect(res3.nomor).toBe('LA/3/X/2026');
    expect(res3.seq).toBe(3);

    const res4 = generateOrGetLocalInvoiceNumber('nota-4', 'toko-pw', '2026-10-07');
    expect(res4.nomor).toBe('PH/4/X/2026');
    expect(res4.seq).toBe(4);
  });

  // 3. Idempotensi: client_id / nota_id dikirim dua kali: nomor sama, counter tidak naik dua kali
  it('3. Idempotensi: nota_id yang sama menghasilkan nomor yang sama persis tanpa menaikkan counter', () => {
    const res1 = generateOrGetLocalInvoiceNumber('nota-idempotent-1', 'toko-pw', '2026-10-05');
    expect(res1.nomor).toBe('PH/1/X/2026');
    expect(res1.seq).toBe(1);
    expect(res1.is_new).toBe(true);

    // Request kedua dengan nota_id yang sama
    const res2 = generateOrGetLocalInvoiceNumber('nota-idempotent-1', 'toko-pw', '2026-10-05');
    expect(res2.nomor).toBe('PH/1/X/2026');
    expect(res2.seq).toBe(1);
    expect(res2.is_new).toBe(false);

    // Counter tahun tetap 1
    const db = loadDb();
    expect(db.invoice_counters['2026']).toBe(1);
  });

  // 4. Dua request simpan bersamaan (atomik, tidak ada SEQ kembar)
  it('4. Permintaan konkuren/bersamaan mendapatkan nomor unik tanpa SEQ kembar', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      Promise.resolve().then(() =>
        generateOrGetLocalInvoiceNumber(`nota-concurrent-${i}`, 'toko-htg', '2026-10-05')
      )
    );

    const results = await Promise.all(promises);
    const seqs = results.map((r) => r.seq);
    const uniqueSeqs = new Set(seqs);

    expect(uniqueSeqs.size).toBe(10);
    expect(seqs.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  // 5. Pergantian tahun: tanggal 31 Des 2026 lalu 1 Jan 2027 -> 2027 mulai dari 1
  it('5. Tahun baru mereset counter mulai dari 1 lagi', () => {
    const res2026 = generateOrGetLocalInvoiceNumber('nota-des-2026', 'toko-lb', '2026-12-31');
    expect(res2026.nomor).toBe('LB/1/XII/2026');
    expect(res2026.seq).toBe(1);

    const res2027 = generateOrGetLocalInvoiceNumber('nota-jan-2027', 'toko-lb', '2027-01-01');
    expect(res2027.nomor).toBe('LB/1/I/2027');
    expect(res2027.seq).toBe(1);
  });

  // 6. Toko tak dikenal / toko_id tidak valid: ditolak
  it('6. Menolak penyimpanan dan tidak membuat nomor jika toko_id tidak dikenal/tidak valid', () => {
    expect(() => {
      generateOrGetLocalInvoiceNumber('nota-invalid-toko', 'toko-tidak-ada', '2026-10-05');
    }).toThrow(/Toko tidak valid atau kode_invoice belum diatur/);

    expect(() => {
      generateOrGetLocalInvoiceNumber('nota-invalid-empty', '', '2026-10-05');
    }).toThrow(/Toko tidak valid atau kode_invoice belum diatur/);

    // Counter tidak boleh bertambah
    const db = loadDb();
    expect(db.invoice_counters['2026']).toBeUndefined();
  });

  // 7. Edit tanggal beda bulan: hanya romawi berubah, SEQ tetap
  it('7. Edit tanggal dalam tahun yang sama: hanya romawi berubah, SEQ TETAP', () => {
    const initial = generateOrGetLocalInvoiceNumber('nota-edit-bulan', 'toko-pw', '2026-10-05');
    expect(initial.nomor).toBe('PH/1/X/2026');
    expect(initial.seq).toBe(1);

    // Edit ke November 2026
    const updatedNov = generateOrGetLocalInvoiceNumber('nota-edit-bulan', 'toko-pw', '2026-11-12');
    expect(updatedNov.nomor).toBe('PH/1/XI/2026');
    expect(updatedNov.seq).toBe(1);
    expect(updatedNov.is_new).toBe(false);

    // Edit balik ke Oktober 2026
    const updatedOct = generateOrGetLocalInvoiceNumber('nota-edit-bulan', 'toko-pw', '2026-10-20');
    expect(updatedOct.nomor).toBe('PH/1/X/2026');
    expect(updatedOct.seq).toBe(1);
  });

  // 8. Edit toko: hanya prefix berubah, SEQ tetap
  it('8. Edit toko: hanya prefix berubah, SEQ TETAP', () => {
    const initial = generateOrGetLocalInvoiceNumber('nota-edit-toko', 'toko-pw', '2026-10-05');
    expect(initial.nomor).toBe('PH/1/X/2026');
    expect(initial.seq).toBe(1);

    // Ganti toko ke LA
    const updatedStore = generateOrGetLocalInvoiceNumber('nota-edit-toko', 'toko-la', '2026-10-05');
    expect(updatedStore.nomor).toBe('LA/1/X/2026');
    expect(updatedStore.seq).toBe(1);
    expect(updatedStore.is_new).toBe(false);
  });

  // 9. Edit tanggal beda tahun: SEQ baru, SEQ lama hangus, log tercatat
  it('9. Edit tanggal ganti tahun: mengambil SEQ baru dari urutan tahun baru dan mencatat ke audit log', () => {
    const initial = generateOrGetLocalInvoiceNumber('nota-edit-tahun', 'toko-htg', '2026-10-05');
    expect(initial.nomor).toBe('HTG/1/X/2026');
    expect(initial.seq).toBe(1);

    // Edit ke tahun 2027
    const updatedYear = generateOrGetLocalInvoiceNumber('nota-edit-tahun', 'toko-htg', '2027-02-10', 'admin-user');
    expect(updatedYear.nomor).toBe('HTG/1/II/2027');
    expect(updatedYear.seq).toBe(1);
    expect(updatedYear.tahun).toBe(2027);

    // Audit log harus mencatat perubahan
    const db = loadDb();
    const log = db.invoice_number_log.find((l: any) => l.nota_id === 'nota-edit-tahun');
    expect(log).toBeDefined();
    expect(log.nomor_lama).toBe('HTG/1/X/2026');
    expect(log.nomor_baru).toBe('HTG/1/II/2027');
    expect(log.user_info).toBe('admin-user');
  });

  // 10. Duplikasi pesanan: dapat nomor baru
  it('10. Duplikasi pesanan membuat nota_id baru sehingga mendapatkan nomor invoice baru', () => {
    const original = generateOrGetLocalInvoiceNumber('nota-original', 'toko-lb', '2026-10-05');
    expect(original.nomor).toBe('LB/1/X/2026');

    // Duplikasi = nota_id baru
    const duplicated = generateOrGetLocalInvoiceNumber('nota-duplicated', 'toko-lb', '2026-10-05');
    expect(duplicated.nomor).toBe('LB/2/X/2026');
    expect(duplicated.seq).toBe(2);
  });

  // 11. Konversi catatan Follow Up: dapat nomor baru
  it('11. Konversi catatan Follow Up ke pesanan membuat nota_id baru dan mendapatkan nomor invoice', () => {
    const converted = generateOrGetLocalInvoiceNumber('nota-from-note-1', 'toko-la', '2026-10-05');
    expect(converted.nomor).toBe('LA/1/X/2026');
    expect(converted.seq).toBe(1);
  });

  // 12. Cetak ulang nota original dan cashback: nomor sama persis, counter tidak naik
  it('12. Cetak ulang nota original dan cashback membaca nomor yang tersimpan, counter tidak naik', () => {
    const res = generateOrGetLocalInvoiceNumber('nota-print-1', 'toko-pw', '2026-10-05');
    expect(res.nomor).toBe('PH/1/X/2026');

    // Cetak versi Original
    const readOri = generateOrGetLocalInvoiceNumber('nota-print-1', 'toko-pw', '2026-10-05');
    expect(readOri.nomor).toBe('PH/1/X/2026');

    // Cetak versi Cashback
    const readCashback = generateOrGetLocalInvoiceNumber('nota-print-1', 'toko-pw', '2026-10-05');
    expect(readCashback.nomor).toBe('PH/1/X/2026');

    // Counter tidak bertambah
    const db = loadDb();
    expect(db.invoice_counters['2026']).toBe(1);
  });

  // 13. Nomor hangus tidak pernah dipakai ulang
  it('13. SEQ lama yang hangus setelah ganti tahun tidak pernah dipakai ulang oleh pesanan berikutnya', () => {
    // 2026: nota-A dapat seq 1
    generateOrGetLocalInvoiceNumber('nota-A', 'toko-htg', '2026-10-05');
    // 2026: nota-B dapat seq 2
    generateOrGetLocalInvoiceNumber('nota-B', 'toko-htg', '2026-10-05');

    // nota-A diganti tanggal ke 2027
    generateOrGetLocalInvoiceNumber('nota-A', 'toko-htg', '2027-01-05');

    // Buat pesanan baru di 2026: counter tetap maju, tidak mundur ke seq 1 yang ditinggalkan nota-A
    const notaC = generateOrGetLocalInvoiceNumber('nota-C', 'toko-htg', '2026-10-05');
    expect(notaC.seq).toBe(3);
    expect(notaC.nomor).toBe('HTG/3/X/2026');
  });
});
