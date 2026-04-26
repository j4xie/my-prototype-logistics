"""Unit tests for TransitiveAgent."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from smartbi.canonical.entity_resolution.agents.transitive import TransitiveAgent
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


async def test_no_history_returns_none():
    """Empty first_hop fetch → AgentResult(None, 0.0)."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])
    pool, _ = _make_mock_pool(conn)

    agent = TransitiveAgent()
    result = await agent.resolve(
        ResolutionInput(
            raw_name="桂满陇陆家嘴店",
            entity_type=EntityType.STORE,
            factory_id="F001",
        ),
        pool,
    )

    assert result.matched_entity_id is None
    assert result.confidence == 0.0
    assert "no first-hop" in result.reasoning


async def test_chain_closure_found():
    """First hop returns 1 candidate; second hop returns matching b_entity_id → matched + discounted."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(
        return_value=[
            {"b_entity_id": 42, "b_name": "桂满陇", "confidence": 0.92},
        ]
    )
    conn.fetchrow = AsyncMock(
        return_value={"b_entity_id": 42, "confidence": 0.95},
    )
    pool, _ = _make_mock_pool(conn)

    agent = TransitiveAgent()
    result = await agent.resolve(
        ResolutionInput(
            raw_name="桂满陇陆家嘴店",
            entity_type=EntityType.STORE,
            factory_id="F001",
        ),
        pool,
    )

    assert result.matched_entity_id == 42
    # min(0.92, 0.95) * 0.95 = 0.874
    assert result.confidence == pytest.approx(0.92 * 0.95, abs=1e-6)
    assert "transitive closure" in result.reasoning
    assert "桂满陇" in result.reasoning


async def test_chain_no_closure():
    """Second hop returns different b_entity_id → no closure → AgentResult(None, 0.0)."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(
        return_value=[
            {"b_entity_id": 42, "b_name": "桂满陇", "confidence": 0.92},
        ]
    )
    conn.fetchrow = AsyncMock(
        return_value={"b_entity_id": 99, "confidence": 0.95},
    )
    pool, _ = _make_mock_pool(conn)

    agent = TransitiveAgent()
    result = await agent.resolve(
        ResolutionInput(
            raw_name="桂满陇陆家嘴店",
            entity_type=EntityType.STORE,
            factory_id="F001",
        ),
        pool,
    )

    assert result.matched_entity_id is None
    assert result.confidence == 0.0
    assert "no transitive closure" in result.reasoning


async def test_uses_confidence_column_not_sim():
    """SQL must reference 'confidence' column (not 'sim') to match migration schema."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])
    pool, _ = _make_mock_pool(conn)

    agent = TransitiveAgent()
    await agent.resolve(
        ResolutionInput(
            raw_name="X",
            entity_type=EntityType.STORE,
            factory_id="F001",
        ),
        pool,
    )

    sql = conn.fetch.await_args.args[0]
    assert "confidence" in sql
    assert "ORDER BY" in sql.upper() or "order by" in sql
    # ensure schema mismatch isn't hiding under aliases:
    assert " sim " not in sql.lower()
    assert "as sim" not in sql.lower()


async def test_picks_best_chain_among_multiple():
    """Multiple first-hop candidates; closure on highest min(conf) wins."""
    first_rows = [
        {"b_entity_id": 1, "b_name": "A", "confidence": 0.90},
        {"b_entity_id": 2, "b_name": "B", "confidence": 0.95},
        {"b_entity_id": 3, "b_name": "C", "confidence": 0.88},
    ]

    fetchrow_responses = {
        "A": {"b_entity_id": 1, "confidence": 0.91},
        "B": {"b_entity_id": 2, "confidence": 0.99},
        "C": None,
    }

    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=first_rows)

    async def fake_fetchrow(sql, factory, etype, name, *args):
        return fetchrow_responses.get(name)

    conn.fetchrow = AsyncMock(side_effect=fake_fetchrow)
    pool, _ = _make_mock_pool(conn)

    agent = TransitiveAgent()
    result = await agent.resolve(
        ResolutionInput(
            raw_name="X",
            entity_type=EntityType.STORE,
            factory_id="F001",
        ),
        pool,
    )

    # 'B' chain wins: min(0.95, 0.99) * 0.95 = 0.9025
    assert result.matched_entity_id == 2
    assert result.confidence == pytest.approx(0.95 * 0.95, abs=1e-6)


async def test_uses_raw_name_not_normalized():
    """a_name lookup uses input.raw_name as-is (matches _record_history convention)."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])
    pool, _ = _make_mock_pool(conn)

    agent = TransitiveAgent()
    await agent.resolve(
        ResolutionInput(
            raw_name="桂滿隴(陸家嘴店)",  # contains traditional + parens
            entity_type=EntityType.STORE,
            factory_id="F001",
        ),
        pool,
    )

    args = conn.fetch.await_args.args
    # 4th arg is a_name; should match raw input verbatim
    assert args[3] == "桂滿隴(陸家嘴店)"
