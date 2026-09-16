import React, { useState, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  Smartphone, 
  FileText, 
  Bell, 
  Database 
} from 'lucide-react';
import { Kitchen, Store as StoreType, OrderItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  deleteMasterTokoFromDb, 
  deleteMasterPemasokFromDb, 
  deleteMasterDapurFromDb 
} from '../lib/supabaseDb';
import { MASTER_TABLES_SQL } from '../lib/masterSqlScript';

import { SettingsTab, KelolaSubTab, SafetyDialogState } from './settings/types';
import { KelolaDataTab } from './settings/KelolaDataTab';
import { DocxTemplateTab } from './settings/DocxTemplateTab';
import { NotificationTab } from './settings/NotificationTab';
import { InstallAppTab } from './settings/InstallAppTab';
import { DangerZoneTab } from './settings/DangerZoneTab';
import { SafetyDeleteDialog } from './settings/SafetyDeleteDialog';
import { SqlViewerModal } from './settings/SqlViewerModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  kitchens: Kitchen[];
  onUpdateKitchens: (kitchens: Kitchen[]) => void;
  stores: StoreType[];
  onUpdateStores: (stores: StoreType[]) => void;
  pemasokList: string[];
  onUpdatePemasok: (pemasok: string[]) => void;
  orders?: OrderItem[];
  onUpdateOrders?: (orders: OrderItem[]) => void;
  onDeleteAllData?: () => void;
  onRefreshData?: () => void | Promise<void>;
  initialTab?: 'kelola_data' | 'dapur' | 'toko' | 'pemasok' | 'template' | 'notifikasi' | 'install' | 'danger';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  kitchens,
  onUpdateKitchens,
  stores,
  onUpdateStores,
  pemasokList,
  onUpdatePemasok,
  orders = [],
  onDeleteAllData,
  onRefreshData,
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (initialTab === 'dapur' || initialTab === 'toko' || initialTab === 'pemasok' || initialTab === 'kelola_data') {
      return 'kelola_data';
    }
    return (initialTab as any) || 'kelola_data';
  });

  const [kelolaSubTab, setKelolaSubTab] = useState<KelolaSubTab>(() => {
    if (initialTab === 'dapur') return 'dapur';
    if (initialTab === 'pemasok') return 'pemasok';
    return 'toko';
  });

  // Safety dialog state for delete checking
  const [safetyDialog, setSafetyDialog] = useState<SafetyDialogState | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // SQL Script modal state
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      onRefreshData?.();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialTab && isOpen) {
      if (initialTab === 'dapur' || initialTab === 'toko' || initialTab === 'pemasok' || initialTab === 'kelola_data') {
        setActiveTab('kelola_data');
        if (initialTab === 'dapur') setKelolaSubTab('dapur');
        if (initialTab === 'pemasok') setKelolaSubTab('pemasok');
        if (initialTab === 'toko') setKelolaSubTab('toko');
      } else {
        setActiveTab(initialTab as any);
      }
    }
  }, [initialTab, isOpen]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(MASTER_TABLES_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  // Execute safe deletion
  const handleExecuteSafetyDelete = async () => {
    if (!safetyDialog || safetyDialog.type !== 'confirm') return;
    setIsDeleting(true);
    try {
      if (safetyDialog.category === 'Dapur') {
        await deleteMasterDapurFromDb(safetyDialog.id);
        onUpdateKitchens(kitchens.filter((k) => k.id !== safetyDialog.id));
      } else if (safetyDialog.category === 'Toko') {
        await deleteMasterTokoFromDb(safetyDialog.id);
        onUpdateStores(stores.filter((s) => s.id !== safetyDialog.id));
      } else if (safetyDialog.category === 'Pemasok') {
        await deleteMasterPemasokFromDb(safetyDialog.nama);
        onUpdatePemasok(pemasokList.filter((p) => p !== safetyDialog.nama));
      }
      await onRefreshData?.();
    } catch (err) {
      console.error('Gagal menghapus:', err);
    } finally {
      setIsDeleting(false);
      setSafetyDialog(null);
    }
  };

  const handleDeleteAllDataConfirm = () => {
    if (
      confirm(
        '⚠️ PERINGATAN: Seluruh data pesanan lokal akan dihapus permanen! Apakah Anda benar-benar yakin?'
      )
    ) {
      if (onDeleteAllData) {
        onDeleteAllData();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 no-print font-sans">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        />

        {/* Bottom Sheet Container */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-2xl tablet-landscape-modal bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[88vh] z-10 border-t sm:border border-slate-200/80 overflow-hidden"
        >
          {/* Mobile Drag Indicator */}
          <div className="pt-3 pb-1 flex justify-center">
            <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 leading-none">
                  Pengaturan &amp; Kelola Data
                </h2>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Kelola data toko, pemasok, dapur, template faktur, dan spreadsheet
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Horizontally Scrollable Modern Tab Bar for Mobile & Desktop */}
          <div className="px-3 py-2 bg-slate-50/90 border-b border-slate-200/80">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
              <button
                type="button"
                onClick={() => setActiveTab('kelola_data')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'kelola_data'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Kelola Data ({stores.length + pemasokList.length + kitchens.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('template')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'template'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Template DOCX</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('notifikasi')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'notifikasi'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <Bell className="w-3.5 h-3.5 text-amber-500" />
                <span>Notifikasi HP</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('install')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'install'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
                <span>Install APK</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('danger')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'danger'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white text-rose-600 hover:bg-rose-50 border border-rose-200'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
            {activeTab === 'kelola_data' && (
              <KelolaDataTab
                subTab={kelolaSubTab}
                onSubTabChange={setKelolaSubTab}
                stores={stores}
                onUpdateStores={onUpdateStores}
                pemasokList={pemasokList}
                onUpdatePemasok={onUpdatePemasok}
                kitchens={kitchens}
                onUpdateKitchens={onUpdateKitchens}
                onRefreshData={onRefreshData}
                onOpenSafetyDialog={setSafetyDialog}
                onCopySql={handleCopySql}
                copiedSql={copiedSql}
                onShowSqlModal={() => setShowSqlModal(true)}
              />
            )}

            {activeTab === 'template' && (
              <DocxTemplateTab
                orders={orders}
                stores={stores}
                kitchens={kitchens}
                pemasokList={pemasokList}
              />
            )}

            {activeTab === 'notifikasi' && <NotificationTab />}

            {activeTab === 'install' && <InstallAppTab />}

            {activeTab === 'danger' && (
              <DangerZoneTab onDeleteAllDataConfirm={handleDeleteAllDataConfirm} />
            )}
          </div>
        </motion.div>

        {/* Safety Dialog Modal */}
        <SafetyDeleteDialog
          dialog={safetyDialog}
          isDeleting={isDeleting}
          onClose={() => setSafetyDialog(null)}
          onConfirmDelete={handleExecuteSafetyDelete}
        />

        {/* SQL Viewer Modal */}
        <SqlViewerModal
          isOpen={showSqlModal}
          onClose={() => setShowSqlModal(false)}
          copiedSql={copiedSql}
          onCopySql={handleCopySql}
        />
      </div>
    </AnimatePresence>
  );
};
