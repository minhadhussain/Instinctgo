import { escapeHtml } from "./renderer";
import type { CaseDefinition, CaseState } from "./types";

export interface ExtractedPage { page: number; text: string; ocr: boolean }
export interface ExtractedDocument { text: string; pages: ExtractedPage[]; method: "Text" | "Word" | "PDF" | "OCR" | "PDF + OCR" }
export interface ExtractionProgress { progress: number; message: string }
export const MAX_TEXT_CHARACTERS = 200000;

export function normalizeDocumentText(text: string) {
  return text.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

export function finishExtraction(pages: ExtractedPage[], method: ExtractedDocument["method"]): ExtractedDocument {
  const normalized = pages.map((page) => ({ ...page, text: normalizeDocumentText(page.text) }));
  const text = normalized.map((page) => page.text).filter(Boolean).join("\n\n");
  if (!text) throw new Error("No readable text was found. Try a clearer scan or a document containing selectable text.");
  if (text.length > MAX_TEXT_CHARACTERS) throw new Error("This document contains more than 200,000 characters. Split it into smaller files for editing in the browser.");
  return { text, pages: normalized, method };
}

/** Keep PDF text runs on their original lines, including runs split by font changes. */
export function pdfTextLines(items: { str: string; hasEOL?: boolean; transform: number[]; width: number; height: number }[]) {
  let text = "";
  let previous: typeof items[number] | undefined;
  for (const item of items) {
    if (previous && !text.endsWith("\n")) {
      const newLine = Math.abs(item.transform[5] - previous.transform[5]) > Math.max(2, item.height * 0.5);
      const gap = item.transform[4] - (previous.transform[4] + previous.width);
      if (newLine) text += "\n";
      else if (gap > Math.max(1, item.height * 0.1) && !/\s$/.test(text) && !/^\s/.test(item.str)) text += " ";
    }
    text += item.str;
    if (item.hasEOL) text += "\n";
    previous = item;
  }
  return normalizeDocumentText(text);
}

export function applyExtractedText(item: CaseDefinition, state: CaseState, result: ExtractedDocument, now: string): { item: CaseDefinition; state: CaseState } {
  const html = result.text.split(/\n\s*\n/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
  const original = item.documents[0];
  const source = { ...original, locator: result.pages.length > 1 ? `Extracted text · ${result.pages.length} pages` : "Extracted text", content: result.pages.map((page) => `${result.pages.length > 1 ? `Page ${page.page}\n\n` : ""}${page.text || "No text detected on this page."}`), extraction: { method: result.method, pages: result.pages.length, ocrPages: result.pages.filter((page) => page.ocr).length } };
  return { item: { ...item, documents: [source, ...item.documents.slice(1)] }, state: { ...state, html, text: result.text, stage: 6, status: "Extracted draft", draftKind: "proposal", savedAt: now, versions: [...state.versions, { id: state.versions.length + 1, label: "Extracted proposal text", html, text: result.text, author: "Browser extraction", date: now }] } };
}
