import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { formatMoney } from "@catat/shared";
import { db } from "../lib/db";
import { accountBalances } from "../lib/finance";
import { useBusiness } from "../lib/businessContext";

function startOfMonth(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export default function DashboardPage() {
  const { current } = useBusiness();
  const navigate = useNavigate();
  const businessId = current?.id ?? "";
  const currency = current?.currency ?? "IDR";

  const stats = useLiveQuery(async () => {
    if (!businessId) return null;
    const [accounts, txs, debts, payments] = await Promise.all([
      db.accounts.where("businessId").equals(businessId).toArray(),
      db.transactions.where("businessId").equals(businessId).toArray(),
      db.debts.where("businessId").equals(businessId).toArray(),
      db.debtPayments.where("businessId").equals(businessId).toArray(),
    ]);
    const liveTx = txs.filter((t) => !t.deletedAt);
    const monthStart = startOfMonth();
    let monthIncome = 0,
      monthExpense = 0;
    for (const t of liveTx) {
      if (t.occurredAt < monthStart) continue;
      if (t.type === "income") monthIncome += t.amountCents;
      else if (t.type === "expense") monthExpense += t.amountCents;
    }

    const bal = accountBalances(accounts, txs, debts, payments);
    const liveAccounts = accounts.filter((a) => !a.deletedAt && !a.isArchived);
    const cashTotal = liveAccounts.reduce((s, a) => s + (bal.get(a.id) ?? 0), 0);

    let receivable = 0,
      payable = 0;
    for (const d of debts) {
      if (d.deletedAt || d.status === "paid") continue;
      const remain = d.amountCents - d.paidCents;
      if (d.direction === "receivable") receivable += remain;
      else payable += remain;
    }
    return {
      cashTotal,
      accounts: liveAccounts.map((a) => ({ id: a.id, name: a.name, balance: bal.get(a.id) ?? 0 })),
      monthIncome,
      monthExpense,
      receivable,
      payable,
    };
  }, [businessId]);

  if (!stats) return <p className="text-slate-400">Memuat…</p>;

  const monthStart = startOfMonth();
  const now = Date.now();

  return (
    <div className="space-y-4">
      <div className="card bg-brand text-white">
        <p className="text-sm text-white/80">Total saldo Kas & Bank</p>
        <p className="mt-1 text-3xl font-bold">{formatMoney(stats.cashTotal, currency)}</p>
        {stats.accounts.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-white/20 pt-2 text-sm">
            {stats.accounts.map((a) => (
              <button
                key={a.id}
                className="flex w-full justify-between text-white/90 active:opacity-70"
                onClick={() => navigate(`/transactions?account=${a.id}`)}
              >
                <span>{a.name}</span>
                <span>{formatMoney(a.balance, currency)} ›</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Masuk bulan ini" value={formatMoney(stats.monthIncome, currency)} tone="text-emerald-600" onClick={() => navigate(`/transactions?type=income&from=${monthStart}&to=${now}`)} />
        <Stat label="Keluar bulan ini" value={formatMoney(stats.monthExpense, currency)} tone="text-red-600" onClick={() => navigate(`/transactions?type=expense&from=${monthStart}&to=${now}`)} />
        <Stat label="Piutang" value={formatMoney(stats.receivable, currency)} tone="text-amber-600" onClick={() => navigate(`/debts?dir=receivable`)} />
        <Stat label="Hutang" value={formatMoney(stats.payable, currency)} tone="text-purple-600" onClick={() => navigate(`/debts?dir=payable`)} />
      </div>
    </div>
  );
}

function Stat({ label, value, tone, onClick }: { label: string; value: string; tone: string; onClick?: () => void }) {
  return (
    <button className="card text-left active:bg-slate-50" onClick={onClick}>
      <p className="text-xs text-slate-500">{label} ›</p>
      <p className={`mt-1 text-lg font-bold ${tone}`}>{value}</p>
    </button>
  );
}
