// Bangun CSV dari header + baris, lalu picu unduhan di browser.
type Cell = string | number | null | undefined;

function escapeCell(value: Cell): string {
  const s = value === null || value === undefined ? "" : String(value);
  // Bungkus dengan kutip bila mengandung koma, kutip, atau baris baru.
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  // BOM agar Excel membaca UTF-8 (penting untuk "Rp" & karakter non-ASCII).
  return "﻿" + lines.join("\r\n");
}

export function downloadCsv(filename: string, headers: string[], rows: Cell[][]): void {
  const blob = new Blob([buildCsv(headers, rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
