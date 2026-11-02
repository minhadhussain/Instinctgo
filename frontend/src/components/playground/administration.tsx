"use client";

import { useState } from "react";
import { ArrowDown, Building2, GitBranch, LockKeyhole, Settings2 } from "lucide-react";
import { branches, controllerPath, registrarPath } from "@/lib/playground/hierarchy";
import type { CaseDefinition, CaseState, Role } from "@/lib/playground/types";
import { Badge } from "./ui";

export function Administration({ cases, states, onTerminal }: { cases: CaseDefinition[]; states: Record<string, CaseState>; onTerminal: (category: string, role: Role) => void }) {
  const [category, setCategory] = useState(cases[0].category);
  const [pnc, setPnc] = useState("");
  const [pncSaved, setPncSaved] = useState("");
  const item = cases.find((item) => item.category === category)!;
  const path = item.branch === "Examination" ? controllerPath : registrarPath;
  const terminal = states[item.id].terminal;
  const editable = states[item.id].level === 0 && ["Received", "AI-generated draft", "Human-edited draft"].includes(states[item.id].status);
  return <div className="pg-view-content">
    <section className="pg-card"><div className="pg-card-heading"><span><Building2 size={16} />Institutional hierarchy</span></div><div className="pg-hierarchy-root">Vice-Chancellor<ArrowDown size={14} /></div><div className="pg-hierarchy-columns">{[registrarPath, controllerPath].map((route, index) => <div key={index}>{route.slice(0, -1).toReversed().map((position) => <div key={position}>{position}<ArrowDown size={12} /></div>)}</div>)}</div></section>
    <div className="pg-admin-branches">{branches.map((branch) => <section className="pg-card" key={branch.name}><h3><GitBranch size={16} />{branch.name}</h3><p>Head: {branch.head}</p>{branch.sections.map((section) => <span className="pg-section-chip" key={section}>{section}</span>)}{branch.name === "PNC" && <small>Reporting levels not configured</small>}</section>)}</div>
    <div className="pg-review-grid"><section className="pg-card"><div className="pg-card-heading"><span><Settings2 size={16} />Approval authority</span></div><label className="pg-field">Proposal category<select value={category} onChange={(event) => setCategory(event.target.value)}>{cases.filter((item) => !item.historical).map((item) => <option key={item.id}>{item.category}</option>)}</select></label><label className="pg-field">Terminal authority<select disabled={!editable} value={terminal} onChange={(event) => onTerminal(category, event.target.value as Role)}>{path.slice(1).map((role) => <option key={role}>{role}</option>)}</select></label>{!editable && <p className="pg-help">Locked while the file is under review.</p>}</section><section className="pg-card"><div className="pg-card-heading"><span><GitBranch size={16} />PNC reporting structure</span><Badge tone="warning">Inactive</Badge></div><label className="pg-field">Intermediate levels<input value={pnc} onChange={(event) => setPnc(event.target.value)} placeholder="Level names, separated by commas" /></label><button className="pg-button" disabled={!pnc.trim()} onClick={() => setPncSaved(pnc)}>Save draft configuration</button><p className="pg-help">{pncSaved ? `${pncSaved.split(",").map((value) => value.trim()).filter(Boolean).join(" → ")} → Engineer · Draft` : "Branch head: Engineer"}</p></section></div>
    <section className="pg-card"><div className="pg-card-heading"><span><LockKeyhole size={16} />Role permissions</span></div><div className="pg-permission-grid"><div><strong>Dealing Assistant</strong><p>Prepare · Edit · Attach · Submit · Close</p></div><div><strong>Reviewing officer</strong><p>Verify · Comment · Return · Forward</p></div><div><strong>Terminal authority</strong><p>Approve · Direct · Reject · Return</p></div></div></section>
  </div>;
}
