import React from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Store as StoreIcon, 
  Utensils, 
  Truck, 
  Edit3, 
  Trash2,
  TrendingUp,
  Tag
} from 'lucide-react';
import { OrderItem } from '../types';
import { formatRupiah, parseIndonesianNumber } from '../lib/formatters';
import { motion } from 'motion/react';

interface OrderItemCardProps {
  item: OrderItem;
  onToggleStatus: (id: string) => void;
  onEdit: (item: OrderItem) => void;
  onDelete: (id: string) => void;
}

export const OrderItemCard: React.FC<OrderItemCardProps> = React.memo(({
  item,
  onToggleStatus,
  onEdit,
  onDelete,
}) => {
  const isDone = item.status === 'selesai';
  const q = parseIndonesianNumber(item.qty);
  const hb = parseIndonesianNumber(item.hargaBeli);
  const hj = parseIndonesianNumber(item.hargaJual);
  const totalBeli = q * hb;
  const totalJual = q * hj;
  const profit = totalJual - totalBeli;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`relative rounded-2xl p-4 transition-all border shadow-sm ${
        isDone
          ? 'bg-white dark:bg-slate-900 border-emerald-200/70 dark:border-emerald-900/60 shadow-emerald-50/50 dark:shadow-none'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-slate-100/70 dark:shadow-none'
      }`}
    >
      {/* Top Header: Title & Direct Quick Toggle Switch */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className={`text-base font-bold tracking-tight ${isDone ? 'text-slate-500 dark:text-slate-400 line-through decoration-slate-300 dark:decoration-slate-600' : 'text-slate-900 dark:text-slate-100'}`}>
              {item.namaBarang}
            </h3>
            
            {/* Status Badge */}
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                isDone
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
              }`}
            >
              {isDone ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Selesai
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  Pending
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium flex-wrap">
            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300 font-semibold border border-slate-200/80 dark:border-slate-700">
              {item.qty} Qty
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
              <StoreIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              {item.toko}
            </span>
          </div>
        </div>

        {/* High Density Direct Toggle Switch */}
        <div className="flex items-center flex-col gap-1">
          <button
            type="button"
            onClick={() => onToggleStatus(item.id)}
            className={`relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none ${
              isDone ? 'bg-emerald-600 border-emerald-600' : 'bg-white dark:bg-slate-800 border-indigo-600 dark:border-indigo-500'
            }`}
            title={isDone ? 'Ubah ke Pending' : 'Tandai Selesai'}
          >
            <span className="sr-only">Toggle Status</span>
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-md ring-0 transition duration-200 ease-in-out my-0.5 ${
                isDone ? 'translate-x-6 bg-white' : 'translate-x-1 bg-indigo-600 dark:bg-indigo-400'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Details Grid: Kitchen, Supplier, Prices & Profit */}
      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 mb-3 grid grid-cols-2 gap-2 text-xs border border-slate-100 dark:border-slate-700/80">
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <Utensils className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span className="font-medium truncate">{item.tujuanDapur}</span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <Truck className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
          <span className="font-medium truncate">{item.pemasok}</span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <Tag className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span>Beli: <strong className="text-slate-700 dark:text-slate-200">{formatRupiah(item.hargaBeli)}</strong></span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <Tag className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
          <span>Jual: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatRupiah(item.hargaJual)}</strong></span>
        </div>
      </div>

      {/* Footer: Profit & Actions */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 dark:text-slate-400">Profit:</span>
          <span className={`font-bold flex items-center gap-1 ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            <TrendingUp className="w-3 h-3" />
            {formatRupiah(profit)}
          </span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span className="text-slate-500 dark:text-slate-400">Total: <strong className="text-slate-800 dark:text-slate-100">{formatRupiah(totalJual)}</strong></span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(item)}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Edit Pesanan"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
            title="Hapus Pesanan"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
});
