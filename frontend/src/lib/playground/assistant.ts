import type { AIAdapter, CaseDefinition, CaseState } from "./types";

export interface CaseFilters { query: string; category: string; branch: string; section: string; session: string; status: string; authority: string; assistant: string; officer: string; policy: string; from: string; to: string }
export const emptyFilters: CaseFilters = { query: "", category: "", branch: "", section: "", session: "", status: "", authority: "", assistant: "", officer: "", policy: "", from: "", to: "" };

export function filterCases(cases: CaseDefinition[], states: Record<string, CaseState>, filters: CaseFilters, authority: (item: CaseDefinition) => string) {
  return cases.filter((item) => {
    const haystack = `${item.id} ${item.subject} ${item.category} ${item.description} ${item.applicant}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase())) && (!filters.category || item.category === filters.category) && (!filters.branch || item.branch === filters.branch) && (!filters.section || item.section === filters.section) && (!filters.session || item.session === filters.session) && (!filters.status || states[item.id].status === filters.status) && (!filters.authority || authority(item) === filters.authority) && (!filters.assistant || item.assistant === filters.assistant) && (!filters.officer || item.officer === filters.officer) && (!filters.policy || item.documents.some((doc) => `${doc.title} ${doc.id}`.toLowerCase().includes(filters.policy.toLowerCase()))) && (!filters.from || item.date >= filters.from) && (!filters.to || item.date <= filters.to);
  });
}

export const demoAI: AIAdapter = {
  mode: "local-demo",
  respond({ question, mode, current, state, cases, states }) {
    const q = question.toLowerCase();
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
    if (/rule|notification|policy|applies/.test(q)) return { text: `${rule.title}: ${rule.content[1]}`, citations };
    if (/why|explain|paragraph|next|forward|decision|proposal/.test(q)) return { text: `${current.explanation.join("\n\n")}\n\nNext step: ${current.recommendation}`, citations: current.documents.map((doc) => doc.id) };
    return { text: "No matching information in this case collection.", citations: [] };
  },
};
