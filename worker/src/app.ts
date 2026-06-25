import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppContext } from "./env.js";
import { withServices } from "./middleware/auth.js";
import businesses from "./routes/businesses.js";
import members from "./routes/members.js";
import sync from "./routes/sync.js";
import reports from "./routes/reports.js";

const app = new Hono<AppContext>().basePath("/api");

// CORS hanya relevan saat dev (web di :5173, worker di :8787). Di produksi
// keduanya satu origin sehingga kredensial cookie otomatis terkirim.
app.use("*", cors({ origin: (o) => o, credentials: true }));

// Sediakan db + auth ke semua route.
app.use("*", withServices);

app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

// Endpoint better-auth: /api/auth/sign-up/email, /sign-in/email, /sign-out, dll.
app.on(["GET", "POST"], "/auth/*", (c) => c.var.auth.handler(c.req.raw));

app.route("/businesses", businesses);
// members & invitations juga di-mount di /businesses:
//   /businesses/:businessId/members, /businesses/:businessId/invitations,
//   /businesses/invitations/accept
app.route("/businesses", members);
app.route("/sync", sync);
app.route("/reports", reports);

export default app;
