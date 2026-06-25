import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { saveLocal, deleteLocal } from "../lib/sync";
import { useBusiness } from "../lib/businessContext";
import { Sheet } from "./TransactionsPage";

export default function ContactsPage() {
  const { current } = useBusiness();
  const businessId = current?.id ?? "";
  const [open, setOpen] = useState(false);

  const contacts = useLiveQuery(
    async () => (businessId ? (await db.contacts.where("businessId").equals(businessId).toArray()).filter((c) => !c.deletedAt) : []),
    [businessId],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Kontak</h2>
        <button className="btn-primary py-2" onClick={() => setOpen(true)}>
          + Tambah
        </button>
      </div>

      {(contacts ?? []).length === 0 && <p className="py-10 text-center text-slate-400">Belum ada kontak.</p>}

      <ul className="space-y-2">
        {(contacts ?? []).map((c) => (
          <li key={c.id} className="card flex items-center justify-between">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-slate-400">
                {c.type === "customer" ? "Pelanggan" : c.type === "supplier" ? "Pemasok" : "Pelanggan & Pemasok"}
                {c.phone ? ` · ${c.phone}` : ""}
              </p>
            </div>
            <button className="text-slate-300 hover:text-red-500" onClick={() => deleteLocal("contacts", businessId, c.id)}>
              ✕
            </button>
          </li>
        ))}
      </ul>

      {open && <AddContact businessId={businessId} onClose={() => setOpen(false)} />}
    </div>
  );
}

function AddContact({ businessId, onClose }: { businessId: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"customer" | "supplier" | "both">("both");
  const [phone, setPhone] = useState("");

  async function submit() {
    if (!name.trim()) return;
    await saveLocal("contacts", businessId, { name: name.trim(), type, phone: phone || null, note: null });
    onClose();
  }

  return (
    <Sheet title="Tambah kontak" onClose={onClose}>
      <div>
        <label className="label">Nama</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div>
        <label className="label">Jenis</label>
        <select className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="both">Pelanggan & Pemasok</option>
          <option value="customer">Pelanggan</option>
          <option value="supplier">Pemasok</option>
        </select>
      </div>
      <div>
        <label className="label">No. HP (opsional)</label>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
      </div>
      <button className="btn-primary w-full" onClick={submit}>
        Simpan
      </button>
    </Sheet>
  );
}
