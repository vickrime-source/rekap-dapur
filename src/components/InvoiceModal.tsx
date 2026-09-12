import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Receipt, 
  FileText, 
  User, 
  MapPin, 
  Phone, 
  CreditCard, 
  Download, 
  Sparkles,
  FileDown,
  Eye,
  CheckCircle2
} from 'lucide-react';
import { OrderItem } from '../types';
import { formatRupiah, formatTanggalRealtime, formatTanggalInvoice, resolveRecipientSppgName, parseIndonesianNumber } from '../lib/formatters';
import { getStoreProfile } from '../lib/storeProfiles';
import { printHtmlInvoiceDirectly } from '../lib/htmlInvoicePdf';
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
  onTriggerBackgroundExport,
  onSaveInvoiceRecord,
}) => {
  const [bayar, setBayar] = useState<number>(bayarAmount);
  const [showFullPreview, setShowFullPreview] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBayar(bayarAmount);
      setShowFullPreview(false);
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
  
  const finalRecipientName = resolveRecipientSppgName(recipientName, mainKitchen, displayItems);
  const invoiceDate = formatTanggalInvoice(displayItems[0]?.tanggal || new Date());

  const handleDirectPrint = () => {
    if (onSaveInvoiceRecord) {
      onSaveInvoiceRecord();
    }
    printHtmlInvoiceDirectly({
      storeName: mainStore,
      kitchenName: mainKitchen,
      items: displayItems,
      invoiceNumber,
      bayar,
      customNama: finalRecipientName,
      customAlamat: '-',
      customNomor: '-',
      customTanggal: invoiceDate,
    });
  };

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
        customAlamat: '-',
        customNomor: '-',
        customTanggal: invoiceDate,
        type: 'pdf',
      });
    }
    onClose();
  };

  const handleStartDocxExport = () => {
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
        customAlamat: '-',
        customNomor: '-',
        customTanggal: invoiceDate,
        type: 'docx',
      });
    }
    onClose();
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

        {/* Bottom Sheet Modal (Centered and bounded for tablet landscape) */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-2xl tablet-landscape-modal bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] z-10 border-t sm:border border-slate-200/80 overflow-hidden"
        >
          {/* Mobile Drag Indicator */}
          <div className="pt-3 pb-1 flex justify-center">
            <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 leading-none">
                    {invoiceNumber}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                    {profile.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {mainKitchen} • {displayItems.length} Barang • {formatRupiah(totalJual)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowFullPreview(!showFullPreview)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  showFullPreview
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="Lihat Pratinjau Kertas A4"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{showFullPreview ? 'Mode Ringkas' : 'Pratinjau A4'}</span>
              </button>

              <button
                onClick={onClose}
                type="button"
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {showFullPreview ? (
              /* A4 Paper HTML Preview */
              <div className="bg-slate-200 p-2 sm:p-4 rounded-2xl overflow-x-auto">
                <div className="bg-white shadow-xl rounded-lg p-6 sm:p-8 min-w-[650px] max-w-[760px] mx-auto text-slate-900 text-xs border border-slate-300">
                  {/* Top Header */}
                  <div className="border-b border-slate-300 pb-4 mb-4">
                    {/* Logo at Top-Left */}
                    {profile.logoBase64 && (
                      <div className="mb-3">
                        <img
                          src={profile.logoBase64}
                          alt="Logo"
                          className="h-16 max-w-[240px] object-contain block"
                        />
                      </div>
                    )}

                    {/* Two Parallel Columns: Left = Company Text, Right = Tanggal & Recipient Text */}
                    <div className="flex items-start justify-between gap-6">
                      <div className="w-1/2">
                        <h4 className="font-extrabold text-sm uppercase text-slate-900 leading-tight">
                          {profile.name}
                        </h4>
                        <p className="text-[10px] text-slate-600 whitespace-pre-line mt-1">
                          {profile.address}
                        </p>
                        <p className="text-[9px] font-bold text-slate-700 mt-1">
                          {profile.contact}
                        </p>
                      </div>

                      <div className="w-1/2 text-left pl-4">
                        <p className="font-bold text-[11px] text-slate-900 mb-2">
                          Tanggal : {invoiceDate}
                        </p>
                        <div className="text-[10px] text-slate-800 space-y-0.5">
                          <p className="font-semibold text-slate-900">Kepada Yth.</p>
                          <p className="font-bold text-slate-900">{finalRecipientName}</p>
                          <p className="text-slate-700">-</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Table */}
                  <table className="w-full border-collapse border border-slate-900 text-[11px] mb-3">
                    <thead>
                      <tr className="bg-blue-100 text-slate-900 font-extrabold text-center">
                        <th className="border border-slate-900 p-1.5 w-8">NO</th>
                        <th className="border border-slate-900 p-1.5 w-20">BANYAKNYA</th>
                        <th className="border border-slate-900 p-1.5">NAMA ITEM</th>
                        <th className="border border-slate-900 p-1.5 w-24">HARGA</th>
                        <th className="border border-slate-900 p-1.5 w-28">JUMLAH</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayItems.map((item, idx) => {
                        const q = parseIndonesianNumber(item.qty);
                        const p = parseIndonesianNumber(item.hargaJual || item.hargaBeli || 0);
                        return (
                          <tr key={idx} className="border border-slate-900">
                            <td className="border border-slate-900 p-1.5 text-center">{idx + 1}</td>
                            <td className="border border-slate-900 p-1.5 text-center">{q}</td>
                            <td className="border border-slate-900 p-1.5 font-medium">{item.namaBarang}</td>
                            <td className="border border-slate-900 p-1.5 text-right">{formatRupiah(p)}</td>
                            <td className="border border-slate-900 p-1.5 text-right font-bold">{formatRupiah(q * p)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold">
                        <td colSpan={3} className="border border-slate-900 bg-white"></td>
                        <td className="border border-slate-900 p-1 text-center bg-slate-50 font-extrabold">TOTAL</td>
                        <td className="border border-slate-900 p-1 text-right">{formatRupiah(totalJual)}</td>
                      </tr>
                      <tr className="font-bold">
                        <td colSpan={3} className="border border-slate-900 bg-white"></td>
                        <td className="border border-slate-900 p-1 text-center bg-slate-50 font-extrabold">BAYAR</td>
                        <td className="border border-slate-900 p-1 text-right">{formatRupiah(bayar)}</td>
                      </tr>
                      <tr className="font-bold">
                        <td colSpan={3} className="border border-slate-900 bg-white"></td>
                        <td className="border border-slate-900 p-1 text-center bg-slate-50 font-extrabold">SISA</td>
                        <td className="border border-slate-900 p-1 text-right font-black text-rose-700">{formatRupiah(sisa)}</td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Payment Info & Signatures */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="text-[10px] text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200">
                      <p className="font-bold text-slate-900 mb-1">Informasi Pembayaran:</p>
                      <p>Atas Nama: <strong>{profile.bankAccountName || profile.accountHolder || profile.signerName}</strong></p>
                      <p>Bank: <strong>{profile.bankName}</strong></p>
                      <p>No. Rekening: <strong className="text-slate-900 text-[11px]">{profile.bankAccountNumber || profile.accountNumber}</strong></p>
                    </div>

                    <div className="flex justify-between items-start text-center text-[10px]">
                      <div className="w-1/2">
                        <p className="font-semibold mb-12">Tanda Terima</p>
                        <p className="font-bold inline-block min-w-[90px]">
                          ({finalRecipientName})
                        </p>
                      </div>

                      <div className="w-1/2 relative">
                        <p className="font-semibold mb-1">Hormat Kami</p>
                        <div className="relative h-12 flex items-center justify-center">
                          {profile.stampSignatureCombinedBase64 ? (
                            <img
                              src={profile.stampSignatureCombinedBase64}
                              alt="Stempel & Tanda Tangan"
                              className="h-14 max-w-[140px] object-contain mx-auto"
                            />
                          ) : (
                            <>
                              {profile.stampBase64 && (
                                <img
                                  src={profile.stampBase64}
                                  alt="Cap"
                                  className="absolute inset-0 m-auto h-14 max-w-[85px] object-contain opacity-80 pointer-events-none z-1"
                                />
                              )}
                              {profile.signatureBase64 && (
                                <img
                                  src={profile.signatureBase64}
                                  alt="Tanda Tangan"
                                  className="relative h-11 max-w-[100px] object-contain z-10 mx-auto"
                                />
                              )}
                            </>
                          )}
                        </div>
                        <p className="font-bold mt-1 text-slate-900">{profile.signerName}</p>
                        <p className="text-[9px] text-slate-500">{profile.signerContact}</p>
                      </div>
                    </div>
                  </div>

                  {/* Policy Footer Note */}
                  {profile.footerNote && (
                    <div className="mt-4 pt-2 border-t border-dashed border-slate-300 text-[10px] italic text-slate-600">
                      * {profile.footerNote}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Compact Card View */
              <>
                {/* Store Profile Card */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-3">
                  {profile.logoBase64 && (
                    <img
                      src={profile.logoBase64}
                      alt={profile.name}
                      className="h-12 w-16 object-contain bg-white p-1 rounded-lg border border-slate-200 shadow-2xs flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-black text-slate-900 uppercase truncate">
                      {profile.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      Bank {profile.bankName} - {profile.bankAccountNumber || profile.accountNumber} ({profile.bankAccountName || profile.accountHolder || profile.signerName})
                    </p>
                  </div>
                </div>

                {/* Recipient & Meta Summary */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Penerima:
                    </span>
                    <span className="font-extrabold text-slate-900 block mt-0.5">
                      {recipientName || mainKitchen}
                    </span>
                    <span className="text-[11px] text-slate-600 font-medium block">
                      {recipientAddress || 'Banyuwangi'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Pembayaran:
                    </span>
                    <div className="mt-0.5 space-y-0.5 text-[11px]">
                      <span className="font-bold text-slate-700 block">
                        Bayar: <strong className="text-emerald-700">{formatRupiah(bayar)}</strong>
                      </span>
                      <span className="font-bold text-slate-700 block">
                        Sisa: <strong className="text-rose-700">{formatRupiah(sisa)}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Scoped Items Table Preview */}
                <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="px-3.5 py-2 bg-slate-100/80 border-b border-slate-200 text-[11px] font-black text-slate-700 uppercase tracking-wider flex justify-between">
                    <span>Rincian Barang</span>
                    <span>{displayItems.length} Item</span>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {displayItems.map((item, idx) => (
                      <div key={item.id || idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                        <div className="min-w-0 pr-2">
                          <span className="font-bold text-slate-900 block truncate">{item.namaBarang}</span>
                          <span className="text-[10px] text-slate-500">{item.qty} × {formatRupiah(item.hargaJual || item.hargaBeli || 0)}</span>
                        </div>
                        <span className="font-black text-slate-900 text-xs flex-shrink-0">
                          {formatRupiah(parseIndonesianNumber(item.qty) * parseIndonesianNumber(item.hargaJual || item.hargaBeli || 0))}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 uppercase">Total Invoice:</span>
                    <span className="text-base font-black text-indigo-700">{formatRupiah(totalJual)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons: Only DOCX and PDF */}
          <div className="p-4 bg-slate-50 border-t border-slate-200/80 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleStartDocxExport}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-indigo-300" />
              <span>Unduh DOCX</span>
            </button>

            <button
              type="button"
              onClick={handleStartPdfExport}
              className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs rounded-2xl shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh PDF</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
