import React, { useState, useMemo } from 'react';
import { 
  Truck, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Search, 
  MapPin, 
  Package, 
  ArrowRight, 
  RefreshCw,
  Check,
  Undo2,
  ChevronRight,
  Sparkles,
  LayoutGrid,
  List
} from 'lucide-react';
import { OrderItem, DeliveryStatus, Kitchen } from '../types';
import { getTodayWIB, formatTanggalWeb } from '../lib/formatters';

export interface DriverDeliveryViewProps {
  orders: OrderItem[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  onUpdateDeliveryStatus: (id: string, status: DeliveryStatus) => void;
  onUpdateGroupDeliveryStatus?: (groupItems: OrderItem[], status: DeliveryStatus) => void;
  kitchens?: Kitchen[];
}

export const DriverDeliveryView: React.FC<DriverDeliveryViewProps> = ({
  orders,
  selectedDate,
  onDateChange,
  onUpdateDeliveryStatus,
  onUpdateGroupDeliveryStatus,
  kitchens = [],
}) => {
  const [filterMode, setFilterMode] = useState<'pending' | 'done' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'all' | 'custom'>('today');
  const [viewStyle, setViewStyle] = useState<'card' | 'table'>('card');
  const today = getTodayWIB();

  // Melacak pesanan yang baru saja atau telah diselesaikan oleh driver
  const [driverCompletedIds, setDriverCompletedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('htg_driver_completed_ids');
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch (_) {}
    return new Set<string>();
  });

  // Helper: Hanya mengambil data yang delivery status-nya DRIVER (atau selesai oleh driver)
  const isDriverOrder = (o: OrderItem) => {
    const rawDel = (o.deliveryStatus || o.status_pengiriman || '').toString().toUpperCase();
    return rawDel === 'DRIVER' || (rawDel === 'DONE' && driverCompletedIds.has(o.id));
  };

  // Filter orders that belong strictly to DRIVER deliveries
  const driverOrders = useMemo(() => {
    return orders.filter((o) => {
      // Hanya data berstatus delivery DRIVER atau yang telah ditandai DONE oleh driver
      if (!isDriverOrder(o)) return false;

      // Date filtering
      if (dateFilterMode === 'today') {
        if (o.tanggal !== today) return false;
      } else if (dateFilterMode === 'custom' && selectedDate) {
        if (o.tanggal !== selectedDate) return false;
      }

      // Status filtering (Pending / Done / All)
      const rawDel = (o.deliveryStatus || o.status_pengiriman || '').toString().toUpperCase();
      const isDone = rawDel === 'DONE';
      if (filterMode === 'pending' && isDone) return false;
      if (filterMode === 'done' && !isDone) return false;

      // Text search (Dapur / Item)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const dapur = (o.tujuanDapur || '').toLowerCase();
        const item = (o.namaBarang || (o as any).item || '').toLowerCase();
        if (!dapur.includes(q) && !item.includes(q)) return false;
      }

      return true;
    });
  }, [orders, dateFilterMode, today, selectedDate, filterMode, searchQuery, driverCompletedIds]);

  // Summary counts for today/selected period (hanya pesanan DRIVER)
  const stats = useMemo(() => {
    const relevantDateOrders = orders.filter((o) => {
      if (!isDriverOrder(o)) return false;
      if (dateFilterMode === 'today') return o.tanggal === today;
      if (dateFilterMode === 'custom' && selectedDate) return o.tanggal === selectedDate;
      return true;
    });

    const total = relevantDateOrders.length;
    const done = relevantDateOrders.filter((o) => {
      const rawDel = (o.deliveryStatus || o.status_pengiriman || '').toString().toUpperCase();
      return rawDel === 'DONE';
    }).length;
    const pending = total - done;
    const kitchens = Array.from(new Set(relevantDateOrders.map((o) => o.tujuanDapur))).length;

    return { total, done, pending, kitchens };
  }, [orders, dateFilterMode, today, selectedDate, driverCompletedIds]);

  // Group items by Tujuan Dapur for driver convenience
  const kitchenGroups = useMemo(() => {
    const map = new Map<string, OrderItem[]>();
    driverOrders.forEach((item) => {
      const key = item.tujuanDapur || 'Dapur Belum Ditentukan';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    });

    return Array.from(map.entries()).map(([kitchenName, items]) => {
      const isAllDone = items.every((i) => {
        const rawDel = (i.deliveryStatus || i.status_pengiriman || '').toString().toUpperCase();
        return rawDel === 'DONE';
      });
      const kitchenInfo = kitchens.find((k) => k.nama.toLowerCase() === kitchenName.toLowerCase());

      return {
        kitchenName,
        kitchenLocation: kitchenInfo?.lokasi || '',
        items,
        isAllDone,
        doneCount: items.filter((i) => (i.deliveryStatus || i.status_pengiriman || '').toString().toUpperCase() === 'DONE').length,
      };
    });
  }, [driverOrders, kitchens]);

  // Handler to toggle an item delivery status
  const handleToggleItemStatus = (item: OrderItem) => {
    const currentDel = (item.deliveryStatus || item.status_pengiriman || '').toString().toUpperCase();
    const nextStatus: DeliveryStatus = currentDel === 'DONE' ? 'DRIVER' : 'DONE';

    setDriverCompletedIds((prev) => {
      const next = new Set(prev);
      if (nextStatus === 'DONE') {
        next.add(item.id);
      } else {
        next.delete(item.id);
      }
      try {
        localStorage.setItem('htg_driver_completed_ids', JSON.stringify(Array.from(next)));
      } catch (_) {}
      return next;
    });

    onUpdateDeliveryStatus(item.id, nextStatus);
  };

  // Handler to mark all items in a kitchen as DONE
  const handleCompleteKitchen = (items: OrderItem[]) => {
    setDriverCompletedIds((prev) => {
      const next = new Set(prev);
      items.forEach((it) => next.add(it.id));
      try {
        localStorage.setItem('htg_driver_completed_ids', JSON.stringify(Array.from(next)));
      } catch (_) {}
      return next;
    });

    if (onUpdateGroupDeliveryStatus) {
      onUpdateGroupDeliveryStatus(items, 'DONE');
    } else {
      items.forEach((it) => onUpdateDeliveryStatus(it.id, 'DONE'));
    }
  };

  return (
    <div className="space-y-4 pt-1 pb-12 max-w-5xl mx-auto font-sans">
      {/* 1. Header Card Khusus Driver (High-Contrast, Touch-Friendly) */}
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 rounded-3xl p-4 sm:p-6 text-white shadow-lg shadow-indigo-600/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-blue-100 text-[11px] font-bold tracking-wide uppercase">
              <Truck className="w-3.5 h-3.5 text-white" />
              <span>Portal Khusus Driver</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Pengiriman Hari Ini
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 font-medium">
              Daftar barang yang perlu diantar oleh driver ke dapur tujuan
            </p>
          </div>

          {/* Quick Date Switcher */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setDateFilterMode('today');
                onDateChange(today);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilterMode === 'today'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              Hari Ini ({formatTanggalWeb(today, false)})
            </button>

            <button
              type="button"
              onClick={() => setDateFilterMode('all')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilterMode === 'all'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              Semua Hari
            </button>

            <div className="relative inline-flex items-center bg-white/15 hover:bg-white/25 rounded-xl px-2.5 py-2 text-xs font-bold text-white transition-all cursor-pointer">
              <Calendar className="w-3.5 h-3.5 mr-1.5" />
              <span>{dateFilterMode === 'custom' ? formatTanggalWeb(selectedDate, false) : 'Pilih Tgl'}</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setDateFilterMode('custom');
                  onDateChange(e.target.value);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
              />
            </div>
          </div>
        </div>

        {/* 2. Progress Overview Banner */}
        <div className="mt-5 pt-4 border-t border-white/20 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/15">
            <div className="text-[10px] sm:text-xs font-bold text-blue-200 uppercase tracking-wider">
              Total Kiriman
            </div>
            <div className="text-xl sm:text-2xl font-black mt-0.5 font-nominal">
              {stats.total} <span className="text-xs font-normal">item</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/15">
            <div className="text-[10px] sm:text-xs font-bold text-blue-200 uppercase tracking-wider">
              Tujuan Dapur
            </div>
            <div className="text-xl sm:text-2xl font-black mt-0.5 font-nominal">
              {stats.kitchens} <span className="text-xs font-normal">lokasi</span>
            </div>
          </div>

          <div className="bg-amber-400/20 backdrop-blur-sm rounded-2xl p-3 border border-amber-300/30">
            <div className="text-[10px] sm:text-xs font-bold text-amber-200 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-300" />
              <span>Perlu Diantar</span>
            </div>
            <div className="text-xl sm:text-2xl font-black mt-0.5 text-amber-300 font-nominal">
              {stats.pending} <span className="text-xs font-normal">item</span>
            </div>
          </div>

          <div className="bg-emerald-400/20 backdrop-blur-sm rounded-2xl p-3 border border-emerald-300/30">
            <div className="text-[10px] sm:text-xs font-bold text-emerald-200 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-300" />
              <span>Selesai (Done)</span>
            </div>
            <div className="text-xl sm:text-2xl font-black mt-0.5 text-emerald-300 font-nominal">
              {stats.done} <span className="text-xs font-normal">item</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Toolbar Filter: Status, Pencarian & Tampilan */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Status Tab Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilterMode('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              filterMode === 'pending'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Perlu Diantar ({stats.pending})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('done')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              filterMode === 'done'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Selesai ({stats.done})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              filterMode === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Semua ({stats.total})
          </button>
        </div>

        {/* Pencarian Dapur atau Item & Style Switcher */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari dapur / nama barang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewStyle('card')}
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                viewStyle === 'card'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Tampilan Kartu Dapur"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewStyle('table')}
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                viewStyle === 'table'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Tampilan Tabel Baris"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Konten Pengiriman Driver */}
      {driverOrders.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto border border-blue-100 dark:border-blue-900/50">
            <Truck className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Tidak Ada Pengiriman Driver
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {filterMode === 'pending'
                ? 'Semua pengiriman driver untuk periode ini sudah selesai (Done) atau tidak ada kiriman terjadwal.'
                : 'Tidak ada data pengiriman yang berstatus DRIVER pada filter ini.'}
            </p>
          </div>
          {dateFilterMode !== 'all' && (
            <button
              type="button"
              onClick={() => setDateFilterMode('all')}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <span>Lihat Semua Tanggal</span>
            </button>
          )}
        </div>
      ) : viewStyle === 'card' ? (
        /* TAMPILAN 1: Kartu Group per Dapur (Sangat Praktis untuk Driver saat bongkar muat) */
        <div className="space-y-4">
          {kitchenGroups.map((group) => (
            <div
              key={group.kitchenName}
              className={`bg-white dark:bg-slate-900 rounded-3xl border transition-all overflow-hidden shadow-xs ${
                group.isAllDone
                  ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/20 dark:bg-emerald-950/10'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Header Dapur */}
              <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                    group.isAllDone
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                  }`}>
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-slate-100 leading-tight">
                      {group.kitchenName}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                      {group.kitchenLocation ? (
                        <span>{group.kitchenLocation} • </span>
                      ) : null}
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {group.items.length} Barang Kiriman
                      </span>
                      <span>({group.doneCount} Selesai)</span>
                    </p>
                  </div>
                </div>

                {/* Tombol Aksi Cepat Selesaikan Semua untuk Dapur Ini */}
                {!group.isAllDone && (
                  <button
                    type="button"
                    onClick={() => handleCompleteKitchen(group.items)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto min-h-[38px]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Tandai Semua Selesai di Dapur Ini</span>
                  </button>
                )}
              </div>

              {/* Daftar Barang di Dapur Ini */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {group.items.map((item) => {
                  const rawDel = (item.deliveryStatus || item.status_pengiriman || '').toString().toUpperCase();
                  const isDone = rawDel === 'DONE';

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isDone
                          ? 'bg-emerald-50/30 dark:bg-emerald-950/10'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                        }`}>
                          <Package className="w-4 h-4" />
                        </div>

                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-slate-900 dark:text-slate-100 break-words">
                              {item.namaBarang}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {formatTanggalWeb(item.tanggal, false)}
                            </span>
                          </div>

                          <div className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                            <span className="text-blue-700 dark:text-blue-400 text-sm">
                              Jumlah: <strong>{item.qty} {item.satuan || 'Kg'}</strong>
                            </span>
                            {item.catatan && item.catatan.trim() && (
                              <span className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800 font-sans font-medium">
                                Catatan: {item.catatan}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tombol Klik DONE untuk Driver (Touch Target Besar & Jelas) */}
                      <button
                        type="button"
                        onClick={() => handleToggleItemStatus(item)}
                        className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer active:scale-95 shrink-0 min-h-[44px] sm:min-w-[150px] shadow-xs ${
                          isDone
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/25 ring-2 ring-blue-400/30'
                        }`}
                      >
                        {isDone ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                            <span>✓ Selesai Dikirim</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 stroke-[2.8]" />
                            <span>Tandai Selesai</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TAMPILAN 2: Tabel Baris Ringkas Khusus Driver (Tanggal, Tujuan Dapur, Item, QTY, Status) */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] sm:text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-3 text-center">NO</th>
                  <th className="py-3 px-3">TANGGAL</th>
                  <th className="py-3 px-3">TUJUAN DAPUR</th>
                  <th className="py-3 px-3">ITEM</th>
                  <th className="py-3 px-3 text-center">QTY</th>
                  <th className="py-3 px-3 text-center">STATUS PENGIRIM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
                {driverOrders.map((item, idx) => {
                  const rawDel = (item.deliveryStatus || item.status_pengiriman || '').toString().toUpperCase();
                  const isDone = rawDel === 'DONE';

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                        isDone ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center font-mono text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                        {formatTanggalWeb(item.tanggal, false)}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>{item.tujuanDapur}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                        <div>{item.namaBarang}</div>
                        {item.catatan && item.catatan.trim() && (
                          <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                            Catatan: {item.catatan}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {item.qty} {item.satuan || 'Kg'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleItemStatus(item)}
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 min-h-[36px] shadow-2xs ${
                            isDone
                              ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          {isDone ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Done</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Tandai Done</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
