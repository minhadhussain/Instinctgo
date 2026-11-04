"use client";

import { useEffect, type ReactNode } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import type { LenisOptions } from "lenis";
import { resumePageScroll } from "@/lib/smooth-scroll";

const options: LenisOptions = {
  autoRaf: true,
  lerp: 0.1,
  smoothWheel: true,
  syncTouch: false,
  respectReducedMotion: true,
  stopInertiaOnNavigate: true,
  // Scrollable document panels opt out with data-lenis-prevent.
  prevent: (node) => node.matches("textarea, select, [contenteditable='true']"),
};

function ScrollBehavior() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;

    function onAnchor(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || lenis!.isStopped) return;
      const link = event.composedPath().find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement);
      if (!link?.getAttribute("href") || link.hasAttribute("download") || (link.target && link.target !== "_self") || link.hasAttribute("data-lenis-ignore")) return;
      const url = new URL(link.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || !url.hash) return;
      let id: string;
      try { id = decodeURIComponent(url.hash.slice(1)); } catch { return; }
      const target = document.getElementById(id);
      if (!target) return;

      event.preventDefault();
      // Preserve Next's history state, deep links and the browser Back button.
      if (location.hash !== url.hash) history.pushState(history.state, "", url.hash);
      lenis!.scrollTo(target, {
        duration: 1,
        onComplete: () => {
          const temporaryFocus = !target.hasAttribute("tabindex");
          if (temporaryFocus) target.setAttribute("tabindex", "-1");
          target.focus({ preventScroll: true });
          if (temporaryFocus) target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
        },
      });
    }

    function resetMomentum() {
      lenis!.stop();
      resumePageScroll(lenis);
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    function onMotionChange() { if (reducedMotion.matches) resetMomentum(); }

    // Run after React handlers so citations and other handled links stay local.
    window.addEventListener("click", onAnchor);
    window.addEventListener("popstate", resetMomentum);
    window.addEventListener("hashchange", resetMomentum);
    reducedMotion.addEventListener("change", onMotionChange);
    if (document.querySelector("dialog[open]") || ["hidden", "clip"].includes(getComputedStyle(document.body).overflowY)) lenis.stop();

    return () => {
      window.removeEventListener("click", onAnchor);
      window.removeEventListener("popstate", resetMomentum);
      window.removeEventListener("hashchange", resetMomentum);
      reducedMotion.removeEventListener("change", onMotionChange);
    };
  }, [lenis]);

  return null;
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  return <ReactLenis root options={options}><ScrollBehavior />{children}</ReactLenis>;
}
