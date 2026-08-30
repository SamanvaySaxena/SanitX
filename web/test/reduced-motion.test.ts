/**
 * §7.2 — "Under reduced motion, ScrollTrigger instances are not created at
 * all — not created-then-disabled — so the pinning cost is never paid."
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MOTION_STORAGE_KEY,
  applyWillChange,
  clearWillChange,
  onReducedMotionChange,
  prefersReducedMotion,
  readMotionPreference,
  setMotionPreference,
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

beforeEach(() => {
  delete document.documentElement.dataset.motion;
  window.localStorage.clear();
});

afterEach(() => {
  delete document.documentElement.dataset.motion;
  vi.restoreAllMocks();
});

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

  it("notifies subscribers with the RESOLVED answer, and unsubscribes cleanly", () => {
    // The subscriber must not have to combine the OS query with the visitor's
    // own setting itself; it gets the one answer that decides whether a
    // ScrollTrigger may exist.
    const listeners = mockMatchMedia(true);
    const handler = vi.fn();
    const off = onReducedMotionChange(handler);
    expect(listeners).toHaveLength(1);

    listeners[0]({ matches: true } as MediaQueryListEvent);
    expect(handler).toHaveBeenLastCalledWith(true);

    // Same OS event, but the visitor has since asked for motion anyway.
    document.documentElement.dataset.motion = "full";
    listeners[0]({ matches: true } as MediaQueryListEvent);
    expect(handler).toHaveBeenLastCalledWith(false);

    off();
    expect(listeners).toHaveLength(0);
  });

  it("notifies when the visitor changes the preference, not just the OS", () => {
    mockMatchMedia(false);
    const handler = vi.fn();
    const off = onReducedMotionChange(handler);
    setMotionPreference("reduced");
    expect(handler).toHaveBeenLastCalledWith(true);
    setMotionPreference("full");
    expect(handler).toHaveBeenLastCalledWith(false);
    off();
    setMotionPreference("system");
    expect(handler).toHaveBeenCalledTimes(2);
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

describe("the motion preference (§7.2) is the visitor's, and defaults to the OS", () => {
  it("defaults to system, so nothing overrides the OS without an explicit act", () => {
    expect(readMotionPreference()).toBe("system");
    mockMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
  });

  it("lets a visitor keep motion despite an OS-wide reduce signal", () => {
    mockMatchMedia(true);
    setMotionPreference("full");
    expect(document.documentElement.dataset.motion).toBe("full");
    expect(prefersReducedMotion()).toBe(false);
  });

  it("lets a visitor drop motion the OS never asked to drop", () => {
    mockMatchMedia(false);
    setMotionPreference("reduced");
    expect(prefersReducedMotion()).toBe(true);
  });

  it("persists a choice and clears it again on system", () => {
    mockMatchMedia(false);
    setMotionPreference("full");
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBe("full");
    setMotionPreference("system");
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset.motion).toBeUndefined();
    expect(prefersReducedMotion()).toBe(false);
  });

  it("ignores a junk attribute rather than treating it as an override", () => {
    mockMatchMedia(true);
    document.documentElement.dataset.motion = "yes-please";
    expect(readMotionPreference()).toBe("system");
    expect(prefersReducedMotion()).toBe(true);
  });

  it("survives localStorage being unavailable", () => {
    mockMatchMedia(true);
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    expect(() => setMotionPreference("full")).not.toThrow();
    // The attribute still applies, so the current page honours the choice.
    expect(prefersReducedMotion()).toBe(false);
    spy.mockRestore();
  });

  it("builds no ScrollTrigger when the visitor chose reduced (§7.2)", async () => {
    mockMatchMedia(false);
    setMotionPreference("reduced");
    const build = vi.fn();
    const el = document.createElement("div");
    document.body.appendChild(el);
    const teardown = await createPinnedScene({
      pinTarget: el,
      end: "+=600%",
      build,
    });
    expect(build).not.toHaveBeenCalled();
    teardown();
    el.remove();
  });
});
