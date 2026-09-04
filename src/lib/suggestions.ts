/**
 * Autocomplete / Suggestion Engine for grocery and kitchen inventory items.
 */

export const DEFAULT_ITEM_SUGGESTIONS: string[] = [
  'Ikan',
  'Ikan Lele',
  'Ikan Gurame',
  'Ikan Nila',
  'Ikan Kembung',
  'Ikan Tongkol',
  'Ikan Patin',
  'Ikan Bandeng',
  'Apel',
  'Apel Fuji',
  'Apel Malang',
  'Alpukat',
  'Ayam Potong',
  'Ayam Fillet',
  'Ayam Kampung',
  'Ayam Broiler',
  'Bayam',
  'Beras',
  'Beras Pandan Wangi',
  'Beras Setra Ramos',
  'Bawang Merah',
  'Bawang Putih',
  'Bawang Bombay',
  'Cabai Rawit',
  'Cabai Merah',
  'Cabai Hijau',
  'Cabai Keriting',
  'Daging Sapi',
  'Daging Kambing',
  'Daging Ayam',
  'Telur Ayam',
  'Telur Bebek',
  'Telur Puyuh',
  'Tomat',
  'Terong',
  'Tahu Putih',
  'Tahu Kuning',
  'Tempe',
  'Wortel',
  'Kentang',
  'Kobis / Kol',
  'Sawi Putih',
  'Sawi Hijau',
  'Kangkung',
  'Buncis',
  'Kacang Panjang',
  'Labu Siam',
  'Minyak Goreng',
  'Gula Pasir',
  'Garam Halus',
  'Kecap Manis',
  'Saus Tiram',
  'Tepung Terigu',
  'Tepung Beras',
  'Tepung Tapioka',
  'Yali 80',
  'Semangka',
  'Melon',
  'Jeruk Manis',
  'Pisang',
  'Pepaya',
  'Susu UHT',
  'Susu Kental Manis',
  'Keju Cheddar',
  'Mentega',
];

/**
 * Returns matching suggestions based on user keystrokes.
 * Case-insensitive, matches prefix or substring.
 */
export function getItemSuggestions(
  query: string,
  customItems: string[] = [],
  maxResults: number = 6
): string[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return [];

  const combined = Array.from(new Set([...customItems, ...DEFAULT_ITEM_SUGGESTIONS]));

  // Prefix matches first, then contains matches
  const prefixMatches: string[] = [];
  const otherMatches: string[] = [];

  for (const item of combined) {
    const lower = item.toLowerCase();
    if (lower.startsWith(clean)) {
      prefixMatches.push(item);
    } else if (lower.includes(clean)) {
      otherMatches.push(item);
    }
  }

  return [...prefixMatches, ...otherMatches].slice(0, maxResults);
}
