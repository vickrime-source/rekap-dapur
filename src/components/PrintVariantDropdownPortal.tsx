import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Coins, Check } from 'lucide-react';
import { InvoicePriceVariant } from '../types';

export interface PrintVariantDropdownPortalProps {
  isOpen: boolean;
  targetRect: DOMRect | null;
  onClose: () => void;
  onSelectVariant: (variant: InvoicePriceVariant) => void;
  hasCashbackItem?: boolean;
}

export const PrintVariantDropdownPortal: React.FC<PrintVariantDropdownPortalProps> = ({
  isOpen,
  targetRect,
  onClose,
  onSelectVariant,
  hasCashbackItem = false,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  const menuWidth = 210;
  const menuHeight = 135;
  const spaceBelow = window.innerHeight - targetRect.bottom;
  const openUpwards = spaceBelow < menuHeight && targetRect.top > menuHeight;

  // Horizontal position: align to right edge of button or left edge if too close to screen right
  const rightPos = Math.max(12, Math.min(window.innerWidth - targetRect.right, window.innerWidth - menuWidth - 12));
  const topPos = openUpwards ? undefined : targetRect.bottom + 6;
  const bottomPos = openUpwards ? window.innerHeight - targetRect.top + 6 : undefined;

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
            right: `${rightPos}px`,
            top: topPos !== undefined ? `${topPos}px` : undefined,
            bottom: bottomPos !== undefined ? `${bottomPos}px` : undefined,
            width: `${menuWidth}px`,
          }}
          className="pointer-events-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-1.5 overflow-hidden text-slate-800 dark:text-slate-100 ring-1 ring-black/5"
        >
          <div className="px-2.5 py-1 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/80 mb-1 flex items-center justify-between">
            <span>Pilih Varian Invoice</span>
          </div>

          <div className="space-y-0.5">
            {/* OPSI 1: Cetak Ori */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                onSelectVariant('ori');
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50/80 dark:hover:bg-amber-950/40 transition-colors cursor-pointer group"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-100/70 dark:bg-amber-950/60 group-hover:bg-amber-200/80 dark:group-hover:bg-amber-900/60 flex items-center justify-center transition-colors flex-shrink-0 text-amber-700 dark:text-amber-400">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs text-slate-900 dark:text-slate-100 leading-tight">
                  Cetak Ori
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate mt-0.5">
                  Harga jual normal
                </div>
              </div>
            </button>

            {/* OPSI 2: Cetak Cashback */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                onSelectVariant('cashback');
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer group"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-100/70 dark:bg-emerald-950/60 group-hover:bg-emerald-200/80 dark:group-hover:bg-emerald-900/60 flex items-center justify-center transition-colors flex-shrink-0 text-emerald-700 dark:text-emerald-400">
                <Coins className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs text-slate-900 dark:text-slate-100 leading-tight flex items-center gap-1.5">
                  <span>Cetak Cashback</span>
                  {hasCashbackItem && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Terdapat item dengan nilai cashback" />
                  )}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate mt-0.5">
                  {hasCashbackItem ? 'Sesuai nilai cashback item' : 'Fallback harga jual (belum diset)'}
                </div>
              </div>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
