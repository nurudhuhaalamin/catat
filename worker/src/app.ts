import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppContext } from "./env.js";
import { withServices } from "./middleware/auth.js";
import { loginLockout } from "./middleware/ratelimit.js";
import businesses from "./routes/businesses.js";
import members from "./routes/members.js";
import sync from "./routes/sync.js";
import reports from "./routes/reports.js";

const app = new Hono<AppContext>().basePath("/api");

// CORS dibatasi ke origin yang dikenal (produksi same-origin; dev web di :5173).
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allow = [c.env.BETTER_AUTH_URL, "http://localhost:5173"];
      return allow.includes(origin) ? origin : "";
    },
    credentials: true,
  }),
);

// Sediakan db + auth ke semua route.
app.use("*", withServices);

app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

// Login: pasang lockout per-IP sebelum diserahkan ke better-auth (lebih spesifik dulu).
app.post("/auth/sign-in/email", loginLockout, (c) => c.var.auth.handler(c.req.raw));
// Endpoint better-auth lainnya: /api/auth/sign-out, /get-session, dll.
app.on(["GET", "POST"], "/auth/*", (c) => c.var.auth.handler(c.req.raw));

app.route("/businesses", businesses);
// members & invitations juga di-mount di /businesses:
//   /businesses/:businessId/members, /businesses/:businessId/invitations,
//   /businesses/invitations/accept
app.route("/businesses", members);
app.route("/sync", sync);
app.route("/reports", reports);

export default app;
