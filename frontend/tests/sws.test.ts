import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildSwsNote } from "../src/lib/playground/sws-draft";
import { applyDraftNote, noteInput } from "../src/lib/playground/note-draft";
import { defaultNotingLayout, countWords, layoutError, paperSizes, swsHeadings } from "../src/lib/playground/sws-settings";
import { createImportedCase } from "../src/lib/playground/intake";
import { applyExtractedText, finishExtraction } from "../src/lib/playground/document-text";
import { initialCaseState } from "../src/lib/playground/workflow";

const text = readFileSync(new URL("../public/samples/sws-procurement-proposal.txt", import.meta.url), "utf8").replace(/\r\n?/g, "\n");
const now = "2026-11-06T10:00:00Z";

test("SWS uses a concise four-section note and explicitly reserves both missing rulebooks", () => {
  const draft = buildSwsNote({ title: "Procurement", proposal_id: "proposal", proposal_text: text, supporting_documents: [], drafting_style: "sws-procurement", word_limit: 300 });
  assert.deepEqual(draft.sections?.map((section) => section.heading), [...swsHeadings]);
  assert.ok(countWords(draft.sections!.map((section) => section.text).join(" ")) <= 300);
  assert.match(draft.sections![1].text, /INR 60000/);
  assert.match(draft.sections![1].text, /Budget head/);
  assert.match(draft.sections![2].text, /Assam Procurement Rules.*pending/);
  assert.deepEqual(draft.applied_rules, []);
  assert.equal(draft.category, "procurement");
  assert.doesNotMatch(JSON.stringify(draft.sections), /12\.1|GPF|60%/);
});

test("SWS conversion retains the proposal and starts automatic note/paragraph numbering", () => {
  const bytes = new TextEncoder().encode(text);
  const item = { ...createImportedCase({ name: "sws.txt", type: "text/plain", size: bytes.length }, bytes.buffer, "blob:sws", "SWS-001", now), workspace: "sws-procurement" as const };
  const initial = initialCaseState(item);
  assert.equal(initial.notingLayout?.paper, "legal");
  assert.equal(initial.notingLayout?.margins.left, 35);
  const extracted = applyExtractedText(item, initial, finishExtraction([{ page: 1, text, ocr: false }], "Text"), now);
  const input = noteInput(extracted.item, extracted.state);
  assert.equal(input.drafting_style, "sws-procurement");
  assert.equal(input.word_limit, 300);
  const result = applyDraftNote(extracted.item, extracted.state, buildSwsNote(input), now);
  assert.match(result.state.html, /data-note-number="1"/);
  assert.equal((result.state.html.match(/data-para-number=/g) ?? []).length, 4);
  assert.equal(result.state.proposalDraft?.text, text.trim());
  assert.equal(result.item.section, "Student Welfare Section");
  assert.equal(result.state.notingLayout, initial.notingLayout);
});

test("paper dimensions and margins use actual Legal and A3 sizes", () => {
  assert.deepEqual([paperSizes.legal.width, paperSizes.legal.height], [215.9, 355.6]);
  assert.deepEqual([paperSizes.a3.width, paperSizes.a3.height], [297, 420]);
  const layout = defaultNotingLayout();
  assert.equal(layoutError(layout), undefined);
  assert.equal(layoutError({ ...layout, paper: "a3" }), undefined);
  assert.match(layoutError({ ...layout, margins: { top: 20, bottom: 20, left: 80, right: 80 } })!, /writing width/);
  assert.match(layoutError({ ...layout, margins: { ...layout.margins, left: -5 } })!, /between 10 and 80/);
  assert.match(layoutError({ ...layout, wordLimit: 20 })!, /word target/);
});
