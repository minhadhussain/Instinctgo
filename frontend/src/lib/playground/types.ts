export type Role = "Dealing Assistant" | "Section Officer" | "Assistant Registrar" | "Deputy Registrar" | "Registrar" | "Assistant Controller" | "Deputy Controller" | "Controller" | "Vice-Chancellor";
export type Branch = "Administrative" | "Examination" | "PNC";
export type SourceStatus = "Current" | "Historical" | "Superseded" | "Under review" | "Unverified";
export type CaseStatus = "Received" | "AI-generated draft" | "Extracted draft" | "Generated note" | "Human-edited draft" | "In review" | "Returned" | "Demo approved" | "Demo rejected" | "Closed";
export type View = "Overview" | "Noting Studio" | "AI Assistant" | "Case Explorer" | "Reference Library" | "Workflow" | "Administration";
export type WorkspaceKind = "general" | "sws-procurement";
export interface NotingLayout {
  paper: "legal" | "a3";
  margins: { top: number; right: number; bottom: number; left: number };
  paperColor: "white" | "green";
  wordLimit: number;
}

export interface ReferenceDocument {
  id: string;
  title: string;
  type: string;
  source: string;
  date: string;
  effectiveDate: string;
  version: string;
  status: SourceStatus;
  department: string;
  locator: string;
  content: string[];
  highlight: number;
  original?: { name: string; url: string; mime: string; size: number };
  extraction?: { method: string; pages: number; ocrPages: number };
  file?: { name: string; url: string; page?: number };
  application?: string;
}

export interface NoteSection { heading: string; text: string; referenceIds?: string[] }
export interface Finding { kind: "pass" | "warning" | "error"; title: string; detail: string; referenceId?: string }
export interface CaseDefinition {
  id: string;
  subject: string;
  category: string;
  branch: Branch;
  section: string;
  date: string;
  session: string;
  applicant: string;
  assistant: string;
  officer: string;
  description: string;
  facts: { label: string; value: string; uncertain?: boolean }[];
  documents: ReferenceDocument[];
  note: NoteSection[];
  explanation: string[];
  findings: Finding[];
  recommendation: string;
  terminal: Role;
  tools: string[];
  calculation?: { expression: string; amount: number; expected: number };
  historical?: { status: "Closed" | "Demo rejected" | "Returned"; disposition: string };
  imported?: boolean;
  institution?: string;
  caseTemplateId?: string;
  workspace?: WorkspaceKind;
}

export interface NoteVersion { id: number; label: string; html: string; text: string; date: string; author: Role | "Simulated AI" | "Browser extraction" | "Case template" | "Local drafting" | "AI drafting" }
export interface Movement { id: number; officer: Role; date: string; action: string; remarks: string; previous: CaseStatus; next: CaseStatus; from: Role; to: Role; version: number }
export interface CaseComment { id: number; author: Role; date: string; text: string }
export interface CaseState {
  stage: number;
  status: CaseStatus;
  level: number;
  html: string;
  text: string;
  versions: NoteVersion[];
  movements: Movement[];
  comments: CaseComment[];
  checks: string[];
  extraDocuments: ReferenceDocument[];
  correction: string;
  disposition: string;
  terminal: Role;
  savedAt: string;
  signature?: { name: string; role: Role; date: string };
  draftKind?: "proposal" | "note";
  proposalDraft?: { html: string; text: string; savedAt: string };
  appliedRuleIds?: string[];
  generation?: { engine: "local" | "ai"; styleSources: { path: string; pages: number[]; title: string }[]; missingInformation: string[] };
  notingLayout?: NotingLayout;
}

export type WorkflowAction = "submit" | "forward" | "return" | "approve" | "reject" | "close";
export interface AssistantResponse { text: string; citations: string[]; caseIds?: string[]; draft?: string }
export interface AssistantRequest { question: string; mode: "research" | "draft"; current: CaseDefinition; state: CaseState; cases: CaseDefinition[]; states: Record<string, CaseState>; references?: ReferenceDocument[]; contextId?: string }
export interface AIAdapter { mode: "local-demo"; respond: (request: AssistantRequest) => AssistantResponse }
