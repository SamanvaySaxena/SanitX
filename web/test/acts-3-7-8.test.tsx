/**
 * Zone A — Acts 3 and 7, plus the cross-act invariants that only hold once
 * the page is composed. FRONTEND_DESIGN.md §5.3, §5.7, §5.9.
 *
 *   §5.3  the sticky pane is the REAL scanner UI, not a drawing of it
 *   §5.7  Act 7 embeds the identical component, pre-loaded
 *   §5.9  trust signals are distributed, and every anchor resolves
 *   §7.2  every act's argument survives motion being removed
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineScroller } from "@/components/narrative/PipelineScroller";
import { EmbeddedInstrument } from "@/components/narrative/EmbeddedInstrument";
import { MALICIOUS } from "@/lib/fixtures/scans";

/* =========================================================================
   Act 3 — the pipeline (§5.3)
   ========================================================================= */
describe("§5.3 Act 3 — the pipeline scroller", () => {
  it("narrates all six phases, always readable (§7.2)", () => {
    const { container } = render(<PipelineScroller />);
    const blocks = container.querySelectorAll(".pipe-scene-block");
    expect(blocks).toHaveLength(6);
    // Every block carries its prose, not just the active one — the static
    // composition is the whole argument.
    for (const b of blocks) {
      expect((b.textContent ?? "").length).toBeGreaterThan(120);
    }
  });

  it("shows the finished scan in the static render, not an empty shell", () => {
    // No timeline runs in jsdom, so this IS the motion-off composition.
    render(<PipelineScroller />);
    expect(screen.getByText("BLOCKED")).toBeInTheDocument();
    expect(screen.getAllByText(/PHASE 6/).length).toBeGreaterThan(0);
  });

  it("renders the REAL scanner components rather than an illustration", () => {
    const { container } = render(<PipelineScroller />);
    // These class names are the scanner's own — .sx-ledger, .sx-findings and
    // .sx-bboxes come from styles/scanner.css, not narrative.css. If this act
    // ever regresses to a bespoke drawing, they vanish.
    expect(container.querySelector(".sx-ledger")).not.toBeNull();
    expect(container.querySelector(".sx-findings")).not.toBeNull();
    expect(container.querySelector(".sx-bboxes")).not.toBeNull();
  });

  it("quotes the fixture's own readouts rather than retyping them", () => {
    render(<PipelineScroller />);
    for (const p of MALICIOUS.phases) {
      if (p.readout) {
        expect(screen.getAllByText(p.readout).length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the duplicated product screen out of the accessibility tree", () => {
    const { container } = render(<PipelineScroller />);
    // The narration is the accessible path; the scrubbed pane would otherwise
    // make a screen reader walk the findings list six times over.
    expect(container.querySelector(".pipe-ui")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});

/* =========================================================================
   Act 7 — the instrument, embedded (§5.7)
   ========================================================================= */
describe("§5.7 Act 7 — the embedded instrument", () => {
  it("renders the identical scanner, marked as embedded", () => {
    const { container } = render(<EmbeddedInstrument />);
    const root = container.querySelector(".sx-root");
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute("data-embedded", "true");
  });

  it("owns the #scanner anchor the skip link targets (§7.3)", () => {
    const { container } = render(<EmbeddedInstrument />);
    expect(container.querySelector("#scanner")).not.toBeNull();
  });

  it("ships no marketing copy inside the tool itself (§11)", () => {
    const { container } = render(<EmbeddedInstrument />);
    const text = container.querySelector(".sx-root")?.textContent ?? "";
    expect(text).not.toMatch(/sign up|get started|free trial|book a demo/i);
  });
});

/* =========================================================================
   Cross-act — invariants that only hold once the page is composed
   ========================================================================= */
describe("§5.9 trust signals resolve", () => {
  it("the anchors Acts 0 and 1 link to are owned by a later act", () => {
    const { container } = render(<EmbeddedInstrument />);
    for (const id of ["scanner"]) {
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });
});
