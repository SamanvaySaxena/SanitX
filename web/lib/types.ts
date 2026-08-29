/* =========================================================================
   The one contract, both zones — FRONTEND_DESIGN.md §9.3
   -------------------------------------------------------------------------
   Zone A's Acts 3-5 and Zone B's scanner render from THESE types. They mirror
   the target response contract in PIPELINE_IMPROVEMENTS.md Phase 6 (verdict,
   score, component scores, per-finding type/severity/bbox/snippet, timings)
   and are the reason the narrative site cannot drift into promising fields
   that do not exist. When the backend's Pydantic models land, generate this
   file from them rather than editing it by hand.
   ========================================================================= */

/** §5 of PIPELINE_IMPROVEMENTS — the three verdict bands. */
export type Verdict = "SAFE" | "REVIEW" | "BLOCKED";

/** Severity is independent of verdict: a document can carry a high-severity
    finding and still land in REVIEW once weights are applied. */
export type Severity = "info" | "low" | "medium" | "high" | "critical";

/** The ten vectors of PIPELINE_IMPROVEMENTS §3 (P1). Kept as a closed union
    so a finding can never carry a category the taxonomy does not document. */
export type VectorId =
  | "render_mode_3tr"
  | "extgstate_opacity"
  | "z_order_occlusion"
  | "hidden_ocg"
  | "tounicode_cmap"
  | "actualtext_override"
  | "unicode_obfuscation"
  | "metadata_channel"
  | "image_steganography"
  | "shadow_signature";

/** PDF user-space coordinates, origin top-left, as PyMuPDF reports them. */
export interface BBox {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Finding {
  id: string;
  vector: VectorId;
  /** Short label as shown in the findings list, e.g. "3 Tr". */
  label: string;
  severity: Severity;
  /** 0-1 contribution this finding makes to its component score. */
  score: number;
  page: number;
  bbox: BBox | null;
  /** The offending span, verbatim from the document. Always set in mono. */
  snippet: string | null;
  /** Machine-readable reason codes, e.g. ["RENDER_MODE_3", "OFFPAGE"]. */
  reasonCodes: string[];
  /** MITRE ATT&CK technique where mapped (D3, for SOC consumers). */
  mitre: string | null;
  detail: string;
}

/** The six phases of PIPELINE_IMPROVEMENTS §5. The scanner's phase ledger
    (§6.2) and Act 3's six scenes (§5.3) are the same six rows. */
export type PhaseId = 1 | 2 | 3 | 4 | 5 | 6;
export type PhaseStatus = "pending" | "running" | "complete" | "failed";

export interface Phase {
  id: PhaseId;
  name: string;
  status: PhaseStatus;
  /** Milliseconds. Null until the phase completes. Engineers want per-phase cost. */
  ms: number | null;
  /** Short mono readout shown beside the row, e.g. "1,284 spans · 9 anomalous". */
  readout: string | null;
  /** Set when status is "failed". The UI must name the phase and say the
      document was NOT cleared (§6.3, fail-closed messaging). */
  error: string | null;
}

/** Phase 3 — the render-extract discrepancy gate. The money shot's data. */
export interface Divergence {
  /** Lexical overlap, Jaccard index over token sets. 1.00 = identical. */
  jaccard: number;
  /** Semantic invariance, cosine over sentence-transformer embeddings. */
  cosine: number;
  jaccardThreshold: number;
  cosineThreshold: number;
  /** What a person reads — Path A, OCR over the rendered pixmap. */
  rendered: string[];
  /** What the model ingests — Path B, the cleaned corpus from Phase 2. */
  extracted: string[];
}

/** Phase 4's three-tier funnel. A cost architecture, not a screen (§5.3 scene 4). */
export interface TierBreakdown {
  tier1: number;
  tier2: number;
  tier3: number;
  costPerDoc: number;
}

/** Phase 5 — R = clamp(0, 1, w_s·S + w_d·D + w_m·M). */
export interface ComponentScores {
  /** Structural anomaly score, from Phase 2. */
  s: number;
  /** Divergence penalty, from Phase 3. */
  d: number;
  /** Semantic confidence, from Phase 4. */
  m: number;
}

export interface Weights {
  s: number;
  d: number;
  m: number;
}

export interface DocumentMeta {
  filename: string;
  pages: number;
  bytes: number;
  sha256: string;
}

export interface ScanResponse {
  scanId: string;
  document: DocumentMeta;
  verdict: Verdict;
  /** The composite R. */
  score: number;
  components: ComponentScores;
  weights: Weights;
  findings: Finding[];
  phases: Phase[];
  divergence: Divergence | null;
  tiers: TierBreakdown | null;
  /** Checks that ran. A clean result lists these instead of celebrating (§6.5). */
  checksRun: string[];
  totalMs: number;
  /** True when served from lib/fixtures. The UI must label this visibly
      (§10.2) — a security tool that silently shows fabricated verdicts is
      not a mock, it is a misrepresentation. */
  demo: boolean;
}

/** SSE frame shape (§6.2). Phases stream as they complete; the verdict lands last. */
export type ScanEvent =
  | { type: "document"; document: DocumentMeta }
  | { type: "phase"; phase: Phase }
  | { type: "findings"; findings: Finding[] }
  | { type: "divergence"; divergence: Divergence }
  | { type: "tiers"; tiers: TierBreakdown }
  | { type: "verdict"; response: ScanResponse }
  | { type: "error"; phase: PhaseId | null; message: string };
