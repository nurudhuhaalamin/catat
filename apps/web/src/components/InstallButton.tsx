import { useState } from "react";
import { Download, Share, X } from "lucide-react";
import { usePwaInstall } from "../lib/pwaInstall";

// Tombol "Pasang aplikasi". Android/desktop: memicu prompt instal browser.
// iOS (Safari): menampilkan instruksi (tidak ada prompt otomatis).
export default function InstallButton({ className = "", label = "Pasang aplikasi" }: { className?: string; label?: string }) {
  const { installed, canPrompt, isIOS, promptInstall } = usePwaInstall();
  const [showIos, setShowIos] = useState(false);

  if (installed) return null;
  if (!canPrompt && !isIOS) return null; // sudah terpasang / tidak didukung

  return (
    <>
      <button
        className={className || "btn-ghost w-full justify-center"}
        onClick={() => (canPrompt ? promptInstall() : setShowIos(true))}
      >
        <Download size={16} /> {label}
      </button>

      {showIos && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowIos(false)}>
          <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 pb-8 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Pasang ke Layar Utama</h3>
              <button onClick={() => setShowIos(false)} className="muted">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm muted">Di iPhone/iPad, pasang lewat Safari:</p>
            <ol className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">1</span>
                Tap tombol <Share size={15} className="inline" /> <b>Bagikan</b> di bar Safari.
              </li>
              <li className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">2</span>
                Pilih <b>Tambah ke Layar Utama</b>.
              </li>
              <li className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">3</span>
                Tap <b>Tambah</b> — ikon Catat muncul di layar utama.
              </li>
            </ol>
            <button className="btn-primary w-full" onClick={() => setShowIos(false)}>
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
