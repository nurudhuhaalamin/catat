import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { formatMoney } from "@catat/shared";
import { db } from "../lib/db";
import { useBusiness } from "../lib/businessContext";
import { presetRange, customRange, presetLabel, type RangePreset, type DateRange } from "../lib/dateRange";
import { downloadCsv } from "../lib/csv";

const DAY = 86_400_000;
const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

interface NamedTotal {
  name: string;
  cents: number;
}

interface AgingBuckets {
  belum: number;
  d1_30: number;
  d31_60: number;
  d60: number;
  tanpa: number;
  total: number;
}

function emptyAging(): AgingBuckets {
  return { belum: 0, d1_30: 0, d31_60: 0, d60: 0, tanpa: 0, total: 0 };
}

function addAging(b: AgingBuckets, remain: number, dueDate: number | null | undefined, now: number) {
  b.total += remain;
  if (!dueDate) return void (b.tanpa += remain);
  if (dueDate >= now) return void (b.belum += remain);
  const overdue = Math.floor((now - dueDate) / DAY);
  if (overdue <= 30) b.d1_30 += remain;
  else if (overdue <= 60) b.d31_60 += remain;
  else b.d60 += remain;
}

export default function ReportsPage() {
  const { current } = useBusiness();
  const businessId = current?.id ?? "";
  const currency = current?.currency ?? "IDR";

  const [preset, setPreset] = useState<RangePreset>("this_month");
  const [fromStr, setFromStr] = useState(() => new Date().toISOString().slice(0, 10));
  const [toStr, setToStr] = useState(() => new Date().toISOString().slice(0, 10));

  const range: DateRange = useMemo(
    () => (preset === "custom" ? customRange(fromStr, toStr) : presetRange(preset)),
    [preset, fromStr, toStr],
  );

  const report = useLiveQuery(async () => {
    if (!businessId) return null;
    const [txAll, cats, debtsAll, contactsAll] = await Promise.all([
      db.transactions.where("businessId").equals(businessId).toArray(),
      db.categories.where("businessId").equals(businessId).toArray(),
      db.debts.where("businessId").equals(businessId).toArray(),
      db.contacts.where("businessId").equals(businessId).toArray(),
    ]);
    const catName = new Map(cats.map((c) => [c.id, c.name]));
    const contactName = new Map(contactsAll.map((c) => [c.id, c.name]));

    const txs = txAll.filter((t) => !t.deletedAt && t.occurredAt >= range.from && t.occurredAt <= range.to);

    // Laba-rugi: kelompokkan per kategori.
    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();
    const monthMap = new Map<string, { income: number; expense: number }>();
    let totalIncome = 0;
    let totalExpense = 0;

    for (const t of txs) {
      const key = t.categoryId ? (catName.get(t.categoryId) ?? "Tanpa kategori") : "Tanpa kategori";
      const target = t.type === "income" ? incomeMap : expenseMap;
      target.set(key, (target.get(key) ?? 0) + t.amountCents);
      if (t.type === "income") totalIncome += t.amountCents;
      else totalExpense += t.amountCents;

      const d = new Date(t.occurredAt);
      const mk = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const bucket = monthMap.get(mk) ?? { income: 0, expense: 0 };
      if (t.type === "income") bucket.income += t.amountCents;
      else bucket.expense += t.amountCents;
      monthMap.set(mk, bucket);
    }

    const toSorted = (m: Map<string, number>): NamedTotal[] =>
      [...m.entries()].map(([name, cents]) => ({ name, cents })).sort((a, b) => b.cents - a.cents);

    const cashflow = [...monthMap.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([mk, v]) => {
        const [y, mo] = mk.split("-");
        return { label: `${MONTHS_ID[Number(mo)]} ${y}`, income: v.income, expense: v.expense };
      });

    // Aging piutang & hutang dari sisa hutang yang belum lunas.
    const now = Date.now();
    const receivable = emptyAging();
    const payable = emptyAging();
    for (const dRow of debtsAll) {
      if (dRow.deletedAt || dRow.status === "paid") continue;
      const remain = dRow.amountCents - dRow.paidCents;
      if (remain <= 0) continue;
      addAging(dRow.direction === "receivable" ? receivable : payable, remain, dRow.dueDate, now);
    }

    return {
      income: toSorted(incomeMap),
      expense: toSorted(expenseMap),
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
      cashflow,
      receivable,
      payable,
      txForCsv: txs
        .slice()
        .sort((a, b) => a.occurredAt - b.occurredAt)
        .map((t) => ({
          tanggal: new Date(t.occurredAt).toLocaleDateString("id-ID"),
          tipe: t.type === "income" ? "Masuk" : "Keluar",
          kategori: t.categoryId ? (catName.get(t.categoryId) ?? "") : "",
          kontak: t.contactId ? (contactName.get(t.contactId) ?? "") : "",
          jumlah: t.amountCents / 100,
          catatan: t.note ?? "",
        })),
      debtsForCsv: debtsAll
        .filter((d) => !d.deletedAt)
        .map((d) => ({
          jenis: d.direction === "receivable" ? "Piutang" : "Hutang",
          kontak: contactName.get(d.contactId) ?? "",
          jumlah: d.amountCents / 100,
          dibayar: d.paidCents / 100,
          sisa: (d.amountCents - d.paidCents) / 100,
          jatuhTempo: d.dueDate ? new Date(d.dueDate).toLocaleDateString("id-ID") : "",
          status: d.status,
          catatan: d.note ?? "",
        })),
    };
  }, [businessId, range.from, range.to]);

  if (!report) return <p className="text-slate-400">Memuat…</p>;

  const m = (c: number) => formatMoney(c, currency);

  function exportTransaksi() {
    if (!report) return;
    downloadCsv(
      `transaksi-${fromStr}.csv`,
      ["Tanggal", "Tipe", "Kategori", "Kontak", "Jumlah", "Catatan"],
      report.txForCsv.map((r) => [r.tanggal, r.tipe, r.kategori, r.kontak, r.jumlah, r.catatan]),
    );
  }
  function exportHutang() {
    if (!report) return;
    downloadCsv(
      `piutang-hutang.csv`,
      ["Jenis", "Kontak", "Jumlah", "Dibayar", "Sisa", "Jatuh Tempo", "Status", "Catatan"],
      report.debtsForCsv.map((r) => [r.jenis, r.kontak, r.jumlah, r.dibayar, r.sisa, r.jatuhTempo, r.status, r.catatan]),
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Laporan</h2>

      {/* Pemilih rentang */}
      <div className="flex flex-wrap gap-2">
        {(["this_month", "last_month", "this_year", "custom"] as RangePreset[]).map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              preset === p ? "bg-brand text-white" : "bg-white text-slate-500 border border-slate-200"
            }`}
          >
            {presetLabel(p)}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <input className="input" type="date" value={fromStr} onChange={(e) => setFromStr(e.target.value)} />
          <span className="text-slate-400">s/d</span>
          <input className="input" type="date" value={toStr} onChange={(e) => setToStr(e.target.value)} />
        </div>
      )}

      {/* Laba-Rugi */}
      <section className="card space-y-3">
        <h3 className="font-bold">Laba-Rugi</h3>
        <CatList title="Pemasukan" rows={report.income} tone="text-emerald-600" fmt={m} />
        <CatList title="Pengeluaran" rows={report.expense} tone="text-red-600" fmt={m} />
        <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
          <Row label="Total Pemasukan" value={m(report.totalIncome)} />
          <Row label="Total Pengeluaran" value={m(report.totalExpense)} />
          <div className="flex justify-between pt-1 text-base font-bold">
            <span>Laba/Rugi Bersih</span>
            <span className={report.net >= 0 ? "text-emerald-600" : "text-red-600"}>{m(report.net)}</span>
          </div>
        </div>
        <p className="text-xs text-slate-400">Berbasis kas (pemasukan − pengeluaran), tanpa HPP stok.</p>
      </section>

      {/* Arus Kas */}
      <section className="card space-y-2">
        <h3 className="font-bold">Arus Kas per Bulan</h3>
        {report.cashflow.length === 0 && <p className="text-sm text-slate-400">Belum ada transaksi pada rentang ini.</p>}
        {report.cashflow.map((c) => (
          <div key={c.label} className="border-b border-slate-50 py-1.5 last:border-0">
            <div className="flex justify-between text-sm font-medium">
              <span>{c.label}</span>
              <span className={c.income - c.expense >= 0 ? "text-emerald-600" : "text-red-600"}>
                {m(c.income - c.expense)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Masuk {m(c.income)}</span>
              <span>Keluar {m(c.expense)}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Aging */}
      <section className="card space-y-3">
        <h3 className="font-bold">Umur Piutang & Hutang</h3>
        <AgingTable title="Piutang (orang berhutang ke kita)" b={report.receivable} fmt={m} />
        <AgingTable title="Hutang (kita berhutang)" b={report.payable} fmt={m} />
        <p className="text-xs text-slate-400">Berdasarkan sisa yang belum lunas per hari ini.</p>
      </section>

      {/* Export */}
      <section className="card space-y-2">
        <h3 className="font-bold">Export</h3>
        <button className="btn-ghost w-full justify-start" onClick={exportTransaksi}>
          ⬇️ Transaksi (CSV) — sesuai rentang
        </button>
        <button className="btn-ghost w-full justify-start" onClick={exportHutang}>
          ⬇️ Piutang & Hutang (CSV)
        </button>
        <button className="btn-ghost w-full justify-start" onClick={() => window.print()}>
          🖨️ Cetak / simpan PDF
        </button>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function CatList({ title, rows, tone, fmt }: { title: string; rows: NamedTotal[]; tone: string; fmt: (c: number) => string }) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-slate-500">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-300">—</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.name} className="flex justify-between text-sm">
              <span className="text-slate-600">{r.name}</span>
              <span className={tone}>{fmt(r.cents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AgingTable({ title, b, fmt }: { title: string; b: AgingBuckets; fmt: (c: number) => string }) {
  const rows: [string, number][] = [
    ["Belum jatuh tempo", b.belum],
    ["Lewat 1–30 hari", b.d1_30],
    ["Lewat 31–60 hari", b.d31_60],
    ["Lewat >60 hari", b.d60],
    ["Tanpa tanggal", b.tanpa],
  ];
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-slate-500">{title}</p>
      <ul className="space-y-1">
        {rows.map(([label, cents]) => (
          <li key={label} className="flex justify-between text-sm">
            <span className="text-slate-600">{label}</span>
            <span className={cents > 0 ? "text-slate-800" : "text-slate-300"}>{fmt(cents)}</span>
          </li>
        ))}
        <li className="flex justify-between border-t border-slate-100 pt-1 text-sm font-bold">
          <span>Total</span>
          <span>{fmt(b.total)}</span>
        </li>
      </ul>
    </div>
  );
}
