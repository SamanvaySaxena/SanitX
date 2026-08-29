import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

// Pure-logic suites opt into the node environment via a @vitest-environment
// docblock; this setup file still runs for them, so everything below is
// guarded rather than assumed.
if (typeof window !== "undefined") {
  // jsdom implements neither matchMedia nor IntersectionObserver, and both are
  // load-bearing: the reduced-motion guard (§7.2) and micro-demo gating (§5.2).
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }

  if (!window.IntersectionObserver) {
    class MockIntersectionObserver implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds: readonly number[] = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    window.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof window.IntersectionObserver;
  }
}
