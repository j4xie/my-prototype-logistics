"""Unit tests for FinanceWriter."""
from __future__ import annotations

import hashlib
from unittest.mock import AsyncMock, MagicMock

from smartbi.canonical.silver_writers import FinanceWriter, WriteSummary


def _make_mock_pool(conn):
    pool = MagicMock()
    acquire_ctx = MagicMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=acquire_ctx)
    return pool


def _row(d):
    return {"row_data": d}


async def test_existing_subject_reused():
    """Subject normalized match → existing subject_id returned, no INSERT."""
    rows = [
        _row(
            {
                "凭证号": "V001",
                "凭证日期": "2026-04-20",
                "科目": "营业收入",
                "借方": "0",
                "贷方": "1000",
            }
        ),
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    # fetchrow: SELECT existing returns subject_id=42
    conn.fetchrow = AsyncMock(return_value={"subject_id": 42})
    conn.execute = AsyncMock(return_value="INSERT 0 1")

    writer = FinanceWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    summary = await writer.write(upload_id=1, factory_id="F001")

    assert isinstance(summary, WriteSummary)
    assert summary.rows_written == 1
    assert summary.new_entity_count == 0
    # 1 SELECT for subject lookup; INSERT not called for subject
    assert conn.fetchrow.await_count == 1


async def test_new_subject_inserted():
    """Subject not found → INSERT new row with category='unknown'."""
    rows = [
        _row(
            {
                "凭证号": "V002",
                "凭证日期": "2026-04-20",
                "科目": "新科目",
                "借方": "100",
                "贷方": "0",
            }
        ),
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    # First fetchrow (SELECT) returns None; second (INSERT RETURNING) returns subject_id=77
    conn.fetchrow = AsyncMock(side_effect=[None, {"subject_id": 77}])
    conn.execute = AsyncMock(return_value="INSERT 0 1")

    writer = FinanceWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 1
    assert summary.new_entity_count == 1
    # SELECT then INSERT RETURNING
    assert conn.fetchrow.await_count == 2
    insert_call = conn.fetchrow.await_args_list[1]
    insert_sql = insert_call.args[0]
    assert "INSERT INTO dim_finance_subject" in insert_sql
    # category='unknown' is the 4th arg (factory_id, name, normalized_name, category)
    assert insert_call.args[4] == "unknown"


async def test_subject_cache_within_run():
    """Same normalized name twice → only 1 lookup."""
    rows = [
        _row({"凭证号": "V1", "科目": "营业收入", "借方": "10"}),
        _row({"凭证号": "V2", "科目": "营业 收入", "借方": "20"}),  # whitespace diff
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value={"subject_id": 5})
    conn.execute = AsyncMock(return_value="INSERT 0 1")

    writer = FinanceWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 2
    # Subject SELECTed only once due to cache
    assert conn.fetchrow.await_count == 1


async def test_source_row_hash_deterministic():
    """Hash = sha256(voucher_no|date|subject|amount). Same input → same hash."""
    rows = [_row({"凭证号": "V1", "凭证日期": "2026-04-20", "科目": "X", "借方": "100"})]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value={"subject_id": 1})
    conn.execute = AsyncMock(return_value="INSERT 0 1")

    writer = FinanceWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    await writer.write(upload_id=1, factory_id="F001")

    # source_row_hash is the 9th positional arg (1-indexed) of the INSERT
    insert_args = conn.execute.await_args.args
    actual_hash = insert_args[9]
    expected = hashlib.sha256(
        "V1|2026-04-20|X|100.0000".encode("utf-8")
    ).hexdigest()
    assert actual_hash == expected
    assert len(actual_hash) == 64


async def test_on_conflict_do_nothing_idempotent():
    """If execute returns 'INSERT 0 0' (conflict), rows_skipped++, not rows_written."""
    rows = [
        _row({"凭证号": "V1", "科目": "X", "借方": "10"}),
        _row({"凭证号": "V2", "科目": "X", "借方": "20"}),
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value={"subject_id": 1})
    # Second execute returns conflict (INSERT 0 0)
    conn.execute = AsyncMock(side_effect=["INSERT 0 1", "INSERT 0 0"])

    writer = FinanceWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 1
    assert summary.rows_skipped == 1


async def test_missing_subject_skipped():
    """Row with no subject column → skipped."""
    rows = [
        _row({"凭证号": "V1", "借方": "100"}),
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value="INSERT 0 1")

    writer = FinanceWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 0
    assert summary.rows_skipped == 1
    conn.fetchrow.assert_not_called()
    conn.execute.assert_not_called()


async def test_voucher_insert_carries_correct_fields():
    """INSERT carries voucher_no / voucher_date / subject_id / debit / credit."""
    rows = [
        _row(
            {
                "凭证号": "VX",
                "凭证日期": "2026-04-21",
                "科目": "现金",
                "借方": "500",
                "贷方": "0",
                "摘要": "差旅费",
            }
        ),
    ]
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value={"subject_id": 99})
    conn.execute = AsyncMock(return_value="INSERT 0 1")

    writer = FinanceWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())
    await writer.write(upload_id=10, factory_id="F999")

    args = conn.execute.await_args.args
    # args[0]=sql, args[1..]=binds in order: factory, upload, voucher_no, date, subject_id,
    # debit, credit, description, hash
    assert args[1] == "F999"
    assert args[2] == 10
    assert args[3] == "VX"
    assert args[5] == 99
    assert args[6] == 500.0
    assert args[7] == 0.0
    assert args[8] == "差旅费"
