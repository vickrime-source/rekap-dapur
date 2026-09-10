import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

/**
 * Inisialisasi Supabase client browser untuk Realtime Subscriptions
 */
export async function getClientSupabase(): Promise<SupabaseClient | null> {
  if (clientInstance) return clientInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Primary: Gunakan environment variable browser Vite (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY)
      let url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
      let anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

      // Fallback: Jika belum ada di bundle client, ambil dari endpoint konfigurasi backend
      if (!url || !anonKey) {
        const res = await fetch('/api/supabase/config');
        if (res.ok) {
          const data = await res.json();
          url = url || data.url || '';
          anonKey = anonKey || data.anonKey || '';
        }
      }

      if (url && anonKey) {
        clientInstance = createClient(url, anonKey, {
          auth: { persistSession: false },
          realtime: {
            params: {
              eventsPerSecond: 10,
            },
          },
        });
        return clientInstance;
      }
      return null;
    } catch {
      return null;
    }
  })();

  return initPromise;
}

/**
 * Langganan perubahan tabel aktif (Hemat Egress: HANYA subscribe tabel yang sedang dilihat)
 * Kembalikan fungsi unsubscribe
 */
export async function subscribeToTableChanges(
  tableName: 'pesanan' | 'transaksi' | 'notes',
  onChange: (payload: any) => void
): Promise<() => void> {
  try {
    const supabase = await getClientSupabase();
    if (!supabase) return () => {};

    const channelName = `realtime_${tableName}_${Date.now()}`;
    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        (payload) => {
          onChange(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}
