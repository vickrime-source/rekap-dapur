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
});
