"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, ChevronRight, FilePenLine, FolderOpen, GitBranch, LayoutDashboard, Maximize2, MessageSquareText, Minimize2, Settings2, ShieldCheck, X } from "lucide-react";
import { cases, libraryDocuments, sampleCases } from "@/lib/playground/data";
import { allRoles, getPath } from "@/lib/playground/hierarchy";
import { advanceWorkflow, clarifications, initialCaseState } from "@/lib/playground/workflow";
import { escapeHtml, renderNote } from "@/lib/playground/renderer";
import type { CaseState, ReferenceDocument, Role, View, WorkflowAction } from "@/lib/playground/types";
import { Studio } from "./studio";
import { Overview } from "./overview";
import { AssistantPanel } from "./assistant-panel";
import { WorkflowPanel } from "./workflow-panel";
import { CaseDetail, CaseExplorer, ReferenceLibrary, UploadDocument } from "./repository";
import { Administration } from "./administration";
import { Badge, DocumentPreview } from "./ui";
import "./playground.css";

const navigation = [{ label: "Overview", icon: LayoutDashboard }, { label: "Noting Studio", icon: FilePenLine }, { label: "AI Assistant", icon: MessageSquareText }, { label: "Case Explorer", icon: FolderOpen }, { label: "Reference Library", icon: BookOpen }, { label: "Workflow", icon: GitBranch }, { label: "Administration", icon: Settings2 }] as const;

export function AdministrativePlayground() {
  const [view, setView] = useState<View>("Noting Studio");
  const [selected, setSelected] = useState(sampleCases[0].id);
  const [states, setStates] = useState<Record<string, CaseState>>(() => Object.fromEntries(cases.map((item, index) => [item.id, initialCaseState(item, index === 0)])));
  const [role, setRole] = useState<Role>("Dealing Assistant");
  const [inspectedStage, setInspectedStage] = useState(6);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReferenceDocument | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extraLibrary, setExtraLibrary] = useState<ReferenceDocument[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState("");
  const appRef = useRef<HTMLDivElement>(null);
  const item = cases.find((item) => item.id === selected)!;
  const state = states[selected];
  const editable = !item.historical && runningId !== selected && state.level === 0 && role === "Dealing Assistant" && ["AI-generated draft", "Human-edited draft", "Returned"].includes(state.status) && Boolean(state.html);
  const assigned = getPath(item.branch, state.terminal)[state.level];
  const allDocuments = [...libraryDocuments, ...extraLibrary, ...Object.values(states).flatMap((state) => state.extraDocuments)].filter((doc, index, array) => array.findIndex((other) => other.id === doc.id) === index);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onEscape(event: KeyboardEvent) { if (event.key === "Escape" && !document.querySelector("dialog[open]")) setExpanded(false); }
    window.addEventListener("keydown", onEscape);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onEscape); };
  }, [expanded]);
  useEffect(() => {
    if (!runningId) return;
    let step = 0;
    const current = cases.find((item) => item.id === runningId)!;
    const interval = setInterval(() => {
      step += 1;
      const next = step;
      setInspectedStage(next);
      setStates((previous) => {
        const previousState = previous[runningId];
        const baseNote = next === 4 ? renderNote(current) : null;
        const amendment = previousState.terminal !== current.terminal ? routingAmendment(current.branch, previousState.terminal) : null;
        const generated = baseNote ? { html: baseNote.html + (amendment?.html ?? ""), text: baseNote.text + (amendment?.text ?? "") } : null;
        const now = new Date().toISOString();
        return { ...previous, [runningId]: { ...previousState, stage: next, ...(generated ? { ...generated, status: "AI-generated draft" as const, versions: [...previousState.versions, { id: previousState.versions.length + 1, label: "AI-generated draft", ...generated, date: now, author: "Simulated AI" as const }], savedAt: now } : {}) } };
      });
      if (next === 6) { clearInterval(interval); setRunningId(null); setNotice("Draft ready for review."); }
    }, 700);
    return () => clearInterval(interval);
  }, [runningId]);

  function update(change: Partial<CaseState> | ((state: CaseState) => CaseState)) {
    setStates((previous) => ({ ...previous, [selected]: typeof change === "function" ? change(previous[selected]) : { ...previous[selected], ...change } }));
  }
  function openCase(id: string, nextView: View = "Noting Studio") {
    if (runningId) setStates((previous) => ({ ...previous, [runningId]: { ...previous[runningId], stage: previous[runningId].html ? 6 : 0 } }));
    setRunningId(null); setSelected(id); setView(nextView); setInspectedStage(runningId === id ? (states[id].html ? 6 : 0) : states[id].stage); setDetailId(null);
  }
  function saveVersion(label = "Human-edited draft") {
    if (!editable) return;
    const now = new Date().toISOString();
    update((previous) => ({ ...previous, savedAt: now, versions: [...previous.versions, { id: previous.versions.length + 1, label, html: previous.html, text: previous.text, author: role, date: now }] }));
    setNotice("Version saved.");
  }
  function changeNote(html: string, text: string) {
    if (!editable) return;
    update({ html, text, status: "Human-edited draft", savedAt: new Date().toISOString(), checks: [] });
  }
  function insertDraft(text: string) {
    if (!editable) return;
    changeNote(`${state.html}<p>${escapeHtml(text)}</p>`, `${state.text}\n\n${text}`);
    setNotice("Text inserted into note.");
  }
  function comment(text: string) {
    if (item.historical || role !== assigned || ["Closed", "Demo approved", "Demo rejected"].includes(state.status)) return;
    update((previous) => ({ ...previous, comments: [...previous.comments, { id: previous.comments.length + 1, author: role, date: new Date().toISOString(), text }] }));
    setNotice("Observation recorded.");
  }
  function action(action: WorkflowAction, remarks: string) {
    const result = advanceWorkflow(item, state, role, action, remarks, new Date().toISOString());
    if (result.error) { setNotice(result.error); return; }
    update(result.state!);
    setNotice(action === "close" ? "File closed." : `File with ${getPath(item.branch, state.terminal)[result.state!.level]}.`);
  }
  function correction(text: string) {
    if (role !== "Dealing Assistant" || state.level !== 0 || !text.trim()) return;
    const now = new Date().toISOString();
    const html = `${state.html}<h3>Correction response</h3><p>${escapeHtml(text.trim())}</p>`;
    const plain = `${state.text}\n\nCorrection response\n${text.trim()}`;
    update((previous) => ({ ...previous, html, text: plain, status: "Human-edited draft", correction: text.trim(), savedAt: now, versions: [...previous.versions, { id: previous.versions.length + 1, label: "Correction response", html, text: plain, author: "Dealing Assistant", date: now }], comments: [...previous.comments, { id: previous.comments.length + 1, author: "Dealing Assistant", date: now, text: `Correction: ${text.trim()}` }] }));
    setNotice("Correction version saved.");
  }
  function clarify() {
    if (!editable || !clarifications[item.id] || state.extraDocuments.some((doc) => doc.id === `${item.id}-clarification`)) return;
    const text = clarifications[item.id];
    const now = new Date().toISOString();
    const doc: ReferenceDocument = { id: `${item.id}-clarification`, title: "Clarification packet", type: "Supporting clarification", source: "Sample University · demo records", date: now.slice(0, 10), effectiveDate: now.slice(0, 10), version: "1.0", status: "Current", department: item.section, locator: "Page 1 · Additional evidence", content: ["Supporting clarification — demo record.", text], highlight: 1 };
    const html = `${state.html}<h3>Additional examination after clarification</h3><p>${escapeHtml(text)} <a href="#ref-${doc.id}">[Clarification]</a></p>`;
    const plain = `${state.text}\n\nAdditional examination after clarification\n${text}`;
    update((previous) => ({ ...previous, html, text: plain, status: "Human-edited draft", correction: text, savedAt: now, extraDocuments: [...previous.extraDocuments, doc], versions: [...previous.versions, { id: previous.versions.length + 1, label: "Additional evidence & revised note", html, text: plain, author: "Dealing Assistant", date: now }], comments: [...previous.comments, { id: previous.comments.length + 1, text: `Sample clarification attached: ${text}`, author: "Dealing Assistant", date: now }] }));
    setNotice("Clarification attached. Note revised.");
  }
  function run() {
    if (state.level !== 0 || role !== "Dealing Assistant" || item.historical || state.movements.length) return;
    update((previous) => ({ ...previous, stage: 0, versions: previous.html && previous.html !== previous.versions.at(-1)?.html ? [...previous.versions, { id: previous.versions.length + 1, label: "Working copy before regeneration", html: previous.html, text: previous.text, author: "Dealing Assistant", date: new Date().toISOString() }] : previous.versions }));
    setInspectedStage(0); setRunningId(item.id);
  }
  function addDocument(doc: ReferenceDocument, attach: boolean) {
    setExtraLibrary((previous) => [...previous, doc]);
    const canAttach = !item.historical && state.level === 0 && role === "Dealing Assistant" && !["Closed", "Demo approved", "Demo rejected"].includes(state.status);
    if (attach && canAttach) update((previous) => ({ ...previous, extraDocuments: [...previous.extraDocuments, doc] }));
    setNotice(attach && !canAttach ? "Added to library. This file is not open for attachments." : "Document added. Source status: Unverified.");
  }
  function configureTerminal(category: string, terminal: Role) {
    setStates((previous) => Object.fromEntries(Object.entries(previous).map(([id, current]) => {
      const definition = cases.find((item) => item.id === id)!;
      if (definition.historical || definition.category !== category || current.level !== 0 || current.movements.length || !getPath(definition.branch, terminal).length) return [id, current];
      const amendment = routingAmendment(definition.branch, terminal);
      const now = new Date().toISOString();
      const html = current.html ? current.html + amendment.html : "";
      const text = current.text ? current.text + amendment.text : "";
      return [id, { ...current, terminal, html, text, ...(html ? { status: "Human-edited draft", savedAt: now, versions: [...current.versions, { id: current.versions.length + 1, label: "Session authority amendment", html, text, date: now, author: role }] } : {}) }];
    })));
    setNotice(`Approval authority updated to ${terminal}.`);
  }
  const inboxCount = cases.filter((item) => !item.historical && states[item.id].status !== "Closed" && getPath(item.branch, states[item.id].terminal)[states[item.id].level] === role).length;

  return <div className={`pg-app ${expanded ? "pg-expanded" : ""}`} ref={appRef} aria-label="InstinctGo administrative playground">
    <div className="pg-window-bar"><span>InstinctGo workspace</span><div>DEMO · SYNTHETIC RECORDS<button aria-label={expanded ? "Exit expanded playground" : "Expand playground"} title={expanded ? "Exit expanded view" : "Expand workspace"} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</button></div></div>
    <div className="pg-app-layout"><aside className="pg-navigation"><a className="brand pg-brand" href="#workspace" onClick={(event) => { event.preventDefault(); setView("Overview"); }}>instinct<span className="brand-go">go</span><span className="brand-period">.</span></a><div className="pg-institution"><span>SU</span><div><strong>Sample University</strong><small>{item.branch} branch</small></div></div><p className="pg-nav-label">WORKSPACE</p><nav aria-label="Playground navigation">{navigation.map(({ label, icon: Icon }) => <button key={label} className={view === label ? "pg-nav-active" : ""} aria-current={view === label ? "page" : undefined} onClick={() => setView(label)}><Icon size={16} strokeWidth={1.7} /><span>{label === "AI Assistant" ? "Assistant" : label}</span>{label === "Overview" && <small>{inboxCount}</small>}{view === label && label !== "Overview" && <span className="pg-nav-active-dot" />}</button>)}</nav><div className="pg-nav-bottom"><button onClick={() => setDetailId(selected)}><FolderOpen size={15} />Case details<ArrowRight size={12} /></button></div></aside>
      <div className="pg-main"><header className="pg-app-topbar"><div><span className="pg-breadcrumb">Workspace<ChevronRight size={11} /></span><strong>{view === "AI Assistant" ? "Assistant" : view}</strong></div><label className="pg-role-switch"><span className="pg-avatar">{role.split(" ").map((part) => part[0]).join("")}</span><span><small>ROLE</small><select aria-label="Simulated role" value={role} onChange={(event) => setRole(event.target.value as Role)}>{allRoles.map((role) => <option key={role}>{role}</option>)}</select></span></label></header>
        <div className="pg-case-bar"><div className="pg-case-identity"><span className="pg-case-symbol"><FolderOpen size={21} strokeWidth={1.5} /></span><div><label htmlFor="pg-proposal">PROPOSAL</label><select id="pg-proposal" aria-label="Select sample proposal" value={selected} onChange={(event) => openCase(event.target.value, view === "Overview" ? "Noting Studio" : view)}>{cases.map((item) => <option key={item.id} value={item.id}>{item.historical ? "Archived · " : ""}{item.subject}</option>)}</select><small>{item.id}<span>·</span>{item.section}</small></div></div><div className="pg-case-bar-right"><Badge tone={state.status === "Returned" ? "warning" : state.status === "Closed" || state.status === "Demo approved" ? "success" : "blue"}>{state.status}</Badge><small>{item.historical ? "Archived" : `With ${assigned}`}</small></div></div>
        {view === "Noting Studio" && <Studio item={item} state={state} role={role} cases={cases} states={states} stage={inspectedStage} running={runningId === selected} editable={editable} onStage={setInspectedStage} onRun={run} onChange={changeNote} onSave={() => saveVersion()} onComment={comment} onInsert={insertDraft} onPreview={setPreview} onOpen={openCase} onUpload={() => setUploading(true)} onWorkflow={() => setView("Workflow")} notify={setNotice} />}
        {view === "Overview" && <Overview cases={cases} states={states} role={role} onOpen={openCase} onWorkflow={(id) => openCase(id, "Workflow")} />}
        {view === "AI Assistant" && <div className="pg-view-content"><AssistantPanel key={item.id} item={item} state={state} cases={cases} states={states} expanded editable={editable} onInsert={insertDraft} onPreview={setPreview} onOpen={openCase} /></div>}
        {view === "Case Explorer" && <CaseExplorer cases={cases} states={states} onOpen={openCase} onDetail={setDetailId} />}
        {view === "Reference Library" && <ReferenceLibrary documents={allDocuments} usedIds={allDocuments.filter((doc) => state.html.includes(`#ref-${doc.id}`)).map((doc) => doc.id)} onPreview={setPreview} onUpload={() => setUploading(true)} />}
        {view === "Workflow" && <WorkflowPanel key={`${item.id}-${state.movements.length}`} item={item} state={state} role={role} onRole={setRole} onAction={action} onChecks={(checks) => update({ checks })} onCorrection={correction} onStudio={() => { setView("Noting Studio"); setInspectedStage(state.html ? 6 : 0); }} onClarify={clarify} />}
        {view === "Administration" && <Administration cases={cases} states={states} onTerminal={configureTerminal} />}
        <footer className="pg-app-footer"><span>{item.id}</span><span>Session data clears on reload</span></footer>
      </div>
    </div>
    {notice && <div className="pg-toast" role="status"><ShieldCheck size={17} /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={14} /></button></div>}
    {preview && <DocumentPreview document={preview} onClose={() => setPreview(null)} />}
    {uploading && <UploadDocument onClose={() => setUploading(false)} onAdd={addDocument} />}
    {detailId && <CaseDetail item={cases.find((item) => item.id === detailId)!} state={states[detailId]} onClose={() => setDetailId(null)} onOpen={() => openCase(detailId)} onPreview={setPreview} />}
  </div>;
}

function routingAmendment(branch: "Administrative" | "Examination" | "PNC", terminal: Role) {
  const text = `Session routing amendment: the configured terminal authority is ${terminal}. Required movement: ${getPath(branch, terminal).join(" → ")}. This most recent session setting supersedes all earlier routing statements in this synthetic note and the default sample manual for this demonstration only. It does not confer any real institutional authority.`;
  return { html: `<h3>Session routing amendment</h3><p>${escapeHtml(text)}</p>`, text: `\n\nSession routing amendment\n${text}` };
}
