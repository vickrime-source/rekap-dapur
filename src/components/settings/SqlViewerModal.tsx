import React, { useState } from 'react';
import { Database, Copy, CheckCircle2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { MASTER_TABLES_SQL, MIGRATION_UUID_TO_BIGINT_SQL } from '../../lib/masterSqlScript';

interface SqlViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  copiedSql?: boolean;
  onCopySql?: () => void;
}

export const SqlViewerModal: React.FC<SqlViewerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'migration' | 'schema'>('migration');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentSql = activeTab === 'migration' ? MIGRATION_UUID_TO_BIGINT_SQL : MASTER_TABLES_SQL;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/70 font-sans">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-slate-900 text-slate-100 rounded-3xl p-4 sm:p-6 max-w-2xl w-full shadow-2xl border border-slate-700 flex flex-col max-h-[85vh] space-y-3"
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">
                Skrip SQL Master: Dapur, Toko &amp; Pemasok
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                Format BigInt Identity (Efisien, Ringan, 100% Relasi Terjaga)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin SQL</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('migration')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'migration'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Migrasi UUID ke BigInt (Existing Data)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('schema')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'schema'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Skema Tabel Baru (DDL Master)
          </button>
        </div>

        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 overflow-y-auto font-mono text-[11px] leading-relaxed text-emerald-400 select-all flex-1 max-h-[55vh]">
          <pre className="whitespace-pre-wrap">{currentSql}</pre>
        </div>

        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
          <span>
            Jalankan skrip ini di <strong className="text-white">Supabase Dashboard &rarr; SQL Editor</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </motion.div>
    </div>
  );
};
