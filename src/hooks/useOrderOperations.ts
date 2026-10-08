import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { 
  OrderItem, 
  InvoiceRecord, 
  PaymentStatus, 
  DeliveryStatus, 
  MasterToko, 
  MasterPemasok, 
  MasterDapur, 
} from '../types';
import { getTodayWIB, getNowWIBISOString } from '../lib/formatters';
import { 
  saveOrderToDb, 
  saveOrdersBatchToDb, 
  updateOrderInDb, 
  batchUpdateStatusInDb,
  deleteOrderFromDb, 
  deleteOrdersFromDb, 
  saveTransactionToDb, 
  deleteTransactionFromDb 
} from '../lib/supabaseDb';
import { ConfirmDialogState } from './useConfirmDialog';

interface UseOrderOperationsProps {
  orders: OrderItem[];
  setOrders: Dispatch<SetStateAction<OrderItem[]>>;
  invoices: InvoiceRecord[];
  setInvoices: Dispatch<SetStateAction<InvoiceRecord[]>>;
  masterToko: MasterToko[];
  masterPemasok: MasterPemasok[];
  masterDapur: MasterDapur[];
  setSelectedDate: (date: string) => void;
  setIsLoadingDb: (loading: boolean) => void;
  setDbError: (error: string | null) => void;
  setConfirmState: Dispatch<SetStateAction<ConfirmDialogState | null>>;
  showToast: (message: string, type?: 'success' | 'delete' | 'edit' | 'info' | 'error') => void;
}

export function useOrderOperations({
  orders,
  setOrders,
  invoices,
  setInvoices,
  masterToko,
  masterPemasok,
  masterDapur,
  setSelectedDate,
  setIsLoadingDb,
  setDbError,
  setConfirmState,
  showToast,
}: UseOrderOperationsProps) {
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderItem | null>(null);
  const [editingBatchOrders, setEditingBatchOrders] = useState<OrderItem[]>([]);
  const [prefilledKitchen, setPrefilledKitchen] = useState<string | undefined>();

  const handleToggleStatus = useCallback(async (id: string) => {
    let nextStatus: 'pending' | 'selesai' = 'pending';
    let nextPay: PaymentStatus = 'UNPAID';
    let nextDel: DeliveryStatus = 'PENDING';

    setOrders((prev) =>
      prev.map((o) => {
        if (String(o.id) !== String(id)) return o;
        nextStatus = o.status === 'pending' ? 'selesai' : 'pending';
        nextPay = nextStatus === 'selesai' ? 'PAID' : (o.paymentStatus || 'UNPAID');
        nextDel = nextStatus === 'selesai' ? 'DONE' : (o.deliveryStatus || 'PENDING');
        return {
          ...o,
          status: nextStatus,
          paymentStatus: nextPay,
          status_pembayaran: nextPay,
          deliveryStatus: nextDel,
          status_pengiriman: nextDel,
        };
      })
    );

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.items?.some((it) => String(it.id) === String(id))) {
          return {
            ...inv,
            status_pembayaran: nextPay,
            items: inv.items.map((it) =>
              String(it.id) === String(id)
                ? { ...it, status: nextStatus, paymentStatus: nextPay, status_pembayaran: nextPay, deliveryStatus: nextDel, status_pengiriman: nextDel }
                : it
            ),
          };
        }
        return inv;
      })
    );

    const res = await updateOrderInDb(id, {
      status: nextStatus,
      paymentStatus: nextPay,
      deliveryStatus: nextDel,
    });
    if (!res.success) {
      showToast(`Gagal update status: ${res.error}`, 'error');
    }
  }, [setOrders, setInvoices, showToast]);

  const handleUpdatePaymentStatus = useCallback(async (id: string, paymentStatus: PaymentStatus) => {
    const targetOrder = orders.find((o) => String(o.id) === String(id));
    const rawDel = targetOrder?.deliveryStatus || (targetOrder as any)?.status_pengiriman || (targetOrder?.status === 'selesai' ? 'DONE' : 'PENDING');
    const delStatus: DeliveryStatus = rawDel?.toUpperCase() === 'DONE' ? 'DONE' : 'PENDING';
    const newStatus: 'pending' | 'selesai' = paymentStatus === 'PAID' && delStatus === 'DONE' ? 'selesai' : 'pending';

    setOrders((prev) =>
      prev.map((o) => {
        if (String(o.id) !== String(id)) return o;
        return {
          ...o,
          paymentStatus,
          status_pembayaran: paymentStatus,
          status: newStatus,
        };
      })
    );

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.items?.some((it) => String(it.id) === String(id))) {
          return {
            ...inv,
            status_pembayaran: paymentStatus,
            items: inv.items.map((it) =>
              String(it.id) === String(id)
                ? { ...it, paymentStatus, status_pembayaran: paymentStatus, status: newStatus }
                : it
            ),
          };
        }
        return inv;
      })
    );

    const res = await updateOrderInDb(id, {
      paymentStatus,
      status: newStatus,
    });
    if (!res.success) {
      setDbError(res.error || 'Gagal update status pembayaran');
      showToast(`Gagal update status pembayaran: ${res.error}`, 'error');
    } else {
      showToast(`Status pembayaran berhasil diperbarui (${paymentStatus})`, 'success');
    }
  }, [orders, setOrders, setInvoices, setDbError, showToast]);

  const handleUpdateDeliveryStatus = useCallback(async (id: string, deliveryStatus: DeliveryStatus) => {
    const targetOrder = orders.find((o) => String(o.id) === String(id));
    const rawPay = targetOrder?.paymentStatus || (targetOrder as any)?.status_pembayaran || (targetOrder?.status === 'selesai' ? 'PAID' : 'UNPAID');
    const payStatus: PaymentStatus = rawPay?.toUpperCase() === 'PAID' ? 'PAID' : 'UNPAID';
    const newStatus: 'pending' | 'selesai' = payStatus === 'PAID' && deliveryStatus === 'DONE' ? 'selesai' : 'pending';

    setOrders((prev) =>
      prev.map((o) => {
        if (String(o.id) !== String(id)) return o;
        return {
          ...o,
          deliveryStatus,
          status_pengiriman: deliveryStatus,
          status: newStatus,
        };
      })
    );

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.items?.some((it) => String(it.id) === String(id))) {
          return {
            ...inv,
            items: inv.items.map((it) =>
              String(it.id) === String(id)
                ? { ...it, deliveryStatus, status_pengiriman: deliveryStatus, status: newStatus }
                : it
            ),
          };
        }
        return inv;
      })
    );

    const res = await updateOrderInDb(id, {
      deliveryStatus,
      status: newStatus,
    });
    if (!res.success) {
      setDbError(res.error || 'Gagal update status pengiriman');
      showToast(`Gagal update status pengiriman: ${res.error}`, 'error');
    } else {
      showToast(`Status pengiriman berhasil diperbarui (${deliveryStatus})`, 'success');
    }
  }, [orders, setOrders, setInvoices, setDbError, showToast]);

  const handleUpdateGroupPaymentStatus = useCallback(async (groupItems: OrderItem[], paymentStatus: PaymentStatus) => {
    if (!groupItems || groupItems.length === 0) return;
    const targetIds = groupItems.map((it) => String(it.id));
    const targetIdsSet = new Set(targetIds);

    const isAllDone = groupItems.every((it) => {
      const del = it.deliveryStatus || (it as any).status_pengiriman || (it.status === 'selesai' ? 'DONE' : 'PENDING');
      return del?.toUpperCase() === 'DONE';
    });
    const groupStatus: 'pending' | 'selesai' = paymentStatus === 'PAID' && isAllDone ? 'selesai' : 'pending';

    setOrders((prev) =>
      prev.map((o) => {
        if (!targetIdsSet.has(String(o.id))) return o;
        const delStatus = o.deliveryStatus || (o as any).status_pengiriman || (o.status === 'selesai' ? 'DONE' : 'PENDING');
        const newStatus = paymentStatus === 'PAID' && delStatus?.toUpperCase() === 'DONE' ? 'selesai' : 'pending';
        return {
          ...o,
          paymentStatus,
          status_pembayaran: paymentStatus,
          status: newStatus,
        };
      })
    );

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.items?.some((it) => targetIdsSet.has(String(it.id)))) {
          return {
            ...inv,
            status_pembayaran: paymentStatus,
            items: inv.items.map((it) =>
              targetIdsSet.has(String(it.id))
                ? { ...it, paymentStatus, status_pembayaran: paymentStatus }
                : it
            ),
          };
        }
        return inv;
      })
    );

    const res = await batchUpdateStatusInDb(targetIds, {
      paymentStatus,
      status: groupStatus,
    });
    if (!res.success) {
      setDbError(res.error || 'Gagal update pembayaran grup');
      showToast(`Gagal update grup: ${res.error}`, 'error');
    } else {
      showToast(`Status pembayaran grup berhasil diperbarui (${paymentStatus})`, 'success');
    }
  }, [setOrders, setInvoices, setDbError, showToast]);

  const handleUpdateGroupDeliveryStatus = useCallback(async (groupItems: OrderItem[], deliveryStatus: DeliveryStatus) => {
    if (!groupItems || groupItems.length === 0) return;
    const targetIds = groupItems.map((it) => String(it.id));
    const targetIdsSet = new Set(targetIds);

    const isAllPaid = groupItems.every((it) => {
      const pay = it.paymentStatus || (it as any).status_pembayaran || (it.status === 'selesai' ? 'PAID' : 'UNPAID');
      return pay?.toUpperCase() === 'PAID';
    });
    const groupStatus: 'pending' | 'selesai' = deliveryStatus === 'DONE' && isAllPaid ? 'selesai' : 'pending';

    setOrders((prev) =>
      prev.map((o) => {
        if (!targetIdsSet.has(String(o.id))) return o;
        const payStatus = o.paymentStatus || (o as any).status_pembayaran || (o.status === 'selesai' ? 'PAID' : 'UNPAID');
        const newStatus = payStatus?.toUpperCase() === 'PAID' && deliveryStatus === 'DONE' ? 'selesai' : 'pending';
        return {
          ...o,
          deliveryStatus,
          status_pengiriman: deliveryStatus,
          status: newStatus,
        };
      })
    );

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.items?.some((it) => targetIdsSet.has(String(it.id)))) {
          return {
            ...inv,
            items: inv.items.map((it) =>
              targetIdsSet.has(String(it.id))
                ? { ...it, deliveryStatus, status_pengiriman: deliveryStatus }
                : it
            ),
          };
        }
        return inv;
      })
    );

    const res = await batchUpdateStatusInDb(targetIds, {
      deliveryStatus,
      status: groupStatus,
    });
    if (!res.success) {
      setDbError(res.error || 'Gagal update pengiriman grup');
      showToast(`Gagal update pengiriman grup: ${res.error}`, 'error');
    } else {
      showToast(`Status pengiriman grup berhasil diperbarui (${deliveryStatus})`, 'success');
    }
  }, [setOrders, setInvoices, setDbError, showToast]);

  const handleDuplicateOrder = useCallback(async (itemOrItems: OrderItem | OrderItem[]) => {
    const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    if (items.length === 0) return;

    const newNotaId = `nota-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const duplicatedList: OrderItem[] = items.map((item, idx) => ({
      ...item,
      id: `ord-dup-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
      notaId: newNotaId,
      nota_id: newNotaId,
      invoiceNumber: undefined,
      invoice_number: undefined,
      createdAt: getNowWIBISOString(),
    }));

    setOrders((prev) => [...duplicatedList, ...prev]);

    setIsLoadingDb(true);
    const res = await saveOrdersBatchToDb(duplicatedList);
    setIsLoadingDb(false);

    if (res.success) {
      showToast(
        duplicatedList.length > 1
          ? `Seluruh pesanan (${duplicatedList.length} item) berhasil diduplikasi`
          : 'Pesanan berhasil diduplikasi',
        'success'
      );
    } else {
      setDbError(res.error || 'Gagal menyimpan pesanan');
      showToast(`Pesanan tersimpan lokal. Gagal simpan ke database: ${res.error}`, 'info');
    }
  }, [setOrders, setIsLoadingDb, showToast, setDbError]);

  const handleToggleBatchStatus = useCallback(async (targetName: string, date: string, targetStatus: 'pending' | 'selesai') => {
    const isDone = targetStatus === 'selesai';
    const nextPay: PaymentStatus = isDone ? 'PAID' : 'UNPAID';
    const nextDel: DeliveryStatus = isDone ? 'DONE' : 'PENDING';

    let affectedIds: string[] = [];

    setOrders((prev) => {
      const matched = prev.filter(
        (o) => (o.toko === targetName || o.tujuanDapur === targetName) && o.tanggal === date
      );
      affectedIds = matched.map((o) => String(o.id));

      return prev.map((o) =>
        (o.toko === targetName || o.tujuanDapur === targetName) && o.tanggal === date
          ? {
              ...o,
              status: targetStatus,
              paymentStatus: nextPay,
              status_pembayaran: nextPay,
              deliveryStatus: nextDel,
              status_pengiriman: nextDel,
            }
          : o
      );
    });

    if (affectedIds.length > 0) {
      const res = await batchUpdateStatusInDb(affectedIds, {
        status: targetStatus,
        paymentStatus: nextPay,
        deliveryStatus: nextDel,
      });
      if (!res.success) {
        showToast(`Gagal update status batch: ${res.error}`, 'error');
      } else {
        showToast(`Status berhasil diubah menjadi ${isDone ? 'Selesai (PAID & DONE)' : 'Pending'}`, 'success');
      }
    }
  }, [setOrders, showToast]);

  const handleSaveOrder = useCallback(async (
    orderData: Omit<OrderItem, 'id' | 'createdAt'> | Array<Omit<OrderItem, 'id' | 'createdAt'>>,
    editId?: string
  ) => {
    if (editId) {
      const itemsList = Array.isArray(orderData) ? orderData : [orderData];
      const oldOrder = orders.find((o) => o.id === editId) || editingOrder;

      const sharedNotaId = oldOrder?.notaId || oldOrder?.nota_id || (itemsList[0] as any)?.notaId || (itemsList[0] as any)?.nota_id || `nota-${Date.now()}`;
      const sharedInvoice = oldOrder?.invoiceNumber || (oldOrder as any)?.invoice_number || (itemsList[0] as any)?.invoiceNumber || (itemsList[0] as any)?.invoice_number;

      // Identifikasi item yang dihapus dari batch asal
      const submittedIds = new Set(itemsList.map((it: any) => it.id).filter(Boolean));
      const deletedIds = editingBatchOrders.filter((o) => o.id && !submittedIds.has(o.id)).map((o) => o.id);

      // Pisahkan pesanan lama yang diupdate vs pesanan baru yang ditambah
      const existingOrdersToUpdate: OrderItem[] = [];
      const newOrdersToAdd: OrderItem[] = [];

      itemsList.forEach((item: any, idx: number) => {
        const itemExisting = orders.find((o) => o.id === item.id) || (idx === 0 && item.id === editId ? oldOrder : undefined);
        const curToko = (item.toko || oldOrder?.toko || '').trim();
        const curPemasok = (item.pemasok || oldOrder?.pemasok || '').trim();
        const curDapur = (item.tujuanDapur || oldOrder?.tujuanDapur || '').trim();
        const cleanD = curDapur.replace(/^dapur\s+/i, '').trim().toLowerCase();

        const itTokoId = item.toko_id || item.tokoId || masterToko.find((t) => t.nama.toLowerCase() === curToko.toLowerCase())?.id || itemExisting?.toko_id || null;
        const itPemasokId = item.pemasok_id || item.pemasokId || masterPemasok.find((p) => p.nama.toLowerCase() === curPemasok.toLowerCase())?.id || itemExisting?.pemasok_id || null;
        const itDapurId = item.dapur_id || item.dapurId || masterDapur.find((d) => d.nama.toLowerCase() === curDapur.toLowerCase() || d.nama.toLowerCase() === cleanD)?.id || itemExisting?.dapur_id || null;

        const rawQ = Number(item.qty) || 0;
        const rawQBeli = item.qty_beli !== undefined ? Number(item.qty_beli) : (item.qtyBeli !== undefined ? Number(item.qtyBeli) : rawQ);

        const mapped: OrderItem = {
          ...(itemExisting || {}),
          ...item,
          notaId: sharedNotaId,
          nota_id: sharedNotaId,
          invoiceNumber: sharedInvoice,
          invoice_number: sharedInvoice,
          toko: curToko,
          toko_id: itTokoId,
          tujuanDapur: curDapur,
          dapur: curDapur,
          dapur_id: itDapurId,
          pemasok: curPemasok,
          pemasok_id: itPemasokId,
          qty: rawQ,
          qtyBeli: rawQBeli,
          qty_beli: rawQBeli,
        } as OrderItem;

        if (itemExisting && itemExisting.id) {
          existingOrdersToUpdate.push({
            ...mapped,
            id: itemExisting.id,
            createdAt: itemExisting.createdAt || getNowWIBISOString(),
          });
        } else {
          newOrdersToAdd.push({
            ...mapped,
            id: `ord-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
            createdAt: getNowWIBISOString(),
          });
        }
      });

      const updateMap = new Map(existingOrdersToUpdate.map((o) => [o.id, o]));
      const delSet = new Set(deletedIds);

      setOrders((prev) => {
        const filtered = prev.filter((o) => !delSet.has(o.id));
        const updated = filtered.map((o) => updateMap.get(o.id) || o);
        return newOrdersToAdd.length > 0 ? [...newOrdersToAdd, ...updated] : updated;
      });

      const message = `Pesanan (${itemsList.length} item) berhasil diperbarui`;
      showToast(message, 'edit');

      setIsLoadingDb(true);
      try {
        if (deletedIds.length > 0) {
          await deleteOrdersFromDb(deletedIds);
        }
        for (const itm of existingOrdersToUpdate) {
          await updateOrderInDb(itm.id, itm);
        }
        if (newOrdersToAdd.length > 0) {
          await saveOrdersBatchToDb(newOrdersToAdd);
        }
      } catch (err: any) {
        console.error('[handleSaveOrder batch edit error]:', err);
        setDbError(err?.message || 'Gagal menyimpan pembaruan ke database');
      } finally {
        setIsLoadingDb(false);
      }
      return;
    }

    const rawItems = Array.isArray(orderData) ? orderData : [orderData];

    // Filter ketat: Jangan pernah izinkan item kosong atau tanpa dapur tersimpan
    const validItems = rawItems.filter((item: any) => {
      const nama = ((item.namaBarang || item.item || item.nama_barang || '') as string).trim();
      const dapur = ((item.tujuanDapur || item.dapur || item.tujuan_dapur || '') as string).trim();
      return nama.length > 0 && dapur.length > 0;
    });

    console.log('FINAL ITEMS TO INSERT', validItems);

    if (validItems.length === 0) {
      console.warn('[handleSaveOrder] Ditolak: Tidak ada item valid (item & dapur wajib ada).', orderData);
      showToast('Gagal: Nama barang dan Dapur wajib diisi!', 'error');
      return;
    }

    const createdDate = getNowWIBISOString();
    const sharedNotaId =
      validItems.find((i: any) => i.nota_id || i.notaId)?.nota_id ||
      validItems.find((i: any) => i.nota_id || i.notaId)?.notaId ||
      `nota-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newOrdersAdded: OrderItem[] = validItems.map((item, idx) => {
      const curToko = ((item as any).toko || '').trim();
      const curPemasok = ((item as any).pemasok || '').trim();
      const curDapur = ((item as any).tujuanDapur || (item as any).dapur || (item as any).tujuan_dapur || '').trim();
      const curItemName = ((item as any).namaBarang || (item as any).item || (item as any).nama_barang || '').trim();
      const cleanD = curDapur.replace(/^dapur\s+/i, '').trim().toLowerCase();

      const fTokoId = (item as any).toko_id || (item as any).tokoId || masterToko.find((t) => t.nama.toLowerCase() === curToko.toLowerCase())?.id || '';
      const fPemasokId = (item as any).pemasok_id || (item as any).pemasokId || masterPemasok.find((p) => p.nama.toLowerCase() === curPemasok.toLowerCase())?.id || '';
      const fDapurId = (item as any).dapur_id || (item as any).dapurId || masterDapur.find((d) => d.nama.toLowerCase() === curDapur.toLowerCase() || d.nama.toLowerCase() === cleanD)?.id || '';

      const rawQ = Number(item.qty) || 0;
      const rawQBeli = (item as any).qty_beli !== undefined ? Number((item as any).qty_beli) : ((item as any).qtyBeli !== undefined ? Number((item as any).qtyBeli) : rawQ);

      const mappedOrder: OrderItem = {
        ...item,
        namaBarang: curItemName,
        tujuanDapur: curDapur,
        toko: curToko,
        pemasok: curPemasok,
        toko_id: fTokoId,
        pemasok_id: fPemasokId,
        dapur_id: fDapurId,
        qty: rawQ,
        qtyBeli: rawQBeli,
        qty_beli: rawQBeli,
        notaId: sharedNotaId,
        nota_id: sharedNotaId,
        id: `ord-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        createdAt: createdDate,
      };

      console.log('SUBMIT ITEM', mappedOrder);
      return mappedOrder;
    });

    setOrders((prev) => [...newOrdersAdded, ...prev]);
    setSelectedDate(getTodayWIB());

    setIsLoadingDb(true);
    let successCount = 0;
    let lastError = '';

    const batchRes = await saveOrdersBatchToDb(newOrdersAdded);
    let finalItemsWithInvoice = newOrdersAdded;
    if (batchRes.success && batchRes.data && Array.isArray(batchRes.data) && batchRes.data.length > 0) {
      finalItemsWithInvoice = batchRes.data as OrderItem[];
      setOrders((prev) => {
        const idMap = new Map(finalItemsWithInvoice.map((it) => [it.id, it]));
        return prev.map((o) => idMap.get(o.id) || o);
      });
      successCount = finalItemsWithInvoice.length;
    } else if (batchRes.success) {
      successCount = newOrdersAdded.length;
    } else {
      lastError = batchRes.error || 'Gagal menyimpan pesanan ke database';
    }

    if (finalItemsWithInvoice.length > 0) {
      const firstItem = finalItemsWithInvoice[0];
      const officialInvNum = firstItem.invoiceNumber || firstItem.invoice_number || '';

      const totalBeli = finalItemsWithInvoice.reduce((sum, it) => {
        const rawQJ = Number(it.qty || 0);
        const rawQB = (it as any).qtyBeli !== undefined && (it as any).qtyBeli !== null
          ? Number((it as any).qtyBeli)
          : ((it as any).qty_beli !== undefined && (it as any).qty_beli !== null
            ? Number((it as any).qty_beli)
            : rawQJ);
        const rt = Math.max(0, Number(it.retur) || 0);
        const qbe = Math.max(0, rawQB - rt);
        return sum + qbe * Number(it.hargaBeli || 0);
      }, 0);
      const totalJual = finalItemsWithInvoice.reduce((sum, it) => {
        const rawQJ = Number(it.qty || 0);
        const rt = Math.max(0, Number(it.retur) || 0);
        const qf = Math.max(0, rawQJ - rt);
        return sum + qf * Number(it.hargaJual || 0);
      }, 0);
      const newInvoiceRec: InvoiceRecord = {
        id: `tx-${Date.now()}`,
        invoiceNumber: officialInvNum,
        tanggalPrint: firstItem.tanggal,
        createdAt: createdDate,
        tujuanDapur: firstItem.tujuanDapur,
        dapur_id: firstItem.dapur_id || null,
        toko: firstItem.toko,
        toko_id: firstItem.toko_id || null,
        items: finalItemsWithInvoice,
        totalBeli,
        totalJual,
        totalProfit: totalJual - totalBeli,
        pemasok: firstItem.pemasok,
        pemasok_id: firstItem.pemasok_id || null,
        status: firstItem.paymentStatus || 'UNPAID',
      };
      setInvoices((prev) => [newInvoiceRec, ...prev]);
      await saveTransactionToDb(newInvoiceRec);
    }

    setIsLoadingDb(false);

    if (successCount === newOrdersAdded.length) {
      showToast(`${successCount} pesanan berhasil tersimpan`, 'success');
    } else {
      setDbError(lastError);
      showToast(`${newOrdersAdded.length} pesanan tersimpan di HP. Error sync: ${lastError}`, 'info');
    }
  }, [orders, masterToko, masterPemasok, masterDapur, setOrders, setSelectedDate, setIsLoadingDb, setInvoices, showToast, setDbError]);

  const handleDeleteOrder = useCallback((id: string) => {
    const targetOrder = orders.find((o) => o.id === id);
    const targetInvoice = !targetOrder ? invoices.find((inv) => inv.id === id || inv.items?.some((it) => it.id === id)) : undefined;

    const desc = targetOrder
      ? `${targetOrder.namaBarang} (${targetOrder.tujuanDapur || 'Dapur'})`
      : targetInvoice
      ? `Transaksi ${targetInvoice.toko || targetInvoice.tujuanDapur || ''}`
      : 'data ini';

    setConfirmState({
      isOpen: true,
      title: 'Konfirmasi Hapus Pesanan',
      message: `Yakin hapus data ${desc}? Data akan dihapus secara permanen.`,
      onConfirm: async () => {
        setIsLoadingDb(true);
        setConfirmState((prev) => (prev ? { ...prev, isLoading: true } : null));

        try {
          if (targetOrder) {
            const res = await deleteOrderFromDb(targetOrder.id);
            if (!res.success) {
              const errMsg = typeof res.error === 'string' ? res.error : ((res.error as any)?.message || 'Terjadi kesalahan');
              showToast(`Gagal menghapus di database: ${errMsg}`, 'error');
              setDbError(errMsg);
              return;
            }
            setOrders((prev) => prev.filter((o) => o.id !== id));

            const remainingOrdersInBatch = orders.filter(
              (o) =>
                o.id !== id &&
                o.tanggal === targetOrder.tanggal &&
                o.toko === targetOrder.toko &&
                o.tujuanDapur === targetOrder.tujuanDapur &&
                (o.pemasok || '') === (targetOrder.pemasok || '')
            );

            const matchingInvoices = invoices.filter((inv) => {
              if (inv.id === id) return true;
              if (inv.items && Array.isArray(inv.items) && inv.items.some((it) => it.id === id)) return true;
              const invDate = inv.tanggalPrint || inv.tanggal || inv.createdAt?.split('T')[0] || '';
              const invToko = inv.toko || inv.items?.[0]?.toko || '';
              const invDapur = inv.tujuanDapur || inv.items?.[0]?.tujuanDapur || '';
              const invPemasok = inv.pemasok || inv.items?.[0]?.pemasok || '';

              return (
                invDate === targetOrder.tanggal &&
                invToko === targetOrder.toko &&
                (!targetOrder.tujuanDapur || invDapur === targetOrder.tujuanDapur) &&
                (!targetOrder.pemasok || invPemasok === targetOrder.pemasok)
              );
            });

            if (remainingOrdersInBatch.length === 0) {
              if (matchingInvoices.length > 0) {
                const invoiceIdsToDelete = matchingInvoices.map((inv) => inv.id).filter(Boolean);
                for (const invId of invoiceIdsToDelete) {
                  await deleteTransactionFromDb(invId);
                }
                const delIdsSet = new Set(invoiceIdsToDelete);
                setInvoices((prev) => prev.filter((inv) => !delIdsSet.has(inv.id)));
              }
            } else {
              setInvoices((prev) =>
                prev.map((inv) => {
                  if (inv.items && Array.isArray(inv.items) && inv.items.some((it) => it.id === id)) {
                    const filteredItems = inv.items.filter((it) => it.id !== id);
                    const newTotalBeli = filteredItems.reduce((s, it) => {
                      const rawQJ = Number(it.qty || 0);
                      const rawQB = (it as any).qtyBeli !== undefined && (it as any).qtyBeli !== null
                        ? Number((it as any).qtyBeli)
                        : ((it as any).qty_beli !== undefined && (it as any).qty_beli !== null
                          ? Number((it as any).qty_beli)
                          : rawQJ);
                      const rt = Math.max(0, Number(it.retur) || 0);
                      const qbe = Math.max(0, rawQB - rt);
                      return s + qbe * (Number(it.hargaBeli) || 0);
                    }, 0);
                    const newTotalJual = filteredItems.reduce((s, it) => {
                      const rawQJ = Number(it.qty || 0);
                      const rt = Math.max(0, Number(it.retur) || 0);
                      const qf = Math.max(0, rawQJ - rt);
                      return s + qf * (Number(it.hargaJual) || 0);
                    }, 0);
                    return {
                      ...inv,
                      items: filteredItems,
                      totalBeli: newTotalBeli,
                      totalJual: newTotalJual,
                      totalProfit: newTotalJual - newTotalBeli,
                    };
                  }
                  return inv;
                })
              );
            }

            showToast(`Pesanan "${targetOrder.namaBarang}" berhasil dihapus`, 'delete');
          } else if (targetInvoice) {
            const resInv = await deleteTransactionFromDb(targetInvoice.id);
            if (!resInv.success) {
              showToast(`Gagal menghapus transaksi: ${resInv.error || 'Terjadi kesalahan'}`, 'error');
              setDbError(resInv.error || 'Gagal menghapus transaksi');
              return;
            }
            setInvoices((prev) => prev.filter((inv) => inv.id !== targetInvoice.id));
            showToast('Transaksi berhasil dihapus', 'delete');
          } else {
            setOrders((prev) => prev.filter((o) => o.id !== id));
            showToast('Item berhasil dihapus', 'delete');
          }
        } catch (err: any) {
          console.error('Error in handleDeleteOrder:', err);
          showToast(`Gagal menghapus: ${err?.message || 'Error tidak diketahui'}`, 'error');
        } finally {
          setIsLoadingDb(false);
          setConfirmState(null);
        }
      },
    });
  }, [orders, invoices, setConfirmState, setIsLoadingDb, showToast, setDbError, setOrders, setInvoices]);

  const handleDeleteBatchOrders = useCallback((items: OrderItem[]) => {
    if (!items || items.length === 0) return;
    const first = items[0];
    const desc = `${first.tujuanDapur || 'Dapur'} - ${first.toko || 'Toko'} (${first.tanggal})`;

    setConfirmState({
      isOpen: true,
      title: 'Hapus Seluruh Pesanan Transaksi',
      message: `Yakin hapus seluruh pesanan (${items.length} item) untuk ${desc}? Log transaksi terkait juga akan dihapus.`,
      onConfirm: async () => {
        setIsLoadingDb(true);
        setConfirmState((prev) => (prev ? { ...prev, isLoading: true } : null));

        try {
          const ids = items.map((it) => it.id);
          const res = await deleteOrdersFromDb(ids);
          if (!res.success) {
            const errMsg = typeof res.error === 'string' ? res.error : ((res.error as any)?.message || 'Terjadi kesalahan');
            showToast(`Gagal menghapus dari database: ${errMsg}`, 'error');
            return;
          }

          const itemIds = new Set(ids);
          setOrders((prev) => prev.filter((o) => !itemIds.has(o.id)));

          const batchTanggal = first.tanggal;
          const batchToko = first.toko || '';
          const batchDapur = first.tujuanDapur || '';
          const batchPemasok = first.pemasok || '';

          const matchingInvoices = invoices.filter((inv) => {
            if (itemIds.has(inv.id)) return true;
            if (inv.items && Array.isArray(inv.items) && inv.items.some((it) => itemIds.has(it.id))) return true;

            const invDate = inv.tanggalPrint || inv.tanggal || inv.createdAt?.split('T')[0] || '';
            const invToko = inv.toko || inv.items?.[0]?.toko || '';
            const invDapur = inv.tujuanDapur || inv.items?.[0]?.tujuanDapur || '';
            const invPemasok = inv.pemasok || inv.items?.[0]?.pemasok || '';

            return (
              invDate === batchTanggal &&
              invToko === batchToko &&
              (!batchDapur || invDapur === batchDapur) &&
              (!batchPemasok || invPemasok === batchPemasok)
            );
          });

          if (matchingInvoices.length > 0) {
            const invoiceIdsToDelete = matchingInvoices.map((inv) => inv.id).filter(Boolean);
            for (const invId of invoiceIdsToDelete) {
              await deleteTransactionFromDb(invId);
            }
            const delIdsSet = new Set(invoiceIdsToDelete);
            setInvoices((prev) => prev.filter((inv) => !delIdsSet.has(inv.id)));
          }

          showToast(`${items.length} pesanan & transaksi terkait berhasil dihapus`, 'delete');
        } catch (err: any) {
          console.error('Error handleDeleteBatchOrders:', err);
          showToast(`Gagal menghapus pesanan: ${err?.message || err}`, 'error');
        } finally {
          setIsLoadingDb(false);
          setConfirmState(null);
        }
      },
    });
  }, [invoices, setConfirmState, setIsLoadingDb, setOrders, setInvoices, showToast]);

  const handleDeleteKitchenOrders = useCallback((targetName: string, date: string) => {
    const matchingOrders = orders.filter(
      (o) => (o.toko === targetName || o.tujuanDapur === targetName) && o.tanggal === date
    );

    setConfirmState({
      isOpen: true,
      title: 'Hapus Semua Pesanan',
      message: `Hapus semua pesanan (${matchingOrders.length} item) untuk ${targetName} pada tanggal ${date}? Data akan dihapus permanen.`,
      onConfirm: async () => {
        setIsLoadingDb(true);
        setConfirmState((prev) => (prev ? { ...prev, isLoading: true } : null));

        try {
          const ids = matchingOrders.map((o) => o.id);
          if (ids.length > 0) {
            const res = await deleteOrdersFromDb(ids);
            if (!res.success) {
              showToast(`Gagal: ${res.error}`, 'error');
              return;
            }

            const itemIds = new Set(ids);
            const matchingInvoices = invoices.filter((inv) => {
              if (itemIds.has(inv.id)) return true;
              const invDate = inv.tanggalPrint || inv.tanggal;
              const invToko = inv.toko;
              const invDapur = inv.tujuanDapur;
              return (
                invDate === date &&
                (invToko === targetName || invDapur === targetName)
              );
            });

            for (const inv of matchingInvoices) {
              if (inv.id) await deleteTransactionFromDb(inv.id);
            }
            const delIds = new Set(matchingInvoices.map((inv) => inv.id));
            setInvoices((prev) => prev.filter((inv) => !delIds.has(inv.id)));
          }

          setOrders((prev) =>
            prev.filter(
              (o) => !((o.toko === targetName || o.tujuanDapur === targetName) && o.tanggal === date)
            )
          );
          showToast('Semua pesanan berhasil dihapus', 'delete');
        } catch (err: any) {
          console.error('Error deleting kitchen orders:', err);
          showToast(`Gagal: ${err?.message || err}`, 'error');
        } finally {
          setIsLoadingDb(false);
          setConfirmState(null);
        }
      },
    });
  }, [orders, invoices, setConfirmState, setIsLoadingDb, setInvoices, setOrders, showToast]);

  const handleOpenEditOrder = useCallback((item: OrderItem, batchItems?: OrderItem[]) => {
    let finalBatch = batchItems;
    if ((!finalBatch || finalBatch.length <= 1) && item) {
      const targetNota = item.notaId || item.nota_id;
      if (targetNota) {
        const matchingOrders = orders.filter(
          (o) => (o.notaId && o.notaId === targetNota) || (o.nota_id && o.nota_id === targetNota)
        );
        if (matchingOrders.length > 1) {
          finalBatch = matchingOrders;
        }
      } else if (item.tanggal && item.tujuanDapur && item.toko) {
        const matchingOrders = orders.filter(
          (o) =>
            o.tanggal === item.tanggal &&
            o.tujuanDapur === item.tujuanDapur &&
            o.toko === item.toko
        );
        if (matchingOrders.length > 1) {
          finalBatch = matchingOrders;
        }
      }
    }
    setEditingOrder(item);
    setEditingBatchOrders(finalBatch && finalBatch.length > 0 ? finalBatch : [item]);
    setPrefilledKitchen(item.tujuanDapur);
    setIsOrderModalOpen(true);
  }, [orders]);

  const handleOpenAddModal = useCallback((kitchenName?: string) => {
    setEditingOrder(null);
    setEditingBatchOrders([]);
    setPrefilledKitchen(kitchenName);
    setIsOrderModalOpen(true);
  }, []);

  return {
    isOrderModalOpen,
    setIsOrderModalOpen,
    editingOrder,
    setEditingOrder,
    editingBatchOrders,
    setEditingBatchOrders,
    prefilledKitchen,
    setPrefilledKitchen,
    handleToggleStatus,
    handleUpdatePaymentStatus,
    handleUpdateDeliveryStatus,
    handleUpdateGroupPaymentStatus,
    handleUpdateGroupDeliveryStatus,
    handleDuplicateOrder,
    handleToggleBatchStatus,
    handleSaveOrder,
    handleDeleteOrder,
    handleDeleteBatchOrders,
    handleDeleteKitchenOrders,
    handleOpenEditOrder,
    handleOpenAddModal,
  };
}
