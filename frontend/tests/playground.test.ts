import test from "node:test";
import assert from "node:assert/strict";
import { cases, sampleCases } from "../src/lib/playground/data";
import { getPath } from "../src/lib/playground/hierarchy";
import { advanceWorkflow, initialCaseState, validateNote, verificationChecks } from "../src/lib/playground/workflow";
import { demoAI, emptyFilters, filterCases, respondToRules } from "../src/lib/playground/assistant";
import { escapeHtml } from "../src/lib/playground/renderer";
import type { CaseState, Role, WorkflowAction } from "../src/lib/playground/types";
import { createImportedCase, MAX_DOCUMENT_SIZE, validateDocument } from "../src/lib/playground/intake";
import { findRuleMatches, rulePhrases } from "../src/lib/playground/rule-matches";
import { canApproveNote, performFinanceAction } from "../src/lib/playground/finance-actions";
import { applyExtractedText, finishExtraction, MAX_TEXT_CHARACTERS, ocrParagraphText, pdfTextLines } from "../src/lib/playground/document-text";
import { convertGpfProposal, gpfProposalText, gpfRules, parseGpfProposal, renderGpfNote } from "../src/lib/playground/gpf-case";
import { applyDraftNote, buildLocalNote, classifyProposal, factIsGrounded, moneyValue, noteInput, type NoteInput } from "../src/lib/playground/note-draft";
import { requestNoteDraft } from "../src/lib/playground/note-service";

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

test("intake validates size, format and content while retaining the original separately", () => {
  assert.match(validateDocument({ name: "proposal.exe", size: 200 }), /Choose a PDF/);
  assert.match(validateDocument({ name: "proposal.pdf", size: 0 }), /empty/);
  assert.match(validateDocument({ name: "proposal.pdf", size: MAX_DOCUMENT_SIZE + 1 }), /20 MB/);
  const bytes = new TextEncoder().encode("Original proposal: procure chairs.\n\nRequested amount: INR 500.");
  const file = { name: "proposal.txt", type: "text/plain", size: bytes.length };
  const record = createImportedCase(file, bytes.buffer, "blob:original", "FIN-TEST", now);
  assert.equal(record.documents[0].original?.url, "blob:original");
  assert.match(record.documents[0].content.join(" "), /INR 500/);
  assert.ok(record.note.every((section) => !section.text), "An upload does not fabricate an extracted finance note");
  assert.equal(record.documents[0].status, "Unverified");
  assert.throws(() => createImportedCase({ ...file, name: "fake.pdf" }, bytes.buffer, "blob:fake", "FIN-FAKE", now), /does not match/);
});

test("rule highlights resolve mapped passages and exact clauses to current sources only", () => {
  const source = procurement.documents[2];
  const phrases = rulePhrases(procurement, procurement.documents);
  const paragraph = procurement.note[3].text;
  const mapped = findRuleMatches(paragraph, phrases);
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].sourceId, source.id);
  assert.equal(mapped[0].paragraph, source.highlight);
  assert.equal(findRuleMatches(paragraph.replace("documented need", "documented\nneed"), phrases)[0].sourceId, source.id);
  const exact = findRuleMatches(`Rule: ${source.content[1]} End.`, phrases);
  assert.equal(exact[0].sourceId, source.id);
  assert.equal(exact[0].from, 6);
  assert.equal(findRuleMatches("A purchase must always be approved automatically.", phrases).length, 0);
  assert.equal(findRuleMatches(paragraph.replace("requires", "does not require"), phrases).length, 0, "Edited meaning removes a stale highlight");
  assert.equal(rulePhrases(procurement, [{ ...source, status: "Superseded" }]).length, 0);
});

test("finance approval requires the assigned human authority, verification and signatory", () => {
  const state = { ...initialCaseState(procurement, true), level: 4, status: "In review" as const };
  assert.equal(canApproveNote(procurement, state, "Dealing Assistant"), false);
  assert.equal(canApproveNote(procurement, state, "Registrar"), true);
  assert.ok(performFinanceAction(procurement, state, "Registrar", "approve", "Verified", true, "", now).error);
  assert.ok(performFinanceAction(procurement, state, "Registrar", "approve", "Verified", false, "Demo officer", now).error);
  assert.ok(performFinanceAction(procurement, state, "Dealing Assistant", "approve", "Verified", true, "Demo officer", now).error);
  const approved = performFinanceAction(procurement, state, "Registrar", "approve", "Quotation and allocation verified.", true, "Demo officer", now).state!;
  assert.equal(approved.signature?.name, "Demo officer");
  assert.equal(approved.signature?.role, "Registrar");
  assert.equal(approved.status, "Demo approved");
  assert.equal(canApproveNote(procurement, approved, "Registrar"), false);
  assert.equal(state.signature, undefined, "The original state is not mutated");
});

test("uploaded chatbot context quotes the selected source without claiming extraction or approval", () => {
  const bytes = new TextEncoder().encode("Original request for a new equipment allocation.");
  const current = createImportedCase({ name: "request.txt", type: "text/plain", size: bytes.length }, bytes.buffer, "blob:test", "FIN-CHAT", now);
  const state = initialCaseState(current, true);
  const rule = procurement.documents[2];
  const request = { question: "Explain this rule", mode: "research" as const, current, state, cases: [current], states: { [current.id]: state }, references: [rule], contextId: rule.id };
  const answer = demoAI.respond(request);
  assert.deepEqual(answer.citations, [rule.id]);
  assert.ok(answer.text.includes(rule.content[1]));
  assert.match(demoAI.respond({ ...request, contextId: undefined }).text, /Convert to note/);
  assert.match(demoAI.respond({ ...request, question: "Sign this proposal" }).text, /cannot approve or sign/);
  assert.equal(state.movements.length, 0);
});

test("intake chatbot answers from the rules library without a proposal context", () => {
  const refundRule = sampleCases[2].documents[2];
  const aidRule = sampleCases[1].documents[2];
  const rules = [procurement.documents[2], refundRule, aidRule, { ...refundRule, id: "old-refund-rule", status: "Superseded" as const }];
  const answer = respondToRules("Explain duplicate payments", rules, "");
  assert.deepEqual(answer.citations, [refundRule.id]);
  assert.ok(answer.text.includes(refundRule.content[1]));
  assert.equal(answer.draft, undefined);
  assert.deepEqual(respondToRules("Summarise this rule", rules, aidRule.id).citations, [aidRule.id]);
  assert.deepEqual(respondToRules("Interstellar astronomy", rules, "").citations, []);
});

test("converted text preserves the original and creates an escaped editable draft", () => {
  const bytes = new TextEncoder().encode("Original document");
  const record = createImportedCase({ name: "proposal.txt", type: "text/plain", size: bytes.length }, bytes.buffer, "blob:original", "FIN-TEXT", now);
  const state = initialCaseState(record);
  const result = finishExtraction([{ page: 1, text: "Finance request\r\nAmount: INR 47200\r\n\r\n<img src=x onerror=alert(1)>", ocr: true }], "OCR");
  const converted = applyExtractedText(record, state, result, now);
  assert.equal(converted.item.documents[0].original, record.documents[0].original);
  assert.equal(record.documents[0].content[0], "Original document");
  assert.equal(state.html, "", "Conversion does not mutate the previous draft");
  assert.equal(converted.state.status, "Extracted draft");
  assert.match(converted.state.html, /Finance request<br>Amount: INR 47200/);
  assert.ok(!converted.state.html.includes("<img"));
  assert.match(converted.state.html, /&lt;img/);
  assert.equal(converted.state.versions[0].author, "Browser extraction");
  assert.equal(converted.item.documents[0].extraction?.ocrPages, 1);
  assert.equal(converted.state.draftKind, "proposal");
  assert.match(advanceWorkflow(converted.item, converted.state, "Dealing Assistant", "submit", "Review source text.", now).error!, /Convert the proposal text into a note/);
});

test("PDF extraction keeps font-split words together and preserves line and page boundaries", () => {
  const run = (str: string, x: number, y: number, width: number, hasEOL = false) => ({ str, transform: [1, 0, 0, 1, x, y], width, height: 12, hasEOL });
  const text = pdfTextLines([run("Fin", 20, 700, 15), run("ance", 35, 700, 25), run("request", 68, 700, 40, true), run("Total: INR 47200", 20, 680, 90)]);
  assert.equal(text, "Finance request\nTotal: INR 47200");
  const result = finishExtraction([{ page: 1, text, ocr: false }, { page: 2, text: "Scanned second page", ocr: true }], "PDF + OCR");
  assert.equal(result.text, "Finance request\nTotal: INR 47200\n\nScanned second page");
  assert.equal(result.pages[1].page, 2);
  assert.equal(result.method, "PDF + OCR");
});

test("empty and oversized extraction results are reported rather than silently truncated", () => {
  assert.throws(() => finishExtraction([{ page: 1, text: " \n\u0000", ocr: true }], "OCR"), /No readable text/);
  assert.throws(() => finishExtraction([{ page: 1, text: "x".repeat(MAX_TEXT_CHARACTERS + 1), ocr: false }], "Text"), /200,000 characters/);
});

test("PDF paragraph gaps survive line-end markers, wrapping and font changes", () => {
  const run = (str: string, x: number, y: number, width: number, hasEOL = false) => ({ str, transform: [1, 0, 0, 1, x, y], width, height: 12, hasEOL });
  const text = pdfTextLines([
    run("Subject: Refund request", 20, 720, 150, true),
    run("I request a refund of INR 4500", 20, 684, 200, true),
    run("paid twice for the examination.", 20, 668, 200, true),
    run("Please verify the pay", 20, 632, 100), run("ment receipts.", 120, 632, 80),
    run("", 200, 632, 0, true), run("Both transactions are listed below.", 20, 616, 210, true),
  ]);
  assert.equal(text, "Subject: Refund request\n\nI request a refund of INR 4500\npaid twice for the examination.\n\nPlease verify the payment receipts.\nBoth transactions are listed below.");
  const bytes = new TextEncoder().encode(text);
  const item = createImportedCase({ name: "proposal.txt", type: "text/plain", size: bytes.length }, bytes.buffer, "blob:paragraphs", "FIN-SPACING", now);
  const converted = applyExtractedText(item, initialCaseState(item), finishExtraction([{ page: 1, text, ocr: false }], "PDF"), now);
  assert.equal((converted.state.html.match(/<p>/g) ?? []).length, 3);
  assert.match(converted.state.html, /INR 4500<br>paid twice/);
  assert.equal(converted.state.text, text);
});

test("OCR restores recognized paragraph spacing without discarding unmatched text", () => {
  const raw = "To the Registrar\nRefund request\nI paid INR 4500 twice.\nPlease verify both receipts.\nYours faithfully,\nRiya Nath\n";
  const paragraphs = ["To the Registrar\nRefund request\n", "I paid INR 4500 twice.\nPlease verify both receipts.\n", "Yours faithfully,\nRiya Nath\n"];
  const spaced = ocrParagraphText(raw, paragraphs);
  assert.equal(spaced, "To the Registrar\nRefund request\n\nI paid INR 4500 twice.\nPlease verify both receipts.\n\nYours faithfully,\nRiya Nath");
  assert.equal(spaced.replace(/\s/g, ""), raw.replace(/\s/g, ""));
  assert.equal(ocrParagraphText(raw, paragraphs.slice(0, 2)), raw.trim());
  assert.equal(ocrParagraphText(raw), raw.trim());
  const lines = [
    { text: "I paid INR 4500 twice.", y: 200, height: 25 },
    { text: "Please verify both receipts.", y: 245, height: 25 },
    { text: "Yours faithfully,", y: 380, height: 25 },
    { text: "Riya Nath", y: 425, height: 25 },
  ];
  const merged = lines.map((line) => line.text).join("\n");
  assert.equal(ocrParagraphText(merged, [merged], lines), "I paid INR 4500 twice.\nPlease verify both receipts.\n\nYours faithfully,\nRiya Nath");
  assert.equal(ocrParagraphText(raw, paragraphs, lines), spaced, "Incomplete layout data falls back to the complete recognized paragraphs");
});

function extractedGpf(text = gpfProposalText) {
  const bytes = new TextEncoder().encode(text);
  const item = createImportedCase({ name: "renamed-proposal.txt", type: "text/plain", size: bytes.length }, bytes.buffer, "blob:original-gpf", "FIN-GPF-TEST", now);
  return applyExtractedText(item, initialCaseState(item), finishExtraction([{ page: 1, text, ocr: false }], "Text"), now);
}

test("the supplied GPF proposal becomes the expected formatted note only on explicit conversion", () => {
  const proposal = extractedGpf();
  assert.equal(proposal.state.draftKind, "proposal");
  assert.equal(proposal.state.appliedRuleIds, undefined);
  const result = convertGpfProposal(proposal.item, proposal.state, now);
  const expected = renderGpfNote(parseGpfProposal(gpfProposalText));
  assert.equal(result.state.draftKind, "note");
  assert.equal(result.state.html, expected.html);
  assert.equal(result.state.text, expected.text);
  assert.match(result.state.html, /<table>/);
  assert.match(result.state.text, /Put up for your kind perusal/);
  assert.match(result.state.text, /50% ceiling.*Rs\. 3,00,000/);
  assert.match(result.state.text, /36 equal monthly instalments of Rs\. 5,000/);
  assert.equal(result.state.terminal, "Vice-Chancellor");
  assert.equal(result.state.proposalDraft?.text, gpfProposalText);
  assert.equal(result.item.documents[0].original, proposal.item.documents[0].original);
  assert.deepEqual(result.state.appliedRuleIds, gpfRules.map((rule) => rule.id));
  assert.equal(proposal.state.draftKind, "proposal", "The reviewed proposal is not mutated");
  assert.equal(validateNote(result.item, result.state).some((finding) => finding.kind === "error"), false);
  assert.equal(result.state.html.includes("data-rule-source"), false);
  assert.equal(advanceWorkflow(result.item, result.state, "Dealing Assistant", "submit", "", now).state?.status, "In review");
});

test("GPF note preparation uses reviewed fields and rejects unrelated or inconsistent requests", () => {
  const edited = extractedGpf(gpfProposalText.replaceAll("Dr. Aditi Bora", "Dr. Rina Das"));
  const result = convertGpfProposal(edited.item, edited.state, now);
  assert.match(result.state.text, /Dr\. Rina Das/);
  assert.equal(result.state.text.includes("Dr. Aditi Bora"), false);
  assert.throws(() => parseGpfProposal("Please refund my semester fee."), /first-case demo/);
  assert.throws(() => parseGpfProposal(gpfProposalText.replace("Advance requested: INR 180000", "Advance requested: INR 400000")), /50%/);
  assert.throws(() => parseGpfProposal(gpfProposalText.replace("Previous advance outstanding: INR 0", "Previous advance outstanding: INR 10000")), /12.1.3/);
  assert.throws(() => parseGpfProposal(gpfProposalText.replace("Repayment instalments: 36", "Repayment instalments: 40")), /36 equal/);
  assert.throws(() => parseGpfProposal(gpfProposalText.replace("CPF subscriber before 2005-02-01: Yes", "CPF subscriber before 2005-02-01: No")), /Rule 5/);
  assert.throws(() => parseGpfProposal(gpfProposalText + "\nGPF balance: INR 999999"), /one clear/);
  assert.throws(() => convertGpfProposal(result.item, result.state, now), /review the proposal text/);
});

test("GPF rules are tied to the supplied PDF and the assistant respects the proposal stage", () => {
  assert.deepEqual([...new Set(gpfRules.map((rule) => rule.file?.page))], [4, 7, 8]);
  assert.ok(gpfRules.every((rule) => rule.file?.name === "GPF-RULE-FINAL.pdf"));
  assert.equal(gpfRules.some((rule) => /Rule 13/.test(rule.title)), false);
  assert.deepEqual(respondToRules("Explain Rule 5", gpfRules, "").citations, ["du-gpf-5"]);
  assert.deepEqual(respondToRules("Explain Rule 12.1.4", gpfRules, "").citations, ["du-gpf-12-1-4"]);
  const proposal = extractedGpf();
  const request = { question: "Draft the next action", mode: "draft" as const, current: proposal.item, state: proposal.state, cases: [proposal.item], states: { [proposal.item.id]: proposal.state }, references: proposal.item.documents };
  const answer = demoAI.respond(request);
  assert.equal(answer.draft, undefined);
  assert.match(answer.text, /Convert to note/);
  assert.equal(canApproveNote(proposal.item, { ...proposal.state, level: 4, status: "In review" }, "Registrar"), false);
});

const newRefund = `To the Registrar
Dibrugarh University
Subject: Request for refund of duplicate examination fee

I, Riya Nath, a student in the Department of Physics, accidentally paid INR 3200 twice for the examination. I request a refund of INR 3200. Please check the two payment receipts.

Yours faithfully,
Riya Nath`;
function draftInput(text: string, title = "new-upload") : NoteInput {
  return { title, proposal_text: text, proposal_id: "new-proposal", supporting_documents: [] };
}

test("new free-form refund proposals produce their own notes without sample identifiers", () => {
  const input = draftInput(newRefund);
  const draft = buildLocalNote(input);
  assert.equal(draft.category, "fee-refund");
  assert.equal(draft.facts.find((fact) => fact.key === "applicant")?.value, "Riya Nath");
  assert.equal(draft.facts.find((fact) => fact.key === "amount_requested")?.value, "INR 3200");
  assert.ok(draft.facts.every((fact) => factIsGrounded(fact, input)));
  assert.deepEqual(draft.applied_rules, []);
  assert.ok(draft.missing_information.some((value) => value.includes("policy")));
  assert.ok(draft.style_sources[0].path.endsWith("Untitled design (5).pdf"));
  assert.ok(draft.paragraphs.some((value) => value.includes("ledger")));
  assert.equal(JSON.stringify(draft).includes("Aditi Bora"), false);
  assert.equal(JSON.stringify(draft).includes("DEMO-GPF-001"), false);
  assert.equal(draft.engine, "local");
});

test("note formation preserves originals, uses edited text and is independent of the filename", () => {
  const bytes = new TextEncoder().encode(newRefund);
  const item = createImportedCase({ name: "scan-128.txt", type: "text/plain", size: bytes.length }, bytes.buffer, "blob:refund", "FIN-NEW", now);
  const extracted = applyExtractedText(item, initialCaseState(item), finishExtraction([{ page: 1, text: newRefund, ocr: false }], "Text"), now);
  const edited = { ...extracted.state, text: newRefund.replaceAll("Riya Nath", "Anu Bora") };
  const input = noteInput(extracted.item, edited);
  const draft = buildLocalNote(input);
  assert.equal(buildLocalNote({ ...input, title: "some-other-filename" }).subject, draft.subject);
  draft.paragraphs = draft.paragraphs.filter((paragraph) => paragraph !== draft.recommendation);
  const result = applyDraftNote(extracted.item, edited, draft, now);
  assert.equal(result.state.draftKind, "note");
  assert.match(result.state.text, /Anu Bora/);
  assert.equal(result.state.text.includes("Riya Nath"), false);
  assert.match(result.state.html, /<table>/);
  assert.match(result.state.text, /Put up for your kind perusal/);
  assert.equal(result.state.proposalDraft?.text, edited.text);
  assert.equal(result.item.documents[0].original, extracted.item.documents[0].original);
  assert.equal(extracted.state.draftKind, "proposal");
  assert.equal(result.state.generation?.engine, "local");
  assert.ok(result.state.text.includes(draft.recommendation));
});

test("incomplete and unfamiliar applications still produce a clarification note", () => {
  const draft = buildLocalNote(draftInput("Please permit me to submit my dissertation after the deadline because my project work was delayed."));
  assert.equal(draft.category, "general");
  assert.ok(draft.paragraphs.length >= 3);
  assert.ok(draft.missing_information.some((value) => value.includes("Applicant")));
  assert.equal(draft.facts.some((fact) => fact.key === "application_date"), false);
  assert.deepEqual(draft.applied_rules, []);
});

test("new GPF medical applications use advance rules without education-only sample facts", () => {
  const input = draftInput(`Subject: Request for GPF advance for medical expenses
I, Arup Das, request an advance of INR 90000 from my GPF for my dependent father's surgery. My GPF account has a balance of INR 300000. I propose 30 equal monthly instalments.
Yours faithfully,
Arup Das`);
  const draft = buildLocalNote(input);
  assert.equal(draft.category, "gpf-advance");
  assert.equal(draft.facts.find((fact) => fact.key === "fund_balance")?.value, "INR 300000");
  assert.ok(draft.applied_rules.some((rule) => rule.id === "du-gpf-12-1-1"));
  assert.ok(draft.paragraphs.some((paragraph) => paragraph.includes("1,50,000")));
  assert.equal(JSON.stringify(draft).includes("Anika Bora"), false);
  assert.equal(JSON.stringify(draft).includes("dependent daughter"), false);
  assert.ok(draft.facts.every((fact) => factIsGrounded(fact, input)));
});

test("GPF withdrawals and final payments are not drafted as recoverable advances", () => {
  const withdrawal = buildLocalNote(draftInput(`Subject: GPF withdrawal for house construction
Applicant: Arup Das
Amount requested: INR 250000
GPF balance: INR 800000
Monthly pay: INR 40000
I request a non-refundable withdrawal to construct a house.`));
  assert.equal(withdrawal.category, "gpf-withdrawal");
  assert.ok(withdrawal.applied_rules.some((rule) => rule.id === "du-gpf-13-2"));
  assert.equal(withdrawal.applied_rules.some((rule) => rule.id.startsWith("du-gpf-12")), false);
  assert.match(withdrawal.paragraphs.join(" "), /6,00,000/);
  const final = buildLocalNote(draftInput("Subject: Final settlement of GPF after retirement\nI have retired and request final payment of my GPF accumulation."));
  assert.equal(final.category, "gpf-final");
  assert.ok(final.applied_rules.some((rule) => rule.id === "du-gpf-14-1"));
  assert.equal(final.applied_rules.some((rule) => rule.id.startsWith("du-gpf-12")), false);
});

test("the sample remains supported but its explicit advance is not mistaken for a withdrawal", () => {
  assert.equal(classifyProposal(gpfProposalText), "gpf-advance");
  const draft = buildLocalNote(draftInput(gpfProposalText));
  assert.ok(draft.paragraphs.some((paragraph) => paragraph.includes("3,00,000")));
  assert.ok(draft.paragraphs.some((paragraph) => paragraph.includes("5,000")));
});

test("new drafts report GPF limits and handle Indian amount units", () => {
  assert.equal(moneyValue("Rs. 1.5 lakh"), 150000);
  assert.equal(moneyValue("INR 2 crore"), 20000000);
  assert.equal(moneyValue("INR 180OO0"), undefined);
  const draft = buildLocalNote(draftInput("Subject: GPF advance\nGPF balance: INR 300000\nAdvance requested: INR 200000\nRepayment instalments: 40\nI request this advance for higher education."));
  assert.ok(draft.findings.some((finding) => finding.kind === "error" && finding.title.includes("limit")));
  assert.ok(draft.findings.some((finding) => finding.title.includes("repayment") || finding.title.includes("Repayment")));
});

test("a different named university does not inherit the Dibrugarh GPF policy", () => {
  const draft = buildLocalNote(draftInput("To the Registrar\nDelhi University\nSubject: GPF advance\nI request an advance of INR 50000 from my GPF account for medical treatment."));
  assert.equal(draft.institution, "Delhi University");
  assert.deepEqual(draft.applied_rules, []);
  assert.equal(draft.paragraphs.some((paragraph) => paragraph.includes("Rule 12")), false);
});

const consultancyProposal = `Dibrugarh University
Subject: Distribution of institutional consultancy earnings
Applicant: Dr. Nandita Roy
Department: Applied Geology
Distributable consultancy earnings: INR 100000
We request distribution of earnings from materials testing for an external client using University laboratory facilities. Laboratory staff participated in the assignment. Please verify the client report and DUCF deposit before release.`;

test("new consultancy proposals use the added PDF and its nested earnings split", () => {
  const draft = buildLocalNote(draftInput(consultancyProposal));
  assert.equal(draft.category, "consultancy");
  assert.ok(draft.applied_rules.some((rule) => rule.id === "du-consultancy-2-1-2"));
  assert.ok(draft.applied_rules.some((rule) => rule.id === "du-consultancy-3-ii"));
  assert.equal(draft.applied_rules.some((rule) => rule.id.startsWith("du-gpf")), false);
  assert.match(draft.paragraphs.join(" "), /60,000.*40,000.*36,000.*24,000/);
  assert.match(draft.recommendation, /Advisory Committee/);
  assert.doesNotMatch(draft.recommendation, /Vice-Chancellor/);
  assert.match(draft.missing_information.join(" "), /transaction-date tax/);
  const bytes = new TextEncoder().encode(consultancyProposal);
  const item = createImportedCase({ name: "consultancy.txt", type: "text/plain", size: bytes.length }, bytes.buffer, "blob:consultancy", "FIN-CONSULT", now);
  const extracted = applyExtractedText(item, initialCaseState(item), finishExtraction([{ page: 1, text: consultancyProposal, ocr: false }], "Text"), now);
  const result = applyDraftNote(extracted.item, extracted.state, draft, now);
  const rule = result.item.documents.find((doc) => doc.id === "du-consultancy-2-1-2");
  assert.equal(rule?.file?.url, "/samples/case-01/consultancy-service-rules.pdf");
  assert.equal(rule?.file?.page, 3);
  assert.equal(rule?.highlight, -1);
});

test("consultancy leave applies both limits while ordinary leave and refunds keep their own rules", () => {
  const draft = buildLocalNote(draftInput(`Dibrugarh University
Subject: Special consultancy leave for an off-campus visit
Consultancy leave days requested: 6
Consultancy leave already taken this calendar year: 16
I request permission for the consultancy visit to the client.`));
  assert.ok(draft.findings.some((finding) => finding.title.includes("single-spell")));
  assert.ok(draft.findings.some((finding) => finding.title.includes("annual limit")));
  assert.match(draft.paragraphs.join(" "), /Points requiring resolution/);
  for (const text of [newRefund, "Subject: Casual leave\nI request five days of casual leave for personal reasons.", "Subject: Hiring an external consultant\nPlease approve procurement of consultancy services for the office."]) {
    assert.deepEqual(buildLocalNote(draftInput(text)).applied_rules, []);
  }
  const refund = buildLocalNote(draftInput("Dibrugarh University\nSubject: Refund of consultancy analysis fee\nOur external client requests refund of INR 6000 as the testing service could not be provided."));
  assert.equal(refund.category, "service-refund");
  assert.ok(refund.applied_rules.some((rule) => rule.id === "du-consultancy-2-1-1"));
  assert.ok(refund.missing_information.some((value) => value.includes("refund entitlement")));
  assert.equal(refund.applied_rules.some((rule) => rule.id === "du-consultancy-2-1-2"), false);
  assert.deepEqual(buildLocalNote(draftInput(consultancyProposal.replace("Dibrugarh University", "Delhi University"))).applied_rules, []);
});

test("soft PDF line breaks do not drop parts of the applicant's request", () => {
  const input = draftInput(`Subject: GPF advance for medical treatment
I, Arup Das, request an advance of INR 90000 for my
dependent father's surgery. My GPF account has a
balance of INR 300000. My registration number is EMP-059.
I propose 30 equal monthly instalments.`);
  const draft = buildLocalNote(input);
  assert.match(draft.paragraphs.join(" "), /my dependent father's surgery\./);
  assert.equal(draft.facts.find((fact) => fact.key === "fund_balance")?.value, "INR 300000");
  assert.equal(draft.facts.find((fact) => fact.key === "reference")?.value, "EMP-059");
  assert.ok(draft.facts.every((fact) => factIsGrounded(fact, input)));
});

test("the drafting service falls back locally without a configured model and honours cancellation", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ ai_available: false });
    const draft = await requestNoteDraft(draftInput(newRefund), new AbortController().signal);
    assert.equal(draft.engine, "local");
    const controller = new AbortController();
    globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true });
    });
    const pending = requestNoteDraft(draftInput(newRefund), controller.signal);
    controller.abort();
    await assert.rejects(pending, { name: "AbortError" });
  } finally { globalThis.fetch = originalFetch; }
});
