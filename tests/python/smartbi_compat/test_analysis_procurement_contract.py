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
