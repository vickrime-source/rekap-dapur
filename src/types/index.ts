export type OrderStatus = "pending" | "selesai";
export type PaymentStatus = "PAID" | "UNPAID";
export type DeliveryStatus = "DONE" | "PENDING" | "SHIPPED";
export type DashboardPeriod = "hari_ini" | "mingguan" | "bulan_ini" | "all_time";

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
  qty: number;
  satuan?: string;
  hargaBeli: number;
  hargaJual: number;
  toko: string;         // Toko Kita (e.g. HTG, PROHE, LUWENG BOGA, ADIFRUITA)
  toko_id?: string;     // Foreign Key to master toko
  tokoId?: string;
  tujuanDapur: string;  // Dinamis dari daftar dapur
  dapur_id?: string;    // Foreign Key to master dapur
  dapurId?: string;
  pemasok: string;      // Supplier/Pemasok
  pemasok_id?: string;  // Foreign Key to master pemasok
  pemasokId?: string;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  deliveryStatus?: DeliveryStatus;
  tanggal: string;      // YYYY-MM-DD
  createdAt?: string;    // ISO timestamp string
  created_at?: string;
  catatan?: string;
  cashback?: number;   // Nilai cashback per barang (opsional: hargaBeli <= cashback <= hargaJual)
  rowIndex?: number;    // Baris indeks aktual di Google Sheets (sheet "pesanan")
}

export interface MasterToko {
  id: string;
  nama: string;
  created_at?: string;
  createdAt?: string;
}

export interface MasterPemasok {
  id: string;
  nama: string;
  created_at?: string;
  createdAt?: string;
}

export interface MasterDapur {
  id: string;
  nama: string;
  alamat: string;
  created_at?: string;
  createdAt?: string;
}

export interface MasterSatuan {
  id: string;
  nama: string;
  created_at?: string;
  createdAt?: string;
}

export interface Kitchen {
  id: string;
  nama: string;
  alamat?: string;
  penanggungJawab?: string;
  lokasi?: string;
  created_at?: string;
  createdAt?: string;
}

export interface Store {
  id: string;
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
  dapur_id?: string;     // Foreign Key to master dapur
  dapurId?: string;
  toko: string;
  toko_id?: string;      // Foreign Key to master toko
  tokoId?: string;
  pemasok?: string;
  pemasok_id?: string;   // Foreign Key to master pemasok
  pemasokId?: string;
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
  hargaBeli: number;
  hargaJual: number;
  toko?: string;
  tujuanDapur?: string;
  pemasok?: string;
}

export type FollowUpStatus = 'pending' | 'completed' | 'cancelled';

export interface NoteItem {
  id: string;
  tujuanDapur: string;
  toko?: string;
  pemasok?: string;
  namaBarang?: string;
  qty?: number;
  satuan?: string;
  catatan: string;
  isDone: boolean;
  status?: FollowUpStatus | string;
  createdAt: string;
  orderId?: string;
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
