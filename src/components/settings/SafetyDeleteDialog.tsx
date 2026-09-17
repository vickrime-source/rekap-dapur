import React from 'react';
import { AlertTriangle, Trash2, CheckCircle2, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { SafetyDialogState } from './types';

interface SafetyDeleteDialogProps {
  dialog: SafetyDialogState | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirmDelete: () => void;
}

export const SafetyDeleteDialog: React.FC<SafetyDeleteDialogProps> = ({
  dialog,
  isDeleting,
  onClose,
  onConfirmDelete,
}) => {
  if (!dialog) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs font-sans">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
      >
        {dialog.type === 'blocked' ? (
          <>
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                Tidak Dapat Menghapus {dialog.category}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <span className="font-bold text-slate-900 dark:text-slate-100">"{dialog.nama}"</span> masih tercatat digunakan pada{' '}
                <span className="font-extrabold text-amber-700 dark:text-amber-400">{dialog.orderCount || 0} pesanan</span> dan{' '}
                <span className="font-extrabold text-amber-700 dark:text-amber-400">{dialog.transaksiCount || 0} riwayat transaksi</span>.
              </p>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200/80 dark:border-amber-900/60 text-[11px] text-amber-800 dark:text-amber-300 text-left font-medium">
                Data ini dilarang dihapus agar riwayat transaksi dan faktur yang sudah berjalan tidak menjadi data rusak (orphan).
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-black transition-all cursor-pointer"
            >
              Mengerti &amp; Tutup
            </button>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                Hapus {dialog.category}?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Yakin ingin menghapus {dialog.category.toLowerCase()}{' '}
                <span className="font-bold text-slate-900 dark:text-slate-100">"{dialog.nama}"</span>?
              </p>
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/70 dark:border-emerald-900/60 text-[11px] text-emerald-800 dark:text-emerald-300 text-left font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Data aman dihapus karena belum pernah dipakai di pesanan mana pun.</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={onConfirmDelete}
                disabled={isDeleting}
                className="py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};
