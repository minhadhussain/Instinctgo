import { apiUrl } from "../api";
import { buildLocalNote, factIsGrounded, type DraftNote, type NoteInput } from "./note-draft";

async function request(path: string, init: RequestInit, signal: AbortSignal, timeout: number) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.throwIfAborted();
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeout);
  try {
    const response = await fetch(apiUrl(path), { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`Note service returned ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
}

export async function requestNoteDraft(input: NoteInput, signal: AbortSignal): Promise<DraftNote> {
  signal.throwIfAborted();
  const local = buildLocalNote(input);
  try {
    const capabilities = await request("noting/capabilities", {}, signal, 2500);
    signal.throwIfAborted();
    if (capabilities.ai_available !== true) return local;
    const draft: DraftNote = await request("noting/draft", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    }, signal, 70000);
    signal.throwIfAborted();
    if (draft.engine !== "ai" || typeof draft.subject !== "string" || typeof draft.routing !== "string"
      || typeof draft.recommendation !== "string" || !Array.isArray(draft.paragraphs) || draft.paragraphs.length < 3
      || !draft.paragraphs.every((paragraph) => typeof paragraph === "string")
      || !Array.isArray(draft.facts) || !draft.facts.every((fact) => factIsGrounded(fact, input))
      || !Array.isArray(draft.applied_rules) || !Array.isArray(draft.missing_information)
      || !Array.isArray(draft.findings) || !Array.isArray(draft.style_sources)) throw new Error("Invalid note response");
    return draft;
  } catch (error) {
    if (signal.aborted) throw error;
    // The local output is explicitly labelled; it is not presented as an AI response.
    return local;
  }
}
