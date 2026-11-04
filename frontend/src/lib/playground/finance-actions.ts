import { getPath } from "./hierarchy";
import { advanceWorkflow, verificationChecks } from "./workflow";
import type { CaseDefinition, CaseState, Role, WorkflowAction } from "./types";

export function canApproveNote(item: CaseDefinition, state: CaseState, role: Role) {
  const path = getPath(item.branch, state.terminal);
  return state.draftKind !== "proposal" && !item.historical && path.length > 1 && state.level === path.length - 1 && path[state.level] === role && ["In review", "Returned"].includes(state.status);
}

export function performFinanceAction(item: CaseDefinition, state: CaseState, role: Role, action: WorkflowAction, remarks: string, verified: boolean, name: string, now: string) {
  if (action === "approve" && (!canApproveNote(item, state, role) || !name.trim())) return { error: "Approval requires the assigned authority and a signatory name." };
  let current = { ...state, checks: verified ? [...verificationChecks] : [] };
  // Saving the actual corrected working draft is part of resubmission.
  if (action === "submit" && current.movements.some((event) => event.action === "return") && current.html !== current.versions.at(-1)?.html) current = { ...current, versions: [...current.versions, { id: current.versions.length + 1, label: "Correction submitted", html: current.html, text: current.text, author: role, date: now }] };
  const result = advanceWorkflow(item, current, role, action, remarks, now);
  if (result.state && action === "approve") result.state = { ...result.state, signature: { name: name.trim(), role, date: now } };
  return result;
}
