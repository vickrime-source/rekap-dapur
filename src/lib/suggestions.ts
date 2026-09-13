import { ITEM_SUGGESTIONS } from '../data/itemSuggestions';

export { ITEM_SUGGESTIONS };

/**
 * Autocomplete / Suggestion Engine for grocery and kitchen inventory items.
 */
export const DEFAULT_ITEM_SUGGESTIONS: string[] = ITEM_SUGGESTIONS;

/**
 * Returns matching suggestions based on user keystrokes.
 * - Case-insensitive matching.
 * - Matches if substring exists anywhere in the item name (beginning, middle, or end).
 * - Priority sorting:
 *   1. Exact match
 *   2. Starts with query at the beginning of the item name
 *   3. Starts with query at the beginning of any word (e.g., "Ikan" in "Kaki Naga Ikan" for query "ik")
 *   4. Substring match in the middle of a word (e.g., "ik" in "Keripik Tempe")
 * - Within the same tier, items are sorted by earlier match index, shorter length, and alphabetical order.
 */
export function getItemSuggestions(
  query: string,
  customItems: string[] = [],
  maxResults: number = 8
): string[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return [];

  // Combine custom existing orders/items with master ITEM_SUGGESTIONS, removing duplicates
  const combined = Array.from(new Set([...customItems, ...ITEM_SUGGESTIONS]));

  interface MatchItem {
    item: string;
    tier: number;
    matchIndex: number;
    length: number;
  }

  const matches: MatchItem[] = [];

  for (const item of combined) {
    if (!item) continue;
    const lower = item.toLowerCase();
    const matchIndex = lower.indexOf(clean);

    if (matchIndex === -1) {
      continue;
    }

    let tier = 4; // Default: match di tengah kata

    if (lower === clean) {
      tier = 1; // Cocok persis
    } else if (matchIndex === 0) {
      tier = 2; // Match di awal item
    } else {
      // Cek apakah match di awal salah satu kata (setelah spasi, dash, slash, atau tanda kurung)
      const words = lower.split(/[\s\-_/()]+/);
      const isStartOfWord = words.some((w) => w.startsWith(clean));
      if (isStartOfWord) {
        tier = 3; // Match di awal kata berikutnya
      } else {
        tier = 4; // Match di tengah kata
      }
    }

    matches.push({
      item,
      tier,
      matchIndex,
      length: item.length,
    });
  }

  // Urutkan: Tier terkecil dulu (awal kata), lalu matchIndex lebih awal, lalu item lebih ringkas, lalu alfabetis
  matches.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.matchIndex !== b.matchIndex) return a.matchIndex - b.matchIndex;
    if (a.length !== b.length) return a.length - b.length;
    return a.item.localeCompare(b.item);
  });

  return matches.slice(0, maxResults).map((m) => m.item);
}

