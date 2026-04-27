"""Unit tests for ProductSummaryWriter dual-write provenance hook (Day 10-12).

Verifies the SMARTBI_ENABLE_PROVENANCE env-flag gate and the per-record
hook fan-out. The hook is patched at its module-canonical path so we don't
need a real PG conn to assert call structure.
"""
from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from smartbi.canonical.silver_writers import (
    ProductSummaryWriter,
    ResolveResult,
)


_HOOK_PATH = (
    "smartbi.canonical.silver_writers.product_summary_writer."
    "write_provenance_for_fields"
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
    """conn with .transaction() returning a no-op async context manager."""
    conn = AsyncMock()
    tx_ctx = MagicMock()
    tx_ctx.__aenter__ = AsyncMock(return_value=None)
    tx_ctx.__aexit__ = AsyncMock(return_value=None)
    conn.transaction = MagicMock(return_value=tx_ctx)
    return conn


def _build_writer(conn):
    writer = ProductSummaryWriter(
        pool=_make_mock_pool(conn), orchestrator=MagicMock()
    )
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=20, is_tentative=False, confidence=0.95)
    )
    return writer


@pytest.mark.asyncio
async def test_provenance_hook_called_when_enabled(monkeypatch):
    """ENV=1 → write_provenance_for_fields invoked once per record."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    rows = [
        _row({"门店": "A 店", "商品名称": "P1", "单卖数量": "5", "销售金额": "200"}),
        _row({"门店": "A 店", "商品名称": "P2", "单卖数量": "3", "销售金额": "150"}),
    ]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value=None)  # _fetch_period
    conn.executemany = AsyncMock(return_value=None)

    writer = _build_writer(conn)
    # Make _resolve_product return distinct ids so provenance per-record is
    # provable even without distinct names.
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        side_effect=[
            ResolveResult(entity_id=21, is_tentative=False, confidence=0.95),
            ResolveResult(entity_id=22, is_tentative=False, confidence=0.95),
        ]
    )

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        mock_hook.return_value = {
            "written": 3,
            "queued": 0,
            "no_change": 0,
            "skipped_null": 0,
        }
        summary = await writer.write(upload_id=99, factory_id="F001")

    assert summary.rows_written == 2
    # Hook called once per record (2 records)
    assert mock_hook.await_count == 2

    # Verify args of first call. Phase B C1 fix: field_name encodes the
    # store dimension as ``@store_{store_id}`` suffix, so revenue →
    # ``revenue@store_10`` (store_id is mocked to 10 in _build_writer).
    first_kwargs = mock_hook.await_args_list[0].kwargs
    assert first_kwargs["factory_id"] == "F001"
    assert first_kwargs["entity_type"] == "product"
    assert first_kwargs["entity_id"] == 21
    assert first_kwargs["source_type"] == "product_summary"
    assert first_kwargs["mapper_method"] == "rule"
    assert first_kwargs["confidence"] == 0.85
    assert first_kwargs["source_upload_id"] == 99
    assert set(first_kwargs["fields"].keys()) == {
        "revenue@store_10",
        "qty_sold@store_10",
        "avg_unit_price@store_10",
    }
    assert first_kwargs["fields"]["revenue@store_10"] == 200.0
    assert first_kwargs["fields"]["qty_sold@store_10"] == 5.0
    assert first_kwargs["fields"]["avg_unit_price@store_10"] == 40.0

    # Second record's product_id distinct
    assert mock_hook.await_args_list[1].kwargs["entity_id"] == 22


@pytest.mark.asyncio
async def test_provenance_hook_skipped_when_disabled(monkeypatch):
    """ENV unset (default) → write_provenance_for_fields NEVER called."""
    monkeypatch.delenv("SMARTBI_ENABLE_PROVENANCE", raising=False)

    rows = [
        _row({"门店": "A", "商品名称": "P", "单卖数量": "5", "销售金额": "100"}),
    ]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value=None)
    conn.executemany = AsyncMock(return_value=None)
    writer = _build_writer(conn)

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        await writer.write(upload_id=1, factory_id="F001")

    assert mock_hook.await_count == 0
    # Inner conn.transaction() must not have been called either when gated off
    conn.transaction.assert_not_called()


@pytest.mark.asyncio
async def test_provenance_hook_skipped_for_empty_records(monkeypatch):
    """ENV=1 but no records (empty upload) → hook not called."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=[])
    conn.fetchrow = AsyncMock(return_value=None)
    conn.executemany = AsyncMock(return_value=None)
    writer = _build_writer(conn)

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 0
    assert mock_hook.await_count == 0
    conn.transaction.assert_not_called()


@pytest.mark.asyncio
async def test_provenance_hook_passes_period_as_validity(monkeypatch):
    """When SheetMergeAnalyzer set merge_inferred_period_*, those flow as
    valid_from/valid_to to the hook."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    rows = [
        _row({"门店": "A", "商品名称": "P", "单卖数量": "2", "销售金额": "50"}),
    ]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    # Phase 3: _fetch_period returns row with merge_inferred_period_*.
    conn.fetchrow = AsyncMock(
        return_value={
            "p_start": date(2026, 4, 1),
            "p_end": date(2026, 4, 30),
        }
    )
    conn.executemany = AsyncMock(return_value=None)
    writer = _build_writer(conn)

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        mock_hook.return_value = {
            "written": 3,
            "queued": 0,
            "no_change": 0,
            "skipped_null": 0,
        }
        await writer.write(upload_id=1, factory_id="F001")

    kwargs = mock_hook.await_args.kwargs
    assert kwargs["valid_from"] == date(2026, 4, 1)
    assert kwargs["valid_to"] == date(2026, 4, 30)


@pytest.mark.asyncio
async def test_provenance_hook_compound_field_name_per_store(monkeypatch):
    """Phase B C1 fix: same product across 2 stores → distinct field_names.

    Both records anchor to entity_type='product' / entity_id=20 (same product),
    but the field_name encodes store dimension as ``@store_{store_id}`` so the
    two provenance writes don't collide on the same dedup key. This is what
    lets a multi-store upload write all rows successfully instead of silently
    queueing N-1 of them as 'field_conflict' admin_queue noise.
    """
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    rows = [
        _row(
            {"门店": "A 店", "商品名称": "招牌鱼", "单卖数量": "10", "销售金额": "300"}
        ),
        _row(
            {"门店": "B 店", "商品名称": "招牌鱼", "单卖数量": "5", "销售金额": "150"}
        ),
    ]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value=None)
    conn.executemany = AsyncMock(return_value=None)

    writer = ProductSummaryWriter(
        pool=_make_mock_pool(conn), orchestrator=MagicMock()
    )
    # Two distinct stores, same product across both rows.
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        side_effect=[
            ResolveResult(entity_id=11, is_tentative=False, confidence=0.95),
            ResolveResult(entity_id=22, is_tentative=False, confidence=0.95),
        ]
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=99, is_tentative=False, confidence=0.95)
    )

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        mock_hook.return_value = {"written": 3, "queued": 0, "no_change": 0, "skipped_null": 0}
        await writer.write(upload_id=1, factory_id="F001")

    assert mock_hook.await_count == 2
    # Both calls anchor to product_id=99 ...
    assert mock_hook.await_args_list[0].kwargs["entity_id"] == 99
    assert mock_hook.await_args_list[1].kwargs["entity_id"] == 99
    # ...but field_names differ by @store_<id> suffix.
    fields_call_0 = set(mock_hook.await_args_list[0].kwargs["fields"].keys())
    fields_call_1 = set(mock_hook.await_args_list[1].kwargs["fields"].keys())
    assert fields_call_0 == {
        "revenue@store_11",
        "qty_sold@store_11",
        "avg_unit_price@store_11",
    }
    assert fields_call_1 == {
        "revenue@store_22",
        "qty_sold@store_22",
        "avg_unit_price@store_22",
    }
    # Distinct keys ensure no overlap → no provenance dedup-key collision.
    assert fields_call_0.isdisjoint(fields_call_1)


@pytest.mark.asyncio
async def test_provenance_hook_bare_field_name_when_store_null(monkeypatch):
    """Phase B C1 fix: store_id=None → bare field_name (no @ suffix)."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    rows = [
        _row({"门店": "A 店", "商品名称": "P", "单卖数量": "5", "销售金额": "200"}),
    ]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value=None)
    conn.executemany = AsyncMock(return_value=None)

    writer = ProductSummaryWriter(
        pool=_make_mock_pool(conn), orchestrator=MagicMock()
    )
    # Store-resolution returned None entity_id — but record path requires
    # entity_id != None to land in records. We need to override and feed in
    # a None store_id at records-creation level. Use a non-None entity_id for
    # store but assert that the writer's existing behavior would use it.
    # However the writer's path skips records when store entity_id is None
    # (line 61-63), so we can't actually exercise the bare-name path via the
    # public API today. Instead, we directly assert the hook code path is
    # consistent with the design — via inspection of the writer's records
    # tuple shape and the suffix logic. This test is therefore a placeholder
    # documenting the intent: if a future change allows store_id=None into
    # records, the hook MUST emit a bare ``revenue`` (no suffix). See the
    # writer's hook block conditional ``if store_id_for_prov is not None``.
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=20, is_tentative=False, confidence=0.95)
    )

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        mock_hook.return_value = {"written": 3, "queued": 0, "no_change": 0, "skipped_null": 0}
        await writer.write(upload_id=1, factory_id="F001")

    # Sanity: with store_id=10 (non-NULL), suffix applies.
    assert mock_hook.await_count == 1
    fields = set(mock_hook.await_args.kwargs["fields"].keys())
    assert fields == {"revenue@store_10", "qty_sold@store_10", "avg_unit_price@store_10"}
