import React, { useState, useEffect } from 'react';
import { 
  CircleCheck, 
  Store, 
  Truck, 
  Utensils, 
  Calendar, 
  TrendingUp, 
  Loader2,
  FileText,
  Check
} from 'lucide-react';
import { NoteItem, Kitchen, Store as StoreType, MasterToko, MasterPemasok } from '../types';
import { getTodayWIB } from '../lib/formatters';
import { guessStoreForItem } from '../lib/storeMatcher';
import { MoneyInput, formatIDR } from './MoneyInput';
import { ProfitSummary } from './ProfitSummary';
import { FormSection } from './FormSection';
import { TransactionModalLayout } from './TransactionModalLayout';

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
  kitchens: Kitchen[];
  stores: StoreType[];
  pemasokList: string[];
  masterToko?: MasterToko[];
  masterPemasok?: MasterPemasok[];
  selectedDate: string;
  pastPriceHistory?: { namaBarang: string; hargaBeli: number; hargaJual: number }[];
}

const COMMON_UNITS = ['Kg', 'Ikat', 'Gram', 'Pcs', 'Tray', 'Pack', 'Liter', 'Box', 'Karung', 'Ekor'];

export const FollowUpNoteModal: React.FC<FollowUpNoteModalProps> = ({
  isOpen,
  onClose,
  note,
  onDone,
  kitchens = [],
  stores = [],
  pemasokList = [],
  masterToko = [],
  masterPemasok = [],
  selectedDate,
  pastPriceHistory = [],
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
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  useEffect(() => {
    if (note && isOpen) {
      const item = note.namaBarang || note.catatan || '';
      setNamaBarang(item);
      setQty(note.qty && note.qty > 0 ? note.qty : 1);
      setSatuan(note.satuan || 'Kg');
      setTujuanDapur(note.tujuanDapur || kitchens[0]?.nama || '');
      setTanggal(selectedDate || getTodayWIB());
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

      // 1. Tentukan Toko: pakai dari note jika ada, atau tebak dari nama barang
      let initialToko = note.toko || '';
      if (!initialToko && item) {
        const guessed = guessStoreForItem(item, availableStores);
        if (guessed) initialToko = guessed;
      }
      if (!initialToko && availableStores.length > 0) {
        initialToko = availableStores[0];
      }
      setToko(initialToko);

      // 2. Tentukan Pemasok: pakai dari note jika ada, atau default dari pemasokList
      let initialPemasok = note.pemasok || '';
      if (!initialPemasok && availablePemasok.length > 0) {
        initialPemasok = availablePemasok[0];
      }
      setPemasok(initialPemasok);

      // 3. Cek riwayat harga jika barang pernah dipesan sebelumnya
      const match = pastPriceHistory.find(
        (p) => p.namaBarang.toLowerCase() === item.toLowerCase() && (p.hargaBeli > 0 || p.hargaJual > 0)
      );
      if (match) {
        setHargaBeli(Math.round(match.hargaBeli || 0));
        setHargaJual(Math.round(match.hargaJual || 0));
      } else {
        setHargaBeli(0);
        setHargaJual(0);
      }
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
      await onDone({
        noteId: note.id,
        namaBarang: namaBarang.trim(),
        qty: quantity,
        satuan: satuan.trim() || 'Kg',
        toko: toko.trim(),
        pemasok: pemasok.trim(),
        tujuanDapur: tujuanDapur.trim(),
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
      subtitle="Lengkapi harga beli & jual untuk menghitung estimasi margin"
      icon={<CircleCheck className="w-5 h-5 text-emerald-400" />}
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            id="btn-batal-follow-up"
            className="py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer text-center"
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
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
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
        {/* Catatan Awal Card */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Catatan Awal Follow Up
            </span>
            {note.tujuanDapur && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                Dapur {note.tujuanDapur}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm font-semibold text-slate-800 italic">
            "{catatanAwal || note.namaBarang || 'Tanpa catatan'}"
          </p>
        </div>

        {/* SECTION 1 — DETAIL BARANG */}
        <FormSection
          title="Detail Barang"
          subtitle="Konfirmasi nama barang dan volume pesanan"
          icon={<Utensils className="w-3.5 h-3.5" />}
        >
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Nama Barang <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="input-followup-nama-barang"
                value={namaBarang}
                onChange={(e) => {
                  const val = e.target.value;
                  setNamaBarang(val);
                  const autoStore = guessStoreForItem(val, availableStores);
                  if (autoStore) setToko(autoStore);
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, namaBarang: true }))}
                placeholder="Contoh: Buncis, Ayam, Telur..."
                className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all ${
                  touched.namaBarang && !isItemValid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                }`}
              />
              {touched.namaBarang && !isItemValid && (
                <p className="text-[10px] font-semibold text-rose-600 mt-1">Nama barang wajib diisi</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
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
                  className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all text-center ${
                    touched.qty && !isQtyValid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                  }`}
                  placeholder="1"
                />
                {touched.qty && !isQtyValid && (
                  <p className="text-[10px] font-semibold text-rose-600 mt-1">Qty harus lebih dari 0</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Satuan
                </label>
                <select
                  id="select-followup-satuan"
                  value={satuan}
                  onChange={(e) => setSatuan(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
                >
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </FormSection>

        {/* SECTION 2 — TUJUAN PESANAN (Toko, Pemasok, Dapur) */}
        <FormSection
          title="Tujuan Pesanan"
          subtitle="Distribusi toko rekanan, pemasok & dapur pemesan"
          icon={<Store className="w-3.5 h-3.5" />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Toko <span className="text-rose-500">*</span>
              </label>
              <select
                id="select-followup-toko"
                value={toko}
                onChange={(e) => {
                  setToko(e.target.value);
                  setTouched((prev) => ({ ...prev, toko: true }));
                }}
                className={`w-full px-3 py-2 bg-white border rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer ${
                  touched.toko && !isStoreValid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                }`}
              >
                <option value="">-- Pilih Toko --</option>
                {availableStores.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {touched.toko && !isStoreValid && (
                <p className="text-[10px] font-semibold text-rose-600 mt-1">Pilih toko asal</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Pemasok <span className="text-rose-500">*</span>
              </label>
              <select
                id="select-followup-pemasok"
                value={pemasok}
                onChange={(e) => {
                  setPemasok(e.target.value);
                  setTouched((prev) => ({ ...prev, pemasok: true }));
                }}
                className={`w-full px-3 py-2 bg-white border rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer ${
                  touched.pemasok && !isSupplierValid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                }`}
              >
                <option value="">-- Pilih Pemasok --</option>
                {availablePemasok.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {touched.pemasok && !isSupplierValid && (
                <p className="text-[10px] font-semibold text-rose-600 mt-1">Pilih pemasok</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Dapur Tujuan <span className="text-rose-500">*</span>
              </label>
              <select
                id="select-followup-dapur"
                value={tujuanDapur}
                onChange={(e) => {
                  setTujuanDapur(e.target.value);
                  setTouched((prev) => ({ ...prev, tujuanDapur: true }));
                }}
                className={`w-full px-3 py-2 bg-white border rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer ${
                  touched.tujuanDapur && !isKitchenValid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                }`}
              >
                <option value="">-- Pilih Dapur --</option>
                {kitchens.map((k) => (
                  <option key={k.id} value={k.nama}>
                    Dapur {k.nama}
                  </option>
                ))}
              </select>
              {touched.tujuanDapur && !isKitchenValid && (
                <p className="text-[10px] font-semibold text-rose-600 mt-1">Pilih dapur tujuan</p>
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

        {/* SECTION 4 — TANGGAL PESANAN */}
        <FormSection
          title="Tanggal Transaksi"
          subtitle="Tanggal pencatatan pesanan ke sistem pembukuan"
          icon={<Calendar className="w-3.5 h-3.5" />}
        >
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Tanggal Pesanan
            </label>
            <input
              type="date"
              required
              id="input-followup-tanggal"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
            />
          </div>
        </FormSection>
      </form>
    </TransactionModalLayout>
  );
};
