import React, { useState } from 'react';
import { 
  X, 
  Utensils, 
  Store as StoreIcon, 
  Truck, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  RefreshCw, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Smartphone, 
  AlertTriangle, 
  FileText, 
  Upload, 
  FileCheck, 
  ExternalLink, 
  Receipt, 
  Sparkles,
  FileSpreadsheet,
  Bell,
  Clock
} from 'lucide-react';
import { Kitchen, Store as StoreType, OrderItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getCustomTemplateUrl, 
  setCustomTemplateUrl, 
  downloadDocxInvoice, 
  INVOICE_TEMPLATES 
} from '../lib/docxTemplate';
import {
  checkGoogleSheetsConnection,
  fetchSheetData,
} from '../lib/googleSheets';
import {
  getNotificationSettings,
  saveNotificationSettings,
  getNotificationPermissionStatus,
  requestNotificationPermission,
  sendTestNotification,
  NotificationSettings,
} from '../lib/notificationManager';

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
  onUpdateOrders,
  onDeleteAllData,
}) => {
  const [activeTab, setActiveTab] = useState<'dapur' | 'toko' | 'pemasok' | 'template' | 'googlesheets' | 'notifikasi' | 'install' | 'danger'>('dapur');

  // Notification States
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(getNotificationSettings());
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(getNotificationPermissionStatus());
  const [testNotificationSent, setTestNotificationSent] = useState<boolean>(false);

  const handleUpdateNotificationSetting = <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    const updated = { ...notificationSettings, [key]: value };
    setNotificationSettings(updated);
    saveNotificationSettings(updated);
  };

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setPermissionStatus(res);
    if (res === 'granted') {
      handleUpdateNotificationSetting('enabled', true);
    }
  };

  const handleSendTestNotification = async () => {
    setTestNotificationSent(false);
    const success = await sendTestNotification();
    if (success) {
      setTestNotificationSent(true);
      setTimeout(() => setTestNotificationSent(false), 3000);
    } else {
      const res = await requestNotificationPermission();
      setPermissionStatus(res);
      if (res === 'granted') {
        await sendTestNotification();
        setTestNotificationSent(true);
        setTimeout(() => setTestNotificationSent(false), 3000);
      }
    }
  };

  // Form states for adding/editing Master Data
  const [newKitchenName, setNewKitchenName] = useState('');
  const [newKitchenLocation, setNewKitchenLocation] = useState('');
  const [editingKitchenId, setEditingKitchenId] = useState<string | null>(null);

  const [newStoreName, setNewStoreName] = useState('');
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);

  const [newPemasokName, setNewPemasokName] = useState('');

  // DOCX Template States
  const [selectedTemplateFile, setSelectedTemplateFile] = useState<File | null>(null);
  const [templateStatus, setTemplateStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeCustomTemplateUrl, setActiveCustomTemplateUrl] = useState<string | null>(getCustomTemplateUrl());
  const [customTemplateName, setCustomTemplateName] = useState<string | null>(
    localStorage.getItem('custom_docx_template_name')
  );

  // Google Sheets API states
  const [testingSheets, setTestingSheets] = useState(false);
  const [sheetsConnectionData, setSheetsConnectionData] = useState<{
    success?: boolean;
    configured?: boolean;
    title?: string;
    clientEmail?: string | null;
    spreadsheetId?: string | null;
    sheets?: string[];
    error?: string;
  } | null>(null);

  // Install PWA states
  const [isInstalled, setIsInstalled] = useState(false);

  if (!isOpen) return null;

  // --- KITCHEN HANDLERS ---
  const handleAddOrUpdateKitchen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKitchenName.trim()) return;

    if (editingKitchenId) {
      onUpdateKitchens(
        kitchens.map((k) =>
          k.id === editingKitchenId
            ? { ...k, nama: newKitchenName.trim(), lokasi: newKitchenLocation.trim() || undefined }
            : k
        )
      );
      setEditingKitchenId(null);
    } else {
      const newK: Kitchen = {
        id: `k-${Date.now()}`,
        nama: newKitchenName.trim(),
        lokasi: newKitchenLocation.trim() || undefined,
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

  const handleDeleteKitchen = (id: string) => {
    if (confirm('Yakin ingin menghapus dapur ini?')) {
      onUpdateKitchens(kitchens.filter((k) => k.id !== id));
    }
  };

  // --- STORE HANDLERS ---
  const handleAddOrUpdateStore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) return;

    if (editingStoreId) {
      onUpdateStores(
        stores.map((s) => (s.id === editingStoreId ? { ...s, nama: newStoreName.trim() } : s))
      );
      setEditingStoreId(null);
    } else {
      const newS: StoreType = {
        id: `s-${Date.now()}`,
        nama: newStoreName.trim(),
      };
      onUpdateStores([...stores, newS]);
    }
    setNewStoreName('');
  };

  const handleEditStore = (s: StoreType) => {
    setEditingStoreId(s.id);
    setNewStoreName(s.nama);
  };

  const handleDeleteStore = (id: string) => {
    if (confirm('Yakin ingin menghapus toko ini?')) {
      onUpdateStores(stores.filter((s) => s.id !== id));
    }
  };

  // --- PEMASOK HANDLERS ---
  const handleAddPemasok = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPemasokName.trim()) return;
    if (pemasokList.includes(newPemasokName.trim())) {
      alert('Pemasok sudah terdaftar');
      return;
    }
    onUpdatePemasok([...pemasokList, newPemasokName.trim()]);
    setNewPemasokName('');
  };

  const handleDeletePemasok = (name: string) => {
    if (confirm(`Yakin ingin menghapus pemasok "${name}"?`)) {
      onUpdatePemasok(pemasokList.filter((p) => p !== name));
    }
  };

  // --- GOOGLE SHEETS API HANDLER ---
  const handleTestSheetsConnection = async () => {
    setTestingSheets(true);
    setSheetsConnectionData(null);
    try {
      const status = await checkGoogleSheetsConnection();
      if (status.success) {
        // Also verify sheet data can be fetched
        const testRes = await fetchSheetData<any>('pesanan');
        setSheetsConnectionData({
          ...status,
          error: testRes.error || undefined,
        });
      } else {
        setSheetsConnectionData(status);
      }
    } catch (err: any) {
      setSheetsConnectionData({
        success: false,
        configured: false,
        error: err?.message || 'Gagal menghubungi backend Google Sheets API',
      });
    } finally {
      setTestingSheets(false);
    }
  };

  // --- TEMPLATE HANDLERS ---
  const handleUseLocalDocx = () => {
    if (!selectedTemplateFile) return;
    const objectUrl = URL.createObjectURL(selectedTemplateFile);
    setCustomTemplateUrl(objectUrl);
    localStorage.setItem('custom_docx_template_name', selectedTemplateFile.name);
    setActiveCustomTemplateUrl(objectUrl);
    setCustomTemplateName(selectedTemplateFile.name);
    setTemplateStatus({
      type: 'success',
      text: `Template lokal "${selectedTemplateFile.name}" aktif untuk sesi browser ini!`,
    });
  };

  const handleResetCustomTemplate = () => {
    setCustomTemplateUrl(null);
    localStorage.removeItem('custom_docx_template_name');
    setActiveCustomTemplateUrl(null);
    setCustomTemplateName(null);
    setTemplateStatus({
      type: 'success',
      text: 'Berhasil di-reset ke template standar default per toko.',
    });
  };

  const handleTestSampleDocxExport = async () => {
    try {
      const sampleItems: OrderItem[] = orders.length > 0 ? orders.slice(0, 3) : [
        {
          id: 'test-1',
          namaBarang: 'Ayam Potong Segar',
          qty: 10,
          hargaBeli: 28000,
          hargaJual: 35000,
          toko: stores[0]?.nama || 'HTG',
          tujuanDapur: kitchens[0]?.nama || 'Dapur Utama',
          pemasok: pemasokList[0] || 'Supplier Utama',
          status: 'pending',
          tanggal: new Date().toISOString().split('T')[0],
          catatan: 'Contoh catatan pesanan'
        }
      ];

      await downloadDocxInvoice({
        storeName: stores[0]?.nama || 'HTG',
        kitchenName: kitchens[0]?.nama || 'Dapur Utama',
        items: sampleItems,
        invoiceNumber: 'INV-SAMPLE-001',
        bayar: 100000,
      });
    } catch (err: any) {
      alert(`Gagal uji export template: ${err?.message || err}`);
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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center no-print font-sans">
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
          className="relative w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[88vh] z-10 border-t border-slate-200/80 overflow-hidden"
        >
          {/* Mobile Drag Indicator */}
          <div className="pt-3 pb-1 flex justify-center">
            <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 leading-none">
                Pengaturan Sistem &amp; Master Data
              </h2>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Kelola master data toko, dapur, template invoice, dan spreadsheet
              </p>
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
                onClick={() => setActiveTab('dapur')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'dapur'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Dapur ({kitchens.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('toko')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'toko'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <StoreIcon className="w-3.5 h-3.5" />
                <span>Toko ({stores.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('pemasok')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'pemasok'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Pemasok ({pemasokList.length})</span>
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
                onClick={() => setActiveTab('googlesheets')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'googlesheets'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Google Sheets</span>
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
            {/* SUB-TAB 1: KELOLA DAPUR */}
            {activeTab === 'dapur' && (
              <div className="space-y-4">
                <form onSubmit={handleAddOrUpdateKitchen} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    {editingKitchenId ? 'Edit Data Dapur' : 'Tambah Dapur Baru'}
                  </h3>
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
                        className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100"
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

                <div className="space-y-2">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    Daftar Dapur Aktif ({kitchens.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {kitchens.map((k) => (
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
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteKitchen(k.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 2: KELOLA TOKO */}
            {activeTab === 'toko' && (
              <div className="space-y-4">
                <form onSubmit={handleAddOrUpdateStore} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    {editingStoreId ? 'Edit Toko' : 'Tambah Toko Baru'}
                  </h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nama Toko (Contoh: HTG, PROHE, LUWENG BOGA)"
                      required
                      value={newStoreName}
                      onChange={(e) => setNewStoreName(e.target.value)}
                      className="flex-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none font-semibold"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{editingStoreId ? 'Simpan' : 'Tambah'}</span>
                    </button>
                  </div>
                </form>

                <div className="space-y-2">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    Daftar Toko ({stores.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {stores.map((s) => (
                      <div
                        key={s.id}
                        className="p-3 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between shadow-2xs hover:border-indigo-300 transition-all"
                      >
                        <span className="font-extrabold text-xs text-slate-900">{s.nama}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditStore(s)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStore(s.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 3: KELOLA PEMASOK */}
            {activeTab === 'pemasok' && (
              <div className="space-y-4">
                <form onSubmit={handleAddPemasok} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Tambah Pemasok Baru
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
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah</span>
                    </button>
                  </div>
                </form>

                <div className="space-y-2">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    Daftar Pemasok ({pemasokList.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {pemasokList.map((p) => (
                      <div
                        key={p}
                        className="p-3 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between shadow-2xs hover:border-indigo-300 transition-all"
                      >
                        <span className="font-bold text-xs text-slate-900">{p}</span>
                        <button
                          type="button"
                          onClick={() => handleDeletePemasok(p)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 4: CUSTOM TEMPLATE DOCX */}
            {activeTab === 'template' && (
              <div className="space-y-4 text-xs text-slate-700">
                {/* Offline Print Info Card */}
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-2 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-600 text-white rounded-xl">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-black text-emerald-950 text-xs sm:text-sm block">
                        Cetak Browser Offline (No Limit &amp; Cepat)
                      </span>
                      <p className="text-[11px] text-emerald-800 font-medium">
                        Semua file Word .DOCX dikonversi menjadi PDF secara langsung di browser tanpa ketergantungan API eksternal.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status Template Aktif & Defaults */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 text-[11px] uppercase tracking-wider">
                      Status Template Aktif
                    </span>
                    {activeCustomTemplateUrl && (
                      <button
                        type="button"
                        onClick={handleResetCustomTemplate}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg border border-rose-200 transition-colors"
                      >
                        Reset ke Default
                      </button>
                    )}
                  </div>

                  {activeCustomTemplateUrl ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                      <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-xs">
                        <FileCheck className="w-4 h-4 text-emerald-600" />
                        <span>Menggunakan Template Custom: {customTemplateName || 'Template Custom'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] text-slate-600 font-medium">
                        Menggunakan template bawaan default per toko:
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                        {Object.entries(INVOICE_TEMPLATES).map(([storeKey, url]) => (
                          <a
                            key={storeKey}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition-all shadow-2xs"
                          >
                            <span className="font-bold text-slate-900">{storeKey}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions for Testing and Selecting Local File */}
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestSampleDocxExport}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all text-xs cursor-pointer shadow-xs"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Uji Export Invoice DOCX</span>
                    </button>
                  </div>
                </div>

                {/* Local Docx Uploader */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <h4 className="font-black text-slate-900 uppercase text-[11px] tracking-wider flex items-center gap-2">
                    <Upload className="w-4 h-4 text-indigo-600" />
                    <span>Gunakan File .DOCX Kustom dari HP/Komputer</span>
                  </h4>

                  <input
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => setSelectedTemplateFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-700 bg-white border border-slate-300 rounded-xl p-2.5 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />

                  {selectedTemplateFile && (
                    <button
                      type="button"
                      onClick={handleUseLocalDocx}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold rounded-xl flex items-center gap-1.5 transition-all text-xs cursor-pointer shadow-xs"
                    >
                      <Check className="w-4 h-4" />
                      <span>Gunakan File "{selectedTemplateFile.name}" Sebagai Template</span>
                    </button>
                  )}

                  {templateStatus && (
                    <div
                      className={`p-3 rounded-xl text-xs font-bold space-y-1.5 ${
                        templateStatus.type === 'success'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-rose-100 text-rose-900 border border-rose-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {templateStatus.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                        )}
                        <span>{templateStatus.text}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Variable Placeholder Reference */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <span className="font-black text-slate-900 text-[11px] uppercase tracking-wider block">
                    Daftar Variable / Tag Placeholder (.docx)
                  </span>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    Sisipkan tag tag berikut ke dalam file .docx Anda:
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1">
                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                      <span className="text-indigo-600 font-bold block">{`{dapur}`}</span>
                      <span className="text-slate-500 text-[9px]">Dapur Tujuan</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                      <span className="text-indigo-600 font-bold block">{`{toko}`}</span>
                      <span className="text-slate-500 text-[9px]">Nama Toko</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                      <span className="text-indigo-600 font-bold block">{`{tanggal}`}</span>
                      <span className="text-slate-500 text-[9px]">Tanggal</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                      <span className="text-indigo-600 font-bold block">{`{invoiceNumber}`}</span>
                      <span className="text-slate-500 text-[9px]">No Invoice</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                      <span className="text-indigo-600 font-bold block">{`{total}`}</span>
                      <span className="text-slate-500 text-[9px]">Total (Rp)</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                      <span className="text-indigo-600 font-bold block">{`{bayar}`} &amp; {`{sisa}`}</span>
                      <span className="text-slate-500 text-[9px]">Nominal Bayar</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 5: GOOGLE SHEETS API */}
            {activeTab === 'googlesheets' && (
              <div className="space-y-4 text-xs text-slate-700">
                {/* Connection Status & Test Card */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                      <div>
                        <h3 className="font-black text-slate-900 uppercase text-[11px] tracking-wider">
                          Koneksi Google Sheets API Resmi
                        </h3>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Menggunakan Service Account JWT Authentication (googleapis)
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleTestSheetsConnection}
                      disabled={testingSheets}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingSheets ? 'animate-spin' : ''}`} />
                      <span>{testingSheets ? 'Menguji...' : 'Uji Koneksi'}</span>
                    </button>
                  </div>

                  {sheetsConnectionData && (
                    <div
                      className={`p-3.5 rounded-xl text-xs space-y-2 border ${
                        sheetsConnectionData.success && !sheetsConnectionData.error
                          ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
                          : 'bg-rose-50 text-rose-950 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-black">
                        {sheetsConnectionData.success && !sheetsConnectionData.error ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span>
                          {sheetsConnectionData.success && !sheetsConnectionData.error
                            ? 'Berhasil Terhubung ke Google Sheets API!'
                            : 'Gagal Terhubung ke Google Sheets'}
                        </span>
                      </div>

                      {sheetsConnectionData.error && (
                        <p className="text-[11px] text-rose-700 font-mono bg-white/80 p-2 rounded-lg border border-rose-200">
                          {sheetsConnectionData.error}
                        </p>
                      )}

                      {sheetsConnectionData.title && (
                        <div className="text-[11px] space-y-1 pt-1 border-t border-emerald-200/60 font-sans">
                          <div><span className="font-bold">Judul Spreadsheet:</span> {sheetsConnectionData.title}</div>
                          {sheetsConnectionData.clientEmail && (
                            <div><span className="font-bold">Service Account:</span> {sheetsConnectionData.clientEmail}</div>
                          )}
                          {sheetsConnectionData.sheets && (
                            <div><span className="font-bold">Sheet Terdeteksi:</span> {sheetsConnectionData.sheets.join(', ')}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="font-bold">Metode Otentikasi:</span>
                      <span className="font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">Google Service Account JWT</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span className="font-bold">Status Apps Script:</span>
                      <span className="font-semibold text-slate-500">Dinonaktifkan (Migrasi selesai)</span>
                    </div>
                  </div>
                </div>

                {/* Environment Variables Info */}
                <div className="bg-indigo-50/70 border border-indigo-200/80 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="font-black text-[11px] text-indigo-950 uppercase tracking-wider">
                      Setup Environment Variables (Vercel / Server)
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-900 leading-relaxed font-medium">
                    Kredensial Google Sheets API disimpan secara aman di sisi server (backend environment variables), tidak pernah bocor ke browser:
                  </p>
                  <ul className="space-y-1.5 text-[11px] text-indigo-950 font-mono bg-white/90 p-3 rounded-xl border border-indigo-100">
                    <li><strong className="text-indigo-800 font-sans font-bold">1.</strong> GOOGLE_SHEETS_CLIENT_EMAIL</li>
                    <li><strong className="text-indigo-800 font-sans font-bold">2.</strong> GOOGLE_SHEETS_PRIVATE_KEY</li>
                    <li><strong className="text-indigo-800 font-sans font-bold">3.</strong> GOOGLE_SHEETS_SPREADSHEET_ID</li>
                  </ul>
                  <div className="text-[11px] text-indigo-900/90 space-y-1">
                    <p className="font-semibold">Langkah yang sudah disiapkan:</p>
                    <p>✓ Spreadsheet sudah di-share ke email service account dengan akses <strong>Editor</strong>.</p>
                    <p>✓ Google Sheets API sudah di-enable di Google Cloud Console.</p>
                    <p>✓ Endpoint backend <code className="bg-indigo-100 px-1 py-0.5 rounded text-indigo-800">/api/sheets-get</code>, <code className="bg-indigo-100 px-1 py-0.5 rounded text-indigo-800">/api/sheets-add</code>, <code className="bg-indigo-100 px-1 py-0.5 rounded text-indigo-800">/api/sheets-update</code>, dan <code className="bg-indigo-100 px-1 py-0.5 rounded text-indigo-800">/api/sheets-delete</code> aktif.</p>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB: KONFIGURASI NOTIFIKASI HP */}
            {activeTab === 'notifikasi' && (
              <div className="space-y-4 text-xs text-slate-700">
                {/* 1. Permission Status Card */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 uppercase text-[11px] tracking-wider">
                          Status Izin Notifikasi HP
                        </h3>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Web & Mobile Push Notifications (PWA)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {permissionStatus === 'granted' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Diizinkan (Aktif)
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRequestPermission}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-extrabold rounded-xl text-[11px] transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Bell className="w-3 h-3" />
                          <span>Minta Izin HP</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                    {permissionStatus === 'granted'
                      ? '✓ Browser dan HP Anda telah mengizinkan notifikasi. Pengingat laporan dan catatan akan muncul otomatis di status bar / layar kunci HP.'
                      : '⚠️ Klik "Minta Izin HP" lalu pilih "Izinkan" (Allow) pada pop-up browser agar notifikasi laporan harian dan catatan dapat muncul di layar HP Anda.'}
                  </p>
                </div>

                {/* 2. Master & Feature Toggles */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-3.5 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <span className="font-black text-slate-900 text-xs block">
                        Aktifkan Seluruh Notifikasi HP
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Master switch untuk mengaktifkan atau menonaktifkan semua notifikasi
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.enabled}
                        onChange={(e) => handleUpdateNotificationSetting('enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {/* Feature 1: Pengingat Laporan Harian */}
                  <div className="flex items-start justify-between gap-3 pt-1">
                    <div className="space-y-1">
                      <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                        Pengingat Laporan Harian (Daily Report)
                      </span>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Kirimkan rangkuman total pesanan, omset, dan laba bersih hari ini secara otomatis ke HP.
                      </p>
                      
                      {notificationSettings.dailyReportReminder && (
                        <div className="flex items-center gap-2 pt-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-600">Jam Notifikasi:</span>
                          <input
                            type="time"
                            value={notificationSettings.dailyReminderTime || '20:00'}
                            onChange={(e) => handleUpdateNotificationSetting('dailyReminderTime', e.target.value)}
                            className="px-2 py-0.5 text-[11px] font-bold bg-slate-50 border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-400 font-medium">WIB</span>
                        </div>
                      )}
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        disabled={!notificationSettings.enabled}
                        checked={notificationSettings.dailyReportReminder}
                        onChange={(e) => handleUpdateNotificationSetting('dailyReportReminder', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-40"></div>
                    </label>
                  </div>

                  {/* Feature 2: Pengingat Catatan / Notes Belum Selesai */}
                  <div className="flex items-start justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-500" />
                        Pengingat Catatan / Notes Follow Up
                      </span>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Kirim notifikasi pengingat jika masih ada catatan follow up dapur yang berstatus pending.
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        disabled={!notificationSettings.enabled}
                        checked={notificationSettings.pendingNotesReminder}
                        onChange={(e) => handleUpdateNotificationSetting('pendingNotesReminder', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-40"></div>
                    </label>
                  </div>

                  {/* Feature 3: Notifikasi Pesanan Masuk */}
                  <div className="flex items-start justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        Notifikasi Pesanan Masuk (Real-time Alert)
                      </span>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Tampilkan notifikasi pop-up seketika saat pesanan baru berhasil dicatat lewat suara / tombol.
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        disabled={!notificationSettings.enabled}
                        checked={notificationSettings.newOrderAlert}
                        onChange={(e) => handleUpdateNotificationSetting('newOrderAlert', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-40"></div>
                    </label>
                  </div>
                </div>

                {/* 3. Test Notification Action */}
                <div className="bg-indigo-50/70 border border-indigo-200/80 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <span className="font-black text-xs text-indigo-950 block">
                      Tes Notifikasi Langsung di HP Anda
                    </span>
                    <span className="text-[10px] text-indigo-700 font-medium">
                      Kirim pesan uji coba sekarang untuk memastikan notifikasi muncul di bar HP.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendTestNotification}
                    className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>{testNotificationSent ? 'Terkirim ✓' : 'Kirim Tes Notifikasi'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* SUB-TAB 6: INSTALL APK / PWA */}
            {activeTab === 'install' && (
              <div className="space-y-6 text-center py-6 max-w-sm mx-auto">
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center shadow-xl shadow-indigo-500/25">
                    <Receipt className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      Rekap Dapur
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Tambahkan ke Layar Utama HP untuk pengalaman seperti aplikasi native.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-left space-y-2 text-xs">
                  <span className="font-black text-slate-800 block">Cara Pasang di HP (Android / iOS):</span>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 font-medium text-[11px]">
                    <li>Buka menu browser (titik 3 di Chrome atau tombol Bagikan di Safari).</li>
                    <li>Pilih <strong>"Tambahkan ke Layar Utama" (Add to Home Screen)</strong> atau <strong>"Install Aplikasi"</strong>.</li>
                    <li>Aplikasi akan langsung muncul di menu HP Anda!</li>
                  </ol>
                </div>
              </div>
            )}

            {/* SUB-TAB 7: DANGER ZONE */}
            {activeTab === 'danger' && (
              <div className="bg-rose-50/80 p-5 rounded-2xl border border-rose-200 space-y-3">
                <div className="flex items-center gap-2 text-rose-800 font-black text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>Danger Zone: Hapus Semua Data Pesanan Lokal</span>
                </div>
                <p className="text-xs text-rose-700 leading-relaxed font-medium">
                  Fitur ini akan membersihkan data pesanan yang tersimpan di perangkat ini. Gunakan hanya jika Anda ingin mereset aplikasi.
                </p>
                <button
                  type="button"
                  onClick={handleDeleteAllDataConfirm}
                  className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs rounded-2xl transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>HAPUS SELURUH DATA PESANAN LOKAL</span>
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
