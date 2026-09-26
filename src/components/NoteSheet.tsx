import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  CheckCircle, 
  Plus, 
  Utensils, 
  Tag, 
  FileText, 
  Sparkles, 
  Mic, 
  MicOff, 
  Scale, 
  Volume2, 
  Check, 
  AlertCircle,
  Store,
  Truck,
  Search,
  ChevronDown,
  Trash2
} from 'lucide-react';
import { Kitchen, NoteItem, FollowUpItemRow, Store as StoreType, MasterToko, MasterPemasok, MasterDapur, MasterSatuan } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { getItemSuggestions } from '../lib/suggestions';
import { parseVoiceInput } from '../lib/voiceParser';
import { guessStoreForItem } from '../lib/storeMatcher';
import { SatuanAutocomplete } from './SatuanAutocomplete';
import { PemasokAutocomplete } from './PemasokAutocomplete';
import { saveMasterSatuanToDb } from '../lib/supabaseDb';

interface NoteSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: Omit<NoteItem, 'id' | 'createdAt'>) => void;
  kitchens: Kitchen[];
  stores?: StoreType[];
  pemasokList?: string[];
  masterToko?: MasterToko[];
  masterPemasok?: MasterPemasok[];
  masterDapur?: MasterDapur[];
  masterSatuan?: MasterSatuan[];
  onAddMasterSatuan?: (nama: string) => Promise<{ success: boolean; error?: string }>;
  onRefreshMaster?: () => Promise<void> | void;
  existingItemNames?: string[];
  autoStartVoice?: boolean;
}

const COMMON_UNITS = ['Kg', 'Gram', 'Pcs', 'Ikat', 'Tray', 'Pack', 'Liter', 'Box', 'Karung', 'Ekor'];

export const NoteSheet: React.FC<NoteSheetProps> = ({
  isOpen,
  onClose,
  onSave,
  kitchens,
  stores = [],
  pemasokList = [],
  masterToko = [],
  masterPemasok = [],
  masterDapur = [],
  masterSatuan = [],
  onAddMasterSatuan,
  onRefreshMaster,
  existingItemNames = [],
  autoStartVoice = false,
}) => {
  const [tujuanDapur, setTujuanDapur] = useState<string>('');
  const [toko, setToko] = useState<string>('');
  const [pemasok, setPemasok] = useState<string>('');
  
  // Multi-item items state
  const [itemRows, setItemRows] = useState<FollowUpItemRow[]>([
    {
      id: `item-${Date.now()}`,
      namaBarang: '',
      pemasok: '',
      qty: 1,
      satuan: 'Kg',
      catatan: '',
    },
  ]);
  const [catatanUmum, setCatatanUmum] = useState<string>('');

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState<number>(0);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState<number | null>(null);

  const [isTokoOpen, setIsTokoOpen] = useState<boolean>(false);
  const [isDapurOpen, setIsDapurOpen] = useState<boolean>(false);
  const [isPemasokOpen, setIsPemasokOpen] = useState<boolean>(false);

  // Available masters
  const availableStores = masterToko.length > 0 ? masterToko.map((t) => t.nama) : stores.map((s) => s.nama);
  const availablePemasok = masterPemasok.length > 0 ? masterPemasok.map((p) => p.nama) : pemasokList;

  // Filtered lists for Autocomplete
  const filteredTokoSuggestions = useMemo(() => {
    const q = toko.trim().toLowerCase();
    const pool = masterToko.length > 0 ? masterToko : stores.map((s, idx) => ({ id: s.id || `t-${idx}`, nama: s.nama }));
    if (!q) return pool;
    return pool.filter((t) => t.nama.toLowerCase().includes(q));
  }, [toko, masterToko, stores]);
  const filteredKitchenSuggestions = useMemo(() => {
    const q = tujuanDapur.trim().toLowerCase().replace(/^dapur\s+/i, '');
    const pool = masterDapur.length > 0 ? masterDapur : kitchens.map((k) => ({ id: k.id, nama: k.nama, alamat: k.lokasi || '' }));
    if (!q) return pool;
    return pool.filter((d) => {
      const namaClean = d.nama.toLowerCase().replace(/^dapur\s+/i, '');
      const alamatClean = (d.alamat || '').toLowerCase();
      return namaClean.includes(q) || alamatClean.includes(q);
    });
  }, [tujuanDapur, masterDapur, kitchens]);

  const filteredPemasokSuggestions = useMemo(() => {
    const q = pemasok.trim().toLowerCase();
    const pool = masterPemasok.length > 0 ? masterPemasok : availablePemasok.map((p, idx) => ({ id: `p-${idx}`, nama: p }));
    if (!q) return pool;
    return pool.filter((p) => p.nama.toLowerCase().includes(q));
  }, [pemasok, masterPemasok, availablePemasok]);

  // Voice Recognition States
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTujuanDapur('');
      setToko('');
      setPemasok('');
      setIsTokoOpen(false);
      setIsDapurOpen(false);
      setIsPemasokOpen(false);
      setItemRows([
        {
          id: `item-${Date.now()}`,
          namaBarang: '',
          pemasok: '',
          qty: 1,
          satuan: 'Kg',
          catatan: '',
        },
      ]);
      setCatatanUmum('');
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestionIdx(null);
      setVoiceTranscript('');
      setVoiceNotice(null);
      setVoiceError(null);

      // Auto start voice if requested
      if (autoStartVoice) {
        setTimeout(() => {
          startVoiceRecognition();
        }, 300);
      } else {
        setTimeout(() => inputRef.current?.focus(), 150);
      }
    } else {
      stopVoiceRecognition();
    }

    return () => {
      stopVoiceRecognition();
    };
  }, [isOpen, kitchens, autoStartVoice]);

  const handleAddItemRow = () => {
    setItemRows((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        namaBarang: '',
        pemasok: '',
        qty: 1,
        satuan: 'Kg',
        catatan: '',
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (itemRows.length <= 1) return;
    setItemRows((prev) => prev.filter((_, idx) => idx !== index));
    if (activeSuggestionIdx === index) {
      setActiveSuggestionIdx(null);
      setShowSuggestions(false);
    }
  };

  const handleUpdateItemRow = (index: number, field: keyof FollowUpItemRow, value: any) => {
    setItemRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Clean up speech recognition when unmounting
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

  // Start voice recognition
  const startVoiceRecognition = () => {
    stopVoiceRecognition();
    setVoiceError(null);
    setVoiceNotice(null);

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError('Browser tidak mendukung Speech Recognition. Gunakan Google Chrome atau Edge.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceNotice('Mendengarkan... Silakan sebutkan nama barang & jumlah (contoh: "Ayam 4 kg")...');
      };

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        setVoiceTranscript(transcript);

        // If this is final result, parse and fill fields
        if (event.results[current].isFinal) {
          handleProcessVoiceTranscript(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setVoiceError('Izin mikrofon ditolak. Mohon izinkan akses mic di browser.');
        } else if (event.error === 'no-speech') {
          setVoiceError('Tidak ada suara terdeteksi. Silakan coba lagi.');
        } else {
          setVoiceError(`Error suara: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn('Failed to start speech recognition:', err);
      setVoiceError('Gagal mengakses mikrofon.');
      setIsListening(false);
    }
  };

  // Parse voice transcript into fields
  const handleProcessVoiceTranscript = (text: string) => {
    if (!text.trim()) return;

    const parsed = parseVoiceInput(text, kitchens);

    if (parsed.tujuanDapur) {
      setTujuanDapur(parsed.tujuanDapur);
    }

    setItemRows((prev) => {
      const emptyIdx = prev.findIndex((r) => !r.namaBarang.trim());
      const next = [...prev];
      const newRow: FollowUpItemRow = {
        id: `item-${Date.now()}`,
        namaBarang: parsed.namaBarang || text,
        pemasok: pemasok || '',
        qty: parsed.qty || 1,
        satuan: parsed.satuan || 'Kg',
        catatan: parsed.catatan || '',
      };
      if (emptyIdx !== -1) {
        next[emptyIdx] = newRow;
      } else {
        next.push(newRow);
      }
      return next;
    });

    const autoStore = guessStoreForItem(parsed.namaBarang, availableStores);
    if (autoStore && !toko) setToko(autoStore);

    setVoiceNotice(`✓ Berhasil: "${parsed.namaBarang}" sebanyak ${parsed.qty} ${parsed.satuan}`);
  };

  // Toggle voice recognition
  const toggleVoice = () => {
    if (isListening) {
      stopVoiceRecognition();
    } else {
      startVoiceRecognition();
    }
  };

  // Update suggestions when user types namaBarang in a row
  const handleItemNameChange = (idx: number, val: string) => {
    handleUpdateItemRow(idx, 'namaBarang', val);

    const autoStore = guessStoreForItem(val, availableStores);
    if (autoStore && !toko) {
      setToko(autoStore);
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (val.trim().length >= 1) {
      debounceTimerRef.current = setTimeout(() => {
        const results = getItemSuggestions(val, existingItemNames, 8);
        setSuggestions(results);
        setSelectedSuggestionIdx(0);
        setActiveSuggestionIdx(idx);
        setShowSuggestions(results.length > 0);
      }, 150);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestionIdx(null);
    }
  };

  // Keyboard navigation & Enter selection for suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (showSuggestions && activeSuggestionIdx === idx && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const chosen = suggestions[selectedSuggestionIdx];
        if (chosen) {
          handleSelectSuggestion(idx, chosen);
        }
      }
    }
  };

  const handleSelectSuggestion = (idx: number, item: string) => {
    handleUpdateItemRow(idx, 'namaBarang', item);
    const autoStore = guessStoreForItem(item, availableStores);
    if (autoStore && !toko) setToko(autoStore);
    setShowSuggestions(false);
    setActiveSuggestionIdx(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validRows = itemRows.filter(
      (r) => r.namaBarang.trim() !== '' || (r.catatan && r.catatan.trim() !== '')
    );

    if (validRows.length === 0 && !catatanUmum.trim()) {
      alert('Mohon lengkapi minimal satu nama barang atau catatan follow up.');
      return;
    }

    const itemsToSave: FollowUpItemRow[] = validRows.length > 0
      ? validRows.map((r, idx) => ({
          id: r.id || `item-${idx + 1}`,
          namaBarang: r.namaBarang.trim(),
          pemasok: (r.pemasok || pemasok || '').trim(),
          qty: typeof r.qty === 'number' ? r.qty : parseFloat(String(r.qty).replace(',', '.')) || 1,
          satuan: (r.satuan || 'Kg').trim(),
          catatan: (r.catatan || '').trim(),
        }))
      : [
          {
            id: `item-${Date.now()}`,
            namaBarang: 'Catatan Dapur',
            pemasok: pemasok.trim(),
            qty: 1,
            satuan: 'Kg',
            catatan: catatanUmum.trim(),
          },
        ];

    const firstItem = itemsToSave[0];
    const summaryCatatan = catatanUmum.trim() || itemsToSave
      .map((it) => {
        let desc = `${it.namaBarang} ${it.qty} ${it.satuan}`;
        if (it.pemasok) desc += ` (Pemasok: ${it.pemasok})`;
        if (it.catatan) desc += ` - ${it.catatan}`;
        return desc;
      })
      .join('; ');

    onSave({
      tujuanDapur: tujuanDapur || '',
      toko: toko || undefined,
      pemasok: firstItem.pemasok || pemasok || undefined,
      namaBarang: firstItem.namaBarang,
      qty: firstItem.qty,
      satuan: firstItem.satuan,
      catatan: summaryCatatan,
      items: itemsToSave,
      isDone: false,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 no-print">
        {/* Backdrop click to dismiss */}
        <div className="absolute inset-0" onClick={onClose} />

        {/* Tab Bar Sheet Container */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-800 overflow-hidden z-10 max-h-[90vh] flex flex-col transition-colors"
        >
          {/* Pull Tab Bar / Handle */}
          <div className="w-full pt-3 pb-1 flex justify-center items-center cursor-grab bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800">
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  TAMBAH FOLLOW UP
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Catat pesanan cepat atau memo sebelum masuk transaksi
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto flex-1 font-sans">
            
            {/* Dapur, Toko & Pemasok Grid */}
            <div className="space-y-2.5">
              {/* Dapur Searchable Autocomplete */}
              <div className="relative">
                <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Utensils className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>DAPUR TUJUAN</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={tujuanDapur}
                    autoComplete="off"
                    onFocus={() => setIsDapurOpen(true)}
                    onChange={(e) => {
                      setTujuanDapur(e.target.value);
                      setIsDapurOpen(true);
                    }}
                    className="w-full pl-8 pr-7 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setIsDapurOpen(!isDapurOpen)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                    title="Buka daftar dapur"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {isDapurOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsDapurOpen(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-40 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredKitchenSuggestions.length > 0 ? (
                        filteredKitchenSuggestions.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              setTujuanDapur(d.nama);
                              setIsDapurOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between group cursor-pointer"
                          >
                            <div>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-900 dark:group-hover:text-indigo-300">
                                Dapur {d.nama.replace(/^dapur\s+/i, '')}
                              </span>
                              {d.alamat && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">{d.alamat}</span>
                              )}
                            </div>
                            {tujuanDapur.trim().toLowerCase().replace(/^dapur\s+/i, '') === d.nama.trim().toLowerCase().replace(/^dapur\s+/i, '') && (
                              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">Terpilih</span>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="p-2.5 text-center">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                            Belum ada dapur "<span className="font-semibold text-slate-700 dark:text-slate-200">{tujuanDapur}</span>"
                          </p>
                          <span className="inline-block text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg">
                            + Tetap bisa dipakai & disimpan
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Toko & Pemasok Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Toko Searchable / Free Text */}
                <div className="relative">
                  <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Store className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                    <span>TOKO</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={toko}
                      autoComplete="off"
                      onFocus={() => setIsTokoOpen(true)}
                      onChange={(e) => {
                        setToko(e.target.value);
                        setIsTokoOpen(true);
                      }}
                      className="w-full pl-8 pr-7 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-purple-500 transition-all"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setIsTokoOpen(!isTokoOpen)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                      title="Buka daftar toko"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isTokoOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setIsTokoOpen(false)} />
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-40 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredTokoSuggestions.length > 0 ? (
                          filteredTokoSuggestions.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setToko(t.nama);
                                setIsTokoOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between group cursor-pointer"
                            >
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-900 dark:group-hover:text-indigo-300">
                                {t.nama}
                              </span>
                              {toko.trim().toLowerCase() === t.nama.trim().toLowerCase() && (
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">Terpilih</span>
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="p-2.5 text-center">
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              Toko "<span className="font-semibold text-slate-700 dark:text-slate-200">{toko}</span>"
                            </p>
                            <span className="inline-block text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg">
                              + Tetap bisa dipakai & disimpan
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Pemasok Searchable Autocomplete */}
                <div className="relative">
                  <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Truck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    <span>PEMASOK</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={pemasok}
                      autoComplete="off"
                      onFocus={() => setIsPemasokOpen(true)}
                      onChange={(e) => {
                        setPemasok(e.target.value);
                        setIsPemasokOpen(true);
                      }}
                      className="w-full pl-8 pr-7 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 transition-all"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setIsPemasokOpen(!isPemasokOpen)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                      title="Buka daftar pemasok"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isPemasokOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setIsPemasokOpen(false)} />
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-40 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredPemasokSuggestions.length > 0 ? (
                          filteredPemasokSuggestions.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setPemasok(p.nama);
                                setIsPemasokOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between group cursor-pointer"
                            >
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-900 dark:group-hover:text-indigo-300">
                                {p.nama}
                              </span>
                              {pemasok.trim().toLowerCase() === p.nama.trim().toLowerCase() && (
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">Terpilih</span>
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="p-2.5 text-center">
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              Belum ada pemasok "<span className="font-semibold text-slate-700 dark:text-slate-200">{pemasok}</span>"
                            </p>
                            <span className="inline-block text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg">
                              + Tetap bisa dipakai & disimpan
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Multi-Item Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>DAFTAR ITEM BARANG FOLLOW UP ({itemRows.length})</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Item Barang</span>
                </button>
              </div>

              {/* List of item rows */}
              <div className="space-y-3">
                {itemRows.map((row, idx) => (
                  <div
                    key={row.id || idx}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2.5 relative"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Item #{idx + 1}
                      </span>
                      {itemRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors cursor-pointer"
                          title="Hapus Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Nama Barang with Autocomplete */}
                    <div className="relative">
                      <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        NAMA BARANG
                      </label>
                      <input
                        ref={idx === 0 ? inputRef : undefined}
                        type="text"
                        value={row.namaBarang}
                        onChange={(e) => handleItemNameChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        onFocus={() => {
                          if (row.namaBarang.trim().length >= 1) {
                            const results = getItemSuggestions(row.namaBarang, existingItemNames, 8);
                            setSuggestions(results);
                            setSelectedSuggestionIdx(0);
                            setActiveSuggestionIdx(idx);
                            setShowSuggestions(results.length > 0);
                          }
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                      />

                      {/* Autocomplete suggestions popover */}
                      {showSuggestions && activeSuggestionIdx === idx && suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 overflow-hidden py-1 divide-y divide-slate-100 dark:divide-slate-800 max-h-52 overflow-y-auto">
                          <div className="sticky top-0 px-2.5 py-1 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800 flex items-center justify-between z-10">
                            <span>Saran Barang</span>
                            <span className="font-mono text-[8px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1 rounded">↵ Enter</span>
                          </div>
                          {suggestions.map((sug, sIdx) => (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => handleSelectSuggestion(idx, sug)}
                              onMouseEnter={() => setSelectedSuggestionIdx(sIdx)}
                              className={`w-full px-3 py-1.5 text-left text-xs font-extrabold flex items-center justify-between transition-colors cursor-pointer ${
                                sIdx === selectedSuggestionIdx
                                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              <span>{sug}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Qty & Satuan & Pemasok (3-column grid) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Qty */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Scale className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          <span>JUMLAH</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          required
                          value={row.qty}
                          onChange={(e) => handleUpdateItemRow(idx, 'qty', e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-black text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>

                      {/* Satuan */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          <span>SATUAN</span>
                        </label>
                        <SatuanAutocomplete
                          value={row.satuan || 'Kg'}
                          onChange={(val) => handleUpdateItemRow(idx, 'satuan', val)}
                          masterSatuan={masterSatuan}
                          onAddMasterSatuan={async (nama) => {
                            if (onAddMasterSatuan) return await onAddMasterSatuan(nama);
                            const res = await saveMasterSatuanToDb(nama);
                            if (res.success && onRefreshMaster) await onRefreshMaster();
                            return { success: res.success, error: res.error };
                          }}
                          onRefreshMaster={onRefreshMaster}
                        />
                      </div>

                      {/* Pemasok item */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Truck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                            <span>PEMASOK ITEM</span>
                          </span>
                          {!row.pemasok && pemasok && (
                            <span className="text-[8.5px] text-indigo-600 dark:text-indigo-400 font-normal">
                              Ikut form atas
                            </span>
                          )}
                        </label>
                        <PemasokAutocomplete
                          id={`input-row-pemasok-${idx}`}
                          value={row.pemasok || ''}
                          fallbackPemasok={pemasok}
                          onChange={(val) => handleUpdateItemRow(idx, 'pemasok', val)}
                          masterPemasok={masterPemasok}
                          pemasokList={availablePemasok}
                          compact
                        />
                      </div>
                    </div>

                    {/* Catatan Per Item */}
                    <div>
                      <input
                        type="text"
                        value={row.catatan || ''}
                        onChange={(e) => handleUpdateItemRow(idx, 'catatan', e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Button Tambah Item */}
              <button
                type="button"
                onClick={handleAddItemRow}
                className="w-full py-2 px-3 border-2 border-dashed border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Item Barang Lainnya</span>
              </button>
            </div>

            {/* Isi Catatan Umum Follow Up */}
            <div>
              <label className="block text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>CATATAN UMUM / KETERANGAN FOLLOW UP</span>
              </label>
              <textarea
                rows={2}
                value={catatanUmum}
                onChange={(e) => setCatatanUmum(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all resize-none"
              />
            </div>

            {/* Voice Feedback Banner (if active) */}
            {(isListening || voiceNotice || voiceError) && (
              <div className="text-center py-1">
                {isListening ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-[11px] font-bold animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping inline-block" />
                    <span>Mendengarkan... {voiceTranscript ? `"${voiceTranscript}"` : 'Bicara sekarang...'}</span>
                  </div>
                ) : voiceNotice ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10.5px] font-bold">
                    <span>{voiceNotice}</span>
                  </div>
                ) : voiceError ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-[10.5px] font-bold">
                    <AlertCircle className="w-3 h-3" />
                    <span>{voiceError}</span>
                  </div>
                ) : null}
              </div>
            )}

            {/* Buttons: Batal | Mic Button | Simpan Catatan */}
            <div className="pt-2 flex items-center gap-2">
              {/* Batal Button */}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-center"
              >
                Batal
              </button>

              {/* Circular Mic Button in the middle */}
              <div className="relative">
                {isListening && (
                  <span className="absolute -inset-1 rounded-full bg-rose-500/30 animate-ping pointer-events-none" />
                )}
                <button
                  type="button"
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

              {/* Simpan Follow Up Button */}
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-900 dark:bg-indigo-600 hover:bg-indigo-800 dark:hover:bg-indigo-500 text-white text-xs font-black shadow-md shadow-indigo-900/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Simpan Follow Up</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
