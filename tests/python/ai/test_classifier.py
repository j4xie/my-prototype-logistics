"""ai/matcher/classifier.py — wrap existing classifier ONNX."""
from __future__ import annotations

from unittest.mock import patch

import pytest


@pytest.mark.asyncio
async def test_classifier_returns_top_k_with_confidence():
    """Classifier returns probability dict; matcher converts to candidates."""
    fake_predictions = [
        ("INVENTORY_QUERY", 0.85),
        ("STOCK_CHECK", 0.10),
        ("OTHER", 0.05),
    ]
    with patch("ai.matcher.classifier._predict", return_value=fake_predictions):
        from ai.matcher.classifier import ClassifierMatcher
        matcher = ClassifierMatcher()
        cands = await matcher.match("查库存", factoryId="F001", businessType="FACTORY")
        assert len(cands) == 3
        assert cands[0].intentCode == "INVENTORY_QUERY"
        assert cands[0].confidence == 0.85
        assert cands[1].intentCode == "STOCK_CHECK"


@pytest.mark.asyncio
async def test_classifier_empty_if_underlying_returns_nothing():
    with patch("ai.matcher.classifier._predict", return_value=[]):
        from ai.matcher.classifier import ClassifierMatcher
        matcher = ClassifierMatcher()
        cands = await matcher.match("?", factoryId="F", businessType="COMMON")
        assert cands == []


@pytest.mark.asyncio
async def test_classifier_filters_below_threshold():
    """Predictions below 0.05 are dropped (noise)."""
    fake_predictions = [
        ("INTENT_A", 0.8),
        ("INTENT_B", 0.04),
    ]
    with patch("ai.matcher.classifier._predict", return_value=fake_predictions):
        from ai.matcher.classifier import ClassifierMatcher
        matcher = ClassifierMatcher(min_confidence=0.05)
        cands = await matcher.match("X", factoryId="F", businessType="COMMON")
        assert len(cands) == 1
        assert cands[0].intentCode == "INTENT_A"
