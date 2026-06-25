import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LContact } from "../lib/db";
import { saveLocal, deleteLocal } from "../lib/sync";
import { useBusiness } from "../lib/businessContext";
import { Sheet } from "./TransactionsPage";

export default function ContactsPage() {
  const { current } = useBusiness();
  const businessId = current?.id ?? "";
  const canRecord = current?.role !== "viewer";
  const [sheet, setSheet] = useState<LContact | "new" | null>(null);

  const contacts = useLiveQuery(
    async () => (businessId ? (await db.contacts.where("businessId").equals(businessId).toArray()).filter((c) => !c.deletedAt) : []),
    [businessId],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Kontak</h2>
        {canRecord && (
          <button className="btn-primary py-2" onClick={() => setSheet("new")}>
            + Tambah
          </button>
        )}
      </div>

      {(contacts ?? []).length === 0 && <p className="py-10 text-center text-slate-400">Belum ada kontak.</p>}

      <ul className="space-y-2">
        {(contacts ?? []).map((c) => (
          <li
            key={c.id}
            className={`card flex items-center justify-between ${canRecord ? "cursor-pointer active:bg-slate-50" : ""}`}
            onClick={canRecord ? () => setSheet(c) : undefined}
          >
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-slate-400">
                {c.type === "customer" ? "Pelanggan" : c.type === "supplier" ? "Pemasok" : "Pelanggan & Pemasok"}
                {c.phone ? ` · ${c.phone}` : ""}
              </p>
            </div>
            {canRecord && (
              <button
                className="text-slate-300 hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteLocal("contacts", businessId, c.id);
                }}
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      {sheet && <AddContact businessId={businessId} contact={sheet === "new" ? null : sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

function AddContact({ businessId, contact, onClose }: { businessId: string; contact: LContact | null; onClose: () => void }) {
  const [name, setName] = useState(contact?.name ?? "");
  const [type, setType] = useState<"customer" | "supplier" | "both">(contact?.type ?? "both");
  const [phone, setPhone] = useState(contact?.phone ?? "");

  async function submit() {
    if (!name.trim()) return;
    await saveLocal("contacts", businessId, { ...(contact ?? {}), name: name.trim(), type, phone: phone || null });
    onClose();
  }

  return (
    <Sheet title={contact ? "Ubah kontak" : "Tambah kontak"} onClose={onClose}>
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
