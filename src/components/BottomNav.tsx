import React, { useRef } from 'react';
import { LayoutDashboard, BarChart3, Plus, TableProperties } from 'lucide-react';
import { motion } from 'motion/react';

export type TabType = 'dashboard' | 'rekap' | 'transaksi';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onOpenAddModal: () => void;
  onStartVoiceHold?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  onOpenAddModal,
  onStartVoiceHold,
}) => {
  const holdTimerRef = useRef<any>(null);
  const didTriggerHoldRef = useRef<boolean>(false);

  const startHold = () => {
    didTriggerHoldRef.current = false;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    holdTimerRef.current = setTimeout(() => {
      didTriggerHoldRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch {}
      }
      onStartVoiceHold?.();
    }, 320); // 320ms hold threshold
  };

  const endHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (didTriggerHoldRef.current) {
      e.preventDefault();
      e.stopPropagation();
      didTriggerHoldRef.current = false;
      return;
    }
    onOpenAddModal();
  };

  return (
    <div className="fixed bottom-3 sm:bottom-4 md:bottom-5 left-0 right-0 z-30 px-3 sm:px-4 max-w-lg md:max-w-xl mx-auto no-print pointer-events-none">
      <nav className="clay-card bg-white dark:bg-slate-900 h-[72px] rounded-3xl flex items-center justify-between px-4 sm:px-6 md:px-8 border border-slate-200/80 dark:border-slate-800 shadow-lg pointer-events-auto transition-colors duration-200">
        {/* 1. Dashboard */}
        <button
          onClick={() => onChangeTab('dashboard')}
          className={`flex flex-col items-center justify-center space-y-0.5 transition-all cursor-pointer ${
            activeTab === 'dashboard' 
              ? 'text-indigo-600 dark:text-indigo-400 scale-105 font-extrabold' 
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-semibold'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'dashboard' ? 'clay-pill-active text-[#4f46e5] dark:text-white' : ''}`}>
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <span className="text-[10px] uppercase tracking-wider">Dashboard</span>
        </button>

        {/* 2. Rekap (BARU) */}
        <button
          onClick={() => onChangeTab('rekap')}
          className={`flex flex-col items-center justify-center space-y-0.5 transition-all cursor-pointer ${
            activeTab === 'rekap' 
              ? 'text-indigo-600 dark:text-indigo-400 scale-105 font-extrabold' 
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-semibold'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'rekap' ? 'clay-pill-active text-[#4f46e5] dark:text-white' : ''}`}>
            <BarChart3 className="w-5 h-5" />
          </div>
          <span className="text-[10px] uppercase tracking-wider">Rekap</span>
        </button>

        {/* TENGAH — Clay FAB Tambah Pesanan (Tap: Modal Pesanan, Hold/Tahan: Voice Assistant) */}
        <div className="relative -top-5">
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onMouseDown={startHold}
            onMouseUp={endHold}
            onMouseLeave={endHold}
            onTouchStart={startHold}
            onTouchEnd={endHold}
            onTouchCancel={endHold}
            onClick={handleClick}
            className="w-[58px] h-[58px] sm:w-[62px] sm:h-[62px] clay-btn-primary rounded-full flex items-center justify-center text-white border-4 border-[#edf2f9] dark:border-slate-900 shadow-lg shadow-indigo-600/30 focus:outline-none cursor-pointer select-none transition-colors"
            title="Klik: Tambah Pesanan | Tahan (Hold): Voice Assistant Suara Pintar"
          >
            <Plus className="w-7 h-7 sm:w-8 sm:h-8 stroke-[3]" />
          </motion.button>
        </div>

        {/* 3. Transaksi */}
        <button
          onClick={() => onChangeTab('transaksi')}
          className={`flex flex-col items-center justify-center space-y-0.5 transition-all cursor-pointer ${
            activeTab === 'transaksi' 
              ? 'text-indigo-600 dark:text-indigo-400 scale-105 font-extrabold' 
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-semibold'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'transaksi' ? 'clay-pill-active text-[#4f46e5] dark:text-white' : ''}`}>
            <TableProperties className="w-5 h-5" />
          </div>
          <span className="text-[10px] uppercase tracking-wider">Transaksi</span>
        </button>
      </nav>
    </div>
  );
};
