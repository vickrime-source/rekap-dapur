import React from 'react';
import { Database, Copy, CheckCircle2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { MASTER_TABLES_SQL } from '../../lib/masterSqlScript';

interface SqlViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  copiedSql: boolean;
  onCopySql: () => void;
}

export const SqlViewerModal: React.FC<SqlViewerModalProps> = ({
  isOpen,
  onClose,
  copiedSql,
  onCopySql,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs font-sans">
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
                Supabase PostgreSQL DDL, Indexing, Seed Data &amp; RLS
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopySql}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {copiedSql ? (
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

        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 overflow-y-auto font-mono text-[11px] leading-relaxed text-emerald-400 select-all flex-1 max-h-[60vh]">
          <pre className="whitespace-pre-wrap">{MASTER_TABLES_SQL}</pre>
        </div>

        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
          <span>
            File tersimpan juga di <code className="text-indigo-300 font-mono">/master_tables_schema.sql</code>
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
