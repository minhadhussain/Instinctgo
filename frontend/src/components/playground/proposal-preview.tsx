"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import type { CaseDefinition, CaseState, ReferenceDocument } from "@/lib/playground/types";
import { Modal } from "./ui";

function textWalker(element: Element) {
  return document.createTreeWalker(element, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: (node) => node.nodeType === Node.TEXT_NODE || (node as Element).tagName === "BR" ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP });
}

function textValue(element: Element) {
  const walker = textWalker(element);
  let text = "";
  let node = walker.nextNode();
  while (node) { text += node.nodeType === Node.TEXT_NODE ? node.textContent : "\n"; node = walker.nextNode(); }
  return text;
}

function textPoint(element: Element, offset: number): [Node, number] {
  const walker = textWalker(element);
  let node = walker.nextNode();
  while (node) {
    const length = node.nodeType === Node.TEXT_NODE ? node.textContent?.length ?? 0 : 1;
    if (offset <= length) {
      if (node.nodeType === Node.TEXT_NODE) return [node, offset];
      const parent = node.parentNode!;
      return [parent, Array.prototype.indexOf.call(parent.childNodes, node) + offset];
    }
    offset -= length;
    node = walker.nextNode();
  }
  return [element, element.childNodes.length];
}

function splitBlock(element: Element, offset: number) {
  const [node, position] = textPoint(element, offset);
  const before = document.createRange();
  before.setStart(element, 0); before.setEnd(node, position);
  const after = document.createRange();
  after.setStart(node, position); after.setEnd(element, element.childNodes.length);
  const first = element.cloneNode(false) as Element;
  const second = element.cloneNode(false) as Element;
  first.append(before.cloneContents()); second.append(after.cloneContents());
  return [first, second];
}

function paginate(html: string, measure: HTMLDivElement) {
  const source = document.createElement("div"); source.innerHTML = html;
  const queue = Array.from(source.children);
  const pages: string[] = [];
  measure.replaceChildren();
  while (queue.length) {
    const block = queue.shift()!;
    measure.append(block);
    if (measure.scrollHeight <= 740) continue;
    block.remove();
    if (measure.childElementCount) { pages.push(measure.innerHTML); measure.replaceChildren(); queue.unshift(block); continue; }
    // Split a long paragraph at a word boundary, retaining its inline formatting.
    const text = textValue(block);
    let low = 1, high = text.length, best = 0;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      measure.replaceChildren(splitBlock(block, middle)[0]);
      if (measure.scrollHeight <= 740) { best = middle; low = middle + 1; } else high = middle - 1;
    }
    if (!best || best >= text.length) { pages.push(block.outerHTML); measure.replaceChildren(); continue; }
    const boundary = text.lastIndexOf(" ", best);
    const [first, second] = splitBlock(block, boundary > 0 ? boundary + 1 : best);
    pages.push(first.outerHTML); measure.replaceChildren(); queue.unshift(second);
  }
  if (measure.childElementCount) pages.push(measure.innerHTML);
  measure.replaceChildren();
  return pages.length ? pages : ["<p>No note text yet.</p>"];
}

export function ProposalPreview({ item, state, documents, onClose, onSource }: { item: CaseDefinition; state: CaseState; documents: ReferenceDocument[]; onClose: () => void; onSource: (doc: ReferenceDocument) => void }) {
  const [pages, setPages] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(() => typeof window !== "undefined" && window.innerWidth < 720 ? Math.max(30, Math.floor((window.innerWidth - 80) / 680 * 100)) : 80);
  const measure = useRef<HTMLDivElement>(null);
  const proposal = state.draftKind === "proposal";
  useEffect(() => {
    const frame = requestAnimationFrame(() => { if (measure.current) setPages(paginate(state.html, measure.current)); });
    return () => cancelAnimationFrame(frame);
  }, [state.html]);
  function source(target: HTMLElement) {
    const id = target.closest("a")?.getAttribute("href")?.replace(/^#ref-/, "");
    const doc = documents.find((doc) => doc.id === id);
    if (doc) onSource(doc);
  }
  const currentPage = Math.min(page, Math.max(0, pages.length - 1));
  return <Modal title={proposal ? "Preview proposal text" : "Preview note"} onClose={onClose} wide>
    <div className="pg-preview-controls"><div><button className="pg-icon-button" aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17} /></button><span aria-live="polite">Page {currentPage + 1} of {pages.length || "…"}</span><button className="pg-icon-button" aria-label="Next page" disabled={currentPage >= pages.length - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17} /></button></div><div><button className="pg-icon-button" aria-label="Zoom out" disabled={zoom <= 30} onClick={() => setZoom(Math.max(30, zoom - 10))}><Minus size={16} /></button><output>{zoom}%</output><button className="pg-icon-button" aria-label="Zoom in" disabled={zoom >= 150} onClick={() => setZoom(Math.min(150, zoom + 10))}><Plus size={16} /></button></div><button className="pg-text-button" onClick={onClose}><ArrowLeft size={14} />Back to editing</button></div>
    <p className="pg-preview-save">{state.savedAt ? `Saved draft · ${new Date(state.savedAt).toLocaleTimeString()}` : "Prepared sample draft"}</p>
    <div className="pg-preview-canvas" data-lenis-prevent><article className="pg-preview-sheet" style={{ zoom: zoom / 100 }}><header><span>{item.institution?.toUpperCase() ?? "UNIVERSITY · FINANCE"}</span><small>{item.id}</small><h2>{item.subject}</h2><p>{proposal ? "Extracted proposal text" : "Finance note"} · {item.date}</p></header><div className="pg-rich-editor pg-finance-text pg-preview-content" onClick={(event) => { if ((event.target as HTMLElement).closest("a")) { event.preventDefault(); source(event.target as HTMLElement); } }} dangerouslySetInnerHTML={{ __html: pages[currentPage] ?? "<p>Preparing preview…</p>" }} />{state.signature && currentPage === pages.length - 1 && <p className="pg-preview-signature">{state.signature.name} · {state.signature.role}</p>}<footer>{currentPage + 1} / {pages.length || "…"}</footer></article></div>
    <div ref={measure} aria-hidden="true" className="pg-rich-editor pg-finance-text pg-preview-measure" />
  </Modal>;
}
