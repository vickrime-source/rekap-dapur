import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Receipt, 
  Download, 
  Eye, 
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { OrderItem } from '../types';
import { formatRupiah, formatTanggalInvoice, resolveRecipientSppgName, parseIndonesianNumber } from '../lib/formatters';
import { getStoreProfile } from '../lib/storeProfiles';
import { getStoreInvoiceConfig } from '../lib/invoiceStyles';
import { exportHtmlInvoicePng } from '../lib/htmlInvoicePdf';
import { InvoicePaperA4 } from './InvoicePaperA4';
import { motion, AnimatePresence } from 'motion/react';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber: string;
  items: OrderItem[];
  tujuanDapur?: string;
  toko?: string;
  recipientName?: string;
  recipientAddress?: string;
  recipientPhone?: string;
  bayarAmount?: number;
  initialFullPreview?: boolean;
  onTriggerBackgroundExport?: (options: {
    storeName: string;
    kitchenName: string;
    items: OrderItem[];
    invoiceNumber: string;
    bayar: number;
    customNama: string;
    customAlamat: string;
    customNomor: string;
    type: 'pdf' | 'docx';
  }) => void;
  onSaveInvoiceRecord?: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  invoiceNumber,
  items,
  tujuanDapur,
  toko,
  recipientName,
  recipientAddress,
  recipientPhone,
  bayarAmount = 0,
  initialFullPreview = false,
  onTriggerBackgroundExport,
  onSaveInvoiceRecord,
}) => {
  const [bayar, setBayar] = useState<number>(bayarAmount);
  const [isViewFull, setIsViewFull] = useState(false);
  const [isGeneratingPng, setIsGeneratingPng] = useState(false);
  const invoicePaperRef = useRef<HTMLDivElement>(null);
  const fullViewPaperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setBayar(bayarAmount);
      setIsViewFull(false);
    }
  }, [isOpen, bayarAmount]);

  if (!isOpen || items.length === 0) return null;

  // Filter items strictly to match store + kitchen + date
  const targetStore = (toko || items[0]?.toko || '').trim().toLowerCase();
  const targetKitchen = (tujuanDapur || items[0]?.tujuanDapur || '').trim().toLowerCase();
  const targetDate = items[0]?.tanggal;

  const scopedItems = items.filter((item) => {
    const matchStore = !targetStore || item.toko.trim().toLowerCase() === targetStore;
    const matchKitchen = !targetKitchen || item.tujuanDapur.trim().toLowerCase() === targetKitchen;
    const matchDate = !targetDate || item.tanggal === targetDate;
    return matchStore && matchKitchen && matchDate;
  });

  const displayItems = scopedItems.length > 0 ? scopedItems : items;

  const totalJual = displayItems.reduce((sum, item) => {
    const q = parseIndonesianNumber(item.qty);
    const p = parseIndonesianNumber(item.hargaJual || item.hargaBeli || 0);
    return sum + q * p;
  }, 0);
  const sisa = Math.max(0, totalJual - parseIndonesianNumber(bayar));

  const mainKitchen = tujuanDapur || displayItems[0]?.tujuanDapur || 'Dapur';
  const mainStore = toko || displayItems[0]?.toko || 'HTG';
  const profile = getStoreProfile(mainStore);
  const styleConfig = getStoreInvoiceConfig(mainStore);
  
  const finalRecipientName = resolveRecipientSppgName(recipientName, mainKitchen, displayItems);
  const invoiceDate = formatTanggalInvoice(displayItems[0]?.tanggal || new Date());

  const handleStartPdfExport = () => {
    if (onSaveInvoiceRecord) {
      onSaveInvoiceRecord();
    }
    if (onTriggerBackgroundExport) {
      onTriggerBackgroundExport({
        storeName: mainStore,
        kitchenName: mainKitchen,
        items: displayItems,
        invoiceNumber,
        bayar,
        customNama: finalRecipientName,
        customAlamat: recipientAddress || '-',
        customNomor: recipientPhone || '-',
        customTanggal: invoiceDate,
        type: 'pdf',
      });
    }
    onClose();
  };

  const handleStartPngExport = async () => {
    if (isGeneratingPng) return;
    setIsGeneratingPng(true);
    try {
      if (onSaveInvoiceRecord) {
        onSaveInvoiceRecord();
      }
      const targetEl = isViewFull ? fullViewPaperRef.current : invoicePaperRef.current;
      await exportHtmlInvoicePng({
        storeName: mainStore,
        kitchenName: mainKitchen,
        items: displayItems,
        invoiceNumber,
        bayar,
        customNama: finalRecipientName,
        customAlamat: recipientAddress || '-',
        customNomor: recipientPhone || '-',
        customTanggal: invoiceDate,
        targetElement: targetEl,
      });
    } catch (err: any) {
      console.error('Failed to export PNG:', err);
      alert('Gagal mengunduh gambar PNG invoice.');
    } finally {
      setIsGeneratingPng(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 no-print font-sans">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        />

        {/* Main Modal Container */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-4xl tablet-landscape-modal bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] z-10 border-t sm:border border-slate-200/80 overflow-hidden"
        >
          {/* Mobile Drag Indicator */}
          <div className="pt-3 pb-1 flex justify-center sm:hidden">
            <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
          </div>

          {/* D. Header: Clean, Ringkas, Informasi Inti */}
          <div className="px-5 sm:px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                    {invoiceNumber}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-black uppercase border border-emerald-200 tracking-wide">
                    {profile.name}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                  {mainKitchen} • {displayItems.length} Barang • <span className="font-bold text-slate-700">{formatRupiah(totalJual)}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onClose}
                type="button"
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer min-h-[42px] min-w-[42px] flex items-center justify-center"
                aria-label="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* A. Area Preview Utama: Rasio Kertas A4 Bersih di Tengah Background Netral */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/90 flex flex-col items-center">
            <div className="w-full flex justify-center py-2">
              <div className="overflow-x-auto w-full flex justify-center pb-2">
                <div className="w-[794px] max-w-full">
                  <InvoicePaperA4
                    ref={invoicePaperRef}
                    profile={profile}
                    styleConfig={styleConfig}
                    items={displayItems}
                    invoiceNumber={invoiceNumber}
                    invoiceDate={invoiceDate}
                    recipientName={finalRecipientName}
                    totalJual={totalJual}
                    bayar={bayar}
                    sisa={sisa}
                    id="invoice-paper-preview"
                  />
                </div>
              </div>
            </div>

            {/* A.4 Tombol "View Full" di Bagian Bawah Area Preview */}
            <div className="w-full max-w-md flex justify-center mt-3 mb-1">
              <button
                type="button"
                onClick={() => setIsViewFull(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 active:scale-98 text-slate-700 hover:text-indigo-600 text-xs font-bold border border-slate-200 shadow-sm transition-all cursor-pointer min-h-[40px]"
              >
                <Eye className="w-4 h-4 text-indigo-600" />
                <span>View Full</span>
              </button>
            </div>
          </div>

          {/* B. Sederhanakan Aksi Bawah: Unduh PNG (Secondary) & Export PDF (Primary) */}
          <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200/80 grid grid-cols-2 gap-3 shrink-0">
            {/* Secondary Action: Unduh PNG */}
            <button
              type="button"
              disabled={isGeneratingPng}
              onClick={handleStartPngExport}
              className="py-3 px-4 bg-white hover:bg-emerald-50 active:bg-emerald-100 text-emerald-700 hover:text-emerald-800 font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl border border-emerald-300 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 min-h-[46px]"
            >
              {isGeneratingPng ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0 text-emerald-600" />
              ) : (
                <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span>{isGeneratingPng ? 'Memproses...' : 'Unduh PNG'}</span>
            </button>

            {/* Primary Action: Export PDF */}
            <button
              type="button"
              onClick={handleStartPdfExport}
              className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 active:scale-98 text-white font-extrabold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[46px]"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Export PDF</span>
            </button>
          </div>
        </motion.div>

        {/* A.5 Modal Mode "View Full" / Fullscreen Document Viewer */}
        <AnimatePresence>
          {isViewFull && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-60 bg-slate-900/90 backdrop-blur-sm flex flex-col p-2 sm:p-6 font-sans overflow-hidden"
            >
              {/* Fullscreen Viewer Top Bar */}
              <div className="w-full max-w-5xl mx-auto flex items-center justify-between py-2.5 px-4 bg-slate-800/90 text-white rounded-2xl border border-slate-700/80 mb-3 shadow-lg shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="font-extrabold text-sm sm:text-base tracking-wide text-white">
                    {invoiceNumber}
                  </span>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[11px] font-bold">
                    {profile.name} • {mainKitchen}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsViewFull(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 active:scale-95 text-xs font-bold text-slate-100 transition-colors cursor-pointer min-h-[36px]"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Kembali</span>
                  </button>
                </div>
              </div>

              {/* Fullscreen Document Content Scroll Area */}
              <div className="flex-1 overflow-y-auto overflow-x-auto flex justify-center p-2 sm:p-4">
                <div className="my-auto pb-6">
                  <InvoicePaperA4
                    ref={fullViewPaperRef}
                    profile={profile}
                    styleConfig={styleConfig}
                    items={displayItems}
                    invoiceNumber={invoiceNumber}
                    invoiceDate={invoiceDate}
                    recipientName={finalRecipientName}
                    totalJual={totalJual}
                    bayar={bayar}
                    sisa={sisa}
                    id="invoice-paper-fullview"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
};
