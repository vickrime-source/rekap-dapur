import React, { useState, useEffect } from 'react';
import { 
  X, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  Settings,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { checkGoogleSheetsConnection } from '../lib/googleSheets';

interface SyncBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  isSyncing: boolean;
  onTriggerSync: () => void;
  syncError: string | null;
  ordersCount: number;
  invoicesCount: number;
  notesCount?: number;
  onOpenSettings: () => void;
  lastSyncedTime?: string;
}

export const SyncBottomSheet: React.FC<SyncBottomSheetProps> = ({
  isOpen,
  onClose,
  isSyncing,
  onTriggerSync,
  syncError,
  ordersCount,
  invoicesCount,
  notesCount = 0,
  onOpenSettings,
  lastSyncedTime,
}) => {
  const [connectionInfo, setConnectionInfo] = useState<{
    configured: boolean;
    title?: string;
    clientEmail?: string | null;
    spreadsheetId?: string | null;
  }>({ configured: true });

  useEffect(() => {
    if (isOpen) {
      checkGoogleSheetsConnection().then((info) => {
        setConnectionInfo({
          configured: info.configured,
          title: info.title,
          clientEmail: info.clientEmail,
          spreadsheetId: info.spreadsheetId,
        });
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfigured = connectionInfo.configured && !syncError;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center no-print font-sans">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        />

        {/* Bottom Sheet Modal */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh] z-10 border-t border-slate-200/80 overflow-hidden"
        >
          {/* Mobile Drag Handle */}
          <div className="pt-3 pb-1 flex justify-center">
            <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 leading-none">
                  Google Sheets API Resmi
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Backend Service Account (JWT Auth) Realtime Sync
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 overflow-y-auto">
            {/* Status Card */}
            <div
              className={`p-4 rounded-2xl border-2 flex items-start gap-3.5 ${
                syncError
                  ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                  : isConfigured
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/80 border-amber-200 text-amber-950'
              }`}
            >
              <div className="mt-0.5">
                {syncError ? (
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                ) : isConfigured ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs uppercase tracking-wider">
                    {syncError
                      ? 'Kendala Koneksi Sheets'
                      : isConfigured
                      ? 'Google Sheets API Terhubung'
                      : 'Kredensial Belum Terpasang'}
                  </span>
                  {lastSyncedTime && !syncError && (
                    <span className="text-[10px] text-slate-500 font-bold">
                      {lastSyncedTime}
                    </span>
                  )}
                </div>

                <p className="text-xs leading-relaxed opacity-90">
                  {syncError
                    ? syncError
                    : isConfigured
                    ? `Terhubung ke spreadsheet: ${connectionInfo.title || 'Aktif'} via Google Sheets Service Account resmi.`
                    : 'Atur GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, dan GOOGLE_SHEETS_SPREADSHEET_ID di environment variables.'}
                </p>
              </div>
            </div>

            {/* Sync Stats Summary - 3 Cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <span className="text-[9px] font-bold text-slate-500 uppercase block truncate">
                  Sheet Pesanan
                </span>
                <span className="text-base font-black text-slate-900 mt-1 block">
                  {ordersCount} <span className="text-[10px] font-bold text-slate-500">Item</span>
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <span className="text-[9px] font-bold text-slate-500 uppercase block truncate">
                  Sheet Notes
                </span>
                <span className="text-base font-black text-slate-900 mt-1 block">
                  {notesCount} <span className="text-[10px] font-bold text-slate-500">Note</span>
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <span className="text-[9px] font-bold text-slate-500 uppercase block truncate">
                  Sheet Transaksi
                </span>
                <span className="text-base font-black text-slate-900 mt-1 block">
                  {invoicesCount} <span className="text-[10px] font-bold text-slate-500">Inv</span>
                </span>
              </div>
            </div>

            {/* Sync Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={onTriggerSync}
                disabled={isSyncing}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sedang Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Status Koneksi Google Sheets</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
