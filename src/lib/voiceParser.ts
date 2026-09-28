/**
 * Indonesian Voice Note Parser for Rekap Dapur Pro
 * Parses spoken input such as:
 * - "ayam 4 kg" -> namaBarang: "Ayam", qty: 4, satuan: "Kg"
 * - "bawang merah 2 kilo dapur siliragung" -> namaBarang: "Bawang Merah", qty: 2, satuan: "Kg", dapur: "Siliragung"
 * - "telur ayam 5 tray tolong yang bagus" -> namaBarang: "Telur Ayam", qty: 5, satuan: "Tray", catatan: "tolong yang bagus"
 * - "tomat satu setengah kg" -> namaBarang: "Tomat", qty: 1.5, satuan: "Kg"
 */

export interface ParsedVoiceNote {
  rawTranscript: string;
  namaBarang: string;
  qty: number;
  satuan: string;
  hargaBeli?: number;
  hargaJual?: number;
  tujuanDapur?: string;
  toko?: string;
  pemasok?: string;
  catatan?: string;
}

export type VoiceIntent = 'CREATE_NOTE' | 'CREATE_ORDER' | 'EDIT_ORDER';

export interface SmartVoiceResult {
  intent: VoiceIntent;
  missingFields?: string[];
  // Note:
  noteText?: string;
  noteDapur?: string;
  // Order:
  namaBarang?: string;
  qty?: number;
  satuan?: string;
  hargaBeli?: number;
  hargaJual?: number;
  tujuanDapur?: string;
  toko?: string;
  pemasok?: string;
  catatan?: string;
  // Edit Order:
  targetBarang?: string;
  targetDapur?: string;
  newQty?: number;
  newSatuan?: string;
  newHargaBeli?: number;
  newHargaJual?: number;
  newNamaBarang?: string;
  rawTranscript: string;
}

function normalizeContextText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function findExplicitMasterValue(input: string, values: string[]): string {
  const normalizedInput = normalizeContextText(input);
  return values.find((value) => {
    const normalizedValue = normalizeContextText(value);
    return normalizedValue.length > 0 && normalizedInput.includes(normalizedValue);
  }) || '';
}

/**
 * Gemini boleh membantu membaca angka dan nama barang, tetapi konteks master
 * tidak boleh diisi dari tebakan. Dapur/toko/pemasok hanya dipertahankan jika
 * nama tersebut benar-benar tertulis di sumber input.
 */
export function keepOnlyExplicitMasterContext(
  parsed: SmartVoiceResult,
  input: string,
  kitchens: string[] = [],
  stores: string[] = [],
  pemasokList: string[] = [],
): SmartVoiceResult {
  return {
    ...parsed,
    noteDapur: findExplicitMasterValue(input, kitchens),
    tujuanDapur: findExplicitMasterValue(input, kitchens),
    targetDapur: findExplicitMasterValue(input, kitchens) || undefined,
    toko: findExplicitMasterValue(input, stores),
    pemasok: findExplicitMasterValue(input, pemasokList),
  };
}

const INDO_NUMBER_WORDS: Record<string, number> = {
  'setengah': 0.5,
  'seperempat': 0.25,
  'satu': 1,
  'sebuah': 1,
  'seekor': 1,
  'seikat': 1,
  'sebungkus': 1,
  'dua': 2,
  'tiga': 3,
  'empat': 4,
  'lima': 5,
  'enam': 6,
  'tujuh': 7,
  'delapan': 8,
  'sembilan': 9,
  'sepuluh': 10,
  'sebelas': 11,
  'dua belas': 12,
  'tiga belas': 13,
  'empat belas': 14,
  'lima belas': 15,
  'dua puluh': 20,
  'dua puluh lima': 25,
  'tiga puluh': 30,
  'lima puluh': 50,
  'seratus': 100,
};

const UNIT_MAPPING: Record<string, string> = {
  'kg': 'Kg',
  'kilo': 'Kg',
  'kilogram': 'Kg',
  'g': 'Gram',
  'gr': 'Gram',
  'gram': 'Gram',
  'ons': 'Ons',
  'ikat': 'Ikat',
  'bungkus': 'Pcs',
  'bks': 'Pcs',
  'pcs': 'Pcs',
  'biji': 'Pcs',
  'buah': 'Pcs',
  'butir': 'Pcs',
  'potong': 'Pcs',
  'ekor': 'Pcs',
  'tray': 'Tray',
  'keranjang': 'Keranjang',
  'kotak': 'Box',
  'box': 'Box',
  'karung': 'Karung',
  'sak': 'Karung',
  'pack': 'Pack',
  'pak': 'Pack',
  'dus': 'Box',
  'liter': 'Liter',
  'ltr': 'Liter',
  'btl': 'Botol',
  'botol': 'Botol',
  'sisir': 'Sisir',
};

function capitalizeWords(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Parse price string like "30 ribu", "30rb", "30.000", "25 k" into number 30000
 */
function parsePriceFromIndonesian(text: string): number {
  if (!text) return 0;
  const clean = text.toLowerCase().trim();
  
  const ribuMatch = clean.match(/([\d.,]+)\s*(ribu|rb|k)/i);
  if (ribuMatch) {
    const base = parseFloat(ribuMatch[1].replace(/\./g, '').replace(',', '.'));
    return Math.round(base * 1000);
  }

  const rawNum = clean.replace(/[^\d]/g, '');
  return parseInt(rawNum, 10) || 0;
}

export function parseVoiceInput(
  rawTranscript: string,
  availableKitchens: Array<{ id?: string; nama: string }> = [],
  availableStores: Array<{ id?: string; nama: string }> = [],
  availablePemasok: string[] = []
): ParsedVoiceNote {
  if (!rawTranscript || typeof rawTranscript !== 'string') {
    return {
      rawTranscript: '',
      namaBarang: 'Pesanan Baru',
      qty: 1,
      satuan: 'Kg',
    };
  }

  let text = rawTranscript.toLowerCase().trim();

  // 1. Detect Kitchen
  let detectedKitchen = '';
  for (const k of availableKitchens) {
    const kName = k.nama.toLowerCase();
    const regex = new RegExp(`\\b(dapur\\s+)?${kName}\\b`, 'i');
    if (regex.test(text)) {
      detectedKitchen = k.nama;
      text = text.replace(regex, ' ').trim();
      break;
    }
  }

  // 2. Detect Store
  let detectedStore = '';
  for (const s of availableStores) {
    const sName = s.nama.toLowerCase();
    const regex = new RegExp(`\\b(toko\\s+)?${sName}\\b`, 'i');
    if (regex.test(text)) {
      detectedStore = s.nama;
      text = text.replace(regex, ' ').trim();
      break;
    }
  }

  // 3. Detect Pemasok
  let detectedPemasok = '';
  for (const p of availablePemasok) {
    const pName = p.toLowerCase();
    const regex = new RegExp(`\\b(pemasok\\s+|supplier\\s+)?${pName}\\b`, 'i');
    if (regex.test(text)) {
      detectedPemasok = p;
      text = text.replace(regex, ' ').trim();
      break;
    }
  }

  // 4. Detect Buying and Selling Prices
  let detectedHargaBeli = 0;
  let detectedHargaJual = 0;

  const beliRegex = /(?:beli|harga\s*beli|kulak|kulakan)\s*(?:sebesar|nya|satuan|satuannya)?\s*([\d.,]+\s*(?:ribu|rb|k|\d{3,}))/i;
  const beliMatch = text.match(beliRegex);
  if (beliMatch) {
    detectedHargaBeli = parsePriceFromIndonesian(beliMatch[1]);
    text = text.replace(beliMatch[0], ' ').trim();
  }

  const jualRegex = /(?:jual|harga\s*jual)\s*(?:sebesar|nya|satuan|satuannya)?\s*([\d.,]+\s*(?:ribu|rb|k|\d{3,}))/i;
  const jualMatch = text.match(jualRegex);
  if (jualMatch) {
    detectedHargaJual = parsePriceFromIndonesian(jualMatch[1]);
    text = text.replace(jualMatch[0], ' ').trim();
  }

  // 5. Detect Quantity & Unit
  let qty = 1;
  let satuan = 'Kg';
  let namaBarang = '';
  let catatan = '';

  const unitsPattern = Object.keys(UNIT_MAPPING).sort((a, b) => b.length - a.length).join('|');
  const qtyUnitRegex = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${unitsPattern})\\b`, 'i');
  const match = text.match(qtyUnitRegex);

  if (match) {
    const rawQty = match[1].replace(',', '.');
    qty = parseFloat(rawQty) || 1;
    satuan = UNIT_MAPPING[match[2].toLowerCase()] || 'Kg';

    const matchIndex = match.index || 0;
    const beforeText = text.substring(0, matchIndex).trim();
    const afterText = text.substring(matchIndex + match[0].length).trim();

    namaBarang = beforeText || afterText;
    if (beforeText && afterText) {
      catatan = afterText;
    }
  } else {
    // Number word + Unit (e.g. "dua kg")
    const wordsPattern = Object.keys(INDO_NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|');
    const wordUnitRegex = new RegExp(`(${wordsPattern})\\s*(${unitsPattern})\\b`, 'i');
    const wordMatch = text.match(wordUnitRegex);

    if (wordMatch) {
      qty = INDO_NUMBER_WORDS[wordMatch[1].toLowerCase()] || 1;
      satuan = UNIT_MAPPING[wordMatch[2].toLowerCase()] || 'Kg';

      const matchIndex = wordMatch.index || 0;
      const beforeText = text.substring(0, matchIndex).trim();
      const afterText = text.substring(matchIndex + wordMatch[0].length).trim();

      namaBarang = beforeText || afterText;
      if (beforeText && afterText) {
        catatan = afterText;
      }
    } else {
      const justNumberRegex = /(\d+(?:[.,]\d+)?)/;
      const numMatch = text.match(justNumberRegex);

      if (numMatch) {
        const rawQty = numMatch[1].replace(',', '.');
        qty = parseFloat(rawQty) || 1;
        const numIndex = numMatch.index || 0;
        const beforeText = text.substring(0, numIndex).trim();
        const afterText = text.substring(numIndex + numMatch[0].length).trim();

        namaBarang = beforeText || afterText;
        if (beforeText && afterText) {
          catatan = afterText;
        }
        satuan = 'Kg';
      } else {
        namaBarang = text;
        qty = 1;
        satuan = 'Kg';
      }
    }
  }

  // Clean up punctuation and stop words
  namaBarang = namaBarang
    .replace(/^(pesan|beli|order|tolong|minta|catat|tambah|tambahkan|note)\s+/i, '')
    .replace(/[.,;:]/g, '')
    .trim();

  catatan = catatan
    .replace(/^[.,;:\s-]+/, '')
    .trim();

  if (!catatan) {
    catatan = rawTranscript;
  }

  return {
    rawTranscript,
    namaBarang: capitalizeWords(namaBarang),
    qty: Math.max(0.1, qty),
    satuan,
    hargaBeli: detectedHargaBeli,
    hargaJual: detectedHargaJual,
    tujuanDapur: detectedKitchen,
    toko: detectedStore,
    pemasok: detectedPemasok,
    catatan,
  };
}

export function parseVoiceOrderSmart(
  transcript: string,
  availableKitchens: Array<{ id?: string; nama: string }> = [],
  availableStores: Array<{ id?: string; nama: string }> = [],
  availablePemasok: string[] = []
) {
  const parsed = parseVoiceInput(transcript, availableKitchens, availableStores, availablePemasok);

  return {
    rawTranscript: parsed.rawTranscript,
    namaBarang: parsed.namaBarang || '',
    qty: parsed.qty,
    satuan: parsed.satuan,
    hargaBeli: parsed.hargaBeli,
    hargaJual: parsed.hargaJual,
    tujuanDapur: parsed.tujuanDapur || '',
    toko: parsed.toko || '',
    pemasok: parsed.pemasok || '',
    catatan: parsed.catatan,
  };
}

/**
 * Universal Intent-Aware Voice Assistant Parser (handles Note, Order, and Edit Order)
 */
export function parseVoiceAssistantSmart(
  transcript: string,
  availableKitchens: Array<{ id?: string; nama: string }> = [],
  availableStores: Array<{ id?: string; nama: string }> = [],
  availablePemasok: string[] = []
): SmartVoiceResult {
  const clean = transcript.trim();
  const lower = clean.toLowerCase();

  // 1. Intent: CREATE_NOTE ("buat notes..", "catat..", "note..", "tulis catatan..")
  const noteRegex = /^(?:buat\s+(?:notes|note|catatan)|catat|tulis\s+(?:catatan|note)|note)\b/i;
  if (noteRegex.test(lower)) {
    let noteText = clean.replace(noteRegex, '').replace(/^[:\s-]+/, '').trim();
    if (!noteText) noteText = clean;

    // Detect kitchen in note if mentioned
    let detectedDapur = '';
    for (const k of availableKitchens) {
      if (new RegExp(`\\b${k.nama}\\b`, 'i').test(noteText)) {
        detectedDapur = k.nama;
        break;
      }
    }

    return {
      intent: 'CREATE_NOTE',
      noteText: capitalizeWords(noteText),
      noteDapur: detectedDapur,
      rawTranscript: transcript,
    };
  }

  // 2. Intent: EDIT_ORDER ("edit harga/item/kg/", "ubah..", "ganti..", "koreksi..")
  const editRegex = /^(?:edit|ubah|ganti|koreksi|revisi)\b/i;
  if (editRegex.test(lower)) {
    const afterEdit = clean.replace(editRegex, '').trim();

    // Check if editing price: e.g. "edit harga ayam jadi 32 ribu"
    const priceEditMatch = afterEdit.match(/(?:harga\s*(?:beli|jual)?\s*)?([a-zA-Z\s]+?)\s*(?:jadi|menjadi|=)\s*([\d.,]+\s*(?:ribu|rb|k|\d{3,}))/i);
    const isBeli = /harga\s*beli|kulak/i.test(afterEdit);
    const isJual = /harga\s*jual/i.test(afterEdit);

    if (priceEditMatch) {
      const targetBarang = priceEditMatch[1].replace(/harga\s*(?:beli|jual)?/i, '').trim();
      const newPrice = parsePriceFromIndonesian(priceEditMatch[2]);
      return {
        intent: 'EDIT_ORDER',
        targetBarang: capitalizeWords(targetBarang),
        newHargaBeli: isBeli ? newPrice : undefined,
        newHargaJual: isJual || !isBeli ? newPrice : undefined,
        rawTranscript: transcript,
      };
    }

    // Check if editing qty: e.g. "ganti qty ayam jadi 15 kg"
    const qtyEditMatch = afterEdit.match(/(?:qty\s*|jumlah\s*)?([a-zA-Z\s]+?)\s*(?:jadi|menjadi|=)\s*(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?/i);
    if (qtyEditMatch) {
      const targetBarang = qtyEditMatch[1].replace(/(?:qty|jumlah)/i, '').trim();
      const newQty = parseFloat(qtyEditMatch[2].replace(',', '.')) || 1;
      const newSatuan = qtyEditMatch[3] ? UNIT_MAPPING[qtyEditMatch[3].toLowerCase()] || 'Kg' : undefined;
      return {
        intent: 'EDIT_ORDER',
        targetBarang: capitalizeWords(targetBarang),
        newQty,
        newSatuan,
        rawTranscript: transcript,
      };
    }

    // Generic edit fallback
    return {
      intent: 'EDIT_ORDER',
      targetBarang: capitalizeWords(afterEdit),
      rawTranscript: transcript,
    };
  }

  // 3. Default Intent: CREATE_ORDER ("buat pesan..", "ayam 10 kg..", "pesan..")
  const orderData = parseVoiceOrderSmart(transcript, availableKitchens, availableStores, availablePemasok);
  return {
    intent: 'CREATE_ORDER',
    ...orderData,
  };
}
