"""Tests for MaterializationTrigger strategies.

Week 3 Day 3 of Unified Data Layer v1 spec.

Covers each trigger's scope computation, plus an end-to-end test that
fires UploadCompleteTrigger against a seeded Silver and verifies all 3
agg_* tables are populated.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio

from smartbi.canonical import CanonicalRow, SilverNormalizer
from smartbi.gold import (
    ApiAppendIncrementalTrigger,
    FieldRegistryReviewedTrigger,
    GoldMaterializer,
    MaterializeStats,
    UploadCompleteTrigger,
)
from smartbi.gold.triggers import _months_in_range


_TENANT = "TEST_GT_A"


# ── _months_in_range helper ─────────────────────────────────

def test_months_in_range_single_month():
    assert _months_in_range(date(2026, 4, 5), date(2026, 4, 25)) == [date(2026, 4, 1)]


def test_months_in_range_two_months():
    assert _months_in_range(date(2026, 4, 15), date(2026, 5, 10)) == [
        date(2026, 4, 1), date(2026, 5, 1),
    ]


def test_months_in_range_across_year_boundary():
    assert _months_in_range(date(2025, 11, 20), date(2026, 2, 5)) == [
        date(2025, 11, 1),
        date(2025, 12, 1),
        date(2026, 1, 1),
        date(2026, 2, 1),
    ]


def test_months_in_range_same_day():
    assert _months_in_range(date(2026, 4, 21), date(2026, 4, 21)) == [date(2026, 4, 1)]


# ── Trigger call sequencing (via mock materializer) ─────────

@pytest.mark.asyncio
async def test_upload_complete_calls_daily_channel_and_each_month():
    """UploadCompleteTrigger(4/15, 5/10) should call:
      - materialize_daily once with (4/15, 5/10)
      - materialize_channel once with same range
      - materialize_product twice (4/1 and 5/1)
    """
    mat = MagicMock()
    mat.factory_id = "F"
    mat.materialize_daily = AsyncMock(
        return_value=MaterializeStats("agg_daily", 5, "F"))
    mat.materialize_channel = AsyncMock(
        return_value=MaterializeStats("agg_channel", 3, "F"))
    mat.materialize_product = AsyncMock(
        return_value=MaterializeStats("agg_product", 2, "F"))
    mat.materialize_discount = AsyncMock(
        return_value=MaterializeStats("agg_discount", 1, "F"))

    trig = UploadCompleteTrigger(date(2026, 4, 15), date(2026, 5, 10))
    result = await trig.fire(mat)

    assert result.reason == "upload_complete"
    # daily + channel + 2 × (product + discount) = 6 per-table results
    assert len(result.results) == 6
    mat.materialize_daily.assert_awaited_once_with((date(2026, 4, 15), date(2026, 5, 10)))
    mat.materialize_channel.assert_awaited_once_with((date(2026, 4, 15), date(2026, 5, 10)))
    assert mat.materialize_product.await_count == 2
    assert mat.materialize_discount.await_count == 2
    mat.materialize_product.assert_any_await(date(2026, 4, 1))
    mat.materialize_product.assert_any_await(date(2026, 5, 1))
    mat.materialize_discount.assert_any_await(date(2026, 4, 1))
    mat.materialize_discount.assert_any_await(date(2026, 5, 1))


@pytest.mark.asyncio
async def test_api_append_incremental_uses_today_minus_days_back():
    """days_back=3 + today=4/20 → scope (4/17, 4/20)."""
    mat = MagicMock()
    mat.factory_id = "F"
    mat.materialize_daily = AsyncMock(
        return_value=MaterializeStats("agg_daily", 0, "F"))
    mat.materialize_channel = AsyncMock(
        return_value=MaterializeStats("agg_channel", 0, "F"))
    mat.materialize_product = AsyncMock(
        return_value=MaterializeStats("agg_product", 0, "F"))
    mat.materialize_discount = AsyncMock(
        return_value=MaterializeStats("agg_discount", 0, "F"))

    trig = ApiAppendIncrementalTrigger(days_back=3, today=date(2026, 4, 20))
    await trig.fire(mat)

    mat.materialize_daily.assert_awaited_once_with((date(2026, 4, 17), date(2026, 4, 20)))


@pytest.mark.asyncio
async def test_field_registry_reviewed_fire():
    """FieldRegistryReviewedTrigger is currently identical to UploadComplete
    in call pattern but uses a different `reason` label for observability."""
    mat = MagicMock()
    mat.factory_id = "F"
    mat.materialize_daily = AsyncMock(
        return_value=MaterializeStats("agg_daily", 0, "F"))
    mat.materialize_channel = AsyncMock(
        return_value=MaterializeStats("agg_channel", 0, "F"))
    mat.materialize_product = AsyncMock(
        return_value=MaterializeStats("agg_product", 0, "F"))
    mat.materialize_discount = AsyncMock(
        return_value=MaterializeStats("agg_discount", 0, "F"))

    trig = FieldRegistryReviewedTrigger(date(2026, 4, 1), date(2026, 4, 30))
    result = await trig.fire(mat)
    assert result.reason == "field_registry_reviewed"


# ── Trigger validation ──────────────────────────────────────

def test_upload_complete_rejects_non_date_args():
    with pytest.raises(TypeError):
        UploadCompleteTrigger("2026-04-15", date(2026, 4, 20))  # str not date


def test_api_append_incremental_rejects_invalid_days_back():
    with pytest.raises(ValueError, match="days_back must be >= 1"):
        ApiAppendIncrementalTrigger(days_back=0)


@pytest.mark.asyncio
async def test_inverted_range_raises():
    mat = MagicMock()
    trig = UploadCompleteTrigger(date(2026, 5, 1), date(2026, 4, 1))
    with pytest.raises(ValueError, match="date_min .* > date_max"):
        await trig.fire(mat)


# ── Reason labels ───────────────────────────────────────────

def test_each_trigger_has_distinct_reason():
    assert UploadCompleteTrigger(date(2026, 4, 1), date(2026, 4, 1)).reason == "upload_complete"
    assert FieldRegistryReviewedTrigger(date(2026, 4, 1), date(2026, 4, 1)).reason == "field_registry_reviewed"
    assert ApiAppendIncrementalTrigger(today=date(2026, 4, 1)).reason == "api_append_incremental"


# ── Live-DB end-to-end ──────────────────────────────────────

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


@pytest.mark.asyncio
async def test_upload_complete_trigger_end_to_end(pool, clean_rows):
    """Seed Silver with 2 bills across 2 days, fire trigger, verify all 3
    agg_* tables reflect the data. This is the full Bronze→Silver→Gold
    pipeline (minus Bronze — we inject CanonicalRow directly)."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        norm = SilverNormalizer(pool, factory_id=_TENANT)
        await norm.write_row(CanonicalRow(
            factory_id=_TENANT, source_type="excel",
            store_name="S1", source_bill_no="E2E-1", date=date(2026, 4, 21),
            gross_amount=Decimal("50"), net_amount=Decimal("50"),
            combo_string="#米饭#_1份*3+#可乐#_1份*8",
            payments=(("现金", Decimal("50")),),
        ))
        await norm.write_row(CanonicalRow(
            factory_id=_TENANT, source_type="excel",
            store_name="S1", source_bill_no="E2E-2", date=date(2026, 4, 22),
            gross_amount=Decimal("20"), net_amount=Decimal("20"),
            combo_string="#米饭#_2份*3",
            payments=(("美团支付", Decimal("20")),),
        ))

        mat = GoldMaterializer(pool, factory_id=_TENANT)
        trigger = UploadCompleteTrigger(date(2026, 4, 21), date(2026, 4, 22))
        result = await trigger.fire(mat)

        # 2 daily + 1 channel × 2 dates = 2 channel rows + 2 products in 1 month
        # daily=2, channel=2, product=2 → total=6 upserts
        assert result.total_rows_upserted == 6

        async with pool.acquire() as conn:
            daily = await conn.fetchval(
                "SELECT COUNT(*) FROM agg_daily WHERE factory_id=$1", _TENANT
            )
            product = await conn.fetchval(
                "SELECT COUNT(*) FROM agg_product WHERE factory_id=$1", _TENANT
            )
            channel = await conn.fetchval(
                "SELECT COUNT(*) FROM agg_channel WHERE factory_id=$1", _TENANT
            )
        assert daily == 2
        assert product == 2
        assert channel == 2
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_total_rows_upserted_aggregates_across_all_calls():
    """TriggerResult.total_rows_upserted sums all underlying materialize_*
    stats, regardless of target."""
    mat = MagicMock()
    mat.factory_id = "F"
    mat.materialize_daily = AsyncMock(
        return_value=MaterializeStats("agg_daily", 10, "F"))
    mat.materialize_channel = AsyncMock(
        return_value=MaterializeStats("agg_channel", 5, "F"))
    mat.materialize_product = AsyncMock(
        return_value=MaterializeStats("agg_product", 3, "F"))
    mat.materialize_discount = AsyncMock(
        return_value=MaterializeStats("agg_discount", 3, "F"))

    trig = UploadCompleteTrigger(date(2026, 4, 1), date(2026, 4, 30))
    result = await trig.fire(mat)
    # April only: daily=10 + channel=5 + product=3 + discount=3 = 21
    assert result.total_rows_upserted == 21
