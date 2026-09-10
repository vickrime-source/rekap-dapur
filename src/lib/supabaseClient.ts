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
      const res = await fetch('/api/supabase/config');
      if (!res.ok) return null;
      const data = await res.json();

      if (data.url && data.anonKey) {
        clientInstance = createClient(data.url, data.anonKey, {
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
