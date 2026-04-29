"""Unit tests for InventoryWriter dual-write provenance hook (Day 10-12).

Verifies:
- ENV=1 → 1 hook call per inserted snapshot row
- ENV unset → hook NEVER called
- Anchor: entity_type='ingredient', entity_id=ingredient_id
- valid_from = snapshot_date for the row
- Fields: stock_qty, unit (NOT safe_stock_qty/reorder_point — those come from
  dim_ingredient_threshold, not the upload)
"""
from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from smartbi.canonical.silver_writers import InventoryWriter, ResolveResult


_HOOK_PATH = (
    "smartbi.canonical.silver_writers.inventory_writer.write_provenance_for_fields"
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


def _make_conn_with_transaction():
    conn = AsyncMock()
    tx_ctx = MagicMock()
    tx_ctx.__aenter__ = AsyncMock(return_value=None)
    tx_ctx.__aexit__ = AsyncMock(return_value=None)
    conn.transaction = MagicMock(return_value=tx_ctx)
    return conn


@pytest.mark.asyncio
async def test_provenance_hook_called_per_record_when_enabled(monkeypatch):
    """ENV=1 → 1 hook call per inserted snapshot record."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

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
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    # _fetch_period=None, ingredient lookup → id=88, threshold lookup → None
    conn.fetchrow = AsyncMock(
        side_effect=[None, {"ingredient_id": 88}, None, None]
    )
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)

    writer = InventoryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        mock_hook.return_value = {
            "written": 2,
            "queued": 0,
            "no_change": 0,
            "skipped_null": 0,
        }
        summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 1
    assert mock_hook.await_count == 1
    kw = mock_hook.await_args.kwargs
    assert kw["factory_id"] == "F001"
    assert kw["entity_type"] == "ingredient"
    assert kw["entity_id"] == 88
    assert kw["source_type"] == "inventory"
    assert kw["mapper_method"] == "rule"
    assert kw["confidence"] == 0.80
    assert kw["source_upload_id"] == 1
    assert kw["valid_from"] == date(2026, 4, 22)
    # NOTE: safe_stock_qty / reorder_point NOT in fields — those come from
    # dim_ingredient_threshold, not from the upload.
    # Phase B C1 fix: field_name encodes store dimension. _resolve_store mock
    # returns entity_id=10, so stock_qty → ``stock_qty@store_10``.
    assert set(kw["fields"].keys()) == {"stock_qty@store_10", "unit@store_10"}
    assert kw["fields"]["stock_qty@store_10"] == 12.5
    assert kw["fields"]["unit@store_10"] == "kg"


@pytest.mark.asyncio
async def test_provenance_hook_skipped_when_disabled(monkeypatch):
    """ENV unset → hook never called."""
    monkeypatch.delenv("SMARTBI_ENABLE_PROVENANCE", raising=False)

    rows = [_row({"门店": "A", "物料": "番茄", "库存数量": "5"})]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(
        side_effect=[None, {"ingredient_id": 42}, None, None]
    )
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)

    writer = InventoryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        await writer.write(upload_id=1, factory_id="F001")

    assert mock_hook.await_count == 0
    conn.transaction.assert_not_called()


@pytest.mark.asyncio
async def test_provenance_hook_skipped_for_unmatched_ingredient(monkeypatch):
    """Unmatched ingredient → row skipped, no provenance recorded."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    rows = [_row({"门店": "A", "物料": "未知食材", "库存数量": "10"})]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value=None)  # _fetch_period + ingredient lookup
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)

    writer = InventoryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 0
    assert summary.admin_queue_count == 1
    assert mock_hook.await_count == 0
    # Transaction never opened — records list is empty
    conn.transaction.assert_not_called()


@pytest.mark.asyncio
async def test_provenance_hook_uses_period_end_when_no_row_date(monkeypatch):
    """No row-level date column → fall back to merge_inferred_period_end as
    snapshot_date, plumbed through to provenance valid_from."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    rows = [_row({"门店": "A", "物料": "猪肉", "库存数量": "20"})]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    # _fetch_period returns period_end=2026-04-30, then ingredient + threshold
    conn.fetchrow = AsyncMock(
        side_effect=[
            {"p_start": date(2026, 4, 1), "p_end": date(2026, 4, 30)},
            {"ingredient_id": 99},
            None,
            None,
        ]
    )
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)

    writer = InventoryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        mock_hook.return_value = {
            "written": 2,
            "queued": 0,
            "no_change": 0,
            "skipped_null": 0,
        }
        await writer.write(upload_id=1, factory_id="F001")

    kw = mock_hook.await_args.kwargs
    assert kw["valid_from"] == date(2026, 4, 30)


@pytest.mark.asyncio
async def test_provenance_hook_compound_field_name_per_store(monkeypatch):
    """Phase B C1 fix: same ingredient across 2 stores → distinct field_names.

    Multi-store inventory must write distinct field_provenance dedup keys
    per (ingredient, store). Without the suffix, store 1's stock_qty would
    silently displace store 2's, with the latter ending up as
    'field_conflict' in admin_queue.
    """
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    rows = [
        _row(
            {
                "门店": "A 店",
                "物料": "猪肉",
                "库存数量": "12.5",
                "单位": "kg",
                "盘点日期": "2026-04-22",
            }
        ),
        _row(
            {
                "门店": "B 店",
                "物料": "猪肉",
                "库存数量": "8.0",
                "单位": "kg",
                "盘点日期": "2026-04-22",
            }
        ),
    ]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    # _fetch_period None, then ingredient lookup id=88 (cached after 1st),
    # then thresholds None for each row's store-specific + global lookup.
    conn.fetchrow = AsyncMock(
        side_effect=[None, {"ingredient_id": 88}, None, None, None, None]
    )
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)

    writer = InventoryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        side_effect=[
            ResolveResult(entity_id=11, is_tentative=False, confidence=0.95),
            ResolveResult(entity_id=22, is_tentative=False, confidence=0.95),
        ]
    )

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        mock_hook.return_value = {"written": 2, "queued": 0, "no_change": 0, "skipped_null": 0}
        await writer.write(upload_id=1, factory_id="F001")

    assert mock_hook.await_count == 2
    # Both anchor to ingredient_id=88 ...
    assert mock_hook.await_args_list[0].kwargs["entity_id"] == 88
    assert mock_hook.await_args_list[1].kwargs["entity_id"] == 88
    # ...but distinct field_name suffixes per store.
    fields_0 = set(mock_hook.await_args_list[0].kwargs["fields"].keys())
    fields_1 = set(mock_hook.await_args_list[1].kwargs["fields"].keys())
    assert fields_0 == {"stock_qty@store_11", "unit@store_11"}
    assert fields_1 == {"stock_qty@store_22", "unit@store_22"}
    assert fields_0.isdisjoint(fields_1)


@pytest.mark.asyncio
async def test_provenance_hook_bare_field_name_when_store_null(monkeypatch):
    """Phase B C1 fix: store-less inventory (store_id=None) keeps bare names.

    Some factories track inventory globally (no per-store snapshot). The
    InventoryWriter doesn't skip these — it inserts with store_id=None.
    The provenance hook must use ``stock_qty`` (no suffix) so global lineage
    isn't synthetically partitioned.
    """
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    rows = [
        _row(
            {
                "物料": "猪肉",  # no store column
                "库存数量": "100",
                "单位": "kg",
                "盘点日期": "2026-04-22",
            }
        ),
    ]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    # _fetch_period None, then ingredient lookup id=88, then threshold lookup
    # (store_id is None so only global threshold path queried) → None.
    conn.fetchrow = AsyncMock(
        side_effect=[None, {"ingredient_id": 88}, None]
    )
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)

    writer = InventoryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    # Store resolution falls through to None entity_id (no store name in row).
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=None, is_tentative=False, confidence=0.0)
    )

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        mock_hook.return_value = {"written": 2, "queued": 0, "no_change": 0, "skipped_null": 0}
        await writer.write(upload_id=1, factory_id="F001")

    assert mock_hook.await_count == 1
    fields = set(mock_hook.await_args.kwargs["fields"].keys())
    # No store suffix → bare canonical names preserve global lineage.
    assert fields == {"stock_qty", "unit"}


@pytest.mark.asyncio
async def test_provenance_hook_skipped_when_no_records(monkeypatch):
    """ENV=1 but 0 rows resolved → no hook + no transaction."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=[])
    conn.fetchrow = AsyncMock(return_value=None)
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)

    writer = InventoryWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 0
    assert mock_hook.await_count == 0
    conn.transaction.assert_not_called()
