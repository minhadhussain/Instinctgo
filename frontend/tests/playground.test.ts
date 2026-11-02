import test from "node:test";
import assert from "node:assert/strict";
import { cases, sampleCases } from "../src/lib/playground/data";
import { getPath } from "../src/lib/playground/hierarchy";
import { advanceWorkflow, initialCaseState, validateNote, verificationChecks } from "../src/lib/playground/workflow";
import { demoAI, emptyFilters, filterCases } from "../src/lib/playground/assistant";
import { escapeHtml } from "../src/lib/playground/renderer";
import type { CaseState, Role, WorkflowAction } from "../src/lib/playground/types";

const procurement = sampleCases[0];
const now = "2026-11-02T12:00:00.000Z";
function move(state: CaseState, role: Role, action: WorkflowAction, remarks = "Verified against sample evidence.") {
  return advanceWorkflow(procurement, state, role, action, remarks, now);
}
function submitted() { return move(initialCaseState(procurement, true), "Dealing Assistant", "submit").state!; }
function verified(state: CaseState) { return { ...state, checks: [...verificationChecks] }; }

test("Registrar and Controller branches preserve sequential mandatory levels", () => {
  assert.deepEqual(getPath("Administrative", "Registrar"), ["Dealing Assistant", "Section Officer", "Assistant Registrar", "Deputy Registrar", "Registrar"]);
  assert.deepEqual(getPath("Examination", "Controller"), ["Dealing Assistant", "Section Officer", "Assistant Controller", "Deputy Controller", "Controller"]);
  assert.equal(getPath("Administrative", "Vice-Chancellor").at(-1), "Vice-Chancellor");
  assert.deepEqual(getPath("PNC", "Registrar"), []);
  assert.deepEqual(getPath("Examination", "Registrar"), []);
});

test("complete proposal-to-decision journey requires verification at every level and final action", () => {
  let state = submitted();
  for (const role of ["Section Officer", "Assistant Registrar", "Deputy Registrar"] as Role[]) {
    assert.ok(move(state, role, "forward").error);
    state = move(verified(state), role, "forward").state!;
  }
  assert.equal(state.level, 4);
  assert.ok(move(verified(state), "Registrar", "approve", "").error);
  state = move(verified(state), "Registrar", "approve", "Sanction of INR 47,200 recorded in the synthetic demonstration.").state!;
  assert.equal(state.status, "Demo approved");
  assert.equal(state.level, 0);
  assert.ok(move(state, "Registrar", "close").error);
  state = move(state, "Dealing Assistant", "close", "Sample dispatch receipt recorded.").state!;
  assert.equal(state.status, "Closed");
  assert.equal(state.movements.length, 6);
  assert.match(state.disposition, /dispatch receipt/);
  assert.ok(state.movements.every((event) => event.officer && event.date && event.remarks && event.previous && event.next));
  assert.ok(move(state, "Dealing Assistant", "submit").error);
});

test("unassigned roles cannot advance or approve a file, even with a populated checklist", () => {
  const state = verified(submitted());
  assert.ok(move(state, "Registrar", "approve").error);
  assert.ok(move(state, "Assistant Registrar", "forward").error);
  assert.ok(move(state, "Section Officer", "approve").error);
  assert.ok(move(initialCaseState(procurement), "Dealing Assistant", "submit").error);
  assert.ok(move({ ...initialCaseState(procurement, true), html: "<p></p>", text: "" }, "Dealing Assistant", "submit").error);
});

test("returns require remarks, go back one level, and preserve draft and movement history", () => {
  let state = submitted();
  assert.ok(move(state, "Section Officer", "return", "").error);
  state = move(state, "Section Officer", "return", "Please clarify delivery charges.").state!;
  assert.equal(state.level, 0);
  assert.equal(state.status, "Returned");
  assert.equal(state.versions.length, 2);
  assert.ok(move(state, "Dealing Assistant", "submit").error);
  const identical = { ...state, versions: [...state.versions, { ...state.versions[1], id: 3, label: "Unchanged copy" }] };
  assert.ok(move(identical, "Dealing Assistant", "submit").error, "Saving the same draft does not satisfy a correction");
  state = { ...state, versions: [...state.versions, { id: 3, label: "Correction", html: state.html, text: `${state.text}\nDelivery is included.`, author: "Dealing Assistant", date: "2026-11-02T12:01:00.000Z" }] };
  state = move(state, "Dealing Assistant", "submit").state!;
  assert.equal(state.level, 1);
  assert.equal(state.movements[1].remarks, "Please clarify delivery charges.");
  state = move(verified(state), "Section Officer", "forward").state!;
  state = move(state, "Assistant Registrar", "return", "Recheck allocation.").state!;
  assert.equal(state.level, 1, "AR returns to SO, not directly to DA");
  assert.equal(state.checks.length, 0);
});

test("critical examination conflict blocks approval until sample reconciliation is attached", () => {
  const item = sampleCases.find((item) => item.branch === "Examination")!;
  let state = { ...initialCaseState(item, true), level: 4, status: "In review" as const, checks: [...verificationChecks] };
  assert.ok(advanceWorkflow(item, state, "Controller", "approve", "Correct the register.", now).error);
  const source = { ...item.documents[0], id: `${item.id}-clarification`, title: "Sample authenticated clarification", status: "Current" as const };
  state = { ...state, extraDocuments: [source] };
  assert.equal(validateNote(item, state).some((finding) => finding.kind === "error"), false);
  assert.equal(advanceWorkflow(item, state, "Controller", "approve", "Correct attendance status per authenticated reconciliation.", now).state?.status, "Demo approved");
});

test("validator checks edited amounts and unresolved source links", () => {
  const state = initialCaseState(procurement, true);
  assert.equal(validateNote(procurement, state).some((finding) => finding.kind === "error"), false);
  assert.ok(validateNote(procurement, { ...state, text: `${state.text}\nSanction ₹99,999.` }).some((finding) => finding.title === "Unsupported amount in edited note"));
  assert.ok(validateNote(procurement, { ...state, html: `${state.html}<a href="#ref-not-a-source">[10]</a>` }).some((finding) => finding.kind === "error"));
});

test("the eight proposal types select different tools, arithmetic and authorities", () => {
  assert.equal(new Set(sampleCases.map((item) => item.category)).size, 8);
  assert.equal(sampleCases.filter((item) => item.calculation).length, 3);
  for (const item of sampleCases) {
    assert.ok(getPath(item.branch, item.terminal).length >= 2);
    assert.ok(item.documents.length >= 3);
    if (item.calculation) assert.equal(item.calculation.amount, item.calculation.expected);
  }
  assert.equal(sampleCases.find((item) => item.category === "Meeting resolution")!.terminal, "Vice-Chancellor");
});

test("read-only assistant cannot mutate state and returns structured historical search results", () => {
  const states = Object.fromEntries(cases.map((item) => [item.id, initialCaseState(item, true)]));
  const state = states[procurement.id];
  const before = JSON.stringify(states);
  const request = { mode: "research" as const, current: procurement, state, cases, states };
  assert.match(demoAI.respond({ ...request, question: "Approve and submit this case" }).text, /does not edit/);
  const refunds = demoAI.respond({ ...request, question: "Find fee refunds in session 2025–26" });
  assert.deepEqual(refunds.caseIds, ["DEMO-HIS-103"]);
  const returned = demoAI.respond({ ...request, question: "Which cases were returned by the Section Officer?" });
  assert.deepEqual(returned.caseIds, ["DEMO-HIS-105"]);
  const rejected = demoAI.respond({ ...request, question: "Why was the research proposal rejected?" });
  assert.match(rejected.text, /already been fully reimbursed/);
  assert.equal(JSON.stringify(states), before);
  assert.ok(demoAI.respond({ ...request, mode: "draft", question: "Draft the next action" }).draft);
});

test("case filters combine category, session, date, policy and status", () => {
  const states = Object.fromEntries(cases.map((item) => [item.id, initialCaseState(item)]));
  const results = filterCases(cases, states, { ...emptyFilters, category: "Fee refund proposal", session: "2025–26", status: "Closed", from: "2026-01-01", to: "2026-06-30", policy: "duplicate-payment" }, () => "Dealing Assistant");
  assert.deepEqual(results.map((item) => item.id), ["DEMO-HIS-103"]);
  assert.equal(filterCases(cases, states, { ...emptyFilters, query: "unrepresented subject" }, () => "Dealing Assistant").length, 0);
});

test("archived records remain immutable and user-supplied note text is escaped", () => {
  const item = cases.find((item) => item.historical)!;
  assert.ok(advanceWorkflow(item, initialCaseState(item), "Dealing Assistant", "submit", "", now).error);
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});
