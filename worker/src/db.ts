import { drizzle } from "drizzle-orm/d1";
import { schema } from "@catat/shared";
import type { Env } from "./env.js";

export function getDb(env: Env) {
  return drizzle(env.DB, { schema });
}

export type DB = ReturnType<typeof getDb>;
