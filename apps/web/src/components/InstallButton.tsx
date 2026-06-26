import { useState } from "react";
import { Download, Share, X, MoreVertical } from "lucide-react";
import { usePwaInstall } from "../lib/pwaInstall";

// Tombol "Pasang aplikasi". Selalu tampil selama belum terpasang.
// - Jika browser mendukung prompt (Android/desktop Chrome/Edge) → munculkan dialog instal.
// - Jika tidak → tampilkan panduan sesuai perangkat (iOS Safari / Android / desktop).
export default function InstallButton({ className = "", label = "Pasang aplikasi" }: { className?: string; label?: string }) {
  const { installed, canPrompt, isIOS, isAndroid, promptInstall } = usePwaInstall();
  const [showHelp, setShowHelp] = useState(false);

  if (installed) return null;

  async function onClick() {
    if (canPrompt) {
      const ok = await promptInstall();
      if (!ok) setShowHelp(true); // batal / tidak muncul → tampilkan panduan
    } else {
      setShowHelp(true);
    }
  }

  return (
    <>
      <button className={className || "btn-ghost w-full justify-center"} onClick={onClick}>
        <Download size={16} /> {label}
      </button>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowHelp(false)}>
          <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 pb-8 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Pasang ke Layar Utama</h3>
              <button onClick={() => setShowHelp(false)} className="muted">
                <X size={20} />
              </button>
            </div>

            {isIOS ? (
              <Steps
                intro="Di iPhone/iPad, pasang lewat Safari:"
                steps={[
                  <>Tap tombol <Share size={15} className="inline" /> <b>Bagikan</b> di bar Safari.</>,
                  <>Pilih <b>Tambah ke Layar Utama</b>.</>,
                  <>Tap <b>Tambah</b> — ikon Catat muncul di layar utama.</>,
                ]}
              />
            ) : isAndroid ? (
              <Steps
                intro="Di Android (pakai Chrome):"
                steps={[
                  <>Tap menu <MoreVertical size={15} className="inline" /> di kanan atas.</>,
                  <>Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke Layar utama</b>.</>,
                  <>Konfirmasi <b>Pasang</b>.</>,
                ]}
                note="Jika menu itu tidak ada, kemungkinan halaman dibuka di browser dalam-aplikasi (mis. dari WhatsApp/Instagram). Buka dulu di Chrome, lalu coba lagi."
              />
            ) : (
              <Steps
                intro="Di laptop/komputer (Chrome atau Edge):"
                steps={[
                  <>Klik ikon <b>Instal</b> (monitor dengan panah) di ujung kanan address bar, atau</>,
                  <>Menu <MoreVertical size={15} className="inline" /> → <b>Install Catat…</b></>,
                ]}
              />
            )}

            <button className="btn-primary w-full" onClick={() => setShowHelp(false)}>
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Steps({ intro, steps, note }: { intro: string; steps: React.ReactNode[]; note?: string }) {
  return (
    <>
      <p className="text-sm muted">{intro}</p>
      <ol className="space-y-2 text-sm">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {note && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{note}</p>}
    </>
  );
}
