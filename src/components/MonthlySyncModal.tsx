import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink, 
  Settings, 
  FileText,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OrderItem, PeriodSummaryStats } from '../types';
import { formatRupiah } from '../lib/formatters';
import { 
  buildMonthlyRecapPayload, 
  syncMonthlyRecapToEndpoint, 
  downloadMonthlyRecapCsv, 
  downloadMonthlyRecapSummaryDoc,
  getCurrentMonthLabel
} from '../lib/monthlyRecapSync';

interface MonthlySyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: OrderItem[];
  stats: PeriodSummaryStats;
  selectedDate?: string;
  onOpenSettings?: () => void;
}

export const MonthlySyncModal: React.FC<MonthlySyncModalProps> = ({
  isOpen,
  onClose,
  orders,
  stats,
  selectedDate,
  onOpenSettings,
}) => {
  const [endpointUrl, setEndpointUrl] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    type: 'success' | 'error' | 'idle';
    message?: string;
  }>({ type: 'idle' });

  // Load endpoint URL from localStorage whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('gas_rekap_bulanan_sheet_url') || '';
      setEndpointUrl(saved.trim());
      setSyncStatus({ type: 'idle' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const monthLabel = getCurrentMonthLabel(selectedDate);
  const payload = buildMonthlyRecapPayload(orders, stats, selectedDate);

  const handleSyncToSheets = async () => {
    if (!endpointUrl) {
      setSyncStatus({
        type: 'error',
        message: 'Endpoint Link Sheet belum diisi. Silakan masukkan link di Pengaturan.',
      });
      return;
    }

    setIsSyncing(true);
    setSyncStatus({ type: 'idle' });

    const result = await syncMonthlyRecapToEndpoint(endpointUrl, payload);
    setIsSyncing(false);

    if (result.success) {
      setSyncStatus({
        type: 'success',
        message: result.message,
      });
    } else {
      setSyncStatus({
        type: 'error',
        message: result.message,
      });
    }
  };

  const handleDownloadCsv = () => {
    downloadMonthlyRecapCsv(payload);
  };

  const handleDownloadDoc = () => {
    downloadMonthlyRecapSummaryDoc(payload);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 no-print font-sans">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl z-10 border border-slate-200/90 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header Bar */}
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/25 shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 leading-tight">
                  Simpan &amp; Update Rekapan Bulanan
                </h3>
                <span className="text-[11px] font-semibold text-slate-500">
                  Sinkronisasi Google Sheets / Dokumen / CSV
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/80 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
            {/* Snapshot Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">
                  Periode Rekapan
                </span>
                <span className="font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                  {monthLabel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
                <div>
                  <span className="text-[10px] text-slate-500 block">Total Transaksi</span>
                  <span className="font-extrabold text-slate-900 font-nominal">
                    {stats.totalTransactions} Transaksi ({stats.totalQty.toLocaleString('id-ID')} Qty)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Pengeluaran PO (H.Beli)</span>
                  <span className="font-extrabold text-rose-700 font-nominal">
                    {formatRupiah(stats.totalPengeluaran)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Pendapatan (H.Jual)</span>
                  <span className="font-extrabold text-slate-900 font-nominal">
                    {formatRupiah(stats.totalPendapatan)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Profit Bersih</span>
                  <span className="font-extrabold text-emerald-800 font-nominal">
                    {formatRupiah(stats.profitBersih)}
                  </span>
                </div>
              </div>
            </div>

            {/* Endpoint Connection Card */}
            <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                  <span className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                    Endpoint Google Sheets
                  </span>
                </div>

                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Settings className="w-3 h-3" />
                    <span>Ubah di Pengaturan</span>
                  </button>
                )}
              </div>

              {endpointUrl ? (
                <div className="p-2.5 bg-white rounded-xl border border-indigo-200 text-xs font-mono text-slate-700 truncate">
                  {endpointUrl}
                </div>
              ) : (
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium flex items-center justify-between gap-2">
                  <span>Endpoint belum diatur. Masukkan link di Pengaturan.</span>
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenSettings();
                      }}
                      className="px-2 py-1 bg-amber-600 text-white rounded-lg text-[10px] font-bold shrink-0 cursor-pointer"
                    >
                      Buka Pengaturan
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Status Feedback Message */}
            {syncStatus.type !== 'idle' && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                  syncStatus.type === 'success'
                    ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                    : 'bg-rose-50 text-rose-950 border-rose-300'
                }`}
              >
                {syncStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{syncStatus.message}</span>
              </div>
            )}

            {/* Actions: 1. Update Sheets, 2. Download CSV, 3. Download Docs */}
            <div className="space-y-2 pt-1">
              {/* Button 1: Update ke Google Sheets */}
              <button
                type="button"
                onClick={handleSyncToSheets}
                disabled={isSyncing}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-2xl text-xs font-black shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 min-h-[46px]"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncing
                    ? 'Mengupdate Rekapan ke Google Sheet...'
                    : 'Update Rekapan Bulanan ke Google Sheet'}
                </span>
              </button>

              {/* Sub-actions Grid: CSV & Docs */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="py-2.5 px-3 bg-white hover:bg-slate-50 active:scale-95 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs min-h-[42px]"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Unduh File .CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadDoc}
                  className="py-2.5 px-3 bg-white hover:bg-slate-50 active:scale-95 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs min-h-[42px]"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Unduh Ringkasan .DOC/TXT</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
