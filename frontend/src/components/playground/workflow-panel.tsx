"use client";

import { useState } from "react";
import { ArrowRight, Check, CheckCheck, ClipboardCheck, CornerDownLeft, FileCheck2, History, MessageSquare, ShieldCheck } from "lucide-react";
import { getPath } from "@/lib/playground/hierarchy";
import { validateNote, verificationChecks } from "@/lib/playground/workflow";
import type { CaseDefinition, CaseState, Role, WorkflowAction } from "@/lib/playground/types";
import { Badge, formatDate } from "./ui";

interface Props { item: CaseDefinition; state: CaseState; role: Role; onRole: (role: Role) => void; onAction: (action: WorkflowAction, remarks: string) => void; onChecks: (checks: string[]) => void; onCorrection: (text: string) => void; onStudio: () => void; onClarify: () => void }

export function WorkflowPanel({ item, state, role, onRole, onAction, onChecks, onCorrection, onStudio, onClarify }: Props) {
  const [remarks, setRemarks] = useState("");
  const path = getPath(item.branch, state.terminal);
  const assigned = path[state.level];
  const canAct = assigned === role && !item.historical && state.status !== "Closed";
  const terminal = state.level === path.length - 1;
  const decided = state.status === "Demo approved" || state.status === "Demo rejected";
  const critical = validateNote(item, state).some((finding) => finding.kind === "error");
  const unresolved = item.findings.some((finding) => finding.kind !== "pass") && !state.extraDocuments.some((doc) => doc.id === `${item.id}-clarification`);
  const lastReturn = state.movements.findLast((event) => event.action === "return");
  function act(action: WorkflowAction) { onAction(action, remarks); }
  return <div className="pg-view-content">
    <div className="pg-route-card"><div className="pg-card-heading"><span><ShieldCheck size={16} />{item.branch} branch</span><small>Approval authority: {state.terminal}</small></div><ol className="pg-route">{path.map((position, index) => <li key={position} className={`${index === state.level && !decided ? "pg-route-active" : ""} ${index < state.level || decided || state.status === "Closed" ? "pg-route-done" : ""}`}><span>{index < state.level || decided || state.status === "Closed" ? <Check size={14} /> : index + 1}</span><strong>{position}</strong><small>{index === 0 ? "Preparation" : index === 1 ? "Verification" : index === path.length - 1 ? "Decision" : "Examination"}</small></li>)}</ol></div>
    <div className="pg-review-grid"><section className="pg-card"><div className="pg-card-heading"><span><ClipboardCheck size={16} />{decided ? "Final action & closure" : state.level === 0 ? "Note preparation" : `${assigned} review`}</span></div>
      {item.historical ? <p className="pg-help">Archived file · Read-only</p> : !canAct ? <div className="pg-role-prompt"><h3>{state.status === "Closed" ? "File closed" : `Pending with ${assigned}`}</h3>{state.status !== "Closed" && <button className="pg-button pg-primary" onClick={() => onRole(assigned)}>Switch to {assigned}<ArrowRight size={14} /></button>}</div> : <>
        <details className="pg-compare-proposal"><summary>Compare original proposal & current note</summary><div className="pg-comparison"><article><h4>Original proposal</h4>{item.documents[0].content.map((text, index) => <p key={index}>{text}</p>)}</article><article><h4>Current note</h4><p>{state.text || "Generate a note in Noting Studio first."}</p></article></div></details>
        {state.level > 0 && <div className="pg-checklist">{verificationChecks.map((check) => <label key={check}><input type="checkbox" checked={state.checks.includes(check)} onChange={(event) => onChecks(event.target.checked ? [...state.checks, check] : state.checks.filter((value) => value !== check))} /><span>{check}</span></label>)}</div>}
        {critical && <div className="pg-alert pg-alert-danger">Unresolved evidence conflict. Approval blocked.</div>}
        {unresolved && !critical && <div className="pg-alert">Supporting evidence incomplete. Clarification or a conditional direction required.</div>}
        {lastReturn && <div className="pg-return-remark"><CornerDownLeft size={15} /><div><strong>Previous return · {lastReturn.officer}</strong><p>{lastReturn.remarks}</p></div></div>}
        <label className="pg-field">{decided ? "Final action / receipt" : state.level === 0 && lastReturn ? "Correction response" : "Officer remarks / reason for return"}<textarea rows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder={decided ? "Order, dispatch or receipt details" : "Remarks"} /></label>
        <div className="pg-workflow-actions">
          {decided ? <button className="pg-button pg-primary" disabled={!remarks.trim()} onClick={() => act("close")}><CheckCheck size={15} />Record final action & close</button> : state.level === 0 ? <>
            <button className="pg-button" onClick={onStudio}>Edit note</button>
            {unresolved && <button className="pg-button" onClick={onClarify}>Add sample clarification</button>}
            {lastReturn && <button className="pg-button" disabled={!remarks.trim()} onClick={() => { onCorrection(remarks); setRemarks(""); }}>Save correction version</button>}
            <button className="pg-button pg-primary" disabled={state.stage < 6 || !state.html} onClick={() => act("submit")}>Submit to Section Officer<ArrowRight size={14} /></button>
          </> : <><button className="pg-button" disabled={!remarks.trim()} onClick={() => act("return")}><CornerDownLeft size={14} />Return one level</button>{terminal ? <><button className="pg-button pg-danger-button" disabled={!remarks.trim() || state.checks.length < 3} onClick={() => act("reject")}>Record rejection</button><button className="pg-button pg-primary" disabled={critical || !remarks.trim() || state.checks.length < 3} onClick={() => act("approve")}><FileCheck2 size={15} />{unresolved ? "Record conditional direction" : "Record approval / direction"}</button></> : <button className="pg-button pg-primary" disabled={state.checks.length < 3} onClick={() => act("forward")}>Forward to {path[state.level + 1]}<ArrowRight size={14} /></button>}</>}
        </div>
      </>}
    </section><section className="pg-card pg-observations"><div className="pg-card-heading"><span><MessageSquare size={16} />Observations & disposition</span></div>{state.disposition && <div className="pg-disposition"><Badge tone="success">Disposition</Badge><p>{state.disposition}</p></div>}{state.comments.map((comment) => <div className="pg-observation" key={comment.id}><strong>{comment.author}</strong><small>{formatDate(comment.date)}</small><p>{comment.text}</p></div>)}{!state.comments.length && !state.disposition && <p className="pg-help">No observations recorded.</p>}</section></div>
    <section className="pg-card pg-movement-card"><div className="pg-card-heading"><span><History size={16} />Movement register</span><small>{state.movements.length} entries</small></div>{!state.movements.length ? <p className="pg-help">No movements recorded.</p> : <div className="pg-movement-list">{state.movements.toReversed().map((event) => <div key={event.id}><span className="pg-timeline-dot">{event.action === "return" ? <CornerDownLeft size={13} /> : <ArrowRight size={13} />}</span><div><strong>{event.from} <ArrowRight size={12} /> {event.to}</strong><p>{event.remarks}</p><small>{event.previous} → {event.next} · {formatDate(event.date)}</small></div></div>)}</div>}</section>
  </div>;
}
