import type Lenis from "lenis";

/** Nested dialogs and the expanded workspace can hold the page lock together. */
export function resumePageScroll(lenis: Lenis | undefined) {
  if (!lenis || document.querySelector("dialog[open]")) return;
  if (["hidden", "clip"].includes(getComputedStyle(document.body).overflowY)) return;
  lenis.start();
}
