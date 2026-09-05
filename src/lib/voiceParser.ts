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
  tujuanDapur?: string;
  catatan?: string;
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
  'tray': 'Tray',
  'trey': 'Tray',
  'pcs': 'Pcs',
  'pc': 'Pcs',
  'buah': 'Pcs',
  'biji': 'Pcs',
  'butir': 'Pcs',
  'pack': 'Pack',
  'pak': 'Pack',
  'bungkus': 'Pack',
  'bks': 'Pack',
  'liter': 'Liter',
  'ltr': 'Liter',
  'box': 'Box',
  'dus': 'Box',
  'kardus': 'Box',
  'karung': 'Karung',
  'sak': 'Karung',
  'ekor': 'Ekor',
  'botol': 'Botol',
  'btl': 'Botol',
  'kaleng': 'Kaleng',
  'porsi': 'Porsi',
  'lembar': 'Lembar',
  'sisir': 'Sisir',
};

// Capitalize title
export function capitalizeWords(str: string): string {
  if (!str) return '';
  return str
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function parseVoiceInput(
  transcript: string,
  availableKitchens: Array<{ id: string; nama: string }> = []
): ParsedVoiceNote {
  const rawTranscript = transcript.trim();
  let text = rawTranscript.toLowerCase();

  let detectedKitchen: string | undefined = undefined;

  // 1. Check if kitchen is mentioned (e.g. "dapur siliragung" or "untuk siliragung" or just "siliragung")
  for (const k of availableKitchens) {
    const kName = k.nama.toLowerCase();
    const patterns = [
      new RegExp(`\\bdapur\\s+${kName}\\b`, 'i'),
      new RegExp(`\\bke\\s+dapur\\s+${kName}\\b`, 'i'),
      new RegExp(`\\buntuk\\s+dapur\\s+${kName}\\b`, 'i'),
      new RegExp(`\\buntuk\\s+${kName}\\b`, 'i'),
      new RegExp(`\\b${kName}\\b`, 'i'),
    ];

    for (const pat of patterns) {
      if (pat.test(text)) {
        detectedKitchen = k.nama;
        text = text.replace(pat, ' ').trim();
        break;
      }
    }
    if (detectedKitchen) break;
  }

  // Normalize multi-word numbers: "satu setengah" -> "1.5", "dua setengah" -> "2.5"
  text = text.replace(/\bsatu\s+setengah\b/g, '1.5');
  text = text.replace(/\bdua\s+setengah\b/g, '2.5');
  text = text.replace(/\btiga\s+setengah\b/g, '3.5');
  text = text.replace(/\bempat\s+setengah\b/g, '4.5');
  text = text.replace(/\blima\s+setengah\b/g, '5.5');

  // Replace Indonesian single word numbers
  for (const [word, num] of Object.entries(INDO_NUMBER_WORDS)) {
    const reg = new RegExp(`\\b${word}\\b`, 'g');
    text = text.replace(reg, num.toString());
  }

  let qty = 1;
  let satuan = 'Kg';
  let namaBarang = '';
  let catatan = '';

  // 2. Pattern A: Number + Unit
  // e.g. "ayam 4 kg", "tomat 2.5 kilo", "telur 5 tray", "bayam 10 ikat"
  const unitKeys = Object.keys(UNIT_MAPPING).sort((a, b) => b.length - a.length).join('|');
  const qtyUnitRegex = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${unitKeys})\\b`, 'i');

  const match = text.match(qtyUnitRegex);

  if (match) {
    const rawQty = match[1].replace(',', '.');
    qty = parseFloat(rawQty) || 1;
    const rawUnit = match[2].toLowerCase();
    satuan = UNIT_MAPPING[rawUnit] || 'Kg';

    // The text before the match is usually the item name
    const matchIndex = match.index || 0;
    const beforeText = text.substring(0, matchIndex).trim();
    const afterText = text.substring(matchIndex + match[0].length).trim();

    namaBarang = beforeText;
    catatan = afterText;

    // If item name was empty before (e.g. "4 kg ayam"), check afterText
    if (!namaBarang && afterText) {
      namaBarang = afterText;
      catatan = '';
    }
  } else {
    // 3. Pattern B: Just number without explicit unit (e.g. "ayam 4")
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
      satuan = 'Kg'; // default fallback for kitchen items
    } else {
      // 4. No numbers found, entire text is item or note
      namaBarang = text;
      qty = 1;
      satuan = 'Kg';
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
    tujuanDapur: detectedKitchen,
    catatan,
  };
}
