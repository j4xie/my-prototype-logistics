"""Tests for canonical.templates.qhj_revenue_report — entry point + params shape.

Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §6.1-§6.2 + §11.2
Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task E1
"""
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from smartbi.canonical.templates.base import TemplateResult
from smartbi.canonical.templates.qhj_revenue_report import (
    RevenueReportParams,
    compute_qhj_revenue_report,
)


def test_params_defaults_yoy_false():
    """Spec §11.2: include_yoy is hardcoded False first phase."""
    p = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL",
        store_ids=[1, 2],
        date_from=date(2025, 10, 1),
        date_to=date(2025, 10, 7),
    )
    assert p.meal_periods is None
    assert p.include_yoy is False


def test_params_accepts_meal_periods():
    p = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL",
        store_ids=[1],
        date_from=date(2025, 10, 1),
        date_to=date(2025, 10, 7),
        meal_periods=["午市", "晚市"],
    )
    assert p.meal_periods == ["午市", "晚市"]


def _make_pool_with_canned_data():
    """Pool yielding empty fetches so the 4 block stubs don't error."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])
    conn.execute = AsyncMock(return_value="SET")
    conn.fetchval = AsyncMock(return_value=None)
    ctx = AsyncMock()
    ctx.__aenter__ = AsyncMock(return_value=conn)
    ctx.__aexit__ = AsyncMock(return_value=None)
    pool = MagicMock()
    pool.acquire = MagicMock(return_value=ctx)
    return pool, conn


@pytest.mark.asyncio
async def test_compute_returns_template_result_with_4_blocks():
    pool, _ = _make_pool_with_canned_data()
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL",
        store_ids=[1, 2],
        date_from=date(2025, 10, 1),
        date_to=date(2025, 10, 7),
    )
    result = await compute_qhj_revenue_report(pool, params)
    assert isinstance(result, TemplateResult)
    assert result.code == "qhj_revenue_report"
    assert result.title == "收入管理报表"
    for key in ("block1_yoy", "block2_mom", "block3_meal_split", "block4_diner_dist"):
        assert key in result.data, f"missing block {key}"


@pytest.mark.asyncio
async def test_meta_carries_yoy_note_when_disabled():
    pool, _ = _make_pool_with_canned_data()
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL",
        store_ids=[1],
        date_from=date(2025, 10, 1),
        date_to=date(2025, 10, 7),
    )
    result = await compute_qhj_revenue_report(pool, params)
    meta = result.data["meta"]
    assert meta["yoy_available"] is False
    assert meta["yoy_note"] == "需要 2024 同期数据"
    assert meta["date_from"] == "2025-10-01"
    assert meta["date_to"] == "2025-10-07"


@pytest.mark.asyncio
async def test_meta_yoy_note_none_when_enabled():
    pool, _ = _make_pool_with_canned_data()
    params = RevenueReportParams(
        factory_id="R_QINGHUAJIAO_REAL",
        store_ids=[1],
        date_from=date(2025, 10, 1),
        date_to=date(2025, 10, 7),
        include_yoy=True,
    )
    result = await compute_qhj_revenue_report(pool, params)
    assert result.data["meta"]["yoy_available"] is True
    assert result.data["meta"]["yoy_note"] is None
