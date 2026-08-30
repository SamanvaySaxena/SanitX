import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

// Pure-logic suites opt into the node environment via a @vitest-environment
// docblock; this setup file still runs for them, so everything below is
// guarded rather than assumed.
if (typeof window !== "undefined") {
  // jsdom implements neither matchMedia nor IntersectionObserver. Nothing
  // gates motion on matchMedia any more (§7.2), but component code and
  // third-party libraries still call it; IntersectionObserver remains
  // load-bearing for micro-demo gating (§5.2).
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

  // The page preview sizes its raster from a ResizeObserver (§6.1). jsdom has
  // none, and the component treats its absence as "render at the fallback
  // width" rather than as an error — this stub keeps that path exercised
  // without inventing layout jsdom cannot measure anyway.
  if (!window.ResizeObserver) {
    class MockResizeObserver implements ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver =
      MockResizeObserver as unknown as typeof window.ResizeObserver;
  }

  // jsdom ships no Blob.prototype.arrayBuffer, and two load-bearing paths need
  // one: §6.3's %PDF- magic-header check reads five bytes off a slice, and the
  // page preview reads the whole file to rasterise it. FileReader is the
  // faithful equivalent — this changes what the environment CAN do, never what
  // the code under test does.
  if (typeof Blob !== "undefined" && !Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }

  // Same gap, same fix, for the Markdown surface: MarkdownPage reads the
  // scanned file with file.text() to show the SOURCE rather than a rendering
  // of it (see the header of that component for why).
  if (typeof Blob !== "undefined" && !Blob.prototype.text) {
    Blob.prototype.text = function text(this: Blob) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    };
  }
}
