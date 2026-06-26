import { useEffect, useState } from "react";
import { Outlet, NavLink, Navigate, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  HandCoins,
  BarChart3,
  Landmark,
  Tags,
  Users,
  Settings,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useBusiness } from "../lib/businessContext";
import { useTheme } from "../lib/theme";
import { startAutoSync } from "../lib/sync";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  primary?: boolean; // tampil di bottom-nav mobile
}

const NAV: NavItem[] = [
  { to: "/", label: "Beranda", icon: LayoutDashboard, end: true, primary: true },
  { to: "/transactions", label: "Transaksi", icon: Wallet, primary: true },
  { to: "/debts", label: "Piutang & Hutang", icon: HandCoins, primary: true },
  { to: "/reports", label: "Laporan", icon: BarChart3, primary: true },
  { to: "/accounts", label: "Akun Kas & Bank", icon: Landmark },
  { to: "/categories", label: "Kategori", icon: Tags },
  { to: "/team", label: "Tim", icon: Users },
  { to: "/settings", label: "Lainnya", icon: Settings, primary: true },
];

export default function AppLayout() {
  const { businesses, current, loading } = useBusiness();
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

  if (loading) return <div className="flex min-h-full items-center justify-center muted">Memuat…</div>;
  if (businesses.length === 0 || !current) return <Navigate to="/onboarding" replace />;

  return (
    <div className="min-h-full md:flex">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4 dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 font-bold text-white">C</div>
          <span className="text-lg font-bold">Catat</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              <n.icon size={18} />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-full flex-1 flex-col">
        <Topbar online={online} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-slate-200 bg-white/95 px-1 py-1.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:hidden">
        {NAV.filter((n) => n.primary).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-[11px] ${
                isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-400"
              }`
            }
          >
            <n.icon size={20} />
            <span className="truncate">{n.label === "Piutang & Hutang" ? "Piutang" : n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function Topbar({ online }: { online: boolean }) {
  const { businesses, current, canCreateBusiness, setCurrentId } = useBusiness();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 md:px-8">
      <div className="flex items-center gap-2 md:hidden">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">C</div>
      </div>
      <select
        className="min-w-0 max-w-[55%] truncate rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-brand-300"
        value={current?.id ?? ""}
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
        {canCreateBusiness && <option value="__new__">+ Tambah lini usaha…</option>}
      </select>

      <div className="ml-auto flex items-center gap-2">
        <span
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            online
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          }`}
          title={online ? "Tersinkron saat online" : "Mode offline — tersimpan di perangkat"}
        >
          {online ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span className="hidden sm:inline">{online ? "Online" : "Offline"}</span>
        </span>
        <button
          onClick={toggle}
          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          title={isDark ? "Mode terang" : "Mode gelap"}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
