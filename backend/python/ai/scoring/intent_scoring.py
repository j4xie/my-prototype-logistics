"""Combined score for ranking candidates after calibration (β C4).

Combines (calibrated_confidence, matched_keyword_count, priority, confidence_boost)
into single score using configurable weights. Defaults (0.5, 0.2, 0.2, 0.1).

Used by orchestrator after candidate generation to re-rank candidates by score
descending. matched_keyword_count and priority are normalized (caps at 1.0).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple


@dataclass
class IntentScorer:
    """Default weights (0.5, 0.2, 0.2, 0.1) over (confidence, keywords, priority, boost)."""

    weights: Tuple[float, float, float, float] = (0.5, 0.2, 0.2, 0.1)

    def score(
        self,
        calibrated_confidence: float,
        matched_keyword_count: int,
        priority: int,
        confidence_boost: float,
    ) -> float:
        w1, w2, w3, w4 = self.weights
        kw_norm = min(matched_keyword_count / 5.0, 1.0)
        priority_norm = min(priority / 100.0, 1.0)
        return (w1 * calibrated_confidence
                + w2 * kw_norm
                + w3 * priority_norm
                + w4 * confidence_boost)
