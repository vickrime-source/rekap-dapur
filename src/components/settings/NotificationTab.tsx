import React, { useState } from 'react';
import { 
  Bell, 
  CheckCircle2, 
  Receipt, 
  Clock, 
  FileText, 
  Sparkles 
} from 'lucide-react';
import {
  getNotificationSettings,
  saveNotificationSettings,
  getNotificationPermissionStatus,
  requestNotificationPermission,
  sendTestNotification,
  NotificationSettings,
} from '../../lib/notificationManager';

export const NotificationTab: React.FC = () => {
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(getNotificationSettings());
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(getNotificationPermissionStatus());
  const [testNotificationSent, setTestNotificationSent] = useState<boolean>(false);

  const handleUpdateNotificationSetting = <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    const updated = { ...notificationSettings, [key]: value };
    setNotificationSettings(updated);
    saveNotificationSettings(updated);
  };

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setPermissionStatus(res);
    if (res === 'granted') {
      handleUpdateNotificationSetting('enabled', true);
    }
  };

  const handleSendTestNotification = async () => {
    setTestNotificationSent(false);
    const success = await sendTestNotification();
    if (success) {
      setTestNotificationSent(true);
      setTimeout(() => setTestNotificationSent(false), 3000);
    } else {
      const res = await requestNotificationPermission();
      setPermissionStatus(res);
      if (res === 'granted') {
        await sendTestNotification();
        setTestNotificationSent(true);
        setTimeout(() => setTestNotificationSent(false), 3000);
      }
    }
  };

  return (
    <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
      {/* 1. Permission Status Card */}
      <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 dark:bg-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-slate-100 uppercase text-[11px] tracking-wider">
                Status Izin Notifikasi HP
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Web &amp; Mobile Push Notifications (PWA)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {permissionStatus === 'granted' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                Diizinkan (Aktif)
              </span>
            ) : (
              <button
                type="button"
                onClick={handleRequestPermission}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-extrabold rounded-xl text-[11px] transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <Bell className="w-3 h-3" />
                <span>Minta Izin HP</span>
              </button>
            )}
          </div>
        </div>

        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
          {permissionStatus === 'granted'
            ? '✓ Browser dan HP Anda telah mengizinkan notifikasi. Pengingat laporan dan catatan akan muncul otomatis di status bar / layar kunci HP.'
            : '⚠️ Klik "Minta Izin HP" lalu pilih "Izinkan" (Allow) pada pop-up browser agar notifikasi laporan harian dan catatan dapat muncul di layar HP Anda.'}
        </p>
      </div>

      {/* 2. Pengaturan Sakelar Notifikasi */}
      <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <div>
            <span className="font-black text-slate-900 dark:text-slate-100 text-xs block">
              Aktifkan Seluruh Notifikasi HP
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              Sakelar utama untuk mengaktifkan atau menonaktifkan semua notifikasi
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={notificationSettings.enabled}
              onChange={(e) => handleUpdateNotificationSetting('enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {/* Feature 1: Pengingat Laporan Harian */}
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="space-y-1">
            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Pengingat Laporan Harian (Daily Report)
            </span>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
              Kirimkan rangkuman total pesanan, omset, dan laba bersih hari ini secara otomatis ke HP.
            </p>
            
            {notificationSettings.dailyReportReminder && (
              <div className="flex items-center gap-2 pt-1">
                <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Jam Notifikasi:</span>
                <input
                  type="time"
                  value={notificationSettings.dailyReminderTime || '20:00'}
                  onChange={(e) => handleUpdateNotificationSetting('dailyReminderTime', e.target.value)}
                  className="px-2 py-0.5 text-[11px] font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">WIB</span>
              </div>
            )}
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
            <input
              type="checkbox"
              disabled={!notificationSettings.enabled}
              checked={notificationSettings.dailyReportReminder}
              onChange={(e) => handleUpdateNotificationSetting('dailyReportReminder', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-40"></div>
          </label>
        </div>

        {/* Feature 2: Pengingat Catatan / Notes Belum Selesai */}
        <div className="flex items-start justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
          <div className="space-y-0.5">
            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              Pengingat Catatan / Notes Follow Up
            </span>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
              Kirim notifikasi pengingat jika masih ada catatan follow up dapur yang berstatus pending.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
            <input
              type="checkbox"
              disabled={!notificationSettings.enabled}
              checked={notificationSettings.pendingNotesReminder}
              onChange={(e) => handleUpdateNotificationSetting('pendingNotesReminder', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-40"></div>
          </label>
        </div>

        {/* Feature 3: Notifikasi Pesanan Masuk */}
        <div className="flex items-start justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
          <div className="space-y-0.5">
            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Notifikasi Pesanan Masuk (Real-time Alert)
            </span>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
              Tampilkan notifikasi pop-up seketika saat pesanan baru berhasil dicatat lewat suara / tombol.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
            <input
              type="checkbox"
              disabled={!notificationSettings.enabled}
              checked={notificationSettings.newOrderAlert}
              onChange={(e) => handleUpdateNotificationSetting('newOrderAlert', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-40"></div>
          </label>
        </div>
      </div>

      {/* 3. Test Notification Action */}
      <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <span className="font-black text-xs text-indigo-950 dark:text-indigo-200 block">
            Tes Notifikasi Langsung di HP Anda
          </span>
          <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-medium">
            Kirim pesan uji coba sekarang untuk memastikan notifikasi muncul di bar HP.
          </span>
        </div>

        <button
          type="button"
          onClick={handleSendTestNotification}
          className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <Bell className="w-3.5 h-3.5" />
          <span>{testNotificationSent ? 'Terkirim ✓' : 'Kirim Tes Notifikasi'}</span>
        </button>
      </div>
    </div>
  );
};
