import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  CircleCheck, 
  Store, 
  Truck, 
  Utensils, 
  Calendar, 
  TrendingUp, 
  Loader2,
  FileText,
  Check,
  Search,
  ChevronDown,
  Trash2
} from 'lucide-react';
import { NoteItem, Kitchen, Store as StoreType, MasterToko, MasterPemasok, MasterDapur, MasterSatuan } from '../types';
import { getTodayWIB, formatTanggalWeb } from '../lib/formatters';
import { getItemSuggestions } from '../lib/suggestions';
import { saveMasterTokoToDb, saveMasterDapurToDb, saveMasterPemasokToDb, saveMasterSatuanToDb } from '../lib/supabaseDb';
import { MoneyInput, formatIDR } from './MoneyInput';
import { ProfitSummary } from './ProfitSummary';
import { FormSection } from './FormSection';
import { TransactionModalLayout } from './TransactionModalLayout';
import { SatuanAutocomplete } from './SatuanAutocomplete';

export interface FollowUpNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: NoteItem | null;
  onDone: (data: {
    noteId: string;
    namaBarang: string;
    qty: number;
    satuan: string;
    toko: string;
    pemasok: string;
    tujuanDapur: string;
    hargaBeli: number;
    hargaJual: number;
    tanggal: string;
    catatanTambahan?: string;
  }) => Promise<void> | void;
  onDelete?: (noteId: string) => Promise<void> | void;
  kitchens: Kitchen[];
  stores: StoreType[];
  pemasokList: string[];
  masterToko?: MasterToko[];
  masterPemasok?: MasterPemasok[];
  masterDapur?: MasterDapur[];
  masterSatuan?: MasterSatuan[];
  onAddMasterSatuan?: (nama: string) => Promise<{ success: boolean; error?: string }>;
  onRefreshMaster?: () => Promise<void> | void;
  selectedDate: string;
  pastPriceHistory?: { namaBarang: string; hargaBeli: number; hargaJual: number }[];
  existingOrders?: { namaBarang: string }[];
}

const COMMON_UNITS = ['Kg', 'Ikat', 'Gram', 'Pcs', 'Tray', 'Pack', 'Liter', 'Box', 'Karung', 'Ekor'];

export const FollowUpNoteModal: React.FC<FollowUpNoteModalProps> = ({
  isOpen,
  onClose,
  note,
  onDone,
  onDelete,
  kitchens = [],
  stores = [],
  pemasokList = [],
  masterToko = [],
  masterPemasok = [],
  masterDapur = [],
  masterSatuan = [],
  onAddMasterSatuan,
  onRefreshMaster,
  selectedDate,
  pastPriceHistory = [],
  existingOrders = [],
}) => {
  const [namaBarang, setNamaBarang] = useState('');
  const [qty, setQty] = useState<number | string>(1);
  const [satuan, setSatuan] = useState('Kg');
  const [toko, setToko] = useState('');
  const [pemasok, setPemasok] = useState('');
  const [tujuanDapur, setTujuanDapur] = useState('');
  const [hargaBeli, setHargaBeli] = useState<number>(0);
  const [hargaJual, setHargaJual] = useState<number>(0);
  const [tanggal, setTanggal] = useState(selectedDate || getTodayWIB());
  const [catatanAwal, setCatatanAwal] = useState('');
  const [activeItemIndex, setActiveItemIndex] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Memoized suggestion names
  const existingNames = useMemo(() => {
    const fromOrders = (existingOrders || []).map((o) => o.namaBarang);
    const fromHistory = (pastPriceHistory || []).map((p) => p.namaBarang);
    return Array.from(new Set([...fromOrders, ...fromHistory]));
  }, [existingOrders, pastPriceHistory]);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);
  const [selectedSugIdx, setSelectedSugIdx] = useState(0);
  const [isTokoOpen, setIsTokoOpen] = useState(false);
  const [isDapurOpen, setIsDapurOpen] = useState(false);
  const [isPemasokOpen, setIsPemasokOpen] = useState(false);
  const tokoInputRef = useRef<HTMLInputElement>(null);
  const dapurInputRef = useRef<HTMLInputElement>(null);
  const pemasokInputRef = useRef<HTMLInputElement>(null);

  const [touched, setTouched] = useState({
    namaBarang: false,
    qty: false,
    toko: false,
    pemasok: false,
    tujuanDapur: false,
    hargaBeli: false,
    hargaJual: false,
  });

  // Available lists
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

  const applyItemData = (itemNama: string, itemQty: number | string, itemSatuan: string, itemPemasok?: string) => {
    setNamaBarang(itemNama);
    setQty(itemQty && Number(itemQty) > 0 ? itemQty : 1);
    setSatuan(itemSatuan || 'Kg');

    // Toko tidak pernah ditebak dari nama barang atau master pertama.
    setToko(note?.toko || '');

    // Tentukan Pemasok
    const initialPemasok = itemPemasok || note?.pemasok || '';
    setPemasok(initialPemasok);

    // Cek riwayat harga
    const match = pastPriceHistory.find(
      (p) => p.namaBarang.toLowerCase() === itemNama.toLowerCase() && (p.hargaBeli > 0 || p.hargaJual > 0)
    );
    if (match) {
      setHargaBeli(Math.round(match.hargaBeli || 0));
      setHargaJual(Math.round(match.hargaJual || 0));
    } else {
      setHargaBeli(0);
      setHargaJual(0);
    }
    setIsTokoOpen(false);
    setIsDapurOpen(false);
    setIsPemasokOpen(false);
  };

  const selectItemIndex = (idx: number) => {
    if (!note || !note.items || !note.items[idx]) return;
    setActiveItemIndex(idx);
    const it = note.items[idx];
    applyItemData(it.namaBarang, it.qty, it.satuan, it.pemasok);
  };

  useEffect(() => {
    if (note && isOpen) {
      setActiveItemIndex(0);
      const firstItem = note.items && note.items.length > 0 ? note.items[0] : null;
      const item = firstItem?.namaBarang || note.namaBarang || note.catatan || '';
      const initialQty = firstItem?.qty || (note.qty && note.qty > 0 ? note.qty : 1);
      const initialSatuan = firstItem?.satuan || note.satuan || 'Kg';
      const initialPemasok = firstItem?.pemasok || note.pemasok || '';

      setTujuanDapur(note.tujuanDapur || '');
      setTanggal(note.tanggal || note.createdAt?.slice(0, 10) || selectedDate || getTodayWIB());
      setCatatanAwal(note.catatan || '');
      setIsSubmitting(false);
      setTouched({
        namaBarang: false,
        qty: false,
        toko: false,
        pemasok: false,
        tujuanDapur: false,
        hargaBeli: false,
        hargaJual: false,
      });

      applyItemData(item, initialQty, initialSatuan, initialPemasok);
    }
  }, [note, isOpen, selectedDate]);

  if (!isOpen || !note) return null;

  // Safe numerical calculations
  const parsedQty = typeof qty === 'number' ? qty : parseFloat(String(qty).replace(',', '.')) || 0;
  const quantity = Math.max(0, parsedQty);
  const purchasePrice = Math.max(0, Math.round(hargaBeli));
  const sellingPrice = Math.max(0, Math.round(hargaJual));

  const totalPenjualan = sellingPrice * quantity;
  const totalModal = purchasePrice * quantity;
  const totalProfit = totalPenjualan - totalModal;

  // Validation
  const isItemValid = namaBarang.trim().length > 0;
  const isQtyValid = quantity > 0;
  const isStoreValid = toko.trim().length > 0;
  const isSupplierValid = pemasok.trim().length > 0;
  const isKitchenValid = tujuanDapur.trim().length > 0;
  const isBeliValid = purchasePrice > 0;
  const isJualValid = sellingPrice > 0;

  const isFormValid =
    isItemValid &&
    isQtyValid &&
    isStoreValid &&
    isSupplierValid &&
    isKitchenValid &&
    isBeliValid &&
    isJualValid;

  const missingFields = [
    !isItemValid ? 'nama barang' : '',
    !isQtyValid ? 'qty' : '',
    !isStoreValid ? 'toko' : '',
    !isKitchenValid ? 'dapur tujuan' : '',
    !isBeliValid ? 'harga beli' : '',
    !isJualValid ? 'harga jual' : '',
    !isSupplierValid ? 'pemasok' : '',
  ].filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) {
      setTouched({
        namaBarang: true,
        qty: true,
        toko: true,
        pemasok: true,
        tujuanDapur: true,
        hargaBeli: true,
        hargaJual: true,
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const cleanDapur = tujuanDapur.trim();
      const cleanDapurCheck = cleanDapur.replace(/^dapur\s+/i, '').trim().toLowerCase();
      const matchedDapur = (masterDapur || []).find(
        (d) => d.nama.trim().toLowerCase() === cleanDapur.toLowerCase() ||
               d.nama.trim().toLowerCase() === cleanDapurCheck ||
               d.nama.trim().toLowerCase().replace(/^dapur\s+/i, '') === cleanDapurCheck
      );
      if (!matchedDapur && cleanDapur) {
        const newDapurName = cleanDapur.replace(/^dapur\s+/i, '').trim();
        try {
          await saveMasterDapurToDb(newDapurName);
        } catch (e) {
          console.warn('Auto-save master dapur note error:', e);
        }
      }

      const cleanPemasok = pemasok.trim();
      const matchedPemasok = (masterPemasok || []).find(
        (p) => p.nama.trim().toLowerCase() === cleanPemasok.toLowerCase()
      );
      if (!matchedPemasok && cleanPemasok) {
        try {
          await saveMasterPemasokToDb(cleanPemasok);
        } catch (e) {
          console.warn('Auto-save master pemasok note error:', e);
        }
      }

      const cleanToko = toko.trim();
      const matchedToko = (masterToko || []).find(
        (t) => t.nama.trim().toLowerCase() === cleanToko.toLowerCase() || String(t.id) === String(cleanToko)
      );
      if (!matchedToko && cleanToko) {
        try {
          await saveMasterTokoToDb(cleanToko);
        } catch (e) {
          console.warn('Auto-save master toko note error:', e);
        }
      }

      if (onRefreshMaster) {
        try {
          await onRefreshMaster();
        } catch (_) {}
      }

      await onDone({
        noteId: note.id,
        namaBarang: namaBarang.trim(),
        qty: quantity,
        satuan: satuan.trim() || 'Kg',
        toko: toko.trim(),
        pemasok: cleanPemasok,
        tujuanDapur: cleanDapur,
        hargaBeli: purchasePrice,
        hargaJual: sellingPrice,
        tanggal: tanggal || getTodayWIB(),
        catatanTambahan: catatanAwal.trim(),
      });
      onClose();
    } catch (err) {
      console.error('Error completing follow up:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TransactionModalLayout
      isOpen={isOpen}
      onClose={onClose}
      title="FOLLOW UP PESANAN"
      subtitle="Lengkapi field yang masih kosong sebelum dipindahkan ke pesanan"
      icon={<CircleCheck className="w-5 h-5 text-emerald-400" />}
      headerRight={
        <div className="relative flex items-center bg-slate-800 border border-slate-700 hover:border-indigo-400 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-2xs transition-all cursor-pointer group flex-1 sm:flex-none">
          <Calendar className="w-3.5 h-3.5 text-indigo-400 mr-2 shrink-0 group-hover:text-indigo-300" />
          <span className="truncate font-semibold text-slate-100 select-none">
            {tanggal ? formatTanggalWeb(tanggal, false) : 'Pilih Tanggal'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1.5 shrink-0" />
          <input
            type="date"
            required
            id="input-followup-tanggal"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
            title="Pilih tanggal pesanan"
          />
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          {onDelete ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={async () => {
                if (!window.confirm('Hapus Follow Up ini? Data yang dihapus tidak masuk transaksi.')) return;
                setIsSubmitting(true);
                try {
                  await onDelete(note.id);
                  onClose();
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2.5 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
              title="Hapus Follow Up"
            >
              <Trash2 className="h-4 w-4" />
              Hapus
            </button>
          ) : <span />}
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            id="btn-batal-follow-up"
            className="py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-center"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            id="btn-simpan-ke-transaksi"
            className={`py-2 px-5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center shadow-md ${
              isFormValid && !isSubmitting
                ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20 active:scale-98'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              ) : (
                <Check className="w-4 h-4 text-emerald-400" />
              )}
              <span className="font-black text-xs sm:text-sm">
                {isSubmitting ? 'Menyimpan...' : 'Simpan ke Transaksi'}
              </span>
            </div>
            <div className="text-[10px] text-slate-300 font-mono flex items-center gap-1.5 mt-0.5">
              <span>{formatIDR(totalPenjualan)}</span>
              <span>•</span>
              <span className={totalProfit >= 0 ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>
                Profit {totalProfit < 0 ? `-${formatIDR(Math.abs(totalProfit))}` : formatIDR(totalProfit)}
              </span>
            </div>
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        {missingFields.length > 0 && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 dark:border-amber-800 dark:bg-amber-950/30">
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
              <div>
                <p className="text-xs font-black text-amber-900 dark:text-amber-200">Follow Up belum lengkap</p>
                <p className="mt-1 text-[11px] font-semibold leading-relaxed text-amber-800 dark:text-amber-300">
                  Isi field berikut sebelum konfirmasi masuk ke pesanan: {missingFields.join(', ')}.
                </p>
              </div>
            </div>
          </div>
        )}
        {/* Catatan Awal Card */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-3 sm:p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Catatan Awal Follow Up
            </span>
            {note.tujuanDapur && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Dapur {note.tujuanDapur}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 italic">
            "{catatanAwal || note.namaBarang || 'Tanpa catatan'}"
          </p>
        </div>

        {/* Multi-Item Selector if note has multiple items */}
        {note.items && note.items.length > 1 && (
          <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-black uppercase text-indigo-900 dark:text-indigo-300 tracking-wider">
              <span>Pilih Item untuk Diproses ({note.items.length} Barang):</span>
              <span className="font-semibold text-slate-500 dark:text-slate-400">Item #{activeItemIndex + 1} aktif</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {note.items.map((it, idx) => (
                <button
                  key={it.id || idx}
                  type="button"
                  onClick={() => selectItemIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    activeItemIndex === idx
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/40'
                  }`}
                >
                  {it.namaBarang || `Item #${idx + 1}`} ({it.qty} {it.satuan || 'Kg'})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 1 — DETAIL BARANG */}
        <FormSection
          title="Detail Barang"
          subtitle="Konfirmasi nama barang dan volume pesanan"
          icon={<Utensils className="w-3.5 h-3.5" />}
        >
          <div className="space-y-3">
            <div className="relative">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Nama Barang <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="input-followup-nama-barang"
                value={namaBarang}
                onChange={(e) => {
                  const val = e.target.value;
                  setNamaBarang(val);
                  if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current);
                  }

                  if (val.trim().length >= 1) {
                    debounceTimerRef.current = setTimeout(() => {
                      const results = getItemSuggestions(val, existingNames, 8);
                      setSuggestions(results);
                      setSelectedSugIdx(0);
                      setShowSuggestions(results.length > 0);
                    }, 150);
                  } else {
                    setSuggestions([]);
                    setShowSuggestions(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (showSuggestions && suggestions.length > 0) {
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
                        setNamaBarang(chosen);
                        setShowSuggestions(false);
                      }
                    } else if (e.key === 'Escape') {
                      setShowSuggestions(false);
                    }
                  }
                }}
                onFocus={() => {
                  if (namaBarang.trim().length >= 1) {
                    const results = getItemSuggestions(namaBarang, existingNames, 8);
                    setSuggestions(results);
                    setShowSuggestions(results.length > 0);
                  }
                }}
                onBlur={() => {
                  // Slight delay so click on suggestion can register
                  setTimeout(() => {
                    setShowSuggestions(false);
                    setTouched((prev) => ({ ...prev, namaBarang: true }));
                  }, 200);
                }}
                className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all ${
                  touched.namaBarang && !isItemValid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 dark:border-slate-700'
                }`}
              />

              {/* Autocomplete Popup */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 overflow-hidden py-1 divide-y divide-slate-100 dark:divide-slate-700 max-h-60 overflow-y-auto">
                  <div className="sticky top-0 px-2.5 py-1 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-900 flex items-center justify-between z-10">
                    <span>Saran Barang</span>
                    <span className="font-mono text-[8px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1 rounded">↵ Enter</span>
                  </div>
                  {suggestions.map((sug, idx) => (
                    <button
                      key={sug}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setNamaBarang(sug);
                        setShowSuggestions(false);
                      }}
                      onMouseEnter={() => setSelectedSugIdx(idx)}
                      className={`w-full px-3 py-1.5 text-left text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                        idx === selectedSugIdx
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <span>{sug}</span>
                    </button>
                  ))}
                </div>
              )}

              {touched.namaBarang && !isItemValid && (
                <p className="text-[10px] font-semibold text-rose-600 mt-1">Nama barang wajib diisi</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Qty / Jumlah <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  id="input-followup-qty"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, qty: true }))}
                  className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all text-center ${
                    touched.qty && !isQtyValid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 dark:border-slate-700'
                  }`}
                />
                {touched.qty && !isQtyValid && (
                  <p className="text-[10px] font-semibold text-rose-600 mt-1">Qty harus lebih dari 0</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Satuan
                </label>
                <SatuanAutocomplete
                  id="select-followup-satuan"
                  value={satuan}
                  onChange={setSatuan}
                  masterSatuan={masterSatuan}
                  onAddMasterSatuan={async (nama) => {
                    if (onAddMasterSatuan) return await onAddMasterSatuan(nama);
                    const res = await saveMasterSatuanToDb(nama);
                    if (res.success && onRefreshMaster) await onRefreshMaster();
                    return { success: res.success, error: res.error };
                  }}
                />
              </div>
            </div>
          </div>
        </FormSection>

        {/* SECTION 2 — TUJUAN PESANAN */}
        <FormSection
          title="Tujuan Pesanan"
          subtitle="Toko rekanan, pemasok & dapur pemesan"
          icon={<Store className="w-3.5 h-3.5" />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Toko Autocomplete / Free Text */}
            <div className="relative">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Toko <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  id="input-followup-toko"
                  ref={tokoInputRef}
                  value={toko}
                  autoComplete="off"
                  onFocus={() => {
                    setIsTokoOpen(true);
                    setTouched((prev) => ({ ...prev, toko: true }));
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setToko(val);
                    setIsTokoOpen(true);
                    setTouched((prev) => ({ ...prev, toko: true }));
                  }}
                  className={`w-full pl-8 pr-7 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all ${
                    touched.toko && !isStoreValid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 dark:border-slate-700'
                  }`}
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setIsTokoOpen(!isTokoOpen)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title="Buka daftar toko"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {touched.toko && !isStoreValid && (
                <p className="text-[10px] font-semibold text-rose-600 mt-1">Isi toko asal</p>
              )}

              {isTokoOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setIsTokoOpen(false)} 
                  />
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-40 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredTokoSuggestions.length > 0 ? (
                      filteredTokoSuggestions.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setToko(t.nama);
                            setIsTokoOpen(false);
                            setTouched((prev) => ({ ...prev, toko: true }));
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors flex items-center justify-between group cursor-pointer"
                        >
                          <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-900 dark:group-hover:text-indigo-300">
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
                        <span className="inline-block text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg">
                          + Otomatis disimpan ke Master saat disimpan
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Pemasok Autocomplete */}
            <div className="relative">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Pemasok <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  id="input-followup-pemasok"
                  ref={pemasokInputRef}
                  value={pemasok}
                  autoComplete="off"
                  onFocus={() => {
                    setIsPemasokOpen(true);
                    setTouched((prev) => ({ ...prev, pemasok: true }));
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPemasok(val);
                    setIsPemasokOpen(true);
                    setTouched((prev) => ({ ...prev, pemasok: true }));
                  }}
                  className={`w-full pl-8 pr-7 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all ${
                    touched.pemasok && !isSupplierValid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 dark:border-slate-700'
                  }`}
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setIsPemasokOpen(!isPemasokOpen)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title="Buka daftar pemasok"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {touched.pemasok && !isSupplierValid && (
                <p className="text-[10px] font-semibold text-rose-600 mt-1">Isi nama pemasok</p>
              )}

              {isPemasokOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setIsPemasokOpen(false)} 
                  />
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-40 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredPemasokSuggestions.length > 0 ? (
                      filteredPemasokSuggestions.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setPemasok(p.nama);
                            setIsPemasokOpen(false);
                            setTouched((prev) => ({ ...prev, pemasok: true }));
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors flex items-center justify-between group cursor-pointer"
                        >
                          <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-900 dark:group-hover:text-indigo-300">
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
                        <span className="inline-block text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg">
                          + Otomatis disimpan ke Master saat disimpan
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Dapur Autocomplete */}
            <div className="relative">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Dapur <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  id="input-followup-dapur"
                  ref={dapurInputRef}
                  value={tujuanDapur}
                  autoComplete="off"
                  onFocus={() => {
                    setIsDapurOpen(true);
                    setTouched((prev) => ({ ...prev, tujuanDapur: true }));
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTujuanDapur(val);
                    setIsDapurOpen(true);
                    setTouched((prev) => ({ ...prev, tujuanDapur: true }));
                  }}
                  className={`w-full pl-8 pr-7 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all ${
                    touched.tujuanDapur && !isKitchenValid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 dark:border-slate-700'
                  }`}
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setIsDapurOpen(!isDapurOpen)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title="Buka daftar dapur"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {touched.tujuanDapur && !isKitchenValid && (
                <p className="text-[10px] font-semibold text-rose-600 mt-1">Isi dapur tujuan</p>
              )}

              {isDapurOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setIsDapurOpen(false)} 
                  />
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-40 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredKitchenSuggestions.length > 0 ? (
                      filteredKitchenSuggestions.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            setTujuanDapur(d.nama);
                            setIsDapurOpen(false);
                            setTouched((prev) => ({ ...prev, tujuanDapur: true }));
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors flex items-center justify-between group cursor-pointer"
                        >
                          <div>
                            <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-900 dark:group-hover:text-indigo-300">
                              Dapur {d.nama.replace(/^dapur\s+/i, '')}
                            </span>
                            {d.alamat && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                                {d.alamat}
                              </span>
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
                        <span className="inline-block text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg">
                          + Otomatis disimpan ke Master saat disimpan
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </FormSection>

        {/* SECTION 3 — HARGA & ESTIMASI PROFIT */}
        <FormSection
          title="Harga & Estimasi Profit"
          subtitle="Kalkulasi margin otomatis berdasarkan kuantitas & harga satuan"
          icon={<TrendingUp className="w-3.5 h-3.5" />}
        >
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MoneyInput
                label="Harga Beli / Modal (PO)"
                required
                id="input-followup-hargabeli"
                value={hargaBeli}
                onChange={(val) => {
                  setHargaBeli(val);
                  setTouched((prev) => ({ ...prev, hargaBeli: true }));
                }}
                error={touched.hargaBeli && !isBeliValid ? 'Harga beli wajib diisi (> 0)' : undefined}
                helperText="Harga modal per satuan dari pemasok"
              />

              <MoneyInput
                label="Harga Jual"
                required
                id="input-followup-hargajual"
                value={hargaJual}
                onChange={(val) => {
                  setHargaJual(val);
                  setTouched((prev) => ({ ...prev, hargaJual: true }));
                }}
                error={touched.hargaJual && !isJualValid ? 'Harga jual wajib diisi (> 0)' : undefined}
                helperText="Harga per satuan tagihan ke dapur"
              />
            </div>

            <ProfitSummary
              quantity={quantity}
              purchasePrice={purchasePrice}
              sellingPrice={sellingPrice}
            />
          </div>
        </FormSection>
      </form>
    </TransactionModalLayout>
  );
};
