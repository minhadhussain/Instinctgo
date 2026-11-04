import type { CaseDefinition, CaseState, CaseStatus, Finding, Role, WorkflowAction } from "./types";
import { getPath } from "./hierarchy";
import { renderNote } from "./renderer";

export const verificationChecks = ["Proposal and note compared", "Sources and facts verified", "Conditions and next action reviewed"];
export const stages = ["Received", "Understanding", "Retrieval", "Examination", "Noting", "Validation", "Review"];

export function initialCaseState(item: CaseDefinition, ready = false): CaseState {
  const generated = ready || Boolean(item.historical);
  const note = generated ? renderNote(item) : { html: "", text: "" };
  return {
    stage: generated ? 6 : 0, status: item.historical?.status ?? (generated ? "AI-generated draft" : "Received"), level: 0, ...note,
    versions: generated ? [{ id: 1, label: item.historical ? "Archived sample note" : "AI-generated draft", ...note, date: `${item.date}T10:00:00`, author: "Simulated AI" }] : [],
    movements: item.historical ? [{ id: 1, officer: item.historical.status === "Returned" ? "Section Officer" : item.terminal, date: `${item.date}T15:30:00`, action: "Archived disposition", remarks: item.historical.disposition, previous: "In review", next: item.historical.status, from: item.historical.status === "Returned" ? "Section Officer" : item.terminal, to: "Dealing Assistant", version: 1 }] : [],
    comments: [], checks: [], extraDocuments: [], correction: "", disposition: item.historical?.disposition ?? "", terminal: item.terminal, savedAt: "", draftKind: item.imported ? "proposal" : "note",
  };
}

export function validateNote(item: CaseDefinition, state: CaseState): Finding[] {
  const resolved = state.extraDocuments.some((doc) => doc.id === `${item.id}-clarification`);
  const findings: Finding[] = item.findings.map((finding) => resolved && finding.kind !== "pass" ? { ...finding, kind: "pass", title: `${finding.title} · clarified`, detail: "Supporting clarification attached." } : finding);
  const sources = [...item.documents, ...state.extraDocuments];
  const links = [...new Set([...Array.from(state.html.matchAll(/href="#ref-([^"]+)"/g), (match) => match[1]), ...(state.appliedRuleIds ?? [])])];
  if (!item.historical && state.html && !links.length) findings.push({ kind: "error", title: "No linked evidence", detail: "Insert current sample references before recording a final decision on this note." });
  const invalid = links.filter((id) => !sources.some((doc) => doc.id === id && (doc.status === "Current" || (resolved && doc.id === "exam-attendance" && doc.status === "Under review"))));
  if (invalid.length && !item.historical) findings.push({ kind: "error", title: "Citation requires verification", detail: "At least one linked source is missing, under review, historical or not current. Verify the evidence before a final decision." });
  else findings.push({ kind: "pass", title: "Source links checked", detail: `${links.length} references linked.` });
  if (item.calculation) findings.push({ kind: item.calculation.amount === item.calculation.expected ? "pass" : "error", title: "Deterministic calculation", detail: item.calculation.expression });
  if (!item.historical) {
    const amounts = (text: string) => [...text.matchAll(/(?:₹\s*|INR\s+|Rs\.?\s+)([\d,]+(?:\.\d+)?)/gi)].map((match) => ({ text: match[0], value: Number(match[1].replace(/,/g, "")) }));
    const supportedAmounts = new Set(item.note.flatMap((section) => amounts(section.text).map((amount) => amount.value)));
    const unsupported = amounts(state.text).filter((amount) => !supportedAmounts.has(amount.value)).map((amount) => amount.text);
    if (unsupported.length) findings.push({ kind: "error", title: "Unsupported amount in edited note", detail: `${[...new Set(unsupported)].join(", ")} is not supported by this case's sample calculation or supplied note facts. Reconcile the edit before approval.` });
  }
  if (state.status === "Human-edited draft" || state.correction) findings.push({ kind: "warning", title: "Edited note pending verification", detail: "Revised paragraphs require source verification." });
  return findings;
}

export function advanceWorkflow(item: CaseDefinition, state: CaseState, role: Role, action: WorkflowAction, remarks: string, now: string): { state?: CaseState; error?: string } {
  if (item.historical) return { error: "Archived sample records are read-only." };
  if (state.draftKind === "proposal") return { error: "Convert the proposal text into a note before submitting it for review." };
  const path = getPath(item.branch, state.terminal);
  if (!path.length) return { error: "Configure a valid institutional route first." };
  if (state.status === "Closed") return { error: "This file is already closed." };
  if (path[state.level] !== role) return { error: `This file is currently with ${path[state.level]}. Switch to that simulated role.` };
  if (!state.html || !state.text.trim() || state.stage < 6) return { error: "Complete note generation and validation first." };
  const decided = state.status === "Demo approved" || state.status === "Demo rejected";
  if (decided && action !== "close") return { error: "A decision has been recorded. Record final action and close the file." };
  let level = state.level;
  let status: CaseStatus = state.status;
  let disposition = state.disposition;
  if (action === "close") {
    if (!decided || role !== "Dealing Assistant") return { error: "Final action follows a recorded decision at the dealing level." };
    if (!remarks.trim()) return { error: "Record the final action or dispatch acknowledgement." };
    status = "Closed";
    disposition = `${state.disposition}\nFinal action: ${remarks.trim()}`;
  } else if (action === "return") {
    if (level === 0) return { error: "The file is already at the preparation level." };
    if (!remarks.trim()) return { error: "Enter the reason for return and required correction." };
    level -= 1;
    status = "Returned";
  } else if (action === "submit") {
    if (level !== 0 || !["AI-generated draft", "Generated note", "Human-edited draft", "Returned"].includes(state.status)) return { error: "Only a prepared draft at the dealing level can be submitted." };
    const lastReturn = state.movements.findLast((movement) => movement.action === "return");
    const returnedVersion = state.versions.find((version) => version.id === lastReturn?.version);
    if (lastReturn && !state.versions.some((version) => version.id > lastReturn.version && version.author === "Dealing Assistant" && (version.html !== returnedVersion?.html || version.text !== returnedVersion?.text))) return { error: "Record a correction and save a new version before resubmitting." };
    level = 1;
    status = "In review";
  } else {
    if (level === 0 || !["In review", "Returned"].includes(state.status)) return { error: "Submit the file for supervisory review first." };
    if (!verificationChecks.every((check) => state.checks.includes(check))) return { error: "Complete all three verification checks before forwarding or deciding." };
    if (action === "forward") {
      if (level >= path.length - 1) return { error: "The file has reached its configured terminal authority." };
      level += 1;
      status = "In review";
    } else {
      if (level !== path.length - 1) return { error: "Only the configured terminal authority can record a final decision." };
      if (!remarks.trim()) return { error: "Record the grounds and conditions of the decision." };
      if (action === "approve" && validateNote(item, state).some((finding) => finding.kind === "error")) return { error: "Resolve critical evidence conflicts before recording an approval. Return for correction or record a reasoned rejection." };
      status = action === "approve" ? "Demo approved" : "Demo rejected";
      disposition = `Simulated ${action === "approve" ? "approval / direction" : "rejection"} by ${role}: ${remarks.trim()}`;
      level = 0;
    }
  }
  const snapshot = { id: state.versions.length + 1, label: action === "submit" ? "Submitted for review" : `Review · ${role}`, html: state.html, text: state.text, date: now, author: role };
  return { state: { ...state, status, level, disposition, checks: [], correction: action === "return" ? "" : state.correction, versions: action === "submit" ? [...state.versions, snapshot] : state.versions, movements: [...state.movements, { id: state.movements.length + 1, officer: role, date: now, action, remarks: remarks.trim() || (action === "submit" ? "Draft and supporting evidence submitted for supervisory verification." : "Verified and forwarded for sequential examination."), previous: state.status, next: status, from: role, to: path[level], version: action === "submit" ? snapshot.id : state.versions.length }], savedAt: now } };
}

export const clarifications: Record<string, string> = {
  "DEMO-SWS-021": "A signed synthetic declaration confirms no prior assistance in session 2026–27. The acceptance letter and endorsement remain valid. Eligibility may now be examined for the requested ₹18,000; this does not itself authorize disbursal.",
  "DEMO-AB-038": "The synthetic library clearance confirms no outstanding loans or dues for DEMO-118. The clearance checklist is complete. Certificate release remains subject to the authorized direction and signed receipt.",
  "DEMO-EXM-046": "The authenticated sample reconciliation confirms attendance as Present and identifies the Absent register entry as a transcription error. The evaluator's award record is enclosed in this synthetic packet. The competent authority may direct correction of attendance status; no numerical mark is inferred or changed by this note.",
};
