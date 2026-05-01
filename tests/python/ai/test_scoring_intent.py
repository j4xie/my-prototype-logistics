"""Combined intent scoring (β C4)."""
from __future__ import annotations
import pytest


def test_intent_score_combines_with_default_weights():
    """Default weights (0.5, 0.2, 0.2, 0.1) over 4 components."""
    from ai.scoring.intent_scoring import IntentScorer
    scorer = IntentScorer()
    score = scorer.score(
        calibrated_confidence=0.8,
        matched_keyword_count=2,
        priority=80,
        confidence_boost=0.1,
    )
    # 0.5*0.8 + 0.2*(2/5) + 0.2*(80/100) + 0.1*0.1 = 0.4 + 0.08 + 0.16 + 0.01 = 0.65
    assert abs(score - 0.65) < 0.01


def test_intent_score_handles_zero_inputs():
    from ai.scoring.intent_scoring import IntentScorer
    scorer = IntentScorer()
    assert scorer.score(0, 0, 0, 0) == 0.0


def test_intent_score_custom_weights():
    from ai.scoring.intent_scoring import IntentScorer
    scorer = IntentScorer(weights=(1.0, 0.0, 0.0, 0.0))
    assert scorer.score(0.7, 5, 100, 0.5) == 0.7


def test_intent_score_caps_keyword_count_at_5():
    """matched_keyword_count > 5 caps at 1.0 normalization."""
    from ai.scoring.intent_scoring import IntentScorer
    scorer = IntentScorer(weights=(0.0, 1.0, 0.0, 0.0))
    assert scorer.score(0, 10, 0, 0) == 1.0  # 10/5 capped to 1.0


def test_intent_score_caps_priority_at_100():
    from ai.scoring.intent_scoring import IntentScorer
    scorer = IntentScorer(weights=(0.0, 0.0, 1.0, 0.0))
    assert scorer.score(0, 0, 200, 0) == 1.0  # 200/100 capped to 1.0
