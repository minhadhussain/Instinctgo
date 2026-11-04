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

export interface PositionedTextLine { text: string; y: number; height: number }

function textWithParagraphGaps(lines: PositionedTextLine[], maxLineSpacing: number) {
  const gaps = lines.slice(1).map((line, index) => Math.abs(line.y - lines[index].y)).filter((gap) => gap > 2).sort((a, b) => a - b);
  // Estimate ordinary line spacing without treating large paragraph gaps as
  // the default. Cap it for pages consisting of single-line paragraphs.
  const ordinaryGap = gaps[Math.floor((gaps.length - 1) / 4)] ?? 0;
  return lines.map((line, index) => {
    if (!index) return line.text;
    const previous = lines[index - 1];
    const height = Math.max(previous.height, line.height);
    const lineSpacing = Math.min(ordinaryGap || height * 1.2, height * maxLineSpacing);
    const paragraphGap = Math.abs(line.y - previous.y) > Math.max(lineSpacing * 1.4, height * 1.6);
    return `${paragraphGap ? "\n\n" : "\n"}${line.text}`;
  }).join("");
}

/** Restore OCR paragraph boundaries only when they preserve all recognized text. */
export function ocrParagraphText(text: string, paragraphs: string[] = [], lines: PositionedTextLine[] = []) {
  const spaced = paragraphs.map(normalizeDocumentText).filter(Boolean).join("\n\n");
  const characters = (value: string) => value.replace(/\s/g, "");
  const positioned = lines.filter((line) => line.text.trim() && Number.isFinite(line.y) && line.height > 0).map((line) => ({ ...line, text: normalizeDocumentText(line.text) }));
  // OCR paragraph labels can span a visible blank gap. Line coordinates retain
  // that gap without splitting ordinary wrapped lines into separate paragraphs.
  const layoutText = textWithParagraphGaps(positioned, 2);
  if (layoutText && characters(layoutText) === characters(text)) return normalizeDocumentText(layoutText);
  return normalizeDocumentText(spaced && characters(spaced) === characters(text) ? spaced : text);
}

/** Keep font-split words together and use page geometry to retain paragraph gaps. */
export function pdfTextLines(items: { str: string; hasEOL?: boolean; transform: number[]; width: number; height: number }[]) {
  const lines: PositionedTextLine[] = [];
  let line: typeof lines[number] | undefined;
  let previous: typeof items[number] | undefined;
  const flush = () => {
    if (line?.text.trim()) lines.push(line);
    line = undefined;
    previous = undefined;
  };
  for (const item of items) {
    // PDF.js emits empty end-of-line markers as well as visible text runs.
    if (!item.str) { if (item.hasEOL) flush(); continue; }
    const height = item.height || Math.hypot(item.transform[2], item.transform[3]) || 12;
    if (line && Math.abs(item.transform[5] - line.y) > Math.max(2, height * 0.5, line.height * 0.5)) flush();
    line ??= { text: "", y: item.transform[5], height };
    if (previous) {
      const gap = item.transform[4] - (previous.transform[4] + previous.width);
      if (gap > Math.max(1, height * 0.1) && !/\s$/.test(line.text) && !/^\s/.test(item.str)) line.text += " ";
    }
    line.text += item.str;
    line.height = Math.max(line.height, height);
    previous = item;
    if (item.hasEOL) flush();
  }
  flush();
  return normalizeDocumentText(textWithParagraphGaps(lines, 1.5));
}

export function applyExtractedText(item: CaseDefinition, state: CaseState, result: ExtractedDocument, now: string): { item: CaseDefinition; state: CaseState } {
  const html = result.text.split(/\n\s*\n/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
  const original = item.documents[0];
  const source = { ...original, locator: result.pages.length > 1 ? `Extracted text · ${result.pages.length} pages` : "Extracted text", content: result.pages.map((page) => `${result.pages.length > 1 ? `Page ${page.page}\n\n` : ""}${page.text || "No text detected on this page."}`), extraction: { method: result.method, pages: result.pages.length, ocrPages: result.pages.filter((page) => page.ocr).length } };
  return { item: { ...item, documents: [source, ...item.documents.slice(1)] }, state: { ...state, html, text: result.text, stage: 6, status: "Extracted draft", draftKind: "proposal", savedAt: now, versions: [...state.versions, { id: state.versions.length + 1, label: "Extracted proposal text", html, text: result.text, author: "Browser extraction", date: now }] } };
}
