import { TextParseResult } from '../types';

const UNITS: Record<string, string> = {
  kg: 'Kg', kilo: 'Kg', kilogram: 'Kg', gram: 'Gram', gr: 'Gram', g: 'Gram',
  ons: 'Ons', pcs: 'Pcs', pc: 'Pcs', biji: 'Pcs', buah: 'Pcs', butir: 'Pcs',
  tray: 'Tray', karton: 'Karton', dus: 'Box', box: 'Box', pack: 'Pack', pak: 'Pack',
  liter: 'Liter', l: 'Liter', ltr: 'Liter', botol: 'Botol', btl: 'Botol',
  ikat: 'Ikat', ikatan: 'Ikat', karung: 'Karung', krg: 'Karung', sak: 'Karung',
};
const UNIT_PATTERN = Object.keys(UNITS).sort((a, b) => b.length - a.length).join('|');
const DAYS = '(?:senin|selasa|rabu|kamis|jumat|jum\'at|sabtu|minggu)';

type Formula = {
  jenis: 'jual' | 'beli';
  qty?: number;
  hargaSatuan?: number;
  namaBarang: string;
};

/**
 * Membaca format laporan dapur yang sebenarnya:
 * Jual 8x420.000 = 3.360.000klengkeng biru
 * Beli 8x400.000 = 3.200.000
 * fie 8x20.000 = 160.000
 *
 * Jual membuat item. Beli melengkapi item jual terdekat, termasuk qty beli
 * yang boleh berbeda. Fie, total, tanggal, dan header tidak pernah menjadi item.
 */
export function parseWhatsAppText(
  text: string,
  defaultToko = '',
  defaultDapur = '',
  defaultPemasok = '',
  availableStores: string[] = [],
  availableKitchens: string[] = [],
): TextParseResult[] {
  if (!text || !text.trim()) return [];

  const results: TextParseResult[] = [];
  const pendingBuyIndexes: number[] = [];
  const defaultYear = detectReportYear(text) || new Date().getFullYear();
  let currentDapur = defaultDapur;
  let currentToko = defaultToko;
  let currentDate = '';
  let lastItemIndex = -1;

  for (const raw of splitLines(text)) {
    const line = cleanLine(raw);
    if (!line) continue;

    const dapur = parseDapurHeader(line);
    if (dapur) {
      currentDapur = dapur;
      const dateInHeader = parseDate(line, defaultYear);
      if (dateInHeader) currentDate = dateInHeader;
      lastItemIndex = -1;
      pendingBuyIndexes.length = 0;
      continue;
    }

    const toko = parseTokoHeader(line, availableStores);
    if (toko) {
      currentToko = toko;
      continue;
    }

    const dateInLine = parseDate(line, defaultYear);
    if (dateInLine) {
      currentDate = dateInLine;
      if (!/\b(?:jual|beli)\b/i.test(line)) continue;
    }

    const formula = parseFormulaLine(line);
    if (formula) {
      if (formula.jenis === 'jual' && formula.namaBarang) {
        const parsed: TextParseResult = {
          namaBarang: formula.namaBarang,
          qty: formula.qty || 1,
          hargaBeli: 0,
          hargaJual: formula.hargaSatuan || 0,
          toko: currentToko,
          tujuanDapur: currentDapur,
          pemasok: defaultPemasok,
          tanggal: currentDate || undefined,
        };
        results.push(parsed);
        lastItemIndex = results.length - 1;
        pendingBuyIndexes.push(lastItemIndex);
      } else if (formula.jenis === 'jual' && lastItemIndex >= 0 && formula.hargaSatuan) {
        const target = results[lastItemIndex];
        if (!target.hargaJual) {
          target.hargaJual = formula.hargaSatuan;
          pendingBuyIndexes.push(lastItemIndex);
        }
      } else if (formula.jenis === 'beli') {
        const index = pendingBuyIndexes.shift();
        if (index !== undefined) {
          const target = results[index];
          target.qtyBeli = formula.qty || target.qty;
          target.qty_beli = target.qtyBeli;
          if (formula.hargaSatuan) target.hargaBeli = formula.hargaSatuan;
        }
      }
      continue;
    }

    if (isIgnoredLine(line)) continue;
    const plainItem = parsePlainItem(line);
    if (!plainItem) continue;

    results.push({
      ...plainItem,
      toko: currentToko,
      tujuanDapur: currentDapur,
      pemasok: defaultPemasok,
      tanggal: currentDate || undefined,
    });
    lastItemIndex = results.length - 1;
  }

  return results;
}

function splitLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u200b\u200c\u200d\u200e\u200f]/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function cleanLine(line: string): string {
  return line
    .replace(/^\s*[\d]+[.)]\s*/, '')
    .replace(/^\s*[-*•]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDapurHeader(line: string): string {
  if (/^pesanan\b/i.test(line)) return '';
  const match = line.match(new RegExp(`\\bdapur\\s+(.+?)(?=\\s+(?:${DAYS})\\b|\\s+\\d{1,2}[/-]\\d{1,2}|$)`, 'i'));
  if (!match) return '';
  return match[1].replace(/[\s:_-]+$/, '').trim();
}

function parseTokoHeader(line: string, availableStores: string[]): string {
  const normalized = line.trim().replace(/[.:_-]+$/, '').trim();
  const codeMatch = normalized.match(/^(LA|LB|HTG|PW)(?:\s*\/.*)?$/i);
  if (!codeMatch) return '';

  const code = codeMatch[1].toUpperCase();
  const known = availableStores.find((store) => {
    const value = store.trim().toUpperCase();
    return value === code || value.startsWith(`${code} `) || value.startsWith(`${code}/`);
  });
  return known || code;
}

function parseFormulaLine(line: string): Formula | null {
  const match = line.match(/^(jual|beli)\b\s*(.*)$/i);
  if (!match) return null;

  const jenis = match[1].toLowerCase() as 'jual' | 'beli';
  const body = match[2].trim();
  if (!body) return { jenis, namaBarang: '' };

  const multiplied = body.match(/^(\d+(?:[.,]\d+)?)\s*[x×*]\s*([\d.,]+)(?:\s*=\s*([\d.,]+))?(.*)$/i);
  if (multiplied) {
    const namaBarang = (multiplied[4] || '')
      .replace(/^\s*[-:=]+\s*/, '')
      .trim();
    return {
      jenis,
      qty: parseQuantity(multiplied[1]),
      hargaSatuan: parsePrice(multiplied[2]),
      namaBarang,
    };
  }

  // Format ringkas seperti: "Jual 270 semangka kuning".
  const qtyAndName = body.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
  if (qtyAndName) {
    return { jenis, qty: parseQuantity(qtyAndName[1]), namaBarang: qtyAndName[2].trim() };
  }
  const qtyOnly = body.match(/^(\d+(?:[.,]\d+)?)$/);
  if (qtyOnly) return { jenis, qty: parseQuantity(qtyOnly[1]), namaBarang: '' };
  return { jenis, namaBarang: '' };
}

function parsePlainItem(line: string): { namaBarang: string; qty: number; satuan: string; hargaBeli: number; hargaJual: number } | null {
  let cleaned = line.replace(/^\s*\d+[.)]\s*/, '').trim();
  if (!cleaned || isIgnoredLine(cleaned)) return null;

  let hargaBeli = 0;
  let hargaJual = 0;
  const atPrice = cleaned.match(/@\s*([^/]+?)(?:\s*\/\s*([^/]+))?(?:\s|$)/i);
  if (atPrice) {
    hargaBeli = parsePrice(atPrice[1]);
    hargaJual = atPrice[2] ? parsePrice(atPrice[2]) : 0;
    cleaned = cleaned.slice(0, atPrice.index).trim();
  }
  const buyPrice = cleaned.match(/\bbeli\s*(?::|=)?\s*([\d.,]+(?:\s*(?:ribu|rb|k))?)/i);
  if (buyPrice) {
    hargaBeli = hargaBeli || parsePrice(buyPrice[1]);
    cleaned = cleaned.replace(buyPrice[0], ' ').trim();
  }
  const sellPrice = cleaned.match(/\bjual\s*(?::|=)?\s*([\d.,]+(?:\s*(?:ribu|rb|k))?)/i);
  if (sellPrice) {
    hargaJual = hargaJual || parsePrice(sellPrice[1]);
    cleaned = cleaned.replace(sellPrice[0], ' ').trim();
  }

  const qtyUnit = cleaned.match(new RegExp(`(?:^|[: ]+)(${UNIT_PATTERN})\\b`, 'i'));
  const numberUnit = cleaned.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*:?\\s*(${UNIT_PATTERN})\\b`, 'i'));
  if (numberUnit) {
    const before = cleaned.slice(0, numberUnit.index).replace(/[:\-]+\s*$/, '').trim();
    const after = cleaned.slice((numberUnit.index || 0) + numberUnit[0].length).trim();
    const namaBarang = `${before} ${after}`.trim();
    if (!namaBarang) return null;
    return { namaBarang, qty: parseQuantity(numberUnit[1]), satuan: UNITS[numberUnit[2].toLowerCase()] || 'Kg', hargaBeli, hargaJual };
  }

  // A line without a price but with a bare quantity is a valid Follow Up item.
  const bareQty = cleaned.match(/^(.*?)(?:\s+)(\d+(?:[.,]\d+)?)$/);
  if (bareQty && parseQuantity(bareQty[2]) < 1000) {
    return { namaBarang: bareQty[1].replace(/[:\-]+\s*$/, '').trim(), qty: parseQuantity(bareQty[2]), satuan: 'Kg', hargaBeli, hargaJual };
  }
  return null;
}

function isIgnoredLine(line: string): boolean {
  return /^(?:pesanan|jalur|la|nota|fie|jual|beli|total|jumlah|subtotal|grand total)\b/i.test(line)
    || /^dapur\b/i.test(line)
    || new RegExp(`^(?:${DAYS})\\b`, 'i').test(line)
    || /^[_🌻\s]*(?:m|senin|selasa|rabu|kamis|jumat|sabtu|minggu)\b/i.test(line)
    || /^\d+[.,]?\d*\s*[x×*]\s*\d+[.,]?\d*/i.test(line);
}

function parseDate(line: string, defaultYear: number): string {
  const match = line.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (!match) return '';
  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearRaw = match[3] ? Number(match[3]) : defaultYear;
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  if (day < 1 || day > 31 || month < 1 || month > 12) return '';
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function detectReportYear(text: string): number | null {
  const fullYear = text.match(/\b(19\d{2}|20\d{2})\b/);
  if (fullYear) return Number(fullYear[1]);
  const monthYear = text.match(/\b(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{2})\b/i);
  if (monthYear) return 2000 + Number(monthYear[1]);
  return null;
}

function parseQuantity(value: string): number {
  return Number(value.replace(',', '.')) || 0;
}

function parsePrice(value: string): number {
  const normalized = value.trim();
  if (!normalized) return 0;
  const number = Number(normalized.includes(',') ? normalized.replace(/\./g, '').replace(',', '.') : normalized.replace(/\./g, ''));
  return Number.isFinite(number) ? Math.round(number) : 0;
}
