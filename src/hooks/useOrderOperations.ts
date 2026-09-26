import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { 
  OrderItem, 
  InvoiceRecord, 
  PaymentStatus, 
  DeliveryStatus, 
  MasterToko, 
  MasterPemasok, 
  MasterDapur, 
  Store as StoreType, 
  Kitchen, 
  TextParseResult 
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
  stores: StoreType[];
  kitchens: Kitchen[];
  pemasokList: string[];
  selectedDate: string;
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
  stores,
  kitchens,
  pemasokList,
  selectedDate,
  setSelectedDate,
  setIsLoadingDb,
  setDbError,
  setConfirmState,
  showToast,
}: UseOrderOperationsProps) {
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderItem | null>(null);
  const [prefilledKitchen, setPrefilledKitchen] = useState<string | undefined>();

  const handleToggleStatus = useCallback((id: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, status: o.status === 'pending' ? 'selesai' : 'pending' } : o
      )
    );
  }, [setOrders]);

  const handleUpdatePaymentStatus = useCallback(async (id: string, paymentStatus: PaymentStatus) => {
    let targetOrder: OrderItem | undefined;
    let newStatus: 'pending' | 'selesai' = 'pending';

    setOrders((prev) => {
      targetOrder = prev.find((o) => o.id === id);
      if (!targetOrder) return prev;
      const delStatus = targetOrder.deliveryStatus || (targetOrder.status === 'selesai' ? 'DONE' : 'PENDING');
      newStatus = paymentStatus === 'PAID' && delStatus === 'DONE' ? 'selesai' : 'pending';

      return prev.map((o) => {
        if (o.id !== id) return o;
        return {
          ...o,
          paymentStatus,
          status: newStatus,
        };
      });
    });

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
  }, [setOrders, setDbError, showToast]);

  const handleUpdateDeliveryStatus = useCallback(async (id: string, deliveryStatus: DeliveryStatus) => {
    let targetOrder: OrderItem | undefined;
    let newStatus: 'pending' | 'selesai' = 'pending';

    setOrders((prev) => {
      targetOrder = prev.find((o) => o.id === id);
      if (!targetOrder) return prev;
      const payStatus = targetOrder.paymentStatus || (targetOrder.status === 'selesai' ? 'PAID' : 'UNPAID');
      newStatus = payStatus === 'PAID' && deliveryStatus === 'DONE' ? 'selesai' : 'pending';

      return prev.map((o) => {
        if (o.id !== id) return o;
        return {
          ...o,
          deliveryStatus,
          status: newStatus,
        };
      });
    });

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
  }, [setOrders, setDbError, showToast]);

  const handleUpdateGroupPaymentStatus = useCallback(async (groupItems: OrderItem[], paymentStatus: PaymentStatus) => {
    if (!groupItems || groupItems.length === 0) return;
    const targetIds = groupItems.map((it) => it.id);
    const targetIdsSet = new Set(targetIds);

    setOrders((prev) =>
      prev.map((o) => {
        if (!targetIdsSet.has(o.id)) return o;
        const delStatus = o.deliveryStatus || (o.status === 'selesai' ? 'DONE' : 'PENDING');
        const newStatus = paymentStatus === 'PAID' && delStatus === 'DONE' ? 'selesai' : 'pending';
        return {
          ...o,
          paymentStatus,
          status: newStatus,
        };
      })
    );

    const res = await batchUpdateStatusInDb(targetIds, {
      paymentStatus,
      status: paymentStatus === 'PAID' ? 'selesai' : 'pending',
    });
    if (!res.success) {
      setDbError(res.error || 'Gagal update pembayaran grup');
      showToast(`Gagal update grup: ${res.error}`, 'error');
    } else {
      showToast(`Status pembayaran grup berhasil diperbarui (${paymentStatus})`, 'success');
    }
  }, [setOrders, setDbError, showToast]);

  const handleUpdateGroupDeliveryStatus = useCallback(async (groupItems: OrderItem[], deliveryStatus: DeliveryStatus) => {
    if (!groupItems || groupItems.length === 0) return;
    const targetIds = groupItems.map((it) => it.id);
    const targetIdsSet = new Set(targetIds);

    setOrders((prev) =>
      prev.map((o) => {
        if (!targetIdsSet.has(o.id)) return o;
        const payStatus = o.paymentStatus || (o.status === 'selesai' ? 'PAID' : 'UNPAID');
        const newStatus = payStatus === 'PAID' && deliveryStatus === 'DONE' ? 'selesai' : 'pending';
        return {
          ...o,
          deliveryStatus,
          status: newStatus,
        };
      })
    );

    const res = await batchUpdateStatusInDb(targetIds, {
      deliveryStatus,
      status: deliveryStatus === 'DONE' ? 'selesai' : 'pending',
    });
    if (!res.success) {
      setDbError(res.error || 'Gagal update pengiriman grup');
      showToast(`Gagal update pengiriman grup: ${res.error}`, 'error');
    } else {
      showToast(`Status pengiriman grup berhasil diperbarui (${deliveryStatus})`, 'success');
    }
  }, [setOrders, setDbError, showToast]);

  const handleDuplicateOrder = useCallback(async (item: OrderItem) => {
    const duplicated: OrderItem = {
      ...item,
      id: `ord-dup-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: getNowWIBISOString(),
    };

    setOrders((prev) => [duplicated, ...prev]);

    setIsLoadingDb(true);
    const res = await saveOrderToDb(duplicated);
    setIsLoadingDb(false);

    if (res.success) {
      showToast('Pesanan berhasil diduplikasi & tersimpan', 'success');
    } else {
      setDbError(res.error || 'Gagal menyimpan pesanan');
      showToast(`Pesanan tersimpan di HP. Gagal simpan ke database: ${res.error}`, 'info');
    }
  }, [setOrders, setIsLoadingDb, showToast, setDbError]);

  const handleToggleBatchStatus = useCallback((targetName: string, date: string, targetStatus: 'pending' | 'selesai') => {
    setOrders((prev) =>
      prev.map((o) =>
        (o.toko === targetName || o.tujuanDapur === targetName) && o.tanggal === date
          ? { ...o, status: targetStatus }
          : o
      )
    );
  }, [setOrders]);

  const handleSaveOrder = useCallback(async (
    orderData: Omit<OrderItem, 'id' | 'createdAt'> | Array<Omit<OrderItem, 'id' | 'createdAt'>>,
    editId?: string
  ) => {
    if (editId && !Array.isArray(orderData)) {
      const oldOrder = orders.find((o) => o.id === editId);
      const curToko = (orderData as any).toko || oldOrder?.toko || '';
      const curPemasok = (orderData as any).pemasok || oldOrder?.pemasok || '';
      const curDapur = (orderData as any).tujuanDapur || oldOrder?.tujuanDapur || '';
      const cleanD = curDapur.replace(/^dapur\s+/i, '').trim().toLowerCase();

      const fTokoId = (orderData as any).toko_id || (orderData as any).tokoId || masterToko.find((t) => t.nama.toLowerCase() === curToko.trim().toLowerCase())?.id || oldOrder?.toko_id || null;
      const fPemasokId = (orderData as any).pemasok_id || (orderData as any).pemasokId || masterPemasok.find((p) => p.nama.toLowerCase() === curPemasok.trim().toLowerCase())?.id || oldOrder?.pemasok_id || null;
      const fDapurId = (orderData as any).dapur_id || (orderData as any).dapurId || masterDapur.find((d) => d.nama.toLowerCase() === curDapur.trim().toLowerCase() || d.nama.toLowerCase() === cleanD)?.id || oldOrder?.dapur_id || null;

      const updatedOrder: OrderItem = {
        ...(oldOrder || {}),
        ...orderData,
        toko_id: fTokoId,
        pemasok_id: fPemasokId,
        dapur_id: fDapurId,
        id: editId,
        createdAt: oldOrder?.createdAt || getNowWIBISOString(),
      } as OrderItem;

      setOrders((prev) =>
        prev.map((o) => (o.id === editId ? updatedOrder : o))
      );
      showToast('Pesanan berhasil diperbarui', 'edit');

      setIsLoadingDb(true);
      const res = await updateOrderInDb(editId, updatedOrder);
      setIsLoadingDb(false);
      if (!res.success) {
        setDbError(res.error || 'Gagal update pesanan di Supabase');
        showToast(`Pesanan diperbarui di HP. Gagal simpan ke database: ${res.error}`, 'info');
      } else {
        showToast('Pesanan berhasil diperbarui & tersimpan', 'edit');
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
    if (batchRes.success) {
      successCount = newOrdersAdded.length;
    } else {
      lastError = batchRes.error || 'Gagal menyimpan pesanan ke database';
    }

    if (newOrdersAdded.length > 0) {
      const firstItem = newOrdersAdded[0];
      const totalBeli = newOrdersAdded.reduce((sum, it) => {
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
      const totalJual = newOrdersAdded.reduce((sum, it) => {
        const rawQJ = Number(it.qty || 0);
        const rt = Math.max(0, Number(it.retur) || 0);
        const qf = Math.max(0, rawQJ - rt);
        return sum + qf * Number(it.hargaJual || it.hargaBeli || 0);
      }, 0);
      const newInvoiceRec: InvoiceRecord = {
        id: `tx-${Date.now()}`,
        invoiceNumber: `TRX-${Date.now().toString().slice(-6)}`,
        tanggalPrint: firstItem.tanggal,
        createdAt: createdDate,
        tujuanDapur: firstItem.tujuanDapur,
        dapur_id: firstItem.dapur_id || null,
        toko: firstItem.toko,
        toko_id: firstItem.toko_id || null,
        items: newOrdersAdded,
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
                      return s + qf * (Number(it.hargaJual || it.hargaBeli) || 0);
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

  const handleOpenEditOrder = useCallback((item: OrderItem) => {
    setEditingOrder(item);
    setPrefilledKitchen(item.tujuanDapur);
    setIsOrderModalOpen(true);
  }, []);

  const handleOpenAddModal = useCallback((kitchenName?: string) => {
    setEditingOrder(null);
    setPrefilledKitchen(kitchenName);
    setIsOrderModalOpen(true);
  }, []);

  const handleEditOrderVoice = useCallback((params: {
    targetBarang: string;
    targetDapur?: string;
    newQty?: number;
    newSatuan?: string;
    newHargaBeli?: number;
    newHargaJual?: number;
  }): boolean => {
    const lowerTarget = params.targetBarang.toLowerCase().trim();
    if (!lowerTarget) return false;

    const found = orders.find((o) => {
      const oName = o.namaBarang.toLowerCase();
      const matchBarang = oName.includes(lowerTarget) || lowerTarget.includes(oName);
      if (!matchBarang) return false;
      if (params.targetDapur) {
        return o.tujuanDapur.toLowerCase().includes(params.targetDapur.toLowerCase());
      }
      return true;
    });

    if (!found) return false;

    const updated: OrderItem = {
      ...found,
      qty: params.newQty !== undefined ? params.newQty : found.qty,
      satuan: params.newSatuan || found.satuan,
      hargaBeli: params.newHargaBeli !== undefined ? params.newHargaBeli : found.hargaBeli,
      hargaJual: params.newHargaJual !== undefined ? params.newHargaJual : found.hargaJual,
    };

    handleSaveOrder(updated, found.id);
    showToast(`Pesanan "${found.namaBarang}" berhasil diperbarui`, 'success');
    return true;
  }, [orders, handleSaveOrder, showToast]);

  const handleImportParsedItems = useCallback(async (parsedResults: TextParseResult[], targetDate: string) => {
    const validParsed = parsedResults.filter((r) => r.namaBarang && r.namaBarang.trim() !== '');
    if (validParsed.length === 0) {
      showToast('Tidak ada item valid untuk diimport', 'error');
      return;
    }

    const newOrdersAdded: OrderItem[] = validParsed.map((res, index) => ({
      id: `ord-imp-${Date.now()}-${index}`,
      namaBarang: res.namaBarang.trim(),
      item: res.namaBarang.trim(),
      qty: Number(res.qty) > 0 ? Number(res.qty) : 1,
      satuan: res.satuan || 'Kg',
      hargaBeli: Number(res.hargaBeli) || 0,
      hargaJual: Number(res.hargaJual) || 0,
      toko: res.toko || stores[0]?.nama || 'HTG',
      tujuanDapur: res.tujuanDapur || kitchens[0]?.nama || 'Dapur',
      dapur: res.tujuanDapur || kitchens[0]?.nama || 'Dapur',
      pemasok: res.pemasok || pemasokList[0] || 'Ajeng fruits',
      status: 'pending',
      tanggal: targetDate || selectedDate,
      createdAt: new Date().toISOString(),
    }));

    setOrders((prev) => [...newOrdersAdded, ...prev]);

    setIsLoadingDb(true);
    let successCount = 0;
    let lastError = '';

    for (let index = 0; index < newOrdersAdded.length; index++) {
      const newOrderItem = newOrdersAdded[index];
      const saveRes = await saveOrderToDb(newOrderItem);

      if (saveRes.success) {
        successCount++;
      } else {
        lastError = saveRes.error || 'Gagal menyimpan pesanan';
      }
    }

    setIsLoadingDb(false);

    if (successCount === newOrdersAdded.length) {
      showToast(`${successCount} item import berhasil tersimpan`, 'success');
    } else {
      setDbError(lastError);
      showToast(`${newOrdersAdded.length} item import tersimpan di HP. Error sync: ${lastError}`, 'info');
    }
  }, [stores, kitchens, pemasokList, selectedDate, setOrders, setIsLoadingDb, showToast, setDbError]);

  return {
    isOrderModalOpen,
    setIsOrderModalOpen,
    editingOrder,
    setEditingOrder,
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
    handleEditOrderVoice,
    handleImportParsedItems,
  };
}
