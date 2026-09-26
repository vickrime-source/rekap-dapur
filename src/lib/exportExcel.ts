import { OrderItem } from '../types';
import { formatRupiah, formatTanggal } from './formatters';

export async function exportToExcel(orders: OrderItem[], filenamePrefix = 'Rekap_Dapur_Tracker') {
  if (!orders || orders.length === 0) {
    alert('Tidak ada data pesanan untuk diekspor');
    return;
  }

  const XLSX = await import('xlsx');

  const exportData = orders.map((item, index) => {
    const rawQtyJual = Number(item.qty) || 0;
    const rawQtyBeli = (item as any).qtyBeli !== undefined && (item as any).qtyBeli !== null
      ? Number((item as any).qtyBeli)
      : ((item as any).qty_beli !== undefined && (item as any).qty_beli !== null
        ? Number((item as any).qty_beli)
        : rawQtyJual);
    const returQty = Math.max(0, Number(item.retur) || 0);
    const finalQty = Math.max(0, rawQtyJual - returQty);
    const qtyBeliEfektif = Math.max(0, rawQtyBeli - returQty);
    const cb = Number(item.cashback) || 0;

    const totalBeli = qtyBeliEfektif * item.hargaBeli;
    const totalJual = finalQty * item.hargaJual;
    const profit = cb > 0 ? (cb * finalQty - totalBeli) : (totalJual - totalBeli);
    const keKoperasi = cb > 0 ? (item.hargaJual - cb) * finalQty : 0;

    return {
      'No': index + 1,
      'Tanggal': formatTanggal(item.tanggal, false),
      'Nama Barang': item.namaBarang,
      'Qty Awal': rawQtyJual,
      'Retur': returQty,
      'Qty Final': finalQty,
      'Satuan': item.satuan || 'Kg',
      'Harga Beli (Satuan)': item.hargaBeli,
      'Harga Jual (Satuan)': item.hargaJual,
      'Cashback': cb,
      'Total Pembelian': totalBeli,
      'Total Penjualan': totalJual,
      'Keuntungan (Profit)': profit,
      'Total Cashback': keKoperasi,
      'Toko': item.toko,
      'Tujuan Dapur': item.tujuanDapur,
      'Pemasok / Supplier': item.pemasok,
      'Status': item.status === 'selesai' ? 'Selesai' : 'Pending',
      'Catatan': item.catatan || '-'
    };
  });

  // Calculate totals
  const totalRawQtyAll = orders.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const totalReturAll = orders.reduce((sum, item) => sum + Math.max(0, Number(item.retur) || 0), 0);
  const totalFinalQtyAll = orders.reduce((sum, item) => {
    const rq = Number(item.qty) || 0;
    const rt = Math.max(0, Number(item.retur) || 0);
    return sum + Math.max(0, rq - rt);
  }, 0);
  const totalBeliAll = orders.reduce((sum, item) => {
    const rq = Number(item.qty) || 0;
    const rawQB = (item as any).qtyBeli ?? (item as any).qty_beli ?? rq;
    const rt = Math.max(0, Number(item.retur) || 0);
    const qbe = Math.max(0, rawQB - rt);
    return sum + (qbe * (Number(item.hargaBeli) || 0));
  }, 0);
  const totalJualAll = orders.reduce((sum, item) => {
    const rq = Number(item.qty) || 0;
    const rt = Math.max(0, Number(item.retur) || 0);
    return sum + (Math.max(0, rq - rt) * (Number(item.hargaJual) || 0));
  }, 0);
  let totalProfitAll = 0;
  let totalKeKoperasiAll = 0;
  orders.forEach((item) => {
    const rq = Number(item.qty) || 0;
    const rawQB = (item as any).qtyBeli ?? (item as any).qty_beli ?? rq;
    const rt = Math.max(0, Number(item.retur) || 0);
    const fq = Math.max(0, rq - rt);
    const qbe = Math.max(0, rawQB - rt);
    const modal = qbe * (Number(item.hargaBeli) || 0);
    const omzet = fq * (Number(item.hargaJual) || 0);
    const cb = Number(item.cashback) || 0;
    if (cb > 0) {
      totalProfitAll += (cb * fq - modal);
      totalKeKoperasiAll += (Number(item.hargaJual || 0) - cb) * fq;
    } else {
      totalProfitAll += (omzet - modal);
    }
  });

  // Append summary row
  exportData.push({
    'No': 0,
    'Tanggal': '--- REKAP TOTAL ---',
    'Nama Barang': `Total ${orders.length} Item`,
    'Qty Awal': totalRawQtyAll,
    'Retur': totalReturAll,
    'Qty Final': totalFinalQtyAll,
    'Satuan': '',
    'Harga Beli (Satuan)': 0,
    'Harga Jual (Satuan)': 0,
    'Cashback': 0,
    'Total Pembelian': totalBeliAll,
    'Total Penjualan': totalJualAll,
    'Keuntungan (Profit)': totalProfitAll,
    'Total Cashback': totalKeKoperasiAll,
    'Toko': '',
    'Tujuan Dapur': '',
    'Pemasok / Supplier': '',
    'Status': '',
    'Catatan': ''
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 5 },  // No
    { wch: 15 }, // Tanggal
    { wch: 25 }, // Nama Barang
    { wch: 10 }, // Qty Awal
    { wch: 8 },  // Retur
    { wch: 10 }, // Qty Final
    { wch: 8 },  // Satuan
    { wch: 18 }, // Harga Beli
    { wch: 18 }, // Harga Jual
    { wch: 12 }, // Cashback
    { wch: 18 }, // Total Pembelian
    { wch: 18 }, // Total Penjualan
    { wch: 18 }, // Keuntungan
    { wch: 14 }, // Cashback
    { wch: 12 }, // Toko
    { wch: 22 }, // Tujuan Dapur
    { wch: 20 }, // Pemasok
    { wch: 10 }, // Status
    { wch: 20 }, // Catatan
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Dapur Tracker');

  const todayStr = new Date().toISOString().split('T')[0];
  const filename = `${filenamePrefix}_${todayStr}.xlsx`;

  XLSX.writeFile(workbook, filename);
}

export async function exportToCSV(orders: OrderItem[], filenamePrefix = 'Rekap_Dapur_Tracker') {
  if (!orders || orders.length === 0) {
    alert('Tidak ada data pesanan untuk diekspor');
    return;
  }

  const XLSX = await import('xlsx');

  const exportData = orders.map((item, index) => {
    const rawQtyJual = Number(item.qty) || 0;
    const rawQtyBeli = (item as any).qtyBeli !== undefined && (item as any).qtyBeli !== null
      ? Number((item as any).qtyBeli)
      : ((item as any).qty_beli !== undefined && (item as any).qty_beli !== null
        ? Number((item as any).qty_beli)
        : rawQtyJual);
    const returQty = Math.max(0, Number(item.retur) || 0);
    const finalQty = Math.max(0, rawQtyJual - returQty);
    const qtyBeliEfektif = Math.max(0, rawQtyBeli - returQty);
    const cb = Number(item.cashback) || 0;

    const totalBeli = qtyBeliEfektif * item.hargaBeli;
    const totalJual = finalQty * item.hargaJual;
    const profit = cb > 0 ? (cb * finalQty - totalBeli) : (totalJual - totalBeli);
    const keKoperasi = cb > 0 ? (item.hargaJual - cb) * finalQty : 0;

    return {
      'No': index + 1,
      'Tanggal': item.tanggal,
      'Nama Barang': item.namaBarang,
      'Qty Awal': rawQtyJual,
      'Retur': returQty,
      'Qty Final': finalQty,
      'Satuan': item.satuan || 'Kg',
      'Harga Beli Satuan': item.hargaBeli,
      'Harga Jual Satuan': item.hargaJual,
      'Cashback': cb,
      'Total Beli': totalBeli,
      'Total Jual': totalJual,
      'Profit': profit,
      'Total Cashback': keKoperasi,
      'Toko': item.toko,
      'Tujuan Dapur': item.tujuanDapur,
      'Pemasok': item.pemasok,
      'Status': item.status
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);

  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const todayStr = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `${filenamePrefix}_${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
