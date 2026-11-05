"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Bold, Italic, Link2, Redo2, Underline, Undo2 } from "lucide-react";
import type { CaseDefinition, CaseState, ReferenceDocument } from "@/lib/playground/types";
import { escapeHtml } from "@/lib/playground/renderer";
import { FontSize } from "./editor-extensions";
import { Modal } from "./ui";

interface Props {
  item: CaseDefinition; state: CaseState; editable: boolean; documents: ReferenceDocument[];
  onChange: (html: string, text: string) => void; onPreview: (doc: ReferenceDocument) => void;
}

export function NoteEditor({ item, state, editable, documents, onChange, onPreview }: Props) {
  const [linking, setLinking] = useState(false);
  const proposal = state.draftKind === "proposal";
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: false } }), FontSize, TableKit.configure({ table: { resizable: false, cellMinWidth: 50 } })],
    immediatelyRender: false, shouldRerenderOnTransaction: true, content: state.html, editable,
    editorProps: { attributes: { class: `pg-rich-editor pg-finance-text${proposal ? " pg-proposal-text" : ""}`, "aria-label": proposal ? "Proposal text editor" : "Finance note editor", role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.getText()),
  }, [item.id, state.draftKind]);
  useEffect(() => { if (editor && editor.getHTML() !== state.html) editor.commands.setContent(state.html, { emitUpdate: false }); }, [editor, state.html]);
  useEffect(() => { editor?.setEditable(editable, false); }, [editor, editable]);

  function openSource(target: HTMLElement) {
    const anchor = target.closest("a");
    const id = anchor?.getAttribute("href")?.replace(/^#ref-/, "");
    const source = documents.find((doc) => doc.id === id);
    if (source) onPreview(source);
  }

  return <section className="pg-editor-panel" aria-label={proposal ? "Extracted proposal" : "Finance note"}>
    <div className="pg-editor-toolbar pg-writing-toolbar" aria-label="Writing tools">
      <select aria-label="Text style" disabled={!editable} value={editor?.isActive("heading", { level: 2 }) ? "2" : editor?.isActive("heading", { level: 3 }) ? "3" : "paragraph"} onChange={(event) => { if (event.target.value === "paragraph") editor?.chain().focus().setParagraph().run(); else editor?.chain().focus().setHeading({ level: Number(event.target.value) as 2 | 3 }).run(); }}><option value="paragraph">Paragraph</option><option value="2">Heading 1</option><option value="3">Heading 2</option></select>
      <select aria-label="Font size" disabled={!editable} value={editor?.getAttributes("fontSize").size ?? "16px"} onChange={(event) => editor?.chain().focus().setMark("fontSize", { size: event.target.value }).run()}>{[12, 14, 16, 18, 20, 24].map((size) => <option key={size} value={`${size}px`}>{size}</option>)}</select>
      <span className="pg-toolbar-divider" />
      <div className="pg-formatting">
        <button title="Bold" aria-label="Bold" aria-pressed={editor?.isActive("bold") ?? false} disabled={!editable} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={16} /></button>
        <button title="Italic" aria-label="Italic" aria-pressed={editor?.isActive("italic") ?? false} disabled={!editable} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={16} /></button>
        <button title="Underline" aria-label="Underline" aria-pressed={editor?.isActive("underline") ?? false} disabled={!editable} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleUnderline().run()}><Underline size={16} /></button>
        <button title="Cite a source" aria-label="Insert source link" disabled={!editable} onMouseDown={(event) => event.preventDefault()} onClick={() => setLinking(true)}><Link2 size={16} /></button>
      </div>
      <div className="pg-formatting pg-undo-tools"><button title="Undo" aria-label="Undo edit" disabled={!editable || !editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}><Undo2 size={16} /></button><button title="Redo" aria-label="Redo edit" disabled={!editable || !editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}><Redo2 size={16} /></button></div>
    </div>
    <div className="pg-document-scroll" data-lenis-prevent>
      <article className="pg-note-paper">
        <div className="pg-note-kicker"><span>{item.institution?.toUpperCase() ?? "UNIVERSITY · FINANCE"}</span><span>{proposal ? "PROPOSAL TEXT" : "FINANCE NOTE"}</span></div>
        <h2>{proposal ? "Extracted proposal text" : "Note for consideration"}</h2>
        <div className="pg-note-subject"><span>Subject</span><strong>{item.subject}</strong></div>
        <div className="pg-note-reference">{item.date} · {item.section}</div>
        <div onClick={(event) => { if ((event.target as HTMLElement).closest("a")) { event.preventDefault(); openSource(event.target as HTMLElement); } }}><EditorContent editor={editor} /></div>
        {state.signature && <div className="pg-signature"><strong>{state.signature.name}</strong><small>{state.signature.role} · {new Date(state.signature.date).toLocaleString()} · Demo signature</small></div>}
      </article>
    </div>
    <div className="pg-editor-footer"><span>{state.savedAt ? "Saved in this session" : item.imported ? "Manual draft" : "Prepared sample draft"}</span><span>{state.text.trim().split(/\s+/).filter(Boolean).length} words · {editable ? "Autosave on" : "Read-only"}</span></div>
    {linking && <Modal title="Cite a source" onClose={() => setLinking(false)}><p className="pg-help">Select a source to link the selected text or insert a citation.</p>{documents.map((doc) => <button className="pg-source-row" key={doc.id} onClick={() => { if (!editor) return; const href = `#ref-${doc.id}`; if (editor.state.selection.empty) editor.chain().focus().insertContent(`<a href="${escapeHtml(href)}">[${escapeHtml(doc.title)}]</a>`).run(); else editor.chain().focus().setLink({ href }).run(); setLinking(false); }}><Link2 size={16} /><span><strong>{doc.title}</strong><small>{doc.status} · {doc.locator}</small></span></button>)}</Modal>}
  </section>;
}
