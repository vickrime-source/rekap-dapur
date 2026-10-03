import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Settings, 
  ShoppingBag, 
  AlertCircle,
  Download,
  Loader2,
  Receipt,
  Plus,
  CheckCircle2,
  Circle,
  Pencil,
  FileText,
  Utensils,
  Tag,
  Scale,
  Database,
  ArrowRightCircle,
  Store,
  Truck,
  Calendar,
  ChevronDown,
  Trash2,
  ListChecks,
  Square,
  CheckSquare2
} from 'lucide-react';
import { OrderItem, NoteItem, Kitchen, DashboardPeriod } from '../types';
import { 
  parseIndonesianNumber, 
  formatRupiah, 
  parseDateSafe, 
  isOrderToday, 
  isOrderThisMonth,
  isOrderThisWeek,
  getWeekRange,
  formatTanggalWeb
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
  onOpenNewNoteSheet: () => void;
  onDeleteSelectedNotes: (noteIds: string[]) => void;
  onOpenRekap: () => void;
  onOpenSettings: () => void;
  onOpenExportHistory: () => void;
  onOpenSyncSheet?: () => void;
  isSyncingGas?: boolean;
  isExportingActive?: boolean;
  exportHistoryCount?: number;
  pendingSyncCount?: number;
  isOnline?: boolean;
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
  onOpenNewNoteSheet,
  onDeleteSelectedNotes,
  onOpenRekap,
  onOpenSettings,
  onOpenExportHistory,
  onOpenSyncSheet,
  isSyncingGas = false,
  isExportingActive = false,
  exportHistoryCount = 0,
  pendingSyncCount = 0,
  isOnline = true,
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

  // Data konversi lama tetap tersimpan untuk audit, tetapi bukan lagi antrean Follow Up.
  const followUpNotes = useMemo(
    () => notes.filter((note) => !note.orderId && String(note.status || '').toLowerCase() !== 'completed'),
    [notes]
  );

  const sortedNotes = useMemo(() => {
    const today = new Date(`${selectedDate || new Date().toISOString().slice(0, 10)}T00:00:00`).getTime();
    const getNoteDate = (note: NoteItem) => note.tanggal || note.createdAt?.slice(0, 10) || selectedDate;
    const getDistance = (note: NoteItem) => {
      const time = new Date(`${getNoteDate(note)}T00:00:00`).getTime();
      return Number.isFinite(time) ? Math.abs(time - today) : Number.MAX_SAFE_INTEGER;
    };

    return [...followUpNotes].sort((a, b) => {
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      const distanceDiff = getDistance(a) - getDistance(b);
      if (distanceDiff !== 0) return distanceDiff;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  }, [followUpNotes, selectedDate]);

  const activeNotesCount = followUpNotes.filter((note) => !note.isDone).length;

  const followUpGroups = useMemo(() => {
    const groups = new Map<string, { id: string; notes: NoteItem[] }>();

    for (const note of sortedNotes) {
      const dateKey = note.tanggal || '';
      const dapurKey = (note.tujuanDapur || '').trim().toLowerCase();
      const pemasokKey = (note.pemasok || '').trim().toLowerCase();
      // Batch ID adalah sumber paling aman. Untuk data lama, kelompokkan hanya
      // draft bulk dengan konteks yang sama; catatan manual tetap terpisah.
      const isBulkDraft = /^\s*Draft bulk:/i.test(note.catatan || '');
      const key = note.batchId
        ? `${note.batchId}|${dateKey}|${dapurKey}|${pemasokKey}`
        : (isBulkDraft
        ? `legacy-bulk|${dateKey}|${dapurKey}|${pemasokKey}`
        : `note|${note.id}`);
      const existing = groups.get(key);
      if (existing) existing.notes.push(note);
      else groups.set(key, { id: key, notes: [note] });
    }

    return Array.from(groups.values());
  }, [sortedNotes]);

  const [openFollowUpGroups, setOpenFollowUpGroups] = useState<Record<string, boolean>>({});
  const [isSelectingNotes, setIsSelectingNotes] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const existingIds = new Set(followUpNotes.map((note) => note.id));
    setSelectedNoteIds((previous) => {
      const remaining = [...previous].filter((id) => existingIds.has(id));
      return remaining.length === previous.size ? previous : new Set(remaining);
    });
  }, [followUpNotes]);

  useEffect(() => {
    if (followUpNotes.length === 0) setIsSelectingNotes(false);
  }, [followUpNotes.length]);

  const toggleNoteSelection = (ids: string[]) => {
    setSelectedNoteIds((previous) => {
      const next = new Set(previous);
      const allSelected = ids.every((id) => next.has(id));
      ids.forEach((id) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
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

  // Dynamic memoized calculations for operational metrics: Estimasi Laba, Pesanan (Trx), & Pending (Trx)
  const { totalBatches, pendingBatches, totalLabaBersih } = useMemo(() => {
    let labaBersih = 0;
    const batchMap = new Map<string, { allPaid: boolean; allDone: boolean }>();

    for (let i = 0; i < filteredOrders.length; i++) {
      const item = filteredOrders[i];

      // Acuan status pembayaran dan pengiriman
      const isPaid = item.paymentStatus === 'PAID' || (item.status === 'selesai' && !item.paymentStatus);
      const isDone = item.deliveryStatus === 'DONE' || (item.status === 'selesai' && !item.deliveryStatus);

      // Group per keberangkatan (trx) sesuai acuan tabel pesanan (tanggal + tujuan dapur + toko)
      const batchKey = item.notaId || item.nota_id || `${item.tanggal}||${item.tujuanDapur}||${item.toko}||${item.createdAt || ''}`;

      if (!batchMap.has(batchKey)) {
        batchMap.set(batchKey, { allPaid: isPaid, allDone: isDone });
      } else {
        const batch = batchMap.get(batchKey)!;
        if (!isPaid) batch.allPaid = false;
        if (!isDone) batch.allDone = false;
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
      const jual = parseIndonesianNumber(item.hargaJual);
      const cb = parseIndonesianNumber(item.cashback);
      const modalItem = qtyBeliEfektif * beli;
      const omzetItem = qtyFinal * jual;
      const labaItem = cb > 0 ? ((cb - beli) * qtyFinal) : (omzetItem - modalItem);
      labaBersih += labaItem;
    }

    let pendingCount = 0;
    batchMap.forEach((batch) => {
      // Acuan keberangkatan pending: delivery belum DONE atau payment belum PAID (unpaid)
      if (!batch.allPaid || !batch.allDone) {
        pendingCount++;
      }
    });

    return {
      totalBatches: batchMap.size,
      pendingBatches: pendingCount,
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
        <div className="grid grid-cols-1 gap-2.5">
          {/* Left: Status Operasional (Estimasi Laba, Pesanan & Pending) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* 1. Box Estimasi Laba (Teratas) */}
            <button type="button" onClick={onOpenRekap} aria-label="Buka Rekap dari Laba Bersih" title="Buka Rekap" className="order-2 w-full bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800/60 rounded-2xl p-2 sm:p-2.5 flex items-center justify-between text-left shadow-2xs transition-colors duration-200 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 cursor-pointer">
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
            </button>

            {/* 2. Box Pesanan (Tengah - Per Keberangkatan) */}
            <div className="order-1 bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-2 sm:p-2.5 flex items-center justify-between shadow-2xs transition-colors duration-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-800/80 flex-shrink-0">
                  <ShoppingBag className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Pesanan
                  </span>
                  <span className="text-xs sm:text-sm font-black font-nominal text-slate-800 dark:text-slate-100 leading-none">
                    <AnimatedCounter value={totalBatches} format="number" /> <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">trx</span>
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Box Pending (Bawah - Per Keberangkatan) */}
            <div className={`order-3 rounded-2xl p-2 sm:p-2.5 flex items-center justify-between border shadow-2xs transition-colors duration-200 ${
              pendingBatches > 0
                ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200/90 dark:border-rose-800/60'
                : 'bg-white dark:bg-slate-800/90 border-slate-200/90 dark:border-slate-700/80'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center border flex-shrink-0 ${
                  pendingBatches > 0
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-600'
                }`}>
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider block ${
                    pendingBatches > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    Pending
                  </span>
                  <span className={`text-xs sm:text-sm font-black font-nominal leading-none ${
                    pendingBatches > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200'
                  }`}>
                    <AnimatedCounter value={pendingBatches} format="number" /> <span className="text-[10px] font-medium opacity-80">trx</span>
                  </span>
                </div>
              </div>
            </div>

            {totalBatches === 0 && orders.length > 0 && activePeriod !== 'all_time' && (
              <button
                type="button"
                onClick={() => handleSetPeriod('all_time')}
                className="order-4 text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 border border-indigo-200 dark:border-indigo-800 rounded-xl px-2.5 py-1.5 text-center cursor-pointer transition-colors shadow-2xs w-full"
                title="Klik untuk melihat semua pesanan yang tersimpan di database"
              >
                Data aman: Ada {orders.length} pesanan di All Time &rarr;
              </button>
            )}
          </div>

          {/* Right Column: HIGHLIGHT FOLLOW UP */}
          <div className="bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9)] dark:shadow-none transition-colors duration-200">
            {/* Header of Follow Up Section */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-lg bg-indigo-900 dark:bg-indigo-600 text-white flex items-center justify-center">
                  <FileText className="w-3 h-3" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  FOLLOW UP
                </span>
                {followUpNotes.length > 0 && (
                  <span className="text-[9.5px] font-black px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300">
                    {activeNotesCount}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {notes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSelectingNotes((value) => !value);
                      setSelectedNoteIds(new Set());
                    }}
                    aria-label={isSelectingNotes ? 'Selesai memilih Follow Up' : 'Pilih banyak Follow Up'}
                    aria-pressed={isSelectingNotes}
                    title={isSelectingNotes ? 'Selesai memilih' : 'Pilih banyak'}
                    className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${isSelectingNotes ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'}`}
                  >
                    <ListChecks className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenNewNoteSheet}
                  aria-label="Tambah Follow Up"
                  title="Tambah Follow Up"
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  <Plus className="w-4 h-4 stroke-[2.7]" />
                </button>
              </div>
            </div>

            {isSelectingNotes && (
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 py-2 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => toggleNoteSelection(followUpNotes.map((note) => note.id))}
                  aria-label={selectedNoteIds.size === followUpNotes.length ? 'Batal pilih semua Follow Up' : 'Pilih semua Follow Up'}
                  title={selectedNoteIds.size === followUpNotes.length ? 'Batal pilih semua' : 'Pilih semua'}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-indigo-700 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-950 focus-visible:outline-2 focus-visible:outline-indigo-500"
                >
                  {selectedNoteIds.size === followUpNotes.length ? <CheckSquare2 className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                </button>
                <div className="flex items-center gap-1.5">
                  <span aria-live="polite" className="min-w-6 rounded-full bg-indigo-100 px-1.5 py-0.5 text-center text-[10px] font-black text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{selectedNoteIds.size}</span>
                  <button
                    type="button"
                    disabled={selectedNoteIds.size === 0}
                    onClick={() => onDeleteSelectedNotes([...selectedNoteIds])}
                    aria-label={`Hapus ${selectedNoteIds.size} Follow Up terpilih`}
                    title={`Hapus ${selectedNoteIds.size} terpilih`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-35 dark:text-rose-400 dark:hover:bg-rose-950 focus-visible:outline-2 focus-visible:outline-rose-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Follow Up dikelompokkan agar 92 item tetap bisa diaudit tanpa menjadi daftar panjang. */}
            <div className="mt-2 space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {sortedNotes.length === 0 ? (
                <div className="text-center py-2 text-slate-400 dark:text-slate-500 text-[11px] font-medium italic">
                  Belum ada catatan follow up.
                </div>
              ) : (
                followUpGroups.map((group) => {
                  const first = group.notes[0];
                  const isOpen = openFollowUpGroups[group.id] ?? group.notes.some((note) => !note.isDone);
                  const activeCount = group.notes.filter((note) => !note.isDone).length;
                  const groupDate = first.tanggal ? formatTanggalWeb(first.tanggal, false) : 'Tanggal belum disebut';
                  const groupDapur = first.tujuanDapur?.trim() || 'Dapur belum disebut';
                  const groupPemasok = first.pemasok?.trim() || 'Pemasok belum disebut';
                  const groupIds = group.notes.map((note) => note.id);
                  const selectedInGroup = groupIds.filter((id) => selectedNoteIds.has(id)).length;

                  return (
                    <div key={group.id} className="rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-800 shadow-2xs overflow-hidden">
                      <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setOpenFollowUpGroups((prev) => ({ ...prev, [group.id]: !isOpen }))}
                        aria-expanded={isOpen}
                        className="min-w-0 flex-1 flex items-center justify-between gap-2 p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                          <ChevronDown className={`w-4 h-4 flex-shrink-0 text-indigo-600 dark:text-indigo-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          <span className={`flex-shrink-0 text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded border ${first.tujuanDapur ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' : 'bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'}`}>
                            {groupDapur}
                          </span>
                          <span className="flex flex-shrink-0 items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[8.5px] font-black text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            <Calendar className="h-2.5 w-2.5" />
                            {groupDate}
                          </span>
                          <span className={`flex-shrink-0 text-[8.5px] font-bold px-1.5 py-0.5 rounded border truncate max-w-[125px] flex items-center gap-0.5 ${first.pemasok ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' : 'bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'}`}>
                            <Truck className="w-2.5 h-2.5" />
                            <span>{groupPemasok}</span>
                          </span>
                          <span className="flex-shrink-0 text-[8.5px] font-black px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/70 text-indigo-800 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700">
                            {group.notes.length} item{group.notes.length === 1 ? '' : 's'}
                          </span>
                          {activeCount !== group.notes.length && (
                            <span className="text-[8px] font-bold text-emerald-700 dark:text-emerald-300">{activeCount} aktif</span>
                          )}
                        </div>
                      </button>

                      {isSelectingNotes && (
                        <button
                          type="button"
                          onClick={() => toggleNoteSelection(groupIds)}
                          aria-label={selectedInGroup === group.notes.length ? `Batal pilih grup ${groupDapur}` : `Pilih ${group.notes.length} Follow Up di grup ${groupDapur}`}
                          aria-pressed={selectedInGroup === group.notes.length}
                          title={selectedInGroup === group.notes.length ? 'Batal pilih grup' : 'Pilih grup'}
                          className="mx-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950 focus-visible:outline-2 focus-visible:outline-indigo-500"
                        >
                          {selectedInGroup === group.notes.length ? <CheckSquare2 className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                        </button>
                      )}
                      </div>

                      {isOpen && <div className="border-t border-slate-200 dark:border-slate-700 p-1.5 space-y-1.5">
                        {group.notes.map((note) => {
                          return (
                    <div
                      key={note.id}
                      className={`flex items-center justify-between gap-2 p-1.5 sm:p-2 rounded-xl border transition-all ${
                        note.isDone
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200'
                          : 'bg-slate-50/80 dark:bg-slate-900/50 border-slate-200/90 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-500'
                      }`}
                    >
                      {isSelectingNotes && (
                        <input
                          type="checkbox"
                          checked={selectedNoteIds.has(note.id)}
                          onChange={() => toggleNoteSelection([note.id])}
                          aria-label={`Pilih Follow Up ${note.namaBarang || note.catatan}`}
                          className="h-4 w-4 shrink-0 accent-indigo-600"
                        />
                      )}
                      {/* Detail item; konteks dapur, tanggal, dan pemasok sudah terlihat di kepala grup. */}
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
                        {/* Toko Badge */}
                        {note.toko ? (
                          <span className="flex-shrink-0 text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 truncate max-w-[90px] flex items-center gap-0.5">
                            <Store className="w-2.5 h-2.5" />
                            <span>{note.toko}</span>
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

                      {/* Right: satu tombol edit untuk mencegah salah tekan */}
                      {!isSelectingNotes && <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Edit Button: lengkapi field sebelum dipindahkan ke transaksi */}
                        <button
                          type="button"
                          onClick={() => (onFollowUpNote ? onFollowUpNote(note) : onToggleNoteStatus(note.id))}
                          title={note.isDone ? "Tinjau Follow Up" : "Edit dan lengkapi Follow Up"}
                          aria-label="Edit Follow Up"
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                            note.isDone
                              ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-900'
                              : 'bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:text-white active:scale-95 shadow-2xs'
                          }`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>}
                    </div>
                          );
                        })}
                      </div>}
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
