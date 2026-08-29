/* =========================================================================
   The threat taxonomy — PIPELINE_IMPROVEMENTS §3 (P1 table), rendered by §5.2.
   -------------------------------------------------------------------------
   This array is the SINGLE SOURCE for the hero's countable claim (§5.0) and
   the Act 2 bento grid. §5.2: "Act 0 claims ten vectors; this is the list.
   Keep the count in the two places synchronised — a hero that promises ten
   and a grid that shows eight is the kind of small inconsistency this
   audience notices and generalises from."

   The hero reads VECTOR_COUNT from here rather than hardcoding a numeral, so
   the two cannot drift. test/vectors.test.ts holds the invariant.
   ========================================================================= */
import type { VectorId } from "./types";

export interface Vector {
  id: VectorId;
  name: string;
  /** The 2x1 cells: the three vectors that defeat EVERY physical check. */
  hero: boolean;
  /** One line. Why it evades the naive checks. */
  mechanism: string;
  /** One line. How we catch it. */
  detection: string;
  /** The actual call that implements the check — a §5.9 trust signal,
      attached to the individual detection claim it supports. */
  call: string;
  /** Which pipeline phase resolves it. */
  phase: 1 | 2 | 3 | 4;
}

export const VECTORS: Vector[] = [
  {
    id: "render_mode_3tr",
    name: "Invisible render mode 3 Tr",
    hero: true,
    mechanism:
      "Text is standard 12pt solid black; the operator leaves it unrasterised. Passes colour and size checks.",
    detection:
      "Parse per-span graphics state and flag every span drawn under render mode 3.",
    call: 'page.get_text("rawdict") → span["render_mode"] == 3',
    phase: 2,
  },
  {
    id: "tounicode_cmap",
    name: "/ToUnicode CMap remapping",
    hero: true,
    mechanism:
      "Glyphs render benign text; the embedded CMap decodes to a payload. Defeats every physical check.",
    detection:
      "Only catchable by comparing what is rendered against what is extracted.",
    call: "page.get_pixmap() + OCR ↔ cleaned corpus → Jaccard, cosine",
    phase: 3,
  },
  {
    id: "actualtext_override",
    name: "/ActualText override",
    hero: true,
    mechanism:
      "The accessibility tree takes precedence in high-fidelity extractors; the visible text stays benign.",
    detection:
      "Traverse the tagged structure tree; flag overrides with no corresponding visible rendering.",
    call: "doc.get_toc() / structure tree → /ActualText, /Alt divergence",
    phase: 2,
  },
  {
    id: "extgstate_opacity",
    name: "Zero opacity via /ExtGState",
    hero: false,
    mechanism:
      "/ca (fill) or /CA (stroke) set to 0 leaves the RGB values untouched, so a colour check sees black text.",
    detection: "Inspect the ExtGState dictionary linked to each block; flag opacity ≈ 0.",
    call: 'span["alpha"] via rawdict → flag < 0.05',
    phase: 2,
  },
  {
    id: "z_order_occlusion",
    name: "Z-order occlusion",
    hero: false,
    mechanism:
      "The payload is drawn, then covered by an opaque image or vector. Coordinates are valid and on-page.",
    detection:
      "Compute text↔graphic bbox intersections; flag text enveloped by a higher-Z graphic.",
    call: "TEXT_PRESERVE_IMAGES | TEXT_COLLECT_VECTORS → bbox intersect",
    phase: 2,
  },
  {
    id: "hidden_ocg",
    name: "Hidden Optional Content Groups",
    hero: false,
    mechanism:
      "Layer visibility is set OFF; viewers skip the layer, extractors dump it anyway.",
    detection:
      "Build an OCG state map from layer metadata; omit OFF-layer spans from the corpus and flag them.",
    call: "doc.layer_ui_configs() → OCG state map",
    phase: 2,
  },
  {
    id: "unicode_obfuscation",
    name: "Zero-width chars, BIDI overrides",
    hero: false,
    mechanism:
      "Splits payload tokens with U+200B or U+FE00–FE0F to defeat regex and signature filters.",
    detection: "Unicode normalisation and category filtering over the extracted corpus.",
    call: 'unicodedata.normalize("NFKC", …) → category Cf',
    phase: 2,
  },
  {
    id: "metadata_channel",
    name: "Metadata, annotation, form channels",
    hero: false,
    mechanism:
      "/Annots contents, form defaults and XMP are ingested by naive RAG loaders and are invisible to readers.",
    detection: "Extract and scan these as separate corpora, not just page text.",
    call: "page.annots(), doc.xref_get_key(), doc.metadata",
    phase: 2,
  },
  {
    id: "image_steganography",
    name: "Image steganography, in-image text",
    hero: false,
    mechanism:
      "Targets downstream multimodal models rather than text extraction — no text layer is involved at all.",
    detection: "Chi-square test on pixel LSBs; a contrast-boosted secondary OCR pass.",
    call: "page.get_images() → χ² over LSB plane + OCR",
    phase: 3,
  },
  {
    id: "shadow_signature",
    name: "Shadow attacks on signed PDFs",
    hero: false,
    mechanism:
      "The payload is embedded before signing; activating it later does not break the signature.",
    detection:
      "Validate signatures and dismantle structure independently. A valid signature is never treated as trust.",
    call: "incremental-update chain walk + signature validation",
    phase: 1,
  },
];

/** The hero's countable claim. Derived, never typed as a literal. */
export const VECTOR_COUNT = VECTORS.length;

/** English numeral for the headline — "Ten ways a PDF can hide an instruction." */
const NUMERALS = [
  "Zero", "One", "Two", "Three", "Four", "Five",
  "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
];

export const VECTOR_COUNT_WORD =
  NUMERALS[VECTOR_COUNT] ?? String(VECTOR_COUNT);

export const HERO_VECTORS = VECTORS.filter((v) => v.hero);
export const STANDARD_VECTORS = VECTORS.filter((v) => !v.hero);
