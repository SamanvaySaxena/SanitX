/* =========================================================================
   The reduced-motion guard — FRONTEND_DESIGN.md §7.2
   -------------------------------------------------------------------------
   "Under reduced motion, ScrollTrigger instances are not created at all —
   not created-then-disabled — so the pinning cost is never paid."

   Every scene calls prefersReducedMotion() BEFORE building a timeline and
   returns early. The CSS block in globals.css is the second line of defence,
   not the first; a disabled-after-creation ScrollTrigger still measures, still
   pins, and still costs.

   ---------------------------------------------------------------------------
   THREE STATES, AND WHY.
   Windows' "Animation effects: off" sets prefers-reduced-motion:reduce for the
   whole OS, so a visitor who merely turned off taskbar animations loses every
   scrolled scene on the site. Deleting the guard (commit 65fc1a3) fixed that
   by removing the §7.2 guarantee entirely, which §7.2 calls a blocking defect.
   Hardcoding an override on <html> had the same effect for everyone else.

   So the preference is a real, three-state, user-owned setting:

       system   (attribute absent)    — honour the OS. THE DEFAULT.
       full     data-motion="full"    — the visitor asked for motion anyway.
       reduced  data-motion="reduced" — the visitor asked for less, OS aside.

   Only an explicit act by the visitor writes "full", which is the whole point:
   someone who asked their OS for less motion has not asked us for more. The
   control lives in components/primitives/MotionToggle.tsx; the attribute is
   stamped before first paint by the inline script in app/layout.tsx so no
   scene ever builds against the wrong preference.
   ========================================================================= */

const QUERY = "(prefers-reduced-motion: reduce)";

/** The localStorage key the toggle and the pre-paint script both use. */
export const MOTION_STORAGE_KEY = "sanitx.motion";

/** Fired on `window` whenever the preference changes within the session, so
    scenes can tear a timeline down (or build one) without a reload. */
export const MOTION_CHANGE_EVENT = "sanitx:motionchange";

export type MotionPreference = "system" | "full" | "reduced";

function isPreference(v: unknown): v is MotionPreference {
  return v === "system" || v === "full" || v === "reduced";
}

/** The visitor's stated preference. Absent attribute means "system". */
export function readMotionPreference(): MotionPreference {
  if (typeof document === "undefined") return "system";
  const v = document.documentElement.dataset.motion;
  return isPreference(v) ? v : "system";
}

/**
 * Records the preference: the attribute (which CSS and the guard both read),
 * localStorage (so it survives a reload), and an event (so live scenes react).
 * Storage is best-effort — a blocked localStorage must not cost the visitor
 * the setting for the current page.
 */
export function setMotionPreference(pref: MotionPreference): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (pref === "system") delete root.dataset.motion;
  else root.dataset.motion = pref;

  try {
    if (pref === "system") window.localStorage.removeItem(MOTION_STORAGE_KEY);
    else window.localStorage.setItem(MOTION_STORAGE_KEY, pref);
  } catch {
    /* Private mode, or storage disabled. The attribute still applies. */
  }

  window.dispatchEvent(new Event(MOTION_CHANGE_EVENT));
}

export function prefersReducedMotion(): boolean {
  const pref = readMotionPreference();
  if (pref === "full") return false;
  if (pref === "reduced") return true;
  // Fail closed: no matchMedia means we cannot know, and the safe unknown for
  // a vestibular trigger is "assume they asked for less".
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true;
  }
  return window.matchMedia(QUERY).matches;
}

/** Subscribe to changes so a scene can tear its timeline down mid-session.
    Fires for both sources of truth: the OS query and the visitor's own
    toggle. The handler always receives the RESOLVED answer, so a caller never
    has to combine the two itself. */
export function onReducedMotionChange(
  handler: (reduced: boolean) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const offs: (() => void)[] = [];
  const notify = () => handler(prefersReducedMotion());

  if (typeof window.matchMedia === "function") {
    const mq = window.matchMedia(QUERY);
    mq.addEventListener("change", notify);
    offs.push(() => mq.removeEventListener("change", notify));
  }

  window.addEventListener(MOTION_CHANGE_EVENT, notify);
  offs.push(() => window.removeEventListener(MOTION_CHANGE_EVENT, notify));

  return () => offs.forEach((off) => off());
}

/* §8 — will-change is applied on scene ENTRY and removed on EXIT. A permanent
   will-change on six pinned scenes is its own performance bug. */
export function applyWillChange(el: Element | null): void {
  if (el instanceof HTMLElement) el.style.willChange = "transform, opacity";
}

export function clearWillChange(el: Element | null): void {
  if (el instanceof HTMLElement) el.style.willChange = "";
}
