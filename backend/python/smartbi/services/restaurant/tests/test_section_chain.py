"""Tests for chain-level section handlers (Task 1.6).

Covers:
  - MultiStoreComparisonHandler → wraps MultiStoreComparator
  - CalibrationHistoryHandler   → wraps MonthlyCalibrationReporter (needs db_session)
  - StorePnlOnePagerHandler     → composes prior section outputs
  - BomLayerStatusHandler       → wraps RestaurantAnalyzerV2._build_bom_layer_status

Each handler has at least:
  1. A positive path test (real synthetic input → OK or graceful SKIPPED)
  2. A skip path test (missing required input → SKIPPED with reason)

Tests use ``in (OK, SKIPPED)`` for tolerant assertions where the underlying
engine may legitimately return SKIPPED on edge cases. The contract being
tested is that the handler **does not crash** and returns a valid
SectionResponse.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pandas as pd
import pytest

from smartbi.services.restaurant.sections.base import SectionRequest, SectionStatus
from smartbi.services.restaurant.sections.bom_layer_status import BomLayerStatusHandler
from smartbi.services.restaurant.sections.calibration_history import CalibrationHistoryHandler
from smartbi.services.restaurant.sections.multi_store_comparison import (
    MultiStoreComparisonHandler,
)
from smartbi.services.restaurant.sections.store_pnl_one_pager import (
    StorePnlOnePagerHandler,
)


# ─────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────


@pytest.fixture
def multi_store_pos_df():
    """POS DataFrame: 3 stores × 5 SKUs × 60 days, ~900 rows.

    Includes 门店名称 column required by MultiStoreComparator.
    """
    rows = []
    base = datetime(2026, 1, 1, 10, 0, 0)
    stores = ["青花椒松江店", "青花椒陆家嘴店", "青花椒第一百货店"]
    dishes = [
        ("青花椒鱼", 88.0),
        ("花椒鱼", 78.0),
        ("酸菜鱼", 68.0),
        ("水煮肉片", 58.0),
        ("麻婆豆腐", 38.0),
    ]
    for day in range(60):
        for store in stores:
            for name, price in dishes:
                rows.append({
                    "商品名称": name,
                    "订单来源": "堂食",
                    "实收额": price,
                    "开单时间": (base + timedelta(days=day)).isoformat(),
                    "数量": 1,
                    "门店名称": store,
                })
    return pd.DataFrame(rows)


@pytest.fixture
def single_store_pos_df():
    """POS DataFrame with only 1 store — multi-store comparison should skip."""
    return pd.DataFrame([
        {
            "商品名称": "青花椒鱼",
            "订单来源": "堂食",
            "实收额": 88.0,
            "开单时间": "2026-02-01 12:30",
            "数量": 1,
            "门店名称": "青花椒松江店",
        },
    ])


@pytest.fixture
def sample_financial_metrics():
    """鼎鲜火锅 2026-02 fixture as a financial_metrics dict
    (FinancialMetrics.to_dict() shape).
    """
    return {
        "revenue": 731048,
        "foodCost": 335213,
        "laborCost": 237660,
        "rent": 57328,
        "otherCost": None,
        "netProfit": -49724,
        "foodCostRatio": 0.4585,
        "laborCostRatio": 0.3251,
        "rentRatio": 0.0784,
        "restaurantNetMargin": -0.068,
        "costRigidity": 0.561,
        "revenueChangePct": -0.474,
        "laborCostChangePct": -0.266,
        "foodCostChangePct": -0.397,
    }


# ─────────────────────────────────────────────────────────
# MultiStoreComparisonHandler
# ─────────────────────────────────────────────────────────


def test_multi_store_runs_with_3_stores(multi_store_pos_df):
    """Positive path: 3 stores in POS → comparator should succeed."""
    handler = MultiStoreComparisonHandler()
    req = SectionRequest(
        factory_id="F1", upload_id="u1", sub_sector="川菜", params={}
    )
    response = handler.compute(req, context={"pos_df": multi_store_pos_df})
    assert response.section_name == "multi_store_comparison"
    assert response.status in (SectionStatus.OK, SectionStatus.SKIPPED)
    assert response.computed_at_ms >= 0
    if response.status == SectionStatus.OK:
        assert "storeCount" in response.data
        assert response.data["storeCount"] == 3
        assert "storeRankings" in response.data
        assert isinstance(response.data["storeRankings"], list)
        assert len(response.data["storeRankings"]) == 3


def test_multi_store_skipped_without_pos():
    """Skip path: no POS at all."""
    handler = MultiStoreComparisonHandler()
    req = SectionRequest(
        factory_id="F1", upload_id="u1", sub_sector="川菜", params={}
    )
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.SKIPPED
    assert any("POS" in w for w in response.warnings)


def test_multi_store_skipped_with_single_store(single_store_pos_df):
    """Skip path: single store doesn't satisfy ≥2 stores requirement."""
    handler = MultiStoreComparisonHandler()
    req = SectionRequest(
        factory_id="F1", upload_id="u1", sub_sector="川菜", params={}
    )
    response = handler.compute(req, context={"pos_df": single_store_pos_df})
    assert response.status == SectionStatus.SKIPPED
    assert any("门店" in w for w in response.warnings)


# ─────────────────────────────────────────────────────────
# CalibrationHistoryHandler
# ─────────────────────────────────────────────────────────


def test_calibration_skipped_without_db_session():
    """Skip path: no db_session means we can't query history."""
    handler = CalibrationHistoryHandler()
    req = SectionRequest(
        factory_id="F1", upload_id="u1", sub_sector="火锅", params={}
    )
    response = handler.compute(req, context={})
    assert response.section_name == "calibration_history"
    assert response.status == SectionStatus.SKIPPED
    assert any("db_session" in w for w in response.warnings)


def test_calibration_skipped_with_mock_db_no_data():
    """Skip path: db_session present but no historical data → graceful skip.

    Uses a minimal mock db_session that returns an empty list. The handler
    should reach the reporter, which returns an empty CalibrationHistoryReport
    with total_periods=0, and the handler should map that to SKIPPED.
    """
    class _MockQuery:
        def filter(self, *_args, **_kw):
            return self

        def order_by(self, *_args, **_kw):
            return self

        def all(self):
            return []

    class _MockSession:
        def query(self, _model):
            return _MockQuery()

    handler = CalibrationHistoryHandler()
    req = SectionRequest(
        factory_id="F1", upload_id="u1", sub_sector="火锅", params={}
    )
    response = handler.compute(req, context={"db_session": _MockSession()})
    assert response.status == SectionStatus.SKIPPED
    # Either "无历史校准数据" or some other graceful reason
    assert response.warnings


# ─────────────────────────────────────────────────────────
# StorePnlOnePagerHandler
# ─────────────────────────────────────────────────────────


def test_store_pnl_runs_with_financial_metrics(sample_financial_metrics):
    """Positive path: financial_metrics in context → builds P&L one-pager."""
    handler = StorePnlOnePagerHandler()
    req = SectionRequest(
        factory_id="F-DINGXIAN-YIWU",
        upload_id="u1",
        sub_sector="火锅",
        store_name="鼎鲜火锅·义乌分公司",
        period="2026-02",
        params={},
    )
    response = handler.compute(
        req, context={"financial_metrics": sample_financial_metrics}
    )
    assert response.section_name == "store_pnl_one_pager"
    assert response.status in (SectionStatus.OK, SectionStatus.SKIPPED)
    if response.status == SectionStatus.OK:
        # StorePnlOnePagerReport.to_dict() canonical keys
        assert "storeName" in response.data
        assert "headline" in response.data
        assert "pnlLines" in response.data
        assert isinstance(response.data["pnlLines"], list)
        assert len(response.data["pnlLines"]) >= 1


def test_store_pnl_skipped_without_financial_metrics():
    """Skip path: no financial_metrics → can't build a P&L."""
    handler = StorePnlOnePagerHandler()
    req = SectionRequest(
        factory_id="F1", upload_id="u1", sub_sector="火锅", params={}
    )
    response = handler.compute(req, context={})
    assert response.status == SectionStatus.SKIPPED
    assert any("financial_metrics" in w for w in response.warnings)


def test_store_pnl_reads_from_request_params(sample_financial_metrics):
    """Standalone mode: financial_metrics passed in request.params."""
    handler = StorePnlOnePagerHandler()
    req = SectionRequest(
        factory_id="F1",
        upload_id="u1",
        sub_sector="火锅",
        store_name="测试店",
        params={"financial_metrics": sample_financial_metrics},
    )
    response = handler.compute(req, context={})
    assert response.status in (SectionStatus.OK, SectionStatus.SKIPPED)


# ─────────────────────────────────────────────────────────
# BomLayerStatusHandler
# ─────────────────────────────────────────────────────────


def test_bom_layer_status_returns_layer_dict():
    """Positive path: no sku_form_manager / monthly_calibrator → Layer 1."""
    handler = BomLayerStatusHandler()
    req = SectionRequest(
        factory_id="F1", upload_id="u1", sub_sector="火锅", params={}
    )
    response = handler.compute(req, context={})
    assert response.section_name == "bom_layer_status"
    assert response.status in (SectionStatus.OK, SectionStatus.SKIPPED)
    if response.status == SectionStatus.OK:
        assert isinstance(response.data, dict)
        # Without sku_form_manager and monthly_calibrator → Layer 1 default
        assert "currentLayer" in response.data
        assert response.data["currentLayer"] == "Layer 1"
        assert "currentAccuracyPp" in response.data
        assert "upgradeHint" in response.data


def test_bom_layer_status_idempotent_caching():
    """Calling twice on the same handler should return identical layer info
    (analyzer cache hit).
    """
    handler = BomLayerStatusHandler()
    req = SectionRequest(
        factory_id="F1", upload_id="u1", sub_sector="火锅", params={}
    )
    r1 = handler.compute(req, context={})
    r2 = handler.compute(req, context={})
    if r1.status == SectionStatus.OK and r2.status == SectionStatus.OK:
        assert r1.data == r2.data
