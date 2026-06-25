import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { formatMoney } from "@catat/shared";
import { db, type LDebt } from "../lib/db";
import { saveLocal } from "../lib/sync";
import { useBusiness } from "../lib/businessContext";
import { Sheet } from "./TransactionsPage";

export default function DebtsPage() {
  const { current } = useBusiness();
  const businessId = current?.id ?? "";
  const currency = current?.currency ?? "IDR";
  const [tab, setTab] = useState<"receivable" | "payable">("receivable");
  const [addOpen, setAddOpen] = useState(false);
  const [payFor, setPayFor] = useState<LDebt | null>(null);

  const debts = useLiveQuery(
    async () =>
      businessId
        ? (await db.debts.where("businessId").equals(businessId).toArray()).filter((d) => !d.deletedAt && d.direction === tab)
        : [],
    [businessId, tab],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Piutang & Hutang</h2>
        <button className="btn-primary py-2" onClick={() => setAddOpen(true)}>
          + Tambah
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button className={pill(tab === "receivable")} onClick={() => setTab("receivable")}>
          Piutang (orang berhutang)
        </button>
        <button className={pill(tab === "payable")} onClick={() => setTab("payable")}>
          Hutang (kita berhutang)
        </button>
      </div>

      {(debts ?? []).length === 0 && <p className="py-10 text-center text-slate-400">Belum ada data.</p>}

      <ul className="space-y-2">
        {(debts ?? []).map((d) => {
          const remain = d.amountCents - d.paidCents;
          return (
            <li key={d.id} className="card space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{d.note || "Tanpa keterangan"}</p>
                  <p className="text-xs text-slate-400">
                    {d.status === "paid" ? "Lunas" : `Sisa ${formatMoney(remain, currency)}`}
                    {d.dueDate ? ` · jatuh tempo ${new Date(d.dueDate).toLocaleDateString("id-ID")}` : ""}
                  </p>
                </div>
                <span className="font-semibold">{formatMoney(d.amountCents, currency)}</span>
              </div>
              {d.status !== "paid" && (
                <button className="btn-ghost w-full py-2 text-sm" onClick={() => setPayFor(d)}>
                  Catat pembayaran
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {addOpen && <AddDebt businessId={businessId} direction={tab} onClose={() => setAddOpen(false)} />}
      {payFor && <PaySheet businessId={businessId} debt={payFor} onClose={() => setPayFor(null)} />}
    </div>
  );
}

function AddDebt({ businessId, direction, onClose }: { businessId: string; direction: "receivable" | "payable"; onClose: () => void }) {
  const [contactId, setContactId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const contacts = useLiveQuery(
    async () => (await db.contacts.where("businessId").equals(businessId).toArray()).filter((c) => !c.deletedAt),
    [businessId],
  );

  async function submit() {
    const rupiah = Number(amount);
    if (!contactId || !rupiah || rupiah <= 0) return;
    await saveLocal("debts", businessId, {
      contactId,
      direction,
      amountCents: Math.round(rupiah * 100),
      paidCents: 0,
      status: "open",
      dueDate: dueDate ? new Date(dueDate).getTime() : null,
      note: note || null,
    });
    onClose();
  }

  return (
    <Sheet title={direction === "receivable" ? "Tambah piutang" : "Tambah hutang"} onClose={onClose}>
      <div>
        <label className="label">Kontak</label>
        <select className="input" value={contactId} onChange={(e) => setContactId(e.target.value)} autoFocus>
          <option value="">— Pilih kontak —</option>
          {(contacts ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {(contacts ?? []).length === 0 && <p className="mt-1 text-xs text-amber-600">Tambah kontak dulu di menu Kontak.</p>}
      </div>
      <div>
        <label className="label">Jumlah (Rp)</label>
        <input className="input" type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <label className="label">Jatuh tempo (opsional)</label>
        <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      <div>
        <label className="label">Catatan</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button className="btn-primary w-full" onClick={submit}>
        Simpan
      </button>
    </Sheet>
  );
}

function PaySheet({ businessId, debt, onClose }: { businessId: string; debt: LDebt; onClose: () => void }) {
  const remain = debt.amountCents - debt.paidCents;
  const [amount, setAmount] = useState(String(remain / 100));

  async function submit() {
    const rupiah = Number(amount);
    if (!rupiah || rupiah <= 0) return;
    const cents = Math.min(Math.round(rupiah * 100), remain);
    const newPaid = debt.paidCents + cents;
    const status = newPaid >= debt.amountCents ? "paid" : "partial";

    // Catat pembayaran + perbarui sisa hutang/piutang.
    await saveLocal("debtPayments", businessId, { debtId: debt.id, amountCents: cents, paidAt: Date.now(), note: null });
    await saveLocal("debts", businessId, { ...debt, paidCents: newPaid, status });
    onClose();
  }

  return (
    <Sheet title="Catat pembayaran" onClose={onClose}>
      <p className="text-sm text-slate-500">Sisa saat ini: {formatMoney(remain, "IDR")}</p>
      <div>
        <label className="label">Jumlah bayar (Rp)</label>
        <input className="input" type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      </div>
      <button className="btn-primary w-full" onClick={submit}>
        Simpan pembayaran
      </button>
    </Sheet>
  );
}

function pill(active: boolean) {
  return `rounded-xl px-2 py-2 text-xs font-medium ${active ? "bg-brand text-white" : "bg-slate-100 text-slate-500"}`;
}
