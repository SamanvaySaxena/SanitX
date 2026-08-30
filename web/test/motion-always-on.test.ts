/**
 * Motion is not gated on the operating system — FRONTEND_DESIGN.md §7.2.
 *
 * Windows reports `prefers-reduced-motion: reduce` for its taskbar "Animation
 * effects: off" setting, which is not a statement about this site. A scrolled
 * act is scrubbed: it advances only as far as the visitor's own scroll takes
 * it. So the scene is built for everyone, and this suite is the regression
 * guard for that — it asserts a pinned scene is created with the media query
 * answering "reduce".
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const scrollTriggerConfigs: Record<string, unknown>[] = [];

vi.mock("gsap", () => ({
  gsap: {
    registerPlugin: vi.fn(),
    set: vi.fn(),
    timeline: (vars?: Record<string, unknown>) => {
      if (vars?.scrollTrigger) {
        scrollTriggerConfigs.push(
          vars.scrollTrigger as Record<string, unknown>,
        );
      }
      const tl = {
        to: () => tl,
        fromTo: () => tl,
        set: () => tl,
        addLabel: () => tl,
      };
      return tl;
    },
  },
}));

vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: { getAll: () => [] },
}));

import { createPinnedScene, lerp, subProgress } from "@/lib/motion/timeline";

/** Every media query answers "yes" — the most hostile OS setting we can hand it. */
function osAsksForReducedMotion(): void {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  scrollTriggerConfigs.length = 0;
  document.body.innerHTML = "";
});

describe("§7.2 scrolled scenes build regardless of the OS motion setting", () => {
  it("creates the pinned ScrollTrigger even when the OS asks for reduced motion", async () => {
    osAsksForReducedMotion();
    const pinTarget = document.createElement("section");
    document.body.append(pinTarget);

    const build = vi.fn();
    await createPinnedScene({ pinTarget, end: "+=600%", build });

    expect(build).toHaveBeenCalledTimes(1);
    expect(scrollTriggerConfigs).toHaveLength(1);
    expect(scrollTriggerConfigs[0]).toMatchObject({
      pin: pinTarget,
      trigger: pinTarget,
      // §4.2 — the visitor's finger is the easing, so nothing plays on its own.
      scrub: 1,
      anticipatePin: 1,
    });
  });

  it("still refuses to build against a detached target", async () => {
    osAsksForReducedMotion();
    const build = vi.fn();
    await createPinnedScene({
      pinTarget: document.createElement("section"),
      end: "+=600%",
      build,
    });

    expect(build).not.toHaveBeenCalled();
    expect(scrollTriggerConfigs).toHaveLength(0);
  });

  it("keeps the scrub maths pure", () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(0, 100, 2)).toBe(100);
    expect(subProgress(0.5, 0.25, 0.75)).toBe(0.5);
  });
});
