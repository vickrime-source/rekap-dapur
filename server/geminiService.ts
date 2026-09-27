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

export type VoiceIntent = 'CREATE_NOTE' | 'CREATE_ORDER' | 'EDIT_ORDER';

export interface VoiceAssistantResult {
  intent: VoiceIntent;
  missingFields?: string[];
  // If CREATE_NOTE:
  noteText?: string;
  noteDapur?: string;
  
  // If CREATE_ORDER:
  tujuanDapur?: string;
  namaBarang?: string;
  qty?: number;
  satuan?: string;
  hargaBeli?: number;
  hargaJual?: number;
  toko?: string;
  pemasok?: string;
  catatan?: string;

  // If EDIT_ORDER:
  targetBarang?: string;
  targetDapur?: string;
  newQty?: number;
  newSatuan?: string;
  newHargaBeli?: number;
  newHargaJual?: number;
  newNamaBarang?: string;
}

export async function parseVoiceOrderWithGemini(
  transcriptText: string,
  availableKitchens: string[] = [],
  availableStores: string[] = [],
  availablePemasok: string[] = []
): Promise<VoiceAssistantResult | null> {
  const ai = getGeminiAI();
  if (!ai) return null;

  const prompt = `Anda adalah asisten AI kasir dan rekap dapur bahasa Indonesia untuk warung/katering.
Tugas Anda adalah memahami perintah suara pengguna dan menentukan INTENT serta mengekstrak datanya:

Teks ucapan suara pengguna:
"${transcriptText}"

Daftar Dapur Tersedia: ${availableKitchens.join(', ') || 'Cluring, Siliragung, Glenmore, Sempu, Pesanggaran'}
Daftar Toko Tersedia: ${availableStores.join(', ') || 'HTG, PROHE, LUWENG BOGA, ADIFRUITA'}
Daftar Pemasok Tersedia: ${availablePemasok.join(', ') || 'Ajeng fruits, Sari buah, PMB'}

KLASIFIKASI INTENT:
1. "CREATE_NOTE": Jika pengguna mengatakan "buat notes...", "catat...", "tulis catatan...", "note...", atau memberikan instruksi memo/pengingat/follow up.
   Contoh: "buat notes tolong cek stok ayam besok pagi", "catat jangan lupa konfirmasi toko HTG".
   Ekstrak:
   - "noteText": Isi lengkap catatan yang dimaksud.
   - "noteDapur": Nama dapur jika disebutkan.

2. "CREATE_ORDER": Jika pengguna mengatakan "buat pesan...", "pesan...", "tambah pesanan...", atau langsung menyebut pesanan komoditas seperti "ayam 10 kg", "dapur cluring telur 5 tray beli 30rb jual 35rb".
   Ekstrak:
   - "tujuanDapur": Nama dapur tujuan.
   - "namaBarang": Nama komoditas makanan (misal: "Ayam", "Bawang Merah", "Telur").
   - "qty": Angka kuantitas (misal 10, 0.5, 2).
   - "satuan": Satuan (misal: "Kg", "Gram", "Pcs", "Tray", "Pack", "Liter", "Ikat").
   - "hargaBeli": Angka harga beli dalam rupiah. Jika tidak disebutkan, jangan mengarang nilai.
   - "hargaJual": Angka harga jual dalam rupiah. Jika tidak disebutkan, jangan mengarang nilai.
   - "toko": Nama toko kita jika ada.
   - "pemasok": Nama supplier jika ada.
   - "catatan": Catatan pesanan jika ada.
   - Jangan mengarang dapur, qty, harga, pemasok, atau barang yang tidak disebutkan.
   - Jika data CREATE_ORDER belum lengkap, tetap kembalikan intent CREATE_ORDER dan isi hanya field yang benar-benar ditemukan.

3. "EDIT_ORDER": Jika pengguna mengatakan "edit harga/item/kg...", "ubah...", "ganti qty...", "koreksi harga...", "revisi...".
   Contoh: "edit harga ayam jadi 32 ribu", "ganti qty ayam dapur cluring jadi 15 kg", "ubah harga beli jadi 28 ribu".
   Ekstrak:
   - "targetBarang": Nama komoditas yang ingin diedit (misal: "Ayam").
   - "targetDapur": Nama dapur yang bersangkutan jika ada.
   - "newQty": Kuantitas baru jika diubah.
   - "newSatuan": Satuan baru jika diubah.
   - "newHargaBeli": Harga beli baru jika diubah.
   - "newHargaJual": Harga jual baru jika diubah.
   - "newNamaBarang": Nama barang baru jika diubah.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: {
              type: Type.STRING,
              enum: ['CREATE_NOTE', 'CREATE_ORDER', 'EDIT_ORDER'],
              description: 'Intent dari ucapan pengguna',
            },
            noteText: { type: Type.STRING, description: 'Isi catatan jika intent CREATE_NOTE' },
            noteDapur: { type: Type.STRING, description: 'Dapur tujuan catatan jika ada' },
            tujuanDapur: { type: Type.STRING, description: 'Nama dapur tujuan' },
            namaBarang: { type: Type.STRING, description: 'Nama barang atau bahan makanan' },
            qty: { type: Type.NUMBER, description: 'Jumlah kuantitas angka' },
            satuan: { type: Type.STRING, description: 'Satuan ukuran (Kg, Pcs, Tray, dsb)' },
            hargaBeli: { type: Type.NUMBER, description: 'Harga beli dalam rupiah' },
            hargaJual: { type: Type.NUMBER, description: 'Harga jual dalam rupiah' },
            toko: { type: Type.STRING, description: 'Nama toko atau brand kita' },
            pemasok: { type: Type.STRING, description: 'Nama pemasok atau supplier' },
            catatan: { type: Type.STRING, description: 'Catatan tambahan' },
            targetBarang: { type: Type.STRING, description: 'Nama komoditas target edit' },
            targetDapur: { type: Type.STRING, description: 'Nama dapur target edit' },
            newQty: { type: Type.NUMBER, description: 'Qty baru' },
            newSatuan: { type: Type.STRING, description: 'Satuan baru' },
            newHargaBeli: { type: Type.NUMBER, description: 'Harga beli baru' },
            newHargaJual: { type: Type.NUMBER, description: 'Harga jual baru' },
            newNamaBarang: { type: Type.STRING, description: 'Nama barang baru' },
          },
          required: ['intent'],
        },
      },
    });

    const jsonText = response.text?.trim();
    if (!jsonText) return null;

    const data = JSON.parse(jsonText) as VoiceAssistantResult;
    return {
      intent: data.intent || 'CREATE_ORDER',
      noteText: data.noteText,
      noteDapur: data.noteDapur,
      tujuanDapur: data.tujuanDapur || '',
      namaBarang: data.namaBarang || '',
      qty: data.qty !== undefined ? Number(data.qty) : undefined,
      satuan: data.satuan || undefined,
      hargaBeli: data.hargaBeli !== undefined ? Number(data.hargaBeli) : undefined,
      hargaJual: data.hargaJual !== undefined ? Number(data.hargaJual) : undefined,
      toko: data.toko || '',
      pemasok: data.pemasok || '',
      catatan: data.catatan || '',
      targetBarang: data.targetBarang,
      targetDapur: data.targetDapur,
      newQty: data.newQty ? Number(data.newQty) : undefined,
      newSatuan: data.newSatuan,
      newHargaBeli: data.newHargaBeli ? Number(data.newHargaBeli) : undefined,
      newHargaJual: data.newHargaJual ? Number(data.newHargaJual) : undefined,
      newNamaBarang: data.newNamaBarang,
    };
  } catch (err) {
    console.warn('[Gemini Voice Assistant Parser Error]:', err);
    return null;
  }
}
