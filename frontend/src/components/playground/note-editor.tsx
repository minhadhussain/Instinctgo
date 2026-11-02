"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, CheckCheck, ChevronDown, Download, Heading2, History, Link2, ListOrdered, MessageSquarePlus, PenLine, Redo2, Save, Undo2 } from "lucide-react";
import type { CaseDefinition, CaseState, ReferenceDocument, Role } from "@/lib/playground/types";
import { escapeHtml, exportNote } from "@/lib/playground/renderer";
import { getPath } from "@/lib/playground/hierarchy";
import { Badge, EmptyState, formatDate, Modal } from "./ui";

interface Props {
  item: CaseDefinition; state: CaseState; role: Role; editable: boolean;
  onChange: (html: string, text: string) => void; onSave: () => void;
  onComment: (text: string) => void; onPreview: (doc: ReferenceDocument) => void;
  notify: (message: string) => void;
}

export function NoteEditor({ item, state, role, editable, onChange, onSave, onComment, onPreview, notify }: Props) {
  const [modal, setModal] = useState<"versions" | "references" | "comment" | "rewrite" | null>(null);
  const [comment, setComment] = useState("");
  const [leftVersion, setLeftVersion] = useState(1);
  const [rightVersion, setRightVersion] = useState(0);
  const [selection, setSelection] = useState({ from: 0, to: 0, text: "" });
  const [exporting, setExporting] = useState(false);
  const documents = [...item.documents, ...state.extraDocuments];
  const canComment = !item.historical && !["Closed", "Demo approved", "Demo rejected"].includes(state.status) && role === getPath(item.branch, state.terminal)[state.level];
  const editor = useEditor({
    extensions: [StarterKit.configure({ italic: false, link: { openOnClick: false, autolink: false } })],
    immediatelyRender: false, shouldRerenderOnTransaction: true, content: state.html, editable,
    editorProps: { attributes: { class: "pg-rich-editor", "aria-label": "Administrative note editor", role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.getText()),
    onSelectionUpdate: ({ editor }) => { const { from, to } = editor.state.selection; setSelection({ from, to, text: editor.state.doc.textBetween(from, to, " ") }); },
  });
  useEffect(() => { if (editor && editor.getHTML() !== state.html) editor.commands.setContent(state.html, { emitUpdate: false }); }, [editor, state.html]);
  useEffect(() => { editor?.setEditable(editable, false); }, [editor, editable]);

  const rewrite = selection.text ? `It is submitted for consideration that ${selection.text.charAt(0).toLowerCase()}${selection.text.slice(1).replace(/[.!?]+$/, "")}.` : "";
  const original = state.versions.find((version) => version.id === leftVersion) ?? state.versions[0];
  const comparison = rightVersion ? state.versions.find((version) => version.id === rightVersion) : { text: state.text, label: "Current working copy" };
  async function download(format: "docx" | "pdf") {
    setExporting(true);
    try { await exportNote(format, item, state); notify(`${format.toUpperCase()} downloaded.`); }
    catch { notify("The export could not be created. Please try again."); }
    finally { setExporting(false); }
  }

  return <section className="pg-editor-panel" aria-label="Noting editor">
    <div className="pg-panel-heading"><span><span className="pg-small-square"><FileIcon /></span>Digital Green Sheet</span><button className="pg-text-button" onClick={() => setModal("versions")} disabled={!state.versions.length}><History size={13} />Versions <span className="pg-count">{state.versions.length}</span></button></div>
    <div className="pg-editor-toolbar">
      <span className="pg-editor-style">Normal text <ChevronDown size={11} /></span>
      <div className="pg-formatting">
        <button title="Bold" aria-label="Bold" aria-pressed={editor?.isActive("bold") ?? false} disabled={!editable} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={14} /></button>
        <button title="Heading" aria-label="Toggle heading" disabled={!editable} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}><Heading2 size={15} /></button>
        <button title="Numbered list" aria-label="Numbered list" disabled={!editable} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></button>
        <button title="Undo" aria-label="Undo edit" disabled={!editable || !editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}><Undo2 size={14} /></button>
        <button title="Redo" aria-label="Redo edit" disabled={!editable || !editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}><Redo2 size={14} /></button>
      </div>
      <button className="pg-text-button" disabled={!editable || !selection.text} title="Select text to rewrite" onMouseDown={(event) => event.preventDefault()} onClick={() => setModal("rewrite")}><PenLine size={13} />Rewrite</button>
    </div>
    {state.html ? <div className="pg-document-scroll">
      <article className="pg-note-paper">
        <div className="pg-note-kicker"><span>{item.section.toUpperCase()}</span><span>NOTE {String(Math.max(1, state.versions.length)).padStart(2, "0")}</span></div>
        <h2>Note for consideration</h2>
        <div className="pg-note-subject"><span>Subject</span><strong>{item.subject}</strong></div>
        <div className="pg-note-reference">File no. {item.id} <span>·</span> {item.date}</div>
        <Badge tone={state.status === "In review" ? "warning" : state.status === "Demo approved" || state.status === "Closed" ? "success" : "blue"}>{state.status}</Badge>
        <div onClick={(event) => { const anchor = (event.target as HTMLElement).closest("a"); if (anchor) { event.preventDefault(); const id = anchor.getAttribute("href")?.replace("#ref-", ""); const doc = documents.find((doc) => doc.id === id); if (doc) onPreview(doc); } }}><EditorContent editor={editor} /></div>
        <div className="pg-signature"><span>Submitted for kind consideration.</span><small>{item.assistant} · Dealing Assistant</small></div>
        <div className="pg-note-watermark">DEMO DOCUMENT</div>
      </article>
    </div> : <EmptyState title="No note prepared">The original proposal is available in Received.</EmptyState>}
    <div className="pg-editor-footer"><span><CheckCheck size={13} />{state.savedAt ? "Saved in this session" : "Synthetic working copy"}</span><span>{state.text.trim() ? state.text.trim().split(/\s+/).length : 0} words · {editable ? "Editing enabled" : "Read-only"}</span></div>
    <div className="pg-editor-actions"><div><button className="pg-text-button" disabled={!editable} onClick={() => setModal("references")}><Link2 size={13} />Insert reference</button><button className="pg-text-button" disabled={!state.html || !canComment} onClick={() => setModal("comment")}><MessageSquarePlus size={13} />Comment</button><button className="pg-text-button" disabled={!editable} onClick={onSave}><Save size={13} />Save version</button></div><div><button className="pg-text-button" disabled={!state.html || exporting} onClick={() => download("docx")}><Download size={13} />DOCX</button><button className="pg-text-button" disabled={!state.html || exporting} onClick={() => download("pdf")}>PDF</button></div></div>
    {modal === "versions" && <Modal title="Version history & comparison" onClose={() => setModal(null)} wide>
      <p className="pg-help">Changes are highlighted.</p>
      <div className="pg-compare-selects"><label>Earlier version<select value={leftVersion} onChange={(event) => setLeftVersion(Number(event.target.value))}>{state.versions.map((version) => <option key={version.id} value={version.id}>v{version.id} · {version.label}</option>)}</select></label><label>Compare with<select value={rightVersion} onChange={(event) => setRightVersion(Number(event.target.value))}><option value={0}>Current working copy</option>{state.versions.map((version) => <option key={version.id} value={version.id}>v{version.id} · {version.label}</option>)}</select></label></div>
      <div className="pg-comparison">{[{ value: original, other: comparison }, { value: comparison, other: original }].map(({ value, other }, index) => <article key={index}><h4>{value?.label}</h4>{value?.text.split("\n").filter(Boolean).map((line, lineIndex) => <p key={lineIndex} className={!other?.text.split("\n").includes(line) ? "pg-diff" : ""}>{line}</p>)}</article>)}</div>
      <div className="pg-version-list">{state.versions.toReversed().map((version) => <div key={version.id}><strong>v{version.id} · {version.label}</strong><span>{version.author} · {formatDate(version.date)}</span></div>)}</div>
    </Modal>}
    {modal === "references" && <Modal title="Insert reference" onClose={() => setModal(null)}>{documents.map((doc, index) => <button className="pg-source-row" key={doc.id} disabled={doc.status !== "Current"} onClick={() => { editor?.chain().focus().insertContent(` <a href="#ref-${doc.id}">[${index + 1}: ${escapeHtml(doc.title)}]</a> `).run(); setModal(null); }}><Link2 size={16} /><span><strong>{doc.title}</strong><small>{doc.status} · {doc.locator}</small></span></button>)}</Modal>}
    {modal === "comment" && <Modal title="Add observation" onClose={() => setModal(null)}><form onSubmit={(event) => { event.preventDefault(); if (comment.trim()) { onComment(`${selection.text ? `On “${selection.text}”: ` : ""}${comment.trim()}`); setComment(""); setModal(null); } }}><p className="pg-help">{role}</p>{selection.text && <blockquote>{selection.text}</blockquote>}<label className="pg-field">Observation<textarea required value={comment} onChange={(event) => setComment(event.target.value)} rows={4} /></label><button className="pg-button pg-primary" type="submit">Add comment</button></form></Modal>}
    {modal === "rewrite" && <Modal title="Rewrite selection" onClose={() => setModal(null)}><h4>Selected text</h4><blockquote>{selection.text}</blockquote><h4>Suggested wording</h4><p className="pg-suggestion">{rewrite}</p><button className="pg-button pg-primary" onClick={() => { editor?.chain().focus().insertContentAt({ from: selection.from, to: selection.to }, escapeHtml(rewrite)).run(); setModal(null); notify("Text updated."); }}>Apply</button></Modal>}
  </section>;
}

function FileIcon() { return <span aria-hidden="true">N</span>; }
