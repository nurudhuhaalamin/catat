import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { formatMoney } from "@catat/shared";
import { db, type LAccount } from "../lib/db";
import { accountBalances } from "../lib/finance";
import { saveLocal, deleteLocal } from "../lib/sync";
import { useBusiness } from "../lib/businessContext";
import { Sheet } from "./TransactionsPage";

export default function AccountsPage() {
  const { current } = useBusiness();
  const businessId = current?.id ?? "";
  const currency = current?.currency ?? "IDR";
  const canManage = current?.role === "owner" || current?.role === "admin";
  const [edit, setEdit] = useState<LAccount | "new" | null>(null);

  const data = useLiveQuery(async () => {
    if (!businessId) return null;
    const [accounts, txs, debts, payments] = await Promise.all([
      db.accounts.where("businessId").equals(businessId).toArray(),
      db.transactions.where("businessId").equals(businessId).toArray(),
      db.debts.where("businessId").equals(businessId).toArray(),
      db.debtPayments.where("businessId").equals(businessId).toArray(),
    ]);
    const live = accounts.filter((a) => !a.deletedAt && !a.isArchived);
    const bal = accountBalances(accounts, txs, debts, payments);
    return { accounts: live, bal };
  }, [businessId]);

  const accounts = data?.accounts ?? [];
  const total = accounts.reduce((s, a) => s + (data?.bal.get(a.id) ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Akun Kas & Bank</h2>
        {canManage && (
          <button className="btn-primary py-2" onClick={() => setEdit("new")}>
            + Akun
          </button>
        )}
      </div>

      <div className="card bg-brand text-white">
        <p className="text-sm text-white/80">Total saldo</p>
        <p className="mt-1 text-2xl font-bold">{formatMoney(total, currency)}</p>
      </div>

      {accounts.length === 0 && <p className="py-8 text-center text-slate-400">Belum ada akun.</p>}

      <ul className="space-y-2">
        {accounts.map((a) => (
          <li key={a.id} className="card flex items-center justify-between">
            <div>
              <p className="font-medium">
                {a.name} <span className="text-xs text-slate-400">{a.type === "bank" ? "Bank" : a.type === "cash" ? "Kas" : "Lain"}</span>
              </p>
              <p className="text-xs text-slate-400">Saldo awal {formatMoney(a.openingBalanceCents, currency)}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold">{formatMoney(data?.bal.get(a.id) ?? 0, currency)}</span>
              {canManage && (
                <button className="text-slate-300 hover:text-brand" onClick={() => setEdit(a)} title="Ubah">
                  ✎
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {edit && <EditAccount businessId={businessId} account={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EditAccount({ businessId, account, onClose }: { businessId: string; account: LAccount | null; onClose: () => void }) {
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<"cash" | "bank" | "other">(account?.type ?? "cash");
  const [opening, setOpening] = useState(account ? String(account.openingBalanceCents / 100) : "0");

  async function submit() {
    if (!name.trim()) return;
    await saveLocal("accounts", businessId, {
      ...(account ?? {}),
      name: name.trim(),
      type,
      openingBalanceCents: Math.round(Number(opening || "0") * 100),
      isArchived: false,
    });
    onClose();
  }

  async function remove() {
    if (account) await deleteLocal("accounts", businessId, account.id);
    onClose();
  }

  return (
    <Sheet title={account ? "Ubah akun" : "Tambah akun"} onClose={onClose}>
      <div>
        <label className="label">Nama akun</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. BCA, Kas Toko" autoFocus />
      </div>
      <div>
        <label className="label">Jenis</label>
        <select className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="cash">Kas (tunai)</option>
          <option value="bank">Bank</option>
          <option value="other">Lainnya</option>
        </select>
      </div>
      <div>
        <label className="label">Saldo awal (Rp)</label>
        <input className="input" type="number" inputMode="numeric" value={opening} onChange={(e) => setOpening(e.target.value)} />
      </div>
      <button className="btn-primary w-full" onClick={submit}>
        Simpan
      </button>
      {account && (
        <button className="btn-ghost w-full text-red-600" onClick={remove}>
          Hapus akun
        </button>
      )}
    </Sheet>
  );
}
