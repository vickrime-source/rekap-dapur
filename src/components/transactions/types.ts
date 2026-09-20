import { OrderItem, PaymentStatus, DeliveryStatus } from '../../types';

export interface TransactionBatch {
  id: string;
  batchIndex: number;
  tanggal: string;
  createdAt?: string;
  tujuanDapur: string;
  toko: string;
  pemasok: string;
  payStatus: PaymentStatus;
  delStatus: DeliveryStatus;
  totalQty: number;
  totalBeli: number;
  totalJual?: number;
  totalLabaBersih?: number;
  totalKeKoperasi?: number;
  isCancelled?: boolean;
  status?: string;
  items: OrderItem[];
  catatan?: string;
  rowIndex?: number;
}

export interface SummaryTotals {
  totalQty: number;
  totalBeli: number;
  totalJual: number;
  totalKeKoperasi: number;
  totalLabaBersih: number;
}

export interface ActiveActionMenu {
  id: string;
  rect: DOMRect;
  batch: TransactionBatch;
}
