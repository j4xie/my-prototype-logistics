"""Unit tests for InventoryWriter."""
from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock

from smartbi.canonical.silver_writers import (
    InventoryWriter,
    ResolveResult,
    WriteSummary,
)


def _make_mock_pool(conn):
    pool = MagicMock()
    acquire_ctx = MagicMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=acquire_ctx)
    return pool


def _row(d):
    return {"row_data": d}


async def test_resolves_ingredient_by_name():
    """SELECT dim_ingredient WHERE name → ingredient_id used in INSERT."""
    rows = [
        _row(
            {
                "门店": "A",
                "物料": "猪肉",
                "库存数量": "12.5",
                "单位": "kg",
                "盘点日期": "2026-04-22",
            }
        ),
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    # Phase 3: _fetch_period is the first fetchrow call → return None (no period inferred yet).
    # ingredient SELECT returns id=88; threshold returns None
    conn.fetchrow = AsyncMock(side_effect=[None, {"ingredient_id": 88}, None, None])
    conn.executemany = AsyncMock(return_value=None)

    writer = InventoryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )

    summary = await writer.write(upload_id=1, factory_id="F001")

    assert isinstance(summary, WriteSummary)
    assert summary.rows_written == 1
    assert summary.admin_queue_count == 0
    batch = conn.executemany.await_args.args[1]
    assert batch[0][2] == 88  # ingredient_id
    assert batch[0][3] == 10  # store_id
    assert batch[0][4] == date(2026, 4, 22)
    assert batch[0][5] == 12.5  # stock_qty
    assert batch[0][6] == "kg"


async def test_unmatched_ingredient_skipped():
    """No dim_ingredient match → row skipped, admin_queue_count++."""
    rows = [_row({"门店": "A", "物料": "未知食材", "库存数量": "10"})]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    # Phase 3: _fetch_period gets None first; ingredient lookup also returns None.
    conn.fetchrow = AsyncMock(return_value=None)
    conn.executemany = AsyncMock(return_value=None)

    writer = InventoryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )

    summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 0
    assert summary.admin_queue_count == 1
    conn.executemany.assert_not_called()


async def test_threshold_store_specific_preferred():
    """LEFT JOIN dim_ingredient_threshold prefers store-specific row over global NULL."""
    rows = [_row({"门店": "A", "物料": "番茄", "库存数量": "5"})]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    # Phase 3: _fetch_period None first.
    # ingredient lookup → id=42; store-specific threshold returns row
    conn.fetchrow = AsyncMock(
        side_effect=[
            None,
            {"ingredient_id": 42},
            {"safe_stock_qty": 10, "reorder_point": 8},
        ]
    )
    conn.executemany = AsyncMock(return_value=None)

    writer = InventoryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )

    await writer.write(upload_id=1, factory_id="F001")

    batch = conn.executemany.await_args.args[1]
    assert batch[0][7] == 10  # safe_stock_qty
    assert batch[0][8] == 8  # reorder_point


async def test_threshold_falls_back_to_global_null_store():
    """Store-specific threshold missing → fall back to NULL-store global row."""
    rows = [_row({"门店": "A", "物料": "盐", "库存数量": "100"})]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(
        side_effect=[
            None,  # Phase 3: _fetch_period
            {"ingredient_id": 1},
            None,  # store-specific threshold missing
            {"safe_stock_qty": 50, "reorder_point": 30},  # global NULL store
        ]
    )
    conn.executemany = AsyncMock(return_value=None)

    writer = InventoryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )

    await writer.write(upload_id=1, factory_id="F001")

    batch = conn.executemany.await_args.args[1]
    assert batch[0][7] == 50
    assert batch[0][8] == 30


async def test_no_threshold_writes_null():
    """No threshold row at all → safe_stock_qty + reorder_point both NULL."""
    rows = [_row({"门店": "A", "物料": "胡椒", "库存数量": "0.5"})]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(
        side_effect=[None, {"ingredient_id": 7}, None, None]  # Phase 3 leading None
    )
    conn.executemany = AsyncMock(return_value=None)

    writer = InventoryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )

    await writer.write(upload_id=1, factory_id="F001")

    batch = conn.executemany.await_args.args[1]
    assert batch[0][7] is None
    assert batch[0][8] is None


async def test_ingredient_cache_dedups_lookup():
    """Same ingredient name 2 rows → only 1 SELECT."""
    rows = [
        _row({"门店": "A", "物料": "盐", "库存数量": "1"}),
        _row({"门店": "B", "物料": "盐", "库存数量": "2"}),
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    # Phase 3: leading None for _fetch_period.
    # 1 ingredient SELECT (cached), then for each of 2 rows do 2 threshold lookups (each not found = 4)
    conn.fetchrow = AsyncMock(
        side_effect=[
            None,  # Phase 3: _fetch_period
            {"ingredient_id": 99},
            None, None,  # row1 thresholds (store-specific + global)
            None, None,  # row2 thresholds
        ]
    )
    conn.executemany = AsyncMock(return_value=None)

    writer = InventoryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        side_effect=[
            ResolveResult(entity_id=1, is_tentative=False, confidence=0.95),
            ResolveResult(entity_id=2, is_tentative=False, confidence=0.95),
        ]
    )

    summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 2
    # Phase 3: 1 period + 1 ingredient + 4 threshold = 6 fetchrow calls (NOT 7, ingredient cached)
    assert conn.fetchrow.await_count == 6


async def test_no_ingredient_column_skipped():
    """Row without ingredient name → skipped + admin_queue_count++."""
    rows = [_row({"门店": "A", "库存数量": "50"})]  # no 物料
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value=None)
    conn.executemany = AsyncMock(return_value=None)

    writer = InventoryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )

    summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 0
    assert summary.admin_queue_count == 1
    # Phase 3: _fetch_period is now called once before the row loop (which short-circuits).
    assert conn.fetchrow.await_count == 1


async def test_executemany_includes_on_conflict_unique_dedup():
    """SQL must include ON CONFLICT (factory, ingredient, store, date) DO UPDATE."""
    rows = [_row({"物料": "X", "库存数量": "1"})]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(
        side_effect=[None, {"ingredient_id": 1}, None, None]  # Phase 3 leading None
    )
    conn.executemany = AsyncMock(return_value=None)

    writer = InventoryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=None, is_tentative=False, confidence=0.0)
    )

    await writer.write(upload_id=1, factory_id="F001")

    sql = conn.executemany.await_args.args[0]
    assert "fact_inventory_snapshot" in sql
    assert "ON CONFLICT" in sql
    assert "factory_id, ingredient_id, store_id, snapshot_date" in sql
