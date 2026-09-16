import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { MasterToko, MasterPemasok, MasterDapur, MasterSatuan, Store as StoreType, Kitchen } from '../types';
import { 
  fetchMasterTokoFromDb, 
  fetchMasterPemasokFromDb, 
  fetchMasterDapurFromDb, 
  fetchMasterSatuanFromDb, 
  saveMasterSatuanToDb 
} from '../lib/supabaseDb';

interface UseMasterDataProps {
  setStores: Dispatch<SetStateAction<StoreType[]>>;
  setPemasokList: Dispatch<SetStateAction<string[]>>;
  setKitchens: Dispatch<SetStateAction<Kitchen[]>>;
  showToast: (message: string, type?: 'success' | 'delete' | 'edit' | 'info' | 'error') => void;
}

export function useMasterData({
  setStores,
  setPemasokList,
  setKitchens,
  showToast,
}: UseMasterDataProps) {
  const [masterToko, setMasterToko] = useState<MasterToko[]>([]);
  const [masterPemasok, setMasterPemasok] = useState<MasterPemasok[]>([]);
  const [masterDapur, setMasterDapur] = useState<MasterDapur[]>([]);
  const [masterSatuan, setMasterSatuan] = useState<MasterSatuan[]>([]);

  const refreshMasterData = useCallback(async () => {
    try {
      const [tokoRes, pemasokRes, dapurRes, satuanRes] = await Promise.all([
        fetchMasterTokoFromDb(),
        fetchMasterPemasokFromDb(),
        fetchMasterDapurFromDb(),
        fetchMasterSatuanFromDb(),
      ]);
      if (tokoRes.success && tokoRes.data) {
        setMasterToko(tokoRes.data);
        if (tokoRes.data.length > 0) {
          setStores(tokoRes.data.map((t) => ({ id: t.id, nama: t.nama })));
        }
      }
      if (pemasokRes.success && pemasokRes.data) {
        setMasterPemasok(pemasokRes.data);
        if (pemasokRes.data.length > 0) {
          setPemasokList(pemasokRes.data.map((p) => p.nama));
        }
      }
      if (dapurRes.success && dapurRes.data) {
        setMasterDapur(dapurRes.data);
        if (dapurRes.data.length > 0) {
          setKitchens(dapurRes.data.map((d) => ({ id: d.id, nama: d.nama, lokasi: d.alamat })));
        }
      }
      if (satuanRes.success && satuanRes.data) {
        setMasterSatuan(satuanRes.data);
      }
    } catch (e) {
      console.warn('Error refreshing master data from Supabase:', e);
    }
  }, [setStores, setPemasokList, setKitchens]);

  const handleAddMasterSatuan = useCallback(async (nama: string): Promise<{ success: boolean; error?: string }> => {
    const res = await saveMasterSatuanToDb(nama);
    if (res.success) {
      await refreshMasterData();
      showToast(`Satuan "${nama}" berhasil disimpan ke Master`, 'success');
      return { success: true };
    }
    return { success: false, error: res.error || 'Gagal menyimpan satuan' };
  }, [refreshMasterData, showToast]);

  return {
    masterToko,
    masterPemasok,
    masterDapur,
    masterSatuan,
    refreshMasterData,
    handleAddMasterSatuan,
  };
}
