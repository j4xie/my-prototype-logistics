"""Unit tests for ReviewWriter dual-write provenance hook (Day 10-12).

Verifies:
- ENV=1 → hook called once per upload (one anchor entity per dim_review_summary roll-up)
- ENV unset → hook NEVER called
- Anchor selection: product_id if any product resolved, else store_id, else skip
- Hook gets correct fields: avg_rating, review_count, positive_count, negative_count
"""
from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from smartbi.canonical.silver_writers import ResolveResult, ReviewWriter


_HOOK_PATH = (
    "smartbi.canonical.silver_writers.review_writer.write_provenance_for_fields"
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


def _build_writer(conn, store_id=10, product_id=20):
    writer = ReviewWriter(
        pool=_make_mock_pool(conn), orchestrator=MagicMock()
    )
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=store_id, is_tentative=False, confidence=0.95)
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(
            entity_id=product_id, is_tentative=False, confidence=0.95
        )
    )
    return writer


@pytest.mark.asyncio
async def test_provenance_hook_called_once_per_upload_when_enabled(monkeypatch):
    """ENV=1 + reviews resolve → hook called once with summary fields."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    rows = [
        _row(
            {
                "门店": "A",
                "商品名称": "招牌鱼",
                "评分": "5",
                "评论内容": "好吃",
                "评论日期": "2026-04-20",
            }
        ),
        _row(
            {
                "门店": "A",
                "商品名称": "招牌鱼",
                "评分": "1",
                "评论内容": "难吃",
                "评论日期": "2026-04-21",
            }
        ),
    ]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value=None)
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)

    writer = _build_writer(conn)

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        mock_hook.return_value = {
            "written": 4,
            "queued": 0,
            "no_change": 0,
            "skipped_null": 0,
        }
        summary = await writer.write(upload_id=42, factory_id="F001")

    assert summary.rows_written == 2
    assert mock_hook.await_count == 1
    kw = mock_hook.await_args.kwargs
    assert kw["factory_id"] == "F001"
    assert kw["entity_type"] == "product"
    assert kw["entity_id"] == 20
    assert kw["source_type"] == "review"
    assert kw["mapper_method"] == "rule"
    assert kw["confidence"] == 0.80
    assert kw["source_upload_id"] == 42
    assert set(kw["fields"].keys()) == {
        "avg_rating",
        "review_count",
        "positive_count",
        "negative_count",
    }
    # avg of 5 and 1 = 3.0; 1 positive (rating>=4); 1 negative (rating<=2)
    assert kw["fields"]["avg_rating"] == 3.0
    assert kw["fields"]["review_count"] == 2
    assert kw["fields"]["positive_count"] == 1
    assert kw["fields"]["negative_count"] == 1


@pytest.mark.asyncio
async def test_provenance_hook_skipped_when_disabled(monkeypatch):
    """ENV unset → hook NEVER called."""
    monkeypatch.delenv("SMARTBI_ENABLE_PROVENANCE", raising=False)

    rows = [_row({"门店": "A", "商品名称": "P", "评分": "4", "评论日期": "2026-04-20"})]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value=None)
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)
    writer = _build_writer(conn)

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        await writer.write(upload_id=1, factory_id="F001")

    assert mock_hook.await_count == 0
    conn.transaction.assert_not_called()


@pytest.mark.asyncio
async def test_provenance_hook_falls_back_to_store_when_no_product(monkeypatch):
    """No product resolves → anchor to store_id with entity_type='store'."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    # Row has no product name → product resolution skipped → product_id_for_summary=None
    rows = [_row({"门店": "A", "评分": "5", "评论日期": "2026-04-20"})]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value=None)
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)
    writer = _build_writer(conn, store_id=77)

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        mock_hook.return_value = {
            "written": 4,
            "queued": 0,
            "no_change": 0,
            "skipped_null": 0,
        }
        await writer.write(upload_id=1, factory_id="F001")

    assert mock_hook.await_count == 1
    kw = mock_hook.await_args.kwargs
    assert kw["entity_type"] == "store"
    assert kw["entity_id"] == 77


@pytest.mark.asyncio
async def test_provenance_hook_skipped_when_no_anchor_entity(monkeypatch):
    """Neither product nor store resolves → hook NOT called."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    rows = [_row({"评分": "5", "评论日期": "2026-04-20"})]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value=None)
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)

    writer = ReviewWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=None, is_tentative=False, confidence=0.0)
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=None, is_tentative=False, confidence=0.0)
    )

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        await writer.write(upload_id=1, factory_id="F001")

    assert mock_hook.await_count == 0


@pytest.mark.asyncio
async def test_provenance_hook_passes_period_as_validity(monkeypatch):
    """When SheetMergeAnalyzer set merge_inferred_period_*, those flow through."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    rows = [_row({"门店": "A", "商品名称": "P", "评分": "5", "评论日期": "2026-04-20"})]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(
        return_value={"p_start": date(2026, 4, 1), "p_end": date(2026, 4, 30)}
    )
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)
    writer = _build_writer(conn)

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        mock_hook.return_value = {
            "written": 4,
            "queued": 0,
            "no_change": 0,
            "skipped_null": 0,
        }
        await writer.write(upload_id=1, factory_id="F001")

    kw = mock_hook.await_args.kwargs
    assert kw["valid_from"] == date(2026, 4, 1)
    assert kw["valid_to"] == date(2026, 4, 30)


@pytest.mark.asyncio
async def test_provenance_hook_skipped_when_no_rows(monkeypatch):
    """ENV=1 but 0 rows in upload → hook not called."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=[])
    conn.fetchrow = AsyncMock(return_value=None)
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)
    writer = _build_writer(conn)

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 0
    assert mock_hook.await_count == 0
