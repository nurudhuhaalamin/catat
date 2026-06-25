import { useEffect, useState } from "react";
import { Outlet, NavLink, Navigate, useNavigate } from "react-router-dom";
import { useBusiness } from "../lib/businessContext";
import { startAutoSync } from "../lib/sync";

const nav = [
  { to: "/", label: "Beranda", icon: "🏠", end: true },
  { to: "/transactions", label: "Transaksi", icon: "💵" },
  { to: "/debts", label: "Piutang/Hutang", icon: "📋" },
  { to: "/contacts", label: "Kontak", icon: "👥" },
  { to: "/settings", label: "Lainnya", icon: "⚙️" },
];

export default function AppLayout() {
  const { businesses, current, loading, setCurrentId } = useBusiness();
  const navigate = useNavigate();
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    return startAutoSync(() => current.id);
  }, [current?.id]);

  if (loading) return <div className="flex min-h-full items-center justify-center text-slate-500">Memuat…</div>;
  if (businesses.length === 0) return <Navigate to="/onboarding" replace />;
  if (!current) return <Navigate to="/onboarding" replace />;

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur">
        <select
          className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-brand-dark"
          value={current.id}
          onChange={(e) => {
            if (e.target.value === "__new__") navigate("/onboarding");
            else setCurrentId(e.target.value);
          }}
        >
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
          <option value="__new__">+ Tambah lini usaha…</option>
        </select>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            online ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
          title={online ? "Tersinkron saat online" : "Mode offline — tersimpan di perangkat"}
        >
          {online ? "Online" : "Offline"}
        </span>
      </header>

      <main className="flex-1 px-4 pb-24 pt-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-2xl justify-around border-t border-slate-100 bg-white/95 px-1 py-1.5 backdrop-blur">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-[11px] ${
                isActive ? "text-brand" : "text-slate-400"
              }`
            }
          >
            <span className="text-lg">{n.icon}</span>
            <span className="truncate">{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
