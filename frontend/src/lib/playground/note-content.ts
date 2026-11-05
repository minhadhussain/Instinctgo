import library from "../../../../samples/noting-library.json";

function isBoilerplate(text: string) {
  const normalized = text.trim().replace(/^\d+[.)]\s*/, "").replace(/\s+/g, " ").toLowerCase();
  return library.notePresentation.omitPrefixes.some((prefix) => normalized.startsWith(prefix.toLowerCase()));
}

/** Clean generated prose; original documents and reviewed proposal text are not passed here. */
export function cleanNoteParagraphs(paragraphs: string[]): string[] {
  const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  return paragraphs.flatMap((text) => text.split(/\n\s*\n/)).filter((text) => !isBoilerplate(text)).map((text) => [...segmenter.segment(text)].filter(({ segment }) => !isBoilerplate(segment)).map(({ segment }) => segment).join("").trim()).filter(Boolean);
}
