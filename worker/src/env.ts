import type { getDb } from "./db.js";
import type { createAuth } from "./auth.js";
import type { Membership } from "@catat/shared";

// Binding & variabel lingkungan Worker (lihat wrangler.toml).
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  ENVIRONMENT?: string;
}

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
}

// Variabel yang dititipkan antar-middleware Hono.
export interface Variables {
  db: ReturnType<typeof getDb>;
  auth: ReturnType<typeof createAuth>;
  user: AuthedUser;
  membership: Membership;
}

export type AppContext = { Bindings: Env; Variables: Variables };
