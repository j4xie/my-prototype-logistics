"""Unit tests for DeterministicAgent + EmbeddingAgent."""
from __future__ import annotations

from collections import OrderedDict
from unittest.mock import AsyncMock, MagicMock

import pytest

from smartbi.canonical.entity_resolution.agents.deterministic import (
    DeterministicAgent,
    normalize_for_dim,
)
from smartbi.canonical.entity_resolution.agents.embedding import EmbeddingAgent
from smartbi.canonical.entity_resolution.orchestrator import (
    EntityType,
    ResolutionInput,
)


def _make_mock_pool(conn=None):
    if conn is None:
        conn = AsyncMock()
    pool = MagicMock()
    acquire_ctx = MagicMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=acquire_ctx)
    return pool, conn


# --- normalize_for_dim ---------------------------------------------------


def test_normalize_for_dim_traditional_to_simplified():
    """Traditional Chinese mapped + parens stripped."""
    assert normalize_for_dim("桂滿隴(陸家嘴店)") == "桂满陇陆家嘴店"


def test_normalize_for_dim_whitespace_collapse():
    """Outer stripped, inner collapsed to single space."""
    assert normalize_for_dim("  桂满陇   陆家嘴  ") == "桂满陇 陆家嘴"


def test_normalize_for_dim_empty_input():
    """Empty/None-ish → empty string."""
    assert normalize_for_dim("") == ""
    assert normalize_for_dim("   ") == ""


def test_normalize_for_dim_lowercase_ascii():
    """ASCII letters lowercased; Chinese unchanged."""
    assert normalize_for_dim("Store-A 门店") == "storea 门店"


# --- DeterministicAgent --------------------------------------------------


async def test_deterministic_product_match():
    """fetchrow returns a row → AgentResult(eid, 1.0, ...)."""
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value={"product_id": 42})
    pool, _ = _make_mock_pool(conn)

    agent = DeterministicAgent()
    result = await agent.resolve(
        ResolutionInput(
            raw_name="青花椒鱼",
            entity_type=EntityType.PRODUCT,
            factory_id="F001",
        ),
        pool,
    )

    assert result.matched_entity_id == 42
    assert result.confidence == 1.0
    conn.fetchrow.assert_awaited_once()


async def test_deterministic_store_no_match():
    """No row matches normalized → confidence 0."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(
        return_value=[
            {"store_id": 1, "name": "门店X"},
            {"store_id": 2, "name": "门店Y"},
        ]
    )
    pool, _ = _make_mock_pool(conn)

    agent = DeterministicAgent()
    result = await agent.resolve(
        ResolutionInput(
            raw_name="门店Z",
            entity_type=EntityType.STORE,
            factory_id="F001",
        ),
        pool,
    )

    assert result.matched_entity_id is None
    assert result.confidence == 0.0


async def test_deterministic_store_normalized_match():
    """Store row matches via normalize_for_dim equality (handles trad/simp)."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(
        return_value=[
            {"store_id": 1, "name": "桂满陇(陆家嘴店)"},
        ]
    )
    pool, _ = _make_mock_pool(conn)

    agent = DeterministicAgent()
    result = await agent.resolve(
        ResolutionInput(
            raw_name="桂滿隴(陸家嘴店)",
            entity_type=EntityType.STORE,
            factory_id="F001",
        ),
        pool,
    )

    assert result.matched_entity_id == 1
    assert result.confidence == 1.0


async def test_deterministic_empty_name_short_circuits():
    """raw_name = '' → confidence 0, no DB call."""
    pool, conn = _make_mock_pool()
    agent = DeterministicAgent()

    result = await agent.resolve(
        ResolutionInput(
            raw_name="",
            entity_type=EntityType.STORE,
            factory_id="F001",
        ),
        pool,
    )

    assert result.matched_entity_id is None
    assert result.confidence == 0.0
    pool.acquire.assert_not_called()


# --- EmbeddingAgent ------------------------------------------------------


def test_embedding_cache_lru_eviction():
    """Cache evicts oldest entry when size > CACHE_MAX_SIZE."""
    agent = EmbeddingAgent(embed_fn=AsyncMock())
    agent.CACHE_MAX_SIZE = 3  # type: ignore[misc]

    agent._cache_put(("F001", "a"), [1.0])
    agent._cache_put(("F001", "b"), [2.0])
    agent._cache_put(("F001", "c"), [3.0])
    agent._cache_put(("F001", "d"), [4.0])  # evicts 'a'

    assert ("F001", "a") not in agent._cache
    assert ("F001", "d") in agent._cache
    assert len(agent._cache) == 3


def test_embedding_cache_lru_move_to_end():
    """Get a cached key → moves to end (most recent), so it survives next eviction."""
    agent = EmbeddingAgent(embed_fn=AsyncMock())
    agent.CACHE_MAX_SIZE = 3  # type: ignore[misc]

    agent._cache_put(("F001", "a"), [1.0])
    agent._cache_put(("F001", "b"), [2.0])
    agent._cache_put(("F001", "c"), [3.0])
    # touch 'a' so it becomes most recent
    agent._cache_get(("F001", "a"))
    agent._cache_put(("F001", "d"), [4.0])  # should evict 'b' now, not 'a'

    assert ("F001", "a") in agent._cache
    assert ("F001", "b") not in agent._cache


async def test_embedding_cosine_above_threshold():
    """Mock embed_fn returns vectors → cosine > 0.7 → matched_entity_id set."""
    # query vector parallel to 'good' candidate, far from 'bad'
    embeds = {
        "门店A": [1.0, 0.0],
        "门店B": [0.99, 0.05],  # cos ≈ 0.998 with 门店A
        "门店C": [0.0, 1.0],    # cos ≈ 0 with 门店A
    }

    async def fake_embed(text):
        return embeds.get(text)

    agent = EmbeddingAgent(embed_fn=fake_embed)

    conn = AsyncMock()
    conn.fetch = AsyncMock(
        return_value=[
            {"eid": 10, "name": "门店B"},
            {"eid": 20, "name": "门店C"},
        ]
    )
    pool, _ = _make_mock_pool(conn)

    result = await agent.resolve(
        ResolutionInput(
            raw_name="门店A",
            entity_type=EntityType.STORE,
            factory_id="F001",
        ),
        pool,
    )

    assert result.matched_entity_id == 10
    assert result.confidence > 0.9
    assert len(result.candidates) == 2
    assert result.candidates[0]["entity_id"] == 10


async def test_embedding_handles_none_from_embed_fn():
    """embed_fn returns None for query → AgentResult(None, 0.0, ...) without DB."""

    async def fake_embed(text):
        return None

    agent = EmbeddingAgent(embed_fn=fake_embed)
    pool, conn = _make_mock_pool()

    result = await agent.resolve(
        ResolutionInput(
            raw_name="门店A",
            entity_type=EntityType.STORE,
            factory_id="F001",
        ),
        pool,
    )

    assert result.matched_entity_id is None
    assert result.confidence == 0.0
    assert result.reasoning == "embedding 服务返回 None"
    pool.acquire.assert_not_called()


async def test_embedding_below_threshold_returns_none_id():
    """Best cosine ≤ 0.7 → matched_entity_id stays None even though confidence is set."""
    embeds = {
        "门店X": [1.0, 0.0],
        "完全不同的Y": [0.0, 1.0],  # orthogonal → cos=0
    }

    async def fake_embed(text):
        return embeds.get(text)

    agent = EmbeddingAgent(embed_fn=fake_embed)

    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[{"eid": 99, "name": "完全不同的Y"}])
    pool, _ = _make_mock_pool(conn)

    result = await agent.resolve(
        ResolutionInput(
            raw_name="门店X",
            entity_type=EntityType.STORE,
            factory_id="F001",
        ),
        pool,
    )

    assert result.matched_entity_id is None
    assert result.confidence == pytest.approx(0.0)


def test_embedding_cosine_zero_norm_safe():
    """Zero vector → cosine returns 0.0, no division-by-zero."""
    assert EmbeddingAgent._cosine([0.0, 0.0], [1.0, 1.0]) == 0.0
    assert EmbeddingAgent._cosine([1.0, 1.0], [0.0, 0.0]) == 0.0
    assert EmbeddingAgent._cosine([0.0], [0.0]) == 0.0


async def test_embedding_table_empty():
    """dim_<entity> empty → reasoning explains, confidence 0."""

    async def fake_embed(text):
        return [1.0, 0.0]

    agent = EmbeddingAgent(embed_fn=fake_embed)

    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])
    pool, _ = _make_mock_pool(conn)

    result = await agent.resolve(
        ResolutionInput(
            raw_name="门店A",
            entity_type=EntityType.STORE,
            factory_id="F001",
        ),
        pool,
    )

    assert result.matched_entity_id is None
    assert result.confidence == 0.0
    assert "dim_store" in result.reasoning
