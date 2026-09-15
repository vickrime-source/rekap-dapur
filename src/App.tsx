import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  MasterDapur,
  MasterSatuan
} from './types';
import { 
  INITIAL_KITCHENS, 
  INITIAL_STORES, 
  INITIAL_PEMASOK 
} from './constants/initialData';
import { HeaderBanner } from './components/HeaderBanner';
import { BottomNav, TabType } from './components/BottomNav';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { OrderModal } from './components/OrderModal';
import { NoteSheet } from './components/NoteSheet';
import { FollowUpNoteModal } from './components/FollowUpNoteModal';
import { InvoiceModal } from './components/InvoiceModal';
import { InvoiceFormModal } from './components/InvoiceFormModal';
import { TextImportModal } from './components/TextImportModal';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { ConfirmModal } from './components/ConfirmModal';
import { ExportHistorySheet } from './components/ExportHistorySheet';
import { SmartVoiceOrderOverlay } from './components/SmartVoiceOrderOverlay';
import { Toast, ToastMessage, ToastType } from './components/Toast';
import { generateInvoiceNumber, parseIndonesianNumber, getTodayWIB, getNowWIBISOString } from './lib/formatters';
import { 
  fetchOrdersFromDb,
  saveOrderToDb,
  saveOrdersBatchToDb,
  updateOrderInDb,
  batchUpdateStatusInDb,
  deleteOrderFromDb,
  deleteOrdersFromDb,
  fetchTransactionsFromDb,
  saveTransactionToDb,
  deleteTransactionFromDb,
  fetchNotesFromDb,
  saveNoteToDb,
  updateNoteInDb,
  deleteNoteFromDb,
  fetchMasterTokoFromDb, 
  fetchMasterPemasokFromDb, 
  fetchMasterDapurFromDb,
  fetchMasterSatuanFromDb,
  saveMasterSatuanToDb 
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
  // Pure in-memory orders state populated ONLY from Supabase (never from localStorage)
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [kitchens, setKitchens] = useLocalStorage<Kitchen[]>('dapur_tracker_kitchens_v4', INITIAL_KITCHENS);
  const [stores, setStores] = useLocalStorage<StoreType[]>('dapur_tracker_stores_v4', INITIAL_STORES);
  const [pemasokList, setPemasokList] = useLocalStorage<string[]>('dapur_tracker_pemasok_v4', INITIAL_PEMASOK);
  const [invoices, setInvoices] = useLocalStorage<InvoiceRecord[]>('dapur_tracker_invoices_v4', []);
  const [exportHistory, setExportHistory] = useLocalStorage<ExportHistoryItem[]>('dapur_export_history_v1', []);
  const [notes, setNotes] = useLocalStorage<NoteItem[]>('dapur_highlight_notes_v1', []);
  const [dashboardPeriod, setDashboardPeriod] = useLocalStorage<DashboardPeriod>('dapur_dashboard_period_v2', 'mingguan');

  // Purge legacy cached orders and old dummy master data from localStorage and sessionStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('dapur_tracker_orders_v4');
        window.localStorage.removeItem('dapur_tracker_orders');
        
        // Check if cached pemasok contains old dummy data (Pemasok 1/2/3/4)
        const cachedPemasok = window.localStorage.getItem('dapur_tracker_pemasok_v4');
        if (cachedPemasok && (cachedPemasok.includes('Pemasok 1') || cachedPemasok.includes('Pemasok 2'))) {
          window.localStorage.removeItem('dapur_tracker_pemasok_v4');
          setPemasokList(INITIAL_PEMASOK);
        }
        window.localStorage.removeItem('dapur_tracker_pemasok');

        Object.keys(window.sessionStorage || {}).forEach((key) => {
          if (key.includes('pesanan') || key.includes('order') || key.includes('pemasok')) {
            window.sessionStorage.removeItem(key);
          }
        });
      }
    } catch {
      // ignore storage access errors
    }
  }, []);

  // Supabase Database Sync State
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Export background tracking state
  const [isExportingActive, setIsExportingActive] = useState(false);
  const [isExportHistoryOpen, setIsExportHistoryOpen] = useState(false);
  const [isNoteSheetOpen, setIsNoteSheetOpen] = useState(false);
  const [autoStartVoiceNote, setAutoStartVoiceNote] = useState(false);

  // Master Data State (PostgreSQL Master Tables: Toko, Pemasok, Dapur, Satuan)
  const [masterToko, setMasterToko] = useState<MasterToko[]>([]);
  const [masterPemasok, setMasterPemasok] = useState<MasterPemasok[]>([]);
  const [masterDapur, setMasterDapur] = useState<MasterDapur[]>([]);
  const [masterSatuan, setMasterSatuan] = useState<MasterSatuan[]>([]);

  const refreshMasterData = async () => {
    try {
      const [tokoRes, pemasokRes, dapurRes, satuanRes] = await Promise.all([
        fetchMasterTokoFromDb(),
        fetchMasterPemasokFromDb(),
        fetchMasterDapurFromDb(),
        fetchMasterSatuanFromDb(),
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
      if (satuanRes.success && satuanRes.data) {
        setMasterSatuan(satuanRes.data);
      }
    } catch (e) {
      console.warn('Error refreshing master data from Supabase:', e);
    }
  };

  const handleAddMasterSatuan = async (nama: string): Promise<{ success: boolean; error?: string }> => {
    const res = await saveMasterSatuanToDb(nama);
    if (res.success) {
      await refreshMasterData();
      showToast(`Satuan "${nama}" berhasil disimpan ke Master`, 'success');
      return { success: true };
    }
    return { success: false, error: res.error || 'Gagal menyimpan satuan' };
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

  // Fetch Supabase data
  const loadDatabaseData = async (showToastNotice = false) => {
    if (isFetchingDataRef.current) return;
    isFetchingDataRef.current = true;
    setIsLoadingDb(true);
    setDbError(null);
    try {
      const [ordersRes, txRes, notesRes] = await Promise.all([
        fetchOrdersFromDb({ forceRefresh: showToastNotice }),
        fetchTransactionsFromDb(100, 1, showToastNotice),
        fetchNotesFromDb(showToastNotice),
      ]);

      let loadedOrdersCount = 0;
      let loadedInvoicesCount = 0;
      let loadedNotesCount = 0;

      if (ordersRes.success && Array.isArray(ordersRes.orders)) {
        setOrders(ordersRes.orders);
        loadedOrdersCount = ordersRes.orders.length;
      }

      if (txRes.success && Array.isArray(txRes.transactions)) {
        setInvoices(txRes.transactions);
        loadedInvoicesCount = txRes.transactions.length;
      }

      if (notesRes.success && Array.isArray(notesRes.notes)) {
        setNotes(notesRes.notes);
        loadedNotesCount = notesRes.notes.length;
      }

      const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setLastSyncedTime(`Pukul ${nowStr}`);

      if (ordersRes.error && txRes.error && notesRes.error) {
        const errText = ordersRes.error || txRes.error || notesRes.error || 'Gagal koneksi ke database Supabase';
        setDbError(errText);
        if (showToastNotice) {
          showToast(`Gagal: ${errText}`, 'error');
        }
      } else if (showToastNotice) {
        showToast(`Berhasil memuat ${loadedOrdersCount} pesanan, ${loadedNotesCount} catatan & ${loadedInvoicesCount} transaksi dari Supabase!`, 'success');
      }
    } catch (err: any) {
      console.warn('Gagal memuat data dari Supabase (menggunakan mode data lokal HP):', err);
      setDbError(err?.message || 'Gagal koneksi ke Supabase');
      if (showToastNotice) {
        showToast(`Gagal: ${err?.message || 'Tidak dapat terhubung'}`, 'error');
      }
    } finally {
      setIsLoadingDb(false);
      isFetchingDataRef.current = false;
    }
  };

  React.useEffect(() => {
    loadDatabaseData();
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
    if (pemasokList.some((p) => p.startsWith('Pemasok ') || ['HTG', 'PROHE', 'LUWENG BOGA', 'ADIFRUITA'].includes(p))) {
      setPemasokList(INITIAL_PEMASOK);
    }

    let needUpdate = false;
    const updatedOrders = orders.map((o) => {
      let toko = o.toko;
      let pemasok = o.pemasok;
      let itemChanged = false;

      if (['HTG', 'PROHE', 'LUWENG BOGA', 'ADIFRUITA'].includes(o.pemasok)) {
        toko = o.pemasok;
        pemasok = INITIAL_PEMASOK[0];
        itemChanged = true;
      }
      if (['Toko 1', 'Toko 2', 'Toko 3', 'Toko 4'].includes(o.toko)) {
        toko = 'HTG';
        itemChanged = true;
      }
      if (['Toko 1', 'Toko 2', 'Toko 3', 'Toko 4', 'Pemasok 1', 'Pemasok 2', 'Pemasok 3', 'Pemasok 4'].includes(o.pemasok)) {
        pemasok = INITIAL_PEMASOK[0];
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

  // Follow Up Note Modal States
  const [followUpNoteTarget, setFollowUpNoteTarget] = useState<NoteItem | null>(null);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);

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
  const [invoiceInitialFullPreview, setInvoiceInitialFullPreview] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<OrderItem[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceTargetKitchen, setInvoiceTargetKitchen] = useState<string | undefined>();
  const [invoiceTargetStore, setInvoiceTargetStore] = useState<string | undefined>();

  const [isTextImportOpen, setIsTextImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'kelola_data' | 'dapur' | 'toko' | 'pemasok' | 'template' | 'notifikasi' | 'install' | 'danger'>('kelola_data');

  // Automatic multi-device & online listeners
  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Internet terhubung! Memperbarui data dari database...', 'info');
      loadDatabaseData(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('Mode offline aktif. Data tetap tersimpan aman di HP.', 'info');
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        loadDatabaseData(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);

    // Supabase Realtime subscription hemat egress
    let unsubscribePesanan: (() => void) | undefined;
    let unsubscribeNotes: (() => void) | undefined;
    let unsubscribeTransaksi: (() => void) | undefined;

    const setupRealtime = async () => {
      try {
        if (activeTab === 'dashboard' || activeTab === 'dapur' || activeTab === 'toko') {
          unsubscribePesanan = await subscribeToTableChanges('pesanan', () => {
            invalidateCache('pesanan');
            invalidateCache('summary');
            loadDatabaseData(false);
          });
          if (activeTab === 'dashboard') {
            unsubscribeNotes = await subscribeToTableChanges('notes', () => {
              invalidateCache('notes');
              loadDatabaseData(false);
            });
          }
        } else if (activeTab === 'transaksi') {
          unsubscribeTransaksi = await subscribeToTableChanges('transaksi', () => {
            invalidateCache('transaksi');
            loadDatabaseData(false);
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
      document.removeEventListener('visibilitychange', handleVisibility);
      if (unsubscribePesanan) unsubscribePesanan();
      if (unsubscribeNotes) unsubscribeNotes();
      if (unsubscribeTransaksi) unsubscribeTransaksi();
    };
  }, [activeTab]);

  // Memoized unique item names from existing orders for auto-suggest
  const existingItemNames = useMemo(
    () => Array.from(new Set(orders.map((o) => o.namaBarang))),
    [orders]
  );

  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Handlers for Order CRUD
  const handleToggleStatus = useCallback((id: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, status: o.status === 'pending' ? 'selesai' : 'pending' } : o
      )
    );
  }, []);

  const handleUpdatePaymentStatus = useCallback(async (id: string, paymentStatus: PaymentStatus) => {
    let targetOrder: OrderItem | undefined;
    let newStatus: 'pending' | 'selesai' = 'pending';

    setOrders((prev) => {
      targetOrder = prev.find((o) => o.id === id);
      if (!targetOrder) return prev;
      const delStatus = targetOrder.deliveryStatus || (targetOrder.status === 'selesai' ? 'DONE' : 'PENDING');
      newStatus = paymentStatus === 'PAID' && delStatus === 'DONE' ? 'selesai' : 'pending';

      return prev.map((o) => {
        if (o.id !== id) return o;
        return {
          ...o,
          paymentStatus,
          status: newStatus,
        };
      });
    });

    // Sync to Supabase
    const res = await updateOrderInDb(id, {
      paymentStatus,
      status: newStatus,
    });
    if (!res.success) {
      setDbError(res.error || 'Gagal update status pembayaran');
      showToast(`Gagal update status pembayaran: ${res.error}`, 'error');
    } else {
      showToast(`Status pembayaran berhasil diperbarui (${paymentStatus})`, 'success');
    }
  }, []);

  const handleUpdateDeliveryStatus = useCallback(async (id: string, deliveryStatus: DeliveryStatus) => {
    let targetOrder: OrderItem | undefined;
    let newStatus: 'pending' | 'selesai' = 'pending';

    setOrders((prev) => {
      targetOrder = prev.find((o) => o.id === id);
      if (!targetOrder) return prev;
      const payStatus = targetOrder.paymentStatus || (targetOrder.status === 'selesai' ? 'PAID' : 'UNPAID');
      newStatus = payStatus === 'PAID' && deliveryStatus === 'DONE' ? 'selesai' : 'pending';

      return prev.map((o) => {
        if (o.id !== id) return o;
        return {
          ...o,
          deliveryStatus,
          status: newStatus,
        };
      });
    });

    // Sync to Supabase
    const res = await updateOrderInDb(id, {
      deliveryStatus,
      status: newStatus,
    });
    if (!res.success) {
      setDbError(res.error || 'Gagal update status pengiriman');
      showToast(`Gagal update status pengiriman: ${res.error}`, 'error');
    } else {
      showToast(`Status pengiriman berhasil diperbarui (${deliveryStatus})`, 'success');
    }
  }, []);

  const handleUpdateGroupPaymentStatus = useCallback(async (groupItems: OrderItem[], paymentStatus: PaymentStatus) => {
    if (!groupItems || groupItems.length === 0) return;
    const targetIds = groupItems.map((it) => it.id);
    const targetIdsSet = new Set(targetIds);

    setOrders((prev) =>
      prev.map((o) => {
        if (!targetIdsSet.has(o.id)) return o;
        const delStatus = o.deliveryStatus || (o.status === 'selesai' ? 'DONE' : 'PENDING');
        const newStatus = paymentStatus === 'PAID' && delStatus === 'DONE' ? 'selesai' : 'pending';
        return {
          ...o,
          paymentStatus,
          status: newStatus,
        };
      })
    );

    // Sync to Supabase
    const res = await batchUpdateStatusInDb(targetIds, {
      paymentStatus,
      status: paymentStatus === 'PAID' ? 'selesai' : 'pending',
    });
    if (!res.success) {
      setDbError(res.error || 'Gagal update pembayaran grup');
      showToast(`Gagal update grup: ${res.error}`, 'error');
    } else {
      showToast(`Status pembayaran grup berhasil diperbarui (${paymentStatus})`, 'success');
    }
  }, []);

  const handleUpdateGroupDeliveryStatus = useCallback(async (groupItems: OrderItem[], deliveryStatus: DeliveryStatus) => {
    if (!groupItems || groupItems.length === 0) return;
    const targetIds = groupItems.map((it) => it.id);
    const targetIdsSet = new Set(targetIds);

    setOrders((prev) =>
      prev.map((o) => {
        if (!targetIdsSet.has(o.id)) return o;
        const payStatus = o.paymentStatus || (o.status === 'selesai' ? 'PAID' : 'UNPAID');
        const newStatus = payStatus === 'PAID' && deliveryStatus === 'DONE' ? 'selesai' : 'pending';
        return {
          ...o,
          deliveryStatus,
          status: newStatus,
        };
      })
    );

    // Sync to Supabase
    const res = await batchUpdateStatusInDb(targetIds, {
      deliveryStatus,
      status: deliveryStatus === 'DONE' ? 'selesai' : 'pending',
    });
    if (!res.success) {
      setDbError(res.error || 'Gagal update pengiriman grup');
      showToast(`Gagal update pengiriman grup: ${res.error}`, 'error');
    } else {
      showToast(`Status pengiriman grup berhasil diperbarui (${deliveryStatus})`, 'success');
    }
  }, []);

  const handleDuplicateOrder = useCallback(async (item: OrderItem) => {
    const duplicated: OrderItem = {
      ...item,
      id: `ord-dup-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: getNowWIBISOString(),
    };

    setOrders((prev) => [duplicated, ...prev]);

    setIsLoadingDb(true);
    const res = await saveOrderToDb(duplicated);
    setIsLoadingDb(false);

    if (res.success) {
      showToast('Pesanan berhasil diduplikasi & tersimpan', 'success');
    } else {
      setDbError(res.error || 'Gagal menyimpan pesanan');
      showToast(`Pesanan tersimpan di HP. Gagal simpan ke database: ${res.error}`, 'info');
    }
  }, []);

  const handleToggleBatchStatus = useCallback((targetName: string, date: string, targetStatus: 'pending' | 'selesai') => {
    setOrders((prev) =>
      prev.map((o) =>
        (o.toko === targetName || o.tujuanDapur === targetName) && o.tanggal === date
          ? { ...o, status: targetStatus }
          : o
      )
    );
  }, []);

  const handleSaveOrder = async (
    orderData: Omit<OrderItem, 'id' | 'createdAt'> | Array<Omit<OrderItem, 'id' | 'createdAt'>>,
    editId?: string
  ) => {
    if (editId && !Array.isArray(orderData)) {
      const oldOrder = orders.find((o) => o.id === editId);
      const curToko = (orderData as any).toko || oldOrder?.toko || '';
      const curPemasok = (orderData as any).pemasok || oldOrder?.pemasok || '';
      const curDapur = (orderData as any).tujuanDapur || oldOrder?.tujuanDapur || '';
      const cleanD = curDapur.replace(/^dapur\s+/i, '').trim().toLowerCase();

      const fTokoId = (orderData as any).toko_id || (orderData as any).tokoId || masterToko.find((t) => t.nama.toLowerCase() === curToko.trim().toLowerCase())?.id || oldOrder?.toko_id || '';
      const fPemasokId = (orderData as any).pemasok_id || (orderData as any).pemasokId || masterPemasok.find((p) => p.nama.toLowerCase() === curPemasok.trim().toLowerCase())?.id || oldOrder?.pemasok_id || '';
      const fDapurId = (orderData as any).dapur_id || (orderData as any).dapurId || masterDapur.find((d) => d.nama.toLowerCase() === curDapur.trim().toLowerCase() || d.nama.toLowerCase() === cleanD)?.id || oldOrder?.dapur_id || '';

      const updatedOrder: OrderItem = {
        ...(oldOrder || {}),
        ...orderData,
        toko_id: fTokoId,
        tokoId: fTokoId,
        pemasok_id: fPemasokId,
        pemasokId: fPemasokId,
        dapur_id: fDapurId,
        dapurId: fDapurId,
        id: editId,
        createdAt: oldOrder?.createdAt || getNowWIBISOString(),
      } as OrderItem;

      setOrders((prev) =>
        prev.map((o) => (o.id === editId ? updatedOrder : o))
      );
      showToast('Pesanan berhasil diperbarui', 'edit');

      // Sync update to Supabase
      setIsLoadingDb(true);
      const res = await updateOrderInDb(editId, updatedOrder);
      setIsLoadingDb(false);
      if (!res.success) {
        setDbError(res.error || 'Gagal update pesanan di Supabase');
        showToast(`Pesanan diperbarui di HP. Gagal simpan ke database: ${res.error}`, 'info');
      } else {
        showToast('Pesanan berhasil diperbarui & tersimpan', 'edit');
      }
      return;
    }

    const itemsToAdd = Array.isArray(orderData) ? orderData : [orderData];
    const createdDate = getNowWIBISOString();

    const newOrdersAdded: OrderItem[] = itemsToAdd.map((item, idx) => {
      const curToko = (item as any).toko || '';
      const curPemasok = (item as any).pemasok || '';
      const curDapur = (item as any).tujuanDapur || '';
      const cleanD = curDapur.replace(/^dapur\s+/i, '').trim().toLowerCase();

      const fTokoId = (item as any).toko_id || (item as any).tokoId || masterToko.find((t) => t.nama.toLowerCase() === curToko.trim().toLowerCase())?.id || '';
      const fPemasokId = (item as any).pemasok_id || (item as any).pemasokId || masterPemasok.find((p) => p.nama.toLowerCase() === curPemasok.trim().toLowerCase())?.id || '';
      const fDapurId = (item as any).dapur_id || (item as any).dapurId || masterDapur.find((d) => d.nama.toLowerCase() === curDapur.trim().toLowerCase() || d.nama.toLowerCase() === cleanD)?.id || '';

      return {
        ...item,
        tanggal: item.tanggal ? String(item.tanggal).split('T')[0] : getTodayWIB(),
        toko_id: fTokoId,
        tokoId: fTokoId,
        pemasok_id: fPemasokId,
        pemasokId: fPemasokId,
        dapur_id: fDapurId,
        dapurId: fDapurId,
        id: `ord-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        createdAt: createdDate,
      };
    });

    setOrders((prev) => [...newOrdersAdded, ...prev]);
    if (newOrdersAdded[0]?.tanggal) {
      setSelectedDate(newOrdersAdded[0].tanggal);
    }

    setIsLoadingDb(true);
    let successCount = 0;
    let lastError = '';

    const batchRes = await saveOrdersBatchToDb(newOrdersAdded);
    if (batchRes.success) {
      successCount = newOrdersAdded.length;
    } else {
      lastError = batchRes.error || 'Gagal menyimpan pesanan ke database';
    }

    // Save transaction if orders were added
    if (newOrdersAdded.length > 0) {
      const firstItem = newOrdersAdded[0];
      const totalBeli = newOrdersAdded.reduce((sum, it) => sum + Number(it.qty || 0) * Number(it.hargaBeli || 0), 0);
      const totalJual = newOrdersAdded.reduce((sum, it) => sum + Number(it.qty || 0) * Number(it.hargaJual || it.hargaBeli || 0), 0);
      const newInvoiceRec: InvoiceRecord = {
        id: `tx-${Date.now()}`,
        invoiceNumber: `TRX-${Date.now().toString().slice(-6)}`,
        tanggal: firstItem.tanggal,
        tanggalPrint: firstItem.tanggal,
        createdAt: createdDate,
        tujuanDapur: firstItem.tujuanDapur,
        dapur_id: firstItem.dapur_id || (firstItem as any).dapurId,
        toko: firstItem.toko,
        toko_id: firstItem.toko_id || (firstItem as any).tokoId,
        items: newOrdersAdded,
        totalBeli,
        totalJual,
        totalProfit: totalJual - totalBeli,
        pemasok: firstItem.pemasok,
        pemasok_id: firstItem.pemasok_id || (firstItem as any).pemasokId,
        status: firstItem.paymentStatus || 'UNPAID',
      };
      setInvoices((prev) => [newInvoiceRec, ...prev]);
      await saveTransactionToDb(newInvoiceRec);
    }

    setIsLoadingDb(false);

    if (successCount === newOrdersAdded.length) {
      showToast(`${successCount} pesanan berhasil tersimpan`, 'success');
    } else {
      setDbError(lastError);
      showToast(`${newOrdersAdded.length} pesanan tersimpan di HP. Error sync: ${lastError}`, 'info');
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
      message: `Yakin hapus data ${desc}? Data akan dihapus secara permanen.`,
      onConfirm: async () => {
        setIsLoadingDb(true);
        setConfirmState((prev) => (prev ? { ...prev, isLoading: true } : null));

        try {
          if (targetOrder) {
            const res = await deleteOrderFromDb(targetOrder.id);
            if (!res.success) {
              showToast(`Gagal menghapus dari database: ${res.error || 'Terjadi kesalahan'}`, 'error');
              setDbError(res.error || 'Gagal menghapus data');
              return;
            }
            setOrders((prev) => prev.filter((o) => o.id !== id));

            // SINKRONISASI KE LOG TRANSAKSI:
            // Cek apakah ada pesanan lain yang tersisa di kelompok/batch transaksi ini
            const remainingOrdersInBatch = orders.filter(
              (o) =>
                o.id !== id &&
                o.tanggal === targetOrder.tanggal &&
                o.toko === targetOrder.toko &&
                o.tujuanDapur === targetOrder.tujuanDapur &&
                (o.pemasok || '') === (targetOrder.pemasok || '')
            );

            // Cari invoice terkait
            const matchingInvoices = invoices.filter((inv) => {
              if (inv.id === id) return true;
              if (inv.items && Array.isArray(inv.items) && inv.items.some((it) => it.id === id)) return true;
              const invDate = inv.tanggal || (inv.tanggalPrint && /^\d{4}-\d{2}-\d{2}$/.test(inv.tanggalPrint) ? inv.tanggalPrint : (inv.items?.[0]?.tanggal || ''));
              const invToko = inv.toko || inv.items?.[0]?.toko || '';
              const invDapur = inv.tujuanDapur || inv.items?.[0]?.tujuanDapur || '';
              const invPemasok = inv.pemasok || inv.items?.[0]?.pemasok || '';

              return (
                invDate === targetOrder.tanggal &&
                invToko === targetOrder.toko &&
                (!targetOrder.tujuanDapur || invDapur === targetOrder.tujuanDapur) &&
                (!targetOrder.pemasok || invPemasok === targetOrder.pemasok)
              );
            });

            if (remainingOrdersInBatch.length === 0) {
              // Jika ini order terakhir dalam transaksi, hapus seluruh transaksi terkait dari DB & state
              if (matchingInvoices.length > 0) {
                const invoiceIdsToDelete = matchingInvoices.map((inv) => inv.id).filter(Boolean);
                for (const invId of invoiceIdsToDelete) {
                  await deleteTransactionFromDb(invId);
                }
                const delIdsSet = new Set(invoiceIdsToDelete);
                setInvoices((prev) => prev.filter((inv) => !delIdsSet.has(inv.id)));
              }
            } else {
              // Jika masih ada item lain, perbarui item array di invoice
              setInvoices((prev) =>
                prev.map((inv) => {
                  if (inv.items && Array.isArray(inv.items) && inv.items.some((it) => it.id === id)) {
                    const filteredItems = inv.items.filter((it) => it.id !== id);
                    const newTotalBeli = filteredItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.hargaBeli) || 0), 0);
                    const newTotalJual = filteredItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.hargaJual || it.hargaBeli) || 0), 0);
                    return {
                      ...inv,
                      items: filteredItems,
                      totalBeli: newTotalBeli,
                      totalJual: newTotalJual,
                      totalProfit: newTotalJual - newTotalBeli,
                    };
                  }
                  return inv;
                })
              );
            }

            showToast(`Pesanan "${targetOrder.namaBarang}" berhasil dihapus`, 'delete');
          } else if (targetInvoice) {
            const resInv = await deleteTransactionFromDb(targetInvoice.id);
            if (!resInv.success) {
              showToast(`Gagal menghapus transaksi: ${resInv.error || 'Terjadi kesalahan'}`, 'error');
              setDbError(resInv.error || 'Gagal menghapus transaksi');
              return;
            }
            setInvoices((prev) => prev.filter((inv) => inv.id !== targetInvoice.id));
            showToast('Transaksi berhasil dihapus', 'delete');
          } else {
            setOrders((prev) => prev.filter((o) => o.id !== id));
            showToast('Item berhasil dihapus', 'delete');
          }
        } catch (err: any) {
          console.error('Error in handleDeleteOrder:', err);
          showToast(`Gagal menghapus: ${err?.message || 'Error tidak diketahui'}`, 'error');
        } finally {
          setIsLoadingDb(false);
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
      message: `Yakin hapus seluruh pesanan (${items.length} item) untuk ${desc}? Log transaksi terkait juga akan dihapus.`,
      onConfirm: async () => {
        setIsLoadingDb(true);
        setConfirmState((prev) => (prev ? { ...prev, isLoading: true } : null));

        try {
          const ids = items.map((it) => it.id);
          const res = await deleteOrdersFromDb(ids);
          if (!res.success) {
            showToast(`Gagal menghapus dari database: ${res.error || 'Terjadi kesalahan'}`, 'error');
            return;
          }

          const itemIds = new Set(ids);
          setOrders((prev) => prev.filter((o) => !itemIds.has(o.id)));

          // SINKRONISASI KE LOG TRANSAKSI:
          // Cari dan hapus seluruh invoice/transaksi yang berelasi dengan batch ini
          const batchTanggal = first.tanggal;
          const batchToko = first.toko || '';
          const batchDapur = first.tujuanDapur || '';
          const batchPemasok = first.pemasok || '';

          const matchingInvoices = invoices.filter((inv) => {
            if (itemIds.has(inv.id)) return true;
            if (inv.items && Array.isArray(inv.items) && inv.items.some((it) => itemIds.has(it.id))) return true;

            const invDate = inv.tanggal || (inv.tanggalPrint && /^\d{4}-\d{2}-\d{2}$/.test(inv.tanggalPrint) ? inv.tanggalPrint : (inv.items?.[0]?.tanggal || ''));
            const invToko = inv.toko || inv.items?.[0]?.toko || '';
            const invDapur = inv.tujuanDapur || inv.items?.[0]?.tujuanDapur || '';
            const invPemasok = inv.pemasok || inv.items?.[0]?.pemasok || '';

            return (
              invDate === batchTanggal &&
              invToko === batchToko &&
              (!batchDapur || invDapur === batchDapur) &&
              (!batchPemasok || invPemasok === batchPemasok)
            );
          });

          if (matchingInvoices.length > 0) {
            const invoiceIdsToDelete = matchingInvoices.map((inv) => inv.id).filter(Boolean);
            for (const invId of invoiceIdsToDelete) {
              await deleteTransactionFromDb(invId);
            }
            const delIdsSet = new Set(invoiceIdsToDelete);
            setInvoices((prev) => prev.filter((inv) => !delIdsSet.has(inv.id)));
          }

          showToast(`${items.length} pesanan & transaksi terkait berhasil dihapus`, 'delete');
        } catch (err: any) {
          console.error('Error handleDeleteBatchOrders:', err);
          showToast(`Gagal menghapus pesanan: ${err?.message || err}`, 'error');
        } finally {
          setIsLoadingDb(false);
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
      message: `Hapus semua pesanan (${matchingOrders.length} item) untuk ${targetName} pada tanggal ${date}? Data akan dihapus permanen.`,
      onConfirm: async () => {
        setIsLoadingDb(true);
        setConfirmState((prev) => (prev ? { ...prev, isLoading: true } : null));

        try {
          const ids = matchingOrders.map((o) => o.id);
          if (ids.length > 0) {
            const res = await deleteOrdersFromDb(ids);
            if (!res.success) {
              showToast(`Gagal: ${res.error}`, 'error');
              return;
            }

            const itemIds = new Set(ids);
            // Hapus juga transaksi/invoice terkait dari state & database
            const matchingInvoices = invoices.filter((inv) => {
              if (itemIds.has(inv.id)) return true;
              const invDate = inv.tanggal || (inv.tanggalPrint && /^\d{4}-\d{2}-\d{2}$/.test(inv.tanggalPrint) ? inv.tanggalPrint : (inv.items?.[0]?.tanggal || ''));
              const invToko = inv.toko;
              const invDapur = inv.tujuanDapur;
              return (
                invDate === date &&
                (invToko === targetName || invDapur === targetName)
              );
            });

            for (const inv of matchingInvoices) {
              if (inv.id) await deleteTransactionFromDb(inv.id);
            }
            const delIds = new Set(matchingInvoices.map((inv) => inv.id));
            setInvoices((prev) => prev.filter((inv) => !delIds.has(inv.id)));
          }

          setOrders((prev) =>
            prev.filter(
              (o) => !((o.toko === targetName || o.tujuanDapur === targetName) && o.tanggal === date)
            )
          );
          showToast('Semua pesanan berhasil dihapus', 'delete');
        } catch (err: any) {
          console.error('Error deleting kitchen orders:', err);
          showToast(`Gagal: ${err?.message || err}`, 'error');
        } finally {
          setIsLoadingDb(false);
          setConfirmState(null);
        }
      },
    });
  };

  const handleOpenEditOrder = useCallback((item: OrderItem) => {
    setEditingOrder(item);
    setPrefilledKitchen(item.tujuanDapur);
    setIsOrderModalOpen(true);
  }, []);

  const handleOpenAddModal = useCallback((kitchenName?: string) => {
    setEditingOrder(null);
    setPrefilledKitchen(kitchenName);
    setIsOrderModalOpen(true);
  }, []);

  // Highlight Follow Up Handlers: Buka Modal Follow Up untuk mengisi harga jual & beli
  const handleOpenFollowUpNote = (note: NoteItem) => {
    setFollowUpNoteTarget(note);
    setIsFollowUpModalOpen(true);
  };

  // Handler ketika form Follow Up selesai diisi (Transaction-Safe + Soft Completion)
  const handleCompleteFollowUpNote = async (data: {
    noteId: string;
    namaBarang: string;
    qty: number;
    satuan: string;
    toko: string;
    pemasok: string;
    tujuanDapur: string;
    hargaBeli: number;
    hargaJual: number;
    tanggal: string;
    catatanTambahan?: string;
  }) => {
    const targetNote = notes.find((n) => n.id === data.noteId);
    const targetTanggal = data.tanggal || selectedDate || getTodayWIB();

    const cleanD = data.tujuanDapur.replace(/^dapur\s+/i, '').trim().toLowerCase();
    const fTokoId = masterToko.find((t) => t.nama.toLowerCase() === data.toko.trim().toLowerCase())?.id || '';
    const fPemasokId = masterPemasok.find((p) => p.nama.toLowerCase() === data.pemasok.trim().toLowerCase())?.id || '';
    const fDapurId = masterDapur.find((d) => d.nama.toLowerCase() === data.tujuanDapur.trim().toLowerCase() || d.nama.toLowerCase() === cleanD)?.id || '';

    const newOrderFromNote: OrderItem = {
      id: `ord-from-note-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      namaBarang: data.namaBarang,
      qty: data.qty,
      satuan: data.satuan,
      hargaBeli: data.hargaBeli,
      hargaJual: data.hargaJual,
      toko: data.toko,
      toko_id: fTokoId,
      tokoId: fTokoId,
      tujuanDapur: data.tujuanDapur,
      dapur_id: fDapurId,
      dapurId: fDapurId,
      pemasok: data.pemasok,
      pemasok_id: fPemasokId,
      pemasokId: fPemasokId,
      status: 'pending',
      paymentStatus: 'UNPAID',
      deliveryStatus: 'PENDING',
      tanggal: targetTanggal,
      createdAt: new Date().toISOString(),
      catatan: data.catatanTambahan ? `Dari Catatan: ${data.catatanTambahan}` : `Dari Catatan: ${data.namaBarang} (${data.qty} ${data.satuan})`,
    };

    // Langkah 1: Buat dan simpan pesanan transaksi terlebih dahulu (Transaction-Safe)
    try {
      const saveRes = await saveOrderToDb(newOrderFromNote);
      if (saveRes && !saveRes.success && saveRes.error) {
        console.warn('Gagal menyimpan pesanan ke server, simpan di memori lokal:', saveRes.error);
      }
    } catch (err) {
      console.warn('Gagal membuat transaksi di database:', err);
    }

    // Langkah 2: Tambahkan ke state transaksi / pesanan lokal
    setOrders((prev) => [newOrderFromNote, ...prev]);

    // Langkah 3: Soft completion - tandai status follow up menjadi 'completed' (BUKAN delete)
    setNotes((prev) =>
      prev.map((n) =>
        n.id === data.noteId
          ? {
              ...n,
              isDone: true,
              status: 'completed',
              orderId: newOrderFromNote.id,
              namaBarang: data.namaBarang,
              qty: data.qty,
              satuan: data.satuan,
              toko: data.toko,
              pemasok: data.pemasok,
              tujuanDapur: data.tujuanDapur,
            }
          : n
      )
    );

    // Langkah 4: Update status follow up di database Supabase secara soft completion
    if (targetNote) {
      try {
        await updateNoteInDb(targetNote.id, {
          isDone: true,
          status: 'completed',
          orderId: newOrderFromNote.id,
          namaBarang: data.namaBarang,
          qty: data.qty,
          satuan: data.satuan,
          toko: data.toko,
          pemasok: data.pemasok,
          tujuanDapur: data.tujuanDapur,
        });
      } catch (err) {
        console.warn('Gagal memperbarui status follow up di Supabase:', err);
      }
    }

    showToast(
      `✓ Follow Up Berhasil: "${data.namaBarang}" (${data.qty} ${data.satuan}) telah masuk ke Transaksi Pesanan!`,
      'success'
    );
  };

  const handleToggleNoteStatus = async (noteId: string) => {
    const target = notes.find((n) => n.id === noteId);
    if (!target) return;

    if (!target.isDone) {
      // Jika belum selesai, buka modal follow up untuk mengisi harga
      handleOpenFollowUpNote(target);
    } else {
      // Kembalikan ke pending (soft toggle)
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, isDone: false, status: 'pending' } : n))
      );
      showToast('Status item dikembalikan ke Follow Up aktif', 'info');

      updateNoteInDb(target.id, {
        isDone: false,
        status: 'pending',
      });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const target = notes.find((n) => n.id === noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    showToast('Item follow up berhasil dihapus', 'delete');

    if (target) {
      await deleteNoteFromDb(target.id);
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
    showToast('Item follow up berhasil disimpan', 'success');

    // Sync to Supabase
    await saveNoteToDb(newNote);
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
  useEffect(() => {
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
        const currentOrders = ordersRef.current;
        let count = 0;
        let totalOmset = 0;
        let totalBeli = 0;
        for (let i = 0; i < currentOrders.length; i++) {
          const o = currentOrders[i];
          if (o.tanggal === todayStr) {
            count++;
            const qty = Number(o.qty || 0);
            const hb = Number(o.hargaBeli || 0);
            const hj = Number(o.hargaJual || hb || 0);
            totalOmset += qty * hj;
            totalBeli += qty * hb;
          }
        }
        const totalLaba = totalOmset - totalBeli;

        sendDailyReportNotification(count, totalOmset, totalLaba);
        saveNotificationSettings({
          ...settings,
          lastDailyNotifiedDate: todayStr,
        });
      }
    };

    const interval = setInterval(checkNotificationSchedule, 30000);
    return () => clearInterval(interval);
  }, []);

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

        // Async sync to Supabase
        saveTransactionToDb(newRecord).catch(() => {});

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
    setInvoiceInitialFullPreview(false);
    setIsInvoiceModalOpen(true);
  };

  // Handler for View-Only Preview (Eye Icon):
  // Opens the existing InvoiceModal directly in A4 HTML preview mode (view-only),
  // allowing user to inspect and screenshot/download PNG as transaction proof without triggering print dialog.
  const handleViewInvoice = useCallback((
    items: OrderItem[],
    kitchenName?: string,
    storeName?: string,
    _dateStr?: string
  ) => {
    if (!items || items.length === 0) {
      showToast('Tidak ada item untuk dilihat invoice-nya', 'error');
      return;
    }

    const targetKitchen = kitchenName || items[0]?.tujuanDapur || 'Siliragung';
    const targetStore = storeName || items[0]?.toko || 'HTG';
    const invNum = generateInvoiceNumber(targetKitchen);

    const totalAmount = items.reduce(
      (sum, item) => sum + parseIndonesianNumber(item.qty) * parseIndonesianNumber(item.hargaJual || item.hargaBeli || 0),
      0
    );

    setInvoiceRecipientName(targetKitchen);
    setInvoiceRecipientAddress('-');
    setInvoiceRecipientPhone('-');
    setInvoiceBayar(totalAmount);
    setInvoiceItems(items);
    setInvoiceNumber(invNum);
    setInvoiceTargetKitchen(targetKitchen);
    setInvoiceTargetStore(targetStore);
    setInvoiceInitialFullPreview(true);
    setIsInvoiceModalOpen(true);
  }, []);

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

    setIsLoadingDb(true);
    const res = await saveTransactionToDb(newRecord);
    setIsLoadingDb(false);

    // ALWAYS save invoice record locally so data is never lost
    setInvoices((prev) => [newRecord, ...prev]);

    if (res.success) {
      showToast('Invoice & Transaksi berhasil tersimpan', 'success');
    } else {
      setDbError(res.error || 'Gagal koneksi ke database');
      showToast(`Invoice tersimpan di HP. (Gagal sync: ${res.error || 'Error'})`, 'info');
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
      message: `Yakin hapus transaksi untuk ${batchDesc}? Data pesanan terkait juga akan dihapus.`,
      onConfirm: async () => {
        setIsLoadingDb(true);
        setConfirmState((prev) => (prev ? { ...prev, isLoading: true } : null));

        try {
          // 1. Delete associated orders from db if any
          const batchItemIds = (batch.items || []).map((it: any) => it.id).filter(Boolean);
          if (batchItemIds.length > 0) {
            await deleteOrdersFromDb(batchItemIds);
          }

          // 2. Delete transaction from db
          if (batch.id) {
            await deleteTransactionFromDb(batch.id);
          }

          // 3. Update local state
          const batchItemIdsSet = new Set(batchItemIds);
          setInvoices((prev) =>
            prev.filter((inv) => {
              if (inv.id === batch.id) return false;
              const invDate = inv.tanggal || (inv.tanggalPrint && /^\d{4}-\d{2}-\d{2}$/.test(inv.tanggalPrint) ? inv.tanggalPrint : (inv.items?.[0]?.tanggal || ''));
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
              if (batchItemIdsSet.has(o.id)) return false;
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

          showToast(`Transaksi ${batchDesc} berhasil dihapus`, 'delete');
        } catch (err: any) {
          console.error('Error deleting transaction:', err);
          showToast(`Gagal menghapus transaksi: ${err?.message || err}`, 'error');
        } finally {
          setIsLoadingDb(false);
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
      message: `Yakin hapus transaksi "${desc}"? Data akan dihapus secara permanen.`,
      onConfirm: async () => {
        setIsLoadingDb(true);
        setConfirmState((prev) => (prev ? { ...prev, isLoading: true } : null));

        try {
          if (targetInvoice) {
            const res = await deleteTransactionFromDb(targetInvoice.id);
            if (!res.success) {
              showToast(`Gagal menghapus transaksi: ${res.error || 'Terjadi kesalahan'}`, 'error');
              return;
            }
          }

          setInvoices((prev) => prev.filter((inv) => inv.id !== id));
          showToast('Transaksi berhasil dihapus', 'delete');
        } catch (e: any) {
          console.warn('Error deleting invoice:', e);
          showToast(`Gagal menghapus: ${e?.message || 'Error'}`, 'error');
        } finally {
          setIsLoadingDb(false);
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
      pemasok: res.pemasok || pemasokList[0] || 'Ajeng fruits',
      status: 'pending',
      tanggal: targetDate || selectedDate,
      createdAt: new Date().toISOString(),
    }));

    // Local-First: ALWAYS save imported items locally first
    setOrders((prev) => [...newOrdersAdded, ...prev]);

    setIsLoadingDb(true);
    let successCount = 0;
    let lastError = '';

    for (let index = 0; index < newOrdersAdded.length; index++) {
      const newOrderItem = newOrdersAdded[index];
      const saveRes = await saveOrderToDb(newOrderItem);

      if (saveRes.success) {
        successCount++;
      } else {
        lastError = saveRes.error || 'Gagal menyimpan pesanan';
      }
    }

    setIsLoadingDb(false);

    if (successCount === newOrdersAdded.length) {
      showToast(`${successCount} item import berhasil tersimpan`, 'success');
    } else {
      setDbError(lastError);
      showToast(`${newOrdersAdded.length} item import tersimpan di HP. Error sync: ${lastError}`, 'info');
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
          onFollowUpNote={handleOpenFollowUpNote}
          onDeleteNote={handleDeleteNote}
          onOpenNewNoteSheet={(startVoice) => {
            setAutoStartVoiceNote(!!startVoice);
            setIsNoteSheetOpen(true);
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenExportHistory={() => setIsExportHistoryOpen(true)}
          isSyncingGas={isLoadingDb}
          isExportingActive={isExportingActive}
          exportHistoryCount={exportHistory.length}
          pendingSyncCount={0}
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
                  isLoading={isLoadingDb}
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
                  onViewInvoice={handleViewInvoice}
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
                  isLoading={isLoadingDb}
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
                  onViewInvoice={handleViewInvoice}
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
        stores={stores}
        pemasokList={pemasokList}
        masterToko={masterToko}
        masterPemasok={masterPemasok}
        masterDapur={masterDapur}
        masterSatuan={masterSatuan}
        onAddMasterSatuan={handleAddMasterSatuan}
        onRefreshMaster={refreshMasterData}
        existingItemNames={existingItemNames}
        autoStartVoice={autoStartVoiceNote}
      />

      {/* 0.1 Follow Up Note Modal (Input Harga Jual & Beli -> Masuk ke Transaksi & Terhitung sebagai Pesanan) */}
      <FollowUpNoteModal
        isOpen={isFollowUpModalOpen}
        note={followUpNoteTarget}
        onClose={() => {
          setIsFollowUpModalOpen(false);
          setFollowUpNoteTarget(null);
        }}
        onDone={handleCompleteFollowUpNote}
        kitchens={kitchens}
        stores={stores}
        pemasokList={pemasokList}
        masterToko={masterToko}
        masterPemasok={masterPemasok}
        masterDapur={masterDapur}
        masterSatuan={masterSatuan}
        onAddMasterSatuan={handleAddMasterSatuan}
        onRefreshMaster={refreshMasterData}
        existingOrders={orders}
        selectedDate={selectedDate}
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
        masterSatuan={masterSatuan}
        onAddMasterSatuan={handleAddMasterSatuan}
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
        onClose={() => {
          setIsInvoiceModalOpen(false);
          setInvoiceInitialFullPreview(false);
        }}
        invoiceNumber={invoiceNumber}
        items={invoiceItems}
        tujuanDapur={invoiceTargetKitchen}
        toko={invoiceTargetStore}
        recipientName={invoiceRecipientName}
        recipientAddress={invoiceRecipientAddress}
        recipientPhone={invoiceRecipientPhone}
        bayarAmount={invoiceBayar}
        initialFullPreview={invoiceInitialFullPreview}
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

      {/* 7. Settings Bottom Sheet */}
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
