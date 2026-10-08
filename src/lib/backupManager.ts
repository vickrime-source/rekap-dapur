import { getNowWIBISOString, formatTanggalRealtime } from './formatters';

export interface BackupDataPayload {
  appName: string;
  appDescription: string;
  version: string;
  backupDate: string;
  backupDateWIB: string;
  stats: {
    totalOrders: number;
    totalInvoices: number;
    totalNotes: number;
    totalExportHistory: number;
    totalStores: number;
    totalKitchens: number;
    totalSuppliers: number;
  };
  data: {
    orders: any[];
    invoices: any[];
    followUpNotes: any[];
    exportHistory: any[];
    masterData: {
      stores: any[];
      kitchens: any[];
      pemasokList: string[];
      masterToko?: any[];
      masterPemasok?: any[];
      masterDapur?: any[];
      masterSatuan?: any[];
    };
    localStorageSnapshot: Record<string, any>;
  };
}

export function generateBackupData(params: {
  orders?: any[];
  invoices?: any[];
  notes?: any[];
  exportHistory?: any[];
  stores?: any[];
  kitchens?: any[];
  pemasokList?: string[];
  masterToko?: any[];
  masterPemasok?: any[];
  masterDapur?: any[];
  masterSatuan?: any[];
}): BackupDataPayload {
  const {
    orders = [],
    invoices = [],
    notes = [],
    exportHistory = [],
    stores = [],
    kitchens = [],
    pemasokList = [],
    masterToko = [],
    masterPemasok = [],
    masterDapur = [],
    masterSatuan = [],
  } = params;

  // Snapshot of relevant localStorage keys
  const localStorageSnapshot: Record<string, any> = {};
  if (typeof window !== 'undefined' && window.localStorage) {
    const keysToBackup = [
      'htg_orders_v1',
      'htg_invoices_v1',
      'htg_followup_notes_v1',
      'htg_export_history',
      'htg_custom_ranges',
      'htg_daily_notes',
      'htg_docx_template',
      'theme',
    ];
    keysToBackup.forEach((key) => {
      try {
        const val = window.localStorage.getItem(key);
        if (val !== null) {
          try {
            localStorageSnapshot[key] = JSON.parse(val);
          } catch {
            localStorageSnapshot[key] = val;
          }
        }
      } catch (err) {
        console.warn(`[backupManager] Gagal membaca key ${key} dari localStorage:`, err);
      }
    });
  }

  const nowIso = getNowWIBISOString();
  const nowFormatted = formatTanggalRealtime(nowIso);

  return {
    appName: 'HTG Accounting',
    appDescription: 'Sistem Pembukuan & Manajemen Pesanan HTG Accounting',
    version: '1.0',
    backupDate: nowIso,
    backupDateWIB: nowFormatted,
    stats: {
      totalOrders: orders.length,
      totalInvoices: invoices.length,
      totalNotes: notes.length,
      totalExportHistory: exportHistory.length,
      totalStores: stores.length,
      totalKitchens: kitchens.length,
      totalSuppliers: pemasokList.length,
    },
    data: {
      orders,
      invoices,
      followUpNotes: notes,
      exportHistory,
      masterData: {
        stores,
        kitchens,
        pemasokList,
        masterToko,
        masterPemasok,
        masterDapur,
        masterSatuan,
      },
      localStorageSnapshot,
    },
  };
}

export function downloadBackupJson(payload: BackupDataPayload): string {
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });

  // Format date for filename: YYYY-MM-DD-HHmm
  const dateObj = new Date(payload.backupDate || Date.now());
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const min = String(dateObj.getMinutes()).padStart(2, '0');

  const fileName = `backup-htg-accounting-${yyyy}-${mm}-${dd}-${hh}${min}.json`;

  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return fileName;
}
