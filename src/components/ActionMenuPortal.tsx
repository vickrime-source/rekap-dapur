import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Edit2, 
  Copy, 
  Trash2, 
  Package, 
  X,
  ExternalLink
} from 'lucide-react';
import { OrderItem } from '../types';
import { formatRupiah } from '../lib/formatters';

export interface ActionMenuPortalProps {
  isOpen: boolean;
  targetRect: DOMRect | null;
  onClose: () => void;
  title?: string;
  batchNumber?: number;
  items: OrderItem[];
  onEdit: (item: OrderItem, batchItems?: OrderItem[]) => void;
  onEditBatch?: (items: OrderItem[]) => void;
  onDuplicate?: (item: OrderItem) => void;
  onDelete: (itemId: string) => void;
  onDeleteBatch?: () => void;
}

export const ActionMenuPortal: React.FC<ActionMenuPortalProps> = ({
  isOpen,
  targetRect,
  onClose,
  title = 'Transaksi',
  batchNumber,
  items,
  onEdit,
  onEditBatch,
  onDuplicate,
  onDelete,
  onDeleteBatch,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click, scroll, resize, or escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (typeof document === 'undefined' || !isOpen || !targetRect) {
    return null;
  }

  // Calculate viewport boundaries and positioning
  const menuWidth = 230;
  const estimatedHeight = items.length === 1 ? 190 : Math.min(320, 90 + items.length * 56);
  const spaceBelow = window.innerHeight - targetRect.bottom;
  const openUpwards = spaceBelow < estimatedHeight && targetRect.top > estimatedHeight;

  // Horizontal position: align to right edge with safety margin
  const rightPos = Math.max(12, Math.min(window.innerWidth - targetRect.right, window.innerWidth - menuWidth - 12));
  const topPos = openUpwards ? undefined : targetRect.bottom + 6;
  const bottomPos = openUpwards ? window.innerHeight - targetRect.top + 6 : undefined;

  const singleItem = items.length === 1 ? items[0] : null;

  return createPortal(
    <AnimatePresence>
      <div 
        className="fixed inset-0 pointer-events-none z-[99999]"
        aria-hidden="true"
      >
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95, y: openUpwards ? 4 : -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: openUpwards ? 4 : -4 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            top: topPos,
            bottom: bottomPos,
            right: rightPos,
            width: `${menuWidth}px`,
          }}
          className="pointer-events-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-900/15 dark:shadow-black/50 border border-slate-200/90 dark:border-slate-800 p-1.5 select-none overflow-hidden max-w-[calc(100vw-24px)] text-slate-800 dark:text-slate-200"
        >
          {/* Header */}
          <div className="px-2.5 py-1.5 mb-1 rounded-xl bg-slate-50/90 dark:bg-slate-800/90 border border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <Package className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                {singleItem ? title : `${title} (${items.length})`}
              </span>
            </div>
            {batchNumber !== undefined && (
              <span className="text-[9px] font-extrabold font-mono text-slate-400 dark:text-slate-400 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded-md border border-slate-200/70 dark:border-slate-700 flex-shrink-0">
                #{batchNumber}
              </span>
            )}
          </div>

          {/* When items is empty (e.g. raw invoice record from sheet transaksi) */}
          {items.length === 0 ? (
            <div className="space-y-1.5 p-1">
              <div className="px-2 py-1 text-[11px] text-slate-500 dark:text-slate-400">
                Data baris dari sheet Transaksi.
              </div>
              {onDeleteBatch && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDeleteBatch();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-950/50 group-hover:bg-rose-100/80 dark:group-hover:bg-rose-900/60 flex items-center justify-center transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 group-hover:text-rose-600" />
                  </div>
                  <span>Hapus Transaksi</span>
                </button>
              )}
            </div>
          ) : (
            /* Unified Action Menu: Langsung Edit Pesanan (Seluruh item bisa diedit sekaligus di modal) */
            <div className="space-y-1">
              {/* Tombol Utama: Edit Langsung Pesanan (Semua Item Sekaligus) */}
              <button
                type="button"
                id="btn-edit-pesanan-portal"
                onClick={() => {
                  onClose();
                  if (onEditBatch) {
                    onEditBatch(items);
                  } else {
                    onEdit(items[0], items);
                  }
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-98 rounded-xl transition-all cursor-pointer shadow-xs shadow-indigo-600/30 group"
              >
                <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Edit2 className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate leading-tight">
                    {items.length > 1 ? `Edit Pesanan (${items.length} Item)` : 'Edit Pesanan'}
                  </div>
                  <div className="text-[9.5px] font-normal text-indigo-100 truncate">
                    Buka & edit seluruh item
                  </div>
                </div>
              </button>

              {/* Duplikat Pesanan */}
              {onDuplicate && (
                <button
                  type="button"
                  id="btn-duplikat-pesanan-portal"
                  onClick={() => {
                    onClose();
                    onDuplicate(items[0]);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/50 rounded-xl transition-all cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-100/70 dark:group-hover:bg-emerald-900/60 flex items-center justify-center transition-colors flex-shrink-0">
                    <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
                  </div>
                  <span className="truncate">
                    {items.length > 1 ? `Duplikat Pesanan (${items.length} Item)` : 'Duplikat Pesanan'}
                  </span>
                </button>
              )}

              {/* Hapus Pesanan */}
              <button
                type="button"
                id="btn-hapus-pesanan-portal"
                onClick={() => {
                  onClose();
                  if (onDeleteBatch) {
                    onDeleteBatch();
                  } else {
                    onDelete(items[0].id);
                  }
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-all cursor-pointer group"
              >
                <div className="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-950/50 group-hover:bg-rose-100/80 dark:group-hover:bg-rose-900/60 flex items-center justify-center transition-colors flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 group-hover:text-rose-600" />
                </div>
                <span className="truncate">
                  {items.length > 1 ? `Hapus Seluruh Pesanan (${items.length} Item)` : 'Hapus Pesanan'}
                </span>
              </button>

              {/* Ringkasan Item Pesanan (Read-only clean preview tanpa tombol edit satuan) */}
              {items.length > 1 ? (
                <div className="mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                  <div className="px-2 py-0.5 text-[9.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Item di Pesanan Ini ({items.length})</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 pr-0.5 mt-0.5">
                    {items.map((it, idx) => (
                      <div key={it.id || idx} className="py-1 px-2 flex items-center justify-between gap-1 text-[11px]">
                        <div className="truncate font-semibold text-slate-800 dark:text-slate-200" title={it.namaBarang}>
                          <span className="text-slate-400 mr-1 font-mono text-[10px]">#{idx + 1}</span>
                          {it.namaBarang}
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 shrink-0">
                          {it.qty} {it.satuan || 'Kg'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : singleItem ? (
                <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800 px-2 py-1 bg-slate-50/70 dark:bg-slate-800/50 rounded-xl">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={singleItem.namaBarang}>
                    {singleItem.namaBarang}
                  </div>
                  <div className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{singleItem.qty} {singleItem.satuan || 'Pcs'}</span>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span className="font-medium text-slate-600 dark:text-slate-400">{formatRupiah(singleItem.hargaBeli)}</span>
                  </div>
                  {singleItem.catatan && singleItem.catatan.trim() && (
                    <div className="mt-1 text-[10px] text-slate-600 dark:text-slate-300 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 rounded px-1.5 py-0.5">
                      <span className="font-bold text-amber-800 dark:text-amber-300">Catatan: </span>
                      <span className="break-words">{singleItem.catatan.trim()}</span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
