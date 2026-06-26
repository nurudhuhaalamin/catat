import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatMoney } from "@catat/shared";
import type { MonthPoint, CatSlice } from "../../lib/analytics";

export interface AnalyticsChartsProps {
  currency: string;
  series: MonthPoint[];
  expenseSlices: CatSlice[];
}

const DONUT = ["#0d9488", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#ec4899", "#84cc16"];
const axisTick = { fill: "#94a3b8", fontSize: 11 };
const grid = "#94a3b833";

function compact(cents: number): string {
  const v = cents / 100;
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, "") + "M";
  if (a >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "jt";
  if (a >= 1e3) return Math.round(v / 1e3) + "rb";
  return String(Math.round(v));
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="section-title mb-3 text-sm">{title}</h3>
      {children}
    </div>
  );
}

export default function AnalyticsCharts({ currency, series, expenseSlices }: AnalyticsChartsProps) {
  const money = (v: number) => formatMoney(v, currency);
  const tooltipStyle = {
    contentStyle: { borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,.12)", fontSize: 12 },
    formatter: (v: number) => money(v),
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <ChartCard title="Tren Arus Kas">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={series} margin={{ left: -10, right: 8, top: 6 }}>
            <defs>
              <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0d9488" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={compact} tick={axisTick} tickLine={false} axisLine={false} width={48} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="income" name="Masuk" stroke="#0d9488" fill="url(#gIncome)" strokeWidth={2} />
            <Area type="monotone" dataKey="expense" name="Keluar" stroke="#ef4444" fill="url(#gExpense)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Pemasukan vs Pengeluaran">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={series} margin={{ left: -10, right: 8, top: 6 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={compact} tick={axisTick} tickLine={false} axisLine={false} width={48} />
            <Tooltip {...tooltipStyle} cursor={{ fill: grid }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="income" name="Masuk" fill="#0d9488" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="Keluar" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Pengeluaran per Kategori">
        {expenseSlices.length === 0 ? (
          <div className="grid h-[220px] place-items-center muted text-sm">Belum ada pengeluaran pada periode ini.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={expenseSlices} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                {expenseSlices.map((_, i) => (
                  <Cell key={i} fill={DONUT[i % DONUT.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Tren Laba Bersih">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={series} margin={{ left: -10, right: 8, top: 6 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={compact} tick={axisTick} tickLine={false} axisLine={false} width={48} />
            <Tooltip {...tooltipStyle} />
            <Line type="monotone" dataKey="net" name="Laba bersih" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
