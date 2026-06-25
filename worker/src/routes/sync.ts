import { Hono } from "hono";
import { and, eq, gt } from "drizzle-orm";
import {
  contacts,
  categories,
  transactions,
  debts,
  debtPayments,
  contactSchema,
  categorySchema,
  transactionSchema,
  debtSchema,
  debtPaymentSchema,
  syncPushSchema,
} from "@catat/shared";
import type { AppContext } from "../env.js";
import { requireAuth, requireBusiness } from "../middleware/auth.js";

const app = new Hono<AppContext>();

const ms = (v: unknown): Date | null => (typeof v === "number" ? new Date(v) : null);

/**
 * PUSH: terapkan batch mutasi dari outbox perangkat secara idempoten.
 * Idempotensi: conflict target = primary key `id` (UUID dibuat di perangkat).
 * Server adalah pemilik `updated_at` (selalu di-set waktu server) → cursor pull monoton.
 * Edit memakai last-write-wins; hapus = soft-delete (set deleted_at).
 */
app.post("/push", requireAuth, requireBusiness("staff"), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = syncPushSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Payload sync tidak valid", details: parsed.error.flatten() }, 400);
  }
  const businessId = c.req.param("businessId") ?? c.req.header("x-business-id")!;
  if (parsed.data.businessId !== businessId) {
    return c.json({ error: "businessId tidak konsisten" }, 400);
  }

  const db = c.var.db;
  const userId = c.var.user.id;
  const applied: string[] = [];
  const rejected: { id?: string; entity: string; reason: string }[] = [];

  for (const m of parsed.data.mutations) {
    const serverNow = new Date();
    try {
      if (m.op === "delete") {
        await softDelete(db, businessId, m.entity, String((m.data as { id?: string }).id ?? ""), serverNow);
        applied.push(String((m.data as { id?: string }).id ?? ""));
        continue;
      }

      switch (m.entity) {
        case "contacts": {
          const d = contactSchema.parse(m.data);
          await db
            .insert(contacts)
            .values({
              id: d.id,
              businessId,
              name: d.name,
              type: d.type,
              phone: d.phone ?? null,
              note: d.note ?? null,
              createdAt: serverNow,
              updatedAt: serverNow,
              deletedAt: ms(d.deletedAt),
            })
            .onConflictDoUpdate({
              target: contacts.id,
              set: { name: d.name, type: d.type, phone: d.phone ?? null, note: d.note ?? null, updatedAt: serverNow, deletedAt: ms(d.deletedAt) },
            });
          applied.push(d.id);
          break;
        }
        case "categories": {
          const d = categorySchema.parse(m.data);
          await db
            .insert(categories)
            .values({ id: d.id, businessId, kind: d.kind, name: d.name, createdAt: serverNow, updatedAt: serverNow, deletedAt: ms(d.deletedAt) })
            .onConflictDoUpdate({ target: categories.id, set: { name: d.name, kind: d.kind, updatedAt: serverNow, deletedAt: ms(d.deletedAt) } });
          applied.push(d.id);
          break;
        }
        case "transactions": {
          const d = transactionSchema.parse(m.data);
          await db
            .insert(transactions)
            .values({
              id: d.id,
              businessId,
              type: d.type,
              amountCents: d.amountCents,
              categoryId: d.categoryId ?? null,
              contactId: d.contactId ?? null,
              occurredAt: new Date(d.occurredAt),
              note: d.note ?? null,
              createdBy: userId,
              clientId: d.clientId,
              createdAt: serverNow,
              updatedAt: serverNow,
              deletedAt: ms(d.deletedAt),
            })
            .onConflictDoUpdate({
              target: transactions.id,
              set: {
                type: d.type,
                amountCents: d.amountCents,
                categoryId: d.categoryId ?? null,
                contactId: d.contactId ?? null,
                occurredAt: new Date(d.occurredAt),
                note: d.note ?? null,
                updatedAt: serverNow,
                deletedAt: ms(d.deletedAt),
              },
            });
          applied.push(d.id);
          break;
        }
        case "debts": {
          const d = debtSchema.parse(m.data);
          await db
            .insert(debts)
            .values({
              id: d.id,
              businessId,
              contactId: d.contactId,
              direction: d.direction,
              amountCents: d.amountCents,
              paidCents: d.paidCents,
              dueDate: ms(d.dueDate),
              status: d.status,
              note: d.note ?? null,
              createdBy: userId,
              clientId: d.clientId,
              createdAt: serverNow,
              updatedAt: serverNow,
              deletedAt: ms(d.deletedAt),
            })
            .onConflictDoUpdate({
              target: debts.id,
              set: {
                contactId: d.contactId,
                direction: d.direction,
                amountCents: d.amountCents,
                paidCents: d.paidCents,
                dueDate: ms(d.dueDate),
                status: d.status,
                note: d.note ?? null,
                updatedAt: serverNow,
                deletedAt: ms(d.deletedAt),
              },
            });
          applied.push(d.id);
          break;
        }
        case "debtPayments": {
          const d = debtPaymentSchema.parse(m.data);
          await db
            .insert(debtPayments)
            .values({
              id: d.id,
              businessId,
              debtId: d.debtId,
              amountCents: d.amountCents,
              paidAt: new Date(d.paidAt),
              note: d.note ?? null,
              clientId: d.clientId,
              createdAt: serverNow,
              updatedAt: serverNow,
              deletedAt: ms(d.deletedAt),
            })
            .onConflictDoUpdate({
              target: debtPayments.id,
              set: { amountCents: d.amountCents, paidAt: new Date(d.paidAt), note: d.note ?? null, updatedAt: serverNow, deletedAt: ms(d.deletedAt) },
            });
          applied.push(d.id);
          break;
        }
      }
    } catch (err) {
      rejected.push({ id: (m.data as { id?: string }).id, entity: m.entity, reason: (err as Error).message });
    }
  }

  return c.json({ applied: applied.length, rejected, cursor: Date.now() });
});

/**
 * PULL: kembalikan semua baris yang berubah sejak `since` (ms) per entitas.
 * Client menyimpan `cursor` dan mengirimnya pada pull berikutnya.
 */
app.get("/pull", requireAuth, requireBusiness("staff"), async (c) => {
  const businessId = c.req.param("businessId") ?? c.req.header("x-business-id")!;
  const since = Number(c.req.query("since") ?? "0") || 0;
  const sinceDate = new Date(since);
  const db = c.var.db;

  const [contactRows, categoryRows, txRows, debtRows, paymentRows] = await Promise.all([
    db.select().from(contacts).where(and(eq(contacts.businessId, businessId), gt(contacts.updatedAt, sinceDate))),
    db.select().from(categories).where(and(eq(categories.businessId, businessId), gt(categories.updatedAt, sinceDate))),
    db.select().from(transactions).where(and(eq(transactions.businessId, businessId), gt(transactions.updatedAt, sinceDate))),
    db.select().from(debts).where(and(eq(debts.businessId, businessId), gt(debts.updatedAt, sinceDate))),
    db.select().from(debtPayments).where(and(eq(debtPayments.businessId, businessId), gt(debtPayments.updatedAt, sinceDate))),
  ]);

  return c.json({
    cursor: Date.now(),
    changes: {
      contacts: contactRows.map(toEpoch),
      categories: categoryRows.map(toEpoch),
      transactions: txRows.map(toEpoch),
      debts: debtRows.map(toEpoch),
      debtPayments: paymentRows.map(toEpoch),
    },
  });
});

// Konversi semua kolom Date -> epoch ms (number) agar konsisten dengan store lokal (Dexie).
function toEpoch<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Date ? v.getTime() : v;
  }
  return out as T;
}

async function softDelete(
  db: AppContext["Variables"]["db"],
  businessId: string,
  entity: string,
  id: string,
  serverNow: Date,
) {
  if (!id) return;
  const set = { deletedAt: serverNow, updatedAt: serverNow };
  switch (entity) {
    case "contacts":
      return db.update(contacts).set(set).where(and(eq(contacts.businessId, businessId), eq(contacts.id, id)));
    case "categories":
      return db.update(categories).set(set).where(and(eq(categories.businessId, businessId), eq(categories.id, id)));
    case "transactions":
      return db.update(transactions).set(set).where(and(eq(transactions.businessId, businessId), eq(transactions.id, id)));
    case "debts":
      return db.update(debts).set(set).where(and(eq(debts.businessId, businessId), eq(debts.id, id)));
    case "debtPayments":
      return db.update(debtPayments).set(set).where(and(eq(debtPayments.businessId, businessId), eq(debtPayments.id, id)));
  }
}

export default app;
