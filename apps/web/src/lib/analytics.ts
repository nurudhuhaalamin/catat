import type { LCategory, LTransaction } from "./db";

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export interface MonthPoint {
  key: string;
  label: string;
  income: number; // cents
  expense: number; // cents
  net: number; // cents
}

// Deret per bulan untuk N bulan terakhir (termasuk bulan ini).
export function monthlySeries(txs: LTransaction[], months = 6): MonthPoint[] {
  const now = new Date();
  const points: MonthPoint[] = [];
  const index = new Map<string, MonthPoint>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const p: MonthPoint = { key, label: MONTHS_ID[d.getMonth()], income: 0, expense: 0, net: 0 };
    points.push(p);
    index.set(key, p);
  }
  for (const t of txs) {
    if (t.deletedAt || t.type === "transfer") continue;
    const d = new Date(t.occurredAt);
    const p = index.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (!p) continue;
    if (t.type === "income") p.income += t.amountCents;
    else p.expense += t.amountCents;
  }
  for (const p of points) p.net = p.income - p.expense;
  return points;
}

export interface CatSlice {
  name: string;
  value: number; // cents
}

// Pengeluaran per kategori dalam rentang.
export function expenseByCategory(txs: LTransaction[], categories: LCategory[], from: number, to: number): CatSlice[] {
  const name = new Map(categories.map((c) => [c.id, c.name]));
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.deletedAt || t.type !== "expense") continue;
    if (t.occurredAt < from || t.occurredAt > to) continue;
    const k = t.categoryId ? name.get(t.categoryId) ?? "Tanpa kategori" : "Tanpa kategori";
    map.set(k, (map.get(k) ?? 0) + t.amountCents);
  }
  return [...map.entries()].map(([n, value]) => ({ name: n, value })).sort((a, b) => b.value - a.value);
}
