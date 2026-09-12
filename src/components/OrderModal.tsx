import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Plus, 
  Utensils, 
  Store, 
  Truck, 
  Calendar, 
  Trash2,
  Mic,
  AlertCircle,
  Clock,
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  OrderItem, 
  Kitchen, 
  Store as StoreType, 
  MasterToko, 
  MasterPemasok, 
  MasterDapur,
  PaymentStatus,
  DeliveryStatus
} from '../types';
import { getTodayWIB } from '../lib/formatters';
import { getItemSuggestions } from '../lib/suggestions';
import { parseVoiceInput } from '../lib/voiceParser';
import { guessStoreForItem } from '../lib/storeMatcher';
import { 
  saveMasterTokoToDb, 
  saveMasterPemasokToDb, 
  saveMasterDapurToDb 
} from '../lib/supabaseDb';
import { MoneyInput, formatIDR } from './MoneyInput';
import { ProfitPreview } from './ProfitPreview';
import { OrderSummary } from './OrderSummary';
import { StatusSegment } from './StatusSegment';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    orderData: Omit<OrderItem, 'id' | 'createdAt'> | Array<Omit<OrderItem, 'id' | 'createdAt'>>,
    editId?: string
  ) => void;
  initialData?: OrderItem | null;
  prefilledKitchen?: string;
  kitchens: Kitchen[];
  stores: StoreType[];
  pemasokList: string[];
  masterToko?: MasterToko[];
  masterPemasok?: MasterPemasok[];
  masterDapur?: MasterDapur[];
  onRefreshMaster?: () => Promise<void>;
  selectedDate: string;
  existingOrders?: OrderItem[];
}

interface ItemRow {
  id: string;
  namaBarang: string;
  qty: number;
  satuan: string;
  hargaBeli: number;
  hargaJual: number;
}

const COMMON_UNITS = ['Kg', 'Gram', 'Pcs', 'Ikat', 'Tray', 'Pack', 'Liter', 'Box', 'Karung', 'Ekor'];

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  prefilledKitchen,
  kitchens = [],
  stores = [],
  pemasokList = [],
  masterToko = [],
  masterPemasok = [],
  masterDapur = [],
  onRefreshMaster,
  selectedDate,
  existingOrders = [],
}) => {
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState<number>(0);
  const [toko, setToko] = useState('');
  const [tujuanDapur, setTujuanDapur] = useState('');
  const [pemasok, setPemasok] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('UNPAID');
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('PENDING');
  const [tanggal, setTanggal] = useState(selectedDate || getTodayWIB());
  const [catatan, setCatatan] = useState('');

  // Quick Add Master State
  const [quickAddType, setQuickAddType] = useState<'toko' | 'pemasok' | 'dapur' | null>(null);
  const [quickAddNama, setQuickAddNama] = useState('');
  const [quickAddAlamat, setQuickAddAlamat] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);

  // Suggestion engine states
  const [activeSuggestionRowId, setActiveSuggestionRowId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSugIdx, setSelectedSugIdx] = useState<number>(0);

  // Voice Recognition States
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Computed master lists
  const availableStores = masterToko.length > 0 ? masterToko.map((t) => t.nama) : stores.map((s) => s.nama);
  const availableKitchens = masterDapur.length > 0 ? masterDapur.map((d) => d.nama) : kitchens.map((k) => k.nama);
  const availablePemasok = masterPemasok.length > 0 ? masterPemasok.map((p) => p.nama) : pemasokList;

  // Initialize or reset form state
  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setItemRows([
        {
          id: initialData.id || '1',
          namaBarang: initialData.namaBarang,
          qty: initialData.qty || 1,
          satuan: initialData.satuan || 'Kg',
          hargaBeli: Math.round(initialData.hargaBeli || 0),
          hargaJual: Math.round(initialData.hargaJual || 0),
        },
      ]);
      setActiveItemIndex(0);
      setToko(initialData.toko || '');
      setTujuanDapur(initialData.tujuanDapur || '');
      setPemasok(initialData.pemasok || '');
      setPaymentStatus(initialData.paymentStatus || (initialData.status === 'selesai' ? 'PAID' : 'UNPAID'));
      setDeliveryStatus(initialData.deliveryStatus || (initialData.status === 'selesai' ? 'DONE' : 'PENDING'));
      setTanggal(initialData.tanggal || selectedDate || getTodayWIB());
      setCatatan(initialData.catatan || '');
    } else {
      setItemRows([
        {
          id: `item-${Date.now()}`,
          namaBarang: '',
          qty: 1,
          satuan: 'Kg',
          hargaBeli: 0,
          hargaJual: 0,
        },
      ]);
      setActiveItemIndex(0);
      setToko('');
      setTujuanDapur(prefilledKitchen || '');
      setPemasok('');
      setPaymentStatus('UNPAID');
      setDeliveryStatus('PENDING');
      setTanggal(selectedDate || getTodayWIB());
      setCatatan('');
    }

    setVoiceNotice(null);
    setVoiceError(null);
    setIsListening(false);

    return () => {
      stopVoiceRecognition();
    };
  }, [initialData, prefilledKitchen, isOpen, selectedDate]);

  // Voice recognition cleanup
  const stopVoiceRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const toggleVoice = () => {
    if (isListening) {
      stopVoiceRecognition();
      return;
    }

    stopVoiceRecognition();
    setVoiceError(null);
    setVoiceNotice(null);

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError('Browser tidak mendukung Speech Recognition.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          handleProcessVoiceInput(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setVoiceError('Izin mikrofon ditolak.');
        } else if (event.error !== 'no-speech') {
          setVoiceError(`Error mic: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setVoiceError('Gagal mengakses mikrofon.');
      setIsListening(false);
    }
  };

  const handleProcessVoiceInput = (transcriptText: string) => {
    const parsed = parseVoiceInput(transcriptText, kitchens, stores, pemasokList);

    if (parsed.namaBarang) {
      const pastMatch = existingOrders.find(
        (o) => o.namaBarang.toLowerCase() === parsed.namaBarang.toLowerCase() && (o.hargaBeli > 0 || o.hargaJual > 0)
      );

      const autoBeli = parsed.hargaBeli || pastMatch?.hargaBeli || 0;
      const autoJual = parsed.hargaJual || pastMatch?.hargaJual || 0;

      setItemRows((prev) => {
        const active = prev[activeItemIndex] || prev[0];
        const updated: ItemRow = {
          ...active,
          namaBarang: parsed.namaBarang,
          qty: parsed.qty || active.qty || 1,
          satuan: parsed.satuan || active.satuan || 'Kg',
          hargaBeli: autoBeli > 0 ? autoBeli : active.hargaBeli,
          hargaJual: autoJual > 0 ? autoJual : active.hargaJual,
        };

        const copy = [...prev];
        copy[activeItemIndex] = updated;
        return copy;
      });
    }

    if (parsed.tujuanDapur) setTujuanDapur(parsed.tujuanDapur);
    if (parsed.toko) {
      setToko(parsed.toko);
    } else if (parsed.namaBarang) {
      const autoStore = guessStoreForItem(parsed.namaBarang, availableStores);
      if (autoStore) setToko(autoStore);
    }
    if (parsed.pemasok) setPemasok(parsed.pemasok);

    setVoiceNotice(`✓ Terdeteksi: ${parsed.namaBarang || 'Pesanan'} (${parsed.qty || 1} ${parsed.satuan || 'Kg'})`);
    setTimeout(() => setVoiceNotice(null), 4000);
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNama = quickAddNama.trim();
    if (!cleanNama) {
      setQuickAddError('Nama tidak boleh kosong');
      return;
    }

    setQuickAddLoading(true);
    setQuickAddError(null);
    try {
      if (quickAddType === 'toko') {
        const res = await saveMasterTokoToDb(cleanNama);
        if (!res.success) throw new Error(res.error || 'Gagal menyimpan toko');
        setToko(cleanNama);
      } else if (quickAddType === 'pemasok') {
        const res = await saveMasterPemasokToDb(cleanNama);
        if (!res.success) throw new Error(res.error || 'Gagal menyimpan pemasok');
        setPemasok(cleanNama);
      } else if (quickAddType === 'dapur') {
        const res = await saveMasterDapurToDb(cleanNama, quickAddAlamat.trim());
        if (!res.success) throw new Error(res.error || 'Gagal menyimpan dapur');
        setTujuanDapur(cleanNama);
      }

      await onRefreshMaster?.();
      setQuickAddType(null);
      setQuickAddNama('');
      setQuickAddAlamat('');
    } catch (err: any) {
      setQuickAddError(err?.message || 'Gagal menambahkan');
    } finally {
      setQuickAddLoading(false);
    }
  };

  const currentItem = itemRows[activeItemIndex] || itemRows[0] || {
    id: 'default',
    namaBarang: '',
    qty: 1,
    satuan: 'Kg',
    hargaBeli: 0,
    hargaJual: 0,
  };

  const updateCurrentItem = (field: keyof ItemRow, value: any) => {
    setItemRows((prev) => {
      const copy = [...prev];
      const targetIdx = activeItemIndex < copy.length ? activeItemIndex : 0;
      copy[targetIdx] = {
        ...copy[targetIdx],
        [field]: value,
      };
      return copy;
    });
  };

  const addItemRow = () => {
    const newItem: ItemRow = {
      id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      namaBarang: '',
      qty: 1,
      satuan: 'Kg',
      hargaBeli: 0,
      hargaJual: 0,
    };
    setItemRows((prev) => [...prev, newItem]);
    setActiveItemIndex(itemRows.length);
  };

  const removeItemRow = (index: number) => {
    if (itemRows.length <= 1) return;
    setItemRows((prev) => prev.filter((_, idx) => idx !== index));
    if (activeItemIndex >= index && activeItemIndex > 0) {
      setActiveItemIndex(activeItemIndex - 1);
    }
  };

  // Suggestion handling when typing Nama Barang
  const handleItemNameChange = (val: string) => {
    updateCurrentItem('namaBarang', val);

    // Auto-select toko jika cocok
    const autoStore = guessStoreForItem(val, availableStores);
    if (autoStore && !toko) {
      setToko(autoStore);
    }

    if (val.trim().length >= 1) {
      const existingNames = Array.from(new Set(existingOrders.map((o) => o.namaBarang)));
      const results = getItemSuggestions(val, existingNames, 5);
      setSuggestions(results);
      setSelectedSugIdx(0);
      setActiveSuggestionRowId(currentItem.id);
    } else {
      setSuggestions([]);
      setActiveSuggestionRowId(null);
    }
  };

  const handleItemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (activeSuggestionRowId === currentItem.id && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSugIdx((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSugIdx((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const chosen = suggestions[selectedSugIdx];
        if (chosen) {
          selectSuggestion(chosen);
        }
      } else if (e.key === 'Escape') {
        setActiveSuggestionRowId(null);
      }
    }
  };

  const selectSuggestion = (itemText: string) => {
    updateCurrentItem('namaBarang', itemText);

    const autoStore = guessStoreForItem(itemText, availableStores);
    if (autoStore) {
      setToko(autoStore);
    }

    const match = existingOrders.find(
      (o) => o.namaBarang.toLowerCase() === itemText.toLowerCase() && (o.hargaBeli > 0 || o.hargaJual > 0)
    );
    if (match) {
      updateCurrentItem('hargaBeli', match.hargaBeli || 0);
      updateCurrentItem('hargaJual', match.hargaJual || 0);
    }

    setActiveSuggestionRowId(null);
  };

  // Grand totals across all items
  const totalModalSemua = itemRows.reduce(
    (sum, r) => sum + (Number(r.qty) || 0) * (Number(r.hargaBeli) || 0),
    0
  );
  const totalPenjualanSemua = itemRows.reduce(
    (sum, r) => sum + (Number(r.qty) || 0) * (Number(r.hargaJual) || 0),
    0
  );

  // Form validity check
  const isFormValid =
    tanggal.trim() !== '' &&
    toko.trim() !== '' &&
    tujuanDapur.trim() !== '' &&
    pemasok.trim() !== '' &&
    itemRows.length > 0 &&
    itemRows.every(
      (r) =>
        r.namaBarang.trim() !== '' &&
        Number(r.qty) > 0 &&
        Number(r.hargaBeli) >= 0 &&
        Number(r.hargaJual) >= 0
    );

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!toko.trim()) {
      alert('Mohon pilih Toko terlebih dahulu.');
      return;
    }
    if (!tujuanDapur.trim()) {
      alert('Mohon pilih Dapur terlebih dahulu.');
      return;
    }
    if (!pemasok.trim()) {
      alert('Mohon pilih Pemasok terlebih dahulu.');
      return;
    }

    if (!isFormValid) {
      alert('Mohon lengkapi semua data barang (Nama Barang, Jumlah, Harga Beli, Harga Jual).');
      return;
    }

    const calculatedStatus =
      deliveryStatus === 'DONE' && paymentStatus === 'PAID' ? 'selesai' : 'pending';

    if (initialData) {
      const firstRow = itemRows[0];
      onSave(
        {
          namaBarang: firstRow.namaBarang.trim(),
          qty: Number(firstRow.qty) || 1,
          satuan: firstRow.satuan || 'Kg',
          hargaBeli: Math.max(0, Number(firstRow.hargaBeli) || 0),
          hargaJual: Math.max(0, Number(firstRow.hargaJual) || 0),
          toko,
          tujuanDapur,
          pemasok,
          status: calculatedStatus,
          paymentStatus,
          deliveryStatus,
          tanggal,
          catatan: catatan.trim(),
        },
        initialData.id
      );
    } else {
      const payload = itemRows.map((row) => ({
        namaBarang: row.namaBarang.trim(),
        qty: Number(row.qty) || 1,
        satuan: row.satuan || 'Kg',
        hargaBeli: Math.max(0, Number(row.hargaBeli) || 0),
        hargaJual: Math.max(0, Number(row.hargaJual) || 0),
        toko,
        tujuanDapur,
        pemasok,
        status: calculatedStatus,
        paymentStatus,
        deliveryStatus,
        tanggal,
        catatan: catatan.trim(),
      }));
      onSave(payload);
    }

    onClose();
  };

  const isSuggestionOpen =
    activeSuggestionRowId === currentItem.id && suggestions.length > 0;

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs no-print font-sans">
          {/* Backdrop click to dismiss */}
          <div className="absolute inset-0" onClick={onClose} />

          {/* Bottom Sheet Modal Container (Responsive Centered on Tablet/Desktop) */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full max-w-lg sm:max-w-xl md:max-w-2xl tablet-landscape-modal bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 overflow-hidden z-10 max-h-[92vh] sm:max-h-[88vh] flex flex-col"
          >
            {/* Pull Tab Bar / Handle */}
            <div className="w-full pt-3 pb-1 flex justify-center items-center cursor-grab bg-slate-50 border-b border-slate-100">
              <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
            </div>

            {/* Header Modal (100% Persis Style Existing) */}
            <div className="px-5 py-3.5 bg-slate-50 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                  <Utensils className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 leading-tight">
                    {initialData ? 'Edit Pesanan' : 'Input Pesanan Baru'}
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Masukkan detail pesanan dapur
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                id="close-order-modal-btn"
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Content */}
            <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* Voice Feedback Banner if listening */}
              {(isListening || voiceNotice || voiceError) && (
                <div className="text-center py-1">
                  {isListening ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[11px] font-bold animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping inline-block" />
                      <span>Mendengarkan ucapan suara...</span>
                    </div>
                  ) : voiceNotice ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10.5px] font-bold">
                      <span>{voiceNotice}</span>
                    </div>
                  ) : voiceError ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[10.5px] font-bold">
                      <AlertCircle className="w-3 h-3" />
                      <span>{voiceError}</span>
                    </div>
                  ) : null}
                </div>
              )}

              {/* CARD 1: DETAIL PESANAN (Tetap Card Pertama, Rapih & Estimasi Margin) */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                    DETAIL PESANAN
                  </span>
                  {itemRows.length > 1 && (
                    <span className="text-[10.5px] font-bold text-indigo-600">
                      Item #{activeItemIndex + 1} dari {itemRows.length}
                    </span>
                  )}
                </div>

                {/* Multi item switch pills if > 1 */}
                {itemRows.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                    {itemRows.map((row, idx) => {
                      const isActive = idx === activeItemIndex;
                      return (
                        <div
                          key={row.id}
                          onClick={() => setActiveItemIndex(idx)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs cursor-pointer transition-all shrink-0 ${
                            isActive
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span>#{idx + 1} {row.namaBarang || 'Tanpa Nama'}</span>
                          {!initialData && itemRows.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeItemRow(idx);
                              }}
                              className="p-0.5 rounded hover:bg-black/10 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Field 1: Nama Barang */}
                <div className="relative">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nama Barang
                  </label>
                  <input
                    type="text"
                    required
                    id="input-nama-barang"
                    placeholder="Contoh: Cabe Merah, Ayam Broiler"
                    value={currentItem.namaBarang}
                    onChange={(e) => handleItemNameChange(e.target.value)}
                    onKeyDown={handleItemKeyDown}
                    onFocus={() => {
                      if (currentItem.namaBarang.trim().length >= 1) {
                        const existingNames = Array.from(new Set(existingOrders.map((o) => o.namaBarang)));
                        const results = getItemSuggestions(currentItem.namaBarang, existingNames, 5);
                        setSuggestions(results);
                        setActiveSuggestionRowId(currentItem.id);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                  />

                  {/* Autocomplete Popup */}
                  {isSuggestionOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden py-1 divide-y divide-slate-100">
                      <div className="px-3 py-1 text-[9px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 flex items-center justify-between">
                        <span>Saran Otomatis (Enter / Klik)</span>
                        <span className="font-mono text-[8px] bg-slate-200 text-slate-700 px-1 rounded">↵ Enter</span>
                      </div>
                      {suggestions.map((sug, idx) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => selectSuggestion(sug)}
                          onMouseEnter={() => setSelectedSugIdx(idx)}
                          className={`w-full px-3 py-1.5 text-left text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                            idx === selectedSugIdx
                              ? 'bg-indigo-50 text-indigo-800'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>{sug}</span>
                          <span className="text-[10px] text-slate-400 font-normal">Pilih</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Field 2: Qty & Satuan */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Qty
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      id="input-qty-barang"
                      placeholder="1"
                      value={currentItem.qty === 0 ? '' : currentItem.qty}
                      onChange={(e) =>
                        updateCurrentItem(
                          'qty',
                          e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all text-center"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Satuan
                    </label>
                    <select
                      id="select-satuan-barang"
                      value={currentItem.satuan || 'Kg'}
                      onChange={(e) => updateCurrentItem('satuan', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
                    >
                      {COMMON_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Field 3: Harga Beli & Harga Jual */}
                <div className="grid grid-cols-2 gap-3">
                  <MoneyInput
                    label="Harga Beli"
                    required
                    id="input-harga-beli"
                    value={currentItem.hargaBeli}
                    onChange={(val) => updateCurrentItem('hargaBeli', val)}
                  />
                  <MoneyInput
                    label="Harga Jual"
                    required
                    id="input-harga-jual"
                    value={currentItem.hargaJual}
                    onChange={(val) => updateCurrentItem('hargaJual', val)}
                  />
                </div>

                {/* Estimasi Margin di bawah Harga dalam card yang sama */}
                <ProfitPreview
                  quantity={currentItem.qty}
                  purchasePrice={currentItem.hargaBeli}
                  sellingPrice={currentItem.hargaJual}
                />
              </div>

              {/* Tambah Item Barang Lainnya (Dashed border button & list preview) */}
              {!initialData && (
                <div className="space-y-2">
                  <button
                    type="button"
                    id="btn-tambah-item-barang"
                    onClick={addItemRow}
                    className="w-full py-2.5 px-4 bg-white hover:bg-indigo-50/60 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 rounded-2xl border-2 border-dashed border-slate-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>＋ Tambah Item Barang</span>
                  </button>

                  {/* Multi item list preview when > 1 */}
                  {itemRows.length > 1 && (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                        Daftar Barang ({itemRows.length} Item):
                      </div>
                      <div className="divide-y divide-slate-100">
                        {itemRows.map((r, idx) => (
                          <div
                            key={r.id}
                            onClick={() => setActiveItemIndex(idx)}
                            className={`py-1.5 px-2 rounded-lg flex items-center justify-between text-xs cursor-pointer ${
                              idx === activeItemIndex ? 'bg-indigo-50 font-bold text-indigo-900' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div>
                              <span className="font-semibold block">
                                #{idx + 1} {r.namaBarang || 'Tanpa Nama'}
                              </span>
                              <span className="text-[10.5px] text-slate-500 font-normal">
                                {r.qty} {r.satuan || 'Kg'}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold block text-slate-900">
                                {formatIDR((r.qty || 0) * (r.hargaJual || 0))}
                              </span>
                              <span className="text-[9.5px] text-slate-400 font-mono">
                                Beli: {formatIDR((r.qty || 0) * (r.hargaBeli || 0))}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CARD 2: TUJUAN PESANAN (Konteks Pesanan: Toko, Pemasok, Dapur) */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-slate-600" />
                  <span>TUJUAN PESANAN</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Toko */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Toko
                    </label>
                    <select
                      required
                      id="select-order-toko"
                      value={toko}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW__') {
                          setQuickAddType('toko');
                          setQuickAddNama('');
                          setQuickAddAlamat('');
                          setQuickAddError(null);
                        } else {
                          setToko(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
                    >
                      <option value="">-- Pilih Toko --</option>
                      <option value="__ADD_NEW__" className="text-indigo-600 font-bold bg-indigo-50">
                        + Tambah Toko Baru...
                      </option>
                      {availableStores.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Pemasok */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Pemasok
                    </label>
                    <select
                      required
                      id="select-order-pemasok"
                      value={pemasok}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW__') {
                          setQuickAddType('pemasok');
                          setQuickAddNama('');
                          setQuickAddAlamat('');
                          setQuickAddError(null);
                        } else {
                          setPemasok(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
                    >
                      <option value="">-- Pilih Pemasok --</option>
                      <option value="__ADD_NEW__" className="text-indigo-600 font-bold bg-indigo-50">
                        + Tambah Pemasok Baru...
                      </option>
                      {availablePemasok.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dapur (Full Width pada Desktop) */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Dapur
                    </label>
                    <select
                      required
                      id="select-order-dapur"
                      value={tujuanDapur}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW__') {
                          setQuickAddType('dapur');
                          setQuickAddNama('');
                          setQuickAddAlamat('');
                          setQuickAddError(null);
                        } else {
                          setTujuanDapur(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
                    >
                      <option value="">-- Pilih Dapur --</option>
                      <option value="__ADD_NEW__" className="text-indigo-600 font-bold bg-indigo-50">
                        + Tambah Dapur Baru...
                      </option>
                      {availableKitchens.map((k) => (
                        <option key={k} value={k}>
                          Dapur {k}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* CARD 3: STATUS TRANSAKSI (Tetap Segmented Control Existing) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StatusSegment<PaymentStatus>
                  label="STATUS PEMBAYARAN"
                  value={paymentStatus}
                  onChange={setPaymentStatus}
                  idPrefix="status-pembayaran"
                  options={[
                    { value: 'UNPAID', label: 'UNPAID', activeColor: 'bg-rose-600 text-white' },
                    { value: 'PAID', label: 'PAID', activeColor: 'bg-emerald-600 text-white' },
                  ]}
                />

                <StatusSegment<DeliveryStatus>
                  label="STATUS PENGIRIMAN"
                  value={deliveryStatus}
                  onChange={setDeliveryStatus}
                  idPrefix="status-pengiriman"
                  options={[
                    { value: 'PENDING', label: 'PENDING', activeColor: 'bg-amber-600 text-white' },
                    { value: 'DONE', label: 'DONE', activeColor: 'bg-emerald-600 text-white' },
                  ]}
                />
              </div>

              {/* CARD 4: TOTAL SUMMARY (Total Penjualan, Total Beli, Estimasi Profit) */}
              <OrderSummary
                totalPenjualan={totalPenjualanSemua}
                totalBeli={totalModalSemua}
              />

              {/* Tanggal & Catatan Opsional */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    required
                    id="input-tanggal-order"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Catatan (Opsional)
                  </label>
                  <input
                    type="text"
                    id="input-catatan-order"
                    placeholder="Catatan tambahan..."
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                  />
                </div>
              </div>
            </form>

            {/* BOTTOM ACTION BAR (100% PERSIS EXISTING: Batal | 🎙 | Simpan Pesanan) */}
            <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center gap-2">
              {/* Tombol Batal */}
              <button
                type="button"
                onClick={onClose}
                id="btn-batal-order"
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer text-center"
              >
                Batal
              </button>

              {/* Tombol Microphone Bundar di Tengah */}
              <div className="relative">
                {isListening && (
                  <span className="absolute -inset-1 rounded-full bg-rose-500/30 animate-ping pointer-events-none" />
                )}
                <button
                  type="button"
                  id="btn-voice-order"
                  onClick={toggleVoice}
                  title={isListening ? 'Klik untuk berhenti bicara' : 'Bicara sekarang (contoh: Ayam 4 kg)'}
                  className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer shadow-md ${
                    isListening
                      ? 'bg-rose-600 text-white shadow-rose-500/40 ring-4 ring-rose-200 scale-105'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/30 hover:scale-105 active:scale-95'
                  }`}
                >
                  <Mic className="w-5 h-5" />
                </button>
              </div>

              {/* Tombol Simpan Pesanan */}
              <button
                type="button"
                id="btn-simpan-pesanan"
                disabled={!isFormValid}
                onClick={() => handleSubmit()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-900 hover:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black shadow-md shadow-indigo-900/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>{initialData ? 'Simpan Perubahan' : 'Simpan Pesanan'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Quick Add Master Modal */}
      {quickAddType && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    + Tambah {quickAddType === 'toko' ? 'Toko Baru' : quickAddType === 'pemasok' ? 'Pemasok Baru' : 'Dapur Baru'}
                  </h3>
                  <span className="text-[10.5px] text-slate-400 font-medium block">
                    Tersimpan ke database &amp; langsung terpilih
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickAddType(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nama {quickAddType === 'toko' ? 'Toko' : quickAddType === 'pemasok' ? 'Pemasok' : 'Dapur'}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={`Contoh: ${quickAddType === 'toko' ? 'HTG / Luweng Boga' : quickAddType === 'pemasok' ? 'UD Barokah' : 'Siliragung'}`}
                  value={quickAddNama}
                  onChange={(e) => setQuickAddNama(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              {quickAddType === 'dapur' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Alamat / Lokasi (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Jl. Raya Rogojampi No. 12"
                    value={quickAddAlamat}
                    onChange={(e) => setQuickAddAlamat(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              )}

              {quickAddError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 font-bold">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{quickAddError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickAddType(null)}
                  className="flex-1 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={quickAddLoading || !quickAddNama.trim()}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                >
                  <span>{quickAddLoading ? 'Menyimpan...' : 'Simpan & Pilih'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
