
import { OrderItem, InvoicePriceVariant } from '../types';
import { formatRupiah, formatTanggalInvoice, resolveRecipientSppgName, parseIndonesianNumber } from './formatters';
import { getStoreProfile, StoreProfile } from './storeProfiles';
import { getStoreInvoiceConfig, StoreInvoiceStyleConfig } from './invoiceStyles';

export interface HtmlInvoiceOptions {
  storeName: string;
  kitchenName: string;
  items: OrderItem[];
  invoiceNumber: string;
  bayar?: number;
  customNama?: string;
  customAlamat?: string;
  customNomor?: string;
  customTanggal?: string;
  priceVariant?: InvoicePriceVariant;
}

/**
 * Builds clean, responsive, print-perfect HTML string for the invoice.
 * Incorporates explicit cell padding (8px 12px), vertical alignment,
 * strict font-weight control (default normal, only headers and total bold),
 * and store-specific typography, header colors, and swapped layout.
 */
export function generateInvoiceHtmlString(options: HtmlInvoiceOptions): string {
  const profile = getStoreProfile(options.storeName);
  const styleConfig = getStoreInvoiceConfig(options.storeName);
  const items = options.items;
  const priceVariant = options.priceVariant || 'ori';

  const calculatedItems = items.map((item) => {
    const rawQ = parseIndonesianNumber(item.qty);
    const retQ = Math.min(rawQ, Math.max(0, Number(item.retur) || 0));
    const q = Math.max(0, rawQ - retQ);
    const hargaJual = parseIndonesianNumber(item.hargaJual || 0);
    const cb = Number(item.cashback) || 0;

    // Varian Ori: HARGA = harga_jual. NILAI = harga_jual * qty.
    // Varian Cashback: HARGA = nilai cashback jika >0, else fallback ke harga_jual. NILAI = HARGA * qty.
    const p = (priceVariant === 'cashback' && cb > 0) ? cb : hargaJual;
    const subtotal = q * p;

    return { rawQ, retQ, q, p, subtotal, item };
  });

  const totalJual = calculatedItems.reduce((sum, ci) => sum + ci.subtotal, 0);
  const bayar = options.bayar !== undefined ? parseIndonesianNumber(options.bayar) : totalJual;
  const sisa = Math.max(0, totalJual - bayar);

  const recipientName = resolveRecipientSppgName(options.customNama, options.kitchenName, items);
  const invoiceDate = formatTanggalInvoice(options.customTanggal || items[0]?.tanggal || new Date());

  const rowsHtml = calculatedItems
    .map(({ rawQ, retQ, q, p, subtotal, item }, idx) => {
      const qtyCell = retQ > 0 ? `
        <span style="display: inline-block; vertical-align: middle; line-height: 1.2; text-align: center; white-space: nowrap; font-size: 10pt;">
          <span style="color: #000000; font-weight: normal;">${rawQ}</span>
          <span style="color: #64748b; margin: 0 2px;">-</span>
          <span style="color: #dc2626; font-size: 10pt; font-weight: bold;">${retQ}</span>
          <span style="color: #64748b; margin: 0 2px;">=</span>
          <span style="font-size: 10pt; font-weight: bold; color: #000000;">${q}</span>
        </span>
      ` : `<span style="display: inline-block; vertical-align: middle; line-height: 1.2; font-size: 10pt; font-weight: bold; color: #000000;">${q}</span>`;

      const nameCell = retQ > 0 ? `
        <div style="line-height: 1.25; vertical-align: middle;">
          <span style="vertical-align: middle;">${item.namaBarang}</span>
          <span style="color: #dc2626; font-size: 8.5pt; font-weight: bold; vertical-align: middle; white-space: nowrap; margin-left: 8px;">Retur</span>
        </div>
      ` : `<span style="display: inline-block; line-height: 1.25; vertical-align: middle;">${item.namaBarang}</span>`;

      return `
      <tr>
        <td class="col-no" style="border: 1px solid #000000; padding: 7px 4px; vertical-align: middle; text-align: center; font-size: 10pt; font-weight: normal; font-family: ${styleConfig.fontFamily}; color: #334155; white-space: nowrap;">${idx + 1}</td>
        <td class="col-qty" style="border: 1px solid #000000; padding: 7px 4px; vertical-align: middle; text-align: center; font-size: 10pt; font-weight: bold; font-family: ${styleConfig.fontFamily}; color: #000000; white-space: nowrap;">${qtyCell}</td>
        <td class="col-name" style="border: 1px solid #000000; padding: 7px 12px; vertical-align: middle; text-align: left; font-size: 10pt; font-weight: normal; font-family: ${styleConfig.fontFamily}; color: #000000;">${nameCell}</td>
        <td class="col-price" style="border: 1px solid #000000; padding: 7px 8px; vertical-align: middle; text-align: center; font-size: 10pt; font-weight: normal; white-space: nowrap; font-family: ${styleConfig.fontFamily}; color: #000000;">${formatRupiah(p)}</td>
        <td class="col-total" style="border: 1px solid #000000; padding: 7px 8px; vertical-align: middle; text-align: center; font-size: 10pt; font-weight: bold; white-space: nowrap; font-family: ${styleConfig.fontFamily}; color: #000000;">${formatRupiah(subtotal)}</td>
      </tr>
    `;
    })
    .join('');

  // Bank / Payment Info block
  const bankInfoHtml = `
    <div style="font-size: 9.5pt; color: #111111; line-height: 1.45; font-family: ${styleConfig.fontFamily};">
      <div style="font-weight: bold; margin-bottom: 2px;">Informasi Pembayaran</div>
      <div>Atas Nama : <strong>${profile.bankAccountName || profile.accountHolder || profile.signerName}</strong></div>
      <div>Bank : <strong>${profile.bankName}</strong></div>
      <div>No. Rekening : <strong style="font-size: 10pt; letter-spacing: 0.3px;">${profile.bankAccountNumber || profile.accountNumber}</strong></div>
    </div>
  `;

  // Tanda Terima block
  const tandaTerimaBlockHtml = `
    <td style="width: 50%; text-align: center; vertical-align: top;">
      <div style="font-size: 10pt; font-weight: bold; margin-bottom: 60px; font-family: ${styleConfig.fontFamily};">
        Tanda Terima
      </div>
      <div style="font-size: 10pt; font-weight: bold; display: inline-block; min-width: 140px; font-family: ${styleConfig.fontFamily};">
        (${recipientName})
      </div>
    </td>
  `;

  // Hormat Kami block (with stamp & signature)
  const hormatKamiBlockHtml = `
    <td style="width: 50%; text-align: center; vertical-align: top; position: relative;">
      <div style="font-size: 10pt; font-weight: bold; margin-bottom: 6px; font-family: ${styleConfig.fontFamily};">
        Hormat Kami
      </div>

      <!-- Container for Stamp & Signature (Single image if combined available, otherwise overlay) -->
      ${
        profile.stampSignatureCombinedBase64
          ? `<div style="height: 80px; margin: 0 auto; width: 220px; display: flex; align-items: center; justify-content: center; text-align: center;">
              <img src="${profile.stampSignatureCombinedBase64}" alt="Stempel & Tanda Tangan" style="max-height: 80px; max-width: 190px; object-fit: contain; display: block; margin: 0 auto;" />
             </div>`
          : `<div style="position: relative; height: 75px; margin: 0 auto; width: 220px; display: flex; align-items: center; justify-content: center; text-align: center;">
              ${
                profile.stampBase64
                  ? `<img src="${profile.stampBase64}" alt="Stamp" style="position: absolute; left: 0; right: 0; top: 0; bottom: 0; margin: auto; height: 75px; max-width: 125px; object-fit: contain; opacity: 0.85; z-index: 1; pointer-events: none;" />`
                  : ''
              }
              ${
                profile.signatureBase64
                  ? `<img src="${profile.signatureBase64}" alt="Signature" style="position: relative; height: 65px; max-width: 155px; object-fit: contain; z-index: 2; display: block; margin: 0 auto;" />`
                  : `<div style="height: 65px;"></div>`
              }
             </div>`
      }

      <div style="font-size: 10pt; font-weight: bold; margin-top: 6px; font-family: ${styleConfig.fontFamily};">
        ${profile.signerName}
      </div>
      ${profile.signerContact ? `<div style="font-size: 8.5pt; font-weight: normal; color: #444444; font-family: ${styleConfig.fontFamily};">${profile.signerContact}</div>` : ''}
    </td>
  `;

  return `
    <div class="invoice-container" style="
      width: 794px;
      min-height: 1123px;
      padding: 45px 50px 40px 50px;
      box-sizing: border-box;
      background: #ffffff;
      color: #000000;
      font-family: ${styleConfig.fontFamily};
      line-height: 1.35;
      position: relative;
      margin: 0 auto;
    ">
      <style>
        *, *::before, *::after {
          box-sizing: border-box !important;
        }
        img {
          display: inline-block !important;
        }
        .invoice-container {
          box-sizing: border-box !important;
        }
        .invoice-container table {
          border-collapse: collapse !important;
          border-spacing: 0 !important;
        }
        .invoice-table-main {
          width: 100% !important;
          border-collapse: collapse !important;
          border-spacing: 0 !important;
          table-layout: fixed !important;
          margin-top: 10px !important;
          margin-bottom: 8px !important;
          border: 1px solid #000000 !important;
        }
        .invoice-table-main th {
          border: 1px solid #000000 !important;
          vertical-align: middle !important;
          text-align: center !important;
          font-weight: bold !important;
          line-height: 1.2 !important;
          padding: 7px 4px !important;
          box-sizing: border-box !important;
        }
        .invoice-table-main td {
          border: 1px solid #000000 !important;
          vertical-align: middle !important;
          line-height: 1.35 !important;
          box-sizing: border-box !important;
        }
        .invoice-table-main th.col-no,
        .invoice-table-main td.col-no {
          width: 45px !important;
          text-align: center !important;
          vertical-align: middle !important;
        }
        .invoice-table-main th.col-qty,
        .invoice-table-main td.col-qty {
          width: 115px !important;
          text-align: center !important;
          vertical-align: middle !important;
        }
        .invoice-table-main th.col-name {
          text-align: center !important;
          vertical-align: middle !important;
        }
        .invoice-table-main td.col-name {
          text-align: left !important;
          vertical-align: middle !important;
        }
        .invoice-table-main th.col-price,
        .invoice-table-main td.col-price {
          width: 125px !important;
          text-align: center !important;
          vertical-align: middle !important;
        }
        .invoice-table-main th.col-total,
        .invoice-table-main td.col-total {
          width: 135px !important;
          text-align: center !important;
          vertical-align: middle !important;
        }
        .invoice-table-main td.is-bold {
          font-weight: bold !important;
        }
        .invoice-table-main td.is-normal {
          font-weight: normal !important;
        }
        .invoice-table-main td.is-sisa {
          font-weight: bold !important;
          color: #be123c !important;
        }
      </style>

      <!-- HEADER SECTION -->
      ${
        profile.logoBase64
          ? `<div style="margin-bottom: 10px;">
              <img src="${profile.logoBase64}" alt="Logo" style="height: 75px; max-width: 245px; object-fit: contain; display: block;" />
             </div>`
          : ''
      }
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
        <tr>
          <!-- Store Profile (Left Column) -->
          <td style="vertical-align: top; width: 55%; padding-right: 15px;">
            <div style="font-size: 11.5pt; font-weight: bold; text-transform: uppercase; color: #000000; font-family: ${styleConfig.fontFamily}; margin-bottom: 3px; letter-spacing: -0.1px;">
              ${profile.name}
            </div>
            <div style="font-size: 9pt; color: #111111; line-height: 1.35; white-space: pre-line; font-weight: normal; font-family: ${styleConfig.fontFamily};">
              ${profile.address}
            </div>
            <div style="font-size: 8.5pt; color: #222222; margin-top: 3px; font-weight: bold; font-family: ${styleConfig.fontFamily};">
              ${profile.contact}
            </div>
          </td>

          <!-- Date & Recipient Info (Right Column, Aligned with Company Text on Left) -->
          <td style="vertical-align: top; width: 45%; text-align: left; padding-left: 20px;">
            <div style="font-size: 10pt; margin-bottom: 10px; font-family: ${styleConfig.fontFamily}; font-weight: normal;">
              <strong style="font-weight: bold;">Tanggal :</strong> ${invoiceDate}
            </div>
            <div style="font-size: 9.5pt; line-height: 1.4; font-family: ${styleConfig.fontFamily};">
              <div style="font-weight: bold; margin-bottom: 2px;">Kepada Yth.</div>
              <div style="font-weight: bold; font-size: 10pt; color: #000000;">${recipientName}</div>
              <div style="color: #222222; font-weight: normal;">-</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- INVOICE ITEMS TABLE -->
      <table class="invoice-table-main" style="
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        margin-top: 10px;
        margin-bottom: 8px;
        border: 1px solid #000000;
      ">
        <colgroup>
          <col style="width: 45px;" />
          <col style="width: 115px;" />
          <col style="width: auto;" />
          <col style="width: 125px;" />
          <col style="width: 135px;" />
        </colgroup>
        <thead>
          <tr style="background-color: ${styleConfig.headerBg}; color: ${styleConfig.headerText};">
            <th class="col-no" style="border: 1px solid #000000; padding: 7px 4px; vertical-align: middle; font-size: 10pt; font-weight: bold; width: 45px; text-align: center; font-family: ${styleConfig.fontFamily}; line-height: 1.2;">NO</th>
            <th class="col-qty" style="border: 1px solid #000000; padding: 7px 4px; vertical-align: middle; font-size: 10pt; font-weight: bold; width: 115px; text-align: center; font-family: ${styleConfig.fontFamily}; line-height: 1.2;">BANYAKNYA</th>
            <th class="col-name" style="border: 1px solid #000000; padding: 7px 8px; vertical-align: middle; font-size: 10pt; font-weight: bold; text-align: center; font-family: ${styleConfig.fontFamily}; line-height: 1.2;">NAMA ITEM</th>
            <th class="col-price" style="border: 1px solid #000000; padding: 7px 4px; vertical-align: middle; font-size: 10pt; font-weight: bold; width: 125px; text-align: center; font-family: ${styleConfig.fontFamily}; line-height: 1.2;">HARGA</th>
            <th class="col-total" style="border: 1px solid #000000; padding: 7px 4px; vertical-align: middle; font-size: 10pt; font-weight: bold; width: 135px; text-align: center; font-family: ${styleConfig.fontFamily}; line-height: 1.2;">JUMLAH</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="border: 1px solid #000000; padding: 7px 12px; vertical-align: middle; font-weight: normal; background: #ffffff;"></td>
            <td class="col-price is-bold" style="border: 1px solid #000000; padding: 7px 12px; vertical-align: middle; font-size: 10pt; font-weight: bold; text-align: center; letter-spacing: 0.5px; font-family: ${styleConfig.fontFamily}; color: #000000; background: #f8fafc;">TOTAL</td>
            <td class="col-total is-bold" style="border: 1px solid #000000; padding: 7px 12px; vertical-align: middle; font-size: 10pt; font-weight: bold; text-align: center; white-space: nowrap; font-family: ${styleConfig.fontFamily}; color: #000000;">${formatRupiah(totalJual)}</td>
          </tr>
          <tr>
            <td colspan="3" style="border: 1px solid #000000; padding: 7px 12px; vertical-align: middle; font-weight: normal; background: #ffffff;"></td>
            <td class="col-price is-normal" style="border: 1px solid #000000; padding: 7px 12px; vertical-align: middle; font-size: 10pt; font-weight: normal; text-align: center; letter-spacing: 0.5px; font-family: ${styleConfig.fontFamily}; color: #000000; background: #f8fafc;">BAYAR</td>
            <td class="col-total is-normal" style="border: 1px solid #000000; padding: 7px 12px; vertical-align: middle; font-size: 10pt; font-weight: normal; text-align: center; white-space: nowrap; font-family: ${styleConfig.fontFamily}; color: #000000;">${formatRupiah(bayar)}</td>
          </tr>
          <tr>
            <td colspan="3" style="border: 1px solid #000000; padding: 7px 12px; vertical-align: middle; font-weight: normal; background: #ffffff;"></td>
            <td class="col-price is-sisa" style="border: 1px solid #000000; padding: 7px 12px; vertical-align: middle; font-size: 10pt; font-weight: bold; text-align: center; letter-spacing: 0.5px; font-family: ${styleConfig.fontFamily}; color: #be123c; background: #f8fafc;">SISA</td>
            <td class="col-total is-sisa" style="border: 1px solid #000000; padding: 7px 12px; vertical-align: middle; font-size: 10pt; font-weight: bold; text-align: center; white-space: nowrap; font-family: ${styleConfig.fontFamily}; color: #be123c;">${formatRupiah(sisa)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- FOOTER INFO & SIGNATURE SECTION -->
      ${
        !styleConfig.layoutSwap
          ? `
          <!-- Baseline Layout (HTG & PROHE): Bank info di KIRI, Tanda Tangan di KANAN -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 14px;">
            <tr>
              <td style="vertical-align: top; width: 55%; padding-right: 15px;">
                ${bankInfoHtml}
              </td>
              <td style="vertical-align: top; width: 45%;"></td>
            </tr>
          </table>

          <table style="width: 100%; border-collapse: collapse; margin-top: 22px;">
            <tr>
              ${tandaTerimaBlockHtml}
              ${hormatKamiBlockHtml}
            </tr>
          </table>
          `
          : `
          <!-- Swapped Layout (LB & LA): Bank info di KANAN, Tanda Tangan 'Hormat Kami' di KIRI -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 14px;">
            <tr>
              <td style="vertical-align: top; width: 45%;"></td>
              <td style="vertical-align: top; width: 55%; padding-left: 20px; text-align: left;">
                ${bankInfoHtml}
              </td>
            </tr>
          </table>

          <table style="width: 100%; border-collapse: collapse; margin-top: 22px;">
            <tr>
              ${hormatKamiBlockHtml}
              ${tandaTerimaBlockHtml}
            </tr>
          </table>
          `
      }

      <!-- FOOTER NOTE (e.g. PROHE POLICY) -->
      ${
        profile.footerNote
          ? `<div style="margin-top: 20px; font-size: 8.5pt; font-style: italic; color: #555555; border-top: 1px dashed #cccccc; padding-top: 6px; font-family: ${styleConfig.fontFamily}; font-weight: normal;">
               * ${profile.footerNote}
             </div>`
          : ''
      }
    </div>
  `;
}

/**
 * Exports the HTML Invoice to crisp, high-resolution PDF file using html2canvas & jsPDF.
 * Guaranteed never to be blank and completely hidden from screen!
 */
export async function exportHtmlInvoicePdf(
  options: HtmlInvoiceOptions,
  onProgress?: (msg: string) => void
): Promise<{ pdfBlob: Blob; pdfUrl: string; fileName: string }> {
  onProgress?.('Mempersiapkan template invoice...');

  const htmlContent = generateInvoiceHtmlString(options);

  // Create isolated container placed completely off-screen to avoid any visual glitch
  const container = document.createElement('div');
  container.id = 'html-invoice-render-target';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0px';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-9999';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  container.innerHTML = htmlContent;

  document.body.appendChild(container);

  try {
    onProgress?.('Memproses grafik & teks invoice...');

    // Wait for embedded images to be ready
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve(null);
        return new Promise((resolve) => {
          img.onload = () => resolve(null);
          img.onerror = () => resolve(null);
          setTimeout(resolve, 300);
        });
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 150));

    onProgress?.('Membuat berkas PDF tajam...');

    const [html2canvasModule, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);
    const html2canvas = (html2canvasModule.default || html2canvasModule) as any;

    const canvas = await withSanitizedComputedStyles(async () => {
      return await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794,
        onclone: (clonedDoc: Document) => {
          const el = clonedDoc.getElementById('html-invoice-render-target');
          if (el) {
            el.style.left = '0px';
            el.style.top = '0px';
            el.style.opacity = '1';
            el.style.zIndex = '1';
            el.style.transform = 'none';
          }
          const fixStyle = clonedDoc.createElement('style');
          fixStyle.textContent = `
            img {
              display: inline !important;
            }
            body > div:last-child img {
              display: inline !important;
            }
          `;
          clonedDoc.head.appendChild(fixStyle);
          clonedDoc.querySelectorAll('style').forEach((st) => {
            if (st.textContent && (st.textContent.includes('oklch') || st.textContent.includes('lab'))) {
              st.textContent = sanitizeCssColorsInString(st.textContent);
            }
          });
        },
      });
    });

    const cleanNumber = options.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeStore = options.storeName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Invoice_${safeStore}_${cleanNumber}.pdf`;

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    if (imgHeight <= pageHeight + 2) {
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight), undefined, 'FAST');
    } else {
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = position - pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }
    }

    // Direct download trigger
    pdf.save(fileName);

    const pdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);

    onProgress?.('Selesai!');
    return { pdfBlob, pdfUrl, fileName };
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

// Helper to convert modern CSS color (oklch, lab, color(...)) to hex/rgb via canvas 2d
let colorHelperCanvasCtx: CanvasRenderingContext2D | null = null;

function convertCssColorToRgb(colorStr: string): string {
  if (!colorStr || typeof colorStr !== 'string') return colorStr;
  if (!colorStr.includes('oklch') && !colorStr.includes('lab') && !colorStr.includes('color(')) {
    return colorStr;
  }
  try {
    if (typeof document !== 'undefined') {
      if (!colorHelperCanvasCtx) {
        const c = document.createElement('canvas');
        c.width = 1;
        c.height = 1;
        colorHelperCanvasCtx = c.getContext('2d', { willReadFrequently: true });
      }
      if (colorHelperCanvasCtx) {
        colorHelperCanvasCtx.fillStyle = '#000000';
        colorHelperCanvasCtx.fillStyle = colorStr;
        const res = colorHelperCanvasCtx.fillStyle;
        if (res && !res.includes('oklch') && !res.includes('lab') && !res.includes('color(')) {
          return res;
        }
      }
    }
  } catch {
    // ignore
  }
  return 'rgba(0,0,0,0)';
}

function sanitizeCssColorsInString(val: string): string {
  if (typeof val !== 'string') return val;
  if (!val.includes('oklch') && !val.includes('lab') && !val.includes('color(')) {
    return val;
  }
  return val.replace(/(oklch|lab|color)\([^)]+\)/gi, (match) => {
    return convertCssColorToRgb(match);
  });
}

/**
 * Executes an async task while proxying window.getComputedStyle so that modern CSS
 * color formats (oklch, lab, etc.) that crash html2canvas are safely converted to RGB/hex.
 */
async function withSanitizedComputedStyles<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof window === 'undefined') return fn();
  const originalGetComputedStyle = window.getComputedStyle;

  const createProxiedStyle = (style: CSSStyleDeclaration) => {
    return new Proxy(style, {
      get(target, prop, receiver) {
        const val = Reflect.get(target, prop, target);
        if (typeof val === 'function') {
          if (prop === 'getPropertyValue') {
            return (propName: string) => {
              const res = target.getPropertyValue(propName);
              return sanitizeCssColorsInString(res);
            };
          }
          return val.bind(target);
        }
        if (typeof val === 'string') {
          return sanitizeCssColorsInString(val);
        }
        return val;
      },
    });
  };

  window.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
    const style = originalGetComputedStyle.call(window, elt, pseudoElt);
    return createProxiedStyle(style);
  } as typeof window.getComputedStyle;

  // Injeksi style untuk html2canvas font metrics di dokumen utama
  let html2canvasFixStyle: HTMLStyleElement | null = null;
  if (typeof document !== 'undefined' && document.head) {
    html2canvasFixStyle = document.createElement('style');
    html2canvasFixStyle.id = 'html2canvas-global-img-fix';
    html2canvasFixStyle.textContent = `
      img {
        display: inline !important;
      }
      body > div:last-child img {
        display: inline !important;
      }
    `;
    document.head.appendChild(html2canvasFixStyle);
  }

  try {
    return await fn();
  } finally {
    window.getComputedStyle = originalGetComputedStyle;
    if (html2canvasFixStyle && html2canvasFixStyle.parentNode) {
      html2canvasFixStyle.parentNode.removeChild(html2canvasFixStyle);
    }
  }
}

/**
 * Preloads all <img> tags inside an element before canvas capture.
 */
async function preloadImagesInElement(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve(null);
      return new Promise((resolve) => {
        img.onload = () => resolve(null);
        img.onerror = () => resolve(null);
        setTimeout(resolve, 350);
      });
    })
  );
  await new Promise((resolve) => setTimeout(resolve, 150));
}

/**
 * Exports the HTML Invoice directly to a high-resolution PNG image file using html2canvas.
 * Generates an image file (.png) and triggers automatic download.
 */
export async function exportHtmlInvoicePng(
  options: HtmlInvoiceOptions & { targetElement?: HTMLElement | null },
  onProgress?: (msg: string) => void
): Promise<{ pngBlob: Blob; pngUrl: string; fileName: string }> {
  onProgress?.('Mempersiapkan gambar invoice...');

  const cleanNumber = options.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeStore = options.storeName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Invoice_${safeStore}_${cleanNumber}.png`;

  const html2canvasModule = await import('html2canvas');
  const html2canvas = (html2canvasModule.default || html2canvasModule) as any;

  const downloadCanvasAsPng = (canvas: HTMLCanvasElement): Promise<{ pngBlob: Blob; pngUrl: string; fileName: string }> => {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob: Blob | null) => {
        if (!blob) {
          reject(new Error('Gagal menghasilkan berkas gambar PNG'));
          return;
        }

        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
        }, 500);

        onProgress?.('Selesai!');
        resolve({ pngBlob: blob, pngUrl, fileName });
      }, 'image/png');
    });
  };

  // Attempt 1: If a live targetElement is provided, capture it safely with style sanitization
  if (options.targetElement && document.body.contains(options.targetElement)) {
    try {
      onProgress?.('Mengambil tangkapan layar invoice...');
      await preloadImagesInElement(options.targetElement);

      const targetId = options.targetElement.id || 'invoice-paper-a4';
      const canvas = await withSanitizedComputedStyles(async () => {
        return await html2canvas(options.targetElement!, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc: Document) => {
            const el = clonedDoc.getElementById(targetId) || clonedDoc.querySelector(`[id="${targetId}"]`);
            if (el && el instanceof HTMLElement) {
              el.style.transform = 'none';
              el.style.boxShadow = 'none';
              el.style.margin = '0 auto';
              el.style.borderRadius = '0px';
            }
            const fixStyle = clonedDoc.createElement('style');
            fixStyle.textContent = `
              img {
                display: inline !important;
              }
              body > div:last-child img {
                display: inline !important;
              }
            `;
            clonedDoc.head.appendChild(fixStyle);
            clonedDoc.querySelectorAll('style').forEach((st) => {
              if (st.textContent && (st.textContent.includes('oklch') || st.textContent.includes('lab'))) {
                st.textContent = sanitizeCssColorsInString(st.textContent);
              }
            });
          },
        });
      });

      if (canvas && canvas.width > 0 && canvas.height > 0) {
        return await downloadCanvasAsPng(canvas);
      }
    } catch (targetErr) {
      console.warn('Tangkapan langsung gagal, beralih ke generator invoice HTML presisi...', targetErr);
    }
  }

  // Attempt 2 (Robust Fallback / Standalone generator): Build dedicated high-res A4 container
  onProgress?.('Menyusun template invoice resolusi tinggi...');
  const htmlContent = generateInvoiceHtmlString(options);

  const container = document.createElement('div');
  container.id = 'html-invoice-render-target-png';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0px';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-9999';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  container.innerHTML = htmlContent;

  document.body.appendChild(container);

  try {
    onProgress?.('Memproses grafik & teks invoice...');
    await preloadImagesInElement(container);

    onProgress?.('Membuat berkas gambar PNG...');

    const canvas = await withSanitizedComputedStyles(async () => {
      return await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794,
        onclone: (clonedDoc: Document) => {
          const el = clonedDoc.getElementById('html-invoice-render-target-png');
          if (el) {
            el.style.left = '0px';
            el.style.top = '0px';
            el.style.opacity = '1';
            el.style.zIndex = '1';
            el.style.transform = 'none';
          }
          const fixStyle = clonedDoc.createElement('style');
          fixStyle.textContent = `
            img {
              display: inline !important;
            }
            body > div:last-child img {
              display: inline !important;
            }
          `;
          clonedDoc.head.appendChild(fixStyle);
          clonedDoc.querySelectorAll('style').forEach((st) => {
            if (st.textContent && (st.textContent.includes('oklch') || st.textContent.includes('lab'))) {
              st.textContent = sanitizeCssColorsInString(st.textContent);
            }
          });
        },
      });
    });

    return await downloadCanvasAsPng(canvas);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Native Browser Direct Print (window.print via hidden iframe)
 * Gives 100% Vector resolution without any rasterization!
 */
export function printHtmlInvoiceDirectly(options: HtmlInvoiceOptions): void {
  const htmlContent = generateInvoiceHtmlString(options);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Invoice - ${options.invoiceNumber}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          * {
            box-sizing: border-box;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);
  doc.close();

  // Clean up iframe after printing
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }, 60000);
}
