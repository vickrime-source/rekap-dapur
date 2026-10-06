import { useState, useRef, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { OrderItem, InvoiceRecord, NoteItem } from '../types';
import { TabType } from '../components/BottomNav';
import { 
  fetchOrdersFromDb, 
  fetchTransactionsFromDb, 
  fetchNotesFromDb 
} from '../lib/supabaseDb';
import { subscribeToTableChanges } from '../lib/supabaseClient';
import { invalidateCache } from '../lib/cacheManager';

interface UseDatabaseSyncProps {
  activeTab: TabType;
  setOrders: Dispatch<SetStateAction<OrderItem[]>>;
  setInvoices: Dispatch<SetStateAction<InvoiceRecord[]>>;
  setNotes: Dispatch<SetStateAction<NoteItem[]>>;
  showToast: (message: string, type?: 'success' | 'delete' | 'edit' | 'info' | 'error') => void;
}

export function useDatabaseSync({
  activeTab,
  setOrders,
  setInvoices,
  setNotes,
  showToast,
}: UseDatabaseSyncProps) {
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [lastSyncedTime, setLastSyncedTime] = useState<string | undefined>();
  const isFetchingDataRef = useRef(false);

  const loadDatabaseData = useCallback(async (showToastNotice = false) => {
    if (isFetchingDataRef.current) return;
    isFetchingDataRef.current = true;
    setIsLoadingDb(true);
    setDbError(null);
    try {
      const [ordersRes, txRes, notesRes] = await Promise.all([
        fetchOrdersFromDb({ forceRefresh: showToastNotice }),
        fetchTransactionsFromDb(500, 1, showToastNotice, true),
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
        showToast(
          `Berhasil memuat ${loadedOrdersCount} pesanan, ${loadedNotesCount} catatan & ${loadedInvoicesCount} transaksi dari Supabase!`,
          'success'
        );
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
  }, [setOrders, setInvoices, setNotes, showToast]);

  // Initial load
  useEffect(() => {
    loadDatabaseData();
  }, [loadDatabaseData]);

  // Automatic multi-device & online listeners + Supabase Realtime
  useEffect(() => {
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

    let unsubscribePesanan: (() => void) | undefined;
    let unsubscribeNotes: (() => void) | undefined;
    let unsubscribeTransaksi: (() => void) | undefined;

    const setupRealtime = async () => {
      try {
        if (activeTab === 'dashboard') {
          unsubscribePesanan = await subscribeToTableChanges('pesanan', () => {
            invalidateCache('pesanan');
            invalidateCache('summary');
            loadDatabaseData(false);
          });
          unsubscribeNotes = await subscribeToTableChanges('notes', () => {
            invalidateCache('notes');
            loadDatabaseData(false);
          });
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
  }, [activeTab, loadDatabaseData, showToast]);

  return {
    isLoadingDb,
    setIsLoadingDb,
    dbError,
    setDbError,
    isOnline,
    lastSyncedTime,
    loadDatabaseData,
  };
}
