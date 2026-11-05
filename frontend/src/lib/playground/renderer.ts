import type { CaseDefinition, CaseState } from "./types";
import type { NoteBlock } from "./gpf-case";

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
  if (item.workspace === "sws-procurement") {
    const { exportSwsNote } = await import("./sws-document");
    return exportSwsNote(format, item, state);
  }
  const disclaimer = `${item.imported ? "PLAYGROUND DRAFT" : "SYNTHETIC PLAYGROUND"} · ${state.status.toUpperCase()} · NOT AN OFFICIAL DOCUMENT`;
  const parsed = new DOMParser().parseFromString(state.html, "text/html");
  const plain = (element: Element) => { const copy = element.cloneNode(true) as Element; copy.querySelectorAll("br").forEach((br) => br.replaceWith("\n")); copy.querySelectorAll("p").forEach((p) => p.append("\n")); return copy.textContent?.trim() ?? ""; };
  const blocks: NoteBlock[] = Array.from(parsed.body.children).map((element) => element.tagName === "TABLE" ? { kind: "table", rows: Array.from(element.querySelectorAll("tr")).map((row) => Array.from(row.children).map(plain)) } : { kind: "paragraph", text: plain(element), bold: /^H[1-6]$/.test(element.tagName) || !!element.querySelector("strong"), underline: !!element.querySelector("u") });
  if (state.signature) blocks.push({ kind: "paragraph", text: `Demo signature: ${state.signature.name} — ${state.signature.role} — ${state.signature.date}` });
  if (format === "docx") {
    const { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, UnderlineType } = await import("docx");
    const paragraph = (text: string, bold = false, underline = false) => new Paragraph({ spacing: { after: 150 }, children: text.split("\n").map((line, index) => new TextRun({ text: line, break: index ? 1 : undefined, bold, underline: underline ? { type: UnderlineType.SINGLE } : undefined, size: 22, font: "Calibri" })) });
    const children = blocks.map((block) => block.kind === "table" ? new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: block.rows.map((row, index) => new TableRow({ children: row.map((cell) => new TableCell({ children: [paragraph(cell, index === 0)] })) })) }) : paragraph(block.text, block.bold, block.underline));
    const file = new Document({ creator: "InstinctGo playground", title: item.subject, sections: [{ children: [paragraph(item.institution ?? "University Finance", true), paragraph(item.subject, true), paragraph(disclaimer), ...children] }] });
    saveBlob(await Packer.toBlob(file), `${item.id}-demo.docx`);
  } else {
    const { jsPDF } = await import("jspdf");
    const { drawDocumentPdf } = await import("./document-pdf");
    const pdf = drawDocumentPdf(new jsPDF(), item.institution ?? "UNIVERSITY FINANCE", `${item.subject} · ${item.id}`, blocks, disclaimer);
    pdf.save(`${item.id}-demo.pdf`);
  }
}
