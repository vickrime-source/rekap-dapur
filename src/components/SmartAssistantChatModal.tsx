import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bot, FileText, Send, Sparkles, Trash2, Upload, User, X } from 'lucide-react';
import { OrderItem, Kitchen, NoteItem, Store as StoreType } from '../types';
import { parseVoiceAssistantSmart } from '../lib/voiceParser';
import { formatRupiah, getTodayWIB } from '../lib/formatters';

interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
}

interface DraftOrderFields {
  namaBarang?: string;
  qty?: number;
  satuan?: string;
  hargaBeli?: number;
  hargaJual?: number;
  tujuanDapur?: string;
  toko?: string;
  pemasok?: string;
  catatan?: string;
}

interface SmartAssistantChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBatch: (initialText?: string) => void;
  onOrderCreated: (order: Omit<OrderItem, 'id' | 'createdAt'>) => void;
  onNoteCreated: (note: {
    text: string;
    dapur?: string;
    namaBarang?: string;
    qty?: number;
    satuan?: string;
    pemasok?: string;
    tanggal: string;
    isDone: boolean;
  }) => void;
  kitchens: Kitchen[];
  stores: StoreType[];
  pemasokList: string[];
  notes: NoteItem[];
  selectedDate: string;
}

const fieldLabels: Record<string, string> = {
  'nama barang': 'nama barang',
  'dapur tujuan': 'dapur tujuan',
  'jumlah/qty': 'qty',
  'harga beli': 'harga beli',
  'harga jual': 'harga jual',
  pemasok: 'pemasok',
};

const CHAT_STORAGE_KEY = 'dapur_smart_assistant_chat_v1';
const welcomeMessage: ChatMessage = {
  role: 'assistant',
  text: 'Siap membantu input pesanan. Tulis bebas, misalnya: “tambahkan pesanan dapur Bu Zahrul daging beli 50 ribu jual 60 ribu”. Jika belum lengkap, saya simpan sebagai Follow Up.',
};

export const SmartAssistantChatModal: React.FC<SmartAssistantChatModalProps> = ({
  isOpen,
  onClose,
  onOpenBatch,
  onOrderCreated,
  onNoteCreated,
  kitchens,
  stores,
  pemasokList,
  notes,
  selectedDate,
}) => {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [draftOrder, setDraftOrder] = useState<DraftOrderFields | null>(null);
  const [sessionId] = useState(() => {
    try {
      const saved = window.localStorage.getItem('dapur_smart_assistant_session_v1');
      if (saved) return saved;
      const next = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem('dapur_smart_assistant_session_v1', next);
      return next;
    } catch {
      return `session-${Date.now()}`;
    }
  });
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = window.localStorage.getItem(CHAT_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [welcomeMessage];
    } catch {
      return [welcomeMessage];
    }
  });

  const kitchenNames = useMemo(() => kitchens.map((item) => item.nama), [kitchens]);
  const storeNames = useMemo(() => stores.map((item) => item.nama), [stores]);

  const suggestions = useMemo(() => {
    const lower = text.toLowerCase();
    const match = lower.match(/(?:dapur|pemasok|supplier|toko)\s*([^\s]*)$/i);
    if (!match) return [];
    const query = match[1] || '';
    const keyword = match[0].match(/^(dapur|pemasok|supplier|toko)/i)?.[1]?.toLowerCase() || '';
    const pool = keyword === 'dapur'
      ? kitchenNames
      : keyword === 'toko'
        ? storeNames
        : pemasokList;
    return pool.filter((value) => value.toLowerCase().includes(query)).slice(0, 6);
  }, [text, kitchenNames, storeNames, pemasokList]);

  const appendMessage = (message: ChatMessage) => {
    setMessages((previous) => [...previous, message]);
    void fetch('/api/assistant-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, role: message.role, content: message.text }),
    }).catch(() => {
      // Local history remains available when the SQL table/API is not configured.
    });
  };

  useEffect(() => {
    void fetch(`/api/assistant-chat?sessionId=${encodeURIComponent(sessionId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (Array.isArray(json?.data) && json.data.length > 0) {
          setMessages(json.data.map((item: any) => ({ role: item.role, text: item.content })));
        }
      })
      .catch(() => {
        // Local storage is the offline fallback.
      });
  }, [sessionId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-100)));
    } catch {
      // Riwayat lokal tidak boleh mengganggu input pesanan.
    }
  }, [messages]);

  // Semua Hook harus dipanggil sebelum guard render agar jumlah Hook tetap
  // sama ketika modal dibuka atau ditutup.
  if (!isOpen) return null;

  const clearChat = () => {
    setMessages([welcomeMessage]);
    setDraftOrder(null);
    try {
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
      void fetch(`/api/assistant-chat?sessionId=${encodeURIComponent(sessionId)}`, { method: 'DELETE' }).catch(() => undefined);
    } catch {
      // ignore storage errors
    }
  };

  const applySuggestion = (value: string) => {
    const nextText = text.replace(/(dapur|pemasok|supplier|toko)\s*[^\s]*$/i, (match) => {
      const keyword = match.match(/^(dapur|pemasok|supplier|toko)/i)?.[1] || '';
      return `${keyword} ${value}`;
    });
    setText(nextText.trim());
  };

  const answerFollowUpQuestion = (input: string) => {
    const lower = normalize(input);
    const isQuestion = /(follow\s*-?\s*up|catatan).*(kurang|belum|apa saja|daftar|tampil|cek)|(?:kurang|belum).*(follow\s*-?\s*up|catatan)/i.test(lower);
    const isWriteCommand = /\b(tambah|tambahkan|pesan|beli|catat|buat|input|simpan)\b/i.test(lower);
    if (!isQuestion || isWriteCommand) return false;

    const activeNotes = notes.filter((note) => !note.isDone);
    if (activeNotes.length === 0) {
      appendMessage({ role: 'assistant', text: 'Saat ini tidak ada Follow Up yang masih aktif.' });
      return true;
    }

    const summary = activeNotes.map((note, index) => {
      const item = note.namaBarang || note.catatan || 'Pesanan tanpa nama barang';
      const details = [
        note.qty ? `${note.qty} ${note.satuan || ''}`.trim() : '',
        note.pemasok ? `pemasok: ${note.pemasok}` : '',
        note.tujuanDapur ? `dapur: ${note.tujuanDapur}` : '',
      ].filter(Boolean).join(', ');
      const missing = note.catatan.match(/Belum lengkap:\s*(.+)$/i)?.[1];
      return `${index + 1}. ${item}${details ? ` (${details})` : ''}${missing ? ` — masih kurang: ${missing}` : ''}`;
    }).join('\n');

    appendMessage({ role: 'assistant', text: `Follow Up aktif yang belum selesai:\n${summary}` });
    return true;
  };

  const rejectUnclearQuestion = (input: string) => {
    const isQuestion = /\?|\b(apa|apakah|bagaimana|kenapa|mengapa|berapa|siapa|mana|kapan|tanya|jelaskan|status|cek|lihat|tampilkan)\b/i.test(input.trim());
    const isWriteCommand = /\b(tambah|tambahkan|pesan|beli|catat|buat|input|simpan)\b/i.test(input);
    if (!isQuestion || isWriteCommand) return false;

    appendMessage({
      role: 'assistant',
      text: 'Saya belum mengubah data karena ini terbaca sebagai pertanyaan. Kalau ingin menambah pesanan, gunakan kata “tambahkan”, “pesan”, “beli”, atau “catat”.',
    });
    return true;
  };

  const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const findKnownValue = (input: string, values: string[]) => {
    const normalizedInput = normalize(input);
    const exact = values.find((value) => normalizedInput.includes(normalize(value)));
    if (exact) return exact;

    const candidates = values.filter((value) => {
      const firstWord = normalize(value).split(/\s+/)[0];
      return firstWord.length >= 3 && new RegExp(`\\b(?:dapur|pemasok|supplier|toko)?\\s*${firstWord}\\b`, 'i').test(normalizedInput);
    });
    return candidates.length === 1 ? candidates[0] : '';
  };

  const mergeParsedFields = (input: string, parsed: any, localParsed: any, previousDraft: DraftOrderFields | null): DraftOrderFields => {
    const merged: DraftOrderFields = { ...(previousDraft || {}) };
    const mergedValues = merged as Record<string, unknown>;
    const knownKitchen = findKnownValue(input, kitchenNames);
    const knownSupplier = findKnownValue(input, pemasokList);
    const knownStore = findKnownValue(input, storeNames);
    const isSupplierSelection = Boolean(previousDraft && knownSupplier && !/(dapur|qty|jumlah|kg|kilo|beli|jual|harga|barang|item|pesan)/i.test(input));

    if (isSupplierSelection) {
      return { ...merged, pemasok: knownSupplier };
    }

    const fields: Array<keyof DraftOrderFields> = ['namaBarang', 'qty', 'satuan', 'hargaBeli', 'hargaJual', 'tujuanDapur', 'toko', 'pemasok', 'catatan'];

    for (const field of fields) {
      const remoteValue = parsed?.[field];
      const localValue = localParsed?.[field];
      if (remoteValue !== undefined && remoteValue !== null && remoteValue !== '' && !(typeof remoteValue === 'number' && remoteValue <= 0)) {
        mergedValues[field] = remoteValue;
      } else if (localValue !== undefined && localValue !== null && localValue !== '' && !(typeof localValue === 'number' && localValue <= 0)) {
        mergedValues[field] = localValue;
      }
    }

    if (knownKitchen) merged.tujuanDapur = knownKitchen;
    if (knownSupplier) merged.pemasok = knownSupplier;
    if (knownStore) merged.toko = knownStore;
    return merged;
  };

  const saveDraft = (parsed: any, originalText: string, missingFields: string[]) => {
    const isFirstDraft = !draftOrder;
    setDraftOrder(parsed);
    const draftText = [
      `Draft pesanan: ${parsed.namaBarang || originalText}`,
      parsed.qty ? `Qty ${parsed.qty} ${parsed.satuan || ''}`.trim() : '',
      parsed.hargaBeli ? `Beli ${formatRupiah(Number(parsed.hargaBeli))}` : '',
      parsed.hargaJual ? `Jual ${formatRupiah(Number(parsed.hargaJual))}` : '',
      `Belum lengkap: ${missingFields.join(', ')}`,
    ].filter(Boolean).join(' • ');

    if (isFirstDraft) {
      onNoteCreated({
        text: draftText,
        dapur: parsed.tujuanDapur || 'Semua Dapur',
        namaBarang: parsed.namaBarang || originalText,
        qty: Number(parsed.qty) > 0 ? Number(parsed.qty) : undefined,
        satuan: parsed.satuan || undefined,
        pemasok: parsed.pemasok || undefined,
        tanggal: selectedDate || getTodayWIB(),
        isDone: false,
      });
    }

    appendMessage({
      role: 'assistant',
      text: `${isFirstDraft ? 'Draft sudah saya simpan' : 'Draft sudah saya perbarui'} ke Follow Up. Yang masih kurang: ${missingFields.join(', ')}.`,
    });
  };

  const processText = async (event: FormEvent) => {
    event.preventDefault();
    const originalText = text.trim();
    if (!originalText || isProcessing) return;

    setText('');
    appendMessage({ role: 'user', text: originalText });
    setIsProcessing(true);

    try {
      if (isBulkReportInput(originalText)) {
        appendMessage({
          role: 'assistant',
          text: 'Ini terlihat seperti laporan bulk. Saya tidak menyimpannya sebagai satu pesanan. Saya buka Import Batch untuk memecah dan menampilkan preview dulu.',
        });
        onOpenBatch(originalText);
        return;
      }

      let parsed: any = null;
      if (answerFollowUpQuestion(originalText)) return;
      if (rejectUnclearQuestion(originalText)) return;
      if (/(pemasok|supplier).*(apa saja|pilihan|daftar)|apa saja.*(pemasok|supplier)/i.test(originalText)) {
        appendMessage({
          role: 'assistant',
          text: pemasokList.length > 0
            ? `Pemasok yang tersedia: ${pemasokList.join(', ')}. Balas dengan nama pemasoknya untuk melengkapi draft.`
            : 'Belum ada daftar pemasok. Tambahkan pemasok dulu dari data master.',
        });
        return;
      }

      const localParsed = parseVoiceAssistantSmart(originalText, kitchens, stores, pemasokList);
      try {
        const response = await fetch('/api/parse-voice-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: originalText,
            kitchens: kitchenNames,
            stores: storeNames,
            pemasokList,
          }),
        });
        const json = await response.json();
        if (response.ok && json.success && json.data) parsed = json.data;
      } catch {
        // Fallback di bawah menangani mode offline.
      }

      if (!parsed) {
        parsed = localParsed;
      }

      parsed = { ...parsed, ...mergeParsedFields(originalText, parsed, localParsed, draftOrder) };

      if (parsed.intent === 'CREATE_NOTE') {
        onNoteCreated({
          text: parsed.noteText || originalText,
          dapur: parsed.noteDapur || 'Semua Dapur',
          tanggal: selectedDate || getTodayWIB(),
          isDone: false,
        });
        appendMessage({ role: 'assistant', text: 'Catatan Follow Up sudah disimpan.' });
        return;
      }

      if (parsed.intent === 'EDIT_ORDER') {
        appendMessage({
          role: 'assistant',
          text: 'Perintah edit lebih aman dilakukan dari menu edit pesanan. Saya belum mengubah data apa pun.',
        });
        return;
      }

      const missingFields: string[] = [];
      if (!String(parsed.namaBarang || '').trim()) missingFields.push(fieldLabels['nama barang']);
      if (!String(parsed.tujuanDapur || '').trim()) missingFields.push(fieldLabels['dapur tujuan']);
      if (!(Number(parsed.qty) > 0)) missingFields.push(fieldLabels['jumlah/qty']);
      if (!(Number(parsed.hargaBeli) > 0)) missingFields.push(fieldLabels['harga beli']);
      if (!(Number(parsed.hargaJual) > 0)) missingFields.push(fieldLabels['harga jual']);
      if (!String(parsed.pemasok || '').trim()) missingFields.push(fieldLabels.pemasok);

      if (missingFields.length > 0) {
        saveDraft(parsed, originalText, missingFields);
        return;
      }

      const guessedStore = parsed.toko || stores[0]?.nama || 'HTG';
      const order: Omit<OrderItem, 'id' | 'createdAt'> = {
        namaBarang: parsed.namaBarang,
        qty: Number(parsed.qty),
        satuan: parsed.satuan || 'Kg',
        hargaBeli: Number(parsed.hargaBeli),
        hargaJual: Number(parsed.hargaJual),
        tujuanDapur: parsed.tujuanDapur,
        toko: guessedStore,
        pemasok: parsed.pemasok,
        status: 'pending',
        paymentStatus: 'UNPAID',
        deliveryStatus: 'PENDING',
        tanggal: selectedDate || getTodayWIB(),
        catatan: parsed.catatan || originalText,
      };
      onOrderCreated(order);
      setDraftOrder(null);
      appendMessage({
        role: 'assistant',
        text: `Pesanan siap disimpan: ${order.namaBarang} ${order.qty} ${order.satuan} untuk ${order.tujuanDapur}.`,
      });
    } catch {
      appendMessage({ role: 'assistant', text: 'Saya belum bisa memahami perintah itu. Coba tulis nama barang, qty, dapur, harga beli, harga jual, dan pemasok.' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-3 sm:items-center sm:p-6">
      <div className="flex h-[min(720px,calc(100vh-1.5rem))] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:h-[min(720px,calc(100vh-3rem))]">
        <header className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-white dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide">Smart Assistant</h2>
              <p className="text-xs text-indigo-100">Input bebas atau siapkan draft Follow Up</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={clearChat} className="rounded-xl p-2 text-indigo-100 hover:bg-white/15 hover:text-white" aria-label="Bersihkan riwayat chat" title="Bersihkan riwayat chat">
              <Trash2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-white/15" aria-label="Tutup Smart Assistant">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950/50">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex gap-2.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-300"><Bot className="h-4 w-4" /></div>}
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs font-semibold leading-relaxed ${message.role === 'user' ? 'rounded-br-md bg-indigo-600 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'}`}>
                {message.text}
              </div>
              {message.role === 'user' && <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><User className="h-4 w-4" /></div>}
            </div>
          ))}
          {isProcessing && <div className="text-xs font-bold text-slate-400">Assistant sedang memahami input...</div>}
        </div>

        <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <button type="button" onClick={onOpenBatch} className="mb-2 inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] font-extrabold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300">
            <Upload className="h-3.5 w-3.5" /> Import Batch WhatsApp
          </button>
          <form onSubmit={processText} className="flex items-end gap-2">
            <textarea value={text} onChange={(event) => setText(event.target.value)} rows={2} placeholder="Tulis perintah pesanan..." className="min-h-11 flex-1 resize-none rounded-2xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            <button type="submit" disabled={isProcessing || !text.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Kirim pesan">
              <Send className="h-4 w-4" />
            </button>
          </form>
          {suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => applySuggestion(suggestion)} className="rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-black text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300">
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400"><FileText className="h-3 w-3" /> Data belum lengkap akan masuk Follow Up, bukan dipaksakan menjadi transaksi.</p>
        </div>
      </div>
    </div>
  );
};

function isBulkReportInput(input: string): boolean {
  const normalized = input.toLowerCase();
  const jualCount = (normalized.match(/\bjual\b/g) || []).length;
  const beliCount = (normalized.match(/\bbeli\b/g) || []).length;
  const dapurCount = (normalized.match(/\bdapur\b/g) || []).length;
  const lineCount = input.split(/\r?\n/).filter((line) => line.trim()).length;

  return input.length >= 280
    || lineCount >= 8
    || jualCount >= 2
    || beliCount >= 2
    || dapurCount >= 2;
}
