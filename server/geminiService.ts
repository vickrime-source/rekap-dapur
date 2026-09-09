import { GoogleGenAI, Type } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

export function getGeminiAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export interface ParsedVoiceOrderAI {
  tujuanDapur: string;
  namaBarang: string;
  qty: number;
  satuan: string;
  hargaBeli: number;
  hargaJual: number;
  toko?: string;
  pemasok?: string;
  catatan?: string;
}

export async function parseVoiceOrderWithGemini(
  transcriptText: string,
  availableKitchens: string[] = [],
  availableStores: string[] = [],
  availablePemasok: string[] = []
): Promise<ParsedVoiceOrderAI | null> {
  const ai = getGeminiAI();
  if (!ai) return null;

  const prompt = `Anda adalah asisten AI kasir dan rekap dapur bahasa Indonesia untuk warung/katering.
Tugas Anda adalah mengekstrak teks ucapan suara pemesanan barang menjadi data pesanan terstruktur JSON.

Teks ucapan suara:
"${transcriptText}"

Daftar Dapur Tersedia: ${availableKitchens.join(', ') || 'Cluring, Siliragung, Glenmore, Sempu, Pesanggaran'}
Daftar Toko Tersedia: ${availableStores.join(', ') || 'HTG, PROHE, LUWENG BOGA, ADIFRUITA'}
Daftar Pemasok Tersedia: ${availablePemasok.join(', ') || 'Pemasok 1, Pemasok 2'}

Petunjuk Penting Ekstraksi:
1. "tujuanDapur": Nama dapur tujuan jika disebutkan (misal: "dapur cluring" -> "Cluring", "siliragung" -> "Siliragung"). Jika tidak disebutkan, gunakan dapur yang paling cocok atau kosongkan.
2. "namaBarang": Nama komoditas/bahan makanan (misal: "Ayam", "Bawang Merah", "Telur", "Minyak Goreng").
3. "qty": Jumlah angka (misal: "10 kg" -> 10, "setengah kilo" -> 0.5, "2 tray" -> 2).
4. "satuan": Satuan (pilih salah satu yang sesuai: "Kg", "Gram", "Pcs", "Ikat", "Tray", "Pack", "Liter", "Box", "Ekor").
5. "hargaBeli": Harga beli (misal: "beli 30 ribu satuanya" atau "beli 30.000" atau "beli 30rb" -> 30000). Jika tidak disebutkan isi 0.
6. "hargaJual": Harga jual (misal: "jual 35 ribu" atau "jual 35.000" atau "jual 35rb" -> 35000). Jika tidak disebutkan isi 0.
7. "toko": Toko jika disebutkan (misal: "toko htg" -> "HTG").
8. "pemasok": Pemasok jika disebutkan.
9. "catatan": Catatan tambahan jika ada (misal: permintaan khusus kualitas, jam pengiriman).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tujuanDapur: { type: Type.STRING, description: 'Nama dapur tujuan' },
            namaBarang: { type: Type.STRING, description: 'Nama barang atau bahan makanan' },
            qty: { type: Type.NUMBER, description: 'Jumlah kuantitas angka' },
            satuan: { type: Type.STRING, description: 'Satuan ukuran (Kg, Pcs, Tray, dsb)' },
            hargaBeli: { type: Type.NUMBER, description: 'Harga beli dalam rupiah' },
            hargaJual: { type: Type.NUMBER, description: 'Harga jual dalam rupiah' },
            toko: { type: Type.STRING, description: 'Nama toko atau brand kita' },
            pemasok: { type: Type.STRING, description: 'Nama pemasok atau supplier' },
            catatan: { type: Type.STRING, description: 'Catatan tambahan' },
          },
          required: ['namaBarang', 'qty', 'satuan', 'hargaBeli', 'hargaJual'],
        },
      },
    });

    const jsonText = response.text?.trim();
    if (!jsonText) return null;

    const data = JSON.parse(jsonText) as ParsedVoiceOrderAI;
    return {
      tujuanDapur: data.tujuanDapur || '',
      namaBarang: data.namaBarang || 'Ayam',
      qty: Number(data.qty) || 1,
      satuan: data.satuan || 'Kg',
      hargaBeli: Number(data.hargaBeli) || 0,
      hargaJual: Number(data.hargaJual) || 0,
      toko: data.toko || '',
      pemasok: data.pemasok || '',
      catatan: data.catatan || '',
    };
  } catch (err) {
    console.warn('[Gemini Voice Order Parser Error]:', err);
    return null;
  }
}
