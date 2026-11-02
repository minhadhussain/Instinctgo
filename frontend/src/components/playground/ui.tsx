"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { BookOpen, FileText, X } from "lucide-react";
import type { ReferenceDocument } from "@/lib/playground/types";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "blue" }) {
  return <span className={`pg-badge pg-badge-${tone}`}><span />{children}</span>;
}

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className={`pg-modal ${wide ? "pg-modal-wide" : ""}`} aria-label={title} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="pg-modal-header"><h3>{title}</h3><button className="pg-icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>
    <div className="pg-modal-body">{children}</div>
  </dialog>;
}

export function DocumentPreview({ document, onClose }: { document: ReferenceDocument; onClose: () => void }) {
  return <Modal title="Source document" onClose={onClose} wide>
    <div className="pg-preview-meta"><span><FileText size={16} />{document.type}</span><Badge tone={document.status === "Current" ? "success" : document.status === "Superseded" ? "danger" : "warning"}>{document.status}</Badge></div>
    <article className="pg-source-paper">
      <div className="pg-document-masthead"><BookOpen size={26} strokeWidth={1.4} /><span>SAMPLE UNIVERSITY</span><small>DEMO DOCUMENT</small></div>
      <h2>{document.title}</h2>
      <dl className="pg-metadata"><div><dt>Issuing source</dt><dd>{document.source}</dd></div><div><dt>Published / effective</dt><dd>{document.date} / {document.effectiveDate}</dd></div><div><dt>Version / department</dt><dd>{document.version} / {document.department}</dd></div><div><dt>Relevant passage</dt><dd>{document.locator}</dd></div></dl>
      {document.content.map((paragraph, index) => <p key={index} className={index === document.highlight ? "pg-highlight-passage" : ""}>{index === document.highlight && <span className="pg-passage-label">LINKED EVIDENCE</span>}{paragraph}</p>)}
      <footer>Illustrative record <span>Page 1 of 1</span></footer>
    </article>
  </Modal>;
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="pg-empty"><FileText size={29} strokeWidth={1.3} /><h3>{title}</h3><p>{children}</p></div>;
}

export function formatDate(value: string) {
  return new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
