/**
 * §7.2 — the motion preference is the visitor's, and its default is the
 * operating system's answer. These tests exist because the failure mode is
 * silent: a hardcoded override looks identical to a working toggle on the
 * machine of whoever wrote it, and only ever hurts someone else.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionToggle } from "@/components/primitives/MotionToggle";
import {
  MOTION_STORAGE_KEY,
  prefersReducedMotion,
} from "@/lib/motion/reduced-motion";

function mockMatchMedia(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  delete document.documentElement.dataset.motion;
  window.localStorage.clear();
  mockMatchMedia(true); // the hostile default: the OS asked for less motion.
});

afterEach(() => {
  delete document.documentElement.dataset.motion;
  vi.restoreAllMocks();
});

describe("the motion toggle", () => {
  it("offers three states, because two cannot express 'follow the system'", () => {
    render(<MotionToggle />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    for (const name of ["System", "Full", "Reduced"]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
  });

  it("starts on System, so the OS wins until the visitor says otherwise", () => {
    render(<MotionToggle />);
    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
    expect(document.documentElement.dataset.motion).toBeUndefined();
    expect(prefersReducedMotion()).toBe(true);
  });

  it("names its state in a visible word rather than a colour (§7.1, §3.2)", () => {
    render(<MotionToggle />);
    // The checked option's label is real text in the accessibility tree, not
    // an sr-only string and not a filled swatch carrying the meaning alone.
    const checked = screen.getByRole("radio", { checked: true });
    expect(checked).toHaveAccessibleName("System");
    expect(screen.getByText("System")).toBeVisible();
  });

  it("turns motion on for a visitor whose OS asked for less", async () => {
    const user = userEvent.setup();
    render(<MotionToggle />);
    await user.click(screen.getByRole("radio", { name: "Full" }));

    expect(document.documentElement.dataset.motion).toBe("full");
    expect(prefersReducedMotion()).toBe(false);
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBe("full");
  });

  it("turns motion off for a visitor whose OS said nothing", async () => {
    mockMatchMedia(false);
    const user = userEvent.setup();
    render(<MotionToggle />);
    await user.click(screen.getByRole("radio", { name: "Reduced" }));

    expect(prefersReducedMotion()).toBe(true);
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBe("reduced");
  });

  it("hands control back to the OS on System, leaving nothing behind", async () => {
    const user = userEvent.setup();
    render(<MotionToggle />);
    await user.click(screen.getByRole("radio", { name: "Full" }));
    await user.click(screen.getByRole("radio", { name: "System" }));

    expect(document.documentElement.dataset.motion).toBeUndefined();
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBeNull();
    expect(prefersReducedMotion()).toBe(true);
  });

  it("restores a stored choice on mount, without a reload", () => {
    // What the pre-paint script in app/layout.tsx will already have stamped.
    document.documentElement.dataset.motion = "full";
    render(<MotionToggle />);
    expect(screen.getByRole("radio", { name: "Full" })).toBeChecked();
  });

  it("is reachable and operable from the keyboard alone (§7.3)", async () => {
    const user = userEvent.setup();
    render(<MotionToggle />);
    await user.tab();
    expect(screen.getByRole("radio", { name: "System" })).toHaveFocus();
    // Roving arrow-key selection, which is why these are radios.
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Full" })).toBeChecked();
    expect(prefersReducedMotion()).toBe(false);
  });
});
