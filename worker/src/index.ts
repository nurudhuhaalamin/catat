import app from "./app.js";
import type { Env } from "./env.js";

// Satu Worker melayani API (/api/*) DAN aset statis SPA (apps/web/dist).
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api")) {
      return app.fetch(request, env, ctx);
    }

    // Aset statis; jika tidak ditemukan, fallback ke index.html (SPA routing).
    const assetRes = await env.ASSETS.fetch(request);
    if (assetRes.status === 404 && request.method === "GET") {
      const indexReq = new Request(new URL("/index.html", url.origin).toString(), request);
      return env.ASSETS.fetch(indexReq);
    }
    return assetRes;
  },
};
