// Saat dev, web (:5173) memanggil worker (:8787). Di produksi satu origin.
export const API_BASE = import.meta.env.DEV ? "http://localhost:8787" : "";

interface ApiOptions {
  method?: string;
  body?: unknown;
  businessId?: string;
}

export async function api(path: string, opts: ApiOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.businessId) headers["x-business-id"] = opts.businessId;

  return fetch(API_BASE + path, {
    method: opts.method ?? "GET",
    credentials: "include",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

export async function apiJson<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const res = await api(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Gagal memuat data");
  }
  return res.json() as Promise<T>;
}
