import React, { useState } from 'react';
import { Utensils, Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { Kitchen } from '../../../types';
import { saveMasterDapurToDb, checkMasterUsageFromDb } from '../../../lib/supabaseDb';
import { SafetyDialogState } from '../types';

interface DapurSubSectionProps {
  kitchens: Kitchen[];
  onUpdateKitchens: (kitchens: Kitchen[]) => void;
  onRefreshData?: () => void | Promise<void>;
  onOpenSafetyDialog: (dialog: SafetyDialogState) => void;
}

export const DapurSubSection: React.FC<DapurSubSectionProps> = ({
  kitchens,
  onUpdateKitchens,
  onRefreshData,
  onOpenSafetyDialog,
}) => {
  const [searchDapur, setSearchDapur] = useState('');
  const [newKitchenName, setNewKitchenName] = useState('');
  const [newKitchenLocation, setNewKitchenLocation] = useState('');
  const [editingKitchenId, setEditingKitchenId] = useState<string | null>(null);

  const handleAddOrUpdateKitchen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKitchenName.trim()) return;

    const trimmedName = newKitchenName.trim();
    const trimmedLoc = newKitchenLocation.trim() || undefined;

    saveMasterDapurToDb(trimmedName, trimmedLoc).then(() => {
      onRefreshData?.();
    }).catch(console.error);

    if (editingKitchenId) {
      onUpdateKitchens(
        kitchens.map((k) =>
          k.id === editingKitchenId
            ? { ...k, nama: trimmedName, lokasi: trimmedLoc }
            : k
        )
      );
      setEditingKitchenId(null);
    } else {
      const newK: Kitchen = {
        id: `k-${Date.now()}`,
        nama: trimmedName,
        lokasi: trimmedLoc,
      };
      onUpdateKitchens([...kitchens, newK]);
    }
    setNewKitchenName('');
    setNewKitchenLocation('');
  };

  const handleEditKitchen = (k: Kitchen) => {
    setEditingKitchenId(k.id);
    setNewKitchenName(k.nama);
    setNewKitchenLocation(k.lokasi || '');
  };

  const handleDeleteKitchen = async (id: string) => {
    const targetKitchen = kitchens.find((k) => k.id === id);
    const targetName = targetKitchen?.nama || '';

    try {
      const check = await checkMasterUsageFromDb('dapur', id, targetName);
      if (check.isUsed) {
        onOpenSafetyDialog({
          type: 'blocked',
          category: 'Dapur',
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
      category: 'Dapur',
      id,
      nama: targetName,
    });
  };

  return (
    <div className="space-y-4 font-sans">
      <form onSubmit={handleAddOrUpdateKitchen} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Utensils className="w-3.5 h-3.5 text-indigo-600" />
            <span>{editingKitchenId ? 'Edit Data Dapur' : 'Tambah Dapur Baru'}</span>
          </h3>
          {editingKitchenId && (
            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
              Mode Edit
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <input
            type="text"
            placeholder="Nama Dapur (misal: Dapur Utama)"
            required
            value={newKitchenName}
            onChange={(e) => setNewKitchenName(e.target.value)}
            className="p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:outline-none font-semibold"
          />
          <input
            type="text"
            placeholder="Lokasi / Keterangan (Opsional)"
            value={newKitchenLocation}
            onChange={(e) => setNewKitchenLocation(e.target.value)}
            className="p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:outline-none font-semibold"
          />
        </div>
        <div className="flex gap-2 justify-end pt-1">
          {editingKitchenId && (
            <button
              type="button"
              onClick={() => {
                setEditingKitchenId(null);
                setNewKitchenName('');
                setNewKitchenLocation('');
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Batal
            </button>
          )}
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{editingKitchenId ? 'Simpan Perubahan' : 'Tambah Dapur'}</span>
          </button>
        </div>
      </form>

      {/* Search & List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
            Daftar Dapur ({kitchens.length})
          </span>
          {kitchens.length > 4 && (
            <div className="relative w-44">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari dapur..."
                value={searchDapur}
                onChange={(e) => setSearchDapur(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-indigo-600 font-medium"
              />
            </div>
          )}
        </div>

        {kitchens.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            Belum ada data dapur. Silakan tambahkan dapur di atas.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {kitchens
              .filter((k) => 
                k.nama.toLowerCase().includes(searchDapur.toLowerCase()) ||
                (k.lokasi && k.lokasi.toLowerCase().includes(searchDapur.toLowerCase()))
              )
              .map((k) => (
                <div
                  key={k.id}
                  className="p-3 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between shadow-2xs hover:border-indigo-300 transition-all"
                >
                  <div>
                    <div className="font-bold text-xs text-slate-900">{k.nama}</div>
                    {k.lokasi && <div className="text-[11px] text-slate-500 font-medium">{k.lokasi}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleEditKitchen(k)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit Dapur"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteKitchen(k.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Hapus Dapur"
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
