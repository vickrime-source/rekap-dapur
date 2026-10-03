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
  priceVariant?: 'ori' | 'cashback';
}

export const InvoicePaperA4 = React.forwardRef<HTMLDivElement, InvoicePaperA4Props>(({
  profile,
  styleConfig,
  items,
  invoiceNumber,
  invoiceDate,
  recipientName,
  totalJual,
  scale = 1,
  id = 'invoice-paper-a4',
  priceVariant = 'ori',
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

          {/* Date & Recipient */}
          <div className="w-1/2 text-left pl-6">
            <div className="text-[11px] text-slate-900 mb-2 font-bold pb-1 border-b border-slate-200">
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
      <table className="w-full border-collapse border border-slate-900 text-xs mb-5" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '45px' }} />
          <col style={{ width: '115px' }} />
          <col style={{ width: 'auto' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '135px' }} />
        </colgroup>
        <thead>
          <tr
            style={{
              backgroundColor: styleConfig.headerBg,
              color: styleConfig.headerText,
            }}
            className="font-extrabold text-[11px]"
          >
            <th className="border border-slate-900 px-1 py-2 text-center align-middle leading-normal" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
              NO
            </th>
            <th className="border border-slate-900 px-2 py-2 text-center align-middle leading-normal" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
              BANYAKNYA
            </th>
            <th className="border border-slate-900 px-2 py-2 text-center align-middle leading-normal" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
              NAMA ITEM
            </th>
            <th className="border border-slate-900 px-2 py-2 text-center align-middle leading-normal" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
              HARGA
            </th>
            <th className="border border-slate-900 px-2 py-2 text-center align-middle leading-normal" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
              JUMLAH
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const rawQ = parseIndonesianNumber(item.qty);
            const retQ = Math.min(rawQ, Math.max(0, Number(item.retur) || 0));
            const q = Math.max(0, rawQ - retQ);
            const hargaJual = parseIndonesianNumber(item.hargaJual || 0);
            const cb = Number(item.cashback) || 0;
            const p = (priceVariant === 'cashback' && cb > 0) ? cb : hargaJual;
            return (
              <tr key={idx} className="border border-slate-900 text-[11px]">
                <td className="border border-slate-900 px-1.5 py-2 text-center align-middle text-slate-700" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{idx + 1}</td>
                <td className="border border-slate-900 px-2 py-2 text-center align-middle font-bold whitespace-nowrap" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                  {retQ > 0 ? (
                    <span className="inline-block align-middle whitespace-nowrap leading-tight text-[11px] text-center">
                      <span className="text-slate-700 font-normal">{rawQ}</span>
                      <span className="text-slate-500 font-normal mx-0.5">-</span>
                      <span className="text-red-600 font-bold">{retQ}</span>
                      <span className="text-slate-500 font-normal mx-0.5">=</span>
                      <span className="text-slate-900 font-bold">{q}</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-900 font-bold" style={{ verticalAlign: 'middle', lineHeight: 1 }}>{q}</span>
                  )}
                </td>
                <td className="border border-slate-900 px-3 py-2 text-left align-middle font-medium text-slate-900" style={{ verticalAlign: 'middle', textAlign: 'left' }}>
                  <div className="leading-tight" style={{ verticalAlign: 'middle' }}>
                    <span className="align-middle">{item.namaBarang}</span>
                    {retQ > 0 && (
                      <span className="text-red-600 font-bold text-[10px] whitespace-nowrap align-middle ml-2">
                        Retur
                      </span>
                    )}
                  </div>
                </td>
                <td className="border border-slate-900 px-3 py-2 text-center align-middle tabular-nums whitespace-nowrap" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{formatRupiah(p)}</td>
                <td className="border border-slate-900 px-3 py-2 text-center align-middle font-bold tabular-nums whitespace-nowrap" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{formatRupiah(q * p)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-bold text-[11px]">
            <td colSpan={3} className="border border-slate-900 bg-white" style={{ verticalAlign: 'middle' }}></td>
            <td className="border border-slate-900 px-3 py-2 text-center align-middle bg-slate-50 font-extrabold tracking-wider" style={{ verticalAlign: 'middle', textAlign: 'center' }}>TOTAL</td>
            <td className="border border-slate-900 px-3 py-2 text-center align-middle font-extrabold tabular-nums whitespace-nowrap" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{formatRupiah(totalJual)}</td>
          </tr>
          <tr className="font-bold text-[11px]">
            <td colSpan={3} className="border border-slate-900 bg-white" style={{ verticalAlign: 'middle' }}></td>
            <td className="border border-slate-900 px-3 py-2 text-center align-middle bg-slate-50 font-medium tracking-wider" style={{ verticalAlign: 'middle', textAlign: 'center' }}>BAYAR</td>
            <td className="border border-slate-900 px-3 py-2 text-center align-middle font-medium tabular-nums whitespace-nowrap" style={{ verticalAlign: 'middle', textAlign: 'center' }}>0</td>
          </tr>
          <tr className="font-bold text-[11px]">
            <td colSpan={3} className="border border-slate-900 bg-white" style={{ verticalAlign: 'middle' }}></td>
            <td className="border border-slate-900 px-3 py-2 text-center align-middle bg-slate-50 font-extrabold text-rose-700 tracking-wider" style={{ verticalAlign: 'middle', textAlign: 'center' }}>SISA</td>
            <td className="border border-slate-900 px-3 py-2 text-center align-middle font-black text-rose-700 tabular-nums whitespace-nowrap" style={{ verticalAlign: 'middle', textAlign: 'center' }}></td>
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
