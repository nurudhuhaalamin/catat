import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  const canRecord = current?.role !== "viewer";
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<"receivable" | "payable">(searchParams.get("dir") === "payable" ? "payable" : "receivable");

  useEffect(() => {
    const d = searchParams.get("dir");
    if (d === "payable" || d === "receivable") setTab(d);
  }, [searchParams]);
  const [addOpen, setAddOpen] = useState(false);
  const [editFor, setEditFor] = useState<LDebt | null>(null);
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
        {canRecord && (
          <button className="btn-primary py-2" onClick={() => setAddOpen(true)}>
            + Tambah
          </button>
        )}
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
              {canRecord && (
                <div className="flex gap-2">
                  <button className="btn-ghost flex-1 py-2 text-sm" onClick={() => setEditFor(d)}>
                    Ubah
                  </button>
                  {d.status !== "paid" && (
                    <button className="btn-primary flex-1 py-2 text-sm" onClick={() => setPayFor(d)}>
                      Catat pembayaran
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {addOpen && <AddDebt businessId={businessId} direction={tab} debt={null} onClose={() => setAddOpen(false)} />}
      {editFor && <AddDebt businessId={businessId} direction={editFor.direction} debt={editFor} onClose={() => setEditFor(null)} />}
      {payFor && <PaySheet businessId={businessId} debt={payFor} onClose={() => setPayFor(null)} />}
    </div>
  );
}

function AddDebt({
  businessId,
  direction,
  debt,
  onClose,
}: {
  businessId: string;
  direction: "receivable" | "payable";
  debt: LDebt | null;
  onClose: () => void;
}) {
  const [contactId, setContactId] = useState(debt?.contactId ?? "");
  const [amount, setAmount] = useState(debt ? String(debt.amountCents / 100) : "");
  const [categoryId, setCategoryId] = useState(debt?.categoryId ?? "");
  const [cashNow, setCashNow] = useState(!!debt?.accountId);
  const [accountId, setAccountId] = useState(debt?.accountId ?? "");
  const [dueDate, setDueDate] = useState(debt?.dueDate ? new Date(debt.dueDate).toISOString().slice(0, 10) : "");
  const [note, setNote] = useState(debt?.note ?? "");

  const contacts = useLiveQuery(
    async () => (await db.contacts.where("businessId").equals(businessId).toArray()).filter((c) => !c.deletedAt),
    [businessId],
  );
  const catKind = direction === "receivable" ? "income" : "expense";
  const categories = useLiveQuery(
    async () => (await db.categories.where("businessId").equals(businessId).toArray()).filter((c) => !c.deletedAt && c.kind === catKind),
    [businessId, catKind],
  );
  const accounts = useLiveQuery(
    async () => (await db.accounts.where("businessId").equals(businessId).toArray()).filter((a) => !a.deletedAt && !a.isArchived),
    [businessId],
  );

  async function submit() {
    const rupiah = Number(amount);
    if (!contactId || !rupiah || rupiah <= 0) return;
    if (cashNow && !accountId) return;
    const amountCents = Math.round(rupiah * 100);
    const paidCents = debt?.paidCents ?? 0;
    const status = paidCents >= amountCents ? "paid" : paidCents > 0 ? "partial" : "open";
    await saveLocal("debts", businessId, {
      ...(debt ?? {}),
      contactId,
      direction,
      amountCents,
      paidCents,
      status,
      categoryId: categoryId || null,
      accountId: cashNow ? accountId : null,
      dueDate: dueDate ? new Date(dueDate).getTime() : null,
      note: note || null,
    });
    onClose();
  }

  const cashLabel = direction === "receivable" ? "Uang tunai keluar sekarang (meminjamkan)" : "Uang tunai masuk sekarang (meminjam)";

  return (
    <Sheet title={`${debt ? "Ubah" : "Tambah"} ${direction === "receivable" ? "piutang" : "hutang"}`} onClose={onClose}>
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
        {(contacts ?? []).length === 0 && (
          <p className="mt-1 text-xs text-amber-600">Tambah kontak dulu di menu Lainnya → Kontak.</p>
        )}
      </div>
      <div>
        <label className="label">Jumlah (Rp)</label>
        <input className="input" type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <label className="label">Kategori (opsional)</label>
        <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">— {direction === "receivable" ? "mis. Penjualan" : "mis. Pembelian"} —</option>
          {(categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={cashNow} onChange={(e) => setCashNow(e.target.checked)} />
        {cashLabel}
      </label>
      {cashNow && (
        <div>
          <label className="label">Akun kas/bank</label>
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">— Pilih akun —</option>
            {(accounts ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

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
  const [accountId, setAccountId] = useState("");

  const accounts = useLiveQuery(
    async () => (await db.accounts.where("businessId").equals(businessId).toArray()).filter((a) => !a.deletedAt && !a.isArchived),
    [businessId],
  );

  async function submit() {
    const rupiah = Number(amount);
    if (!rupiah || rupiah <= 0 || !accountId) return;
    const cents = Math.min(Math.round(rupiah * 100), remain);
    const newPaid = debt.paidCents + cents;
    const status = newPaid >= debt.amountCents ? "paid" : "partial";

    // Catat pembayaran (menggerakkan kas/bank) + perbarui sisa hutang/piutang.
    await saveLocal("debtPayments", businessId, { debtId: debt.id, amountCents: cents, paidAt: Date.now(), accountId, note: null });
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
      <div>
        <label className="label">{debt.direction === "receivable" ? "Uang masuk ke akun" : "Uang keluar dari akun"}</label>
        <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">— Pilih akun —</option>
          {(accounts ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
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
