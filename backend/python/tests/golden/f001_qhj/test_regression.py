"""Golden regression suite — qhj F001 real data (upload 3970).

Week 4 Phase A.5 of Unified Data Layer v1 spec (§2.4):
    "每次 flip 前 check: pytest tests/golden/4169/test_regression.py -v
     必须所有 30+ 断言数字差 <0.1% 才能 merge"

Scope
-----
Asserts known totals / rankings produced by running backfill_silver on
upload 3970 (qhj 2025 full-year POS data, 200K rows raw → 140K
transactions in Silver). These values were captured once (2026-04-21)
after a clean backfill and serve as the regression baseline for any
future Silver/Gold/normalizer change.

If the backfill logic changes (e.g. new parser heuristic, alias table
expansion), these numbers are expected to shift — update the golden
values in this file as part of the change commit. That's the contract:
any movement in these numbers must be explained + accepted.

Skip behavior
-------------
These tests require the upload to be backfilled into the target DB.
Each test checks for the presence of F001 agg rows and pytest.skip()s
cleanly if the data isn't there. So:
- Dev laptops without backfilled data → all skip (no false negatives)
- Server test DB (backfilled 2026-04-21) → all run
- CI (no DB) → fixture detects no postgres_url → skip

To enable locally, run backfill_silver against upload 3970.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio


_TENANT = "F001"
_EPSILON_AMOUNT = Decimal("0.01")  # tolerate 1 cent FP rounding


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
        min_size=1, max_size=2,
        setup=set_pg_connection_tenant,
    )
    try:
        yield p
    finally:
        await p.close()


@pytest_asyncio.fixture
async def has_data(pool):
    """Skip whole module if F001 backfill hasn't run against this DB."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            n = await conn.fetchval(
                "SELECT COUNT(*) FROM fact_pos_transaction WHERE factory_id=$1",
                _TENANT,
            )
    finally:
        reset_factory_id(token)
    if n == 0:
        pytest.skip(
            f"No backfilled data for factory={_TENANT}. "
            f"Run: python -m scripts.backfill_silver --upload-id 3970 --factory F001"
        )
    return n


# ── Grand totals ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_total_bill_count(pool, has_data):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            n = await conn.fetchval(
                "SELECT COUNT(*) FROM fact_pos_transaction WHERE factory_id=$1", _TENANT
            )
    finally:
        reset_factory_id(token)
    assert n == 140541


@pytest.mark.asyncio
async def test_total_revenue(pool, has_data):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            rev = await conn.fetchval(
                "SELECT SUM(net_amount) FROM fact_pos_transaction WHERE factory_id=$1",
                _TENANT,
            )
    finally:
        reset_factory_id(token)
    assert abs(rev - Decimal("20639884.52")) < _EPSILON_AMOUNT


@pytest.mark.asyncio
async def test_date_range_is_full_2025(pool, has_data):
    """qhj uploaded their full 2025 POS export."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT MIN(date) AS min_d, MAX(date) AS max_d, "
                "COUNT(DISTINCT date) AS days FROM fact_pos_transaction "
                "WHERE factory_id=$1",
                _TENANT,
            )
    finally:
        reset_factory_id(token)
    assert row["min_d"] == date(2025, 1, 1)
    assert row["max_d"] == date(2025, 12, 31)
    assert row["days"] == 365


@pytest.mark.asyncio
async def test_store_count_is_8(pool, has_data):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            n = await conn.fetchval(
                "SELECT COUNT(*) FROM dim_store WHERE factory_id=$1", _TENANT
            )
    finally:
        reset_factory_id(token)
    assert n == 8


@pytest.mark.asyncio
async def test_product_count_is_502(pool, has_data):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            n = await conn.fetchval(
                "SELECT COUNT(*) FROM dim_product WHERE factory_id=$1", _TENANT
            )
    finally:
        reset_factory_id(token)
    assert n == 502


@pytest.mark.asyncio
async def test_total_item_count(pool, has_data):
    """Each bill has multiple items; total item rows across all bills."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            n = await conn.fetchval(
                "SELECT COUNT(*) FROM fact_pos_item WHERE factory_id=$1", _TENANT
            )
    finally:
        reset_factory_id(token)
    assert n == 646946


# ── Top N rankings ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_top_5_products_by_annual_revenue(pool, has_data):
    """Known ranking as of 2026-04-21 backfill. Sorted by revenue desc
    across all months."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT p.name, SUM(a.qty_sold) AS qty, SUM(a.revenue) AS revenue
                  FROM agg_product a
                  JOIN dim_product p ON p.product_id = a.product_id
                 WHERE a.factory_id=$1
                 GROUP BY p.name
                 ORDER BY SUM(a.revenue) DESC
                 LIMIT 5
                """,
                _TENANT,
            )
    finally:
        reset_factory_id(token)
    expected = [
        ("招牌青花椒味(单人份)",       Decimal("23521"),  Decimal("1354832.60")),
        ("招牌青花椒鱼可乐单人套餐",   Decimal("15733"),  Decimal("989416.80")),
        ("米饭",                        Decimal("94538"),  Decimal("937138.00")),
        ("招牌青花椒味(2-3人份)",      Decimal("3392"),   Decimal("669905.60")),
        ("招牌青花椒味(小份)",          Decimal("2847"),   Decimal("449063.60")),
    ]
    assert len(rows) == 5
    for i, (name, qty, rev) in enumerate(expected):
        assert rows[i]["name"] == name, f"rank {i+1}: expected {name}, got {rows[i]['name']}"
        assert abs(rows[i]["qty"] - qty) < _EPSILON_AMOUNT
        assert abs(rows[i]["revenue"] - rev) < _EPSILON_AMOUNT


@pytest.mark.asyncio
async def test_top_3_stores_by_revenue(pool, has_data):
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT s.name, SUM(a.net_amount) AS revenue, SUM(a.bill_count) AS bills
                  FROM agg_daily a
                  JOIN dim_store s ON s.store_id = a.store_id
                 WHERE a.factory_id=$1
                 GROUP BY s.name
                 ORDER BY SUM(a.net_amount) DESC
                 LIMIT 3
                """,
                _TENANT,
            )
    finally:
        reset_factory_id(token)
    expected = [
        ("青花椒大丸百货店",   Decimal("7431228.74"), 41131),
        ("青花椒徐汇日月光店", Decimal("5132845.53"), 42645),
        ("青花椒徐汇光启城店", Decimal("2720994.05"), 15081),
    ]
    assert len(rows) == 3
    for i, (name, rev, bills) in enumerate(expected):
        assert rows[i]["name"] == name, f"rank {i+1}: {rows[i]['name']}"
        assert abs(rows[i]["revenue"] - rev) < _EPSILON_AMOUNT
        assert rows[i]["bills"] == bills


# ── Consistency between fact/agg layers ──────────────────────

@pytest.mark.asyncio
async def test_agg_daily_total_matches_fact_total(pool, has_data):
    """Gold layer must exactly reflect Silver — any drift would indicate
    a materialization bug or a partial refresh."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            fact_total = await conn.fetchval(
                "SELECT SUM(net_amount) FROM fact_pos_transaction WHERE factory_id=$1",
                _TENANT,
            )
            agg_total = await conn.fetchval(
                "SELECT SUM(net_amount) FROM agg_daily WHERE factory_id=$1",
                _TENANT,
            )
            fact_bills = await conn.fetchval(
                "SELECT COUNT(*) FROM fact_pos_transaction WHERE factory_id=$1",
                _TENANT,
            )
            agg_bills = await conn.fetchval(
                "SELECT SUM(bill_count) FROM agg_daily WHERE factory_id=$1",
                _TENANT,
            )
    finally:
        reset_factory_id(token)
    assert abs(fact_total - agg_total) < _EPSILON_AMOUNT
    assert fact_bills == agg_bills


@pytest.mark.asyncio
async def test_item_revenue_sum_matches_agg_product(pool, has_data):
    """Item-level revenue (sum of fact_pos_item.amount) must match
    agg_product.revenue total when product_id IS NOT NULL. Any drift
    means the materializer's SUM aggregation is wrong OR the parser-
    miss filter is broken."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            items_total = await conn.fetchval(
                "SELECT SUM(amount) FROM fact_pos_item "
                "WHERE factory_id=$1 AND product_id IS NOT NULL",
                _TENANT,
            )
            agg_total = await conn.fetchval(
                "SELECT SUM(revenue) FROM agg_product WHERE factory_id=$1", _TENANT,
            )
    finally:
        reset_factory_id(token)
    assert abs(items_total - agg_total) < _EPSILON_AMOUNT


# ── Row-count sanity for Silver↔Gold ratios ─────────────────

@pytest.mark.asyncio
async def test_agg_daily_rows_reasonable(pool, has_data):
    """agg_daily should have about 8 stores × 365 days - some empty days.
    Verified count 2026-04-21: 1730."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            n = await conn.fetchval(
                "SELECT COUNT(*) FROM agg_daily WHERE factory_id=$1", _TENANT
            )
    finally:
        reset_factory_id(token)
    assert n == 1730


@pytest.mark.asyncio
async def test_agg_product_rows_reasonable(pool, has_data):
    """agg_product is keyed (factory, product, month). 502 products × 12
    months is upper bound; actual is 2998 (products weren't all sold every
    month)."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            n = await conn.fetchval(
                "SELECT COUNT(*) FROM agg_product WHERE factory_id=$1", _TENANT
            )
    finally:
        reset_factory_id(token)
    assert n == 2998


# ── Channel payments (added after EAV extraction, v2 backfill) ──

@pytest.mark.asyncio
async def test_payment_channels_seeded(pool, has_data):
    """After v2 backfill with EAV, 23 distinct payment channels were
    extracted from qhj's wide-format columns."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            n = await conn.fetchval(
                "SELECT COUNT(*) FROM dim_payment_channel WHERE factory_id=$1", _TENANT
            )
    finally:
        reset_factory_id(token)
    assert n == 23


@pytest.mark.asyncio
async def test_fact_payment_total(pool, has_data):
    """Total attributable to known payment methods.
    ~¥13.1M out of ¥20.6M total revenue — remainder is unmapped payment
    methods (vouchers, stored-value balances) not yet in _PAYMENT_COLUMNS."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            total = await conn.fetchval(
                "SELECT SUM(amount) FROM fact_pos_payment WHERE factory_id=$1", _TENANT
            )
            n = await conn.fetchval(
                "SELECT COUNT(*) FROM fact_pos_payment WHERE factory_id=$1", _TENANT
            )
    finally:
        reset_factory_id(token)
    assert abs(total - Decimal("13116990.78")) < _EPSILON_AMOUNT
    assert n == 139906


@pytest.mark.asyncio
async def test_top_5_channels_by_total_amount(pool, has_data):
    """Known ranking captured 2026-04-21 (v2 backfill with EAV).
    Dominated by [微信] ¥6.2M; 饿了么/美团/支付宝follow."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT ch.name, SUM(a.amount) AS total
                  FROM agg_channel a
                  JOIN dim_payment_channel ch ON ch.channel_id = a.channel_id
                 WHERE a.factory_id=$1
                 GROUP BY ch.name
                 ORDER BY SUM(a.amount) DESC
                 LIMIT 5
                """,
                _TENANT,
            )
    finally:
        reset_factory_id(token)
    expected = [
        ("[微信]",   Decimal("6226665.69")),
        ("[饿了么]", Decimal("2856172.09")),
        ("[美团]",   Decimal("1598630.66")),
        ("[支付宝]", Decimal("1396864.88")),
        ("招行买单", Decimal("259647.78")),
    ]
    assert len(rows) == 5
    for i, (name, total) in enumerate(expected):
        assert rows[i]["name"] == name, f"rank {i+1}: {rows[i]['name']}"
        assert abs(rows[i]["total"] - total) < _EPSILON_AMOUNT


@pytest.mark.asyncio
async def test_agg_channel_rows_reasonable(pool, has_data):
    """agg_channel (factory, channel, date) — 3404 rows post v2 backfill."""
    from smartbi.tenant_ctx import set_factory_id, reset_factory_id
    token = set_factory_id(_TENANT)
    try:
        async with pool.acquire() as conn:
            n = await conn.fetchval(
                "SELECT COUNT(*) FROM agg_channel WHERE factory_id=$1", _TENANT
            )
    finally:
        reset_factory_id(token)
    assert n == 3404
