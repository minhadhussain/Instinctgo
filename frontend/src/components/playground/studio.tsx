"use client";

import { ArrowRight, BookOpen, Check, CircleAlert, FileText, Play, Plus, ShieldCheck } from "lucide-react";
import { stages, validateNote } from "@/lib/playground/workflow";
import type { CaseDefinition, CaseState, ReferenceDocument, Role } from "@/lib/playground/types";
import { AssistantPanel } from "./assistant-panel";
import { NoteEditor } from "./note-editor";
import { Badge } from "./ui";

interface Props {
  item: CaseDefinition; state: CaseState; role: Role; cases: CaseDefinition[]; states: Record<string, CaseState>;
  stage: number; running: boolean; editable: boolean;
  onStage: (stage: number) => void; onRun: () => void; onChange: (html: string, text: string) => void; onSave: () => void; onComment: (text: string) => void; onInsert: (text: string) => void;
  onPreview: (document: ReferenceDocument) => void; onOpen: (id: string) => void; onUpload: () => void; onWorkflow: () => void; notify: (message: string) => void;
}

export function Studio(props: Props) {
  const { item, state, role, cases, states, stage, running, editable, onStage, onRun, onChange, onSave, onComment, onInsert, onPreview, onOpen, onUpload, onWorkflow, notify } = props;
  const docs = [...item.documents, ...state.extraDocuments];
  const validations = validateNote(item, state);
  const issues = validations.filter((finding) => finding.kind !== "pass");
  return <>
    <div className="pg-pipeline" aria-label="File processing stages"><ol>{stages.map((label, index) => <li key={label}><button disabled={index > state.stage || running} aria-current={stage === index ? "step" : undefined} onClick={() => onStage(index)} className={`${stage === index ? "pg-stage-active" : ""} ${index < state.stage ? "pg-stage-done" : ""}`}><span className={running && state.stage === index ? "pg-processing-dot" : ""}>{index < state.stage ? <Check size={11} /> : String(index + 1).padStart(2, "0")}</span><strong>{label}</strong></button></li>)}</ol></div>
    <div className="pg-studio-grid"><div className="pg-studio-main">
      {(stage === 4 || stage === 6) && state.html ? <NoteEditor key={item.id} item={item} state={state} role={role} editable={editable && !running} onChange={onChange} onSave={onSave} onComment={onComment} onPreview={onPreview} notify={notify} /> : <section className="pg-stage-panel">
        <div className="pg-panel-heading"><span><FileText size={15} />{["Original proposal", "Extracted particulars", "References", "Examination", "Preparing draft…", "Validation", "Review"][stage]}</span><span className="pg-mini-label">{stage + 1} / 7</span></div>
        <div className="pg-stage-content">
          {stage === 0 && <><article className="pg-intake-paper"><div className="pg-note-kicker"><span>SAMPLE UNIVERSITY</span><span>ORIGINAL PROPOSAL</span></div><h3>{item.subject}</h3><p className="pg-help">{item.applicant} · {item.date}</p>{item.documents[0].content.map((text, index) => <p key={index}>{text}</p>)}<button className="pg-text-button" onClick={() => onPreview(item.documents[0])}>Open document<ArrowRight size={13} /></button></article><h4 className="pg-small-heading">ATTACHMENTS</h4>{docs.slice(1).map((doc) => <button className="pg-source-row" key={doc.id} onClick={() => onPreview(doc)}><FileText size={16} /><span><strong>{doc.title}</strong><small>{doc.type} · {doc.status}</small></span><ArrowRight size={13} /></button>)}{!item.historical && <div className="pg-stage-run"><button className="pg-button pg-primary" disabled={running || state.level !== 0 || role !== "Dealing Assistant" || state.movements.length > 0} onClick={onRun}><Play size={14} />{running ? "Processing…" : state.html ? "Regenerate note" : "Prepare note"}</button></div>}</>}
          {stage === 1 && <><div className="pg-facts-grid">{item.facts.map((fact) => <div key={fact.label} className={fact.uncertain ? "pg-fact-uncertain" : ""}><span>{fact.label}{fact.uncertain && <CircleAlert size={13} />}</span><strong>{fact.value}</strong>{fact.uncertain && <small>Clarification required</small>}</div>)}</div><p className="pg-help">Source: {item.documents[0].title}</p></>}
          {stage === 2 && docs.map((doc) => <button key={doc.id} className="pg-retrieved-source" onClick={() => onPreview(doc)}><BookOpen size={20} /><div><strong>{doc.title}</strong><p>{doc.type} · {doc.source}</p><span>{doc.locator} · {doc.date}</span></div><Badge tone={doc.status === "Current" ? "success" : "warning"}>{doc.status}</Badge></button>)}
          {stage === 3 && <><div className="pg-explanation-list">{item.explanation.map((text, index) => <article key={index}><span>{index + 1}</span><p>{text}</p></article>)}</div><div className="pg-recommendation"><strong>Proposed action</strong><p>{item.recommendation}</p></div></>}
          {stage === 4 && !state.html && <p className="pg-help" role="status">Preparing draft…</p>}
          {stage === 5 && <><div className="pg-validation-list">{validations.map((finding, index) => <div className={`pg-validation-${finding.kind}`} key={index}>{finding.kind === "pass" ? <ShieldCheck size={18} /> : <CircleAlert size={18} />}<div><strong>{finding.title}</strong><p>{finding.detail}</p>{finding.referenceId && <button className="pg-text-button" onClick={() => { const doc = docs.find((doc) => doc.id === finding.referenceId); if (doc) onPreview(doc); }}>View source<ArrowRight size={12} /></button>}</div></div>)}</div><button className="pg-button pg-primary" disabled={state.stage < 6} onClick={() => onStage(6)}>Review note<ArrowRight size={14} /></button></>}
          {stage > 0 && stage < 4 && !running && <button className="pg-button pg-primary pg-next-stage" disabled={state.stage <= stage} onClick={() => onStage(stage + 1)}>Continue to {stages[stage + 1].toLowerCase()}<ArrowRight size={14} /></button>}
        </div>
      </section>}
      {state.html && stage >= 4 && <button className={`pg-validation-summary ${issues.length ? "pg-has-issues" : ""}`} onClick={() => onStage(5)}><ShieldCheck size={15} /><span>{issues.length ? `${issues.length} item${issues.length === 1 ? "" : "s"} requiring review` : "Validation complete"}</span><span>Details<ArrowRight size={12} /></span></button>}
    </div><aside className="pg-studio-sidebar"><section className="pg-reference-panel"><div className="pg-panel-heading"><span><BookOpen size={15} />References</span><span className="pg-count">{docs.length}</span></div><div className="pg-reference-list">{docs.map((doc, index) => <button className="pg-reference-item" key={doc.id} onClick={() => onPreview(doc)}><span className={`pg-ref-icon ${index === docs.length - 1 ? "pg-ref-rule" : ""}`}><FileText size={16} /></span><span><strong>{doc.title}</strong><small>{doc.type} · {doc.date}</small><span className="pg-reference-status"><span className={doc.status === "Current" ? "pg-dot-green" : "pg-dot-amber"} />{doc.status}<span>·</span>{state.html.includes(`#ref-${doc.id}`) ? "Cited" : "Available"}</span></span><ArrowRight size={12} /></button>)}</div><button className="pg-add-source" onClick={onUpload}><Plus size={13} />Add attachment</button></section><AssistantPanel key={item.id} item={item} state={state} cases={cases} states={states} editable={editable} onInsert={onInsert} onPreview={onPreview} onOpen={onOpen} /></aside></div>
    <div className="pg-file-actions"><span>Approval authority: <strong>{state.terminal}</strong></span><button className="pg-button pg-primary" onClick={onWorkflow}>{state.status === "Closed" ? "View disposition" : "Review & route"}<ArrowRight size={14} /></button></div>
  </>;
}
