import { saveAs } from 'file-saver';
import { compressDocxImagesClient } from './clientDocxCompressor';
import { OrderItem } from '../types';
import {
  formatRupiah,
  formatTanggal,
  formatTanggalRealtime,
  formatTanggalInvoice,
  resolveRecipientSppgName,
  parseIndonesianNumber,
  generateInvoiceNumber,
} from './formatters';
import { exportHtmlInvoicePdf } from './htmlInvoicePdf';

export const TEMPLATE_URLS: Record<string, string> = {
  "LUWENG BOGA": "https://docs.google.com/document/d/1vCwDWoGEQhmyujqTF0l0VVJU3cH8nyxn/export?format=docx",
  "HTG": "https://docs.google.com/document/d/1km9cBqcqqfWoHdI8tg7ATjw2ZSAsL4gZ/export?format=docx",
  "LUMBUNG ADIFRUTA": "https://docs.google.com/document/d/1AvbWhAIgCgyHBqeaZ-qpw3MSrKazoXoh/export?format=docx",
  "PROHE": "https://docs.google.com/document/d/1uzoTVnveItdYGgHoZcFedec1KMf-D0LX/export?format=docx"
};

export const INVOICE_TEMPLATES = TEMPLATE_URLS;

export function getCustomTemplateUrl(): string | null {
  return localStorage.getItem('custom_docx_template_url');
}

export function setCustomTemplateUrl(url: string | null, name?: string): void {
  if (url) {
    localStorage.setItem('custom_docx_template_url', url);
    if (name) localStorage.setItem('custom_docx_template_name', name);
  } else {
    localStorage.removeItem('custom_docx_template_url');
    localStorage.removeItem('custom_docx_template_name');
  }
}

/**
 * Get Google Docs export URL for a given store name
 */
export function getTemplateUrlForStore(storeName: string): string {
  const customUrl = getCustomTemplateUrl();
  if (customUrl) return customUrl;

  const norm = (storeName || '').trim().toUpperCase();
  if (norm.includes('LUWENG') || norm.includes('LEMBUNG') || norm.includes('BOGA') || norm.includes('LB')) {
    return TEMPLATE_URLS["LUWENG BOGA"];
  }
  if (norm.includes('PROHE') || norm.includes('PW')) {
    return TEMPLATE_URLS["PROHE"];
  }
  if (norm.includes('LUMBUNG') || norm.includes('ADIFRUTA') || norm.includes('ADIFRUITA') || norm.includes('ADIFR') || norm.includes('FRUITA') || norm.includes('FRUTA') || norm === 'LA') {
    return TEMPLATE_URLS["LUMBUNG ADIFRUTA"];
  }
  return TEMPLATE_URLS["HTG"];
}

export interface ExportInvoiceOptions {
  storeName: string;
  kitchenName: string;
  items: OrderItem[];
  invoiceNumber?: string;
  dateStr?: string;
  bayar?: number;
  customNama?: string;
  customAlamat?: string;
  customNomor?: string;
}

/**
 * Format docxtemplater errors into detailed messages for debugging
 */
function formatDocxtemplaterErrors(err: any, storeName: string): string {
  console.error(`[docxtemplater Error on store "${storeName}"]:`, err);

  if (err.properties && Array.isArray(err.properties.errors)) {
    const errorList = err.properties.errors
      .map((e: any, idx: number) => {
        const explanation = e.properties?.explanation || e.message || 'Syntax/Tag Error';
        const tag = e.properties?.id || e.properties?.xtag || e.properties?.context || '';
        const file = e.properties?.file || '';
        return `${idx + 1}. ${explanation} ${tag ? `[Tag: "${tag}"]` : ''} ${file ? `(${file})` : ''}`;
      })
      .join('\n');

    return `MultiError (${err.properties.errors.length} error pada template "${storeName}"):\n${errorList}`;
  }

  return `TemplateError pada template "${storeName}": ${err?.message || err}`;
}

export function sanitizeDocxXml(zip: any): void {
  const xmlFiles = Object.keys(zip.files).filter((fileName) =>
    fileName.startsWith('word/') && fileName.endsWith('.xml')
  );

  for (const xmlPath of xmlFiles) {
    const docXmlFile = zip.file(xmlPath);
    if (!docXmlFile) continue;

    let docXml = docXmlFile.asText();

    // 1. Fix PROHE specific broken opening/closing tags and isolated single braces
    // In PROHE Google Docs, the table has '{{#it em s}}{' in col 1, '{no}' in col 2, and '}' in col 3
    docXml = docXml.replaceAll('{{#it em s}}{', '{{#items}}');
    docXml = docXml.replaceAll('{{#it em s}}', '{{#items}}');
    docXml = docXml.replaceAll('{{/it em s}}', '{{/items}}');
    docXml = docXml.replaceAll('{#it em s}', '{{#items}}');
    docXml = docXml.replaceAll('{/it em s}', '{{/items}}');

    // 2. Fix PROHE isolated {no} cell and remove its closing } artifact
    docXml = docXml.replaceAll('<w:t xml:space="preserve">{no}</w:t>', '<w:t xml:space="preserve">{{no}}</w:t>');
    docXml = docXml.replaceAll('<w:t>{no}</w:t>', '<w:t>{{no}}</w:t>');
    docXml = docXml.replaceAll('<w:t xml:space="preserve">}</w:t>', '<w:t xml:space="preserve"></w:t>');
    docXml = docXml.replaceAll('<w:t>} </w:t>', '<w:t></w:t>');
    docXml = docXml.replaceAll('<w:t>}</w:t>', '<w:t></w:t>');

    // 3. Spaced order tags if present
    docXml = docXml.replaceAll('{{#or der s}}', '{{#orders}}');
    docXml = docXml.replaceAll('{{/or der s}}', '{{/orders}}');

    zip.file(xmlPath, docXml);
  }
}

/**
 * Prepare and filter transaction items strictly by store, kitchen, and date
 */
export function prepareScopedInvoiceData(options: ExportInvoiceOptions) {
  const { storeName, kitchenName, items, bayar = 0 } = options;

  const targetStore = (storeName || '').trim().toLowerCase();
  const targetKitchen = (kitchenName || '').trim().toLowerCase();
  const targetDate = options.dateStr || items[0]?.tanggal;

  // 1. FILTER: strictly match store + kitchen + date of the clicked action row
  const filteredItems = items.filter((item) => {
    const matchStore = !targetStore || (item.toko || '').trim().toLowerCase() === targetStore;
    const matchKitchen = !targetKitchen || (item.tujuanDapur || '').trim().toLowerCase() === targetKitchen;
    const matchDate = !targetDate || item.tanggal === targetDate;
    return matchStore && matchKitchen && matchDate;
  });

  const validItems = filteredItems.length > 0 ? filteredItems : items;

  // 2. Invoice Number Auto Generation
  const autoInvoiceNo =
    options.invoiceNumber ||
    (validItems[0] as any)?.noInvoice ||
    (validItems[0] as any)?.nomorInvoice ||
    generateInvoiceNumber(kitchenName);

  const formattedDate = targetDate ? formatTanggalInvoice(targetDate) : formatTanggalInvoice(new Date());
  const rawDate = targetDate || new Date().toISOString().split('T')[0];

  const displayNama = resolveRecipientSppgName(options.customNama, kitchenName, validItems);
  const displayAlamat = '-';
  const displayNomor = '-';

  // 3. Calculate TOTAL using parseIndonesianNumber
  let grandTotal = 0;
  const itemsFormatted = validItems.map((item, index) => {
    const q = parseIndonesianNumber(item.qty);
    const unitPrice = parseIndonesianNumber(item.hargaJual || 0);
    const subtotal = q * unitPrice;
    grandTotal += subtotal;

    return {
      no: index + 1,
      NO: index + 1,
      qty: q,
      QTY: q,
      banyaknya: q,
      BANYAKNYA: q,

      nama: item.namaBarang,
      NAMA: item.namaBarang,
      namaItem: item.namaBarang,
      NAMA_ITEM: item.namaBarang,
      nama_item: item.namaBarang,
      namaBarang: item.namaBarang,
      NAMA_BARANG: item.namaBarang,
      nama_barang: item.namaBarang,
      barang: item.namaBarang,
      BARANG: item.namaBarang,
      item: item.namaBarang,
      ITEM: item.namaBarang,

      harga: formatRupiah(unitPrice),
      HARGA: formatRupiah(unitPrice),
      hargaJual: formatRupiah(unitPrice),
      hargaBeli: formatRupiah(parseIndonesianNumber(item.hargaBeli)),

      jumlah: formatRupiah(subtotal),
      JUMLAH: formatRupiah(subtotal),
      subtotal: formatRupiah(subtotal),
      SUBTOTAL: formatRupiah(subtotal),

      catatan: item.catatan || '',
      pemasok: item.pemasok || '',
    };
  });

  const parsedBayar = parseIndonesianNumber(bayar);
  const sisa = grandTotal - parsedBayar;

  // Exact Data Context required by docxtemplater:
  // { tgl, nama, alamat, nomor, TOTAL, bayar, sisa, items: [...] }
  const dataContext = {
    // Dates
    tgl: formattedDate,
    TGL: formattedDate,
    tanggal: formattedDate,
    TANGGAL: formattedDate,
    raw_tanggal: rawDate,

    // Recipient Info
    nama: displayNama,
    NAMA: displayNama,
    dapur: displayNama,
    DAPUR: displayNama,
    kitchen: displayNama,
    tujuanDapur: displayNama,
    kepada: displayNama,
    KEPADA: displayNama,

    alamat: displayAlamat,
    ALAMAT: displayAlamat,

    nomor: displayNomor,
    NOMOR: displayNomor,
    no: displayNomor,
    NO: displayNomor,
    invoiceNumber: autoInvoiceNo,
    INVOICE_NUMBER: autoInvoiceNo,

    // Store Info
    toko: storeName,
    TOKO: storeName,
    store: storeName,

    // Totals
    total: formatRupiah(grandTotal),
    TOTAL: formatRupiah(grandTotal),

    // Tampilan invoice tetap 0/kosong; nilai pembayaran operasional tidak diubah.
    bayar: '0',
    BAYAR: '0',

    sisa: '',
    SISA: '',

    // Array of items
    items: itemsFormatted,
    ITEMS: itemsFormatted,
    orders: itemsFormatted,
    ORDERS: itemsFormatted,
    barang: itemsFormatted,
    BARANG: itemsFormatted,
    table: itemsFormatted,
    TABLE: itemsFormatted,
  };

  return {
    validItems,
    dataContext,
    grandTotal,
    autoInvoiceNo,
    formattedDate,
    rawDate,
    itemsFormatted,
    parsedBayar,
    sisa,
  };
}

/**
 * Fetch Google Docs docx template directly from Google Docs export URL
 */
export async function fetchDocxTemplateBuffer(storeName: string): Promise<ArrayBuffer> {
  const targetUrl = getTemplateUrlForStore(storeName);
  const response = await fetch(targetUrl);
  if (!response.ok) {
    throw new Error(`Gagal mengambil template Google Docs untuk ${storeName} (${response.statusText})`);
  }
  return await response.arrayBuffer();
}

/**
 * Main Export Function:
 * Uses clean HTML Invoice Template Engine (Option A) for 100% pixel-perfect vector rendering,
 * guaranteed logo positioning, accurate table sizing, and instant PDF download.
 */
export async function exportInvoicePdf(
  options: ExportInvoiceOptions,
  onProgress?: (statusMsg: string) => void
): Promise<{ pdfBlob: Blob; pdfUrl: string; fileName: string }> {
  const { storeName, kitchenName, invoiceNumber, bayar, customNama, customAlamat, customNomor } = options;
  const { validItems } = prepareScopedInvoiceData(options);

  if (validItems.length === 0) {
    throw new Error('Tidak ada transaksi valid untuk di-export');
  }

  return await exportHtmlInvoicePdf(
    {
      storeName,
      kitchenName,
      items: validItems,
      invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
      bayar: bayar || 0,
      customNama,
      customAlamat,
      customNomor,
    },
    onProgress
  );
}

/**
 * Download filled DOCX file directly without PDF conversion
 */
export async function exportInvoiceDocxOnly(
  options: ExportInvoiceOptions,
  onProgress?: (statusMsg: string) => void
): Promise<{ docxBlob: Blob; fileName: string }> {
  const { storeName, kitchenName } = options;
  onProgress?.('Menyiapkan data invoice...');
  const { validItems, dataContext, rawDate } = prepareScopedInvoiceData(options);
  if (validItems.length === 0) {
    throw new Error('Tidak ada transaksi valid untuk di-export');
  }
  onProgress?.('Mengambil template invoice...');
  const arrayBuffer = await fetchDocxTemplateBuffer(storeName);
  onProgress?.('Mengisi template invoice...');
  const [{ default: PizZip }, { default: Docxtemplater }] = await Promise.all([
    import('pizzip'),
    import('docxtemplater'),
  ]);
  const zip = new PizZip(arrayBuffer);
  sanitizeDocxXml(zip);
  let docxBlob: Blob;
  try {
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
      nullGetter: () => '',
    });
    doc.render(dataContext);
    docxBlob = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  } catch (err: any) {
    const errorDetails = formatDocxtemplaterErrors(err, storeName);
    throw new Error(errorDetails);
  }

  const fileName = `Invoice_${storeName.replace(/\s+/g, '_')}_${kitchenName.replace(/\s+/g, '_')}_${rawDate}.docx`;
  saveAs(docxBlob, fileName);
  onProgress?.('File DOCX Berhasil Diunduh!');
  return { docxBlob, fileName };
}

/**
 * Client-Side PDF Generation using docx-preview + html2pdf
 * Runs completely in browser, requires no server or external API keys.
 */
export async function renderDocxToPdfClientSide(
  docxBlob: Blob,
  baseFileName: string,
  onProgress?: (statusMsg: string) => void
): Promise<{ pdfBlob: Blob; pdfUrl: string; fileName: string }> {
  onProgress?.('Mencetak PDF di browser (Client-Side)...');
  console.log('[Client PDF] Rendering DOCX to PDF in browser via docx-preview + html2pdf...');

  // Create container positioned at (0, 0) with A4 standard pixel width (794px)
  const container = document.createElement('div');
  container.id = 'docx-render-pdf-container';
  container.style.position = 'fixed';
  container.style.left = '0px';
  container.style.top = '0px';
  container.style.width = '794px';
  container.style.minHeight = '1123px';
  container.style.zIndex = '-99999';
  container.style.opacity = '1';
  container.style.pointerEvents = 'none';
  container.style.background = '#ffffff';
  container.style.margin = '0';
  container.style.padding = '0';
  container.style.boxSizing = 'border-box';
  container.style.overflow = 'visible';
  document.body.appendChild(container);

  try {
    const arrayBuffer = await docxBlob.arrayBuffer();
    const { renderAsync } = await import('docx-preview');
    await renderAsync(arrayBuffer, container, undefined, {
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      experimental: true,
      trimXmlDeclaration: true,
      renderHeaders: true,
      renderFooters: true,
      useBase64URL: true,
    });

    onProgress?.('Merapikan tata letak & logo PDF...');

    // 1. Clean .docx-wrapper (remove grey background, outer shadows and margins)
    const wrapper = container.querySelector('.docx-wrapper') as HTMLElement;
    if (wrapper) {
      wrapper.style.padding = '0';
      wrapper.style.margin = '0';
      wrapper.style.background = '#ffffff';
      wrapper.style.boxShadow = 'none';
    }

    // 2. Normalize and fit all sections to exact A4 printable area
    const sections = container.querySelectorAll('section.docx');
    sections.forEach((sec) => {
      const el = sec as HTMLElement;
      el.style.boxShadow = 'none';
      el.style.margin = '0 auto';
      el.style.background = '#ffffff';
      el.style.width = '100%';
      el.style.maxWidth = '794px';
      el.style.minHeight = '1123px';
      el.style.boxSizing = 'border-box';
      el.style.padding = '36px 44px'; // Proportional margins to keep right column inside page
      el.style.overflow = 'visible';
    });

    // 3. Fix and unhide all logos and images (strip unsupported clip-path, normalize offsets)
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      const el = img as HTMLImageElement;
      // Strip unsupported CSS clip-path that causes html2canvas to render blank/invisible images
      el.style.clipPath = 'none';
      (el.style as any).webkitClipPath = 'none';
      el.style.transform = 'none';
      el.style.visibility = 'visible';
      el.style.opacity = '1';
      el.style.display = 'inline-block';
      el.style.maxWidth = '100%';
      el.style.objectFit = 'contain';

      // Fix parent drawing container generated by docx-preview
      const parent = el.parentElement;
      if (parent) {
        parent.style.overflow = 'visible';
        parent.style.transform = 'none';
        (parent.style as any).webkitTransform = 'none';
        if (el.style.width && el.style.width !== '0px') {
          parent.style.width = el.style.width;
        }
        if (el.style.height && el.style.height !== '0px') {
          parent.style.height = el.style.height;
        }
        // Normalize any negative offsets that push images off-screen or out of page margin
        const curLeft = parseFloat(parent.style.left || '0');
        if (curLeft < 0) {
          parent.style.left = '0px';
        }
        const curTop = parseFloat(parent.style.top || '0');
        if (curTop < 0) {
          parent.style.top = '0px';
        }
      }
    });

    // 4. Ensure header and paragraphs have clean layout and visible overflow
    container.querySelectorAll('header, .docx-header').forEach((h) => {
      const el = h as HTMLElement;
      el.style.overflow = 'visible';
      el.style.marginTop = '0';
      el.style.marginBottom = '12px';
      el.style.minHeight = 'auto';
    });

    // 5. Tables: ensure 100% width, border-collapse: collapse, and neat borders/padding
    container.querySelectorAll('table').forEach((tbl) => {
      const el = tbl as HTMLElement;
      el.style.width = '100%';
      el.style.maxWidth = '100%';
      el.style.tableLayout = 'fixed';
      el.style.boxSizing = 'border-box';
      el.style.borderCollapse = 'collapse';
      el.style.margin = '10px 0';
      el.style.border = '1px solid #000000';
    });

    // 6. Table Cells: explicit 8px 12px padding, vertical-align middle, clean borders, and weight normalization
    container.querySelectorAll('td, th').forEach((cellNode) => {
      const cell = cellNode as HTMLElement;
      cell.style.padding = '8px 12px';
      cell.style.verticalAlign = 'middle';
      cell.style.border = '1px solid #000000';
      cell.style.boxSizing = 'border-box';
      cell.style.wordBreak = 'break-word';
      cell.style.overflowWrap = 'break-word';

      const isHeader = cell.tagName.toLowerCase() === 'th' || cell.closest('thead') !== null;
      const text = cell.textContent?.trim().toUpperCase() || '';

      if (isHeader) {
        cell.style.fontWeight = 'bold';
        cell.style.textAlign = 'center';
      } else {
        // Explicit normal font-weight on data cells unless it is TOTAL or signature label
        if (text === 'TOTAL' || text.startsWith('TOTAL')) {
          cell.style.fontWeight = 'bold';
        } else if (text === 'HORMAT KAMI' || text === 'TANDA TERIMA') {
          cell.style.fontWeight = 'bold';
        } else {
          cell.style.fontWeight = 'normal';
          // Prevent child spans/paras from inheriting stray bold from docx runs
          cell.querySelectorAll('p, span, b, strong').forEach((child) => {
            const c = child as HTMLElement;
            const childText = c.textContent?.trim().toUpperCase() || '';
            if (childText !== 'TOTAL' && childText !== 'HORMAT KAMI' && childText !== 'TANDA TERIMA') {
              c.style.fontWeight = 'normal';
            }
          });
        }
      }
    });

    // 7. General text wrapping
    container.querySelectorAll('p, span').forEach((node) => {
      const el = node as HTMLElement;
      el.style.wordBreak = 'break-word';
      el.style.overflowWrap = 'break-word';
    });

    // 7. Ensure all images are fully loaded before capturing canvas
    const imgElements = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      imgElements.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve(null);
        return new Promise((resolve) => {
          img.onload = () => resolve(null);
          img.onerror = () => resolve(null);
          setTimeout(resolve, 800);
        });
      })
    );

    // Wait a brief tick for all CSS layout changes to settle
    await new Promise((resolve) => setTimeout(resolve, 350));

    const targetElement = (container.querySelector('.docx-wrapper') as HTMLElement) || container;

    const fileName = `${baseFileName}.pdf`;
    const opt = {
      margin: [4, 4, 4, 4] as [number, number, number, number],
      filename: fileName,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        backgroundColor: '#ffffff',
        windowWidth: 794,
      },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = (html2pdfModule as any).default || html2pdfModule;
    const pdfBlob: Blob = await html2pdf().set(opt).from(targetElement).output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);

    try {
      saveAs(pdfBlob, fileName);
    } catch (e) {
      console.warn('[Client PDF Fallback] saveAs failed or blocked:', e);
    }

    onProgress?.('Selesai (PDF Browser)!');

    return {
      pdfBlob,
      pdfUrl,
      fileName,
    };
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Backwards compatibility alias - points to actual DOCX export
 */
export const downloadDocxInvoice = exportInvoiceDocxOnly;
