import { TextParseResult } from '../types';
import { guessStoreForItem } from './storeMatcher';

type ParsedPrice = { buy?: number; sell?: number };

const UNIT_ALIASES: Record<string, string> = {
  kg: 'Kg', kilo: 'Kg', kilogram: 'Kg',
  g: 'Gram', gr: 'Gram', gram: 'Gram',
  ons: 'Ons', pcs: 'Pcs', pc: 'Pcs', biji: 'Pcs', butir: 'Pcs', buah: 'Pcs',
  tray: 'Tray', karton: 'Karton', dus: 'Box', box: 'Box', pack: 'Pack', pak: 'Pack',
  liter: 'Liter', l: 'Liter', ltr: 'Liter', botol: 'Botol', btl: 'Botol',
  ikat: 'Ikat', ikatan: 'Ikat', karung: 'Karung', krg: 'Karung', sak: 'Karung',
};

const UNIT_PATTERN = Object.keys(UNIT_ALIASES).sort((a, b) => b.length - a.length).join('|');
const DAY_PATTERN = "(?:senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu)";

/**
 * Parser bulk yang konservatif:
 * - satu baris/blok barang = satu item;
 * - baris "Jual ..."/"Beli ..." hanya melengkapi item terakhir;
 * - baris dapur/tanggal/rumus tidak pernah menjadi nama barang;
 * - harga yang tidak disebutkan tetap 0 agar masuk Follow Up.
 */
export function parseWhatsAppText(
  text: string,
  defaultToko = 'HTG',
  defaultDapur = 'Siliragung',
  defaultPemasok = 'Ajeng fruits',
  availableStores: string[] = [],
  availableKitchens: string[] = []
): TextParseResult[] {
  if (!text || !text.trim()) return [];

  const results: TextParseResult[] = [];
  let currentDapur = defaultDapur;
  let lastItemIndex = -1;

  for (const rawLine of splitBulkLines(text)) {
    const line = cleanLine(rawLine);
    if (!line) continue;

    const context = extractKitchenContext(line, availableKitchens);
    if (context.name) currentDapur = context.name;
    if (context.isHeader) continue;

    const priceLine = extractLabeledPrices(line);
    if (priceLine.hasLabel && /^(?:beli|jual)\b/i.test(line)) {
      if (lastItemIndex >= 0) {
        const previous = results[lastItemIndex];
        if (priceLine.buy !== undefined) previous.hargaBeli = priceLine.buy;
        if (priceLine.sell !== undefined) previous.hargaJual = priceLine.sell;
      }
      continue;
    }

    if (isNoiseLine(line)) continue;
    const parsed = parseItemLine(line);
    if (!parsed) continue;

    const itemToko = guessStoreForItem(parsed.namaBarang, availableStores) || defaultToko;
    results.push({
      namaBarang: parsed.namaBarang,
      qty: parsed.qty,
      satuan: parsed.satuan,
      hargaBeli: parsed.hargaBeli,
      hargaJual: parsed.hargaJual,
      toko: itemToko,
      tujuanDapur: parsed.dapur || currentDapur,
      pemasok: defaultPemasok,
    });
    lastItemIndex = results.length - 1;
  }

  return results;
}

function splitBulkLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u200b]/g, ' ')
    .trim()
    .split('\n')
    // Toleransi untuk paste WhatsApp yang menghilangkan line break di antara label.
    .flatMap((line) => line.split(/\s+(?=(?:jual|beli)\b)/i))
    .map((line) => line.trim())
    .filter(Boolean);
}

function cleanLine(rawLine: string): string {
  return rawLine
    .replace(/^\[?\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?,?\s*\d{1,2}:\d{2}\]?\s*/i, '')
    .replace(/^\s*[\d]+[.)]\s*/, '')
    .replace(/^\s*[-*•]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKitchenContext(line: string, availableKitchens: string[]): { name: string; isHeader: boolean } {
  const lower = line.toLowerCase();
  const known = availableKitchens.find((kitchen) => {
    const name = kitchen.trim().toLowerCase();
    return name && lower.includes(name);
  });
  const hasKitchenWord = /\bdapur\b/i.test(line);
  const hasDateWord = new RegExp(`\\b${DAY_PATTERN}\\b|\\b\\d{1,2}[\\/-]\\d{1,2}(?:[\\/-]\\d{2,4})?\\b`, 'i').test(line);

  if (known) {
    const looksLikeHeader = hasKitchenWord || hasDateWord;
    return { name: known, isHeader: looksLikeHeader && !looksLikeItemWithKitchen(line, known) };
  }

  const generic = line.match(new RegExp(`\\bdapur\\s+([A-Za-z][A-Za-z0-9 ._-]*?)(?=\\s+(?:${DAY_PATTERN})\\b|\\s+\\d{1,2}[\\/-]\\d{1,2}|$)`, 'i'));
  if (generic) return { name: generic[1].trim(), isHeader: true };
  return { name: '', isHeader: false };
}

function looksLikeItemWithKitchen(line: string, kitchen: string): boolean {
  const before = line.slice(0, line.toLowerCase().indexOf(kitchen.toLowerCase())).trim();
  if (!before || /\bdapur\b/i.test(before)) return false;
  return /[A-Za-z]/.test(before);
}

function extractLabeledPrices(line: string): ParsedPrice & { hasLabel: boolean } {
  const result: ParsedPrice & { hasLabel: boolean } = { hasLabel: false };
  const buyMatch = line.match(/\bbeli\b\s*(?::|=)?\s*([^;|]+?)(?=\s+jual\b|$)/i);
  const sellMatch = line.match(/\bjual\b\s*(?::|=)?\s*([^;|]+?)(?=\s+beli\b|$)/i);
  if (buyMatch) {
    result.hasLabel = true;
    result.buy = extractUnitPrice(buyMatch[1]);
  }
  if (sellMatch) {
    result.hasLabel = true;
    result.sell = extractUnitPrice(sellMatch[1]);
  }
  return result;
}

function extractUnitPrice(value: string): number {
  const multiplication = value.match(/(?:[\d.,]+)\s*[x×*]\s*([\d.,]+)\s*(ribu|rb|k)?/i);
  if (multiplication) return parsePriceValue(`${multiplication[1]}${multiplication[2] || ''}`);
  const numbers = value.match(/(?:rp\.?\s*)?\d[\d.,]*(?:\s*(?:ribu|rb|k))?/ig);
  if (!numbers || numbers.length === 0) return 0;
  return parsePriceValue(numbers.length >= 2 ? numbers[1] : numbers[0]);
}

function parseItemLine(line: string): {
  namaBarang: string;
  qty: number;
  satuan: string;
  hargaBeli: number;
  hargaJual: number;
  dapur?: string;
} | null {
  if (/^\d[\d.,]*\s*[x×*]\s*\d[\d.,]*(?:\s*=\s*\d[\d.,]*)?$/i.test(line)) return null;

  const inlinePrices = extractLabeledPrices(line);
  let working = line;
  let hargaBeli = inlinePrices.buy || 0;
  let hargaJual = inlinePrices.sell || 0;
  if (inlinePrices.hasLabel) {
    working = working.replace(/\b(?:beli|jual)\b\s*(?::|=)?\s*[^;|]+?(?=\s+(?:beli|jual)\b|$)/ig, ' ');
  }

  const atMatch = working.match(/@\s*([^/]+?)(?:\s*\/\s*([^/]+))?(?:\s|$)/i);
  if (atMatch) {
    hargaBeli = hargaBeli || parsePriceValue(atMatch[1]);
    hargaJual = hargaJual || (atMatch[2] ? parsePriceValue(atMatch[2]) : 0);
    working = working.slice(0, atMatch.index).trim();
  }

  const kitchenMatch = working.match(/\bdapur\s+(.+?)\s*$/i);
  const dapur = kitchenMatch?.[1]?.trim();
  if (kitchenMatch) working = working.slice(0, kitchenMatch.index).trim();
  working = working.replace(/(?:=|:)\s*[\d.,]+\s*$/g, '').trim();

  let qty = 1;
  let satuan = 'Kg';
  const qtyUnit = working.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_PATTERN})\\b`, 'i'));
  if (qtyUnit) {
    qty = parseQuantity(qtyUnit[1]);
    satuan = UNIT_ALIASES[qtyUnit[2].toLowerCase()] || 'Kg';
    working = `${working.slice(0, qtyUnit.index).trim()} ${working.slice((qtyUnit.index || 0) + qtyUnit[0].length).trim()}`.trim();
  } else {
    const trailingQty = working.match(/^(.*?)(?:\s+)(\d+(?:[.,]\d+)?)$/);
    if (trailingQty && !looksLikePrice(trailingQty[2])) {
      working = trailingQty[1].trim();
      qty = parseQuantity(trailingQty[2]);
    } else {
      const leadingQty = working.match(/^(\d+(?:[.,]\d+)?)\s*[x*]\s*(.+)$/i);
      if (leadingQty) {
        qty = parseQuantity(leadingQty[1]);
        working = leadingQty[2].trim();
      }
    }
  }

  const trailingPrice = working.match(/(?:^|\s)[-:]\s*(\d[\d.,]*(?:\s*(?:ribu|rb|k))?)\s*$/i);
  if (trailingPrice) {
    hargaBeli = hargaBeli || parsePriceValue(trailingPrice[1]);
    working = working.slice(0, trailingPrice.index).trim();
  }

  const namaBarang = working
    .replace(/^[\s\-:=]+|[\s\-:=]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!namaBarang || isNoiseLine(namaBarang) || looksLikeFormula(namaBarang)) return null;
  return { namaBarang, qty: qty > 0 ? qty : 1, satuan, hargaBeli, hargaJual, dapur };
}

function isNoiseLine(line: string): boolean {
  return /^(?:jual|beli|total|jumlah|subtotal|grand total|catatan|dapur)\b/i.test(line)
    || new RegExp(`^(?:${DAY_PATTERN})\\b`, 'i').test(line)
    || /^\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/.test(line)
    || looksLikeFormula(line);
}

function looksLikeFormula(line: string): boolean {
  return /^\d[\d.,]*\s*[x×*]\s*\d[\d.,]*(?:\s*=\s*\d[\d.,]*)?$/i.test(line)
    || /^=?\s*\d[\d.,]*(?:\s*[-+]\s*\d[\d.,]*)+\s*$/i.test(line);
}

function looksLikePrice(value: string): boolean {
  return parseQuantity(value) >= 1000;
}

function parseQuantity(value: string): number {
  return Number(value.replace(',', '.')) || 0;
}

function parsePriceValue(value: string): number {
  if (!value) return 0;
  const normalized = value.toLowerCase().replace(/rp\.?/g, '').trim();
  const match = normalized.match(/^([\d.,]+)\s*(ribu|rb|k)?$/i);
  if (!match) return 0;

  let numberText = match[1];
  if (numberText.includes('.') && numberText.includes(',')) {
    numberText = numberText.replace(/\./g, '').replace(',', '.');
  } else if (match[2]) {
    numberText = numberText.replace(',', '.');
  } else {
    numberText = numberText.replace(/\./g, '').replace(',', '.');
  }

  const number = Number(numberText);
  if (!Number.isFinite(number)) return 0;
  return Math.round(match[2] ? number * 1000 : number);
}
