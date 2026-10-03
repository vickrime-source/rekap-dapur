import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { NoteItem, OrderItem, MasterToko, MasterPemasok, MasterDapur } from '../types';
import { getTodayWIB } from '../lib/formatters';
import { 
  saveOrderToDb, 
  saveNoteToDb, 
  updateNoteInDb, 
  deleteNoteFromDb 
} from '../lib/supabaseDb';

interface UseNotesOperationsProps {
  notes: NoteItem[];
  setNotes: Dispatch<SetStateAction<NoteItem[]>>;
  orders: OrderItem[];
  setOrders: Dispatch<SetStateAction<OrderItem[]>>;
  masterToko: MasterToko[];
  masterPemasok: MasterPemasok[];
  masterDapur: MasterDapur[];
  selectedDate: string;
  showToast: (message: string, type?: 'success' | 'delete' | 'edit' | 'info' | 'error') => void;
}

export function useNotesOperations({
  notes,
  setNotes,
  orders: _orders,
  setOrders,
  masterToko,
  masterPemasok,
  masterDapur,
  selectedDate,
  showToast,
}: UseNotesOperationsProps) {
  const [followUpNoteTarget, setFollowUpNoteTarget] = useState<NoteItem | null>(null);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);

  const handleOpenFollowUpNote = useCallback((note: NoteItem) => {
    setFollowUpNoteTarget(note);
    setIsFollowUpModalOpen(true);
  }, []);

  const handleCompleteFollowUpNote = useCallback(async (data: {
    noteId: string;
    itemIndex?: number;
    namaBarang: string;
    qty: number;
    satuan: string;
    toko: string;
    pemasok: string;
    tujuanDapur: string;
    hargaBeli: number;
    hargaJual: number;
    tanggal: string;
    catatanTambahan?: string;
  }) => {
    const targetNote = notes.find((n) => n.id === data.noteId);
    if (!targetNote) {
      showToast('Follow Up tidak ditemukan. Muat ulang data sebelum mencoba lagi.', 'error');
      throw new Error('Follow Up tidak ditemukan');
    }
    if (targetNote.items && targetNote.items.length > 1 && (data.itemIndex === undefined || data.itemIndex < 0 || data.itemIndex >= targetNote.items.length)) {
      showToast('Item Follow Up tidak valid. Pilih ulang item sebelum menyimpan.', 'error');
      throw new Error('Item Follow Up tidak valid');
    }
    const targetTanggal = data.tanggal || selectedDate || getTodayWIB();

    const cleanD = data.tujuanDapur.replace(/^dapur\s+/i, '').trim().toLowerCase();
    const fTokoId = masterToko.find((t) => t.nama.toLowerCase() === data.toko.trim().toLowerCase())?.id || '';
    const fPemasokId = masterPemasok.find((p) => p.nama.toLowerCase() === data.pemasok.trim().toLowerCase())?.id || '';
    const fDapurId = masterDapur.find((d) => d.nama.toLowerCase() === data.tujuanDapur.trim().toLowerCase() || d.nama.toLowerCase() === cleanD)?.id || '';

    const newOrderFromNote: OrderItem = {
      id: `ord-from-note-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      namaBarang: data.namaBarang,
      qty: data.qty,
      satuan: data.satuan,
      hargaBeli: data.hargaBeli,
      hargaJual: data.hargaJual,
      toko: data.toko,
      toko_id: fTokoId || null,
      tujuanDapur: data.tujuanDapur,
      dapur_id: fDapurId || null,
      pemasok: data.pemasok,
      pemasok_id: fPemasokId || null,
      status: 'pending',
      paymentStatus: 'UNPAID',
      deliveryStatus: 'PENDING',
      tanggal: targetTanggal,
      createdAt: new Date().toISOString(),
      catatan: data.catatanTambahan ? `Dari Catatan: ${data.catatanTambahan}` : `Dari Catatan: ${data.namaBarang} (${data.qty} ${data.satuan})`,
    };

    // Jangan keluarkan Follow Up sebelum pesanan benar-benar tersimpan di server.
    const saveRes = await saveOrderToDb(newOrderFromNote);
    if (!saveRes.success) {
      const message = saveRes.error || 'Gagal menyimpan pesanan';
      showToast(`Pesanan gagal disimpan: ${message}. Follow Up tetap ada.`, 'error');
      throw new Error(message);
    }

    const savedOrder = saveRes.data || newOrderFromNote;
    setOrders((prev) => prev.some((order) => order.id === savedOrder.id) ? prev : [savedOrder, ...prev]);

    // Catatan multi-item: keluarkan hanya item yang diproses, sisanya tetap Follow Up.
    const remainingItems = targetNote.items && targetNote.items.length > 1
      ? targetNote.items.filter((_, index) => index !== (data.itemIndex ?? 0))
      : [];

    if (remainingItems.length > 0) {
      const firstRemaining = remainingItems[0];
      const remainingNote: NoteItem = {
        ...targetNote,
        items: remainingItems,
        namaBarang: firstRemaining.namaBarang,
        qty: firstRemaining.qty,
        satuan: firstRemaining.satuan,
        pemasok: firstRemaining.pemasok || targetNote.pemasok,
        isDone: false,
        status: 'FOLLOW UP',
        orderId: undefined,
      };
      const updateRes = await updateNoteInDb(targetNote.id, remainingNote);
      setNotes((prev) => prev.map((note) => note.id === targetNote.id ? remainingNote : note));
      showToast(
        updateRes.success
          ? `Pesanan ${data.namaBarang} tersimpan. ${remainingItems.length} item masih Follow Up.`
          : `Pesanan tersimpan, tetapi sisa Follow Up gagal disinkronkan: ${updateRes.error || 'coba muat ulang'}. Jangan input ulang item ini.`,
        updateRes.success ? 'success' : 'error'
      );
      return;
    }

    // Catatan satu item: hapus permanen setelah pesanan tersimpan.
    let deleteRes = await deleteNoteFromDb(targetNote.id);
    if (!deleteRes.success) deleteRes = await deleteNoteFromDb(targetNote.id);
    if (!deleteRes.success) {
      // Jika hapus gagal, tandai selesai agar catatan tidak muncul lagi saat data dimuat ulang.
      const fallbackRes = await updateNoteInDb(targetNote.id, {
        ...targetNote,
        isDone: true,
        status: 'completed',
        orderId: savedOrder.id,
      });
      showToast(
        fallbackRes.success
          ? 'Pesanan tersimpan. Follow Up disembunyikan, tetapi penghapusan di server belum berhasil.'
          : 'Pesanan tersimpan, tetapi Follow Up gagal dihapus dari server. Jangan proses ulang item ini.',
        'error'
      );
    } else {
      showToast(`Pesanan ${data.namaBarang} tersimpan; Follow Up telah dihapus.`, 'success');
    }
    setNotes((prev) => prev.filter((note) => note.id !== targetNote.id));
  }, [notes, selectedDate, masterToko, masterPemasok, masterDapur, setOrders, setNotes, showToast]);

  const handleToggleNoteStatus = useCallback(async (noteId: string) => {
    const target = notes.find((n) => n.id === noteId);
    if (!target) return;

    if (!target.isDone) {
      handleOpenFollowUpNote(target);
    } else {
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, isDone: false, status: 'pending' } : n))
      );
      showToast('Status item dikembalikan ke Follow Up aktif', 'info');

      updateNoteInDb(target.id, {
        isDone: false,
        status: 'pending',
      });
    }
  }, [notes, handleOpenFollowUpNote, setNotes, showToast]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    const target = notes.find((n) => n.id === noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    showToast('Item follow up berhasil dihapus', 'delete');

    if (target) {
      await deleteNoteFromDb(target.id);
    }
  }, [notes, setNotes, showToast]);

  const handleDeleteSelectedNotes = useCallback(async (noteIds: string[]) => {
    const selected = new Set(noteIds);
    const targets = notes.filter((note) => selected.has(note.id));
    const deletedIds: string[] = [];

    for (const note of targets) {
      const result = await deleteNoteFromDb(note.id);
      if (result.success) deletedIds.push(note.id);
    }

    if (deletedIds.length > 0) {
      const deleted = new Set(deletedIds);
      setNotes((prev) => prev.filter((note) => !deleted.has(note.id)));
    }

    const failed = targets.length - deletedIds.length;
    if (failed > 0) {
      showToast(`${deletedIds.length} Follow Up dihapus, ${failed} gagal. Coba lagi untuk sisanya.`, 'error');
    } else if (deletedIds.length > 0) {
      showToast(`${deletedIds.length} Follow Up berhasil dihapus`, 'delete');
    }
  }, [notes, setNotes, showToast]);

  const handleSaveNote = useCallback(async (noteData: Omit<NoteItem, 'id' | 'createdAt'>) => {
    const newNote: NoteItem = {
      ...noteData,
      tanggal: noteData.tanggal || selectedDate || getTodayWIB(),
      id: `note-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    setNotes((prev) => [newNote, ...prev]);
    showToast('Item follow up berhasil disimpan', 'success');

    await saveNoteToDb(newNote);
  }, [selectedDate, setNotes, showToast]);

  return {
    followUpNoteTarget,
    setFollowUpNoteTarget,
    isFollowUpModalOpen,
    setIsFollowUpModalOpen,
    handleOpenFollowUpNote,
    handleCompleteFollowUpNote,
    handleToggleNoteStatus,
    handleDeleteNote,
    handleDeleteSelectedNotes,
    handleSaveNote,
  };
}
