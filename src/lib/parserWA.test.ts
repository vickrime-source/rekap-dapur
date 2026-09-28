import { describe, expect, it } from 'vitest';
import { parseWhatsAppText } from './parserWA';

describe('parseWhatsAppText', () => {
  it('memecah laporan WhatsApp menjadi item dan mengambil harga unit dari rumus jual/beli', () => {
    const input = `
      1050000 dapur Sambimulyo minggu 27/9
      ayam 2
      Jual 330×36500 = 12045000
      Beli 330×35500 = 11715000
      fe 330000 dapur Patoman minggu 27/9
      muscat 2
      Jual 25×220000 = 5500000
      Beli 25×190000 = 4750000
    `;

    const result = parseWhatsAppText(input, 'HTG', 'Siliragung', 'Ajeng', [], ['Sambimulyo', 'Patoman']);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ namaBarang: 'ayam', qty: 2, hargaJual: 36500, hargaBeli: 35500, tujuanDapur: 'Sambimulyo' });
    expect(result[1]).toMatchObject({ namaBarang: 'muscat', qty: 2, hargaJual: 220000, hargaBeli: 190000, tujuanDapur: 'Patoman' });
    expect(result.every((item) => !item.namaBarang.includes('Jual') && !item.namaBarang.includes('Beli'))).toBe(true);
  });

  it('mendukung format satu baris dan membiarkan harga yang tidak disebutkan kosong', () => {
    const result = parseWhatsAppText(
      '1. Beras Premium 5 kg @ 14000 / 16500\n2. Telur 2 tray beli 370000',
      'HTG',
      'Siliragung',
      'Ajeng',
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ namaBarang: 'Beras Premium', qty: 5, satuan: 'Kg', hargaBeli: 14000, hargaJual: 16500 });
    expect(result[1]).toMatchObject({ namaBarang: 'Telur', qty: 2, satuan: 'Tray', hargaBeli: 370000, hargaJual: 0 });
  });

  it('membaca format laporan asli dengan nama barang menempel setelah total jual', () => {
    const result = parseWhatsAppText(
      `Pesanan Dapur 27-1 Oktober 26
Dapur Siliragung
Senin 28/9
1. Jual 8x420.000 = 3.360.000klengkeng biru
2. Beli 8x400.000 = 3.200.000
Dapur Tamanagung
Senin 28/9
1. Jual 15x425.000 = 6.375.000klengkeng biru
2. Beli 14x400.000 = 5.600.000`,
      'HTG',
      'Siliragung',
      'Ajeng',
      [],
      ['Siliragung', 'Tamanagung'],
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ namaBarang: 'klengkeng biru', qty: 8, qtyBeli: 8, hargaJual: 420000, hargaBeli: 400000, tanggal: '2026-09-28' });
    expect(result[1]).toMatchObject({ namaBarang: 'klengkeng biru', qty: 15, qtyBeli: 14, hargaJual: 425000, hargaBeli: 400000, tanggal: '2026-09-28' });
  });

  it('tidak mengarang dapur atau pemasok ketika konteks tidak ada di sumber', () => {
    const result = parseWhatsAppText(
      'Senin 28/9\nJual 5x10000 = 50000 tomat\nBeli 5x7000 = 35000',
      'HTG',
      '',
      '',
      [],
      [],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      namaBarang: 'tomat',
      tanggal: '2026-09-28',
      tujuanDapur: '',
      pemasok: '',
    });
  });

  it('hanya mengisi toko jika kode toko tertulis di sumber', () => {
    const result = parseWhatsAppText(
      'Dapur Singojuruh\nMinggu 27/9\nLA\nJual 2x10000 = 20000 apel\nBeli 2x7000 = 14000',
      '',
      '',
      '',
      ['HTG', 'LA / Lumbung Adifruta'],
      ['Singojuruh'],
    );

    expect(result[0]).toMatchObject({ toko: 'LA / Lumbung Adifruta' });
  });
});
