import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, useSession } from "../lib/auth";
import { api } from "../lib/api";
import { useBusiness } from "../lib/businessContext";
import { syncNow } from "../lib/sync";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { current, businesses, refresh, setCurrentId } = useBusiness();
  const navigate = useNavigate();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const isOwner = current?.role === "owner";

  async function manualSync() {
    if (!current) return;
    setSyncMsg("Menyinkronkan…");
    const ok = await syncNow(current.id);
    setSyncMsg(ok ? "Tersinkron." : "Gagal/offline — akan dicoba lagi otomatis.");
  }

  async function deleteBusiness() {
    if (!current) return;
    const ok = window.confirm(`Hapus lini usaha "${current.name}"? Data tidak lagi muncul di aplikasi.`);
    if (!ok) return;
    const res = await api(`/api/businesses/${current.id}`, { method: "DELETE" });
    if (res.ok) {
      const remaining = businesses.filter((b) => b.id !== current.id);
      await refresh();
      if (remaining[0]) setCurrentId(remaining[0].id);
      navigate("/");
    } else {
      alert((await res.json().catch(() => ({}))).error ?? "Gagal menghapus");
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold">Lainnya</h2>

      <div className="card">
        <p className="font-medium">{session?.user.name}</p>
        <p className="text-sm text-slate-400">{session?.user.email}</p>
        {current && <p className="mt-1 text-xs text-slate-400">Peran Anda di {current.name}: {current.role}</p>}
      </div>

      <div className="space-y-2">
        <Item icon="🏦" label="Akun Kas & Bank" onClick={() => navigate("/accounts")} />
        <Item icon="🏷️" label="Kategori" onClick={() => navigate("/categories")} />
        <Item icon="👥" label="Kontak (pelanggan & pemasok)" onClick={() => navigate("/contacts")} />
        <Item icon="🧑‍🤝‍🧑" label="Kelola tim" onClick={() => navigate("/team")} />
        <Item icon="➕" label="Tambah lini usaha" onClick={() => navigate("/onboarding")} />
        <Item icon="🔄" label="Sinkronkan sekarang" onClick={manualSync} />
        {syncMsg && <p className="px-1 text-sm text-slate-500">{syncMsg}</p>}
      </div>

      {isOwner && (
        <button className="btn-ghost w-full justify-start text-red-600" onClick={deleteBusiness}>
          🗑️ Hapus lini usaha ini
        </button>
      )}

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

function Item({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button className="btn-ghost w-full justify-start" onClick={onClick}>
      {icon} {label}
    </button>
  );
}
