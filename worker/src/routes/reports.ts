import { Hono } from "hono";
import { and, eq, gte, lte, isNull, sql } from "drizzle-orm";
import { transactions, debts } from "@catat/shared";
import type { AppContext } from "../env.js";
import { requireAuth, requireBusiness } from "../middleware/auth.js";

const app = new Hono<AppContext>();

// Ringkasan dashboard (otoritatif dari D1): pemasukan, pengeluaran, saldo,
// total piutang & hutang yang masih berjalan, untuk rentang waktu tertentu.
app.get("/:businessId/summary", requireAuth, requireBusiness("staff"), async (c) => {
  const businessId = c.req.param("businessId");
  const from = Number(c.req.query("from") ?? "0") || 0;
  const to = Number(c.req.query("to") ?? String(Date.now()));
  const db = c.var.db;

  const totals = await db
    .select({
      type: transactions.type,
      total: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.businessId, businessId),
        isNull(transactions.deletedAt),
        gte(transactions.occurredAt, new Date(from)),
        lte(transactions.occurredAt, new Date(to)),
      ),
    )
    .groupBy(transactions.type);

  const income = totals.find((t) => t.type === "income")?.total ?? 0;
  const expense = totals.find((t) => t.type === "expense")?.total ?? 0;

  const outstanding = await db
    .select({
      direction: debts.direction,
      total: sql<number>`COALESCE(SUM(${debts.amountCents} - ${debts.paidCents}), 0)`,
    })
    .from(debts)
    .where(and(eq(debts.businessId, businessId), isNull(debts.deletedAt), sql`${debts.status} != 'paid'`))
    .groupBy(debts.direction);

  const receivable = outstanding.find((d) => d.direction === "receivable")?.total ?? 0;
  const payable = outstanding.find((d) => d.direction === "payable")?.total ?? 0;

  return c.json({
    range: { from, to },
    incomeCents: Number(income),
    expenseCents: Number(expense),
    balanceCents: Number(income) - Number(expense),
    receivableCents: Number(receivable),
    payableCents: Number(payable),
  });
});

export default app;
