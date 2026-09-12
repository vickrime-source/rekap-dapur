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
  TrendingUp,
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

export const HeaderBanner: React.FC<HeaderBannerProps> = ({
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
  // Default to 'hari_ini' if uncontrolled
  const [internalPeriod, setInternalPeriod] = useState<DashboardPeriod>('hari_ini');
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
    
    if (activePeriod === 'all_time') {
      return orders;
    }

    if (activePeriod === 'hari_ini') {
      return orders.filter((o) => isOrderToday(o, selectedDate));
    } else if (activePeriod === 'mingguan') {
      return orders.filter((o) => isOrderThisWeek(o, weekRange));
    } else if (activePeriod === 'bulan_ini') {
      return orders.filter((o) => isOrderThisMonth(o, selectedDate));
    }

    return orders;
  }, [orders, activePeriod, selectedDate, weekRange]);

  // Status helper for accurate pending count synchronized with table grouping
  const isItemPending = (item: OrderItem) => {
    const isPaid = item.paymentStatus === 'PAID' || (item.status === 'selesai' && !item.paymentStatus);
    const isDone = item.deliveryStatus === 'DONE' || (item.status === 'selesai' && !item.deliveryStatus);
    return !isPaid || !isDone || item.status === 'pending';
  };

  // Dynamic calculations
  const totalOrders = filteredOrders.length;
  const totalPending = filteredOrders.filter(isItemPending).length;

  // Total Laba Bersih: (Harga Jual - Harga Beli) x Qty
  const totalLaba = useMemo(() => {
    return filteredOrders.reduce((sum, item) => {
      const qty = parseIndonesianNumber(item.qty) || 0;
      const beli = parseIndonesianNumber(item.hargaBeli) || 0;
      const jual = parseIndonesianNumber(item.hargaJual) || 0;
      return sum + ((jual - beli) * qty);
    }, 0);
  }, [filteredOrders]);

  return (
    <header className="no-print px-3 pt-3 pb-2 max-w-5xl mx-auto w-full font-sans">
      {/* Claymorphism Semi-Glass Main Container */}
      <div className="bg-white/90 backdrop-blur-xl border border-white/90 p-3 sm:p-4 rounded-3xl shadow-[0_8px_24px_rgba(166,180,200,0.25)] space-y-3">
        
        {/* Top Header Bar with Brand & Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-b border-slate-200/80 pb-2.5">
          {/* Brand & Logo */}
          <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 flex-shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none flex items-center gap-1.5 whitespace-nowrap">
                  <span>Rekap Dapur</span>
                </h1>
              </div>
            </div>

            {/* Mobile Header Action Icons (Download History, Settings) */}
            <div className="sm:hidden flex items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenExportHistory}
                title="Riwayat Export & Download"
                className={`relative p-2 rounded-2xl border transition-all cursor-pointer active:scale-95 ${
                  isExportingActive
                    ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                    : 'bg-slate-100/90 text-indigo-700 hover:bg-indigo-50 border-slate-200'
                }`}
              >
                {isExportingActive ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
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
                className="p-2 rounded-2xl bg-slate-100/90 text-slate-700 hover:text-indigo-600 active:scale-95 border border-slate-200 transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Section: Filter Switcher & Desktop Action Buttons */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            {/* Segmented Control Filter Periode with Sliding Pill Animation */}
            <div className="relative flex items-center bg-slate-200/80 p-1 rounded-full border border-slate-300/70 shadow-inner w-full sm:w-auto justify-between sm:justify-start">
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
                      isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900'
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

            <div className="hidden sm:flex items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenExportHistory}
                title="Riwayat Cetak & Download PDF/DOCX"
                className={`relative p-2 rounded-2xl border transition-all cursor-pointer active:scale-95 ${
                  isExportingActive
                    ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                    : 'bg-slate-100/90 text-indigo-700 hover:bg-indigo-50 border-slate-200/80'
                }`}
              >
                {isExportingActive ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
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
                className="p-2 rounded-2xl bg-slate-100/90 text-slate-700 hover:text-indigo-600 active:scale-95 border border-slate-200/80 transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 
          REVISION REQUIREMENT 1:
          Left Side: Stacked Duo-Card (Atas: Pesanan [Indigo], Bawah: Pending [Rose/Amber])
          Right Side: Highlight Notes for Follow Up & Done with Status Dots + New Note Button
        */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          
          {/* Left Column: Stacked Unified Duo-Card (Atas: Pesanan, Bawah: Pending, Box 3: Total Laba Bersih) */}
          <div className="md:col-span-4 tablet-landscape-full-col flex flex-col sm:flex-row md:flex-col tablet-landscape-grid-3 gap-2">
            {/* Top Box: PESANAN */}
            <div className="flex-1 bg-indigo-50/80 border border-indigo-200/80 rounded-2xl p-2.5 flex items-center justify-between shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-500/30 flex-shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 block">
                    PESANAN
                  </span>
                  <span className="text-base sm:text-lg font-black font-nominal text-slate-900 leading-tight flex items-baseline gap-1">
                    <AnimatedCounter value={totalOrders} format="number" />
                    <span className="text-[10px] font-bold text-slate-500">Item</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Box: PENDING */}
            <div className="flex-1 bg-rose-50/80 border border-rose-200/80 rounded-2xl p-2.5 flex items-center justify-between shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-sm shadow-rose-500/30 flex-shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 block">
                    PENDING
                  </span>
                  <span className="text-base sm:text-lg font-black font-nominal text-rose-700 leading-tight flex items-baseline gap-1">
                    <AnimatedCounter value={totalPending} format="number" />
                    <span className="text-[10px] font-bold text-rose-600/80">Item</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Box 3: TOTAL LABA BERSIH */}
            <div className="flex-1 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-2.5 flex items-center justify-between shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-500/30 flex-shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                    TOTAL LABA BERSIH
                  </span>
                  <span className="text-base sm:text-lg font-black font-nominal text-emerald-950 leading-tight truncate block">
                    <AnimatedCounter value={totalLaba} format="rupiah" />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: HIGHLIGHT FOLLOW UP (Daftar pesanan sementara untuk ditindaklanjuti) */}
          <div className="md:col-span-8 tablet-landscape-full-col bg-slate-50/90 border border-slate-200 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9)]">
            {/* Header of Follow Up Section */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-lg bg-indigo-900 text-white flex items-center justify-center">
                  <FileText className="w-3 h-3" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-900">
                  FOLLOW UP
                </span>
              </div>

              {/* Action Button: Tambah Follow Up */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenNewNoteSheet(false)}
                  className="px-2.5 py-1 rounded-xl bg-indigo-900 hover:bg-indigo-800 text-white text-[10px] font-black flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                  <span>Tambah Follow Up</span>
                </button>
              </div>
            </div>

            {/* List of Follow Up Items with Checklist Icon & Trash */}
            <div className="mt-2 space-y-1.5 max-h-[145px] overflow-y-auto pr-1">
              {notes.length === 0 ? (
                <div className="text-center py-2 text-slate-400 text-[11px] font-medium italic">
                  Belum ada daftar follow up. Klik <strong>+ Tambah Follow Up</strong> untuk mencatat pesanan sementara.
                </div>
              ) : (
                notes.map((note) => {
                  return (
                    <div
                      key={note.id}
                      className={`flex items-center justify-between gap-2 p-1.5 sm:p-2 rounded-xl border transition-all ${
                        note.isDone
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                          : 'bg-white border-slate-200/90 shadow-2xs hover:border-indigo-300'
                      }`}
                    >
                      {/* Left: [Dapur] [Toko] [Pemasok] [Nama Barang] [Qty] [Catatan] */}
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
                        {/* Dapur Badge */}
                        {note.tujuanDapur ? (
                          <span className="flex-shrink-0 text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {note.tujuanDapur}
                          </span>
                        ) : null}

                        {/* Toko Badge */}
                        {note.toko ? (
                          <span className="flex-shrink-0 text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 truncate max-w-[90px] flex items-center gap-0.5">
                            <Store className="w-2.5 h-2.5" />
                            <span>{note.toko}</span>
                          </span>
                        ) : null}

                        {/* Pemasok Badge */}
                        {note.pemasok ? (
                          <span className="flex-shrink-0 text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 truncate max-w-[80px] flex items-center gap-0.5">
                            <Truck className="w-2.5 h-2.5" />
                            <span>{note.pemasok}</span>
                          </span>
                        ) : null}

                        {/* Nama Barang */}
                        {note.namaBarang && (
                          <span className="flex-shrink-0 text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 truncate max-w-[110px]">
                            {note.namaBarang}
                          </span>
                        )}

                        {/* Qty & Unit Badge */}
                        {note.qty !== undefined && note.qty !== null && (
                          <span className="flex-shrink-0 text-[8.5px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                            {note.qty} {note.satuan || 'Kg'}
                          </span>
                        )}

                        {/* Catatan Awal */}
                        <span
                          className={`text-[10px] font-semibold truncate flex-1 min-w-[100px] ${
                            note.isDone ? 'line-through text-slate-400' : 'text-slate-800'
                          }`}
                          title={note.catatan}
                        >
                          {note.catatan}
                        </span>

                        {note.isDone && (
                          <span className="flex-shrink-0 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
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
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200'
                              : 'bg-indigo-50/90 text-indigo-700 border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 active:scale-95 shadow-2xs'
                          }`}
                        >
                          <CircleCheck className="w-5 h-5" />
                        </button>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => onDeleteNote(note.id)}
                          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
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
};
