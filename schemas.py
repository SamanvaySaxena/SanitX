from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


# Mirrors web/lib/types.ts. If this backend contract changes, regenerate the
# TypeScript contract from these Pydantic models instead of editing by hand.
class Base(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


Verdict = Literal["SAFE", "REVIEW", "BLOCKED"]
Severity = Literal["info", "low", "medium", "high", "critical"]
VectorId = Literal[
    "render_mode_3tr",
    "extgstate_opacity",
    "z_order_occlusion",
    "hidden_ocg",
    "tounicode_cmap",
    "actualtext_override",
    "unicode_obfuscation",
    "metadata_channel",
    "image_steganography",
    "shadow_signature",
    "small_text",
    "low_contrast",
    "near_border",
    "semantic_injection",
    # Markdown vectors. The Markdown source has no glyphs to measure, so the
    # hiding techniques differ in kind, not just in coordinates: text is
    # concealed by the *renderer* (comments, CSS) rather than by ink.
    "hidden_html_comment",
    "hidden_css_style",
    "active_html_embed",
    "suspicious_uri",
]
DocumentKind = Literal["pdf", "markdown"]
PhaseId = Literal[1, 2, 3, 4, 5, 6]
PhaseStatus = Literal["pending", "running", "complete", "failed"]


class BBox(Base):
    page: int
    x0: float
    y0: float
    x1: float
    y1: float


class Finding(Base):
    id: str
    vector: VectorId
    label: str
    severity: Severity
    score: float
    page: int
    bbox: BBox | None
    # Markdown findings anchor to a 1-based source line instead of a bbox;
    # PDF findings leave this null and anchor to `bbox`.
    line: int | None = None
    snippet: str | None
    reason_codes: list[str]
    mitre: str | None
    detail: str


class Phase(Base):
    id: PhaseId
    name: str
    status: PhaseStatus
    ms: int | None
    readout: str | None
    error: str | None


class Divergence(Base):
    jaccard: float
    cosine: float
    jaccard_threshold: float
    cosine_threshold: float
    rendered: list[str]
    extracted: list[str]


class TierBreakdown(Base):
    tier1: int
    tier2: int
    tier3: int
    cost_per_doc: float


class ComponentScores(Base):
    s: float
    d: float
    m: float


class Weights(Base):
    s: float
    d: float
    m: float


class DocumentMeta(Base):
    filename: str
    # Which pipeline produced this scan. The preview pane renders a page
    # raster for "pdf" and the annotated source for "markdown", so it has to
    # come from the response rather than be re-guessed from the filename.
    kind: DocumentKind = "pdf"
    pages: int
    bytes: int
    sha256: str
    # Markdown only: total source lines. Null for PDFs, where `pages` is the
    # unit of navigation.
    lines: int | None = None


class ScanResponse(Base):
    scan_id: str
    document: DocumentMeta
    verdict: Verdict
    score: float
    components: ComponentScores
    weights: Weights
    findings: list[Finding]
    phases: list[Phase]
    divergence: Divergence | None
    tiers: TierBreakdown | None
    checks_run: list[str]
    total_ms: int
    demo: bool


class DocumentEvent(Base):
    type: Literal["document"]
    document: DocumentMeta


class PhaseEvent(Base):
    type: Literal["phase"]
    phase: Phase


class FindingsEvent(Base):
    type: Literal["findings"]
    findings: list[Finding]


class DivergenceEvent(Base):
    type: Literal["divergence"]
    divergence: Divergence


class TiersEvent(Base):
    type: Literal["tiers"]
    tiers: TierBreakdown


class VerdictEvent(Base):
    type: Literal["verdict"]
    response: ScanResponse


class ErrorEvent(Base):
    type: Literal["error"]
    phase: PhaseId | None
    message: str


class SemanticEvidence(Base):
    page: int | None = None
    bbox: list[float] | None = None
    # Markdown evidence anchors to a source line instead of a bbox.
    line: int | None = None
    description: str = ""
    snippet: str | None = None


class SemanticDecision(Base):
    decision: Literal["ACCEPT", "REVIEW", "REJECT"]
    confidence: float = Field(ge=0, le=1)
    reason: str
    evidence: list[SemanticEvidence] = Field(default_factory=list)
