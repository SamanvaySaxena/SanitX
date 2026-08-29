// @vitest-environment node
/**
 * The fixtures are the frontend test corpus (§10.2) AND the contract proof
 * (§9.3). These assertions pin them to the numbers the design document
 * actually prints on screen, so a fixture edit that would make Act 3 or the
 * scanner header lie fails here first.
 */
import { describe, expect, it } from "vitest";
import { BORDERLINE, CLEAN, MALICIOUS, SAMPLES, SAMPLE_ORDER } from "@/lib/fixtures/scans";
import { computeRisk, verdictFor } from "@/lib/scoring";
import { VECTORS } from "@/lib/vectors";
import type { ScanResponse } from "@/lib/types";

const ALL = Object.values(SAMPLES);

describe("every fixture honours the contract", () => {
  it("ships exactly the three §6.5 samples: clean, borderline, malicious", () => {
    expect(SAMPLE_ORDER).toEqual(["clean", "borderline", "malicious"]);
    expect(ALL).toHaveLength(3);
  });

  // §10.2 — the label is not cosmetic. A silently fabricated verdict is a
  // misrepresentation, so the flag every UI reads must be set.
  it.each(ALL)("$scanId is flagged as demo data", (r: ScanResponse) => {
    expect(r.demo).toBe(true);
  });

  it.each(ALL)("$scanId derives its verdict from its own score", (r: ScanResponse) => {
    expect(r.verdict).toBe(verdictFor(r.score));
  });

  // The formula is the single source of truth. A stored score that disagreed
  // with w·c would be exactly the drift §9.3 exists to prevent.
  it.each(ALL)("$scanId score equals R computed from its components", (r: ScanResponse) => {
    expect(r.score).toBeCloseTo(computeRisk(r.components, r.weights), 10);
  });

  it.each(ALL)("$scanId keeps every component and weight in [0,1]", (r: ScanResponse) => {
    for (const v of [...Object.values(r.components), ...Object.values(r.weights)]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it.each(ALL)("$scanId carries all six pipeline phases in order", (r: ScanResponse) => {
    expect(r.phases.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const p of r.phases) {
      expect(p.ms, `phase ${p.id} timing`).toBeTypeOf("number");
    }
    // Engineers will add these up (§6.2). Total must not be less than the parts.
    const sum = r.phases.reduce((a, p) => a + (p.ms ?? 0), 0);
    expect(r.totalMs).toBeGreaterThanOrEqual(sum);
  });

  it.each(ALL)("$scanId only cites vectors the taxonomy documents", (r: ScanResponse) => {
    const known = new Set(VECTORS.map((v) => v.id));
    for (const f of r.findings) expect(known.has(f.vector), f.vector).toBe(true);
  });

  it.each(ALL)("$scanId gives every finding a reason code and a detail", (r: ScanResponse) => {
    for (const f of r.findings) {
      expect(f.reasonCodes.length, f.id).toBeGreaterThan(0);
      expect(f.detail.length, f.id).toBeGreaterThan(30);
      expect(f.score).toBeGreaterThanOrEqual(0);
      expect(f.score).toBeLessThanOrEqual(1);
      if (f.bbox) expect(f.bbox.page).toBe(f.page);
    }
  });

  it.each(ALL)("$scanId never cites a page beyond the document", (r: ScanResponse) => {
    for (const f of r.findings) {
      expect(f.page).toBeGreaterThanOrEqual(1);
      expect(f.page).toBeLessThanOrEqual(r.document.pages);
    }
  });
});

describe("the malicious sample matches §6.1 exactly", () => {
  it("is BLOCKED at R = 0.81", () => {
    expect(MALICIOUS.verdict).toBe("BLOCKED");
    expect(MALICIOUS.score.toFixed(2)).toBe("0.81");
  });

  it("carries the §6.1 component breakdown S .88 / D .93 / M .61", () => {
    expect(MALICIOUS.components).toEqual({ s: 0.88, d: 0.93, m: 0.61 });
  });

  it("has the 9 findings the header count promises", () => {
    expect(MALICIOUS.findings).toHaveLength(9);
    // §6.1 lists these four by page and label; the list is ordered by score.
    const top = MALICIOUS.findings.slice(0, 1)[0];
    expect(top.label).toBe("3 Tr");
    expect(top.page).toBe(1);
    expect(top.score).toBe(0.91);
  });

  it("diverges past both Phase 3 thresholds — the §5.4 definitive signal", () => {
    const d = MALICIOUS.divergence!;
    expect(d.jaccard).toBe(0.62);
    expect(d.cosine).toBe(0.71);
    expect(d.jaccard).toBeLessThan(d.jaccardThreshold);
    expect(d.cosine).toBeLessThan(d.cosineThreshold);
  });

  it("keeps the §5.4 panes: extracted is a superset of rendered", () => {
    const d = MALICIOUS.divergence!;
    expect(d.extracted.slice(0, d.rendered.length)).toEqual(d.rendered);
    expect(d.extracted.length).toBeGreaterThan(d.rendered.length);
  });

  it("shows the §5.3 scene-4 tier funnel summing to 100 documents", () => {
    const t = MALICIOUS.tiers!;
    expect(t.tier1 + t.tier2 + t.tier3).toBe(100);
    expect(t.tier1).toBeGreaterThan(t.tier2);
    expect(t.tier2).toBeGreaterThan(t.tier3);
  });
});

describe("the clean sample matches §6.5", () => {
  it("is VERIFIED SAFE at R = 0.08 and lists the checks that ran", () => {
    expect(CLEAN.verdict).toBe("SAFE");
    expect(CLEAN.score.toFixed(2)).toBe("0.08");
    expect(CLEAN.checksRun.length).toBeGreaterThanOrEqual(10);
  });

  it("does not diverge", () => {
    const d = CLEAN.divergence!;
    expect(d.rendered).toEqual(d.extracted);
    expect(d.jaccard).toBeGreaterThan(d.jaccardThreshold);
    expect(d.cosine).toBeGreaterThan(d.cosineThreshold);
  });
});

describe("the borderline sample carries the §5.5 argument", () => {
  it("lands in REVIEW — the band a binary gate cannot express", () => {
    expect(BORDERLINE.verdict).toBe("REVIEW");
    expect(BORDERLINE.score.toFixed(2)).toBe("0.42");
  });

  // The whole point of shipping a borderline fixture: it holds a finding whose
  // mechanism is identical to the malicious one but whose explanation is benign.
  it("holds a benign-explanation finding of the same vector as the attack", () => {
    const b = BORDERLINE.findings.find((f) => f.vector === "render_mode_3tr")!;
    expect(b).toBeDefined();
    expect(b.reasonCodes).toContain("OCR_LAYER_LIKELY");
    expect(b.score).toBeLessThan(
      MALICIOUS.findings.find((f) => f.vector === "render_mode_3tr")!.score,
    );
  });
});
