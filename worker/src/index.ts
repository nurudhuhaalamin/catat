import app from "./app.js";
import type { Env } from "./env.js";

// Header keamanan untuk semua respons (API & aset). X-Robots-Tag mencegah indexing.
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self'",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

function harden(res: Response): Response {
  const h = new Headers(res.headers);
  h.set("Content-Security-Policy", CSP);
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  h.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

// Satu Worker melayani API (/api/*) DAN aset statis SPA (apps/web/dist).
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api")) {
      return harden(await app.fetch(request, env, ctx));
    }

    // Aset statis; jika tidak ditemukan, fallback ke index.html (SPA routing).
    let assetRes = await env.ASSETS.fetch(request);
    if (assetRes.status === 404 && request.method === "GET") {
      const indexReq = new Request(new URL("/index.html", url.origin).toString(), request);
      assetRes = await env.ASSETS.fetch(indexReq);
    }
    return harden(assetRes);
  },
};
