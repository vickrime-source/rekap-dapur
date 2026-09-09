import React, { useState, useEffect, useRef } from 'react';
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
  AlertCircle 
} from 'lucide-react';
import { Kitchen, NoteItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { getItemSuggestions } from '../lib/suggestions';
import { parseVoiceInput } from '../lib/voiceParser';

interface NoteSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: Omit<NoteItem, 'id' | 'createdAt'>) => void;
  kitchens: Kitchen[];
  existingItemNames?: string[];
  autoStartVoice?: boolean;
}

const COMMON_UNITS = ['Kg', 'Gram', 'Pcs', 'Ikat', 'Tray', 'Pack', 'Liter', 'Box', 'Karung', 'Ekor'];

export const NoteSheet: React.FC<NoteSheetProps> = ({
  isOpen,
  onClose,
  onSave,
  kitchens,
  existingItemNames = [],
  autoStartVoice = false,
}) => {
  const [tujuanDapur, setTujuanDapur] = useState<string>('');
  const [namaBarang, setNamaBarang] = useState<string>('');
  const [qty, setQty] = useState<number | string>(1);
  const [satuan, setSatuan] = useState<string>('Kg');
  const [catatan, setCatatan] = useState<string>('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState<number>(0);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // Voice Recognition States
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      if (kitchens.length > 0 && !tujuanDapur) {
        setTujuanDapur(kitchens[0].nama);
      }
      setNamaBarang('');
      setQty(1);
      setSatuan('Kg');
      setCatatan('');
      setSuggestions([]);
      setShowSuggestions(false);
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

    // Apply parsed values
    if (parsed.namaBarang) {
      setNamaBarang(parsed.namaBarang);
    }
    if (parsed.qty) {
      setQty(parsed.qty);
    }
    if (parsed.satuan) {
      setSatuan(parsed.satuan);
    }
    if (parsed.tujuanDapur) {
      setTujuanDapur(parsed.tujuanDapur);
    }
    if (parsed.catatan) {
      setCatatan(parsed.catatan);
    } else {
      setCatatan(`${parsed.namaBarang} ${parsed.qty} ${parsed.satuan}`);
    }

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

  // Update suggestions when user types namaBarang
  const handleItemChange = (val: string) => {
    setNamaBarang(val);
    if (val.trim().length >= 1) {
      const results = getItemSuggestions(val, existingItemNames, 5);
      setSuggestions(results);
      setSelectedSuggestionIdx(0);
      setShowSuggestions(results.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Keyboard navigation & Enter selection for suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
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
          setNamaBarang(chosen);
          setShowSuggestions(false);
        }
      }
    }
  };

  const handleSelectSuggestion = (item: string) => {
    setNamaBarang(item);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catatan.trim() && !namaBarang.trim()) {
      alert('Mohon isi nama barang atau isi catatan follow up.');
      return;
    }

    const numQty = typeof qty === 'number' ? qty : parseFloat(String(qty).replace(',', '.')) || 1;
    const itemNama = namaBarang.trim();
    const finalCatatan = catatan.trim() || (itemNama ? `${itemNama} ${numQty} ${satuan}` : 'Catatan Dapur');

    onSave({
      tujuanDapur: tujuanDapur || (kitchens[0]?.nama || 'Siliragung'),
      namaBarang: itemNama || undefined,
      qty: numQty,
      satuan: satuan || 'Kg',
      catatan: finalCatatan,
      isDone: false,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-xs no-print">
        {/* Backdrop click to dismiss */}
        <div className="absolute inset-0" onClick={onClose} />

        {/* Tab Bar Sheet Container */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 overflow-hidden z-10 max-h-[90vh] flex flex-col"
        >
          {/* Pull Tab Bar / Handle */}
          <div className="w-full pt-3 pb-1 flex justify-center items-center cursor-grab bg-slate-50 border-b border-slate-100">
            <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-5 py-3.5 bg-slate-50 flex items-center justify-between border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">
                  TAMBAH CATATAN
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto flex-1 font-sans">
            
            {/* Dapur Dropdown */}
            <div>
              <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Utensils className="w-3 h-3 text-indigo-600" />
                <span>PILIH DAPUR</span>
              </label>
              <select
                value={tujuanDapur}
                onChange={(e) => setTujuanDapur(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all cursor-pointer"
              >
                {kitchens.map((k) => (
                  <option key={k.id} value={k.nama}>
                    Dapur {k.nama}
                  </option>
                ))}
              </select>
            </div>

            {/* Nama Barang with Smart Autocomplete Engine */}
            <div className="relative">
              <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-700" />
                <span>NAMA BARANG</span>
              </label>

              <input
                ref={inputRef}
                type="text"
                placeholder="Nama barang..."
                value={namaBarang}
                onChange={(e) => handleItemChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (namaBarang.trim().length >= 1) {
                    const results = getItemSuggestions(namaBarang, existingItemNames, 5);
                    setSuggestions(results);
                    setShowSuggestions(results.length > 0);
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all"
              />

              {/* Suggestion Dropdown Popover */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden py-1 divide-y divide-slate-100">
                  <div className="px-2.5 py-1 text-[9px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 flex items-center justify-between">
                    <span>Saran Otomatis (Tekan Enter / Klik)</span>
                    <span className="font-mono text-[8px] bg-slate-200 text-slate-700 px-1 rounded">↵ Enter</span>
                  </div>
                  {suggestions.map((sug, idx) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => handleSelectSuggestion(sug)}
                      onMouseEnter={() => setSelectedSuggestionIdx(idx)}
                      className={`w-full px-3 py-1.5 text-left text-xs font-extrabold flex items-center justify-between transition-colors cursor-pointer ${
                        idx === selectedSuggestionIdx
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

            {/* Quick Suggestion Pills */}
            {!showSuggestions && (
              <div className="flex flex-wrap gap-1 items-center pt-0.5">
                <span className="text-[9px] font-bold text-slate-400">Paling Sering:</span>
                {['Ayam Potong', 'Ikan Lele', 'Telur Ayam', 'Bawang Merah', 'Bayam', 'Beras'].map((quick) => (
                  <button
                    key={quick}
                    type="button"
                    onClick={() => setNamaBarang(quick)}
                    className="text-[9.5px] font-bold bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 px-2 py-0.5 rounded-lg border border-slate-200/80 transition-colors"
                  >
                    +{quick}
                  </button>
                ))}
              </div>
            )}

            {/* INPUT QTY KG DI NOTES DI BAWAH NAMA BARANG (Requirement #3) */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
              <div className="grid grid-cols-2 gap-2.5">
                {/* Input QTY */}
                <div>
                  <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Scale className="w-3 h-3 text-indigo-600" />
                    <span>JUMLAH / QTY</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    required
                    placeholder="Contoh: 4"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                {/* Input SATUAN (kg, pcs, ikat, dll) */}
                <div>
                  <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span>SATUAN</span>
                  </label>
                  <select
                    value={satuan}
                    onChange={(e) => setSatuan(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                  >
                    {COMMON_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Unit Pills */}
              <div className="flex flex-wrap gap-1 items-center pt-1">
                <span className="text-[9px] font-bold text-slate-400">Pilih Satuan:</span>
                {['Kg', 'Gram', 'Pcs', 'Ikat', 'Tray', 'Pack'].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setSatuan(u)}
                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                      satuan.toLowerCase() === u.toLowerCase()
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {/* Isi Catatan Follow Up */}
            <div>
              <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3 text-emerald-600" />
                <span>ISI CATATAN / KETERANGAN FOLLOW UP</span>
              </label>
              <textarea
                rows={2}
                placeholder="Isi catatan..."
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all resize-none"
              />
            </div>

            {/* Voice Feedback Banner (if active) */}
            {(isListening || voiceNotice || voiceError) && (
              <div className="text-center py-1">
                {isListening ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[11px] font-bold animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping inline-block" />
                    <span>Mendengarkan... {voiceTranscript ? `"${voiceTranscript}"` : 'Bicara sekarang...'}</span>
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

            {/* Buttons: Batal | Mic Button | Simpan Catatan */}
            <div className="pt-2 flex items-center gap-2">
              {/* Batal Button */}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer text-center"
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

              {/* Simpan Catatan Button */}
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-md shadow-slate-900/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Simpan Catatan</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
