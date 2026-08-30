"""
Markdown ingestion and structural scan — the Markdown half of pipeline.py.

WHY THIS EXISTS SEPARATELY. `pipeline.py` is a PDF pipeline all the way down:
it measures glyph size, samples background pixels, and reads paint order.
Markdown has none of those. What it has is a *source* that a reader never
sees and a *rendering* that hides part of it — which is the same attack, one
layer up. A comment, a `display:none` span or a zero-width character is
invisible to the human reviewing the file and fully present in the text an
LLM ingests.

So the vectors differ, but the two phases the pipeline needs are identical in
shape:

  Phase 1 (hardened ingestion)  strip the executable constructs and count
                                what was removed
  Phase 2 (structural scan)     emit Findings and TextSpans

TextSpans are emitted at SUB-LINE granularity, split into the visible
remainder and each hidden segment, both keyed to the same source line. That is
what lets `divergence.compute_divergence` — written for PDF — compute a real
rendered-vs-extracted split for Markdown without knowing anything about it:
the extracted list gets the whole line, the rendered list gets only the part a
reader would actually see.

The detection heuristics here are the ones `inspect_pdf._layer_1_markdown`
already used; this module makes them produce the structured contract
(`Finding`, `TextSpan`) that the streaming pipeline and the frontend speak.
"""

import re
import unicodedata

from divergence import TextSpan
from schemas import Finding

MARKDOWN_EXTENSIONS = (".md", ".markdown", ".mdown", ".mkd")

# Zero-width and directional characters: invisible to a reader, part of the
# token stream for anything parsing the source. The Markdown counterpart of
# the PDF "small_text" vector.
INVISIBLE_CHARS_PATTERN = re.compile(
    "[​‌‍‎‏⁠﻿­"
    "᠎⁡⁢⁣⁤]"
)

# Never rendered, always extracted. The single most common way to smuggle an
# instruction through a Markdown document.
HTML_COMMENT_PATTERN = re.compile(r"<!--.*?-->", re.DOTALL)

_HIDDEN_STYLE_DECL = (
    r"display\s*:\s*none"
    r"|visibility\s*:\s*hidden"
    r"|font-size\s*:\s*0"
    r"|opacity\s*:\s*0"
)

# The whole element, so its text content can be subtracted from the rendered
# line rather than just the attribute that hides it.
HIDDEN_STYLE_ELEMENT_PATTERN = re.compile(
    r"<(\w+)[^>]*style\s*=\s*[\"'][^\"']*(?:" + _HIDDEN_STYLE_DECL + r")[^\"']*[\"'][^>]*>"
    r"(?:.*?</\1\s*>)?",
    re.IGNORECASE | re.DOTALL,
)

# Fallback for a hidden style on an element this line does not close.
HIDDEN_STYLE_PATTERN = re.compile(
    r"style\s*=\s*[\"'][^\"']*(?:" + _HIDDEN_STYLE_DECL + r")[^\"']*[\"']",
    re.IGNORECASE,
)

ACTIVE_HTML_TAG_PATTERN = re.compile(
    r"<\s*(script|iframe|object|embed|link|meta)\b[^>]*>",
    re.IGNORECASE,
)

# The whole element, body included. Stripping only the opening tag would leave
# the script body sitting in the text as prose and the closing tag behind it,
# which is exactly the payload the strip exists to contain.
ACTIVE_HTML_ELEMENT_PATTERN = re.compile(
    r"<\s*(script|iframe|object|embed)\b[^>]*>.*?</\s*\1\s*>",
    re.IGNORECASE | re.DOTALL,
)

# A closing tag whose opener was already removed, or which never had one.
ORPHAN_CLOSING_TAG_PATTERN = re.compile(
    r"</\s*(script|iframe|object|embed|link|meta)\s*>",
    re.IGNORECASE,
)

SUSPICIOUS_URI_PATTERN = re.compile(r"(javascript|data|vbscript)\s*:", re.IGNORECASE)

# Mirrors pipeline.BIDI_CONTROLS. Right-to-left overrides reverse how a line
# reads on screen while leaving the code points in source order.
BIDI_CONTROLS = {
    "‪", "‫", "‬", "‭", "‮",
    "⁦", "⁧", "⁨", "⁩",
}


def is_markdown(filename: str, content_type: str = "") -> bool:
    name = (filename or "").lower()
    return name.endswith(MARKDOWN_EXTENSIONS) or "markdown" in (content_type or "").lower()


def has_unicode_obfuscation(text: str) -> bool:
    """Same test as pipeline._has_unicode_obfuscation, minus the reversed-word
    heuristic, which is a PDF-span signal and produces noise on prose."""
    if any(ch in BIDI_CONTROLS for ch in text):
        return True
    return any(unicodedata.category(ch) == "Cf" for ch in text)


def strip_active_content(text: str) -> tuple[str, int]:
    """
    Contain executable content instead of passing it through — the Markdown
    equivalent of pipeline._strip_active_content. Returns the sanitised source
    and the number of constructs neutralised, which is what phase 1 reports.
    """
    removed = 0

    def _strip(_match: re.Match[str]) -> str:
        nonlocal removed
        removed += 1
        return "[STRIPPED_ACTIVE_CONTENT]"

    def _uri(_match: re.Match[str]) -> str:
        nonlocal removed
        removed += 1
        return "stripped-uri:"

    # Whole elements first, so <script>payload</script> goes as one unit.
    sanitized = ACTIVE_HTML_ELEMENT_PATTERN.sub(_strip, text)
    # Then whatever is left: void tags (link, meta) and unclosed openers.
    sanitized = ACTIVE_HTML_TAG_PATTERN.sub(_strip, sanitized)
    # Orphaned closers are debris from the two passes above, not a separate
    # construct, so they are removed without inflating the count.
    sanitized = ORPHAN_CLOSING_TAG_PATTERN.sub("", sanitized)
    sanitized = SUSPICIOUS_URI_PATTERN.sub(_uri, sanitized)
    return sanitized, removed


def _hidden_segments(line: str) -> list[tuple[int, int, str]]:
    """Spans of the line that are present in the source but never rendered,
    as (start, end, reason), merged so overlaps are not counted twice."""
    raw: list[tuple[int, int, str]] = []

    for match in HTML_COMMENT_PATTERN.finditer(line):
        raw.append((match.start(), match.end(), "hidden_html_comment"))

    for match in HIDDEN_STYLE_ELEMENT_PATTERN.finditer(line):
        raw.append((match.start(), match.end(), "hidden_css_style"))

    # A script or iframe body is never rendered as prose either, so it belongs
    # on the extracted-not-rendered side of the divergence gate along with the
    # comments — not just in the findings list.
    for match in ACTIVE_HTML_ELEMENT_PATTERN.finditer(line):
        raw.append((match.start(), match.end(), "active_html_embed"))

    if not any(reason == "hidden_css_style" for _, _, reason in raw):
        for match in HIDDEN_STYLE_PATTERN.finditer(line):
            raw.append((match.start(), match.end(), "hidden_css_style"))

    raw.sort()
    merged: list[tuple[int, int, str]] = []
    for start, end, reason in raw:
        if merged and start < merged[-1][1]:
            prev_start, prev_end, prev_reason = merged[-1]
            merged[-1] = (prev_start, max(prev_end, end), prev_reason)
            continue
        merged.append((start, end, reason))
    return merged


def _visible_remainder(line: str, hidden: list[tuple[int, int, str]]) -> str:
    """What a reader actually sees: the line with every hidden segment cut out."""
    if not hidden:
        return line
    out: list[str] = []
    cursor = 0
    for start, end, _ in hidden:
        out.append(line[cursor:start])
        cursor = end
    out.append(line[cursor:])
    return "".join(out)


def _visible_reasons(visible: str) -> list[str]:
    """Reasons that apply to the part of the line that IS rendered — the text
    is on screen, but not as it appears."""
    reasons: list[str] = []
    if INVISIBLE_CHARS_PATTERN.search(visible) or has_unicode_obfuscation(visible):
        reasons.append("unicode_obfuscation")
    if ACTIVE_HTML_TAG_PATTERN.search(visible):
        reasons.append("active_html_embed")
    if SUSPICIOUS_URI_PATTERN.search(visible):
        reasons.append("suspicious_uri")
    return reasons


def structural_scan(
    text: str,
    finding_factory,
) -> tuple[list[Finding], list[TextSpan], int]:
    """
    Emit findings and spans for a Markdown source.

    `finding_factory(reasons, line_no, snippet, detail) -> Finding` is supplied
    by pipeline.py so the scoring, severity and labelling rules stay in ONE
    place across both document kinds — a Markdown finding must be scored by
    the same function a PDF finding is, or the two verdicts are not comparable.

    Returns (findings, spans, total_lines). `total_lines` counts non-blank
    source lines, which is what phase 2's readout reports.
    """
    findings: list[Finding] = []
    spans: list[TextSpan] = []
    total_lines = 0

    for line_no, line in enumerate(text.split("\n"), start=1):
        if not line.strip():
            continue
        total_lines += 1

        hidden = _hidden_segments(line)
        visible = _visible_remainder(line, hidden)
        visible_reasons = _visible_reasons(visible)

        # The rendered half of the divergence pair. Reasons here mark text
        # that IS on screen but is not what it looks like, exactly as a PDF
        # span carrying `unicode_obfuscation` does.
        if visible.strip():
            spans.append(
                TextSpan(
                    page=1,
                    line=line_no,
                    text=visible.strip(),
                    reasons=tuple(visible_reasons),
                )
            )
        if visible_reasons:
            findings.append(
                finding_factory(
                    visible_reasons,
                    line_no,
                    visible.strip()[:500],
                    f"Line {line_no} was flagged for {', '.join(visible_reasons)}.",
                )
            )

        # The extracted-only half: present in the source, absent from the
        # rendering. Same line key, so divergence pairs them.
        for start, end, reason in hidden:
            segment = line[start:end]
            if not segment.strip():
                continue
            spans.append(
                TextSpan(page=1, line=line_no, text=segment.strip(), reasons=(reason,))
            )
            reasons = [reason]
            if has_unicode_obfuscation(segment) or INVISIBLE_CHARS_PATTERN.search(segment):
                reasons.append("unicode_obfuscation")
            if SUSPICIOUS_URI_PATTERN.search(segment):
                reasons.append("suspicious_uri")
            findings.append(
                finding_factory(
                    reasons,
                    line_no,
                    segment.strip()[:500],
                    f"Line {line_no} carries source text that is never rendered "
                    f"({', '.join(reasons)}).",
                )
            )

    return findings, spans, total_lines
