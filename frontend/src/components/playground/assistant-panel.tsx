"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUp, BookOpen, ChevronDown, MessageSquareText } from "lucide-react";
import { demoAI, respondToIntake, respondToRules } from "@/lib/playground/assistant";
import type { AssistantResponse, CaseDefinition, CaseState, ReferenceDocument } from "@/lib/playground/types";

interface Message extends AssistantResponse { question: string; id: number }
interface CaseProps { libraryOnly?: false; item: CaseDefinition; state: CaseState; cases: CaseDefinition[]; states: Record<string, CaseState>; documents?: ReferenceDocument[]; expanded?: boolean; editable: boolean; onInsert: (text: string, citations?: string[]) => void; onPreview: (document: ReferenceDocument) => void; onOpen: (id: string) => void }
interface LibraryProps { libraryOnly: true; intake?: boolean; documents: ReferenceDocument[]; expanded?: boolean; onPreview: (document: ReferenceDocument) => void }
type Props = CaseProps | LibraryProps;

export function AssistantPanel(props: Props) {
  const { expanded = false, onPreview } = props;
  const caseContext = props.libraryOnly ? null : props;
  const intake = props.libraryOnly && props.intake;
  const proposal = caseContext?.state.draftKind === "proposal";
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inserted, setInserted] = useState<number[]>([]);
  const [contextId, setContextId] = useState("");
  const history = useRef<HTMLDivElement>(null);
  const documents = props.documents ?? [...caseContext!.cases.flatMap((item) => item.documents), ...caseContext!.state.extraDocuments];
  const starters = intake ? [["How to start", "How do I start?"], ["About the sample", "What is the sample case?"], ["Supported files", "Which file formats can I upload?"]] : proposal ? [["Summarise", "Summarise this proposal"], ["Check details", "Check the required proposal details"], ["Next step", "How do I convert this into a note?"]] : [["Summarise", "Summarise this note"], ["Applied rules", "Which supplied rules apply to this note?"], ["Draft next action", "Draft the next action"]];
  const context = documents.find((doc) => doc.id === contextId)?.title ?? (props.libraryOnly ? "Rules & Regulations" : proposal ? "Current proposal text" : "Note & applied rules");
  useEffect(() => { if (history.current) history.current.scrollTop = history.current.scrollHeight; }, [messages]);
  function ask(value: string) {
    if (!value.trim()) return;
    const mode = /^(?:please\s+)?(?:draft|write|improve|rewrite|suggest wording)\b/i.test(value.trim()) ? "draft" : "research";
    const response = intake ? respondToIntake(value) : props.libraryOnly ? respondToRules(value, documents, contextId) : demoAI.respond({ question: value, mode, current: props.item, state: props.state, cases: props.cases, states: props.states, references: documents, contextId });
    setMessages((previous) => [...previous, { ...response, question: value, id: previous.length + 1 }]);
    setQuestion("");
  }
  return <section className={`pg-assistant ${expanded ? "pg-assistant-expanded" : ""}`} aria-label={intake ? "Intake AI Assistant" : proposal ? "Proposal AI Assistant" : "Note AI Assistant"}>
    <div className="pg-panel-heading"><span><MessageSquareText size={17} />AI Assistant</span><span className="pg-mini-label">Demo</span></div>
    <div className="pg-assistant-body">
      {intake ? <div className="pg-assistant-intro"><strong>Proposal → text → note</strong><p>Upload your proposal or try the sample. Review its text, then prepare a note in the format of your supplied examples.</p></div> : <details className="pg-chat-context-details"><summary title={context}><BookOpen size={13} /><span>{context}</span><ChevronDown size={13} /></summary><label className="pg-chat-context">Choose a source<select aria-label="Chatbot source context" value={contextId} onChange={(event) => setContextId(event.target.value)}><option value="">{proposal ? "Current proposal text" : "Note & applied rules"}</option>{documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.title} · {doc.status}</option>)}</select></label></details>}
      {proposal && !messages.length && <p className="pg-assistant-stage-hint">Review the extracted text here. When it is ready, use <strong>Convert to note</strong> below the editor.</p>}
      <div ref={history} className="pg-chat-history" data-lenis-prevent aria-live="polite" aria-relevant="additions">
        {messages.map((message) => <div className="pg-chat-turn" key={message.id}><div className="pg-user-message">{message.question}</div><div className="pg-assistant-message"><p>{message.text}</p>{message.citations.length > 0 && <div className="pg-chat-citations">{message.citations.map((id, index) => { const doc = documents.find((doc) => doc.id === id); return doc ? <button key={id} onClick={() => onPreview(doc)}><BookOpen size={10} />{index + 1}. {doc.title}</button> : null; })}</div>}{message.draft && caseContext && <div className="pg-drafting-result"><p>{message.draft}</p><button className="pg-button pg-primary" disabled={!caseContext.editable || inserted.includes(message.id)} onClick={() => { caseContext.onInsert(message.draft!, message.citations); setInserted((previous) => [...previous, message.id]); }}>{inserted.includes(message.id) ? "Inserted" : "Insert into note"}</button>{!caseContext.editable && <small>Note is read-only.</small>}</div>}{message.caseIds?.map((id) => { const result = caseContext?.cases.find((item) => item.id === id); if (!result || !caseContext) return null; return <button key={id} className="pg-search-result" onClick={() => caseContext.onOpen(id)}><span>{result.id} · {result.date}</span><strong>{result.subject}<ArrowRight size={13} /></strong><span>{result.branch} · {result.section} · {caseContext.states[id].status}</span><p>{(result.historical?.disposition ?? result.note[0].text).slice(0, 200)}</p><small>Policy: {result.documents.at(-1)?.title} · {result.historical ? "Historical" : "Current"}</small></button>; })}</div></div>)}
      </div>
      {!messages.length ? <div className="pg-starter-questions">{starters.map(([label, starter]) => <button key={label} onClick={() => ask(starter)}>{label}</button>)}</div> : <details className="pg-chat-prompts"><summary>Suggested questions<ChevronDown size={12} /></summary><div className="pg-starter-questions">{starters.map(([label, starter]) => <button key={label} onClick={() => ask(starter)}>{label}</button>)}</div></details>}
      <form className="pg-chat-input" onSubmit={(event) => { event.preventDefault(); ask(question); }}><textarea rows={2} aria-label={intake ? "Ask about the workflow" : "Ask about this case"} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); ask(question); } }} placeholder={intake ? "Ask how to get started…" : proposal ? "Ask about the proposal…" : "Ask about the note or its rules…"} /><button type="submit" disabled={!question.trim()} aria-label="Send question" title="Send · Enter"><ArrowUp size={17} /></button></form>
    </div>
  </section>;
}
