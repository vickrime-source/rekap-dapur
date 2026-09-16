import React from 'react';
import { 
  Store as StoreIcon, 
  Truck, 
  Utensils, 
  Database, 
  Copy, 
  CheckCircle2, 
  Code2 
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
  onCopySql: () => void;
  copiedSql: boolean;
  onShowSqlModal: () => void;
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
  onCopySql,
  copiedSql,
  onShowSqlModal,
}) => {
  return (
    <div className="space-y-4 font-sans">
      {/* Sub-Tabs Switcher: Toko | Pemasok | Dapur */}
      <div className="flex items-center p-1 bg-slate-100 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => onSubTabChange('toko')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            subTab === 'toko'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <StoreIcon className="w-3.5 h-3.5" />
          <span>Toko</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            subTab === 'toko' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'
          }`}>
            {stores.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSubTabChange('pemasok')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            subTab === 'pemasok'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Pemasok</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            subTab === 'pemasok' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'
          }`}>
            {pemasokList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSubTabChange('dapur')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            subTab === 'dapur'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Utensils className="w-3.5 h-3.5" />
          <span>Dapur</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            subTab === 'dapur' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'
          }`}>
            {kitchens.length}
          </span>
        </button>
      </div>

      {/* Database SQL Helper Banner */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Database className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-black text-indigo-950 truncate">
              Skrip SQL Database (Supabase / Postgres)
            </h4>
            <p className="text-[10px] text-indigo-700 font-medium truncate">
              Tabel &amp; data master dapur, toko, pemasok
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onCopySql}
            className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
            title="Salin query SQL ke clipboard"
          >
            {copiedSql ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin SQL</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onShowSqlModal}
            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-[11px] font-black transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
            title="Lihat query SQL lengkap"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Lihat SQL</span>
          </button>
        </div>
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
