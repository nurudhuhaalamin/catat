import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { formatMoney } from "@catat/shared";
import { db, type LTransaction } from "../lib/db";
import { saveLocal, deleteLocal } from "../lib/sync";
import { useBusiness } from "../lib/businessContext";

type TxType = "income" | "expense" | "transfer";
type Filter = { q: string; type: "all" | TxType; accountId: string; categoryId: string; from: number | null; to: number | null };

const emptyFilter: Filter = { q: "", type: "all", accountId: "", categoryId: "", from: null, to: null };

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (dayKey(ts) === dayKey(today.getTime())) return "Hari ini";
  if (dayKey(ts) === dayKey(yest.getTime())) return "Kemarin";
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function TransactionsPage() {
  const { current } = useBusiness();
  const businessId = current?.id ?? "";
  const currency = current?.currency ?? "IDR";
  const canRecord = current?.role !== "viewer";
  const [sheet, setSheet] = useState<LTransaction | "new" | null>(null);
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>(emptyFilter);
  const [showFilter, setShowFilter] = useState(false);

  // Inisialisasi / sinkronkan filter dari query string (untuk drill-down dari Beranda/Laporan).
  useEffect(() => {
    const type = (searchParams.get("type") as Filter["type"]) ?? "all";
    const accountId = searchParams.get("account") ?? "";
    const categoryId = searchParams.get("category") ?? "";
    const from = searchParams.get("from") ? Number(searchParams.get("from")) : null;
    const to = searchParams.get("to") ? Number(searchParams.get("to")) : null;
    const q = searchParams.get("q") ?? "";
    setFilter({ q, type: ["income", "expense", "transfer"].includes(type) ? type : "all", accountId, categoryId, from, to });
    if (accountId || categoryId || from || to || (type && type !== "all")) setShowFilter(true);
  }, [searchParams]);

  const data = useLiveQuery(async () => {
    if (!businessId) return null;
    const [txs, accounts, categories] = await Promise.all([
      db.transactions.where("businessId").equals(businessId).reverse().sortBy("occurredAt"),
      db.accounts.where("businessId").equals(businessId).toArray(),
      db.categories.where("businessId").equals(businessId).toArray(),
    ]);
    return {
      txs: txs.filter((t) => !t.deletedAt),
      accounts: accounts.filter((a) => !a.deletedAt),
      categories: categories.filter((c) => !c.deletedAt),
      accountName: new Map(accounts.map((a) => [a.id, a.name])),
    };
  }, [businessId]);

  const filtered = useMemo(() => {
    const txs = data?.txs ?? [];
    const q = filter.q.trim().toLowerCase();
    return txs.filter((t) => {
      if (filter.type !== "all" && t.type !== filter.type) return false;
      if (filter.accountId && t.accountId !== filter.accountId && t.toAccountId !== filter.accountId) return false;
      if (filter.categoryId && t.categoryId !== filter.categoryId) return false;
      if (filter.from != null && t.occurredAt < filter.from) return false;
      if (filter.to != null && t.occurredAt > filter.to) return false;
      if (q && !(t.note ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, filter]);

  // Kelompokkan per tanggal (sudah urut terbaru dulu).
  const groups = useMemo(() => {
    const map = new Map<string, LTransaction[]>();
    for (const t of filtered) {
      const k = dayKey(t.occurredAt);
      (map.get(k) ?? map.set(k, []).get(k)!).push(t);
    }
    return [...map.values()];
  }, [filtered]);

  const accountName = data?.accountName ?? new Map<string, string>();
  const hasFilter = filter.q || filter.type !== "all" || filter.accountId || filter.categoryId || filter.from || filter.to;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Transaksi</h2>
        {canRecord && (
          <button className="btn-primary py-2" onClick={() => setSheet("new")}>
            + Catat
          </button>
        )}
      </div>

      {/* Cari + filter */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Cari catatan…"
            value={filter.q}
            onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
          />
          <button className="btn-ghost px-3" onClick={() => setShowFilter((s) => !s)} title="Filter">
            ⚙︎
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["all", "income", "expense", "transfer"] as const).map((t) => (
            <button key={t} className={chip(filter.type === t)} onClick={() => setFilter((f) => ({ ...f, type: t }))}>
              {t === "all" ? "Semua" : t === "income" ? "Masuk" : t === "expense" ? "Keluar" : "Transfer"}
            </button>
          ))}
        </div>
        {showFilter && (
          <div className="card space-y-2">
            <select className="input" value={filter.accountId} onChange={(e) => setFilter((f) => ({ ...f, accountId: e.target.value }))}>
              <option value="">Semua akun</option>
              {(data?.accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select className="input" value={filter.categoryId} onChange={(e) => setFilter((f) => ({ ...f, categoryId: e.target.value }))}>
              <option value="">Semua kategori</option>
              {(data?.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.kind === "income" ? "masuk" : "keluar"})
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input
                className="input"
                type="date"
                value={filter.from ? new Date(filter.from).toISOString().slice(0, 10) : ""}
                onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value ? new Date(e.target.value).setHours(0, 0, 0, 0) : null }))}
              />
              <span className="text-slate-400">s/d</span>
              <input
                className="input"
                type="date"
                value={filter.to ? new Date(filter.to).toISOString().slice(0, 10) : ""}
                onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value ? new Date(e.target.value).setHours(23, 59, 59, 999) : null }))}
              />
            </div>
            {hasFilter && (
              <button className="btn-ghost w-full text-sm" onClick={() => setFilter(emptyFilter)}>
                Reset filter
              </button>
            )}
          </div>
        )}
        <p className="px-1 text-xs text-slate-400">{filtered.length} transaksi</p>
      </div>

      {filtered.length === 0 && <p className="py-10 text-center text-slate-400">{hasFilter ? "Tidak ada yang cocok." : "Belum ada transaksi."}</p>}

      <div className="space-y-4">
        {groups.map((items) => (
          <div key={dayKey(items[0].occurredAt)} className="space-y-2">
            <p className="px-1 text-xs font-semibold text-slate-400">{dayLabel(items[0].occurredAt)}</p>
            <ul className="space-y-2">
              {items.map((t) => (
                <li
                  key={t.id}
                  className={`card flex items-center justify-between ${canRecord ? "cursor-pointer active:bg-slate-50" : ""}`}
                  onClick={canRecord ? () => setSheet(t) : undefined}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {t.note || (t.type === "income" ? "Pemasukan" : t.type === "expense" ? "Pengeluaran" : "Transfer")}
                    </p>
                    <p className="text-xs text-slate-400">
                      {t.type === "transfer"
                        ? `${accountName.get(t.accountId ?? "") ?? "?"} → ${accountName.get(t.toAccountId ?? "") ?? "?"}`
                        : t.accountId
                          ? accountName.get(t.accountId) ?? "?"
                          : "Tanpa akun"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-semibold ${
                        t.type === "income" ? "text-emerald-600" : t.type === "expense" ? "text-red-600" : "text-slate-500"
                      }`}
                    >
                      {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}
                      {formatMoney(t.amountCents, currency)}
                    </span>
                    {canRecord && (
                      <button
                        className="text-slate-300 hover:text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLocal("transactions", businessId, t.id);
                        }}
                        title="Hapus"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {sheet && <AddSheet businessId={businessId} tx={sheet === "new" ? null : sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

function chip(active: boolean) {
  return `shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${active ? "bg-brand text-white" : "bg-white text-slate-500 border border-slate-200"}`;
}

function AddSheet({ businessId, tx, onClose }: { businessId: string; tx: LTransaction | null; onClose: () => void }) {
  const [type, setType] = useState<TxType>(tx?.type ?? "income");
  const [amount, setAmount] = useState(tx ? String(tx.amountCents / 100) : "");
  const [accountId, setAccountId] = useState(tx?.accountId ?? "");
  const [toAccountId, setToAccountId] = useState(tx?.toAccountId ?? "");
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? "");
  const [contactId, setContactId] = useState(tx?.contactId ?? "");
  const [date, setDate] = useState(() => new Date(tx?.occurredAt ?? Date.now()).toISOString().slice(0, 10));
  const [note, setNote] = useState(tx?.note ?? "");

  const accounts = useLiveQuery(
    async () => (await db.accounts.where("businessId").equals(businessId).toArray()).filter((a) => !a.deletedAt && !a.isArchived),
    [businessId],
  );
  const categories = useLiveQuery(
    async () =>
      type === "transfer"
        ? []
        : (await db.categories.where("businessId").equals(businessId).toArray()).filter((c) => !c.deletedAt && c.kind === (type === "income" ? "income" : "expense")),
    [businessId, type],
  );
  const contacts = useLiveQuery(
    async () => (await db.contacts.where("businessId").equals(businessId).toArray()).filter((c) => !c.deletedAt),
    [businessId],
  );

  async function submit() {
    const rupiah = Number(amount);
    if (!rupiah || rupiah <= 0 || !accountId) return;
    if (type === "transfer" && (!toAccountId || toAccountId === accountId)) return;
    await saveLocal("transactions", businessId, {
      ...(tx ?? {}),
      type,
      amountCents: Math.round(rupiah * 100),
      accountId,
      toAccountId: type === "transfer" ? toAccountId : null,
      categoryId: type === "transfer" ? null : categoryId || null,
      contactId: type === "transfer" ? null : contactId || null,
      occurredAt: new Date(date).getTime(),
      note: note || null,
    });
    onClose();
  }

  const noAccounts = (accounts ?? []).length === 0;

  return (
    <Sheet title={tx ? "Ubah transaksi" : "Catat transaksi"} onClose={onClose}>
      <div className="grid grid-cols-3 gap-2">
        <button className={tab(type === "income")} onClick={() => setType("income")}>
          Masuk
        </button>
        <button className={tab(type === "expense")} onClick={() => setType("expense")}>
          Keluar
        </button>
        <button className={tab(type === "transfer")} onClick={() => setType("transfer")}>
          Transfer
        </button>
      </div>

      {noAccounts && <p className="text-xs text-amber-600">Buat akun Kas/Bank dulu di menu Lainnya → Akun Kas & Bank.</p>}

      <div>
        <label className="label">Jumlah (Rp)</label>
        <input className="input" type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      </div>

      <div>
        <label className="label">{type === "transfer" ? "Dari akun" : type === "income" ? "Masuk ke akun" : "Keluar dari akun"}</label>
        <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">— Pilih akun —</option>
          {(accounts ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {type === "transfer" ? (
        <div>
          <label className="label">Ke akun</label>
          <select className="input" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
            <option value="">— Pilih akun —</option>
            {(accounts ?? []).filter((a) => a.id !== accountId).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <div>
            <label className="label">Kategori</label>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— Tanpa kategori —</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Kontak (opsional)</label>
            <select className="input" value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">—</option>
              {(contacts ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div>
        <label className="label">Tanggal</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div>
        <label className="label">Catatan</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Penjualan harian" />
      </div>
      <button className="btn-primary w-full" onClick={submit} disabled={noAccounts}>
        Simpan
      </button>
    </Sheet>
  );
}

function tab(active: boolean) {
  return `rounded-xl py-2.5 text-sm font-medium ${active ? "bg-brand text-white" : "bg-slate-100 text-slate-500"}`;
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-t-3xl bg-white p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-1 w-10 rounded-full bg-slate-200" />
        <h3 className="text-lg font-bold">{title}</h3>
        {children}
      </div>
    </div>
  );
}
