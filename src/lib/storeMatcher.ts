/**
 * Store Identity Matcher
 * 
 * Rules based on store specialties:
 * 1. UD Prohe Wangi (PW / Prohe):
 *    Spesialis pasokan protein hewani & seafood (ikan, lele, nila, gurame, patin, tongkol, cumi, udang, seafood, dll).
 * 2. UD Luweng Boga (LB / Luweng Boga):
 *    Fokus pada produk protein olahan, karbohidrat pokok & sayuran kemasan (telur asin, lontong, mix vegetable / sayuran campur).
 * 3. UD Lumbung Adifruta (LA / Lumbung Adifruta):
 *    Dominan komoditas pertanian segar, terutama buah-buahan (Apel, Jeruk Siem Madu, Jambu Citra, Klengkeng, Semangka, Anggur, Melon, Pisang Ambon)
 *    dan sayuran segar (Sawi, Kubis, Bawang Pre, Seledri, Jagung Manis, Kacang Panjang, Putren, Wortel, Toge, Edamame).
 * 4. CV. Handai Tolan Group (HTG):
 *    Variasi luas: buah segar (Jeruk Siem, Semangka, Anggur, Leci, Klengkeng), sayuran (Wortel, Sawi, Buncis, Labu Siam, Bawang, Kacang),
 *    serta produk pangan olahan (burger, krupuk udang, lontong, daging sapi, daging ayam).
 */

export type StoreCode = 'PW' | 'LB' | 'LA' | 'HTG';

interface StoreIdentityRule {
  code: StoreCode;
  nameKeywords: string[];
  exactKeywords: string[];
  partialKeywords: string[];
}

const STORE_RULES: StoreIdentityRule[] = [
  // 1. UD Prohe Wangi: Protein Hewani & Seafood Prioritas
  {
    code: 'PW',
    nameKeywords: ['prohe', 'pw', 'wangi'],
    exactKeywords: [
      'ikan', 'udang', 'cumi', 'seafood', 'lele', 'nila', 'gurame', 'tongkol',
      'patin', 'kakap', 'bandeng', 'kembung', 'daging', 'tetelan', 'prohe'
    ],
    partialKeywords: [
      'ikan ', 'ikan', 'lele', 'gurame', 'nila', 'tongkol', 'patin', 'kakap',
      'bandeng', 'kembung', 'cumi', 'udang', 'seafood', 'daging sapi', 'tetelan',
      'fillet', 'prohe'
    ],
  },

  // 2. UD Luweng Boga: Telur Asin, Lontong, Mix Vegetable
  {
    code: 'LB',
    nameKeywords: ['luweng', 'lb', 'boga'],
    exactKeywords: [
      'telur asin', 'lontong', 'mix vegetable', 'sayur campur', 'sayuran campur',
      'sayur beku', 'frozen veg', 'karbohidrat'
    ],
    partialKeywords: [
      'telur asin', 'lontong', 'mix vegetable', 'sayuran campur', 'sayur campur',
      'sayuran kemasan', 'frozen vegetable'
    ],
  },

  // 3. UD Lumbung Adifruta: Buah-buahan segar & Sayuran hijau segar tertentu
  {
    code: 'LA',
    nameKeywords: ['lumbung', 'la', 'adifruta'],
    exactKeywords: [
      'apel', 'apel fuji', 'apel malang', 'jeruk siem madu', 'jeruk madu', 'jambu citra',
      'jambu', 'melon', 'pisang ambon', 'pisang', 'bawang pre', 'bawang daun', 'seledri',
      'jagung manis', 'jagung', 'kacang panjang', 'putren', 'toge', 'tauge', 'edamame',
      'kubis', 'kol'
    ],
    partialKeywords: [
      'apel', 'jeruk siem madu', 'jeruk madu', 'jambu citra', 'jambu', 'melon',
      'pisang ambon', 'pisang', 'bawang pre', 'prei', 'seledri', 'jagung manis',
      'putren', 'toge', 'tauge', 'edamame', 'kubis', 'kacang panjang'
    ],
  },

  // 4. CV. Handai Tolan Group: Variasi produk luas, buah, sayur, pangan olahan
  {
    code: 'HTG',
    nameKeywords: ['htg', 'handai', 'tolan'],
    exactKeywords: [
      'jeruk siem', 'semangka', 'anggur', 'leci', 'klengkeng', 'wortel', 'sawi',
      'buncis', 'labu siam', 'bawang merah', 'bawang putih', 'bawang bombay',
      'kacang', 'burger', 'krupuk udang', 'kerupuk', 'ayam'
    ],
    partialKeywords: [
      'jeruk siem', 'semangka', 'anggur', 'leci', 'klengkeng', 'wortel', 'buncis',
      'labu siam', 'bawang merah', 'bawang putih', 'bawang bombay', 'burger',
      'krupuk', 'kerupuk'
    ],
  },
];

/**
 * Mendeteksi nama toko yang paling sesuai berdasarkan nama item yang diinput.
 * 
 * @param itemName Nama barang yang diketik oleh user (contoh: "ikan lele", "telur asin")
 * @param availableStores Daftar nama toko yang aktif di sistem (contoh: ["HTG", "LA / Lumbung Adifruta", "LB / Luweng Boga", "PW / Prohe"])
 * @returns Nama toko yang cocok dari availableStores, atau undefined jika tidak ada preferensi kuat.
 */
export function guessStoreForItem(itemName: string, availableStores: string[]): string | undefined {
  if (!itemName || !itemName.trim() || !availableStores || availableStores.length === 0) {
    return undefined;
  }

  const cleanItem = itemName.trim().toLowerCase();

  // Helper untuk mencari toko yang cocok dengan store code
  const findStoreByCode = (code: StoreCode): string | undefined => {
    const rule = STORE_RULES.find((r) => r.code === code);
    if (!rule) return undefined;

    return availableStores.find((storeName) => {
      const s = storeName.toLowerCase();
      return rule.nameKeywords.some((kw) => {
        // Cek prefix atau kata utuh (misal: "PW / Prohe" -> "pw" atau "prohe")
        return s.includes(kw);
      });
    });
  };

  // 1. Check rule UD Prohe Wangi (Protein hewani & seafood)
  // Contoh eksplisit user: "misal user ketik ikan otomatis > prohe"
  const isPW = STORE_RULES[0].exactKeywords.includes(cleanItem) ||
    STORE_RULES[0].partialKeywords.some((kw) => cleanItem.includes(kw));

  if (isPW) {
    const matched = findStoreByCode('PW');
    if (matched) return matched;
  }

  // 2. Check rule UD Luweng Boga (Telur asin, lontong, mix vegetable)
  const isLB = STORE_RULES[1].exactKeywords.includes(cleanItem) ||
    STORE_RULES[1].partialKeywords.some((kw) => cleanItem.includes(kw));

  if (isLB) {
    const matched = findStoreByCode('LB');
    if (matched) return matched;
  }

  // 3. Check rule UD Lumbung Adifruta (Apel, Jambu citra, Jeruk madu, Seledri, Putren, Toge, dll)
  const isLA = STORE_RULES[2].exactKeywords.includes(cleanItem) ||
    STORE_RULES[2].partialKeywords.some((kw) => cleanItem.includes(kw));

  if (isLA) {
    const matched = findStoreByCode('LA');
    if (matched) return matched;
  }

  // 4. Check rule CV. Handai Tolan Group (HTG)
  const isHTG = STORE_RULES[3].exactKeywords.includes(cleanItem) ||
    STORE_RULES[3].partialKeywords.some((kw) => cleanItem.includes(kw));

  if (isHTG) {
    const matched = findStoreByCode('HTG');
    if (matched) return matched;
  }

  return undefined;
}
