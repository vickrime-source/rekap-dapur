import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, Plus, Utensils, Tag, FileText, Sparkles } from 'lucide-react';
import { Kitchen, NoteItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { getItemSuggestions } from '../lib/suggestions';

interface NoteSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: Omit<NoteItem, 'id' | 'createdAt'>) => void;
  kitchens: Kitchen[];
  existingItemNames?: string[];
}

export const NoteSheet: React.FC<NoteSheetProps> = ({
  isOpen,
  onClose,
  onSave,
  kitchens,
  existingItemNames = [],
}) => {
  const [tujuanDapur, setTujuanDapur] = useState<string>('');
  const [namaBarang, setNamaBarang] = useState<string>('');
  const [catatan, setCatatan] = useState<string>('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState<number>(0);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (kitchens.length > 0 && !tujuanDapur) {
        setTujuanDapur(kitchens[0].nama);
      }
      setNamaBarang('');
      setCatatan('');
      setSuggestions([]);
      setShowSuggestions(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, kitchens]);

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

    onSave({
      tujuanDapur: tujuanDapur || (kitchens[0]?.nama || 'Siliragung'),
      namaBarang: namaBarang.trim() || undefined,
      catatan: catatan.trim(),
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
          className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 overflow-hidden z-10 max-h-[85vh] flex flex-col"
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
                  NOTES
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

          {/* Form Form Body */}
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
              <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3 text-slate-700" />
                  <span>NAMA BARANG (OPSIONAL)</span>
                </span>
                <span className="text-[9px] font-bold text-indigo-600 flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5" />
                  Auto-Suggest
                </span>
              </label>

              <input
                ref={inputRef}
                type="text"
                placeholder="Ketik misal: ik (ikan), ap (apel), ayam..."
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
                {['Ikan Lele', 'Ayam Potong', 'Apel Fuji', 'Telur Ayam', 'Bayam', 'Beras'].map((quick) => (
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

            {/* Isi Catatan Follow Up */}
            <div>
              <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3 text-emerald-600" />
                <span>ISI CATATAN / STATUS FOLLOW UP</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="Contoh: Tolong kirim sebelum jam 9 pagi, konfirmasi stok ke supplier, minta nota fisik..."
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all resize-none"
              />
            </div>

            {/* Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer text-center"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-md shadow-slate-900/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Simpan</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
