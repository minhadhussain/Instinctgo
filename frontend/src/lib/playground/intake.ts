import type { CaseDefinition, CaseState, ReferenceDocument } from "./types";

export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;
export const DOCUMENT_ACCEPT = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg";
export type ProcessingStatus = "Uploaded" | "Processing" | "Error";
export interface IntakeJob { status: ProcessingStatus; error?: string; progress?: number; message?: string }

export function validateDocument(file: Pick<File, "name" | "size">) {
  if (!/\.(pdf|docx|txt|md|png|jpe?g)$/i.test(file.name)) return "Choose a PDF, DOCX, TXT, Markdown, PNG or JPEG file.";
  if (!file.size) return "This file is empty. Choose a document with content.";
  if (file.size > MAX_DOCUMENT_SIZE) return "This file is too large. The maximum size is 20 MB.";
  return "";
}

export function readDocument(file: File, progress: (value: number) => void, signal: AbortSignal): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => reader.abort();
    signal.addEventListener("abort", abort, { once: true });
    reader.onprogress = (event) => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)); };
    reader.onload = () => { progress(100); resolve(reader.result as ArrayBuffer); };
    reader.onerror = () => reject(new Error("The document could not be read. Please select it again."));
    reader.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    reader.onloadend = () => signal.removeEventListener("abort", abort);
    if (signal.aborted) reject(new DOMException("Upload cancelled", "AbortError"));
    else reader.readAsArrayBuffer(file);
  });
}

export function createImportedCase(file: Pick<File, "name" | "type" | "size">, bytes: ArrayBuffer, url: string, id: string, now: string): CaseDefinition {
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  const textFile = extension === "txt" || extension === "md";
  let content: string[];
  if (textFile) {
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new Error("This text file is not UTF-8. Save it as UTF-8 and try again."); }
    if (!text.trim()) throw new Error("This document has no readable text.");
    content = text.slice(0, 200000).split(/\n\s*\n/).filter(Boolean);
    if (text.length > 200000) content.push("Text preview limited to 200,000 characters. Download the original for the complete document.");
  } else {
    const signature = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
    const valid = extension === "pdf" ? signature[0] === 37 && signature[1] === 80 && signature[2] === 68 && signature[3] === 70
      : extension === "docx" ? signature[0] === 80 && signature[1] === 75
      : extension === "png" ? signature[0] === 137 && signature[1] === 80 && signature[2] === 78 && signature[3] === 71
      : signature[0] === 255 && signature[1] === 216;
    if (!valid) throw new Error("The file content does not match its extension. Choose a valid document.");
    content = ["The original file is ready. Process the document to convert its text in your browser."];
  }
  const mime = extension === "pdf" ? "application/pdf" : extension === "png" ? "image/png" : /jpe?g/.test(extension ?? "") ? "image/jpeg" : file.type || "application/octet-stream";
  const document: ReferenceDocument = { id: `${id}-original`, title: file.name, type: "Original proposal", source: "User upload", date: now.slice(0, 10), effectiveDate: now.slice(0, 10), version: "Original", status: "Unverified", department: "Finance", locator: textFile ? "Original text" : "Original file", content, highlight: -1, original: { name: file.name, url, mime, size: file.size } };
  return { id, subject: file.name.replace(/\.[^.]+$/, ""), category: "Uploaded proposal", branch: "Administrative", section: "Finance", date: now.slice(0, 10), session: String(new Date(now).getFullYear()), applicant: "", assistant: "Finance staff", officer: "Section Officer", description: file.name, documents: [document], note: ["Background", "Financial examination", "Applicable provisions", "Recommendation"].map((heading) => ({ heading, text: "" })), facts: [], explanation: [], findings: [], recommendation: "", terminal: "Registrar", tools: [], imported: true };
}

export function displayStatus(state: CaseState, job?: IntakeJob) {
  if (job) return job.status;
  if (["Closed", "Demo approved"].includes(state.status)) return "Completed";
  if (state.status === "In review") return "In Review";
  if (state.status === "Returned") return "Clarification requested";
  if (state.status === "Demo rejected") return "Rejected";
  if (state.status === "Received") return "Uploaded";
  if (state.draftKind === "proposal") return "Proposal text";
  if (state.status === "Generated note") return "Note ready";
  return "Draft Ready";
}
