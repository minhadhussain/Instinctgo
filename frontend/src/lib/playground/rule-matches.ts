import type { CaseDefinition, ReferenceDocument } from "./types";

export interface RuleMatch { from: number; to: number; sourceId: string; title: string; locator: string; paragraph: number }
export interface RulePhrase { text: string; sourceId: string; title: string; locator: string; paragraph: number }

export function isRuleDocument(document: ReferenceDocument) {
  return /rule|regulation|manual|procedure|protocol|guideline|statute|memorandum/i.test(`${document.type} ${document.title}`);
}

export function rulePhrases(item: CaseDefinition, documents: ReferenceDocument[]): RulePhrase[] {
  return documents.filter((doc) => doc.status === "Current" && isRuleDocument(doc)).flatMap((doc) => {
    const phrase = (text: string, paragraph: number) => ({ text, sourceId: doc.id, title: doc.title, locator: doc.locator, paragraph });
    // Supplied citation mappings cover paraphrased sample notes. New text must
    // match an actual clause; keyword similarity never creates a rule citation.
    const mapped = item.note.filter((section) => section.referenceIds?.includes(doc.id) && section.text.length >= 30).map((section) => phrase(section.text, doc.highlight));
    const clauses = doc.content.flatMap((text, index) => index === 0 ? [] : [text, ...(text.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [])].map((value) => phrase(value.trim(), index))).filter((value) => value.text.length >= 40);
    return [...mapped, ...clauses];
  });
}

export function findRuleMatches(text: string, phrases: RulePhrase[]): RuleMatch[] {
  const found: RuleMatch[] = [];
  for (const phrase of phrases) {
    const pattern = phrase.text.split(/\s+/).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
    for (const match of text.matchAll(new RegExp(pattern, "gi"))) found.push({ from: match.index, to: match.index + match[0].length, sourceId: phrase.sourceId, title: phrase.title, locator: phrase.locator, paragraph: phrase.paragraph });
  }
  const matches: RuleMatch[] = [];
  for (const match of found.sort((a, b) => a.from - b.from || (b.to - b.from) - (a.to - a.from))) {
    if (!matches.length || matches[matches.length - 1].to <= match.from) matches.push(match);
  }
  return matches;
}
