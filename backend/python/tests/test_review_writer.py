"""Unit tests for ReviewWriter."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

from smartbi.canonical.silver_writers import ResolveResult, ReviewWriter, WriteSummary


def _make_mock_pool(conn):
    pool = MagicMock()
    acquire_ctx = MagicMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=acquire_ctx)
    return pool


def _row(d):
    return {"row_data": d}


async def test_writes_fact_rows_and_summary():
    """Each row → 1 fact_review_event INSERT (batched). Summary INSERTed once."""
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
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)

    writer = ReviewWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
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

    conn.executemany.assert_awaited_once()
    fact_sql = conn.executemany.await_args.args[0]
    fact_batch = conn.executemany.await_args.args[1]
    assert "fact_review_event" in fact_sql
    assert len(fact_batch) == 2
    assert fact_batch[0][0] == "F001"
    assert fact_batch[0][2] == 20  # product_id
    assert fact_batch[0][3] == 10  # store_id
    assert fact_batch[0][4] == 5.0  # rating
    # source_row_hash position 7 — must be 64-char SHA256 hex
    assert isinstance(fact_batch[0][7], str)
    assert len(fact_batch[0][7]) == 64

    conn.execute.assert_awaited_once()
    summary_sql = conn.execute.await_args.args[0]
    assert "dim_review_summary" in summary_sql
    summary_args = conn.execute.await_args.args
    # New arg order: (sql, factory_id, upload_id, product_id, store_id,
    #                 avg_rating, total, positive, negative, keywords, unmatched)
    assert summary_args[1] == "F001"
    assert summary_args[2] == 1  # upload_id
    # avg_rating = (5+1)/2 = 3.0
    assert summary_args[5] == 3.0
    # total_count
    assert summary_args[6] == 2
    # positive (rating >= 4) count = 1
    assert summary_args[7] == 1
    # negative (rating <= 2) count = 1
    assert summary_args[8] == 1


async def test_unresolved_product_appended_to_unmatched_names():
    """Product can't resolve → product_id=NULL on fact row + name appended to unmatched JSONB."""
    rows = [
        _row(
            {
                "门店": "A",
                "商品名称": "幽灵菜",
                "评分": "3",
                "评论内容": "?",
            }
        ),
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)

    writer = ReviewWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=None, is_tentative=False, confidence=0.0)
    )

    summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.admin_queue_count == 1

    fact_batch = conn.executemany.await_args.args[1]
    assert fact_batch[0][2] is None  # product_id NULL
    assert fact_batch[0][3] == 10  # store_id still resolved

    summary_args = conn.execute.await_args.args
    unmatched_jsonb = summary_args[10]
    parsed = json.loads(unmatched_jsonb)
    assert parsed == ["幽灵菜"]


async def test_keywords_placeholder_empty():
    """Day 8-9: top_keywords always written as []."""
    rows = [_row({"门店": "A", "评分": "5"})]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)

    writer = ReviewWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=20, is_tentative=False, confidence=0.95)
    )

    await writer.write(upload_id=1, factory_id="F001")

    summary_args = conn.execute.await_args.args
    keywords_jsonb = summary_args[9]
    assert json.loads(keywords_jsonb) == []


async def test_no_product_column_skips_product_resolve():
    """No product column → no product resolve call, all reviews land in fact with NULL product."""
    rows = [_row({"门店": "A", "评分": "5", "评论内容": "good"})]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)

    writer = ReviewWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=999, is_tentative=False, confidence=0.95)
    )

    await writer.write(upload_id=1, factory_id="F001")

    writer._resolve_product.assert_not_called()
    fact_batch = conn.executemany.await_args.args[1]
    assert fact_batch[0][2] is None  # product_id


async def test_sentiment_rating_3_neutral_only_counted_in_total():
    """Rating 3 (neutral) is counted in total but neither positive nor negative."""
    rows = [
        _row({"门店": "A", "评分": "3", "评论内容": "ok"}),
        _row({"门店": "A", "评分": "3", "评论内容": "still ok"}),
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)

    writer = ReviewWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=None, is_tentative=False, confidence=0.0)
    )

    summary = await writer.write(upload_id=1, factory_id="F001")

    summary_args = conn.execute.await_args.args
    assert summary_args[6] == 2  # total
    assert summary_args[7] == 0  # positive
    assert summary_args[8] == 0  # negative
    assert summary.rows_written == 2


async def test_no_rows_inserts_empty_summary():
    """Empty upload → no fact insert, summary INSERT still runs with zeros."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)

    writer = ReviewWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())

    summary = await writer.write(upload_id=99, factory_id="F001")

    assert summary.rows_written == 0
    conn.executemany.assert_not_called()
    conn.execute.assert_awaited_once()
    summary_args = conn.execute.await_args.args
    assert summary_args[5] is None  # avg_rating None
    assert summary_args[6] == 0  # total_count 0


async def test_unmatched_names_dedup():
    """Same product name unmatched twice → only listed once in unmatched_product_names."""
    rows = [
        _row({"门店": "A", "商品名称": "幽灵菜", "评分": "3"}),
        _row({"门店": "A", "商品名称": "幽灵菜", "评分": "4"}),
        _row({"门店": "A", "商品名称": "另一个", "评分": "2"}),
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)

    writer = ReviewWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=None, is_tentative=False, confidence=0.0)
    )

    await writer.write(upload_id=1, factory_id="F001")

    summary_args = conn.execute.await_args.args
    unmatched = json.loads(summary_args[10])
    assert sorted(unmatched) == ["另一个", "幽灵菜"]


async def test_idempotent_rerun_uses_source_row_hash():
    """Re-run with same upload_id must hit ON CONFLICT, not duplicate.

    Asserts the fact INSERT SQL contains the COALESCE(source_row_hash, '')
    expression matching `uq_fre_natkey`, and the summary INSERT contains
    the COALESCE-natkey ON CONFLICT DO UPDATE matching `uq_drs_natkey`.
    """
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
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)

    writer = ReviewWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    writer._resolve_store = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=10, is_tentative=False, confidence=0.95)
    )
    writer._resolve_product = AsyncMock(  # type: ignore[method-assign]
        return_value=ResolveResult(entity_id=20, is_tentative=False, confidence=0.95)
    )

    await writer.write(upload_id=1, factory_id="F001")

    fact_sql = conn.executemany.await_args.args[0]
    fact_batch = conn.executemany.await_args.args[1]
    assert "source_row_hash" in fact_sql
    assert (
        "COALESCE(source_row_hash, '')" in fact_sql
    ), "fact ON CONFLICT must use COALESCE matching uq_fre_natkey"
    assert "DO NOTHING" in fact_sql, "fact_review_event must DO NOTHING on conflict"
    # source_row_hash is the 8th tuple element (idx 7) and a 64-char hex string
    assert isinstance(fact_batch[0][7], str) and len(fact_batch[0][7]) == 64

    summary_sql = conn.execute.await_args.args[0]
    assert "dim_review_summary" in summary_sql
    assert "ON CONFLICT" in summary_sql
    assert (
        "COALESCE(period_start, DATE '0001-01-01')" in summary_sql
    ), "summary ON CONFLICT must use period_start COALESCE sentinel"
    assert "COALESCE(upload_id, 0)" in summary_sql
    assert "COALESCE(product_id, 0)" in summary_sql
    assert "COALESCE(store_id, 0)" in summary_sql
    assert "DO UPDATE SET" in summary_sql, "summary must upsert, not DO NOTHING"
    assert "avg_rating = EXCLUDED.avg_rating" in summary_sql
    assert "total_count = EXCLUDED.total_count" in summary_sql

    # Second run with same upload_id, same row → SQL identical, batch deterministic hash
    conn.fetch = AsyncMock(return_value=rows)
    conn.executemany = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)
    await writer.write(upload_id=1, factory_id="F001")
    fact_sql_second = conn.executemany.await_args.args[0]
    fact_batch_second = conn.executemany.await_args.args[1]
    assert fact_sql_second == fact_sql, "fact SQL must be identical across runs"
    # Same input row → same hash (deterministic)
    assert fact_batch_second[0][7] == fact_batch[0][7]
