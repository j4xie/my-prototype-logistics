"""Tests for smartbi.agent.budget_tracker.

Week 5 Day 2 of Unified Data Layer v1. Uses real asyncpg pool against
smartbi_db (test). POSTGRES_DB=smartbi_db must be in env.

Each test calls set_factory_id() inline (not via fixture) because
pytest-asyncio runs fixture setup/teardown in a different Task than
the test body, so ContextVars set in a fixture don't propagate.
"""
from __future__ import annotations

from datetime import date, timedelta

import pytest
import pytest_asyncio

from smartbi.agent import AgentBudgetTracker, DEFAULT_TIER_CAPS


_TENANT = "TEST_BUDGET_A"


@pytest_asyncio.fixture
async def pool():
    import asyncpg
    from smartbi.config import get_settings
    from smartbi.tenant_ctx import set_pg_connection_tenant
    settings = get_settings()
    if not settings.postgres_url:
        pytest.skip("No Postgres configured")
    p = await asyncpg.create_pool(
        settings.postgres_url, min_size=1, max_size=3,
        setup=set_pg_connection_tenant,
    )
    try:
        yield p
    finally:
        await p.close()


async def _reset_tenant(pool, tenant):
    """Call at top of each test to wipe this tenant's state.

    Tenant context is set for this session so RLS lets us DELETE
    our own rows.
    """
    from smartbi.tenant_ctx import set_factory_id
    set_factory_id(tenant)
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM agent_budget_daily WHERE factory_id=$1", tenant,
        )
        await conn.execute(
            "DELETE FROM agent_tenant_config WHERE factory_id=$1", tenant,
        )


async def test_check_creates_row_with_basic_cap_when_unregistered(pool):
    await _reset_tenant(pool, _TENANT)
    tracker = AgentBudgetTracker(pool)
    result = await tracker.check_budget(_TENANT)
    assert result.tokens_used == 0
    assert result.tokens_cap == DEFAULT_TIER_CAPS["basic"]
    assert result.blocked is False


async def test_enterprise_tier_gets_higher_cap(pool):
    await _reset_tenant(pool, _TENANT)
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO agent_tenant_config (factory_id, tier) VALUES ($1, 'enterprise')",
            _TENANT,
        )
    tracker = AgentBudgetTracker(pool)
    result = await tracker.check_budget(_TENANT)
    assert result.tokens_cap == DEFAULT_TIER_CAPS["enterprise"]


async def test_custom_cap_override_wins_over_tier(pool):
    await _reset_tenant(pool, _TENANT)
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO agent_tenant_config
                (factory_id, tier, custom_cap_override)
            VALUES ($1, 'basic', 500000)
            """,
            _TENANT,
        )
    tracker = AgentBudgetTracker(pool)
    result = await tracker.check_budget(_TENANT)
    assert result.tokens_cap == 500_000


async def test_consume_accumulates(pool):
    await _reset_tenant(pool, _TENANT)
    tracker = AgentBudgetTracker(pool)
    await tracker.check_budget(_TENANT)
    r1 = await tracker.consume(_TENANT, 1000)
    r2 = await tracker.consume(_TENANT, 2500)
    assert r1.tokens_used == 1000
    assert r2.tokens_used == 3500
    assert r2.blocked is False


async def test_blocked_transitions_at_cap(pool):
    """Setting custom cap low to exercise the blocked flag flip."""
    await _reset_tenant(pool, _TENANT)
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO agent_tenant_config
                (factory_id, tier, custom_cap_override)
            VALUES ($1, 'basic', 100)
            """,
            _TENANT,
        )
    tracker = AgentBudgetTracker(pool)
    r0 = await tracker.check_budget(_TENANT)
    assert r0.blocked is False and r0.tokens_cap == 100

    r1 = await tracker.consume(_TENANT, 50)
    assert r1.blocked is False

    r2 = await tracker.consume(_TENANT, 50)  # hits exactly 100
    assert r2.blocked is True
    assert r2.tokens_used == 100

    r3 = await tracker.check_budget(_TENANT)
    assert r3.blocked is True


async def test_daily_row_isolation(pool):
    """Yesterday's blocked row doesn't affect today's check."""
    await _reset_tenant(pool, _TENANT)
    tracker = AgentBudgetTracker(pool)
    yesterday = date.today() - timedelta(days=1)

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO agent_budget_daily
                (factory_id, date, tokens_used, tokens_cap)
            VALUES ($1, $2, 100, 100)
            """,
            _TENANT, yesterday,
        )

    today_result = await tracker.check_budget(_TENANT)
    assert today_result.blocked is False
    assert today_result.tokens_used == 0


async def test_consume_zero_or_negative_is_noop(pool):
    await _reset_tenant(pool, _TENANT)
    tracker = AgentBudgetTracker(pool)
    await tracker.check_budget(_TENANT)
    r_zero = await tracker.consume(_TENANT, 0)
    r_neg = await tracker.consume(_TENANT, -100)
    assert r_zero.tokens_used == 0
    assert r_neg.tokens_used == 0
