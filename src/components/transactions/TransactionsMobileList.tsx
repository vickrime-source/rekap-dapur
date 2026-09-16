import React from 'react';
import { OrderItem } from '../../types';
import { TableSkeleton } from '../TableSkeleton';
import { Pagination } from '../Pagination';
import { TransactionsMobileCard } from './TransactionsMobileCard';
import { TransactionBatch } from './types';

interface TransactionsMobileListProps {
  isLoading: boolean;
  filteredBatches: TransactionBatch[];
  paginatedBatches: TransactionBatch[];
  selectedStoreFilter: string;
  expandedBatchIds: Set<string>;
  onToggleExpandBatch: (id: string) => void;
  activeMenuId?: string | null;
  onToggleBatchPayment: (batch: TransactionBatch) => void;
  onToggleBatchDelivery: (batch: TransactionBatch) => void;
  onViewInvoice?: (items: OrderItem[], kitchenName?: string, storeName?: string, dateStr?: string) => void;
  onOpenInvoiceModal?: (items: OrderItem[], kitchenName?: string, storeName?: string) => void;
  onExportInvoicePdf?: (items: OrderItem[], kitchenName: string, storeName: string, dateStr?: string) => void;
  onDeleteTransaction?: (batch: TransactionBatch) => void;
  onDeleteInvoice?: (id: string) => void;
  onDeleteOrder: (id: string) => void;
  onOpenActionMenu: (rect: DOMRect, batch: TransactionBatch) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const TransactionsMobileList: React.FC<TransactionsMobileListProps> = ({
  isLoading,
  filteredBatches,
  paginatedBatches,
  selectedStoreFilter,
  expandedBatchIds,
  onToggleExpandBatch,
  activeMenuId,
  onToggleBatchPayment,
  onToggleBatchDelivery,
  onViewInvoice,
  onOpenInvoiceModal,
  onExportInvoicePdf,
  onDeleteTransaction,
  onDeleteInvoice,
  onDeleteOrder,
  onOpenActionMenu,
  currentPage,
  totalPages,
  onPageChange,
}) => {
  return (
    <div className="block sm:hidden space-y-2.5">
      {isLoading && filteredBatches.length === 0 ? (
        <TableSkeleton rows={4} />
      ) : paginatedBatches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-500 text-xs shadow-xs space-y-1">
          <p className="font-bold text-slate-700">Tidak ada transaksi yang sesuai filter</p>
          {selectedStoreFilter !== 'all' && (
            <p className="text-[11px] text-indigo-600">Filter aktif: Toko {selectedStoreFilter}</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 tablet-landscape-grid-2 gap-3">
            {paginatedBatches.map((batch) => (
              <TransactionsMobileCard
                key={`mobile-batch-card-${batch.id}`}
                batch={batch}
                isExpanded={expandedBatchIds.has(batch.id)}
                onToggleExpand={() => onToggleExpandBatch(batch.id)}
                isMenuOpen={activeMenuId === batch.id}
                onToggleBatchPayment={onToggleBatchPayment}
                onToggleBatchDelivery={onToggleBatchDelivery}
                onViewInvoice={onViewInvoice}
                onOpenInvoiceModal={onOpenInvoiceModal}
                onExportInvoicePdf={onExportInvoicePdf}
                onDeleteTransaction={onDeleteTransaction}
                onDeleteInvoice={onDeleteInvoice}
                onDeleteOrder={onDeleteOrder}
                onOpenActionMenu={onOpenActionMenu}
              />
            ))}
          </div>

          {/* Mobile Pagination - Always visible & spans full width */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            totalItems={filteredBatches.length}
          />
        </div>
      )}
    </div>
  );
};
