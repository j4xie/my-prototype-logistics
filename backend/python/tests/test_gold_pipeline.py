"""Tests for ingest_and_materialize — the one-shot pipeline wrapper.

Week 4 Day 1 of Unified Data Layer v1 spec.

Focuses on wiring correctness (does it call Silver then Gold?) and the
range-derivation helper. Happy-path E2E is already covered by
test_gold_triggers.test_upload_complete_trigger_end_to_end; this suite
verifies the thin pipeline layer adds no bugs.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio

from smartbi.canonical import CanonicalRow
from smartbi.gold import ingest_and_materialize
from smartbi.gold.pipeline import _derive_range


_TENANT = "TEST_PIPE_A"


# ── _derive_range helper ────────────────────────────────────

def test_derive_range_empty_input():
    r = _derive_range([])
    assert r[0] == r[1]  # today..today degenerate


def test_derive_range_single_row():
    row = CanonicalRow(
        factory_id="x", source_type="excel",
        store_name="s", source_bill_no="b", date=date(2026, 4, 21),
    )
    assert _derive_range([row]) == (date(2026, 4, 21), date(2026, 4, 21))


def test_derive_range_multiple_rows_picks_min_max():
    rows = [
        CanonicalRow(factory_id="x", source_type="e", store_name="s",
                     source_bill_no=str(i), date=d)
        for i, d in enumerate([
            date(2026, 4, 15),
            date(2026, 4, 28),
            date(2026, 4, 20),
            date(2026, 4, 5),
        ])
    ]
    assert _derive_range(rows) == (date(2026, 4, 5), date(2026, 4, 28))


# ── Validation ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_empty_factory_id_raises():
    with pytest.raises(ValueError, match="factory_id required"):
        await ingest_and_materialize(None, "", [])


@pytest.mark.asyncio
async def test_inverted_explicit_range_raises():
    with pytest.raises(ValueError, match="date_range start > end"):
        await ingest_and_materialize(
            None, "F", [],
            date_range=(date(2026, 4, 22), date(2026, 4, 21)),
        )


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
async def test_pipeline_writes_silver_and_materializes_gold(pool, clean_rows):
    """Full happy path — one call produces both fact rows and agg rows."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        rows = [
            CanonicalRow(
                factory_id=_TENANT, source_type="excel",
                store_name="S1", source_bill_no="P1",
                date=date(2026, 4, 21),
                net_amount=Decimal("20"),
                combo_string="#米饭#_1份*3+#可乐#_1份*8",
                payments=(("现金", Decimal("11")),),
            ),
            CanonicalRow(
                factory_id=_TENANT, source_type="excel",
                store_name="S2", source_bill_no="P2",
                date=date(2026, 4, 22),
                net_amount=Decimal("30"),
                combo_string="#可乐#_3份*8",
                payments=(("美团支付", Decimal("24")),),
            ),
        ]
        stats = await ingest_and_materialize(pool, _TENANT, rows)

        assert stats.normalize.transactions_written == 2
        assert stats.normalize.items_written == 3
        assert stats.trigger.reason == "upload_complete"
        assert stats.trigger.total_rows_upserted > 0

        async with pool.acquire() as conn:
            n_txn = await conn.fetchval(
                "SELECT COUNT(*) FROM fact_pos_transaction WHERE factory_id=$1", _TENANT
            )
            n_daily = await conn.fetchval(
                "SELECT COUNT(*) FROM agg_daily WHERE factory_id=$1", _TENANT
            )
        assert n_txn == 2
        assert n_daily == 2
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_pipeline_uses_explicit_range_widens_scope(pool, clean_rows):
    """Caller can widen the range beyond the actual row dates (useful for
    backfill-then-refresh patterns that want to recompute a bigger window)."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        rows = [
            CanonicalRow(
                factory_id=_TENANT, source_type="excel",
                store_name="S1", source_bill_no="W1",
                date=date(2026, 4, 21),
                combo_string="#米饭#_1份*3",
            ),
        ]
        stats = await ingest_and_materialize(
            pool, _TENANT, rows,
            date_range=(date(2026, 3, 1), date(2026, 4, 30)),
        )
        # March + April = 2 months for materialize_product, 1 materialize_daily
        # call + 1 materialize_channel call = 4 materialize_ calls total.
        assert len(stats.trigger.results) == 4
    finally:
        reset_factory_id(token)


@pytest.mark.asyncio
async def test_pipeline_empty_rows_is_noop(pool, clean_rows):
    """Empty rows → still fires trigger (degenerate today..today) but no
    actual work done. Caller can check stats to decide whether to log."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        stats = await ingest_and_materialize(pool, _TENANT, [])
        assert stats.normalize.transactions_written == 0
        assert stats.trigger.total_rows_upserted == 0
    finally:
        reset_factory_id(token)
