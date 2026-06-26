import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { schema } from "@catat/shared";
import type { Env } from "./env.js";
import type { DB } from "./db.js";

// Auth email+password berbasis better-auth, disimpan di D1 via drizzle adapter.
export function createAuth(env: Env, db: DB) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL, "http://localhost:5173"],
    rateLimit: { enabled: true, window: 60, max: 30 },
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 8,
      // Registrasi publik ditutup: akun anggota dibuat oleh owner/admin (lihat routes/members.ts).
      disableSignUp: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 hari
      updateAge: 60 * 60 * 24, // perpanjang tiap hari aktif
    },
    advanced: {
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: true,
        httpOnly: true,
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
