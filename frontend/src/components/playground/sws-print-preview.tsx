"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { renderSwsPages, printSwsNote, swsDocumentCss } from "@/lib/playground/sws-document";
import type { CaseDefinition, CaseState } from "@/lib/playground/types";
import { Modal } from "./ui";

export function SwsPrintPreview({ item, state, onClose }: { item: CaseDefinition; state: CaseState; onClose: () => void }) {
  const [pages, setPages] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(65);
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    let active = true;
    void renderSwsPages(item, state).then((rendered) => { if (active) { setPages(rendered.pages); setError(""); } }).catch((error) => { if (active) setError(error instanceof Error ? error.message : "Page layout failed."); });
    return () => { active = false; };
  }, [item, state]);
  const current = Math.min(page, Math.max(0, pages.length - 1));
  return <Modal title="SWS print layout" onClose={onClose} wide>
    <style>{swsDocumentCss}</style>
    <div className="pg-preview-controls">
      <div><button className="pg-icon-button" aria-label="Previous page" disabled={!current} onClick={() => setPage(current - 1)}><ChevronLeft size={17} /></button><span>Page {current + 1} of {pages.length || "…"}</span><button className="pg-icon-button" aria-label="Next page" disabled={current >= pages.length - 1} onClick={() => setPage(current + 1)}><ChevronRight size={17} /></button></div>
      <label>Zoom <select aria-label="Print preview zoom" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>{[35, 50, 65, 80, 100].map((value) => <option key={value} value={value}>{value}%</option>)}</select></label>
      <button className="pg-button" disabled={printing || !!error || !pages.length} onClick={async () => { setPrinting(true); try { await printSwsNote(item, state); } catch (error) { setError(error instanceof Error ? error.message : "Printing failed."); } finally { setPrinting(false); } }}><Printer size={16} />Print</button>
    </div>
    <p className="pg-help">This paginated view is shared by PDF and fixed-layout Word exports. Print at 100% scale with browser headers/footers off and the matching paper size.</p>
    {error ? <p role="alert" className="pg-note-error">{error}</p> : <div className="pg-preview-canvas pg-sws-preview" data-lenis-prevent><div style={{ zoom: zoom / 100 }} dangerouslySetInnerHTML={{ __html: pages[current] ?? "Preparing pages…" }} /></div>}
  </Modal>;
}
