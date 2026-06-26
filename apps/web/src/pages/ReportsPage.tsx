import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { formatMoney } from "@catat/shared";
import { db } from "../lib/db";
import { balanceSheet, type BalanceSheet } from "../lib/finance";
import { useBusiness } from "../lib/businessContext";
import { presetRange, customRange, presetLabel, type RangePreset, type DateRange } from "../lib/dateRange";
import { downloadCsv } from "../lib/csv";
import { exportPdf } from "../lib/pdf";

const DAY = 86_400_000;
const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

interface NamedTotal {
  id: string | null;
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

function agingRowsCsv(jenis: string, b: AgingBuckets): (string | number)[][] {
  return [
    [jenis, "Belum jatuh tempo", b.belum / 100],
    [jenis, "Lewat 1-30 hari", b.d1_30 / 100],
    [jenis, "Lewat 31-60 hari", b.d31_60 / 100],
    [jenis, "Lewat >60 hari", b.d60 / 100],
    [jenis, "Tanpa tanggal", b.tanpa / 100],
    [jenis, "Total", b.total / 100],
  ];
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
  const navigate = useNavigate();
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
    const [txAll, cats, debtsAll, contactsAll, accountsAll, paymentsAll] = await Promise.all([
      db.transactions.where("businessId").equals(businessId).toArray(),
      db.categories.where("businessId").equals(businessId).toArray(),
      db.debts.where("businessId").equals(businessId).toArray(),
      db.contacts.where("businessId").equals(businessId).toArray(),
      db.accounts.where("businessId").equals(businessId).toArray(),
      db.debtPayments.where("businessId").equals(businessId).toArray(),
    ]);
    const catName = new Map(cats.map((c) => [c.id, c.name]));
    const contactName = new Map(contactsAll.map((c) => [c.id, c.name]));

    const txs = txAll.filter((t) => !t.deletedAt && t.occurredAt >= range.from && t.occurredAt <= range.to);

    // Laba-rugi: kelompokkan per kategori (key = categoryId, "" = tanpa kategori).
    const incomeMap = new Map<string, { name: string; cents: number }>();
    const expenseMap = new Map<string, { name: string; cents: number }>();
    const monthMap = new Map<string, { income: number; expense: number }>();
    let totalIncome = 0;
    let totalExpense = 0;

    for (const t of txs) {
      if (t.type === "transfer") continue; // transfer bukan pemasukan/pengeluaran
      const catId = t.categoryId ?? "";
      const name = t.categoryId ? (catName.get(t.categoryId) ?? "Tanpa kategori") : "Tanpa kategori";
      const target = t.type === "income" ? incomeMap : expenseMap;
      const cur = target.get(catId) ?? { name, cents: 0 };
      cur.cents += t.amountCents;
      target.set(catId, cur);
      if (t.type === "income") totalIncome += t.amountCents;
      else totalExpense += t.amountCents;

      const d = new Date(t.occurredAt);
      const mk = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const bucket = monthMap.get(mk) ?? { income: 0, expense: 0 };
      if (t.type === "income") bucket.income += t.amountCents;
      else bucket.expense += t.amountCents;
      monthMap.set(mk, bucket);
    }

    const toSorted = (m: Map<string, { name: string; cents: number }>): NamedTotal[] =>
      [...m.entries()].map(([id, v]) => ({ id: id || null, name: v.name, cents: v.cents })).sort((a, b) => b.cents - a.cents);

    const cashflow = [...monthMap.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([mk, v]) => {
        const [y, mo] = mk.split("-").map(Number);
        const from = new Date(y, mo, 1).getTime();
        const to = new Date(y, mo + 1, 0, 23, 59, 59, 999).getTime();
        return { label: `${MONTHS_ID[mo]} ${y}`, income: v.income, expense: v.expense, from, to };
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
      range,
      bs: balanceSheet(accountsAll, txAll, debtsAll, paymentsAll, cats),
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
  const r = report;
  const businessName = current?.name ?? "Usaha";
  const period = `${new Date(r.range.from).toLocaleDateString("id-ID")} – ${new Date(r.range.to).toLocaleDateString("id-ID")}`;
  const pdfBase = (title: string, fileName: string, tables: { title?: string; head: string[]; rows: (string | number)[][] }[]) =>
    exportPdf({ fileName, business: businessName, title, period, tables });

  // Tabel-tabel per laporan (dipakai untuk PDF & CSV).
  const labaTables = () => {
    const inc = r.income.map((x) => [x.name, m(x.cents)]);
    inc.push(["TOTAL PEMASUKAN", m(r.totalIncome)]);
    const exp = r.expense.map((x) => [x.name, m(x.cents)]);
    exp.push(["TOTAL PENGELUARAN", m(r.totalExpense)]);
    return [
      { title: "Pemasukan", head: ["Kategori", "Jumlah"], rows: inc },
      { title: "Pengeluaran", head: ["Kategori", "Jumlah"], rows: exp },
      { title: "Ringkasan", head: ["Keterangan", "Jumlah"], rows: [["Laba/Rugi Bersih", m(r.net)]] },
    ];
  };
  const arusTables = () => [
    {
      head: ["Bulan", "Masuk", "Keluar", "Selisih"],
      rows: r.cashflow.map((c) => [c.label, m(c.income), m(c.expense), m(c.income - c.expense)]),
    },
  ];
  const neracaTables = () => [
    {
      title: "Saldo Kas & Bank",
      head: ["Akun", "Saldo"],
      rows: [...r.bs.cashByAccount.map((a) => [a.account.name, m(a.balance)]), ["TOTAL", m(r.bs.cashTotal)]],
    },
    {
      title: "Aset",
      head: ["Pos", "Jumlah"],
      rows: [
        ["Kas & Bank", m(r.bs.cashTotal)],
        ["Piutang", m(r.bs.receivable)],
        ["Aset lain", m(r.bs.otherAssets)],
        ["TOTAL ASET", m(r.bs.assets)],
      ],
    },
    {
      title: "Liabilitas & Ekuitas",
      head: ["Pos", "Jumlah"],
      rows: [
        ["Hutang", m(r.bs.liabilities)],
        ["Modal", m(r.bs.capital)],
        ["Laba (rugi) berjalan", m(r.bs.profit)],
        ["TOTAL LIABILITAS & EKUITAS", m(r.bs.liabilities + r.bs.equity)],
      ],
    },
  ];
  const agingRows = (b: AgingBuckets) => [
    ["Belum jatuh tempo", m(b.belum)],
    ["Lewat 1–30 hari", m(b.d1_30)],
    ["Lewat 31–60 hari", m(b.d31_60)],
    ["Lewat >60 hari", m(b.d60)],
    ["Tanpa tanggal", m(b.tanpa)],
    ["TOTAL", m(b.total)],
  ];
  const agingTables = () => [
    { title: "Piutang", head: ["Umur", "Jumlah"], rows: agingRows(r.receivable) },
    { title: "Hutang", head: ["Umur", "Jumlah"], rows: agingRows(r.payable) },
  ];

  const EXPORTS: { label: string; csv: () => void; pdf: () => void }[] = [
    {
      label: "Laba-Rugi",
      pdf: () => pdfBase("Laporan Laba-Rugi", "laba-rugi.pdf", labaTables()),
      csv: () =>
        downloadCsv(
          "laba-rugi.csv",
          ["Bagian", "Kategori", "Jumlah"],
          [
            ...r.income.map((x) => ["Pemasukan", x.name, x.cents / 100]),
            ...r.expense.map((x) => ["Pengeluaran", x.name, x.cents / 100]),
            ["Ringkasan", "Laba/Rugi Bersih", r.net / 100],
          ],
        ),
    },
    {
      label: "Arus Kas",
      pdf: () => pdfBase("Laporan Arus Kas", "arus-kas.pdf", arusTables()),
      csv: () =>
        downloadCsv(
          "arus-kas.csv",
          ["Bulan", "Masuk", "Keluar", "Selisih"],
          r.cashflow.map((c) => [c.label, c.income / 100, c.expense / 100, (c.income - c.expense) / 100]),
        ),
    },
    {
      label: "Posisi Keuangan (Neraca)",
      pdf: () => pdfBase("Laporan Posisi Keuangan", "posisi-keuangan.pdf", neracaTables()),
      csv: () =>
        downloadCsv("posisi-keuangan.csv", ["Pos", "Jumlah"], [
          ...r.bs.cashByAccount.map((a) => [`Saldo ${a.account.name}`, a.balance / 100]),
          ["Total Kas & Bank", r.bs.cashTotal / 100],
          ["Piutang", r.bs.receivable / 100],
          ["Aset lain", r.bs.otherAssets / 100],
          ["Total Aset", r.bs.assets / 100],
          ["Hutang", r.bs.liabilities / 100],
          ["Modal", r.bs.capital / 100],
          ["Laba berjalan", r.bs.profit / 100],
          ["Ekuitas", r.bs.equity / 100],
        ]),
    },
    {
      label: "Umur Piutang & Hutang",
      pdf: () => pdfBase("Umur Piutang & Hutang", "umur-piutang-hutang.pdf", agingTables()),
      csv: () =>
        downloadCsv("umur-piutang-hutang.csv", ["Jenis", "Umur", "Jumlah"], [
          ...agingRowsCsv("Piutang", r.receivable),
          ...agingRowsCsv("Hutang", r.payable),
        ]),
    },
    {
      label: "Transaksi (rinci)",
      pdf: () =>
        pdfBase("Daftar Transaksi", "transaksi.pdf", [
          {
            head: ["Tanggal", "Tipe", "Kategori", "Akun", "Jumlah", "Catatan"],
            rows: r.txForCsv.map((x) => [x.tanggal, x.tipe, x.kategori, x.kontak, m(Math.round(x.jumlah * 100)), x.catatan]),
          },
        ]),
      csv: () =>
        downloadCsv(
          "transaksi.csv",
          ["Tanggal", "Tipe", "Kategori", "Kontak", "Jumlah", "Catatan"],
          r.txForCsv.map((x) => [x.tanggal, x.tipe, x.kategori, x.kontak, x.jumlah, x.catatan]),
        ),
    },
    {
      label: "Piutang & Hutang (rinci)",
      pdf: () =>
        pdfBase("Daftar Piutang & Hutang", "piutang-hutang.pdf", [
          {
            head: ["Jenis", "Kontak", "Jumlah", "Sisa", "Jatuh Tempo", "Status"],
            rows: r.debtsForCsv.map((x) => [x.jenis, x.kontak, m(Math.round(x.jumlah * 100)), m(Math.round(x.sisa * 100)), x.jatuhTempo, x.status]),
          },
        ]),
      csv: () =>
        downloadCsv(
          "piutang-hutang.csv",
          ["Jenis", "Kontak", "Jumlah", "Dibayar", "Sisa", "Jatuh Tempo", "Status", "Catatan"],
          r.debtsForCsv.map((x) => [x.jenis, x.kontak, x.jumlah, x.dibayar, x.sisa, x.jatuhTempo, x.status, x.catatan]),
        ),
    },
  ];

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
        <CatList
          title="Pemasukan"
          rows={report.income}
          tone="text-emerald-600"
          fmt={m}
          onRow={(r) =>
            navigate(
              `/transactions?type=income&from=${report.range.from}&to=${report.range.to}${r.id ? `&category=${r.id}` : ""}`,
            )
          }
        />
        <CatList
          title="Pengeluaran"
          rows={report.expense}
          tone="text-red-600"
          fmt={m}
          onRow={(r) =>
            navigate(
              `/transactions?type=expense&from=${report.range.from}&to=${report.range.to}${r.id ? `&category=${r.id}` : ""}`,
            )
          }
        />
        <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
          <Row label="Total Pemasukan" value={m(report.totalIncome)} />
          <Row label="Total Pengeluaran" value={m(report.totalExpense)} />
          <div className="flex justify-between pt-1 text-base font-bold">
            <span>Laba/Rugi Bersih</span>
            <span className={report.net >= 0 ? "text-emerald-600" : "text-red-600"}>{m(report.net)}</span>
          </div>
        </div>
      </section>

      {/* Posisi Keuangan / Neraca */}
      <PosisiKeuangan bs={report.bs} fmt={m} onAccount={(id) => navigate(`/transactions?account=${id}`)} />

      {/* Arus Kas */}
      <section className="card space-y-2">
        <h3 className="font-bold">Arus Kas per Bulan</h3>
        {report.cashflow.length === 0 && <p className="text-sm text-slate-400">Belum ada transaksi pada rentang ini.</p>}
        {report.cashflow.map((c) => (
          <button
            key={c.label}
            className="w-full border-b border-slate-50 py-1.5 text-left last:border-0 active:bg-slate-50"
            onClick={() => navigate(`/transactions?from=${c.from}&to=${c.to}`)}
          >
            <div className="flex justify-between text-sm font-medium">
              <span>{c.label} ›</span>
              <span className={c.income - c.expense >= 0 ? "text-emerald-600" : "text-red-600"}>{m(c.income - c.expense)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Masuk {m(c.income)}</span>
              <span>Keluar {m(c.expense)}</span>
            </div>
          </button>
        ))}
      </section>

      {/* Aging */}
      <section className="card space-y-3">
        <h3 className="font-bold">Umur Piutang & Hutang</h3>
        <AgingTable title="Piutang (orang berhutang ke kita)" b={report.receivable} fmt={m} onClick={() => navigate("/debts?dir=receivable")} />
        <AgingTable title="Hutang (kita berhutang)" b={report.payable} fmt={m} onClick={() => navigate("/debts?dir=payable")} />
        <p className="text-xs text-slate-400">Berdasarkan sisa yang belum lunas per hari ini. Ketuk untuk lihat daftar.</p>
      </section>

      {/* Export */}
      <section className="card space-y-2">
        <h3 className="font-bold">Export Laporan</h3>
        <p className="text-xs text-slate-400">Sesuai rentang terpilih ({period}).</p>
        {EXPORTS.map((ex) => (
          <div key={ex.label} className="flex items-center justify-between gap-2 border-b border-slate-50 py-1.5 last:border-0">
            <span className="text-sm">{ex.label}</span>
            <div className="flex gap-2">
              <button className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 active:bg-slate-50" onClick={ex.csv}>
                CSV
              </button>
              <button className="rounded-lg bg-brand px-3 py-1 text-xs font-medium text-white active:bg-brand-dark" onClick={ex.pdf}>
                PDF
              </button>
            </div>
          </div>
        ))}
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

function CatList({
  title,
  rows,
  tone,
  fmt,
  onRow,
}: {
  title: string;
  rows: NamedTotal[];
  tone: string;
  fmt: (c: number) => string;
  onRow?: (r: NamedTotal) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-slate-500">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-300">—</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.id ?? r.name}>
              <button className="flex w-full justify-between text-sm active:opacity-70" onClick={() => onRow?.(r)}>
                <span className="text-slate-600">{r.name} ›</span>
                <span className={tone}>{fmt(r.cents)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PosisiKeuangan({ bs, fmt, onAccount }: { bs: BalanceSheet; fmt: (c: number) => string; onAccount?: (id: string) => void }) {
  return (
    <section className="card space-y-3">
      <h3 className="font-bold">Posisi Keuangan</h3>

      <div>
        <p className="mb-1 text-sm font-semibold text-slate-500">Saldo Kas & Bank</p>
        <ul className="space-y-1 text-sm">
          {bs.cashByAccount.map(({ account, balance }) => (
            <li key={account.id}>
              <button className="flex w-full justify-between active:opacity-70" onClick={() => onAccount?.(account.id)}>
                <span className="text-slate-600">{account.name} ›</span>
                <span>{fmt(balance)}</span>
              </button>
            </li>
          ))}
          <li className="flex justify-between border-t border-slate-100 pt-1 font-semibold">
            <span>Total Kas & Bank</span>
            <span>{fmt(bs.cashTotal)}</span>
          </li>
        </ul>
      </div>

      <div className="space-y-1 border-t border-slate-100 pt-2 text-sm">
        <p className="text-sm font-semibold text-slate-500">Aset</p>
        <Line label="Kas & Bank" value={fmt(bs.cashTotal)} />
        <Line label="Piutang" value={fmt(bs.receivable)} />
        <Line label="Aset lain" value={fmt(bs.otherAssets)} />
        <Line label="Total Aset" value={fmt(bs.assets)} bold />
      </div>

      <div className="space-y-1 border-t border-slate-100 pt-2 text-sm">
        <p className="text-sm font-semibold text-slate-500">Liabilitas & Ekuitas</p>
        <Line label="Hutang" value={fmt(bs.liabilities)} />
        <Line label="Modal" value={fmt(bs.capital)} />
        <Line label={`Laba (rugi) berjalan`} value={fmt(bs.profit)} />
        <Line label="Total Liabilitas & Ekuitas" value={fmt(bs.liabilities + bs.equity)} bold />
      </div>

      <p className="text-xs text-slate-400">Kekayaan bersih (ekuitas): {fmt(bs.equity)}.</p>
    </section>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : "text-slate-600"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function AgingTable({ title, b, fmt, onClick }: { title: string; b: AgingBuckets; fmt: (c: number) => string; onClick?: () => void }) {
  const rows: [string, number][] = [
    ["Belum jatuh tempo", b.belum],
    ["Lewat 1–30 hari", b.d1_30],
    ["Lewat 31–60 hari", b.d31_60],
    ["Lewat >60 hari", b.d60],
    ["Tanpa tanggal", b.tanpa],
  ];
  return (
    <div>
      <button className="mb-1 text-sm font-semibold text-brand active:opacity-70" onClick={onClick}>
        {title} ›
      </button>
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
