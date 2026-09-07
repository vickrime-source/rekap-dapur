import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Save, 
  Plus, 
  Utensils, 
  Store, 
  Truck, 
  Calendar, 
  Trash2,
  Mic,
  AlertCircle
} from 'lucide-react';
import { OrderItem, Kitchen, Store as StoreType } from '../types';
import { formatRupiah, formatRupiahInput, parseRupiahInput, getTodayWIB } from '../lib/formatters';
import { getItemSuggestions } from '../lib/suggestions';
import { parseVoiceInput } from '../lib/voiceParser';
import { motion, AnimatePresence } from 'motion/react';

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
  selectedDate: string;
  existingOrders?: OrderItem[];
}

interface ItemRow {
  id: string;
  namaBarang: string;
  qty: number | '';
  hargaBeli: number | '';
  hargaJual: number | '';
}

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  prefilledKitchen,
  kitchens,
  stores,
  pemasokList,
  selectedDate,
  existingOrders = [],
}) => {
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [toko, setToko] = useState('');
  const [tujuanDapur, setTujuanDapur] = useState('');
  const [pemasok, setPemasok] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'UNPAID'>('UNPAID');
  const [deliveryStatus, setDeliveryStatus] = useState<'DONE' | 'PENDING'>('PENDING');
  const [tanggal, setTanggal] = useState(selectedDate);
  const [catatan, setCatatan] = useState('');

  // Suggestion engine states
  const [activeSuggestionRowId, setActiveSuggestionRowId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSugIdx, setSelectedSugIdx] = useState<number>(0);

  // Voice Recognition States
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (initialData) {
      setItemRows([
        {
          id: '1',
          namaBarang: initialData.namaBarang,
          qty: initialData.qty,
          hargaBeli: initialData.hargaBeli,
          hargaJual: initialData.hargaJual,
        },
      ]);
      setToko(initialData.toko || '');
      setTujuanDapur(initialData.tujuanDapur || '');
      setPemasok(initialData.pemasok || '');
      setPaymentStatus(initialData.paymentStatus || (initialData.status === 'selesai' ? 'PAID' : 'UNPAID'));
      setDeliveryStatus(initialData.deliveryStatus || (initialData.status === 'selesai' ? 'DONE' : 'PENDING'));
      setTanggal(initialData.tanggal);
      setCatatan(initialData.catatan || '');
    } else {
      // REQUIREMENT 1: Dropdown toko, dapur, pemasok default SEMUA KOSONG
      setItemRows([
        {
          id: Date.now().toString(),
          namaBarang: '',
          qty: 1,
          hargaBeli: '',
          hargaJual: '',
        },
      ]);
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
  }, [initialData, prefilledKitchen, isOpen, kitchens, stores, pemasokList, selectedDate]);

  // Clean up speech recognition
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

  // Toggle voice recognition
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
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          handleProcessVoiceInput(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech error:', event.error);
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
      console.warn('Failed to start speech:', err);
      setVoiceError('Gagal mengakses mikrofon.');
      setIsListening(false);
    }
  };

  // Process voice input and fill fields automatically
  const handleProcessVoiceInput = (transcriptText: string) => {
    const parsed = parseVoiceInput(transcriptText, kitchens, stores, pemasokList);

    // 1. Fill Item Row
    if (parsed.namaBarang) {
      // Look up past pricing for this item
      const pastMatch = existingOrders.find(
        (o) => o.namaBarang.toLowerCase() === parsed.namaBarang.toLowerCase() && (o.hargaBeli > 0 || o.hargaJual > 0)
      );

      const autoBeli = pastMatch?.hargaBeli ?? '';
      const autoJual = pastMatch?.hargaJual ?? '';

      setItemRows((prev) => {
        if (prev.length === 0) {
          return [
            {
              id: Date.now().toString(),
              namaBarang: parsed.namaBarang,
              qty: parsed.qty || 1,
              hargaBeli: autoBeli,
              hargaJual: autoJual,
            },
          ];
        }
        // Update first row if empty or replace
        const first = prev[0];
        const updatedFirst: ItemRow = {
          ...first,
          namaBarang: parsed.namaBarang,
          qty: parsed.qty || first.qty || 1,
          hargaBeli: first.hargaBeli || autoBeli,
          hargaJual: first.hargaJual || autoJual,
        };
        return [updatedFirst, ...prev.slice(1)];
      });
    }

    // 2. Set Dapur if detected
    if (parsed.tujuanDapur) {
      setTujuanDapur(parsed.tujuanDapur);
    }

    // 3. Set Toko if detected
    if (parsed.toko) {
      setToko(parsed.toko);
    }

    // 4. Set Pemasok if detected
    if (parsed.pemasok) {
      setPemasok(parsed.pemasok);
    }

    setVoiceNotice(`✓ Terdeteksi: ${parsed.namaBarang} (${parsed.qty} ${parsed.satuan})`);
    setTimeout(() => setVoiceNotice(null), 4000);
  };

  if (!isOpen) return null;

  const addItemRow = () => {
    setItemRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        namaBarang: '',
        qty: 1,
        hargaBeli: '',
        hargaJual: '',
      },
    ]);
  };

  const removeItemRow = (id: string) => {
    if (itemRows.length <= 1) return;
    setItemRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateItemRow = (id: string, field: keyof ItemRow, value: any) => {
    setItemRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  // Suggestion handling when typing Nama Barang
  const handleItemNameChange = (rowId: string, val: string) => {
    updateItemRow(rowId, 'namaBarang', val);
    if (val.trim().length >= 1) {
      const existingNames = Array.from(new Set(existingOrders.map((o) => o.namaBarang)));
      const results = getItemSuggestions(val, existingNames, 6);
      setSuggestions(results);
      setSelectedSugIdx(0);
      setActiveSuggestionRowId(rowId);
    } else {
      setSuggestions([]);
      setActiveSuggestionRowId(null);
    }
  };

  // Keyboard navigation & Enter trigger for suggestions
  const handleItemKeyDown = (rowId: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (activeSuggestionRowId === rowId && suggestions.length > 0) {
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
          selectSuggestion(rowId, chosen);
        }
      } else if (e.key === 'Escape') {
        setActiveSuggestionRowId(null);
      }
    }
  };

  const selectSuggestion = (rowId: string, itemText: string) => {
    updateItemRow(rowId, 'namaBarang', itemText);

    // Auto-populate past prices if available
    const match = existingOrders.find(
      (o) => o.namaBarang.toLowerCase() === itemText.toLowerCase() && (o.hargaBeli > 0 || o.hargaJual > 0)
    );
    if (match) {
      updateItemRow(rowId, 'hargaBeli', match.hargaBeli || '');
      updateItemRow(rowId, 'hargaJual', match.hargaJual || '');
    }

    setActiveSuggestionRowId(null);
  };

  const isFormValid =
    tanggal.trim() !== '' &&
    toko.trim() !== '' &&
    tujuanDapur.trim() !== '' &&
    pemasok.trim() !== '' &&
    itemRows.length > 0 &&
    itemRows.every(
      (r) =>
        r.namaBarang.trim() !== '' &&
        r.qty !== '' &&
        Number(r.qty) > 0 &&
        r.hargaBeli !== '' &&
        Number(r.hargaBeli) >= 0 &&
        r.hargaJual !== '' &&
        Number(r.hargaJual) >= 0
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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
          hargaBeli: Number(firstRow.hargaBeli) || 0,
          hargaJual: Number(firstRow.hargaJual) || 0,
          toko,
          tujuanDapur,
          pemasok,
          status: calculatedStatus,
          paymentStatus,
          deliveryStatus,
          tanggal,
          catatan,
        },
        initialData.id
      );
    } else {
      const payload = itemRows.map((row) => ({
        namaBarang: row.namaBarang.trim(),
        qty: Number(row.qty) || 1,
        hargaBeli: Number(row.hargaBeli) || 0,
        hargaJual: Number(row.hargaJual) || 0,
        toko,
        tujuanDapur,
        pemasok,
        status: calculatedStatus,
        paymentStatus,
        deliveryStatus,
        tanggal,
        catatan,
      }));
      onSave(payload);
    }

    onClose();
  };

  const grandTotalBeli = itemRows.reduce(
    (sum, r) => sum + (Number(r.qty) || 0) * (Number(r.hargaBeli) || 0),
    0
  );
  const grandTotalJual = itemRows.reduce(
    (sum, r) => sum + (Number(r.qty) || 0) * (Number(r.hargaJual) || 0),
    0
  );

  return (
    <AnimatePresence>
      {/* REQUIREMENT 2: BOTTOM SHEET BAR UI (Slide from bottom) */}
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-xs no-print">
        {/* Backdrop click to dismiss */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 overflow-hidden z-10 max-h-[92vh] flex flex-col font-sans"
        >
          {/* Bottom Sheet Pull Handle Bar */}
          <div className="w-full pt-3 pb-1 flex justify-center items-center cursor-grab bg-slate-50 border-b border-slate-100">
            <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
          </div>

          {/* Header Bar */}
          <div className="px-5 py-3 bg-white flex items-center justify-between border-b border-slate-200">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                {initialData ? 'Edit Pesanan Dapur' : 'Input Pesanan Baru'}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 text-slate-800">
            
            {/* Grid Tanggal, Toko, Dapur, Pemasok */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 bg-slate-50/90 p-3 sm:p-3.5 rounded-2xl border border-slate-200/90">
              {/* Tanggal */}
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-indigo-600" />
                  <span>Tanggal</span>
                </label>
                <input
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Toko (REQUIREMENT 1: DEFAULT KOSONG) */}
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Store className="w-3 h-3 text-indigo-600" />
                  <span>Toko</span>
                </label>
                <select
                  required
                  value={toko}
                  onChange={(e) => setToko(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">-- Pilih Toko --</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.nama}>
                      {s.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dapur (REQUIREMENT 1: DEFAULT KOSONG) */}
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Utensils className="w-3 h-3 text-indigo-600" />
                  <span>Dapur</span>
                </label>
                <select
                  required
                  value={tujuanDapur}
                  onChange={(e) => setTujuanDapur(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">-- Pilih Dapur --</option>
                  {kitchens.map((k) => (
                    <option key={k.id} value={k.nama}>
                      Dapur {k.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pemasok (REQUIREMENT 1: DEFAULT KOSONG) */}
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Truck className="w-3 h-3 text-indigo-600" />
                  <span>Pemasok</span>
                </label>
                <select
                  required
                  value={pemasok}
                  onChange={(e) => setPemasok(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">-- Pilih Pemasok --</option>
                  {pemasokList.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* List of Items / Barang */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between pt-0.5">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Daftar Barang ({itemRows.length})
                </h3>
              </div>

              {itemRows.map((row, index) => {
                const isSuggestionOpen = activeSuggestionRowId === row.id && suggestions.length > 0;

                return (
                  <div
                    key={row.id}
                    className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/90 space-y-2.5 relative"
                  >
                    {/* Header item jika ada lebih dari 1 barang */}
                    {itemRows.length > 1 && (
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5">
                        <span className="text-xs font-black text-slate-700">
                          Barang #{index + 1}
                        </span>
                        {!initialData && (
                          <button
                            type="button"
                            onClick={() => removeItemRow(row.id)}
                            className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus Barang Ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Nama Barang dengan Suggestion Engine */}
                    <div className="relative">
                      <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Nama Barang
                      </label>
                      <input
                        type="text"
                        required
                        value={row.namaBarang}
                        onChange={(e) => handleItemNameChange(row.id, e.target.value)}
                        onKeyDown={(e) => handleItemKeyDown(row.id, e)}
                        onFocus={() => {
                          if (row.namaBarang.trim().length >= 1) {
                            const existingNames = Array.from(new Set(existingOrders.map((o) => o.namaBarang)));
                            const results = getItemSuggestions(row.namaBarang, existingNames, 6);
                            setSuggestions(results);
                            setActiveSuggestionRowId(row.id);
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
                      />

                      {/* Suggestion Dropdown */}
                      {isSuggestionOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden py-1 divide-y divide-slate-100">
                          <div className="px-2.5 py-1 text-[9px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 flex items-center justify-between">
                            <span>Saran Otomatis (Klik atau Enter)</span>
                            <span className="font-mono text-[8px] bg-slate-200 text-slate-700 px-1 rounded">↵ Enter</span>
                          </div>
                          {suggestions.map((sug, idx) => (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => selectSuggestion(row.id, sug)}
                              onMouseEnter={() => setSelectedSugIdx(idx)}
                              className={`w-full px-3 py-1.5 text-left text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                                idx === selectedSugIdx
                                  ? 'bg-indigo-50 text-indigo-800'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span>{sug}</span>
                              <span className="text-[9px] text-slate-400 font-normal">Pilih</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Qty, Harga Beli, Harga Jual */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Qty (Kg/Pcs)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          required
                          placeholder="1"
                          value={row.qty}
                          onChange={(e) =>
                            updateItemRow(
                              row.id,
                              'qty',
                              e.target.value === '' ? '' : parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 text-center focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Harga Beli (Rp)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="0"
                          value={formatRupiahInput(row.hargaBeli)}
                          onChange={(e) =>
                            updateItemRow(row.id, 'hargaBeli', parseRupiahInput(e.target.value))
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Harga Jual (Rp)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="0"
                          value={formatRupiahInput(row.hargaJual)}
                          onChange={(e) =>
                            updateItemRow(row.id, 'hargaJual', parseRupiahInput(e.target.value))
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Tambah Barang Lainnya (Hanya untuk order baru) */}
              {!initialData && (
                <button
                  type="button"
                  onClick={addItemRow}
                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-dashed border-slate-300 text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Barang Lainnya</span>
                </button>
              )}
            </div>

            {/* Status Pembayaran & Pengiriman */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50/80 p-3 rounded-2xl border border-slate-200/90">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Status Pembayaran
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('UNPAID')}
                    className={`py-1.5 px-3 text-xs rounded-xl border transition-all cursor-pointer text-center ${
                      paymentStatus === 'UNPAID'
                        ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    UNPAID
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('PAID')}
                    className={`py-1.5 px-3 text-xs rounded-xl border transition-all cursor-pointer text-center ${
                      paymentStatus === 'PAID'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    PAID
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Status Pengiriman
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDeliveryStatus('PENDING')}
                    className={`py-1.5 px-3 text-xs rounded-xl border transition-all cursor-pointer text-center ${
                      deliveryStatus === 'PENDING'
                        ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    PENDING
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryStatus('DONE')}
                    className={`py-1.5 px-3 text-xs rounded-xl border transition-all cursor-pointer text-center ${
                      deliveryStatus === 'DONE'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    DONE
                  </button>
                </div>
              </div>
            </div>

            {/* Total Summary */}
            <div className="bg-slate-50 border border-slate-200/90 p-3 rounded-2xl flex items-center justify-between text-xs">
              <div>
                <span className="text-[10.5px] text-slate-500 font-semibold block">Total Penjualan</span>
                <span className="font-black text-slate-900 text-sm font-mono">
                  {formatRupiah(grandTotalJual)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10.5px] text-slate-500 font-semibold block">Total Beli</span>
                <span className="font-bold text-slate-700 text-xs font-mono">
                  {formatRupiah(grandTotalBeli)}
                </span>
              </div>
            </div>

            {/* Subtle Voice Feedback if active or error (clean, no extra clutter) */}
            {(isListening || voiceNotice || voiceError) && (
              <div className="text-center py-0.5">
                {isListening ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[11px] font-bold animate-pulse border border-rose-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping inline-block" />
                    Mendengarkan suara...
                  </span>
                ) : voiceNotice ? (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {voiceNotice}
                  </span>
                ) : voiceError ? (
                  <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 inline-flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {voiceError}
                  </span>
                ) : null}
              </div>
            )}

            {/* REQUIREMENT 2: Action Buttons (Batal | Small Circular Mic Button in Middle | Simpan) */}
            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
              {/* Batal Button */}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer text-center"
              >
                Batal
              </button>

              {/* Small Circular Mic Icon Button in the middle (No text, no clutter) */}
              <div className="relative shrink-0">
                {isListening && (
                  <span className="absolute -inset-1 rounded-full bg-rose-500/30 animate-ping pointer-events-none" />
                )}
                <button
                  type="button"
                  onClick={toggleVoice}
                  title={isListening ? 'Berhenti bicara' : 'Bicara pesanan (contoh: Ayam 4 kg)'}
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-md ${
                    isListening
                      ? 'bg-rose-600 text-white ring-4 ring-rose-200 scale-105 shadow-rose-500/40'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105 active:scale-95 shadow-indigo-500/30'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                </button>
              </div>

              {/* Simpan Pesanan Button */}
              <button
                type="submit"
                disabled={!isFormValid}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md ${
                  isFormValid
                    ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20 active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>{initialData ? 'Simpan Perubahan' : 'Simpan Pesanan'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
