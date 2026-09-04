import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Settings, 
  ShoppingBag, 
  Clock,
  Download,
  Loader2,
  Receipt,
  FileSpreadsheet,
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  FileText,
  Utensils,
  Tag
} from 'lucide-react';
import { OrderItem, NoteItem, Kitchen } from '../types';
import { parseIndonesianNumber } from '../lib/formatters';

interface HeaderBannerProps {
  orders: OrderItem[];
  selectedDate: string;
  notes: NoteItem[];
  kitchens: Kitchen[];
  onToggleNoteStatus: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onOpenNewNoteSheet: () => void;
  onOpenSettings: () => void;
  onOpenExportHistory: () => void;
  onOpenSyncSheet: () => void;
  isSyncingGas?: boolean;
  isExportingActive?: boolean;
  exportHistoryCount?: number;
}

export const HeaderBanner: React.FC<HeaderBannerProps> = ({
  orders = [],
  selectedDate,
  notes = [],
  onToggleNoteStatus,
  onDeleteNote,
  onOpenNewNoteSheet,
  onOpenSettings,
  onOpenExportHistory,
  onOpenSyncSheet,
  isSyncingGas = false,
  isExportingActive = false,
  exportHistoryCount = 0,
}) => {
  const [period, setPeriod] = useState<'hari_ini' | 'bulan_ini' | 'all_time'>('hari_ini');

  // Filter orders according to active period selection
  const filteredOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    
    if (period === 'hari_ini') {
      const targetDate = selectedDate || new Date().toISOString().split('T')[0];
      return orders.filter((o) => o.tanggal === targetDate);
    } else if (period === 'bulan_ini') {
      const monthKey = (selectedDate || new Date().toISOString().split('T')[0]).substring(0, 7);
      return orders.filter((o) => o.tanggal && o.tanggal.startsWith(monthKey));
    } else {
      return orders;
    }
  }, [orders, period, selectedDate]);

  // Status helper for accurate pending count synchronized with table grouping
  const isItemPending = (item: OrderItem) => {
    const isPaid = item.paymentStatus === 'PAID' || (item.status === 'selesai' && !item.paymentStatus);
    const isDone = item.deliveryStatus === 'DONE' || (item.status === 'selesai' && !item.deliveryStatus);
    return !isPaid || !isDone || item.status === 'pending';
  };

  // Dynamic calculations
  const totalOrders = filteredOrders.length;
  const totalPending = filteredOrders.filter(isItemPending).length;

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
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none flex items-center gap-1.5 whitespace-nowrap">
                  <span>Rekap Dapur Pro</span>
                </h1>
              </div>
            </div>

            {/* Mobile Header Action Icons (Sync, Download History, Settings) */}
            <div className="sm:hidden flex items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenSyncSheet}
                title="Buka Sinkronisasi Google Sheets"
                className="relative p-2 rounded-2xl bg-slate-100/90 text-emerald-700 hover:bg-emerald-50 active:scale-95 border border-slate-200 flex items-center justify-center transition-all cursor-pointer"
              >
                <FileSpreadsheet className={`w-4 h-4 ${isSyncingGas ? 'animate-spin text-emerald-600' : ''}`} />
                {isSyncingGas && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                )}
              </button>

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
                title="Pengaturan Master Data"
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
                { id: 'bulan_ini' as const, label: 'Bulan Ini' },
                { id: 'all_time' as const, label: 'All Time' },
              ].map((opt) => {
                const isActive = period === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPeriod(opt.id)}
                    className={`relative flex-1 sm:flex-none px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 whitespace-nowrap text-center cursor-pointer select-none ${
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
                onClick={onOpenSyncSheet}
                title="Buka Sinkronisasi Google Sheets"
                className="p-2 rounded-2xl bg-slate-100/90 hover:bg-emerald-50 text-emerald-700 active:scale-95 border border-slate-200/80 transition-all cursor-pointer"
              >
                <FileSpreadsheet className={`w-4 h-4 ${isSyncingGas ? 'animate-spin text-emerald-600' : ''}`} />
              </button>

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
                title="Pengaturan Master Data"
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
          
          {/* Left Column: Stacked Unified Duo-Card (Atas: Pesanan, Bawah: Pending) */}
          <div className="md:col-span-4 flex flex-col sm:flex-row md:flex-col gap-2">
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
                  <span className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                    {totalOrders} <span className="text-[10px] font-bold text-slate-500">Item</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Box: PENDING */}
            <div className="flex-1 bg-rose-50/80 border border-rose-200/80 rounded-2xl p-2.5 flex items-center justify-between shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-sm shadow-rose-500/30 flex-shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 block">
                    PENDING
                  </span>
                  <span className="text-base sm:text-lg font-black text-rose-700 leading-tight">
                    {totalPending} <span className="text-[10px] font-bold text-rose-600/80">Item</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: HIGHLIGHT NOTES (Follow up & Done Check Dot Status) */}
          <div className="md:col-span-8 bg-slate-50/90 border border-slate-200 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9)]">
            {/* Header of Highlight Notes */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-lg bg-slate-800 text-white flex items-center justify-center">
                  <FileText className="w-3 h-3" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-900">
                  NOTES
                </span>
              </div>

              {/* + New Note Button */}
              <button
                type="button"
                onClick={onOpenNewNoteSheet}
                className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
                <span>New Note</span>
              </button>
            </div>

            {/* List of Notes with Interactive Check Dot Status */}
            <div className="mt-2 space-y-1.5 max-h-[85px] overflow-y-auto pr-1">
              {notes.length === 0 ? (
                <div className="text-center py-2 text-slate-400 text-[11px] font-medium italic">
                  Belum ada catatan follow up. Klik <strong>+ New Note</strong> untuk menambah.
                </div>
              ) : (
                notes.map((note) => {
                  return (
                    <div
                      key={note.id}
                      className={`flex items-center justify-between gap-2 p-1.5 rounded-xl border transition-all ${
                        note.isDone
                          ? 'bg-slate-100/70 border-slate-200 opacity-60'
                          : 'bg-white border-slate-200/90 shadow-2xs'
                      }`}
                    >
                      {/* Left: Interactive Check Dot + Details */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Check Dot Status Button */}
                        <button
                          type="button"
                          onClick={() => onToggleNoteStatus(note.id)}
                          title={note.isDone ? 'Klik untuk tandai Follow Up' : 'Klik untuk tandai Selesai / Done'}
                          className="flex-shrink-0 cursor-pointer focus:outline-none"
                        >
                          {note.isDone ? (
                            <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-indigo-500 bg-indigo-50 flex items-center justify-center hover:bg-indigo-100">
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                            </div>
                          )}
                        </button>

                        {/* Dapur Badge */}
                        <span className="flex-shrink-0 text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {note.tujuanDapur}
                        </span>

                        {/* Optional Item Name */}
                        {note.namaBarang && (
                          <span className="flex-shrink-0 text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 truncate max-w-[90px]">
                            {note.namaBarang}
                          </span>
                        )}

                        {/* Note Description Text */}
                        <span
                          className={`text-[10px] font-semibold truncate flex-1 ${
                            note.isDone ? 'line-through text-slate-400' : 'text-slate-800'
                          }`}
                        >
                          {note.catatan}
                        </span>
                      </div>

                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={() => onDeleteNote(note.id)}
                        className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors flex-shrink-0"
                        title="Hapus Catatan"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
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
