import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { formatMoney } from "@catat/shared";
import { db } from "../lib/db";
import { saveLocal, deleteLocal } from "../lib/sync";
import { useBusiness } from "../lib/businessContext";

type TxType = "income" | "expense" | "transfer";

export default function TransactionsPage() {
  const { current } = useBusiness();
  const businessId = current?.id ?? "";
  const currency = current?.currency ?? "IDR";
  const canRecord = current?.role !== "viewer";
  const [open, setOpen] = useState(false);

  const data = useLiveQuery(async () => {
    if (!businessId) return { txs: [], accountName: new Map<string, string>() };
    const [txs, accounts] = await Promise.all([
      db.transactions.where("businessId").equals(businessId).reverse().sortBy("occurredAt"),
      db.accounts.where("businessId").equals(businessId).toArray(),
    ]);
    return {
      txs: txs.filter((t) => !t.deletedAt),
      accountName: new Map(accounts.map((a) => [a.id, a.name])),
    };
  }, [businessId]);

  const txs = data?.txs ?? [];
  const accountName = data?.accountName ?? new Map<string, string>();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Transaksi</h2>
        {canRecord && (
          <button className="btn-primary py-2" onClick={() => setOpen(true)}>
            + Catat
          </button>
        )}
      </div>

      {txs.length === 0 && <p className="py-10 text-center text-slate-400">Belum ada transaksi.</p>}

      <ul className="space-y-2">
        {txs.map((t) => (
          <li key={t.id} className="card flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {t.note || (t.type === "income" ? "Pemasukan" : t.type === "expense" ? "Pengeluaran" : "Transfer")}
              </p>
              <p className="text-xs text-slate-400">
                {new Date(t.occurredAt).toLocaleDateString("id-ID")}
                {t.type === "transfer"
                  ? ` · ${accountName.get(t.accountId ?? "") ?? "?"} → ${accountName.get(t.toAccountId ?? "") ?? "?"}`
                  : t.accountId
                    ? ` · ${accountName.get(t.accountId) ?? "?"}`
                    : ""}
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
                <button className="text-slate-300 hover:text-red-500" onClick={() => deleteLocal("transactions", businessId, t.id)} title="Hapus">
                  ✕
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {open && <AddSheet businessId={businessId} onClose={() => setOpen(false)} />}
    </div>
  );
}

function AddSheet({ businessId, onClose }: { businessId: string; onClose: () => void }) {
  const [type, setType] = useState<TxType>("income");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [contactId, setContactId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

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
    <Sheet title="Catat transaksi" onClose={onClose}>
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
