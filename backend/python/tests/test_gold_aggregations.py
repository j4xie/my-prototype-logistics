"""Tests for Gold aggregation tables — schema invariants.

Week 3 Day 1 of Unified Data Layer v1 spec (§4.1).

Schema-only tests here. Materializer logic (read Silver → UPSERT agg_*)
is tested in test_gold_materializer.py (Day 2).
"""
from __future__ import annotations

from datetime import date

import pytest
import pytest_asyncio


_AGG_TABLES = ("agg_daily", "agg_product", "agg_channel")
_TENANT = "TEST_GOLD_A"


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
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            for t in _AGG_TABLES:
                await conn.execute(f"DELETE FROM {t} WHERE factory_id=$1", _TENANT)
            for t in ("dim_product", "dim_payment_channel", "dim_store"):
                await conn.execute(f"DELETE FROM {t} WHERE factory_id=$1", _TENANT)
    finally:
        reset_factory_id(token)
    yield
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            for t in _AGG_TABLES:
                await conn.execute(f"DELETE FROM {t} WHERE factory_id=$1", _TENANT)
            for t in ("dim_product", "dim_payment_channel", "dim_store"):
                await conn.execute(f"DELETE FROM {t} WHERE factory_id=$1", _TENANT)
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_all_agg_tables_have_rls(pool):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class "
            "WHERE relkind='r' AND relname = ANY($1::text[])",
            list(_AGG_TABLES),
        )
        found = {r["relname"]: (r["relrowsecurity"], r["relforcerowsecurity"]) for r in rows}
        assert set(found) == set(_AGG_TABLES)
        for t, (rls, force) in found.items():
            assert rls, f"{t} missing RLS"
            assert force, f"{t} missing FORCE RLS"


@pytest.mark.asyncio
async def test_agg_product_month_must_be_first_of_month(pool, clean_rows):
    """agg_product.month = DATE_TRUNC('month', month). Enforced by CHECK."""
    import asyncpg.exceptions
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            pid = await conn.fetchval(
                """
                INSERT INTO dim_product (factory_id, name, normalized_name)
                VALUES ($1, 'p', 'p')
                ON CONFLICT (factory_id, normalized_name) DO UPDATE SET updated_at=NOW()
                RETURNING product_id
                """,
                _TENANT,
            )
            # First of month — ok.
            await conn.execute(
                "INSERT INTO agg_product (factory_id, product_id, month, qty_sold, revenue) "
                "VALUES ($1, $2, $3, 1, 1)",
                _TENANT, pid, date(2026, 4, 1),
            )
            # Mid-month — blocked by CHECK.
            with pytest.raises(asyncpg.exceptions.CheckViolationError):
                await conn.execute(
                    "INSERT INTO agg_product (factory_id, product_id, month, qty_sold, revenue) "
                    "VALUES ($1, $2, $3, 1, 1)",
                    _TENANT, pid, date(2026, 4, 15),
                )
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_agg_upsert_bumps_version(pool, clean_rows):
    """Materializer UPSERT pattern increments version on each recompute."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            store_id = await conn.fetchval(
                "INSERT INTO dim_store (factory_id, name) VALUES ($1, 'S') "
                "ON CONFLICT (factory_id, name) DO UPDATE SET updated_at=NOW() "
                "RETURNING store_id",
                _TENANT,
            )
            # First materialization.
            await conn.execute(
                """
                INSERT INTO agg_daily (factory_id, date, store_id, net_amount, bill_count)
                VALUES ($1, $2, $3, 100, 2)
                """,
                _TENANT, date(2026, 4, 21), store_id,
            )
            # Recompute.
            await conn.execute(
                """
                INSERT INTO agg_daily (factory_id, date, store_id, net_amount, bill_count)
                VALUES ($1, $2, $3, 150, 3)
                ON CONFLICT (factory_id, date, store_id)
                  DO UPDATE SET net_amount = EXCLUDED.net_amount,
                                bill_count = EXCLUDED.bill_count,
                                version    = agg_daily.version + 1,
                                computed_at = NOW()
                """,
                _TENANT, date(2026, 4, 21), store_id,
            )
            row = await conn.fetchrow(
                "SELECT version, net_amount FROM agg_daily "
                "WHERE factory_id=$1 AND date=$2 AND store_id=$3",
                _TENANT, date(2026, 4, 21), store_id,
            )
        assert row["version"] == 2
        assert row["net_amount"] == 150
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_agg_cascades_when_dim_deleted(pool, clean_rows):
    """Deleting a dim_store removes all its agg_daily rows (FK CASCADE)."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            store_id = await conn.fetchval(
                "INSERT INTO dim_store (factory_id, name) VALUES ($1, 'CascadeStore') "
                "ON CONFLICT (factory_id, name) DO UPDATE SET updated_at=NOW() "
                "RETURNING store_id",
                _TENANT,
            )
            await conn.execute(
                "INSERT INTO agg_daily (factory_id, date, store_id, net_amount) "
                "VALUES ($1, $2, $3, 100)",
                _TENANT, date(2026, 4, 21), store_id,
            )
            # Delete the store.
            await conn.execute("DELETE FROM dim_store WHERE store_id=$1", store_id)
            n = await conn.fetchval(
                "SELECT COUNT(*) FROM agg_daily WHERE store_id=$1", store_id
            )
        assert n == 0
    finally:
        reset_factory_id(token)
