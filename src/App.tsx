import React, { useState } from 'react';
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
  NoteItem
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
import { Toast, ToastMessage, ToastType } from './components/Toast';
import { generateInvoiceNumber, parseIndonesianNumber } from './lib/formatters';
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
import { downloadDocxInvoice } from './lib/docxTemplate';
import { exportHtmlInvoicePdf } from './lib/htmlInvoicePdf';
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

  // Google Sheets Sync State
  const [isSyncingGas, setIsSyncingGas] = useState(false);
  const [gasError, setGasError] = useState<string | null>(null);

  // Export background tracking state
  const [isExportingActive, setIsExportingActive] = useState(false);
  const [isExportHistoryOpen, setIsExportHistoryOpen] = useState(false);
  const [isSyncSheetOpen, setIsSyncSheetOpen] = useState(false);
  const [isNoteSheetOpen, setIsNoteSheetOpen] = useState(false);
  const [autoStartVoiceNote, setAutoStartVoiceNote] = useState(false);

  // Toast Notification State
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ id: `toast-${Date.now()}`, message, type });
  };

  const [lastSyncedTime, setLastSyncedTime] = useState<string | undefined>();

  // Fetch sheet data
  const loadSpreadsheetData = async (showToastNotice = false) => {
    setIsSyncingGas(true);
    setGasError(null);
    try {
      const [pesananRes, transaksiRes, notesRes] = await Promise.all([
        fetchSheetData<any>('pesanan'),
        fetchSheetData<any>('transaksi'),
        fetchSheetData<any>('notes'),
      ]);

      let loadedOrdersCount = 0;
      let loadedInvoicesCount = 0;
      let loadedNotesCount = 0;
      let hasAnySuccess = false;

      if (!pesananRes.error && Array.isArray(pesananRes.data) && pesananRes.data.length > 0) {
        const mappedOrders = pesananRes.data.map(mapRawOrder);
        setOrders(mappedOrders);
        loadedOrdersCount = mappedOrders.length;
        hasAnySuccess = true;
      }

      if (!transaksiRes.error && Array.isArray(transaksiRes.data) && transaksiRes.data.length > 0) {
        const mappedInvoices = transaksiRes.data.map(mapRawInvoice);
        setInvoices(mappedInvoices);
        loadedInvoicesCount = mappedInvoices.length;
        hasAnySuccess = true;
      }

      if (!notesRes.error && Array.isArray(notesRes.data) && notesRes.data.length > 0) {
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
    }
  };

  React.useEffect(() => {
    loadSpreadsheetData();
  }, []);

  // Confirm Modal State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    onConfirm: () => void;
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
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

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
      showToast(`Status lokal diubah (Gagal sync Sheets: ${res.error})`, 'error');
    } else {
      showToast(`Status pembayaran berhasil diperbarui (${paymentStatus})`, 'success');
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
      showToast(`Status lokal diubah (Gagal sync Sheets: ${res.error})`, 'error');
    } else {
      showToast(`Status pengiriman berhasil diperbarui (${deliveryStatus})`, 'success');
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
      showToast(`Status grup lokal diubah (Gagal sync Sheets: ${res.error})`, 'error');
    } else {
      showToast(`Status pembayaran grup berhasil diperbarui (${paymentStatus})`, 'success');
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
      showToast(`Status pengiriman grup lokal diubah (Gagal sync Sheets: ${res.error})`, 'error');
    } else {
      showToast(`Status pengiriman grup berhasil diperbarui (${deliveryStatus})`, 'success');
    }
  };

  const handleDuplicateOrder = async (item: OrderItem) => {
    const duplicated: OrderItem = {
      ...item,
      id: `ord-dup-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
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
      showToast(`Pesanan diduplikasi di HP/Lokal! (Gagal sync Google Sheets: ${res.error || '404 Error'})`, 'error');
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
        createdAt: oldOrder?.createdAt || new Date().toISOString(),
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
          showToast(`Gagal update di Spreadsheet: ${res.error}`, 'error');
        }
      }
      return;
    }

    const itemsToAdd = Array.isArray(orderData) ? orderData : [orderData];
    const createdDate = new Date().toISOString();

    const newOrdersAdded: OrderItem[] = itemsToAdd.map((item, idx) => ({
      ...item,
      id: `ord-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
      createdAt: createdDate,
    }));

    // Local-First: ALWAYS save new orders to local state & localStorage immediately
    setOrders((prev) => [...newOrdersAdded, ...prev]);

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
      if (txRes.success) {
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
      } else {
        console.warn('Gagal append ke sheet transaksi:', txRes.error);
      }
    }

    setIsSyncingGas(false);

    if (successCount === newOrdersAdded.length) {
      showToast(`${successCount} pesanan berhasil ditambahkan & tersimpan ke Google Sheets`, 'success');
    } else if (successCount > 0) {
      setGasError(lastError);
      showToast(`Tersimpan lokal. ${successCount}/${newOrdersAdded.length} terkirim ke Sheets (${lastError})`, 'error');
    } else {
      setGasError(lastError);
      showToast(`Pesanan TERSIMPAN DI HP/LOKAL! (Gagal sync Google Sheets: ${lastError})`, 'error');
    }
  };

  const handleDeleteOrder = (id: string) => {
    const targetOrder = orders.find((o) => o.id === id);
    const targetInvoice = !targetOrder ? invoices.find((inv) => inv.id === id || inv.items?.some((it) => it.id === id)) : undefined;

    setConfirmState({
      isOpen: true,
      title: 'Konfirmasi Hapus Pesanan',
      message: 'Apakah Anda yakin ingin menghapus item ini?',
      onConfirm: async () => {
        setOrders((prev) => prev.filter((o) => o.id !== id));
        if (targetInvoice) {
          setInvoices((prev) => prev.filter((inv) => inv.id !== targetInvoice.id));
        }
        setConfirmState(null);
        showToast('Item berhasil dihapus', 'delete');

        if (targetOrder) {
          const res = await deleteRow('pesanan', {
            match: {
              ITEM: targetOrder.namaBarang,
              DATE: targetOrder.tanggal,
              DAPUR: targetOrder.tujuanDapur,
              TOKO: targetOrder.toko,
            },
            rowIndex: targetOrder.rowIndex,
          });
          if (!res.success) {
            setGasError(res.error || 'Gagal hapus data di Google Sheets');
            showToast(`Dihapus lokal (Gagal hapus di Sheets: ${res.error})`, 'error');
          }
        } else if (targetInvoice) {
          await deleteRow('transaksi', {
            match: {
              TANGGAL: targetInvoice.tanggalPrint || targetInvoice.tanggal,
              TOKO: targetInvoice.toko,
              PEMASOK: targetInvoice.pemasok,
            },
            rowIndex: targetInvoice.rowIndex,
          });
        }
      },
    });
  };

  const handleDeleteKitchenOrders = (targetName: string, date: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Hapus Semua Pesanan',
      message: `Hapus semua pesanan untuk ${targetName} pada tanggal ${date}?`,
      onConfirm: () => {
        setOrders((prev) => prev.filter((o) => !((o.toko === targetName || o.tujuanDapur === targetName) && o.tanggal === date)));
        setConfirmState(null);
        showToast('Semua pesanan berhasil dihapus', 'delete');
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
            console.warn('Gagal sync pesanan dari note ke sheet pesanan:', orderRes.error);
          }
        })
        .catch((err) => console.warn('Gagal sync pesanan dari note:', err))
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
      ).catch((err) => console.warn('Gagal sync status note ke sheet notes:', err));

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
      ).catch((err) => console.warn('Gagal sync status note ke sheet notes:', err));
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
        console.warn('Gagal hapus note di Google Sheets:', res.error);
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
      console.warn('Note tersimpan lokal, gagal sync ke Google Sheets:', res.error);
    }
  };

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
      message: `Hapus transaksi untuk ${batchDesc}? Data di sheet transaksi dan pesanan terkait di Google Sheets akan dihapus.`,
      onConfirm: async () => {
        // 1. Local state updates
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

        setConfirmState(null);
        showToast(`Transaksi ${batchDesc} berhasil dihapus`, 'delete');

        // 2. Google Sheets sync: Delete from sheet "transaksi"
        setIsSyncingGas(true);
        try {
          const txMatch: Record<string, any> = {
            TANGGAL: batch.tanggal,
          };
          if (batch.pemasok) txMatch.PEMASOK = batch.pemasok;
          if (batch.toko) txMatch.TOKO = batch.toko;
          if (batch.items && batch.items.length > 0 && batch.items[0].namaBarang) {
            txMatch.BARANG = batch.items[0].namaBarang;
          }

          const resTx = await deleteRow('transaksi', {
            match: txMatch,
          });

          if (!resTx.success) {
            console.warn('Gagal hapus di sheet transaksi:', resTx.error);
          }

          // 3. Delete matching items from sheet "pesanan"
          if (batch.items && batch.items.length > 0) {
            for (const item of batch.items) {
              await deleteRow('pesanan', {
                match: {
                  ITEM: item.namaBarang,
                  DATE: item.tanggal || batch.tanggal,
                  DAPUR: item.tujuanDapur || batch.tujuanDapur,
                  TOKO: item.toko || batch.toko,
                },
                rowIndex: item.rowIndex,
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
        } catch (err) {
          console.warn('Error syncing delete transaction:', err);
        } finally {
          setIsSyncingGas(false);
        }
      },
    });
  };

  const handleDeleteInvoice = (id: string) => {
    const targetInvoice = invoices.find((inv) => inv.id === id);
    setConfirmState({
      isOpen: true,
      title: 'Hapus Transaksi',
      message: 'Apakah Anda yakin ingin menghapus transaksi ini? Data di Google Sheets akan dihapus.',
      onConfirm: async () => {
        setInvoices((prev) => prev.filter((inv) => inv.id !== id));
        setConfirmState(null);
        showToast('Transaksi berhasil dihapus', 'delete');

        if (targetInvoice) {
          setIsSyncingGas(true);
          try {
            await deleteRow('transaksi', {
              match: {
                TANGGAL: targetInvoice.tanggalPrint || targetInvoice.tanggal,
                TOKO: targetInvoice.toko,
                PEMASOK: targetInvoice.pemasok,
              },
              rowIndex: targetInvoice.rowIndex,
            });
          } catch (e) {
            console.warn('Error deleting invoice from sheet:', e);
          } finally {
            setIsSyncingGas(false);
          }
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
      }
    }

    setIsSyncingGas(false);

    if (successCount === newOrdersAdded.length) {
      showToast(`${successCount} item import berhasil tersimpan ke Google Sheets`, 'success');
    } else {
      setGasError(lastError);
      showToast(`${newOrdersAdded.length} item TERSIMPAN DI HP/LOKAL! (${successCount}/${newOrdersAdded.length} sync Sheets: ${lastError})`, 'error');
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
      <HeaderBanner
        orders={orders}
        selectedDate={selectedDate}
        notes={notes}
        kitchens={kitchens}
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
      />

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
                  isLoading={isSyncingGas}
                  kitchens={kitchens}
                  stores={stores}
                  pemasokList={pemasokList}
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  onToggleStatus={handleToggleStatus}
                  onUpdatePaymentStatus={handleUpdatePaymentStatus}
                  onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
                  onUpdateGroupPaymentStatus={handleUpdateGroupPaymentStatus}
                  onUpdateGroupDeliveryStatus={handleUpdateGroupDeliveryStatus}
                  onEditOrder={handleOpenEditOrder}
                  onDuplicateOrder={handleDuplicateOrder}
                  onDeleteOrder={handleDeleteOrder}
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
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      {/* Fixed Sticky Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenAddModal={() => handleOpenAddModal()}
      />

      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Confirm Delete Modal */}
      {confirmState && (
        <ConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
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
        selectedDate={selectedDate}
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
        onOpenSettings={() => {
          setIsSyncSheetOpen(false);
          setIsSettingsOpen(true);
        }}
      />

      {/* 8. Settings Bottom Sheet */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        kitchens={kitchens}
        onUpdateKitchens={setKitchens}
        stores={stores}
        onUpdateStores={setStores}
        pemasokList={pemasokList}
        onUpdatePemasok={setPemasokList}
        orders={orders}
        onUpdateOrders={setOrders}
        onDeleteAllData={handleDeleteAllData}
      />
    </div>
  );
}
