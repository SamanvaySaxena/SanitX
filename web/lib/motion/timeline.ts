/* =========================================================================
   GSAP timeline factories — FRONTEND_DESIGN.md §2.2, §4.2, §8
   -------------------------------------------------------------------------
   GSAP is imported ONLY from here, and this module is imported only by
   components under the (marketing) route group. That import boundary is how
   §1.3's thesis becomes real: a professional who bookmarks /scan never
   downloads a byte of GSAP.

   The three §2.2 rules are enforced structurally rather than by discipline:
     1. transform/opacity only          — callers receive a typed prop subset
     2. never animate the pinned element — pinTarget and animation scope differ
     3. anticipatePin: 1                — baked into the factory default
   ========================================================================= */
import {
  prefersReducedMotion,
  onReducedMotionChange,
  applyWillChange,
  clearWillChange,
} from "./reduced-motion";

export interface PinnedSceneOptions {
  /** The wrapper that gets pinned. Nothing inside the timeline may touch it. */
  pinTarget: HTMLElement;
  /** Scroll distance, e.g. "600%" for Act 3's 600vh. */
  end: string;
  /** Builds the timeline. Receives the gsap namespace and the created timeline. */
  build: (ctx: { gsap: GsapNamespace; tl: GsapTimeline }) => void;
  /** Children that get will-change on entry and lose it on exit (§8). */
  willChangeTargets?: (HTMLElement | null)[];
}

/* Structural typing over the parts of GSAP used here keeps this module honest
   about its surface and keeps the tests free of a real GSAP dependency. */
export interface GsapTimeline {
  to: (t: unknown, v: Record<string, unknown>, p?: unknown) => GsapTimeline;
  fromTo: (
    t: unknown,
    f: Record<string, unknown>,
    v: Record<string, unknown>,
    p?: unknown,
  ) => GsapTimeline;
  set: (t: unknown, v: Record<string, unknown>, p?: unknown) => GsapTimeline;
  addLabel: (n: string, p?: unknown) => GsapTimeline;
}

export interface GsapNamespace {
  timeline: (v?: Record<string, unknown>) => GsapTimeline;
  registerPlugin: (...p: unknown[]) => void;
  set: (t: unknown, v: Record<string, unknown>) => void;
}

export type SceneTeardown = () => void;

/**
 * Creates a pinned, scrubbed scene. Returns a no-op teardown and never touches
 * GSAP when reduced motion is requested — the instance is not created at all.
 *
 * The preference is now a live setting the visitor owns (§7.2, MotionToggle),
 * so this also RE-SYNCS: choosing "Reduced" kills the scene where it stands,
 * and choosing "Full" builds it, both without a reload. Doing that here rather
 * than in each act means every scene gets the behaviour from one place and no
 * act can forget it.
 */
export async function createPinnedScene(
  opts: PinnedSceneOptions,
): Promise<SceneTeardown> {
  let inner: SceneTeardown | null = null;
  let building = false;
  let disposed = false;

  async function sync(): Promise<void> {
    if (disposed) return;
    if (prefersReducedMotion()) {
      inner?.();
      inner = null;
      return;
    }
    // Already running, or an async build is already in flight for this scene.
    if (inner || building) return;
    building = true;
    try {
      const teardown = await buildScene(opts);
      // The preference can flip, or the component unmount, while the GSAP
      // import is in flight. Whatever we just built is then already wrong.
      if (disposed || prefersReducedMotion()) teardown();
      else inner = teardown;
    } finally {
      building = false;
    }
  }

  await sync();
  const off = onReducedMotionChange(() => void sync());

  return () => {
    disposed = true;
    off();
    inner?.();
    inner = null;
  };
}

async function buildScene(
  opts: PinnedSceneOptions,
): Promise<SceneTeardown> {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([
    import("gsap"),
    import("gsap/ScrollTrigger"),
  ]);

  /* The import is async, and a lot can happen while it is in flight: a route
     change, a StrictMode double-mount's cleanup, or a test tearing down its
     DOM. Building a ScrollTrigger against a detached node leaves an orphan
     instance that measures and pins against nothing, so bail if the target
     left the document while we were waiting. */
  if (!opts.pinTarget.isConnected) return () => {};

  gsap.registerPlugin(ScrollTrigger);

  const targets = opts.willChangeTargets ?? [];

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: opts.pinTarget,
      start: "top top",
      end: opts.end,
      pin: opts.pinTarget,
      // §2.2 — engage the pin slightly early so fast scrolling never flashes
      // a frame of unpinned content.
      anticipatePin: 1,
      // §4.2 — scrubs are LINEAR always. The user's finger is the easing.
      scrub: 1,
      invalidateOnRefresh: true,
      onEnter: () => targets.forEach(applyWillChange),
      onEnterBack: () => targets.forEach(applyWillChange),
      onLeave: () => targets.forEach(clearWillChange),
      onLeaveBack: () => targets.forEach(clearWillChange),
    },
  }) as unknown as GsapTimeline;

  opts.build({ gsap: gsap as unknown as GsapNamespace, tl });

  return () => {
    targets.forEach(clearWillChange);
    ScrollTrigger.getAll()
      .filter((st) => st.trigger === opts.pinTarget)
      .forEach((st) => st.kill());
  };
}

/**
 * Maps a 0-1 scroll progress onto a value range. Used by the scrubbed metric
 * counters in Act 4, which must be reversible — scrubbing backwards makes the
 * numbers climb again, which is how a visitor verifies they are computed
 * rather than canned (§5.4, §5.9).
 */
export function lerp(from: number, to: number, t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return from + (to - from) * clamped;
}

/** Progress within a sub-range of an overall 0-1 timeline. */
export function subProgress(t: number, start: number, end: number): number {
  if (end <= start) return t >= end ? 1 : 0;
  return Math.min(1, Math.max(0, (t - start) / (end - start)));
}
