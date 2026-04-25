"""Mock-based unit tests for CapabilityCalculator. Real PG required for RLS tests
(see test_capability_calculator_integration.py).
"""
from __future__ import annotations
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock

from smartbi.capability.calculator import CapabilityCalculator
from smartbi.tenant_ctx import set_factory_id, reset_factory_id


def _build_mock_pool(rows: list | None = None, has_merge_status: bool = False):
    """Build an AsyncMock pool that returns the specified row sequence.

    Mocks the conn.transaction() async context manager + conn.execute / conn.fetch /
    conn.fetchval in correct sequence per calculator's SQL pattern.
    """
    rows = rows or []

    conn = AsyncMock()
    # _check_merge_status_column uses conn.fetchval
    # _fetch_capabilities uses conn.execute (set_config) then conn.fetch (DISTINCT query)
    conn.fetchval = AsyncMock(return_value=has_merge_status)
    conn.fetch = AsyncMock(
        return_value=[{"original_name": r} if isinstance(r, str) else r for r in rows]
    )
    conn.execute = AsyncMock(return_value=None)

    # transaction() returns an async context manager
    txn = AsyncMock()
    txn.__aenter__ = AsyncMock(return_value=txn)
    txn.__aexit__ = AsyncMock(return_value=False)
    conn.transaction = MagicMock(return_value=txn)

    # pool.acquire() returns an async context manager yielding conn
    pool_cm = AsyncMock()
    pool_cm.__aenter__ = AsyncMock(return_value=conn)
    pool_cm.__aexit__ = AsyncMock(return_value=False)

    pool = MagicMock()
    pool.acquire = MagicMock(return_value=pool_cm)
    return pool, conn


# ----- Test 1: empty factory returns empty set -----
@pytest.mark.asyncio
async def test_empty_factory_returns_empty_set():
    pool, _ = _build_mock_pool(rows=[])
    calc = CapabilityCalculator(pool)
    result = await calc.get_capabilities("F_NEW_EMPTY")
    assert result == set()


# ----- Test 2: returns canonical fields (中文 → English mapping) -----
@pytest.mark.asyncio
async def test_returns_canonical_fields():
    # Mock raw column names (some Chinese, some English) — calculator maps via to_canonical
    pool, _ = _build_mock_pool(rows=["门店名称", "营业日期", "应收金额", "unknown_column"])
    calc = CapabilityCalculator(pool)
    result = await calc.get_capabilities("F001")
    assert "store_name" in result
    assert "date" in result
    assert "gross_amount" in result
    # unknown_column not in ALIAS_TO_ATTR → not included
    assert "unknown_column" not in result


# ----- Test 3: cache TTL — same factory cached within TTL -----
@pytest.mark.asyncio
async def test_cache_hit_within_ttl():
    pool, conn = _build_mock_pool(rows=["门店名称"])
    calc = CapabilityCalculator(pool)

    r1 = await calc.get_capabilities("F001")
    r2 = await calc.get_capabilities("F001")

    assert r1 == r2 == {"store_name"}
    # Only ONE underlying SQL call (cache hit on second)
    assert conn.fetch.call_count == 1


# ----- Test 4: invalidate clears cache -----
@pytest.mark.asyncio
async def test_invalidate_clears_cache():
    pool, conn = _build_mock_pool(rows=["门店名称"])
    calc = CapabilityCalculator(pool)

    await calc.get_capabilities("F001")
    assert "F001" in calc._cache

    calc.invalidate("F001")
    assert "F001" not in calc._cache
    # invalidation_gen bumped
    assert calc._invalidation_gen["F001"] == 1


# ----- Test 5: inflight dedup — 3 concurrent calls share 1 query -----
@pytest.mark.asyncio
async def test_inflight_dedup_concurrent_calls_share_query():
    pool, conn = _build_mock_pool(rows=["门店名称"])

    # Slow down the fetch to simulate real query latency
    async def slow_fetch(*args, **kwargs):
        await asyncio.sleep(0.05)
        return [{"original_name": "门店名称"}]
    conn.fetch.side_effect = slow_fetch

    calc = CapabilityCalculator(pool)

    results = await asyncio.gather(
        calc.get_capabilities("F001"),
        calc.get_capabilities("F001"),
        calc.get_capabilities("F001"),
    )

    assert all(r == {"store_name"} for r in results)
    # Only 1 SQL query despite 3 concurrent calls
    assert conn.fetch.call_count == 1


# ----- Test 6: invalidation_gen defeats race -----
@pytest.mark.asyncio
async def test_invalidation_gen_defeats_race():
    """Scenario: invalidate() runs while inflight query is still in flight.
    The stale result from the inflight query MUST NOT overwrite the now-empty cache.
    """
    pool, conn = _build_mock_pool(rows=["门店名称"])

    async def slow_fetch(*args, **kwargs):
        await asyncio.sleep(0.1)  # Long enough to allow invalidate during this
        return [{"original_name": "门店名称"}]
    conn.fetch.side_effect = slow_fetch

    calc = CapabilityCalculator(pool)

    # Start fetch
    fetch_task = asyncio.create_task(calc.get_capabilities("F001"))
    await asyncio.sleep(0.02)  # Let it start

    # Invalidate WHILE fetch still in flight
    calc.invalidate("F001")

    # Wait for fetch to complete
    await fetch_task

    # Even though fetch returned data, cache must NOT have it (gen mismatch)
    assert "F001" not in calc._cache
    # Generation bumped to 1
    assert calc._invalidation_gen["F001"] == 1


# ----- Test 7: cross-tenant guard returns 403 -----
@pytest.mark.asyncio
async def test_cross_tenant_blocked():
    from fastapi import HTTPException
    pool, _ = _build_mock_pool(rows=[])
    calc = CapabilityCalculator(pool)

    token = set_factory_id("F001")
    try:
        with pytest.raises(HTTPException) as exc_info:
            await calc.get_capabilities("F002")
        assert exc_info.value.status_code == 403
    finally:
        reset_factory_id(token)
