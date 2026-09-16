import { useEffect, useRef } from 'react';
import { OrderItem } from '../types';
import { 
  getNotificationSettings, 
  saveNotificationSettings, 
  sendDailyReportNotification 
} from '../lib/notificationManager';

export function useDailyNotification(orders: OrderItem[]) {
  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    const checkNotificationSchedule = () => {
      const settings = getNotificationSettings();
      if (!settings.enabled || !settings.dailyReportReminder) return;

      const now = new Date();
      // WIB Timezone UTC+7
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const wibDate = new Date(utc + 3600000 * 7);
      const hours = String(wibDate.getHours()).padStart(2, '0');
      const minutes = String(wibDate.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${hours}:${minutes}`;
      const todayStr = wibDate.toISOString().split('T')[0];

      if (
        settings.dailyReminderTime === currentTimeStr &&
        settings.lastDailyNotifiedDate !== todayStr
      ) {
        const currentOrders = ordersRef.current;
        let count = 0;
        let totalOmset = 0;
        let totalBeli = 0;
        for (let i = 0; i < currentOrders.length; i++) {
          const o = currentOrders[i];
          if (o.tanggal === todayStr) {
            count++;
            const qty = Number(o.qty || 0);
            const hb = Number(o.hargaBeli || 0);
            const hj = Number(o.hargaJual || hb || 0);
            totalOmset += qty * hj;
            totalBeli += qty * hb;
          }
        }
        const totalLaba = totalOmset - totalBeli;

        sendDailyReportNotification(count, totalOmset, totalLaba);
        saveNotificationSettings({
          ...settings,
          lastDailyNotifiedDate: todayStr,
        });
      }
    };

    const interval = setInterval(checkNotificationSchedule, 30000);
    return () => clearInterval(interval);
  }, []);
}
