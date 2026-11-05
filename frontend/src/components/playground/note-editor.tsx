"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Bold, Italic, Link2, Redo2, Underline, Undo2, FilePlus2 } from "lucide-react";
import type { CaseDefinition, CaseState, NotingLayout, ReferenceDocument } from "@/lib/playground/types";
import { escapeHtml } from "@/lib/playground/renderer";
import { FontSize, NoteMarker, NotingNumbers, TextAlignment } from "./editor-extensions";
import { defaultNotingLayout, countWords, paperSizes, swsHeadings } from "@/lib/playground/sws-settings";
import { MM_TO_PX, swsDocumentCss, swsHeaderHtml } from "@/lib/playground/sws-document";
import { TableTools } from "./table-tools";
import { NotingLayoutControls } from "./noting-layout-controls";
import { Modal } from "./ui";

interface Props {
  item: CaseDefinition; state: CaseState; editable: boolean; documents: ReferenceDocument[];
  onChange: (html: string, text: string) => void; onPreview: (doc: ReferenceDocument) => void;
  onLayoutChange: (layout: NotingLayout) => void;
}

export function NoteEditor({ item, state, editable, documents, onChange, onPreview, onLayoutChange }: Props) {
  const [linking, setLinking] = useState(false);
  const proposal = state.draftKind === "proposal";
  const sws = item.workspace === "sws-procurement";
  const layout = state.notingLayout ?? defaultNotingLayout();
  const scroll = useRef<HTMLDivElement>(null);
  const [writingZoom, setWritingZoom] = useState(1);
  const [writingScale, setWritingScale] = useState("fit");
  useEffect(() => {
    if (!sws || !scroll.current) return;
    const observer = new ResizeObserver(([entry]) => setWritingZoom(Math.min(1, Math.max(0.3, (entry.contentRect.width - 40) / (paperSizes[layout.paper].width * MM_TO_PX)))));
    observer.observe(scroll.current); return () => observer.disconnect();
  }, [sws, layout.paper]);
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: false } }), FontSize, TextAlignment, TableKit.configure({ table: { resizable: false, cellMinWidth: 50 } }), ...(!proposal && sws ? [NoteMarker, NotingNumbers] : [])],
    immediatelyRender: false, shouldRerenderOnTransaction: true, content: state.html, editable,
    editorProps: { attributes: { class: sws ? "sws-document sws-writing-content" : `pg-rich-editor pg-finance-text${proposal ? " pg-proposal-text" : ""}`, "aria-label": proposal ? "Proposal text editor" : "Finance note editor", role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor }) => onChange(editor.getHTML(), sws && !proposal ? editor.getText({ textSerializers: { paragraph: ({ node }) => `${node.attrs.paraNumber ? `${node.attrs.paraNumber}. ` : ""}${node.textBetween(0, node.content.size, "\n", (leaf) => leaf.type.name === "hardBreak" ? "\n" : leaf.textContent)}` } }) : editor.getText()),
  }, [item.id, state.draftKind, sws]);
  useEffect(() => { if (editor && editor.getHTML() !== state.html) editor.commands.setContent(state.html, { emitUpdate: false }); }, [editor, state.html]);
  useEffect(() => { editor?.setEditable(editable, false); }, [editor, editable]);

  function openSource(target: HTMLElement) {
    const anchor = target.closest("a");
    const id = anchor?.getAttribute("href")?.replace(/^#ref-/, "");
    const source = documents.find((doc) => doc.id === id);
    if (source) onPreview(source);
  }
  const counts: { note: number; words: number; characters: number }[] = [];
  if (sws && !proposal) editor?.state.doc.forEach((node) => {
    if (node.type.name === "noteMarker") counts.push({ note: node.attrs.number, words: 0, characters: 0 });
    else if (node.type.name !== "heading") {
      if (!counts.length) counts.push({ note: 1, words: 0, characters: 0 });
      const text = node.textBetween(0, node.content.size, " ");
      counts.at(-1)!.words += countWords(text); counts.at(-1)!.characters += text.length;
    }
  });

  return <section className="pg-editor-panel" aria-label={proposal ? "Extracted proposal" : "Finance note"}>
    {sws && <><style>{swsDocumentCss}</style><NotingLayoutControls layout={layout} editable={editable} onChange={onLayoutChange} /></>}
    <div className="pg-editor-toolbar pg-writing-toolbar" aria-label="Writing tools">
      <select aria-label="Text style" disabled={!editable} value={editor?.isActive("heading", { level: 2 }) ? "2" : editor?.isActive("heading", { level: 3 }) ? "3" : "paragraph"} onChange={(event) => { if (event.target.value === "paragraph") editor?.chain().focus().setParagraph().run(); else editor?.chain().focus().setHeading({ level: Number(event.target.value) as 2 | 3 }).run(); }}><option value="paragraph">Paragraph</option><option value="2">Heading 1</option><option value="3">Heading 2</option></select>
      <select aria-label="Font size" disabled={!editable} value={editor?.getAttributes("fontSize").size ?? "16px"} onChange={(event) => editor?.chain().focus().setMark("fontSize", { size: event.target.value }).run()}>{[12, 14, 16, 18, 20, 24].map((size) => <option key={size} value={`${size}px`}>{sws ? `${size * 0.75} pt` : size}</option>)}</select>
      <span className="pg-toolbar-divider" />
      <div className="pg-formatting">
        <button title="Bold" aria-label="Bold" aria-pressed={editor?.isActive("bold") ?? false} disabled={!editable} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={16} /></button>
        <button title="Italic" aria-label="Italic" aria-pressed={editor?.isActive("italic") ?? false} disabled={!editable} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={16} /></button>
        <button title="Underline" aria-label="Underline" aria-pressed={editor?.isActive("underline") ?? false} disabled={!editable} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleUnderline().run()}><Underline size={16} /></button>
        <button title="Cite a source" aria-label="Insert source link" disabled={!editable} onMouseDown={(event) => event.preventDefault()} onClick={() => setLinking(true)}><Link2 size={16} /></button>
      </div>
      <select aria-label="Text alignment" disabled={!editable} value={editor?.getAttributes("paragraph").textAlign ?? editor?.getAttributes("heading").textAlign ?? "left"} onChange={(event) => editor?.chain().focus().updateAttributes("paragraph", { textAlign: event.target.value }).updateAttributes("heading", { textAlign: event.target.value }).updateAttributes("tableCell", { textAlign: event.target.value }).updateAttributes("tableHeader", { textAlign: event.target.value }).run()}><option value="left">Align left</option><option value="center">Centre</option><option value="right">Align right</option><option value="justify">Justify</option></select>
      <TableTools editor={editor} editable={editable} />
      {sws && <select aria-label="Writing zoom" value={writingScale} onChange={(event) => setWritingScale(event.target.value)}><option value="fit">Fit width</option><option value="0.75">75%</option><option value="1">100%</option></select>}
      {sws && !proposal && <button className="pg-text-button" disabled={!editable} onClick={() => editor?.chain().focus("end").insertContent([{ type: "noteMarker" }, ...swsHeadings.flatMap((heading) => [{ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: heading }] }, { type: "paragraph" }])]).run()}><FilePlus2 size={15} />Add note</button>}
      <div className="pg-formatting pg-undo-tools"><button title="Undo" aria-label="Undo edit" disabled={!editable || !editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}><Undo2 size={16} /></button><button title="Redo" aria-label="Redo edit" disabled={!editable || !editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}><Redo2 size={16} /></button></div>
    </div>
    <div ref={scroll} className={`pg-document-scroll${sws ? " pg-sws-writing" : ""}`} data-lenis-prevent>
      <article className={sws ? "sws-writing-sheet" : "pg-note-paper"} style={sws ? { width: `${paperSizes[layout.paper].width}mm`, minHeight: `${paperSizes[layout.paper].height}mm`, padding: `${layout.margins.top}mm ${layout.margins.right}mm ${layout.margins.bottom}mm ${layout.margins.left}mm`, background: layout.paperColor === "green" ? "#edf5e8" : "#fff", zoom: writingScale === "fit" ? writingZoom : Number(writingScale) } : undefined}>
        {sws ? <div dangerouslySetInnerHTML={{ __html: swsHeaderHtml(item) }} /> : <><div className="pg-note-kicker"><span>{item.institution?.toUpperCase() ?? "UNIVERSITY · FINANCE"}</span><span>{proposal ? "PROPOSAL TEXT" : "FINANCE NOTE"}</span></div>
        <h2>{proposal ? "Extracted proposal text" : "Note for consideration"}</h2>
        <div className="pg-note-subject"><span>Subject</span><strong>{item.subject}</strong></div>
        <div className="pg-note-reference">{item.date} · {item.section}</div></>}
        <div onClick={(event) => { if ((event.target as HTMLElement).closest("a")) { event.preventDefault(); openSource(event.target as HTMLElement); } }}><EditorContent editor={editor} /></div>
        {state.signature && <div className="pg-signature"><strong>{state.signature.name}</strong><small>{state.signature.role} · {new Date(state.signature.date).toLocaleString()} · Demo signature</small></div>}
      </article>
    </div>
    {sws && !proposal && <div className="pg-brevity-meter" aria-live="polite">{counts.map((count) => <span key={count.note} data-over-limit={count.words > layout.wordLimit || undefined}>Note #{count.note}: {count.words} / {layout.wordLimit} words · {count.characters} characters</span>)}{counts.some((count) => count.words > layout.wordLimit) && <p>Over the target. Keep the issue to a short summary, retain the amount and budget head, cite only relevant provisions, and end with the approval sought. Your text has not been truncated.</p>}</div>}
    <div className="pg-editor-footer"><span>{state.savedAt ? "Saved in this session" : item.imported ? "Manual draft" : "Prepared sample draft"}</span><span>{state.text.trim().split(/\s+/).filter(Boolean).length} words · {editable ? "Autosave on" : "Read-only"}</span></div>
    {linking && <Modal title="Cite a source" onClose={() => setLinking(false)}><p className="pg-help">Select a source to link the selected text or insert a citation.</p>{documents.map((doc) => <button className="pg-source-row" key={doc.id} onClick={() => { if (!editor) return; const href = `#ref-${doc.id}`; if (editor.state.selection.empty) editor.chain().focus().insertContent(`<a href="${escapeHtml(href)}">[${escapeHtml(doc.title)}]</a>`).run(); else editor.chain().focus().setLink({ href }).run(); setLinking(false); }}><Link2 size={16} /><span><strong>{doc.title}</strong><small>{doc.status} · {doc.locator}</small></span></button>)}</Modal>}
  </section>;
}
