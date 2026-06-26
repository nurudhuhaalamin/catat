// Pembuat PDF laporan (berformat) di sisi klien. jsPDF di-import dinamis agar tidak
// membebani bundle awal — hanya dimuat saat user menekan "PDF".

export interface PdfTable {
  title?: string;
  head: string[];
  rows: (string | number)[][];
}

export interface PdfDoc {
  fileName: string;
  business: string;
  title: string;
  period?: string;
  tables: PdfTable[];
}

export async function exportPdf(doc: PdfDoc): Promise<void> {
  const { default: JsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const pdf = new JsPDF({ unit: "mm", format: "a4" });
  pdf.setFontSize(16);
  pdf.text(doc.business, 14, 18);
  pdf.setFontSize(12);
  pdf.text(doc.title, 14, 25);
  let y = 31;
  if (doc.period) {
    pdf.setFontSize(10);
    pdf.setTextColor(110);
    pdf.text(doc.period, 14, y);
    pdf.setTextColor(0);
    y += 6;
  }

  for (const t of doc.tables) {
    if (t.title) {
      pdf.setFontSize(11);
      pdf.text(t.title, 14, y);
      y += 2;
    }
    autoTable(pdf, {
      head: [t.head],
      body: t.rows.map((r) => r.map((c) => String(c))),
      startY: y,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9, cellPadding: 1.5 },
      headStyles: { fillColor: [15, 118, 110] },
    });
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  const generated = new Date().toLocaleString("id-ID");
  pdf.setFontSize(8);
  pdf.setTextColor(150);
  pdf.text(`Dibuat ${generated} · Catat`, 14, pdf.internal.pageSize.getHeight() - 8);

  pdf.save(doc.fileName);
}
