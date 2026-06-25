export type RangePreset = "this_month" | "last_month" | "this_year" | "custom";

export interface DateRange {
  from: number; // epoch ms (inklusif)
  to: number; // epoch ms (inklusif, akhir hari)
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

export function presetRange(preset: Exclude<RangePreset, "custom">, now = new Date()): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "this_month":
      return { from: new Date(y, m, 1).getTime(), to: endOfDay(new Date(y, m + 1, 0)) };
    case "last_month":
      return { from: new Date(y, m - 1, 1).getTime(), to: endOfDay(new Date(y, m, 0)) };
    case "this_year":
      return { from: new Date(y, 0, 1).getTime(), to: endOfDay(new Date(y, 11, 31)) };
  }
}

// Bangun rentang dari dua input <input type="date"> (string "YYYY-MM-DD").
export function customRange(fromStr: string, toStr: string): DateRange {
  const from = fromStr ? startOfDay(new Date(fromStr)) : 0;
  const to = toStr ? endOfDay(new Date(toStr)) : Date.now();
  return { from, to };
}

export function presetLabel(preset: RangePreset): string {
  return { this_month: "Bulan ini", last_month: "Bulan lalu", this_year: "Tahun ini", custom: "Kustom" }[preset];
}
