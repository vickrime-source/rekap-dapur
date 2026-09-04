import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Save, 
  Plus, 
  Utensils, 
  Store, 
  Truck, 
  Calendar, 
  Trash2
} from 'lucide-react';
import { OrderItem, Kitchen, Store as StoreType } from '../types';
import { formatRupiah, formatRupiahInput, parseRupiahInput } from '../lib/formatters';
import { getItemSuggestions } from '../lib/suggestions';
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
      setToko(initialData.toko);
      setTujuanDapur(initialData.tujuanDapur);
      setPemasok(initialData.pemasok);
      setPaymentStatus(initialData.paymentStatus || (initialData.status === 'selesai' ? 'PAID' : 'UNPAID'));
      setDeliveryStatus(initialData.deliveryStatus || (initialData.status === 'selesai' ? 'DONE' : 'PENDING'));
      setTanggal(initialData.tanggal);
      setCatatan(initialData.catatan || '');
    } else {
      setItemRows([
        {
          id: Date.now().toString(),
          namaBarang: '',
          qty: 1,
          hargaBeli: '',
          hargaJual: '',
        },
      ]);
      setToko(stores[0]?.nama || 'HTG');
      setTujuanDapur(prefilledKitchen || kitchens[0]?.nama || 'Siliragung');
      setPemasok(pemasokList[0] || 'Pemasok 1');
      setPaymentStatus('UNPAID');
      setDeliveryStatus('PENDING');
      setTanggal(selectedDate || new Date().toISOString().split('T')[0]);
      setCatatan('');
    }
  }, [initialData, prefilledKitchen, isOpen, kitchens, stores, pemasokList, selectedDate]);

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
      const results = getItemSuggestions(val, [], 6);
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
        // Requirement 5: Auto-select suggestion on Enter
        e.preventDefault();
        const chosen = suggestions[selectedSugIdx];
        if (chosen) {
          updateItemRow(rowId, 'namaBarang', chosen);
          setActiveSuggestionRowId(null);
        }
      } else if (e.key === 'Escape') {
        setActiveSuggestionRowId(null);
      }
    }
  };

  const selectSuggestion = (rowId: string, itemText: string) => {
    updateItemRow(rowId, 'namaBarang', itemText);
    setActiveSuggestionRowId(null);
  };

  const isFormValid =
    tanggal.trim() !== '' &&
    toko !== '' &&
    toko !== '-' &&
    tujuanDapur !== '' &&
    tujuanDapur !== '-' &&
    pemasok !== '' &&
    pemasok !== '-' &&
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
    if (!isFormValid) {
      alert('Mohon lengkapi semua kolom wajib (Tanggal, Nama Barang, Toko, Dapur, Pemasok, Harga Beli, Harga Jual, Qty).');
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs no-print">
        {/* Backdrop click to dismiss */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ y: 15, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 15, opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-10 max-h-[90vh] flex flex-col font-sans"
        >
          {/* Header Putih / Netral Bersih */}
          <div className="px-6 py-4 bg-white flex items-center justify-between border-b border-slate-200">
            <h2 className="text-[18px] font-bold text-slate-800 tracking-tight">
              {initialData ? 'Edit Pesanan Dapur' : 'Input Pesanan Baru'}
            </h2>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-slate-800">
            {/* Grid Tanggal, Toko, Dapur, Pemasok */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
              {/* Tanggal */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tanggal</span>
                </label>
                <input
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                />
              </div>

              {/* Toko */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-slate-500" />
                  <span>Toko</span>
                </label>
                <select
                  value={toko}
                  onChange={(e) => setToko(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 cursor-pointer"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.nama}>
                      {s.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dapur */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-slate-500" />
                  <span>Dapur</span>
                </label>
                <select
                  value={tujuanDapur}
                  onChange={(e) => setTujuanDapur(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 cursor-pointer"
                >
                  {kitchens.map((k) => (
                    <option key={k.id} value={k.nama}>
                      Dapur {k.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pemasok */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Pemasok</span>
                </label>
                <select
                  value={pemasok}
                  onChange={(e) => setPemasok(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 cursor-pointer"
                >
                  {pemasokList.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* List of Items / Barang */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pt-1">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Daftar Barang ({itemRows.length})
                </h3>
              </div>

              {itemRows.map((row, index) => {
                const isSuggestionOpen = activeSuggestionRowId === row.id && suggestions.length > 0;

                return (
                  <div
                    key={row.id}
                    className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3 relative"
                  >
                    {/* Header item jika ada lebih dari 1 barang */}
                    {itemRows.length > 1 && (
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <span className="text-xs font-bold text-slate-700">
                          Barang {index + 1}
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
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Nama Barang
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Nama barang..."
                        value={row.namaBarang}
                        onChange={(e) => handleItemNameChange(row.id, e.target.value)}
                        onKeyDown={(e) => handleItemKeyDown(row.id, e)}
                        onFocus={() => {
                          if (row.namaBarang.trim().length >= 1) {
                            const results = getItemSuggestions(row.namaBarang, [], 6);
                            setSuggestions(results);
                            setActiveSuggestionRowId(row.id);
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                      />

                      {/* Dropdown Suggestions Popover */}
                      {isSuggestionOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 overflow-hidden py-1 divide-y divide-slate-100">
                          <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase bg-slate-50 flex items-center justify-between">
                            <span>Saran Barang</span>
                            <span className="font-mono text-[9px] text-slate-500">↵ Enter</span>
                          </div>
                          {suggestions.map((sug, sIdx) => (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => selectSuggestion(row.id, sug)}
                              onMouseEnter={() => setSelectedSugIdx(sIdx)}
                              className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                                sIdx === selectedSugIdx
                                  ? 'bg-indigo-50 text-indigo-700'
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

                    {/* QTY, HARGA BELI, HARGA JUAL */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Jumlah (Qty)
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={row.qty}
                          onChange={(e) => updateItemRow(row.id, 'qty', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-semibold font-mono text-center focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Harga Beli
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Rp 0"
                          value={row.hargaBeli !== '' ? formatRupiahInput(row.hargaBeli) : ''}
                          onChange={(e) => updateItemRow(row.id, 'hargaBeli', parseRupiahInput(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-semibold font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Harga Jual
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Rp 0"
                          value={row.hargaJual !== '' ? formatRupiahInput(row.hargaJual) : ''}
                          onChange={(e) => updateItemRow(row.id, 'hargaJual', parseRupiahInput(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-semibold font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {!initialData && (
                <button
                  type="button"
                  onClick={addItemRow}
                  className="w-full py-2.5 border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/70 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-slate-500" />
                  <span>+ Tambah Barang</span>
                </button>
              )}
            </div>

            {/* Status Pembayaran & Pengiriman (Warna Soft / Border) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Status Pembayaran
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('UNPAID')}
                    className={`py-2 px-3 text-xs rounded-lg border transition-all cursor-pointer text-center ${
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
                    className={`py-2 px-3 text-xs rounded-lg border transition-all cursor-pointer text-center ${
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
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Status Pengiriman
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryStatus('PENDING')}
                    className={`py-2 px-3 text-xs rounded-lg border transition-all cursor-pointer text-center ${
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
                    className={`py-2 px-3 text-xs rounded-lg border transition-all cursor-pointer text-center ${
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
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Total Penjualan</span>
                <span className="font-bold text-slate-900 text-sm font-mono">
                  {formatRupiah(grandTotalJual)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500 font-medium block">Total Beli</span>
                <span className="font-semibold text-slate-700 text-xs font-mono">
                  {formatRupiah(grandTotalBeli)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!isFormValid}
                className={`py-2 px-5 rounded-lg text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  isFormValid
                    ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-xs'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
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
