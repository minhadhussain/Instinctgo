import type { NotingLayout } from "./types";

export const swsHeadings = ["Issue / Proposal Summary", "Financial Implication & Budget Head", "Rule Justification (GFR / Assam Procurement)", "Recommendation / Seeking Approval"] as const;
export const procurementRuleGroups = [
  { id: "gfr-university", title: "GFR & University Procurement Rules", detail: "General Financial Rules and the University's adopted procurement guidelines / amendments." },
  { id: "assam", title: "Assam Procurement Rules", detail: "Assam Public Procurement Rules and applicable State guidelines." },
] as const;
export const paperSizes = { legal: { label: "Legal · 8.5 × 14 in", width: 215.9, height: 355.6 }, a3: { label: "A3 · 297 × 420 mm", width: 297, height: 420 } };
export const defaultNotingLayout = (): NotingLayout => ({ paper: "legal", margins: { top: 20, right: 20, bottom: 20, left: 35 }, paperColor: "white", wordLimit: 300 });
export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export function layoutError(layout: NotingLayout): string | undefined {
  if (!paperSizes[layout.paper]) return "Choose Legal or A3 paper.";
  if (Object.values(layout.margins).some((value) => !Number.isFinite(value) || value < 10 || value > 80)) return "Set each margin between 10 and 80 mm.";
  const paper = paperSizes[layout.paper];
  if (paper.width - layout.margins.left - layout.margins.right < 100 || paper.height - layout.margins.top - layout.margins.bottom < 150) return "Leave at least 100 mm of writing width and 150 mm of page height.";
  if (!Number.isInteger(layout.wordLimit) || layout.wordLimit < 100 || layout.wordLimit > 1000) return "Choose a word target between 100 and 1,000.";
}

export const swsSample = { title: "SWS procurement proposal", proposalUrl: "/samples/sws-procurement-proposal.txt", proposalName: "sws-procurement-proposal.txt" };
