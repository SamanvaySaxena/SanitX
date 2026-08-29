/**
 * §7.2 — "Under reduced motion, ScrollTrigger instances are not created at
 * all — not created-then-disabled — so the pinning cost is never paid."
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyWillChange,
  clearWillChange,
  onReducedMotionChange,
  prefersReducedMotion,
} from "@/lib/motion/reduced-motion";
import { createPinnedScene, lerp, subProgress } from "@/lib/motion/timeline";

function mockMatchMedia(matches: boolean) {
  const listeners: ((e: MediaQueryListEvent) => void)[] = [];
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) =>
      listeners.push(fn),
    removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => {
      const i = listeners.indexOf(fn);
      if (i > -1) listeners.splice(i, 1);
    },
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  return listeners;
}

afterEach(() => vi.restoreAllMocks());

describe("the reduced-motion guard", () => {
  it("reports the media query state", () => {
    mockMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    mockMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("fails closed when matchMedia is unavailable", () => {
    const original = window.matchMedia;
    // @ts-expect-error deliberately removing the API
    delete window.matchMedia;
    expect(prefersReducedMotion()).toBe(true);
    window.matchMedia = original;
  });

  it("notifies subscribers and unsubscribes cleanly", () => {
    const listeners = mockMatchMedia(false);
    const handler = vi.fn();
    const off = onReducedMotionChange(handler);
    expect(listeners).toHaveLength(1);
    listeners[0]({ matches: true } as MediaQueryListEvent);
    expect(handler).toHaveBeenCalledWith(true);
    off();
    expect(listeners).toHaveLength(0);
  });

  // The load-bearing assertion: GSAP is never even imported.
  it("creates no ScrollTrigger instance under reduced motion", async () => {
    mockMatchMedia(true);
    const build = vi.fn();
    const teardown = await createPinnedScene({
      pinTarget: document.createElement("div"),
      end: "+=600%",
      build,
    });
    expect(build).not.toHaveBeenCalled();
    expect(teardown).toBeTypeOf("function");
    expect(() => teardown()).not.toThrow();
  });
});

describe("will-change hygiene (§8)", () => {
  it("applies on entry and removes on exit, never permanently", () => {
    const el = document.createElement("div");
    applyWillChange(el);
    expect(el.style.willChange).toBe("transform, opacity");
    clearWillChange(el);
    expect(el.style.willChange).toBe("");
  });

  it("tolerates a null ref without throwing", () => {
    expect(() => applyWillChange(null)).not.toThrow();
    expect(() => clearWillChange(null)).not.toThrow();
  });
});

describe("scrub maths", () => {
  // §5.4 — scrubbing backwards must make the metrics climb again, which is
  // how a visitor verifies the numbers are computed rather than canned.
  it("is reversible and clamped", () => {
    expect(lerp(1, 0.62, 0)).toBeCloseTo(1);
    expect(lerp(1, 0.62, 1)).toBeCloseTo(0.62);
    expect(lerp(1, 0.62, 0.5)).toBeCloseTo(0.81);
    expect(lerp(1, 0.62, -5)).toBeCloseTo(1);
    expect(lerp(1, 0.62, 5)).toBeCloseTo(0.62);
  });

  it("maps a sub-range of an overall timeline", () => {
    expect(subProgress(0.5, 0.25, 0.75)).toBeCloseTo(0.5);
    expect(subProgress(0.1, 0.25, 0.75)).toBe(0);
    expect(subProgress(0.9, 0.25, 0.75)).toBe(1);
    expect(subProgress(0.5, 0.5, 0.5)).toBe(1);
  });
});
