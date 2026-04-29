"""Tests for Silver dimension tables.

Week 2 Day 1 of Unified Data Layer v1 spec (§2.1).

We don't re-prove the RLS plumbing (covered by Day 2 test_rls_isolation.py);
instead we verify each dim table has the policy attached + verify the
per-table UPSERT pattern is idempotent + verify cross-tenant name collisions
are permitted (two factories CAN each have "门店A").
"""
from __future__ import annotations

import pytest
import pytest_asyncio


_DIM_TABLES = (
    "dim_store",
    "dim_product",
    "dim_staff",
    "dim_payment_channel",
    "dim_discount",
)

_TENANT_A = "TEST_DIM_A"
_TENANT_B = "TEST_DIM_B"


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
        min_size=1,
        max_size=3,
        setup=set_pg_connection_tenant,
    )
    try:
        yield p
    finally:
        await p.close()


@pytest_asyncio.fixture
async def clean_rows(pool):
    """Wipe test-tenant rows in each dim table before + after."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    for fid in (_TENANT_A, _TENANT_B):
        token = set_factory_id(fid)
        try:
            async with pool.acquire() as conn:
                # Order matters for FK (dim_staff refs dim_store):
                # delete children first.
                for t in ("dim_staff", "dim_store", "dim_product",
                          "dim_payment_channel", "dim_discount"):
                    await conn.execute(
                        f"DELETE FROM {t} WHERE factory_id = $1", fid
                    )
        finally:
            reset_factory_id(token)
    yield
    for fid in (_TENANT_A, _TENANT_B):
        token = set_factory_id(fid)
        try:
            async with pool.acquire() as conn:
                for t in ("dim_staff", "dim_store", "dim_product",
                          "dim_payment_channel", "dim_discount"):
                    await conn.execute(
                        f"DELETE FROM {t} WHERE factory_id = $1", fid
                    )
        finally:
            reset_factory_id(token)


# ── RLS contract verification ────────────────────────────────

@pytest.mark.asyncio
async def test_all_dim_tables_have_rls_policy(pool):
    """Each dim_* table must have RLS enabled + forced + tenant_isolation policy.
    Guards against forgetting to add the three ALTER TABLE / CREATE POLICY
    stanzas when someone adds a new dim.
    """
    async with pool.acquire() as conn:
        # pg_class.relrowsecurity = RLS enabled; relforcerowsecurity = FORCE
        rows = await conn.fetch(
            """
            SELECT relname, relrowsecurity, relforcerowsecurity
              FROM pg_class
             WHERE relkind = 'r'
               AND relname = ANY($1::text[])
            """,
            list(_DIM_TABLES),
        )
        found = {r["relname"]: (r["relrowsecurity"], r["relforcerowsecurity"]) for r in rows}
        assert set(found.keys()) == set(_DIM_TABLES), f"missing tables: {set(_DIM_TABLES) - set(found)}"
        for t, (rls, force) in found.items():
            assert rls, f"{t} missing ENABLE ROW LEVEL SECURITY"
            assert force, f"{t} missing FORCE ROW LEVEL SECURITY"

        policies = await conn.fetch(
            """
            SELECT tablename, policyname
              FROM pg_policies
             WHERE tablename = ANY($1::text[])
               AND policyname = 'tenant_isolation'
            """,
            list(_DIM_TABLES),
        )
        got = {p["tablename"] for p in policies}
        assert got == set(_DIM_TABLES)


# ── UPSERT idempotency ───────────────────────────────────────

@pytest.mark.asyncio
async def test_dim_store_upsert_is_idempotent(pool, clean_rows):
    """Inserting the same (factory_id, name) twice returns the same store_id."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT_A)
    try:
        async with pool.acquire() as conn:
            id1 = await conn.fetchval(
                """
                INSERT INTO dim_store (factory_id, name, brand)
                VALUES ($1, $2, $3)
                ON CONFLICT (factory_id, name)
                  DO UPDATE SET updated_at = NOW(), brand = EXCLUDED.brand
                RETURNING store_id
                """,
                _TENANT_A, "门店A", "青花椒",
            )
            id2 = await conn.fetchval(
                """
                INSERT INTO dim_store (factory_id, name, brand)
                VALUES ($1, $2, $3)
                ON CONFLICT (factory_id, name)
                  DO UPDATE SET updated_at = NOW(), brand = EXCLUDED.brand
                RETURNING store_id
                """,
                _TENANT_A, "门店A", "青花椒-更新",
            )
        assert id1 == id2
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_dim_product_upsert_keyed_on_normalized_name(pool, clean_rows):
    """Two rows with same normalized_name but different raw names merge;
    this is the de-dup guarantee."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT_A)
    try:
        async with pool.acquire() as conn:
            pid1 = await conn.fetchval(
                """
                INSERT INTO dim_product (factory_id, name, normalized_name, category)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (factory_id, normalized_name)
                  DO UPDATE SET updated_at = NOW()
                RETURNING product_id
                """,
                _TENANT_A, "宫保鸡丁", "gongbaojiding", "荤菜",
            )
            pid2 = await conn.fetchval(
                """
                INSERT INTO dim_product (factory_id, name, normalized_name, category)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (factory_id, normalized_name)
                  DO UPDATE SET updated_at = NOW()
                RETURNING product_id
                """,
                _TENANT_A, "宮保雞丁",  # trad. script, same normalized form
                "gongbaojiding", "荤菜",
            )
        assert pid1 == pid2
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_dim_payment_channel_upsert(pool, clean_rows):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT_A)
    try:
        async with pool.acquire() as conn:
            id1 = await conn.fetchval(
                """
                INSERT INTO dim_payment_channel (factory_id, name, category)
                VALUES ($1, $2, $3)
                ON CONFLICT (factory_id, name)
                  DO UPDATE SET updated_at = NOW(), category = EXCLUDED.category
                RETURNING channel_id
                """,
                _TENANT_A, "美团支付", "online",
            )
            id2 = await conn.fetchval(
                """
                INSERT INTO dim_payment_channel (factory_id, name, category)
                VALUES ($1, $2, $3)
                ON CONFLICT (factory_id, name)
                  DO UPDATE SET updated_at = NOW(), category = EXCLUDED.category
                RETURNING channel_id
                """,
                _TENANT_A, "美团支付", "online",
            )
        assert id1 == id2
    finally:
        reset_factory_id(token)


# ── Cross-tenant name collision is ALLOWED ────────────────────

@pytest.mark.asyncio
async def test_two_tenants_can_share_store_name(pool, clean_rows):
    """Factory A and Factory B can both have a store named '门店A' —
    they're different rows (different factory_id), different store_ids."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id

    token = set_factory_id(_TENANT_A)
    try:
        async with pool.acquire() as conn:
            id_a = await conn.fetchval(
                """
                INSERT INTO dim_store (factory_id, name) VALUES ($1, $2)
                ON CONFLICT (factory_id, name) DO UPDATE SET updated_at=NOW()
                RETURNING store_id
                """,
                _TENANT_A, "门店A",
            )
    finally:
        reset_factory_id(token)

    token = set_factory_id(_TENANT_B)
    try:
        async with pool.acquire() as conn:
            id_b = await conn.fetchval(
                """
                INSERT INTO dim_store (factory_id, name) VALUES ($1, $2)
                ON CONFLICT (factory_id, name) DO UPDATE SET updated_at=NOW()
                RETURNING store_id
                """,
                _TENANT_B, "门店A",
            )
    finally:
        reset_factory_id(token)

    assert id_a != id_b


# ── Touch trigger ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_updated_at_touch_trigger_fires(pool, clean_rows):
    """Updating any field should bump updated_at (verifies the shared trigger
    fn is attached across tables)."""
    import asyncio
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT_A)
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO dim_store (factory_id, name) VALUES ($1, $2)",
                _TENANT_A, "touch_test",
            )
            t1 = await conn.fetchval(
                "SELECT updated_at FROM dim_store WHERE factory_id=$1 AND name=$2",
                _TENANT_A, "touch_test",
            )
            # NOW() is statement-time; need a tiny delay so t2 > t1 is observable.
            await asyncio.sleep(0.01)
            await conn.execute(
                "UPDATE dim_store SET brand = 'X' WHERE factory_id=$1 AND name=$2",
                _TENANT_A, "touch_test",
            )
            t2 = await conn.fetchval(
                "SELECT updated_at FROM dim_store WHERE factory_id=$1 AND name=$2",
                _TENANT_A, "touch_test",
            )
        assert t2 > t1
    finally:
        reset_factory_id(token)


# ── dim_date view ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dim_date_view_fields(pool):
    """Spot-check dim_date for a known date — covers year/quarter/month/
    iso_week/dow/weekend/year_month/year_quarter. No RLS since it's a view."""
    from datetime import date
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM dim_date WHERE calendar_date = $1", date(2026, 1, 5)
        )
    assert row is not None
    assert row["year"] == 2026
    assert row["quarter"] == 1
    assert row["month"] == 1
    assert row["day_of_week"] == 1  # Monday
    assert row["is_weekend"] is False
    assert row["year_month"] == "2026-01"
    assert row["year_quarter"] == "2026-Q1"


@pytest.mark.asyncio
async def test_dim_date_view_spans_expected_range(pool):
    """View covers 2020 through 2030 — 11 full years ≈ 4017 days."""
    async with pool.acquire() as conn:
        n = await conn.fetchval("SELECT COUNT(*) FROM dim_date")
    assert 4000 < n < 4050  # generous bound, leap years vary
