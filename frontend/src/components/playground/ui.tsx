"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useLenis } from "lenis/react";
import { resumePageScroll } from "@/lib/smooth-scroll";
import { BookOpen, ChevronDown, FileText, X } from "lucide-react";
import type { ReferenceDocument } from "@/lib/playground/types";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "blue" }) {
  return <span className={`pg-badge pg-badge-${tone}`}><span />{children}</span>;
}

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const lenis = useLenis();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    lenis?.stop();
    return () => { dialog?.close(); resumePageScroll(lenis); };
  }, [lenis]);
  return <dialog ref={ref} data-lenis-prevent className={`pg-modal ${wide ? "pg-modal-wide" : ""}`} aria-label={title} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="pg-modal-header"><h3>{title}</h3><button className="pg-icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>
    <div className="pg-modal-body">{children}</div>
  </dialog>;
}

export function DocumentPreview({ document, onClose }: { document: ReferenceDocument; onClose: () => void }) {
  return <Modal title={document.title} onClose={onClose} wide>
    <div className="pg-preview-meta"><span><FileText size={16} />{document.type}</span></div>
    {document.file && <div className="pg-original-preview"><div className="pg-original-heading"><strong>{document.file.name}</strong><a className="pg-button" href={document.file.url} download={document.file.name}>Download rulebook</a></div><iframe src={`${document.file.url}${document.file.page ? `#page=${document.file.page}` : ""}`} title={`Rule source: ${document.title}`} /></div>}
    {document.original && <div className="pg-original-preview"><div className="pg-original-heading"><strong>Original file · {document.original.name}</strong><a className="pg-button" href={document.original.url} download={document.original.name}>Download original</a></div>{document.original.mime.startsWith("image/") ? <picture><img src={document.original.url} alt={`Scanned original: ${document.title}`} /></picture> : document.original.mime === "application/pdf" ? <iframe src={document.original.url} title={`Original PDF: ${document.title}`} /> : !/\.(txt|md)$/i.test(document.original.name) ? <p className="pg-help">Download the original for its full formatting. {document.extraction ? "Converted text is shown below." : "Process the document to extract its text."}</p> : null}</div>}
    <article className="pg-source-paper">
      <div className="pg-document-masthead"><BookOpen size={26} strokeWidth={1.4} /><span>{document.file ? "DIBRUGARH UNIVERSITY" : document.original ? "UNIVERSITY FINANCE" : "DOCUMENT REFERENCE"}</span><small>{document.file ? "SUPPLIED RULEBOOK" : document.original ? "ORIGINAL UPLOAD" : "DOCUMENT"}</small></div>
      <h2>{document.title}</h2>
      <p className="pg-source-locator">{document.locator}</p>
      <details className="pg-source-info"><summary>Source details<ChevronDown size={14} /></summary><dl className="pg-metadata"><div><dt>Issuing source</dt><dd>{document.source}</dd></div><div><dt>Published / effective</dt><dd>{document.date} / {document.effectiveDate}</dd></div><div><dt>Version / department</dt><dd>{document.version} / {document.department}</dd></div><div><dt>Relevant passage</dt><dd>{document.locator}</dd></div></dl></details>
      {document.content.map((paragraph, index) => <p key={index} className="pg-preserve-lines">{paragraph}</p>)}
      <footer>{document.file ? "Supplied rule extract" : document.original ? "Original file" : "Reference document"}<span>{document.file ? document.locator : document.original ? "Text preview" : "Page 1 of 1"}</span></footer>
    </article>
  </Modal>;
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="pg-empty"><FileText size={29} strokeWidth={1.3} /><h3>{title}</h3><p>{children}</p></div>;
}

export function formatDate(value: string) {
  return new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
