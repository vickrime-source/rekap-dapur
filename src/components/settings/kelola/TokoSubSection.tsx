import React, { useState } from 'react';
import { Store as StoreIcon, Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { Store as StoreType } from '../../../types';
import { saveMasterTokoToDb, checkMasterUsageFromDb } from '../../../lib/supabaseDb';
import { SafetyDialogState } from '../types';

interface TokoSubSectionProps {
  stores: StoreType[];
  onUpdateStores: (stores: StoreType[]) => void;
  onRefreshData?: () => void | Promise<void>;
  onOpenSafetyDialog: (dialog: SafetyDialogState) => void;
}

export const TokoSubSection: React.FC<TokoSubSectionProps> = ({
  stores,
  onUpdateStores,
  onRefreshData,
  onOpenSafetyDialog,
}) => {
  const [searchToko, setSearchToko] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);

  const handleAddOrUpdateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) return;

    const trimmedStore = newStoreName.trim();
    saveMasterTokoToDb(trimmedStore).then(() => {
      onRefreshData?.();
    }).catch(console.error);

    if (editingStoreId) {
      onUpdateStores(
        stores.map((s) => (s.id === editingStoreId ? { ...s, nama: trimmedStore } : s))
      );
      setEditingStoreId(null);
    } else {
      const newS: StoreType = {
        id: `s-${Date.now()}`,
        nama: trimmedStore,
      };
      onUpdateStores([...stores, newS]);
    }
    setNewStoreName('');
  };

  const handleEditStore = (s: StoreType) => {
    setEditingStoreId(s.id);
    setNewStoreName(s.nama);
  };

  const handleDeleteStore = async (id: string) => {
    const targetStore = stores.find((s) => s.id === id);
    const targetName = targetStore?.nama || '';

    try {
      const check = await checkMasterUsageFromDb('toko', id, targetName);
      if (check.isUsed) {
        onOpenSafetyDialog({
          type: 'blocked',
          category: 'Toko',
          id,
          nama: targetName,
          orderCount: check.orderCount,
          transaksiCount: check.transaksiCount,
        });
        return;
      }
    } catch (e) {
      console.warn('Error checking usage:', e);
    }

    onOpenSafetyDialog({
      type: 'confirm',
      category: 'Toko',
      id,
      nama: targetName,
    });
  };

  return (
    <div className="space-y-4 font-sans">
      <form onSubmit={handleAddOrUpdateStore} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <StoreIcon className="w-3.5 h-3.5 text-indigo-600" />
            <span>{editingStoreId ? 'Edit Data Toko' : 'Tambah Toko Baru'}</span>
          </h3>
          {editingStoreId && (
            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
              Mode Edit
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Nama Toko (Contoh: HTG, PROHE, LUWENG BOGA)"
            required
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            className="flex-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none font-semibold"
          />
          {editingStoreId && (
            <button
              type="button"
              onClick={() => {
                setEditingStoreId(null);
                setNewStoreName('');
              }}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Batal
            </button>
          )}
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{editingStoreId ? 'Simpan' : 'Tambah'}</span>
          </button>
        </div>
      </form>

      {/* Search & List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
            Daftar Toko ({stores.length})
          </span>
          {stores.length > 4 && (
            <div className="relative w-44">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari toko..."
                value={searchToko}
                onChange={(e) => setSearchToko(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-indigo-600 font-medium"
              />
            </div>
          )}
        </div>

        {stores.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            Belum ada data toko. Silakan tambahkan toko di atas.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {stores
              .filter((s) => s.nama.toLowerCase().includes(searchToko.toLowerCase()))
              .map((s) => (
                <div
                  key={s.id}
                  className="p-3 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between shadow-2xs hover:border-indigo-300 transition-all"
                >
                  <span className="font-black text-xs text-slate-900">{s.nama}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleEditStore(s)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit Toko"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteStore(s.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Hapus Toko"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
