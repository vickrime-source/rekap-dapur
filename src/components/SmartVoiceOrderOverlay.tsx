import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, X, Loader2, Square, FileText, ShoppingBag, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OrderItem, Kitchen, Store as StoreType } from '../types';
import { parseVoiceAssistantSmart, SmartVoiceResult } from '../lib/voiceParser';
import { guessStoreForItem } from '../lib/storeMatcher';
import { formatRupiah, getTodayWIB } from '../lib/formatters';

interface SmartVoiceOrderOverlayProps {
  isActive: boolean;
  onClose: () => void;
  onOrderCreated: (order: Omit<OrderItem, 'id' | 'createdAt'>) => void;
  onNoteCreated?: (note: { text: string; category: 'FOLLOW_UP' | 'URGENT' | 'CATATAN'; dapur?: string; tanggal: string; isDone: boolean }) => void;
  onEditOrderVoice?: (params: { targetBarang: string; targetDapur?: string; newQty?: number; newSatuan?: string; newHargaBeli?: number; newHargaJual?: number }) => boolean;
  kitchens: Kitchen[];
  stores: StoreType[];
  pemasokList: string[];
  selectedDate: string;
}

export const SmartVoiceOrderOverlay: React.FC<SmartVoiceOrderOverlayProps> = ({
  isActive,
  onClose,
  onOrderCreated,
  onNoteCreated,
  onEditOrderVoice,
  kitchens,
  stores,
  pemasokList,
  selectedDate,
}) => {
  const [status, setStatus] = useState<'listening' | 'processing' | 'success' | 'error'>('listening');
  const [transcript, setTranscript] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successInfo, setSuccessInfo] = useState<{ title: string; subtitle: string; iconType: 'order' | 'note' | 'edit' } | null>(null);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const isActiveRef = useRef<boolean>(isActive);
  const startTimeRef = useRef<number>(0);
  const silenceTimerRef = useRef<any>(null);

  isActiveRef.current = isActive;

  // Process text with Gemini API, fallback to local Indonesian voice parser
  const processTranscript = useCallback(async (spokenText: string) => {
    const text = spokenText.trim();
    if (!text || text.length < 2) {
      setStatus('error');
      setErrorMsg('Suara tidak terdeteksi. Coba tahan tombol dan bicara lagi.');
      setTimeout(() => {
        if (isActiveRef.current) onClose();
      }, 2000);
      return;
    }

    setStatus('processing');

    try {
      let parsedData: any = null;

      // 1. Try Gemini API via server route
      try {
        const res = await fetch('/api/parse-voice-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            kitchens: kitchens.map((k) => k.nama),
            stores: stores.map((s) => s.nama),
            pemasokList,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            parsedData = json.data;
          }
        }
      } catch (geminiErr) {
        console.warn('[SmartVoice] Gemini route unavailable, fallback to local parser:', geminiErr);
      }

      // 2. Fallback to smart Indonesian local parser if Gemini is offline/unavailable
      if (!parsedData) {
        parsedData = parseVoiceAssistantSmart(text, kitchens, stores, pemasokList);
      }

      const intent = parsedData.intent || 'CREATE_ORDER';

      // --- INTENT A: CREATE NOTE ---
      if (intent === 'CREATE_NOTE') {
        const noteText = parsedData.noteText || text;
        const noteDapur = parsedData.noteDapur || '';

        if (onNoteCreated) {
          onNoteCreated({
            text: noteText,
            category: 'FOLLOW_UP',
            dapur: noteDapur || (kitchens[0]?.nama || 'Semua Dapur'),
            tanggal: selectedDate || getTodayWIB(),
            isDone: false,
          });
        }

        setSuccessInfo({
          title: `Catatan Disimpan ✓`,
          subtitle: `"${noteText}"`,
          iconType: 'note',
        });
        setStatus('success');

        setTimeout(() => {
          if (isActiveRef.current) onClose();
        }, 2200);
        return;
      }

      // --- INTENT B: EDIT ORDER ---
      if (intent === 'EDIT_ORDER') {
        const targetBarang = parsedData.targetBarang || '';
        let edited = false;

        if (onEditOrderVoice && targetBarang) {
          edited = onEditOrderVoice({
            targetBarang,
            targetDapur: parsedData.targetDapur,
            newQty: parsedData.newQty,
            newSatuan: parsedData.newSatuan,
            newHargaBeli: parsedData.newHargaBeli,
            newHargaJual: parsedData.newHargaJual,
          });
        }

        if (edited) {
          const changeDesc = [];
          if (parsedData.newQty) changeDesc.push(`Qty: ${parsedData.newQty} ${parsedData.newSatuan || ''}`);
          if (parsedData.newHargaBeli) changeDesc.push(`Beli: ${formatRupiah(parsedData.newHargaBeli)}`);
          if (parsedData.newHargaJual) changeDesc.push(`Jual: ${formatRupiah(parsedData.newHargaJual)}`);

          setSuccessInfo({
            title: `Pesanan "${targetBarang}" Diperbarui ✓`,
            subtitle: changeDesc.join(' • ') || 'Data pesanan berhasil diubah',
            iconType: 'edit',
          });
          setStatus('success');
        } else {
          // If not found to edit, create as order or note fallback
          setSuccessInfo({
            title: `Pesanan "${targetBarang}" Dicatat ✓`,
            subtitle: text,
            iconType: 'order',
          });
          setStatus('success');
        }

        setTimeout(() => {
          if (isActiveRef.current) onClose();
        }, 2200);
        return;
      }

      // --- INTENT C: CREATE ORDER (Default) ---
      const finalKitchen =
        parsedData.tujuanDapur ||
        (kitchens.length > 0 ? kitchens[0].nama : 'Cluring');

      let finalStore = parsedData.toko;
      if (!finalStore && parsedData.namaBarang) {
        const storeNames = stores.map((s) => s.nama);
        const guessed = guessStoreForItem(parsedData.namaBarang, storeNames);
        if (guessed) finalStore = guessed;
      }
      if (!finalStore) {
        finalStore = stores.length > 0 ? stores[0].nama : 'HTG';
      }

      const finalPemasok =
        parsedData.pemasok ||
        (pemasokList.length > 0 ? pemasokList[0] : 'Ajeng fruits');

      const newOrderPayload: Omit<OrderItem, 'id' | 'createdAt'> = {
        namaBarang: parsedData.namaBarang || 'Ayam',
        qty: Number(parsedData.qty) || 1,
        satuan: parsedData.satuan || 'Kg',
        hargaBeli: Number(parsedData.hargaBeli) || 0,
        hargaJual: Number(parsedData.hargaJual) || 0,
        tujuanDapur: finalKitchen,
        toko: finalStore,
        pemasok: finalPemasok,
        status: 'pending',
        paymentStatus: 'UNPAID',
        deliveryStatus: 'PENDING',
        tanggal: selectedDate || getTodayWIB(),
        catatan: parsedData.catatan || text,
      };

      setSuccessInfo({
        title: `${newOrderPayload.namaBarang} (${newOrderPayload.qty} ${newOrderPayload.satuan}) • ${newOrderPayload.tujuanDapur}`,
        subtitle: `Beli: ${formatRupiah(newOrderPayload.hargaBeli)} • Jual: ${formatRupiah(newOrderPayload.hargaJual)}`,
        iconType: 'order',
      });
      setStatus('success');

      // Auto save order
      onOrderCreated(newOrderPayload);

      // Auto dismiss after 2.2 seconds
      setTimeout(() => {
        if (isActiveRef.current) {
          onClose();
        }
      }, 2200);
    } catch (err: any) {
      console.warn('[SmartVoice Process Error]:', err);
      setStatus('error');
      setErrorMsg(err?.message || 'Gagal memproses suara pintar');
      setTimeout(() => {
        if (isActiveRef.current) onClose();
      }, 2300);
    }
  }, [kitchens, stores, pemasokList, selectedDate, onOrderCreated, onNoteCreated, onEditOrderVoice, onClose]);

  // Stop recording and trigger AI process
  const handleStopAndProcess = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    const textToProcess = transcriptRef.current || transcript;
    processTranscript(textToProcess);
  }, [transcript, processTranscript]);

  // Start Speech Recognition when overlay becomes active
  useEffect(() => {
    if (!isActive) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      setStatus('listening');
      setTranscript('');
      setErrorMsg('');
      setSuccessInfo(null);
      transcriptRef.current = '';
      return;
    }

    startTimeRef.current = Date.now();

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setStatus('error');
      setErrorMsg('Browser ini belum mendukung Speech Recognition. Gunakan Google Chrome.');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'id-ID';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setStatus('listening');
        setTranscript('');
        transcriptRef.current = '';
      };

      recognition.onresult = (event: any) => {
        let currentText = '';
        for (let i = 0; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript;
        }
        transcriptRef.current = currentText;
        setTranscript(currentText);

        // Reset silence timer on new spoken input
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          // If silence for 2.2s after speaking something, auto process
          if (transcriptRef.current.trim().length > 3) {
            handleStopAndProcess();
          }
        }, 2200);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') return;
        console.warn('[SmartVoice Speech Error]:', event.error);
        setStatus('error');
        setErrorMsg(`Gagal mendengarkan: ${event.error}`);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e: any) {
      console.warn('[Speech init error]:', e);
      setStatus('error');
      setErrorMsg('Tidak dapat mengakses mikrofon.');
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
  }, [isActive, handleStopAndProcess]);

  // Global Hold-Release detector: when user releases their finger after holding
  useEffect(() => {
    if (!isActive) return;

    const handleGlobalPointerUp = () => {
      // If held for more than 400ms, user was holding down and just released their finger
      const holdDuration = Date.now() - startTimeRef.current;
      if (holdDuration >= 400) {
        handleStopAndProcess();
      }
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('touchend', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('touchend', handleGlobalPointerUp);
    };
  }, [isActive, handleStopAndProcess]);

  if (!isActive) return null;

  return (
    <AnimatePresence>
      <div className="fixed bottom-3 left-0 right-0 z-40 px-4 max-w-lg mx-auto no-print pointer-events-auto">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.96 }}
          transition={{ type: 'spring', damping: 26, stiffness: 380 }}
          className="bg-slate-950 text-white rounded-3xl h-[76px] sm:h-[80px] border border-indigo-500/30 shadow-[0_12px_36px_rgba(15,23,42,0.65)] px-4 sm:px-5 flex items-center justify-between relative overflow-hidden ring-1 ring-white/10"
        >
          {/* Ambient Glow Aura */}
          <div
            className={`absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-20 rounded-full blur-2xl pointer-events-none transition-colors duration-500 ${
              status === 'listening'
                ? 'bg-rose-500/25'
                : status === 'processing'
                ? 'bg-indigo-500/35'
                : status === 'success'
                ? 'bg-emerald-500/30'
                : 'bg-rose-500/20'
            }`}
          />

          {/* 1. LISTENING STATE */}
          {status === 'listening' && (
            <div className="w-full flex items-center justify-between gap-3 relative z-10">
              {/* Left: Siri/Google Assistant Equalizer Soundwaves */}
              <div className="flex items-center gap-1 shrink-0 h-9 px-1">
                {[0.3, 0.8, 1.4, 0.6, 1.1, 0.4, 0.9, 0.7].map((d, i) => (
                  <motion.span
                    key={i}
                    animate={{
                      height: ['8px', '30px', '10px'],
                    }}
                    transition={{
                      repeat: Infinity,
                      repeatType: 'reverse',
                      duration: 0.55,
                      delay: d * 0.15,
                      ease: 'easeInOut',
                    }}
                    className={`w-1 rounded-full ${
                      i % 3 === 0
                        ? 'bg-rose-500'
                        : i % 3 === 1
                        ? 'bg-indigo-400'
                        : 'bg-amber-400'
                    }`}
                  />
                ))}
              </div>

              {/* Center: Live Text Preview / Assistant Prompt */}
              <div className="flex-1 min-w-0 px-2 text-left">
                {transcript ? (
                  <p className="text-xs sm:text-[13px] font-bold text-white truncate tracking-wide animate-fade-in">
                    "{transcript}"
                  </p>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block shrink-0" />
                    <p className="text-xs font-semibold text-slate-300 truncate">
                      Mendengarkan... Sebutkan perintah suara Anda
                    </p>
                  </div>
                )}
                <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                  Contoh: "buat notes..", "ayam 10 kg", atau "edit harga ayam"
                </span>
              </div>

              {/* Right: Stop & Close Button */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleStopAndProcess}
                  className="w-9 h-9 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-md active:scale-90 transition-all cursor-pointer"
                  title="Selesai bicara"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                  title="Batal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* 2. PROCESSING STATE (Gemini / Smart Parser) */}
          {status === 'processing' && (
            <div className="w-full flex items-center justify-center gap-3 relative z-10 py-1">
              <div className="relative">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                <Sparkles className="w-3 h-3 text-amber-300 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div className="text-left min-w-0 max-w-[240px] sm:max-w-xs">
                <p className="text-xs font-black uppercase tracking-wider text-indigo-300">
                  Memproses Perintah dengan AI...
                </p>
                <p className="text-[11px] text-slate-300 truncate italic">
                  "{transcript}"
                </p>
              </div>
            </div>
          )}

          {/* 3. SUCCESS STATE (Dynamic based on intent) */}
          {status === 'success' && successInfo && (
            <div className="w-full flex items-center justify-between gap-2 relative z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                  successInfo.iconType === 'note'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : successInfo.iconType === 'edit'
                    ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                }`}>
                  {successInfo.iconType === 'note' ? (
                    <FileText className="w-4 h-4" />
                  ) : successInfo.iconType === 'edit' ? (
                    <Edit3 className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0 text-left">
                  <div className="text-xs font-black text-white truncate">
                    {successInfo.title}
                  </div>
                  <div className="text-[10px] text-slate-300 truncate">
                    {successInfo.subtitle}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 shrink-0 bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-500/30">
                Berhasil ✓
              </span>
            </div>
          )}

          {/* 4. ERROR STATE */}
          {status === 'error' && (
            <div className="w-full flex items-center justify-between gap-2 relative z-10 px-1">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <p className="text-xs font-bold text-rose-300 truncate">{errorMsg}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-white flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
