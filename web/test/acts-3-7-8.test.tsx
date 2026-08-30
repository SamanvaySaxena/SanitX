/**
 * Zone A — Acts 3, 7 and 8, plus the cross-act invariants that only hold once
 * the page is composed. FRONTEND_DESIGN.md §5.3, §5.7, §5.8, §5.9.
 *
 *   §5.3  the sticky pane is the REAL scanner UI, not a drawing of it
 *   §5.7  Act 7 embeds the identical component, pre-loaded
 *   §5.8  the contract is complete, and the gap list is current
 *   §5.9  trust signals are distributed, and every anchor resolves
 *   §7.2  every act's argument survives motion being removed
 *   §9.3  one contract, both zones — the site cannot promise a missing field
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineScroller } from "@/components/narrative/PipelineScroller";
import { EmbeddedInstrument } from "@/components/narrative/EmbeddedInstrument";
import { EngineeringContract } from "@/components/narrative/EngineeringContract";
import {
  ERROR_TAXONOMY,
  FAIL_CLOSED,
  LIMITATIONS,
  RESPONSE_SCHEMA,
  STAGE_ORDER,
  limitationsByStage,
} from "@/lib/limitations";
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
   Act 8 — the contract and the gaps (§5.8)
   ========================================================================= */
describe("§5.8 Act 8 — for engineers, and what we do not catch", () => {
  it("documents every field of the response schema", () => {
    render(<EngineeringContract />);
    for (const f of RESPONSE_SCHEMA) {
      expect(screen.getByText(f.path)).toBeInTheDocument();
    }
    // §9.3 — the table is derived from ScanResponse, so a field cannot be
    // advertised here without existing in the type.
    expect(RESPONSE_SCHEMA.length).toBeGreaterThan(15);
  });

  it("lists every error, and none of them resolve to SAFE", () => {
    render(<EngineeringContract />);
    for (const e of ERROR_TAXONOMY) {
      expect(screen.getByText(e.code)).toBeInTheDocument();
      // The guarantee, checked against the data rather than the prose.
      expect(e.outcome).not.toMatch(/\bSAFE\b/);
    }
  });

  it("states the fail-closed guarantee plainly", () => {
    render(<EngineeringContract />);
    expect(
      screen.getByText(new RegExp(FAIL_CLOSED.slice(0, 40))),
    ).toBeInTheDocument();
    expect(FAIL_CLOSED).toMatch(/never SAFE/);
  });

  it("publishes the whole gap list, grouped by the stage that closes it", () => {
    render(<EngineeringContract />);
    for (const l of LIMITATIONS) {
      expect(screen.getByText(l.title)).toBeInTheDocument();
    }
    for (const g of limitationsByStage()) {
      expect(STAGE_ORDER).toContain(g.stage);
      expect(screen.getByText(g.label)).toBeInTheDocument();
    }
  });

  it("cites a source for every gap, so a reader can check it (§5.9)", () => {
    render(<EngineeringContract />);
    for (const l of LIMITATIONS) {
      expect(l.source.length).toBeGreaterThan(0);
      expect(screen.getAllByText(l.source).length).toBeGreaterThan(0);
    }
  });

  it("claims no coverage it cannot show (§3.6)", () => {
    const { container } = render(<EngineeringContract />);
    const text = container.textContent ?? "";
    // §5.8: "Security professionals discount any tool that claims total
    // coverage, because they know none exists."
    expect(text).not.toMatch(/complete coverage|total coverage|100% detection/i);
    expect(text).not.toMatch(/fully protected|guaranteed safe/i);
  });

  it("owns the #api-contract and #limitations anchors (§5.9)", () => {
    const { container } = render(<EngineeringContract />);
    expect(container.querySelector("#api-contract")).not.toBeNull();
    expect(container.querySelector("#limitations")).not.toBeNull();
  });
});

/* =========================================================================
   Cross-act — invariants that only hold once the page is composed
   ========================================================================= */
describe("§5.9 trust signals resolve", () => {
  it("the anchors Acts 0 and 1 link to are owned by a later act", () => {
    const { container } = render(
      <>
        <EmbeddedInstrument />
        <EngineeringContract />
      </>,
    );
    for (const id of ["scanner", "api-contract", "limitations"]) {
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });
});
