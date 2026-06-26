import { lazy, Suspense, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { Landmark, ArrowDownCircle, ArrowUpCircle, TrendingUp, HandCoins, CreditCard, type LucideIcon } from "lucide-react";
import { formatMoney } from "@catat/shared";
import { db } from "../lib/db";
import { accountBalances } from "../lib/finance";
import { monthlySeries, expenseByCategory } from "../lib/analytics";
import { presetRange, type RangePreset } from "../lib/dateRange";
import { useBusiness } from "../lib/businessContext";

const AnalyticsCharts = lazy(() => import("../components/charts"));

export default function DashboardPage() {
  const { current } = useBusiness();
  const navigate = useNavigate();
  const businessId = current?.id ?? "";
  const currency = current?.currency ?? "IDR";
  const [preset, setPreset] = useState<Exclude<RangePreset, "custom">>("this_month");
  const range = useMemo(() => presetRange(preset), [preset]);

  const data = useLiveQuery(async () => {
    if (!businessId) return null;
    const [accounts, txs, debts, payments, categories] = await Promise.all([
      db.accounts.where("businessId").equals(businessId).toArray(),
      db.transactions.where("businessId").equals(businessId).toArray(),
      db.debts.where("businessId").equals(businessId).toArray(),
      db.debtPayments.where("businessId").equals(businessId).toArray(),
      db.categories.where("businessId").equals(businessId).toArray(),
    ]);
    const liveTx = txs.filter((t) => !t.deletedAt);

    let income = 0;
    let expense = 0;
    for (const t of liveTx) {
      if (t.occurredAt < range.from || t.occurredAt > range.to) continue;
      if (t.type === "income") income += t.amountCents;
      else if (t.type === "expense") expense += t.amountCents;
    }

    const bal = accountBalances(accounts, txs, debts, payments);
    const cashTotal = accounts.filter((a) => !a.deletedAt && !a.isArchived).reduce((s, a) => s + (bal.get(a.id) ?? 0), 0);

    let receivable = 0;
    let payable = 0;
    for (const d of debts) {
      if (d.deletedAt || d.status === "paid") continue;
      const remain = d.amountCents - d.paidCents;
      if (d.direction === "receivable") receivable += remain;
      else payable += remain;
    }

    const accountName = new Map(accounts.map((a) => [a.id, a.name]));
    const recent = liveTx.slice().sort((a, b) => b.occurredAt - a.occurredAt).slice(0, 6);

    return {
      cashTotal,
      income,
      expense,
      receivable,
      payable,
      series: monthlySeries(liveTx, 6),
      expenseSlices: expenseByCategory(liveTx, categories, range.from, range.to),
      recent,
      accountName,
    };
  }, [businessId, range.from, range.to]);

  if (!data) return <DashSkeleton />;

  const q = `from=${range.from}&to=${range.to}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Beranda</h1>
        <div className="flex gap-1.5">
          {(["this_month", "last_month", "this_year"] as const).map((p) => (
            <button key={p} className={preset === p ? "chip-on" : "chip-off"} onClick={() => setPreset(p)}>
              {p === "this_month" ? "Bulan ini" : p === "last_month" ? "Bulan lalu" : "Tahun ini"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi icon={Landmark} label="Total Saldo" value={formatMoney(data.cashTotal, currency)} tone="text-slate-900 dark:text-white" onClick={() => navigate("/transactions")} />
        <Kpi icon={ArrowDownCircle} label="Pemasukan" value={formatMoney(data.income, currency)} tone="text-emerald-600" onClick={() => navigate(`/transactions?type=income&${q}`)} />
        <Kpi icon={ArrowUpCircle} label="Pengeluaran" value={formatMoney(data.expense, currency)} tone="text-red-600" onClick={() => navigate(`/transactions?type=expense&${q}`)} />
        <Kpi icon={TrendingUp} label="Laba Bersih" value={formatMoney(data.income - data.expense, currency)} tone={data.income - data.expense >= 0 ? "text-emerald-600" : "text-red-600"} onClick={() => navigate(`/transactions?${q}`)} />
        <Kpi icon={HandCoins} label="Piutang" value={formatMoney(data.receivable, currency)} tone="text-amber-600" onClick={() => navigate("/debts?dir=receivable")} />
        <Kpi icon={CreditCard} label="Hutang" value={formatMoney(data.payable, currency)} tone="text-purple-600" onClick={() => navigate("/debts?dir=payable")} />
      </div>

      {/* Charts */}
      <Suspense fallback={<div className="grid h-64 place-items-center rounded-2xl border border-dashed border-slate-300 muted dark:border-slate-700">Memuat grafik…</div>}>
        <AnalyticsCharts currency={currency} series={data.series} expenseSlices={data.expenseSlices} />
      </Suspense>

      {/* Recent */}
      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="section-title text-sm">Transaksi Terbaru</h3>
          <button className="text-sm font-medium text-brand-600 dark:text-brand-400" onClick={() => navigate("/transactions")}>
            Lihat semua
          </button>
        </div>
        {data.recent.length === 0 ? (
          <p className="py-6 text-center muted text-sm">Belum ada transaksi.</p>
        ) : (
          <ul>
            {data.recent.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 divide-row">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {t.note || (t.type === "income" ? "Pemasukan" : t.type === "expense" ? "Pengeluaran" : "Transfer")}
                  </p>
                  <p className="text-xs muted">
                    {new Date(t.occurredAt).toLocaleDateString("id-ID")} · {data.accountName.get(t.accountId ?? "") ?? "—"}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${t.type === "income" ? "text-emerald-600" : t.type === "expense" ? "text-red-600" : "muted"}`}>
                  {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}
                  {formatMoney(t.amountCents, currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone, onClick }: { icon: LucideIcon; label: string; value: string; tone: string; onClick?: () => void }) {
  return (
    <button className="kpi" onClick={onClick}>
      <span className="flex items-center gap-1.5 text-xs muted">
        <Icon size={15} /> {label}
      </span>
      <span className={`text-lg font-bold ${tone}`}>{value}</span>
    </button>
  );
}

function DashSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}
