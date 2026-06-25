import type { LAccount, LCategory, LDebt, LDebtPayment, LTransaction } from "./db";

const active = <T extends { deletedAt?: number | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt);

/**
 * Saldo berjalan tiap akun kas/bank:
 * opening + masuk − keluar + transfer masuk − transfer keluar
 *        − piutang yang dibayar tunai saat dicatat (kas keluar)
 *        + hutang yang diterima tunai saat dicatat (kas masuk)
 *        + pelunasan piutang (kas masuk) − pelunasan hutang (kas keluar)
 */
export function accountBalances(
  accounts: LAccount[],
  txs: LTransaction[],
  debts: LDebt[],
  payments: LDebtPayment[],
): Map<string, number> {
  const bal = new Map<string, number>();
  for (const a of active(accounts)) bal.set(a.id, a.openingBalanceCents);
  const add = (id: string | null | undefined, cents: number) => {
    if (id && bal.has(id)) bal.set(id, (bal.get(id) ?? 0) + cents);
  };

  for (const t of active(txs)) {
    if (t.type === "income") add(t.accountId, t.amountCents);
    else if (t.type === "expense") add(t.accountId, -t.amountCents);
    else if (t.type === "transfer") {
      add(t.accountId, -t.amountCents);
      add(t.toAccountId, t.amountCents);
    }
  }

  const debtDir = new Map<string, LDebt["direction"]>();
  for (const d of active(debts)) {
    debtDir.set(d.id, d.direction);
    if (d.accountId) add(d.accountId, d.direction === "receivable" ? -d.amountCents : d.amountCents);
  }
  for (const p of active(payments)) {
    if (!p.accountId) continue;
    const dir = debtDir.get(p.debtId);
    if (dir === "receivable") add(p.accountId, p.amountCents);
    else if (dir === "payable") add(p.accountId, -p.amountCents);
  }
  return bal;
}

export interface BalanceSheet {
  cashByAccount: { account: LAccount; balance: number }[];
  cashTotal: number;
  receivable: number;
  payable: number;
  otherAssets: number;
  assets: number;
  liabilities: number;
  equity: number;
  profit: number; // laba berjalan (pendapatan − beban dari transaksi)
  capital: number; // modal = ekuitas − laba
}

export function balanceSheet(
  accounts: LAccount[],
  txs: LTransaction[],
  debts: LDebt[],
  payments: LDebtPayment[],
  categories: LCategory[],
): BalanceSheet {
  const balances = accountBalances(accounts, txs, debts, payments);
  const liveAccounts = active(accounts);
  const cashByAccount = liveAccounts.map((a) => ({ account: a, balance: balances.get(a.id) ?? 0 }));
  const cashTotal = cashByAccount.reduce((s, x) => s + x.balance, 0);

  let receivable = 0;
  let payable = 0;
  for (const d of active(debts)) {
    if (d.status === "paid") continue;
    const remain = d.amountCents - d.paidCents;
    if (d.direction === "receivable") receivable += remain;
    else payable += remain;
  }

  const natureOf = new Map(categories.map((c) => [c.id, c.nature]));
  let otherAssets = 0;
  let income = 0;
  let expense = 0;
  for (const t of active(txs)) {
    const nature = t.categoryId ? natureOf.get(t.categoryId) : undefined;
    if (t.type === "income" && nature !== "modal") income += t.amountCents;
    if (t.type === "expense") {
      if (nature === "aset") otherAssets += t.amountCents;
      else if (nature !== "prive") expense += t.amountCents;
    }
  }

  const assets = cashTotal + receivable + otherAssets;
  const liabilities = payable;
  const equity = assets - liabilities;
  const profit = income - expense;
  return { cashByAccount, cashTotal, receivable, payable, otherAssets, assets, liabilities, equity, profit, capital: equity - profit };
}
