import React, { useState } from 'react';
import { MessageSquareText, Mic, PenLine, Plus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface FloatingAddMenuProps {
  onVoice: () => void;
  onManual: () => void;
  onAssistant: () => void;
}

export const FloatingAddMenu: React.FC<FloatingAddMenuProps> = ({
  onVoice,
  onManual,
  onAssistant,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const runAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="fixed right-4 bottom-24 sm:right-6 sm:bottom-24 z-40 no-print flex flex-col items-end gap-2.5">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className="flex flex-col items-end gap-2.5"
          >
            <button
              type="button"
              onClick={() => runAction(onVoice)}
              className="inline-flex items-center gap-2.5 rounded-2xl bg-slate-950 px-3.5 py-2.5 text-xs font-extrabold text-white shadow-xl ring-1 ring-white/10 hover:bg-slate-800 active:scale-95 transition-all"
            >
              <span>Voice</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300">
                <Mic className="h-4 w-4" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => runAction(onManual)}
              className="inline-flex items-center gap-2.5 rounded-2xl bg-slate-950 px-3.5 py-2.5 text-xs font-extrabold text-white shadow-xl ring-1 ring-white/10 hover:bg-slate-800 active:scale-95 transition-all"
            >
              <span>Input Manual</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
                <PenLine className="h-4 w-4" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => runAction(onAssistant)}
              className="inline-flex items-center gap-2.5 rounded-2xl bg-slate-950 px-3.5 py-2.5 text-xs font-extrabold text-white shadow-xl ring-1 ring-white/10 hover:bg-slate-800 active:scale-95 transition-all"
            >
              <span>Smart Assistant</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
                <MessageSquareText className="h-4 w-4" />
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsOpen((value) => !value)}
        aria-label={isOpen ? 'Tutup menu input' : 'Buka menu input'}
        aria-expanded={isOpen}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 ring-4 ring-white/70 dark:ring-slate-950 focus:outline-none"
      >
        {isOpen ? <X className="h-7 w-7 stroke-[2.5]" /> : <Plus className="h-7 w-7 stroke-[2.8]" />}
      </motion.button>
    </div>
  );
};
