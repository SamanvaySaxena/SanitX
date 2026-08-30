from schemas import ComponentScores, SemanticDecision, Verdict, Weights


BANDS = {"review": 0.30, "blocked": 0.70}
DEFAULT_WEIGHTS = Weights(s=0.33, d=0.35, m=0.32)


def clamp01(n: float) -> float:
    return min(1.0, max(0.0, n))


def compute_risk(c: ComponentScores, w: Weights = DEFAULT_WEIGHTS) -> float:
    return clamp01(w.s * c.s + w.d * c.d + w.m * c.m)


def verdict_for(r: float) -> Verdict:
    if r >= BANDS["blocked"]:
        return "BLOCKED"
    if r >= BANDS["review"]:
        return "REVIEW"
    return "SAFE"


def structural_component(finding_scores: list[float], anomalous_spans: int) -> float:
    if not finding_scores:
        return 0.0
    return clamp01(0.7 * max(finding_scores) + 0.3 * min(1.0, anomalous_spans / 6))


def divergence_component(jaccard: float, cosine: float) -> float:
    def norm(value: float, threshold: float) -> float:
        return clamp01((threshold - value) / threshold)

    return clamp01(0.5 * norm(jaccard, 0.70) + 0.5 * norm(cosine, 0.80))


def semantic_component(decision: SemanticDecision) -> float:
    if decision.decision == "REJECT":
        return clamp01(decision.confidence)
    if decision.decision == "REVIEW":
        return clamp01(decision.confidence * 0.5)
    return clamp01((1.0 - decision.confidence) * 0.15)
