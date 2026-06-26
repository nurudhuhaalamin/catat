import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Landmark, Tags, Contact, Users, Plus, RefreshCw, Trash2, LogOut, Sun, Moon, Monitor, ChevronRight, type LucideIcon } from "lucide-react";
import { signOut, useSession } from "../lib/auth";
import { api } from "../lib/api";
import { useBusiness } from "../lib/businessContext";
import { syncNow } from "../lib/sync";
import { useTheme, type Theme } from "../lib/theme";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { current, businesses, canCreateBusiness, refresh, setCurrentId } = useBusiness();
  const { theme, setTheme } = useTheme();
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

  const themes: { v: Theme; label: string; icon: LucideIcon }[] = [
    { v: "light", label: "Terang", icon: Sun },
    { v: "dark", label: "Gelap", icon: Moon },
    { v: "system", label: "Sistem", icon: Monitor },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Lainnya</h1>

      <div className="card">
        <p className="font-semibold">{session?.user.name}</p>
        <p className="text-sm muted">{session?.user.email}</p>
        {current && <p className="mt-1 text-xs muted">Peran Anda di {current.name}: {current.role}</p>}
      </div>

      {/* Tema */}
      <div className="card">
        <p className="mb-2 text-sm font-semibold">Tampilan</p>
        <div className="grid grid-cols-3 gap-2">
          {themes.map((t) => (
            <button
              key={t.v}
              onClick={() => setTheme(t.v)}
              className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-medium transition ${
                theme === t.v
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <t.icon size={18} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="surface divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
        <Item icon={Landmark} label="Akun Kas & Bank" onClick={() => navigate("/accounts")} />
        <Item icon={Tags} label="Kategori" onClick={() => navigate("/categories")} />
        <Item icon={Contact} label="Kontak (pelanggan & pemasok)" onClick={() => navigate("/contacts")} />
        <Item icon={Users} label="Kelola tim" onClick={() => navigate("/team")} />
        {canCreateBusiness && <Item icon={Plus} label="Tambah lini usaha" onClick={() => navigate("/onboarding")} />}
        <Item icon={RefreshCw} label="Sinkronkan sekarang" onClick={manualSync} />
      </div>
      {syncMsg && <p className="px-1 text-sm muted">{syncMsg}</p>}

      {isOwner && (
        <button className="btn-ghost w-full justify-start text-red-600" onClick={deleteBusiness}>
          <Trash2 size={16} /> Hapus lini usaha ini
        </button>
      )}

      <button
        className="btn-ghost w-full justify-center text-red-600"
        onClick={async () => {
          await signOut();
          window.location.href = "/login";
        }}
      >
        <LogOut size={16} /> Keluar
      </button>
    </div>
  );
}

function Item({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
      onClick={onClick}
    >
      <Icon size={18} className="text-slate-400" />
      <span className="flex-1">{label}</span>
      <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
    </button>
  );
}
