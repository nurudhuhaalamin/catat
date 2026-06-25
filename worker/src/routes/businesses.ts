import { Hono } from "hono";
import { and, eq, desc } from "drizzle-orm";
import { businesses, memberships, categories, accounts, businessCreateSchema } from "@catat/shared";
import type { AppContext } from "../env.js";
import { requireAuth, requireBusiness } from "../middleware/auth.js";

const app = new Hono<AppContext>();

const now = () => new Date();
const uid = () => crypto.randomUUID();

// Kategori bawaan saat usaha baru dibuat.
const DEFAULT_CATEGORIES: { kind: "income" | "expense"; name: string }[] = [
  { kind: "income", name: "Penjualan" },
  { kind: "income", name: "Pendapatan Lain" },
  { kind: "expense", name: "Pembelian Stok" },
  { kind: "expense", name: "Operasional" },
  { kind: "expense", name: "Gaji" },
];

// Daftar lini usaha milik / yang diikuti user, beserta perannya.
app.get("/", requireAuth, async (c) => {
  const rows = await c.var.db
    .select({
      id: businesses.id,
      name: businesses.name,
      ownerUserId: businesses.ownerUserId,
      currency: businesses.currency,
      createdAt: businesses.createdAt,
      updatedAt: businesses.updatedAt,
      deletedAt: businesses.deletedAt,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(businesses, eq(memberships.businessId, businesses.id))
    .where(eq(memberships.userId, c.var.user.id))
    .orderBy(desc(businesses.createdAt));

  return c.json({ businesses: rows.filter((b) => b.deletedAt === null) });
});

// Buat lini usaha baru (pembuat otomatis jadi owner) + kategori bawaan.
app.post("/", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = businessCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Input tidak valid", details: parsed.error.flatten() }, 400);
  }
  const ts = now();
  const businessId = uid();

  await c.var.db.insert(businesses).values({
    id: businessId,
    name: parsed.data.name,
    ownerUserId: c.var.user.id,
    currency: parsed.data.currency,
    createdAt: ts,
    updatedAt: ts,
  });
  await c.var.db.insert(memberships).values({
    id: uid(),
    businessId,
    userId: c.var.user.id,
    role: "owner",
    createdAt: ts,
    updatedAt: ts,
  });
  await c.var.db.insert(categories).values(
    DEFAULT_CATEGORIES.map((cat) => ({
      id: uid(),
      businessId,
      kind: cat.kind,
      name: cat.name,
      nature: cat.kind === "income" ? ("pendapatan" as const) : ("beban" as const),
      createdAt: ts,
      updatedAt: ts,
    })),
  );
  // Akun kas bawaan agar bisa langsung mencatat.
  const kasId = uid();
  await c.var.db.insert(accounts).values({
    id: kasId,
    businessId,
    name: "Kas",
    type: "cash",
    openingBalanceCents: 0,
    isArchived: false,
    clientId: kasId,
    createdAt: ts,
    updatedAt: ts,
  });

  const created = await c.var.db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  return c.json({ business: { ...created[0], role: "owner" } }, 201);
});

// Ganti nama / mata uang (owner atau admin).
app.patch("/:businessId", requireAuth, requireBusiness("admin"), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = businessCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Input tidak valid" }, 400);
  }
  await c.var.db
    .update(businesses)
    .set({ ...parsed.data, updatedAt: now() })
    .where(eq(businesses.id, c.req.param("businessId")));
  return c.json({ ok: true });
});

// Soft-delete usaha (hanya owner).
app.delete("/:businessId", requireAuth, requireBusiness("owner"), async (c) => {
  await c.var.db
    .update(businesses)
    .set({ deletedAt: now(), updatedAt: now() })
    .where(and(eq(businesses.id, c.req.param("businessId"))));
  return c.json({ ok: true });
});

export default app;
