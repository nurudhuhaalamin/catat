import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { formatMoney } from "@catat/shared";
import { db } from "../lib/db";
import { saveLocal, deleteLocal } from "../lib/sync";
import { useBusiness } from "../lib/businessContext";

export default function TransactionsPage() {
  const { current } = useBusiness();
  const businessId = current?.id ?? "";
  const currency = current?.currency ?? "IDR";
  const [open, setOpen] = useState(false);

  const txs = useLiveQuery(
    async () =>
      businessId
        ? (await db.transactions.where("businessId").equals(businessId).reverse().sortBy("occurredAt")).filter((t) => !t.deletedAt)
        : [],
    [businessId],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Transaksi</h2>
        <button className="btn-primary py-2" onClick={() => setOpen(true)}>
          + Catat
        </button>
      </div>

      {(txs ?? []).length === 0 && <p className="py-10 text-center text-slate-400">Belum ada transaksi.</p>}

      <ul className="space-y-2">
        {(txs ?? []).map((t) => (
          <li key={t.id} className="card flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate font-medium">{t.note || (t.type === "income" ? "Pemasukan" : "Pengeluaran")}</p>
              <p className="text-xs text-slate-400">{new Date(t.occurredAt).toLocaleDateString("id-ID")}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-semibold ${t.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                {t.type === "income" ? "+" : "−"}
                {formatMoney(t.amountCents, currency)}
              </span>
              <button className="text-slate-300 hover:text-red-500" onClick={() => deleteLocal("transactions", businessId, t.id)} title="Hapus">
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>

      {open && <AddSheet businessId={businessId} onClose={() => setOpen(false)} />}
    </div>
  );
}

function AddSheet({ businessId, onClose }: { businessId: string; onClose: () => void }) {
  const [type, setType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [contactId, setContactId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const categories = useLiveQuery(
    async () => (await db.categories.where("businessId").equals(businessId).toArray()).filter((c) => !c.deletedAt && c.kind === type),
    [businessId, type],
  );
  const contacts = useLiveQuery(
    async () => (await db.contacts.where("businessId").equals(businessId).toArray()).filter((c) => !c.deletedAt),
    [businessId],
  );

  async function submit() {
    const rupiah = Number(amount);
    if (!rupiah || rupiah <= 0) return;
    await saveLocal("transactions", businessId, {
      type,
      amountCents: Math.round(rupiah * 100),
      categoryId: categoryId || null,
      contactId: contactId || null,
      occurredAt: new Date(date).getTime(),
      note: note || null,
    });
    onClose();
  }

  return (
    <Sheet title="Catat transaksi" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <button className={tab(type === "income")} onClick={() => setType("income")}>
          Uang masuk
        </button>
        <button className={tab(type === "expense")} onClick={() => setType("expense")}>
          Uang keluar
        </button>
      </div>
      <div>
        <label className="label">Jumlah (Rp)</label>
        <input className="input" type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      </div>
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
      <div>
        <label className="label">Tanggal</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div>
        <label className="label">Catatan</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Penjualan harian" />
      </div>
      <button className="btn-primary w-full" onClick={submit}>
        Simpan
      </button>
    </Sheet>
  );
}

function tab(active: boolean) {
  return `rounded-xl py-2.5 font-medium ${active ? "bg-brand text-white" : "bg-slate-100 text-slate-500"}`;
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-2xl space-y-3 rounded-t-3xl bg-white p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-1 w-10 rounded-full bg-slate-200" />
        <h3 className="text-lg font-bold">{title}</h3>
        {children}
      </div>
    </div>
  );
}
