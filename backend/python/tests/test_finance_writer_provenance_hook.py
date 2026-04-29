"""Unit tests for FinanceWriter dual-write provenance hook (Day 10-12).

Verifies:
- ENV=1 → hook called once per row that successfully INSERTed (not for skipped/dedup'd)
- ENV unset → hook NEVER called
- Anchor: entity_type='finance_subject', entity_id=subject_id
- valid_from = voucher_date for the row
"""
from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from smartbi.canonical.silver_writers import FinanceWriter


_HOOK_PATH = (
    "smartbi.canonical.silver_writers.finance_writer.write_provenance_for_fields"
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
async def test_provenance_hook_called_per_subject_day_when_enabled(monkeypatch):
    """ENV=1 → 1 hook call per UNIQUE (subject_id, voucher_date) roll-up.

    Phase B C1 fix: per-voucher provenance was rolled up to per-(subject,
    day) at the hook to avoid admin_queue noise. This test uses 2 vouchers
    on DIFFERENT days (same subject) → 2 distinct rollup keys → 2 hook
    calls (not 2 per-voucher writes that would collide on dedup).
    """
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

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
        _row(
            {
                "凭证号": "V002",
                "凭证日期": "2026-04-21",
                "科目": "营业收入",
                "借方": "200",
                "贷方": "0",
            }
        ),
    ]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    # subject lookup returns existing subject_id=42 each time (cached after first)
    conn.fetchrow = AsyncMock(return_value={"subject_id": 42})
    conn.execute = AsyncMock(return_value="INSERT 0 1")

    writer = FinanceWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        mock_hook.return_value = {
            "written": 2,
            "queued": 0,
            "no_change": 0,
            "skipped_null": 0,
        }
        summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 2
    assert mock_hook.await_count == 2

    # First call: V001 (debit=0, credit=1000, date=2026-04-20)
    kw1 = mock_hook.await_args_list[0].kwargs
    assert kw1["factory_id"] == "F001"
    assert kw1["entity_type"] == "finance_subject"
    assert kw1["entity_id"] == 42
    assert kw1["source_type"] == "bill_flow"
    assert kw1["mapper_method"] == "rule"
    assert kw1["confidence"] == 0.90
    assert kw1["source_upload_id"] == 1
    assert kw1["valid_from"] == date(2026, 4, 20)
    assert set(kw1["fields"].keys()) == {"debit_amount", "credit_amount"}
    assert kw1["fields"]["debit_amount"] == 0.0
    assert kw1["fields"]["credit_amount"] == 1000.0

    # Second call: V002 (debit=200, credit=0, date=2026-04-21)
    kw2 = mock_hook.await_args_list[1].kwargs
    assert kw2["valid_from"] == date(2026, 4, 21)
    assert kw2["fields"]["debit_amount"] == 200.0
    assert kw2["fields"]["credit_amount"] == 0.0


@pytest.mark.asyncio
async def test_provenance_hook_skipped_when_disabled(monkeypatch):
    """ENV unset → hook never called."""
    monkeypatch.delenv("SMARTBI_ENABLE_PROVENANCE", raising=False)

    rows = [
        _row(
            {
                "凭证号": "V001",
                "凭证日期": "2026-04-20",
                "科目": "营业收入",
                "借方": "100",
                "贷方": "0",
            }
        ),
    ]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value={"subject_id": 42})
    conn.execute = AsyncMock(return_value="INSERT 0 1")

    writer = FinanceWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        await writer.write(upload_id=1, factory_id="F001")

    assert mock_hook.await_count == 0
    conn.transaction.assert_not_called()


@pytest.mark.asyncio
async def test_provenance_hook_skipped_for_dedup_rows(monkeypatch):
    """Re-run row hits ON CONFLICT DO NOTHING ('INSERT 0 0') → row counted as
    skipped, no provenance write for it."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

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
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value={"subject_id": 42})
    # Simulate: row already in DB → ON CONFLICT DO NOTHING fires → "INSERT 0 0"
    conn.execute = AsyncMock(return_value="INSERT 0 0")

    writer = FinanceWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 0
    assert summary.rows_skipped == 1
    assert mock_hook.await_count == 0
    # transaction never opened because provenance_records is empty
    conn.transaction.assert_not_called()


@pytest.mark.asyncio
async def test_provenance_hook_skipped_when_no_subject_name(monkeypatch):
    """Row missing 科目 column → skipped early, no provenance attempted."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    rows = [
        _row({"凭证号": "V_X", "凭证日期": "2026-04-20", "借方": "100"}),
    ]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value="INSERT 0 1")

    writer = FinanceWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 0
    assert summary.rows_skipped == 1
    assert mock_hook.await_count == 0


@pytest.mark.asyncio
async def test_provenance_hook_rolls_up_same_subject_same_day(monkeypatch):
    """Phase B C1 fix: 3 vouchers same (subject, day) → 1 hook call with SUM.

    Per-voucher provenance lineage isn't analytically useful and would
    explode field_provenance rows (10k vouchers same subject/day → 20k rows,
    all but the first as 'field_conflict' admin_queue noise). Roll-up to
    one provenance row per (subject_id, voucher_date) preserves daily-
    subject granularity which is the meaningful query level.
    """
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    rows = [
        _row(
            {
                "凭证号": "V001",
                "凭证日期": "2026-04-20",
                "科目": "营业收入",
                "借方": "100",
                "贷方": "0",
            }
        ),
        _row(
            {
                "凭证号": "V002",
                "凭证日期": "2026-04-20",
                "科目": "营业收入",
                "借方": "200",
                "贷方": "0",
            }
        ),
        _row(
            {
                "凭证号": "V003",
                "凭证日期": "2026-04-20",
                "科目": "营业收入",
                "借方": "300",
                "贷方": "0",
            }
        ),
    ]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value={"subject_id": 42})
    conn.execute = AsyncMock(return_value="INSERT 0 1")

    writer = FinanceWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        mock_hook.return_value = {"written": 2, "queued": 0, "no_change": 0, "skipped_null": 0}
        summary = await writer.write(upload_id=1, factory_id="F001")

    # Silver layer wrote 3 distinct voucher rows (per-voucher detail retained)
    assert summary.rows_written == 3
    # Provenance roll-up: 3 vouchers same (subject, day) → 1 hook call.
    assert mock_hook.await_count == 1
    kw = mock_hook.await_args.kwargs
    assert kw["entity_type"] == "finance_subject"
    assert kw["entity_id"] == 42
    assert kw["valid_from"] == date(2026, 4, 20)
    # SUM(100+200+300) = 600 debit; 0 credit.
    assert kw["fields"]["debit_amount"] == 600.0
    assert kw["fields"]["credit_amount"] == 0.0


@pytest.mark.asyncio
async def test_provenance_hook_skips_voucher_with_null_date(monkeypatch):
    """Phase B C1 fix: voucher with NULL voucher_date can't be anchored.

    Skip from provenance roll-up — Silver layer still wrote the row, but we
    can't write provenance without a valid_from. The other voucher in the
    same upload (with a real date) must still produce its provenance row.
    """
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    rows = [
        _row(
            {
                "凭证号": "V_NO_DATE",
                "科目": "营业收入",
                "借方": "100",
                "贷方": "0",
            }
        ),
        _row(
            {
                "凭证号": "V_OK",
                "凭证日期": "2026-04-20",
                "科目": "营业收入",
                "借方": "200",
                "贷方": "0",
            }
        ),
    ]
    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=rows)
    conn.fetchrow = AsyncMock(return_value={"subject_id": 42})
    conn.execute = AsyncMock(return_value="INSERT 0 1")

    writer = FinanceWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        mock_hook.return_value = {"written": 2, "queued": 0, "no_change": 0, "skipped_null": 0}
        await writer.write(upload_id=1, factory_id="F001")

    # NULL-date voucher doesn't enter rollup → only 1 hook call (the dated one).
    assert mock_hook.await_count == 1
    kw = mock_hook.await_args.kwargs
    assert kw["valid_from"] == date(2026, 4, 20)
    assert kw["fields"]["debit_amount"] == 200.0


@pytest.mark.asyncio
async def test_provenance_hook_handles_empty_upload(monkeypatch):
    """ENV=1 but 0 rows → no hook call, no transaction."""
    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")

    conn = _make_conn_with_transaction()
    conn.fetch = AsyncMock(return_value=[])
    conn.fetchrow = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value="INSERT 0 1")

    writer = FinanceWriter(pool=_make_mock_pool(conn), orchestrator=MagicMock())

    with patch(_HOOK_PATH, new_callable=AsyncMock) as mock_hook:
        summary = await writer.write(upload_id=1, factory_id="F001")

    assert summary.rows_written == 0
    assert mock_hook.await_count == 0
    conn.transaction.assert_not_called()
