export type OrderStatus = "pending" | "selesai";
export type PaymentStatus = "PAID" | "UNPAID";
export type DeliveryStatus = "DONE" | "PENDING";

export interface OrderItem {
  id: string;
  namaBarang: string;
  qty: number;
  hargaBeli: number;
  hargaJual: number;
  toko: string;         // Toko Kita (e.g. HTG, PROHE, LUWENG BOGA, ADIFRUITA)
  tujuanDapur: string;  // Dinamis dari daftar dapur
  pemasok: string;      // Supplier/Pemasok
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  deliveryStatus?: DeliveryStatus;
  tanggal: string;      // YYYY-MM-DD
  createdAt?: string;    // ISO timestamp string
  catatan?: string;
  rowIndex?: number;    // Baris indeks aktual di Google Sheets (sheet "pesanan")
}

export interface Kitchen {
  id: string;
  nama: string;
  penanggungJawab?: string;
  lokasi?: string;
}

export interface Store {
  id: string;
  nama: string;
  lokasi?: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  tanggalPrint: string;  // Tanggal real-time saat dibuat
  createdAt: string;
  tujuanDapur: string;
  toko: string;
  items: OrderItem[];
  totalBeli: number;
  totalJual: number;
  totalProfit: number;
  rowIndex?: number;     // Baris indeks aktual di Google Sheets (sheet "transaksi")
  pemasok?: string;
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

export interface NoteItem {
  id: string;
  tujuanDapur: string;
  namaBarang?: string;
  catatan: string;
  isDone: boolean;
  createdAt: string;
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
