"""SemanticRouter — 3-tier + OOD flag (β C1)."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


@pytest.fixture
def visible_intents_with_embeddings():
    """Snapshot rows with embedding column populated."""
    return [
        {
            "id": "u1", "intent_code": "INVENTORY_QUERY", "intent_name": "库存查询",
            "intent_category": "ANALYSIS", "tool_name": "material_inventory_query",
            "description": "查询库存", "factory_id": None, "business_type": "COMMON",
            "is_active": True, "priority": 80, "config_version": 1,
            "embedding": [0.9, 0.1, 0.0] + [0.0] * 765,
        },
        {
            "id": "u2", "intent_code": "PRODUCT_LIST", "intent_name": "产品列表",
            "intent_category": "ANALYSIS", "tool_name": "product_list",
            "description": "查询产品", "factory_id": None, "business_type": "COMMON",
            "is_active": True, "priority": 50, "config_version": 1,
            "embedding": [0.5, 0.5, 0.0] + [0.0] * 765,
        },
    ]


@pytest.mark.asyncio
async def test_direct_execute_when_top_similarity_above_092(visible_intents_with_embeddings):
    """Top similarity >= 0.92 -> DIRECT_EXECUTE."""
    from ai.router.semantic_router import SemanticRouter

    query_emb = [0.9, 0.1, 0.0] + [0.0] * 765  # cosine ~ 1.0 with INVENTORY_QUERY

    with patch("ai.embedding.get_embedding_cached", new=AsyncMock(return_value=query_emb)):
        router = SemanticRouter()
        decision = await router.route(
            query="查库存",
            visible_intents=visible_intents_with_embeddings,
            factoryId="F001",
            businessType="FACTORY",
        )
    assert decision.method == "DIRECT_EXECUTE"
    assert decision.candidates[0].intentCode == "INVENTORY_QUERY"
    assert decision.candidates[0].confidence >= 0.92
    assert decision.ood_detected is False


@pytest.mark.asyncio
async def test_need_full_llm_when_similarity_below_075(visible_intents_with_embeddings):
    """Top similarity < 0.75 -> NEED_FULL_LLM."""
    from ai.router.semantic_router import SemanticRouter

    query_emb = [0.0, 0.0, 1.0] + [0.0] * 765  # orthogonal -> cosine ~ 0

    with patch("ai.embedding.get_embedding_cached", new=AsyncMock(return_value=query_emb)):
        router = SemanticRouter()
        decision = await router.route(
            query="完全无关",
            visible_intents=visible_intents_with_embeddings,
            factoryId="F001",
            businessType="FACTORY",
        )
    assert decision.method == "NEED_FULL_LLM"
    assert decision.ood_detected is True  # max sim ~ 0 < 0.3


@pytest.mark.asyncio
async def test_factory_isolation_strict():
    """visible_intents already factory-filtered by caller; router doesn't add factory filter."""
    from ai.router.semantic_router import SemanticRouter

    rows_f001_only = [
        {
            "id": "u1", "intent_code": "F001_INTENT", "intent_name": "F001",
            "intent_category": "ANALYSIS", "tool_name": "x", "description": "x",
            "factory_id": "F001", "business_type": "FACTORY", "is_active": True,
            "priority": 50, "config_version": 1,
            "embedding": [1.0, 0.0, 0.0] + [0.0] * 765,
        },
    ]
    query_emb = [1.0, 0.0, 0.0] + [0.0] * 765

    with patch("ai.embedding.get_embedding_cached", new=AsyncMock(return_value=query_emb)):
        router = SemanticRouter()
        decision = await router.route(
            query="anything", visible_intents=rows_f001_only,
            factoryId="F001", businessType="FACTORY",
        )
    codes = {c.intentCode for c in decision.candidates}
    assert "F001_INTENT" in codes


@pytest.mark.asyncio
async def test_embedding_failure_returns_fallthrough_decision():
    """gRPC fail -> router returns NEED_FULL_LLM with empty candidates."""
    from ai.router.semantic_router import SemanticRouter

    with patch("ai.embedding.get_embedding_cached", new=AsyncMock(return_value=None)):
        router = SemanticRouter()
        decision = await router.route(
            query="anything", visible_intents=[],
            factoryId="F001", businessType="FACTORY",
        )
    assert decision.method == "NEED_FULL_LLM"
    assert decision.candidates == []
    assert decision.query_embedding is None


@pytest.mark.asyncio
async def test_top_k_caps_candidates_returned():
    """top_k=2 -> returns at most 2 candidates."""
    from ai.router.semantic_router import SemanticRouter

    rows = [
        {
            "id": f"u{i}", "intent_code": f"INTENT_{i}", "intent_name": f"i{i}",
            "intent_category": "X", "tool_name": "t", "description": "",
            "factory_id": None, "business_type": "COMMON", "is_active": True,
            "priority": 50, "config_version": 1,
            "embedding": [1.0 - i * 0.1, i * 0.1, 0.0] + [0.0] * 765,
        }
        for i in range(5)
    ]
    query_emb = [1.0, 0.0, 0.0] + [0.0] * 765

    with patch("ai.embedding.get_embedding_cached", new=AsyncMock(return_value=query_emb)):
        router = SemanticRouter(top_k=2)
        decision = await router.route(
            query="x", visible_intents=rows,
            factoryId="F", businessType="COMMON",
        )
    assert len(decision.candidates) == 2
