"""Tests for Block 4 SQL — 客单人数分析 (per-store distribution).

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §6.5 + §11.1
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task E5

Block 4 is per-store. Each store fires its own SQL query under an asyncio
semaphore so concurrent fanout doesn't exhaust the pool. Joins
fact_pos_transaction + fact_pos_item to compute diner-count distribution.
"""
import asyncio
from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest

from smartbi.canonical.templates.qhj_revenue_report import (
    RevenueReportParams,
    _compute_block4_diner_dist,
)


def _mk_pool_per_store(store_name_map: dict[int, str],
                       dist_per_store: dict[int, list[dict]]):
    """Pool where each acquire returns a conn that:
      - fetchval('SELECT name FROM dim_store...') returns store_name_map[store_id]
      - fetch(<block4 SQL>) returns dist_per_store[store_id]

    The store_id is captured from the SQL args ($2 position).
    """
    pool = MagicMock()
    call_seq = []

    def acquire_factory():
        # Each acquire returns a fresh conn ctx; tests use different
        # conn instances so we can read which store_id was used.
        conn = AsyncMock()

        async def fake_fetchval(sql, *args):
            # set_config returns None / store_name lookup returns name.
            if sql.strip().startswith("SELECT set_config"):
                return None
            # _Store_name lookup query — 2nd arg is store_id
            if "FROM dim_store" in sql:
                store_id = args[1]
                return store_name_map.get(store_id)
            return None

        async def fake_fetch(sql, *args):
            # Block 4 main SQL uses store_id at $2 position
            store_id = args[1]
            call_seq.append(store_id)
            return dist_per_store.get(store_id, [])

        async def fake_execute(sql, *args):
            return "SET"

        conn.fetchval = AsyncMock(side_effect=fake_fetchval)
        conn.fetch = AsyncMock(side_effect=fake_fetch)
        conn.execute = AsyncMock(side_effect=fake_execute)
        ctx = AsyncMock()
        ctx.__aenter__ = AsyncMock(return_value=conn)
        ctx.__aexit__ = AsyncMock(return_value=None)
        return ctx

    pool.acquire = MagicMock(side_effect=acquire_factory)
    return pool, call_seq


@pytest.mark.asyncio
async def test_block4_returns_one_entry_per_store():
    """Multi-store: result list has one entry per store_id in params."""
    pool, _ = _mk_pool_per_store(
        store_name_map={1: "S1", 2: "S2"},
        dist_per_store={
            1: [{"diner_count": 1, "bill_count": 5, "bill_ratio": 0.1,
                 "total_items": 12, "avg_items_per_bill": 2.4,
                 "revenue": 500, "revenue_per_diner": 100,
                 "revenue_per_item": 42, "revenue_ratio": 0.05}],
            2: [{"diner_count": 2, "bill_count": 30, "bill_ratio": 0.6,
                 "total_items": 90, "avg_items_per_bill": 3.0,
                 "revenue": 4500, "revenue_per_diner": 75,
                 "revenue_per_item": 50, "revenue_ratio": 0.45}],
        },
    )
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL",
        store_ids=[1, 2],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    sem = asyncio.Semaphore(3)
    result = await _compute_block4_diner_dist(pool, params, sem)

    assert len(result) == 2
    store_names = {b["store_name"] for b in result}
    assert store_names == {"S1", "S2"}


@pytest.mark.asyncio
async def test_block4_carries_distribution_rows_per_store():
    """Each result entry has 'distribution' = list of diner-count rows."""
    pool, _ = _mk_pool_per_store(
        store_name_map={1: "S1"},
        dist_per_store={
            1: [
                {"diner_count": 1, "bill_count": 5, "bill_ratio": 0.1,
                 "total_items": 12, "avg_items_per_bill": 2.4,
                 "revenue": 500, "revenue_per_diner": 100,
                 "revenue_per_item": 42, "revenue_ratio": 0.05},
                {"diner_count": 2, "bill_count": 30, "bill_ratio": 0.6,
                 "total_items": 90, "avg_items_per_bill": 3.0,
                 "revenue": 4500, "revenue_per_diner": 75,
                 "revenue_per_item": 50, "revenue_ratio": 0.45},
            ],
        },
    )
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL",
        store_ids=[1],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    sem = asyncio.Semaphore(3)
    result = await _compute_block4_diner_dist(pool, params, sem)

    assert len(result) == 1
    block = result[0]
    assert block["store_id"] == 1
    assert block["store_name"] == "S1"
    assert "date_range" in block
    dist = block["distribution"]
    assert len(dist) == 2
    diner_counts = [d["diner_count"] for d in dist]
    assert diner_counts == [1, 2]


@pytest.mark.asyncio
async def test_block4_dual_per_diner_and_per_item_metrics_present():
    """Spec §11.1 / §6.5 — both revenue_per_diner AND revenue_per_item emitted."""
    pool, _ = _mk_pool_per_store(
        store_name_map={1: "S1"},
        dist_per_store={
            1: [{"diner_count": 1, "bill_count": 5, "bill_ratio": 0.1,
                 "total_items": 12, "avg_items_per_bill": 2.4,
                 "revenue": 500, "revenue_per_diner": 100,
                 "revenue_per_item": 42, "revenue_ratio": 0.05}],
        },
    )
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL",
        store_ids=[1],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    sem = asyncio.Semaphore(3)
    result = await _compute_block4_diner_dist(pool, params, sem)
    d = result[0]["distribution"][0]
    assert "revenue_per_diner" in d
    assert "revenue_per_item" in d
    assert d["revenue_per_diner"] == 100
    assert d["revenue_per_item"] == 42


@pytest.mark.asyncio
async def test_block4_concurrent_fanout_uses_semaphore():
    """All N stores must be queried; semaphore caps concurrency but doesn't drop work."""
    pool, call_seq = _mk_pool_per_store(
        store_name_map={i: f"S{i}" for i in range(1, 6)},
        dist_per_store={i: [] for i in range(1, 6)},
    )
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL",
        store_ids=[1, 2, 3, 4, 5],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    sem = asyncio.Semaphore(3)
    result = await _compute_block4_diner_dist(pool, params, sem)

    assert len(result) == 5
    assert sorted(call_seq) == [1, 2, 3, 4, 5]


@pytest.mark.asyncio
async def test_block4_unknown_store_falls_back_to_synthetic_name():
    """Missing dim_store name shouldn't crash; synthetic 'store_{id}' used."""
    pool, _ = _mk_pool_per_store(
        store_name_map={},  # no name lookups
        dist_per_store={42: []},
    )
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL",
        store_ids=[42],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    sem = asyncio.Semaphore(3)
    result = await _compute_block4_diner_dist(pool, params, sem)
    assert result[0]["store_id"] == 42
    assert result[0]["store_name"] == "store_42"
    assert result[0]["distribution"] == []
