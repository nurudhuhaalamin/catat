import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, useSession } from "../lib/auth";
import { apiJson } from "../lib/api";
import { useBusiness } from "../lib/businessContext";
import { syncNow } from "../lib/sync";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { current, refresh, setCurrentId } = useBusiness();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function accept() {
    setMsg(null);
    try {
      const res = await apiJson<{ businessId: string }>("/api/businesses/invitations/accept", {
        method: "POST",
        body: { token: token.trim() },
      });
      await refresh();
      setCurrentId(res.businessId);
      setMsg("Undangan diterima. Usaha ditambahkan.");
      setToken("");
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  async function manualSync() {
    if (!current) return;
    setSyncMsg("Menyinkronkan…");
    const ok = await syncNow(current.id);
    setSyncMsg(ok ? "Tersinkron." : "Gagal/offline — akan dicoba lagi otomatis.");
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold">Lainnya</h2>

      <div className="card">
        <p className="font-medium">{session?.user.name}</p>
        <p className="text-sm text-slate-400">{session?.user.email}</p>
      </div>

      <div className="space-y-2">
        <button className="btn-ghost w-full justify-start" onClick={() => navigate("/contacts")}>
          👥 Kontak (pelanggan & pemasok)
        </button>
        <button className="btn-ghost w-full justify-start" onClick={() => navigate("/team")}>
          🧑‍🤝‍🧑 Kelola tim
        </button>
        <button className="btn-ghost w-full justify-start" onClick={() => navigate("/onboarding")}>
          ➕ Tambah lini usaha
        </button>
        <button className="btn-ghost w-full justify-start" onClick={manualSync}>
          🔄 Sinkronkan sekarang
        </button>
        {syncMsg && <p className="px-1 text-sm text-slate-500">{syncMsg}</p>}
      </div>

      <div className="card space-y-2">
        <p className="font-medium">Terima undangan</p>
        <p className="text-xs text-slate-400">Masukkan kode undangan yang Anda terima dari pemilik usaha.</p>
        <input className="input" placeholder="Kode undangan" value={token} onChange={(e) => setToken(e.target.value)} />
        <button className="btn-primary w-full" onClick={accept} disabled={!token.trim()}>
          Terima
        </button>
        {msg && <p className="text-sm text-slate-600">{msg}</p>}
      </div>

      <button
        className="btn-ghost w-full text-red-600"
        onClick={async () => {
          await signOut();
          window.location.href = "/login";
        }}
      >
        Keluar
      </button>
    </div>
  );
}
