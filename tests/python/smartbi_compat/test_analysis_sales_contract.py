"""Contract tests: Python /analysis/sales must match Java byte-shape goldens.

Foundation merge gates (this file):
  - TestEnvelope.test_route_registered
  - TestEnvelope.test_jwt_required
  - TestEnvelope.test_factory_id_isolation
  - TestEnvelope.test_dimension_param_ignored
  - TestEnvelope.test_F999_empty_state_byte_shape  ← foundation merge gate

Sibling specs add:
  - TestOverview (overview spec) — legacy fallback path tests
  - TestRankings (rankings spec) — F001 byte tests + tie-stability + Top 10
  - TestTrend (trend spec) — DAY bucketing + F001 byte
  - TestGold (gold spec) — Gold-path adapter byte tests + empty short-circuit

Goldens recorded against F999 + F001 by:
  scripts/phase2a/record-analysis-sales-goldens.sh
"""
from __future__ import annotations

import importlib.util
import json
import os
import pathlib
from datetime import datetime, timezone
from typing import Any

import jwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

JWT_SECRET = "test-secret-for-phase2a-do-not-use-in-prod"
os.environ["JWT_SECRET"] = JWT_SECRET

GOLDEN_DIR = (
    pathlib.Path(__file__).resolve().parents[2] / "fixtures" / "java-smartbi-golden"
)


def _load_production_main() -> Any:
    main_py = (
        pathlib.Path(__file__).resolve().parents[3]
        / "backend" / "python" / "main.py"
    )
    spec = importlib.util.spec_from_file_location(
        "phase2a_production_main_analysis_sales", main_py,
    )
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_production_main = _load_production_main()


@pytest.fixture
def app(monkeypatch):
    """F999 empty-state — stubs already return empty shapes, no patch needed."""
    return _production_main.app


@pytest.fixture
def client(app):
    return TestClient(app)


def _make_token(factory_id: str) -> str:
    payload = {
        "userId": 1,
        "username": "test_user",
        "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": datetime.now(timezone.utc).timestamp() + 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


@pytest.fixture
def f999_token():
    return _make_token("F999")


@pytest.fixture
def f001_token():
    return _make_token("F001")


# Re-export _strip_volatile for sibling spec test classes
from smartbi_compat.api.analysis_sales import _strip_volatile  # noqa: E402


class TestEnvelope:
    """Foundation merge gate. Sibling specs add Test{Overview,Rankings,Trend,Gold}."""

    def test_route_registered(self, client, f999_token):
        response = client.get(
            "/api/mobile/F999/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f999_token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body.get("success") is True
        assert "data" in body

    def test_jwt_required(self, client):
        response = client.get(
            "/api/mobile/F999/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
        )
        assert response.status_code in (401, 403)

    def test_factory_id_isolation(self, client, f999_token):
        """F999 token must be rejected for F001 path."""
        response = client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f999_token}"},
        )
        assert response.status_code == 403

    def test_dimension_param_ignored(self, client, f999_token):
        """Java line 110 short-circuit: when smartBIService≠null, dimension
        query param is read but NOT branched on. F999 goldens (with/without
        dimension=salesperson) are byte-identical except _meta."""
        r_no_dim = client.get(
            "/api/mobile/F999/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f999_token}"},
        )
        r_with_dim = client.get(
            "/api/mobile/F999/smart-bi/analysis/sales",
            params={
                "startDate": "2025-01-01",
                "endDate": "2025-12-31",
                "dimension": "salesperson",
            },
            headers={"Authorization": f"Bearer {f999_token}"},
        )
        assert r_no_dim.status_code == 200
        assert r_with_dim.status_code == 200
        # After stripping volatile timestamps, the responses must be equal
        assert _strip_volatile(r_no_dim.json()) == _strip_volatile(r_with_dim.json())

    def test_F999_empty_state_byte_shape(self, client, f999_token):
        """Foundation merge gate. F999 has no sales data → composite Map
        matches golden after strip-volatile."""
        response = client.get(
            "/api/mobile/F999/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f999_token}"},
        )
        assert response.status_code == 200

        actual = _strip_volatile(response.json())

        with open(GOLDEN_DIR / "analysis-sales-F999.json", encoding="utf-8") as f:
            golden = json.load(f)
        # Golden file format wraps response: {"verb":..., "response": {...}, "_meta": ...}
        expected_response = _strip_volatile(golden["response"])

        # The Python actual envelope shape may differ slightly from Java
        # (e.g. envelope `code`/`httpStatus` keys). Compare just the `data`
        # field which is what foundation owns.
        assert actual.get("data") == expected_response.get("data"), (
            f"F999 data byte-shape mismatch.\n"
            f"Actual data keys: "
            f"{sorted(actual.get('data', {}).keys()) if isinstance(actual.get('data'), dict) else 'N/A'}\n"
            f"Expected data keys: "
            f"{sorted(expected_response.get('data', {}).keys()) if isinstance(expected_response.get('data'), dict) else 'N/A'}"
        )


# Re-export adapter helpers used by TestGold mock setup
from smartbi_compat.api.analysis_sales import (  # noqa: E402
    _build_from_gold_with_charts,
    _build_from_gold_finance_summary,
)


F001_GOLD_FINANCE = {
    "factory_id": "F001",
    "start_date": "2025-01-01",
    "end_date": "2025-12-31",
    "total_revenue": 20639884.52,
    "bill_count": 140541,
    "avg_bill_value": 146.86,
    "store_count": 8,
    "top_stores": [
        {"store_id": f"S{i}", "store_name": f"Store {i}", "revenue": 100000.0 * (10 - i), "bill_count": 1000 * (10 - i)}
        for i in range(1, 9)
    ],
}

F001_GOLD_TREND = {
    "factory_id": "F001",
    "start_date": "2025-01-01",
    "end_date": "2025-12-31",
    "points": [{"date": "2025-01-01", "revenue": 91972.04, "bill_count": 600, "avg_bill_value": 153.29}],
}

F001_GOLD_PRODUCTS = {
    "factory_id": "F001",
    "start_date": "2025-01-01",
    "end_date": "2025-12-31",
    "top_products": [
        {"product_id": f"P{i}", "name": f"Product {i}", "qty": 1000, "revenue": 100000.0 * (9 - i), "bill_count": 500}
        for i in range(1, 9)
    ],
}


class TestGold:
    """Gold-path adapter contract tests."""

    def _patch_gold_path(self, monkeypatch, finance, trend, products):
        """Patch the 3 query seams + bypass pool acquisition.

        Strategy: patch smartbi.config.get_pg_pool to return a sentinel pool
        object (None is fine since adapters don't actually use pool when seams
        are also patched). Then patch the 3 seams to return fixture data.
        """
        from smartbi_compat.api import analysis_sales as mod
        async def fake_pool():
            return None
        async def fake_fin(pool, fid, dr, *, top_n_stores=10):
            return finance
        async def fake_trend(pool, fid, dr):
            return trend
        async def fake_prod(pool, fid, dr, *, top_n=8):
            return products
        # Patch pool acquisition in smartbi.config namespace where _get_sales_overview imports it
        try:
            import smartbi.config as smartbi_config
            monkeypatch.setattr(smartbi_config, "get_pg_pool", fake_pool, raising=False)
        except ImportError:
            pass
        # Patch the 3 seams in analysis_sales namespace
        monkeypatch.setattr(mod, "_call_finance_summary", fake_fin)
        monkeypatch.setattr(mod, "_call_daily_trend", fake_trend)
        monkeypatch.setattr(mod, "_call_top_products", fake_prod)

    def test_F001_overview_kpi_card_count(self, monkeypatch, client, f001_token):
        self._patch_gold_path(monkeypatch, F001_GOLD_FINANCE, F001_GOLD_TREND, F001_GOLD_PRODUCTS)
        response = client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f001_token}"},
        )
        assert response.status_code == 200
        ov = response.json()["data"]["overview"]
        assert len(ov["kpiCards"]) == 4
        keys = [c["key"] for c in ov["kpiCards"]]
        assert keys == ["total_revenue", "bill_count", "avg_bill_value", "store_count"]

    def test_F001_overview_charts_populated(self, monkeypatch, client, f001_token):
        self._patch_gold_path(monkeypatch, F001_GOLD_FINANCE, F001_GOLD_TREND, F001_GOLD_PRODUCTS)
        response = client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f001_token}"},
        )
        ov = response.json()["data"]["overview"]
        assert "sales_trend" in ov["charts"]
        assert "category_distribution" in ov["charts"]
        assert ov["charts"]["sales_trend"]["chartType"] == "LINE"
        assert ov["charts"]["category_distribution"]["chartType"] == "PIE"

    def test_F001_overview_top_stores_ranking(self, monkeypatch, client, f001_token):
        self._patch_gold_path(monkeypatch, F001_GOLD_FINANCE, F001_GOLD_TREND, F001_GOLD_PRODUCTS)
        response = client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f001_token}"},
        )
        ov = response.json()["data"]["overview"]
        assert "top_stores" in ov["rankings"]
        assert len(ov["rankings"]["top_stores"]) == 8
        first = ov["rankings"]["top_stores"][0]
        assert first["rank"] == 1
        assert first["target"] is None
        assert first["completionRate"] is None
        assert first["alertLevel"] is None

    def test_empty_gold_falls_back_to_legacy(self, monkeypatch, client, f001_token):
        empty_finance = {**F001_GOLD_FINANCE, "total_revenue": 0, "bill_count": 0, "top_stores": []}
        self._patch_gold_path(monkeypatch, empty_finance, F001_GOLD_TREND, F001_GOLD_PRODUCTS)
        response = client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f001_token}"},
        )
        ov = response.json()["data"]["overview"]
        # Legacy placeholder shape: 1 YELLOW insight + 1 suggestion + empty kpiCards
        assert ov["kpiCards"] == []
        assert len(ov["aiInsights"]) == 1
        assert ov["aiInsights"][0]["level"] == "YELLOW"
        assert ov["suggestions"] == ["请先上传销售数据以开始分析"]

    def test_gold_chart_failure_tolerated(self, monkeypatch, client, f001_token):
        from smartbi_compat.api import analysis_sales as mod
        async def fake_fin(pool, fid, dr, *, top_n_stores=10):
            return F001_GOLD_FINANCE
        async def failing_trend(pool, fid, dr):
            raise RuntimeError("simulated trend failure")
        async def fake_prod(pool, fid, dr, *, top_n=8):
            return F001_GOLD_PRODUCTS
        async def fake_pool():
            return None
        try:
            import smartbi.config as smartbi_config
            monkeypatch.setattr(smartbi_config, "get_pg_pool", fake_pool, raising=False)
        except ImportError:
            pass
        monkeypatch.setattr(mod, "_call_finance_summary", fake_fin)
        monkeypatch.setattr(mod, "_call_daily_trend", failing_trend)
        monkeypatch.setattr(mod, "_call_top_products", fake_prod)
        response = client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f001_token}"},
        )
        ov = response.json()["data"]["overview"]
        assert "sales_trend" not in ov["charts"]
        assert "category_distribution" in ov["charts"]
        assert len(ov["kpiCards"]) == 4

    def test_F001_overview_byte_shape_via_gold(self, monkeypatch, client, f001_token):
        """Gold spec merge gate. F001 overview field byte-matches golden after strip-volatile.

        Mock returns the EXACT shape Java's Gold queries return for F001's 2025
        window (~20.6M total revenue / 140541 bills / 8 stores / 365 trend days /
        8 categories). Mocked because tests must be hermetic.
        """
        # Build mock from golden's actual values to ensure byte parity
        with open(GOLDEN_DIR / "analysis-sales-F001.json", encoding="utf-8") as f:
            golden = json.load(f)
        golden_ov = golden["response"]["data"]["overview"]

        kpi_total_rev = golden_ov["kpiCards"][0]["rawValue"]
        kpi_bill_count = golden_ov["kpiCards"][1]["rawValue"]
        kpi_avg_bill = golden_ov["kpiCards"][2]["rawValue"]
        kpi_stores = golden_ov["kpiCards"][3]["rawValue"]

        finance_mock = {
            "factory_id": "F001",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "total_revenue": float(kpi_total_rev),
            "bill_count": int(kpi_bill_count),
            "avg_bill_value": float(kpi_avg_bill),
            "store_count": int(kpi_stores),
            "top_stores": [
                {
                    "store_id": f"S{i+1}",
                    "store_name": s["name"],
                    "revenue": float(s["value"]),
                    "bill_count": 1000,
                }
                for i, s in enumerate(golden_ov["rankings"]["top_stores"])
            ],
        }
        trend_mock = {
            "factory_id": "F001",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "points": [
                {"date": p["date"], "revenue": float(p["amount"]), "bill_count": 100, "avg_bill_value": 100.0}
                for p in golden_ov["charts"]["sales_trend"]["data"]
            ],
        }
        products_mock = {
            "factory_id": "F001",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "top_products": [
                {"product_id": f"P{i+1}", "name": d["category"], "qty": 100, "revenue": float(d["amount"]), "bill_count": 50}
                for i, d in enumerate(golden_ov["charts"]["category_distribution"]["data"])
            ],
        }

        from smartbi_compat.api import analysis_sales as mod
        async def fake_fin(pool, fid, dr, *, top_n_stores=10):
            return finance_mock
        async def fake_trend(pool, fid, dr):
            return trend_mock
        async def fake_prod(pool, fid, dr, *, top_n=8):
            return products_mock
        async def fake_pool():
            return None
        try:
            import smartbi.config as smartbi_config
            monkeypatch.setattr(smartbi_config, "get_pg_pool", fake_pool, raising=False)
        except ImportError:
            pass
        monkeypatch.setattr(mod, "_call_finance_summary", fake_fin)
        monkeypatch.setattr(mod, "_call_daily_trend", fake_trend)
        monkeypatch.setattr(mod, "_call_top_products", fake_prod)

        response = client.get(
            "/api/mobile/F001/smart-bi/analysis/sales",
            params={"startDate": "2025-01-01", "endDate": "2025-12-31"},
            headers={"Authorization": f"Bearer {f001_token}"},
        )
        assert response.status_code == 200

        actual_overview = _strip_volatile(response.json()["data"]["overview"])
        expected_overview = _strip_volatile(golden_ov)

        assert actual_overview == expected_overview, (
            f"F001 overview byte-shape mismatch.\n"
            f"Actual keys: {sorted(actual_overview.keys())}\n"
            f"Expected keys: {sorted(expected_overview.keys())}"
        )


# ============================================================
# TestOverview — overview spec contract tests (Y-a, B, Option 1)
# ============================================================


class TestOverview:
    """Contract tests for legacy fallback overview path.

    Foundation merge gates TestEnvelope; gold spec adds TestGold;
    overview spec (this class) covers _build_legacy_sales_overview real impl.
    """

    def test_threshold_constants_match_java(self):
        """Java SalesAnalysisServiceImpl line 69-74 + SCALE/DISPLAY_SCALE constants."""
        from smartbi_compat.api import analysis_sales as m
        from decimal import Decimal

        assert m.TARGET_RED_THRESHOLD == Decimal("60")
        assert m.TARGET_YELLOW_THRESHOLD == Decimal("85")
        assert m.MARGIN_RED_THRESHOLD == Decimal("15")
        assert m.MARGIN_YELLOW_THRESHOLD == Decimal("25")
        assert m.GROWTH_RED_THRESHOLD == Decimal("-20")
        assert m.GROWTH_YELLOW_THRESHOLD == Decimal("-5")
        assert m.SCALE == 4
        assert m.DISPLAY_SCALE == 2

    def test_alert_level_to_status_mapping(self):
        """Java convertToKPICards line 678-689."""
        from smartbi_compat.api.analysis_sales import _alert_level_to_status
        assert _alert_level_to_status("RED") == "red"
        assert _alert_level_to_status("YELLOW") == "yellow"
        assert _alert_level_to_status("GREEN") == "green"
        assert _alert_level_to_status(None) == "green"
        assert _alert_level_to_status("UNKNOWN") == "green"

    def test_change_direction_to_trend_mapping(self):
        """Java convertToKPICards line 691-703."""
        from smartbi_compat.api.analysis_sales import _change_direction_to_trend
        assert _change_direction_to_trend("UP") == "up"
        assert _change_direction_to_trend("DOWN") == "down"
        assert _change_direction_to_trend("STABLE") == "flat"
        assert _change_direction_to_trend(None) == "flat"

    def test_format_currency(self):
        """Java SalesAnalysisServiceImpl.formatCurrency line 1255-1260."""
        from smartbi_compat.api.analysis_sales import _format_currency
        from decimal import Decimal
        assert _format_currency(Decimal("1234567.89")) == "1,234,567.89"
        assert _format_currency(Decimal("0.005")) == "0.01"
        assert _format_currency(Decimal("100")) == "100.00"
        assert _format_currency(Decimal("-1234.56")) == "-1,234.56"
        assert _format_currency(None) == "-"

    def test_format_completion_pct(self):
        """Java line 236 — '%.1f%%' pattern."""
        from smartbi_compat.api.analysis_sales import _format_completion_pct
        from decimal import Decimal
        assert _format_completion_pct(Decimal("85.34")) == "85.3%"
        assert _format_completion_pct(Decimal("100")) == "100.0%"
        assert _format_completion_pct(Decimal("0")) == "0.0%"
        assert _format_completion_pct(Decimal("85.35")) == "85.4%"

    def test_format_growth_pct(self):
        """Java line 255 — '%+.1f%%' pattern."""
        from smartbi_compat.api.analysis_sales import _format_growth_pct
        from decimal import Decimal
        assert _format_growth_pct(Decimal("12.5")) == "+12.5%"
        assert _format_growth_pct(Decimal("-12.5")) == "-12.5%"
        assert _format_growth_pct(Decimal("0")) == "+0.0%"

    def test_format_growth_pct_negative_zero_edge(self):
        """Java %+.1f%% on -0.04 → '-0.0%' (Java's + flag respects negative zero
        from doubleValue, doesn't prepend + when result starts with '-').
        Bug fix: Phase B code review C1.
        """
        from smartbi_compat.api.analysis_sales import _format_growth_pct
        from decimal import Decimal

        # Negative value that rounds to negative-zero — Java emits "-0.0%"
        assert _format_growth_pct(Decimal("-0.04")) == "-0.0%"
        # Positive value that rounds to positive-zero — Java emits "+0.0%"
        assert _format_growth_pct(Decimal("0.04")) == "+0.0%"
        # Decimal("-0.0") direct — should match Java behavior of -0.0% (since float(-0.0) starts with "-")
        assert _format_growth_pct(Decimal("-0.0")) == "-0.0%"

    def test_calculate_completion_rate(self):
        """Java SalesAnalysisServiceImpl.calculateCompletionRate line 1166-1171."""
        from smartbi_compat.api.analysis_sales import _calculate_completion_rate
        from decimal import Decimal
        result = _calculate_completion_rate(Decimal("50000"), Decimal("100000"))
        assert result == Decimal("50.0000")
        assert _calculate_completion_rate(Decimal("100"), Decimal("0")) == Decimal("0")
        assert _calculate_completion_rate(Decimal("100"), None) == Decimal("0")
        result = _calculate_completion_rate(Decimal("1"), Decimal("3"))
        assert result == Decimal("33.3333")

    def test_calculate_mom_growth(self):
        """Java MetricCalculatorServiceImpl.calculateMomGrowth line 425-438."""
        from smartbi_compat.api.analysis_sales import _calculate_mom_growth
        from decimal import Decimal
        assert _calculate_mom_growth(Decimal("200"), Decimal("100")) == Decimal("100.00")
        assert _calculate_mom_growth(Decimal("50"), Decimal("100")) == Decimal("-50.00")
        assert _calculate_mom_growth(Decimal("100"), Decimal("0")) == Decimal("100")
        assert _calculate_mom_growth(Decimal("0"), Decimal("0")) == Decimal("0")
        assert _calculate_mom_growth(Decimal("100"), None) == Decimal("100")
        assert _calculate_mom_growth(None, Decimal("100")) == Decimal("-100")
        assert _calculate_mom_growth(Decimal("100"), Decimal("-50")) == Decimal("300.00")

    def test_new_metric_result_dict_field_order(self):
        """MetricResult.java 11-field declaration order."""
        from smartbi_compat.api.analysis_sales import _new_metric_result_dict
        from decimal import Decimal
        d = _new_metric_result_dict(
            metric_code="X", metric_name="Y", value=Decimal("1"),
            formatted_value="1.00", unit="元", change_percent=Decimal("0"),
            change_direction="UP", change_value=Decimal("0.5"),
            alert_level="GREEN", dimension_value="dim", description="desc",
        )
        assert list(d.keys()) == [
            "metricCode", "metricName", "value", "formattedValue", "unit",
            "changePercent", "changeDirection", "changeValue", "alertLevel",
            "dimensionValue", "description",
        ]

    def test_new_metric_result_dict_alert_level_default(self):
        """MetricResult.AlertLevel.GREEN.name() default per spec §4."""
        from smartbi_compat.api.analysis_sales import _new_metric_result_dict
        d = _new_metric_result_dict(metric_code="X", metric_name="Y")
        assert d["alertLevel"] == "GREEN"
