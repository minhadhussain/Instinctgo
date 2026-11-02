import type { CaseDefinition, CaseState } from "./types";

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function renderNote(item: CaseDefinition) {
  const html = item.note.map((section, index) => `<h3>${index + 1}. ${escapeHtml(section.heading)}</h3><p>${escapeHtml(section.text)}${(section.referenceIds ?? []).map((id) => ` <a href="#ref-${id}">[${item.documents.findIndex((doc) => doc.id === id) + 1}]</a>`).join("")}</p>`).join("");
  const text = item.note.map((section, index) => `${index + 1}. ${section.heading}\n\n${section.text}${(section.referenceIds ?? []).map((id) => ` [${item.documents.findIndex((doc) => doc.id === id) + 1}]`).join("")}`).join("\n\n");
  return { html, text };
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportNote(format: "docx" | "pdf", item: CaseDefinition, state: CaseState) {
  const disclaimer = `SYNTHETIC PLAYGROUND · ${state.status.toUpperCase()} · NOT AN OFFICIAL DOCUMENT`;
  const content = [item.subject, item.id, disclaimer, "", state.text, "", "Sources (synthetic):", ...[...item.documents, ...state.extraDocuments].map((doc) => `${doc.title} — ${doc.locator} — ${doc.status}`), "", state.disposition ? `Simulated disposition: ${state.disposition}` : "No final approval has been recorded."];
  if (format === "docx") {
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const file = new Document({ creator: "InstinctGo playground", title: item.subject, sections: [{ children: content.flatMap((line) => line.split("\n")).map((line, index) => new Paragraph({ spacing: { after: 180 }, children: [new TextRun({ text: line, bold: index === 0 || index === 2, size: index === 0 ? 32 : 22, font: "Calibri" })] })) }] });
    saveBlob(await Packer.toBlob(file), `${item.id}-demo.docx`);
  } else {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.setFont("helvetica");
    pdf.setFontSize(10);
    let y = 20;
    // Built-in PDF fonts do not contain the rupee glyph; spell the currency explicitly.
    for (const block of content) {
      const lines: string[] = pdf.splitTextToSize(block.replace(/₹/g, "INR ").replace(/[–—]/g, "-").replace(/→/g, "to").replace(/×/g, "x"), 172);
      for (const line of lines) {
        if (y > 274) { pdf.addPage(); y = 20; }
        pdf.text(line, 19, y);
        y += 5;
      }
      y += 3;
    }
    pdf.save(`${item.id}-demo.pdf`);
  }
}
