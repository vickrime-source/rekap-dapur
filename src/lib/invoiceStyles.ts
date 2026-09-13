export interface StoreInvoiceStyleConfig {
  storeKey: 'HTG' | 'PROHE' | 'LUWENG_BOGA' | 'LUMBUNG_ADIFRUTA';
  fontFamily: string;
  headerBg: string;
  headerText: string;
  layoutSwap: boolean; // false: bank kiri & ttd kanan; true: bank kanan & ttd kiri
}

export const STORE_INVOICE_CONFIGS: Record<'HTG' | 'PROHE' | 'LUWENG_BOGA' | 'LUMBUNG_ADIFRUTA', StoreInvoiceStyleConfig> = {
  // HTG: TETAP seperti sekarang (baseline, minim perubahan) — font Arial, warna header tabel tetap, info bank TETAP DI KIRI (jangan ditukar), tanda tangan tetap di kanan.
  HTG: {
    storeKey: 'HTG',
    fontFamily: 'Arial, Helvetica, sans-serif',
    headerBg: '#d9e2f3',
    headerText: '#000000',
    layoutSwap: false,
  },

  // PROHE: font Calibri. Warna header tabel jadi hijau muda pucat (#E8F5E9 dengan teks #2E7D32). Layout tetap sama seperti HTG (bank kiri, ttd kanan) — bedanya cukup di font & warna.
  PROHE: {
    storeKey: 'PROHE',
    fontFamily: 'Calibri, Candara, "Segoe UI", Arial, sans-serif',
    headerBg: '#E8F5E9',
    headerText: '#2E7D32',
    layoutSwap: false,
  },

  // LB (Luweng Boga): font Times New Roman. Warna header tabel hijau tua pucat (#E0F2E9 dengan teks #1B5E3F). LAYOUT DITUKAR: info pembayaran/bank pindah ke KANAN, tanda tangan "Hormat Kami" pindah ke KIRI.
  LUWENG_BOGA: {
    storeKey: 'LUWENG_BOGA',
    fontFamily: '"Times New Roman", Times, Georgia, serif',
    headerBg: '#E0F2E9',
    headerText: '#1B5E3F',
    layoutSwap: true,
  },

  // LA (Lumbung Adifruta): font Georgia. Warna header tabel biru abu pucat (#ECEFF1 dengan teks #37474F). LAYOUT DITUKAR: info pembayaran/bank pindah ke KANAN, tanda tangan "Hormat Kami" pindah ke KIRI.
  LUMBUNG_ADIFRUTA: {
    storeKey: 'LUMBUNG_ADIFRUTA',
    fontFamily: 'Georgia, "Times New Roman", serif',
    headerBg: '#ECEFF1',
    headerText: '#37474F',
    layoutSwap: true,
  },
};

/**
 * Resolves the styling configuration for a given store name/alias.
 * Supported aliases:
 * - HTG: "HTG", "CV. HANDAI TOLAN GROUP", "HANDAI TOLAN", etc.
 * - PROHE: "PROHE", "UD PROHE WANGI", "PW", "PROHE WANGI", etc.
 * - LB: "LUWENG BOGA", "LB", "UD LUWENG BOGA", etc.
 * - LA: "LUMBUNG ADIFRUTA", "LA", "ADIFRUITA", "ADIFRUTA", "UD LUMBUNG ADIFRUTA", etc.
 */
export function getStoreInvoiceConfig(storeName?: string): StoreInvoiceStyleConfig {
  const norm = (storeName || '').trim().toUpperCase();

  if (
    norm.includes('LUWENG') ||
    norm.includes('LEMBUNG') ||
    norm.includes('BOGA') ||
    norm === 'LB' ||
    norm.startsWith('LB ') ||
    norm.endsWith(' LB')
  ) {
    return STORE_INVOICE_CONFIGS.LUWENG_BOGA;
  }

  if (
    norm.includes('PROHE') ||
    norm === 'PW' ||
    norm.startsWith('PW ') ||
    norm.endsWith(' PW') ||
    norm.includes('WANGI')
  ) {
    return STORE_INVOICE_CONFIGS.PROHE;
  }

  if (
    norm.includes('ADIFRUTA') ||
    norm.includes('ADIFRUITA') ||
    norm.includes('ADIFR') ||
    norm.includes('FRUITA') ||
    norm.includes('FRUTA') ||
    norm === 'LA' ||
    norm.startsWith('LA ') ||
    norm.endsWith(' LA') ||
    norm.includes('LUMBUNG')
  ) {
    return STORE_INVOICE_CONFIGS.LUMBUNG_ADIFRUTA;
  }

  // Default to HTG baseline
  return STORE_INVOICE_CONFIGS.HTG;
}
