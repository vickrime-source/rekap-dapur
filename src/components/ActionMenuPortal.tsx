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
  onEdit: (item: OrderItem) => void;
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
          className="pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-900/15 dark:shadow-black/50 border border-slate-200/90 dark:border-slate-800 p-1.5 select-none overflow-hidden max-w-[calc(100vw-24px)] text-slate-800 dark:text-slate-200"
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
          ) : singleItem ? (
            /* Single Item: Clean, minimal Action Card */
            <div className="space-y-1">
              <div className="px-2.5 py-1">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={singleItem.namaBarang}>
                  {singleItem.namaBarang}
                </div>
                <div className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{singleItem.qty} {singleItem.satuan || 'Pcs'}</span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="font-medium text-slate-600 dark:text-slate-400">{formatRupiah(singleItem.hargaBeli)}</span>
                </div>
                {singleItem.catatan && singleItem.catatan.trim() && (
                  <div className="mt-1.5 text-[10.5px] text-slate-600 dark:text-slate-300 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 rounded-lg px-2 py-1 leading-relaxed">
                    <span className="font-bold text-amber-800 dark:text-amber-300">Catatan: </span>
                    <span className="break-words">{singleItem.catatan.trim()}</span>
                  </div>
                )}
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800 mx-1" />

              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(singleItem);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/50 rounded-xl transition-all cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-100/70 dark:group-hover:bg-indigo-900/60 flex items-center justify-center transition-colors flex-shrink-0">
                    <Edit2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                  </div>
                  <span>Edit Transaksi</span>
                </button>

                {onDuplicate && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onDuplicate(singleItem);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/50 rounded-xl transition-all cursor-pointer group"
                  >
                    <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-100/70 dark:group-hover:bg-emerald-900/60 flex items-center justify-center transition-colors flex-shrink-0">
                      <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
                    </div>
                    <span>Duplikat Item</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onDeleteBatch) {
                      onDeleteBatch();
                    } else {
                      onDelete(singleItem.id);
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-all cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-lg bg-rose-50 dark:bg-rose-950/50 group-hover:bg-rose-100/80 dark:group-hover:bg-rose-900/60 flex items-center justify-center transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 group-hover:text-rose-600" />
                  </div>
                  <span>Hapus Transaksi</span>
                </button>
              </div>
            </div>
          ) : (
            /* Multiple Items: Clean Scrollable List with Minimal Action Pills */
            <div className="space-y-1">
              {onDeleteBatch && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDeleteBatch();
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 mb-1 text-left text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-all cursor-pointer group border border-rose-100 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/30"
                >
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 group-hover:text-rose-600" />
                    <span>Hapus Seluruh Transaksi ({items.length} Item)</span>
                  </div>
                </button>
              )}

              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 pr-0.5">
                {items.map((it) => (
                  <div key={it.id} className="py-2 px-2 hover:bg-slate-50/90 dark:hover:bg-slate-800/80 rounded-xl transition-colors">
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={it.namaBarang}>
                        {it.namaBarang}
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 flex-shrink-0">
                        {it.qty}x
                      </span>
                    </div>
                    {it.catatan && it.catatan.trim() && (
                      <div className="mb-1.5 text-[10px] text-slate-600 dark:text-slate-300 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 rounded px-1.5 py-0.5 leading-relaxed">
                        <span className="font-bold text-amber-800 dark:text-amber-300">Catatan: </span>
                        <span className="break-words">{it.catatan.trim()}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onEdit(it);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer border border-slate-200/80 dark:border-slate-700"
                        title="Edit Item Ini"
                      >
                        <Edit2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        Edit
                      </button>
                      {onDuplicate && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onDuplicate(it);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer border border-slate-200/80 dark:border-slate-700"
                          title="Duplikat Item Ini"
                        >
                          <Copy className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          Duplikat
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onDelete(it.id);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer border border-rose-200/80 dark:border-rose-900/50"
                        title="Hapus Item Ini"
                      >
                        <Trash2 className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
