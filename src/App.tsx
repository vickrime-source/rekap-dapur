import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { 
  OrderItem, 
  Kitchen, 
  Store as StoreType, 
  InvoiceRecord, 
  ExportHistoryItem, 
  NoteItem, 
  DashboardPeriod 
} from './types';
import { 
  INITIAL_KITCHENS, 
  INITIAL_STORES, 
  INITIAL_PEMASOK 
} from './constants/initialData';
import { HeaderBanner } from './components/HeaderBanner';
import { BottomNav, TabType } from './components/BottomNav';
import { DashboardView } from './components/DashboardView';
import { RekapView } from './components/RekapView';
import { TransactionsView } from './components/TransactionsView';
import { ConfirmModal } from './components/ConfirmModal';
import { Toast, ToastMessage, ToastType } from './components/Toast';
import { getTodayWIB, isOrderToday, isOrderThisWeek, getWeekRange } from './lib/formatters';
import { sendNewOrderNotification } from './lib/notificationManager';
import { motion, AnimatePresence } from 'motion/react';

// Lazy-loaded modal components to significantly reduce initial bundle size and tablet memory usage
const OrderModal = React.lazy(() => import('./components/OrderModal').then((m) => ({ default: m.OrderModal })));
const NoteSheet = React.lazy(() => import('./components/NoteSheet').then((m) => ({ default: m.NoteSheet })));
const FollowUpNoteModal = React.lazy(() => import('./components/FollowUpNoteModal').then((m) => ({ default: m.FollowUpNoteModal })));
const InvoiceModal = React.lazy(() => import('./components/InvoiceModal').then((m) => ({ default: m.InvoiceModal })));
const InvoiceFormModal = React.lazy(() => import('./components/InvoiceFormModal').then((m) => ({ default: m.InvoiceFormModal })));
const TextImportModal = React.lazy(() => import('./components/TextImportModal').then((m) => ({ default: m.TextImportModal })));
const ExportModal = React.lazy(() => import('./components/ExportModal').then((m) => ({ default: m.ExportModal })));
const SettingsModal = React.lazy(() => import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal })));
const ExportHistorySheet = React.lazy(() => import('./components/ExportHistorySheet').then((m) => ({ default: m.ExportHistorySheet })));
const SmartVoiceOrderOverlay = React.lazy(() => import('./components/SmartVoiceOrderOverlay').then((m) => ({ default: m.SmartVoiceOrderOverlay })));

import { useConfirmDialog } from './hooks/useConfirmDialog';
import { useMasterData } from './hooks/useMasterData';
import { useDatabaseSync } from './hooks/useDatabaseSync';
import { useDailyNotification } from './hooks/useDailyNotification';
import { useNotesOperations } from './hooks/useNotesOperations';
import { useInvoiceFlow } from './hooks/useInvoiceFlow';
import { useOrderOperations } from './hooks/useOrderOperations';

export default function App() {
  // Pure in-memory orders and invoices state populated from Supabase as single source of truth
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [kitchens, setKitchens] = useLocalStorage<Kitchen[]>('dapur_tracker_kitchens_v4', INITIAL_KITCHENS);
  const [stores, setStores] = useLocalStorage<StoreType[]>('dapur_tracker_stores_v4', INITIAL_STORES);
  const [pemasokList, setPemasokList] = useLocalStorage<string[]>('dapur_tracker_pemasok_v4', INITIAL_PEMASOK);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [exportHistory, setExportHistory] = useLocalStorage<ExportHistoryItem[]>('dapur_export_history_v1', []);
  const [notes, setNotes] = useLocalStorage<NoteItem[]>('dapur_highlight_notes_v1', []);
  const [dashboardPeriod, setDashboardPeriod] = useLocalStorage<DashboardPeriod>('dapur_dashboard_period_v3', 'all_time');

  // Navigation State
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayWIB());

  // Toast Notification State
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ id: `toast-${Date.now()}`, message, type });
  }, []);

  // Modal Visibility States
  const [isNoteSheetOpen, setIsNoteSheetOpen] = useState(false);
  const [autoStartVoiceNote, setAutoStartVoiceNote] = useState(false);
  const [isSmartVoiceActive, setIsSmartVoiceActive] = useState(false);
  const [isTextImportOpen, setIsTextImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'kelola_data' | 'dapur' | 'toko' | 'pemasok' | 'template' | 'notifikasi' | 'install' | 'danger'>('kelola_data');

  // Confirm Modal Hook
  const { confirmState, setConfirmState } = useConfirmDialog();

  // Master Data Hook
  const {
    masterToko,
    masterPemasok,
    masterDapur,
    masterSatuan,
    refreshMasterData,
    handleAddMasterSatuan,
  } = useMasterData({
    setStores,
    setPemasokList,
    setKitchens,
    showToast,
  });

  // Database Sync Hook
  const {
    isLoadingDb,
    setIsLoadingDb,
    isOnline,
    setDbError,
  } = useDatabaseSync({
    activeTab,
    setOrders,
    setInvoices,
    setNotes,
    showToast,
  });

  // Smart Initializer: Saat pesanan dimuat dari Supabase, jika filter aktif menghasilkan 0 pesanan
  // (misal 'hari_ini' tapi hari ini belum ada order baru), otomatis tampilkan 'all_time' agar seluruh data langsung tampil.
  const hasCheckedInitialPeriod = useRef(false);
  useEffect(() => {
    if (orders.length > 0 && !hasCheckedInitialPeriod.current) {
      hasCheckedInitialPeriod.current = true;
      if (dashboardPeriod === 'hari_ini') {
        const hasToday = orders.some((o) => isOrderToday(o, selectedDate));
        if (!hasToday) {
          setDashboardPeriod('all_time');
        }
      } else if (dashboardPeriod === 'mingguan') {
        const hasWeek = orders.some((o) => isOrderThisWeek(o, getWeekRange(selectedDate)));
        if (!hasWeek) {
          setDashboardPeriod('all_time');
        }
      }
    }
  }, [orders, dashboardPeriod, selectedDate, setDashboardPeriod]);

  // Daily Report Notification Hook
  useDailyNotification(orders);

  // Notes Operations Hook
  const {
    followUpNoteTarget,
    setFollowUpNoteTarget,
    isFollowUpModalOpen,
    setIsFollowUpModalOpen,
    handleOpenFollowUpNote,
    handleCompleteFollowUpNote,
    handleToggleNoteStatus,
    handleDeleteNote,
    handleSaveNote,
  } = useNotesOperations({
    notes,
    setNotes,
    orders,
    setOrders,
    masterToko,
    masterPemasok,
    masterDapur,
    selectedDate,
    showToast,
  });

  // Invoice Flow Hook
  const {
    isExportingActive,
    isExportHistoryOpen,
    setIsExportHistoryOpen,
    isInvoiceFormOpen,
    setIsInvoiceFormOpen,
    invoiceFormItems,
    invoiceFormKitchen,
    invoiceFormStore,
    invoiceRecipientName,
    invoiceRecipientAddress,
    invoiceRecipientPhone,
    invoiceBayar,
    isInvoiceModalOpen,
    setIsInvoiceModalOpen,
    invoiceInitialFullPreview,
    setInvoiceInitialFullPreview,
    invoiceItems,
    invoiceNumber,
    invoiceTargetKitchen,
    invoiceTargetStore,
    handleDirect1ClickExportInvoicePdf,
    handleStartInvoiceFlow,
    handleConfirmInvoiceForm,
    handleViewInvoice,
    handleSaveInvoiceRecord,
    handleTriggerBackgroundExport,
    handleDeleteTransaction,
    handleDeleteInvoice,
  } = useInvoiceFlow({
    invoices,
    setInvoices,
    setOrders,
    exportHistory,
    setExportHistory,
    setIsLoadingDb,
    setDbError,
    setConfirmState,
    showToast,
  });

  // Order Operations Hook
  const {
    isOrderModalOpen,
    setIsOrderModalOpen,
    editingOrder,
    setEditingOrder,
    prefilledKitchen,
    setPrefilledKitchen,
    handleToggleStatus,
    handleUpdatePaymentStatus,
    handleUpdateDeliveryStatus,
    handleUpdateGroupPaymentStatus,
    handleUpdateGroupDeliveryStatus,
    handleDuplicateOrder,
    handleToggleBatchStatus,
    handleSaveOrder,
    handleDeleteOrder,
    handleDeleteBatchOrders,
    handleDeleteKitchenOrders,
    handleOpenEditOrder,
    handleOpenAddModal,
    handleEditOrderVoice,
    handleImportParsedItems,
  } = useOrderOperations({
    orders,
    setOrders,
    invoices,
    setInvoices,
    masterToko,
    masterPemasok,
    masterDapur,
    stores,
    kitchens,
    pemasokList,
    selectedDate,
    setSelectedDate,
    setIsLoadingDb,
    setDbError,
    setConfirmState,
    showToast,
  });

  // Purge legacy cached orders and old dummy master data
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('dapur_tracker_orders_v4');
        window.localStorage.removeItem('dapur_tracker_orders');
        
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
  }, [setPemasokList]);

  // Initial master data load
  useEffect(() => {
    refreshMasterData();
  }, [refreshMasterData]);

  // Data Sanitization / Migration Effect
  useEffect(() => {
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

    if (notes.some((n) => n.id === 'note-1' || n.id === 'note-2')) {
      setNotes((prev) => prev.filter((n) => n.id !== 'note-1' && n.id !== 'note-2'));
    }
  }, []);

  // Memoized unique item names from existing orders for auto-suggest
  const existingItemNames = useMemo(
    () => Array.from(new Set(orders.map((o) => o.namaBarang))),
    [orders]
  );

  const handleDeleteAllData = useCallback(() => {
    setOrders([]);
    setInvoices([]);
    setExportHistory([]);
    setNotes([]);
    showToast('Seluruh data pesanan, transaksi, dan catatan berhasil dihapus bersih', 'delete');
  }, [setOrders, setInvoices, setExportHistory, setNotes, showToast]);

  return (
    <div className="min-h-screen bg-[#eef2f6] dark:bg-[#090a0c] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white pb-36 sm:pb-24 transition-colors duration-200">
      {/* Top Header Banner */}
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

      {/* Main Content Body (Standard static div without drag gesture for butter-smooth tablet performance) */}
      <main className="flex-1 w-full max-w-7xl xl:max-w-[1536px] mx-auto px-3 sm:px-4 lg:px-4 xl:px-6 2xl:px-8 pt-2 pb-36 sm:pb-32">
        <div className="w-full">
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
            ) : activeTab === 'rekap' ? (
              <motion.div
                key="rekap"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <RekapView
                  orders={orders}
                  stores={stores}
                  kitchens={kitchens}
                  invoices={invoices}
                  selectedDate={selectedDate}
                  period={dashboardPeriod}
                  onPeriodChange={setDashboardPeriod}
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
        </div>
      </main>

      {/* Bottom Navigation Bar */}
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

      {/* Lazy Suspense Boundary for All Modals to prevent massive upfront bundle loading */}
      <React.Suspense fallback={null}>
        {/* Smart Live Voice Order Assistant */}
        {isSmartVoiceActive && (
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
        )}

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

      {/* 0.1 Follow Up Note Modal */}
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
        onSave={(orderData, editId) => {
          const rawItems = Array.isArray(orderData) ? orderData : [orderData];
          const validItems = rawItems.filter((item: any) => {
            const nama = ((item.namaBarang || item.item || item.nama_barang || '') as string).trim();
            const dapur = ((item.tujuanDapur || item.dapur || item.tujuan_dapur || '') as string).trim();
            return nama.length > 0 && dapur.length > 0;
          });
          console.log('FINAL ITEMS TO INSERT', validItems);
          if (validItems.length === 0) {
            console.warn('[App:onSave] Diabaikan: Tidak ada item valid (item & dapur wajib ada).');
            return;
          }
          handleSaveOrder(Array.isArray(orderData) ? validItems : validItems[0], editId);
        }}
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
      </React.Suspense>
    </div>
  );
}
