import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { jsPDF } from "jspdf";
import { gpfNoteBlocks, gpfProposalText, parseGpfProposal, renderGpfNote, gpfSample, type NoteBlock } from "../src/lib/playground/gpf-case";
import { drawDocumentPdf } from "../src/lib/playground/document-pdf";

const samples = fileURLToPath(new URL("../../samples/case-01/", import.meta.url));
const served = fileURLToPath(new URL("../public/samples/case-01/", import.meta.url));
const library = JSON.parse(await readFile(new URL("../../samples/noting-library.json", import.meta.url), "utf8")) as { rulebooks: Record<string, { path: string; url: string }> };
await Promise.all([mkdir(join(samples, "proposals"), { recursive: true }), mkdir(join(samples, "notes"), { recursive: true }), mkdir(served, { recursive: true })]);
const rulePath = join(samples, "rules/GPF-RULE-FINAL.pdf");
const ruleBytes = await readFile(rulePath);
const facts = parseGpfProposal(gpfProposalText);
const note = renderGpfNote(facts);

const proposalBlocks: NoteBlock[] = gpfProposalText.split(/\n\s*\n/).slice(1).map((text) => ({ kind: "paragraph", text, bold: text.startsWith("Subject:") || text.startsWith("ANNEXURE A") }));
const proposalPdf = drawDocumentPdf(new jsPDF(), "DIBRUGARH UNIVERSITY", "Sample application - refundable GPF advance", proposalBlocks);
const notePdf = drawDocumentPdf(new jsPDF(), "DIBRUGARH UNIVERSITY", "Finance & Accounts - sample GPF noting", gpfNoteBlocks(facts));
const proposalFile = join(samples, "proposals", gpfSample.proposalName);
const noteFile = join(samples, "notes/gpf-advance-note.pdf");
await writeFile(proposalFile, Buffer.from(proposalPdf.output("arraybuffer")));
await writeFile(noteFile, Buffer.from(notePdf.output("arraybuffer")));
await writeFile(join(samples, "proposals/gpf-advance-proposal.txt"), gpfProposalText + "\n");
await writeFile(join(samples, "notes/gpf-advance-note.txt"), note.text + "\n");
await Promise.all([
  copyFile(proposalFile, join(served, "gpf-advance-proposal.pdf")),
  copyFile(noteFile, join(served, "gpf-advance-note.pdf")),
  copyFile(rulePath, join(served, "gpf-rules-2013.pdf")),
]);
const ruleSources = await Promise.all(Object.entries(library.rulebooks).map(async ([id, book]) => {
  const source = new URL(`../../samples/${book.path}`, import.meta.url);
  const target = fileURLToPath(new URL(`../public${book.url}`, import.meta.url));
  await copyFile(source, target);
  return { id, path: book.path, url: book.url, sha256: createHash("sha256").update(await readFile(source)).digest("hex") };
}));
await writeFile(new URL("../../samples/noting-source-manifest.json", import.meta.url), JSON.stringify({ ruleSources }, null, 2) + "\n");
await writeFile(join(samples, "case-manifest.json"), JSON.stringify({
  topic: "Refundable GPF advance for a dependent child's higher education",
  rules: "rules/GPF-RULE-FINAL.pdf",
  ruleSha256: createHash("sha256").update(ruleBytes).digest("hex"),
  rulePages: [4, 7, 8],
  appliedRules: ["5", "12.1", "12.1.1(iii)", "12.1.2", "12.1.3", "12.1.4", "12.1.5", "12.1.6"],
  formatReference: "notes/Untitled design (5).pdf",
  formatReferencePages: [6, 7],
  proposal: "proposals/gpf-advance-proposal.pdf",
  expectedNote: "notes/gpf-advance-note.pdf",
  scope: "Fictional GPF applicant. The supplied refund-note PDF informs formatting only. Rule 13 withdrawal conditions are not applied to this Rule 12 advance. No interest rate or ledger code is invented.",
}, null, 2) + "\n");
console.log("First-case GPF proposal, note and rule PDF ready.");
