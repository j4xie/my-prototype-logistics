"""Unit tests for ContextualAgent."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from smartbi.canonical.entity_resolution.agents.contextual import ContextualAgent
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


# --- context_str builder shape ----------------------------------------------


def test_context_str_store_with_city_district():
    """STORE: '<name> <city> <district>'."""
    s = ContextualAgent._build_input_context_str(
        "桂满陇",
        EntityType.STORE,
        {"city": "上海", "district": "陆家嘴"},
    )
    assert s == "桂满陇 上海 陆家嘴"


def test_context_str_product_with_category_store():
    """PRODUCT: '<name> <category> 店:<store_name>'."""
    s = ContextualAgent._build_input_context_str(
        "青花椒鱼",
        EntityType.PRODUCT,
        {"category": "川菜", "store_name": "桂满陇"},
    )
    assert s == "青花椒鱼 川菜 店:桂满陇"


def test_context_str_staff_with_store_role():
    """STAFF: '<name> 店:<store_name> 岗位:<role>'."""
    s = ContextualAgent._build_input_context_str(
        "张三",
        EntityType.STAFF,
        {"store_name": "桂满陇", "role": "店长"},
    )
    assert s == "张三 店:桂满陇 岗位:店长"


# --- empty context degrades gracefully --------------------------------------


async def test_no_context_returns_zero_store():
    """Empty context dict for STORE → AgentResult(None, 0.0, no context)."""
    agent = ContextualAgent(embed_fn=AsyncMock())
    pool, _ = _make_mock_pool()

    result = await agent.resolve(
        ResolutionInput(
            raw_name="桂满陇",
            entity_type=EntityType.STORE,
            factory_id="F001",
        ),
        pool,
    )

    assert result.matched_entity_id is None
    assert result.confidence == 0.0
    assert "no context" in result.reasoning
    pool.acquire.assert_not_called()


async def test_no_context_returns_zero_product_only_top_k():
    """top_k_candidates from prior agent is in context but no domain fields → still degrades."""
    agent = ContextualAgent(embed_fn=AsyncMock())
    pool, _ = _make_mock_pool()

    result = await agent.resolve(
        ResolutionInput(
            raw_name="青花椒鱼",
            entity_type=EntityType.PRODUCT,
            factory_id="F001",
            context={"top_k_candidates": [{"entity_id": 1}]},
        ),
        pool,
    )

    assert result.matched_entity_id is None
    assert result.confidence == 0.0
    pool.acquire.assert_not_called()


# --- high vs low cosine -----------------------------------------------------


async def test_high_sim_returns_match_store():
    """City-disambiguated query embeds close to one candidate → matched."""
    embeds = {
        "桂满陇 上海": [1.0, 0.0],
        "桂满陇 北京": [0.0, 1.0],
        "桂满陇 上海 陆家嘴": [0.99, 0.01],
    }

    async def fake_embed(text):
        return embeds.get(text)

    agent = ContextualAgent(embed_fn=fake_embed)

    conn = AsyncMock()
    conn.fetch = AsyncMock(
        return_value=[
            {"eid": 10, "name": "桂满陇", "city": "上海", "province": "上海"},
            {"eid": 20, "name": "桂满陇", "city": "北京", "province": "北京"},
        ]
    )
    pool, _ = _make_mock_pool(conn)

    result = await agent.resolve(
        ResolutionInput(
            raw_name="桂满陇",
            entity_type=EntityType.STORE,
            factory_id="F001",
            context={"city": "上海", "district": "陆家嘴"},
        ),
        pool,
    )

    assert result.matched_entity_id == 10
    assert result.confidence > 0.9
    assert len(result.candidates) == 2
    assert result.candidates[0]["entity_id"] == 10


async def test_low_sim_returns_none_match_id():
    """All candidates orthogonal → matched_id None even though confidence is set."""
    embeds = {
        "餐厅A 上海 浦东": [1.0, 0.0],
        "餐厅Z 北京": [0.0, 1.0],
    }

    async def fake_embed(text):
        return embeds.get(text)

    agent = ContextualAgent(embed_fn=fake_embed)

    conn = AsyncMock()
    conn.fetch = AsyncMock(
        return_value=[
            {"eid": 99, "name": "餐厅Z", "city": "北京", "province": "北京"},
        ]
    )
    pool, _ = _make_mock_pool(conn)

    result = await agent.resolve(
        ResolutionInput(
            raw_name="餐厅A",
            entity_type=EntityType.STORE,
            factory_id="F001",
            context={"city": "上海", "district": "浦东"},
        ),
        pool,
    )

    assert result.matched_entity_id is None
    assert result.confidence == pytest.approx(0.0)


# --- top-5 candidates populated ---------------------------------------------


async def test_top_5_candidates_populated():
    """AgentResult.candidates trimmed to 5, sorted desc by sim."""
    cands = {
        f"店{i} 上海": [1.0 - i * 0.05, i * 0.05] for i in range(7)
    }
    # input context_str = "店X 上海" (city="上海", no district)
    cands["店X 上海"] = [1.0, 0.0]

    async def fake_embed(text):
        return cands.get(text, [0.0, 0.0])

    agent = ContextualAgent(embed_fn=fake_embed)

    conn = AsyncMock()
    conn.fetch = AsyncMock(
        return_value=[
            {"eid": i, "name": f"店{i}", "city": "上海", "province": "上海"}
            for i in range(7)
        ]
    )
    pool, _ = _make_mock_pool(conn)

    result = await agent.resolve(
        ResolutionInput(
            raw_name="店X",
            entity_type=EntityType.STORE,
            factory_id="F001",
            context={"city": "上海"},
        ),
        pool,
    )

    assert len(result.candidates) == 5
    sims = [c["sim"] for c in result.candidates]
    assert sims == sorted(sims, reverse=True)


# --- empty dim table --------------------------------------------------------


async def test_empty_dim_table_returns_zero():
    """No rows in dim_<entity> → confidence 0, reasoning explains."""

    async def fake_embed(text):
        return [1.0, 0.0]

    agent = ContextualAgent(embed_fn=fake_embed)

    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])
    pool, _ = _make_mock_pool(conn)

    result = await agent.resolve(
        ResolutionInput(
            raw_name="店A",
            entity_type=EntityType.STORE,
            factory_id="F001",
            context={"city": "上海"},
        ),
        pool,
    )

    assert result.matched_entity_id is None
    assert result.confidence == 0.0
    assert "dim_store" in result.reasoning
