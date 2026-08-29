/* =========================================================================
   Act 8 — the contract, and what we do not catch yet.
   FRONTEND_DESIGN.md §5.8, §5.9 · PIPELINE_IMPROVEMENTS.md §3, §5, §6, §10.1
   -------------------------------------------------------------------------
   §5.8: "Why the limitations section is not a liability: it is the strongest
   trust signal available to a project with no logos and no customers.
   Security professionals discount any tool that claims total coverage,
   because they know none exists."

   So this file is DATA, not prose buried in a component. Two reasons:
   test/act8-limitations.test.tsx can hold the invariants (non-empty, every
   entry names the stage that will address it, no fear vocabulary), and the
   list can be regenerated from the roadmap without touching the view.

   Every entry below is sourced from a numbered finding in
   PIPELINE_IMPROVEMENTS.md. Nothing here is estimated, softened, or invented.
   ========================================================================= */
import type { VectorId } from "./types";

/* --- The staged roadmap, PIPELINE_IMPROVEMENTS §6 ---------------------- */

export type Stage = 0 | 1 | 2 | 3 | 4;

export const STAGES: Record<Stage, string> = {
  0: "Stage 0 — make the current thing honest",
  1: "Stage 1 — close the P0s",
  2: "Stage 2 — structural depth (Phase 2)",
  3: "Stage 3 — the discrepancy gate (Phase 3)",
  4: "Stage 4 — semantic hierarchy and scoring (Phases 4–5)",
};

export const STAGE_ORDER: Stage[] = [0, 1, 2, 3, 4];

/** What kind of gap this is. Governs nothing but the reader's expectations —
    a missing detector and an uncalibrated threshold are not the same claim. */
export type LimitationKind =
  | "vector" /* a documented attack vector with no detector today */
  | "heuristic" /* an existing check that is wrong or too coarse */
  | "contract" /* the response contract itself is not yet served */
  | "calibration"; /* a number we have not measured */

export interface Limitation {
  id: string;
  /** What is not covered. Stated as a fact, not as a risk. */
  title: string;
  /** Why it is not covered, and what happens instead today. */
  detail: string;
  /** The stage of PIPELINE_IMPROVEMENTS §6 that will address it. */
  stage: Stage;
  kind: LimitationKind;
  /** Set when the gap maps onto an entry in the §3 P1 taxonomy. */
  vector: VectorId | null;
  /** The finding this is sourced from, so a reader can check it. */
  source: string;
}

/* -------------------------------------------------------------------------
   The list. Ordered by stage, because the reader's next question after
   "what don't you catch" is always "when".
   ------------------------------------------------------------------------- */

export const LIMITATIONS: Limitation[] = [
  /* --- Stage 0 — the things that make the current state honest --------- */
  {
    id: "no-corpus",
    title: "No adversarial corpus, so no measured coverage",
    detail:
      "Every vector in the taxonomy needs a crafted PDF and a benign near-miss twin — a real invoice with a footer, a CV set in 6 pt type, a scan carrying a legitimate 3 Tr OCR layer. Neither the positives nor the negatives exist yet, so no coverage figure and no false-positive rate has been measured. This is why the three stat slots higher up this page are empty.",
    stage: 0,
    kind: "calibration",
    vector: null,
    source: "PIPELINE_IMPROVEMENTS §6, cross-cutting · §8 open question 4",
  },
  {
    id: "fails-open-today",
    title: "The current endpoint fails open, not closed",
    detail:
      "The guarantee stated in the contract column is the target. Today an upstream outage, an auth failure, a schema change and a genuinely clean document all return the same empty string, so they are indistinguishable to a caller. Stage 0 replaces that fallback with a typed error and wraps both layers in handling that fails closed.",
    stage: 0,
    kind: "contract",
    vector: null,
    source: "PIPELINE_IMPROVEMENTS §3 P0-5",
  },
  {
    id: "evaluator-endpoint-unverified",
    title: "The evaluator's request and response shapes are unverified",
    detail:
      "The call names gemini-3.1-flash-lite and posts to /v1beta/interactions with an input[] array, parsing a steps[].content[] response. That does not match the generateContent shape. It has not been confirmed against current documentation, and combined with the fail-open fallback above, any mismatch degrades silently into a permanent clean result.",
    stage: 0,
    kind: "contract",
    vector: null,
    source: "PIPELINE_IMPROVEMENTS §3 P0-8",
  },

  /* --- Stage 1 — the P0s ------------------------------------------------ */
  {
    id: "no-verdict",
    title: "The live API returns no verdict, score or structured findings",
    detail:
      "POST /pdf_checker returns the model's raw free-form text. There is no risk score, no band, no findings array and nothing for a caller to branch on. The scanner on this site is therefore fixture-backed and labelled as such — it renders the target contract, not a live result.",
    stage: 1,
    kind: "contract",
    vector: null,
    source: "PIPELINE_IMPROVEMENTS §3 P0-4 · FRONTEND_DESIGN §10.1",
  },
  {
    id: "findings-not-passed",
    title: "Layer 1's findings never reach Layer 2",
    detail:
      "Layer 1 returns bytes and Layer 2 takes bytes, so which spans were suspicious, why, and at what coordinates is discarded between them. The only channel is a highlight annotation, which does not change what the model's own extraction reads.",
    stage: 1,
    kind: "contract",
    vector: null,
    source: "PIPELINE_IMPROVEMENTS §3 P0-2",
  },
  {
    id: "nothing-stripped",
    title: "Nothing is sanitised — flagged text is highlighted, not removed",
    detail:
      "Highlighting is a visual cue. It does not alter the content stream or change what any downstream extractor sees. A document leaving the pipeline today is exactly as extractable as it was on upload, plus some annotations. The cleaned corpus and the optional redacted artifact are both unbuilt.",
    stage: 1,
    kind: "contract",
    vector: null,
    source: "PIPELINE_IMPROVEMENTS §3 P0-3",
  },
  {
    id: "unbounded-ingestion",
    title: "Ingestion is unbounded",
    detail:
      "The upload is read whole into memory with no size cap, no page cap, no decompression-ratio guard and no parse timeout, and the content type is never verified. The client-side caps this site enforces are the intended server constants, not constants the server enforces yet.",
    stage: 1,
    kind: "contract",
    vector: null,
    source: "PIPELINE_IMPROVEMENTS §3 P0-6",
  },
  {
    id: "active-content",
    title: "Active content passes straight through",
    detail:
      "/JavaScript, /OpenAction, /Launch, XFA streams, embedded files and executable annotations are neither inspected nor stripped. The document is re-serialised including all of it, so the pipeline currently forwards active content rather than containing it.",
    stage: 1,
    kind: "contract",
    vector: null,
    source: "PIPELINE_IMPROVEMENTS §3 P0-7",
  },
  {
    id: "evaluator-injectable",
    title: "The generative evaluator is itself injectable",
    detail:
      "The cloud call sets an empty prompt and sends the whole document as its only input. There is no system prompt to override, no randomised delimiters, no embedded threat knowledge base and no enforced response schema, so the only natural-language instruction reaching the model is the one in the document.",
    stage: 1,
    kind: "contract",
    vector: null,
    source: "PIPELINE_IMPROVEMENTS §3 P0-1",
  },

  /* --- Stage 2 — the structural detectors ------------------------------- */
  {
    id: "render-mode-3tr",
    title: "Invisible render mode 3 Tr is not detected",
    detail:
      "The span is standard 12 pt solid black and sits inside the page; only the operator differs, and the current checks read colour, size and position. Detecting it needs per-span graphics state from get_text(\"rawdict\").",
    stage: 2,
    kind: "vector",
    vector: "render_mode_3tr",
    source: "PIPELINE_IMPROVEMENTS §3 P1 table · §5 Phase 2",
  },
  {
    id: "extgstate-opacity",
    title: "Zero opacity via /ExtGState is not detected",
    detail:
      "/ca and /CA set to 0 leave the RGB values untouched, so the colour check sees ordinary black text. The ExtGState dictionary linked to each block is never read.",
    stage: 2,
    kind: "vector",
    vector: "extgstate_opacity",
    source: "PIPELINE_IMPROVEMENTS §3 P1 table · §5 Phase 2",
  },
  {
    id: "z-order",
    title: "Z-order occlusion is not detected",
    detail:
      "Text drawn and then covered by an opaque image or vector has valid coordinates and sits on-page, so every current check passes it. Catching it needs text-to-graphic bbox intersections with TEXT_PRESERVE_IMAGES and TEXT_COLLECT_VECTORS.",
    stage: 2,
    kind: "vector",
    vector: "z_order_occlusion",
    source: "PIPELINE_IMPROVEMENTS §3 P1 table · §5 Phase 2",
  },
  {
    id: "hidden-ocg",
    title: "Hidden Optional Content Groups are not detected",
    detail:
      "A layer switched off is skipped by viewers and dumped by extractors. No OCG state map is built, so off-layer spans enter the corpus unflagged.",
    stage: 2,
    kind: "vector",
    vector: "hidden_ocg",
    source: "PIPELINE_IMPROVEMENTS §3 P1 table · §5 Phase 2",
  },
  {
    id: "actualtext",
    title: "/ActualText and /Alt overrides are not detected",
    detail:
      "High-fidelity extractors prefer the accessibility tree while the visible text stays ordinary. The tagged structure tree is never traversed. Phase 3's render-versus-extract comparison catches this too, so it is covered twice once both stages land.",
    stage: 2,
    kind: "vector",
    vector: "actualtext_override",
    source: "PIPELINE_IMPROVEMENTS §3 P1 table · §5 Phase 2",
  },
  {
    id: "unicode",
    title: "Zero-width characters and BIDI overrides are not normalised",
    detail:
      "U+200B, variation selectors U+FE00–FE0F and direction overrides split payload tokens and defeat signature matching. No Unicode normalisation or category filtering runs over the extracted text.",
    stage: 2,
    kind: "vector",
    vector: "unicode_obfuscation",
    source: "PIPELINE_IMPROVEMENTS §3 P1 table · §5 Phase 2",
  },
  {
    id: "metadata-channels",
    title: "Metadata, annotation and form-field channels are not scanned",
    detail:
      "/Annots contents, form defaults and XMP are ingested by naive loaders and are invisible to a reader. Only page text is read today; these need scanning as separate corpora.",
    stage: 2,
    kind: "vector",
    vector: "metadata_channel",
    source: "PIPELINE_IMPROVEMENTS §3 P1 table · §5 Phase 2",
  },
  {
    id: "near-border",
    title: "The margin check flags ordinary page furniture",
    detail:
      "Any span touching a 20 pt band inside any edge is flagged, which catches page numbers, running headers, footers and full-bleed layouts. Every source document specifies out-of-bounds detection instead. It becomes a genuine CropBox containment test, with proximity demoted to a small weighted factor.",
    stage: 2,
    kind: "heuristic",
    vector: null,
    source: "PIPELINE_IMPROVEMENTS §3 P1 — quality of existing heuristics",
  },
  {
    id: "near-white",
    title: "The near-white check ignores what is behind the text",
    detail:
      "min(r, g, b) ≥ 235 flags light text regardless of its backing colour. White-on-white is the attack; white-on-dark is ordinary design, and both are flagged identically. Stroke colour and render mode are not read at all — span colour is fill only.",
    stage: 2,
    kind: "heuristic",
    vector: null,
    source: "PIPELINE_IMPROVEMENTS §3 P1 — quality of existing heuristics",
  },
  {
    id: "font-threshold",
    title: "The font-size threshold is binary and arbitrary",
    detail:
      "The code flags under 4.0 pt and the written specification says 2.0 pt. Either way a 5 pt payload walks through untouched. It becomes a continuous contribution to the score, weighted by how much of the document sits at that size.",
    stage: 2,
    kind: "heuristic",
    vector: null,
    source: "PIPELINE_IMPROVEMENTS §3 P1 — quality of existing heuristics",
  },

  /* --- Stage 3 — the discrepancy gate ----------------------------------- */
  {
    id: "tounicode",
    title: "/ToUnicode CMap remapping is not detected",
    detail:
      "The glyphs render one sentence and the embedded CMap decodes to another. It defeats every physical check by construction, and the only answer is comparing OCR over the rendered page against the extracted corpus. That gate does not exist yet, so the divergence numbers on this site come from fixtures.",
    stage: 3,
    kind: "vector",
    vector: "tounicode_cmap",
    source: "PIPELINE_IMPROVEMENTS §3 P1 table · §5 Phase 3",
  },
  {
    id: "image-steg",
    title: "Image steganography and in-image text are not examined",
    detail:
      "These target a downstream multimodal model rather than text extraction, so no text layer is involved and nothing in the current pipeline looks. Both the chi-square test over pixel LSBs and the contrast-boosted secondary OCR pass are unbuilt.",
    stage: 3,
    kind: "vector",
    vector: "image_steganography",
    source: "PIPELINE_IMPROVEMENTS §3 P1 table · §5 Phase 3",
  },
  {
    id: "shadow-signature",
    title: "Signatures on signed PDFs are not validated",
    detail:
      "A payload embedded before signing can be activated later without invalidating the signature. Nothing validates signatures or walks the incremental-update chain today. This one is explicitly deferred as real but narrow, and is scheduled after the discrepancy gate rather than alongside it.",
    stage: 3,
    kind: "vector",
    vector: "shadow_signature",
    source: "PIPELINE_IMPROVEMENTS §3 P1 table · §7 deferred",
  },

  /* --- Stage 4 — scoring and the semantic hierarchy --------------------- */
  {
    id: "bands-uncalibrated",
    title: "The band boundaries are proposed, not calibrated",
    detail:
      "R < 0.30, 0.30 ≤ R < 0.70 and R ≥ 0.70 are a starting point. The thresholds in the source documents were rendered as images and did not survive text export, and the corpus they must be calibrated against does not exist. Every surface on this site that shows a band says so.",
    stage: 4,
    kind: "calibration",
    vector: null,
    source: "PIPELINE_IMPROVEMENTS §5 Phase 5 · FRONTEND_DESIGN §5.5",
  },
  {
    id: "weights-unmeasured",
    title: "The deployment weights are arguments, not measurements",
    detail:
      "The preset profiles above encode a position on where false positives cost more than false negatives. That question is open, and until the corpus exists the weights express a judgement about a deployment rather than a fitted parameter.",
    stage: 4,
    kind: "calibration",
    vector: null,
    source: "PIPELINE_IMPROVEMENTS §8 open question 4",
  },
  {
    id: "no-local-classifier",
    title: "There is no local classifier tier",
    detail:
      "Every semantic decision reaches a cloud model. The deterministic signature pass and the encoder-only classifier that should absorb most documents before that point are both unbuilt, so there is no non-generative tier and no air-gapped path.",
    stage: 4,
    kind: "contract",
    vector: null,
    source: "PIPELINE_IMPROVEMENTS §5 Phase 4 · §8 open question 3",
  },
];

/** Group for rendering. Stages with no entries are omitted rather than shown empty. */
export function limitationsByStage(): {
  stage: Stage;
  label: string;
  items: Limitation[];
}[] {
  return STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGES[stage],
    items: LIMITATIONS.filter((l) => l.stage === stage),
  })).filter((g) => g.items.length > 0);
}

/* =========================================================================
   The contract — §5.8 left column.
   ========================================================================= */

/** §5.8, stated plainly and without hedging. The single sentence a caller
    integrating a security control needs to be able to rely on. */
export const FAIL_CLOSED =
  "Any unresolved error maps to REVIEW or BLOCKED, never SAFE.";

/** §5.9's pattern: the qualifier sits beside the claim it qualifies, so it
    reads as precision rather than as a disclaimer. */
export const CONTRACT_STATUS =
  "This is the Phase 6 target contract, and the schema this site renders from. The endpoint that exists today is POST /pdf_checker, which returns a free-form string — see the column beside this one.";

export const CURL_EXAMPLE = `# Streaming: phases arrive as they complete (SSE).
curl -sS -X POST "$SANITX_HOST/v1/scan" \\
  -H "Accept: text/event-stream" \\
  -F "file=@resume.pdf" \\
  -F 'weights={"s":0.33,"d":0.35,"m":0.32}'

# Non-streaming: omit the Accept header, receive one ScanResponse.
curl -sS -X POST "$SANITX_HOST/v1/scan" -F "file=@resume.pdf"`;

export interface SchemaField {
  /** Dotted path as it appears in the JSON body. */
  path: string;
  type: string;
  note: string;
}

/* Derived field-for-field from ScanResponse in lib/types.ts. §9.3: the
   narrative site renders the real contract rather than a drawing of it, so
   this table cannot promise a field the type does not carry. */
export const RESPONSE_SCHEMA: SchemaField[] = [
  { path: "scanId", type: "string", note: "Opaque id for this scan." },
  {
    path: "document",
    type: "{ filename, pages, bytes, sha256 }",
    note: "Content hash is the provenance anchor for the audit log.",
  },
  {
    path: "verdict",
    type: '"SAFE" | "REVIEW" | "BLOCKED"',
    note: "The three bands. REVIEW means quarantined, not cleared.",
  },
  {
    path: "score",
    type: "number 0–1",
    note: "R = clamp(0, 1, w_s·S + w_d·D + w_m·M).",
  },
  {
    path: "components",
    type: "{ s, d, m }",
    note: "Structural, divergence, semantic. Each 0–1, before weighting.",
  },
  {
    path: "weights",
    type: "{ s, d, m }",
    note: "Echoed back, so a caller can recompute R itself.",
  },
  {
    path: "findings[].id",
    type: "string",
    note: "Stable within a scan; used to address a finding.",
  },
  {
    path: "findings[].vector",
    type: "VectorId",
    note: "Closed union over the documented taxonomy — never a free string.",
  },
  {
    path: "findings[].label",
    type: "string",
    note: 'Short list label, e.g. "3 Tr".',
  },
  {
    path: "findings[].severity",
    type: '"info" | "low" | "medium" | "high" | "critical"',
    note: "Independent of verdict; a critical finding can still land in REVIEW.",
  },
  {
    path: "findings[].score",
    type: "number 0–1",
    note: "Contribution to this finding's component score.",
  },
  { path: "findings[].page", type: "integer", note: "1-based." },
  {
    path: "findings[].bbox",
    type: "{ page, x0, y0, x1, y1 } | null",
    note: "PDF user space, origin top-left, as PyMuPDF reports it.",
  },
  {
    path: "findings[].snippet",
    type: "string | null",
    note: "The offending span, verbatim. Null when the finding carries no text.",
  },
  {
    path: "findings[].reasonCodes",
    type: "string[]",
    note: 'Machine-readable, e.g. ["RENDER_MODE_3", "OFFPAGE"].',
  },
  {
    path: "findings[].mitre",
    type: "string | null",
    note: "ATT&CK technique where mapped, for SOC consumers.",
  },
  { path: "findings[].detail", type: "string", note: "One paragraph, for a human." },
  {
    path: "phases[]",
    type: "{ id, name, status, ms, readout, error }",
    note: "Six rows. ms is per-phase cost; error is set when status is failed.",
  },
  {
    path: "divergence",
    type: "{ jaccard, cosine, …Threshold, rendered[], extracted[] } | null",
    note: "Phase 3. Null when the gate did not run.",
  },
  {
    path: "tiers",
    type: "{ tier1, tier2, tier3, costPerDoc } | null",
    note: "Phase 4 funnel counts and cost per document.",
  },
  {
    path: "checksRun",
    type: "string[]",
    note: "What actually ran. A clean result lists these instead of celebrating.",
  },
  { path: "totalMs", type: "integer", note: "Wall clock for the whole scan." },
  {
    path: "demo",
    type: "boolean",
    note: "True when the body came from a fixture. Rendered visibly, never suppressed.",
  },
];

export interface ApiError {
  code: string;
  http: number;
  meaning: string;
  /** What the caller receives. Never SAFE — that is the guarantee. */
  outcome: string;
}

/* The taxonomy replaces the current single untyped failure mode, in which an
   outage and a clean document are indistinguishable (P0-5). Each row states
   its outcome explicitly so the guarantee is checkable rather than asserted. */
export const ERROR_TAXONOMY: ApiError[] = [
  {
    code: "UNSUPPORTED_MEDIA_TYPE",
    http: 415,
    meaning: "Content type is not application/pdf, or the %PDF- header is absent.",
    outcome: "Refused before parse. No verdict is issued.",
  },
  {
    code: "PAYLOAD_TOO_LARGE",
    http: 413,
    meaning: "Upload exceeds the size cap. The limit is named in the body.",
    outcome: "Refused before parse. No verdict is issued.",
  },
  {
    code: "PAGE_LIMIT_EXCEEDED",
    http: 422,
    meaning: "Page count exceeds the cap enforced during parse.",
    outcome: "Refused. No verdict is issued.",
  },
  {
    code: "DECOMPRESSION_QUOTA",
    http: 422,
    meaning: "Decompressed-to-compressed ratio crossed the guard mid-parse.",
    outcome: "BLOCKED. The quota is itself a signal.",
  },
  {
    code: "PARSE_TIMEOUT",
    http: 504,
    meaning: "Wall-clock parse budget elapsed.",
    outcome: "REVIEW. The document was not cleared.",
  },
  {
    code: "PARSE_FAILED",
    http: 422,
    meaning: "The object tree could not be read.",
    outcome: "REVIEW. The document was not cleared.",
  },
  {
    code: "PHASE_FAILED",
    http: 200,
    meaning:
      "One phase errored. Completed phases keep their results; the failed row names itself.",
    outcome: "REVIEW, with the failing phase stated in the body.",
  },
  {
    code: "EVALUATOR_UNAVAILABLE",
    http: 503,
    meaning: "The semantic tier is unreachable or disabled by configuration.",
    outcome: "REVIEW when the earlier phases are clean; the stronger band otherwise.",
  },
  {
    code: "INTERNAL",
    http: 500,
    meaning: "Anything not enumerated above.",
    outcome: "REVIEW. An unnamed failure is never a pass.",
  },
];
