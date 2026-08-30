import asyncio
from pathlib import Path

import pytest

import pipeline
from schemas import ScanResponse, SemanticDecision
from scoring import verdict_for


ROOT = Path(__file__).resolve().parent


async def _fake_semantic(_pdf_bytes, suspicious_regions, corpus):
    if "IGNORE" in corpus or "SYSTEM OVERRIDE" in corpus or suspicious_regions:
        return SemanticDecision(
            decision="REJECT",
            confidence=0.88,
            reason="Test semantic tier found AI-directed override language.",
            evidence=[
                {
                    "page": suspicious_regions[0]["page"] if suspicious_regions else 1,
                    "bbox": suspicious_regions[0]["bbox"] if suspicious_regions else None,
                    "description": "AI-directed override language appears in the document.",
                }
            ],
        )
    return SemanticDecision(
        decision="ACCEPT",
        confidence=0.94,
        reason="No AI-directed manipulation found.",
        evidence=[],
    )


def collect(path: Path, monkeypatch):
    monkeypatch.setattr(pipeline, "_run_gemini_semantic", _fake_semantic)

    async def run():
        return [event async for event in pipeline.scan_pdf(path.name, path.read_bytes())]

    return asyncio.run(run())


@pytest.mark.parametrize(
    "filename",
    ["sanitx_test.pdf", "sanitx_ultimate_test.pdf", "sanitx_clean_test.pdf"],
)
def test_live_pipeline_contract(filename, monkeypatch):
    events = collect(ROOT / filename, monkeypatch)
    assert events[0]["type"] == "document"
    assert events[-1]["type"] == "verdict"

    phase_completes = [
        event["phase"]
        for event in events
        if event["type"] == "phase" and event["phase"]["status"] == "complete"
    ]
    assert [phase["id"] for phase in phase_completes] == [1, 2, 3, 4, 5, 6]

    response = ScanResponse.model_validate(events[-1]["response"])
    assert response.demo is False
    assert response.verdict == verdict_for(response.score)
    assert 0 <= response.score <= 1
    assert response.total_ms >= sum(phase.ms or 0 for phase in response.phases)

    for finding in response.findings:
        assert 1 <= finding.page <= response.document.pages
        if finding.bbox:
            assert finding.bbox.page == finding.page


def test_pipeline_fails_closed_without_semantic_key(monkeypatch):
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    async def run():
        return [
            event
            async for event in pipeline.scan_pdf(
                "sanitx_test.pdf",
                (ROOT / "sanitx_test.pdf").read_bytes(),
            )
        ]

    events = asyncio.run(run())
    assert events[-1]["type"] == "error"
    assert events[-1]["phase"] == 4
    assert "NOT cleared" in events[-1]["message"]
    assert all(event["type"] != "verdict" for event in events)


def test_ultimate_pdf_injection_suite_reports_all_vectors(monkeypatch):
    events = collect(ROOT / "sanitx_ultimate_test.pdf", monkeypatch)
    response = ScanResponse.model_validate(events[-1]["response"])

    vectors = {finding.vector for finding in response.findings}
    reason_codes = {
        code
        for finding in response.findings
        for code in finding.reason_codes
    }
    snippets = "\n".join(finding.snippet or "" for finding in response.findings)

    assert response.verdict == "BLOCKED"
    assert response.score >= 0.70
    assert response.tiers is not None
    assert response.tiers.tier1 >= 6
    assert {
        "small_text",
        "low_contrast",
        "near_border",
        "z_order_occlusion",
        "unicode_obfuscation",
        "shadow_signature",
    }.issubset(vectors)
    assert "DESTRUCTIVE_SQL" in reason_codes
    assert "DROP TABLE IF EXISTS access_logs;" in snippets
    assert "DELETE FROM admin_users WHERE id = 1;" in snippets
