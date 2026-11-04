import type { jsPDF } from "jspdf";
import type { NoteBlock } from "./gpf-case";

export function drawDocumentPdf(pdf: jsPDF, title: string, subtitle: string, blocks: NoteBlock[], footer = "Demonstration document - fictional applicant; not an official order") {
  const margin = 18;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const bottom = pdf.internal.pageSize.getHeight() - 21;
  let y = 20;
  const printable = (text: string) => text.replace(/₹/g, "INR ").replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...").replace(/→/g, "to").replace(/×/g, "x");
  function header(continued: boolean) {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(13);
    pdf.text(printable(title), margin, 20);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
    const lines: string[] = pdf.splitTextToSize(printable(`${subtitle}${continued ? " (continued)" : ""}`), width);
    pdf.text(lines, margin, 27);
    y = 31 + (lines.length - 1) * 4;
    pdf.setDrawColor(140); pdf.line(margin, y, margin + width, y); y += 8;
  }
  function ensure(height: number) { if (y + height > bottom) { pdf.addPage(); header(true); } }
  header(false);
  for (const block of blocks) {
    if (block.kind === "paragraph") {
      if (block.text.startsWith("ANNEXURE A") && y > 80) { pdf.addPage(); header(true); }
      pdf.setFont("helvetica", block.bold ? "bold" : "normal"); pdf.setFontSize(10.5);
      const lines: string[] = pdf.splitTextToSize(printable(block.text), width);
      ensure(Math.min(lines.length, 3) * 4.7 + 3);
      for (const line of lines) {
        ensure(4.7);
        pdf.setFont("helvetica", block.bold ? "bold" : "normal"); pdf.setFontSize(10.5);
        pdf.text(line, margin, y);
        if (block.underline) pdf.line(margin, y + 0.7, margin + pdf.getTextWidth(line), y + 0.7);
        y += 4.7;
      }
      y += 3;
    } else {
      const count = block.rows[0]?.length ?? 1;
      const widths = count === 4 ? [0.08, 0.36, 0.34, 0.22].map((part) => part * width) : Array.from({ length: count }, () => width / count);
      for (const [index, row] of block.rows.entries()) {
        pdf.setFont("helvetica", index === 0 ? "bold" : "normal"); pdf.setFontSize(9.5);
        const cells = row.map((cell, column) => pdf.splitTextToSize(printable(cell), widths[column] - 4) as string[]);
        const height = Math.max(...cells.map((cell) => cell.length)) * 4.5 + 6;
        ensure(height + 2);
        pdf.setFont("helvetica", index === 0 ? "bold" : "normal"); pdf.setFontSize(9.5);
        let x = margin;
        for (let column = 0; column < count; column++) {
          const shade = index === 0 ? 242 : 255;
          pdf.setDrawColor(90); pdf.setFillColor(shade, shade, shade);
          pdf.rect(x, y, widths[column], height, "FD");
          pdf.text(cells[column] ?? [], x + 2, y + 5, { lineHeightFactor: 1.34 });
          x += widths[column];
        }
        y += height;
      }
      y += 7;
    }
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(90);
    pdf.text(printable(footer), margin, pdf.internal.pageSize.getHeight() - 12);
    pdf.text(`${page} / ${pages}`, margin + width, pdf.internal.pageSize.getHeight() - 12, { align: "right" });
  }
  pdf.setTextColor(0);
  return pdf;
}
