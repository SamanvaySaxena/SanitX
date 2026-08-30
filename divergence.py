import math
import re
from collections import Counter
from dataclasses import dataclass

from schemas import Divergence


TOKEN_RE = re.compile(r"[A-Za-z0-9_']+")


@dataclass(frozen=True)
class TextSpan:
    page: int
    line: int
    text: str
    reasons: tuple[str, ...]
    bbox: tuple[float, float, float, float] | None = None


def tokenize(lines: list[str]) -> list[str]:
    return [m.group(0).lower() for line in lines for m in TOKEN_RE.finditer(line)]


def jaccard(tokens_a: list[str], tokens_b: list[str]) -> float:
    set_a = set(tokens_a)
    set_b = set(tokens_b)
    if not set_a and not set_b:
        return 1.0
    if not set_a or not set_b:
        return 0.0
    return len(set_a & set_b) / len(set_a | set_b)


def cosine(tokens_a: list[str], tokens_b: list[str]) -> float:
    counts_a = Counter(tokens_a)
    counts_b = Counter(tokens_b)
    if not counts_a and not counts_b:
        return 1.0
    if not counts_a or not counts_b:
        return 0.0
    keys = set(counts_a) | set(counts_b)
    dot = sum(counts_a[k] * counts_b[k] for k in keys)
    norm_a = math.sqrt(sum(v * v for v in counts_a.values()))
    norm_b = math.sqrt(sum(v * v for v in counts_b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _line_lists(spans: list[TextSpan]) -> tuple[list[str], list[str]]:
    rendered: dict[tuple[int, int], list[str]] = {}
    extracted: dict[tuple[int, int], list[str]] = {}

    for span in spans:
        key = (span.page, span.line)
        text = span.text.strip()
        if not text:
            continue
        extracted.setdefault(key, []).append(text)
        hidden_reasons = {
            # PDF: hidden by ink, size or paint order.
            "small_text",
            "low_contrast",
            "z_order_occlusion",
            "unicode_obfuscation",
            # Markdown: hidden by the renderer. An HTML comment or a
            # display:none span never reaches the reader's eye but is fully
            # present in the source an LLM ingests — the same
            # rendered/extracted split, one layer up.
            "hidden_html_comment",
            "hidden_css_style",
            "active_html_embed",
        }
        if not hidden_reasons.intersection(span.reasons):
            rendered.setdefault(key, []).append(text)

    def flatten(lines: dict[tuple[int, int], list[str]]) -> list[str]:
        return [" ".join(parts) for _, parts in sorted(lines.items())]

    return flatten(rendered), flatten(extracted)


def compute_divergence(spans: list[TextSpan]) -> Divergence:
    rendered, extracted = _line_lists(spans)
    tokens_a = tokenize(rendered)
    tokens_b = tokenize(extracted)
    return Divergence(
        jaccard=round(jaccard(tokens_a, tokens_b), 4),
        cosine=round(cosine(tokens_a, tokens_b), 4),
        jaccard_threshold=0.70,
        cosine_threshold=0.80,
        rendered=rendered,
        extracted=extracted,
    )
