import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { memberships, invitations, user as userTable, inviteSchema, roleSchema } from "@catat/shared";
import type { AppContext } from "../env.js";
import { requireAuth, requireBusiness } from "../middleware/auth.js";

const app = new Hono<AppContext>();

const now = () => new Date();
const uid = () => crypto.randomUUID();

// Daftar anggota tim sebuah usaha.
app.get("/:businessId/members", requireAuth, requireBusiness("staff"), async (c) => {
  const rows = await c.var.db
    .select({
      membershipId: memberships.id,
      userId: memberships.userId,
      role: memberships.role,
      name: userTable.name,
      email: userTable.email,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(userTable, eq(memberships.userId, userTable.id))
    .where(eq(memberships.businessId, c.req.param("businessId")));
  return c.json({ members: rows });
});

// Undang anggota lewat email (admin/owner). Jika user sudah punya akun,
// langsung dibuatkan membership; jika belum, dibuat undangan pending.
app.post("/:businessId/invitations", requireAuth, requireBusiness("admin"), async (c) => {
  const businessId = c.req.param("businessId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Input tidak valid", details: parsed.error.flatten() }, 400);
  }
  // Hanya owner yang boleh memberi peran owner.
  if (parsed.data.role === "owner" && c.var.membership.role !== "owner") {
    return c.json({ error: "Hanya owner yang dapat menambah owner" }, 403);
  }

  const existing = await c.var.db
    .select()
    .from(userTable)
    .where(eq(userTable.email, parsed.data.email))
    .limit(1);

  if (existing[0]) {
    const already = await c.var.db
      .select()
      .from(memberships)
      .where(and(eq(memberships.businessId, businessId), eq(memberships.userId, existing[0].id)))
      .limit(1);
    if (already[0]) {
      return c.json({ error: "User sudah menjadi anggota" }, 409);
    }
    await c.var.db.insert(memberships).values({
      id: uid(),
      businessId,
      userId: existing[0].id,
      role: parsed.data.role,
      createdAt: now(),
      updatedAt: now(),
    });
    return c.json({ status: "added" }, 201);
  }

  const token = uid();
  await c.var.db.insert(invitations).values({
    id: uid(),
    businessId,
    email: parsed.data.email,
    role: parsed.data.role,
    token,
    invitedBy: c.var.user.id,
    status: "pending",
    createdAt: now(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14), // 14 hari
  });
  // Catatan: pengiriman email belum diaktifkan (fase lanjutan / R2+email provider).
  return c.json({ status: "invited", token }, 201);
});

// Terima undangan (user yang sudah login, email harus cocok).
app.post("/invitations/accept", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) return c.json({ error: "token wajib" }, 400);

  const rows = await c.var.db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
  const inv = rows[0];
  if (!inv || inv.status !== "pending") {
    return c.json({ error: "Undangan tidak valid" }, 404);
  }
  if (inv.expiresAt.getTime() < Date.now()) {
    return c.json({ error: "Undangan kedaluwarsa" }, 410);
  }
  if (inv.email.toLowerCase() !== c.var.user.email.toLowerCase()) {
    return c.json({ error: "Undangan ditujukan untuk email lain" }, 403);
  }

  await c.var.db
    .insert(memberships)
    .values({
      id: uid(),
      businessId: inv.businessId,
      userId: c.var.user.id,
      role: inv.role,
      createdAt: now(),
      updatedAt: now(),
    })
    .onConflictDoNothing();
  await c.var.db.update(invitations).set({ status: "accepted" }).where(eq(invitations.id, inv.id));

  return c.json({ status: "accepted", businessId: inv.businessId });
});

// Ubah peran anggota (owner saja).
app.patch("/:businessId/members/:userId", requireAuth, requireBusiness("owner"), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = roleSchema.safeParse(body.role);
  if (!parsed.success) return c.json({ error: "Peran tidak valid" }, 400);
  const targetUserId = c.req.param("userId");
  if (targetUserId === c.var.user.id) {
    return c.json({ error: "Tidak bisa mengubah peran diri sendiri" }, 400);
  }
  await c.var.db
    .update(memberships)
    .set({ role: parsed.data, updatedAt: now() })
    .where(and(eq(memberships.businessId, c.req.param("businessId")), eq(memberships.userId, targetUserId)));
  return c.json({ ok: true });
});

// Keluarkan anggota (owner saja).
app.delete("/:businessId/members/:userId", requireAuth, requireBusiness("owner"), async (c) => {
  const targetUserId = c.req.param("userId");
  if (targetUserId === c.var.user.id) {
    return c.json({ error: "Owner tidak bisa mengeluarkan diri sendiri" }, 400);
  }
  await c.var.db
    .delete(memberships)
    .where(and(eq(memberships.businessId, c.req.param("businessId")), eq(memberships.userId, targetUserId)));
  return c.json({ ok: true });
});

export default app;
