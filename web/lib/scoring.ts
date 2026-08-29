/* =========================================================================
   Phase 5 risk scoring — PIPELINE_IMPROVEMENTS §5, rendered by §5.5.
   Pure, client-side, and the single source of truth for both the Act 5
   calculator and the scanner's verdict panel.
   ========================================================================= */
import type { ComponentScores, Verdict, Weights } from "./types";

export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** R = clamp(0, 1, w_s·S + w_d·D + w_m·M) */
export function computeRisk(c: ComponentScores, w: Weights): number {
  return clamp01(w.s * c.s + w.d * c.d + w.m * c.m);
}

/* The band boundaries. §5.5 imposes an honesty requirement: these are a
   PROPOSED starting point, not a recommendation. The source documents'
   thresholds were rendered as images and did not survive text export. Every
   surface that shows a band must carry BAND_STATUS verbatim. */
export const BANDS = { review: 0.3, blocked: 0.7 } as const;
export const BAND_STATUS = "proposed — pending calibration";

export function verdictFor(r: number): Verdict {
  if (r >= BANDS.blocked) return "BLOCKED";
  if (r >= BANDS.review) return "REVIEW";
  return "SAFE";
}

/** Colour + glyph + word + position — never colour alone (§3.2 law 2). */
export const VERDICT_PRESENTATION: Record<
  Verdict,
  { glyph: string; word: string; token: string }
> = {
  SAFE: { glyph: "✓", word: "VERIFIED SAFE", token: "var(--safe)" },
  REVIEW: { glyph: "▲", word: "REVIEW", token: "var(--review)" },
  BLOCKED: { glyph: "●", word: "BLOCKED", token: "var(--blocked)" },
};

/** Screen-reader text for role="meter" (§7.3): "0.81, blocked". */
export function verdictAriaText(r: number): string {
  return `${r.toFixed(2)}, ${verdictFor(r).toLowerCase().replace("verified ", "")}`;
}

export interface DeploymentProfile {
  id: string;
  name: string;
  weights: Weights;
  /** Why these weights — the argument §5.5 wants the visitor to *feel*. */
  rationale: string;
}

/* §5.5 presets. These convert open question #4 of PIPELINE_IMPROVEMENTS §8
   — "where do false positives hurt more than false negatives?" — from an
   unresolved design problem into an interaction. */
export const PROFILES: DeploymentProfile[] = [
  {
    id: "balanced",
    name: "Balanced",
    weights: { s: 0.33, d: 0.35, m: 0.32 },
    rationale:
      "Makes no deployment assumption, so it weights the three components " +
      "almost equally — divergence marginally highest, because it has the " +
      "fewest benign explanations.",
  },
  {
    id: "hiring",
    name: "Hiring pipeline",
    weights: { s: 0.28, d: 0.45, m: 0.27 },
    rationale:
      "False positives are expensive — a rejected real CV is a real cost. " +
      "Leans hard on divergence and discounts the structural signal, which " +
      "fires on benign OCR sidecars.",
  },
  {
    id: "hospital",
    name: "Hospital ingestion",
    weights: { s: 0.45, d: 0.45, m: 0.4 },
    rationale:
      "False negatives are unacceptable. Every component weighted up, so R " +
      "reaches the review band on a single strong signal.",
  },
  {
    id: "rag",
    name: "RAG corpus build",
    weights: { s: 0.5, d: 0.35, m: 0.15 },
    rationale:
      "High volume. Weight the cheap deterministic signal and touch the " +
      "expensive semantic tier as rarely as possible.",
  },
];

export const DEFAULT_WEIGHTS: Weights = PROFILES[0].weights;

/** Clamp at the input level rather than validating after the fact (§6.3). */
export const clampWeight = (n: number): number =>
  Number.isFinite(n) ? clamp01(n) : 0;
