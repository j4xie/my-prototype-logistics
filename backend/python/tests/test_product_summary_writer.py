"""Unit tests for ProductSummaryWriter."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

from smartbi.canonical.silver_writers import (
    ProductSummaryWriter,
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


async def test_writes_records_for_resolved_rows():
    """Each row with resolved store + product → 1 INSERT record."""
    rows = [
        _row({"门店": "A 店", "商品名称": "招牌鱼", "单卖数量": "5", "销售金额": "200"}),
        _row({"门店": "A 店", "商品名称": "招牌鱼", "单卖数量": "3", "销售金额": "150"}),
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.executemany = AsyncMock(return_value=None)

    orchestrator = MagicMock()
    writer = ProductSummaryWriter(pool=_make_mock_pool(conn), orchestrator=orchestrator)
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=20, is_tentative=False, confidence=0.95)
    )

    summary = await writer.write(upload_id=1, factory_id="F001")

    assert isinstance(summary, WriteSummary)
    assert summary.rows_written == 2
    assert summary.admin_queue_count == 0
    assert summary.tentative_count == 0
    conn.executemany.assert_awaited_once()
    sql_arg = conn.executemany.await_args.args[0]
    batch_arg = conn.executemany.await_args.args[1]
    assert "agg_product_period" in sql_arg
    assert "ON CONFLICT" in sql_arg
    assert len(batch_arg) == 2
    assert batch_arg[0][0] == "F001"
    assert batch_arg[0][1] == 1  # upload_id
    assert batch_arg[0][2] == 20  # product_id
    assert batch_arg[0][3] == 10  # store_id


async def test_unresolved_store_increments_admin_queue():
    """Store unresolved → admin_queue_count++ + skip product."""
    rows = [_row({"门店": "未知店", "商品名称": "p", "销售金额": "100"})]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.executemany = AsyncMock(return_value=None)

    writer = ProductSummaryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=None, is_tentative=False, confidence=0.0)
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=99, is_tentative=False, confidence=0.0)
    )

    summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 0
    assert summary.admin_queue_count == 1
    assert summary.rows_skipped == 1
    writer._resolve_product.assert_not_called()


async def test_unresolved_product_increments_admin_queue():
    """Store resolved but product not → admin_queue_count++."""
    rows = [_row({"门店": "A", "商品名称": "X", "销售金额": "50"})]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.executemany = AsyncMock(return_value=None)

    writer = ProductSummaryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=None, is_tentative=False, confidence=0.0)
    )

    summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 0
    assert summary.admin_queue_count == 1


async def test_tentative_resolution_counted():
    """is_tentative on store or product → tentative_count++."""
    rows = [_row({"门店": "A", "商品名称": "B", "销售金额": "100"})]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.executemany = AsyncMock(return_value=None)

    writer = ProductSummaryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=1, is_tentative=True, confidence=0.7)
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=2, is_tentative=False, confidence=0.95)
    )

    summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 1
    assert summary.tentative_count == 1


async def test_batch_size_split():
    """records > BATCH_SIZE → multiple executemany calls."""
    rows = [
        _row({"门店": "A", "商品名称": f"P{i}", "销售金额": "10"})
        for i in range(7)
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.executemany = AsyncMock(return_value=None)

    writer = ProductSummaryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer.BATCH_SIZE = 3
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.9)
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        side_effect=[
            ResolveResult(entity_id=100 + i, is_tentative=False, confidence=0.9)
            for i in range(7)
        ]
    )

    summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 7
    # 7 records / batch_size=3 → 3 calls (3, 3, 1)
    assert conn.executemany.await_count == 3


async def test_avg_unit_price_computed():
    """avg_unit_price = revenue / qty when qty > 0."""
    rows = [_row({"门店": "A", "商品名称": "P", "单卖数量": "4", "销售金额": "100"})]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.executemany = AsyncMock(return_value=None)

    writer = ProductSummaryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=1, is_tentative=False, confidence=0.9)
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=2, is_tentative=False, confidence=0.9)
    )

    await writer.write(upload_id=1, factory_id="F001")

    batch = conn.executemany.await_args.args[1][0]
    qty, revenue, avg = batch[6], batch[7], batch[8]
    assert qty == 4.0
    assert revenue == 100.0
    assert avg == 25.0


async def test_resolve_order_store_before_product():
    """Store must resolve before product (context propagated as store_id)."""
    rows = [_row({"门店": "A", "商品名称": "P", "销售金额": "10"})]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.executemany = AsyncMock(return_value=None)

    writer = ProductSummaryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=42, is_tentative=False, confidence=0.95)
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=7, is_tentative=False, confidence=0.95)
    )

    await writer.write(upload_id=1, factory_id="F001")

    # _resolve_product called with store_id=42 in context
    product_call = writer._resolve_product.await_args
    assert product_call.kwargs["context"]["store_id"] == 42


async def test_no_rows_no_executemany():
    """Empty upload → no executemany call, summary all zeros."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])
    conn.executemany = AsyncMock(return_value=None)

    writer = ProductSummaryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())

    summary = await writer.write(upload_id=99, factory_id="F001")

    assert summary.rows_written == 0
    assert summary.admin_queue_count == 0
    conn.executemany.assert_not_called()


async def test_idempotent_rerun_uses_coalesce_on_conflict():
    """Re-run with NULL period_start must hit ON CONFLICT DO UPDATE, not duplicate.

    Asserts the INSERT SQL contains the COALESCE expression matching the
    `uq_app_natkey` unique index, and that DO UPDATE SET overwrites qty/revenue
    with EXCLUDED values. PG 13 lacks NULLS NOT DISTINCT so the COALESCE
    sentinel pattern is required for upsert correctness.
    """
    rows = [
        _row({"门店": "A", "商品名称": "P", "单卖数量": "5", "销售金额": "100"}),
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.executemany = AsyncMock(return_value=None)

    writer = ProductSummaryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=20, is_tentative=False, confidence=0.95)
    )

    # First run: writes one row with NULL period_start.
    await writer.write(upload_id=1, factory_id="F001")
    sql_first = conn.executemany.await_args.args[0]
    batch_first = conn.executemany.await_args.args[1]
    assert (
        "COALESCE(period_start, DATE '0001-01-01')" in sql_first
    ), "ON CONFLICT must use COALESCE sentinel matching uq_app_natkey index"
    assert "DO UPDATE SET" in sql_first, "must upsert, not DO NOTHING"
    assert "qty_sold = EXCLUDED.qty_sold" in sql_first
    assert "revenue = EXCLUDED.revenue" in sql_first
    assert batch_first[0][4] is None, "period_start should be NULL pre-Sheet-Merger"

    # Second run with updated qty/revenue. ON CONFLICT path must fire
    # (PG 13 NULL=NULL via COALESCE sentinel) and overwrite via EXCLUDED.
    rows_rerun = [
        _row({"门店": "A", "商品名称": "P", "单卖数量": "8", "销售金额": "240"}),
    ]
    conn.fetch = AsyncMock(return_value=rows_rerun)
    conn.executemany = AsyncMock(return_value=None)
    await writer.write(upload_id=1, factory_id="F001")
    sql_second = conn.executemany.await_args.args[0]
    batch_second = conn.executemany.await_args.args[1]
    assert sql_second == sql_first, "SQL must be identical across runs"
    assert len(batch_second) == 1, "still one row — natural key collision upserts"
    assert batch_second[0][6] == 8.0  # qty_sold updated
    assert batch_second[0][7] == 240.0  # revenue updated
    assert batch_second[0][4] is None  # period_start still NULL
