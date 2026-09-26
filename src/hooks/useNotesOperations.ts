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

    // Langkah 1: Buat dan simpan pesanan transaksi terlebih dahulu (Transaction-Safe)
    try {
      const saveRes = await saveOrderToDb(newOrderFromNote);
      if (saveRes && !saveRes.success && saveRes.error) {
        console.warn('Gagal menyimpan pesanan ke server, simpan di memori lokal:', saveRes.error);
      }
    } catch (err) {
      console.warn('Gagal membuat transaksi di database:', err);
    }

    // Langkah 2: Tambahkan ke state transaksi / pesanan lokal
    setOrders((prev) => [newOrderFromNote, ...prev]);

    // Langkah 3: Soft completion - tandai status follow up menjadi 'completed' (BUKAN delete)
    setNotes((prev) =>
      prev.map((n) =>
        n.id === data.noteId
          ? {
              ...n,
              isDone: true,
              status: 'completed',
              orderId: newOrderFromNote.id,
              namaBarang: data.namaBarang,
              qty: data.qty,
              satuan: data.satuan,
              toko: data.toko,
              pemasok: data.pemasok,
              tujuanDapur: data.tujuanDapur,
            }
          : n
      )
    );

    // Langkah 4: Update status follow up di database Supabase secara soft completion
    if (targetNote) {
      try {
        await updateNoteInDb(targetNote.id, {
          isDone: true,
          status: 'completed',
          orderId: newOrderFromNote.id,
          namaBarang: data.namaBarang,
          qty: data.qty,
          satuan: data.satuan,
          toko: data.toko,
          pemasok: data.pemasok,
          tujuanDapur: data.tujuanDapur,
        });
      } catch (err) {
        console.warn('Gagal memperbarui status follow up di Supabase:', err);
      }
    }

    showToast(
      `✓ Follow Up Berhasil: "${data.namaBarang}" (${data.qty} ${data.satuan}) telah masuk ke Transaksi Pesanan!`,
      'success'
    );
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

  const handleSaveNote = useCallback(async (noteData: Omit<NoteItem, 'id' | 'createdAt'>) => {
    const newNote: NoteItem = {
      ...noteData,
      id: `note-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    setNotes((prev) => [newNote, ...prev]);
    showToast('Item follow up berhasil disimpan', 'success');

    await saveNoteToDb(newNote);
  }, [setNotes, showToast]);

  return {
    followUpNoteTarget,
    setFollowUpNoteTarget,
    isFollowUpModalOpen,
    setIsFollowUpModalOpen,
    handleOpenFollowUpNote,
    handleCompleteFollowUpNote,
    handleToggleNoteStatus,
    handleDeleteNote,
    handleSaveNote,
  };
}
