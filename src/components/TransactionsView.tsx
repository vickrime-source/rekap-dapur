import React, { useState, useCallback } from 'react';
import { 
  OrderItem, 
  Kitchen, 
  PaymentStatus, 
  DeliveryStatus, 
  Store as StoreType, 
  InvoicePriceVariant
} from '../types';
import { ActionMenuPortal } from './ActionMenuPortal';
import { TransactionBatch, ActiveActionMenu } from './transactions/types';
import { useTransactionData } from './transactions/useTransactionData';
import { TransactionsFilterToolbar } from './transactions/TransactionsFilterToolbar';
import { TransactionsTable } from './transactions/TransactionsTable';
import { TransactionsMobileList } from './transactions/TransactionsMobileList';

export type { TransactionBatch } from './transactions/types';

interface TransactionsViewProps {
  orders: OrderItem[];
  kitchens: Kitchen[];
  stores?: StoreType[];
  isLoading?: boolean;
  invoices?: any[];
  selectedDate?: string;
  onDateChange?: (date: string) => void;
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
}) => {
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPemasok, setSelectedPemasok] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'PAID' | 'UNPAID'>('all');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [selectedDapurFilter, setSelectedDapurFilter] = useState<string>('all');

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
    pemasokList,
    storeNames,
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
    selectedMonth: selectedDate?.slice(0, 7) || '',
    activePeriod: 'all_time',
    customRange: null,
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
      {/* Filter transaksi tetap tersedia tanpa header dan toggle periode yang duplikatif. */}
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

    </div>
  );
};
