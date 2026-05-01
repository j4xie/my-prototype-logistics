"""CRAG quality evaluator (β C5)."""
from __future__ import annotations
import pytest


def test_evaluator_high_quality():
    from ai.rag.evaluator import RAGEvaluator, RAGQuality
    from ai.rag.retrieval import RAGCase
    cases = [RAGCase(query="x", intent_code="X", confidence=0.95,
                       similarity=0.90, source="match_record")]
    assert RAGEvaluator().evaluate(cases) == RAGQuality.HIGH


def test_evaluator_high_quality_at_threshold():
    """Boundary: similarity exactly 0.85 → HIGH."""
    from ai.rag.evaluator import RAGEvaluator, RAGQuality
    from ai.rag.retrieval import RAGCase
    cases = [RAGCase(query="x", intent_code="X", confidence=0.9,
                       similarity=0.85, source="match_record")]
    assert RAGEvaluator().evaluate(cases) == RAGQuality.HIGH


def test_evaluator_medium_quality():
    from ai.rag.evaluator import RAGEvaluator, RAGQuality
    from ai.rag.retrieval import RAGCase
    cases = [RAGCase(query="x", intent_code="X", confidence=0.8,
                       similarity=0.78, source="match_record")]
    assert RAGEvaluator().evaluate(cases) == RAGQuality.MEDIUM


def test_evaluator_unreliable_below_07():
    from ai.rag.evaluator import RAGEvaluator, RAGQuality
    from ai.rag.retrieval import RAGCase
    cases = [RAGCase(query="x", intent_code="X", confidence=0.5,
                       similarity=0.5, source="match_record")]
    assert RAGEvaluator().evaluate(cases) == RAGQuality.UNRELIABLE


def test_evaluator_empty_results():
    """Cold-start: empty cases → UNRELIABLE."""
    from ai.rag.evaluator import RAGEvaluator, RAGQuality
    assert RAGEvaluator().evaluate([]) == RAGQuality.UNRELIABLE
