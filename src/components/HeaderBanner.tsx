import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Settings, 
  ShoppingBag, 
  AlertCircle,
  Download,
  Loader2,
  Receipt,
  Plus,
  CircleCheck,
  CheckCircle2,
  Circle,
  Trash2,
  FileText,
  Utensils,
  Tag,
  Scale,
  Check,
  Database,
  ArrowRightCircle,
  Store,
  Truck
} from 'lucide-react';
import { OrderItem, NoteItem, Kitchen, DashboardPeriod } from '../types';
import { 
  parseIndonesianNumber, 
  formatRupiah, 
  parseDateSafe, 
  isOrderToday, 
  isOrderThisMonth,
  isOrderThisWeek,
  getWeekRange
} from '../lib/formatters';
import { AnimatedCounter } from './AnimatedCounter';
import { ThemeToggle } from './ThemeToggle';

interface HeaderBannerProps {
  orders: OrderItem[];
  selectedDate: string;
  notes: NoteItem[];
  kitchens: Kitchen[];
  period?: DashboardPeriod;
  onPeriodChange?: (period: DashboardPeriod) => void;
  onToggleNoteStatus: (noteId: string) => void;
  onFollowUpNote?: (note: NoteItem) => void;
  onDeleteNote: (noteId: string) => void;
  onOpenNewNoteSheet: (startVoice?: boolean) => void;
  onOpenSettings: () => void;
  onOpenExportHistory: () => void;
  onOpenSyncSheet?: () => void;
  isSyncingGas?: boolean;
  isExportingActive?: boolean;
  exportHistoryCount?: number;
  pendingSyncCount?: number;
  isOnline?: boolean;
  onStartVoiceHold?: () => void;
  onStopVoiceHold?: () => void;
  isVoiceActive?: boolean;
}

export const HeaderBanner: React.FC<HeaderBannerProps> = React.memo(({
  orders = [],
  selectedDate,
  notes = [],
  kitchens = [],
  period: periodProp,
  onPeriodChange,
  onToggleNoteStatus,
  onFollowUpNote,
  onDeleteNote,
  onOpenNewNoteSheet,
  onOpenSettings,
  onOpenExportHistory,
  onOpenSyncSheet,
  isSyncingGas = false,
  isExportingActive = false,
  exportHistoryCount = 0,
  pendingSyncCount = 0,
  isOnline = true,
  onStartVoiceHold,
  onStopVoiceHold,
  isVoiceActive = false,
}) => {
  // Default to 'all_time' if uncontrolled
  const [internalPeriod, setInternalPeriod] = useState<DashboardPeriod>('all_time');
  const activePeriod = periodProp ?? internalPeriod;
  const handleSetPeriod = (newP: DashboardPeriod) => {
    if (onPeriodChange) {
      onPeriodChange(newP);
    } else {
      setInternalPeriod(newP);
    }
  };

  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);

  // Filter orders according to active period selection with robust date & WIB parsing
  const filteredOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    
    // Exclude cancelled orders from dashboard header counts and metrics
    const nonCancelled = orders.filter((o) => o.status !== 'CANCELLED');

    if (activePeriod === 'all_time') {
      return nonCancelled;
    }

    if (activePeriod === 'hari_ini') {
      return nonCancelled.filter((o) => isOrderToday(o, selectedDate));
    } else if (activePeriod === 'mingguan') {
      return nonCancelled.filter((o) => isOrderThisWeek(o, weekRange));
    } else if (activePeriod === 'bulan_ini') {
      return nonCancelled.filter((o) => isOrderThisMonth(o, selectedDate));
    }

    return nonCancelled;
  }, [orders, activePeriod, selectedDate, weekRange]);

  // Dynamic memoized calculations for operational metrics: Pesanan, Laba Bersih & Pending
  const { totalOrders, totalPending, totalLabaBersih } = useMemo(() => {
    let pendingCount = 0;
    let labaBersih = 0;

    for (let i = 0; i < filteredOrders.length; i++) {
      const item = filteredOrders[i];
      const isPaid = item.paymentStatus === 'PAID' || (item.status === 'selesai' && !item.paymentStatus);
      const isDone = item.deliveryStatus === 'DONE' || (item.status === 'selesai' && !item.deliveryStatus);
      if (!isPaid || !isDone || item.status === 'pending') {
        pendingCount++;
      }

      const rawQtyJual = parseIndonesianNumber(item.qty);
      const rawQtyBeli = (item as any).qtyBeli !== undefined && (item as any).qtyBeli !== null
        ? parseIndonesianNumber((item as any).qtyBeli)
        : ((item as any).qty_beli !== undefined && (item as any).qty_beli !== null
          ? parseIndonesianNumber((item as any).qty_beli)
          : rawQtyJual);
      const returQty = Math.max(0, Number(item.retur) || 0);
      const qtyFinal = Math.max(0, rawQtyJual - returQty);
      const qtyBeliEfektif = Math.max(0, rawQtyBeli - returQty);
      const beli = parseIndonesianNumber(item.hargaBeli);
      const jual = parseIndonesianNumber(item.hargaJual || item.hargaBeli);
      const cb = parseIndonesianNumber(item.cashback);
      const modalItem = qtyBeliEfektif * beli;
      const omzetItem = qtyFinal * jual;
      const labaItem = cb > 0 ? ((cb - beli) * qtyFinal) : (omzetItem - modalItem);
      labaBersih += labaItem;
    }

    return {
      totalOrders: filteredOrders.length,
      totalPending: pendingCount,
      totalLabaBersih: labaBersih,
    };
  }, [filteredOrders]);

  return (
    <header className="no-print px-3 sm:px-6 lg:px-8 pt-3 pb-2 max-w-7xl xl:max-w-[1536px] mx-auto w-full font-sans">
      {/* Claymorphism Semi-Glass Main Container */}
      <div className="bg-white/95 dark:bg-slate-900/95 border border-white/90 dark:border-slate-800 p-3 sm:p-4 rounded-3xl shadow-[0_8px_24px_rgba(166,180,200,0.25)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)] space-y-3 transition-colors duration-200">
        
        {/* Top Header Bar with Brand & Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-b border-slate-200/80 dark:border-slate-800 pb-2.5">
          {/* Brand & Logo */}
          <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-1 flex items-center justify-center shadow-md shadow-slate-200/50 dark:shadow-none flex-shrink-0">
                <img src="/icons/htg-192.png" alt="HTG" className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0 flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 tracking-tight leading-none flex items-center gap-1.5 whitespace-nowrap">
                  <span>HTG Accounting</span>
                </h1>
              </div>
            </div>

            {/* Mobile Header Action Icons (Dark Mode, Download History, Settings) */}
            <div className="sm:hidden flex items-center gap-1.5">
              <ThemeToggle />

              <button
                type="button"
                onClick={onOpenExportHistory}
                title="Riwayat Export & Download"
                className={`relative p-2 rounded-2xl border transition-all cursor-pointer active:scale-95 ${
                  isExportingActive
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 animate-pulse'
                    : 'bg-slate-100/90 dark:bg-slate-800/90 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                }`}
              >
                {isExportingActive ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {exportHistoryCount > 0 && !isExportingActive && (
                  <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {exportHistoryCount > 9 ? '9+' : exportHistoryCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={onOpenSettings}
                title="Pengaturan & Kelola Data"
                className="p-2 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Section: Filter Switcher & Desktop Action Buttons */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            {/* Segmented Control Filter Periode with Sliding Pill Animation */}
            <div className="relative flex items-center bg-slate-200/80 dark:bg-slate-800/80 p-1 rounded-full border border-slate-300/70 dark:border-slate-700 shadow-inner w-full sm:w-auto justify-between sm:justify-start">
              {[
                { id: 'hari_ini' as const, label: 'Hari Ini' },
                { id: 'mingguan' as const, label: 'Mingguan' },
                { id: 'bulan_ini' as const, label: 'Bulanan' },
                { id: 'all_time' as const, label: 'All Time' },
              ].map((opt) => {
                const isActive = activePeriod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSetPeriod(opt.id)}
                    className={`relative flex-1 sm:flex-none px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 whitespace-nowrap text-center cursor-pointer select-none ${
                      isActive ? 'text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activePeriodPill"
                        className="absolute inset-0 bg-indigo-600 rounded-full shadow-sm shadow-indigo-600/30"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Desktop Action Buttons: Dark Mode | Download | Settings */}
            <div className="hidden sm:flex items-center gap-1.5">
              <ThemeToggle />

              <button
                type="button"
                onClick={onOpenExportHistory}
                title="Riwayat Cetak & Download PDF/DOCX"
                className={`relative p-2 rounded-2xl border transition-all cursor-pointer active:scale-95 ${
                  isExportingActive
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 animate-pulse'
                    : 'bg-slate-100/90 dark:bg-slate-800/90 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 border-slate-200/80 dark:border-slate-700'
                }`}
              >
                {isExportingActive ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {exportHistoryCount > 0 && !isExportingActive && (
                  <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {exportHistoryCount > 9 ? '9+' : exportHistoryCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={onOpenSettings}
                title="Pengaturan & Kelola Data"
                className="p-2 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* SUB-ROW: Status Operasional & Follow Up Notes */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          {/* Left: Status Operasional (Pesanan, Laba Bersih & Pending) */}
          <div className="md:col-span-4 tablet-landscape-full-col grid grid-cols-1 sm:grid-cols-3 md:flex md:flex-col tablet-landscape-grid-3 gap-2">
            {/* Box Pesanan */}
            <div className="flex-1 bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-2 sm:p-2.5 flex items-center justify-between shadow-2xs transition-colors duration-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-800/80 flex-shrink-0">
                  <ShoppingBag className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Pesanan
                  </span>
                  <span className="text-xs sm:text-sm font-black font-nominal text-slate-800 dark:text-slate-100 leading-none">
                    <AnimatedCounter value={totalOrders} format="number" /> <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">item</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Box Laba Bersih */}
            <div className="flex-1 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800/60 rounded-2xl p-2 sm:p-2.5 flex items-center justify-between shadow-2xs transition-colors duration-200">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center border border-emerald-600 shadow-xs flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                    Laba Bersih
                  </span>
                  <span className="text-xs sm:text-sm font-black font-nominal text-emerald-950 dark:text-emerald-100 leading-none truncate block">
                    <AnimatedCounter value={totalLabaBersih} format="rupiah" />
                  </span>
                </div>
              </div>
            </div>

            {/* Box Pending */}
            <div className={`flex-1 rounded-2xl p-2 sm:p-2.5 flex items-center justify-between border shadow-2xs transition-colors duration-200 ${
              totalPending > 0
                ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200/90 dark:border-rose-800/60'
                : 'bg-white dark:bg-slate-800/90 border-slate-200/90 dark:border-slate-700/80'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center border flex-shrink-0 ${
                  totalPending > 0
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-600'
                }`}>
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider block ${
                    totalPending > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    Pending
                  </span>
                  <span className={`text-xs sm:text-sm font-black font-nominal leading-none ${
                    totalPending > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200'
                  }`}>
                    <AnimatedCounter value={totalPending} format="number" /> <span className="text-[10px] font-medium opacity-80">item</span>
                  </span>
                </div>
              </div>
            </div>

            {totalOrders === 0 && orders.length > 0 && activePeriod !== 'all_time' && (
              <button
                type="button"
                onClick={() => handleSetPeriod('all_time')}
                className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 border border-indigo-200 dark:border-indigo-800 rounded-xl px-2.5 py-1.5 text-center cursor-pointer transition-colors shadow-2xs w-full"
                title="Klik untuk melihat semua pesanan yang tersimpan di database"
              >
                Data aman: Ada {orders.length} pesanan di All Time &rarr;
              </button>
            )}
          </div>

          {/* Right Column: HIGHLIGHT FOLLOW UP */}
          <div className="md:col-span-8 tablet-landscape-full-col bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9)] dark:shadow-none transition-colors duration-200">
            {/* Header of Follow Up Section */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-lg bg-indigo-900 dark:bg-indigo-600 text-white flex items-center justify-center">
                  <FileText className="w-3 h-3" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  FOLLOW UP
                </span>
                {notes.length > 0 && (
                  <span className="text-[9.5px] font-black px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300">
                    {notes.length}
                  </span>
                )}
              </div>

              {/* Action Button: Tambah Follow Up */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenNewNoteSheet(false)}
                  className="px-2.5 py-1 rounded-xl bg-indigo-900 hover:bg-indigo-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-[10px] font-black flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                  <span>Tambah Follow Up</span>
                </button>
              </div>
            </div>

            {/* List of Follow Up Items with Checklist Icon & Trash */}
            <div className="mt-2 space-y-1.5 max-h-[125px] overflow-y-auto pr-1">
              {notes.length === 0 ? (
                <div className="text-center py-2 text-slate-400 dark:text-slate-500 text-[11px] font-medium italic">
                  Belum ada catatan follow up.
                </div>
              ) : (
                notes.map((note) => {
                  return (
                    <div
                      key={note.id}
                      className={`flex items-center justify-between gap-2 p-1.5 sm:p-2 rounded-xl border transition-all ${
                        note.isDone
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200'
                          : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700/80 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-500'
                      }`}
                    >
                      {/* Left: [Dapur] [Toko] [Pemasok] [Nama Barang] [Qty] [Catatan] */}
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
                        {/* Dapur Badge */}
                        {note.tujuanDapur ? (
                          <span className="flex-shrink-0 text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            {note.tujuanDapur}
                          </span>
                        ) : null}

                        {/* Toko Badge */}
                        {note.toko ? (
                          <span className="flex-shrink-0 text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 truncate max-w-[90px] flex items-center gap-0.5">
                            <Store className="w-2.5 h-2.5" />
                            <span>{note.toko}</span>
                          </span>
                        ) : null}

                        {/* Pemasok Badge */}
                        {note.pemasok ? (
                          <span className="flex-shrink-0 text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 truncate max-w-[80px] flex items-center gap-0.5">
                            <Truck className="w-2.5 h-2.5" />
                            <span>{note.pemasok}</span>
                          </span>
                        ) : null}

                        {/* Multi-Item Count Badge */}
                        {note.items && note.items.length > 1 && (
                          <span className="flex-shrink-0 text-[8.5px] font-black px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/70 text-indigo-800 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700">
                            {note.items.length} Item
                          </span>
                        )}

                        {/* Nama Barang */}
                        {note.namaBarang && (
                          <span className="flex-shrink-0 text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600 truncate max-w-[110px]">
                            {note.namaBarang}
                          </span>
                        )}

                        {/* Qty & Unit Badge */}
                        {note.qty !== undefined && note.qty !== null && (
                          <span className="flex-shrink-0 text-[8.5px] font-black px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            {note.qty} {note.satuan || 'Kg'}
                          </span>
                        )}

                        {/* Catatan Awal */}
                        <span
                          className={`text-[10px] font-semibold truncate flex-1 min-w-[100px] ${
                            note.isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'
                          }`}
                          title={note.catatan}
                        >
                          {note.catatan}
                        </span>

                        {note.isDone && (
                          <span className="flex-shrink-0 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                            SELESAI
                          </span>
                        )}
                      </div>

                      {/* Right: [✓ Checklist Button] [Trash Button] */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Checklist Button: Klik untuk membuka proses Follow Up (lengkapi harga & simpan ke transaksi) */}
                        <button
                          type="button"
                          onClick={() => (onFollowUpNote ? onFollowUpNote(note) : onToggleNoteStatus(note.id))}
                          title={note.isDone ? "Sudah masuk transaksi (Klik untuk tinjau/ubah)" : "Proses Follow Up"}
                          aria-label="Proses Follow Up"
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                            note.isDone
                              ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-900'
                              : 'bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:text-white active:scale-95 shadow-2xs'
                          }`}
                        >
                          <CircleCheck className="w-5 h-5" />
                        </button>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => onDeleteNote(note.id)}
                          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-transparent hover:border-rose-200 dark:hover:border-rose-800 transition-all cursor-pointer"
                          title="Hapus Follow Up"
                          aria-label="Hapus Follow Up"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </header>
  );
});
