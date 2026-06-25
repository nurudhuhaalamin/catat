import { useLiveQuery } from "dexie-react-hooks";
import { formatMoney } from "@catat/shared";
import { db } from "../lib/db";
import { useBusiness } from "../lib/businessContext";

function startOfMonth(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export default function DashboardPage() {
  const { current } = useBusiness();
  const businessId = current?.id ?? "";
  const currency = current?.currency ?? "IDR";

  const stats = useLiveQuery(async () => {
    if (!businessId) return null;
    const txs = (await db.transactions.where("businessId").equals(businessId).toArray()).filter((t) => !t.deletedAt);
    const debts = (await db.debts.where("businessId").equals(businessId).toArray()).filter((d) => !d.deletedAt);
    const monthStart = startOfMonth();

    let income = 0,
      expense = 0,
      monthIncome = 0,
      monthExpense = 0;
    for (const t of txs) {
      if (t.type === "income") {
        income += t.amountCents;
        if (t.occurredAt >= monthStart) monthIncome += t.amountCents;
      } else {
        expense += t.amountCents;
        if (t.occurredAt >= monthStart) monthExpense += t.amountCents;
      }
    }
    let receivable = 0,
      payable = 0;
    for (const d of debts) {
      if (d.status === "paid") continue;
      const remain = d.amountCents - d.paidCents;
      if (d.direction === "receivable") receivable += remain;
      else payable += remain;
    }
    return { balance: income - expense, monthIncome, monthExpense, receivable, payable };
  }, [businessId]);

  if (!stats) return <p className="text-slate-400">Memuat…</p>;

  return (
    <div className="space-y-4">
      <div className="card bg-brand text-white">
        <p className="text-sm text-white/80">Saldo kas (akumulasi)</p>
        <p className="mt-1 text-3xl font-bold">{formatMoney(stats.balance, currency)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Masuk bulan ini" value={formatMoney(stats.monthIncome, currency)} tone="text-emerald-600" />
        <Stat label="Keluar bulan ini" value={formatMoney(stats.monthExpense, currency)} tone="text-red-600" />
        <Stat label="Piutang" value={formatMoney(stats.receivable, currency)} tone="text-amber-600" />
        <Stat label="Hutang" value={formatMoney(stats.payable, currency)} tone="text-purple-600" />
      </div>

      <p className="pt-2 text-center text-xs text-slate-400">
        Data tersimpan di perangkat & tersinkron otomatis saat online.
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="card">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone}`}>{value}</p>
    </div>
  );
}
