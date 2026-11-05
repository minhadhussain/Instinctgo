"use client";

import { useState } from "react";
import { ArrowUpRight, BookOpen, FileText, Library, MessageSquareText, Plus, Search } from "lucide-react";
import type { CaseDefinition, CaseState, ReferenceDocument } from "@/lib/playground/types";
import { AssistantPanel } from "./assistant-panel";
import { NoteEditor } from "./note-editor";
import { isRuleDocument } from "@/lib/playground/rule-matches";

interface Props {
  item: CaseDefinition; state: CaseState; cases: CaseDefinition[]; states: Record<string, CaseState>; documents: ReferenceDocument[];
  editable: boolean; onChange: (html: string, text: string) => void; onInsert: (text: string, citations?: string[]) => void;
  onPreview: (document: ReferenceDocument) => void; onOpen: (id: string) => void; onUpload: () => void;
}

export function Studio({ item, state, cases, states, documents, editable, onChange, onInsert, onPreview, onOpen, onUpload }: Props) {
  const [mobilePanel, setMobilePanel] = useState<"note" | "references" | "chat">("note");
  const [query, setQuery] = useState("");
  const [rulebook, setRulebook] = useState("");
  const proposal = state.draftKind === "proposal";
  const rules = documents.filter((doc) => !doc.original && isRuleDocument(doc)).sort((a, b) => Number(state.appliedRuleIds?.includes(b.id)) - Number(state.appliedRuleIds?.includes(a.id)));
  const results = rules.filter((doc) => (!rulebook || doc.source === rulebook) && `${doc.title} ${doc.source} ${doc.content.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const panels = [{ id: "note", label: proposal ? "Proposal text" : "Note", icon: FileText }, ...(!proposal ? [{ id: "references", label: "Rules", icon: Library }] : []), { id: "chat", label: "AI Assistant", icon: MessageSquareText }] as const;
  return <>
    <nav className="pg-mobile-panels" aria-label="Editor panels">{panels.map(({ id, label, icon: Icon }) => <button key={id} aria-pressed={mobilePanel === id} onClick={() => setMobilePanel(id as typeof mobilePanel)}><Icon size={15} />{label}</button>)}</nav>
    <div className={`pg-finance-grid ${proposal ? "pg-proposal-stage" : "pg-note-stage"} pg-show-${mobilePanel}`}>
      <div className="pg-finance-editor"><NoteEditor item={item} state={state} editable={editable} documents={documents} onChange={onChange} onPreview={onPreview} /></div>
      <aside className="pg-finance-sidebar" aria-label={proposal ? "Proposal AI Assistant" : "Rule references and AI Assistant"}>
        {!proposal && <section className="pg-reference-panel" aria-label="Rules & Regulations">
          <div className="pg-panel-heading"><span><BookOpen size={17} />Rules & Regulations</span><span className="pg-count">{rules.length}</span></div>
          <p className="pg-applied-rules-caption">Rule reference library</p>
          <label className="pg-search pg-reference-search"><Search size={14} /><input placeholder="Find a rule…" aria-label="Search rules" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <select className="pg-rulebook-filter" aria-label="Filter rulebook" value={rulebook} onChange={(event) => setRulebook(event.target.value)}><option value="">All rulebooks</option>{[...new Set(rules.map((doc) => doc.source))].map((source) => <option key={source} value={source}>{source}</option>)}</select>
          <div className="pg-reference-list" data-lenis-prevent>{results.map((doc) => <button className="pg-reference-item pg-applied-rule" key={doc.id} onClick={() => onPreview(doc)}><span className="pg-ref-icon pg-ref-rule"><BookOpen size={17} /></span><span><strong>{doc.title}</strong><small>{doc.locator}</small></span><ArrowUpRight size={13} /></button>)}{!results.length && <p className="pg-help">No matching rules.</p>}</div>
          {state.generation && <details className="pg-draft-basis"><summary>Note format</summary>{state.generation.styleSources.map((source) => <p key={source.path}><strong>{source.title}</strong><br />{source.path} · pages {source.pages.join(", ")}</p>)}</details>}
        </section>}
        <AssistantPanel item={item} state={state} cases={cases} states={states} documents={documents} editable={editable} onInsert={onInsert} onPreview={onPreview} onOpen={onOpen} />
        {proposal && editable && <button className="pg-add-source" onClick={onUpload}><Plus size={14} />Add supporting text</button>}
      </aside>
    </div>
  </>;
}
