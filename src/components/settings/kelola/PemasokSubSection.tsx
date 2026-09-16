import React, { useState } from 'react';
import { Truck, Plus, Search, Trash2 } from 'lucide-react';
import { saveMasterPemasokToDb, checkMasterUsageFromDb } from '../../../lib/supabaseDb';
import { SafetyDialogState } from '../types';

interface PemasokSubSectionProps {
  pemasokList: string[];
  onUpdatePemasok: (pemasok: string[]) => void;
  onRefreshData?: () => void | Promise<void>;
  onOpenSafetyDialog: (dialog: SafetyDialogState) => void;
}

export const PemasokSubSection: React.FC<PemasokSubSectionProps> = ({
  pemasokList,
  onUpdatePemasok,
  onRefreshData,
  onOpenSafetyDialog,
}) => {
  const [searchPemasok, setSearchPemasok] = useState('');
  const [newPemasokName, setNewPemasokName] = useState('');

  const handleAddPemasok = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPemasokName.trim()) return;
    const trimmedPemasok = newPemasokName.trim();
    if (pemasokList.includes(trimmedPemasok)) {
      alert('Pemasok sudah terdaftar di daftar');
      return;
    }

    saveMasterPemasokToDb(trimmedPemasok).then(() => {
      onRefreshData?.();
    }).catch(console.error);

    onUpdatePemasok([...pemasokList, trimmedPemasok]);
    setNewPemasokName('');
  };

  const handleDeletePemasok = async (name: string) => {
    try {
      const check = await checkMasterUsageFromDb('pemasok', name, name);
      if (check.isUsed) {
        onOpenSafetyDialog({
          type: 'blocked',
          category: 'Pemasok',
          id: name,
          nama: name,
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
      category: 'Pemasok',
      id: name,
      nama: name,
    });
  };

  return (
    <div className="space-y-4 font-sans">
      <form onSubmit={handleAddPemasok} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5 text-indigo-600" />
          <span>Tambah Pemasok Baru</span>
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Nama Pemasok (Contoh: Juragan Ayam, Pasar Rogojampi)"
            required
            value={newPemasokName}
            onChange={(e) => setNewPemasokName(e.target.value)}
            className="flex-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none font-semibold"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>
        </div>
      </form>

      {/* Search & List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
            Daftar Pemasok ({pemasokList.length})
          </span>
          {pemasokList.length > 4 && (
            <div className="relative w-44">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari pemasok..."
                value={searchPemasok}
                onChange={(e) => setSearchPemasok(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-indigo-600 font-medium"
              />
            </div>
          )}
        </div>

        {pemasokList.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            Belum ada data pemasok. Silakan tambahkan pemasok di atas.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {pemasokList
              .filter((p) => p.toLowerCase().includes(searchPemasok.toLowerCase()))
              .map((p) => (
                <div
                  key={p}
                  className="p-3 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between shadow-2xs hover:border-indigo-300 transition-all"
                >
                  <span className="font-bold text-xs text-slate-900">{p}</span>
                  <button
                    type="button"
                    onClick={() => handleDeletePemasok(p)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Hapus Pemasok"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
