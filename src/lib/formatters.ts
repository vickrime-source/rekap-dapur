export function parseIndonesianNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  
  let str = String(value).trim();
  if (!str || str === '-' || str === '–') return 0;

  // Clean currency prefixes and spaces (e.g. "Rp", "Rp.", "IDR", "$")
  str = str.replace(/^(?:Rp\.?|IDR|\$)\s*/gi, '').trim();

  // If there are both dots and commas, e.g. "15.000,00" or "15,000.00"
  if (str.includes('.') && str.includes(',')) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Indonesian format: 1.000.000,50 -> dot is thousand, comma is decimal
      str = str.replace(/\./g, '').replace(/,/g, '.');
    } else {
      // US format: 1,000,000.50 -> comma is thousand, dot is decimal
      str = str.replace(/,/g, '');
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  // If only dot:
  if (str.includes('.')) {
    const parts = str.split('.');
    // If multiple dots (e.g. 1.500.000) or last part has 3 digits (e.g. 25.000), it's a thousand separator
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      str = str.replace(/\./g, '');
    }
  }

  // If only comma:
  if (str.includes(',')) {
    const parts = str.split(',');
    // If multiple commas (e.g. 1,500,000) or 3 digits after comma (e.g. 25,000), it's a thousand separator
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      str = str.replace(/,/g, '');
    } else {
      // Could be a decimal comma like "1,5" kg
      str = str.replace(/,/g, '.');
    }
  }

  // Remove any remaining characters except numbers, minus and decimal dot
  str = str.replace(/[^0-9.-]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function formatRupiah(amount: number | string): string {
  const numericAmount = typeof amount === 'number' 
    ? (isNaN(amount) ? 0 : amount) 
    : parseIndonesianNumber(amount);
  const isNegative = numericAmount < 0;
  const absAmount = Math.abs(numericAmount);
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(absAmount);

  // Format result nicely like "Rp 150.000" instead of "Rp150.000,00"
  const cleanFormatted = formatted.replace('Rp', 'Rp ');
  return isNegative ? `-${cleanFormatted}` : cleanFormatted;
}

export function formatRupiahInput(value: string | number | null | undefined): string {
  if (value === '' || value === null || value === undefined) return '';
  const digitsOnly = String(value).replace(/[^0-9]/g, '');
  if (!digitsOnly) return '';
  const num = parseInt(digitsOnly, 10);
  if (isNaN(num)) return '';
  return `Rp${num.toLocaleString('id-ID')}`;
}

export function parseRupiahInput(value: string | number | null | undefined): number {
  if (value === '' || value === null || value === undefined) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  const digitsOnly = String(value).replace(/[^0-9]/g, '');
  return digitsOnly ? parseInt(digitsOnly, 10) : 0;
}

export function parseDateSafe(dateVal: any): Date | null {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
  const str = String(dateVal).trim();
  if (!str) return null;

  // 1. ISO standard: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const date = new Date(y, m, d);
    if (!isNaN(date.getTime())) return date;
  }

  // 2. D/M/YYYY or DD/MM/YYYY or D-M-YYYY (Indonesian format: Day first!)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    const date = new Date(y, m, d);
    if (!isNaN(date.getTime())) return date;
  }

  // 3. Indonesian text date e.g. "Kamis, 9 Juli 2026" or "9 Juli 2026" or "Kamis, 9 2026"
  const indonesianMonths: Record<string, number> = {
    jan: 0, januari: 0,
    feb: 1, februari: 1,
    mar: 2, maret: 2,
    apr: 3, april: 3,
    mei: 4, may: 4,
    jun: 5, juni: 5,
    jul: 6, juli: 6,
    ags: 7, agustus: 7, agu: 7,
    sep: 8, september: 8,
    okt: 9, oktober: 9,
    nov: 10, november: 10,
    des: 11, desember: 11
  };
  const textMatch = str.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (textMatch) {
    const d = parseInt(textMatch[1], 10);
    const mKey = textMatch[2].toLowerCase();
    const m = indonesianMonths[mKey] !== undefined ? indonesianMonths[mKey] : 0;
    const y = parseInt(textMatch[3], 10);
    const date = new Date(y, m, d);
    if (!isNaN(date.getTime())) return date;
  }

  // Fallback direct Date parse
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  return null;
}

const INDONESIAN_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const INDONESIAN_MONTHS_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const INDONESIAN_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'
];

/**
 * Format tanggal untuk tampilan Web UI (selalu ada nama hari: "Kamis, 9 Juli 2026")
 */
export function formatTanggalWeb(dateVal: any, shortMonth = false): string {
  if (!dateVal) return '';
  const date = parseDateSafe(dateVal);
  if (!date) return String(dateVal);

  const dayName = INDONESIAN_DAYS[date.getDay()];
  const dayNum = date.getDate();
  const monthName = shortMonth 
    ? INDONESIAN_MONTHS_SHORT[date.getMonth()] 
    : INDONESIAN_MONTHS_LONG[date.getMonth()];
  const year = date.getFullYear();

  return `${dayName}, ${dayNum} ${monthName} ${year}`;
}

/**
 * Normalisasi nama dapur agar selalu dalam format kapital "SPPG {NAMA DAPUR}".
 * Menjamin tidak pernah menghasilkan nama palsu / placeholder '-' / nagrang / typo.
 * Contoh: "Cluring" -> "SPPG CLURING", "siliragung" -> "SPPG SILIRAGUNG"
 */
export function formatSppgKitchenName(kitchenName?: string | null): string {
  if (!kitchenName || !kitchenName.trim() || kitchenName.trim() === '-') {
    return 'SPPG';
  }
  let clean = kitchenName.trim();
  clean = clean.replace(/^sppg\s*[:.-]?\s*/i, '').trim();
  return clean ? `SPPG ${clean.toUpperCase()}` : 'SPPG';
}

/**
 * Mendapatkan nama penerima final khusus Invoice dengan prioritas nama dapur asli transaksi.
 */
export function resolveRecipientSppgName(
  customNama?: string | null,
  kitchenName?: string | null,
  items?: { tujuanDapur?: string }[]
): string {
  let name = '';
  if (customNama && customNama.trim() && customNama.trim() !== '-' && customNama.trim().toLowerCase() !== 'dapur') {
    name = customNama.trim();
  } else if (kitchenName && kitchenName.trim() && kitchenName.trim() !== '-' && kitchenName.trim().toLowerCase() !== 'dapur') {
    name = kitchenName.trim();
  } else if (items && items.length > 0) {
    const itemWithKitchen = items.find((i) => i.tujuanDapur && i.tujuanDapur.trim() && i.tujuanDapur.trim() !== '-');
    if (itemWithKitchen?.tujuanDapur) {
      name = itemWithKitchen.tujuanDapur.trim();
    }
  }

  if (!name) {
    name = 'DAPUR';
  }

  return formatSppgKitchenName(name);
}

/**
 * Format tanggal KHUSUS untuk Invoice: HARI, TANGGAL BULAN TAHUN (contoh: "SENIN, 27 Juli 2026")
 */
export function formatTanggalInvoice(dateVal: any): string {
  if (!dateVal) return '';
  const date = parseDateSafe(dateVal);
  if (!date) return String(dateVal);

  const dayName = INDONESIAN_DAYS[date.getDay()].toUpperCase();
  const d = date.getDate();
  const m = INDONESIAN_MONTHS_LONG[date.getMonth()];
  const y = date.getFullYear();

  return `${dayName}, ${d} ${m} ${y}`;
}

/**
 * Format tanggal gabungan konsisten untuk web (dengan nama hari, contoh: "Kamis, 9 Jul 2026")
 */
export function formatTanggalDisatuin(dateStr: any): string {
  if (!dateStr) return '';
  return formatTanggalWeb(dateStr, true);
}

/**
 * Format jam / waktu dari timestamp untuk web (contoh: "14:35" atau "08:15")
 */
export function formatJam(timeVal: any): string {
  if (!timeVal) return '';
  const str = String(timeVal).trim();
  
  // If already in HH:mm or HH:mm:ss format
  const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch && !str.includes('T') && !str.includes('-')) {
    const hh = timeMatch[1].padStart(2, '0');
    const mm = timeMatch[2];
    return `${hh}:${mm}`;
  }

  // If ISO string or valid date string
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  return str.length > 8 ? str.slice(0, 5) : str;
}

/**
 * Mendapatkan tanggal hari ini dalam format YYYY-MM-DD sesuai Waktu Indonesia Barat (WIB / Asia/Jakarta: UTC+7)
 */
export function getTodayWIB(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date()); // format en-CA menghasilkan YYYY-MM-DD
  } catch {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wib = new Date(utc + (7 * 3600000));
    const y = wib.getFullYear();
    const m = String(wib.getMonth() + 1).padStart(2, '0');
    const d = String(wib.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Mendapatkan jam sekarang dalam format HH:mm:ss sesuai Waktu Indonesia Barat (WIB / Asia/Jakarta: UTC+7)
 */
export function getNowWIBTime(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return formatter.format(new Date()); // format en-GB menghasilkan HH:mm:ss
  } catch {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wib = new Date(utc + (7 * 3600000));
    const hh = String(wib.getHours()).padStart(2, '0');
    const mm = String(wib.getMinutes()).padStart(2, '0');
    const ss = String(wib.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
}

/**
 * Mendapatkan ISO string lengkap dengan offset WIB (+07:00)
 */
export function getNowWIBISOString(): string {
  const dateStr = getTodayWIB();
  const timeStr = getNowWIBTime();
  return `${dateStr}T${timeStr}+07:00`;
}

/**
 * Format tanggal KHUSUS untuk backend Google Sheets: D/M/YYYY (contoh: "9/7/2026")
 * Menggunakan WIB (Waktu Indonesia Barat) jika tanggal kosong
 */
export function formatTanggalBackend(dateVal: any): string {
  if (!dateVal) {
    const todayWIB = getTodayWIB();
    const [y, m, d] = todayWIB.split('-').map(Number);
    return `${d}/${m}/${y}`;
  }
  const date = parseDateSafe(dateVal);
  if (!date) {
    const str = String(dateVal).trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
      return str;
    }
    const todayWIB = getTodayWIB();
    const [y, m, d] = todayWIB.split('-').map(Number);
    return `${d}/${m}/${y}`;
  }
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

/**
 * Format jam KHUSUS untuk backend Google Sheets kolom CREATED AT: HH:mm:ss (contoh: "14:35:20")
 * Ditanam di backend mengikuti Waktu Indonesia Barat (WIB)
 */
export function formatJamBackend(dateVal?: any): string {
  if (!dateVal) {
    return getNowWIBTime();
  }
  
  const str = String(dateVal).trim();
  const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch && !str.includes('T') && !str.includes('-')) {
    const hh = timeMatch[1].padStart(2, '0');
    const mm = timeMatch[2];
    const ss = timeMatch[3] || '00';
    return `${hh}:${mm}:${ss}`;
  }

  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    try {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      return formatter.format(date);
    } catch {
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    }
  }

  return getNowWIBTime();
}

/**
 * Helper untuk mengecek apakah sebuah order termasuk pesanan hari ini secara akurat.
 * Mendukung pencocokan WIB (Asia/Jakarta), waktu lokal HP, dan tanggal seleksi.
 */
export function isOrderToday(o: any, targetDateStr?: string): boolean {
  if (!o) return false;
  
  const todayWIB = getTodayWIB(); // e.g. "2026-09-07"
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  const validTargets = new Set<string>();
  validTargets.add(todayWIB);
  validTargets.add(localToday);

  if (targetDateStr) {
    const normTarget = normalizeDateSimple(targetDateStr);
    if (normTarget) validTargets.add(normTarget);
  }

  // 1. Cek o.tanggal
  if (o.tanggal) {
    const norm = normalizeDateSimple(o.tanggal);
    if (norm && validTargets.has(norm)) return true;

    const parsed = parseDateSafe(o.tanggal);
    if (parsed) {
      const parsedISO = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
      if (validTargets.has(parsedISO)) return true;

      // Antisipasi jika D/M terbalik (misal 7/9 vs 9/7 dari sheet US locale)
      const swapped = new Date(parsed.getFullYear(), parsed.getDate() - 1, parsed.getMonth() + 1);
      if (!isNaN(swapped.getTime())) {
        const swappedISO = `${swapped.getFullYear()}-${String(swapped.getMonth() + 1).padStart(2, '0')}-${String(swapped.getDate()).padStart(2, '0')}`;
        if (validTargets.has(swappedISO)) return true;
      }
    }
  }

  // 2. Cek o.createdAt
  if (o.createdAt) {
    const normCreated = normalizeDateSimple(o.createdAt);
    if (normCreated && validTargets.has(normCreated)) return true;

    const createdDate = parseDateSafe(o.createdAt);
    if (createdDate) {
      const createdISO = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}-${String(createdDate.getDate()).padStart(2, '0')}`;
      if (validTargets.has(createdISO)) return true;
      // Jika dibuat dalam rentang 24 jam terakhir
      const diffHours = Math.abs(Date.now() - createdDate.getTime()) / 3600000;
      if (diffHours <= 24) return true;
    }
  }

  // 3. Cek timestamp pada ID (ord-1725...) jika baru saja dibuat
  if (typeof o.id === 'string' && o.id.startsWith('ord-')) {
    const tsMatch = o.id.match(/^ord-(\d{10,13})/);
    if (tsMatch) {
      const ts = parseInt(tsMatch[1], 10);
      const tsDate = new Date(ts > 1e11 ? ts : ts * 1000);
      if (!isNaN(tsDate.getTime())) {
        const tsISO = `${tsDate.getFullYear()}-${String(tsDate.getMonth() + 1).padStart(2, '0')}-${String(tsDate.getDate()).padStart(2, '0')}`;
        if (validTargets.has(tsISO)) return true;
        const diffHours = Math.abs(Date.now() - tsDate.getTime()) / 3600000;
        if (diffHours <= 24) return true;
      }
    }
  }

  return false;
}

/**
 * Helper untuk normalisasi tanggal string ke YYYY-MM-DD
 */
export function normalizeDateSimple(val: any): string | null {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;

  if (str.includes('T')) {
    return str.split('T')[0];
  }

  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  const parsed = parseDateSafe(val);
  if (parsed) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }

  return null;
}

/**
 * Helper untuk mengecek apakah sebuah order termasuk bulan ini
 */
export function isOrderThisMonth(o: any, targetDateStr?: string): boolean {
  if (!o) return false;

  const todayWIB = getTodayWIB();
  const [wibY, wibM] = todayWIB.split('-').map(Number);
  const now = new Date();
  const localY = now.getFullYear();
  const localM = now.getMonth() + 1;

  let targetY = wibY;
  let targetM = wibM;
  if (targetDateStr) {
    const p = parseDateSafe(targetDateStr);
    if (p) {
      targetY = p.getFullYear();
      targetM = p.getMonth() + 1;
    }
  }

  const checkMonth = (dateObj: Date | null) => {
    if (!dateObj) return false;
    const y = dateObj.getFullYear();
    const m = dateObj.getMonth() + 1;
    return (
      (y === targetY && m === targetM) ||
      (y === wibY && m === wibM) ||
      (y === localY && m === localM)
    );
  };

  if (o.tanggal && checkMonth(parseDateSafe(o.tanggal))) return true;
  if (o.createdAt && checkMonth(parseDateSafe(o.createdAt))) return true;

  return false;
}

export function formatTanggal(dateStr: string, includeDayName = true): string {
  if (!dateStr) return '';
  return formatTanggalWeb(dateStr, false);
}

export function formatTanggalRealtime(customDate?: string | Date): string {
  const dateObj = customDate ? (typeof customDate === 'string' ? new Date(customDate) : customDate) : new Date();
  const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
  return validDate.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function generateInvoiceNumber(suffix?: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  
  const cleanSuffix = suffix ? `/${suffix.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4)}` : '';
  return `INV/${year}${month}${day}${cleanSuffix}/${randomNum}`;
}

export function getTokoBadgeStyle(tokoName: string): string {
  if (!tokoName) return 'bg-slate-100 text-slate-800 border-slate-300 font-bold';
  return 'bg-slate-100 text-slate-900 border-slate-300 font-extrabold shadow-2xs';
}

