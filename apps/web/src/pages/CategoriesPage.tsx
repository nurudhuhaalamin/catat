import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LCategory, type CategoryNature } from "../lib/db";
import { saveLocal, deleteLocal } from "../lib/sync";
import { useBusiness } from "../lib/businessContext";
import { Sheet } from "./TransactionsPage";

const NATURE_LABEL: Record<CategoryNature, string> = {
  pendapatan: "Pendapatan",
  modal: "Setoran modal",
  lainnya: "Penerimaan lain",
  beban: "Beban/biaya",
  aset: "Pembelian aset",
  prive: "Prive (ambil pribadi)",
};

export default function CategoriesPage() {
  const { current } = useBusiness();
  const businessId = current?.id ?? "";
  const canManage = current?.role === "owner" || current?.role === "admin";
  const [edit, setEdit] = useState<LCategory | "new" | null>(null);

  const cats = useLiveQuery(
    async () => (businessId ? (await db.categories.where("businessId").equals(businessId).toArray()).filter((c) => !c.deletedAt) : []),
    [businessId],
  );

  const income = (cats ?? []).filter((c) => c.kind === "income");
  const expense = (cats ?? []).filter((c) => c.kind === "expense");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Kategori</h2>
        {canManage && (
          <button className="btn-primary py-2" onClick={() => setEdit("new")}>
            + Kategori
          </button>
        )}
      </div>

      <Group title="Pemasukan" rows={income} onEdit={canManage ? setEdit : undefined} />
      <Group title="Pengeluaran" rows={expense} onEdit={canManage ? setEdit : undefined} />

      {edit && <EditCategory businessId={businessId} category={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function Group({ title, rows, onEdit }: { title: string; rows: LCategory[]; onEdit?: (c: LCategory) => void }) {
  return (
    <section className="card">
      <h3 className="mb-2 font-semibold text-slate-600">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-300">Belum ada.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center justify-between">
              <span>
                {c.name} <span className="text-xs text-slate-400">· {NATURE_LABEL[c.nature]}</span>
              </span>
              {onEdit && (
                <button className="text-slate-300 hover:text-brand" onClick={() => onEdit(c)}>
                  ✎
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EditCategory({ businessId, category, onClose }: { businessId: string; category: LCategory | null; onClose: () => void }) {
  const [kind, setKind] = useState<"income" | "expense">(category?.kind ?? "income");
  const [name, setName] = useState(category?.name ?? "");
  const [nature, setNature] = useState<CategoryNature>(category?.nature ?? "pendapatan");

  const natureOptions: CategoryNature[] = kind === "income" ? ["pendapatan", "modal", "lainnya"] : ["beban", "aset", "prive"];

  function changeKind(k: "income" | "expense") {
    setKind(k);
    setNature(k === "income" ? "pendapatan" : "beban");
  }

  async function submit() {
    if (!name.trim()) return;
    await saveLocal("categories", businessId, { ...(category ?? {}), kind, name: name.trim(), nature });
    onClose();
  }
  async function remove() {
    if (category) await deleteLocal("categories", businessId, category.id);
    onClose();
  }

  return (
    <Sheet title={category ? "Ubah kategori" : "Tambah kategori"} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <button className={tab(kind === "income")} onClick={() => changeKind("income")}>
          Pemasukan
        </button>
        <button className={tab(kind === "expense")} onClick={() => changeKind("expense")}>
          Pengeluaran
        </button>
      </div>
      <div>
        <label className="label">Nama kategori</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div>
        <label className="label">Jenis (untuk laporan)</label>
        <select className="input" value={nature} onChange={(e) => setNature(e.target.value as CategoryNature)}>
          {natureOptions.map((n) => (
            <option key={n} value={n}>
              {NATURE_LABEL[n]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">
          Default sudah benar untuk kebanyakan kasus. Pilih "Pembelian aset" bila membeli barang
          modal, atau "Setoran modal" untuk tambahan modal.
        </p>
      </div>
      <button className="btn-primary w-full" onClick={submit}>
        Simpan
      </button>
      {category && (
        <button className="btn-ghost w-full text-red-600" onClick={remove}>
          Hapus kategori
        </button>
      )}
    </Sheet>
  );
}

function tab(active: boolean) {
  return `rounded-xl py-2.5 font-medium ${active ? "bg-brand text-white" : "bg-slate-100 text-slate-500"}`;
}
