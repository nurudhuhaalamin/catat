import { createMiddleware } from "hono/factory";
import { and, eq, isNull } from "drizzle-orm";
import { memberships } from "@catat/shared";
import type { AppContext } from "../env.js";

// Pasang db & auth ke context untuk setiap request.
import { getDb } from "../db.js";
import { createAuth } from "../auth.js";

export const withServices = createMiddleware<AppContext>(async (c, next) => {
  const db = getDb(c.env);
  c.set("db", db);
  c.set("auth", createAuth(c.env, db));
  await next();
});

// Wajib login. Mengisi c.var.user atau balas 401.
export const requireAuth = createMiddleware<AppContext>(async (c, next) => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Tidak terautentikasi" }, 401);
  }
  c.set("user", {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  });
  await next();
});

// Level akses: viewer (lihat) < pencatat (catat) < admin (kelola) < owner.
const roleRank = { viewer: 0, pencatat: 1, admin: 2, owner: 3 } as const;
export type Role = keyof typeof roleRank;

// Wajib anggota lini usaha (dari header x-business-id atau param :businessId).
// minRole opsional: minimal peran yang dibutuhkan.
export function requireBusiness(minRole: Role = "viewer") {
  return createMiddleware<AppContext>(async (c, next) => {
    const businessId = c.req.param("businessId") ?? c.req.header("x-business-id");
    if (!businessId) {
      return c.json({ error: "business_id wajib (header x-business-id)" }, 400);
    }
    const rows = await c.var.db
      .select()
      .from(memberships)
      .where(and(eq(memberships.businessId, businessId), eq(memberships.userId, c.var.user.id)))
      .limit(1);

    const membership = rows[0];
    if (!membership) {
      return c.json({ error: "Anda bukan anggota usaha ini" }, 403);
    }
    if (roleRank[membership.role] < roleRank[minRole]) {
      return c.json({ error: "Peran Anda tidak cukup untuk aksi ini" }, 403);
    }
    c.set("membership", membership);
    await next();
  });
}

export { and, eq, isNull };
