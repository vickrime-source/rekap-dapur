import React from 'react';
import { Search, Store as StoreIcon, ChevronDown, Filter, Activity, X } from 'lucide-react';

interface TransactionsFilterToolbarProps {
  selectedStoreFilter: string;
  onSelectStoreFilter: (store: string) => void;
  storeNames: string[];
  selectedPemasok: string;
  onSelectPemasok: (pemasok: string) => void;
  pemasokList: string[];
  selectedDapurFilter: string;
  onSelectDapurFilter: (dapur: string) => void;
  selectedStatusFilter: 'all' | 'PAID' | 'UNPAID';
  onSelectStatusFilter: (status: 'all' | 'PAID' | 'UNPAID') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const TransactionsFilterToolbar: React.FC<TransactionsFilterToolbarProps> = ({
  selectedStoreFilter,
  onSelectStoreFilter,
  storeNames,
  selectedPemasok,
  onSelectPemasok,
  pemasokList,
  selectedDapurFilter,
  onSelectDapurFilter,
  selectedStatusFilter,
  onSelectStatusFilter,
  searchQuery,
  onSearchChange,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        {/* Pill 1: Store Filter Pill */}
        <div className="relative inline-flex items-center">
          <div
            className={`rounded-full px-3.5 py-2 border shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
              selectedStoreFilter !== 'all'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 font-bold ring-1 ring-indigo-300 dark:ring-indigo-700'
                : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-600'
            }`}
          >
            <StoreIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="text-xs font-bold whitespace-nowrap">
              {selectedStoreFilter === 'all' ? 'Semua Toko' : `Toko ${selectedStoreFilter}`}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          </div>
          <select
            value={selectedStoreFilter}
            onChange={(e) => onSelectStoreFilter(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs"
            aria-label="Filter Toko"
          >
            <option value="all">Semua Toko ({storeNames.length})</option>
            {storeNames.map((st) => (
              <option key={st} value={st}>
                Toko {st}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Clear Store Filter Button */}
        {selectedStoreFilter !== 'all' && (
          <button
            type="button"
            onClick={() => onSelectStoreFilter('all')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer min-h-[44px]"
            title="Kembali tampilkan semua toko"
          >
            <span>Reset Toko</span>
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Pill 2: Filter Pemasok */}
        <div className="relative inline-flex items-center">
          <div
            className={`rounded-full px-3.5 py-2 border shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
              selectedPemasok !== 'all'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 font-bold ring-1 ring-indigo-300 dark:ring-indigo-700'
                : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-600'
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="text-xs font-bold whitespace-nowrap">
              {selectedPemasok === 'all' ? 'Semua Pemasok' : selectedPemasok}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          </div>
          <select
            value={selectedPemasok}
            onChange={(e) => onSelectPemasok(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs"
            aria-label="Filter Pemasok"
          >
            <option value="all">Semua Pemasok ({pemasokList.length})</option>
            {pemasokList.map((p) => (
              <option key={p} value={p}>
                Pemasok: {p}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Clear Pemasok Filter Button */}
        {selectedPemasok !== 'all' && (
          <button
            type="button"
            onClick={() => onSelectPemasok('all')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer min-h-[44px]"
            title="Kembali tampilkan semua pemasok"
          >
            <span>Reset Pemasok</span>
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Pill 2b: Filter Dapur (Visible if selected from breakdown) */}
        {selectedDapurFilter !== 'all' && (
          <div className="inline-flex items-center gap-1.5">
            <span className="rounded-full px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 text-xs font-bold">
              Dapur: {selectedDapurFilter}
            </span>
            <button
              type="button"
              onClick={() => onSelectDapurFilter('all')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer min-h-[44px]"
              title="Kembali tampilkan semua dapur"
            >
              <span>Reset Dapur</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Pill 3: Filter Status (PAID / UNPAID) */}
        <div className="relative inline-flex items-center">
          <div
            className={`rounded-full px-3.5 py-2 border shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] ${
              selectedStatusFilter !== 'all'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 font-bold ring-1 ring-indigo-300 dark:ring-indigo-700'
                : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-600'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="text-xs font-bold whitespace-nowrap">
              {selectedStatusFilter === 'all'
                ? 'Semua Status'
                : selectedStatusFilter === 'PAID'
                ? 'Status: LUNAS (PAID)'
                : 'Status: BELUM LUNAS (UNPAID)'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          </div>
          <select
            value={selectedStatusFilter}
            onChange={(e) => onSelectStatusFilter(e.target.value as any)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-xs"
            aria-label="Filter Status"
          >
            <option value="all">Semua Status (PAID &amp; UNPAID)</option>
            <option value="UNPAID">UNPAID (Belum Lunas)</option>
            <option value="PAID">PAID (Lunas)</option>
          </select>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Cari barang, pemasok, toko, dapur..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-7 py-2.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-full text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 shadow-2xs transition-all min-h-[44px]"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
