/**
 * Zone A — Acts 1, 2, 4, 5, 6. FRONTEND_DESIGN.md §5.
 *
 * The invariants under test are the ones the spec calls non-negotiable, and
 * the ones a future edit is most likely to break by accident:
 *
 *   §5.1  the stat slots stay EMPTY until the corpus exists
 *   §5.2  the grid is the hero's receipt — the counts cannot drift
 *   §5.4  the ground inverts, the divergence is legible with motion off,
 *         and the injected line is named in words
 *   §5.5  the band boundaries are labelled "pending calibration"
 *   §7.1  no visually-hidden narrative text anywhere in Zone A
 *   §7.2  the content test: every claim survives motion being removed
 *   §3.6  the tone contract — no borrowed statistics, no fear
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Stakes } from "@/components/narrative/Stakes";
import { ThreatBento } from "@/components/narrative/ThreatBento";
import { DiscrepancyGate } from "@/components/narrative/DiscrepancyGate";
import { RiskCalculator } from "@/components/narrative/RiskCalculator";
import { Handoff } from "@/components/narrative/Handoff";
import { HERO_VECTORS, VECTOR_COUNT, VECTORS } from "@/lib/vectors";
import { BAND_STATUS } from "@/lib/scoring";
import { MALICIOUS } from "@/lib/fixtures/scans";

/** Escapes a fixture line for use inside a RegExp. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* =========================================================================
   Act 1 — the stakes (§5.1)
   ========================================================================= */
describe("§5.1 Act 1 — the stakes", () => {
  it("states the sentence and lands on its second half", () => {
    render(<Stakes />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toMatch(/reads the text layer of a PDF/);
    expect(heading.textContent).toMatch(/None of them read the page\./);
  });

  it("leaves every stat slot empty and says what it is waiting for", () => {
    render(<Stakes />);
    // §5.1: "Leave the placeholders empty until the corpus exists."
    expect(screen.getAllByText(/pending the adversarial corpus/)).toHaveLength(3);
  });

  it("carries no statistic we did not measure (§3.6)", () => {
    const { container } = render(<Stakes />);
    const text = container.textContent ?? "";
    // §3.6 bans borrowed breach figures outright.
    expect(text).not.toMatch(/\d+%/);
    expect(text).not.toMatch(/\$\d/);
    expect(text).not.toMatch(/according to|research shows|studies show/i);
  });

  it("names the three audiences and links the limitations from screen two", () => {
    render(<Stakes />);
    const nav = screen.getByRole("navigation", { name: /where to go next/i });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(3);
    // §5.9 — the limitations link belongs on screen two, not at the bottom.
    expect(
      links.some((a) => /what we don't catch/i.test(a.textContent ?? "")),
    ).toBe(true);
  });
});

/* =========================================================================
   Act 2 — the threat taxonomy (§5.2)
   ========================================================================= */
describe("§5.2 Act 2 — the threat bento", () => {
  it("shows one cell per vector — the hero's receipt cannot drift", () => {
    const { container } = render(<ThreatBento />);
    expect(container.querySelectorAll(".bento-cell")).toHaveLength(VECTOR_COUNT);
  });

  it("names every vector in the taxonomy", () => {
    render(<ThreatBento />);
    for (const v of VECTORS) {
      expect(screen.getByText(v.name)).toBeInTheDocument();
    }
  });

  it("marks exactly the three cells that defeat every physical check", () => {
    const { container } = render(<ThreatBento />);
    expect(container.querySelectorAll('[data-hero="true"]')).toHaveLength(
      HERO_VECTORS.length,
    );
    expect(HERO_VECTORS).toHaveLength(3);
  });

  it("collapses by default and carries the implementing call for each claim", () => {
    const { container } = render(<ThreatBento />);
    // §5.2 — collapsed to name + mechanism.
    for (const cell of container.querySelectorAll<HTMLDetailsElement>(
      ".bento-cell",
    )) {
      expect(cell.open).toBe(false);
    }
    // §5.9 — the PyMuPDF call sits beside the detection claim it supports.
    for (const v of VECTORS) {
      expect(screen.getByText(v.call)).toBeInTheDocument();
    }
  });

  it("uses a native disclosure rather than hidden text (§7.1)", () => {
    const { container } = render(<ThreatBento />);
    expect(container.querySelectorAll("details")).toHaveLength(VECTOR_COUNT);
    expect(container.querySelector(".sr-only, .visually-hidden")).toBeNull();
  });
});

/* =========================================================================
   Act 4 — the discrepancy gate (§5.4). ★
   ========================================================================= */
describe("§5.4 Act 4 — the discrepancy gate", () => {
  it("inverts the ground to paper for this section only", () => {
    const { container } = render(<DiscrepancyGate />);
    const section = container.querySelector("#discrepancy");
    expect(section).toHaveAttribute("data-ground", "paper");
    expect(section).toHaveAttribute("data-act", "discrepancy");
  });

  it("renders both columns from the same contract the scanner uses (§9.3)", () => {
    render(<DiscrepancyGate />);
    const d = MALICIOUS.divergence!;
    for (const line of [...d.rendered, ...d.extracted]) {
      expect(
        screen.getAllByText(new RegExp(escapeRe(line))).length,
      ).toBeGreaterThan(0);
    }
  });

  it("passes the §7.2 content test: the whole argument is in the static render", () => {
    // No timeline has run in jsdom, so this IS the motion-off composition.
    render(<DiscrepancyGate />);
    const d = MALICIOUS.divergence!;

    // Both metrics at their FINAL values, not at the 1.00 premise.
    expect(screen.getByText(d.jaccard.toFixed(2))).toBeInTheDocument();
    expect(screen.getByText(d.cosine.toFixed(2))).toBeInTheDocument();

    // And the conclusion landed, not pending.
    expect(
      screen.getByText(/definitive structural-manipulation/),
    ).toHaveAttribute("data-state", "landed");
  });

  it("turns the divider blocked and names the injection in words (§3.2 law 2)", () => {
    const { container } = render(<DiscrepancyGate />);
    expect(container.querySelector("[data-panes]")).toHaveAttribute(
      "data-diverged",
      "true",
    );
    // Two injected lines in the fixture, each named rather than only reddened.
    expect(screen.getAllByText("in file, not on page")).toHaveLength(2);
  });

  it("keeps the scrubbed counters out of the live region (§7.3)", () => {
    const { container } = render(<DiscrepancyGate />);
    expect(container.querySelector(".gate-metrics")).toHaveAttribute(
      "aria-live",
      "off",
    );
  });

  it("prints each metric beside its threshold so the call is checkable", () => {
    render(<DiscrepancyGate />);
    const d = MALICIOUS.divergence!;
    expect(
      screen.getByText(`threshold ${d.jaccardThreshold.toFixed(2)}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`threshold ${d.cosineThreshold.toFixed(2)}`),
    ).toBeInTheDocument();
  });
});

/* =========================================================================
   Act 5 — the verdict, made interactive (§5.5)
   ========================================================================= */
describe("§5.5 Act 5 — the risk calculator", () => {
  it("labels the band boundaries as proposed, not settled", () => {
    render(<RiskCalculator />);
    // §5.5's honesty requirement, sourced from lib/scoring rather than typed.
    expect(screen.getAllByText(BAND_STATUS).length).toBeGreaterThan(0);
    expect(BAND_STATUS).toMatch(/pending calibration/);
  });

  it("exposes the meter with role=meter and a spoken value (§7.3)", () => {
    render(<RiskCalculator />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuenow");
    expect(meter.getAttribute("aria-valuetext")).toMatch(/safe|review|blocked/i);
  });

  it("offers the three deployment presets §5.5 names", () => {
    render(<RiskCalculator />);
    for (const name of [/hiring/i, /hospital/i, /rag/i]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });
});

/* =========================================================================
   Act 6 — the handoff (§5.6)
   ========================================================================= */
describe("§5.6 Act 6 — the handoff", () => {
  it("ships the simple version: the sentence and the hard rule", () => {
    const { container } = render(<Handoff />);
    expect(
      screen.getByText(/That is the argument\. Here is the instrument\./),
    ).toBeInTheDocument();
    expect(container.querySelector(".handoff-rule")).toBeInTheDocument();
  });

  it("keeps the grid layer decorative and out of the accessibility tree", () => {
    const { container } = render(<Handoff />);
    expect(container.querySelector(".handoff-ground")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
