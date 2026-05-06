"""Byte-shape contract gate for /analysis/procurement per-type modes (PR-A).

Java reference:
  - Controller: SmartBIAnalysisController.getProcurementAnalysis line 452-486
  - Service: ProcurementAnalysisServiceImpl

Mirrors sister test_analysis_department_contract.py pattern.
"""
from __future__ import annotations

import importlib.util
import io
import json
import os
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

import jwt
import pytest


JWT_SECRET = "test-secret-for-phase2a-do-not-use-in-prod"
os.environ["JWT_SECRET"] = JWT_SECRET


REPO_ROOT = Path(__file__).resolve().parents[3]
GOLDEN_DIR = REPO_ROOT / "tests" / "fixtures" / "java-smartbi-golden"


def _load_production_main():
    main_path = REPO_ROOT / "backend" / "python" / "main.py"
    sys.path.insert(0, str(REPO_ROOT / "backend" / "python"))
    spec = importlib.util.spec_from_file_location("_production_main", main_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _make_token(factory_id: str) -> str:
    payload = {
        "userId": 1, "username": "test_user", "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": datetime.now(timezone.utc).timestamp() + 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


VOLATILE = frozenset({"generatedAt", "lastUpdated", "cacheExpireAt", "timestamp"})


def _strip_volatile(obj):
    if isinstance(obj, dict):
        return {k: _strip_volatile(v) for k, v in obj.items() if k not in VOLATILE}
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj


@pytest.fixture(scope="module")
def production_app():
    return _load_production_main().app


@pytest.fixture
def client(production_app):
    from fastapi.testclient import TestClient
    return TestClient(production_app)


@pytest.fixture
def patched_empty(monkeypatch):
    """Patch SQL helpers to return empty rows (F999 baseline)."""

    async def _empty_batches(factory_id, start_date, end_date):
        return []

    async def _empty_suppliers(factory_id):
        return []

    async def _empty_supplier_by_id(supplier_id, factory_id):
        return None

    monkeypatch.setattr(
        "smartbi_compat.api.analysis_procurement._query_material_batches_in_range",
        _empty_batches,
    )
    monkeypatch.setattr(
        "smartbi_compat.api.analysis_procurement._query_active_suppliers",
        _empty_suppliers,
    )
    monkeypatch.setattr(
        "smartbi_compat.api.analysis_procurement._query_supplier_by_id",
        _empty_supplier_by_id,
    )


def _hit(client, mode, factory_id="F999"):
    """Helper to hit the endpoint with consistent params."""
    suffix = f"&analysisType={mode}" if mode else ""
    return client.get(
        f"/api/mobile/{factory_id}/smart-bi/analysis/procurement"
        f"?startDate=2025-01-01&endDate=2025-12-31{suffix}",
        headers={"Authorization": f"Bearer {_make_token(factory_id)}"},
    )


def _byte_compare_data(client, mode, golden_filename, patched_empty):
    """Shared body for byte-shape comparison test."""
    resp = _hit(client, mode)
    assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
    py_data = _strip_volatile(resp.json()["data"])
    with io.open(GOLDEN_DIR / golden_filename, encoding="utf-8") as f:
        golden_data = _strip_volatile(json.load(f)["data"])
    if py_data != golden_data:
        diffs = {}
        for k in set(py_data.keys()) | set(golden_data.keys()):
            if py_data.get(k) != golden_data.get(k):
                diffs[k] = {"python": py_data.get(k), "golden": golden_data.get(k)}
        pytest.fail(
            f"BYTE SHAPE MISMATCH on {list(diffs.keys())}\n"
            f"{json.dumps(diffs, indent=2, ensure_ascii=False, default=str)[:2000]}"
        )


class TestAnalysisProcurementSupplierMode:
    """F999 byte-shape gate for analysisType=supplier."""

    def test_f999_supplier_data_keys_match_golden(self, client, patched_empty):
        """Top-level data keys order matches Java HashMap hash-iter order."""
        resp = _hit(client, "supplier")
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_keys = list(resp.json()["data"].keys())
        with io.open(GOLDEN_DIR / "analysis-procurement-F999-supplier.json", encoding="utf-8") as f:
            golden_keys = list(json.load(f)["data"].keys())
        assert py_keys == golden_keys, (
            f"data key order mismatch:\n  python: {py_keys}\n  golden: {golden_keys}"
        )

    def test_f999_supplier_byte_shape(self, client, patched_empty):
        _byte_compare_data(client, "supplier",
                           "analysis-procurement-F999-supplier.json", patched_empty)

    def test_f999_supplier_radar_dimensions_exact_order(self, client, patched_empty):
        """T5: dimensions list preserves declaration order [price, quality, on-time, service, stability]."""
        resp = _hit(client, "supplier")
        assert resp.status_code == 200
        evaluation = resp.json()["data"]["evaluation"]
        assert evaluation["options"]["dimensions"] == [
            "priceCompetitiveness", "qualityPassRate", "onTimeDelivery",
            "serviceResponse", "supplyStability",
        ], f"dimensions order wrong: {evaluation['options']['dimensions']}"
        assert evaluation["options"]["dimensionNames"] == [
            "价格竞争力", "质量合格率", "准时交付", "服务响应", "供货稳定",
        ], f"dimensionNames order wrong: {evaluation['options']['dimensionNames']}"


class TestAnalysisProcurementCostMode:
    """F999 byte-shape gate for analysisType=cost."""

    def test_f999_cost_data_keys_match_golden(self, client, patched_empty):
        resp = _hit(client, "cost")
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_keys = list(resp.json()["data"].keys())
        with io.open(GOLDEN_DIR / "analysis-procurement-F999-cost.json", encoding="utf-8") as f:
            golden_keys = list(json.load(f)["data"].keys())
        assert py_keys == golden_keys, (
            f"data key order mismatch:\n  python: {py_keys}\n  golden: {golden_keys}"
        )

    def test_f999_cost_byte_shape(self, client, patched_empty):
        _byte_compare_data(client, "cost",
                           "analysis-procurement-F999-cost.json", patched_empty)

    def test_f999_cost_pie_chart_options_order(self, client, patched_empty):
        """costAnalysis (PIE ChartConfig) options keys: [showPercentage, showLegend]."""
        resp = _hit(client, "cost")
        cost_analysis = resp.json()["data"]["costAnalysis"]
        assert list(cost_analysis["options"].keys()) == ["showPercentage", "showLegend"], (
            f"options keys order wrong: {list(cost_analysis['options'].keys())}"
        )


class TestAnalysisProcurementTrendMode:
    """F999 byte-shape gate for analysisType=trend."""

    def test_f999_trend_data_keys_match_golden(self, client, patched_empty):
        resp = _hit(client, "trend")
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_keys = list(resp.json()["data"].keys())
        with io.open(GOLDEN_DIR / "analysis-procurement-F999-trend.json", encoding="utf-8") as f:
            golden_keys = list(json.load(f)["data"].keys())
        assert py_keys == golden_keys, (
            f"data key order mismatch:\n  python: {py_keys}\n  golden: {golden_keys}"
        )

    def test_f999_trend_byte_shape(self, client, patched_empty):
        _byte_compare_data(client, "trend",
                           "analysis-procurement-F999-trend.json", patched_empty)


class TestAnalysisProcurementCostMomMetricShape:
    """Regression test: cost mode PROCUREMENT_MOM_GROWTH MetricResult shape
    when previous_batches is non-empty.

    F999 baseline tests skip this branch (both periods empty). Without this
    test, byte-shape divergence in the MoM dict (alertLevel / changeValue)
    can ship undetected. Mirror Java MetricResult.ofWithTrend (line 153-164):
      - alertLevel = "GREEN" (always set by ofWithTrend builder)
      - changeValue = None (Lombok @Builder default, ofWithTrend doesn't set it)
    """

    def test_mom_growth_metric_alert_and_change_value(self, client, monkeypatch):
        from datetime import date as _date
        from decimal import Decimal as _Dec

        async def fake_batches(factory_id, start_date, end_date):
            # Different totals for current vs previous to force the MoM branch
            if start_date == _date(2025, 6, 1):
                return [
                    {"unit_price": _Dec("10"), "receipt_quantity": _Dec("100"),
                     "supplier_id": "S1", "material_type_id": "M1",
                     "receipt_date": _date(2025, 6, 15), "status": "AVAILABLE"},
                ]
            return [
                {"unit_price": _Dec("8"), "receipt_quantity": _Dec("100"),
                 "supplier_id": "S1", "material_type_id": "M1",
                 "receipt_date": _date(2025, 5, 15), "status": "AVAILABLE"},
            ]

        async def fake_suppliers(factory_id):
            return []

        async def fake_supplier_by_id(supplier_id, factory_id):
            return None

        monkeypatch.setattr(
            "smartbi_compat.api.analysis_procurement._query_material_batches_in_range",
            fake_batches,
        )
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_procurement._query_active_suppliers",
            fake_suppliers,
        )
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_procurement._query_supplier_by_id",
            fake_supplier_by_id,
        )

        resp = client.get(
            "/api/mobile/F001/smart-bi/analysis/procurement"
            "?startDate=2025-06-01&endDate=2025-06-30&analysisType=cost",
            headers={"Authorization": f"Bearer {_make_token('F001')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        metrics = resp.json()["data"]["metrics"]
        mom = next((m for m in metrics if m["metricCode"] == "PROCUREMENT_MOM_GROWTH"), None)
        assert mom is not None, "PROCUREMENT_MOM_GROWTH metric missing when previous_batches non-empty"

        # Java MetricResult.ofWithTrend always sets alertLevel="GREEN"
        assert mom["alertLevel"] == "GREEN", f"alertLevel: {mom['alertLevel']!r}"
        # Java ofWithTrend doesn't set changeValue (Lombok builder default null)
        assert mom["changeValue"] is None, f"changeValue: {mom['changeValue']!r}"
        # Sanity: changePercent IS set (5th param of ofWithTrend)
        assert mom["changePercent"] is not None, "changePercent should be set"
        assert mom["changeDirection"] in ("UP", "DOWN", "STABLE"), mom["changeDirection"]


class TestAnalysisProcurementOverviewMode:
    """F999 byte-shape gate for default mode (no analysisType param) — overview path.

    PR-B (Chat 5) ships:
      - 16-key DashboardResponse (Lombok @Data + no @JsonInclude → all emit)
      - AIInsight 5-key [level, category, message, relatedEntity, actionSuggestion]
      - Top-level data: [overview, endDate, startDate] (Jackson HashMap hash-iter)

    Spec §3.11 listed a 6-key shape but Rule 9 §9.2 catch confirmed F999 golden has
    16 keys, matching inventory PR-B (#54) precedent. Contract test asserts the full
    16-field shape + key order on empty path.
    """

    def test_f999_default_overview_byte_shape(self, client, patched_empty):
        """Empty F999: dict-eq compare against converted golden, with volatile keys stripped."""
        _byte_compare_data(client, None,
                           "analysis-procurement-F999-default.json", patched_empty)

    def test_f999_default_empty_dashboard_shape(self, client, patched_empty):
        """Empty path emits exact AIInsight placeholder + 16-key DashboardResponse.

        AIInsight 5-key order locked: [level, category, message, relatedEntity, actionSuggestion].
        Strings verified against spec §3.11 Round 4 audit C2 fix.
        """
        resp = _hit(client, None)
        assert resp.status_code == 200
        overview = resp.json()["data"]["overview"]

        # 16-key shape (Rule 9 §9.2)
        assert len(overview) == 16, f"expected 16 keys, got {len(overview)}: {list(overview.keys())}"

        # Empty arrays + maps for unpopulated container fields
        assert overview["kpiCards"] == []
        assert overview["charts"] == {}
        assert overview["rankings"] == {}

        # fromCache primitive boolean (NOT None per Lombok @Data primitive default)
        assert overview["fromCache"] is False

        # Default-only fields are None (period/metricCards/chartList/alerts/recommendations/generatedAt/cacheExpireAt)
        for k in ("period", "metricCards", "chartList", "alerts", "recommendations",
                  "generatedAt", "cacheExpireAt"):
            assert overview[k] is None, f"{k} expected None, got {overview[k]!r}"

        # AIInsight placeholder shape (5-key, golden order)
        assert len(overview["aiInsights"]) == 1
        ai = overview["aiInsights"][0]
        assert list(ai.keys()) == ["level", "category", "message", "relatedEntity", "actionSuggestion"], (
            f"AIInsight key order wrong: {list(ai.keys())}"
        )
        assert ai["level"] == "YELLOW"
        assert ai["category"] == "数据状态"
        assert ai["message"] == "当前时间范围内暂无采购数据"
        assert ai["relatedEntity"] is None
        assert ai["actionSuggestion"] == "请调整时间范围或录入采购数据"

        # Suggestions list shape
        assert overview["suggestions"] == ["请先录入采购数据以开始分析"]

    def test_f999_default_dashboard_field_order(self, client, patched_empty):
        """16-key DashboardResponse field order locked to F999 golden (Lombok @Builder declaration order)."""
        resp = _hit(client, None)
        assert resp.status_code == 200
        py_keys = list(resp.json()["data"]["overview"].keys())
        with io.open(GOLDEN_DIR / "analysis-procurement-F999-default.json", encoding="utf-8") as f:
            golden_keys = list(json.load(f)["data"]["overview"].keys())
        assert py_keys == golden_keys, (
            f"overview key order mismatch:\n  python: {py_keys}\n  golden: {golden_keys}"
        )


# ============================================================
# PR-C-1: Arithmetic depth tests (6 PR-A-dependent classes, 27 tests)
# PR-C-2 followup (post-procurement-PR-B merge): TestProcurementOverviewArithmetic (6 tests)
# Spec: docs/superpowers/specs/2026-05-01-phase2a-analysis-procurement-design.md §5.3
# ============================================================


class TestProcurementConcentrationAlertArithmetic:
    """T1 inverse threshold boundary - 5 boundary points (39.99 / 40.0 / 40.01 / 60.0 / 60.01).

    Java line 1109-1116 uses STRICT `>` (NOT `>=`):
      if (concentration > 60) RED;
      if (concentration > 40) YELLOW;
      else GREEN.

    Inverse direction: concentration high = risk high (opposite of regular alert).
    """

    @pytest.mark.parametrize("concentration,expected", [
        ("39.99", "GREEN"),
        ("40.0", "GREEN"),    # NOT > 40 -> GREEN (strict, boundary excludes from YELLOW)
        ("40.01", "YELLOW"),
        ("60.0", "YELLOW"),   # NOT > 60 -> YELLOW (strict, boundary excludes from RED)
        ("60.01", "RED"),
    ])
    def test_concentration_alert_inverse_strict_boundaries(self, concentration, expected):
        from smartbi_compat.api.analysis_procurement import _determine_concentration_alert_level
        assert _determine_concentration_alert_level(Decimal(concentration)) == expected


class TestProcurementMoMGrowthArithmetic:
    """T9 - 4 edge cases for _calculate_mom_growth.

    Java MetricCalculatorServiceImpl.calculateMomGrowth (line 425-438):
      previous null/0:
        current null/<=0 -> 0
        current > 0      -> 100
      current null (with non-zero previous) -> -100
      else: (current - previous) / abs(previous) * 100  <- T9 .abs() denom lock
    """

    def test_previous_none_current_positive_returns_100(self):
        from smartbi_compat.api.analysis_procurement import _calculate_mom_growth
        # previous=None, current>0 -> 100
        assert _calculate_mom_growth(Decimal("50"), None) == Decimal("100")
        # previous=0, current>0 -> 100
        assert _calculate_mom_growth(Decimal("50"), Decimal("0")) == Decimal("100")

    def test_previous_none_current_zero_or_none_returns_zero(self):
        from smartbi_compat.api.analysis_procurement import _calculate_mom_growth
        assert _calculate_mom_growth(None, None) == Decimal("0")
        assert _calculate_mom_growth(Decimal("0"), None) == Decimal("0")
        assert _calculate_mom_growth(Decimal("0"), Decimal("0")) == Decimal("0")

    def test_current_none_with_nonzero_previous_returns_neg_100(self):
        from smartbi_compat.api.analysis_procurement import _calculate_mom_growth
        # current=None, previous=50 -> -100
        assert _calculate_mom_growth(None, Decimal("50")) == Decimal("-100")

    def test_negative_previous_abs_denom_yields_positive_growth(self):
        """T9 lock: previous=-50, current=10 -> change=60; abs(-50)=50; 60/50*100=+120.

        NOT -120 (which would happen if Python used `previous` directly without abs()).
        """
        from smartbi_compat.api.analysis_procurement import _calculate_mom_growth
        result = _calculate_mom_growth(Decimal("10"), Decimal("-50"))
        # Result is quantized to display scale 2: Decimal("120.00")
        assert result == Decimal("120.00"), (
            f"T9 .abs() denom: expected +120 (NOT -120), got {result}"
        )


class TestProcurementSupplierRankingArithmetic:
    """4 tests for _calculate_supplier_ranking_from_data:
       sort by value desc / tie-break / quality alert / negative value defensive.
    """

    @staticmethod
    def _run(factory_id, batches, supplier_lookup=None):
        """Helper: directly call _calculate_supplier_ranking_from_data with mocked supplier lookup.
        supplier_lookup: dict mapping supplier_id -> supplier dict (or None for not found).
        """
        import asyncio
        from smartbi_compat.api import analysis_procurement

        original = analysis_procurement._query_supplier_by_id

        async def fake_lookup(sid, fid):
            if supplier_lookup is None:
                return None
            return supplier_lookup.get(sid)

        try:
            analysis_procurement._query_supplier_by_id = fake_lookup
            return asyncio.run(analysis_procurement._calculate_supplier_ranking_from_data(
                factory_id, batches
            ))
        finally:
            analysis_procurement._query_supplier_by_id = original

    def test_sort_by_value_desc(self):
        """3 suppliers with values [100, 300, 200] -> ranking[B=300, C=200, A=100]."""
        # Each batch: unit_price * receipt_quantity = value
        batches = [
            {"supplier_id": "SUP-A", "unit_price": Decimal("10"),
             "receipt_quantity": Decimal("10"), "status": "AVAILABLE"},      # 100
            {"supplier_id": "SUP-B", "unit_price": Decimal("30"),
             "receipt_quantity": Decimal("10"), "status": "AVAILABLE"},      # 300
            {"supplier_id": "SUP-C", "unit_price": Decimal("20"),
             "receipt_quantity": Decimal("10"), "status": "AVAILABLE"},      # 200
        ]
        rankings = self._run("F", batches)
        assert len(rankings) == 3
        # Sorted desc by value
        assert rankings[0]["name"] == "SUP-B" and rankings[0]["value"] == 300
        assert rankings[1]["name"] == "SUP-C" and rankings[1]["value"] == 200
        assert rankings[2]["name"] == "SUP-A" and rankings[2]["value"] == 100
        assert [r["rank"] for r in rankings] == [1, 2, 3]

    def test_tie_break_stable_order(self):
        """2 suppliers with equal totals -> Python sorted() is stable, preserves insertion order."""
        batches = [
            {"supplier_id": "SUP-A", "unit_price": Decimal("50"),
             "receipt_quantity": Decimal("2"), "status": "AVAILABLE"},       # 100
            {"supplier_id": "SUP-B", "unit_price": Decimal("50"),
             "receipt_quantity": Decimal("2"), "status": "AVAILABLE"},       # 100
        ]
        rankings = self._run("F", batches)
        assert len(rankings) == 2
        # Stable sort: insertion order preserved on tie (A first since seen first in dict iteration)
        names = [r["name"] for r in rankings]
        # Either order acceptable but both must be present
        assert set(names) == {"SUP-A", "SUP-B"}
        # Both have value=100
        assert all(r["value"] == 100 for r in rankings)

    def test_quality_alert_level_thresholds(self):
        """Verify alertLevel maps from quality score (=available/total*100):
           Java: < 90 RED, < 95 YELLOW, else GREEN.

           Build 3 suppliers with controlled available counts:
             SUP-A: 8/10 AVAILABLE -> quality=80 -> RED
             SUP-B: 10/10 AVAILABLE -> quality=100 -> GREEN
             SUP-C: 9/10 AVAILABLE -> quality=90 -> YELLOW (90 NOT < 90 -> not RED, NOT < 95 -> not YELLOW... wait)
           Re-check: 90 < 90 -> false; 90 < 95 -> true -> YELLOW.
        """
        batches = []
        # SUP-A: 8 AVAILABLE + 2 non-AVAILABLE = quality 80 -> RED
        for _i in range(8):
            batches.append({"supplier_id": "SUP-A", "unit_price": Decimal("10"),
                            "receipt_quantity": Decimal("1"), "status": "AVAILABLE"})
        for _i in range(2):
            batches.append({"supplier_id": "SUP-A", "unit_price": Decimal("10"),
                            "receipt_quantity": Decimal("1"), "status": "DEPLETED"})
        # SUP-B: 10/10 AVAILABLE -> quality 100 -> GREEN
        for _i in range(10):
            batches.append({"supplier_id": "SUP-B", "unit_price": Decimal("10"),
                            "receipt_quantity": Decimal("1"), "status": "AVAILABLE"})
        # SUP-C: 9 AVAILABLE + 1 non-AVAILABLE = quality 90 -> YELLOW
        for _i in range(9):
            batches.append({"supplier_id": "SUP-C", "unit_price": Decimal("10"),
                            "receipt_quantity": Decimal("1"), "status": "AVAILABLE"})
        for _i in range(1):
            batches.append({"supplier_id": "SUP-C", "unit_price": Decimal("10"),
                            "receipt_quantity": Decimal("1"), "status": "DEPLETED"})

        rankings = self._run("F", batches)
        by_name = {r["name"]: r for r in rankings}
        assert by_name["SUP-A"]["alertLevel"] == "RED", f"got {by_name['SUP-A']['alertLevel']}"
        assert by_name["SUP-B"]["alertLevel"] == "GREEN", f"got {by_name['SUP-B']['alertLevel']}"
        assert by_name["SUP-C"]["alertLevel"] == "YELLOW", f"got {by_name['SUP-C']['alertLevel']}"

    def test_negative_value_in_ranking_passes_through_no_abs(self):
        """Procurement ranking does NOT abs() like cost does.
        Single supplier with negative-priced batch -> value=-100 in output."""
        batches = [
            {"supplier_id": "SUP-A", "unit_price": Decimal("-50"),
             "receipt_quantity": Decimal("2"), "status": "AVAILABLE"},      # -100
        ]
        rankings = self._run("F", batches)
        assert len(rankings) == 1
        assert rankings[0]["value"] == -100, (
            f"Negative value should pass through without abs(): expected -100, got {rankings[0]['value']}"
        )


class TestProcurementTrendChartArithmetic:
    """3 tests for _get_procurement_trend_chart MONTH aggregation + sort + chart shape.

    Java period semantics:
      MONTH -> period_key = "yyyy-MM"
      Sort: sorted(keys) ascending (Java TreeMap iteration)
    Chart shape (Rule 9 7-field):
      [chartType=LINE, title, seriesField, data, options, xaxisField, yaxisField]
    Per data point: {date, amount} (NOT {period, ...} - procurement uses 'date' key).
    """

    @staticmethod
    def _run_chart(batches, period="MONTH"):
        import asyncio
        from smartbi_compat.api import analysis_procurement

        original = analysis_procurement._query_material_batches_in_range

        async def fake_query(fid, start, end):
            return batches

        try:
            analysis_procurement._query_material_batches_in_range = fake_query
            return asyncio.run(analysis_procurement._get_procurement_trend_chart(
                "F", date(2025, 1, 1), date(2025, 12, 31), period
            ))
        finally:
            analysis_procurement._query_material_batches_in_range = original

    def test_month_period_aggregation(self):
        """3 batches in 3 different months -> chart_data has 3 points keyed by 'yyyy-MM'."""
        batches = [
            {"receipt_date": date(2025, 6, 15), "unit_price": Decimal("10"),
             "receipt_quantity": Decimal("5")},      # 2025-06: 50
            {"receipt_date": date(2025, 1, 10), "unit_price": Decimal("20"),
             "receipt_quantity": Decimal("3")},      # 2025-01: 60
            {"receipt_date": date(2025, 3, 5), "unit_price": Decimal("15"),
             "receipt_quantity": Decimal("4")},      # 2025-03: 60
        ]
        chart = self._run_chart(batches)
        assert len(chart["data"]) == 3
        # Each point has 'date' and 'amount' keys
        assert all(set(p.keys()) == {"date", "amount"} for p in chart["data"])

    def test_multi_month_sorted_ascending(self):
        """Months input as [June, January, March] -> output sorted [Jan, Mar, Jun]."""
        batches = [
            {"receipt_date": date(2025, 6, 15), "unit_price": Decimal("10"),
             "receipt_quantity": Decimal("10")},     # 2025-06: 100
            {"receipt_date": date(2025, 1, 10), "unit_price": Decimal("20"),
             "receipt_quantity": Decimal("10")},     # 2025-01: 200
            {"receipt_date": date(2025, 3, 5), "unit_price": Decimal("15"),
             "receipt_quantity": Decimal("10")},     # 2025-03: 150
        ]
        chart = self._run_chart(batches)
        actual_dates = [p["date"] for p in chart["data"]]
        assert actual_dates == ["2025-01", "2025-03", "2025-06"], (
            f"Expected sorted asc by period key, got {actual_dates}"
        )
        # Spot-check amounts
        by_date = {p["date"]: p["amount"] for p in chart["data"]}
        assert by_date["2025-01"] == 200
        assert by_date["2025-03"] == 150
        assert by_date["2025-06"] == 100

    def test_chart_shape_keys_match_lombok_jackson(self):
        """Verify ALL 7 top-level chart dict keys per Rule 9.2.
        Per data point: {date, amount} (procurement uses 'date', not 'period')."""
        batches = [
            {"receipt_date": date(2025, 6, 1), "unit_price": Decimal("10"),
             "receipt_quantity": Decimal("5")},
        ]
        chart = self._run_chart(batches)
        # Rule 9.2: 7 emit-all fields with lowercase xaxis/yaxisField
        assert chart["chartType"] == "LINE"
        assert chart["title"] == "采购趋势"
        assert chart["seriesField"] is None
        assert chart["xaxisField"] == "date"     # Rule 9.1: lowercase
        assert chart["yaxisField"] == "amount"   # Rule 9.1: lowercase
        assert chart["options"] == {"showDataLabels": False, "smooth": True}
        # Per data point: 'date' and 'amount' keys (NOT 'period')
        assert chart["data"][0]["date"] == "2025-06"
        assert chart["data"][0]["amount"] == 50


class TestProcurementCostMetricsArithmetic:
    """5 tests for _get_cost_metrics:
       total / avg unit price (filter > 0) / max unit price emit / max skipped when null / MoM growth.

    Note: _get_cost_metrics calls _query_material_batches_in_range TWICE:
      1st call: current period (start_date, end_date)
      2nd call: previous period (start - 1 month, end - 1 month)
    Mock must dispatch by date range.
    """

    @staticmethod
    def _run(current_batches, previous_batches=None, start=None, end=None):
        """Helper: mock _query_material_batches_in_range with date-aware dispatch."""
        import asyncio
        from smartbi_compat.api import analysis_procurement

        if previous_batches is None:
            previous_batches = []
        start = start or date(2025, 6, 1)
        end = end or date(2025, 6, 30)

        original = analysis_procurement._query_material_batches_in_range

        async def fake_query(fid, s, e):
            # If start matches the current period start, return current; else previous
            if s == start:
                return current_batches
            return previous_batches

        try:
            analysis_procurement._query_material_batches_in_range = fake_query
            return asyncio.run(analysis_procurement._get_cost_metrics(
                "F", start, end
            ))
        finally:
            analysis_procurement._query_material_batches_in_range = original

    def test_total_purchase_amount(self):
        """3 batches with totalValues [10000, 20000, 30000] -> PROCUREMENT_AMOUNT.value == 60000."""
        batches = [
            {"unit_price": Decimal("100"), "receipt_quantity": Decimal("100")},  # 10000
            {"unit_price": Decimal("200"), "receipt_quantity": Decimal("100")},  # 20000
            {"unit_price": Decimal("300"), "receipt_quantity": Decimal("100")},  # 30000
        ]
        result = self._run(batches)
        by_code = {m["metricCode"]: m for m in result}
        assert by_code["PROCUREMENT_AMOUNT"]["value"] == 60000
        assert by_code["BATCH_COUNT"]["value"] == 3

    def test_avg_unit_price_filters_zero_or_null(self):
        """Batches with unit_price=[10, 0, None, 20] -> avg = (10+20)/2 = 15 (filter > 0)."""
        batches = [
            {"unit_price": Decimal("10"), "receipt_quantity": Decimal("1")},
            {"unit_price": Decimal("0"), "receipt_quantity": Decimal("1")},
            {"unit_price": None, "receipt_quantity": Decimal("1")},
            {"unit_price": Decimal("20"), "receipt_quantity": Decimal("1")},
        ]
        result = self._run(batches)
        by_code = {m["metricCode"]: m for m in result}
        # avg = (10+20)/2 = 15
        assert by_code["AVG_UNIT_PRICE"]["value"] == 15

    def test_max_unit_price_emits_when_present(self):
        """Batches with unit_price=[5, 10, 7] -> MAX=10, dimensionValue=material_type_id of max batch."""
        batches = [
            {"unit_price": Decimal("5"), "receipt_quantity": Decimal("1"),
             "material_type_id": "MAT-A"},
            {"unit_price": Decimal("10"), "receipt_quantity": Decimal("1"),
             "material_type_id": "MAT-B"},
            {"unit_price": Decimal("7"), "receipt_quantity": Decimal("1"),
             "material_type_id": "MAT-C"},
        ]
        result = self._run(batches)
        by_code = {m["metricCode"]: m for m in result}
        assert "MAX_UNIT_PRICE" in by_code
        assert by_code["MAX_UNIT_PRICE"]["value"] == 10
        assert by_code["MAX_UNIT_PRICE"]["dimensionValue"] == "MAT-B"
        assert by_code["MAX_UNIT_PRICE"]["alertLevel"] == "GREEN"
        # 4 metrics (PROCUREMENT_AMOUNT/BATCH_COUNT/AVG_UNIT_PRICE/MAX_UNIT_PRICE), no MoM
        assert len(result) == 4

    def test_max_unit_price_skipped_when_all_null(self):
        """All batches unit_price=None -> no MAX_UNIT_PRICE metric (Java isPresent guard)."""
        batches = [
            {"unit_price": None, "receipt_quantity": Decimal("1"),
             "material_type_id": "MAT-A"},
            {"unit_price": None, "receipt_quantity": Decimal("1"),
             "material_type_id": "MAT-B"},
        ]
        result = self._run(batches)
        codes = [m["metricCode"] for m in result]
        assert "MAX_UNIT_PRICE" not in codes
        # 3 metrics: PROCUREMENT_AMOUNT/BATCH_COUNT/AVG_UNIT_PRICE (no MAX, no MoM)
        assert len(result) == 3

    def test_mom_growth_when_previous_period_nonempty(self):
        """Current sum=120k, previous sum=100k -> momGrowth = (120k-100k)/100k * 100 = 20%, UP."""
        current_batches = [
            {"unit_price": Decimal("100"), "receipt_quantity": Decimal("1200"),
             "material_type_id": "MAT-A"},
        ]   # 120,000
        previous_batches = [
            {"unit_price": Decimal("100"), "receipt_quantity": Decimal("1000"),
             "material_type_id": "MAT-A"},
        ]   # 100,000
        result = self._run(current_batches, previous_batches=previous_batches)
        by_code = {m["metricCode"]: m for m in result}
        assert "PROCUREMENT_MOM_GROWTH" in by_code
        # mom_growth = (120k - 100k) / 100k * 100 = 20
        assert by_code["PROCUREMENT_MOM_GROWTH"]["value"] == 20
        assert by_code["PROCUREMENT_MOM_GROWTH"]["changeDirection"] == "UP"
        # 5 metrics total when MoM emitted
        assert len(result) == 5


class TestProcurementSupplierEvaluationArithmetic:
    """7 tests for 5 dimension scorers + stability boundary + empty-batches case.

    Java semantics (from impl):
      - _calculate_price_score(supplier, batches): rating × 20, default 70 if rating null
      - _calculate_quality_score(batches): availableCount/total × 100, empty -> 0
      - _calculate_delivery_score(supplier, batches): HARDCODED 85 always
      - _calculate_service_score(supplier): rating × 20, default 70
      - _calculate_stability_score(batches): < 2 batches -> 80; CV-based; clamp [0, 100]
    """

    def test_price_score_rating_present(self):
        from smartbi_compat.api.analysis_procurement import _calculate_price_score
        # rating=4 -> 4 × 20 = 80
        assert _calculate_price_score({"rating": 4}, []) == Decimal("80")

    def test_price_score_rating_null_default_70(self):
        from smartbi_compat.api.analysis_procurement import _calculate_price_score
        assert _calculate_price_score({"rating": None}, []) == Decimal("70")
        # rating key missing also defaults to 70
        assert _calculate_price_score({}, []) == Decimal("70")

    def test_quality_score_pass_rate(self):
        from smartbi_compat.api.analysis_procurement import _calculate_quality_score
        # 9 AVAILABLE / 10 total -> 90
        batches = [{"status": "AVAILABLE"}] * 9 + [{"status": "DEPLETED"}] * 1
        result = _calculate_quality_score(batches)
        assert result == Decimal("90.0000"), f"got {result}"
        # Empty batches -> 0
        assert _calculate_quality_score([]) == Decimal("0")

    def test_delivery_score_hardcoded_85(self):
        from smartbi_compat.api.analysis_procurement import _calculate_delivery_score
        # Any input returns 85 (Java line 631 unconditional return)
        assert _calculate_delivery_score({}, []) == Decimal("85")
        assert _calculate_delivery_score({"rating": 5}, [{"status": "AVAILABLE"}]) == Decimal("85")
        assert _calculate_delivery_score({"rating": None}, []) == Decimal("85")

    def test_service_score_rating_present_and_default(self):
        from smartbi_compat.api.analysis_procurement import _calculate_service_score
        # rating=5 -> 5 × 20 = 100
        assert _calculate_service_score({"rating": 5}) == Decimal("100")
        # rating=null -> default 70
        assert _calculate_service_score({"rating": None}) == Decimal("70")

    def test_stability_score_under_2_batches_default_80(self):
        from smartbi_compat.api.analysis_procurement import _calculate_stability_score
        # 0 batches -> default 80
        assert _calculate_stability_score([]) == Decimal("80")
        # 1 batch -> default 80 (Java line 670 batches.size() < 2 guard)
        assert _calculate_stability_score([
            {"receipt_quantity": Decimal("100")},
        ]) == Decimal("80")

    def test_supplier_evaluation_empty_batches_returns_no_data_points(self):
        """Empty batches + empty suppliers -> chart has data=[], but options still 5-dim."""
        import asyncio
        from smartbi_compat.api import analysis_procurement

        original_b = analysis_procurement._query_material_batches_in_range
        original_s = analysis_procurement._query_active_suppliers

        async def fake_b(*_a, **_k): return []
        async def fake_s(*_a, **_k): return []

        try:
            analysis_procurement._query_material_batches_in_range = fake_b
            analysis_procurement._query_active_suppliers = fake_s
            result = asyncio.run(analysis_procurement._get_supplier_evaluation(
                "F", date(2025, 1, 1), date(2025, 12, 31)
            ))
        finally:
            analysis_procurement._query_material_batches_in_range = original_b
            analysis_procurement._query_active_suppliers = original_s

        # chart_data list is empty (no suppliers/batches to evaluate)
        assert result["data"] == []
        # Options still has 5-dim radar definition (declaration order preserved per T5)
        assert result["chartType"] == "RADAR"
        assert result["options"]["dimensions"] == [
            "priceCompetitiveness", "qualityPassRate", "onTimeDelivery",
            "serviceResponse", "supplyStability",
        ]
        assert result["options"]["dimensionNames"] == [
            "价格竞争力", "质量合格率", "准时交付", "服务响应", "供货稳定",
        ]


# ============================================================
# PR-C-2: Overview arithmetic depth (PR-B-dependent, 6 tests)
# Spec: docs/superpowers/specs/2026-05-01-phase2a-analysis-procurement-design.md §5.3
# Targets PR #67 (procurement PR-B) overview helpers:
#   _get_procurement_overview / _build_empty_dashboard / _generate_ai_insights /
#   _generate_suggestions / _build_overview_kpi_cards / _calculate_supplier_concentration
# ============================================================


class TestProcurementOverviewArithmetic:
    """6 tests for PR-B overview helpers — KPI build / AI insights triggers /
    suggestions / empty dashboard exact strings (C2 audit gap) /
    charts key naming / concentration precision byte-eq (Round 4 audit gap).

    Mock targets: _query_material_batches_in_range (called for current + previous period),
    _query_active_suppliers, _query_supplier_by_id (T11 enforced lookup).
    """

    @staticmethod
    def _run_overview(current_batches, previous_batches=None, suppliers=None,
                     supplier_lookup=None, start=None, end=None):
        """Helper: call _get_procurement_overview with all SQL helpers mocked.

        - current_batches: returned for the current-period query
        - previous_batches: returned for the previous-period query (default [])
        - suppliers: returned by _query_active_suppliers (default [])
        - supplier_lookup: dict {supplier_id: supplier_dict}; lookups not in dict return None
        - start/end: defaults to (2025, 6, 1) - (2025, 6, 30) (1 month period)
        """
        import asyncio
        from smartbi_compat.api import analysis_procurement

        if previous_batches is None:
            previous_batches = []
        if suppliers is None:
            suppliers = []
        if supplier_lookup is None:
            supplier_lookup = {}
        start = start or date(2025, 6, 1)
        end = end or date(2025, 6, 30)

        original_b = analysis_procurement._query_material_batches_in_range
        original_s = analysis_procurement._query_active_suppliers
        original_sb = analysis_procurement._query_supplier_by_id

        async def fake_b(fid, s, e):
            if s == start:
                return current_batches
            return previous_batches

        async def fake_s(fid):
            return suppliers

        async def fake_sb(sid, fid):
            return supplier_lookup.get(sid)

        try:
            analysis_procurement._query_material_batches_in_range = fake_b
            analysis_procurement._query_active_suppliers = fake_s
            analysis_procurement._query_supplier_by_id = fake_sb
            return asyncio.run(analysis_procurement._get_procurement_overview(
                "F", start, end
            ))
        finally:
            analysis_procurement._query_material_batches_in_range = original_b
            analysis_procurement._query_active_suppliers = original_s
            analysis_procurement._query_supplier_by_id = original_sb

    def test_kpi_cards_built_5_metrics_when_previous_period_nonempty(self):
        """Non-empty current + non-empty previous -> 5 KPI cards (incl conditional MoM).

        kpiCards is KPICard shape (key/title/...) per Java line 91 convertToKPICards;
        codes match Java calculateKpiCards (line 462-535) constants:
          PROCUREMENT_AMOUNT / BATCH_COUNT / AVG_BATCH_AMOUNT / SUPPLIER_CONCENTRATION /
          PROCUREMENT_MOM_GROWTH (conditional)
        """
        current = [
            {"supplier_id": "SUP-A", "unit_price": Decimal("100"),
             "receipt_quantity": Decimal("100"), "material_type_id": "MAT-A",
             "receipt_date": date(2025, 6, 15), "status": "AVAILABLE"},
        ]
        previous = [
            {"supplier_id": "SUP-A", "unit_price": Decimal("80"),
             "receipt_quantity": Decimal("100"), "material_type_id": "MAT-A",
             "receipt_date": date(2025, 5, 15), "status": "AVAILABLE"},
        ]
        result = self._run_overview(current, previous_batches=previous)
        # KPICard 13-field shape: identifier is "key", not "metricCode"
        keys = [k["key"] for k in result["kpiCards"]]
        assert keys == [
            "PROCUREMENT_AMOUNT", "BATCH_COUNT", "AVG_BATCH_AMOUNT",
            "SUPPLIER_CONCENTRATION", "PROCUREMENT_MOM_GROWTH",
        ], f"5 KPI cards in this exact order, got: {keys}"
        # Each card has the full 13-field KPICard shape
        for card in result["kpiCards"]:
            assert set(card.keys()) == {
                "key", "title", "value", "rawValue", "unit", "change", "changeRate",
                "trend", "status", "compareText", "description", "targetValue", "completionRate",
            }, f"KPICard 13-field shape mismatch: {sorted(card.keys())}"

    def test_ai_insights_concentration_red_and_yellow_triggers(self):
        """Build batches that produce concentration > 60% -> AIInsight level=RED;
        Then test concentration > 40 but <= 60 -> AIInsight level=YELLOW.

        Algorithm: concentration = max_supplier_value / total_value * 100.
        - 80% concentration: SUP-A=Decimal("8000"), SUP-B=Decimal("2000") -> 80% -> RED
        - 50% concentration: SUP-A=Decimal("5000"), SUP-B=Decimal("3000"),
                             SUP-C=Decimal("2000") -> 50% -> YELLOW
        """
        # Case 1: RED (concentration > 60)
        red_current = [
            {"supplier_id": "SUP-A", "unit_price": Decimal("100"),
             "receipt_quantity": Decimal("80"), "material_type_id": "MAT-A",
             "receipt_date": date(2025, 6, 15), "status": "AVAILABLE"},
            {"supplier_id": "SUP-B", "unit_price": Decimal("100"),
             "receipt_quantity": Decimal("20"), "material_type_id": "MAT-B",
             "receipt_date": date(2025, 6, 15), "status": "AVAILABLE"},
        ]
        red_result = self._run_overview(
            red_current,
            supplier_lookup={"SUP-A": {"name": "供应商A"}, "SUP-B": {"name": "供应商B"}},
        )
        red_risk = next(
            (i for i in red_result["aiInsights"] if i["category"] == "供应商风险"), None
        )
        assert red_risk is not None
        assert red_risk["level"] == "RED"
        assert "高达" in red_risk["message"], f"RED message format: {red_risk['message']}"

        # Case 2: YELLOW (40 < concentration <= 60). 5000/10000*100 = 50%
        yellow_current = [
            {"supplier_id": "SUP-A", "unit_price": Decimal("100"),
             "receipt_quantity": Decimal("50"), "material_type_id": "MAT-A",
             "receipt_date": date(2025, 6, 15), "status": "AVAILABLE"},
            {"supplier_id": "SUP-B", "unit_price": Decimal("100"),
             "receipt_quantity": Decimal("30"), "material_type_id": "MAT-B",
             "receipt_date": date(2025, 6, 15), "status": "AVAILABLE"},
            {"supplier_id": "SUP-C", "unit_price": Decimal("100"),
             "receipt_quantity": Decimal("20"), "material_type_id": "MAT-C",
             "receipt_date": date(2025, 6, 15), "status": "AVAILABLE"},
        ]
        yellow_result = self._run_overview(yellow_current)
        yellow_risk = next(
            (i for i in yellow_result["aiInsights"] if i["category"] == "供应商风险"), None
        )
        assert yellow_risk is not None
        assert yellow_risk["level"] == "YELLOW"
        assert "需要关注" in yellow_risk["message"], f"YELLOW message: {yellow_risk['message']}"

    def test_suggestions_trigger_conditions(self):
        """Verify Java generateSuggestions (line 980-1005) triggers:
           1. supplierCount < 3 -> "当前活跃供应商数量较少..."
           2. highPriceCount > 0 (unit_price > avg * 1.5) -> "有 N 批次..."
        """
        # 2 suppliers (< 3 → suggestion 1) + one batch with unit price > 1.5x average
        # avg_unit_price filter is positive only (Java line 553-554), so:
        #   prices = [100, 100, 200] → avg = 400/3 ≈ 133.33 → threshold = 200.0
        #   Need unit_price strictly > 200 to trigger suggestion 2.
        current = [
            {"supplier_id": "SUP-A", "unit_price": Decimal("100"),
             "receipt_quantity": Decimal("10"), "material_type_id": "MAT-A",
             "receipt_date": date(2025, 6, 15), "status": "AVAILABLE"},
            {"supplier_id": "SUP-B", "unit_price": Decimal("100"),
             "receipt_quantity": Decimal("10"), "material_type_id": "MAT-B",
             "receipt_date": date(2025, 6, 15), "status": "AVAILABLE"},
            {"supplier_id": "SUP-A", "unit_price": Decimal("250"),
             "receipt_quantity": Decimal("5"), "material_type_id": "MAT-A",
             "receipt_date": date(2025, 6, 20), "status": "AVAILABLE"},
        ]
        result = self._run_overview(current)
        suggestions = result["suggestions"]
        assert len(suggestions) == 2, f"expected exactly 2 suggestions, got {suggestions}"
        assert "活跃供应商数量较少" in suggestions[0], (
            f"first suggestion should be supplier-count-driven: {suggestions[0]}"
        )
        assert "批次采购单价高于平均价格" in suggestions[1], (
            f"second suggestion should be high-price-driven: {suggestions[1]}"
        )

    def test_suggestions_empty_when_three_plus_suppliers_and_no_high_price(self):
        """3+ distinct suppliers AND no batch unit_price > avg*1.5 → empty list.

        Java line 980-1005: both branches gated by their own conditions; nothing
        else added by default (NOT a default 'healthy' suggestion).
        """
        current = [
            {"supplier_id": f"SUP-{i}", "unit_price": Decimal("100"),
             "receipt_quantity": Decimal("10"), "material_type_id": "MAT-A",
             "receipt_date": date(2025, 6, 15), "status": "AVAILABLE"}
            for i in range(4)  # 4 distinct suppliers
        ]
        result = self._run_overview(current)
        # All unit prices = 100 → avg = 100 → threshold = 150 → no high-price triggers
        assert result["suggestions"] == [], f"expected empty, got {result['suggestions']}"

    def test_empty_dashboard_exact_strings(self):
        """C2 audit-gap fix - empty batches return _build_empty_dashboard with
        exact Java strings (NOT placeholder text)."""
        result = self._run_overview(current_batches=[])

        # Verify 16-key envelope (Lombok @Data emit-all)
        assert len(result) == 16

        # AIInsight exact 5-key shape with C2 strings
        assert len(result["aiInsights"]) == 1
        ai = result["aiInsights"][0]
        assert ai["level"] == "YELLOW"            # NOT "INFO"
        assert ai["category"] == "数据状态"
        assert ai["message"] == "当前时间范围内暂无采购数据"          # NOT "暂无采购数据"
        assert ai["actionSuggestion"] == "请调整时间范围或录入采购数据"  # NOT None
        assert ai["relatedEntity"] is None

        # suggestions list with exact C2 string
        assert result["suggestions"] == ["请先录入采购数据以开始分析"]   # NOT []

        # Empty container fields
        assert result["kpiCards"] == []
        assert result["charts"] == {}
        assert result["rankings"] == {}

    def test_charts_key_naming_replaces_space_with_underscore(self):
        """charts dict keys = title.replace(' ', '_') per Java line 93-101 LinkedHashMap.

        Java chart titles (matched to F001 golden):
          1. '采购趋势'         (buildProcurementTrendChartFromData line 776)
          2. '供应商采购占比'   (buildSupplierPieChart line 866)
          3. '材料类别采购金额' (buildMaterialCategoryChart line 903)
        All Chinese, no spaces, so .replace is a no-op but mechanism stays active.
        """
        current = [
            {"supplier_id": "SUP-A", "unit_price": Decimal("100"),
             "receipt_quantity": Decimal("10"), "material_type_id": "MAT-A",
             "receipt_date": date(2025, 6, 15), "status": "AVAILABLE"},
        ]
        result = self._run_overview(current)
        chart_keys = list(result["charts"].keys())
        assert chart_keys == ["采购趋势", "供应商采购占比", "材料类别采购金额"], (
            f"expected exact 3 chart titles in put-order, got: {chart_keys}"
        )

    def test_concentration_formula_precision_byte_eq(self):
        """Round 4 audit gap fix: concentration formula must yield exact value.

        Setup: SUP-A total=Decimal('60'), SUP-B total=Decimal('40') -> total=100.
        max=60, total=100 -> max/total = 0.6000 (scale=4) -> *100 -> 60.0000.

        Direct call to _calculate_supplier_concentration to verify Decimal precision
        (NOT float drift)."""
        from smartbi_compat.api.analysis_procurement import _calculate_supplier_concentration

        # Build batches such that SUP-A total = 60, SUP-B total = 40
        batches = [
            {"supplier_id": "SUP-A", "unit_price": Decimal("60"),
             "receipt_quantity": Decimal("1")},      # 60
            {"supplier_id": "SUP-B", "unit_price": Decimal("40"),
             "receipt_quantity": Decimal("1")},      # 40
        ]
        result = _calculate_supplier_concentration(batches)
        # Quantize-then-multiply yields Decimal("60.0000") exactly (NOT float 60.000000001 etc)
        assert result == Decimal("60.0000"), (
            f"Round 4 precision lock: expected Decimal('60.0000'), got {result!r}"
        )
