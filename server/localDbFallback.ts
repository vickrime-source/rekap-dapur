import fs from 'fs';
import path from 'path';

export interface FallbackMasterToko {
  id: string;
  nama: string;
  created_at: string;
  updated_at?: string;
}

export interface FallbackMasterPemasok {
  id: string;
  nama: string;
  created_at: string;
  updated_at?: string;
}

export interface FallbackMasterDapur {
  id: string;
  nama: string;
  alamat: string;
  created_at: string;
  updated_at?: string;
}

export interface FallbackMasterSatuan {
  id: string;
  nama: string;
  created_at: string;
  updated_at?: string;
}

export interface FallbackOrder {
  id: string;
  dapur: string;
  dapur_id?: string;
  item: string;
  tanggal: string;
  qty: number;
  qty_beli?: number;
  nota_id?: string;
  satuan: string;
  toko: string;
  toko_id?: string;
  pemasok: string;
  pemasok_id?: string;
  status_pembayaran: string;
  status_pengiriman: string;
  status: string;
  status_pembatalan?: string;
  cancelled_at?: string;
  cancelled_reason?: string;
  harga_jual: number;
  harga_beli: number;
  cashback?: number;
  retur?: number;
  catatan: string;
  created_at: string;
  updated_at: string;
}

export interface FallbackTransaction {
  id: string;
  invoice_number?: string;
  tanggal: string;
  tanggal_print?: string;
  pemasok: string;
  pemasok_id?: string;
  barang: string;
  toko: string;
  toko_id?: string;
  dapur: string;
  dapur_id?: string;
  qty: number;
  harga_beli: number;
  total: number;
  total_profit: number;
  status_pembayaran: string;
  items: any[];
  created_at: string;
  updated_at: string;
}

export interface FallbackNote {
  id: string;
  dapur: string;
  item: string;
  qty: number | null;
  satuan: string;
  catatan: string;
  status: string;
  is_done: boolean;
  order_id: string | null;
  created_at: string;
  updated_at: string;
}

interface LocalDatabase {
  pesanan: FallbackOrder[];
  transaksi: FallbackTransaction[];
  notes: FallbackNote[];
  toko: FallbackMasterToko[];
  pemasok: FallbackMasterPemasok[];
  dapur: FallbackMasterDapur[];
  satuan: FallbackMasterSatuan[];
}

const INITIAL_SATUAN_SEED: FallbackMasterSatuan[] = [
  { id: 'satuan-kg', nama: 'Kg', created_at: new Date().toISOString() },
  { id: 'satuan-gram', nama: 'Gram', created_at: new Date().toISOString() },
  { id: 'satuan-pcs', nama: 'Pcs', created_at: new Date().toISOString() },
  { id: 'satuan-ikat', nama: 'Ikat', created_at: new Date().toISOString() },
  { id: 'satuan-tray', nama: 'Tray', created_at: new Date().toISOString() },
  { id: 'satuan-pack', nama: 'Pack', created_at: new Date().toISOString() },
  { id: 'satuan-liter', nama: 'Liter', created_at: new Date().toISOString() },
  { id: 'satuan-box', nama: 'Box', created_at: new Date().toISOString() },
  { id: 'satuan-karung', nama: 'Karung', created_at: new Date().toISOString() },
  { id: 'satuan-ekor', nama: 'Ekor', created_at: new Date().toISOString() },
  { id: 'satuan-krat', nama: 'Krat', created_at: new Date().toISOString() },
  { id: 'satuan-dus', nama: 'Dus', created_at: new Date().toISOString() },
  { id: 'satuan-bungkus', nama: 'Bungkus', created_at: new Date().toISOString() },
];

const INITIAL_TOKO_SEED: FallbackMasterToko[] = [
  { id: 'toko-lb', nama: 'LB / Luweng Boga', created_at: new Date().toISOString() },
  { id: 'toko-htg', nama: 'HTG', created_at: new Date().toISOString() },
  { id: 'toko-la', nama: 'LA / Lumbung Adifruta', created_at: new Date().toISOString() },
  { id: 'toko-pw', nama: 'PW / Prohe', created_at: new Date().toISOString() },
];

const INITIAL_PEMASOK_SEED: FallbackMasterPemasok[] = [
  { id: 'pemasok-ajeng-fruits', nama: 'Ajeng fruits', created_at: new Date().toISOString() },
  { id: 'pemasok-sari-buah', nama: 'Sari buah', created_at: new Date().toISOString() },
  { id: 'pemasok-buah-mulyo', nama: 'Buah mulyo', created_at: new Date().toISOString() },
  { id: 'pemasok-arnis-buah', nama: 'Arnis buah', created_at: new Date().toISOString() },
  { id: 'pemasok-pmb', nama: 'PMB', created_at: new Date().toISOString() },
  { id: 'pemasok-diah-buah', nama: 'Diah Buah', created_at: new Date().toISOString() },
  { id: 'pemasok-pak-jarwo', nama: 'Pak Jarwo', created_at: new Date().toISOString() },
  { id: 'pemasok-handoyo', nama: 'Handoyo', created_at: new Date().toISOString() },
  { id: 'pemasok-pak-nyoto', nama: 'Pak nyoto', created_at: new Date().toISOString() },
  { id: 'pemasok-pak-bahtiar', nama: 'Pak bahtiar', created_at: new Date().toISOString() },
  { id: 'pemasok-salak-senepo', nama: 'Salak senepo', created_at: new Date().toISOString() },
  { id: 'pemasok-crystal-fruits', nama: 'Crystal fruits', created_at: new Date().toISOString() },
  { id: 'pemasok-indo-sayur', nama: 'indo sayur', created_at: new Date().toISOString() },
  { id: 'pemasok-toko-daging-sapi-bwi', nama: 'Toko daging sapi banyuwangi', created_at: new Date().toISOString() },
  { id: 'pemasok-raja-ayam', nama: 'Raja ayam', created_at: new Date().toISOString() },
  { id: 'pemasok-bu-tiah', nama: 'Bu Tiah', created_at: new Date().toISOString() },
  { id: 'pemasok-vazio', nama: 'Vazio', created_at: new Date().toISOString() },
  { id: 'pemasok-pak-hadi', nama: 'Pak Hadi', created_at: new Date().toISOString() },
  { id: 'pemasok-yogo', nama: 'Yogo', created_at: new Date().toISOString() },
  { id: 'pemasok-roti-pradana', nama: 'Roti Pradana', created_at: new Date().toISOString() },
  { id: 'pemasok-pak-toha', nama: 'Pak Toha', created_at: new Date().toISOString() },
  { id: 'pemasok-nur-cavendish', nama: 'Nur Cavendish', created_at: new Date().toISOString() },
  { id: 'pemasok-juhari-cavendish', nama: 'Juhari Cavendish', created_at: new Date().toISOString() },
  { id: 'pemasok-mecca', nama: 'Mecca', created_at: new Date().toISOString() },
  { id: 'pemasok-lontong-sempu', nama: 'Lontong sempu', created_at: new Date().toISOString() },
  { id: 'pemasok-ladju-snack', nama: 'Ladju snack', created_at: new Date().toISOString() },
  { id: 'pemasok-pak-adi-edamame', nama: 'Pak adi edamame', created_at: new Date().toISOString() },
  { id: 'pemasok-pak-wargito-ndok-asin', nama: 'Pak wargito Ndok Asin', created_at: new Date().toISOString() },
  { id: 'pemasok-suparti', nama: 'Suparti', created_at: new Date().toISOString() },
  { id: 'pemasok-eko-lele', nama: 'Eko lele', created_at: new Date().toISOString() },
  { id: 'pemasok-king', nama: 'King', created_at: new Date().toISOString() },
  { id: 'pemasok-nur-patin', nama: 'Nur patin', created_at: new Date().toISOString() },
  { id: 'pemasok-nanik-tuna', nama: 'Nanik tuna', created_at: new Date().toISOString() },
  { id: 'pemasok-rambo-jambu-citra', nama: 'Rambo Jambu citra', created_at: new Date().toISOString() },
];

const INITIAL_DAPUR_SEED: FallbackMasterDapur[] = [
  { id: 'dapur-kedayunan', nama: 'Kedayunan', alamat: 'Kec. Kabat, Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-siliragung', nama: 'Siliragung', alamat: 'Kec. Siliragung, Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-banjarsari', nama: 'Banjarsari 2', alamat: 'Kec. Glagah, Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-wringinputih-2', nama: 'Wringinputih 2', alamat: 'Kec. Muncar, Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-wringinputih-4', nama: 'Wringinputih 4', alamat: 'Kec. Muncar, Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-singojuruh', nama: 'Singojuruh', alamat: 'Kec. Singojuruh, Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-cluring', nama: 'Cluring', alamat: 'Kec. Cluring, Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-tamansari', nama: 'Tamansari', alamat: 'Kec. Licin, Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-wongsorejo', nama: 'Wongsorejo', alamat: 'Kec. Wongsorejo, Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-sumberagung', nama: 'Sumberagung', alamat: 'Kec. Pesanggaran, Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-mojoroto', nama: 'Mojoroto', alamat: 'Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-tapanrejo', nama: 'Tapanrejo', alamat: 'Kec. Muncar, Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-kendalrejo', nama: 'Kendalrejo', alamat: 'Kec. Tegaldlimo, Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-gambiran', nama: 'Gambiran', alamat: 'Kec. Gambiran, Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-pidis', nama: 'Pidis', alamat: 'Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-kesilir-2', nama: 'Kesilir 2', alamat: 'Kec. Siliragung, Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-mufid', nama: 'Mufid', alamat: 'Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-rejoagung', nama: 'Rejoagung', alamat: 'Kec. Srono, Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-ajeng', nama: 'Ajeng', alamat: 'Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-pesanggaran', nama: 'Pesanggaran', alamat: 'Kec. Pesanggaran, Banyuwangi', created_at: new Date().toISOString() },
  { id: 'dapur-bangorejo', nama: 'Bangorejo', alamat: 'Kec. Bangorejo, Banyuwangi', created_at: new Date().toISOString() },
];

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'local_db.json');

let inMemoryDb: LocalDatabase | null = null;

function loadDb(): LocalDatabase {
  if (inMemoryDb) return inMemoryDb;

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      inMemoryDb = JSON.parse(content);
      if (!inMemoryDb!.pesanan) inMemoryDb!.pesanan = [];
      if (!inMemoryDb!.transaksi) inMemoryDb!.transaksi = [];
      if (!inMemoryDb!.notes) inMemoryDb!.notes = [];
      if (!inMemoryDb!.toko || inMemoryDb!.toko.length === 0) inMemoryDb!.toko = [...INITIAL_TOKO_SEED];
      if (!inMemoryDb!.pemasok || inMemoryDb!.pemasok.length === 0) inMemoryDb!.pemasok = [...INITIAL_PEMASOK_SEED];
      if (!inMemoryDb!.dapur || inMemoryDb!.dapur.length === 0) inMemoryDb!.dapur = [...INITIAL_DAPUR_SEED];
      if (!inMemoryDb!.satuan || inMemoryDb!.satuan.length === 0) inMemoryDb!.satuan = [...INITIAL_SATUAN_SEED];
      return inMemoryDb!;
    }
  } catch (e) {
    console.warn('[LocalDbFallback] Gagal membaca data dari file, menggunakan memori:', e);
  }

  inMemoryDb = {
    pesanan: [],
    transaksi: [],
    notes: [],
    toko: [...INITIAL_TOKO_SEED],
    pemasok: [...INITIAL_PEMASOK_SEED],
    dapur: [...INITIAL_DAPUR_SEED],
    satuan: [...INITIAL_SATUAN_SEED],
  };
  return inMemoryDb;
}

function saveDb() {
  if (!inMemoryDb) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(inMemoryDb, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[LocalDbFallback] Gagal menyimpan data ke file:', e);
  }
}

// ---------------------------------------------------------------------------
// ORDERS (pesanan)
// ---------------------------------------------------------------------------
export function getLocalOrders(filters: any = {}): FallbackOrder[] {
  const db = loadDb();
  let list = [...db.pesanan];

  if (filters.startDate && filters.endDate) {
    list = list.filter((o) => o.tanggal >= filters.startDate && o.tanggal <= filters.endDate);
  } else if (filters.period && filters.period !== 'all_time') {
    const today = new Date().toISOString().split('T')[0];
    const refDate = filters.date || today;

    if (filters.period === 'hari_ini') {
      list = list.filter((o) => o.tanggal === refDate);
    } else if (filters.period === 'mingguan') {
      const cur = new Date(refDate);
      const day = cur.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(cur);
      monday.setDate(cur.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const startStr = monday.toISOString().split('T')[0];
      const endStr = sunday.toISOString().split('T')[0];
      list = list.filter((o) => o.tanggal >= startStr && o.tanggal <= endStr);
    } else if (filters.period === 'bulan_ini') {
      const [y, m] = refDate.split('-');
      const prefix = `${y}-${m}`;
      list = list.filter((o) => o.tanggal.startsWith(prefix));
    }
  } else if (filters.date) {
    list = list.filter((o) => o.tanggal === filters.date);
  }

  if (filters.toko) list = list.filter((o) => o.toko === filters.toko);
  if (filters.dapur) list = list.filter((o) => o.dapur === filters.dapur);
  if (filters.pemasok) list = list.filter((o) => o.pemasok === filters.pemasok);
  if (filters.status) list = list.filter((o) => o.status === filters.status);

  // Sort descending by tanggal, then created_at
  list.sort((a, b) => {
    if (b.tanggal !== a.tanggal) return b.tanggal.localeCompare(a.tanggal);
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

  if (filters.limit) {
    list = list.slice(0, filters.limit);
  }

  return list;
}

export function createLocalOrders(records: any[]): FallbackOrder[] {
  const db = loadDb();
  const created: FallbackOrder[] = [];

  let rawList: any[];
  if (Array.isArray(records)) {
    rawList = records;
  } else if (records && typeof records === 'object') {
    if (Array.isArray((records as any).items)) {
      rawList = (records as any).items;
    } else if (Array.isArray((records as any).data)) {
      rawList = (records as any).data;
    } else {
      rawList = [records];
    }
  } else {
    rawList = [];
  }

  const list: any[] = [];
  for (const entry of rawList) {
    if (Array.isArray(entry)) {
      list.push(...entry);
    } else if (entry && typeof entry === 'object' && Array.isArray(entry.items)) {
      list.push(...entry.items);
    } else if (entry && typeof entry === 'object' && Array.isArray(entry.data)) {
      list.push(...entry.data);
    } else if (entry && typeof entry === 'object') {
      list.push(entry);
    }
  }

  for (const item of list) {
    const rawDapur = (item.dapur || item.tujuanDapur || item.tujuan_dapur || '').toString().trim();
    const rawItem = (item.item || item.namaBarang || item.nama_barang || '').toString().trim();
    if (!rawItem || !rawDapur) continue;

    const id = item.id ? String(item.id) : `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const rawQty = Number(item.qty) || 0;
    const rawQtyBeli = item.qty_beli !== undefined ? Number(item.qty_beli) : (item.qtyBeli !== undefined ? Number(item.qtyBeli) : rawQty);
    const newOrd: FallbackOrder = {
      id,
      dapur: rawDapur,
      item: rawItem,
      tanggal: item.tanggal || new Date().toISOString().split('T')[0],
      qty: rawQty,
      qty_beli: rawQtyBeli,
      nota_id: item.nota_id || item.notaId || null,
      satuan: item.satuan || 'Kg',
      toko: item.toko || '',
      pemasok: item.pemasok || '',
      status_pembayaran: item.status_pembayaran || item.paymentStatus || 'UNPAID',
      status_pengiriman: item.status_pengiriman || item.deliveryStatus || 'PENDING',
      status: item.status || 'pending',
      harga_jual: Number(item.harga_jual !== undefined ? item.harga_jual : item.hargaJual) || 0,
      harga_beli: Number(item.harga_beli !== undefined ? item.harga_beli : item.hargaBeli) || 0,
      cashback: Number(item.cashback) || 0,
      retur: Math.max(0, Number(item.retur) || 0),
      catatan: item.catatan || '',
      created_at: item.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.pesanan.push(newOrd);
    created.push(newOrd);
  }

  saveDb();
  return created;
}

export function updateLocalOrder(id: string, updates: any): FallbackOrder | null {
  const db = loadDb();
  const index = db.pesanan.findIndex((o) => o.id === id);
  if (index === -1) return null;

  const current = db.pesanan[index];
  const updated: FallbackOrder = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  db.pesanan[index] = updated;
  saveDb();
  return updated;
}

export function updateBatchLocalOrders(ids: string[], updates: any): FallbackOrder[] {
  const db = loadDb();
  const updated: FallbackOrder[] = [];

  for (let i = 0; i < db.pesanan.length; i++) {
    if (ids.includes(db.pesanan[i].id)) {
      db.pesanan[i] = {
        ...db.pesanan[i],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      updated.push(db.pesanan[i]);
    }
  }

  saveDb();
  return updated;
}

export function deleteLocalOrders(ids: string[]): { deletedCount: number; softDeleted: boolean; status: string } {
  const db = loadDb();
  let cancelledCount = 0;
  const nowIso = new Date().toISOString();

  db.pesanan = db.pesanan.map((o) => {
    if (ids.includes(o.id)) {
      cancelledCount++;
      return {
        ...o,
        status: 'CANCELLED',
        cancelled_at: nowIso,
        status_pembatalan: 'DIBATALKAN',
        updated_at: nowIso,
      };
    }
    return o;
  });

  saveDb();
  return { deletedCount: cancelledCount, softDeleted: true, status: 'CANCELLED' };
}

// ---------------------------------------------------------------------------
// TRANSACTIONS (transaksi)
// ---------------------------------------------------------------------------
export function getLocalTransactions(limit: number = 500): FallbackTransaction[] {
  const db = loadDb();
  const list = [...db.transaksi];
  list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
  return list.slice(0, Math.min(limit || 500, 5000));
}

export function createLocalTransaction(tx: any): FallbackTransaction {
  const db = loadDb();
  const id = tx.id ? String(tx.id) : `trx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const record: FallbackTransaction = {
    id,
    invoice_number: tx.invoice_number || tx.invoiceNumber || `INV-${Date.now()}`,
    tanggal: tx.tanggal || new Date().toISOString().split('T')[0],
    tanggal_print: tx.tanggal_print || tx.tanggalPrint || new Date().toLocaleDateString('id-ID'),
    pemasok: tx.pemasok || '',
    barang: tx.barang || '',
    toko: tx.toko || '',
    dapur: tx.dapur || '',
    qty: Number(tx.qty) || 0,
    harga_beli: Number(tx.harga_beli) || 0,
    total: Number(tx.total) || 0,
    total_profit: Number(tx.total_profit) || 0,
    status_pembayaran: tx.status_pembayaran || 'PAID',
    items: Array.isArray(tx.items) ? tx.items : [],
    created_at: tx.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.transaksi.push(record);
  saveDb();
  return record;
}

export function deleteLocalTransactions(ids: string[]): { deletedCount: number } {
  const db = loadDb();
  const prevCount = db.transaksi.length;
  db.transaksi = db.transaksi.filter((t) => !ids.includes(t.id));
  const deletedCount = prevCount - db.transaksi.length;
  saveDb();
  return { deletedCount };
}

// ---------------------------------------------------------------------------
// NOTES (notes)
// ---------------------------------------------------------------------------
export function getLocalNotes(): FallbackNote[] {
  const db = loadDb();
  const list = [...db.notes];
  list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return list;
}

export function createLocalNote(note: any): FallbackNote {
  const db = loadDb();
  const id = note.id ? String(note.id) : `nt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const isDone = Boolean(note.is_done !== undefined ? note.is_done : note.isDone);
  const record: FallbackNote = {
    id,
    dapur: note.dapur || note.tujuanDapur || '',
    item: note.item || note.namaBarang || '',
    qty: note.qty !== undefined && note.qty !== null ? Number(note.qty) : null,
    satuan: note.satuan || 'Kg',
    catatan: note.catatan || '',
    status: note.status || (isDone ? 'DONE' : 'FOLLOW UP'),
    is_done: isDone,
    order_id: note.order_id || note.orderId || null,
    created_at: note.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.notes.push(record);
  saveDb();
  return record;
}

export function updateLocalNote(id: string, updates: any): FallbackNote | null {
  const db = loadDb();
  const index = db.notes.findIndex((n) => n.id === id);
  if (index === -1) return null;

  const current = db.notes[index];
  const isDone = updates.is_done !== undefined ? Boolean(updates.is_done) : (updates.isDone !== undefined ? Boolean(updates.isDone) : current.is_done);
  const updated: FallbackNote = {
    ...current,
    ...updates,
    is_done: isDone,
    status: isDone ? 'DONE' : (updates.status || current.status),
    updated_at: new Date().toISOString(),
  };

  db.notes[index] = updated;
  saveDb();
  return updated;
}

export function deleteLocalNote(id: string): { success: boolean } {
  const db = loadDb();
  db.notes = db.notes.filter((n) => n.id !== id);
  saveDb();
  return { success: true };
}

// ---------------------------------------------------------------------------
// PERIOD SUMMARY FROM LOCAL DB
// REVENUE RECOGNITION (BASIS AKRUAL):
// Omzet diakui saat pesanan dibuat/dikirim ke dapur (seluruh pesanan non-CANCELLED, baik status PAID maupun UNPAID).
// Formula:
//   qty_final = qty_jual - retur
//   qty_beli_efektif = qty_beli - retur
//   omzet = harga_jual * qty_final
//   modal = harga_beli * qty_beli_efektif
//   cashback = 0 -> laba_bersih = omzet - modal, ke_koperasi = 0
//   cashback > 0 -> laba_bersih = (cashback - harga_beli) * qty_final, ke_koperasi = (harga_jual - cashback) * qty_final
// Retur ditanggung penuh pemasok, tidak memotong modal toko.
// ---------------------------------------------------------------------------
export function getLocalPeriodSummary(
  period: string = 'mingguan',
  targetDate?: string,
  startDate?: string,
  endDate?: string
) {
  const orders = getLocalOrders({ period, date: targetDate, startDate, endDate });

  let totalQty = 0;
  let totalPendapatan = 0;
  let totalPengeluaran = 0;
  let totalLabaBersih = 0;
  let totalKeKoperasi = 0;
  const storeMap: Record<string, any> = {};
  const globalBatchKeys = new Set<string>();

  for (const item of orders) {
    if (item.status === 'CANCELLED') continue;

    const rawQtyJual = Number(item.qty) || 0;
    const rawQtyBeli = (item as any).qty_beli !== undefined && (item as any).qty_beli !== null
      ? Number((item as any).qty_beli)
      : ((item as any).qtyBeli !== undefined && (item as any).qtyBeli !== null
        ? Number((item as any).qtyBeli)
        : rawQtyJual);
    const ret = Math.max(0, Number(item.retur) || 0);
    const qtyFinal = Math.max(0, rawQtyJual - ret);
    const qtyBeliEfektif = Math.max(0, rawQtyBeli - ret);

    const beli = Number(item.harga_beli) || 0;
    const jual = Number(item.harga_jual) || 0;
    const cb = Number(item.cashback) || 0;

    const modalItem = qtyBeliEfektif * beli;
    const omzetItem = qtyFinal * jual;
    const labaBersihItem = cb > 0 ? ((cb - beli) * qtyFinal) : (omzetItem - modalItem);
    const keKoperasiItem = cb > 0 ? ((jual - cb) * qtyFinal) : 0;

    // Retur berarti barang tidak jadi dibeli/terjual. Breakdown harus
    // konsisten dengan total utama dan memakai qty beli efektif.
    const modalTokoItem = modalItem;

    totalQty += qtyFinal;
    totalPendapatan += omzetItem;
    totalPengeluaran += modalItem;
    totalLabaBersih += labaBersihItem;
    totalKeKoperasi += keKoperasiItem;

    const tokoKey = (item.toko || 'Lainnya').trim() || 'Lainnya';
    if (!storeMap[tokoKey]) {
      storeMap[tokoKey] = {
        totalQty: 0,
        totalBeli: 0,
        totalJual: 0,
        totalLabaBersih: 0,
        totalKeKoperasi: 0,
        count: 0,
        pemasokSet: new Set<string>(),
        batchKeys: new Set<string>(),
      };
    }
    storeMap[tokoKey].totalQty += qtyFinal;
    storeMap[tokoKey].totalBeli += modalTokoItem;
    storeMap[tokoKey].totalJual += omzetItem;
    storeMap[tokoKey].totalLabaBersih += labaBersihItem;
    storeMap[tokoKey].totalKeKoperasi += keKoperasiItem;
    storeMap[tokoKey].count += 1;
    if (item.pemasok && item.pemasok.trim() && item.pemasok.trim() !== '-') {
      storeMap[tokoKey].pemasokSet.add(item.pemasok.trim());
    }

    const bKey = item.nota_id || `${item.tanggal}_${item.dapur}_${item.toko}_${item.created_at || ''}`;
    storeMap[tokoKey].batchKeys.add(bKey);
    globalBatchKeys.add(bKey);
  }

  const storeBreakdowns = Object.entries(storeMap)
    .map(([toko, val]: [string, any]) => {
      const profit = val.totalLabaBersih;
      const marginPercent = val.totalJual > 0 ? Math.round((profit / val.totalJual) * 100) : 0;
      return {
        toko,
        totalQty: val.totalQty,
        totalBeli: val.totalBeli,
        totalJual: val.totalJual,
        profit,
        totalKeKoperasi: val.totalKeKoperasi,
        orderCount: val.count,
        transactionCount: val.batchKeys.size || val.count,
        pemasokList: Array.from(val.pemasokSet),
        percentageOfTotalBeli: totalPengeluaran > 0 ? (val.totalBeli / totalPengeluaran) * 100 : 0,
        percentageOfTotalJual: totalPendapatan > 0 ? (val.totalJual / totalPendapatan) * 100 : 0,
        marginPercent,
      };
    })
    .sort((a, b) => b.totalJual - a.totalJual);

  return {
    period,
    totalQty,
    totalTransactions: globalBatchKeys.size || orders.length,
    totalPendapatan,
    totalPengeluaran,
    profitBersih: totalLabaBersih,
    totalLabaBersih,
    totalKeKoperasi,
    storeBreakdowns,
  };
}

// -----------------------------------------------------------------------------
// MASTER DATA OPERATIONS (TOKO, PEMASOK, DAPUR)
// -----------------------------------------------------------------------------

export function getMasterToko(): FallbackMasterToko[] {
  const db = loadDb();
  return [...(db.toko || [])].sort((a, b) => a.nama.localeCompare(b.nama));
}

export function createMasterToko(nama: string): FallbackMasterToko {
  const db = loadDb();
  const cleanName = (nama || '').trim();
  if (!cleanName) throw new Error('Nama toko tidak boleh kosong.');

  const existing = db.toko.find(t => t.nama.toLowerCase() === cleanName.toLowerCase());
  if (existing) return existing;

  const newToko: FallbackMasterToko = {
    id: `toko-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    nama: cleanName,
    created_at: new Date().toISOString(),
  };

  db.toko.push(newToko);
  saveDb();
  return newToko;
}

export function deleteMasterToko(id: string): { success: boolean; message: string } {
  const db = loadDb();
  const item = db.toko.find(t => t.id === id);
  if (!item) {
    throw new Error('Toko tidak ditemukan.');
  }

  const usage = checkMasterUsage('toko', id, item.nama);
  if (usage.isUsed) {
    throw new Error(usage.message || 'Toko masih digunakan pada data transaksi/pesanan dan tidak dapat dihapus.');
  }

  db.toko = db.toko.filter(t => t.id !== id);
  saveDb();
  return { success: true, message: `Toko "${item.nama}" berhasil dihapus.` };
}

export function getMasterPemasok(): FallbackMasterPemasok[] {
  const db = loadDb();
  return [...(db.pemasok || [])].sort((a, b) => a.nama.localeCompare(b.nama));
}

export function createMasterPemasok(nama: string): FallbackMasterPemasok {
  const db = loadDb();
  const cleanName = (nama || '').trim();
  if (!cleanName) throw new Error('Nama pemasok tidak boleh kosong.');

  const existing = db.pemasok.find(p => p.nama.toLowerCase() === cleanName.toLowerCase());
  if (existing) return existing;

  const newPemasok: FallbackMasterPemasok = {
    id: `pemasok-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    nama: cleanName,
    created_at: new Date().toISOString(),
  };

  db.pemasok.push(newPemasok);
  saveDb();
  return newPemasok;
}

export function deleteMasterPemasok(id: string): { success: boolean; message: string } {
  const db = loadDb();
  const item = db.pemasok.find(p => p.id === id);
  if (!item) {
    throw new Error('Pemasok tidak ditemukan.');
  }

  const usage = checkMasterUsage('pemasok', id, item.nama);
  if (usage.isUsed) {
    throw new Error(usage.message || 'Pemasok masih digunakan pada data transaksi/pesanan dan tidak dapat dihapus.');
  }

  db.pemasok = db.pemasok.filter(p => p.id !== id);
  saveDb();
  return { success: true, message: `Pemasok "${item.nama}" berhasil dihapus.` };
}

export function getMasterDapur(): FallbackMasterDapur[] {
  const db = loadDb();
  return [...(db.dapur || [])].sort((a, b) => a.nama.localeCompare(b.nama));
}

export function createMasterDapur(nama: string, alamat?: string): FallbackMasterDapur {
  const db = loadDb();
  const cleanName = (nama || '').trim().replace(/^Dapur\s+/i, '');
  if (!cleanName) throw new Error('Nama dapur tidak boleh kosong.');

  const existing = db.dapur.find(d => d.nama.toLowerCase() === cleanName.toLowerCase());
  if (existing) {
    if (alamat && !existing.alamat) {
      existing.alamat = alamat.trim();
      saveDb();
    }
    return existing;
  }

  const newDapur: FallbackMasterDapur = {
    id: `dapur-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    nama: cleanName,
    alamat: (alamat || '').trim(),
    created_at: new Date().toISOString(),
  };

  db.dapur.push(newDapur);
  saveDb();
  return newDapur;
}

export function deleteMasterDapur(id: string): { success: boolean; message: string } {
  const db = loadDb();
  const item = db.dapur.find(d => d.id === id);
  if (!item) {
    throw new Error('Dapur tidak ditemukan.');
  }

  const usage = checkMasterUsage('dapur', id, item.nama);
  if (usage.isUsed) {
    throw new Error(usage.message || 'Dapur masih digunakan pada data transaksi/pesanan dan tidak dapat dihapus.');
  }

  db.dapur = db.dapur.filter(d => d.id !== id);
  saveDb();
  return { success: true, message: `Dapur "${item.nama}" berhasil dihapus.` };
}

export function getMasterSatuan(): FallbackMasterSatuan[] {
  const db = loadDb();
  return [...(db.satuan || [])].sort((a, b) => a.nama.localeCompare(b.nama));
}

export function createMasterSatuan(nama: string): FallbackMasterSatuan {
  const db = loadDb();
  const cleanName = (nama || '').trim();
  if (!cleanName) throw new Error('Nama satuan tidak boleh kosong.');

  const existing = (db.satuan || []).find(s => s.nama.toLowerCase() === cleanName.toLowerCase());
  if (existing) return existing;

  const newSatuan: FallbackMasterSatuan = {
    id: `satuan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    nama: cleanName,
    created_at: new Date().toISOString(),
  };

  if (!db.satuan) db.satuan = [];
  db.satuan.push(newSatuan);
  saveDb();
  return newSatuan;
}

export function deleteMasterSatuan(id: string): { success: boolean; message: string } {
  const db = loadDb();
  const item = (db.satuan || []).find(s => s.id === id || s.nama.toLowerCase() === id.toLowerCase());
  if (!item) {
    throw new Error('Satuan tidak ditemukan.');
  }

  db.satuan = (db.satuan || []).filter(s => s.id !== item.id);
  saveDb();
  return { success: true, message: `Satuan "${item.nama}" berhasil dihapus.` };
}

export function checkMasterUsage(
  type: 'toko' | 'pemasok' | 'dapur',
  id: string,
  name?: string
): { isUsed: boolean; orderCount: number; transaksiCount: number; message: string } {
  const db = loadDb();
  const cleanName = (name || '').trim().toLowerCase();
  let orderCount = 0;
  let transaksiCount = 0;

  if (type === 'toko') {
    orderCount = db.pesanan.filter(o => 
      o.toko_id === id || 
      (cleanName && (o.toko?.toLowerCase() === cleanName || o.toko?.toLowerCase().includes(cleanName)))
    ).length;

    transaksiCount = db.transaksi.filter(t => 
      t.toko_id === id || 
      (cleanName && (t.toko?.toLowerCase() === cleanName || t.toko?.toLowerCase().includes(cleanName)))
    ).length;
  } else if (type === 'pemasok') {
    orderCount = db.pesanan.filter(o => 
      o.pemasok_id === id || 
      (cleanName && o.pemasok?.toLowerCase() === cleanName)
    ).length;

    transaksiCount = db.transaksi.filter(t => 
      t.pemasok_id === id || 
      (cleanName && t.pemasok?.toLowerCase() === cleanName)
    ).length;
  } else if (type === 'dapur') {
    orderCount = db.pesanan.filter(o => 
      o.dapur_id === id || 
      (cleanName && (
        o.dapur?.toLowerCase() === cleanName || 
        o.dapur?.toLowerCase() === `dapur ${cleanName}` ||
        o.dapur?.toLowerCase().replace(/^dapur\s+/i, '') === cleanName
      ))
    ).length;

    transaksiCount = db.transaksi.filter(t => 
      t.dapur_id === id || 
      (cleanName && (
        t.dapur?.toLowerCase() === cleanName || 
        t.dapur?.toLowerCase() === `dapur ${cleanName}` ||
        t.dapur?.toLowerCase().replace(/^dapur\s+/i, '') === cleanName
      ))
    ).length;
  }

  const isUsed = (orderCount + transaksiCount) > 0;
  let message = '';
  if (isUsed) {
    const parts: string[] = [];
    if (orderCount > 0) parts.push(`${orderCount} pesanan`);
    if (transaksiCount > 0) parts.push(`${transaksiCount} transaksi`);
    message = `Perhatian: "${name || id}" masih terhubung dengan ${parts.join(' dan ')}. Menghapus master data ini akan merusak riwayat transaksi lama. Hapus atau pindahkan pesanan/transaksi terkait terlebih dahulu!`;
  }

  return { isUsed, orderCount, transaksiCount, message };
}
