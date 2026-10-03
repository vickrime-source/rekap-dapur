import React from 'react';
import { LayoutDashboard, TableProperties, Plus } from 'lucide-react';

export type TabType = 'dashboard' | 'rekap' | 'transaksi';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onOpenManual: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab, onOpenManual }) => (
  <div className="fixed bottom-3 sm:bottom-4 md:bottom-5 left-0 right-0 z-30 px-3 sm:px-4 max-w-[620px] mx-auto no-print pointer-events-none">
    <nav aria-label="Navigasi utama" className="clay-card relative h-[72px] rounded-[28px] flex items-center justify-between px-9 sm:px-14 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-lg pointer-events-auto transition-colors duration-200">
      <button
        type="button"
        onClick={() => onChangeTab('dashboard')}
        aria-current={activeTab === 'dashboard' ? 'page' : undefined}
        className={`flex min-w-20 flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${activeTab === 'dashboard' ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-300 font-semibold'}`}
      >
        <span className={`p-1.5 rounded-xl transition-all ${activeTab === 'dashboard' ? 'clay-pill-active text-[#4f46e5] dark:text-white' : ''}`}>
          <LayoutDashboard className="w-5 h-5" />
        </span>
        <span className="text-[10px] uppercase tracking-wider">Dashboard</span>
      </button>

      <button
        type="button"
        onClick={onOpenManual}
        aria-label="Input pesanan manual"
        title="Input pesanan manual"
        className="absolute left-1/2 -top-5 -translate-x-1/2 flex h-16 w-16 items-center justify-center rounded-[20px] bg-indigo-600 text-white shadow-[0_8px_25px_rgba(79,70,229,0.45)] ring-4 ring-white dark:ring-slate-900 transition-transform hover:scale-105 active:scale-95"
      >
        <Plus className="h-9 w-9 stroke-[2.7]" />
      </button>

      <button
        type="button"
        onClick={() => onChangeTab('transaksi')}
        aria-current={activeTab === 'transaksi' ? 'page' : undefined}
        className={`flex min-w-20 flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${activeTab === 'transaksi' ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-300 font-semibold'}`}
      >
        <span className={`p-1.5 rounded-xl transition-all ${activeTab === 'transaksi' ? 'clay-pill-active text-[#4f46e5] dark:text-white' : ''}`}>
          <TableProperties className="w-5 h-5" />
        </span>
        <span className="text-[10px] uppercase tracking-wider">Transaksi</span>
      </button>
    </nav>
  </div>
);
