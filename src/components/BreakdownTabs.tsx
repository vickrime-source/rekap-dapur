import React from 'react';
import { Store, Truck, UtensilsCrossed } from 'lucide-react';

export type BreakdownTabType = 'toko' | 'pemasok' | 'dapur';

export interface BreakdownTabsProps {
  activeTab: BreakdownTabType;
  onChangeTab: (tab: BreakdownTabType) => void;
  counts?: {
    toko?: number;
    pemasok?: number;
    dapur?: number;
  };
  className?: string;
}

export const BreakdownTabs: React.FC<BreakdownTabsProps> = ({
  activeTab,
  onChangeTab,
  counts,
  className = '',
}) => {
  const tabList: Array<{
    id: BreakdownTabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'toko', label: 'Breakdown Toko', icon: Store, count: counts?.toko },
    { id: 'pemasok', label: 'Breakdown Pemasok', icon: Truck, count: counts?.pemasok },
    { id: 'dapur', label: 'Breakdown Dapur', icon: UtensilsCrossed, count: counts?.dapur },
  ];

  return (
    <div className={`border-b border-slate-200 ${className}`}>
      {/* Responsive mobile horizontal scroll with subtle smooth scrolling */}
      <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth">
        {tabList.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`group flex items-center gap-2 pb-2.5 pt-1 px-1.5 sm:px-2.5 text-xs whitespace-nowrap transition-all border-b-2 cursor-pointer select-none ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 font-medium'
              }`}
              aria-selected={isActive}
            >
              <Icon
                className={`w-4 h-4 transition-colors ${
                  isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[10.5px] px-1.5 py-0.5 rounded-full font-bold transition-colors ${
                    isActive
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200/80 group-hover:text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
