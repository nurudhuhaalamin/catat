import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { loginAttempts } from "@catat/shared";
import type { AppContext } from "../env.js";

const MAX_FAILS = 8; // gagal berturut dalam jendela
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

// Lockout login per-IP: bila terlalu banyak gagal → 429 untuk sementara.
// Dipasang pada POST /api/auth/sign-in/email (lihat app.ts).
export const loginLockout = createMiddleware<AppContext>(async (c, next) => {
  const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("x-forwarded-for") ?? "unknown";
  const db = c.var.db;
  const now = Date.now();

  const row = (await db.select().from(loginAttempts).where(eq(loginAttempts.ip, ip)).limit(1))[0];

  if (row?.lockedUntil && row.lockedUntil.getTime() > now) {
    const mins = Math.ceil((row.lockedUntil.getTime() - now) / 60000);
    return c.json({ error: `Terlalu banyak percobaan login. Coba lagi dalam ${mins} menit.` }, 429);
  }

  // Reset hitungan bila percobaan terakhir sudah lewat jendela.
  let fails = row?.fails ?? 0;
  if (row && now - row.updatedAt.getTime() > WINDOW_MS) fails = 0;

  await next();

  const status = c.res.status;
  if (status === 200) {
    if (row) await db.delete(loginAttempts).where(eq(loginAttempts.ip, ip));
    return;
  }
  if (status === 401 || status === 400 || status === 403) {
    const newFails = fails + 1;
    const lockedUntil = newFails >= MAX_FAILS ? new Date(now + LOCK_MS) : null;
    await db
      .insert(loginAttempts)
      .values({ ip, fails: newFails, lockedUntil, updatedAt: new Date(now) })
      .onConflictDoUpdate({ target: loginAttempts.ip, set: { fails: newFails, lockedUntil, updatedAt: new Date(now) } });
  }
});
