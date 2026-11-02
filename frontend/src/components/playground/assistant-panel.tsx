"use client";

import { useState } from "react";
import { ArrowRight, ArrowUp, BookOpen, MessageSquareText, PenLine, Search } from "lucide-react";
import { demoAI } from "@/lib/playground/assistant";
import type { AssistantResponse, CaseDefinition, CaseState, ReferenceDocument } from "@/lib/playground/types";

interface Message extends AssistantResponse { question: string; id: number }
interface Props { item: CaseDefinition; state: CaseState; cases: CaseDefinition[]; states: Record<string, CaseState>; expanded?: boolean; editable: boolean; onInsert: (text: string) => void; onPreview: (document: ReferenceDocument) => void; onOpen: (id: string) => void }

export function AssistantPanel({ item, state, cases, states, expanded = false, editable, onInsert, onPreview, onOpen }: Props) {
  const [mode, setMode] = useState<"research" | "draft">("research");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inserted, setInserted] = useState<number[]>([]);
  const documents = [...cases.flatMap((item) => item.documents), ...state.extraDocuments];
  const starters = expanded ? ["Find previous research fund disbursal proposals", "Find similar previous cases", "Which cases were returned by the Section Officer?", "Find fee refunds in session 2025–26", "Compare this proposal with the previous case", "Show the movement history of this file"] : ["What information is missing?", "Which notification applies here?", "Find similar previous cases"];
  function ask(value: string) {
    if (!value.trim()) return;
    const response = demoAI.respond({ question: value, mode, current: item, state, cases, states });
    setMessages((previous) => [...previous, { ...response, question: value, id: previous.length + 1 }]);
    setQuestion("");
  }
  return <section className={`pg-assistant ${expanded ? "pg-assistant-expanded" : ""}`} aria-label="Case assistant">
    <div className="pg-panel-heading"><span><MessageSquareText size={15} />Assistant</span><span className="pg-mini-label">DEMO</span></div>
    <div className="pg-assistant-body">
      <div className="pg-mode-switch" aria-label="Assistant interaction mode"><button aria-pressed={mode === "research"} onClick={() => setMode("research")}><Search size={12} />Research</button><button aria-pressed={mode === "draft"} onClick={() => setMode("draft")}><PenLine size={12} />Drafting</button></div>
      <div className="pg-chat-history" aria-live="polite" aria-relevant="additions">
        {messages.map((message) => <div className="pg-chat-turn" key={message.id}><div className="pg-user-message">{message.question}</div><div className="pg-assistant-message"><p>{message.text}</p>{message.citations.length > 0 && <div className="pg-chat-citations">{message.citations.map((id, index) => { const doc = documents.find((doc) => doc.id === id); return doc ? <button key={id} onClick={() => onPreview(doc)}><BookOpen size={10} />{index + 1}. {doc.title}</button> : null; })}</div>}{message.draft && <div className="pg-drafting-result"><p>{message.draft}</p><button className="pg-button pg-primary" disabled={!editable || inserted.includes(message.id)} onClick={() => { onInsert(message.draft!); setInserted((previous) => [...previous, message.id]); }}>{inserted.includes(message.id) ? "Inserted" : "Insert into note"}</button>{!editable && <small>Note is read-only.</small>}</div>}{message.caseIds?.map((id) => { const result = cases.find((item) => item.id === id)!; return <button key={id} className="pg-search-result" onClick={() => onOpen(id)}><span>{result.id} · {result.date}</span><strong>{result.subject}<ArrowRight size={13} /></strong><span>{result.branch} · {result.section} · {states[id].status}</span><p>{(result.historical?.disposition ?? result.note[0].text).slice(0, 200)}</p><small>Policy: {result.documents.at(-1)?.title} · {result.historical ? "Historical" : "Current"}</small></button>; })}</div></div>)}
      </div>
      {!messages.length && <div className="pg-starter-questions">{starters.map((starter) => <button key={starter} onClick={() => ask(starter)}>{starter}<ArrowRight size={12} /></button>)}</div>}
      <form className="pg-chat-input" onSubmit={(event) => { event.preventDefault(); ask(question); }}><input aria-label="Ask about this case" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={mode === "research" ? "Ask about this file…" : "Describe a drafting request…"} /><button type="submit" disabled={!question.trim()} aria-label="Send question"><ArrowUp size={16} /></button></form>
    </div>
  </section>;
}
