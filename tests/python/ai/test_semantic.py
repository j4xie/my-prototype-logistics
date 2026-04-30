"""ai/matcher/semantic.py — pgvector similarity."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture
def mock_pool():
    pool = MagicMock()
    return pool


@pytest.mark.asyncio
async def test_semantic_search_returns_top_candidates(mock_pool):
    """Happy path: embedding succeeds, pgvector returns rows, sorted desc."""
    fake_rows = [
        {"id": "u1", "intent_code": "INVENTORY_QUERY", "intent_name": "库存查询",
         "tool_name": "material_inventory_query", "intent_category": "ANALYSIS",
         "description": "d", "similarity": 0.92},
        {"id": "u2", "intent_code": "STOCK_CHECK", "intent_name": "库存检查",
         "tool_name": "stock_check", "intent_category": "ANALYSIS",
         "description": "d2", "similarity": 0.78},
    ]
    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=fake_rows)
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    mock_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    with patch("ai.matcher.semantic.get_embedding", new=AsyncMock(return_value=[0.1] * 768)):
        from ai.matcher.semantic import SemanticMatcher
        matcher = SemanticMatcher(mock_pool)
        cands = await matcher.match("查库存", factoryId="F001", businessType="FACTORY")
        assert len(cands) == 2
        assert cands[0].intentCode == "INVENTORY_QUERY"
        assert cands[0].confidence == 0.92
        assert cands[1].confidence == 0.78


@pytest.mark.asyncio
async def test_semantic_search_returns_empty_if_embedding_unavailable(mock_pool):
    """Embedding service down → return [] (caller falls through to stage 6)."""
    with patch("ai.matcher.semantic.get_embedding", new=AsyncMock(return_value=None)):
        from ai.matcher.semantic import SemanticMatcher
        matcher = SemanticMatcher(mock_pool)
        cands = await matcher.match("查库存", factoryId="F001", businessType="FACTORY")
        assert cands == []


@pytest.mark.asyncio
async def test_semantic_short_circuit_threshold():
    """is_strong_signal returns True iff top similarity > AI_SEMANTIC_THRESHOLD."""
    from ai.dto import CandidateIntentDto, MatchMethod
    from ai.matcher.semantic import is_strong_signal
    high = [CandidateIntentDto(intentCode="X", intentName="X", confidence=0.90,
                                matchMethod=MatchMethod.SEMANTIC)]
    low = [CandidateIntentDto(intentCode="X", intentName="X", confidence=0.50,
                               matchMethod=MatchMethod.SEMANTIC)]
    assert is_strong_signal(high) is True
    assert is_strong_signal(low) is False
    assert is_strong_signal([]) is False
