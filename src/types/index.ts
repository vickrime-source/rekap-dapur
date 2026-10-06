export type OrderStatus = "pending" | "selesai" | "CANCELLED";
export type PaymentStatus = "PAID" | "UNPAID";
export type DeliveryStatus = "DONE" | "PENDING" | "SHIPPED";
export type DashboardPeriod = "hari_ini" | "mingguan" | "bulan_ini" | "all_time" | "custom";

export interface StoreExpenseBreakdown {
  toko: string;
  totalQty: number;
  totalBeli: number;
  totalJual: number;
  profit: number;
  totalKeKoperasi?: number;
  orderCount: number;
  percentageOfTotalBeli: number;
  transactionCount?: number;
  pemasokList?: string[];
  percentageOfTotalJual?: number;
  marginPercent?: number;
}

export interface PeriodSummaryStats {
  totalQty: number;
  totalTransactions: number;
  totalPendapatan: number;
  totalPengeluaran: number;
  profitBersih: number;
  totalKeKoperasi?: number;
  totalLabaBersih?: number;
  storeBreakdowns: StoreExpenseBreakdown[];
}

export interface OrderItem {
  id: string;
  namaBarang: string;
  qty: number;          // Qty Jual
  qtyBeli?: number;     // Qty Beli (jika berbeda dari qty jual, default = qty)
  qty_beli?: number;
  notaId?: string;      // ID Nota grouping
  nota_id?: string;
  satuan?: string;
  hargaBeli: number;
  hargaJual: number;
  toko: string;         // Toko Kita (e.g. HTG, PROHE, LUWENG BOGA, ADIFRUITA)
  toko_id?: number | string | null;     // Foreign Key to master toko (bigint / int)
  tujuanDapur: string;  // Dinamis dari daftar dapur
  dapur_id?: number | string | null;    // Foreign Key to master dapur (bigint / int)
  pemasok: string;      // Supplier/Pemasok
  pemasok_id?: number | string | null;  // Foreign Key to master pemasok (bigint / int)
  status: OrderStatus;
  statusPembatalan?: string;
  status_pembatalan?: string;
  cancelledAt?: string;
  cancelled_at?: string;
  cancelledReason?: string;
  cancelled_reason?: string;
  paymentStatus?: PaymentStatus;
  deliveryStatus?: DeliveryStatus;
  tanggal: string;      // YYYY-MM-DD
  createdAt?: string;    // ISO timestamp string
  created_at?: string;
  catatan?: string;
  cashback?: number;   // Nilai cashback per barang (opsional: hargaBeli <= cashback <= hargaJual)
  retur?: number;      // Retur barang per item (qty_final = qty_jual - retur)
  rowIndex?: number;    // Baris indeks aktual di Google Sheets (sheet "pesanan")
  invoiceNumber?: string; // Nomor invoice resmi (PREFIX/SEQ/ROMAWI/TAHUN)
  invoice_number?: string;
}

export interface MasterToko {
  id: number | string;
  nama: string;
  kode_invoice?: string; // LA, LB, PH, HTG
  created_at?: string;
  createdAt?: string;
}

export interface MasterPemasok {
  id: number | string;
  nama: string;
  created_at?: string;
  createdAt?: string;
}

export interface MasterDapur {
  id: number | string;
  nama: string;
  alamat: string;
  created_at?: string;
  createdAt?: string;
}

export interface MasterSatuan {
  id: number | string;
  nama: string;
  created_at?: string;
  createdAt?: string;
}

export interface Kitchen {
  id: string | number;
  nama: string;
  alamat?: string;
  penanggungJawab?: string;
  lokasi?: string;
  created_at?: string;
  createdAt?: string;
}

export interface Store {
  id: string | number;
  nama: string;
  lokasi?: string;
  created_at?: string;
  createdAt?: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  tanggalPrint: string;  // Tanggal real-time saat dibuat
  tanggal?: string;      // Tanggal transaksi (YYYY-MM-DD)
  createdAt: string;
  created_at?: string;
  tujuanDapur: string;
  dapur_id?: number | string | null;     // Foreign Key to master dapur
  toko: string;
  toko_id?: number | string | null;      // Foreign Key to master toko
  pemasok?: string;
  pemasok_id?: number | string | null;   // Foreign Key to master pemasok
  items: OrderItem[];
  totalBeli: number;
  totalJual: number;
  totalProfit: number;
  catatan?: string;
  rowIndex?: number;     // Baris indeks aktual di Google Sheets (sheet "transaksi")
  status?: string;
}

export interface TextParseResult {
  namaBarang: string;
  qty: number;
  qtyBeli?: number;
  qty_beli?: number;
  satuan?: string;
  hargaBeli: number;
  hargaJual: number;
  toko?: string;
  tujuanDapur?: string;
  pemasok?: string;
  tanggal?: string;
}

export type FollowUpStatus = 'pending' | 'completed' | 'cancelled';

export interface FollowUpItemRow {
  id: string;
  namaBarang: string;
  pemasok?: string;
  qty: number;
  satuan: string;
  catatan?: string;
}

export interface NoteItem {
  id: string;
  /** Tanggal pesanan/follow up; legacy notes fall back to createdAt. */
  tanggal?: string;
  tujuanDapur: string;
  toko?: string;
  pemasok?: string;
  namaBarang?: string;
  qty?: number;
  satuan?: string;
  catatan: string;
  items?: FollowUpItemRow[];
  isDone: boolean;
  status?: FollowUpStatus | string;
  createdAt: string;
  orderId?: string;
  /** ID batch import agar item satu sumber dapat ditampilkan sebagai satu grup. */
  batchId?: string;
}

export interface ExportHistoryItem {
  id: string;
  invoiceNumber: string;
  fileName: string;
  type?: 'pdf' | 'docx';
  fileType?: 'pdf' | 'docx';
  toko: string;
  tujuanDapur: string;
  tanggal: string;
  itemCount?: number;
  totalJual?: number;
  totalAmount?: number;
  pdfUrl?: string;
  fileUrl?: string;
  createdAt: string;
}

export type InvoicePriceVariant = 'ori' | 'cashback';
