import React, { useState } from 'react';
import { 
  Sparkles, 
  FileCheck, 
  ExternalLink, 
  Receipt, 
  Upload, 
  Check, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { OrderItem, Store as StoreType, Kitchen } from '../../types';
import { 
  getCustomTemplateUrl, 
  setCustomTemplateUrl, 
  downloadDocxInvoice, 
  INVOICE_TEMPLATES 
} from '../../lib/docxTemplate';

interface DocxTemplateTabProps {
  orders: OrderItem[];
  stores: StoreType[];
  kitchens: Kitchen[];
  pemasokList: string[];
}

export const DocxTemplateTab: React.FC<DocxTemplateTabProps> = ({
  orders,
  stores,
  kitchens,
  pemasokList,
}) => {
  const [selectedTemplateFile, setSelectedTemplateFile] = useState<File | null>(null);
  const [templateStatus, setTemplateStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeCustomTemplateUrl, setActiveCustomTemplateUrl] = useState<string | null>(getCustomTemplateUrl());
  const [customTemplateName, setCustomTemplateName] = useState<string | null>(
    localStorage.getItem('custom_docx_template_name')
  );

  const handleUseLocalDocx = () => {
    if (!selectedTemplateFile) return;
    const objectUrl = URL.createObjectURL(selectedTemplateFile);
    setCustomTemplateUrl(objectUrl);
    localStorage.setItem('custom_docx_template_name', selectedTemplateFile.name);
    setActiveCustomTemplateUrl(objectUrl);
    setCustomTemplateName(selectedTemplateFile.name);
    setTemplateStatus({
      type: 'success',
      text: `Template lokal "${selectedTemplateFile.name}" aktif untuk sesi browser ini!`,
    });
  };

  const handleResetCustomTemplate = () => {
    setCustomTemplateUrl(null);
    localStorage.removeItem('custom_docx_template_name');
    setActiveCustomTemplateUrl(null);
    setCustomTemplateName(null);
    setTemplateStatus({
      type: 'success',
      text: 'Berhasil di-reset ke template standar default per toko.',
    });
  };

  const handleTestSampleDocxExport = async () => {
    try {
      const sampleItems: OrderItem[] = orders.length > 0 ? orders.slice(0, 3) : [
        {
          id: 'test-1',
          namaBarang: 'Ayam Potong Segar',
          qty: 10,
          hargaBeli: 28000,
          hargaJual: 35000,
          toko: stores[0]?.nama || 'HTG',
          tujuanDapur: kitchens[0]?.nama || 'Dapur Utama',
          pemasok: pemasokList[0] || 'Supplier Utama',
          status: 'pending',
          tanggal: new Date().toISOString().split('T')[0],
          catatan: 'Contoh catatan pesanan'
        }
      ];

      await downloadDocxInvoice({
        storeName: stores[0]?.nama || 'HTG',
        kitchenName: kitchens[0]?.nama || 'Dapur Utama',
        items: sampleItems,
        invoiceNumber: 'INV-SAMPLE-001',
        bayar: 100000,
      });
    } catch (err: any) {
      alert(`Gagal uji export template: ${err?.message || err}`);
    }
  };

  return (
    <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
      {/* Offline Print Info Card */}
      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 p-4 rounded-2xl space-y-2 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-600 text-white rounded-xl">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="font-black text-emerald-950 dark:text-emerald-200 text-xs sm:text-sm block">
              Cetak Browser Offline (No Limit &amp; Cepat)
            </span>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
              Semua file Word .DOCX dikonversi menjadi PDF secara langsung di browser tanpa ketergantungan API eksternal.
            </p>
          </div>
        </div>
      </div>

      {/* Status Template Aktif & Defaults */}
      <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-black text-slate-900 dark:text-slate-100 text-[11px] uppercase tracking-wider">
            Status Template Aktif
          </span>
          {activeCustomTemplateUrl && (
            <button
              type="button"
              onClick={handleResetCustomTemplate}
              className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer"
            >
              Reset ke Default
            </button>
          )}
        </div>

        {activeCustomTemplateUrl ? (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl space-y-1">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-extrabold text-xs">
              <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Menggunakan Template Custom: {customTemplateName || 'Template Custom'}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
              Menggunakan template bawaan default per toko:
            </p>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              {Object.entries(INVOICE_TEMPLATES).map(([storeKey, url]) => (
                <a
                  key={storeKey}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-slate-700 dark:text-slate-200 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shadow-2xs"
                >
                  <span className="font-bold text-slate-900 dark:text-slate-100">{storeKey}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Actions for Testing */}
        <div className="pt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleTestSampleDocxExport}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all text-xs cursor-pointer shadow-xs"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Uji Export Invoice DOCX</span>
          </button>
        </div>
      </div>

      {/* Local Docx Uploader */}
      <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
        <h4 className="font-black text-slate-900 dark:text-slate-100 uppercase text-[11px] tracking-wider flex items-center gap-2">
          <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Gunakan File .DOCX Kustom dari HP/Komputer</span>
        </h4>

        <input
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => setSelectedTemplateFile(e.target.files?.[0] || null)}
          className="w-full text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 dark:file:bg-indigo-950/80 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 cursor-pointer"
        />

        {selectedTemplateFile && (
          <button
            type="button"
            onClick={handleUseLocalDocx}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold rounded-xl flex items-center gap-1.5 transition-all text-xs cursor-pointer shadow-xs"
          >
            <Check className="w-4 h-4" />
            <span>Gunakan File "{selectedTemplateFile.name}" Sebagai Template</span>
          </button>
        )}

        {templateStatus && (
          <div
            className={`p-3 rounded-xl text-xs font-bold space-y-1.5 ${
              templateStatus.type === 'success'
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {templateStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
              )}
              <span>{templateStatus.text}</span>
            </div>
          </div>
        )}
      </div>

      {/* Variable Placeholder Reference */}
      <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
        <span className="font-black text-slate-900 dark:text-slate-100 text-[11px] uppercase tracking-wider block">
          Daftar Variable / Tag Placeholder (.docx)
        </span>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
          Sisipkan tag tag berikut ke dalam file .docx Anda:
        </p>

        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1">
          <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold block">{`{dapur}`}</span>
            <span className="text-slate-500 dark:text-slate-400 text-[9px]">Dapur Tujuan</span>
          </div>
          <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold block">{`{toko}`}</span>
            <span className="text-slate-500 dark:text-slate-400 text-[9px]">Nama Toko</span>
          </div>
          <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold block">{`{tanggal}`}</span>
            <span className="text-slate-500 dark:text-slate-400 text-[9px]">Tanggal</span>
          </div>
          <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold block">{`{invoiceNumber}`}</span>
            <span className="text-slate-500 dark:text-slate-400 text-[9px]">No Invoice</span>
          </div>
          <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold block">{`{total}`}</span>
            <span className="text-slate-500 dark:text-slate-400 text-[9px]">Total (Rp)</span>
          </div>
          <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold block">{`{bayar}`} &amp; {`{sisa}`}</span>
            <span className="text-slate-500 dark:text-slate-400 text-[9px]">Nominal Bayar</span>
          </div>
        </div>
      </div>
    </div>
  );
};
