import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Store as StoreIcon, 
  Utensils, 
  Calendar as CalendarIcon, 
  ChevronDown, 
  X 
} from 'lucide-react';
import { 
  OrderItem, 
  Kitchen, 
  Store as StoreType, 
  PaymentStatus, 
  DeliveryStatus,
  InvoiceRecord
} from '../types';
import { OrdersTableView } from './OrdersTableView';
import { CalendarPickerModal } from './CalendarPickerModal';
import { 
  formatTanggal, 
  parseDateSafe, 
  normalizeDateSimple, 
  isOrderToday 
} from '../lib/formatters';

interface DashboardViewProps {
  orders: OrderItem[];
  invoices?: InvoiceRecord[];
  isLoading?: boolean;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onToggleStatus?: (id: string) => void;
  onUpdatePaymentStatus: (id: string, status: PaymentStatus) => void;
  onUpdateDeliveryStatus: (id: string, status: DeliveryStatus) => void;
  onUpdateGroupPaymentStatus?: (groupItems: OrderItem[], status: PaymentStatus) => void;
  onUpdateGroupDeliveryStatus?: (groupItems: OrderItem[], status: DeliveryStatus) => void;
  onDuplicateOrder: (item: OrderItem) => void;
  onToggleBatchStatus?: (kitchenName: string, date: string, targetStatus: 'pending' | 'selesai') => void;
  onEditOrder: (item: OrderItem) => void;
  onDeleteOrder: (id: string) => void;
  onDeleteBatchOrders?: (items: OrderItem[]) => void;
  onDeleteKitchenOrders?: (kitchenName: string, date: string) => void;
  onOpenAddModal: (prefilledKitchen?: string) => void;
  onOpenInvoiceModal: (items: OrderItem[], kitchenName?: string, storeName?: string) => void;
  onExportInvoicePdf?: (items: OrderItem[], kitchenName: string, storeName: string, dateStr?: string) => void;
  onOpenTextImport?: () => void;
  onOpenExportModal?: () => void;
  kitchens: Kitchen[];
  stores: StoreType[];
  pemasokList?: string[];
  period?: any;
  onPeriodChange?: any;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  isLoading = false,
  selectedDate,
  onDateChange,
  onUpdatePaymentStatus,
  onUpdateDeliveryStatus,
  onUpdateGroupPaymentStatus,
  onUpdateGroupDeliveryStatus,
  onDuplicateOrder,
  onEditOrder,
  onDeleteOrder,
  onDeleteBatchOrders,
  onOpenInvoiceModal,
  onExportInvoicePdf,
  kitchens,
  stores,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [selectedKitchenFilter, setSelectedKitchenFilter] = useState<string>('all');
  const [useDateFilter, setUseDateFilter] = useState<boolean>(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);

  // Filter orders according to date, store, kitchen, and search
  const filteredOrders = useMemo(() => {
    return orders.filter((item) => {
      // 1. Date Scope
      if (useDateFilter) {
        if (endDate && endDate !== selectedDate) {
          const itemDate = parseDateSafe(item.tanggal);
          const start = parseDateSafe(selectedDate);
          const end = parseDateSafe(endDate);
          if (itemDate && start && end) {
            if (itemDate < start || itemDate > end) return false;
          }
        } else {
          const itemNorm = normalizeDateSimple(item.tanggal);
          const selNorm = normalizeDateSimple(selectedDate);
          const isMatch = itemNorm === selNorm || isOrderToday(item, selectedDate);
          if (!isMatch) return false;
        }
      } else {
        if (!isOrderToday(item, selectedDate)) return false;
      }

      // 2. Search query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesSearch =
          item.namaBarang.toLowerCase().includes(q) ||
          item.pemasok.toLowerCase().includes(q) ||
          item.toko.toLowerCase().includes(q) ||
          item.tujuanDapur.toLowerCase().includes(q) ||
          (item.catatan && item.catatan.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // 3. Store filter
      if (selectedStoreFilter !== 'all' && item.toko !== selectedStoreFilter) {
        return false;
      }

      // 4. Kitchen filter
      if (selectedKitchenFilter !== 'all' && item.tujuanDapur !== selectedKitchenFilter) {
        return false;
      }

      return true;
    });
  }, [
    orders,
    useDateFilter,
    selectedDate,
    endDate,
    searchQuery,
    selectedStoreFilter,
    selectedKitchenFilter,
  ]);

  return (
    <div className="space-y-3 pt-1 pb-36 sm:pb-24 font-sans text-slate-800">
      {/* Filter Pills Bar (Store, Kitchen, Calendar & Search) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Pill Filters Group */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Pill 1: Store Icon + Dropdown */}
          <div className="relative inline-flex items-center">
            <div className={`rounded-full px-3.5 py-2 border shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
              selectedStoreFilter !== 'all' 
                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                : 'bg-white border-slate-200/90 text-slate-800 hover:border-indigo-300'
            }`}>
              <StoreIcon className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="text-xs font-bold whitespace-nowrap">
                {selectedStoreFilter === 'all' ? 'Semua Toko' : `Toko ${selectedStoreFilter}`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </div>
            <select
              value={selectedStoreFilter}
              onChange={(e) => setSelectedStoreFilter(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs"
              aria-label="Filter Toko"
            >
              <option value="all">Semua Toko ({stores.length})</option>
              {stores.map((st) => (
                <option key={st.id} value={st.nama}>
                  Toko {st.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Pill 2: Kitchen Icon + Dropdown */}
          <div className="relative inline-flex items-center">
            <div className={`rounded-full px-3.5 py-2 border shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
              selectedKitchenFilter !== 'all'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                : 'bg-white border-slate-200/90 text-slate-800 hover:border-indigo-300'
            }`}>
              <Utensils className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="text-xs font-bold whitespace-nowrap">
                {selectedKitchenFilter === 'all' ? 'Semua Dapur' : `Dapur ${selectedKitchenFilter}`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </div>
            <select
              value={selectedKitchenFilter}
              onChange={(e) => setSelectedKitchenFilter(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs"
              aria-label="Filter Dapur"
            >
              <option value="all">Semua Dapur ({kitchens.length})</option>
              {kitchens.map((k) => (
                <option key={k.id} value={k.nama}>
                  Dapur {k.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Pill 3: Calendar Icon + Custom Date Scope */}
          <div className="relative inline-flex items-center">
            {useDateFilter ? (
              <div className="rounded-full px-3.5 py-2 bg-indigo-50/90 border border-indigo-300 shadow-2xs flex items-center gap-1.5 cursor-pointer min-h-[44px]">
                <CalendarIcon className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span
                  onClick={() => setIsCalendarOpen(true)}
                  className="text-xs font-bold text-indigo-900 whitespace-nowrap"
                >
                  {endDate && endDate !== selectedDate
                    ? `${formatTanggal(selectedDate, false)} - ${formatTanggal(endDate, false)}`
                    : formatTanggal(selectedDate, false)}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUseDateFilter(false);
                    setEndDate(undefined);
                  }}
                  className="text-indigo-400 hover:text-indigo-700 ml-0.5 p-1 min-h-[32px] flex items-center justify-center cursor-pointer"
                  title="Reset Filter Tanggal Khusus"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setUseDateFilter(true);
                  setIsCalendarOpen(true);
                }}
                className="rounded-full px-3.5 py-2 bg-white border border-slate-200/90 shadow-2xs hover:border-indigo-300 transition-all flex items-center gap-1.5 cursor-pointer text-left min-h-[44px]"
                title="Pilih Tanggal Khusus"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                  Kalender
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
            )}
          </div>

          {/* Reset active store filter if clicked from breakdown */}
          {selectedStoreFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedStoreFilter('all')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-semibold cursor-pointer min-h-[44px]"
              title="Hapus Filter Toko"
            >
              <span>Reset Toko</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari barang, toko, dapur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-7 py-2.5 bg-white border border-slate-200/90 rounded-full text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs transition-all min-h-[44px]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Orders Table View */}
      <OrdersTableView
        orders={filteredOrders}
        isLoading={isLoading}
        onUpdatePaymentStatus={onUpdatePaymentStatus}
        onUpdateDeliveryStatus={onUpdateDeliveryStatus}
        onUpdateGroupPaymentStatus={onUpdateGroupPaymentStatus}
        onUpdateGroupDeliveryStatus={onUpdateGroupDeliveryStatus}
        onEditOrder={onEditOrder}
        onDuplicateOrder={onDuplicateOrder}
        onDeleteOrder={onDeleteOrder}
        onDeleteBatchOrders={onDeleteBatchOrders}
        onOpenInvoiceModal={onOpenInvoiceModal}
        onExportInvoicePdf={onExportInvoicePdf}
      />

      {/* Popover Calendar Modal */}
      <CalendarPickerModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        selectedDate={selectedDate}
        endDate={endDate}
        onSelectRange={(start, end) => {
          onDateChange(start);
          setEndDate(end);
          setUseDateFilter(true);
          setIsCalendarOpen(false);
        }}
        onSelectSingleDate={(dateStr) => {
          onDateChange(dateStr);
          setEndDate(undefined);
          setUseDateFilter(true);
          setIsCalendarOpen(false);
        }}
      />
    </div>
  );
};
