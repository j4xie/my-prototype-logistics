"""Smoke test for tenant isolation plumbing (Week 1 Day 1).

Verifies:
1. set_factory_id / get_factory_id contextvars work across await boundaries
2. pool setup callback sets app.factory_id on borrowed connection
3. asyncpg returns the value via current_setting()

These tests don't touch RLS policies (none enabled yet — that's Day 2+
after observation). They verify the infrastructure is live.

Pool-touching tests run sequentially under one event loop by sharing a
session-scope fixture; otherwise pytest-asyncio creates a new loop per
test and the cached `_pg_pool` global ends up bound to a closed loop.
"""
from __future__ import annotations

import pytest
import pytest_asyncio


@pytest_asyncio.fixture
async def pg_pool():
    """Per-test dedicated pool to avoid cross-loop contamination from the
    cached global `_pg_pool`. Each test creates its own pool with the
    same setup callback, runs assertions, then closes."""
    import asyncpg
    from smartbi.config import get_settings
    from smartbi.tenant_ctx import set_pg_connection_tenant
    settings = get_settings()
    pg_url = settings.postgres_url
    if not pg_url:
        pytest.skip("No Postgres URL configured")
    pool = await asyncpg.create_pool(
        pg_url,
        min_size=1,
        max_size=2,
        setup=set_pg_connection_tenant,
    )
    try:
        yield pool
    finally:
        await pool.close()


@pytest.mark.asyncio
async def test_contextvar_propagates_across_awaits():
    """ContextVar set in parent task visible in child await."""
    from smartbi.tenant_ctx import set_factory_id, get_factory_id, reset_factory_id

    # Default empty → None
    assert get_factory_id() is None

    token = set_factory_id("FACTORY_TEST_A")
    try:
        assert get_factory_id() == "FACTORY_TEST_A"

        async def inner():
            return get_factory_id()

        assert await inner() == "FACTORY_TEST_A"
    finally:
        reset_factory_id(token)

    assert get_factory_id() is None


@pytest.mark.asyncio
async def test_set_factory_id_empty_becomes_internal_sentinel():
    """Empty / None → INTERNAL sentinel (safe default for anonymous calls)."""
    from smartbi.tenant_ctx import set_factory_id, get_factory_id, reset_factory_id, INTERNAL_SENTINEL

    token = set_factory_id(None)
    try:
        assert get_factory_id() == INTERNAL_SENTINEL
    finally:
        reset_factory_id(token)

    token = set_factory_id("")
    try:
        assert get_factory_id() == INTERNAL_SENTINEL
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_pool_setup_applies_factory_id_to_connection(pg_pool):
    """Pool.acquire returns a connection where current_setting returns our factory_id."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    token = set_factory_id("FACTORY_RLS_SMOKE_A")
    try:
        async with pg_pool.acquire() as conn:
            value = await conn.fetchval(
                "SELECT current_setting('app.factory_id', true)"
            )
        assert value == "FACTORY_RLS_SMOKE_A"
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_pool_setup_isolates_tenants_between_acquires(pg_pool):
    """Two separate acquires with different factory_ids see different values.

    This is the critical test: without proper per-acquire setup, one
    tenant's value could leak to the next borrower of the same connection.
    """
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    token_a = set_factory_id("TENANT_A")
    try:
        async with pg_pool.acquire() as conn_a:
            v_a = await conn_a.fetchval("SELECT current_setting('app.factory_id', true)")
    finally:
        reset_factory_id(token_a)

    token_b = set_factory_id("TENANT_B")
    try:
        async with pg_pool.acquire() as conn_b:
            v_b = await conn_b.fetchval("SELECT current_setting('app.factory_id', true)")
    finally:
        reset_factory_id(token_b)

    assert v_a == "TENANT_A"
    assert v_b == "TENANT_B"


@pytest.mark.asyncio
async def test_pool_setup_internal_sentinel_when_no_tenant(pg_pool):
    """If no factory set, borrowed conn gets __internal__ sentinel."""
    from smartbi.tenant_ctx import INTERNAL_SENTINEL

    # Do NOT set_factory_id — plumbing should default to INTERNAL
    async with pg_pool.acquire() as conn:
        value = await conn.fetchval("SELECT current_setting('app.factory_id', true)")
    assert value == INTERNAL_SENTINEL
