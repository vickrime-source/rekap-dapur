import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { OrderItem, InvoiceRecord, ExportHistoryItem, InvoicePriceVariant } from '../types';
import { parseIndonesianNumber } from '../lib/formatters';
import { exportHtmlInvoicePdf } from '../lib/htmlInvoicePdf';
import { downloadDocxInvoice } from '../lib/docxTemplate';
import { 
  saveTransactionToDb, 
  deleteTransactionFromDb, 
  deleteOrdersFromDb 
} from '../lib/supabaseDb';
import { ConfirmDialogState } from './useConfirmDialog';

interface UseInvoiceFlowProps {
  invoices: InvoiceRecord[];
  setInvoices: Dispatch<SetStateAction<InvoiceRecord[]>>;
  setOrders: Dispatch<SetStateAction<OrderItem[]>>;
  exportHistory: ExportHistoryItem[];
  setExportHistory: Dispatch<SetStateAction<ExportHistoryItem[]>>;
  setIsLoadingDb: (loading: boolean) => void;
  setDbError: (error: string | null) => void;
  setConfirmState: Dispatch<SetStateAction<ConfirmDialogState | null>>;
  showToast: (message: string, type?: 'success' | 'delete' | 'edit' | 'info' | 'error') => void;
}

export function useInvoiceFlow({
  invoices,
  setInvoices,
  setOrders,
  exportHistory,
  setExportHistory,
  setIsLoadingDb,
  setDbError,
  setConfirmState,
  showToast,
}: UseInvoiceFlowProps) {
  const [isExportingActive, setIsExportingActive] = useState(false);
  const [isExportHistoryOpen, setIsExportHistoryOpen] = useState(false);

  // Invoice Form (Step 1 Confirmation) & Invoice Modal (Step 2 Preview) States
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);
  const [invoiceFormItems, setInvoiceFormItems] = useState<OrderItem[]>([]);
  const [invoiceFormKitchen, setInvoiceFormKitchen] = useState<string | undefined>();
  const [invoiceFormStore, setInvoiceFormStore] = useState<string | undefined>();

  const [invoiceRecipientName, setInvoiceRecipientName] = useState('');
  const [invoiceRecipientAddress, setInvoiceRecipientAddress] = useState('');
  const [invoiceRecipientPhone, setInvoiceRecipientPhone] = useState('');
  const [invoiceBayar, setInvoiceBayar] = useState<number>(0);

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceInitialFullPreview, setInvoiceInitialFullPreview] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<OrderItem[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceTargetKitchen, setInvoiceTargetKitchen] = useState<string | undefined>();
  const [invoiceTargetStore, setInvoiceTargetStore] = useState<string | undefined>();

  // 1-Click Instant Invoice PDF Download
  const handleDirect1ClickExportInvoicePdf = useCallback(async (
    items: OrderItem[],
    kitchenName: string,
    storeName: string,
    dateStr?: string,
    variant: InvoicePriceVariant = 'ori'
  ) => {
    if (!items || items.length === 0) {
      showToast('Tidak ada item untuk dibuatkan invoice', 'error');
      return;
    }

    setIsExportingActive(true);
    const targetKitchen = kitchenName || items[0]?.tujuanDapur || 'Siliragung';
    const targetStore = storeName || items[0]?.toko || 'HTG';
    const invNum = items[0]?.invoiceNumber || items[0]?.invoice_number || '';

    // Calculate totalAmount according to variant
    const totalAmount = items.reduce(
      (sum, item) => {
        const rawQJ = parseIndonesianNumber(item.qty);
        const rt = Math.max(0, Number(item.retur) || 0);
        const qf = Math.max(0, rawQJ - rt);
        const hj = parseIndonesianNumber(item.hargaJual || 0);
        const cb = Number(item.cashback) || 0;
        const p = (variant === 'cashback' && cb > 0) ? cb : hj;
        return sum + qf * p;
      },
      0
    );

    try {
      const res = await exportHtmlInvoicePdf({
        storeName: targetStore,
        kitchenName: targetKitchen,
        items: items,
        invoiceNumber: invNum,
        bayar: totalAmount,
        customNama: targetKitchen,
        customAlamat: '-',
        customNomor: '-',
        customTanggal: dateStr,
        priceVariant: variant,
      });

      if (res && res.pdfUrl) {
        const newHistoryItem: ExportHistoryItem = {
          id: `exp-${Date.now()}`,
          invoiceNumber: invNum,
          toko: targetStore,
          tujuanDapur: targetKitchen,
          totalAmount,
          totalJual: totalAmount,
          itemCount: items.length,
          tanggal: dateStr || new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          fileName: res.fileName,
          fileUrl: res.pdfUrl,
          pdfUrl: res.pdfUrl,
          type: 'pdf',
          fileType: 'pdf',
        };

        setExportHistory((prev) => [newHistoryItem, ...prev]);

        // Auto save invoice record
        const totalBeli = items.reduce((s, i) => {
          const rawQJ = Number(i.qty || 0);
          const rawQB = (i as any).qtyBeli !== undefined && (i as any).qtyBeli !== null
            ? Number((i as any).qtyBeli)
            : ((i as any).qty_beli !== undefined && (i as any).qty_beli !== null
              ? Number((i as any).qty_beli)
              : rawQJ);
          const rt = Math.max(0, Number(i.retur) || 0);
          const qbe = Math.max(0, rawQB - rt);
          return s + qbe * (i.hargaBeli || 0);
        }, 0);
        const totalJual = items.reduce((s, i) => {
          const rawQJ = Number(i.qty || 0);
          const rt = Math.max(0, Number(i.retur) || 0);
          const qf = Math.max(0, rawQJ - rt);
          return s + qf * (i.hargaJual || 0);
        }, 0);
        const newRecord: InvoiceRecord = {
          id: `inv-rec-${Date.now()}`,
          invoiceNumber: invNum,
          tanggalPrint: new Date().toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
          createdAt: new Date().toISOString(),
          tujuanDapur: targetKitchen,
          toko: targetStore,
          items: items,
          totalBeli,
          totalJual,
          totalProfit: totalJual - totalBeli,
        };

        setInvoices((prev) => [newRecord, ...prev]);

        saveTransactionToDb(newRecord).catch(() => {});

        const variantBadge = variant === 'cashback' ? ' (Varian Cashback)' : '';
        showToast(`Invoice Dapur ${targetKitchen}${variantBadge} berhasil diunduh (${res.fileName})!`, 'success');
      }
    } catch (err: any) {
      console.error('Direct PDF export error:', err);
      showToast(`Gagal export PDF: ${err?.message || err}`, 'error');
    } finally {
      setIsExportingActive(false);
    }
  }, [setExportHistory, setInvoices, showToast]);

  const handleStartInvoiceFlow = useCallback((
    items: OrderItem[],
    kitchenName?: string,
    storeName?: string,
    _dateStr?: string
  ) => {
    if (items.length === 0) {
      alert('Tidak ada item untuk dibuatkan invoice');
      return;
    }

    const mainKitchen = kitchenName || items[0]?.tujuanDapur;
    const mainStore = storeName || items[0]?.toko;
    const mainDate = _dateStr || items[0]?.tanggal;

    const normStore = (mainStore || '').trim().toLowerCase();
    const normKitchen = (mainKitchen || '').trim().toLowerCase();

    const scopedItems = items.filter((item) => {
      const matchStore = !normStore || item.toko.trim().toLowerCase() === normStore;
      const matchKitchen = !normKitchen || item.tujuanDapur.trim().toLowerCase() === normKitchen;
      const matchDate = !mainDate || item.tanggal === mainDate;
      return matchStore && matchKitchen && matchDate;
    });

    const finalItems = scopedItems.length > 0 ? scopedItems : items;

    setInvoiceFormItems(finalItems);
    setInvoiceFormKitchen(mainKitchen);
    setInvoiceFormStore(mainStore);
    setIsInvoiceFormOpen(true);
  }, []);

  const handleConfirmInvoiceForm = useCallback((data: {
    items: OrderItem[];
    kitchenName: string;
    storeName: string;
    recipientName: string;
    address: string;
    phone: string;
    bayar: number;
  }) => {
    setIsInvoiceFormOpen(false);

    setInvoiceRecipientName(data.recipientName);
    setInvoiceRecipientAddress(data.address);
    setInvoiceRecipientPhone(data.phone);
    setInvoiceBayar(data.bayar);

    const invNum = data.items[0]?.invoiceNumber || data.items[0]?.invoice_number || '';

    setInvoiceItems(data.items);
    setInvoiceNumber(invNum);
    setInvoiceTargetKitchen(data.kitchenName);
    setInvoiceTargetStore(data.storeName);
    setInvoiceInitialFullPreview(false);
    setIsInvoiceModalOpen(true);
  }, []);

  const handleViewInvoice = useCallback((
    items: OrderItem[],
    kitchenName?: string,
    storeName?: string,
    _dateStr?: string
  ) => {
    if (!items || items.length === 0) {
      showToast('Tidak ada item untuk dilihat invoice-nya', 'error');
      return;
    }

    const targetKitchen = kitchenName || items[0]?.tujuanDapur || 'Siliragung';
    const targetStore = storeName || items[0]?.toko || 'HTG';
    const invNum = items[0]?.invoiceNumber || items[0]?.invoice_number || '';

    const totalAmount = items.reduce(
      (sum, item) => {
        const rawQJ = parseIndonesianNumber(item.qty);
        const rt = Math.max(0, Number(item.retur) || 0);
        const qf = Math.max(0, rawQJ - rt);
        return sum + qf * parseIndonesianNumber(item.hargaJual || 0);
      },
      0
    );

    setInvoiceRecipientName(targetKitchen);
    setInvoiceRecipientAddress('-');
    setInvoiceRecipientPhone('-');
    setInvoiceBayar(totalAmount);
    setInvoiceItems(items);
    setInvoiceNumber(invNum);
    setInvoiceTargetKitchen(targetKitchen);
    setInvoiceTargetStore(targetStore);
    setInvoiceInitialFullPreview(true);
    setIsInvoiceModalOpen(true);
  }, [showToast]);

  const handleSaveInvoiceRecord = useCallback(async () => {
    const targetNotaId = invoiceItems[0]?.notaId || invoiceItems[0]?.nota_id;
    if (targetNotaId && invoices.some((inv) => inv.items?.some((it) => (it.notaId || it.nota_id) === targetNotaId))) return;

    const totalBeli = invoiceItems.reduce((s, i) => {
      const rawQJ = Number(i.qty || 0);
      const rawQB = (i as any).qtyBeli !== undefined && (i as any).qtyBeli !== null
        ? Number((i as any).qtyBeli)
        : ((i as any).qty_beli !== undefined && (i as any).qty_beli !== null
          ? Number((i as any).qty_beli)
          : rawQJ);
      const rt = Math.max(0, Number(i.retur) || 0);
      const qbe = Math.max(0, rawQB - rt);
      return s + qbe * (i.hargaBeli || 0);
    }, 0);
    const totalJual = invoiceItems.reduce((s, i) => {
      const rawQJ = Number(i.qty || 0);
      const rt = Math.max(0, Number(i.retur) || 0);
      const qf = Math.max(0, rawQJ - rt);
      return s + qf * (i.hargaJual || 0);
    }, 0);
    const newRecord: InvoiceRecord = {
      id: `inv-rec-${Date.now()}`,
      invoiceNumber,
      tanggalPrint: new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      createdAt: new Date().toISOString(),
      tujuanDapur: invoiceTargetKitchen || invoiceItems[0]?.tujuanDapur || 'Dapur',
      toko: invoiceTargetStore || invoiceItems[0]?.toko || 'HTG',
      items: invoiceItems,
      totalBeli,
      totalJual,
      totalProfit: totalJual - totalBeli,
    };

    setIsLoadingDb(true);
    const res = await saveTransactionToDb(newRecord);
    setIsLoadingDb(false);

    setInvoices((prev) => [newRecord, ...prev]);

    if (res.success) {
      showToast('Invoice & Transaksi berhasil tersimpan', 'success');
    } else {
      setDbError(res.error || 'Gagal koneksi ke database');
      showToast(`Invoice tersimpan di HP. (Gagal sync: ${res.error || 'Error'})`, 'info');
    }
  }, [invoices, invoiceNumber, invoiceItems, invoiceTargetKitchen, invoiceTargetStore, setIsLoadingDb, setInvoices, showToast, setDbError]);

  const handleTriggerBackgroundExport = useCallback(async (options: {
    storeName: string;
    kitchenName: string;
    items: OrderItem[];
    invoiceNumber: string;
    bayar: number;
    customNama: string;
    customAlamat: string;
    customNomor: string;
    type: 'pdf' | 'docx';
    priceVariant?: InvoicePriceVariant;
  }) => {
    setIsExportingActive(true);
    const variant = options.priceVariant || 'ori';

    const totalAmount = options.items.reduce(
      (sum, item) => {
        const rawQJ = parseIndonesianNumber(item.qty);
        const rt = Math.max(0, Number(item.retur) || 0);
        const qf = Math.max(0, rawQJ - rt);
        const hj = parseIndonesianNumber(item.hargaJual || 0);
        const cb = Number(item.cashback) || 0;
        const p = (variant === 'cashback' && cb > 0) ? cb : hj;
        return sum + qf * p;
      },
      0
    );

    try {
      if (options.type === 'pdf') {
        const res = await exportHtmlInvoicePdf({
          storeName: options.storeName,
          kitchenName: options.kitchenName,
          items: options.items,
          invoiceNumber: options.invoiceNumber,
          bayar: options.bayar,
          customNama: options.customNama,
          customAlamat: options.customAlamat,
          customNomor: options.customNomor,
          priceVariant: variant,
        });

        if (res && res.pdfUrl) {
          const newHistoryItem: ExportHistoryItem = {
            id: `exp-${Date.now()}`,
            invoiceNumber: options.invoiceNumber,
            toko: options.storeName,
            tujuanDapur: options.kitchenName,
            totalAmount,
            totalJual: totalAmount,
            itemCount: options.items.length,
            tanggal: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            fileName: res.fileName,
            fileUrl: res.pdfUrl,
            pdfUrl: res.pdfUrl,
            type: 'pdf',
            fileType: 'pdf',
          };

          setExportHistory((prev) => [newHistoryItem, ...prev]);
          showToast(`Invoice ${options.invoiceNumber} berhasil dicetak! Klik ikon Download di atas untuk melihat/unduh.`, 'success');
        }
      } else {
        await downloadDocxInvoice({
          storeName: options.storeName,
          kitchenName: options.kitchenName,
          items: options.items,
          invoiceNumber: options.invoiceNumber,
          bayar: options.bayar,
          customNama: options.customNama,
          customAlamat: options.customAlamat,
          customNomor: options.customNomor,
        });

        const newHistoryItem: ExportHistoryItem = {
          id: `exp-${Date.now()}`,
          invoiceNumber: options.invoiceNumber,
          toko: options.storeName,
          tujuanDapur: options.kitchenName,
          totalAmount,
          totalJual: totalAmount,
          itemCount: options.items.length,
          tanggal: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          fileName: `Invoice_${(options.invoiceNumber || '').replace(/\//g, '-')}.docx`,
          type: 'docx',
          fileType: 'docx',
        };

        setExportHistory((prev) => [newHistoryItem, ...prev]);
        showToast(`File Word Invoice ${options.invoiceNumber} siap!`, 'success');
      }
    } catch (err: any) {
      console.error('Background Export Error:', err);
      showToast(`Gagal export: ${err?.message || err}`, 'error');
    } finally {
      setIsExportingActive(false);
    }
  }, [setExportHistory, showToast]);

  const handleDeleteTransaction = useCallback((batch: any) => {
    const batchDesc = `${batch.toko || batch.tujuanDapur || 'Transaksi'} (${batch.tanggal})`;
    setConfirmState({
      isOpen: true,
      title: 'Konfirmasi Hapus Transaksi',
      message: `Yakin hapus transaksi untuk ${batchDesc}? Data pesanan terkait juga akan dihapus.`,
      onConfirm: async () => {
        setIsLoadingDb(true);
        setConfirmState((prev) => (prev ? { ...prev, isLoading: true } : null));

        try {
          const batchItemIds = (batch.items || []).map((it: any) => it.id).filter(Boolean);
          if (batchItemIds.length > 0) {
            await deleteOrdersFromDb(batchItemIds);
          }

          if (batch.id) {
            await deleteTransactionFromDb(batch.id);
          }

          const batchItemIdsSet = new Set(batchItemIds);
          setInvoices((prev) =>
            prev.filter((inv) => {
              if (inv.id === batch.id) return false;
              const invDate = inv.tanggalPrint || inv.tanggal;
              if (
                invDate === batch.tanggal &&
                (inv.toko || '') === (batch.toko || '') &&
                (inv.pemasok || '') === (batch.pemasok || '')
              ) {
                return false;
              }
              return true;
            })
          );

          setOrders((prev) =>
            prev.map((o) => {
              const match =
                batchItemIdsSet.has(o.id) ||
                (o.tanggal === batch.tanggal &&
                  (o.toko === batch.toko || o.tujuanDapur === batch.tujuanDapur) &&
                  o.pemasok === batch.pemasok);
              if (match) {
                return {
                  ...o,
                  status: 'CANCELLED',
                  statusPembatalan: 'DIBATALKAN',
                  status_pembatalan: 'DIBATALKAN',
                  cancelledAt: new Date().toISOString(),
                  cancelled_at: new Date().toISOString(),
                };
              }
              return o;
            })
          );

          showToast(`Transaksi ${batchDesc} berhasil dihapus`, 'delete');
        } catch (err: any) {
          console.error('Error deleting transaction:', err);
          showToast(`Gagal menghapus transaksi: ${err?.message || err}`, 'error');
        } finally {
          setIsLoadingDb(false);
          setConfirmState(null);
        }
      },
    });
  }, [setConfirmState, setIsLoadingDb, setInvoices, setOrders, showToast]);

  const handleDeleteInvoice = useCallback((id: string) => {
    const targetInvoice = invoices.find((inv) => inv.id === id);
    const desc = targetInvoice?.invoiceNumber || targetInvoice?.toko || 'transaksi ini';

    setConfirmState({
      isOpen: true,
      title: 'Konfirmasi Hapus Transaksi',
      message: `Yakin hapus transaksi "${desc}"? Data akan dihapus secara permanen.`,
      onConfirm: async () => {
        setIsLoadingDb(true);
        setConfirmState((prev) => (prev ? { ...prev, isLoading: true } : null));

        try {
          if (targetInvoice) {
            const res = await deleteTransactionFromDb(targetInvoice.id);
            if (!res.success) {
              showToast(`Gagal menghapus transaksi: ${res.error || 'Terjadi kesalahan'}`, 'error');
              return;
            }
          }

          setInvoices((prev) => prev.filter((inv) => inv.id !== id));
          showToast('Transaksi berhasil dihapus', 'delete');
        } catch (e: any) {
          console.warn('Error deleting invoice:', e);
          showToast(`Gagal menghapus: ${e?.message || 'Error'}`, 'error');
        } finally {
          setIsLoadingDb(false);
          setConfirmState(null);
        }
      },
    });
  }, [invoices, setConfirmState, setIsLoadingDb, setInvoices, showToast]);

  return {
    isExportingActive,
    isExportHistoryOpen,
    setIsExportHistoryOpen,
    isInvoiceFormOpen,
    setIsInvoiceFormOpen,
    invoiceFormItems,
    invoiceFormKitchen,
    invoiceFormStore,
    invoiceRecipientName,
    invoiceRecipientAddress,
    invoiceRecipientPhone,
    invoiceBayar,
    isInvoiceModalOpen,
    setIsInvoiceModalOpen,
    invoiceInitialFullPreview,
    setInvoiceInitialFullPreview,
    invoiceItems,
    invoiceNumber,
    invoiceTargetKitchen,
    invoiceTargetStore,
    handleDirect1ClickExportInvoicePdf,
    handleStartInvoiceFlow,
    handleConfirmInvoiceForm,
    handleViewInvoice,
    handleSaveInvoiceRecord,
    handleTriggerBackgroundExport,
    handleDeleteTransaction,
    handleDeleteInvoice,
  };
}
