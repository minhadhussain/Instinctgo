"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, Check, ChevronDown, CircleAlert, FileText, History, LoaderCircle, Search, UploadCloud, X } from "lucide-react";
import { DOCUMENT_ACCEPT, displayStatus, validateDocument, type IntakeJob } from "@/lib/playground/intake";
import type { CaseDefinition, CaseState, ReferenceDocument, WorkspaceKind } from "@/lib/playground/types";
import { Badge } from "./ui";
import { ScanDocument } from "./scan-document";
import { AssistantPanel } from "./assistant-panel";

interface Props {
  cases: CaseDefinition[]; states: Record<string, CaseState>; jobs: Record<string, IntakeJob>;
  sample: { title: string; proposalUrl: string; proposalName: string }; onPreview: (document: ReferenceDocument) => void;
  onUpload: (file: File, progress: (value: number) => void, signal: AbortSignal) => Promise<string>;
  onProcess: (id: string) => void; onOpen: (id: string) => void;
  workspace?: WorkspaceKind;
}

export function DocumentIntake({ cases, states, jobs, sample, onPreview, onUpload, onProcess, onOpen, workspace }: Props) {
  const picker = useRef<HTMLInputElement>(null);
  const operation = useRef<AbortController | null>(null);
  const sampleRequest = useRef<AbortController | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [loadingSample, setLoadingSample] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedId, setUploadedId] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => { operation.current?.abort(); sampleRequest.current?.abort(); }, []);

  async function receive(files: File[]) {
    if (!files.length) return;
    sampleRequest.current?.abort(); setLoadingSample(false);
    operation.current?.abort();
    setUploadedId(""); setProgress(0); setBusy(false);
    if (files.length !== 1) { setError("Please add one proposal at a time."); setFile(null); return; }
    const selected = files[0];
    setFile(selected);
    const invalid = validateDocument(selected);
    setError(invalid);
    if (invalid) return;
    const controller = new AbortController(); operation.current = controller;
    setBusy(true);
    try {
      const id = await onUpload(selected, setProgress, controller.signal);
      if (!controller.signal.aborted) setUploadedId(id);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Upload failed. Try again.");
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function loadSample() {
    sampleRequest.current?.abort();
    const controller = new AbortController(); sampleRequest.current = controller;
    setLoadingSample(true); setError("");
    try {
      const response = await fetch(sample.proposalUrl, { signal: controller.signal });
      if (!response.ok) throw new Error("The sample proposal could not be loaded. Please try again.");
      const blob = await response.blob();
      if (!controller.signal.aborted) await receive([new File([blob], sample.proposalName, { type: sample.proposalName.endsWith(".txt") ? "text/plain" : "application/pdf" })]);
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "The sample could not be loaded."); }
    finally { setLoadingSample(false); }
  }
  function clearSelection() { operation.current?.abort(); sampleRequest.current?.abort(); setFile(null); setUploadedId(""); setProgress(0); setBusy(false); setLoadingSample(false); setError(""); }
  const history = cases.filter((item) => `${item.subject} ${item.id} ${item.description}`.toLowerCase().includes(query.toLowerCase()) && (!filter || displayStatus(states[item.id], jobs[item.id]) === filter));
  const size = file ? file.size < 1024 ? `${file.size} B` : file.size < 1048576 ? `${Math.ceil(file.size / 1024)} KB` : `${(file.size / 1048576).toFixed(1)} MB` : "";

  return <div className="pg-intake-layout">
    <main className="pg-intake-main">
      <div className="pg-intake-heading"><h2 tabIndex={-1}>Add a proposal</h2><p>Extract the text, review it, then convert it into a note.</p></div>
      <div className={`pg-drop-card ${dragging ? "pg-drag-active" : ""} ${uploadedId ? "pg-upload-ready" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); void receive(Array.from(event.dataTransfer.files)); }}>
        {file && !busy && <button className="pg-icon-button pg-upload-reset" aria-label="Clear file selection" title="Clear selection" onClick={clearSelection}><X size={16} /></button>}
        <span className="pg-upload-icon">{busy ? <LoaderCircle className="pg-spinner" size={30} /> : uploadedId ? <Check size={30} /> : error ? <CircleAlert size={30} /> : <UploadCloud size={30} strokeWidth={1.6} />}</span>
        <div aria-live="polite"><h3>{busy ? "Adding your proposal…" : uploadedId ? "Ready to extract text" : error && file ? "This file needs another look" : "Drop your proposal here"}</h3>{file ? <p className="pg-upload-filename" title={file.name}>{file.name}<small>{size}</small></p> : <p>or choose a file from your device</p>}</div>
        {busy ? <><progress className="pg-upload-meter" aria-label="Upload progress" max={100} value={progress} /><span className="pg-upload-percent">{progress}%</span><button className="pg-button" onClick={clearSelection}>Cancel upload</button></> : uploadedId ? <div className="pg-intake-buttons"><button className="pg-button pg-primary pg-process-document" onClick={() => onProcess(uploadedId)}>Convert to text<ArrowRight size={16} /></button><button className="pg-button" onClick={() => picker.current?.click()}>Choose another file</button></div> : <div className="pg-intake-buttons"><button className="pg-button pg-primary" onClick={() => picker.current?.click()}><UploadCloud size={16} />{error ? "Choose a file" : "Upload proposal"}</button><button className="pg-button" onClick={() => setScanning(true)}><Camera size={16} />Scan document</button></div>}
        {error && <div className="pg-upload-error" role="alert"><p>{error}</p>{file && !validateDocument(file) && <button className="pg-text-button" onClick={() => void receive([file])}>Try this file again</button>}</div>}
        <input ref={picker} type="file" accept={DOCUMENT_ACCEPT} className="sr-only" aria-label="Upload proposal document" onChange={(event) => { void receive(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
        <small>PDF, Word, images or text · Up to 20 MB</small>
        <details className="pg-file-requirements"><summary>File requirements<ChevronDown size={12} /></summary><p>PDF, DOCX, TXT, MD, PNG and JPG/JPEG. PDFs up to 100 pages; converted text up to 200,000 characters. Scans use English OCR.</p></details>
      </div>
      <div className="pg-sample-launch"><button className="pg-button" disabled={busy || loadingSample} onClick={() => void loadSample()}>{loadingSample ? "Loading…" : "Use sample"}<ArrowRight size={14} /></button></div>
      <details className="pg-recent-documents">
        <summary><History size={16} />Recent documents<span className="pg-count">{cases.length}</span><ChevronDown size={15} /></summary>
        {cases.length > 0 && <div className="pg-history-filters"><label className="pg-search"><Search size={15} /><input placeholder="Search documents…" aria-label="Search recent documents" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="Filter processing status" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All statuses</option>{[...new Set(cases.map((item) => displayStatus(states[item.id], jobs[item.id])))].map((status) => <option key={status}>{status}</option>)}</select></div>}
        <div className="pg-history-list" data-lenis-prevent>{history.map((item) => { const status = displayStatus(states[item.id], jobs[item.id]); return <button key={item.id} className="pg-history-item" onClick={() => onOpen(item.id)}><span className="pg-history-icon"><FileText size={18} /></span><span><strong>{item.documents[0]?.title ?? item.subject}</strong><small>{item.id} · {item.date}</small><Badge tone={status === "Completed" ? "success" : status === "Error" ? "danger" : status === "In Review" ? "warning" : "blue"}>{status}</Badge></span><ArrowRight size={13} /></button>; })}{!history.length && <div className="pg-history-empty"><FileText size={24} /><p>{cases.length ? "No matching documents." : "Your uploaded proposals will appear here."}</p>{cases.length > 0 && <button className="pg-text-button" onClick={() => { setQuery(""); setFilter(""); }}>Clear filters</button>}</div>}</div>
      </details>
    </main>
    <aside className="pg-intake-sidebar pg-intake-assistant" aria-label="Proposal AI Assistant"><AssistantPanel libraryOnly intake workspace={workspace} documents={[]} onPreview={onPreview} /></aside>
    {scanning && <ScanDocument onCapture={(file) => void receive([file])} onClose={() => setScanning(false)} />}
  </div>;
}
