"""Tests for DimResolver — concurrent-safe dim UPSERT with per-batch cache.

Week 2 Day 3 of Unified Data Layer v1 spec.

Integration tests use live Postgres. Tenant_ctx must match the resolver's
`factory_id` arg, otherwise RLS blocks the insert at WITH CHECK.
"""
from __future__ import annotations

import pytest
import pytest_asyncio

from smartbi.canonical import DimResolver


_TENANT_A = "TEST_DR_A"
_TENANT_B = "TEST_DR_B"


@pytest_asyncio.fixture
async def pool():
    import asyncpg
    from smartbi.config import get_settings
    from smartbi.tenant_ctx import set_pg_connection_tenant
    settings = get_settings()
    if not settings.postgres_url:
        pytest.skip("No Postgres configured")
    p = await asyncpg.create_pool(
        settings.postgres_url,
        min_size=1, max_size=3,
        setup=set_pg_connection_tenant,
    )
    try:
        yield p
    finally:
        await p.close()


@pytest_asyncio.fixture
async def clean_rows(pool):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    for fid in (_TENANT_A, _TENANT_B):
        token = set_factory_id(fid)
        try:
            async with pool.acquire() as conn:
                await conn.execute("DELETE FROM fact_pos_transaction WHERE factory_id=$1", fid)
                for t in ("dim_staff", "dim_product", "dim_payment_channel",
                          "dim_discount", "dim_store"):
                    await conn.execute(f"DELETE FROM {t} WHERE factory_id=$1", fid)
        finally:
            reset_factory_id(token)
    yield
    for fid in (_TENANT_A, _TENANT_B):
        token = set_factory_id(fid)
        try:
            async with pool.acquire() as conn:
                await conn.execute("DELETE FROM fact_pos_transaction WHERE factory_id=$1", fid)
                for t in ("dim_staff", "dim_product", "dim_payment_channel",
                          "dim_discount", "dim_store"):
                    await conn.execute(f"DELETE FROM {t} WHERE factory_id=$1", fid)
        finally:
            reset_factory_id(token)


@pytest_asyncio.fixture
async def resolver(pool):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT_A)
    try:
        yield DimResolver(pool, factory_id=_TENANT_A)
    finally:
        reset_factory_id(token)


# ── Basic UPSERT returns stable id ──────────────────────────

@pytest.mark.asyncio
async def test_resolve_store_idempotent(resolver, clean_rows):
    id1 = await resolver.resolve_store("门店A", brand="青花椒")
    id2 = await resolver.resolve_store("门店A", brand="青花椒")
    assert id1 == id2


@pytest.mark.asyncio
async def test_resolve_product_idempotent(resolver, clean_rows):
    id1 = await resolver.resolve_product("宫保鸡丁", "gongbaojiding", category="荤菜")
    # Raw name different, normalized_name same → same row.
    id2 = await resolver.resolve_product("宮保雞丁", "gongbaojiding", category="荤菜")
    assert id1 == id2


@pytest.mark.asyncio
async def test_resolve_staff_with_store_fk(resolver, clean_rows):
    store_id = await resolver.resolve_store("S")
    sid1 = await resolver.resolve_staff("小王", role="收银员", store_id=store_id)
    sid2 = await resolver.resolve_staff("小王", role="收银员", store_id=store_id)
    assert sid1 == sid2


@pytest.mark.asyncio
async def test_resolve_staff_same_name_different_stores_different_ids(resolver, clean_rows):
    store1 = await resolver.resolve_store("店1")
    store2 = await resolver.resolve_store("店2")
    s1 = await resolver.resolve_staff("同名员工", store_id=store1)
    s2 = await resolver.resolve_staff("同名员工", store_id=store2)
    assert s1 != s2


# ── Cache skips DB round trips ──────────────────────────────

@pytest.mark.asyncio
async def test_cache_hit_skips_db(pool, clean_rows):
    """Second call for same name uses cache, doesn't hit DB. Verify via a
    poisoned pool where the second acquire would raise — cache bypass
    means no acquire happens."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT_A)
    try:
        r = DimResolver(pool, factory_id=_TENANT_A)
        id1 = await r.resolve_store("cached_store")
        assert r.cache_stats()["store"] == 1
        # Poison pool after first call — second call must not touch it.
        r.pool = None  # type: ignore[assignment]
        id2 = await r.resolve_store("cached_store")
        assert id1 == id2
        assert r.cache_stats()["store"] == 1
    finally:
        reset_factory_id(token)


# ── Tenant isolation ────────────────────────────────────────

@pytest.mark.asyncio
async def test_resolver_mismatch_with_tenant_ctx_blocked(pool, clean_rows):
    """DimResolver constructed with factory_id=A but tenant_ctx is B →
    INSERT's WITH CHECK violates → InsufficientPrivilegeError. Protects
    against programmer error that would silently write the wrong tenant."""
    import asyncpg.exceptions
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    # tenant_ctx says TENANT_A
    token = set_factory_id(_TENANT_A)
    try:
        # But resolver is constructed for TENANT_B (intentional mismatch).
        bad_resolver = DimResolver(pool, factory_id=_TENANT_B)
        with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
            await bad_resolver.resolve_store("mismatch_store")
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_two_tenants_both_resolve_store_A_without_crossover(pool, clean_rows):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    token = set_factory_id(_TENANT_A)
    try:
        r_a = DimResolver(pool, factory_id=_TENANT_A)
        id_a = await r_a.resolve_store("共享名字", brand="A 家")
    finally:
        reset_factory_id(token)

    token = set_factory_id(_TENANT_B)
    try:
        r_b = DimResolver(pool, factory_id=_TENANT_B)
        id_b = await r_b.resolve_store("共享名字", brand="B 家")
    finally:
        reset_factory_id(token)

    assert id_a != id_b


# ── Discount parsed_ok OR semantics ─────────────────────────

@pytest.mark.asyncio
async def test_discount_parsed_ok_sticky(resolver, clean_rows):
    """Once any upsert sets parsed_ok=True, subsequent parsed_ok=False
    upserts leave it True (admin-confirmed data shouldn't get undone by
    a regression in automated parse)."""
    did1 = await resolver.resolve_discount("VIP卡", parsed_ok=True)

    # Wipe our cache so the next call hits DB again
    resolver._discount_cache.clear()

    did2 = await resolver.resolve_discount("VIP卡", parsed_ok=False)
    assert did1 == did2

    async with resolver.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT parsed_ok FROM dim_discount WHERE discount_id=$1", did1
        )
    assert row["parsed_ok"] is True


# ── Validation ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_empty_store_name_rejected(resolver, clean_rows):
    with pytest.raises(ValueError, match="store name required"):
        await resolver.resolve_store("")


@pytest.mark.asyncio
async def test_product_requires_both_name_and_normalized(resolver, clean_rows):
    with pytest.raises(ValueError):
        await resolver.resolve_product("x", "")
    with pytest.raises(ValueError):
        await resolver.resolve_product("", "y")


def test_resolver_requires_factory_id(pool):
    with pytest.raises(ValueError, match="factory_id required"):
        DimResolver(pool, factory_id="")


# ── Cache stats sanity ──────────────────────────────────────

@pytest.mark.asyncio
async def test_cache_stats_counts_unique_keys(resolver, clean_rows):
    await resolver.resolve_store("S1")
    await resolver.resolve_store("S2")
    await resolver.resolve_store("S1")   # cache hit — no new entry
    await resolver.resolve_product("P", "p")
    stats = resolver.cache_stats()
    assert stats["store"] == 2
    assert stats["product"] == 1
    assert stats["staff"] == 0
