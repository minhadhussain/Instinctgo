"use client";

import { useEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import { resumePageScroll } from "@/lib/smooth-scroll";
import { ArrowLeft, ChevronRight, Copy, Eye, FileText, Info, LoaderCircle, Maximize2, Minimize2, X } from "lucide-react";
import { convertGpfProposal, gpfCase, gpfSample } from "@/lib/playground/gpf-case";
import { allRoles, getPath } from "@/lib/playground/hierarchy";
import { initialCaseState } from "@/lib/playground/workflow";
import { escapeHtml, exportNote } from "@/lib/playground/renderer";
import { createImportedCase, displayStatus, readDocument, validateDocument, type IntakeJob } from "@/lib/playground/intake";
import { performFinanceAction } from "@/lib/playground/finance-actions";
import { applyExtractedText } from "@/lib/playground/document-text";
import { extractDocumentText } from "@/lib/playground/extract-document";
import type { CaseDefinition, CaseState, ReferenceDocument, Role, WorkflowAction } from "@/lib/playground/types";
import { Studio } from "./studio";
import { DocumentIntake } from "./document-intake";
import { FinanceActions } from "./finance-actions";
import { ProposalPreview } from "./proposal-preview";
import { UploadDocument } from "./repository";
import { Badge, DocumentPreview, Modal } from "./ui";
import "./playground.css";
import "./finance-playground.css";

const emptyState = initialCaseState(gpfCase);

export function AdministrativePlayground() {
  const lenis = useLenis();
  const [page, setPage] = useState<"intake" | "editor">("intake");
  const [cases, setCases] = useState<CaseDefinition[]>([]);
  const [states, setStates] = useState<Record<string, CaseState>>({});
  const [jobs, setJobs] = useState<Record<string, IntakeJob>>({});
  const [selected, setSelected] = useState("");
  const [role, setRole] = useState<Role>("Dealing Assistant");
  const [preview, setPreview] = useState<ReferenceDocument | null>(null);
  const [previewNote, setPreviewNote] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState(false);
  const [fileDetails, setFileDetails] = useState(false);
  const [proposalPreview, setProposalPreview] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const urls = useRef(new Set<string>());
  const conversions = useRef(new Map<string, AbortController>());
  const app = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const item = cases.find((candidate) => candidate.id === selected) ?? gpfCase;
  const state = states[selected] ?? emptyState;
  const job = jobs[selected];
  const proposal = state.draftKind === "proposal";
  const editable = !job && !item.historical && role === "Dealing Assistant" && state.level === 0 && ["AI-generated draft", "Extracted draft", "Generated note", "Human-edited draft", "Returned"].includes(state.status);
  const documents = [...item.documents, ...state.extraDocuments].filter((doc, index, array) => array.findIndex((other) => other.id === doc.id) === index);

  useEffect(() => {
    mounted.current = true;
    const owned = urls.current;
    const active = conversions.current;
    return () => { mounted.current = false; active.forEach((controller) => controller.abort()); active.clear(); owned.forEach((url) => URL.revokeObjectURL(url)); owned.clear(); };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    lenis?.stop();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !document.querySelector("dialog[open]")) setExpanded(false); };
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", escape); resumePageScroll(lenis); };
  }, [expanded, lenis]);

  function update(change: Partial<CaseState> | ((state: CaseState) => CaseState)) {
    setStates((previous) => ({ ...previous, [selected]: typeof change === "function" ? change(previous[selected]) : { ...previous[selected], ...change } }));
  }
  function focusWorkspace() {
    requestAnimationFrame(() => {
      app.current?.scrollTo({ top: 0, behavior: "instant" });
      if (!expanded && app.current) {
        if (lenis) lenis.scrollTo(app.current, { immediate: true });
        else app.current.scrollIntoView({ block: "start", behavior: "instant" });
      }
      app.current?.querySelector<HTMLElement>(".pg-finance-heading h2, .pg-intake-heading h2")?.focus({ preventScroll: true });
    });
  }
  function openCase(id: string) { setSelected(id); setNoteError(""); if (states[id]?.draftKind === "proposal") setRole("Dealing Assistant"); setPage("editor"); focusWorkspace(); }
  function openIntake() { setPage("intake"); focusWorkspace(); }
  async function upload(file: File, progress: (value: number) => void, signal: AbortSignal) {
    const error = validateDocument(file);
    if (error) throw new Error(error);
    const bytes = await readDocument(file, progress, signal);
    if (signal.aborted || !mounted.current) throw new DOMException("Upload cancelled", "AbortError");
    const url = URL.createObjectURL(file);
    const id = `FIN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    let record: CaseDefinition;
    try { record = createImportedCase(file, bytes, url, id, new Date().toISOString()); }
    catch (cause) { URL.revokeObjectURL(url); throw cause; }
    urls.current.add(url);
    setCases((previous) => [record, ...previous]);
    setStates((previous) => ({ ...previous, [id]: initialCaseState(record) }));
    setJobs((previous) => ({ ...previous, [id]: { status: "Uploaded" } }));
    return id;
  }
  async function processDocument(id: string) {
    const record = cases.find((candidate) => candidate.id === id);
    const original = record?.documents[0].original;
    if (!record || !original || !jobs[id] || conversions.current.has(id)) return;
    const controller = new AbortController();
    conversions.current.set(id, controller);
    openCase(id);
    setJobs((previous) => ({ ...previous, [id]: { status: "Processing", progress: 0, message: "Opening your original file" } }));
    try {
      const response = await fetch(original.url, { signal: controller.signal });
      if (!response.ok) throw new Error("The original file is no longer available. Upload it again.");
      const file = new File([await response.blob()], original.name, { type: original.mime });
      controller.signal.throwIfAborted();
      const text = await extractDocumentText(file, { signal: controller.signal, onProgress: (progress) => {
        if (mounted.current && !controller.signal.aborted) setJobs((previous) => ({ ...previous, [id]: { status: "Processing", ...progress } }));
      } });
      if (!mounted.current || controller.signal.aborted) return;
      const converted = applyExtractedText(record, states[id], text, new Date().toISOString());
      setCases((previous) => previous.map((candidate) => candidate.id === id ? converted.item : candidate));
      setStates((previous) => ({ ...previous, [id]: converted.state }));
      setJobs((previous) => { const next = { ...previous }; delete next[id]; return next; });
      setNotice(`${record.subject} converted to editable text.`);
    } catch (error) {
      if (!mounted.current) return;
      setJobs((previous) => ({ ...previous, [id]: controller.signal.aborted ? { status: "Uploaded" } : { status: "Error", error: error instanceof Error ? error.message : "Text conversion failed. Your original is retained; please retry." } }));
    } finally { conversions.current.delete(id); }
  }
  function downloadText() {
    const url = URL.createObjectURL(new Blob([state.text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${item.subject}-text.txt`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyText() {
    try { await navigator.clipboard.writeText(state.text); setNotice("Text copied."); }
    catch { setNotice("Copy was unavailable. Select the text in the editor or download the TXT file."); }
  }
  function changeNote(html: string, text: string) {
    if (!editable) return;
    setNoteError("");
    const cited = Array.from(html.matchAll(/href="#ref-([^"]+)"/g), (match) => match[1]);
    update((previous) => ({ ...previous, html, text, status: "Human-edited draft", savedAt: new Date().toISOString(), checks: [], extraDocuments: [...previous.extraDocuments, ...documents.filter((doc) => cited.includes(doc.id) && !item.documents.some((source) => source.id === doc.id) && !previous.extraDocuments.some((source) => source.id === doc.id))] }));
  }
  function insertDraft(text: string) {
    changeNote(`${state.html}<p>${escapeHtml(text)}</p>`, `${state.text}\n\n${text}`);
  }
  function convertToNote() {
    if (!editable || !proposal) return;
    try {
      const result = convertGpfProposal(item, state, new Date().toISOString());
      setCases((previous) => previous.map((candidate) => candidate.id === selected ? result.item : candidate));
      update(result.state);
      setNoteError("");
      setNotice("GPF note prepared from the reviewed proposal text.");
      focusWorkspace();
    } catch (error) { setNoteError(error instanceof Error ? error.message : "The note could not be prepared. Review the proposal text and try again."); focusWorkspace(); }
  }
  function saveDraft() {
    if (!editable) return;
    const now = new Date().toISOString();
    update((previous) => ({ ...previous, savedAt: now, versions: [...previous.versions, { id: previous.versions.length + 1, label: proposal ? "Saved proposal text" : "Saved finance note", html: previous.html, text: previous.text, author: role, date: now }] }));
    setNotice(proposal ? "Proposal text saved." : "Note saved.");
  }
  function action(action: WorkflowAction, remarks: string, verified: boolean, name: string) {
    const result = performFinanceAction(item, state, role, action, remarks, verified, name, new Date().toISOString());
    if (result.error) return result.error;
    update(result.state!);
    setNotice(action === "approve" ? "Demo approval and signature recorded." : action === "close" ? "Final action recorded." : `File is now with ${getPath(item.branch, state.terminal)[result.state!.level]}.`);
  }
  async function download(format: "docx" | "pdf") {
    setExporting(true);
    try { await exportNote(format, item, state); setNotice(`${format.toUpperCase()} downloaded.`); }
    catch { setNotice("Export failed. Please try again."); }
    finally { setExporting(false); }
  }
  const status = displayStatus(state, job);

  return <div ref={app} data-lenis-prevent={expanded || undefined} className={`pg-app pg-finance ${expanded ? "pg-expanded" : ""}`} aria-label="Noting workspace">
    <div className="pg-window-bar"><span className="pg-workspace-name"><span className="pg-workspace-mark"><FileText size={20} /></span><strong>Noting workspace</strong></span><div><span className="pg-session-label">Session only</span><button aria-label={expanded ? "Exit expanded playground" : "Expand playground"} aria-pressed={expanded} title={expanded ? "Exit expanded view" : "Expand workspace"} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}<span>{expanded ? "Exit full screen" : "Expand"}</span></button></div></div>
    {page === "editor" && <header className="pg-finance-topbar">
      <nav className="pg-finance-breadcrumb" aria-label="Breadcrumb"><button onClick={openIntake}><ArrowLeft size={14} />Documents</button><ChevronRight size={12} /><strong title={item.subject}>{item.subject}</strong></nav>
      <button className="pg-button" disabled={!!job || !state.html} onClick={() => { if (editable) update({ savedAt: new Date().toISOString() }); setPreviewNote(true); }}><Eye size={16} />{proposal ? "Preview text" : "Preview note"}</button>
    </header>}
    {page === "intake" ? <DocumentIntake cases={cases} states={states} jobs={jobs} sample={gpfSample} onPreview={setPreview} onUpload={upload} onProcess={(id) => void processDocument(id)} onOpen={openCase} /> : <>
      <div className="pg-finance-heading"><div><div className="pg-document-title"><h2 tabIndex={-1}>{item.subject}</h2>{(!proposal || job) && <Badge tone={status === "Completed" ? "success" : status === "Error" ? "danger" : status === "In Review" ? "warning" : "blue"}>{status}</Badge>}</div><div className="pg-document-tools"><button className="pg-text-button" onClick={() => setPreview(item.documents[0])}><FileText size={14} />View original proposal</button>{state.proposalDraft && <button className="pg-text-button" onClick={() => setProposalPreview(true)}>View proposal text</button>}<button className="pg-text-button" onClick={() => setFileDetails(true)}><Info size={14} />File details</button></div></div>{!job && !proposal && <label className="pg-role-picker"><span>Demo role</span><select aria-label="Demo role" value={role} onChange={(event) => setRole(event.target.value as Role)}>{allRoles.map((value) => <option key={value}>{value}</option>)}</select></label>}</div>
      {job ? <div className="pg-processing-state" role="status">{job.status === "Processing" ? <><LoaderCircle className="pg-spinner" size={32} /><h3>Converting document to text…</h3><p>{job.message}</p><progress className="pg-conversion-progress" max={100} value={job.progress ?? 0} aria-label="Text conversion progress" /><small>{job.progress ?? 0}% · Processing in your browser</small><button className="pg-button" onClick={() => conversions.current.get(item.id)?.abort()}>Cancel conversion</button></> : <><FileText size={32} /><h3>{job.status === "Error" ? "Text conversion failed" : "Your document is ready to convert"}</h3><p>{job.error ?? "Convert the document into editable text in your browser."}</p><div><button className="pg-button" onClick={openIntake}>Back to documents</button><button className="pg-button pg-primary" onClick={() => void processDocument(item.id)}>{job.status === "Error" ? "Retry conversion" : "Convert to text"}</button></div></>}</div> : <>
        <div className="pg-manual-draft"><span><strong>{proposal ? "1. Review the proposal text" : "2. Finance note prepared"}</strong><small>{proposal ? "Check the extracted text, then choose Convert to note. Your original is preserved." : `${state.appliedRuleIds?.length ?? 0} applied rule entries from the supplied GPF Rules, 2013. The proposal text is preserved separately.`}</small></span><button className="pg-text-button" onClick={() => void copyText()}><Copy size={13} />{proposal ? "Copy text" : "Copy note"}</button></div>
        {noteError && <div className="pg-note-error" role="alert">{noteError}</div>}
        <Studio key={`${item.id}-${state.draftKind}`} item={item} state={state} cases={cases} states={states} documents={documents} editable={editable} onChange={changeNote} onInsert={insertDraft} onPreview={setPreview} onOpen={openCase} onUpload={() => setUploading(true)} />
        <FinanceActions key={`${item.id}-${state.draftKind}-${state.movements.length}-${role}`} item={item} state={state} role={role} editable={editable} exporting={exporting} onSave={saveDraft} onHistory={() => setHistory(true)} onExport={(format) => void download(format)} onTextDownload={item.imported ? downloadText : undefined} onConvertToNote={proposal ? convertToNote : undefined} onAction={action} />
      </>}
    </>}
    <footer className="pg-app-footer"><span>Session workspace</span><span>Files and changes clear on reload</span></footer>
    {notice && <div className="pg-toast" role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={15} /></button></div>}
    {previewNote && <ProposalPreview item={item} state={state} documents={documents} onClose={() => setPreviewNote(false)} onSource={setPreview} />}
    {preview && <DocumentPreview document={preview} onClose={() => setPreview(null)} />}
    {proposalPreview && state.proposalDraft && <Modal title="Proposal text used for this note" onClose={() => setProposalPreview(false)} wide><p className="pg-preserve-lines">{state.proposalDraft.text}</p></Modal>}
    {fileDetails && <Modal title="File details" onClose={() => setFileDetails(false)}><dl className="pg-file-metadata"><div><dt>Document</dt><dd>{item.documents[0].original?.name ?? item.subject}</dd></div><div><dt>Reference</dt><dd>{item.id}</dd></div><div><dt>Department</dt><dd>{item.section}</dd></div><div><dt>Date</dt><dd>{item.date}</dd></div><div><dt>Status</dt><dd>{status}</dd></div><div><dt>Assigned to</dt><dd>{getPath(item.branch, state.terminal)[state.level]}</dd></div><div><dt>Source</dt><dd>{item.documents[0].source}</dd></div>{item.documents[0].original && <div><dt>File size</dt><dd>{item.documents[0].original.size.toLocaleString()} bytes</dd></div>}{item.documents[0].extraction && <div><dt>Conversion</dt><dd>{item.documents[0].extraction.method}{item.documents[0].extraction.method.includes("PDF") ? ` · ${item.documents[0].extraction.pages} pages` : ""}</dd></div>}</dl></Modal>}
    {uploading && <UploadDocument onClose={() => setUploading(false)} onAdd={(doc) => { if (editable) update((previous) => ({ ...previous, extraDocuments: [...previous.extraDocuments, doc] })); }} />}
    {history && <Modal title="Versions & activity" onClose={() => setHistory(false)} wide><h4>Saved versions</h4>{state.versions.toReversed().map((version) => <details className="pg-detail-section" key={version.id}><summary>v{version.id} · {version.label} · {version.author}</summary><p className="pg-preserve-lines">{version.text}</p></details>)}<h4>File activity</h4>{state.movements.length ? state.movements.toReversed().map((event) => <div className="pg-observation" key={event.id}><strong>{event.from} → {event.to}</strong><small>{new Date(event.date).toLocaleString()}</small><p>{event.remarks}</p></div>) : <p className="pg-help">No workflow actions yet.</p>}{state.signature && <p>Demo signature: {state.signature.name} · {state.signature.role}</p>}</Modal>}
  </div>;
}
