import { formatRupiah } from './formatters';

export interface NotificationSettings {
  enabled: boolean;
  dailyReportReminder: boolean;
  dailyReminderTime: string; // "HH:mm" e.g. "20:00"
  pendingNotesReminder: boolean;
  newOrderAlert: boolean;
  lastDailyNotifiedDate?: string;
}

const STORAGE_KEY = 'rekap_dapur_notification_settings';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  dailyReportReminder: true,
  dailyReminderTime: '20:00',
  pendingNotesReminder: true,
  newOrderAlert: true,
  lastDailyNotifiedDate: '',
};

export function getNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save notification settings:', err);
  }
}

export function getNotificationPermissionStatus(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return 'denied';
  }
}

export async function sendRealNotification(
  title: string,
  options: {
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: any;
    vibrate?: number[];
  } = {}
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('Web Notification API not supported');
    return false;
  }

  const settings = getNotificationSettings();
  if (!settings.enabled) {
    return false;
  }

  // If permission not granted, don't attempt to send
  if (Notification.permission !== 'granted') {
    return false;
  }

  const notificationOptions: NotificationOptions = {
    body: options.body || '',
    icon: options.icon || '/favicon.ico',
    badge: options.badge || '/favicon.ico',
    tag: options.tag || `rekap-dapur-${Date.now()}`,
    vibrate: options.vibrate || [200, 100, 200],
    requireInteraction: false,
    ...options,
  };

  try {
    // Try Service Worker registration first (standard for PWA on Android & Chrome)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(title, notificationOptions);
          return true;
        }
      } catch (swErr) {
        console.warn('Service worker notification failed, fallback to native Notification:', swErr);
      }
    }

    // Fallback to standard window.Notification constructor
    const notification = new Notification(title, notificationOptions);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch (err) {
    console.warn('Failed to display web notification:', err);
    return false;
  }
}

// Send real immediate test notification
export async function sendTestNotification(): Promise<boolean> {
  return await sendRealNotification('🔔 Notifikasi Rekap Dapur Aktif!', {
    body: 'Sistem pengingat laporan harian dan catatan notes kini siap muncul langsung di HP Anda.',
    tag: 'test-notification',
  });
}

// Send real daily recap reminder notification
export async function sendDailyReportNotification(
  totalOrders: number,
  totalOmset: number,
  totalLaba: number
): Promise<boolean> {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.dailyReportReminder) return false;

  return await sendRealNotification('⏰ Pengingat Laporan Dapur Hari Ini', {
    body: `Rekap hari ini: ${totalOrders} pesanan | Omset: ${formatRupiah(totalOmset)} | Laba: ${formatRupiah(totalLaba)}. Cek sekarang!`,
    tag: 'daily-report-reminder',
  });
}

// Send real pending notes reminder notification
export async function sendPendingNotesNotification(pendingCount: number): Promise<boolean> {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.pendingNotesReminder || pendingCount <= 0) return false;

  return await sendRealNotification('📝 Pengingat Catatan Dapur', {
    body: `Ada ${pendingCount} catatan pending / follow up yang belum diselesaikan.`,
    tag: 'pending-notes-reminder',
  });
}

// Send real new order alert
export async function sendNewOrderNotification(
  namaBarang: string,
  qty: number,
  satuan: string,
  dapur: string
): Promise<boolean> {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.newOrderAlert) return false;

  return await sendRealNotification('🛒 Pesanan Baru Masuk', {
    body: `${qty} ${satuan} ${namaBarang} untuk ${dapur} telah berhasil dicatat.`,
    tag: 'new-order-alert',
  });
}
