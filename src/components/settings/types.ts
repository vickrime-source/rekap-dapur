import { Store as StoreType, Kitchen, OrderItem } from '../../types';

export type SettingsTab = 'kelola_data' | 'template' | 'notifikasi' | 'install' | 'danger';
export type KelolaSubTab = 'toko' | 'pemasok' | 'dapur';

export interface SafetyDialogState {
  type: 'blocked' | 'confirm';
  category: 'Toko' | 'Pemasok' | 'Dapur';
  id: string;
  nama: string;
  orderCount?: number;
  transaksiCount?: number;
}
