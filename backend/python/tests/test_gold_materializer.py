"""Tests for GoldMaterializer — Silver fact_pos_* → agg_*.

Week 3 Day 2 of Unified Data Layer v1 spec.

Seeds Silver via SilverNormalizer (proving the integration boundary
works), then fires each materialize_* and asserts the agg_* contents.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio

from smartbi.canonical import CanonicalRow, SilverNormalizer
from smartbi.gold import GoldMaterializer


_TENANT = "TEST_GM_A"


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
            for t in ("agg_daily", "agg_product", "agg_channel"):
                await conn.execute(f"DELETE FROM {t} WHERE factory_id=$1", _TENANT)
            await conn.execute("DELETE FROM fact_pos_transaction WHERE factory_id=$1", _TENANT)
            for t in ("dim_staff", "dim_product", "dim_payment_channel",
                      "dim_discount", "dim_store"):
                await conn.execute(f"DELETE FROM {t} WHERE factory_id=$1", _TENANT)
    finally:
        reset_factory_id(token)
    yield
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            for t in ("agg_daily", "agg_product", "agg_channel"):
                await conn.execute(f"DELETE FROM {t} WHERE factory_id=$1", _TENANT)
            await conn.execute("DELETE FROM fact_pos_transaction WHERE factory_id=$1", _TENANT)
            for t in ("dim_staff", "dim_product", "dim_payment_channel",
                      "dim_discount", "dim_store"):
                await conn.execute(f"DELETE FROM {t} WHERE factory_id=$1", _TENANT)
    finally:
        reset_factory_id(token)


@pytest_asyncio.fixture
async def seeded_silver(pool, clean_rows):
    """Seed three bills across two stores + two days via SilverNormalizer.

    After seeding:
    - 2 stores (S1, S2)
    - 2 products (米饭, 可乐)
    - 2 channels (现金, 美团支付)
    - 3 transactions: 2 on 2026-04-21 at S1, 1 on 2026-04-22 at S2
    - Items: bill1 has 米饭×1 + 可乐×1; bill2 has 米饭×2; bill3 has 可乐×3
    - Payments: bill1 现金 11; bill2 现金 6; bill3 美团支付 24
    """
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        norm = SilverNormalizer(pool, factory_id=_TENANT)

        await norm.write_row(CanonicalRow(
            factory_id=_TENANT, source_type="excel",
            store_name="S1", source_bill_no="B1", date=date(2026, 4, 21),
            gross_amount=Decimal("11"), net_amount=Decimal("11"),
            customer_count=2,
            combo_string="#米饭#_1份*3+#可乐#_1份*8",
            payments=(("现金", Decimal("11.00")),),
        ))

        await norm.write_row(CanonicalRow(
            factory_id=_TENANT, source_type="excel",
            store_name="S1", source_bill_no="B2", date=date(2026, 4, 21),
            gross_amount=Decimal("6"), net_amount=Decimal("6"),
            customer_count=1,
            combo_string="#米饭#_2份*3",
            payments=(("现金", Decimal("6.00")),),
        ))

        await norm.write_row(CanonicalRow(
            factory_id=_TENANT, source_type="excel",
            store_name="S2", source_bill_no="B3", date=date(2026, 4, 22),
            gross_amount=Decimal("24"), net_amount=Decimal("24"),
            customer_count=3,
            combo_string="#可乐#_3份*8",
            payments=(("美团支付", Decimal("24.00")),),
        ))
        yield norm
    finally:
        reset_factory_id(token)


# ── agg_daily ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_materialize_daily_rolls_up_per_store_per_date(pool, seeded_silver):
    """3 bills → 2 agg_daily rows (S1 on 4-21 has 2 bills summed, S2 on 4-22 has 1)."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        gm = GoldMaterializer(pool, factory_id=_TENANT)
        stats = await gm.materialize_daily((date(2026, 4, 21), date(2026, 4, 22)))
        assert stats.target == "agg_daily"
        assert stats.rows_upserted == 2

        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT date, net_amount, bill_count, customer_count, item_count "
                "FROM agg_daily WHERE factory_id=$1 ORDER BY date, store_id",
                _TENANT,
            )
        assert len(rows) == 2
        # S1 on 4-21: bills B1 + B2, net=11+6=17, customers=2+1=3, items=2+1=3
        r1 = rows[0]
        assert r1["date"] == date(2026, 4, 21)
        assert r1["net_amount"] == Decimal("17")
        assert r1["bill_count"] == 2
        assert r1["customer_count"] == 3
        assert r1["item_count"] == 3
        # S2 on 4-22: bill B3, net=24, customers=3, items=1
        r2 = rows[1]
        assert r2["date"] == date(2026, 4, 22)
        assert r2["net_amount"] == Decimal("24")
        assert r2["bill_count"] == 1
        assert r2["item_count"] == 1
    finally:
        reset_factory_id(token)


# ── agg_product ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_materialize_product_aggregates_by_month(pool, seeded_silver):
    """All 3 bills in April → per-product April totals.
    米饭: qty=1+2=3 at price=3 so revenue=3+6=9, bill_count=2
    可乐: qty=1+3=4 at price=8 so revenue=8+24=32, bill_count=2
    """
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        gm = GoldMaterializer(pool, factory_id=_TENANT)
        stats = await gm.materialize_product(date(2026, 4, 1))
        assert stats.target == "agg_product"
        assert stats.rows_upserted == 2

        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT p.name, a.qty_sold, a.revenue, a.bill_count
                  FROM agg_product a
                  JOIN dim_product p ON p.product_id = a.product_id
                 WHERE a.factory_id=$1 ORDER BY p.name
                """,
                _TENANT,
            )
        by_name = {r["name"]: r for r in rows}
        assert Decimal(str(by_name["米饭"]["qty_sold"])) == Decimal("3")
        assert Decimal(str(by_name["米饭"]["revenue"])) == Decimal("9")
        assert by_name["米饭"]["bill_count"] == 2
        assert Decimal(str(by_name["可乐"]["qty_sold"])) == Decimal("4")
        assert Decimal(str(by_name["可乐"]["revenue"])) == Decimal("32")
        assert by_name["可乐"]["bill_count"] == 2
    finally:
        reset_factory_id(token)


# ── agg_channel ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_materialize_channel_splits_by_channel_and_date(pool, seeded_silver):
    """现金 on 4-21: bills B1+B2 → amount=11+6=17, bill_count=2.
    美团支付 on 4-22: bill B3 → amount=24, bill_count=1.
    """
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        gm = GoldMaterializer(pool, factory_id=_TENANT)
        stats = await gm.materialize_channel((date(2026, 4, 21), date(2026, 4, 22)))
        assert stats.rows_upserted == 2

        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT ch.name, a.date, a.amount, a.bill_count
                  FROM agg_channel a
                  JOIN dim_payment_channel ch ON ch.channel_id = a.channel_id
                 WHERE a.factory_id=$1 ORDER BY a.date, ch.name
                """,
                _TENANT,
            )
        r1, r2 = rows
        assert r1["name"] == "现金"
        assert r1["date"] == date(2026, 4, 21)
        assert r1["amount"] == Decimal("17")
        assert r1["bill_count"] == 2
        assert r2["name"] == "美团支付"
        assert r2["date"] == date(2026, 4, 22)
        assert r2["amount"] == Decimal("24")
    finally:
        reset_factory_id(token)


# ── Recompute bumps version ─────────────────────────────────

@pytest.mark.asyncio
async def test_rerun_materialize_bumps_version(pool, seeded_silver):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        gm = GoldMaterializer(pool, factory_id=_TENANT)
        await gm.materialize_daily((date(2026, 4, 21), date(2026, 4, 22)))
        await gm.materialize_daily((date(2026, 4, 21), date(2026, 4, 22)))

        async with pool.acquire() as conn:
            versions = await conn.fetch(
                "SELECT version FROM agg_daily WHERE factory_id=$1", _TENANT
            )
        assert [r["version"] for r in versions] == [2, 2]  # both rows bumped
    finally:
        reset_factory_id(token)


# ── Empty range ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_materialize_daily_empty_range_no_exception(pool, clean_rows):
    """Materializer must handle a scope with no underlying fact rows cleanly."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        gm = GoldMaterializer(pool, factory_id=_TENANT)
        stats = await gm.materialize_daily((date(1999, 1, 1), date(1999, 1, 2)))
        assert stats.rows_upserted == 0
    finally:
        reset_factory_id(token)


# ── Validation ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_inverted_range_raises(pool):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        gm = GoldMaterializer(pool, factory_id=_TENANT)
        with pytest.raises(ValueError, match="start .* > end"):
            await gm.materialize_daily((date(2026, 4, 22), date(2026, 4, 21)))
        with pytest.raises(ValueError):
            await gm.materialize_channel((date(2026, 4, 22), date(2026, 4, 21)))
    finally:
        reset_factory_id(token)


def test_materializer_requires_factory_id(pool):
    with pytest.raises(ValueError, match="factory_id required"):
        GoldMaterializer(pool, factory_id="")


@pytest.mark.asyncio
async def test_parser_miss_items_excluded_from_agg_product(pool, clean_rows):
    """fact_pos_item rows with product_id=NULL (parser miss) must NOT be
    aggregated into agg_product — agg_product represents known products only.
    """
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        norm = SilverNormalizer(pool, factory_id=_TENANT)
        await norm.write_row(CanonicalRow(
            factory_id=_TENANT, source_type="excel",
            store_name="S", source_bill_no="PMISS", date=date(2026, 4, 21),
            combo_string="#米饭#_1份*3+这是垃圾数据",
        ))
        gm = GoldMaterializer(pool, factory_id=_TENANT)
        stats = await gm.materialize_product(date(2026, 4, 1))
        # Only 米饭 should land in agg_product; the garbage row is dropped.
        assert stats.rows_upserted == 1

        async with pool.acquire() as conn:
            names = await conn.fetch(
                "SELECT p.name FROM agg_product a JOIN dim_product p ON p.product_id = a.product_id "
                "WHERE a.factory_id=$1", _TENANT,
            )
        assert [r["name"] for r in names] == ["米饭"]
    finally:
        reset_factory_id(token)
