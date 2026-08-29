// @vitest-environment node
/**
 * Phase 5 risk scoring — PIPELINE_IMPROVEMENTS §5, surfaced by §5.5 and §6.1.
 */
import { describe, expect, it } from "vitest";
import {
  BANDS,
  BAND_STATUS,
  DEFAULT_WEIGHTS,
  PROFILES,
  VERDICT_PRESENTATION,
  clamp01,
  clampWeight,
  computeRisk,
  verdictAriaText,
  verdictFor,
} from "@/lib/scoring";

describe("R = clamp(0, 1, w_s·S + w_d·D + w_m·M)", () => {
  it("is the stated linear combination", () => {
    expect(
      computeRisk({ s: 0.5, d: 0.5, m: 0.5 }, { s: 0.2, d: 0.3, m: 0.1 }),
    ).toBeCloseTo(0.3, 10);
  });

  it("clamps to [0, 1] at both ends", () => {
    expect(computeRisk({ s: 1, d: 1, m: 1 }, { s: 1, d: 1, m: 1 })).toBe(1);
    expect(computeRisk({ s: 0, d: 0, m: 0 }, { s: 1, d: 1, m: 1 })).toBe(0);
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(9)).toBe(1);
  });
});

describe("verdict bands", () => {
  it("uses the boundaries from PIPELINE_IMPROVEMENTS §5", () => {
    expect(BANDS.review).toBe(0.3);
    expect(BANDS.blocked).toBe(0.7);
  });

  it.each([
    [0, "SAFE"],
    [0.29, "SAFE"],
    [0.3, "REVIEW"],
    [0.69, "REVIEW"],
    [0.7, "BLOCKED"],
    [1, "BLOCKED"],
  ])("R = %s lands in %s", (r, expected) => {
    expect(verdictFor(r as number)).toBe(expected);
  });

  // §5.5 honesty requirement. The thresholds are a guess and every surface
  // that shows a band must say so.
  it("labels the boundaries as uncalibrated", () => {
    expect(BAND_STATUS).toBe("proposed — pending calibration");
  });
});

describe("verdict presentation — §3.2 colour law 2", () => {
  it("never relies on colour alone: every verdict carries glyph and word", () => {
    for (const v of ["SAFE", "REVIEW", "BLOCKED"] as const) {
      const p = VERDICT_PRESENTATION[v];
      expect(p.glyph.length).toBeGreaterThan(0);
      expect(p.word.length).toBeGreaterThan(0);
      expect(p.token).toMatch(/^var\(--/);
    }
  });

  it("uses the exact §3.6 wording, which is flat and factual", () => {
    expect(VERDICT_PRESENTATION.SAFE.word).toBe("VERIFIED SAFE");
    expect(VERDICT_PRESENTATION.REVIEW.word).toBe("REVIEW");
    expect(VERDICT_PRESENTATION.BLOCKED.word).toBe("BLOCKED");
  });

  it("gives role=meter the §7.3 announcement: '0.81, blocked'", () => {
    expect(verdictAriaText(0.81)).toBe("0.81, blocked");
    expect(verdictAriaText(0.08)).toBe("0.08, safe");
    expect(verdictAriaText(0.42)).toBe("0.42, review");
  });
});

describe("deployment profiles — §5.5", () => {
  it("ships the three named presets plus a default", () => {
    const ids = PROFILES.map((p) => p.id);
    expect(ids).toContain("hiring");
    expect(ids).toContain("hospital");
    expect(ids).toContain("rag");
    expect(PROFILES[0].weights).toEqual(DEFAULT_WEIGHTS);
  });

  it("every preset states its rationale, and every weight is in [0,1]", () => {
    for (const p of PROFILES) {
      expect(p.rationale.length).toBeGreaterThan(20);
      for (const w of Object.values(p.weights)) {
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1);
      }
    }
  });

  // The design argument: the same document must be able to change verdict
  // under a different threat model, or the sliders prove nothing (§5.5).
  it("moves a borderline document across a band boundary", () => {
    const c = { s: 0.62, d: 0.28, m: 0.35 };
    const rag = PROFILES.find((p) => p.id === "rag")!;
    const hiring = PROFILES.find((p) => p.id === "hiring")!;
    expect(computeRisk(c, rag.weights)).toBeGreaterThan(
      computeRisk(c, hiring.weights),
    );
  });
});

describe("input-level clamping — §6.3 'disable, don't validate'", () => {
  it.each([
    [-1, 0],
    [2, 1],
    [0.5, 0.5],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])("clampWeight(%s) === %s", (input, expected) => {
    expect(clampWeight(input as number)).toBe(expected);
  });
});
