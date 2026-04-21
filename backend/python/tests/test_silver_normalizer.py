"""Tests for SilverNormalizer — end-to-end write of CanonicalRow → facts.

Week 2 Day 4 of Unified Data Layer v1 spec.

Covers:
- Happy path: 3 rows with shared store + shared payment channels end up
  with exactly 2 dim_store rows, 2 dim_payment_channel rows, and the
  expected counts across fact tables.
- Duplicate bill (same factory, source, store, bill_no): second call
  returns None without double-writing children.
- Parser miss: a combo with one unparseable piece writes fact_pos_item
  with product_id=NULL + source_item_raw populated.
- Factory mismatch between CanonicalRow and normalizer: raises ValueError.
- Empty combo/payments/discounts: transaction row still lands, no
  children written.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio

from smartbi.canonical import CanonicalRow, SilverNormalizer


_TENANT = "TEST_SN_A"


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
            # fact_pos_transaction cascade covers its children.
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
            await conn.execute("DELETE FROM fact_pos_transaction WHERE factory_id=$1", _TENANT)
            for t in ("dim_staff", "dim_product", "dim_payment_channel",
                      "dim_discount", "dim_store"):
                await conn.execute(f"DELETE FROM {t} WHERE factory_id=$1", _TENANT)
    finally:
        reset_factory_id(token)


@pytest_asyncio.fixture
async def normalizer(pool):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        yield SilverNormalizer(pool, factory_id=_TENANT)
    finally:
        reset_factory_id(token)


def _row(
    *,
    bill: str,
    store: str = "门店A",
    combo: str = "",
    payments=(),
    discounts=(),
    staff: str = None,
    net: str = "100.00",
) -> CanonicalRow:
    """Compact factory for CanonicalRow in tests."""
    return CanonicalRow(
        factory_id=_TENANT,
        source_type="excel",
        store_name=store,
        source_bill_no=bill,
        date=date(2026, 4, 21),
        staff_name=staff,
        net_amount=Decimal(net),
        combo_string=combo,
        payments=tuple((c, Decimal(str(a))) for c, a in payments),
        discounts=tuple((n, Decimal(str(a)), q) for n, a, q in discounts),
    )


# ── End-to-end happy path ────────────────────────────────────

@pytest.mark.asyncio
async def test_write_three_rows_shared_dims(normalizer, clean_rows):
    """Three bills: two at 门店A, one at 门店B. Two payment channels used
    across them. Expected final DB state:
      - dim_store: 2 rows (门店A, 门店B)
      - dim_product: 3 rows (宫保鸡丁, 米饭, 可乐 — shared across bills)
      - dim_payment_channel: 2 rows (现金, 美团支付)
      - fact_pos_transaction: 3 rows
      - fact_pos_item: 2+3+1 = 6 rows (item counts per combo below)
      - fact_pos_payment: 1+2+1 = 4 rows
    """
    rows = [
        _row(
            bill="B1",
            store="门店A",
            combo="#宫保鸡丁#_1份*38+#米饭#_2份*3",
            payments=[("现金", "44.00")],
        ),
        _row(
            bill="B2",
            store="门店A",
            combo="#宫保鸡丁#_1份*38+#可乐#_2份*8+#米饭#_1份*3",
            payments=[("美团支付", "50.00"), ("现金", "7.00")],
        ),
        _row(
            bill="B3",
            store="门店B",
            combo="#米饭#_1份*3",
            payments=[("美团支付", "3.00")],
        ),
    ]
    stats = await normalizer.ingest_rows(rows)
    assert stats.transactions_written == 3
    assert stats.items_written == 6
    assert stats.items_unresolved == 0
    assert stats.payments_written == 4

    async with normalizer.pool.acquire() as conn:
        n_store = await conn.fetchval(
            "SELECT COUNT(*) FROM dim_store WHERE factory_id=$1", _TENANT
        )
        n_prod = await conn.fetchval(
            "SELECT COUNT(*) FROM dim_product WHERE factory_id=$1", _TENANT
        )
        n_chan = await conn.fetchval(
            "SELECT COUNT(*) FROM dim_payment_channel WHERE factory_id=$1", _TENANT
        )
        n_txn = await conn.fetchval(
            "SELECT COUNT(*) FROM fact_pos_transaction WHERE factory_id=$1", _TENANT
        )
        n_item = await conn.fetchval(
            "SELECT COUNT(*) FROM fact_pos_item WHERE factory_id=$1", _TENANT
        )
        n_pay = await conn.fetchval(
            "SELECT COUNT(*) FROM fact_pos_payment WHERE factory_id=$1", _TENANT
        )

    assert n_store == 2
    assert n_prod == 3
    assert n_chan == 2
    assert n_txn == 3
    assert n_item == 6
    assert n_pay == 4


# ── Duplicate bill idempotency ──────────────────────────────

@pytest.mark.asyncio
async def test_duplicate_bill_returns_none_no_children_doubled(normalizer, clean_rows):
    row = _row(
        bill="DUP1",
        combo="#米饭#_1份*3",
        payments=[("现金", "3.00")],
    )
    id1 = await normalizer.write_row(row)
    assert id1 is not None

    id2 = await normalizer.write_row(row)  # same factory+source+store+bill_no
    assert id2 is None

    async with normalizer.pool.acquire() as conn:
        n_txn = await conn.fetchval(
            "SELECT COUNT(*) FROM fact_pos_transaction WHERE factory_id=$1 AND source_bill_no='DUP1'",
            _TENANT,
        )
        n_item = await conn.fetchval(
            "SELECT COUNT(*) FROM fact_pos_item WHERE factory_id=$1 AND transaction_id=$2",
            _TENANT, id1,
        )
        n_pay = await conn.fetchval(
            "SELECT COUNT(*) FROM fact_pos_payment WHERE factory_id=$1 AND transaction_id=$2",
            _TENANT, id1,
        )
    assert n_txn == 1
    assert n_item == 1
    assert n_pay == 1


# ── Parser miss ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_combo_partial_miss_writes_null_product_with_raw_blob(normalizer, clean_rows):
    row = _row(
        bill="PARSER_MISS",
        combo="#米饭#_1份*3+盘子坏了_空盘*0+#可乐#_1份*8",
    )
    stats = await normalizer.ingest_rows([row])
    assert stats.items_written == 3
    assert stats.items_unresolved == 1

    async with normalizer.pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT product_id, source_item_raw FROM fact_pos_item
             WHERE factory_id=$1
             ORDER BY id
            """,
            _TENANT,
        )
    # 1st + 3rd items resolved, middle one has product_id=NULL
    assert rows[0]["product_id"] is not None
    assert rows[1]["product_id"] is None
    assert rows[1]["source_item_raw"] == "盘子坏了_空盘*0"
    assert rows[2]["product_id"] is not None


# ── Factory mismatch guard ──────────────────────────────────

@pytest.mark.asyncio
async def test_canonical_row_factory_mismatch_raises(normalizer, clean_rows):
    bad = CanonicalRow(
        factory_id="OTHER_TENANT",
        source_type="excel",
        store_name="x",
        source_bill_no="x",
        date=date(2026, 4, 21),
    )
    with pytest.raises(ValueError, match="doesn't match normalizer"):
        await normalizer.write_row(bad)


# ── Empty children ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_empty_combo_and_eav_still_writes_transaction(normalizer, clean_rows):
    row = _row(bill="EMPTY_CHILDREN", combo="")
    txn_id = await normalizer.write_row(row)
    assert txn_id is not None

    async with normalizer.pool.acquire() as conn:
        n_item = await conn.fetchval(
            "SELECT COUNT(*) FROM fact_pos_item WHERE transaction_id=$1", txn_id
        )
        n_pay = await conn.fetchval(
            "SELECT COUNT(*) FROM fact_pos_payment WHERE transaction_id=$1", txn_id
        )
        item_count = await conn.fetchval(
            "SELECT item_count FROM fact_pos_transaction WHERE id=$1", txn_id
        )
    assert n_item == 0
    assert n_pay == 0
    assert item_count == 0


# ── Staff resolution ────────────────────────────────────────

@pytest.mark.asyncio
async def test_staff_resolved_when_present(normalizer, clean_rows):
    row = _row(bill="WITH_STAFF", combo="#米饭#_1份*3", staff="小王")
    txn_id = await normalizer.write_row(row)

    async with normalizer.pool.acquire() as conn:
        staff_id = await conn.fetchval(
            "SELECT staff_id FROM fact_pos_transaction WHERE id=$1", txn_id
        )
        staff_name = await conn.fetchval(
            "SELECT name FROM dim_staff WHERE staff_id=$1", staff_id
        )
    assert staff_id is not None
    assert staff_name == "小王"


# ── Discount sub-fact ───────────────────────────────────────

@pytest.mark.asyncio
async def test_discounts_written_per_row(normalizer, clean_rows):
    row = _row(
        bill="WITH_DISC",
        combo="#米饭#_1份*3",
        discounts=[("VIP卡", "1.00", 1), ("满减", "2.00", 1)],
    )
    txn_id = await normalizer.write_row(row)

    async with normalizer.pool.acquire() as conn:
        n_disc = await conn.fetchval(
            "SELECT COUNT(*) FROM fact_pos_discount WHERE transaction_id=$1", txn_id
        )
        has_disc = await conn.fetchval(
            "SELECT has_discount FROM fact_pos_transaction WHERE id=$1", txn_id
        )
    assert n_disc == 2
    assert has_disc is True
