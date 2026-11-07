import library from "../../../../samples/noting-library.json";

const normalize = (text: string) => text.normalize("NFKC").trim().replace(/^\d+[.)]\s*/, "").replace(/\s+/g, " ").toLowerCase();
const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
const referenceOnly = library.notePresentation.referenceOnlyCategories;
const referenceGuidance = new Set([
  ...library.profiles.filter((profile) => profile.categories.some((category) => referenceOnly.includes(category))).map((profile) => profile.examination),
  ...library.rules.filter((rule) => rule.categories.some((category) => referenceOnly.includes(category))).flatMap((rule) => "application" in rule && rule.application ? [rule.application] : []),
].flatMap((text) => [normalize(text), ...[...segmenter.segment(text)].map(({ segment }) => normalize(segment))]));

function isBoilerplate(text: string) {
  const normalized = normalize(text);
  return referenceGuidance.has(normalized) || library.notePresentation.omitPrefixes.some((prefix) => normalized.startsWith(prefix.toLowerCase()));
}

/** Clean generated prose; original documents and reviewed proposal text are not passed here. */
export function cleanNoteParagraphs(paragraphs: string[]): string[] {
  return paragraphs.flatMap((text) => text.split(/\n\s*\n/)).filter((text) => !isBoilerplate(text)).map((text) => [...segmenter.segment(text)].filter(({ segment }) => !isBoilerplate(segment)).map(({ segment }) => segment).join("").trim()).filter(Boolean);
}
