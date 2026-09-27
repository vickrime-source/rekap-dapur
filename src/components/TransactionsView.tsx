import React, { useState, useCallback } from 'react';
import { 
  OrderItem, 
  Kitchen, 
  PaymentStatus, 
  DeliveryStatus, 
  Store as StoreType, 
  DashboardPeriod,
  InvoicePriceVariant
} from '../types';
import { getTodayWIB } from '../lib/formatters';
import { ActionMenuPortal } from './ActionMenuPortal';
import { CustomDateRange } from './ReportPeriodPicker';
import { TransactionBatch, ActiveActionMenu } from './transactions/types';
import { useTransactionData } from './transactions/useTransactionData';
import { TransactionsHeader } from './transactions/TransactionsHeader';
import { TransactionsFilterToolbar } from './transactions/TransactionsFilterToolbar';
import { TransactionsTable } from './transactions/TransactionsTable';
import { TransactionsMobileList } from './transactions/TransactionsMobileList';

// Lazy load MonthlySyncModal to avoid pulling Google Sheets sync libraries into the initial render
const MonthlySyncModal = React.lazy(() => import('./MonthlySyncModal').then(m => ({ default: m.MonthlySyncModal })));

export type { TransactionBatch } from './transactions/types';

interface TransactionsViewProps {
  orders: OrderItem[];
  kitchens: Kitchen[];
  stores?: StoreType[];
  isLoading?: boolean;
  invoices?: any[];
  selectedDate?: string;
  onDateChange?: (date: string) => void;
  period?: DashboardPeriod;
  onPeriodChange?: (period: DashboardPeriod) => void;
  onToggleStatus: (id: string) => void;
  onUpdatePaymentStatus?: (id: string, status: PaymentStatus) => void;
  onUpdateDeliveryStatus?: (id: string, status: DeliveryStatus) => void;
  onUpdateGroupPaymentStatus?: (groupItems: OrderItem[], status: PaymentStatus) => void;
  onUpdateGroupDeliveryStatus?: (groupItems: OrderItem[], status: DeliveryStatus) => void;
  onToggleBatchStatus: (kitchenName: string, date: string, targetStatus: 'pending' | 'selesai') => void;
  onEditOrder: (item: OrderItem) => void;
  onDuplicateOrder?: (item: OrderItem) => void;
  onDeleteOrder: (id: string) => void;
  onDeleteKitchenOrders: (kitchenName: string, date: string) => void;
  onOpenInvoiceModal?: (items: OrderItem[], kitchenName?: string, storeName?: string) => void;
  onExportInvoicePdf?: (items: OrderItem[], kitchenName: string, storeName: string, dateStr?: string, variant?: InvoicePriceVariant) => void;
  onViewInvoice?: (items: OrderItem[], kitchenName?: string, storeName?: string, dateStr?: string) => void;
  onDeleteInvoice?: (id: string) => void;
  onDeleteTransaction?: (batch: TransactionBatch) => void;
  onOpenAddModal: (prefilledKitchen?: string) => void;
  onOpenSettings?: (initialTab?: any) => void;
  onOpenExportHistory?: () => void;
  isExportingActive?: boolean;
  exportHistoryCount?: number;
  onOpenSyncSheet?: () => void;
  pendingSyncCount?: number;
  isOnline?: boolean;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  orders,
  invoices = [],
  stores = [],
  isLoading = false,
  selectedDate,
  period: periodProp,
  onPeriodChange,
  onUpdatePaymentStatus,
  onUpdateDeliveryStatus,
  onUpdateGroupPaymentStatus,
  onUpdateGroupDeliveryStatus,
  onEditOrder,
  onDuplicateOrder,
  onDeleteOrder,
  onOpenInvoiceModal,
  onExportInvoicePdf,
  onViewInvoice,
  onDeleteInvoice,
  onDeleteTransaction,
  onOpenSettings,
}) => {
  // Period control state (synchronized with props or internal fallback)
  const [internalPeriod, setInternalPeriod] = useState<DashboardPeriod>(() => {
    try {
      const saved = localStorage.getItem('gas_dashboard_period');
      if (saved && ['hari_ini', 'mingguan', 'bulan_ini', 'all_time'].includes(saved)) {
        return saved as DashboardPeriod;
      }
    } catch {
      // ignore
    }
    return 'all_time';
  });

  const activePeriod = periodProp ?? internalPeriod;
  const handleSetPeriod = (p: DashboardPeriod) => {
    setCustomRange(null);
    if (onPeriodChange) {
      onPeriodChange(p);
    } else {
      setInternalPeriod(p);
    }
    try {
      localStorage.setItem('gas_dashboard_period', p);
    } catch {
      // ignore
    }
  };

  // State dropdown bulan & custom date range
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return selectedDate ? selectedDate.slice(0, 7) : getTodayWIB().slice(0, 7);
  });
  const [customRange, setCustomRange] = useState<CustomDateRange | null>(null);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPemasok, setSelectedPemasok] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'PAID' | 'UNPAID'>('all');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [selectedDapurFilter, setSelectedDapurFilter] = useState<string>('all');
  const [isMonthlySyncOpen, setIsMonthlySyncOpen] = useState(false);

  // Active 3-dots action menu tracking (Rendered via ActionMenuPortal)
  const [activeMenu, setActiveMenu] = useState<ActiveActionMenu | null>(null);

  // Mobile Cards (< 640px) expansion states
  const [expandedBatchIds, setExpandedBatchIds] = useState<Set<string>>(new Set());

  const toggleExpandBatch = (id: string) => {
    setExpandedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Hook for transaction batches, filtered data, pagination, and totals
  const {
    weekRange,
    pemasokList,
    storeNames,
    periodOrders,
    periodStats,
    filteredBatches,
    paginatedBatches,
    summaryTotals,
    currentPage,
    totalPages,
    setCurrentPage,
  } = useTransactionData({
    orders,
    invoices,
    stores,
    selectedDate,
    selectedMonth,
    activePeriod,
    customRange,
    selectedStoreFilter,
    selectedPemasok,
    selectedDapurFilter,
    selectedStatusFilter,
    searchQuery,
    pageSize: 15,
  });

  const handleToggleBatchPayment = useCallback((batch: TransactionBatch) => {
    const nextStatus: PaymentStatus = batch.payStatus === 'PAID' ? 'UNPAID' : 'PAID';
    if (onUpdateGroupPaymentStatus) {
      onUpdateGroupPaymentStatus(batch.items, nextStatus);
    } else if (onUpdatePaymentStatus) {
      batch.items.forEach((it) => onUpdatePaymentStatus(it.id, nextStatus));
    }
  }, [onUpdateGroupPaymentStatus, onUpdatePaymentStatus]);

  const handleToggleBatchDelivery = useCallback((batch: TransactionBatch) => {
    const nextStatus: DeliveryStatus = batch.delStatus === 'DONE' ? 'PENDING' : 'DONE';
    if (onUpdateGroupDeliveryStatus) {
      onUpdateGroupDeliveryStatus(batch.items, nextStatus);
    } else if (onUpdateDeliveryStatus) {
      batch.items.forEach((it) => onUpdateDeliveryStatus(it.id, nextStatus));
    }
  }, [onUpdateGroupDeliveryStatus, onUpdateDeliveryStatus]);

  const handleOpenActionMenu = useCallback((rect: DOMRect, batch: TransactionBatch) => {
    setActiveMenu((prev) => prev?.id === batch.id ? null : { id: batch.id, rect, batch });
  }, []);

  return (
    <div className="space-y-4 pt-1 pb-36 sm:pb-24 font-sans text-slate-900">
      {/* 1. TOP HEADER - LOG TRANSAKSI */}
      <TransactionsHeader
        activePeriod={activePeriod}
        onSetPeriod={handleSetPeriod}
        onOpenMonthlySync={() => setIsMonthlySyncOpen(true)}
        onOpenSettings={onOpenSettings}
      />

      {/* 2. INTEGRATED FILTER TOOLBAR */}
      <TransactionsFilterToolbar
        selectedStoreFilter={selectedStoreFilter}
        onSelectStoreFilter={setSelectedStoreFilter}
        storeNames={storeNames}
        selectedPemasok={selectedPemasok}
        onSelectPemasok={setSelectedPemasok}
        pemasokList={pemasokList}
        selectedDapurFilter={selectedDapurFilter}
        onSelectDapurFilter={setSelectedDapurFilter}
        selectedStatusFilter={selectedStatusFilter}
        onSelectStatusFilter={setSelectedStatusFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* 3. CARD LIST KHUSUS MOBILE PHONE (< 640px) */}
      <TransactionsMobileList
        isLoading={isLoading}
        filteredBatches={filteredBatches}
        paginatedBatches={paginatedBatches}
        selectedStoreFilter={selectedStoreFilter}
        expandedBatchIds={expandedBatchIds}
        onToggleExpandBatch={toggleExpandBatch}
        activeMenuId={activeMenu?.id}
        onToggleBatchPayment={handleToggleBatchPayment}
        onToggleBatchDelivery={handleToggleBatchDelivery}
        onViewInvoice={onViewInvoice}
        onOpenInvoiceModal={onOpenInvoiceModal}
        onExportInvoicePdf={onExportInvoicePdf}
        onDeleteTransaction={onDeleteTransaction}
        onDeleteInvoice={onDeleteInvoice}
        onDeleteOrder={onDeleteOrder}
        onOpenActionMenu={handleOpenActionMenu}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* 4. TRANSACTIONS TABLE (TABLET & DESKTOP >= 640px) */}
      <div className="hidden sm:block">
        <TransactionsTable
          isLoading={isLoading}
          filteredBatches={filteredBatches}
          paginatedBatches={paginatedBatches}
          summaryTotals={summaryTotals}
          selectedStoreFilter={selectedStoreFilter}
          onResetStoreFilter={() => setSelectedStoreFilter('all')}
          activeMenuId={activeMenu?.id}
          onToggleBatchPayment={handleToggleBatchPayment}
          onViewInvoice={onViewInvoice}
          onOpenInvoiceModal={onOpenInvoiceModal}
          onExportInvoicePdf={onExportInvoicePdf}
          onDeleteTransaction={onDeleteTransaction}
          onDeleteInvoice={onDeleteInvoice}
          onDeleteOrder={onDeleteOrder}
          onOpenActionMenu={handleOpenActionMenu}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Spacer bawah khusus mobile agar tidak overlap dengan bottom navigation */}
      <div className="h-24 sm:h-0 block sm:hidden pointer-events-none" aria-hidden="true" />

      {/* Floating Portal Action Menu */}
      <ActionMenuPortal
        isOpen={!!activeMenu}
        targetRect={activeMenu?.rect || null}
        onClose={() => setActiveMenu(null)}
        title="Detail Transaksi"
        batchNumber={activeMenu?.batch.batchIndex}
        items={activeMenu?.batch.items || []}
        onEdit={onEditOrder}
        onDuplicate={onDuplicateOrder}
        onDelete={onDeleteOrder}
        onDeleteBatch={() => {
          if (activeMenu?.batch) {
            if (onDeleteTransaction) {
              onDeleteTransaction(activeMenu.batch);
            } else if (onDeleteInvoice) {
              onDeleteInvoice(activeMenu.batch.id);
            } else {
              onDeleteOrder(activeMenu.batch.id);
            }
          }
        }}
      />

      {/* Modal Simpan / Update Rekapan Bulanan ke Google Sheets & CSV */}
      {isMonthlySyncOpen && (
        <React.Suspense fallback={null}>
          <MonthlySyncModal
            isOpen={isMonthlySyncOpen}
            onClose={() => setIsMonthlySyncOpen(false)}
            orders={orders}
            stats={periodStats}
            selectedDate={selectedDate}
            onOpenSettings={() => {
              if (onOpenSettings) {
                onOpenSettings('googlesheets');
              }
            }}
          />
        </React.Suspense>
      )}
    </div>
  );
};
