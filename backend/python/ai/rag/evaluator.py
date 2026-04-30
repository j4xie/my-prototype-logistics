"""CRAG-style heuristic evaluator (β C5).

Evaluates retrieval quality based on top-1 similarity:
- ≥ 0.85 → HIGH (full inject into LLM prompt)
- ≥ 0.70 → MEDIUM (query only, no intent_code)
- < 0.70 OR empty → UNRELIABLE (skip RAG)

Cold-start safe: empty results → UNRELIABLE → orchestrator skips RAG enrichment.
"""
from __future__ import annotations

from enum import Enum
from typing import List

from ai.rag.retrieval import RAGCase


class RAGQuality(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    UNRELIABLE = "unreliable"


class RAGEvaluator:
    """Heuristic CRAG evaluator. Empty / low similarity → UNRELIABLE."""

    HIGH_THRESHOLD = 0.85
    MEDIUM_THRESHOLD = 0.70

    def evaluate(self, cases: List[RAGCase]) -> RAGQuality:
        if not cases:
            return RAGQuality.UNRELIABLE
        top_sim = cases[0].similarity
        if top_sim >= self.HIGH_THRESHOLD:
            return RAGQuality.HIGH
        if top_sim >= self.MEDIUM_THRESHOLD:
            return RAGQuality.MEDIUM
        return RAGQuality.UNRELIABLE
