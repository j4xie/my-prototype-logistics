"""Unit tests for smartbi.scripts.backfill_provenance.

Mock-based — covers parameter passing, anchor logic, NULL handling,
rollup behavior. Real-PG tests are in test_data_fabric_e2e.py.
"""
from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest

from smartbi.scripts.backfill_provenance import (
    SUPPORTED_TABLES,
    _backfill_agg_product_period_batch,
    _backfill_dim_review_summary_batch,
    _backfill_fact_finance_voucher_batch,
    _backfill_fact_inventory_snapshot_batch,
    _load_checkpoint,
    _reset_checkpoint,
    _save_checkpoint,
    _store_suffix,
    backfill_table,
)


pytestmark = pytest.mark.asyncio


# ── Checkpoint helpers ─────────────────────────────────────────────

async def test_load_checkpoint_returns_zero_when_no_row():
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value=None)
    out = await _load_checkpoint(conn, "agg_product_period")
    assert out == 0


async def test_load_checkpoint_returns_existing_last_id():
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"last_id": 4242})
    out = await _load_checkpoint(conn, "agg_product_period")
    assert out == 4242


async def test_save_checkpoint_uses_on_conflict_upsert():
    conn = MagicMock()
    conn.execute = AsyncMock(return_value="UPDATE 1")
    await _save_checkpoint(
        conn, "agg_product_period",
        last_id=100, rows_processed_delta=50, rows_inserted_delta=40, rows_skipped_delta=10,
    )
    args, kwargs = conn.execute.call_args
    sql = args[0]
    assert "INSERT INTO backfill_progress" in sql
    assert "ON CONFLICT (table_name)" in sql
    assert args[1] == "agg_product_period"
    assert args[2] == 100
    assert args[3] == 50
    assert args[4] == 40
    assert args[5] == 10


async def test_reset_checkpoint_zeros_all_counters():
    conn = MagicMock()
    conn.execute = AsyncMock(return_value="UPDATE 1")
    await _reset_checkpoint(conn, "fact_finance_voucher")
    args, _ = conn.execute.call_args
    sql = args[0]
    assert "last_id = 0" in sql
    assert "rows_processed = 0" in sql
    assert "rows_inserted = 0" in sql
    assert "completed_at = NULL" in sql


# ── _store_suffix ──────────────────────────────────────────────────

def test_store_suffix_with_id_returns_at_store():
    assert _store_suffix(42) == "@store_42"


def test_store_suffix_with_none_returns_empty():
    assert _store_suffix(None) == ""


def test_store_suffix_with_zero_treated_as_real_id():
    # 0 is not None — only None means "no store dimension"
    assert _store_suffix(0) == "@store_0"


# ── agg_product_period mapper ──────────────────────────────────────

async def test_backfill_agg_product_period_batch_writes_3_fields_per_row():
    """One source row with all 3 metrics → 3 INSERT calls, 3 inserted."""
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"id": 999})  # always insert
    rows = [
        {
            "id": 1, "factory_id": "F999", "upload_id": 5,
            "product_id": 100, "store_id": 7,
            "period_start": date(2026, 1, 1), "period_end": date(2026, 1, 31),
            "qty_sold": 10, "revenue": 1000.0, "avg_unit_price": 100.0,
        }
    ]
    attempted, inserted = await _backfill_agg_product_period_batch(conn, rows)
    assert attempted == 3
    assert inserted == 3
    # Verify @store_7 in 3 calls
    field_names = [c.args[3] for c in conn.fetchrow.call_args_list]
    assert field_names == ["revenue@store_7", "qty_sold@store_7", "avg_unit_price@store_7"]


async def test_backfill_agg_product_period_batch_skips_null_value_fields():
    """revenue=None → only 2 fields attempted."""
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"id": 999})
    rows = [
        {
            "id": 1, "factory_id": "F999", "upload_id": 5,
            "product_id": 100, "store_id": 7,
            "period_start": date(2026, 1, 1), "period_end": date(2026, 1, 31),
            "qty_sold": 10, "revenue": None, "avg_unit_price": 100.0,
        }
    ]
    attempted, inserted = await _backfill_agg_product_period_batch(conn, rows)
    assert attempted == 2
    assert inserted == 2


async def test_backfill_agg_product_period_skips_null_product_id():
    """product_id=None → entire row skipped (no anchor)."""
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"id": 999})
    rows = [
        {
            "id": 1, "factory_id": "F999", "upload_id": 5,
            "product_id": None, "store_id": 7,
            "period_start": date(2026, 1, 1), "period_end": date(2026, 1, 31),
            "qty_sold": 10, "revenue": 1000.0, "avg_unit_price": 100.0,
        }
    ]
    attempted, inserted = await _backfill_agg_product_period_batch(conn, rows)
    assert attempted == 0
    assert inserted == 0


async def test_backfill_agg_product_period_null_store_uses_bare_field_name():
    """store_id=None → bare field name (no @store suffix)."""
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"id": 999})
    rows = [
        {
            "id": 1, "factory_id": "F999", "upload_id": 5,
            "product_id": 100, "store_id": None,
            "period_start": date(2026, 1, 1), "period_end": date(2026, 1, 31),
            "qty_sold": 10, "revenue": 1000.0, "avg_unit_price": 100.0,
        }
    ]
    attempted, inserted = await _backfill_agg_product_period_batch(conn, rows)
    assert attempted == 3
    field_names = [c.args[3] for c in conn.fetchrow.call_args_list]
    assert field_names == ["revenue", "qty_sold", "avg_unit_price"]


async def test_backfill_agg_product_period_idempotent_on_dedup_collision():
    """Re-run: ON CONFLICT DO NOTHING returns None → counted as not-inserted."""
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value=None)  # simulates dedup collision
    rows = [
        {
            "id": 1, "factory_id": "F999", "upload_id": 5,
            "product_id": 100, "store_id": 7,
            "period_start": date(2026, 1, 1), "period_end": date(2026, 1, 31),
            "qty_sold": 10, "revenue": 1000.0, "avg_unit_price": 100.0,
        }
    ]
    attempted, inserted = await _backfill_agg_product_period_batch(conn, rows)
    assert attempted == 3
    assert inserted == 0


# ── dim_review_summary mapper ──────────────────────────────────────

async def test_backfill_dim_review_summary_anchors_to_product_when_present():
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"id": 999})
    rows = [
        {
            "id": 1, "factory_id": "F999", "upload_id": 12,
            "product_id": 200, "store_id": 99,
            "period_start": date(2026, 1, 1), "period_end": date(2026, 1, 31),
            "avg_rating": 4.5, "total_count": 100, "positive_count": 80, "negative_count": 5,
        }
    ]
    attempted, inserted = await _backfill_dim_review_summary_batch(conn, rows)
    assert attempted == 4
    assert inserted == 4
    # call_args = (SQL, factory_id, entity_type, entity_id, field_name, value_json, ...)
    # so args[2] = entity_type, args[3] = entity_id
    entity_types = [c.args[2] for c in conn.fetchrow.call_args_list]
    entity_ids = [c.args[3] for c in conn.fetchrow.call_args_list]
    assert all(et == "product" for et in entity_types)
    assert all(eid == 200 for eid in entity_ids)


async def test_backfill_dim_review_summary_falls_back_to_store_anchor():
    """product_id=None, store_id=10 → entity_type='store'."""
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"id": 999})
    rows = [
        {
            "id": 1, "factory_id": "F999", "upload_id": 12,
            "product_id": None, "store_id": 10,
            "period_start": date(2026, 1, 1), "period_end": date(2026, 1, 31),
            "avg_rating": 4.0, "total_count": 50, "positive_count": 40, "negative_count": 5,
        }
    ]
    attempted, inserted = await _backfill_dim_review_summary_batch(conn, rows)
    assert attempted == 4
    entity_types = {c.args[2] for c in conn.fetchrow.call_args_list}
    entity_ids = {c.args[3] for c in conn.fetchrow.call_args_list}
    assert entity_types == {"store"}
    assert entity_ids == {10}


async def test_backfill_dim_review_summary_skips_when_no_anchor():
    """Both product_id + store_id NULL → row skipped entirely."""
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"id": 999})
    rows = [
        {
            "id": 1, "factory_id": "F999", "upload_id": 12,
            "product_id": None, "store_id": None,
            "period_start": date(2026, 1, 1), "period_end": date(2026, 1, 31),
            "avg_rating": 4.0, "total_count": 50, "positive_count": 40, "negative_count": 5,
        }
    ]
    attempted, inserted = await _backfill_dim_review_summary_batch(conn, rows)
    assert attempted == 0
    assert inserted == 0


async def test_backfill_dim_review_summary_field_name_mapping():
    """Field names match writer hook: total_count → review_count."""
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"id": 999})
    rows = [
        {
            "id": 1, "factory_id": "F999", "upload_id": 12,
            "product_id": 200, "store_id": None,
            "period_start": date(2026, 1, 1), "period_end": date(2026, 1, 31),
            "avg_rating": 4.5, "total_count": 100, "positive_count": 80, "negative_count": 5,
        }
    ]
    await _backfill_dim_review_summary_batch(conn, rows)
    # args[4] = field_name (review SQL has factory_id at args[1], entity_type at args[2],
    # entity_id at args[3], field_name at args[4]).
    field_names = sorted(c.args[4] for c in conn.fetchrow.call_args_list)
    # Note: total_count → review_count
    assert field_names == sorted(["avg_rating", "review_count", "positive_count", "negative_count"])


async def test_backfill_dim_review_summary_forwards_real_upload_id():
    """I1: backfill must forward src['upload_id'] (added by V20260428_01),
    not the sentinel 0. Otherwise audit lineage to the original Excel
    upload is lost.
    """
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"id": 999})
    rows = [
        {
            "id": 1, "factory_id": "F999", "upload_id": 4242,
            "product_id": 200, "store_id": None,
            "period_start": date(2026, 1, 1), "period_end": date(2026, 1, 31),
            "avg_rating": 4.5, "total_count": 100, "positive_count": 80, "negative_count": 5,
        }
    ]
    await _backfill_dim_review_summary_batch(conn, rows)
    # args[6] = source_upload_id (factory_id, entity_type, entity_id, field_name,
    # value_json, source_upload_id, period_start, period_end, created_by)
    upload_ids = {c.args[6] for c in conn.fetchrow.call_args_list}
    assert upload_ids == {4242}, f"expected real upload_id 4242, got {upload_ids}"


async def test_backfill_dim_review_summary_falls_back_to_sentinel_on_null_upload():
    """I1: when upload_id IS NULL (legacy rows pre-V20260428_01), fall back
    to sentinel 0 so the FK to smart_bi_pg_excel_uploads(id) resolves.
    """
    from smartbi.scripts.backfill_provenance import _SENTINEL_UPLOAD_ID

    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"id": 999})
    rows = [
        {
            "id": 1, "factory_id": "F999", "upload_id": None,
            "product_id": 200, "store_id": None,
            "period_start": date(2026, 1, 1), "period_end": date(2026, 1, 31),
            "avg_rating": 4.5, "total_count": 100, "positive_count": 80, "negative_count": 5,
        }
    ]
    await _backfill_dim_review_summary_batch(conn, rows)
    upload_ids = {c.args[6] for c in conn.fetchrow.call_args_list}
    assert upload_ids == {_SENTINEL_UPLOAD_ID}


# ── fact_finance_voucher mapper ────────────────────────────────────

async def test_backfill_fact_finance_voucher_rolls_up_per_subject_date():
    """3 vouchers same (subject, date) → 1 group → 2 INSERTs (debit + credit)."""
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"id": 999})
    rows = [
        {
            "id": i, "factory_id": "F999", "upload_id": 7,
            "subject_id": 10, "voucher_date": date(2026, 1, 15),
            "debit_amount": 100.0, "credit_amount": 50.0,
        }
        for i in range(1, 4)
    ]
    attempted, inserted = await _backfill_fact_finance_voucher_batch(conn, rows)
    assert attempted == 2  # one per field, one group
    assert inserted == 2
    # Both calls have entity_type=finance_subject, entity_id=10
    args_per_call = [c.args for c in conn.fetchrow.call_args_list]
    assert all(a[2] == 10 for a in args_per_call)
    # Field names + values match SUM
    field_to_value = {a[3]: a[4] for a in args_per_call}
    import json as _json
    assert _json.loads(field_to_value["debit_amount"]) == 300.0
    assert _json.loads(field_to_value["credit_amount"]) == 150.0


async def test_backfill_fact_finance_voucher_skips_zero_after_rollup():
    """All credits = 0 after SUM → no credit row written, only debit."""
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"id": 999})
    rows = [
        {
            "id": 1, "factory_id": "F999", "upload_id": 7,
            "subject_id": 10, "voucher_date": date(2026, 1, 15),
            "debit_amount": 100.0, "credit_amount": 0,
        }
    ]
    attempted, inserted = await _backfill_fact_finance_voucher_batch(conn, rows)
    assert attempted == 1  # only debit
    assert inserted == 1
    field_name_called = conn.fetchrow.call_args.args[3]
    assert field_name_called == "debit_amount"


async def test_backfill_fact_finance_voucher_skips_null_subject_or_date(caplog):
    """NULL subject_id or voucher_date rows skipped (no anchor)."""
    import logging
    caplog.set_level(logging.WARNING)
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"id": 999})
    rows = [
        {
            "id": 1, "factory_id": "F999", "upload_id": 7,
            "subject_id": None, "voucher_date": date(2026, 1, 15),
            "debit_amount": 100.0, "credit_amount": 50.0,
        },
        {
            "id": 2, "factory_id": "F999", "upload_id": 7,
            "subject_id": 10, "voucher_date": None,
            "debit_amount": 100.0, "credit_amount": 50.0,
        },
    ]
    attempted, inserted = await _backfill_fact_finance_voucher_batch(conn, rows)
    assert attempted == 0  # both skipped
    assert inserted == 0
    assert any("2 rows skipped" in r.message for r in caplog.records)


# ── fact_inventory_snapshot mapper ─────────────────────────────────

async def test_backfill_fact_inventory_snapshot_handles_null_store():
    """store_id=None → bare field_name 'stock_qty' (no @ suffix)."""
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"id": 999})
    rows = [
        {
            "id": 1, "factory_id": "F999", "upload_id": 8,
            "ingredient_id": 50, "store_id": None,
            "snapshot_date": date(2026, 4, 22),
            "stock_qty": 12.5, "unit": "kg",
        }
    ]
    attempted, inserted = await _backfill_fact_inventory_snapshot_batch(conn, rows)
    assert attempted == 2
    assert inserted == 2
    field_names = sorted(c.args[3] for c in conn.fetchrow.call_args_list)
    assert field_names == sorted(["stock_qty", "unit"])


async def test_backfill_fact_inventory_snapshot_with_store_uses_compound():
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"id": 999})
    rows = [
        {
            "id": 1, "factory_id": "F999", "upload_id": 8,
            "ingredient_id": 50, "store_id": 3,
            "snapshot_date": date(2026, 4, 22),
            "stock_qty": 12.5, "unit": "kg",
        }
    ]
    await _backfill_fact_inventory_snapshot_batch(conn, rows)
    field_names = sorted(c.args[3] for c in conn.fetchrow.call_args_list)
    assert field_names == sorted(["stock_qty@store_3", "unit@store_3"])


async def test_backfill_fact_inventory_snapshot_skips_null_ingredient():
    """ingredient_id NULL → no anchor, row skipped."""
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value={"id": 999})
    rows = [
        {
            "id": 1, "factory_id": "F999", "upload_id": 8,
            "ingredient_id": None, "store_id": 3,
            "snapshot_date": date(2026, 4, 22),
            "stock_qty": 12.5, "unit": "kg",
        }
    ]
    attempted, inserted = await _backfill_fact_inventory_snapshot_batch(conn, rows)
    assert attempted == 0
    assert inserted == 0


# ── Dispatch ───────────────────────────────────────────────────────

async def test_backfill_table_unsupported_raises_value_error():
    """Calling backfill_table with unknown table → ValueError early."""
    pool = MagicMock()
    with pytest.raises(ValueError, match="Unsupported table"):
        await backfill_table(pool, "no_such_table")


def test_supported_tables_match_dispatch_keys():
    """Drift guard: SUPPORTED_TABLES tuple matches _TABLE_DISPATCH keys."""
    from smartbi.scripts.backfill_provenance import _TABLE_DISPATCH
    assert set(SUPPORTED_TABLES) == set(_TABLE_DISPATCH.keys())


# ── I5: SMARTBI_ENABLE_PROVENANCE refuse-to-run guard ──────────────


async def test_main_async_refuses_to_run_when_provenance_flag_on(monkeypatch):
    """I5: main_async must exit 1 (without ever opening a pool) when the
    live writer flag is ON. Concurrent backfill + live writes on the same
    dedup key would race because writer.py raises UniqueViolation while
    backfill has ON CONFLICT DO NOTHING.
    """
    from smartbi.scripts import backfill_provenance as bf

    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", "1")
    # Sentinel guard against accidentally trying to connect: if main_async
    # somehow proceeds past the I5 check, the pool factory below would raise
    # AssertionError instead of the I5 returning 1.
    pool_called = {"count": 0}

    async def _fake_create_pool(*_args, **_kwargs):  # noqa: ANN001
        pool_called["count"] += 1
        raise AssertionError("create_pool should not be reached when flag ON")

    monkeypatch.setattr(bf.asyncpg, "create_pool", _fake_create_pool)

    args = MagicMock(
        table=["agg_product_period"], reset=False,
        batch_size=5000, sleep=0.2, dry_run=False,
    )
    rc = await bf.main_async(args)
    assert rc == 1
    assert pool_called["count"] == 0


@pytest.mark.parametrize("flag_value", ["true", "yes", "on", "1", "TRUE", "On", " 1 "])
async def test_main_async_refuses_for_truthy_flag_variants(monkeypatch, flag_value):
    """I5: refuse-to-run accepts the same truthy spellings as
    is_provenance_enabled() in _writer_hook.py (case + whitespace tolerant)."""
    from smartbi.scripts import backfill_provenance as bf

    monkeypatch.setenv("SMARTBI_ENABLE_PROVENANCE", flag_value)

    async def _fake_create_pool(*_args, **_kwargs):  # noqa: ANN001
        raise AssertionError(f"create_pool should not be reached for flag={flag_value!r}")

    monkeypatch.setattr(bf.asyncpg, "create_pool", _fake_create_pool)
    args = MagicMock(
        table=["agg_product_period"], reset=False,
        batch_size=5000, sleep=0.2, dry_run=False,
    )
    assert await bf.main_async(args) == 1
