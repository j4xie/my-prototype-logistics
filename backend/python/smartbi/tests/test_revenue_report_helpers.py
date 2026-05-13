"""Tests for api._revenue_report_helpers — cache key, gen-with-cache, audit log.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §7.3, §10.7, §11.3
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task G1
"""
import hashlib
import json
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from smartbi.api._revenue_report_helpers import (
    REVENUE_REPORT_CACHE,
    compute_cache_key,
    _generate_with_cache,
)
from smartbi.canonical.templates.qhj_revenue_report import RevenueReportParams


# ─── cache_key ──────────────────────────────────────────────────────────

def test_cache_key_includes_factory_params_hash_and_gold_ts():
    p = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL", store_ids=[1, 2],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    key = compute_cache_key(p, gold_ts="2025-10-07T18:00:00")
    assert key.startswith("revenue_report:R_QINGHUAJIAO_REAL:")
    assert key.endswith(":2025-10-07T18:00:00")


def test_cache_key_stable_for_same_params():
    p1 = RevenueReportParams(
        factory_id="F1", store_ids=[2, 1],  # different order
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
        meal_periods=["晚市", "午市"],
    )
    p2 = RevenueReportParams(
        factory_id="F1", store_ids=[1, 2],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
        meal_periods=["午市", "晚市"],
    )
    assert compute_cache_key(p1, "T") == compute_cache_key(p2, "T")


def test_cache_key_changes_when_gold_ts_changes():
    p = RevenueReportParams(
        factory_id="F1", store_ids=[1],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    k1 = compute_cache_key(p, "2025-10-07T18:00:00")
    k2 = compute_cache_key(p, "2025-10-07T19:00:00")  # gold refreshed
    assert k1 != k2


# ─── _generate_with_cache ───────────────────────────────────────────────

def _make_pool_for_helpers(gold_max_ts):
    """Pool that returns gold_max_computed_at for the freshness query."""
    conn = AsyncMock()
    conn.execute = AsyncMock(return_value="SET")
    conn.fetchval = AsyncMock(return_value=gold_max_ts)
    conn.fetchrow = AsyncMock(return_value=None)  # for audit log INSERT path
    # audit log execute() path returns None
    ctx = AsyncMock()
    ctx.__aenter__ = AsyncMock(return_value=conn)
    ctx.__aexit__ = AsyncMock(return_value=None)
    pool = MagicMock()
    pool.acquire = MagicMock(return_value=ctx)
    return pool, conn


@pytest.mark.asyncio
async def test_generate_with_cache_first_call_is_miss():
    """First invocation runs compute + render; cache_hit summary flag is False."""
    REVENUE_REPORT_CACHE.clear()
    from datetime import datetime
    pool, _ = _make_pool_for_helpers(datetime(2025, 10, 7, 18, 0, 0))
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL", store_ids=[1],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )

    fake_template = MagicMock()
    fake_template.data = {
        "block1_yoy": [], "block2_mom": [], "block3_meal_split": [],
        "block4_diner_dist": [],
        "meta": {"date_from": "2025-10-01", "date_to": "2025-10-07",
                 "yoy_available": False, "yoy_note": "需要 2024 同期数据"},
    }
    fake_compute = AsyncMock(return_value=fake_template)

    with patch(
        "smartbi.api._revenue_report_helpers.compute_qhj_revenue_report",
        new=fake_compute,
    ):
        cache_key, summary, buf = await _generate_with_cache(
            pool, params, user_id="test_user",
        )

    assert summary["cache_hit"] is False
    assert summary["store_count"] == 1
    assert "PK" in buf.getvalue()[:4].decode("latin-1")  # xlsx zip magic
    fake_compute.assert_awaited_once()


@pytest.mark.asyncio
async def test_generate_with_cache_second_call_is_hit():
    """Second invocation with same key returns cached bytes; cache_hit=True."""
    REVENUE_REPORT_CACHE.clear()
    from datetime import datetime
    pool, _ = _make_pool_for_helpers(datetime(2025, 10, 7, 18, 0, 0))
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL", store_ids=[1],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )

    fake_template = MagicMock()
    fake_template.data = {
        "block1_yoy": [], "block2_mom": [], "block3_meal_split": [],
        "block4_diner_dist": [],
        "meta": {"date_from": "2025-10-01", "date_to": "2025-10-07",
                 "yoy_available": False, "yoy_note": None},
    }
    fake_compute = AsyncMock(return_value=fake_template)

    with patch(
        "smartbi.api._revenue_report_helpers.compute_qhj_revenue_report",
        new=fake_compute,
    ):
        # Miss
        await _generate_with_cache(pool, params, user_id="test_user")
        # Hit
        _, summary2, _ = await _generate_with_cache(pool, params, user_id="test_user")

    assert summary2["cache_hit"] is True
    fake_compute.assert_awaited_once()  # compute called only on miss


@pytest.mark.asyncio
async def test_generate_with_cache_summary_carries_gold_ts():
    REVENUE_REPORT_CACHE.clear()
    from datetime import datetime
    expected_ts = datetime(2025, 10, 7, 18, 0, 0)
    pool, _ = _make_pool_for_helpers(expected_ts)
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL", store_ids=[1, 2, 3],
        date_from=date(2025, 10, 1), date_to=date(2025, 10, 7),
    )
    fake_template = MagicMock()
    fake_template.data = {
        "block1_yoy": [], "block2_mom": [], "block3_meal_split": [],
        "block4_diner_dist": [],
        "meta": {"date_from": "2025-10-01", "date_to": "2025-10-07",
                 "yoy_available": False, "yoy_note": None},
    }
    fake_compute = AsyncMock(return_value=fake_template)

    with patch(
        "smartbi.api._revenue_report_helpers.compute_qhj_revenue_report",
        new=fake_compute,
    ):
        _, summary, _ = await _generate_with_cache(pool, params, user_id="u")

    assert summary["store_count"] == 3
    assert summary["gold_materialized_at"] == expected_ts.isoformat()
    assert summary["file_size_bytes"] > 0
