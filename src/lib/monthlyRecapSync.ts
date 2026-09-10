import { OrderItem, StoreExpenseBreakdown, PeriodSummaryStats } from '../types';
import { formatRupiah, formatTanggalDisatuin } from './formatters';

export interface MonthlyRecapPayload {
  action: 'update_rekap_bulanan';
  bulan: string;
  tanggalUpdate: string;
  totalTransaksi: number;
  totalQty: number;
  totalPendapatan: number;
  totalPengeluaran: number;
  profitBersih: number;
  marginPercent: number;
  breakdownToko: {
    toko: string;
    totalQty: number;
    totalBeli: number;
    totalJual: number;
    profit: number;
    orderCount: number;
    persentaseBeli: string;
  }[];
  detailItems: {
    tanggal: string;
    dapur: string;
    toko: string;
    pemasok: string;
    namaBarang: string;
    qty: number;
    hargaBeli: number;
    hargaJual: number;
    subtotalBeli: number;
    subtotalJual: number;
    laba: number;
    status: string;
  }[];
}

/**
 * Mendapatkan bulan saat ini dalam format Bahasa Indonesia (misal: "September 2026")
 */
export function getCurrentMonthLabel(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  return validDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

/**
 * Menyiapkan payload data rekapan bulanan
 */
export function buildMonthlyRecapPayload(
  orders: OrderItem[],
  stats: PeriodSummaryStats,
  selectedDate?: string
): MonthlyRecapPayload {
  const bulan = getCurrentMonthLabel(selectedDate);
  const marginPercent = stats.totalPendapatan > 0
    ? Math.round((stats.profitBersih / stats.totalPendapatan) * 100)
    : 0;

  const breakdownToko = stats.storeBreakdowns.map((s) => ({
    toko: s.toko,
    totalQty: s.totalQty,
    totalBeli: s.totalBeli,
    totalJual: s.totalJual,
    profit: s.profit,
    orderCount: s.orderCount,
    persentaseBeli: `${s.percentageOfTotalBeli.toFixed(1)}%`,
  }));

  const detailItems = orders.map((o) => {
    const qty = Number(o.qty) || 0;
    const beli = Number(o.hargaBeli) || 0;
    const jual = Number(o.hargaJual) || 0;
    return {
      tanggal: o.tanggal || '',
      dapur: o.tujuanDapur || '',
      toko: o.toko || '',
      pemasok: o.pemasok || '',
      namaBarang: o.namaBarang || '',
      qty,
      hargaBeli: beli,
      hargaJual: jual,
      subtotalBeli: qty * beli,
      subtotalJual: qty * jual,
      laba: (qty * jual) - (qty * beli),
      status: o.status || 'pending',
    };
  });

  return {
    action: 'update_rekap_bulanan',
    bulan,
    tanggalUpdate: new Date().toISOString(),
    totalTransaksi: stats.totalTransactions,
    totalQty: stats.totalQty,
    totalPendapatan: stats.totalPendapatan,
    totalPengeluaran: stats.totalPengeluaran,
    profitBersih: stats.profitBersih,
    marginPercent,
    breakdownToko,
    detailItems,
  };
}

/**
 * Mengirim rekapan bulanan langsung ke endpoint Google Sheets / Google Apps Script
 */
export async function syncMonthlyRecapToEndpoint(
  endpointUrl: string,
  payload: MonthlyRecapPayload
): Promise<{ success: boolean; message: string }> {
  const url = endpointUrl.trim();
  if (!url) {
    return {
      success: false,
      message: 'Endpoint Google Sheet belum diisi di Pengaturan.',
    };
  }

  try {
    // 1. Kirim ke Endpoint Eksternal (Google Apps Script Webhook / Custom Sheet endpoint)
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      mode: 'no-cors', // Penting untuk Google Apps Script Web App CORS
    });

    // 2. Jika ada backend server terkonfigurasi, cadangkan juga ke server
    try {
      await fetch('/api/sheets-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'rekap_bulanan',
          data: {
            BULAN: payload.bulan,
            UPDATE_PADA: new Date().toLocaleString('id-ID'),
            TOTAL_TRANSAKSI: payload.totalTransaksi,
            TOTAL_QTY: payload.totalQty,
            PENDAPATAN_JUAL: payload.totalPendapatan,
            PENGELUARAN_BELI: payload.totalPengeluaran,
            PROFIT_BERSIH: payload.profitBersih,
            MARGIN: `${payload.marginPercent}%`,
          },
        }),
      });
    } catch {
      // Abaikan jika sheet 'rekap_bulanan' belum ada di backend service account
    }

    return {
      success: true,
      message: `Rekapan bulan ${payload.bulan} berhasil dikirim dan diupdate ke Google Sheet!`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Gagal mengirim data ke endpoint Google Sheet.',
    };
  }
}

/**
 * Generate dan trigger unduh file CSV Rekapan Bulanan
 */
export function downloadMonthlyRecapCsv(payload: MonthlyRecapPayload): void {
  const lines: string[] = [];

  // Header & Summary
  lines.push(`REKAPAN BULANAN: ${payload.bulan.toUpperCase()}`);
  lines.push(`Waktu Update: ${new Date().toLocaleString('id-ID')}`);
  lines.push('');
  lines.push('--- RINGKASAN FINANSIAL ---');
  lines.push(`Total Transaksi,${payload.totalTransaksi}`);
  lines.push(`Total Kuantitas (Qty),${payload.totalQty}`);
  lines.push(`Total Pendapatan (H.JUAL),${payload.totalPendapatan}`);
  lines.push(`Total Pengeluaran PO (H.BELI),${payload.totalPengeluaran}`);
  lines.push(`Profit Bersih,${payload.profitBersih}`);
  lines.push(`Margin Keuntungan,${payload.marginPercent}%`);
  lines.push('');

  // Breakdown Toko
  lines.push('--- BREAKDOWN TOKO & PENGEPUL ---');
  lines.push('Toko,Total Qty,Pengeluaran PO (H.Beli),Pendapatan (H.Jual),Profit Bersih,Pesanan,% Kontribusi Beli');
  payload.breakdownToko.forEach((b) => {
    lines.push(`"${b.toko}",${b.totalQty},${b.totalBeli},${b.totalJual},${b.profit},${b.orderCount},"${b.persentaseBeli}"`);
  });
  lines.push('');

  // Detail Items
  lines.push('--- RINCIAN ITEM PESANAN BULANAN ---');
  lines.push('Tanggal,Toko,Dapur,Pemasok,Nama Barang,Qty,Harga Beli,Harga Jual,Subtotal Beli,Subtotal Jual,Profit,Status');
  payload.detailItems.forEach((d) => {
    lines.push(
      `"${d.tanggal}","${d.toko}","${d.dapur}","${d.pemasok}","${d.namaBarang}",${d.qty},${d.hargaBeli},${d.hargaJual},${d.subtotalBeli},${d.subtotalJual},${d.laba},"${d.status}"`
    );
  });

  const csvContent = '\uFEFF' + lines.join('\r\n'); // BOM untuk UTF-8 di Excel
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Rekap_Bulanan_${payload.bulan.replace(/\s+/g, '_')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate dan trigger unduh file Ringkasan Dokumen (.txt / Docs ready format)
 */
export function downloadMonthlyRecapSummaryDoc(payload: MonthlyRecapPayload): void {
  const text = `
=====================================================
LAPORAN REKAPAN BULANAN
Bulan: ${payload.bulan}
Waktu Ekspor: ${new Date().toLocaleString('id-ID')}
=====================================================

1. RINGKASAN FINANSIAL & OPERASIONAL
-----------------------------------------------------
- Total Transaksi         : ${payload.totalTransaksi} transaksi
- Total Kuantitas (Qty)   : ${payload.totalQty.toLocaleString('id-ID')} unit/kg
- Total Pendapatan (H.JUAL): ${formatRupiah(payload.totalPendapatan)}
- Total Pengeluaran (H.BELI): ${formatRupiah(payload.totalPengeluaran)}
- Profit Bersih           : ${formatRupiah(payload.profitBersih)}
- Margin Keuntungan       : ${payload.marginPercent}%

2. BREAKDOWN PENGELUARAN PO PER TOKO / PENGEPUL
-----------------------------------------------------
${payload.breakdownToko.map((b, idx) => `${idx + 1}. Toko ${b.toko}:
   - Pengeluaran PO (H.Beli) : ${formatRupiah(b.totalBeli)} (${b.persentaseBeli})
   - Pendapatan (H.Jual)     : ${formatRupiah(b.totalJual)}
   - Profit Bersih           : ${formatRupiah(b.profit)}
   - Volume                  : ${b.totalQty.toLocaleString('id-ID')} item (${b.orderCount} pesanan)`).join('\n\n')}

3. TOTAL ITEM TERDATA: ${payload.detailItems.length} baris barang
=====================================================
Laporan ini digenerate otomatis oleh Rekap Dapur.
`.trim();

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ringkasan_Bulanan_${payload.bulan.replace(/\s+/g, '_')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
