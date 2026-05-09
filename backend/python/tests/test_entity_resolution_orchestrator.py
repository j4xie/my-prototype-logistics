"""Unit tests for EntityResolutionOrchestrator."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from smartbi.canonical.entity_resolution.agents.base import BaseAgent
from smartbi.canonical.entity_resolution.orchestrator import (
    AgentResult,
    EntityResolutionOrchestrator,
    EntityType,
    ResolutionInput,
)


def _make_mock_pool(conn=None):
    if conn is None:
        conn = AsyncMock()
        conn.fetchrow = AsyncMock(return_value={"name": "门店A"})
        conn.execute = AsyncMock(return_value=None)
    pool = MagicMock()
    acquire_ctx = MagicMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=acquire_ctx)
    return pool, conn


class _FakeAgent(BaseAgent):
    """Test double — returns canned AgentResult."""

    def __init__(
        self,
        name: str,
        ship_threshold: float,
        result: AgentResult,
    ) -> None:
        self.name = name
        self.ship_threshold = ship_threshold
        self._result = result
        self.resolve_calls = 0

    async def resolve(self, input, pool):
        self.resolve_calls += 1
        self._observed_top_k = list(input.context.get("top_k_candidates", []))
        self._observed_tried = list(input.context.get("tried_entity_ids", []))
        return self._result


@pytest.fixture
def input_store():
    return ResolutionInput(
        raw_name="门店A",
        entity_type=EntityType.STORE,
        factory_id="F001",
    )


async def test_first_agent_high_confidence_ships(input_store):
    """First agent ≥ ship_threshold → ResolutionOutput from it; second agent NOT called."""
    pool, conn = _make_mock_pool()
    a1 = _FakeAgent(
        "deterministic",
        0.95,
        AgentResult(matched_entity_id=42, confidence=0.97, reasoning="exact"),
    )
    a2 = _FakeAgent(
        "embedding",
        0.90,
        AgentResult(matched_entity_id=99, confidence=0.95, reasoning="cosine"),
    )
    orch = EntityResolutionOrchestrator(pool, [a1, a2])

    out = await orch.resolve(input_store)

    assert out.matched_entity_id == 42
    assert out.confidence == 0.97
    assert out.decided_by_agent == "deterministic"
    assert out.is_tentative is False
    assert out.fallback_chain == ["deterministic"]
    assert a1.resolve_calls == 1
    assert a2.resolve_calls == 0


async def test_fallthrough_to_second_agent(input_store):
    """First low, second ≥ ship_threshold → second wins."""
    pool, _ = _make_mock_pool()
    a1 = _FakeAgent(
        "deterministic",
        0.95,
        AgentResult(matched_entity_id=None, confidence=0.5, reasoning="weak"),
    )
    a2 = _FakeAgent(
        "embedding",
        0.90,
        AgentResult(matched_entity_id=7, confidence=0.92, reasoning="strong cosine"),
    )
    orch = EntityResolutionOrchestrator(pool, [a1, a2])

    out = await orch.resolve(input_store)

    assert out.matched_entity_id == 7
    assert out.confidence == 0.92
    assert out.decided_by_agent == "embedding"
    assert out.fallback_chain == ["deterministic", "embedding"]
    assert out.is_tentative is False


async def test_all_low_confidence_admin_queue(input_store):
    """All agents below ship and below tentative_threshold → admin queue, None match."""
    pool, conn = _make_mock_pool()
    a1 = _FakeAgent(
        "deterministic",
        0.95,
        AgentResult(matched_entity_id=None, confidence=0.3, reasoning="weak"),
    )
    a2 = _FakeAgent(
        "embedding",
        0.90,
        AgentResult(matched_entity_id=None, confidence=0.3, reasoning="weak"),
    )
    orch = EntityResolutionOrchestrator(pool, [a1, a2])

    out = await orch.resolve(input_store)

    assert out.matched_entity_id is None
    assert out.decided_by_agent == "admin_queue"
    assert out.is_tentative is False
    # Admin queue insert was called
    assert conn.execute.await_count >= 1
    insert_sql = conn.execute.await_args_list[-1].args[0]
    assert "entity_resolution_admin_queue" in insert_sql


async def test_second_pass_tentative(input_store):
    """All below ship; best ≥ tentative_threshold + matched_id set → tentative."""
    pool, conn = _make_mock_pool()
    a1 = _FakeAgent(
        "deterministic",
        0.95,
        AgentResult(matched_entity_id=11, confidence=0.6, reasoning="weak ex"),
    )
    a2 = _FakeAgent(
        "embedding",
        0.90,
        AgentResult(matched_entity_id=22, confidence=0.83, reasoning="ok cosine"),
    )
    orch = EntityResolutionOrchestrator(pool, [a1, a2])

    out = await orch.resolve(input_store)

    assert out.is_tentative is True
    assert out.matched_entity_id == 22
    assert out.decided_by_agent == "embedding"
    assert "[tentative]" in out.reasoning


async def test_record_history_called_on_match(input_store):
    """Successful match → entity_resolution_history INSERT executed."""
    pool, conn = _make_mock_pool()
    a1 = _FakeAgent(
        "deterministic",
        0.95,
        AgentResult(matched_entity_id=42, confidence=0.97, reasoning="exact"),
    )
    orch = EntityResolutionOrchestrator(pool, [a1])

    await orch.resolve(input_store)

    # fetchrow for b_name + execute for INSERT
    conn.fetchrow.assert_awaited_once()
    assert conn.execute.await_count == 1
    insert_sql = conn.execute.await_args_list[0].args[0]
    assert "entity_resolution_history" in insert_sql
    assert "ON CONFLICT" in insert_sql


async def test_admin_queue_called_on_no_match(input_store):
    """All low → admin queue insert with priority='high' + reasoning."""
    pool, conn = _make_mock_pool()
    a1 = _FakeAgent(
        "deterministic",
        0.95,
        AgentResult(matched_entity_id=None, confidence=0.2, reasoning="none"),
    )
    orch = EntityResolutionOrchestrator(pool, [a1])

    await orch.resolve(input_store)

    insert_call = conn.execute.await_args_list[-1]
    insert_sql = insert_call.args[0]
    assert "entity_resolution_admin_queue" in insert_sql
    assert "priority" in insert_sql
    assert "reasoning" in insert_sql
    # priority is the 8th positional bind ($8); for no-match path it's "high"
    assert insert_call.args[-1] == "high"


async def test_history_skipped_when_no_match(input_store):
    """No match + tentative-threshold not reached → history NOT written."""
    pool, conn = _make_mock_pool()
    a1 = _FakeAgent(
        "deterministic",
        0.95,
        AgentResult(matched_entity_id=None, confidence=0.4, reasoning="weak"),
    )
    orch = EntityResolutionOrchestrator(pool, [a1])

    await orch.resolve(input_store)

    # fetchrow only used by _record_history; should not be called
    conn.fetchrow.assert_not_called()
    # Only the admin_queue insert should execute (1 call)
    assert conn.execute.await_count == 1
    assert "admin_queue" in conn.execute.await_args_list[0].args[0]


async def test_orchestrator_context_top_k_passed_between_agents(input_store):
    """Top-K from agent 1 visible in agent 2's input.context."""
    pool, _ = _make_mock_pool()
    cands = [
        {"entity_id": 1, "name": "门店A", "sim": 0.6},
        {"entity_id": 2, "name": "门店B", "sim": 0.55},
    ]
    a1 = _FakeAgent(
        "deterministic",
        0.95,
        AgentResult(
            matched_entity_id=None,
            confidence=0.5,
            reasoning="weak",
            candidates=cands,
        ),
    )
    a2 = _FakeAgent(
        "embedding",
        0.90,
        AgentResult(matched_entity_id=None, confidence=0.4, reasoning="also weak"),
    )
    orch = EntityResolutionOrchestrator(pool, [a1, a2])

    await orch.resolve(input_store)

    assert a2._observed_top_k == cands
    # tried_entity_ids should be empty (no matched IDs from a1)
    assert a2._observed_tried == []


async def test_tentative_requires_matched_entity_id(input_store):
    """Best ≥ tentative_threshold but matched_id=None → falls through to admin queue."""
    pool, conn = _make_mock_pool()
    a1 = _FakeAgent(
        "deterministic",
        0.95,
        AgentResult(matched_entity_id=None, confidence=0.85, reasoning="high but no id"),
    )
    orch = EntityResolutionOrchestrator(pool, [a1])

    out = await orch.resolve(input_store)

    assert out.is_tentative is False
    assert out.matched_entity_id is None
    assert out.decided_by_agent == "admin_queue"
