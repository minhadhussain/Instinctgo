import { buildLocalNote, type DraftNote, type NoteInput } from "./note-draft";
import { countWords, swsHeadings } from "./sws-settings";

function concise(text: string, words: number) {
  const tokens = text.trim().split(/\s+/);
  return tokens.length <= words ? text.trim() : `${tokens.slice(0, words).join(" ")}…`;
}

export function buildSwsNote(input: NoteInput): DraftNote {
  const base = buildLocalNote(input);
  const text = input.proposal_text;
  const label = (names: string) => text.match(new RegExp(`^(?:${names})\\s*:\\s*([^\\n]+)`, "im"))?.[1].trim();
  const request = text.replace(/\s+/g, " ").match(/\b(?:I request|We request|It is proposed|The proposal seeks)\b[^.!?]+[.!?]?/i)?.[0];
  const amount = label("Estimated cost|Total estimated cost|Amount requested|Total cost") ?? base.facts.find((fact) => fact.key === "amount_requested" || fact.key === "amount_mentioned")?.value;
  const budget = label("Budget head|Head of account|Budget code");
  const availability = label("Budget availability|Funds available");
  const limit = input.word_limit ?? 300;
  const sections = [
    { heading: swsHeadings[0], text: `${base.facts.find((fact) => fact.key === "applicant")?.value ?? "The concerned section"} has submitted the proposal for ${base.subject.replace(/\.$/, "")}.${request ? ` Stated requirement: “${concise(request, Math.max(20, Math.floor(limit * 0.2)))}”` : " Confirm the quantity, specification and need from the proposal."}` },
    { heading: swsHeadings[1], text: `${amount ? `Stated estimate / amount: ${concise(amount, 15)}.` : "Cost estimate: confirmation required."} Budget head: ${concise(budget ?? "not supplied", 20)}. ${availability ? `Budget availability: ${concise(availability, 15)}.` : "Confirm available funds with Finance & Accounts."}` },
    { heading: swsHeadings[2], text: "GFR / University Procurement Rules and Assam Procurement Rules are pending addition. Record the applicable clauses and procurement method after examining the supplied rulebooks; compliance is not established by this draft." },
    { heading: swsHeadings[3], text: "Subject to confirmation of need, estimate, budget availability and applicable procurement provisions, the proposal may be placed before the competent authority for consideration and approval." },
  ];
  // A short target changes the summary allocation; it never truncates source documents.
  if (countWords(sections.map((section) => section.text).join(" ")) > limit) {
    sections[0].text = `The proposal concerns ${concise(base.subject, 20)}. Verify the stated quantity and specification.`;
    sections[2].text = "GFR / University and Assam procurement rulebooks are pending. Applicable clauses and procurement method require confirmation.";
    sections[3].text = "Put up for consideration, subject to verified need, estimate, budget availability and applicable procurement provisions.";
  }
  return { ...base, category: "procurement", routing: "Student Welfare Section · Dealing Assistant", paragraphs: sections.map((section) => section.text), sections, recommendation: sections[3].text, applied_rules: [], missing_information: ["Add the GFR / University Procurement Rules and Assam Procurement Rules to complete rule justification."], findings: [], engine: "local" };
}
