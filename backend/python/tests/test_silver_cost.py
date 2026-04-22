"""Tests for Silver cost layer — fact_cost_line + dim_cost_category.

v1 Phase B cost foundation. Schema exists; ingest path is a library call
(no Bronze adapter for cost data yet — that lands with the accounting
import feature).
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio

from smartbi.canonical import CostLine, DimResolver, SilverNormalizer


_TENANT = "TEST_COST_A"


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


@pytest_asyncio.fixture
async def clean_rows(pool):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM fact_cost_line WHERE factory_id=$1", _TENANT)
            await conn.execute("DELETE FROM dim_cost_category WHERE factory_id=$1", _TENANT)
        yield
    finally:
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM fact_cost_line WHERE factory_id=$1", _TENANT)
            await conn.execute("DELETE FROM dim_cost_category WHERE factory_id=$1", _TENANT)
        reset_factory_id(token)


# ── Schema invariants ───────────────────────────────────────

@pytest.mark.asyncio
async def test_schema_has_rls(pool):
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class "
            "WHERE relkind='r' AND relname = ANY($1::text[])",
            ["dim_cost_category", "fact_cost_line"],
        )
        found = {r["relname"]: (r["relrowsecurity"], r["relforcerowsecurity"]) for r in rows}
    assert found == {"dim_cost_category": (True, True), "fact_cost_line": (True, True)}


@pytest.mark.asyncio
async def test_cost_type_check_rejects_invalid(pool, clean_rows):
    """DB CHECK constraint rejects cost_type outside the 4 allowed values."""
    import asyncpg.exceptions
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            with pytest.raises(asyncpg.exceptions.CheckViolationError):
                await conn.execute(
                    "INSERT INTO dim_cost_category (factory_id, name, cost_type) "
                    "VALUES ($1, 'x', 'badtype')",
                    _TENANT,
                )
    finally:
        reset_factory_id(token)


# ── DimResolver.resolve_cost_category ───────────────────────

@pytest.mark.asyncio
async def test_resolve_cost_category_idempotent(pool, clean_rows):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        r = DimResolver(pool, _TENANT)
        id1 = await r.resolve_cost_category("食材-主料", "material")
        id2 = await r.resolve_cost_category("食材-主料", "material")
        assert id1 == id2
        assert r.cache_stats()["cost_category"] == 1
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_resolve_cost_category_rejects_bad_type(pool, clean_rows):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        r = DimResolver(pool, _TENANT)
        with pytest.raises(ValueError, match="cost_type must be"):
            await r.resolve_cost_category("x", "bogus")
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_resolve_cost_category_rejects_empty_name(pool, clean_rows):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        r = DimResolver(pool, _TENANT)
        with pytest.raises(ValueError, match="cost category name required"):
            await r.resolve_cost_category("", "material")
    finally:
        reset_factory_id(token)


# ── SilverNormalizer.write_cost_line ────────────────────────

@pytest.mark.asyncio
async def test_write_cost_line_happy_path(pool, clean_rows):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        norm = SilverNormalizer(pool, _TENANT)
        line = CostLine(
            factory_id=_TENANT,
            source_type="accounting_import",
            cost_type="material",
            category_name="食材-主料",
            date=date(2026, 4, 1),
            amount=Decimal("50000.00"),
            is_fixed=False,
            note="本月食材采购",
        )
        fid = await norm.write_cost_line(line)
        assert fid is not None

        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT fcl.amount, fcl.note, fcl.date, c.name, c.cost_type "
                "FROM fact_cost_line fcl "
                "JOIN dim_cost_category c ON c.category_id = fcl.category_id "
                "WHERE fcl.id = $1",
                fid,
            )
        assert row["amount"] == Decimal("50000.00")
        assert row["note"] == "本月食材采购"
        assert row["name"] == "食材-主料"
        assert row["cost_type"] == "material"
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_write_cost_line_factory_mismatch_raises(pool, clean_rows):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        norm = SilverNormalizer(pool, _TENANT)
        bad = CostLine(
            factory_id="OTHER_TENANT",
            source_type="excel",
            cost_type="labor",
            category_name="x",
            date=date(2026, 4, 1),
            amount=Decimal("1"),
        )
        with pytest.raises(ValueError, match="doesn't match normalizer"):
            await norm.write_cost_line(bad)
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_ingest_cost_lines_batch(pool, clean_rows):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        norm = SilverNormalizer(pool, _TENANT)
        lines = [
            CostLine(
                factory_id=_TENANT, source_type="excel",
                cost_type=ct, category_name=cat,
                date=date(2026, 4, 1), amount=Decimal(amt),
                is_fixed=fixed,
            )
            for ct, cat, amt, fixed in [
                ("material", "食材-主料", "50000", False),
                ("labor", "人工-正式员工", "30000", True),
                ("overhead", "租金", "20000", True),
                ("other", "水电", "5000", False),
            ]
        ]
        n = await norm.ingest_cost_lines(lines)
        assert n == 4

        async with pool.acquire() as conn:
            by_type = await conn.fetch(
                """
                SELECT c.cost_type, SUM(fcl.amount) AS total
                  FROM fact_cost_line fcl
                  JOIN dim_cost_category c ON c.category_id = fcl.category_id
                 WHERE fcl.factory_id = $1
                 GROUP BY c.cost_type
                 ORDER BY c.cost_type
                """,
                _TENANT,
            )
        totals = {r["cost_type"]: r["total"] for r in by_type}
        assert totals == {
            "labor": Decimal("30000"),
            "material": Decimal("50000"),
            "other": Decimal("5000"),
            "overhead": Decimal("20000"),
        }
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_ingest_cost_lines_partial_failure_continues(pool, clean_rows):
    """One bad line doesn't abort the batch."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        norm = SilverNormalizer(pool, _TENANT)
        lines = [
            CostLine(
                factory_id=_TENANT, source_type="excel",
                cost_type="material", category_name="OK",
                date=date(2026, 4, 1), amount=Decimal("100"),
            ),
            CostLine(
                factory_id=_TENANT, source_type="excel",
                cost_type="invalid",  # will raise
                category_name="BAD",
                date=date(2026, 4, 1), amount=Decimal("50"),
            ),
            CostLine(
                factory_id=_TENANT, source_type="excel",
                cost_type="labor", category_name="OK2",
                date=date(2026, 4, 1), amount=Decimal("200"),
            ),
        ]
        n = await norm.ingest_cost_lines(lines)
        assert n == 2  # first + third; middle failed
    finally:
        reset_factory_id(token)
