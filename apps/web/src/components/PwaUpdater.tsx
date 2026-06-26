import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw } from "lucide-react";

// Notifikasi "versi baru tersedia" + tombol muat ulang.
export default function PwaUpdater() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Cek pembaruan tiap 60 menit selama app terbuka.
      if (registration) setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-24 md:pb-6">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card dark:border-slate-700 dark:bg-slate-800">
        <RefreshCw size={18} className="shrink-0 text-brand-600" />
        <div className="flex-1 text-sm">
          <p className="font-semibold">Versi baru tersedia</p>
          <p className="muted text-xs">Muat ulang untuk memakai pembaruan terbaru.</p>
        </div>
        <button className="rounded-lg px-3 py-1.5 text-sm muted" onClick={() => setNeedRefresh(false)}>
          Nanti
        </button>
        <button className="btn-primary px-3 py-1.5 text-sm" onClick={() => updateServiceWorker(true)}>
          Muat ulang
        </button>
      </div>
    </div>
  );
}
