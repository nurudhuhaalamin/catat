import { api, apiJson } from "./api";
import { db, tableFor, type SyncEntity } from "./db";
import { newId } from "./id";

interface PullResponse {
  cursor: number;
  changes: Record<SyncEntity, Record<string, unknown>[]>;
}

let syncing = false;

// Tulis ke store lokal + antrekan ke outbox, lalu picu sync (non-blocking).
export async function saveLocal(
  entity: SyncEntity,
  businessId: string,
  record: Record<string, unknown>,
): Promise<void> {
  const now = Date.now();
  const data: Record<string, unknown> = { ...record, businessId, updatedAt: now };
  if (!data.id) data.id = newId();
  if (
    (entity === "accounts" || entity === "transactions" || entity === "debts" || entity === "debtPayments") &&
    !data.clientId
  ) {
    data.clientId = data.id;
  }
  if (!data.createdAt) data.createdAt = now;

  await tableFor(entity).put(data as never);
  await db.outbox.add({ businessId, entity, op: "upsert", data, createdAt: now });
  void syncNow(businessId);
}

// Hapus = soft-delete lokal + antre delete.
export async function deleteLocal(entity: SyncEntity, businessId: string, id: string): Promise<void> {
  const now = Date.now();
  await tableFor(entity).update(id, { deletedAt: now, updatedAt: now });
  await db.outbox.add({ businessId, entity, op: "delete", data: { id }, createdAt: now });
  void syncNow(businessId);
}

export async function pushOutbox(businessId: string): Promise<void> {
  const items = await db.outbox.where("businessId").equals(businessId).sortBy("createdAt");
  if (items.length === 0) return;
  const mutations = items.map((i) => ({ entity: i.entity, op: i.op, data: i.data }));
  const res = await api("/api/sync/push", { method: "POST", businessId, body: { businessId, mutations } });
  if (!res.ok) throw new Error("push gagal");
  await db.outbox.bulkDelete(items.map((i) => i.localId!).filter(Boolean));
}

export async function pull(businessId: string): Promise<void> {
  const cursorRow = await db.meta.get(`cursor:${businessId}`);
  const since = (cursorRow?.value as number) ?? 0;
  const json = await apiJson<PullResponse>(`/api/sync/pull?since=${since}`, { businessId });

  await db.transaction("rw", [db.accounts, db.contacts, db.categories, db.transactions, db.debts, db.debtPayments], async () => {
    for (const entity of Object.keys(json.changes) as SyncEntity[]) {
      const rows = json.changes[entity];
      if (rows?.length) await tableFor(entity).bulkPut(rows as never[]);
    }
  });
  await db.meta.put({ key: `cursor:${businessId}`, value: json.cursor });
}

// Push lalu pull. Aman dipanggil sering; dijaga agar tidak overlap.
export async function syncNow(businessId: string): Promise<boolean> {
  if (syncing || !navigator.onLine) return false;
  syncing = true;
  try {
    await pushOutbox(businessId);
    await pull(businessId);
    return true;
  } catch {
    return false;
  } finally {
    syncing = false;
  }
}

// Pasang sync otomatis: saat kembali online + tiap 30 detik.
export function startAutoSync(getBusinessId: () => string | null): () => void {
  const tick = () => {
    const id = getBusinessId();
    if (id) void syncNow(id);
  };
  const onOnline = () => tick();
  window.addEventListener("online", onOnline);
  const interval = window.setInterval(tick, 30_000);
  tick();
  return () => {
    window.removeEventListener("online", onOnline);
    window.clearInterval(interval);
  };
}
