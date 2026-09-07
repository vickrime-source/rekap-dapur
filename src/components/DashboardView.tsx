import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Store as StoreIcon,
  Utensils,
  Calendar as CalendarIcon,
  ChevronDown,
  X
} from 'lucide-react';
import { OrderItem, Kitchen, Store as StoreType, PaymentStatus, DeliveryStatus } from '../types';
import { OrdersTableView } from './OrdersTableView';
import { CalendarPickerModal } from './CalendarPickerModal';
import { formatTanggal, parseDateSafe, normalizeDateSimple, isOrderToday } from '../lib/formatters';

interface DashboardViewProps {
  orders: OrderItem[];
  isLoading?: boolean;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onToggleStatus: (id: string) => void;
  onUpdatePaymentStatus: (id: string, status: PaymentStatus) => void;
  onUpdateDeliveryStatus: (id: string, status: DeliveryStatus) => void;
  onUpdateGroupPaymentStatus?: (groupItems: OrderItem[], status: PaymentStatus) => void;
  onUpdateGroupDeliveryStatus?: (groupItems: OrderItem[], status: DeliveryStatus) => void;
  onDuplicateOrder: (item: OrderItem) => void;
  onToggleBatchStatus: (kitchenName: string, date: string, targetStatus: 'pending' | 'selesai') => void;
  onEditOrder: (item: OrderItem) => void;
  onDeleteOrder: (id: string) => void;
  onDeleteKitchenOrders: (kitchenName: string, date: string) => void;
  onOpenAddModal: (prefilledKitchen?: string) => void;
  onOpenInvoiceModal: (items: OrderItem[], kitchenName?: string, storeName?: string) => void;
  onExportInvoicePdf?: (items: OrderItem[], kitchenName: string, storeName: string, dateStr?: string) => void;
  kitchens: Kitchen[];
  stores: StoreType[];
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
  onOpenAddModal,
  onOpenInvoiceModal,
  onExportInvoicePdf,
  kitchens,
  stores,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [selectedKitchenFilter, setSelectedKitchenFilter] = useState<string>('all');
  const [useDateFilter, setUseDateFilter] = useState<boolean>(false); // Default ALL TIME
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);

  // Filter orders (All Time by default, or filtered by date if toggled/selected)
  const filteredOrders = useMemo(() => {
    return orders.filter((item) => {
      // Date filter (if active)
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
      }

      // Search filter
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

      // Store filter
      if (selectedStoreFilter !== 'all' && item.toko !== selectedStoreFilter) {
        return false;
      }

      // Kitchen filter
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
      {/* Search & Pill Filter Bar (Matching User Reference Image) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Pill Filters Group */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Pill 1: Store Icon (Purple) + Semua Toko + Chevron */}
          <div className="relative inline-flex items-center">
            <div className="rounded-full px-4 py-2 bg-white border border-indigo-200/90 shadow-2xs hover:border-indigo-400 hover:shadow-xs transition-all flex items-center gap-2 cursor-pointer">
              <StoreIcon className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                {selectedStoreFilter === 'all' ? 'Semua Toko' : `Toko ${selectedStoreFilter}`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            </div>
            <select
              value={selectedStoreFilter}
              onChange={(e) => setSelectedStoreFilter(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs"
            >
              <option value="all">Semua Toko ({stores.length})</option>
              {stores.map((st) => (
                <option key={st.id} value={st.nama}>
                  Toko {st.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Pill 2: Utensils Icon (Purple) + Semua Dapur + Chevron */}
          <div className="relative inline-flex items-center">
            <div className="rounded-full px-4 py-2 bg-white border border-indigo-200/90 shadow-2xs hover:border-indigo-400 hover:shadow-xs transition-all flex items-center gap-2 cursor-pointer">
              <Utensils className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                {selectedKitchenFilter === 'all' ? 'Semua Dapur' : `Dapur ${selectedKitchenFilter}`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            </div>
            <select
              value={selectedKitchenFilter}
              onChange={(e) => setSelectedKitchenFilter(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs"
            >
              <option value="all">Semua Dapur ({kitchens.length})</option>
              {kitchens.map((k) => (
                <option key={k.id} value={k.nama}>
                  Dapur {k.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Pill 3: Calendar Icon (Purple) + All Time / Date Range + Chevron */}
          <div className="relative inline-flex items-center">
            {useDateFilter ? (
              <div className="rounded-full px-4 py-2 bg-indigo-50/80 border border-indigo-300 shadow-2xs flex items-center gap-2 cursor-pointer">
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
                  className="text-indigo-400 hover:text-indigo-700 ml-0.5 p-0.5"
                  title="Reset ke All Time"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setUseDateFilter(true);
                  setIsCalendarOpen(true);
                }}
                className="rounded-full px-4 py-2 bg-white border border-indigo-200/90 shadow-2xs hover:border-indigo-400 hover:shadow-xs transition-all flex items-center gap-2 cursor-pointer text-left"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                  All Time
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              </button>
            )}
          </div>
        </div>

        {/* Search Input in pill aesthetic */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari barang, toko, dapur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-7 py-2 bg-white border border-slate-200/90 rounded-full text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Hierarchical Orders Table */}
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
        onOpenInvoiceModal={onOpenInvoiceModal}
        onExportInvoicePdf={onExportInvoicePdf}
      />

      {/* Popover Calendar Modal (for optional date scope filtering) */}
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
