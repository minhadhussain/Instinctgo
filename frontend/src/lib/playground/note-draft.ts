import library from "../../../../samples/noting-library.json";
import { escapeHtml } from "./renderer";
import type { CaseDefinition, CaseState, Finding, ReferenceDocument } from "./types";

export type NoteCategory = "fee-refund" | "admission-refund" | "hostel-refund" | "service-refund" | "gpf-advance" | "gpf-withdrawal" | "gpf-final" | "consultancy" | "leave" | "procurement" | "general";
export type FactKey = "applicant" | "department" | "reference" | "application_date" | "amount_requested" | "amount_mentioned" | "fund_balance" | "instalments" | "monthly_pay" | "consultancy_earnings" | "consultancy_days" | "yearly_consultancy_days" | "annual_consultancy_fees" | "annual_salary";
export interface ProposalFact { key: FactKey; value: string; evidence: string; source_id: string }
export interface NoteInput { title: string; proposal_text: string; proposal_id: string; supporting_documents: { id: string; title: string; text: string }[]; drafting_style?: "standard" | "sws-procurement"; word_limit?: number }
export interface DraftNote {
  subject: string; category: NoteCategory; institution: string | null; routing: string;
  facts: ProposalFact[]; paragraphs: string[]; recommendation: string;
  applied_rules: { id: string; reason: string }[]; missing_information: string[];
  findings: { kind: "warning" | "error"; title: string; detail: string }[];
  engine: "local" | "ai"; style_sources: { path: string; pages: number[]; title: string }[];
  sections?: { heading: string; text: string }[];
}

export const NOTE_INPUT_LIMIT = 200000;
export const NOTE_TEMPLATE_ID = "example-based-noting";
export const factLabels: Record<FactKey, string> = { applicant: "Applicant", department: "Department / course", reference: "Reference / identification", application_date: "Application date", amount_requested: "Amount requested", amount_mentioned: "Amount mentioned", fund_balance: "GPF balance (stated)", instalments: "Repayment instalments (stated)", monthly_pay: "Monthly pay (stated)", consultancy_earnings: "Distributable consultancy earnings (stated)", consultancy_days: "Consultancy leave days requested", yearly_consultancy_days: "Consultancy leave already taken this calendar year", annual_consultancy_fees: "Total yearly consultancy fees (stated)", annual_salary: "Gross annual University salary (stated)" };
const moneyPattern = "(?:₹|\\bINR\\b|\\bRs\\.?)[ \\t]*(?:\\d{1,3}(?:[, ]\\d{2,3})+|\\d+)(?:\\.\\d{1,2})?(?:[ \\t]*(?:lakhs?|lacs?|crores?|thousand))?(?![A-Za-z0-9,]|\\.\\d)";
const moneyTokens = (text: string) => [...text.matchAll(new RegExp(moneyPattern, "gi"))];
const clean = (text: string) => text.normalize("NFKC").replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").trim();
const compact = (text: string) => clean(text).replace(/\s+/g, " ");
export function moneyValue(text?: string) {
  if (!text) return undefined;
  const token = moneyTokens(text)[0]?.[0];
  if (!token) return undefined;
  const digits = token.match(/\d[\d, ]*(?:\.\d+)?/)?.[0];
  const multiplier = /crore/i.test(token) ? 10000000 : /la(?:kh|c)/i.test(token) ? 100000 : /thousand/i.test(token) ? 1000 : 1;
  const value = Number(digits?.replace(/[, ]/g, "")) * multiplier;
  return Number.isFinite(value) ? value : undefined;
}
const rupees = (amount: number) => `Rs. ${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}/-`;

function labelled(text: string, labels: string[]) {
  const expression = new RegExp(`^[ \\t]*(?:${labels.join("|")})[ \\t]*[:：][ \\t]*([^\\n]+)`, "im");
  const match = text.match(expression);
  return match ? { value: match[1].trim(), evidence: match[0].trim() } : undefined;
}
function subjectOf(text: string) { return labelled(text, ["Subject", "Sub\\.?", "Re"])?.value.replace(/^request\s+for\s+/i, "").slice(0, 240); }
function institutionOf(text: string) {
  const employer = labelled(text, ["Employer", "Employing institution", "University"]);
  if (employer) return employer.value.slice(0, 160);
  const heading = text.split("\n").slice(0, 15).map((line) => line.trim()).find((line) => line.length <= 100 && /^[\p{L} .&'-]*University(?: of [\p{L} .&'-]+)?$/iu.test(line));
  return heading ?? (/\bDibrugarh University\b/i.test(text) ? "Dibrugarh University" : null);
}

export function classifyProposal(input: string): NoteCategory {
  const text = clean(input);
  const subject = subjectOf(text);
  const signal = (subject ?? text.slice(0, 1800)).toLowerCase();
  const consultancy = new RegExp(library.rulebooks.consultancy.signalPattern, "i").test(text);
  if (/hir(?:e|ing)|appoint.*external/.test(signal) && /consultant/.test(signal)) return "procurement";
  if (consultancy && /refund/.test(signal)) return "service-refund";
  if (consultancy && (/consultanc|consulting|ducf|external client|industrial client|outside client/.test(signal) || !subject || /testing|calibration|analys|earning|distribut|special.*leave/.test(signal))) return "consultancy";
  const gpf = /\bg\.?p\.?f\.?\b|general provident fund/i.test(text);
  if (gpf && (!subject || /gpf|provident|advance|withdraw|retirement|settlement/.test(signal))) {
    const request = signal.replace(/\bnot\s+(?:a\s+)?(?:non[- ]?refundable\s+)?withdrawal/g, "").replace(/\bno previous advance/g, "");
    if (/final|on retirement|retired|quit.*service|leaving.*service/.test(request)) return "gpf-final";
    if (/withdraw|non[- ]?refundable/.test(request)) return "gpf-withdrawal";
    if (/advance/.test(request)) return "gpf-advance";
  }
  const topic = `${signal}\n${text.toLowerCase()}`;
  if (/refund|return.{0,25}(fee|payment)|reimburse/.test(topic)) {
    if (/hostel|boarding|residence hall/.test(signal)) return "hostel-refund";
    if (/analysis|analytical|laboratory|service|xrd/.test(signal)) return "service-refund";
    if (/duplicate|twice|double payment|excess/.test(signal)) return "fee-refund";
    if (/admission|withdrawal|withdraw.*seat/.test(signal)) return "admission-refund";
    if (/hostel/.test(topic)) return "hostel-refund";
    return "fee-refund";
  }
  if (/\bleave\b|regulari[sz].*absence/.test(signal)) return "leave";
  if (/procure|purchase|quotation|tender|buying/.test(signal)) return "procurement";
  return "general";
}

export function extractProposalFacts(input: NoteInput): ProposalFact[] {
  const sources = [{ id: input.proposal_id, text: clean(input.proposal_text) }, ...input.supporting_documents.map((doc) => ({ id: doc.id, text: clean(doc.text) }))];
  const facts: ProposalFact[] = [];
  function add(key: FactKey, value: string | undefined, evidence: string | undefined, source_id: string) {
    if (value && evidence && value.length <= 240 && !facts.some((fact) => fact.key === key)) facts.push({ key, value: value.trim(), evidence: evidence.trim().slice(0, 1200), source_id });
  }
  for (const source of sources) {
    const flow = source.text.replace(/\n/g, " ");
    const labels: [FactKey, string[]][] = [
      ["applicant", ["Applicant(?: name)?", "Name(?: of (?:the )?applicant)?", "Student name", "Employee name"]],
      ["department", ["Department", "Dept\\.?", "Course", "Programme", "Program", "Centre", "Center"]],
      ["reference", ["Case reference", "Reference", "Ref\\.?", "Student ID", "Employee ID", "Roll(?: no\\.?| number)?", "Registration(?: no\\.?| number)?", "GPF account"]],
      ["application_date", ["Application date", "Date"]],
      ["fund_balance", ["GPF balance", "Fund balance", "Balance in (?:my )?GPF(?: account)?"]],
      ["amount_requested", ["Advance requested", "Amount requested", "Refund requested", "Requested amount", "Amount claimed", "Amount of (?:advance|refund)"]],
      ["instalments", ["Repayment instalments", "Repayment installments", "Instalments", "Installments"]],
      ["monthly_pay", ["Monthly pay", "Monthly salary", "Basic pay"]],
      ["consultancy_earnings", ["Distributable consultancy earnings", "Distributable earnings"]],
      ["consultancy_days", ["Consultancy leave days requested", "Consultancy leave days"]],
      ["yearly_consultancy_days", ["Consultancy leave already taken this calendar year", "Consultancy leave already taken"]],
      ["annual_consultancy_fees", ["Total yearly consultancy fees", "Annual consultancy fees"]],
      ["annual_salary", ["Gross annual University salary", "Gross annual salary"]],
    ];
    for (const [key, names] of labels) {
      const match = labelled(source.text, names);
      if (!match) continue;
      const monetary = ["fund_balance", "amount_requested", "monthly_pay", "consultancy_earnings", "annual_consultancy_fees", "annual_salary"].includes(key);
      const tokens = moneyTokens(match.value);
      if (monetary) { if (tokens.length === 1) add(key, tokens[0][0], match.evidence, source.id); }
      else add(key, match.value, match.evidence, source.id);
    }
    const identity = flow.match(/\b(?:I,|[Mm]y name is|[Ii] am)\s+((?:Dr\.?\s+|Mr\.?\s+|Ms\.?\s+|Mrs\.?\s+)?[A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+){1,4})(?=\s*[,.;]|\s+(?:a|an|of|from)\b)/u);
    if (identity) add("applicant", identity[1], identity[0], source.id);
    const signed = source.text.match(/(?:Yours faithfully|Yours sincerely|Sincerely|Regards)[,\s]*\n[ \t]*([^\n]{2,100})/i);
    if (signed && !/signature|enclos|attachment|\d{4}/i.test(signed[1])) add("applicant", signed[1], signed[0], source.id);
    const reference = flow.match(/\b(?:registration (?:number|no\.?)|roll (?:number|no\.?)|employee id|student id|GPF account(?: number)?)[ \t]*(?:is|:)?[ \t]*((?=[A-Za-z0-9/-]*\d)[A-Za-z0-9][A-Za-z0-9/-]{2,60})/i);
    if (reference) add("reference", reference[1], reference[0], source.id);
    const department = source.text.match(/\b(?:Department|Dept\.?) of [\p{L}& -]+(?=[,.;\n]|$)/u);
    if (department) add("department", department[0], department[0], source.id);
    const requested = [...flow.matchAll(new RegExp(`\\b(?:request(?:ing|ed)?|seek(?:ing)?|claim(?:ing)?|refund|advance|withdrawal)[^.!?]{0,100}?(${moneyPattern})`, "gi"))];
    const requestedValues = [...new Set(requested.map((match) => moneyValue(match[1])))];
    if (requested.length && requestedValues.length === 1) add("amount_requested", requested[0][1], requested[0][0], source.id);
    const balance = flow.match(new RegExp(`(?:GPF|provident fund)(?: account)?[^.!?]{0,55}?(?:balance|credit|standing)[^.!?]{0,25}?(${moneyPattern})`, "i"));
    if (balance) add("fund_balance", balance[1], balance[0], source.id);
    const instalments = source.text.match(/\b(\d{1,2})\s+(?:equal\s+)?monthly instal(?:l)?ments\b/i);
    if (instalments) add("instalments", instalments[1], instalments[0], source.id);
  }
  if (!facts.some((fact) => fact.key === "amount_requested")) {
    const tokens = moneyTokens(sources[0].text);
    if (tokens.length && new Set(tokens.map((token) => moneyValue(token[0]))).size === 1 && !facts.some((fact) => fact.key === "fund_balance")) add("amount_mentioned", tokens[0][0], tokens[0][0], input.proposal_id);
  }
  return facts;
}

export function rulebookFor(rule: (typeof library.rules)[number]) {
  return "rulebook" in rule && rule.rulebook === "consultancy" ? library.rulebooks.consultancy : library.rulebooks.gpf;
}

export function rulesForProposal(category: NoteCategory, text: string, institution = institutionOf(text)) {
  return library.rules.filter((rule) => {
    const book = rulebookFor(rule);
    return rule.categories.includes(category) && new RegExp(book.signalPattern, "i").test(text)
      && (!institution || book.institution.toLowerCase() === institution.toLowerCase())
      && (!("requiresAny" in rule) || rule.requiresAny?.some((term) => text.toLowerCase().includes(term)));
  });
}

export function buildLocalNote(input: NoteInput): DraftNote {
  const text = clean(input.proposal_text);
  if (text.length < 20) throw new Error("Add the proposal's request and particulars before preparing a note.");
  if (text.length + input.supporting_documents.reduce((sum, doc) => sum + doc.text.length, 0) > NOTE_INPUT_LIMIT) throw new Error("The proposal and supporting text exceed the 200,000-character drafting limit.");
  const category = classifyProposal(text);
  const profile = library.profiles.find((profile) => profile.categories.includes(category))!;
  const facts = extractProposalFacts(input);
  const institution = institutionOf(text);
  const fact = (key: FactKey) => facts.find((entry) => entry.key === key)?.value;
  const titles: Record<NoteCategory, string> = { "fee-refund": "Refund of fee / excess payment", "admission-refund": "Admission withdrawal and refund request", "hostel-refund": "Refund of hostel fee", "service-refund": "Refund of service / analysis fee", "gpf-advance": "Request for a GPF advance", "gpf-withdrawal": "Request for withdrawal from GPF", "gpf-final": "Final payment of GPF accumulation", consultancy: "Consultancy proposal for examination", leave: "Leave request for examination", procurement: "Procurement proposal for examination", general: "Proposal for administrative examination" };
  const rawSubject = subjectOf(text) ?? (category === "general" && input.title && !/^(proposal|application|document|scan)[\s\d_-]*$/i.test(input.title) ? input.title : titles[category]);
  const subject = rawSubject.charAt(0).toUpperCase() + rawSubject.slice(1);
  const missing: string[] = [];
  if (!fact("applicant")) missing.push("Applicant's name / identification is not clearly stated.");
  if (!fact("application_date")) missing.push("Application date is not clearly stated.");
  if (category !== "general" && category !== "leave" && category !== "consultancy" && !fact("amount_requested") && !fact("amount_mentioned")) missing.push("The requested amount is not clearly stated.");
  const rules = rulesForProposal(category, text);
  if (!rules.length) missing.push("The applicable institutional policy and delegation of authority have not been supplied for this request.");
  if (rules.length && !institution) missing.push("Confirm that the supplied Dibrugarh University rules govern the applicant's institution.");
  const paragraphs = [`An application${fact("application_date") ? ` dated ${fact("application_date")}` : ""}${fact("applicant") ? ` from ${fact("applicant")}` : ""} has been received concerning ${subject.replace(/\.$/, "")}. The uploaded proposal${fact("reference") ? ` (reference / identification: ${fact("reference")})` : ""} may kindly be seen in the file.`];
  const flow = compact(text);
  const bodyStart = flow.search(/\b(?:I(?:,|\s)|We\s|Please\s|Kindly\s)/);
  const prose = bodyStart >= 0 ? flow.slice(bodyStart) : flow;
  const sentences = [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(prose)].map((segment) => segment.segment.trim()).filter((sentence) => sentence.length >= 25 && /request|refund|paid|payment|because|due to|seek|advance|withdraw|leave|purchase|consultanc|client/i.test(sentence));
  const statement = (sentences.length ? sentences.slice(0, 3).join(" … ") : prose).slice(0, 1600);
  paragraphs.push(`The applicant's stated request and circumstances are recorded in the following extract: “${statement}${statement.length === 1600 ? "…" : ""}”`);
  if (input.supporting_documents.length) paragraphs.push(`Supporting material supplied with this case: ${input.supporting_documents.map((doc) => doc.title).join("; ")}. Its contents and relevance should be checked with the proposal.`);
  paragraphs.push(profile.examination);
  const findings: DraftNote["findings"] = [];
  const requested = moneyValue(fact("amount_requested"));
  const balance = moneyValue(fact("fund_balance"));
  if (category === "gpf-advance" && rules.length) {
    if (balance !== undefined && requested !== undefined) {
      const limit = Math.floor(balance * 50) / 100;
      paragraphs.push(`The stated GPF balance is ${rupees(balance)}, giving a 50% ceiling of ${rupees(limit)} under Rule 12.1.2. The requested ${rupees(requested)} ${requested <= limit ? "is within that stated ceiling, subject to verification of the eligible account balance" : "exceeds that ceiling and cannot be recommended at this amount under the supplied rule"}.`);
      if (requested > limit) findings.push({ kind: "error", title: "GPF advance exceeds the supplied limit", detail: "Obtain a revised request within the verified 50% ceiling before an approval is recorded." });
    } else missing.push("The requested advance and verified subscription-and-interest balance are needed to check the 50% ceiling.");
    const count = Number(fact("instalments"));
    if (Number.isInteger(count) && count > 0) {
      if (count > 36) findings.push({ kind: "error", title: "Repayment period exceeds Rule 12.1.4", detail: "The principal schedule must not exceed 36 equal whole-rupee monthly instalments." });
      else if (requested !== undefined && requested % count === 0) paragraphs.push(`The stated ${count}-month principal schedule would require ${count} equal instalments of ${rupees(requested / count)} under Rule 12.1.4. The recovery schedule remains to be verified.`);
    }
    paragraphs.push("The service / subscriber particulars, permitted purpose, dependency where required and repayment of any previous advance should be verified under Rules 5 and 12.1.1–12.1.3. Recovery must follow Rules 12.1.4–12.1.6; no University interest rate is assumed in this draft.");
  } else if (category === "gpf-withdrawal" && rules.length) {
    paragraphs.push("Examine the service / retirement eligibility and permitted purpose under Rule 13.1.1. The permissible withdrawal must be checked against both three-fourths of the verified fund balance and twenty months' pay, taking the lower amount under Rule 13.2. A repayable advance's conditions must not be substituted for these withdrawal conditions.");
    const pay = moneyValue(fact("monthly_pay"));
    if (balance !== undefined && pay !== undefined) {
      const limit = Math.min(Math.floor(balance * 75) / 100, pay * 20);
      paragraphs.push(`On the stated balance and monthly pay, the lower limit under Rule 13.2 is ${rupees(limit)}. Verify both underlying figures before making a recommendation.`);
      if (requested !== undefined && requested > limit) findings.push({ kind: "error", title: "GPF withdrawal exceeds the supplied limit", detail: "Obtain a revised request within the verified limit under Rule 13.2." });
    } else missing.push("Verified GPF balance and monthly pay are required for the Rule 13.2 comparison.");
  }
  else if (category === "gpf-final" && rules.length) paragraphs.push("Verify the cessation / retirement particulars, final account balance and any applicable conditions before settling the amount payable under the supplied final-payment provisions.");
  if (rules.some((rule) => rulebookFor(rule).id === "consultancy")) {
    const relevant = (id: string) => rules.find((rule) => rule.id === `du-consultancy-${id}`);
    const applications = rules.flatMap((rule) => "application" in rule && rule.application ? [rule.application] : []);
    for (let index = 0; index < applications.length; index += 3) paragraphs.push(applications.slice(index, index + 3).join(" "));
    missing.push("Confirm the transaction-date tax provisions; the supplied consultancy PDF's service-tax wording does not establish a current tax rate.");
    if (category === "service-refund") missing.push("The consultancy rules establish collection and administration requirements but do not specify refund entitlement or a refund percentage; obtain the applicable contract / refund authority.");
    const earnings = moneyValue(fact("consultancy_earnings"));
    if (relevant("2-1-2") && earnings !== undefined) paragraphs.push(`On the explicitly stated distributable consultancy earnings of ${rupees(earnings)}, Rule 2.1.2 gives a consultants/staff group share of ${rupees(Math.round(earnings * 60) / 100)} and a University share of ${rupees(Math.round(earnings * 40) / 100)}. Within the group share, the 60:40 split corresponds to ${rupees(Math.round(earnings * 36) / 100)} for consultants and ${rupees(Math.round(earnings * 24) / 100)} for eligible staff. These are provisional allocations, subject to verification of the base, staff participation and report-submission condition; no tax or absent-staff reallocation is computed.`);
    if (relevant("2-7")) {
      const days = Number(fact("consultancy_days")), used = Number(fact("yearly_consultancy_days"));
      if (days > 5) findings.push({ kind: "error", title: "Consultancy leave exceeds the single-spell limit", detail: "Rule 2.7 does not permit more than 5 days at a time. Obtain a compliant request before sanction." });
      if (Number.isFinite(days) && Number.isFinite(used) && days + used > 20) findings.push({ kind: "error", title: "Consultancy leave exceeds the ordinary annual limit", detail: "The stated request and leave already taken exceed the ordinary 20-day calendar-year limit under Rule 2.7." });
    }
    const yearlyFees = moneyValue(fact("annual_consultancy_fees")), salary = moneyValue(fact("annual_salary"));
    if ((relevant("3-i") || relevant("3-iii")) && yearlyFees !== undefined && salary !== undefined && yearlyFees > salary) findings.push({ kind: "error", title: "Consultancy fees exceed the annual salary ceiling", detail: "Examine the yearly fee ceiling under Rule 3(i), also referenced by Rule 3(iii), before recommending acceptance." });
  }
  if (findings.length) paragraphs.push(`Points requiring resolution: ${findings.map((finding) => `${finding.title}. ${finding.detail}`).join(" ")}`);
  if (missing.length) paragraphs.push(`The following particulars / records require clarification before a final recommendation: ${missing.join(" ")}`);
  const authority = rules.length && (category === "gpf-advance" || category === "gpf-withdrawal") ? "Vice-Chancellor" : "competent authority";
  const recommendation = category === "consultancy" && rules.length ? "Subject to verification of the proposal and resolution of the points above, the file may be routed through the concerned DMC/BoM or Registrar for recommendation of the Chairperson, Advisory Committee, Consultancy Services, and the required University approval. Acceptance, leave or release of earnings should follow the applicable conditions." : `If the particulars are verified and the request is admissible under the applicable provisions, the file may be placed before the ${authority} for consideration and necessary orders. The amount, accounting treatment and any payment / implementation particulars should be confirmed before further action.`;
  paragraphs.push(recommendation);
  return { subject, category, institution, routing: profile.routing, facts, paragraphs, recommendation, applied_rules: rules.map((rule) => ({ id: rule.id, reason: "application" in rule && rule.application ? rule.application : `Relevant to the ${titles[category].toLowerCase()}; examine the stated particulars against this provision.` })), missing_information: missing, findings, engine: "local", style_sources: [{ path: library.formatSource, pages: profile.pages, title: profile.title }] };
}

export function applyDraftNote(item: CaseDefinition, state: CaseState, draft: DraftNote, now: string): { item: CaseDefinition; state: CaseState } {
  if (state.draftKind !== "proposal" || state.stage < 6 || state.movements.length) throw new Error("Review the extracted proposal text before preparing its note.");
  const profile = library.profiles.find((entry) => entry.categories.includes(draft.category));
  if (!profile || !draft.paragraphs.length) throw new Error("The drafted note has an unsupported structure.");
  const eligibleRules = rulesForProposal(draft.category, state.text, draft.institution);
  const rules: ReferenceDocument[] = draft.applied_rules.map((application) => {
    const source = eligibleRules.find((rule) => rule.id === application.id);
    if (!source) throw new Error("The draft cites a rule that is not supported for this proposal.");
    const book = rulebookFor(source), name = book.path.split("/").at(-1)!;
    return { id: source.id, title: source.title, type: "Supplied rule provision", source: book.title, date: book.issued, effectiveDate: book.effective, version: book.version, status: "Current", department: "Finance & Accounts", locator: `${name} · page ${source.page}`, content: [`Extract / summary from ${book.title}.`, source.excerpt], highlight: -1, file: { name, url: book.url, page: source.page }, application: application.reason };
  });
  const fact = (key: FactKey) => draft.facts.find((entry) => entry.key === key)?.value;
  const paragraphs = [...draft.paragraphs.filter((paragraph) => paragraph !== draft.recommendation), draft.recommendation];
  const cell = (text: string) => `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;
  const table = [["Sl. No.", "Applicant / Reference", "Department / Request", "Amount stated"], ["1", [fact("applicant") ?? "Applicant not clearly stated", fact("reference")].filter(Boolean).join("\n"), fact("department") ?? draft.subject, fact("amount_requested") ?? fact("consultancy_earnings") ?? fact("amount_mentioned") ?? "Not clearly stated"]];
  const sws = item.workspace === "sws-procurement" && draft.sections?.length === 4;
  const html = sws ? `<div data-note-number="1">Note #1</div>${draft.sections!.map((section, index) => `<h3>${escapeHtml(section.heading)}</h3><p data-para-number="${index + 1}">${escapeHtml(section.text)}</p>`).join("")}` : `<p><strong><u>${escapeHtml(draft.routing)}</u></strong></p><p><strong><u>${escapeHtml(draft.subject)}</u></strong></p><table><tbody>${table.map((row, index) => `<tr>${row.map((value) => `<${index ? "td" : "th"}>${cell(value)}</${index ? "td" : "th"}>`).join("")}</tr>`).join("")}</tbody></table>${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("")}<p>${escapeHtml(library.closing)}</p>`;
  const text = sws ? ["Note #1", ...draft.sections!.flatMap((section, index) => [section.heading, `${index + 1}. ${section.text}`])].join("\n\n") : [draft.routing, draft.subject, table.map((row) => row.join(" | ")).join("\n"), ...paragraphs, library.closing].join("\n\n");
  const terminal = rules.some((rule) => rule.id === "du-gpf-12-1" || rule.id === "du-gpf-13-1") ? "Vice-Chancellor" : item.terminal;
  const findings: Finding[] = [...draft.findings, ...draft.missing_information.map((detail) => ({ kind: "warning" as const, title: "Particulars / policy to confirm", detail }))];
  const definition: CaseDefinition = { ...item, caseTemplateId: NOTE_TEMPLATE_ID, institution: draft.institution ?? item.institution, subject: draft.subject, category: draft.category, applicant: fact("applicant") ?? "", section: "Finance & Accounts", documents: [item.documents[0], ...rules], facts: draft.facts.map((entry) => ({ label: factLabels[entry.key], value: entry.value })), note: [{ heading: "Proposal particulars", text: draft.facts.map((entry) => `${factLabels[entry.key]}: ${entry.value}`).join("\n") }, ...paragraphs.map((paragraph, index) => ({ heading: `Paragraph ${index + 1}`, text: paragraph }))], explanation: paragraphs, recommendation: draft.recommendation, findings, terminal, calculation: undefined };
  if (sws) { definition.section = "Student Welfare Section"; definition.note = draft.sections!; }
  return { item: definition, state: { ...state, html, text, status: "Generated note", draftKind: "note", terminal, level: 0, checks: [], savedAt: now, proposalDraft: { html: state.html, text: state.text, savedAt: state.savedAt }, appliedRuleIds: rules.map((rule) => rule.id), generation: { engine: draft.engine, styleSources: draft.style_sources, missingInformation: draft.missing_information }, versions: [...state.versions, { id: state.versions.length + 1, label: "Proposal text used for noting", html: state.html, text: state.text, author: "Dealing Assistant", date: now }, { id: state.versions.length + 2, label: "Note from uploaded proposal", html, text, author: draft.engine === "ai" ? "AI drafting" : "Local drafting", date: now }] } };
}

export function noteInput(item: CaseDefinition, state: CaseState): NoteInput {
  return { title: item.subject.slice(0, 240), proposal_text: state.text, proposal_id: item.documents[0].id, supporting_documents: state.extraDocuments.map((doc) => ({ id: doc.id, title: doc.title, text: doc.content.join("\n\n") })), drafting_style: item.workspace === "sws-procurement" ? "sws-procurement" : "standard", word_limit: state.notingLayout?.wordLimit ?? 300 };
}

export function factIsGrounded(fact: ProposalFact, input: NoteInput) {
  const source = fact.source_id === input.proposal_id ? input.proposal_text : input.supporting_documents.find((doc) => doc.id === fact.source_id)?.text;
  return !!source && compact(source).includes(compact(fact.evidence)) && compact(fact.evidence).includes(compact(fact.value));
}
