import { addRow, updateRow, deleteRow, updateGroupStatus, SheetName } from './googleSheets';

export interface QueueItem {
  id: string;
  type: 'add_row' | 'update_row' | 'delete_row' | 'update_group';
  sheet: SheetName;
  payload?: any;
  match?: any;
  data?: any;
  rowIndex?: number;
  rowIndices?: number[];
  options?: any;
  timestamp: number;
  retryCount: number;
  description?: string;
}

const QUEUE_STORAGE_KEY = 'rekap_dapur_sync_queue_v1';

/**
 * Get all queued sync items from localStorage
 */
export function getSyncQueue(): QueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading sync queue from localStorage:', err);
    return [];
  }
}

/**
 * Save sync queue to localStorage
 */
function saveSyncQueue(queue: QueueItem[]): void {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    // Dispatch custom event so UI components can react immediately
    window.dispatchEvent(new CustomEvent('rekap_dapur_sync_queue_change', { detail: { count: queue.length } }));
  } catch (err) {
    console.error('Error saving sync queue to localStorage:', err);
  }
}

/**
 * Add an item to the sync queue
 */
export function enqueueSync(
  item: Omit<QueueItem, 'id' | 'timestamp' | 'retryCount'>
): QueueItem {
  const queue = getSyncQueue();
  const newItem: QueueItem = {
    ...item,
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    retryCount: 0,
  };
  queue.push(newItem);
  saveSyncQueue(queue);
  return newItem;
}

/**
 * Remove an item from the sync queue by id
 */
export function dequeueSync(id: string): void {
  const queue = getSyncQueue();
  const filtered = queue.filter((item) => item.id !== id);
  saveSyncQueue(filtered);
}

/**
 * Clear the entire sync queue
 */
export function clearSyncQueue(): void {
  saveSyncQueue([]);
}

/**
 * Check if the browser currently has internet connectivity
 */
export function isDeviceOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine !== false;
}

let isProcessingQueue = false;

/**
 * Process all items in the sync queue sequentially and upload to Google Sheets
 */
export async function processSyncQueue(
  onProgress?: (remainingCount: number, currentItem?: QueueItem) => void
): Promise<{ success: boolean; processedCount: number; remainingCount: number; lastError?: string }> {
  if (isProcessingQueue) {
    return { success: false, processedCount: 0, remainingCount: getSyncQueue().length, lastError: 'Sedang memproses antrean' };
  }

  if (!isDeviceOnline()) {
    return { success: false, processedCount: 0, remainingCount: getSyncQueue().length, lastError: 'Perangkat sedang offline' };
  }

  const queue = getSyncQueue();
  if (queue.length === 0) {
    return { success: true, processedCount: 0, remainingCount: 0 };
  }

  isProcessingQueue = true;
  let processedCount = 0;
  let lastError: string | undefined;

  try {
    const currentQueue = [...queue];
    const remainingItems: QueueItem[] = [];

    for (let i = 0; i < currentQueue.length; i++) {
      const item = currentQueue[i];
      if (onProgress) {
        onProgress(currentQueue.length - i, item);
      }

      let opSuccess = false;
      try {
        if (item.type === 'add_row') {
          const res = await addRow(item.sheet, item.payload || item.data);
          opSuccess = res.success;
          if (!opSuccess) lastError = res.error;
        } else if (item.type === 'update_row') {
          const res = await updateRow(item.sheet, item.match, item.data || item.payload, item.rowIndex);
          opSuccess = res.success;
          if (!opSuccess) lastError = res.error;
        } else if (item.type === 'update_group') {
          const res = await updateGroupStatus(item.sheet as 'pesanan', item.match, item.data || item.payload, item.rowIndices);
          opSuccess = res.success;
          if (!opSuccess) lastError = res.error;
        } else if (item.type === 'delete_row') {
          const res = await deleteRow(item.sheet, item.options || item.match || {}, item.rowIndex);
          opSuccess = res.success;
          if (!opSuccess) lastError = res.error;
        }
      } catch (err: any) {
        opSuccess = false;
        lastError = err?.message || 'Gagal koneksi jaringan';
      }

      if (opSuccess) {
        processedCount++;
      } else {
        item.retryCount = (item.retryCount || 0) + 1;
        // Keep item in queue if it failed, unless it has failed more than 10 times with a bad format
        if (item.retryCount < 10) {
          remainingItems.push(item);
        } else {
          console.warn(`[SyncQueue] Item ${item.id} dropped after 10 failed retries:`, item);
        }
      }
    }

    saveSyncQueue(remainingItems);
    return {
      success: remainingItems.length === 0,
      processedCount,
      remainingCount: remainingItems.length,
      lastError,
    };
  } finally {
    isProcessingQueue = false;
  }
}
