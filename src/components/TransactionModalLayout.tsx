import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface TransactionModalLayoutProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  headerRight?: React.ReactNode;
  headerBottom?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string; // e.g. "max-w-2xl" or "max-w-3xl"
}

export const TransactionModalLayout: React.FC<TransactionModalLayoutProps> = ({
  isOpen,
  onClose,
  title,
  subtitle = 'Lengkapi harga beli & jual untuk menghitung estimasi margin',
  icon,
  headerRight,
  headerBottom,
  children,
  footer,
  maxWidth = 'max-w-2xl',
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="transaction-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs no-print overflow-y-auto"
      >
        {/* Backdrop click to dismiss */}
        <div className="fixed inset-0" onClick={onClose} />

        <motion.div
          id="transaction-modal-dialog"
          initial={{ opacity: 0, scale: 0.96, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 14 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className={`relative w-[calc(100vw-24px)] ${maxWidth} my-auto max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.14)] border border-slate-200 dark:border-slate-800 overflow-hidden z-10 flex flex-col font-sans`}
        >
          {/* Mobile Drag Handle Indicator (─────) */}
          <div className="w-full pt-2.5 pb-1 flex justify-center items-center bg-slate-900 sm:hidden">
            <div className="w-12 h-1 bg-slate-600 rounded-full" />
          </div>

          {/* Header Navy Gelap */}
          <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shrink-0 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center justify-between sm:justify-start gap-2.5">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  {icon && (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center shrink-0">
                      {icon}
                    </div>
                  )}
                  <div>
                    <h2 className="text-sm sm:text-base font-black tracking-tight text-white uppercase">
                      {title}
                    </h2>
                    {subtitle && (
                      <p className="text-[11px] text-slate-300 font-medium">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Close button on mobile right */}
                <button
                  type="button"
                  onClick={onClose}
                  id="btn-close-transaction-modal-mobile"
                  className="sm:hidden w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Tutup (Esc)"
                  aria-label="Tutup Modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {headerRight}
                <button
                  type="button"
                  onClick={onClose}
                  id="btn-close-transaction-modal"
                  className="hidden sm:flex w-8 h-8 rounded-full items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Tutup (Esc)"
                  aria-label="Tutup Modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {headerBottom && (
              <div className="pt-0.5">
                {headerBottom}
              </div>
            )}
          </div>

          {/* Scrollable Body Content */}
          <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4 sm:space-y-5 text-slate-800 dark:text-slate-100">
            {children}
          </div>

          {/* Footer Action Bar */}
          {footer && (
            <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 sticky bottom-0 z-20 shrink-0">
              {footer}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
