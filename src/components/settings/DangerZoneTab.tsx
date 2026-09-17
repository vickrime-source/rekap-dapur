import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface DangerZoneTabProps {
  onDeleteAllDataConfirm: () => void;
}

export const DangerZoneTab: React.FC<DangerZoneTabProps> = ({
  onDeleteAllDataConfirm,
}) => {
  return (
    <div className="bg-rose-50/80 dark:bg-rose-950/40 p-5 rounded-2xl border border-rose-200 dark:border-rose-900/80 space-y-3 font-sans">
      <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-black text-xs uppercase tracking-wider">
        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
        <span>Danger Zone: Hapus Semua Data Pesanan Lokal</span>
      </div>
      <p className="text-xs text-rose-700 dark:text-rose-300/90 leading-relaxed font-medium">
        Fitur ini akan membersihkan data pesanan yang tersimpan di perangkat ini. Gunakan hanya jika Anda ingin mereset aplikasi.
      </p>
      <button
        type="button"
        onClick={onDeleteAllDataConfirm}
        className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs rounded-2xl transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer"
      >
        <Trash2 className="w-4 h-4" />
        <span>HAPUS SELURUH DATA PESANAN LOKAL</span>
      </button>
    </div>
  );
};
