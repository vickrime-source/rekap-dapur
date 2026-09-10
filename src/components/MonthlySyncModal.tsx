import React from 'react';
import { 
  X, 
  Download, 
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OrderItem, PeriodSummaryStats } from '../types';
import { formatRupiah } from '../lib/formatters';
import { 
  buildMonthlyRecapPayload, 
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
}) => {
  if (!isOpen) return null;

  const monthLabel = getCurrentMonthLabel(selectedDate);
  const payload = buildMonthlyRecapPayload(orders, stats, selectedDate);

  const handleDownloadCsv = () => {
    downloadMonthlyRecapCsv(payload);
  };

  const handleDownloadDoc = () => {
    downloadMonthlyRecapSummaryDoc(payload);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                  Ekspor Rekapan Bulanan
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  Unduh rekapan periode {monthLabel}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
            {/* Financial Summary Card */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-600">Periode:</span>
                <span className="font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                  {monthLabel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Pesanan</span>
                  <span className="text-sm font-black text-slate-900 font-nominal">
                    {stats.totalPesanan} item
                  </span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Kuantitas</span>
                  <span className="text-sm font-black text-slate-900 font-nominal">
                    {stats.totalQty}
                  </span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Pendapatan Jual</span>
                  <span className="text-sm font-black text-slate-900 font-nominal">
                    {formatRupiah(stats.omsetJual)}
                  </span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Profit Bersih</span>
                  <span className="text-sm font-black text-emerald-700 font-nominal">
                    {formatRupiah(stats.profitBersih)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions: Download CSV & Download Docs */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-2xl text-xs font-black shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[46px]"
              >
                <Download className="w-4 h-4 text-white" />
                <span>Unduh Rekapan Format .CSV (Excel)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadDoc}
                className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-300 rounded-2xl text-xs font-black text-slate-800 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs min-h-[46px]"
              >
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Unduh Ringkasan Dokumen .DOC / TXT</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
