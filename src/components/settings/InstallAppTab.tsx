import React from 'react';

export const InstallAppTab: React.FC = () => {
  return (
    <div className="space-y-6 text-center py-6 max-w-sm mx-auto font-sans">
      <div className="flex flex-col items-center space-y-3">
        <div className="w-20 h-20 rounded-3xl bg-white border border-slate-200 p-2 flex items-center justify-center shadow-xl shadow-slate-200/50">
          <img src="/icons/htg-192.png" alt="HTG Accounting" className="w-full h-full object-contain" />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-900">
            HTG Accounting
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Tambahkan ke Layar Utama HP untuk pengalaman seperti aplikasi native.
          </p>
        </div>
      </div>

      <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-left space-y-2 text-xs">
        <span className="font-black text-slate-800 block">Cara Pasang di HP (Android / iOS):</span>
        <ol className="list-decimal list-inside space-y-1 text-slate-600 font-medium text-[11px]">
          <li>Buka menu browser (titik 3 di Chrome atau tombol Bagikan di Safari).</li>
          <li>Pilih <strong>"Tambahkan ke Layar Utama" (Add to Home Screen)</strong> atau <strong>"Install Aplikasi"</strong>.</li>
          <li>Aplikasi akan langsung muncul di menu HP Anda!</li>
        </ol>
      </div>
    </div>
  );
};
