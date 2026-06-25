import { defineConfig } from "drizzle-kit";

// Migrasi di-generate ke folder ../../migrations dan diterapkan ke D1 oleh Wrangler.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "../../migrations",
});
