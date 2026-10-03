import React from 'react';
import { 
  Store as StoreIcon, 
  Truck, 
  Utensils, 
} from 'lucide-react';
import { Kitchen, Store as StoreType } from '../../types';
import { KelolaSubTab, SafetyDialogState } from './types';
import { TokoSubSection } from './kelola/TokoSubSection';
import { PemasokSubSection } from './kelola/PemasokSubSection';
import { DapurSubSection } from './kelola/DapurSubSection';

interface KelolaDataTabProps {
  subTab: KelolaSubTab;
  onSubTabChange: (subTab: KelolaSubTab) => void;
  stores: StoreType[];
  onUpdateStores: (stores: StoreType[]) => void;
  pemasokList: string[];
  onUpdatePemasok: (pemasok: string[]) => void;
  kitchens: Kitchen[];
  onUpdateKitchens: (kitchens: Kitchen[]) => void;
  onRefreshData?: () => void | Promise<void>;
  onOpenSafetyDialog: (dialog: SafetyDialogState) => void;
}

export const KelolaDataTab: React.FC<KelolaDataTabProps> = ({
  subTab,
  onSubTabChange,
  stores,
  onUpdateStores,
  pemasokList,
  onUpdatePemasok,
  kitchens,
  onUpdateKitchens,
  onRefreshData,
  onOpenSafetyDialog,
}) => {
  return (
    <div className="space-y-4 font-sans">
      {/* Sub-Tabs Switcher: Toko | Pemasok | Dapur */}
      <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => onSubTabChange('toko')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            subTab === 'toko'
              ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/50'
          }`}
        >
          <StoreIcon className="w-3.5 h-3.5" />
          <span>Toko</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            subTab === 'toko'
              ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}>
            {stores.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSubTabChange('pemasok')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            subTab === 'pemasok'
              ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/50'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Pemasok</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            subTab === 'pemasok'
              ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}>
            {pemasokList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSubTabChange('dapur')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            subTab === 'dapur'
              ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/50'
          }`}
        >
          <Utensils className="w-3.5 h-3.5" />
          <span>Dapur</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            subTab === 'dapur'
              ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}>
            {kitchens.length}
          </span>
        </button>
      </div>

      {/* --- SUB-VIEW 1: TOKO --- */}
      {subTab === 'toko' && (
        <TokoSubSection
          stores={stores}
          onUpdateStores={onUpdateStores}
          onRefreshData={onRefreshData}
          onOpenSafetyDialog={onOpenSafetyDialog}
        />
      )}

      {/* --- SUB-VIEW 2: PEMASOK --- */}
      {subTab === 'pemasok' && (
        <PemasokSubSection
          pemasokList={pemasokList}
          onUpdatePemasok={onUpdatePemasok}
          onRefreshData={onRefreshData}
          onOpenSafetyDialog={onOpenSafetyDialog}
        />
      )}

      {/* --- SUB-VIEW 3: DAPUR --- */}
      {subTab === 'dapur' && (
        <DapurSubSection
          kitchens={kitchens}
          onUpdateKitchens={onUpdateKitchens}
          onRefreshData={onRefreshData}
          onOpenSafetyDialog={onOpenSafetyDialog}
        />
      )}
    </div>
  );
};
