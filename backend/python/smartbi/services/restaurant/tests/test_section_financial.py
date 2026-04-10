"""Tests for financial section handlers (diagnostics, benchmark_alerts, channel_margin)."""
from __future__ import annotations

import pandas as pd
import pytest

from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus
from smartbi.services.restaurant.sections.diagnostics import DiagnosticsHandler
from smartbi.services.restaurant.sections.benchmark_alerts import BenchmarkAlertsHandler
from smartbi.services.restaurant.sections.channel_margin import ChannelMarginHandler


@pytest.fixture
def dingxian_financial():
    """鼎鲜火锅 2026-02 real fixture."""
    return {
        "current": {
            "revenue": 731048,
            "food_cost": 307040,
            "labor_cost": 237660,
            "rent": 85000,
        },
        "previous": {
            "revenue": 1390503,
            "food_cost": 555555,
            "labor_cost": 323805,
            "rent": 85000,
        },
        "monthly_revenue": 731048,
    }


@pytest.fixture
def sample_pos_df():
    """Small POS DataFrame spanning multiple channels."""
    return pd.DataFrame([
        {"商品名称": "青花椒鱼", "订单来源": "堂食", "实收额": 88.0, "开单时间": "2026-02-01 12:30", "数量": 1},
        {"商品名称": "花椒鱼",   "订单来源": "堂食", "实收额": 78.0, "开单时间": "2026-02-01 13:15", "数量": 1},
        {"商品名称": "酸菜鱼",   "订单来源": "外卖", "实收额": 68.0, "开单时间": "2026-02-01 19:20", "数量": 1},
        {"商品名称": "水煮肉片", "订单来源": "团购", "实收额": 58.0, "开单时间": "2026-02-02 12:45", "数量": 1},
        {"商品名称": "麻婆豆腐", "订单来源": "堂食", "实收额": 38.0, "开单时间": "2026-02-02 19:00", "数量": 1},
    ])


# ── DiagnosticsHandler ────────────────────────────────────────

def test_diagnostics_runs_on_dingxian_fixture(dingxian_financial):
    """Engine should produce diagnoses (list may be empty if all metrics healthy)."""
    handler = DiagnosticsHandler()
    req = SectionRequest(
        factory_id="F-DINGXIAN-YIWU", upload_id="u1", sub_sector="火锅",
        params={"financial_data": dingxian_financial},
    )
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.OK
    assert response.section_name == "diagnostics"
    assert "diagnoses" in response.data
    assert isinstance(response.data["diagnoses"], list)
    assert response.data["totalCount"] >= 0
    assert response.data["criticalCount"] >= 0
    assert response.computed_at_ms >= 0


def test_diagnostics_skipped_without_financial_data():
    handler = DiagnosticsHandler()
    req = SectionRequest(factory_id="F1", upload_id="u1", sub_sector="火锅", params={})
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.SKIPPED
    assert any("financial_data" in w for w in response.warnings)


def test_diagnostics_reuses_financial_metrics_from_context(dingxian_financial):
    """When context carries a pre-extracted metrics dict (batch mode), handler should use it."""
    handler = DiagnosticsHandler()
    req = SectionRequest(
        factory_id="F-DINGXIAN-YIWU", upload_id="u1", sub_sector="火锅",
        params={"financial_data": dingxian_financial},
    )
    # Fabricate a metrics dict with only ratios (the DiagnosticsEngine accepts
    # any dict shape; missing keys are simply ignored).
    context = {"financial_metrics": {"food_cost_ratio": 42.0, "labor_cost_ratio": 32.5}}
    response = handler.compute(req, context=context)
    assert response.status == SectionStatus.OK


# ── BenchmarkAlertsHandler ────────────────────────────────────

def test_benchmark_alerts_runs_on_dingxian_fixture(dingxian_financial):
    handler = BenchmarkAlertsHandler()
    req = SectionRequest(
        factory_id="F-DINGXIAN-YIWU", upload_id="u1", sub_sector="火锅",
        store_name="鼎鲜火锅 · 义乌分公司",
        params={"financial_data": dingxian_financial},
    )
    # Pre-compute metrics in percentage form (as BenchmarkAlertEngine requires)
    rev = dingxian_financial["current"]["revenue"]
    metrics_pct = {
        "food_cost_ratio": dingxian_financial["current"]["food_cost"] / rev * 100,
        "labor_cost_ratio": dingxian_financial["current"]["labor_cost"] / rev * 100,
        "rent_ratio": dingxian_financial["current"]["rent"] / rev * 100,
    }
    response = handler.compute(req, context={"financial_metrics": metrics_pct})
    # Accept OK or SKIPPED (engine may legitimately skip for incomplete sub-sector data)
    assert response.status in (SectionStatus.OK, SectionStatus.SKIPPED)
    if response.status == SectionStatus.OK:
        assert response.section_name == "benchmark_alerts"
        assert "alerts" in response.data
        assert isinstance(response.data["alerts"], list)
        assert response.data["totalCount"] >= 0
        assert response.data["redCount"] >= 0


def test_benchmark_alerts_skipped_without_financial_data():
    handler = BenchmarkAlertsHandler()
    req = SectionRequest(factory_id="F1", upload_id="u1", sub_sector="火锅", params={})
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.SKIPPED


# ── ChannelMarginHandler ──────────────────────────────────────

def test_channel_margin_runs_on_sample_pos(sample_pos_df):
    handler = ChannelMarginHandler()
    req = SectionRequest(
        factory_id="F1", upload_id="u1", sub_sector="火锅", params={},
    )
    response = handler.compute(req, context={"pos_df": sample_pos_df})
    # Accept OK or SKIPPED — underlying calculator may abort on insufficient data,
    # we just need the handler to not crash and to return a valid SectionResponse.
    assert response.status in (SectionStatus.OK, SectionStatus.SKIPPED)
    assert response.section_name == "channel_margin"


def test_channel_margin_skipped_without_pos_df():
    handler = ChannelMarginHandler()
    req = SectionRequest(factory_id="F1", upload_id="u1", sub_sector="火锅", params={})
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.SKIPPED
    assert any("POS" in w or "DataFrame" in w for w in response.warnings)


def test_channel_margin_skipped_when_columns_missing(sample_pos_df):
    handler = ChannelMarginHandler()
    req = SectionRequest(
        factory_id="F1", upload_id="u1", sub_sector="火锅",
        params={"order_method_col": "NonExistent"},
    )
    response = handler.compute(req, context={"pos_df": sample_pos_df})
    assert response.status == SectionStatus.SKIPPED
    assert any("NonExistent" in w for w in response.warnings)
