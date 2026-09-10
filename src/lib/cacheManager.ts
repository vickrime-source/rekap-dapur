/**
 * Frontend Cache Manager (Memory + Storage)
 * Mencegah pemanggilan fetch berulang dalam sesi yang sama (Hemat Egress Bandwidth)
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cacheStore = new Map<string, CacheEntry<any>>();

// Default TTL: 5 menit untuk data query
export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Mengambil data dari cache jika belum kedaluwarsa
 */
export function getFromCache<T>(key: string): T | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    cacheStore.delete(key);
    return null;
  }

  return entry.data as T;
}

/**
 * Menyimpan data ke dalam cache dengan TTL tertentu
 */
export function setInCache<T>(key: string, data: T, ttlMs: number = DEFAULT_CACHE_TTL_MS): void {
  cacheStore.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs,
  });
}

/**
 * Hapus cache berdasarkan prefix (misal 'pesanan', 'transaksi', 'notes', 'summary')
 * Dipanggil otomatis setelah user melakukan Add, Update, atau Delete!
 */
export function invalidateCache(prefix?: 'pesanan' | 'transaksi' | 'notes' | 'summary' | string): void {
  if (!prefix) {
    cacheStore.clear();
    return;
  }

  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix) || key.includes(`_${prefix}_`)) {
      cacheStore.delete(key);
    }
  }
}

/**
 * Periksa apakah kunci cache masih valid
 */
export function isCacheValid(key: string): boolean {
  const entry = cacheStore.get(key);
  if (!entry) return false;
  return Date.now() - entry.timestamp <= entry.ttl;
}
