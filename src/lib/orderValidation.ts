import { OrderItem, PaymentStatus, DeliveryStatus } from '../types';

export type DashboardStatusFilter = 'all' | 'delivered' | 'pending' | 'paid' | 'unpaid';

export interface ValidatedOrderGroup {
  key: string;
  tujuanDapur: string;
  toko: string;
  tanggal: string;
  createdAt?: string;
  items: OrderItem[];
  isDelivered: boolean;
  isPaid: boolean;
  payStatus: PaymentStatus;
  delStatus: DeliveryStatus;
}

export interface DashboardSummaryMetrics {
  totalTrx: number;
  deliveredTrx: number;
  pendingTrx: number;
  paidTrx: number;
  unpaidTrx: number;
  totalItems: number;
  displayedTrx: number;
  displayedItems: number;
  isValid: boolean;
  discrepancies: string[];
}

/**
 * Normalizes payment status from any order representation (camelCase or snake_case).
 */
export function getItemPayStatus(item: OrderItem): PaymentStatus {
  if (item.paymentStatus) {
    return item.paymentStatus.toUpperCase() === 'PAID' ? 'PAID' : 'UNPAID';
  }
  if (item.status_pembayaran) {
    return item.status_pembayaran.toUpperCase() === 'PAID' ? 'PAID' : 'UNPAID';
  }
  return item.status === 'selesai' ? 'PAID' : 'UNPAID';
}

/**
 * Normalizes delivery status from any order representation (camelCase or snake_case).
 */
export function getItemDelStatus(item: OrderItem): DeliveryStatus {
  if (item.deliveryStatus) {
    return item.deliveryStatus.toUpperCase() === 'DONE' ? 'DONE' : 'PENDING';
  }
  if (item.status_pengiriman) {
    return item.status_pengiriman.toUpperCase() === 'DONE' ? 'DONE' : 'PENDING';
  }
  return item.status === 'selesai' ? 'DONE' : 'PENDING';
}

/**
 * Creates canonical group key based on nota_id or (date + kitchen + store).
 */
export function getOrderBatchKey(item: OrderItem): string {
  return (
    item.notaId ||
    item.nota_id ||
    `${item.tanggal || ''}||${item.tujuanDapur || ''}||${item.toko || ''}`
  );
}

/**
 * Groups orders and evaluates group-level delivery & payment status.
 */
export function groupOrdersByBatch(orders: OrderItem[]): ValidatedOrderGroup[] {
  const map = new Map<string, OrderItem[]>();

  for (let i = 0; i < orders.length; i++) {
    const item = orders[i];
    const key = getOrderBatchKey(item);
    if (!map.has(key)) {
      map.set(key, [item]);
    } else {
      map.get(key)!.push(item);
    }
  }

  const groups: ValidatedOrderGroup[] = [];

  map.forEach((items, key) => {
    const first = items[0];
    const isDelivered = items.every((it) => getItemDelStatus(it) === 'DONE');
    const isPaid = items.every((it) => getItemPayStatus(it) === 'PAID');

    groups.push({
      key,
      tujuanDapur: first.tujuanDapur,
      toko: first.toko,
      tanggal: first.tanggal,
      createdAt: first.createdAt || (first as any).created_at,
      items,
      isDelivered,
      isPaid,
      delStatus: isDelivered ? 'DONE' : 'PENDING',
      payStatus: isPaid ? 'PAID' : 'UNPAID',
    });
  });

  return groups;
}

/**
 * Filters orders based on active status filter, ensuring detailed rows precisely match visual counts.
 */
export function filterOrdersByStatus(
  orders: OrderItem[],
  statusFilter: DashboardStatusFilter
): OrderItem[] {
  if (statusFilter === 'all') return orders;

  const allGroups = groupOrdersByBatch(orders);
  const matchingGroupKeys = new Set<string>();

  for (const group of allGroups) {
    let matches = false;
    switch (statusFilter) {
      case 'delivered':
        matches = group.isDelivered;
        break;
      case 'pending':
        matches = !group.isDelivered;
        break;
      case 'paid':
        matches = group.isPaid;
        break;
      case 'unpaid':
        matches = !group.isPaid;
        break;
      default:
        matches = true;
    }
    if (matches) {
      matchingGroupKeys.add(group.key);
    }
  }

  return orders.filter((item) => matchingGroupKeys.has(getOrderBatchKey(item)));
}

/**
 * Computes dashboard summary metrics and runs strict validation checks against detailed rows.
 */
export function computeAndValidateDashboardSummary(
  allFilteredOrders: OrderItem[],
  displayedOrders: OrderItem[],
  statusFilter: DashboardStatusFilter = 'all'
): DashboardSummaryMetrics {
  const allGroups = groupOrdersByBatch(allFilteredOrders);
  const displayedGroups = groupOrdersByBatch(displayedOrders);

  let deliveredTrx = 0;
  let pendingTrx = 0;
  let paidTrx = 0;
  let unpaidTrx = 0;

  for (const group of allGroups) {
    if (group.isDelivered) {
      deliveredTrx++;
    } else {
      pendingTrx++;
    }

    if (group.isPaid) {
      paidTrx++;
    } else {
      unpaidTrx++;
    }
  }

  const totalTrx = allGroups.length;
  const displayedTrx = displayedGroups.length;
  const totalItems = allFilteredOrders.length;
  const displayedItems = displayedOrders.length;

  // Run Data Validation Assertions
  const discrepancies: string[] = [];

  // Invariant 1: Delivered + Pending must strictly equal Total
  if (deliveredTrx + pendingTrx !== totalTrx) {
    discrepancies.push(
      `Invarian status pengiriman gagal: ${deliveredTrx} (delivered) + ${pendingTrx} (pending) != ${totalTrx} (total)`
    );
  }

  // Invariant 2: Paid + Unpaid must strictly equal Total
  if (paidTrx + unpaidTrx !== totalTrx) {
    discrepancies.push(
      `Invarian status pembayaran gagal: ${paidTrx} (paid) + ${unpaidTrx} (unpaid) != ${totalTrx} (total)`
    );
  }

  // Invariant 3: Detailed displayed rows must match the visual active status filter count
  if (statusFilter === 'all') {
    if (displayedTrx !== totalTrx) {
      discrepancies.push(
        `Discrepancy 'all': Jumlah baris terdisplay (${displayedTrx}) tidak cocok dengan total (${totalTrx})`
      );
    }
  } else if (statusFilter === 'delivered') {
    if (displayedTrx !== deliveredTrx) {
      discrepancies.push(
        `Discrepancy 'delivered': Jumlah baris terdisplay (${displayedTrx}) tidak cocok dengan visual count (${deliveredTrx})`
      );
    }
    // Verify every single displayed group is genuinely delivered
    const nonDelivered = displayedGroups.filter((g) => !g.isDelivered);
    if (nonDelivered.length > 0) {
      discrepancies.push(
        `Ditemukan ${nonDelivered.length} pesanan belum selesai pada filter 'delivered'`
      );
    }
  } else if (statusFilter === 'pending') {
    if (displayedTrx !== pendingTrx) {
      discrepancies.push(
        `Discrepancy 'pending': Jumlah baris terdisplay (${displayedTrx}) tidak cocok dengan visual count (${pendingTrx})`
      );
    }
    // Verify every single displayed group is genuinely pending
    const nonPending = displayedGroups.filter((g) => g.isDelivered);
    if (nonPending.length > 0) {
      discrepancies.push(
        `Ditemukan ${nonPending.length} pesanan sudah selesai pada filter 'pending'`
      );
    }
  } else if (statusFilter === 'paid') {
    if (displayedTrx !== paidTrx) {
      discrepancies.push(
        `Discrepancy 'paid': Jumlah baris terdisplay (${displayedTrx}) tidak cocok dengan visual count (${paidTrx})`
      );
    }
  } else if (statusFilter === 'unpaid') {
    if (displayedTrx !== unpaidTrx) {
      discrepancies.push(
        `Discrepancy 'unpaid': Jumlah baris terdisplay (${displayedTrx}) tidak cocok dengan visual count (${unpaidTrx})`
      );
    }
  }

  const isValid = discrepancies.length === 0;

  if (!isValid && typeof console !== 'undefined') {
    console.warn('[Dashboard Validation Warning]:', discrepancies);
  }

  return {
    totalTrx,
    deliveredTrx,
    pendingTrx,
    paidTrx,
    unpaidTrx,
    totalItems,
    displayedTrx,
    displayedItems,
    isValid,
    discrepancies,
  };
}
