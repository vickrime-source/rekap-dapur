import React from 'react';
import { LayoutDashboard, BarChart3, TableProperties } from 'lucide-react';

export type TabType = 'dashboard' | 'rekap' | 'transaksi';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
}) => {
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
