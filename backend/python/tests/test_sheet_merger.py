"""Unit tests for sheet_merger — period inference + merge decision matrix."""
from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock

from smartbi.canonical.sheet_merger import (
    MergeSummary,
    PeriodRelation,
    SheetMergeAnalyzer,
    compare_periods,
    decide_merge,
    infer_sheet_time_window,
)


# ── compare_periods ────────────────────────────────────────────


def test_compare_periods_equal():
    a = (date(2025, 1, 1), date(2025, 1, 31))
    assert compare_periods(a, a) == PeriodRelation.EQUAL


def test_compare_periods_disjoint():
    a = (date(2025, 1, 1), date(2025, 1, 31))
    b = (date(2025, 3, 1), date(2025, 3, 31))
    assert compare_periods(a, b) == PeriodRelation.DISJOINT
    assert compare_periods(b, a) == PeriodRelation.DISJOINT


def test_compare_periods_subset():
    a = (date(2025, 1, 5), date(2025, 1, 20))
    b = (date(2025, 1, 1), date(2025, 1, 31))
    assert compare_periods(a, b) == PeriodRelation.SUBSET


def test_compare_periods_superset():
    a = (date(2025, 1, 1), date(2025, 1, 31))
    b = (date(2025, 1, 5), date(2025, 1, 20))
    assert compare_periods(a, b) == PeriodRelation.SUPERSET


def test_compare_periods_overlap():
    a = (date(2025, 1, 1), date(2025, 1, 20))
    b = (date(2025, 1, 15), date(2025, 2, 5))
    assert compare_periods(a, b) == PeriodRelation.OVERLAP


def test_compare_periods_unknown_with_nulls():
    a = (None, date(2025, 1, 31))
    b = (date(2025, 1, 1), date(2025, 1, 31))
    assert compare_periods(a, b) == PeriodRelation.UNKNOWN
    assert compare_periods((None, None), b) == PeriodRelation.UNKNOWN
    assert compare_periods(b, (date(2025, 1, 1), None)) == PeriodRelation.UNKNOWN


# ── infer_sheet_time_window ────────────────────────────────────


async def test_infer_period_priority1_row_date_column():
    """Field_definitions has canonical 'date' col → MIN/MAX from row_data."""
    conn = AsyncMock()
    # field_definitions returns a row whose original_name maps to canonical 'date'
    conn.fetch = AsyncMock(return_value=[{"original_name": "日期"}])
    conn.fetchrow = AsyncMock(
        return_value={"min_date": date(2025, 3, 1), "max_date": date(2025, 3, 31)}
    )

    period, method = await infer_sheet_time_window(upload_id=1, conn=conn)

    assert period == (date(2025, 3, 1), date(2025, 3, 31))
    assert method == "row_date_column"
    # Only one fetchrow call (the MIN/MAX); upload metadata not queried.
    assert conn.fetchrow.await_count == 1


async def test_infer_period_priority2_sheet_name_regex():
    """Priority 1 yields no date_col → regex parses '2024年12月' from sheet_name."""
    conn = AsyncMock()
    # No canonical 'date' column in field_definitions
    conn.fetch = AsyncMock(return_value=[{"original_name": "店铺"}])
    conn.fetchrow = AsyncMock(
        return_value={"sheet_name": "销售_2024年12月", "file_name": "report.xlsx"}
    )

    period, method = await infer_sheet_time_window(upload_id=1, conn=conn)

    assert period == (date(2024, 12, 1), date(2024, 12, 31))
    assert method == "sheet_name_regex"


async def test_infer_period_priority2_file_name_dash_pattern():
    """sheet_name empty → file_name '2025-06_data.csv' parsed."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])
    conn.fetchrow = AsyncMock(
        return_value={"sheet_name": None, "file_name": "2025-06_销售.csv"}
    )

    period, method = await infer_sheet_time_window(upload_id=1, conn=conn)

    assert period == (date(2025, 6, 1), date(2025, 6, 30))
    assert method == "sheet_name_regex"


async def test_infer_period_no_method_returns_none():
    """No date col + no parseable name → (None, None)."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])
    conn.fetchrow = AsyncMock(return_value={"sheet_name": "Sheet1", "file_name": "data.xlsx"})

    period, method = await infer_sheet_time_window(upload_id=1, conn=conn)

    assert period is None
    assert method is None


async def test_infer_period_priority1_falls_through_when_min_null():
    """Date col exists but column has only NULL values → fall through to priority 2."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[{"original_name": "日期"}])
    conn.fetchrow = AsyncMock(
        side_effect=[
            {"min_date": None, "max_date": None},  # MIN/MAX returns NULL
            {"sheet_name": "数据_2024年8月", "file_name": None},
        ]
    )

    period, method = await infer_sheet_time_window(upload_id=1, conn=conn)

    assert period == (date(2024, 8, 1), date(2024, 8, 31))
    assert method == "sheet_name_regex"


# ── decide_merge ───────────────────────────────────────────────


async def test_decide_merge_period_unknown_marks_skipped():
    """new upload with NULL period → marked PERIOD_UNKNOWN, skipped_count=1."""
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(
        return_value={
            "id": 100, "p_start": None, "p_end": None,
            "detected_table_type": "PRODUCT_SUMMARY",
        }
    )
    conn.execute = AsyncMock(return_value=None)
    conn.fetch = AsyncMock(return_value=[])

    summary = await decide_merge(new_upload_id=100, factory_id="F001", conn=conn)

    assert summary == MergeSummary(skipped_count=1)
    # Verify the UPDATE sets PERIOD_UNKNOWN
    calls = [c.args[0] for c in conn.execute.await_args_list]
    assert any("PERIOD_UNKNOWN" in sql for sql in calls)


async def test_decide_merge_disjoint_no_action():
    """new period disjoint from all others → 0 mutation, all counters 0."""
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(
        return_value={
            "id": 100, "p_start": date(2025, 3, 1), "p_end": date(2025, 3, 31),
            "detected_table_type": "PRODUCT_SUMMARY",
        }
    )
    conn.fetch = AsyncMock(
        return_value=[
            {"id": 50, "p_start": date(2025, 1, 1), "p_end": date(2025, 1, 31), "p_size": 30},
        ]
    )
    conn.execute = AsyncMock(return_value=None)

    summary = await decide_merge(new_upload_id=100, factory_id="F001", conn=conn)

    assert summary == MergeSummary()  # all zero
    # No UPDATE/INSERT executed (no merge action)
    assert conn.execute.await_count == 0


async def test_decide_merge_equal_marks_superseded():
    """Same period as existing → other upload SUPERSEDED."""
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(
        return_value={
            "id": 100, "p_start": date(2025, 1, 1), "p_end": date(2025, 1, 31),
            "detected_table_type": "PRODUCT_SUMMARY",
        }
    )
    conn.fetch = AsyncMock(
        return_value=[
            {"id": 50, "p_start": date(2025, 1, 1), "p_end": date(2025, 1, 31), "p_size": 30},
        ]
    )
    conn.execute = AsyncMock(return_value=None)

    summary = await decide_merge(new_upload_id=100, factory_id="F001", conn=conn)

    assert summary.superseded_count == 1
    assert summary.merged_count == 0
    assert summary.nested_count == 0
    # The UPDATE on `other` should set SUPERSEDED with id=50.
    update_call = conn.execute.await_args_list[0]
    assert "SUPERSEDED" in update_call.args[0]
    assert update_call.args[1] == 50


async def test_decide_merge_subset_marks_nested_and_queues_admin():
    """new period ⊂ other → new=NESTED_IN_<other>, admin row queued."""
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(
        return_value={
            "id": 100, "p_start": date(2025, 1, 5), "p_end": date(2025, 1, 20),
            "detected_table_type": "PRODUCT_SUMMARY",
        }
    )
    # other is the bigger container 2025-01-01..2025-01-31
    conn.fetch = AsyncMock(
        return_value=[
            {"id": 50, "p_start": date(2025, 1, 1), "p_end": date(2025, 1, 31), "p_size": 30},
        ]
    )
    conn.execute = AsyncMock(return_value=None)

    summary = await decide_merge(new_upload_id=100, factory_id="F001", conn=conn)

    assert summary.nested_count == 1
    assert summary.queued_count == 1
    # The new upload (id=100) should be marked NESTED_IN_50.
    nested_update_call = conn.execute.await_args_list[0]
    assert "NESTED_IN_50" in nested_update_call.args[0] or nested_update_call.args[1] == "NESTED_IN_50"
    # Admin queue insert happened (sheet_merge entity_type)
    queue_call = conn.execute.await_args_list[1]
    assert "entity_resolution_admin_queue" in queue_call.args[0]
    assert "sheet_merge" in queue_call.args[0]


async def test_decide_merge_overlap_marks_merged_and_queues_admin():
    """new period overlaps other → other=MERGED_INTO_<new>, admin queued."""
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(
        return_value={
            "id": 100, "p_start": date(2025, 1, 15), "p_end": date(2025, 2, 15),
            "detected_table_type": "PRODUCT_SUMMARY",
        }
    )
    conn.fetch = AsyncMock(
        return_value=[
            {"id": 50, "p_start": date(2025, 1, 1), "p_end": date(2025, 1, 31), "p_size": 30},
        ]
    )
    conn.execute = AsyncMock(return_value=None)

    summary = await decide_merge(new_upload_id=100, factory_id="F001", conn=conn)

    assert summary.merged_count == 1
    assert summary.queued_count == 1
    # Other upload id=50 was UPDATE-d with MERGED_INTO_100
    merge_call = conn.execute.await_args_list[0]
    assert "MERGED_INTO_100" in merge_call.args[1] or "MERGED_INTO_100" in merge_call.args[0]
    # Admin queue insert
    queue_call = conn.execute.await_args_list[1]
    assert "entity_resolution_admin_queue" in queue_call.args[0]


async def test_decide_merge_supersedes_smallest_first():
    """ORDER BY p_size ASC means we iterate smallest-window-first.

    new period covers both small & big container; SUPERSET applies to both.
    Both get SUPERSEDED (not just the first).
    """
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(
        return_value={
            "id": 100, "p_start": date(2025, 1, 1), "p_end": date(2025, 12, 31),
            "detected_table_type": "PRODUCT_SUMMARY",
        }
    )
    conn.fetch = AsyncMock(
        return_value=[
            # smallest first per ORDER BY p_size ASC
            {"id": 50, "p_start": date(2025, 1, 1), "p_end": date(2025, 1, 31), "p_size": 30},
            {"id": 60, "p_start": date(2025, 1, 1), "p_end": date(2025, 6, 30), "p_size": 180},
        ]
    )
    conn.execute = AsyncMock(return_value=None)

    summary = await decide_merge(new_upload_id=100, factory_id="F001", conn=conn)

    assert summary.superseded_count == 2
    # Two UPDATE calls, ids in order [50, 60]
    update_ids = [c.args[1] for c in conn.execute.await_args_list]
    assert update_ids == [50, 60]


async def test_decide_merge_breaks_after_subset_nested():
    """v1.2 S-NEW-8: once new is NESTED, stop iterating (avoid contradictory SUPERSED+NESTED)."""
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(
        return_value={
            "id": 100, "p_start": date(2025, 1, 5), "p_end": date(2025, 1, 20),
            "detected_table_type": "PRODUCT_SUMMARY",
        }
    )
    # First other is the smallest container (ORDER BY p_size ASC). Becomes SUBSET → break.
    conn.fetch = AsyncMock(
        return_value=[
            {"id": 50, "p_start": date(2025, 1, 1), "p_end": date(2025, 1, 31), "p_size": 30},
            {"id": 60, "p_start": date(2024, 1, 1), "p_end": date(2025, 12, 31), "p_size": 730},
        ]
    )
    conn.execute = AsyncMock(return_value=None)

    summary = await decide_merge(new_upload_id=100, factory_id="F001", conn=conn)

    # Only nested once; second iteration should not happen.
    assert summary.nested_count == 1
    assert summary.queued_count == 1
    # No SUPERSED on id=60 since loop broke
    update_calls = [c.args[0] for c in conn.execute.await_args_list]
    assert not any("SUPERSEDED" in sql for sql in update_calls)


# ── SheetMergeAnalyzer.analyze (integration of inference + decide_merge) ──


async def test_analyzer_persists_period_and_calls_decide_merge():
    """analyze() with valid period → UPDATE merge_inferred_period_*, then decide_merge."""
    conn = AsyncMock()
    # Inference path: priority 1 hits.
    # fetch sequence:
    #   1) field_definitions → [{original_name: '日期'}]
    #   2) decide_merge.others fetch → []
    conn.fetch = AsyncMock(
        side_effect=[
            [{"original_name": "日期"}],
            [],  # no other uploads
        ]
    )
    # fetchrow sequence:
    #   1) MIN/MAX from row_data
    #   2) decide_merge initial new_upload SELECT
    conn.fetchrow = AsyncMock(
        side_effect=[
            {"min_date": date(2025, 4, 1), "max_date": date(2025, 4, 30)},
            {
                "id": 100, "p_start": date(2025, 4, 1), "p_end": date(2025, 4, 30),
                "detected_table_type": "PRODUCT_SUMMARY",
            },
        ]
    )
    conn.execute = AsyncMock(return_value=None)

    analyzer = SheetMergeAnalyzer()
    summary = await analyzer.analyze(upload_id=100, factory_id="F001", conn=conn)

    assert summary == MergeSummary()  # no other uploads to merge against
    # First execute: UPDATE merge_inferred_period_*
    persist_call = conn.execute.await_args_list[0]
    assert "merge_inferred_period_start" in persist_call.args[0]
    assert "row_date_column" in persist_call.args[0] or persist_call.args[3] == "row_date_column"


async def test_analyzer_marks_period_unknown_when_inference_fails():
    """No date col + unparseable name → UPDATE merge_status='PERIOD_UNKNOWN', skipped."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])  # no field_definitions
    conn.fetchrow = AsyncMock(
        return_value={"sheet_name": "Sheet1", "file_name": "x.xlsx"}
    )
    conn.execute = AsyncMock(return_value=None)

    analyzer = SheetMergeAnalyzer()
    summary = await analyzer.analyze(upload_id=999, factory_id="F001", conn=conn)

    assert summary == MergeSummary(skipped_count=1)
    update_call = conn.execute.await_args_list[0]
    assert "PERIOD_UNKNOWN" in update_call.args[0]
    assert update_call.args[1] == 999
