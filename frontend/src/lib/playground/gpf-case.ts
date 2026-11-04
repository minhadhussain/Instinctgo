import { escapeHtml } from "./renderer";
import type { CaseDefinition, CaseState, ReferenceDocument } from "./types";

export const GPF_CASE_ID = "du-gpf-education-advance";
export const gpfSample = {
  title: "GPF advance for a dependent child's higher education",
  proposalUrl: "/samples/case-01/gpf-advance-proposal.pdf",
  proposalName: "gpf-advance-proposal.pdf",
  noteUrl: "/samples/case-01/gpf-advance-note.pdf",
  ruleUrl: "/samples/case-01/gpf-rules-2013.pdf",
};

export interface GpfFacts {
  reference: string; applicant: string; employeeId: string; designation: string; department: string;
  appointment: string; cpfBeforeCutoff: boolean; inService2013: boolean; account: string;
  balance: number; amount: number; outstanding: number; instalments: number; monthly: number;
  dependent: string; course: string; institution: string; applicationDate: string;
}

export const gpfProposalText = `DIBRUGARH UNIVERSITY
DEMONSTRATION PROPOSAL - ALL APPLICANT DETAILS ARE FICTIONAL

Case reference: DEMO-GPF-001
Application date: 2026-11-04

To
The Registrar
Dibrugarh University
Through the Head, Department of Physics

Subject: Request for a refundable GPF advance for higher education of my dependent daughter

Sir/Madam,

I request a refundable advance of INR 180000 from my General Provident Fund account to meet the higher-education expenses of my daughter, who is actually dependent on me. She is pursuing the B.Tech course stated below. My available personal resources are insufficient to meet the present fee demand, and I request consideration of my pecuniary circumstances.

Applicant: Dr. Aditi Bora
Employee ID: EMP-DEMO-001
Designation: Assistant Professor
Department: Department of Physics
Permanent appointment date: 2002-07-15
CPF subscriber before 2005-02-01: Yes
In service on 2013-03-31: Yes
GPF account: GPF-DEMO-001
GPF balance: INR 600000
Advance requested: INR 180000
Previous advance outstanding: INR 0
Purpose: Higher education of dependent daughter
Dependent name: Anika Bora
Course: B.Tech in Civil Engineering
Institution: Example Institute of Engineering
Repayment instalments: 36
Monthly instalment: INR 5000

I declare that I hold a permanent substantive appointment, was a CPF subscriber before 1 February 2005, continued in University service on 31 March 2013, and am a GPF subscriber. The balance above represents my subscription and interest. No previous GPF advance remains outstanding.

I agree to recovery of the principal in 36 equal monthly instalments of INR 5000, commencing from the first full month's pay after the advance is paid. I also agree to interest as determined by the University under the applicable GPF rules. I request an advance, not a non-refundable withdrawal.

The supporting declaration and illustrative education-fee schedule at Annexure A form part of this proposal. Kindly place my application before the competent authority.

Yours faithfully,
Dr. Aditi Bora
Assistant Professor, Department of Physics
(Fictional applicant; demonstration only)

ANNEXURE A - SUPPORTING PARTICULARS (DEMONSTRATION)

The following particulars are supplied by the fictional applicant and remain subject to verification by Establishment and Finance & Accounts.

Tuition fee: INR 120000
Hostel fee: INR 40000
Books and course materials: INR 20000
Total education expenses: INR 180000

The daughter is stated to be actually dependent on the subscriber. The fee schedule, service particulars, GPF balance and absence of any outstanding advance are to be checked against the relevant University records before sanction or release. No actual admission letter, bank account or verified ledger is represented by this demonstration.`;

function value(text: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const values = [...text.matchAll(new RegExp(`^\\s*${escaped}\\s*:[ \\t]*(.+)$`, "gim"))].map((match) => match[1].trim());
  if (values.length !== 1 || !values[0] || values[0].length > 180) throw new Error(`Provide one clear “${label}: …” entry in the proposal text.`);
  return values[0];
}
function money(text: string, label: string) {
  const raw = value(text, label);
  const match = raw.match(/^(?:(?:INR|Rs\.?|₹)\s*)?([\d,]+)(?:\.00)?(?:\/-)?$/i);
  const amount = match ? Number(match[1].replace(/,/g, "")) : NaN;
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(`“${label}” must be a whole-rupee amount.`);
  return amount;
}
function date(text: string, label: string) {
  const raw = value(text, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !Number.isFinite(Date.parse(raw)) || new Date(raw).toISOString().slice(0, 10) !== raw) throw new Error(`Use YYYY-MM-DD for “${label}”.`);
  return raw;
}
export function parseGpfProposal(input: string): GpfFacts {
  const text = input.normalize("NFKC").replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
  if (!/Case reference\s*:\s*DEMO-GPF-001\b/i.test(text)) throw new Error("This first-case demo supports the GPF higher-education advance proposal. Use the sample proposal provided below the upload area.");
  if (value(text, "Purpose").toLowerCase() !== "higher education of dependent daughter") throw new Error("This case is configured for a GPF advance for a dependent daughter's higher education.");
  const facts: GpfFacts = {
    reference: value(text, "Case reference"), applicant: value(text, "Applicant"), employeeId: value(text, "Employee ID"), designation: value(text, "Designation"), department: value(text, "Department"),
    appointment: date(text, "Permanent appointment date"), cpfBeforeCutoff: value(text, "CPF subscriber before 2005-02-01").toLowerCase() === "yes", inService2013: value(text, "In service on 2013-03-31").toLowerCase() === "yes",
    account: value(text, "GPF account"), balance: money(text, "GPF balance"), amount: money(text, "Advance requested"), outstanding: money(text, "Previous advance outstanding"),
    instalments: Number(value(text, "Repayment instalments")), monthly: money(text, "Monthly instalment"), dependent: value(text, "Dependent name"), course: value(text, "Course"), institution: value(text, "Institution"), applicationDate: date(text, "Application date"),
  };
  if (facts.reference.toUpperCase() !== "DEMO-GPF-001") throw new Error("Use case reference DEMO-GPF-001 for this configured proposal.");
  if (facts.appointment >= "2005-02-01" || !facts.cpfBeforeCutoff || !facts.inService2013) throw new Error("The stated service / CPF particulars do not satisfy this case's Rule 5 eligibility conditions. Correct or clarify them before generating the note.");
  if (facts.applicationDate < "2013-04-01" || facts.applicationDate <= facts.appointment) throw new Error("The application date must follow appointment and the commencement of the supplied GPF rules.");
  if (facts.balance <= 0 || facts.amount <= 0 || facts.amount > facts.balance * 0.5) throw new Error("The requested advance must be positive and cannot exceed 50% of the subscription-and-interest balance (Rule 12.1.2).");
  if (facts.outstanding !== 0) throw new Error("Rule 12.1.3 requires repayment of the previous advance. Clarify the outstanding advance before preparing this recommendation.");
  if (!Number.isInteger(facts.instalments) || facts.instalments < 1 || facts.instalments > 36 || facts.monthly * facts.instalments !== facts.amount) throw new Error("The principal must reconcile to at most 36 equal whole-rupee monthly instalments (Rule 12.1.4).");
  return facts;
}

const rule = (id: string, title: string, page: number, excerpt: string): ReferenceDocument => ({
  id, title, type: "GPF rules", source: "Dibrugarh University · supplied General Provident Fund Rules, 2013", date: "2013-08-13", effectiveDate: "2013-04-01", version: "2013", status: "Current", department: "Finance & Accounts", locator: `GPF-RULE-FINAL.pdf · page ${page}`, content: ["Extract from the supplied Dibrugarh University General Provident Fund Rules, 2013.", excerpt], highlight: -1, file: { name: "GPF-RULE-FINAL.pdf", url: gpfSample.ruleUrl, page },
});

export const gpfRules: ReferenceDocument[] = [
  rule("du-gpf-5", "Rule 5 · Subscriber eligibility", 4, "Every employee of the University holding a permanent substantive appointment and a subscriber to C.P.F before 1-2-2005 and not retired from the service of the university till 31.03.2013 shall be entitled to be a subscriber to the General Provident Fund."),
  rule("du-gpf-12-1", "Rule 12.1 · Sanctioning authority", 7, "The payment of an advance from the fund may be sanctioned by the Vice-Chancellor to a subscriber from the amount of his subscription and interest thereon standing to his credit, subject to the following conditions."),
  rule("du-gpf-12-1-1", "Rule 12.1.1(iii) · Higher education", 7, "No advance shall be granted unless the sanctioning authority is satisfied that the applicant's pecuniary circumstance justifies it, and that it will be spent for the following purpose and not otherwise: (iii) To meet the cost of higher education of any person actually dependent on the subscriber."),
  rule("du-gpf-12-1-2", "Rules 12.1.2–12.1.3 · Ceiling & prior advance", 7, "12.1.2 An advance shall in no case exceed 50 percent of the amount of subscription and interest thereon standing to the credit of the subscriber in the Fund.\n\n12.1.3 An advance shall not be granted to any subscriber in excess of the limit laid down in Rule 12.1.2 herein or until repayment of the previous advance."),
  rule("du-gpf-12-1-4", "Rule 12.1.4 · Repayment instalments", 8, "The amount of advance shall be recovered in not more than thirty six equal monthly installments. Each installment shall be a number of whole rupees, the amount of advance being raised or reduced, if necessary, to admit of the fixation of such installments. A subscriber may at his option repay in a smaller number of installment than that agreed upon at the time of grant of advance or in a lump sum."),
  rule("du-gpf-12-1-5", "Rule 12.1.5 · Start of recovery", 8, "Recovery of advance shall be made from the monthly pay of a subscriber and shall commence on the first occasion, after the advance is made, on which the subscriber draws pay for a full month."),
  rule("du-gpf-12-1-6", "Rule 12.1.6 · Interest on advances", 8, "Interest on advances shall be such as may be determined by the University from time to time and shall not exceed by more than two percent of the rate paid by the University to the account of a subscriber. The interest shall ordinarily be recovered in one installment from pay in the next month after complete repayment of the principal has been made. If the period of repayments exceeds twenty months, interest may, if the subscriber so desires, be recovered in two equal monthly installments, the monthly payment being rounded to the nearest whole rupee, 50 p and above counting as next higher rupee."),
];

export type NoteBlock = { kind: "paragraph"; text: string; bold?: boolean; underline?: boolean } | { kind: "table"; rows: string[][] };
const amount = (value: number) => `Rs. ${value.toLocaleString("en-IN")}/-`;
const longDate = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

export function gpfNoteBlocks(f: GpfFacts): NoteBlock[] {
  return [
    { kind: "paragraph", bold: true, underline: true, text: "Registrar / Dy. Registrar (F&A) / Internal Audit / S.O., Accounts" },
    { kind: "paragraph", bold: true, underline: true, text: "GPF advance for higher education of a dependent child:" },
    { kind: "table", rows: [["Sl. No.", "Name of applicant / GPF account", "Department / Purpose", "Advance requested"], ["1", `${f.applicant}\n${f.designation}\n${f.account}`, `${f.department}\nHigher education of dependent daughter`, amount(f.amount)]] },
    { kind: "paragraph", text: `We have received an application dated ${longDate(f.applicationDate)} from ${f.applicant}, ${f.designation}, ${f.department}, along with a declaration of service and GPF particulars and an illustrative education-fee schedule at Annexure A. The application may kindly be seen at Flag 'A' (${f.reference}).` },
    { kind: "paragraph", text: `The above-mentioned applicant has requested a refundable GPF advance of ${amount(f.amount)} towards the higher education of the actually dependent daughter, ${f.dependent}, pursuing ${f.course} at ${f.institution}. The applicant states that available personal resources are insufficient. This purpose falls under Rule 12.1.1(iii), subject to the sanctioning authority being satisfied about the pecuniary circumstances and intended use.` },
    { kind: "paragraph", text: `The applicant states that the permanent substantive appointment commenced on ${longDate(f.appointment)}, CPF membership existed before 01 February 2005 and University service continued on 31 March 2013. These particulars correspond to the subscriber conditions in Rule 5 and require verification from the service records.` },
    { kind: "paragraph", text: `The stated subscription-and-interest balance is ${amount(f.balance)}. The 50% ceiling under Rule 12.1.2 is ${amount(f.balance * 0.5)}; the requested ${amount(f.amount)} is within that ceiling. The applicant declares no previous advance outstanding, to be verified under Rule 12.1.3. The balance, declaration and educational supporting particulars may please be checked by Finance & Accounts / Establishment before sanction or release.` },
    { kind: "paragraph", text: `The proposed principal recovery is ${f.instalments} equal monthly instalments of ${amount(f.monthly)} (${f.instalments} x ${amount(f.monthly)} = ${amount(f.amount)}), satisfying the maximum of 36 whole-rupee instalments in Rule 12.1.4. Recovery shall commence from the first occasion on which full-month pay is drawn after payment of the advance, as provided in Rule 12.1.5.` },
    { kind: "paragraph", text: `Interest shall be applied at the rate determined by the University under Rule 12.1.6 and ordinarily recovered from pay in the month following full recovery of the principal.${f.instalments > 20 ? " As repayment exceeds twenty months, the subscriber may request recovery of interest in two equal monthly instalments where Rule 12.1.6 permits." : ""} No numerical interest rate is assumed in this note.` },
    { kind: "paragraph", text: `If the particulars are verified and the request is found justified, the file may be placed before the Vice-Chancellor for sanction of ${amount(f.amount)} under Rule 12.1. Approval is requested for an advance from the subscriber's GPF subscription-and-interest balance; this is not a non-refundable withdrawal under Rule 13. Release shall follow the recorded sanction and the applicable account verification.` },
    { kind: "paragraph", text: "Put up for your kind perusal and necessary order please." },
    { kind: "paragraph", text: `Dealing Assistant\nFinance & Accounts\n${longDate(f.applicationDate)}` },
  ];
}

export function renderGpfNote(facts: GpfFacts) {
  const blocks = gpfNoteBlocks(facts);
  const html = blocks.map((block) => {
    if (block.kind === "table") return `<table><tbody>${block.rows.map((row, index) => `<tr>${row.map((cell) => `<${index === 0 ? "th" : "td"}><p>${escapeHtml(cell).replace(/\n/g, "<br>")}</p></${index === 0 ? "th" : "td"}>`).join("")}</tr>`).join("")}</tbody></table>`;
    let content = escapeHtml(block.text).replace(/\n/g, "<br>");
    if (block.underline) content = `<u>${content}</u>`;
    if (block.bold) content = `<strong>${content}</strong>`;
    return `<p>${content}</p>`;
  }).join("");
  const text = blocks.map((block) => block.kind === "table" ? block.rows.map((row) => row.join(" | ")).join("\n") : block.text).join("\n\n");
  return { html, text, blocks };
}

export const gpfCase: CaseDefinition = {
  id: "DEMO-GPF-001", subject: gpfSample.title, category: "GPF higher-education advance", institution: "Dibrugarh University", branch: "Administrative", section: "Finance & Accounts", date: "2026-11-04", session: "2026–27", applicant: "Dr. Aditi Bora", assistant: "Dealing Assistant", officer: "Section Officer", description: "Refundable GPF advance for the higher education of a dependent child.",
  documents: [], note: [], facts: [], explanation: [], findings: [], recommendation: "Prepare the note for consideration by the Vice-Chancellor after verification of the application particulars.", terminal: "Vice-Chancellor", tools: ["Text extraction", "GPF rule examination", "Note preparation"], caseTemplateId: GPF_CASE_ID,
};

export function convertGpfProposal(item: CaseDefinition, state: CaseState, now: string): { item: CaseDefinition; state: CaseState } {
  if (state.draftKind !== "proposal" || state.stage < 6 || state.movements.length) throw new Error("Convert and review the proposal text before preparing a note.");
  const facts = parseGpfProposal(state.text);
  const generated = renderGpfNote(facts);
  const applications = [
    "The declared appointment / CPF dates and continued service must be checked against Rule 5.",
    "The recommendation is placed before the Vice-Chancellor for sanction.",
    `The request is for ${facts.dependent}'s higher education; dependency and pecuniary need remain subject to verification.`,
    `${amount(facts.amount)} requested against a ${amount(facts.balance * 0.5)} ceiling; no prior advance is declared outstanding.`,
    `${facts.instalments} equal instalments of ${amount(facts.monthly)} reconcile to the principal.`,
    "Principal recovery starts with the first full-month pay after the advance is paid.",
    "Interest uses the University-determined rate; the note does not invent an interest rate.",
  ];
  const applied = gpfRules.map((doc, index) => ({ ...doc, application: applications[index] }));
  const definition: CaseDefinition = { ...item, ...gpfCase, id: item.id, imported: item.imported, date: facts.applicationDate, applicant: facts.applicant, subject: `GPF advance for ${facts.dependent}'s higher education`, documents: [item.documents[0], ...applied], facts: [{ label: "Applicant", value: facts.applicant }, { label: "GPF balance (declared)", value: amount(facts.balance) }, { label: "Advance requested", value: amount(facts.amount) }, { label: "Maximum under Rule 12.1.2", value: amount(facts.balance * 0.5) }, { label: "Principal recovery", value: `${facts.instalments} x ${amount(facts.monthly)}` }], note: generated.blocks.filter((block) => block.kind === "paragraph").map((block, index) => ({ heading: `Paragraph ${index + 1}`, text: block.text })), explanation: applications, recommendation: `Place ${facts.applicant}'s request for ${amount(facts.amount)} before the Vice-Chancellor after verifying the service, GPF and educational particulars.`, findings: [{ kind: "warning", title: "Applicant particulars require verification", detail: "Service eligibility, GPF balance, prior-advance status, dependency and educational expenses are applicant-supplied particulars, not verified University records." }], calculation: { expression: `${facts.instalments} x ${facts.monthly} = ${facts.amount}; 50% of ${facts.balance} = ${facts.balance * 0.5}`, amount: facts.amount, expected: facts.instalments * facts.monthly } };
  return { item: definition, state: { ...state, html: generated.html, text: generated.text, status: "Generated note", draftKind: "note", terminal: "Vice-Chancellor", level: 0, checks: [], savedAt: now, proposalDraft: { html: state.html, text: state.text, savedAt: state.savedAt }, appliedRuleIds: applied.map((doc) => doc.id), versions: [...state.versions, { id: state.versions.length + 1, label: "Proposal text used for noting", html: state.html, text: state.text, author: "Dealing Assistant", date: now }, { id: state.versions.length + 2, label: "GPF advance note", html: generated.html, text: generated.text, author: "Case template", date: now }] } };
}
