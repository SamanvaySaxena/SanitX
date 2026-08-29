/* =========================================================================
   The reduced-motion guard — FRONTEND_DESIGN.md §7.2
   -------------------------------------------------------------------------
   "Under reduced motion, ScrollTrigger instances are not created at all —
   not created-then-disabled — so the pinning cost is never paid."

   Every scene calls prefersReducedMotion() BEFORE building a timeline and
   returns early. The CSS block in globals.css is the second line of defence,
   not the first; a disabled-after-creation ScrollTrigger still measures, still
   pins, and still costs.
   ========================================================================= */

const QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    // SSR and any environment without matchMedia: assume reduced. The static
    // composition is authored to carry the full argument (§7.2), so defaulting
    // to "no motion" degrades nothing and never ships a half-built timeline.
    return true;
  }
  return window.matchMedia(QUERY).matches;
}

/** Subscribe to changes so a scene can tear its timeline down mid-session. */
export function onReducedMotionChange(
  handler: (reduced: boolean) => void,
): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia(QUERY);
  const listener = (e: MediaQueryListEvent) => handler(e.matches);
  mq.addEventListener("change", listener);
  return () => mq.removeEventListener("change", listener);
}

/* §8 — will-change is applied on scene ENTRY and removed on EXIT. A permanent
   will-change on six pinned scenes is its own performance bug. */
export function applyWillChange(el: Element | null): void {
  if (el instanceof HTMLElement) el.style.willChange = "transform, opacity";
}

export function clearWillChange(el: Element | null): void {
  if (el instanceof HTMLElement) el.style.willChange = "";
}
