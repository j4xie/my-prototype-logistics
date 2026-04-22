"""Tests for smartbi.agent.narrative_cache.

Each test calls set_factory_id() inline because pytest-asyncio runs
fixture setup in a different Task than the test body.
"""
from __future__ import annotations

import asyncio

import pytest
import pytest_asyncio

from smartbi.agent import NarrativeCacheService, compute_question_hash


_TENANT = "TEST_NARRCACHE_A"
_TENANT_B = "TEST_NARRCACHE_B"


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


async def _reset(pool, tenant):
    from smartbi.tenant_ctx import set_factory_id
    set_factory_id(tenant)
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM narrative_cache WHERE factory_id=$1", tenant,
        )


# ---------- Pure-python hash tests (no DB) ----------

def test_hash_determinism_and_normalization():
    h1 = compute_question_hash("本月营业额怎么样?", "2025-01-01", "2025-12-31", _TENANT)
    h2 = compute_question_hash("  本月营业额怎么样?  ", "2025-01-01", "2025-12-31", _TENANT)
    h3 = compute_question_hash("本月营业额怎么样?", "2025-01-01", "2025-12-31", _TENANT_B)
    assert h1 == h2  # whitespace normalized
    assert h1 != h3  # factory_id in hash


def test_hash_case_insensitive_on_question():
    h1 = compute_question_hash("Top Products", "2025-01-01", "2025-12-31", _TENANT)
    h2 = compute_question_hash("TOP PRODUCTS", "2025-01-01", "2025-12-31", _TENANT)
    assert h1 == h2


def test_hash_different_ranges_produce_different_hashes():
    h1 = compute_question_hash("Q", "2025-01-01", "2025-06-30", _TENANT)
    h2 = compute_question_hash("Q", "2025-07-01", "2025-12-31", _TENANT)
    assert h1 != h2


# ---------- DB-backed tests ----------

async def test_put_then_get_roundtrip(pool):
    await _reset(pool, _TENANT)
    svc = NarrativeCacheService(pool)
    h = compute_question_hash("本月营业额", "2025-01-01", "2025-12-31", _TENANT)

    assert await svc.get(_TENANT, h) is None  # miss before put

    await svc.put(_TENANT, h, "营业额 ¥2,063 万", {"type": "kpi"}, tokens=1234)

    hit = await svc.get(_TENANT, h)
    assert hit is not None
    assert hit["answer"] == "营业额 ¥2,063 万"
    assert hit["chart_config"] == {"type": "kpi"}
    assert hit["tokens"] == 1234


async def test_upsert_replaces_existing(pool):
    await _reset(pool, _TENANT)
    svc = NarrativeCacheService(pool)
    h = compute_question_hash("Q", "2025-01-01", "2025-12-31", _TENANT)
    await svc.put(_TENANT, h, "v1", None, tokens=100)
    await svc.put(_TENANT, h, "v2", {"a": 1}, tokens=200)
    hit = await svc.get(_TENANT, h)
    assert hit["answer"] == "v2"
    assert hit["chart_config"] == {"a": 1}
    assert hit["tokens"] == 200


async def test_expired_rows_not_returned(pool):
    """TTL=0 → expires_at = now → get misses immediately."""
    await _reset(pool, _TENANT)
    svc = NarrativeCacheService(pool)
    h = compute_question_hash("expired", "2025-01-01", "2025-12-31", _TENANT)
    await svc.put(_TENANT, h, "stale", None, tokens=1, ttl_hours=0)
    await asyncio.sleep(0.05)
    assert await svc.get(_TENANT, h) is None


async def test_invalidate_on_upload_wipes_factory_only(pool):
    """invalidate wipes all factory A rows but not factory B's."""
    await _reset(pool, _TENANT)
    svc = NarrativeCacheService(pool)
    h_a1 = compute_question_hash("Q1", "2025-01-01", "2025-12-31", _TENANT)
    h_a2 = compute_question_hash("Q2", "2025-01-01", "2025-12-31", _TENANT)
    await svc.put(_TENANT, h_a1, "a1", None, tokens=1)
    await svc.put(_TENANT, h_a2, "a2", None, tokens=1)

    # Hop to tenant B — RLS session context swap
    await _reset(pool, _TENANT_B)
    h_b1 = compute_question_hash("Q1", "2025-01-01", "2025-12-31", _TENANT_B)
    await svc.put(_TENANT_B, h_b1, "b1", None, tokens=1)

    # Back to A to invalidate
    from smartbi.tenant_ctx import set_factory_id
    set_factory_id(_TENANT)
    deleted = await svc.invalidate_on_upload(_TENANT)
    assert deleted == 2
    assert await svc.get(_TENANT, h_a1) is None
    assert await svc.get(_TENANT, h_a2) is None

    # B's row still there
    set_factory_id(_TENANT_B)
    assert await svc.get(_TENANT_B, h_b1) is not None

    # Cleanup B
    await svc.invalidate_on_upload(_TENANT_B)


async def test_prune_expired_cleans_only_expired(pool):
    await _reset(pool, _TENANT)
    svc = NarrativeCacheService(pool)
    h_live = compute_question_hash("live", "2025-01-01", "2025-12-31", _TENANT)
    h_dead = compute_question_hash("dead", "2025-01-01", "2025-12-31", _TENANT)
    await svc.put(_TENANT, h_live, "alive", None, tokens=1, ttl_hours=24)
    await svc.put(_TENANT, h_dead, "gone", None, tokens=1, ttl_hours=0)
    await asyncio.sleep(0.05)

    pruned = await svc.prune_expired()
    assert pruned >= 1

    assert await svc.get(_TENANT, h_live) is not None
    assert await svc.get(_TENANT, h_dead) is None
