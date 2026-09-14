import React from 'react';
import { OrderItem } from '../types';
import { formatRupiah, parseIndonesianNumber } from '../lib/formatters';
import { StoreProfile } from '../lib/storeProfiles';
import { StoreInvoiceStyleConfig } from '../lib/invoiceStyles';

interface InvoicePaperA4Props {
  profile: StoreProfile;
  styleConfig: StoreInvoiceStyleConfig;
  items: OrderItem[];
  invoiceNumber: string;
  invoiceDate: string;
  recipientName: string;
  totalJual: number;
  bayar: number;
  sisa: number;
  scale?: number;
  id?: string;
}

export const InvoicePaperA4 = React.forwardRef<HTMLDivElement, InvoicePaperA4Props>(({
  profile,
  styleConfig,
  items,
  invoiceNumber,
  invoiceDate,
  recipientName,
  totalJual,
  bayar,
  sisa,
  scale = 1,
  id = 'invoice-paper-a4',
}, ref) => {
  return (
    <div
      ref={ref}
      id={id}
      style={{
        fontFamily: styleConfig.fontFamily,
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'top center',
      }}
      className="bg-white text-slate-900 shadow-2xl rounded-sm p-10 sm:p-12 w-[794px] min-h-[1123px] box-border relative mx-auto text-xs border border-slate-300 selection:bg-indigo-100"
    >
      {/* HEADER SECTION: Logo & Two Columns */}
      <div className="border-b border-slate-300 pb-5 mb-5">
        {profile.logoBase64 && (
          <div className="mb-3.5">
            <img
              src={profile.logoBase64}
              alt={profile.name}
              className="h-16 max-w-[260px] object-contain block"
            />
          </div>
        )}

        <div className="flex items-start justify-between gap-8">
          {/* Company Text */}
          <div className="w-1/2">
            <h4 className="font-extrabold text-sm uppercase text-slate-900 leading-snug tracking-tight">
              {profile.name}
            </h4>
            <p className="text-[11px] text-slate-600 whitespace-pre-line mt-1.5 leading-relaxed">
              {profile.address}
            </p>
            {profile.contact && (
              <p className="text-[10px] font-bold text-slate-700 mt-1.5">
                {profile.contact}
              </p>
            )}
          </div>

          {/* Date, Invoice Number & Recipient */}
          <div className="w-1/2 text-left pl-6">
            <div className="flex items-center justify-between text-[11px] text-slate-900 mb-2 font-bold pb-1 border-b border-slate-200">
              <span>Invoice: <span className="font-black text-indigo-900">{invoiceNumber}</span></span>
              <span>{invoiceDate}</span>
            </div>
            <div className="text-[11px] text-slate-800 space-y-0.5">
              <p className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Kepada Yth.</p>
              <p className="font-bold text-slate-900 text-xs">{recipientName}</p>
              <p className="text-slate-600 text-[10px]">-</p>
            </div>
          </div>
        </div>
      </div>

      {/* TABLE SECTION */}
      <table className="w-full border-collapse border border-slate-900 text-xs mb-5">
        <thead>
          <tr
            style={{
              backgroundColor: styleConfig.headerBg,
              color: styleConfig.headerText,
            }}
            className="font-extrabold text-center text-[11px]"
          >
            <th className="border border-slate-900 px-2 py-2 w-10">NO</th>
            <th className="border border-slate-900 px-2 py-2 w-24">BANYAKNYA</th>
            <th className="border border-slate-900 px-3 py-2 text-left">NAMA ITEM</th>
            <th className="border border-slate-900 px-3 py-2 w-28 text-right">HARGA</th>
            <th className="border border-slate-900 px-3 py-2 w-32 text-right">JUMLAH</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const q = parseIndonesianNumber(item.qty);
            const p = parseIndonesianNumber(item.hargaJual || item.hargaBeli || 0);
            return (
              <tr key={idx} className="border border-slate-900 text-[11px]">
                <td className="border border-slate-900 px-2 py-2 text-center text-slate-700">{idx + 1}</td>
                <td className="border border-slate-900 px-2 py-2 text-center font-bold">{q}</td>
                <td className="border border-slate-900 px-3 py-2 font-medium">{item.namaBarang}</td>
                <td className="border border-slate-900 px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatRupiah(p)}</td>
                <td className="border border-slate-900 px-3 py-2 text-right font-bold tabular-nums whitespace-nowrap">{formatRupiah(q * p)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-bold text-[11px]">
            <td colSpan={3} className="border border-slate-900 bg-white"></td>
            <td className="border border-slate-900 px-2 py-1.5 text-center bg-slate-50 font-extrabold tracking-wider">TOTAL</td>
            <td className="border border-slate-900 px-3 py-1.5 text-right font-extrabold tabular-nums whitespace-nowrap">{formatRupiah(totalJual)}</td>
          </tr>
          <tr className="font-bold text-[11px]">
            <td colSpan={3} className="border border-slate-900 bg-white"></td>
            <td className="border border-slate-900 px-2 py-1.5 text-center bg-slate-50 font-medium tracking-wider">BAYAR</td>
            <td className="border border-slate-900 px-3 py-1.5 text-right font-medium tabular-nums whitespace-nowrap">{formatRupiah(bayar)}</td>
          </tr>
          <tr className="font-bold text-[11px]">
            <td colSpan={3} className="border border-slate-900 bg-white"></td>
            <td className="border border-slate-900 px-2 py-1.5 text-center bg-slate-50 font-extrabold text-rose-700 tracking-wider">SISA</td>
            <td className="border border-slate-900 px-3 py-1.5 text-right font-black text-rose-700 tabular-nums whitespace-nowrap">{formatRupiah(sisa)}</td>
          </tr>
        </tfoot>
      </table>

      {/* FOOTER & SIGNATURE SECTION */}
      {!styleConfig.layoutSwap ? (
        /* Standard Layout: Bank Kiri, Tanda Tangan Kanan */
        <div className="grid grid-cols-2 gap-8 pt-3 mt-4">
          <div className="text-[11px] text-slate-700 bg-slate-50/80 p-3 rounded-lg border border-slate-200">
            <p className="font-bold text-slate-900 mb-1 text-xs">Informasi Pembayaran:</p>
            <p>Atas Nama: <strong>{profile.bankAccountName || profile.accountHolder || profile.signerName}</strong></p>
            <p>Bank: <strong>{profile.bankName}</strong></p>
            <p>No. Rekening: <strong className="text-slate-900 text-xs font-black">{profile.bankAccountNumber || profile.accountNumber}</strong></p>
          </div>

          <div className="flex justify-between items-start text-center text-[11px]">
            <div className="w-1/2">
              <p className="font-bold text-slate-800 mb-14">Tanda Terima</p>
              <p className="font-bold inline-block min-w-[110px] border-t border-slate-400 pt-1 text-slate-900">
                ({recipientName})
              </p>
            </div>

            <div className="w-1/2 relative">
              <p className="font-bold text-slate-800 mb-1">Hormat Kami</p>
              <div className="relative h-14 flex items-center justify-center">
                {profile.stampSignatureCombinedBase64 ? (
                  <img
                    src={profile.stampSignatureCombinedBase64}
                    alt="Stempel & Tanda Tangan"
                    className="h-16 max-w-[150px] object-contain mx-auto"
                  />
                ) : (
                  <>
                    {profile.stampBase64 && (
                      <img
                        src={profile.stampBase64}
                        alt="Cap"
                        className="absolute inset-0 m-auto h-16 max-w-[95px] object-contain opacity-85 pointer-events-none z-1"
                      />
                    )}
                    {profile.signatureBase64 && (
                      <img
                        src={profile.signatureBase64}
                        alt="Tanda Tangan"
                        className="relative h-13 max-w-[115px] object-contain z-10 mx-auto"
                      />
                    )}
                  </>
                )}
              </div>
              <p className="font-bold mt-1 text-slate-900 text-xs">{profile.signerName}</p>
              {profile.signerContact && (
                <p className="text-[10px] text-slate-500">{profile.signerContact}</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Swapped Layout: Tanda Tangan Kiri, Bank Kanan */
        <div className="grid grid-cols-2 gap-8 pt-3 mt-4">
          <div className="flex justify-between items-start text-center text-[11px]">
            <div className="w-1/2 relative">
              <p className="font-bold text-slate-800 mb-1">Hormat Kami</p>
              <div className="relative h-14 flex items-center justify-center">
                {profile.stampSignatureCombinedBase64 ? (
                  <img
                    src={profile.stampSignatureCombinedBase64}
                    alt="Stempel & Tanda Tangan"
                    className="h-16 max-w-[150px] object-contain mx-auto"
                  />
                ) : (
                  <>
                    {profile.stampBase64 && (
                      <img
                        src={profile.stampBase64}
                        alt="Cap"
                        className="absolute inset-0 m-auto h-16 max-w-[95px] object-contain opacity-85 pointer-events-none z-1"
                      />
                    )}
                    {profile.signatureBase64 && (
                      <img
                        src={profile.signatureBase64}
                        alt="Tanda Tangan"
                        className="relative h-13 max-w-[115px] object-contain z-10 mx-auto"
                      />
                    )}
                  </>
                )}
              </div>
              <p className="font-bold mt-1 text-slate-900 text-xs">{profile.signerName}</p>
              {profile.signerContact && (
                <p className="text-[10px] text-slate-500">{profile.signerContact}</p>
              )}
            </div>

            <div className="w-1/2">
              <p className="font-bold text-slate-800 mb-14">Tanda Terima</p>
              <p className="font-bold inline-block min-w-[110px] border-t border-slate-400 pt-1 text-slate-900">
                ({recipientName})
              </p>
            </div>
          </div>

          <div className="text-[11px] text-slate-700 bg-slate-50/80 p-3 rounded-lg border border-slate-200">
            <p className="font-bold text-slate-900 mb-1 text-xs">Informasi Pembayaran:</p>
            <p>Atas Nama: <strong>{profile.bankAccountName || profile.accountHolder || profile.signerName}</strong></p>
            <p>Bank: <strong>{profile.bankName}</strong></p>
            <p>No. Rekening: <strong className="text-slate-900 text-xs font-black">{profile.bankAccountNumber || profile.accountNumber}</strong></p>
          </div>
        </div>
      )}

      {/* Store Footer Note if any */}
      {profile.footerNote && (
        <div className="mt-8 pt-2.5 border-t border-dashed border-slate-300 text-[10px] italic text-slate-500">
          * {profile.footerNote}
        </div>
      )}
    </div>
  );
});

InvoicePaperA4.displayName = 'InvoicePaperA4';
