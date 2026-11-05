import type { AIAdapter, AssistantResponse, CaseDefinition, CaseState, ReferenceDocument } from "./types";
import { isRuleDocument } from "./rule-matches";
import { GPF_CASE_ID } from "./gpf-case";
import { buildLocalNote, factLabels, NOTE_TEMPLATE_ID, noteInput } from "./note-draft";

export interface CaseFilters { query: string; category: string; branch: string; section: string; session: string; status: string; authority: string; assistant: string; officer: string; policy: string; from: string; to: string }
export const emptyFilters: CaseFilters = { query: "", category: "", branch: "", section: "", session: "", status: "", authority: "", assistant: "", officer: "", policy: "", from: "", to: "" };

export function filterCases(cases: CaseDefinition[], states: Record<string, CaseState>, filters: CaseFilters, authority: (item: CaseDefinition) => string) {
  return cases.filter((item) => {
    const haystack = `${item.id} ${item.subject} ${item.category} ${item.description} ${item.applicant}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase())) && (!filters.category || item.category === filters.category) && (!filters.branch || item.branch === filters.branch) && (!filters.section || item.section === filters.section) && (!filters.session || item.session === filters.session) && (!filters.status || states[item.id].status === filters.status) && (!filters.authority || authority(item) === filters.authority) && (!filters.assistant || item.assistant === filters.assistant) && (!filters.officer || item.officer === filters.officer) && (!filters.policy || item.documents.some((doc) => `${doc.title} ${doc.id}`.toLowerCase().includes(filters.policy.toLowerCase()))) && (!filters.from || item.date >= filters.from) && (!filters.to || item.date <= filters.to);
  });
}

export function respondToRules(question: string, references: ReferenceDocument[], contextId: string): AssistantResponse {
  const rules = references.filter((doc) => doc.status === "Current" && isRuleDocument(doc));
  const selected = rules.find((doc) => doc.id === contextId);
  const ignored = new Set(["what", "which", "where", "when", "does", "have", "this", "that", "these", "those", "with", "from", "about", "please", "explain", "summarise", "summarize", "show", "find", "rule", "rules", "regulation", "regulations", "clause", "clauses", "require", "required", "requirements", "apply"]);
  const terms = [...new Set(question.toLowerCase().match(/[a-z]{4,}/g) ?? [])].filter((term) => !ignored.has(term));
  const ranked = rules.map((doc) => ({ doc, score: terms.reduce((score, term) => score + (doc.title.toLowerCase().includes(term) ? 3 : doc.content.join(" ").toLowerCase().includes(term) ? 1 : 0), 0) })).filter((result) => result.score > 0).sort((a, b) => b.score - a.score);
  const number = question.match(/\brules?\s+(\d+(?:\.\d+)*(?:\([a-z]+\))?)/i)?.[1] ?? question.match(/\b\d+(?:\.\d+)+(?:\([ivx]+\))?/i)?.[0];
  const numbered = number ? rules.filter((doc) => new RegExp(`(?:^|[^\\d.])${number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\d.])`, "i").test(doc.title)) : [];
  const matches = selected ? [selected] : number ? numbered : ranked.filter((result) => result.score === ranked[0]?.score).slice(0, 3).map((result) => result.doc);
  if (!matches.length) return { text: "Select a rule reference in Context, or ask for a specific rule number or topic.", citations: [] };
  return { text: matches.map((doc) => `${doc.title}\n${doc.locator}\n\n${doc.content.slice(1).join("\n\n")}`).join("\n\n—\n\n"), citations: matches.map((doc) => doc.id) };
}

export function respondToIntake(question: string): AssistantResponse {
  if (/case|sample|topic|gpf/i.test(question)) return { text: "You can upload your own proposal. Its note will follow the structure of the supplied noting examples and use relevant supplied rules. The sample button provides a GPF application to try the same workflow.", citations: [] };
  if (/file|format|pdf|scan/i.test(question)) return { text: "Upload PDF, DOCX, TXT/MD, PNG or JPEG (up to 20 MB). Convert to text first. Scans use English OCR, so review the extracted text before preparing the note.", citations: [] };
  return { text: "1. Upload a proposal or choose Use sample.\n2. Click Convert to text and review the extracted proposal.\n3. Click Convert to note. The prepared note and its applied rules will then appear together.\n\nThe original proposal and reviewed text remain available separately.", citations: [] };
}

export const demoAI: AIAdapter = {
  mode: "local-demo",
  respond({ question, mode, current, state, cases, states, references = [], contextId }) {
    const q = question.toLowerCase();
    const context = references.find((doc) => doc.id === contextId);
    if (/^(approve|sign|submit|forward)\b/.test(q.trim())) return { text: "Use the workflow actions below the editor to submit, forward or sign the note.", citations: [] };
    if (context && /summar|explain|clarif|rule|clause|source|document/.test(q)) return { text: `${context.title}\n\n${context.content.slice(context.original ? 0 : 1).join("\n\n").slice(0, 2000)}`, citations: [context.id] };
    if (state.draftKind === "proposal") {
      if (/rule|clause|polic/.test(q)) return { text: "Review the proposal text, then click Convert to note. The applicable rules will appear beside the generated note at that stage.", citations: [] };
      if (/missing|check|required|details/.test(q)) {
        try { const draft = buildLocalNote(noteInput(current, state)); return { text: draft.facts.map((fact) => `${factLabels[fact.key]}: ${fact.value}`).join("\n") || state.text.slice(0, 1800), citations: [current.documents[0].id] }; }
        catch (error) { return { text: error instanceof Error ? error.message : "Review the proposal text before drafting.", citations: [] }; }
      }
      if (/convert|next|note/.test(q) || mode === "draft") return { text: "Use the Convert to note button below the editor. It prepares a note from your reviewed proposal using the supplied noting examples, while preserving the proposal text separately.", citations: [] };
      return { text: `Current proposal text (excerpt):\n\n${state.text.slice(0, 1800)}`, citations: [current.documents[0].id] };
    }
    if (current.caseTemplateId === NOTE_TEMPLATE_ID) {
      if (/rule|clause|polic/.test(q)) {
        const rules = references.filter(isRuleDocument);
        if (/which|applied|relevant|reference/.test(q)) return { text: rules.map((doc) => `${doc.title}\n${doc.locator}`).join("\n\n"), citations: rules.map((doc) => doc.id) };
        return respondToRules(question, rules, contextId ?? "");
      }
      if (mode === "draft") return { text: "Suggested wording", draft: current.recommendation || current.note.at(-1)?.text, citations: state.appliedRuleIds ?? [] };
      return { text: `${current.facts.map((fact) => `${fact.label}: ${fact.value}`).join("\n")}\n\n${current.explanation.join("\n\n")}`, citations: [current.documents[0].id, ...(state.appliedRuleIds ?? [])] };
    }
    if (current.caseTemplateId === GPF_CASE_ID) {
      if (/rule|clause|polic/.test(q)) return respondToRules(question, references.filter((doc) => state.appliedRuleIds?.includes(doc.id)), contextId ?? "");
      if (mode === "draft") return { text: "Suggested next action", draft: current.recommendation, citations: ["du-gpf-12-1"] };
      return { text: current.facts.map((fact) => `${fact.label}: ${fact.value}`).join("\n"), citations: state.appliedRuleIds ?? [] };
    }
    if (current.imported) {
      const source = current.documents[0];
      if (mode === "draft") return { text: "Drafting aid based on the file name only. Complete the facts and financial examination from the original.", citations: [source.id], draft: `The proposal titled “${current.subject}” is placed for financial examination. The requested amount, budget availability, supporting records and applicable provisions are to be recorded after review of the original document.` };
      if (/rule|clause|polic/.test(q)) return { text: "No applicable rule has been retrieved for this upload. Select an approved reference in the context menu to inspect its exact text.", citations: [] };
      if (/summar|explain|document|proposal/.test(q)) return { text: `${source.extraction || source.original?.mime.startsWith("text/") || /\.(txt|md)$/i.test(source.title) ? "Source text excerpt" : "Source status"}:\n\n${source.content.join("\n\n").slice(0, 1600)}`, citations: [source.id] };
      return { text: "Select a source to read its text, or ask for help drafting the next action.", citations: [] };
    }
    if (/summar/.test(q)) return { text: `${current.description}\n\n${current.explanation.join("\n\n")}`, citations: current.documents.map((doc) => doc.id) };
    const rule = current.documents.at(-1)!;
    const citations = [rule.id];
    if (mode === "draft") {
      return { text: "Suggested wording", citations, draft: `It is submitted for consideration that ${current.recommendation.charAt(0).toLowerCase()}${current.recommendation.slice(1)} The applicable conditions and supporting records should be verified before a final direction is recorded.` };
    }
    if (/rewrite|edit|change|approve|forward|submit/.test(q) && !/why|how|which|previous|show|next|reason/.test(q)) return { text: "Research mode does not edit notes or move files.", citations: [] };
    if (/movement|history|remarks/.test(q)) return { text: state.movements.length ? state.movements.map((event) => `${event.officer} → ${event.to}: ${event.remarks} (${event.previous} → ${event.next})`).join("\n\n") : "No remarks or movements recorded.", citations: [] };
    if (/missing|contradict|uncertain|conflict/.test(q)) return { text: state.extraDocuments.some((doc) => doc.id === `${current.id}-clarification`) ? "Clarification received. The revised note is pending verification." : current.findings.filter((finding) => finding.kind !== "pass").map((finding) => `${finding.title}: ${finding.detail}`).join("\n\n") || "No missing mandatory fields identified.", citations: current.findings.filter((finding) => finding.kind !== "pass").map((finding) => finding.referenceId!).filter(Boolean) };
    if (/compar/.test(q)) {
      const previous = cases.find((item) => item.historical && item.category === current.category);
      return { text: previous ? `Current: ${current.subject}, ${current.session}. Reference: ${rule.title} (${rule.status}).\n\nPrevious: ${previous.subject}, ${previous.session}. Reference: ${previous.documents.at(-1)!.title} (Historical).\n\n${previous.historical!.disposition}` : "No comparable archived case found.", citations, caseIds: previous ? [current.id, previous.id] : [] };
    }
    if (/find|show cases|previous|similar|refunds|procurement decisions|rejected|returned/.test(q)) {
      let matches = cases.filter((item) => Boolean(item.historical));
      if (/similar/.test(q)) matches = matches.filter((item) => item.category === current.category);
      if (/research|fund disbursal|assistance/.test(q)) matches = matches.filter((item) => item.category === "Financial assistance proposal");
      if (/refund/.test(q)) matches = matches.filter((item) => item.category === "Fee refund proposal");
      if (/procurement/.test(q)) matches = matches.filter((item) => item.category === "Procurement proposal");
      if (/returned/.test(q)) matches = cases.filter((item) => states[item.id].movements.some((event) => event.next === "Returned" && (!q.includes("section officer") || event.officer === "Section Officer")));
      if (/reject/.test(q)) matches = matches.filter((item) => states[item.id].status === "Demo rejected" || states[item.id].disposition.toLowerCase().includes("reject"));
      const session = q.match(/20\d{2}\s*[-–/]\s*(?:20)?\d{2}/)?.[0]?.replace(/\s/g, "").replace("/", "–").replace("-", "–");
      if (session) matches = matches.filter((item) => item.session === session || item.session === `${session.slice(0, 4)}–${session.slice(-2)}`);
      return { text: matches.length ? `${matches.length} ${matches.length === 1 ? "case" : "cases"} found.${/reject/.test(q) ? ` ${matches.map((item) => states[item.id].disposition).join(" ")}` : ""}` : "No matching cases found.", citations: [], caseIds: matches.map((item) => item.id) };
    }
    if (/rule|clause|notification|policy|applies/.test(q)) return { text: `${rule.title}: ${rule.content[1]}`, citations: isRuleDocument(rule) ? citations : [] };
    if (/why|explain|paragraph|next|forward|decision|proposal/.test(q)) return { text: `${current.explanation.join("\n\n")}\n\nNext step: ${current.recommendation}`, citations: current.documents.map((doc) => doc.id) };
    return { text: "No matching information in this case collection.", citations: [] };
  },
};
