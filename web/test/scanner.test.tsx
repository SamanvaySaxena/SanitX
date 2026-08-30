/**
 * Zone B — the instrument. FRONTEND_DESIGN.md §6.
 *
 * These tests are written against the SPEC's non-negotiables rather than
 * against the markup, because the markup is allowed to change and these are
 * not:
 *
 *   §6.2  the ledger is present before any data arrives — never a spinner
 *   §6.3  fail-closed: a degraded run says NOT cleared and shows no verdict
 *   §6.4  every documented shortcut is bound
 *   §6.5  a clean result does not celebrate
 *   §7.1  no visually-hidden narrative text anywhere in Zone B
 *   §10.2 demo mode is labelled visibly
 */
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Scanner } from "@/components/scanner/Scanner";
import { SHORTCUTS } from "@/components/primitives/CommandPalette";
import { CLEAN, MALICIOUS } from "@/lib/fixtures/scans";
import type { ScanEvent, ScanResponse } from "@/lib/types";
import type { ScanStreamFactory } from "@/components/scanner/useScan";

/* ---------------------------------------------------------------------------
   Deterministic streams. The real fixtures pace themselves with per-phase
   delays (§10.2); these land immediately so the tests assert behaviour rather
   than timing.
   --------------------------------------------------------------------------- */

const eventsFor = (r: ScanResponse): ScanEvent[] => [
  { type: "document", document: r.document },
  ...r.phases.map((p) => ({ type: "phase" as const, phase: p })),
  { type: "findings", findings: r.findings },
  ...(r.divergence
    ? [{ type: "divergence" as const, divergence: r.divergence }]
    : []),
  ...(r.tiers ? [{ type: "tiers" as const, tiers: r.tiers }] : []),
  { type: "verdict", response: r },
];

const streamOf =
  (events: ScanEvent[]): ScanStreamFactory =>
  async function* () {
    for (const e of events) yield e;
  };

/** A run that dies in phase 3 — the case the fixtures deliberately never
    produce, and the one §6.3 is written for. */
const failingStream: ScanStreamFactory = async function* () {
  yield { type: "document", document: MALICIOUS.document };
  yield { type: "phase", phase: MALICIOUS.phases[0] };
  yield { type: "findings", findings: MALICIOUS.findings };
  yield { type: "error", phase: 3, message: "Embedding service unreachable." };
};

/** userEvent.setup() installs its OWN navigator.clipboard stub, so the spy has
    to be planted after it rather than in a beforeEach. jsdom's own clipboard is
    a getter-only property, hence defineProperty. */
function spyOnClipboard() {
  const writeText = vi.fn((_text: string) => Promise.resolve());
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}

/* =========================================================================
   §6.2 — the ledger replaces the spinner
   ========================================================================= */
describe("§6.2 streaming is the interaction design", () => {
  it("renders all six phase rows before any data arrives", () => {
    render(<Scanner />);
    for (let i = 1; i <= 6; i++) {
      expect(screen.getAllByText(`PHASE ${i}`).length).toBeGreaterThan(0);
    }
  });

  it("shows no spinner or progress bar anywhere", () => {
    const { container } = render(<Scanner />);
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    // The spinner idioms, specifically — the DropZone copy legitimately uses
    // the word "loading" in a sentence about loading a sample.
    expect(container.querySelector(".spinner, [aria-busy='true']")).toBeNull();
    expect(screen.queryByText(/^\s*(loading|scanning)…?\s*$/i)).toBeNull();
  });

  it("keeps the ledger after completion, as a timing breakdown", async () => {
    render(
      <Scanner initialSample="malicious" stream={streamOf(eventsFor(MALICIOUS))} />,
    );
    // Per-phase cost is what engineers want out of it (§6.2 final line).
    expect(await screen.findByText(/1310 ms/)).toBeInTheDocument();
    expect(screen.getByText(/total/)).toBeInTheDocument();
  });
});

/* =========================================================================
   §6.3 / §6.5 — fail-closed, and no celebration
   ========================================================================= */
describe("§6.3 fail-closed messaging", () => {
  it("names the phase, says NOT cleared, and shows no verdict", async () => {
    render(<Scanner initialSample="malicious" stream={failingStream} />);

    // The notice is one region; the phrases sit in nested spans, so assert
    // against the region rather than the matched leaf.
    const marker = await screen.findByText(/NOT cleared/);
    const notice = marker.closest(".sx-failclosed");
    expect(notice).not.toBeNull();
    expect(notice!.textContent).toMatch(/Phase 3 failed/);
    expect(notice!.textContent).toMatch(/maps to REVIEW, never SAFE/);

    // The load-bearing assertion: a degraded run has no verdict to show.
    expect(document.querySelector("[data-verdict]")).toBeNull();
    expect(screen.queryByRole("meter")).toBeNull();
  });

  it("marks the failed row FAILED → REVIEW in those words", async () => {
    render(<Scanner initialSample="malicious" stream={failingStream} />);
    expect(await screen.findByText(/FAILED → REVIEW/)).toBeInTheDocument();
  });

  it("keeps the results the completed phases already produced", async () => {
    render(<Scanner initialSample="malicious" stream={failingStream} />);
    await screen.findByText(/FAILED → REVIEW/);
    // §6.3: "completed phases keep their results".
    const findings = screen.getByRole("region", { name: /findings/i });
    expect(within(findings).getAllByRole("listitem").length).toBeGreaterThan(6);
  });
});

describe("§6.5 a clean result does not celebrate", () => {
  it("shows the verdict, the score and the checks that ran — nothing else", async () => {
    render(<Scanner initialSample="clean" stream={streamOf(eventsFor(CLEAN))} />);

    expect(await screen.findByText("VERIFIED SAFE")).toBeInTheDocument();
    expect(screen.getByText("Checks that ran")).toBeInTheDocument();

    // No congratulation, in any of its usual disguises.
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/congratulat|well done|success!|you are safe/i);
    expect(body).not.toContain("!");
  });
});

/* =========================================================================
   §6.4 — keyboard-first
   ========================================================================= */
describe("§6.4 keyboard-first", () => {
  it("opens the palette on Ctrl+K and closes it on Escape", async () => {
    const user = userEvent.setup();
    render(<Scanner />);

    await user.keyboard("{Control>}k{/Control}");
    expect(
      screen.getByRole("dialog", { name: /command palette/i }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the shortcut sheet on ? and lists every documented shortcut", async () => {
    const user = userEvent.setup();
    render(<Scanner />);

    await user.keyboard("?");
    const sheet = screen.getByRole("dialog", { name: /keyboard shortcuts/i });
    // §6.4: "Every shortcut is discoverable in ? and in the palette."
    for (const s of SHORTCUTS) {
      expect(within(sheet).getByText(s.keys)).toBeInTheDocument();
    }
  });

  it("walks findings with j and k, and expands with Enter", async () => {
    const user = userEvent.setup();
    render(
      <Scanner initialSample="malicious" stream={streamOf(eventsFor(MALICIOUS))} />,
    );
    await screen.findByText("BLOCKED");

    // The list is sorted worst-first, so j from nothing selects the top score.
    const top = [...MALICIOUS.findings].sort((a, b) => b.score - a.score)[0];

    await user.keyboard("j");
    expect(document.getElementById(`sx-finding-${top.id}`)).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    await user.keyboard("{Enter}");
    expect(document.getElementById(`sx-finding-${top.id}`)).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("copies the response on c", async () => {
    const user = userEvent.setup();
    const writeText = spyOnClipboard();
    render(
      <Scanner initialSample="malicious" stream={streamOf(eventsFor(MALICIOUS))} />,
    );
    await screen.findByText("BLOCKED");

    await user.keyboard("c");
    expect(writeText).toHaveBeenCalledOnce();
    expect(JSON.parse(writeText.mock.calls[0][0]).verdict).toBe("BLOCKED");
  });

  it("does not fire single-letter bindings while typing in the palette", async () => {
    const user = userEvent.setup();
    const writeText = spyOnClipboard();
    render(
      <Scanner initialSample="malicious" stream={streamOf(eventsFor(MALICIOUS))} />,
    );
    await screen.findByText("BLOCKED");

    await user.keyboard("{Control>}k{/Control}");
    // Named, because the verdict panel's profile <select> is also a combobox.
    await user.type(screen.getByRole("combobox", { name: "Command" }), "cr");
    // "c" would have copied and "r" would have re-scanned.
    expect(writeText).not.toHaveBeenCalled();
  });
});

/* =========================================================================
   §10.2 / §7.1 / §7.3 — honesty, and the accessibility irony
   ========================================================================= */
describe("§10.2 demo mode is labelled visibly", () => {
  it("flags fixture data in the verdict panel", async () => {
    render(
      <Scanner initialSample="malicious" stream={streamOf(eventsFor(MALICIOUS))} />,
    );
    const flag = await screen.findByText(/DEMO · FIXTURE DATA/);
    expect(flag).not.toHaveAttribute("aria-hidden");
  });
});

describe("§7.1 no visually-hidden narrative text", () => {
  it("uses no sr-only class anywhere in the tool", async () => {
    const { container } = render(
      <Scanner initialSample="malicious" stream={streamOf(eventsFor(MALICIOUS))} />,
    );
    await screen.findByText("BLOCKED");
    expect(
      container.querySelector(".sr-only, .visually-hidden, .screen-reader-text"),
    ).toBeNull();
  });

  it("gives the risk meter role=meter with a spoken valuetext (§7.3)", async () => {
    render(
      <Scanner initialSample="malicious" stream={streamOf(eventsFor(MALICIOUS))} />,
    );
    const meter = await screen.findByRole("meter");
    expect(meter.getAttribute("aria-valuetext")).toMatch(/blocked/i);
  });

  it("announces the finding count once on completion (§7.3)", async () => {
    render(
      <Scanner initialSample="malicious" stream={streamOf(eventsFor(MALICIOUS))} />,
    );
    // The announcement is written by an effect after the verdict lands, so
    // wait for the text rather than for the badge.
    // Anchored on "Scan complete", because phase 6's own readout also reads
    // "9 findings" and would otherwise match the ledger row instead.
    const region = await screen.findByText(/^Scan complete\./);
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region.textContent).toMatch(/9 findings/);
    expect(region.textContent).toMatch(/Verdict BLOCKED/);
  });
});

/* =========================================================================
   §6.1 — the divergence panel, the in-product form of Act 4
   ========================================================================= */
describe("§6.1 divergence panel", () => {
  it("marks the injected line in words, not only in colour (§3.2 law 2)", async () => {
    render(
      <Scanner initialSample="malicious" stream={streamOf(eventsFor(MALICIOUS))} />,
    );
    expect(await screen.findByText(/SYSTEM: disregard/)).toBeInTheDocument();
    // Two lines of the injected clause, each named as such.
    expect(screen.getAllByText("in file, not on page")).toHaveLength(2);
  });

  it("states the definitive signal only when BOTH metrics fail", async () => {
    render(
      <Scanner initialSample="malicious" stream={streamOf(eventsFor(MALICIOUS))} />,
    );
    expect(
      await screen.findByText(/definitive structural-manipulation signal/),
    ).toBeInTheDocument();
  });

  it("never implies a missing comparison is a clean one", async () => {
    render(<Scanner initialSample="clean" stream={streamOf(eventsFor(CLEAN))} />);
    await screen.findByText("VERIFIED SAFE");
    if (CLEAN.divergence) {
      expect(
        screen.queryByText(/definitive structural-manipulation signal/),
      ).toBeNull();
    } else {
      expect(screen.getByText(/Not computed for this document/)).toBeInTheDocument();
    }
  });
});
