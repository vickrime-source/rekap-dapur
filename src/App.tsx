import React, { useState, useRef } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { 
  OrderItem, 
  Kitchen, 
  Store as StoreType, 
  InvoiceRecord, 
  TextParseResult,
  PaymentStatus,
  DeliveryStatus,
  ExportHistoryItem,
  NoteItem,
  DashboardPeriod,
  MasterToko,
  MasterPemasok,
  MasterDapur
} from './types';
import { 
  INITIAL_KITCHENS, 
  INITIAL_STORES, 
  INITIAL_PEMASOK, 
  INITIAL_ORDERS 
} from './constants/initialData';
import { HeaderBanner } from './components/HeaderBanner';
import { BottomNav, TabType } from './components/BottomNav';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { OrderModal } from './components/OrderModal';
import { NoteSheet } from './components/NoteSheet';
import { InvoiceModal } from './components/InvoiceModal';
import { InvoiceFormModal } from './components/InvoiceFormModal';
import { TextImportModal } from './components/TextImportModal';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { ConfirmModal } from './components/ConfirmModal';
import { ExportHistorySheet } from './components/ExportHistorySheet';
import { SyncBottomSheet } from './components/SyncBottomSheet';
import { SmartVoiceOrderOverlay } from './components/SmartVoiceOrderOverlay';
import { Toast, ToastMessage, ToastType } from './components/Toast';
import { generateInvoiceNumber, parseIndonesianNumber, getTodayWIB, getNowWIBISOString } from './lib/formatters';
import { 
  addRow, 
  updateRow,
  updateGroupStatus,
  deleteRow,
  fetchSheetData, 
  mapRawOrder, 
  mapRawInvoice, 
  mapRawNote,
  buildPesananPayload, 
  buildTransaksiPayload,
  buildNotesPayload
} from './lib/googleSheets';
import { 
  getSyncQueue, 
  enqueueSync, 
  processSyncQueue, 
  isDeviceOnline 
} from './lib/syncQueue';
import { 
  fetchMasterTokoFromDb, 
  fetchMasterPemasokFromDb, 
  fetchMasterDapurFromDb 
} from './lib/supabaseDb';
import { subscribeToTableChanges } from './lib/supabaseClient';
import { invalidateCache } from './lib/cacheManager';
import { downloadDocxInvoice } from './lib/docxTemplate';
import { exportHtmlInvoicePdf } from './lib/htmlInvoicePdf';
import { 
  sendNewOrderNotification, 
  sendDailyReportNotification, 
  getNotificationSettings, 
  saveNotificationSettings 
} from './lib/notificationManager';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // Persistent State
  const [orders, setOrders] = useLocalStorage<OrderItem[]>('dapur_tracker_orders_v4', INITIAL_ORDERS);
  const [kitchens, setKitchens] = useLocalStorage<Kitchen[]>('dapur_tracker_kitchens_v4', INITIAL_KITCHENS);
  const [stores, setStores] = useLocalStorage<StoreType[]>('dapur_tracker_stores_v4', INITIAL_STORES);
  const [pemasokList, setPemasokList] = useLocalStorage<string[]>('dapur_tracker_pemasok_v4', INITIAL_PEMASOK);
  const [invoices, setInvoices] = useLocalStorage<InvoiceRecord[]>('dapur_tracker_invoices_v4', []);
  const [exportHistory, setExportHistory] = useLocalStorage<ExportHistoryItem[]>('dapur_export_history_v1', []);
  const [notes, setNotes] = useLocalStorage<NoteItem[]>('dapur_highlight_notes_v1', []);
  const [dashboardPeriod, setDashboardPeriod] = useLocalStorage<DashboardPeriod>('dapur_dashboard_period_v2', 'mingguan');

  // Google Sheets Sync State & Offline Queue
  const [isSyncingGas, setIsSyncingGas] = useState(false);
  const [gasError, setGasError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() => isDeviceOnline());
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(() => getSyncQueue().length);

  // Export background tracking state
  const [isExportingActive, setIsExportingActive] = useState(false);
  const [isExportHistoryOpen, setIsExportHistoryOpen] = useState(false);
  const [isSyncSheetOpen, setIsSyncSheetOpen] = useState(false);
  const [isNoteSheetOpen, setIsNoteSheetOpen] = useState(false);
  const [autoStartVoiceNote, setAutoStartVoiceNote] = useState(false);

  // Master Data State (PostgreSQL Master Tables: Toko, Pemasok, Dapur)
  const [masterToko, setMasterToko] = useState<MasterToko[]>([]);
  const [masterPemasok, setMasterPemasok] = useState<MasterPemasok[]>([]);
  const [masterDapur, setMasterDapur] = useState<MasterDapur[]>([]);

  const refreshMasterData = async () => {
    try {
      const [tokoRes, pemasokRes, dapurRes] = await Promise.all([
        fetchMasterTokoFromDb(),
        fetchMasterPemasokFromDb(),
        fetchMasterDapurFromDb(),
      ]);
      if (tokoRes.success && tokoRes.data) {
        setMasterToko(tokoRes.data);
        if (tokoRes.data.length > 0) {
          setStores(tokoRes.data.map((t) => ({ id: t.id, nama: t.nama })));
        }
      }
      if (pemasokRes.success && pemasokRes.data) {
        setMasterPemasok(pemasokRes.data);
        if (pemasokRes.data.length > 0) {
          setPemasokList(pemasokRes.data.map((p) => p.nama));
        }
      }
      if (dapurRes.success && dapurRes.data) {
        setMasterDapur(dapurRes.data);
        if (dapurRes.data.length > 0) {
          setKitchens(dapurRes.data.map((d) => ({ id: d.id, nama: d.nama, lokasi: d.alamat })));
        }
      }
    } catch (e) {
      console.warn('Error refreshing master data from PostgreSQL:', e);
    }
  };

  // Smart Live Voice Order State (Hold to record & AI auto order)
  const [isSmartVoiceActive, setIsSmartVoiceActive] = useState(false);

  // Toast Notification State
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ id: `toast-${Date.now()}`, message, type });
  };

  const [lastSyncedTime, setLastSyncedTime] = useState<string | undefined>();
  const isFetchingDataRef = useRef(false);

  // Fetch sheet data
  const loadSpreadsheetData = async (showToastNotice = false) => {
    if (isFetchingDataRef.current) return;
    isFetchingDataRef.current = true;
    setIsSyncingGas(true);
    setGasError(null);
    try {
      const [pesananRes, transaksiRes, notesRes] = await Promise.all([
        fetchSheetData<any>('pesanan', { forceRefresh: showToastNotice }),
        fetchSheetData<any>('transaksi', { forceRefresh: showToastNotice }),
        fetchSheetData<any>('notes', { forceRefresh: showToastNotice }),
      ]);

      let loadedOrdersCount = 0;
      let loadedInvoicesCount = 0;
      let loadedNotesCount = 0;
      let hasAnySuccess = false;

      if (!pesananRes.error && Array.isArray(pesananRes.data)) {
        const mappedOrders = pesananRes.data.map(mapRawOrder);
        const queue = getSyncQueue();
        const pendingAddedOrders = queue
          .filter((q) => q.type === 'add_row' && q.sheet === 'pesanan')
          .map((q) => q.payload);

        setOrders((prevOrders) => {
          // Keep local orders that are still pending upload in offline queue
          const pendingUnsynced = prevOrders.filter((po) =>
            pendingAddedOrders.some(
              (p) =>
                p &&
                p.ITEM === po.namaBarang &&
                p.DATE === po.tanggal &&
                p.DAPUR === po.tujuanDapur
            )
          );
          // Sheet orders are the cloud source of truth
          return [...mappedOrders, ...pendingUnsynced];
        });
        loadedOrdersCount = mappedOrders.length;
        hasAnySuccess = true;
      }

      if (!transaksiRes.error && Array.isArray(transaksiRes.data)) {
        const mappedInvoices = transaksiRes.data.map(mapRawInvoice);
        setInvoices(mappedInvoices);
        loadedInvoicesCount = mappedInvoices.length;
        hasAnySuccess = true;
      }

      if (!notesRes.error && Array.isArray(notesRes.data)) {
        const mappedNotes = notesRes.data.map(mapRawNote);
        setNotes(mappedNotes);
        loadedNotesCount = mappedNotes.length;
        hasAnySuccess = true;
      }

      const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setLastSyncedTime(`Pukul ${nowStr}`);

      const isConfigured = pesananRes.configured || transaksiRes.configured || notesRes.configured;

      if (!isConfigured) {
        // App is working in local offline storage mode without errors
        setGasError(null);
        if (showToastNotice) {
          showToast('Google Sheets belum terhubung. Menggunakan data penyimpanan lokal HP.', 'info');
        }
      } else if (pesananRes.error && transaksiRes.error && notesRes.error) {
        const errText = pesananRes.error || transaksiRes.error || notesRes.error || 'Gagal koneksi ke Google Sheets';
        console.warn('[GoogleSheets Sync] Gagal ketiga sheet:', errText);
        setGasError(errText);
        if (showToastNotice) {
          showToast(`Gagal: ${errText}`, 'error');
        }
      } else if (hasAnySuccess) {
        setGasError(null);
        if (showToastNotice) {
          showToast(`Berhasil memuat ${loadedOrdersCount} pesanan, ${loadedNotesCount} catatan & ${loadedInvoicesCount} transaksi dari Spreadsheet!`, 'success');
        }
      } else {
        if (showToastNotice) {
          showToast('Spreadsheet terhubung (Sheet masih kosong).', 'success');
        }
      }
    } catch (err: any) {
      console.warn('Gagal mengambil data spreadsheet (menggunakan mode data lokal HP):', err);
      setGasError(err?.message || 'Gagal koneksi ke Google Sheets');
      if (showToastNotice) {
        showToast(`Gagal: ${err?.message || 'Tidak dapat terhubung'}`, 'error');
      }
    } finally {
      setIsSyncingGas(false);
      isFetchingDataRef.current = false;
    }
  };

  React.useEffect(() => {
    loadSpreadsheetData();
    refreshMasterData();
  }, []);

  // Confirm Modal State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    isLoading?: boolean;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // Data Sanitization / Migration Effect
  React.useEffect(() => {
    if (stores.some((s) => s.nama.startsWith('Toko '))) {
      setStores(INITIAL_STORES);
    }
    if (pemasokList.some((p) => ['HTG', 'PROHE', 'LUWENG BOGA', 'ADIFRUITA'].includes(p))) {
      setPemasokList(INITIAL_PEMASOK);
    }

    let needUpdate = false;
    const updatedOrders = orders.map((o) => {
      let toko = o.toko;
      let pemasok = o.pemasok;
      let itemChanged = false;

      if (['HTG', 'PROHE', 'LUWENG BOGA', 'ADIFRUITA'].includes(o.pemasok)) {
        toko = o.pemasok;
        pemasok = 'Pemasok 1';
        itemChanged = true;
      }
      if (['Toko 1', 'Toko 2', 'Toko 3', 'Toko 4'].includes(o.toko)) {
        toko = 'HTG';
        itemChanged = true;
      }
      if (['Toko 1', 'Toko 2', 'Toko 3', 'Toko 4'].includes(o.pemasok)) {
        pemasok = 'Pemasok 1';
        itemChanged = true;
      }

      if (itemChanged) {
        needUpdate = true;
        return { ...o, toko, pemasok };
      }
      return o;
    });

    if (needUpdate) {
      setOrders(updatedOrders);
    }

    // Clean up residual dummy notes if present from older versions
    if (notes.some((n) => n.id === 'note-1' || n.id === 'note-2')) {
      setNotes((prev) => prev.filter((n) => n.id !== 'note-1' && n.id !== 'note-2'));
    }
  }, []);

  // Navigation State
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayWIB());

  // Modal States
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderItem | null>(null);
  const [prefilledKitchen, setPrefilledKitchen] = useState<string | undefined>();

  // Invoice Form (Step 1 Confirmation) & Invoice Modal (Step 2 Preview) States
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);
  const [invoiceFormItems, setInvoiceFormItems] = useState<OrderItem[]>([]);
  const [invoiceFormKitchen, setInvoiceFormKitchen] = useState<string | undefined>();
  const [invoiceFormStore, setInvoiceFormStore] = useState<string | undefined>();

  const [invoiceRecipientName, setInvoiceRecipientName] = useState('');
  const [invoiceRecipientAddress, setInvoiceRecipientAddress] = useState('');
  const [invoiceRecipientPhone, setInvoiceRecipientPhone] = useState('');
  const [invoiceBayar, setInvoiceBayar] = useState<number>(0);

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<OrderItem[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceTargetKitchen, setInvoiceTargetKitchen] = useState<string | undefined>();
  const [invoiceTargetStore, setInvoiceTargetStore] = useState<string | undefined>();

  const [isTextImportOpen, setIsTextImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'kelola_data' | 'dapur' | 'toko' | 'pemasok' | 'template' | 'googlesheets' | 'notifikasi' | 'install' | 'danger'>('kelola_data');

  // Background queue processor: uploads queued offline changes to Google Sheets
  const handleProcessQueueAndSync = async (showNotice = false) => {
    if (!isDeviceOnline()) {
      if (showNotice) showToast('Perangkat sedang offline. Data tetap tersimpan aman di HP.', 'info');
      return;
    }
    const queue = getSyncQueue();
    if (queue.length > 0) {
      setIsSyncingGas(true);
      const result = await processSyncQueue();
      setIsSyncingGas(false);
      setPendingQueueCount(result.remainingCount);
      if (result.processedCount > 0) {
        showToast(`${result.processedCount} data tersimpan di HP berhasil diunggah ke Google Sheets! Data sekarang aktif untuk semua perangkat.`, 'success');
        await loadSpreadsheetData(false);
      } else if (!result.success && result.lastError) {
        setGasError(result.lastError);
        if (showNotice) showToast(`Sebagian antrean belum terunggah: ${result.lastError}`, 'error');
      }
    } else {
      await loadSpreadsheetData(showNotice);
    }
  };

  // Automatic multi-device & offline queue sync listeners
  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Internet terhubung! Mengunggah antrean perubahan ke Google Sheets...', 'info');
      handleProcessQueueAndSync(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('Mode offline aktif. Perubahan tetap tersimpan di HP dan akan otomatis diunggah ke Google Sheets saat ada sinyal.', 'info');
    };

    const handleQueueChange = (e: any) => {
      setPendingQueueCount(e?.detail?.count ?? getSyncQueue().length);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isDeviceOnline()) {
        handleProcessQueueAndSync(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('rekap_dapur_sync_queue_change', handleQueueChange as EventListener);
    document.addEventListener('visibilitychange', handleVisibility);

    // WAJIB HEMAT EGRESS: Polling setInterval DIHAPUS TOTAL!
    // Digantikan dengan Supabase Realtime subscription hemat egress:
    // HANYA subscribe ke tabel yang sedang aktif dilihat user.
    // Unsubscribe seketika saat user pindah halaman / tab.
    let unsubscribePesanan: (() => void) | undefined;
    let unsubscribeNotes: (() => void) | undefined;
    let unsubscribeTransaksi: (() => void) | undefined;

    const setupRealtime = async () => {
      try {
        if (activeTab === 'dashboard' || activeTab === 'dapur' || activeTab === 'toko') {
          unsubscribePesanan = await subscribeToTableChanges('pesanan', () => {
            invalidateCache('pesanan');
            invalidateCache('summary');
            loadSpreadsheetData(false);
          });
          if (activeTab === 'dashboard') {
            unsubscribeNotes = await subscribeToTableChanges('notes', () => {
              invalidateCache('notes');
              loadSpreadsheetData(false);
            });
          }
        } else if (activeTab === 'transaksi') {
          unsubscribeTransaksi = await subscribeToTableChanges('transaksi', () => {
            invalidateCache('transaksi');
            loadSpreadsheetData(false);
          });
        }
      } catch (err) {
        console.warn('Realtime subscription tidak aktif, menggunakan mode fetch-on-demand:', err);
      }
    };

    setupRealtime();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('rekap_dapur_sync_queue_change', handleQueueChange as EventListener);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (unsubscribePesanan) unsubscribePesanan();
      if (unsubscribeNotes) unsubscribeNotes();
      if (unsubscribeTransaksi) unsubscribeTransaksi();
    };
  }, [activeTab]);

  // Handlers for Order CRUD
  const handleToggleStatus = (id: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, status: o.status === 'pending' ? 'selesai' : 'pending' } : o
      )
    );
  };

  const handleUpdatePaymentStatus = async (id: string, paymentStatus: PaymentStatus) => {
    const targetOrder = orders.find((o) => o.id === id);
    if (!targetOrder) return;
    const delStatus = targetOrder.deliveryStatus || (targetOrder.status === 'selesai' ? 'DONE' : 'PENDING');
    const newStatus = paymentStatus === 'PAID' && delStatus === 'DONE' ? 'selesai' : 'pending';

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        return {
          ...o,
          paymentStatus,
          status: newStatus,
        };
      })
    );

    // Sync to Google Sheets
    const res = await updateRow(
      'pesanan',
      {
        ITEM: targetOrder.namaBarang,
        DATE: targetOrder.tanggal,
        DAPUR: targetOrder.tujuanDapur,
        TOKO: targetOrder.toko,
      },
      {
        PAYMENT: paymentStatus,
        STATUS: newStatus,
      },
      targetOrder.rowIndex
    );
    if (!res.success) {
      setGasError(res.error || 'Gagal update status pembayaran di Google Sheets');
      enqueueSync({
        type: 'update_row',
        sheet: 'pesanan',
        match: {
          ITEM: targetOrder.namaBarang,
          DATE: targetOrder.tanggal,
          DAPUR: targetOrder.tujuanDapur,
          TOKO: targetOrder.toko,
        },
        data: {
          PAYMENT: paymentStatus,
          STATUS: newStatus,
        },
        rowIndex: targetOrder.rowIndex,
        description: `Update bayar (${paymentStatus}) ${targetOrder.namaBarang}`
      });
      showToast(`Status lokal diubah (Tersimpan di HP & masuk antrean upload Google Sheets)`, 'info');
    } else {
      showToast(`Status pembayaran berhasil diperbarui (${paymentStatus}) & tersimpan ke Cloud`, 'success');
    }
  };

  const handleUpdateDeliveryStatus = async (id: string, deliveryStatus: DeliveryStatus) => {
    const targetOrder = orders.find((o) => o.id === id);
    if (!targetOrder) return;
    const payStatus = targetOrder.paymentStatus || (targetOrder.status === 'selesai' ? 'PAID' : 'UNPAID');
    const newStatus = payStatus === 'PAID' && deliveryStatus === 'DONE' ? 'selesai' : 'pending';

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        return {
          ...o,
          deliveryStatus,
          status: newStatus,
        };
      })
    );

    // Sync to Google Sheets
    const res = await updateRow(
      'pesanan',
      {
        ITEM: targetOrder.namaBarang,
        DATE: targetOrder.tanggal,
        DAPUR: targetOrder.tujuanDapur,
        TOKO: targetOrder.toko,
      },
      {
        DILEVERY: deliveryStatus,
        STATUS: newStatus,
      },
      targetOrder.rowIndex
    );
    if (!res.success) {
      setGasError(res.error || 'Gagal update status pengiriman di Google Sheets');
      enqueueSync({
        type: 'update_row',
        sheet: 'pesanan',
        match: {
          ITEM: targetOrder.namaBarang,
          DATE: targetOrder.tanggal,
          DAPUR: targetOrder.tujuanDapur,
          TOKO: targetOrder.toko,
        },
        data: {
          DILEVERY: deliveryStatus,
          STATUS: newStatus,
        },
        rowIndex: targetOrder.rowIndex,
        description: `Update kirim (${deliveryStatus}) ${targetOrder.namaBarang}`
      });
      showToast(`Status lokal diubah (Tersimpan di HP & masuk antrean upload Google Sheets)`, 'info');
    } else {
      showToast(`Status pengiriman berhasil diperbarui (${deliveryStatus}) & tersimpan ke Cloud`, 'success');
    }
  };

  const handleUpdateGroupPaymentStatus = async (groupItems: OrderItem[], paymentStatus: PaymentStatus) => {
    if (!groupItems || groupItems.length === 0) return;
    const first = groupItems[0];
    const targetIds = new Set(groupItems.map((it) => it.id));
    const rowIndices = groupItems.map((it) => it.rowIndex).filter(Boolean) as number[];

    setOrders((prev) =>
      prev.map((o) => {
        if (!targetIds.has(o.id)) return o;
        const delStatus = o.deliveryStatus || (o.status === 'selesai' ? 'DONE' : 'PENDING');
        const newStatus = paymentStatus === 'PAID' && delStatus === 'DONE' ? 'selesai' : 'pending';
        return {
          ...o,
          paymentStatus,
          status: newStatus,
        };
      })
    );

    // Sync whole group atomically to Google Sheets
    const res = await updateGroupStatus(
      'pesanan',
      {
        DATE: first.tanggal,
        DAPUR: first.tujuanDapur,
        TOKO: first.toko,
      },
      {
        PAYMENT: paymentStatus,
        STATUS: paymentStatus === 'PAID' ? 'selesai' : 'pending',
      },
      rowIndices.length > 0 ? rowIndices : undefined
    );
    if (!res.success) {
      setGasError(res.error || 'Gagal update pembayaran grup di Google Sheets');
      enqueueSync({
        type: 'update_group',
        sheet: 'pesanan',
        match: {
          DATE: first.tanggal,
          DAPUR: first.tujuanDapur,
          TOKO: first.toko,
        },
        data: {
          PAYMENT: paymentStatus,
          STATUS: paymentStatus === 'PAID' ? 'selesai' : 'pending',
        },
        rowIndices: rowIndices.length > 0 ? rowIndices : undefined,
        description: `Update grup payment ${first.tujuanDapur}`
      });
      showToast(`Status grup lokal diubah (Tersimpan di HP & masuk antrean upload Google Sheets)`, 'info');
    } else {
      showToast(`Status pembayaran grup berhasil diperbarui (${paymentStatus}) & tersimpan ke Cloud`, 'success');
    }
  };

  const handleUpdateGroupDeliveryStatus = async (groupItems: OrderItem[], deliveryStatus: DeliveryStatus) => {
    if (!groupItems || groupItems.length === 0) return;
    const first = groupItems[0];
    const targetIds = new Set(groupItems.map((it) => it.id));
    const rowIndices = groupItems.map((it) => it.rowIndex).filter(Boolean) as number[];

    setOrders((prev) =>
      prev.map((o) => {
        if (!targetIds.has(o.id)) return o;
        const payStatus = o.paymentStatus || (o.status === 'selesai' ? 'PAID' : 'UNPAID');
        const newStatus = payStatus === 'PAID' && deliveryStatus === 'DONE' ? 'selesai' : 'pending';
        return {
          ...o,
          deliveryStatus,
          status: newStatus,
        };
      })
    );

    // Sync whole group atomically to Google Sheets
    const res = await updateGroupStatus(
      'pesanan',
      {
        DATE: first.tanggal,
        DAPUR: first.tujuanDapur,
        TOKO: first.toko,
      },
      {
        DILEVERY: deliveryStatus,
        STATUS: deliveryStatus === 'DONE' ? 'selesai' : 'pending',
      },
      rowIndices.length > 0 ? rowIndices : undefined
    );
    if (!res.success) {
      setGasError(res.error || 'Gagal update pengiriman grup di Google Sheets');
      enqueueSync({
        type: 'update_group',
        sheet: 'pesanan',
        match: {
          DATE: first.tanggal,
          DAPUR: first.tujuanDapur,
          TOKO: first.toko,
        },
        data: {
          DILEVERY: deliveryStatus,
          STATUS: deliveryStatus === 'DONE' ? 'selesai' : 'pending',
        },
        rowIndices: rowIndices.length > 0 ? rowIndices : undefined,
        description: `Update grup delivery ${first.tujuanDapur}`
      });
      showToast(`Status pengiriman grup lokal diubah (Tersimpan di HP & masuk antrean upload Google Sheets)`, 'info');
    } else {
      showToast(`Status pengiriman grup berhasil diperbarui (${deliveryStatus}) & tersimpan ke Cloud`, 'success');
    }
  };

  const handleDuplicateOrder = async (item: OrderItem) => {
    const duplicated: OrderItem = {
      ...item,
      id: `ord-dup-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: getNowWIBISOString(),
    };

    // Always preserve data locally
    setOrders((prev) => [duplicated, ...prev]);

    setIsSyncingGas(true);
    const res = await addRow('pesanan', buildPesananPayload(duplicated));
    setIsSyncingGas(false);

    if (res.success) {
      showToast('Pesanan berhasil diduplikasi & tersimpan ke Google Sheets', 'success');
    } else {
      setGasError(res.error || 'Gagal tersambung ke Google Sheets');
      enqueueSync({
        type: 'add_row',
        sheet: 'pesanan',
        payload: buildPesananPayload(duplicated),
        description: `Duplikasi pesanan ${duplicated.namaBarang}`
      });
      showToast('Pesanan diduplikasi di HP (Offline). Masuk antrean upload ke Google Sheets.', 'info');
    }
  };

  const handleToggleBatchStatus = (targetName: string, date: string, targetStatus: 'pending' | 'selesai') => {
    setOrders((prev) =>
      prev.map((o) =>
        (o.toko === targetName || o.tujuanDapur === targetName) && o.tanggal === date
          ? { ...o, status: targetStatus }
          : o
      )
    );
  };

  const handleSaveOrder = async (
    orderData: Omit<OrderItem, 'id' | 'createdAt'> | Array<Omit<OrderItem, 'id' | 'createdAt'>>,
    editId?: string
  ) => {
    if (editId && !Array.isArray(orderData)) {
      const oldOrder = orders.find((o) => o.id === editId);
      const updatedOrder: OrderItem = {
        ...(oldOrder || {}),
        ...orderData,
        id: editId,
        createdAt: oldOrder?.createdAt || getNowWIBISOString(),
      } as OrderItem;

      setOrders((prev) =>
        prev.map((o) => (o.id === editId ? updatedOrder : o))
      );
      showToast('Pesanan berhasil diperbarui', 'edit');

      // 2-Way Sync update to Google Sheets
      if (oldOrder) {
        setIsSyncingGas(true);
        const res = await updateRow(
          'pesanan',
          {
            ITEM: oldOrder.namaBarang,
            DATE: oldOrder.tanggal,
            DAPUR: oldOrder.tujuanDapur,
            TOKO: oldOrder.toko,
          },
          buildPesananPayload(updatedOrder),
          oldOrder.rowIndex
        );
        setIsSyncingGas(false);
        if (!res.success) {
          setGasError(res.error || 'Gagal update di Google Sheets');
          enqueueSync({
            type: 'update_row',
            sheet: 'pesanan',
            match: {
              ITEM: oldOrder.namaBarang,
              DATE: oldOrder.tanggal,
              DAPUR: oldOrder.tujuanDapur,
              TOKO: oldOrder.toko,
            },
            data: buildPesananPayload(updatedOrder),
            rowIndex: oldOrder.rowIndex,
            description: `Update pesanan ${updatedOrder.namaBarang}`
          });
          showToast(`Pesanan diperbarui di HP (Offline). Masuk antrean upload Google Sheets.`, 'info');
        } else {
          showToast('Pesanan berhasil diperbarui & tersimpan ke Cloud', 'edit');
        }
      }
      return;
    }

    const itemsToAdd = Array.isArray(orderData) ? orderData : [orderData];
    const createdDate = getNowWIBISOString();

    const newOrdersAdded: OrderItem[] = itemsToAdd.map((item, idx) => ({
      ...item,
      id: `ord-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
      createdAt: createdDate,
    }));

    // Local-First: ALWAYS save new orders to local state & localStorage immediately
    setOrders((prev) => [...newOrdersAdded, ...prev]);
    setSelectedDate(getTodayWIB());

    setIsSyncingGas(true);
    let successCount = 0;
    let lastError = '';

    for (let idx = 0; idx < newOrdersAdded.length; idx++) {
      const newOrderItem = newOrdersAdded[idx];
      const res = await addRow('pesanan', buildPesananPayload(newOrderItem));

      if (res.success) {
        successCount++;
      } else {
        lastError = res.error || 'Gagal menyimpan ke Google Sheets';
        enqueueSync({
          type: 'add_row',
          sheet: 'pesanan',
          payload: buildPesananPayload(newOrderItem),
          description: `Tambah ${newOrderItem.namaBarang}`
        });
      }
    }

    // Also append batch to sheet "transaksi" via sheets.spreadsheets.values.append
    if (newOrdersAdded.length > 0) {
      const firstItem = newOrdersAdded[0];
      const totalBeli = newOrdersAdded.reduce((sum, it) => sum + Number(it.qty || 0) * Number(it.hargaBeli || 0), 0);
      const totalJual = newOrdersAdded.reduce((sum, it) => sum + Number(it.qty || 0) * Number(it.hargaJual || it.hargaBeli || 0), 0);
      const txPayload = buildTransaksiPayload({
        tanggal: firstItem.tanggal,
        tanggalPrint: firstItem.tanggal,
        toko: firstItem.toko,
        pemasok: firstItem.pemasok,
        totalBeli,
        totalJual,
        items: newOrdersAdded,
        status: firstItem.paymentStatus || 'UNPAID',
      });
      const txRes = await addRow('transaksi', txPayload);
      const newInvoiceRec: InvoiceRecord = {
        id: `tx-${Date.now()}`,
        invoiceNumber: `TRX-${Date.now().toString().slice(-6)}`,
        tanggalPrint: firstItem.tanggal,
        createdAt: createdDate,
        tujuanDapur: firstItem.tujuanDapur,
        toko: firstItem.toko,
        items: newOrdersAdded,
        totalBeli,
        totalJual,
        totalProfit: totalJual - totalBeli,
        pemasok: firstItem.pemasok,
        status: firstItem.paymentStatus || 'UNPAID',
      };
      setInvoices((prev) => [newInvoiceRec, ...prev]);

      if (!txRes.success) {
        enqueueSync({
          type: 'add_row',
          sheet: 'transaksi',
          payload: txPayload,
          description: `Transaksi ${firstItem.toko || firstItem.tujuanDapur}`
        });
      }
    }

    setIsSyncingGas(false);

    if (successCount === newOrdersAdded.length) {
      showToast(`${successCount} pesanan tersimpan ke Google Sheets & dapat dilihat di semua perangkat`, 'success');
    } else {
      setGasError(lastError);
      showToast(`${newOrdersAdded.length} pesanan tersimpan di HP. Otomatis diunggah ke Google Sheets saat ada internet agar terlihat di perangkat lain!`, 'info');
    }
  };

  const handleDeleteOrder = (id: string) => {
    const targetOrder = orders.find((o) => o.id === id);
    const targetInvoice = !targetOrder ? invoices.find((inv) => inv.id === id || inv.items?.some((it) => it.id === id)) : undefined;

    const desc = targetOrder
      ? `${targetOrder.namaBarang} (${targetOrder.tujuanDapur || 'Dapur'})`
      : targetInvoice
      ? `Transaksi ${targetInvoice.toko || targetInvoice.tujuanDapur || ''}`
      : 'data ini';

    setConfirmState({
      isOpen: true,
      title: 'Konfirmasi Hapus Pesanan',
      message: `Yakin hapus data ${desc}? Data akan dihapus secara permanen dari Google Sheets.`,
      onConfirm: async () => {
        setIsSyncingGas(true);
        setConfirmState((prev) => (prev ? { ...prev, isLoading: true } : null));

        try {
          if (targetOrder) {
            // Panggil /api/sheets-delete via deleteRow dengan sheet + rowIndex
            const res = await deleteRow('pesanan', {
              rowIndex: targetOrder.rowIndex,
              match: {
                ITEM: targetOrder.namaBarang,
                DATE: targetOrder.tanggal,
                DAPUR: targetOrder.tujuanDapur,
                TOKO: targetOrder.toko,
              },
            });

            if (!res.success) {
              showToast(`Gagal menghapus dari Google Sheets: ${res.error || 'Terjadi kesalahan'}`, 'error');
              setGasError(res.error || 'Gagal menghapus data dari Google Sheets');
              return;
            }

            // Backend sukses: BARU update local state
            setOrders((prev) => prev.filter((o) => o.id !== id));
            showToast(`Pesanan "${targetOrder.namaBarang}" berhasil dihapus permanen`, 'delete');

            // REFETCH ulang seluruh data dari sheet agar semua rowIndex tersinkronisasi kembali
            await loadSpreadsheetData(false);
          } else if (targetInvoice) {
            const resInv = await deleteRow('transaksi', {
              rowIndex: targetInvoice.rowIndex,
              match: {
                TANGGAL: targetInvoice.tanggalPrint || targetInvoice.tanggal,
                TOKO: targetInvoice.toko,
                PEMASOK: targetInvoice.pemasok,
              },
            });

            if (!resInv.success) {
              showToast(`Gagal menghapus transaksi dari Google Sheets: ${resInv.error || 'Terjadi kesalahan'}`, 'error');
              setGasError(resInv.error || 'Gagal menghapus transaksi dari Google Sheets');
              return;
            }

            setInvoices((prev) => prev.filter((inv) => inv.id !== targetInvoice.id));
            showToast('Transaksi berhasil dihapus permanen', 'delete');

            await loadSpreadsheetData(false);
          } else {
            // Data lokal non-Google Sheets
            setOrders((prev) => prev.filter((o) => o.id !== id));
            showToast('Item berhasil dihapus', 'delete');
          }
        } catch (err: any) {
          console.error('Error in handleDeleteOrder:', err);
          showToast(`Gagal menghapus: ${err?.message || 'Error tidak diketahui'}`, 'error');
        } finally {
          setIsSyncingGas(false);
          setConfirmState(null);
        }
      },
    });
  };

  const handleDeleteBatchOrders = (items: OrderItem[]) => {
    if (!items || items.length === 0) return;
    const first = items[0];
    const desc = `${first.tujuanDapur || 'Dapur'} - ${first.toko || 'Toko'} (${first.tanggal})`;

    setConfirmState({
      isOpen: true,
      title: 'Hapus Seluruh Pesanan Transaksi',
      message: `Yakin hapus seluruh pesanan (${items.length} item) untuk ${desc}? Data akan dihapus permanen dari Google Sheets.`,
      onConfirm: async () => {
        setIsSyncingGas(true);
        setConfirmState((prev) => (prev ? { ...prev, isLoading: true } : null));

        try {
          const rowIndices = items
            .map((it) => it.rowIndex)
            .filter((idx): idx is number => typeof idx === 'number' && idx >= 2);

          let res: any;
          if (rowIndices.length > 0) {
            res = await deleteRow('pesanan', { rowIndices });
          } else {
            const firstItem = items[0];
            res = await deleteRow('pesanan', {
              match: {
                DATE: firstItem?.tanggal,
                DAPUR: firstItem?.tujuanDapur,
                TOKO: firstItem?.toko,
              },
              deleteAllMatches: true,
            });
          }

          if (res && !res.success) {
            showToast(`Gagal menghapus dari Google Sheets: ${res.error || 'Terjadi kesalahan'}`, 'error');
            return;
          }

          const itemIds = new Set(items.map((i) => i.id));
          setOrders((prev) => prev.filter((o) => !itemIds.has(o.id)));
          showToast(`${items.length} pesanan berhasil dihapus permanen`, 'delete');

          // REFETCH seluruh data
          await loadSpreadsheetData(false);
        } catch (err: any) {
          console.error('Error handleDeleteBatchOrders:', err);
          showToast(`Gagal menghapus pesanan: ${err?.message || err}`, 'error');
        } finally {
          setIsSyncingGas(false);
          setConfirmState(null);
        }
      },
    });
  };

  const handleDeleteKitchenOrders = (targetName: string, date: string) => {
    const matchingOrders = orders.filter(
      (o) => (o.toko === targetName || o.tujuanDapur === targetName) && o.tanggal === date
    );

    setConfirmState({
      isOpen: true,
      title: 'Hapus Semua Pesanan',
      message: `Hapus semua pesanan (${matchingOrders.length} item) untuk ${targetName} pada tanggal ${date}? Data akan dihapus permanen dari Google Sheets.`,
      onConfirm: async () => {
        setIsSyncingGas(true);
        setConfirmState((prev) => (prev ? { ...prev, isLoading: true } : null));

        try {
          const rowIndices = matchingOrders
            .map((it) => it.rowIndex)
            .filter((idx): idx is number => typeof idx === 'number' && idx >= 2);

          if (rowIndices.length > 0) {
            const res = await deleteRow('pesanan', { rowIndices });
            if (!res.success) {
              showToast(`Gagal: ${res.error}`, 'error');
              return;
            }
          } else {
            await deleteRow('pesanan', {
              match: {
                DATE: date,
                DAPUR: targetName,
              },
              deleteAllMatches: true,
            });
          }

          setOrders((prev) =>
            prev.filter(
              (o) => !((o.toko === targetName || o.tujuanDapur === targetName) && o.tanggal === date)
            )
          );
          showToast('Semua pesanan berhasil dihapus permanen', 'delete');

          // REFETCH
          await loadSpreadsheetData(false);
        } catch (err: any) {
          console.error('Error deleting kitchen orders:', err);
          showToast(`Gagal: ${err?.message || err}`, 'error');
        } finally {
          setIsSyncingGas(false);
          setConfirmState(null);
        }
      },
    });
  };

  const handleOpenEditOrder = (item: OrderItem) => {
    setEditingOrder(item);
    setPrefilledKitchen(item.tujuanDapur);
    setIsOrderModalOpen(true);
  };

  const handleOpenAddModal = (kitchenName?: string) => {
    setEditingOrder(null);
    setPrefilledKitchen(kitchenName);
    setIsOrderModalOpen(true);
  };

  // Highlight Notes Handlers: Ketika dicentang, langsung otomatis masuk sebagai pesanan!
  const handleToggleNoteStatus = async (noteId: string) => {
    const target = notes.find((n) => n.id === noteId);
    if (!target) return;
    const newDone = !target.isDone;

    if (newDone) {
      // Dicentang / Follow Up Selesai -> Langsung Masuk Sebagai Pesanan
      const itemName = target.namaBarang?.trim() || target.catatan?.trim() || 'Barang dari Catatan';
      const itemQty = target.qty && target.qty > 0 ? target.qty : 1;
      const itemSatuan = target.satuan || 'Kg';
      const targetDapur = target.tujuanDapur || kitchens[0]?.nama || 'Siliragung';
      const targetToko = stores[0]?.nama || 'HTG';
      const targetPemasok = pemasokList[0] || 'Pemasok 1';
      const targetTanggal = selectedDate || new Date().toISOString().split('T')[0];

      // Cari perkiraan harga dari riwayat jika barang pernah dipesan sebelumnya
      const prevOrderWithPrice = orders.find(
        (o) => o.namaBarang.toLowerCase() === itemName.toLowerCase() && (o.hargaBeli > 0 || o.hargaJual > 0)
      );
      const autoHargaBeli = prevOrderWithPrice?.hargaBeli || 0;
      const autoHargaJual = prevOrderWithPrice?.hargaJual || 0;

      const newOrderFromNote: OrderItem = {
        id: `ord-from-note-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        namaBarang: itemName,
        qty: itemQty,
        hargaBeli: autoHargaBeli,
        hargaJual: autoHargaJual,
        toko: targetToko,
        tujuanDapur: targetDapur,
        pemasok: targetPemasok,
        status: 'pending',
        paymentStatus: 'UNPAID',
        deliveryStatus: 'PENDING',
        tanggal: targetTanggal,
        createdAt: new Date().toISOString(),
        catatan: `Dari Catatan: ${target.catatan || itemName} (${itemQty} ${itemSatuan})`,
      };

      // 1. Masukkan ke pesanan langsung
      setOrders((prev) => [newOrderFromNote, ...prev]);

      // 2. Tandai status note menjadi Done & simpan referensi orderId
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, isDone: true, orderId: newOrderFromNote.id } : n))
      );

      showToast(`Catatan dicentang: Langsung MASUK JADI PESANAN (${itemName} - ${itemQty} ${itemSatuan})!`, 'success');

      // 3. Sinkronisasi ke Google Sheets sheet "pesanan"
      setIsSyncingGas(true);
      addRow('pesanan', buildPesananPayload(newOrderFromNote))
        .then((orderRes) => {
          if (!orderRes.success) {
            enqueueSync({
              type: 'add_row',
              sheet: 'pesanan',
              payload: buildPesananPayload(newOrderFromNote),
              description: `Tambah pesanan dari note: ${itemName}`
            });
          }
        })
        .catch((err) => {
          enqueueSync({
            type: 'add_row',
            sheet: 'pesanan',
            payload: buildPesananPayload(newOrderFromNote),
            description: `Tambah pesanan dari note: ${itemName}`
          });
        })
        .finally(() => setIsSyncingGas(false));

      // 4. Sinkronisasi perubahan status ke sheet "notes"
      updateRow(
        'notes',
        {
          ID: target.id,
          CATATAN: target.catatan,
          DAPUR: target.tujuanDapur,
        },
        {
          STATUS: 'DONE',
        }
      ).then((res) => {
        if (!res.success) {
          enqueueSync({
            type: 'update_row',
            sheet: 'notes',
            match: { ID: target.id, CATATAN: target.catatan, DAPUR: target.tujuanDapur },
            data: { STATUS: 'DONE' },
            description: `Status note DONE: ${target.catatan}`
          });
        }
      }).catch((err) => {
        enqueueSync({
          type: 'update_row',
          sheet: 'notes',
          match: { ID: target.id, CATATAN: target.catatan, DAPUR: target.tujuanDapur },
          data: { STATUS: 'DONE' },
          description: `Status note DONE: ${target.catatan}`
        });
      });

    } else {
      // Batal centang / Kembalikan ke Follow Up
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, isDone: false } : n))
      );
      showToast('Status catatan dikembalikan ke Follow Up', 'info');

      // Sync perubahan status ke sheet "notes"
      updateRow(
        'notes',
        {
          ID: target.id,
          CATATAN: target.catatan,
          DAPUR: target.tujuanDapur,
        },
        {
          STATUS: 'FOLLOW UP',
        }
      ).then((res) => {
        if (!res.success) {
          enqueueSync({
            type: 'update_row',
            sheet: 'notes',
            match: { ID: target.id, CATATAN: target.catatan, DAPUR: target.tujuanDapur },
            data: { STATUS: 'FOLLOW UP' },
            description: `Status note FOLLOW UP: ${target.catatan}`
          });
        }
      }).catch((err) => {
        enqueueSync({
          type: 'update_row',
          sheet: 'notes',
          match: { ID: target.id, CATATAN: target.catatan, DAPUR: target.tujuanDapur },
          data: { STATUS: 'FOLLOW UP' },
          description: `Status note FOLLOW UP: ${target.catatan}`
        });
      });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const target = notes.find((n) => n.id === noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    showToast('Catatan follow up dihapus', 'delete');

    if (target) {
      const res = await deleteRow('notes', {
        ID: target.id,
        CATATAN: target.catatan,
        DAPUR: target.tujuanDapur,
      });
      if (!res.success) {
        enqueueSync({
          type: 'delete_row',
          sheet: 'notes',
          options: {
            ID: target.id,
            CATATAN: target.catatan,
            DAPUR: target.tujuanDapur,
          },
          description: `Hapus note: ${target.catatan}`
        });
      }
    }
  };

  const handleSaveNote = async (noteData: Omit<NoteItem, 'id' | 'createdAt'>) => {
    const newNote: NoteItem = {
      ...noteData,
      id: `note-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    // Save locally immediately
    setNotes((prev) => [newNote, ...prev]);
    showToast('Catatan follow up berhasil disimpan', 'success');

    // 2-Way Sync to Google Sheets sheet "notes"
    const res = await addRow('notes', buildNotesPayload(newNote));
    if (!res.success) {
      enqueueSync({
        type: 'add_row',
        sheet: 'notes',
        payload: buildNotesPayload(newNote),
        description: `Tambah note: ${newNote.catatan}`
      });
    }
  };

  // Voice Assistant: Edit existing order by spoken commodity name
  const handleEditOrderVoice = (params: {
    targetBarang: string;
    targetDapur?: string;
    newQty?: number;
    newSatuan?: string;
    newHargaBeli?: number;
    newHargaJual?: number;
  }): boolean => {
    const lowerTarget = params.targetBarang.toLowerCase().trim();
    if (!lowerTarget) return false;

    // Search matching order in current list (prefer pending or newest)
    const found = orders.find((o) => {
      const oName = o.namaBarang.toLowerCase();
      const matchBarang = oName.includes(lowerTarget) || lowerTarget.includes(oName);
      if (!matchBarang) return false;
      if (params.targetDapur) {
        return o.tujuanDapur.toLowerCase().includes(params.targetDapur.toLowerCase());
      }
      return true;
    });

    if (!found) return false;

    const updated: OrderItem = {
      ...found,
      qty: params.newQty !== undefined ? params.newQty : found.qty,
      satuan: params.newSatuan || found.satuan,
      hargaBeli: params.newHargaBeli !== undefined ? params.newHargaBeli : found.hargaBeli,
      hargaJual: params.newHargaJual !== undefined ? params.newHargaJual : found.hargaJual,
    };

    handleSaveOrder(updated, found.id);
    showToast(`Pesanan "${found.namaBarang}" berhasil diperbarui`, 'success');
    return true;
  };

  // Mobile Notification Engine: checks every 30s for scheduled daily report reminder
  React.useEffect(() => {
    const checkNotificationSchedule = () => {
      const settings = getNotificationSettings();
      if (!settings.enabled || !settings.dailyReportReminder) return;

      const now = new Date();
      // WIB Timezone UTC+7
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const wibDate = new Date(utc + 3600000 * 7);
      const hours = String(wibDate.getHours()).padStart(2, '0');
      const minutes = String(wibDate.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${hours}:${minutes}`;
      const todayStr = wibDate.toISOString().split('T')[0];

      if (
        settings.dailyReminderTime === currentTimeStr &&
        settings.lastDailyNotifiedDate !== todayStr
      ) {
        const todayOrders = orders.filter((o) => o.tanggal === todayStr);
        const totalOmset = todayOrders.reduce((sum, o) => sum + Number(o.qty || 0) * Number(o.hargaJual || o.hargaBeli || 0), 0);
        const totalBeli = todayOrders.reduce((sum, o) => sum + Number(o.qty || 0) * Number(o.hargaBeli || 0), 0);
        const totalLaba = totalOmset - totalBeli;

        sendDailyReportNotification(todayOrders.length, totalOmset, totalLaba);
        saveNotificationSettings({
          ...settings,
          lastDailyNotifiedDate: todayStr,
        });
      }
    };

    const interval = setInterval(checkNotificationSchedule, 30000);
    return () => clearInterval(interval);
  }, [orders]);

  // 1-Click Instant Invoice PDF Download (Requirement #3)
  // No recipient form/preview popup: auto fills recipient with Dapur name, '-' for phone/address,
  // and immediately downloads the PDF!
  const handleDirect1ClickExportInvoicePdf = async (
    items: OrderItem[],
    kitchenName: string,
    storeName: string,
    dateStr?: string
  ) => {
    if (!items || items.length === 0) {
      showToast('Tidak ada item untuk dibuatkan invoice', 'error');
      return;
    }

    setIsExportingActive(true);
    const targetKitchen = kitchenName || items[0]?.tujuanDapur || 'Siliragung';
    const targetStore = storeName || items[0]?.toko || 'HTG';
    const invNum = generateInvoiceNumber(targetKitchen);

    const totalAmount = items.reduce(
      (sum, item) => sum + parseIndonesianNumber(item.qty) * parseIndonesianNumber(item.hargaJual || item.hargaBeli || 0),
      0
    );

    try {
      const res = await exportHtmlInvoicePdf({
        storeName: targetStore,
        kitchenName: targetKitchen,
        items: items,
        invoiceNumber: invNum,
        bayar: totalAmount,
        customNama: targetKitchen, // Auto recipient = Dapur name
        customAlamat: '-',         // Auto address = '-'
        customNomor: '-',          // Auto phone = '-'
        customTanggal: dateStr,
      });

      if (res && res.pdfUrl) {
        const newHistoryItem: ExportHistoryItem = {
          id: `exp-${Date.now()}`,
          invoiceNumber: invNum,
          toko: targetStore,
          tujuanDapur: targetKitchen,
          totalAmount,
          totalJual: totalAmount,
          itemCount: items.length,
          tanggal: dateStr || new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          fileName: res.fileName,
          fileUrl: res.pdfUrl,
          pdfUrl: res.pdfUrl,
          type: 'pdf',
          fileType: 'pdf',
        };

        setExportHistory((prev) => [newHistoryItem, ...prev]);

        // Auto save invoice record
        const totalBeli = items.reduce((s, i) => s + i.qty * (i.hargaBeli || 0), 0);
        const totalJual = items.reduce((s, i) => s + i.qty * (i.hargaJual || i.hargaBeli || 0), 0);
        const newRecord: InvoiceRecord = {
          id: `inv-rec-${Date.now()}`,
          invoiceNumber: invNum,
          tanggalPrint: new Date().toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
          createdAt: new Date().toISOString(),
          tujuanDapur: targetKitchen,
          toko: targetStore,
          items: items,
          totalBeli,
          totalJual,
          totalProfit: totalJual - totalBeli,
        };
        setInvoices((prev) => [newRecord, ...prev]);

        // Async sync to Google Sheets
        addRow('transaksi', buildTransaksiPayload(newRecord)).catch(() => {});

        showToast(`Invoice Dapur ${targetKitchen} berhasil diunduh (${res.fileName})!`, 'success');
      }
    } catch (err: any) {
      console.error('Direct PDF export error:', err);
      showToast(`Gagal export PDF: ${err?.message || err}`, 'error');
    } finally {
      setIsExportingActive(false);
    }
  };

  // Handlers for Invoice
  // Step 1: Open Confirmation Form Modal when print icon (🖨) is clicked
  const handleStartInvoiceFlow = (
    items: OrderItem[],
    kitchenName?: string,
    storeName?: string,
    _dateStr?: string
  ) => {
    if (items.length === 0) {
      alert('Tidak ada item untuk dibuatkan invoice');
      return;
    }

    const mainKitchen = kitchenName || items[0]?.tujuanDapur;
    const mainStore = storeName || items[0]?.toko;
    const mainDate = _dateStr || items[0]?.tanggal;

    const normStore = (mainStore || '').trim().toLowerCase();
    const normKitchen = (mainKitchen || '').trim().toLowerCase();

    // Strict filter for store + kitchen + date
    const scopedItems = items.filter((item) => {
      const matchStore = !normStore || item.toko.trim().toLowerCase() === normStore;
      const matchKitchen = !normKitchen || item.tujuanDapur.trim().toLowerCase() === normKitchen;
      const matchDate = !mainDate || item.tanggal === mainDate;
      return matchStore && matchKitchen && matchDate;
    });

    const finalItems = scopedItems.length > 0 ? scopedItems : items;

    setInvoiceFormItems(finalItems);
    setInvoiceFormKitchen(mainKitchen);
    setInvoiceFormStore(mainStore);
    setIsInvoiceFormOpen(true);
  };

  // Step 2: Confirmed form, proceed to Preview Invoice Modal
  const handleConfirmInvoiceForm = (data: {
    items: OrderItem[];
    kitchenName: string;
    storeName: string;
    recipientName: string;
    address: string;
    phone: string;
    bayar: number;
  }) => {
    setIsInvoiceFormOpen(false);

    setInvoiceRecipientName(data.recipientName);
    setInvoiceRecipientAddress(data.address);
    setInvoiceRecipientPhone(data.phone);
    setInvoiceBayar(data.bayar);

    const invNum = generateInvoiceNumber(data.kitchenName);

    setInvoiceItems(data.items);
    setInvoiceNumber(invNum);
    setInvoiceTargetKitchen(data.kitchenName);
    setInvoiceTargetStore(data.storeName);
    setIsInvoiceModalOpen(true);
  };

  const handleSaveInvoiceRecord = async () => {
    if (invoices.some((inv) => inv.invoiceNumber === invoiceNumber)) return;

    const totalBeli = invoiceItems.reduce((s, i) => s + i.qty * (i.hargaBeli || 0), 0);
    const totalJual = invoiceItems.reduce((s, i) => s + i.qty * (i.hargaJual || i.hargaBeli || 0), 0);
    const newRecord: InvoiceRecord = {
      id: `inv-rec-${Date.now()}`,
      invoiceNumber,
      tanggalPrint: new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      createdAt: new Date().toISOString(),
      tujuanDapur: invoiceTargetKitchen || invoiceItems[0]?.tujuanDapur || 'Dapur',
      toko: invoiceTargetStore || invoiceItems[0]?.toko || 'HTG',
      items: invoiceItems,
      totalBeli,
      totalJual,
      totalProfit: totalJual - totalBeli,
    };

    setIsSyncingGas(true);
    const txData = buildTransaksiPayload(newRecord);
    const res = await addRow('transaksi', txData);
    setIsSyncingGas(false);

    // ALWAYS save invoice record locally so data is never lost
    setInvoices((prev) => [newRecord, ...prev]);

    if (res.success) {
      showToast('Invoice & Transaksi tersimpan ke Google Sheets', 'success');
    } else {
      setGasError(res.error || 'Gagal koneksi ke Google Sheets');
      showToast(`Invoice TERSIMPAN DI HP/LOKAL! (Gagal sync Google Sheets: ${res.error || 'Error'})`, 'error');
    }
  };

  // Background Export Handler (Requirement #4)
  const handleTriggerBackgroundExport = async (options: {
    storeName: string;
    kitchenName: string;
    items: OrderItem[];
    invoiceNumber: string;
    bayar: number;
    customNama: string;
    customAlamat: string;
    customNomor: string;
    type: 'pdf' | 'docx';
  }) => {
    setIsExportingActive(true);

    const totalAmount = options.items.reduce(
      (sum, item) => sum + parseIndonesianNumber(item.qty) * parseIndonesianNumber(item.hargaJual || item.hargaBeli || 0),
      0
    );

    try {
      if (options.type === 'pdf') {
        const res = await exportHtmlInvoicePdf({
          storeName: options.storeName,
          kitchenName: options.kitchenName,
          items: options.items,
          invoiceNumber: options.invoiceNumber,
          bayar: options.bayar,
          customNama: options.customNama,
          customAlamat: options.customAlamat,
          customNomor: options.customNomor,
        });

        if (res && res.pdfUrl) {
          const newHistoryItem: ExportHistoryItem = {
            id: `exp-${Date.now()}`,
            invoiceNumber: options.invoiceNumber,
            toko: options.storeName,
            tujuanDapur: options.kitchenName,
            totalAmount,
            totalJual: totalAmount,
            itemCount: options.items.length,
            tanggal: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            fileName: res.fileName,
            fileUrl: res.pdfUrl,
            pdfUrl: res.pdfUrl,
            type: 'pdf',
            fileType: 'pdf',
          };

          setExportHistory((prev) => [newHistoryItem, ...prev]);
          showToast(`Invoice ${options.invoiceNumber} berhasil dicetak! Klik ikon Download di atas untuk melihat/unduh.`, 'success');
        }
      } else {
        await downloadDocxInvoice({
          storeName: options.storeName,
          kitchenName: options.kitchenName,
          items: options.items,
          invoiceNumber: options.invoiceNumber,
          bayar: options.bayar,
          customNama: options.customNama,
          customAlamat: options.customAlamat,
          customNomor: options.customNomor,
        });

        const newHistoryItem: ExportHistoryItem = {
          id: `exp-${Date.now()}`,
          invoiceNumber: options.invoiceNumber,
          toko: options.storeName,
          tujuanDapur: options.kitchenName,
          totalAmount,
          totalJual: totalAmount,
          itemCount: options.items.length,
          tanggal: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          fileName: `Invoice_${options.invoiceNumber}.docx`,
          type: 'docx',
          fileType: 'docx',
        };

        setExportHistory((prev) => [newHistoryItem, ...prev]);
        showToast(`File Word Invoice ${options.invoiceNumber} siap!`, 'success');
      }
    } catch (err: any) {
      console.error('Background Export Error:', err);
      showToast(`Gagal export: ${err?.message || err}`, 'error');
    } finally {
      setIsExportingActive(false);
    }
  };

  const handleDeleteTransaction = (batch: any) => {
    const batchDesc = `${batch.toko || batch.tujuanDapur || 'Transaksi'} (${batch.tanggal})`;
    setConfirmState({
      isOpen: true,
      title: 'Konfirmasi Hapus Transaksi',
      message: `Yakin hapus transaksi untuk ${batchDesc}? Data di sheet transaksi dan sheet pesanan di Google Sheets akan dihapus permanen.`,
      onConfirm: async () => {
        setIsSyncingGas(true);
        setConfirmState((prev) => (prev ? { ...prev, isLoading: true } : null));

        try {
          // 1. Google Sheets sync: Delete matching items from sheet "pesanan"
          if (batch.items && batch.items.length > 0) {
            const rowIndicesToDelete = batch.items
              .map((it: any) => it.rowIndex)
              .filter((idx: any) => typeof idx === 'number' && idx >= 2);

            if (rowIndicesToDelete.length > 0) {
              await deleteRow('pesanan', {
                rowIndices: rowIndicesToDelete,
              });
            } else {
              await deleteRow('pesanan', {
                match: {
                  DATE: batch.tanggal,
                  DAPUR: batch.tujuanDapur,
                  TOKO: batch.toko,
                },
                deleteAllMatches: true,
              });
            }
          } else {
            await deleteRow('pesanan', {
              match: {
                DATE: batch.tanggal,
                DAPUR: batch.tujuanDapur,
                TOKO: batch.toko,
              },
              deleteAllMatches: true,
            });
          }

          // 2. Delete from sheet "transaksi"
          const txMatch: Record<string, any> = {
            TANGGAL: batch.tanggal,
          };
          if (batch.pemasok) txMatch.PEMASOK = batch.pemasok;
          if (batch.toko) txMatch.TOKO = batch.toko;
          if (batch.items && batch.items.length > 0 && batch.items[0].namaBarang) {
            txMatch.BARANG = batch.items[0].namaBarang;
          }

          const resTx = await deleteRow('transaksi', {
            rowIndex: batch.rowIndex,
            match: txMatch,
          });

          if (!resTx.success) {
            console.warn('Gagal hapus di sheet transaksi:', resTx.error);
          }

          // 3. BARU update local state setelah backend konfirmasi selesai
          const batchItemIds = new Set((batch.items || []).map((it: any) => it.id));
          setInvoices((prev) =>
            prev.filter((inv) => {
              if (inv.id === batch.id) return false;
              const invDate = inv.tanggalPrint || inv.tanggal;
              if (
                invDate === batch.tanggal &&
                (inv.toko || '') === (batch.toko || '') &&
                (inv.pemasok || '') === (batch.pemasok || '')
              ) {
                return false;
              }
              return true;
            })
          );

          setOrders((prev) =>
            prev.filter((o) => {
              if (batchItemIds.has(o.id)) return false;
              if (
                o.tanggal === batch.tanggal &&
                (o.toko === batch.toko || o.tujuanDapur === batch.tujuanDapur) &&
                o.pemasok === batch.pemasok
              ) {
                return false;
              }
              return true;
            })
          );

          showToast(`Transaksi ${batchDesc} berhasil dihapus permanen`, 'delete');

          // 4. REFETCH ulang seluruh data dari spreadsheet agar baris yang bergeser terupdate
          await loadSpreadsheetData(false);
        } catch (err: any) {
          console.error('Error syncing delete transaction:', err);
          showToast(`Gagal menghapus transaksi: ${err?.message || err}`, 'error');
        } finally {
          setIsSyncingGas(false);
          setConfirmState(null);
        }
      },
    });
  };

  const handleDeleteInvoice = (id: string) => {
    const targetInvoice = invoices.find((inv) => inv.id === id);
    const desc = targetInvoice?.invoiceNumber || targetInvoice?.toko || 'transaksi ini';

    setConfirmState({
      isOpen: true,
      title: 'Konfirmasi Hapus Transaksi',
      message: `Yakin hapus transaksi "${desc}"? Baris akan dihapus permanen dari sheet transaksi di Google Sheets.`,
      onConfirm: async () => {
        setIsSyncingGas(true);
        setConfirmState((prev) => (prev ? { ...prev, isLoading: true } : null));

        try {
          if (targetInvoice) {
            const res = await deleteRow('transaksi', {
              rowIndex: targetInvoice.rowIndex,
              match: {
                TANGGAL: targetInvoice.tanggalPrint || targetInvoice.tanggal,
                TOKO: targetInvoice.toko,
                PEMASOK: targetInvoice.pemasok,
              },
            });

            if (!res.success) {
              showToast(`Gagal menghapus transaksi dari Google Sheets: ${res.error || 'Terjadi kesalahan'}`, 'error');
              return;
            }
          }

          // BARU update local state setelah backend sukses
          setInvoices((prev) => prev.filter((inv) => inv.id !== id));
          showToast('Transaksi berhasil dihapus permanen', 'delete');

          // REFETCH
          await loadSpreadsheetData(false);
        } catch (e: any) {
          console.warn('Error deleting invoice from sheet:', e);
          showToast(`Gagal menghapus: ${e?.message || 'Error'}`, 'error');
        } finally {
          setIsSyncingGas(false);
          setConfirmState(null);
        }
      },
    });
  };

  const handleDeleteAllData = () => {
    setOrders([]);
    setInvoices([]);
    setExportHistory([]);
    setNotes([]);
    showToast('Seluruh data pesanan, transaksi, dan catatan berhasil dihapus bersih', 'delete');
  };

  // Handlers for WhatsApp Text Import
  const handleImportParsedItems = async (parsedResults: TextParseResult[], targetDate: string) => {
    const newOrdersAdded: OrderItem[] = parsedResults.map((res, index) => ({
      id: `ord-imp-${Date.now()}-${index}`,
      namaBarang: res.namaBarang,
      qty: res.qty,
      hargaBeli: res.hargaBeli,
      hargaJual: res.hargaJual,
      toko: res.toko || stores[0]?.nama || 'HTG',
      tujuanDapur: res.tujuanDapur || kitchens[0]?.nama || 'Dapur',
      pemasok: res.pemasok || pemasokList[0] || 'Pemasok 1',
      status: 'pending',
      tanggal: targetDate || selectedDate,
      createdAt: new Date().toISOString(),
    }));

    // Local-First: ALWAYS save imported items locally first
    setOrders((prev) => [...newOrdersAdded, ...prev]);

    setIsSyncingGas(true);
    let successCount = 0;
    let lastError = '';

    for (let index = 0; index < newOrdersAdded.length; index++) {
      const newOrderItem = newOrdersAdded[index];
      const saveRes = await addRow('pesanan', buildPesananPayload(newOrderItem));

      if (saveRes.success) {
        successCount++;
      } else {
        lastError = saveRes.error || 'Gagal menyimpan ke Google Sheets';
        enqueueSync({
          type: 'add_row',
          sheet: 'pesanan',
          payload: buildPesananPayload(newOrderItem),
          description: `Import ${newOrderItem.namaBarang}`
        });
      }
    }

    setIsSyncingGas(false);

    if (successCount === newOrdersAdded.length) {
      showToast(`${successCount} item import tersimpan ke Google Sheets & aktif di semua perangkat`, 'success');
    } else {
      setGasError(lastError);
      showToast(`${newOrdersAdded.length} item import tersimpan di HP. Otomatis diunggah ke Google Sheets saat ada internet agar terlihat di perangkat lain!`, 'info');
    }
  };

  // Horizontal Swipe Gesture threshold logic
  const handleDragEnd = (_: any, info: { offset: { x: number; y: number }; velocity: { x: number } }) => {
    const swipeThreshold = 60;
    if (Math.abs(info.offset.x) > Math.abs(info.offset.y)) {
      if (info.offset.x < -swipeThreshold && activeTab === 'dashboard') {
        setActiveTab('transaksi');
      } else if (info.offset.x > swipeThreshold && activeTab === 'transaksi') {
        setActiveTab('dashboard');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white pb-36 sm:pb-24">
      {/* Top Header Banner with Live Stats, Duo-card, Highlight Notes, Download Icon & Sync Bottom Sheet Trigger */}
      {activeTab === 'dashboard' && (
        <HeaderBanner
          orders={orders}
          selectedDate={selectedDate}
          notes={notes}
          kitchens={kitchens}
          period={dashboardPeriod}
          onPeriodChange={setDashboardPeriod}
          onToggleNoteStatus={handleToggleNoteStatus}
          onDeleteNote={handleDeleteNote}
          onOpenNewNoteSheet={(startVoice) => {
            setAutoStartVoiceNote(!!startVoice);
            setIsNoteSheetOpen(true);
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenExportHistory={() => setIsExportHistoryOpen(true)}
          onOpenSyncSheet={() => setIsSyncSheetOpen(true)}
          isSyncingGas={isSyncingGas}
          isExportingActive={isExportingActive}
          exportHistoryCount={exportHistory.length}
          pendingSyncCount={pendingQueueCount}
          isOnline={isOnline}
          onStartVoiceHold={() => setIsSmartVoiceActive(true)}
          onStopVoiceHold={() => {}}
          isVoiceActive={isSmartVoiceActive}
        />
      )}

      {/* Main Content Body */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-4 pt-2 pb-24 sm:pb-8">
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
          className="w-full touch-pan-y"
        >
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <DashboardView
                  orders={orders}
                  invoices={invoices}
                  isLoading={isSyncingGas}
                  kitchens={kitchens}
                  stores={stores}
                  pemasokList={pemasokList}
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  period={dashboardPeriod}
                  onPeriodChange={setDashboardPeriod}
                  onToggleStatus={handleToggleStatus}
                  onUpdatePaymentStatus={handleUpdatePaymentStatus}
                  onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
                  onUpdateGroupPaymentStatus={handleUpdateGroupPaymentStatus}
                  onUpdateGroupDeliveryStatus={handleUpdateGroupDeliveryStatus}
                  onEditOrder={handleOpenEditOrder}
                  onDuplicateOrder={handleDuplicateOrder}
                  onDeleteOrder={handleDeleteOrder}
                  onDeleteBatchOrders={handleDeleteBatchOrders}
                  onOpenInvoiceModal={handleStartInvoiceFlow}
                  onExportInvoicePdf={handleDirect1ClickExportInvoicePdf}
                  onOpenTextImport={() => setIsTextImportOpen(true)}
                  onOpenExportModal={() => setIsExportOpen(true)}
                  onOpenAddModal={() => handleOpenAddModal()}
                />
              </motion.div>
            ) : (
              <motion.div
                key="transaksi"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <TransactionsView
                  invoices={invoices}
                  orders={orders}
                  isLoading={isSyncingGas}
                  kitchens={kitchens}
                  stores={stores}
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  period={dashboardPeriod}
                  onPeriodChange={setDashboardPeriod}
                  onToggleStatus={handleToggleStatus}
                  onUpdatePaymentStatus={handleUpdatePaymentStatus}
                  onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
                  onUpdateGroupPaymentStatus={handleUpdateGroupPaymentStatus}
                  onUpdateGroupDeliveryStatus={handleUpdateGroupDeliveryStatus}
                  onToggleBatchStatus={handleToggleBatchStatus}
                  onEditOrder={handleOpenEditOrder}
                  onDuplicateOrder={handleDuplicateOrder}
                  onDeleteOrder={handleDeleteOrder}
                  onDeleteKitchenOrders={handleDeleteKitchenOrders}
                  onOpenInvoiceModal={handleStartInvoiceFlow}
                  onExportInvoicePdf={handleDirect1ClickExportInvoicePdf}
                  onDeleteInvoice={handleDeleteInvoice}
                  onDeleteTransaction={handleDeleteTransaction}
                  onOpenAddModal={handleOpenAddModal}
                  onOpenSettings={(tab) => {
                    if (tab) setSettingsInitialTab(tab);
                    setIsSettingsOpen(true);
                  }}
                  onOpenExportHistory={() => setIsExportHistoryOpen(true)}
                  isExportingActive={isExportingActive}
                  exportHistoryCount={exportHistory.length}
                  onOpenSyncSheet={() => setIsSyncSheetOpen(true)}
                  pendingSyncCount={pendingQueueCount}
                  isOnline={isOnline}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      {/* Fixed Sticky Bottom Navigation Bar (Hidden temporarily while Voice Assistant is active) */}
      <AnimatePresence>
        {!isSmartVoiceActive && (
          <motion.div
            key="bottom-nav-bar"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.2 }}
          >
            <BottomNav
              activeTab={activeTab}
              onChangeTab={setActiveTab}
              onOpenAddModal={() => handleOpenAddModal()}
              onStartVoiceHold={() => setIsSmartVoiceActive(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart Live Voice Order Assistant (Takes over bottom area with live animation) */}
      <SmartVoiceOrderOverlay
        isActive={isSmartVoiceActive}
        onClose={() => setIsSmartVoiceActive(false)}
        onOrderCreated={(newOrder) => {
          handleSaveOrder(newOrder);
          sendNewOrderNotification(newOrder.namaBarang, newOrder.qty, newOrder.satuan, newOrder.tujuanDapur);
        }}
        onNoteCreated={(note) => {
          handleSaveNote({
            catatan: note.text,
            tujuanDapur: note.dapur || kitchens[0]?.nama || 'Cluring',
            isDone: false,
          });
        }}
        onEditOrderVoice={handleEditOrderVoice}
        kitchens={kitchens}
        stores={stores}
        pemasokList={pemasokList}
        selectedDate={selectedDate}
      />

      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Confirm Delete Modal */}
      {confirmState && (
        <ConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          isLoading={confirmState.isLoading}
          onConfirm={confirmState.onConfirm}
          onCancel={() => {
            if (!confirmState.isLoading) {
              setConfirmState(null);
            }
          }}
        />
      )}

      {/* 0. Highlight Note Tab Bar Sheet Form */}
      <NoteSheet
        isOpen={isNoteSheetOpen}
        onClose={() => {
          setIsNoteSheetOpen(false);
          setAutoStartVoiceNote(false);
        }}
        onSave={handleSaveNote}
        kitchens={kitchens}
        existingItemNames={Array.from(new Set(orders.map((o) => o.namaBarang)))}
        autoStartVoice={autoStartVoiceNote}
      />

      {/* 1. Add / Edit Order Tab Bar Sheet */}
      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => {
          setIsOrderModalOpen(false);
          setEditingOrder(null);
          setPrefilledKitchen(undefined);
        }}
        onSave={handleSaveOrder}
        initialData={editingOrder}
        prefilledKitchen={prefilledKitchen}
        kitchens={kitchens}
        stores={stores}
        pemasokList={pemasokList}
        masterToko={masterToko}
        masterPemasok={masterPemasok}
        masterDapur={masterDapur}
        onRefreshMaster={refreshMasterData}
        selectedDate={selectedDate}
        existingOrders={orders}
      />

      {/* 2. Invoice Form (Step 1 Confirmation Bottom Sheet) */}
      <InvoiceFormModal
        isOpen={isInvoiceFormOpen}
        onClose={() => setIsInvoiceFormOpen(false)}
        items={invoiceFormItems}
        kitchenName={invoiceFormKitchen}
        storeName={invoiceFormStore}
        kitchens={kitchens}
        onConfirm={handleConfirmInvoiceForm}
      />

      {/* 3. Invoice Preview & Export (Step 2 Bottom Sheet) */}
      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        invoiceNumber={invoiceNumber}
        items={invoiceItems}
        tujuanDapur={invoiceTargetKitchen}
        toko={invoiceTargetStore}
        recipientName={invoiceRecipientName}
        recipientAddress={invoiceRecipientAddress}
        recipientPhone={invoiceRecipientPhone}
        bayarAmount={invoiceBayar}
        onTriggerBackgroundExport={handleTriggerBackgroundExport}
        onSaveInvoiceRecord={handleSaveInvoiceRecord}
      />

      {/* 4. Text Import (WhatsApp Parser) Modal */}
      <TextImportModal
        isOpen={isTextImportOpen}
        onClose={() => setIsTextImportOpen(false)}
        onImportItems={handleImportParsedItems}
        kitchens={kitchens}
        stores={stores}
        pemasokList={pemasokList}
        selectedDate={selectedDate}
      />

      {/* 5. Export Spreadsheet (.xlsx & .csv) Bottom Sheet */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        orders={orders}
        selectedDate={selectedDate}
        onExportSuccess={(fileName) => {
          showToast(`Laporan ${fileName} berhasil diunduh!`, 'success');
        }}
      />

      {/* 6. Export History & Download Bottom Sheet */}
      <ExportHistorySheet
        isOpen={isExportHistoryOpen}
        onClose={() => setIsExportHistoryOpen(false)}
        history={exportHistory}
        onDeleteHistoryItem={(id) => {
          setExportHistory((prev) => prev.filter((item) => item.id !== id));
          showToast('Riwayat item dihapus', 'delete');
        }}
        onClearHistory={() => {
          setExportHistory([]);
          showToast('Riwayat export berhasil dibersihkan', 'success');
        }}
        isExportingActive={isExportingActive}
      />

      {/* 7. Google Sheets Sync Bottom Sheet */}
      <SyncBottomSheet
        isOpen={isSyncSheetOpen}
        onClose={() => setIsSyncSheetOpen(false)}
        ordersCount={orders.length}
        invoicesCount={invoices.length}
        notesCount={notes.length}
        onTriggerSync={() => loadSpreadsheetData(true)}
        isSyncing={isSyncingGas}
        syncError={gasError}
        lastSyncedTime={lastSyncedTime}
        pendingQueueCount={pendingQueueCount}
        isDeviceOnline={isOnline}
        onProcessQueue={() => handleProcessQueueAndSync(true)}
        onOpenSettings={() => {
          setIsSyncSheetOpen(false);
          setIsSettingsOpen(true);
        }}
      />

      {/* 8. Settings Bottom Sheet */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab={settingsInitialTab}
        kitchens={kitchens}
        onUpdateKitchens={setKitchens}
        stores={stores}
        onUpdateStores={setStores}
        pemasokList={pemasokList}
        onUpdatePemasok={setPemasokList}
        orders={orders}
        onUpdateOrders={setOrders}
        onDeleteAllData={handleDeleteAllData}
        onRefreshData={refreshMasterData}
      />
    </div>
  );
}
