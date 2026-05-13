"""Tests for Blocks 1/2/3 SQL (yoy/mom/meal_split).

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §6.3 + §6.4
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task E2-E4

Mocks asyncpg pool/conn returning canned rows; verifies block dispatch +
result shape + business logic (LEFT JOIN dim_store includes zero-revenue
stores; period diff; ratio NULL-safe; yoy disabled → prev cols NULL).
"""
from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest

from smartbi.canonical.templates.qhj_revenue_report import (
    RevenueReportParams,
    _compute_block1_yoy,
    _compute_block2_mom,
    _compute_block3_meal_split,
)


def _mk_pool(*fetch_returns):
    """Build a pool whose conn.fetch returns each entry of fetch_returns sequentially."""
    conn = AsyncMock()
    conn.execute = AsyncMock(return_value="SET")
    conn.fetch = AsyncMock(side_effect=list(fetch_returns))
    ctx = AsyncMock()
    ctx.__aenter__ = AsyncMock(return_value=conn)
    ctx.__aexit__ = AsyncMock(return_value=None)
    pool = MagicMock()
    pool.acquire = MagicMock(return_value=ctx)
    return pool, conn


# ─── Block 1: 可比同比 (YoY) ────────────────────────────────────────

@pytest.mark.asyncio
async def test_block1_yoy_disabled_returns_null_prev_columns():
    """include_yoy=False → prev_*/ratio_* columns are None (UI renders '—')."""
    current_rows = [
        {"store_id": 1, "store_name": "青花椒南方百联店",
         "total": 10000, "dine_in": 7000, "takeout": 3000},
        {"store_id": 2, "store_name": "青花椒徐汇店",
         "total": 5000, "dine_in": 4000, "takeout": 1000},
    ]
    pool, _ = _mk_pool(current_rows)
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL",
        store_ids=[1, 2],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
        include_yoy=False,
    )
    rows = await _compute_block1_yoy(pool, params)
    assert len(rows) == 2
    for r in rows:
        assert r["total"] is not None
        assert r["prev_total"] is None
        assert r["total_ratio"] is None
        assert r["dine_in_ratio"] is None
        assert r["takeout_ratio"] is None


@pytest.mark.asyncio
async def test_block1_yoy_enabled_computes_ratios():
    """include_yoy=True → second SQL query for prev period; ratios computed."""
    current_rows = [
        {"store_id": 1, "store_name": "S1", "total": 100, "dine_in": 70, "takeout": 30},
    ]
    prev_rows = [
        {"store_id": 1, "store_name": "S1", "total": 80, "dine_in": 50, "takeout": 30},
    ]
    pool, _ = _mk_pool(current_rows, prev_rows)
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL",
        store_ids=[1],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
        include_yoy=True,
    )
    rows = await _compute_block1_yoy(pool, params)
    assert len(rows) == 1
    r = rows[0]
    assert r["prev_total"] == 80
    # (100 - 80) / 80 * 100 = 25.0
    assert r["total_ratio"] == 25.0
    # (70 - 50) / 50 * 100 = 40.0
    assert r["dine_in_ratio"] == 40.0
    # (30 - 30) / 30 * 100 = 0.0
    assert r["takeout_ratio"] == 0.0


# ─── Block 2: 环比 (MoM = period over previous same-length) ─────────

@pytest.mark.asyncio
async def test_block2_mom_computes_previous_period():
    current_rows = [
        {"store_id": 1, "store_name": "S1", "total": 100, "dine_in": 60, "takeout": 40},
    ]
    prev_rows = [
        {"store_id": 1, "store_name": "S1", "total": 80, "dine_in": 50, "takeout": 30},
    ]
    pool, _ = _mk_pool(current_rows, prev_rows)
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL",
        store_ids=[1],
        date_from=date(2025, 10, 8), date_to=date(2025, 10, 14),
    )
    rows = await _compute_block2_mom(pool, params)
    assert len(rows) == 1
    r = rows[0]
    assert r["prev_total"] == 80
    assert r["total_ratio"] == 25.0


@pytest.mark.asyncio
async def test_block2_mom_zero_prev_returns_none_ratio():
    """Division by zero: prev=0 → ratio NULL (UI '—'), not crash."""
    current_rows = [
        {"store_id": 1, "store_name": "S1", "total": 100, "dine_in": 60, "takeout": 40},
    ]
    prev_rows = [
        {"store_id": 1, "store_name": "S1", "total": 0, "dine_in": 0, "takeout": 0},
    ]
    pool, _ = _mk_pool(current_rows, prev_rows)
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL",
        store_ids=[1],
        date_from=date(2025, 10, 8), date_to=date(2025, 10, 14),
    )
    rows = await _compute_block2_mom(pool, params)
    r = rows[0]
    assert r["prev_total"] == 0
    assert r["total_ratio"] is None
    assert r["dine_in_ratio"] is None
    assert r["takeout_ratio"] is None


@pytest.mark.asyncio
async def test_block2_mom_no_prev_match_returns_none_prev():
    """LEFT JOIN on store_id; prev had 0 rows → prev cols None."""
    current_rows = [
        {"store_id": 1, "store_name": "S1", "total": 100, "dine_in": 60, "takeout": 40},
    ]
    prev_rows = []  # no prev data for this store
    pool, _ = _mk_pool(current_rows, prev_rows)
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL",
        store_ids=[1],
        date_from=date(2025, 10, 8), date_to=date(2025, 10, 14),
    )
    rows = await _compute_block2_mom(pool, params)
    r = rows[0]
    assert r["total"] == 100
    assert r["prev_total"] is None
    assert r["total_ratio"] is None


# ─── Block 3: 堂食外卖占比 (current-period snapshot) ────────────────

@pytest.mark.asyncio
async def test_block3_meal_split_returns_revenue_and_bill_ratios():
    pool_rows = [
        {"store_id": 1, "store_name": "S1",
         "dine_in_revenue": 7000, "takeout_revenue": 3000,
         "dine_in_bills": 70, "takeout_bills": 30},
    ]
    pool, _ = _mk_pool(pool_rows)
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL",
        store_ids=[1],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    rows = await _compute_block3_meal_split(pool, params)
    assert len(rows) == 1
    r = rows[0]
    # revenue_ratio = dine_in / (dine_in + takeout) = 7000 / 10000 = 0.7
    assert r["revenue_ratio"] == 0.7
    # bill_ratio = 70 / 100 = 0.7
    assert r["bill_ratio"] == 0.7


@pytest.mark.asyncio
async def test_block3_zero_revenue_returns_none_ratio():
    """Zero-revenue store still appears (LEFT JOIN); ratios are None not /0."""
    pool_rows = [
        {"store_id": 1, "store_name": "ZeroRevStore",
         "dine_in_revenue": 0, "takeout_revenue": 0,
         "dine_in_bills": 0, "takeout_bills": 0},
    ]
    pool, _ = _mk_pool(pool_rows)
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL",
        store_ids=[1],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    rows = await _compute_block3_meal_split(pool, params)
    r = rows[0]
    assert r["dine_in_revenue"] == 0
    assert r["revenue_ratio"] is None
    assert r["bill_ratio"] is None
