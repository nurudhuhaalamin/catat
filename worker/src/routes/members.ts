import { Hono, type Context } from "hono";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { memberships, account as accountTable, user as userTable, memberCreateSchema, passwordResetSchema, roleSchema } from "@catat/shared";
import type { AppContext } from "../env.js";
import { requireAuth, requireBusiness } from "../middleware/auth.js";

const app = new Hono<AppContext>();

const now = () => new Date();
const uid = () => crypto.randomUUID();

// Daftar anggota tim sebuah usaha.
app.get("/:businessId/members", requireAuth, requireBusiness("viewer"), async (c) => {
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

// Buat akun anggota (email+password+peran). Hanya admin/owner. Registrasi publik ditutup,
// jadi inilah satu-satunya cara anggota mendapat akun.
app.post("/:businessId/members", requireAuth, requireBusiness("admin"), async (c) => {
  const businessId = c.req.param("businessId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = memberCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Input tidak valid", details: parsed.error.flatten() }, 400);
  }
  if (parsed.data.role === "owner" && c.var.membership.role !== "owner") {
    return c.json({ error: "Hanya owner yang dapat menambah owner" }, 403);
  }
  const email = parsed.data.email.toLowerCase();
  const db = c.var.db;

  // Sudah punya akun? cukup tambahkan keanggotaan.
  const existing = await db.select().from(userTable).where(eq(userTable.email, email)).limit(1);
  let userId = existing[0]?.id;

  if (!userId) {
    userId = uid();
    const ts = now();
    await db.insert(userTable).values({
      id: userId,
      name: parsed.data.name,
      email,
      emailVerified: true,
      createdAt: ts,
      updatedAt: ts,
    });
    // Akun kredensial better-auth (password di-hash dengan util better-auth).
    await db.insert(accountTable).values({
      id: uid(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: await hashPassword(parsed.data.password),
      createdAt: ts,
      updatedAt: ts,
    });
  }

  const already = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.businessId, businessId), eq(memberships.userId, userId)))
    .limit(1);
  if (already[0]) {
    return c.json({ error: "User sudah menjadi anggota usaha ini" }, 409);
  }
  await db.insert(memberships).values({
    id: uid(),
    businessId,
    userId,
    role: parsed.data.role,
    createdAt: now(),
    updatedAt: now(),
  });
  return c.json({ status: existing[0] ? "added_existing" : "created", userId }, 201);
});

// Ubah peran anggota.
app.patch("/:businessId/members/:userId", requireAuth, requireBusiness("admin"), async (c) => {
  const businessId = c.req.param("businessId");
  const targetUserId = c.req.param("userId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = roleSchema.safeParse(body.role);
  if (!parsed.success) return c.json({ error: "Peran tidak valid" }, 400);
  if (targetUserId === c.var.user.id) return c.json({ error: "Tidak bisa mengubah peran diri sendiri" }, 400);

  const guard = await guardOwnerOnly(c, businessId, targetUserId, parsed.data === "owner");
  if (guard) return guard;

  await c.var.db
    .update(memberships)
    .set({ role: parsed.data, updatedAt: now() })
    .where(and(eq(memberships.businessId, businessId), eq(memberships.userId, targetUserId)));
  return c.json({ ok: true });
});

// Reset password anggota.
app.post("/:businessId/members/:userId/password", requireAuth, requireBusiness("admin"), async (c) => {
  const businessId = c.req.param("businessId");
  const targetUserId = c.req.param("userId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = passwordResetSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Password minimal 8 karakter" }, 400);

  const guard = await guardOwnerOnly(c, businessId, targetUserId, false);
  if (guard) return guard;

  const hashed = await hashPassword(parsed.data.password);
  const existingCred = await c.var.db
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(and(eq(accountTable.userId, targetUserId), eq(accountTable.providerId, "credential")))
    .limit(1);

  if (existingCred[0]) {
    await c.var.db.update(accountTable).set({ password: hashed, updatedAt: now() }).where(eq(accountTable.id, existingCred[0].id));
  } else {
    // Belum punya akun kredensial → buat baru.
    await c.var.db.insert(accountTable).values({
      id: uid(),
      accountId: targetUserId,
      providerId: "credential",
      userId: targetUserId,
      password: hashed,
      createdAt: now(),
      updatedAt: now(),
    });
  }
  return c.json({ ok: true });
});

// Keluarkan anggota dari usaha (hapus keanggotaan, akun user tetap ada).
app.delete("/:businessId/members/:userId", requireAuth, requireBusiness("admin"), async (c) => {
  const businessId = c.req.param("businessId");
  const targetUserId = c.req.param("userId");
  if (targetUserId === c.var.user.id) return c.json({ error: "Tidak bisa mengeluarkan diri sendiri" }, 400);

  const guard = await guardOwnerOnly(c, businessId, targetUserId, false);
  if (guard) return guard;

  await c.var.db
    .delete(memberships)
    .where(and(eq(memberships.businessId, businessId), eq(memberships.userId, targetUserId)));
  return c.json({ ok: true });
});

// Hanya owner yang boleh menyentuh anggota ber-peran owner / mengangkat owner.
async function guardOwnerOnly(
  c: Context<AppContext>,
  businessId: string,
  targetUserId: string,
  promotingToOwner: boolean,
) {
  if (c.var.membership.role === "owner") return null;
  const target = await c.var.db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.businessId, businessId), eq(memberships.userId, targetUserId)))
    .limit(1);
  if (promotingToOwner || target[0]?.role === "owner") {
    return c.json({ error: "Hanya owner yang dapat mengelola owner" }, 403);
  }
  return null;
}

export default app;
