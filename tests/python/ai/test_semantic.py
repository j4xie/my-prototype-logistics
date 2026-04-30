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

    # F2 C2 fix: semantic now uses get_embedding_cached. Patch underlying
    # gRPC fetcher (via embedding module) so cache lookup falls through to it.
    from ai import embedding as embedding_module
    embedding_module._request_embedding_cache.set({})
    with patch("ai.embedding.get_embedding", new=AsyncMock(return_value=[0.1] * 768)):
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
    # F2 C2 fix: semantic now uses get_embedding_cached → patch underlying gRPC.
    from ai import embedding as embedding_module
    embedding_module._request_embedding_cache.set({})
    with patch("ai.embedding.get_embedding", new=AsyncMock(return_value=None)):
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


@pytest.mark.asyncio
async def test_stage5_uses_request_cache(mock_pool):
    """β F2 C2: stage 5 SEMANTIC must hit the request-scoped embedding cache.

    Within a single request scope (one fresh _request_embedding_cache value),
    calling matcher.match() twice with the same query must invoke the
    underlying gRPC fetcher only ONCE. Without this, SemanticRouter (β stage 0)
    and stage 5 SEMANTIC would each call gRPC for the same query — wasteful
    and a regression of CR-2 from α audit.
    """
    fake_rows = [
        {"id": "u1", "intent_code": "INVENTORY_QUERY", "intent_name": "库存查询",
         "tool_name": "material_inventory_query", "intent_category": "ANALYSIS",
         "description": "d", "similarity": 0.92},
    ]
    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=fake_rows)
    fake_pool_ctx = MagicMock()
    fake_pool_ctx.__aenter__ = AsyncMock(return_value=fake_conn)
    fake_pool_ctx.__aexit__ = AsyncMock(return_value=False)
    mock_pool.acquire = MagicMock(return_value=fake_pool_ctx)

    from ai import embedding as embedding_module
    # Mimic one fresh request: middleware sets a brand-new cache dict.
    embedding_module._request_embedding_cache.set({})

    grpc_mock = AsyncMock(return_value=[0.1] * 768)
    with patch("ai.embedding.get_embedding", new=grpc_mock):
        from ai.matcher.semantic import SemanticMatcher
        matcher = SemanticMatcher(mock_pool)
        # Two stages within the same "request" call match() with the same query
        cands1 = await matcher.match("x", factoryId="F1", businessType="FACTORY")
        cands2 = await matcher.match("x", factoryId="F1", businessType="FACTORY")
        assert len(cands1) == 1
        assert len(cands2) == 1
        # Cache hit on second call — gRPC must be hit exactly once
        assert grpc_mock.await_count == 1, (
            f"Expected gRPC Encode to be called once (cache hit on 2nd), "
            f"got {grpc_mock.await_count} calls"
        )
