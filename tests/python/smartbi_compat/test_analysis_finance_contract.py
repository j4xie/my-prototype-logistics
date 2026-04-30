"""Byte-shape contract gate for /analysis/finance composite path.

Java reference:
  - Controller: SmartBIAnalysisController.getFinanceAnalysis line 222-274
  - Service: SmartBIServiceImpl.getComprehensiveAnalysis line 600-605

Test pattern (mirrors sister test_analysis_sales_contract.py:41-77):
  - JWT_SECRET set in os.environ BEFORE importing production code
  - Load production main via importlib (gets full middleware stack)
  - Hit /api/mobile/F999/smart-bi/analysis/finance via TestClient with F999 JWT
  - Compare response['data'] (composite) to recorded golden['data']
  - Strip volatile keys (generatedAt/lastUpdated/cacheExpireAt/timestamp)

Golden source: A.5 recorded from test env Java backend (port 10011).

NOTE: This test FAILS until G.1 wires analysis_finance.router into main.py.
After G.1 + G.2, it should pass.
"""
from __future__ import annotations

import importlib.util
import io
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import jwt
import pytest


# ============================================================
# JWT_SECRET MUST be set BEFORE importing production code
# ============================================================
JWT_SECRET = "test-secret-for-phase2a-do-not-use-in-prod"
os.environ["JWT_SECRET"] = JWT_SECRET


REPO_ROOT = Path(__file__).resolve().parents[3]
GOLDEN_DIR = REPO_ROOT / "tests" / "fixtures" / "java-smartbi-golden"


def _load_production_main():
    """Import backend/python/main.py as a module to get production FastAPI app
    with all middleware (JWT auth, CORS, exception handlers) registered.

    Mirrors sister test_analysis_sales_contract.py:41-55.
    """
    main_path = REPO_ROOT / "backend" / "python" / "main.py"
    sys.path.insert(0, str(REPO_ROOT / "backend" / "python"))
    spec = importlib.util.spec_from_file_location("_production_main", main_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _make_token(factory_id: str) -> str:
    """Generate test JWT matching JWT_SECRET set above."""
    payload = {
        "userId": 1,
        "username": "test_user",
        "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": datetime.now(timezone.utc).timestamp() + 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


VOLATILE = frozenset({"generatedAt", "lastUpdated", "cacheExpireAt", "timestamp"})


def _strip_volatile(obj):
    """Recursively strip timing keys before byte compare."""
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


class TestAnalysisFinanceComposite:
    """F999 byte-shape gate for composite path (analysisType empty)."""

    def test_f999_composite_data_keys_match_golden(self, client):
        """Sanity: data keys order matches Jackson order in golden."""
        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_data_keys = list(resp.json()["data"].keys())

        with io.open(GOLDEN_DIR / "analysis-finance-F999-composite.json", encoding="utf-8") as f:
            golden_data_keys = list(json.load(f)["data"].keys())

        assert py_data_keys == golden_data_keys, (
            f"data key order mismatch:\n"
            f"  python: {py_data_keys}\n"
            f"  golden: {golden_data_keys}"
        )

    def test_f999_composite_byte_shape(self, client):
        """Full byte-shape compare on data block (envelope skipped due to A.5 finding)."""
        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200

        py_data = _strip_volatile(resp.json()["data"])

        with io.open(GOLDEN_DIR / "analysis-finance-F999-composite.json", encoding="utf-8") as f:
            golden_data = _strip_volatile(json.load(f)["data"])

        if py_data != golden_data:
            # Show diff
            diffs = {}
            for k in set(py_data.keys()) | set(golden_data.keys()):
                if py_data.get(k) != golden_data.get(k):
                    diffs[k] = {
                        "python": py_data.get(k),
                        "golden": golden_data.get(k),
                    }
            pytest.fail(
                f"BYTE SHAPE MISMATCH on {list(diffs.keys())}\n"
                f"{json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}"
            )

    def test_f999_unimplemented_analysisType_returns_501(self, client):
        """Verify 501 path for un-ported analysisTypes (payable + profit now real impl, excluded)."""
        for at in ["cost", "receivable", "budget"]:
            resp = client.get(
                f"/api/mobile/F999/smart-bi/analysis/finance"
                f"?startDate=2025-01-01&endDate=2025-12-31&analysisType={at}",
                headers={"Authorization": f"Bearer {_make_token('F999')}"},
            )
            assert resp.status_code == 200, f"got {resp.status_code} for analysisType={at}"
            body = resp.json()
            assert body["success"] is False, f"expected success=false for analysisType={at}"
            assert body["code"] == 501, f"expected code=501 for analysisType={at}, got {body['code']}"
            assert at in body["message"], f"expected '{at}' in message, got: {body['message'][:100]}"


class TestAnalysisFinancePayable:
    """F999 byte-shape gate for payable per-type path (analysisType=payable, Phase E real impl)."""

    def test_f999_payable_data_keys_match_golden(self, client, monkeypatch):
        """Sanity: data keys order matches Jackson HashMap order in golden.

        Golden order (F.1 recorded): [endDate, metrics, agingChart, startDate]
        Differs from Java controller put-order [startDate, endDate, metrics, agingChart]
        because Jackson serializes HashMap by hash order, not insertion order.
        """
        async def fake_empty(_factory_id, _end_date):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_payable_data",
            fake_empty,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31&analysisType=payable",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_data_keys = list(resp.json()["data"].keys())

        with io.open(GOLDEN_DIR / "analysis-finance-F999-payable.json", encoding="utf-8") as f:
            golden_data_keys = list(json.load(f)["data"].keys())

        assert py_data_keys == golden_data_keys, (
            f"data key order mismatch:\n"
            f"  python: {py_data_keys}\n"
            f"  golden: {golden_data_keys}"
        )

    def test_f999_payable_byte_shape(self, client, monkeypatch):
        """Full byte-shape compare on data block.

        Mocks _query_finance_payable_data to return [] (matches F999 empty state).
        Compares response['data'] against recorded golden after stripping volatile keys.
        """
        async def fake_empty(_factory_id, _end_date):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_payable_data",
            fake_empty,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31&analysisType=payable",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200

        py_data = _strip_volatile(resp.json()["data"])

        with io.open(GOLDEN_DIR / "analysis-finance-F999-payable.json", encoding="utf-8") as f:
            golden_data = _strip_volatile(json.load(f)["data"])

        if py_data != golden_data:
            diffs = {}
            for k in set(py_data.keys()) | set(golden_data.keys()):
                if py_data.get(k) != golden_data.get(k):
                    diffs[k] = {
                        "python": py_data.get(k),
                        "golden": golden_data.get(k),
                    }
            pytest.fail(
                f"BYTE SHAPE MISMATCH (payable) on {list(diffs.keys())}\n"
                f"{json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}"
            )


class TestAnalysisFinanceProfit:
    """F999 byte-shape gate for profit per-type path (analysisType=profit, PR-A real impl)."""

    def test_f999_profit_data_keys_match_golden(self, client, monkeypatch):
        """Sanity: data keys order matches Jackson HashMap order in recorded golden.

        Mock _query_finance_data → [] for both REVENUE + COST so impl runs the
        empty-Path-A branch (matches F999 reality on test env).
        """
        async def fake_empty(_factory_id, _record_type, _start, _end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_empty,
        )
        async def fake_sales_empty(_factory_id, _start, _end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_sales_fallback",
            fake_sales_empty,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31&analysisType=profit",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_data_keys = list(resp.json()["data"].keys())

        with io.open(GOLDEN_DIR / "analysis-finance-F999-profit.json", encoding="utf-8") as f:
            golden_data_keys = list(json.load(f)["data"].keys())

        assert py_data_keys == golden_data_keys, (
            f"data key order mismatch:\n"
            f"  python: {py_data_keys}\n"
            f"  golden: {golden_data_keys}"
        )

    def test_f999_profit_byte_shape(self, client, monkeypatch):
        """Full byte-shape compare on data block for empty F999 (5-zero-metric +
        empty trendChart data + full options).
        """
        async def fake_empty(_factory_id, _record_type, _start, _end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_empty,
        )
        async def fake_sales_empty(_factory_id, _start, _end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_sales_fallback",
            fake_sales_empty,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31&analysisType=profit",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200

        py_data = _strip_volatile(resp.json()["data"])

        with io.open(GOLDEN_DIR / "analysis-finance-F999-profit.json", encoding="utf-8") as f:
            golden_data = _strip_volatile(json.load(f)["data"])

        if py_data != golden_data:
            diffs = {}
            for k in set(py_data.keys()) | set(golden_data.keys()):
                if py_data.get(k) != golden_data.get(k):
                    diffs[k] = {
                        "python": py_data.get(k),
                        "golden": golden_data.get(k),
                    }
            pytest.fail(
                f"BYTE SHAPE MISMATCH (profit) on {list(diffs.keys())}\n"
                f"{json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}"
            )


class TestProfitMetricsArithmetic:
    """Unit tests for _get_profit_metrics arithmetic branches.

    Direct calls (no HTTP/JWT) — focused on metric calculation correctness
    after PR-A real impl. Mocks _query_finance_data to inject synthetic rows.
    """

    def _run(self, factory_id, range_, fake_data_fn, fake_sales_fn=None):
        """Run _get_profit_metrics with mocked seams. Returns list of metric dicts."""
        import asyncio
        from smartbi_compat.api import analysis_finance as af

        original_finance = af._query_finance_data
        original_sales = af._query_finance_sales_fallback
        try:
            af._query_finance_data = fake_data_fn
            if fake_sales_fn is not None:
                af._query_finance_sales_fallback = fake_sales_fn
            return asyncio.run(af._get_profit_metrics(factory_id, range_))
        finally:
            af._query_finance_data = original_finance
            af._query_finance_sales_fallback = original_sales

    def _build_range(self):
        from datetime import date
        from smartbi_compat.date_range import DateRange
        return DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))

    def _by_code(self, metrics):
        return {m["metricCode"]: m for m in metrics}

    def test_revenue_gt_cost_positive_gross_profit(self):
        """revenue=100k, cost=60k → grossProfit=40k, alertLevel=GREEN, formattedValue='40000.00'."""
        from datetime import date
        from decimal import Decimal
        async def fake(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                return [{"total_cost": Decimal("60000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        result = self._run("F", self._build_range(), fake)
        m = self._by_code(result)
        assert m["GROSS_PROFIT"]["value"] == 40000
        assert m["GROSS_PROFIT"]["alertLevel"] == "GREEN"
        # 40000 / 100000 * 100 = 40.0 → GREEN (>=25)
        assert m["GROSS_MARGIN"]["value"] == 40
        assert m["GROSS_MARGIN"]["alertLevel"] == "GREEN"

    def test_revenue_lt_cost_negative_gross_profit(self):
        """revenue=50k, cost=80k → grossProfit=-30k, GROSS_PROFIT.alertLevel still GREEN
        (Java hardcodes GREEN for GROSS_PROFIT regardless of sign — see analysis_finance.py)."""
        from datetime import date
        from decimal import Decimal
        async def fake(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("50000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                return [{"total_cost": Decimal("80000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        result = self._run("F", self._build_range(), fake)
        m = self._by_code(result)
        assert m["GROSS_PROFIT"]["value"] == -30000
        assert m["GROSS_PROFIT"]["alertLevel"] == "GREEN"  # Java line 425 hardcoded
        # -30000 / 50000 * 100 = -60 → RED (<15)
        assert m["GROSS_MARGIN"]["value"] == -60
        assert m["GROSS_MARGIN"]["alertLevel"] == "RED"

    def test_gross_margin_above_100_clamps_to_null(self):
        """Use net_margin > 100 to test clamp (gross_margin > 100 hard to construct
        without negative cost; abs() prevents that scenario)."""
        from datetime import date
        from decimal import Decimal
        async def fake_high_net(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [
                    {"actual_amount": Decimal("100"), "category": "营业收入",
                     "record_date": date(2025, 6, 1), "upload_id": 1},
                    {"actual_amount": Decimal("200"), "category": "净利润",
                     "record_date": date(2025, 6, 1), "upload_id": 1},
                ]
            if rt == "COST":
                return []
            return []
        result = self._run("F", self._build_range(), fake_high_net)
        m = self._by_code(result)
        # net_margin = 200/100 * 100 = 200% → clamped to null
        assert m["NET_MARGIN"]["value"] is None
        assert m["NET_MARGIN"]["formattedValue"] == "N/A"

    def test_gross_margin_below_neg100_clamps_to_null(self):
        """cost >> revenue → margin < -100% → clamp to null."""
        from datetime import date
        from decimal import Decimal
        async def fake(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                # cost 500, revenue 100 → grossProfit = -400 → margin = -400% → clamp null
                return [{"total_cost": Decimal("500"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        result = self._run("F", self._build_range(), fake)
        m = self._by_code(result)
        assert m["GROSS_MARGIN"]["value"] is None
        assert m["GROSS_MARGIN"]["formattedValue"] == "N/A"
        # Per Java line 432: gross_margin null → alertLevel='RED'
        assert m["GROSS_MARGIN"]["alertLevel"] == "RED"

    def test_net_profit_present_computes_net_margin(self):
        """When 净利 category present → net_margin computed."""
        from datetime import date
        from decimal import Decimal
        async def fake(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [
                    {"actual_amount": Decimal("100000"), "category": "营业收入",
                     "record_date": date(2025, 6, 1), "upload_id": 1},
                    {"actual_amount": Decimal("15000"), "category": "净利润",
                     "record_date": date(2025, 6, 1), "upload_id": 1},
                ]
            if rt == "COST":
                return [{"total_cost": Decimal("50000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        result = self._run("F", self._build_range(), fake)
        m = self._by_code(result)
        assert m["NET_PROFIT"]["value"] == 15000
        # net_margin = 15000 / 100000 * 100 = 15
        assert m["NET_MARGIN"]["value"] == 15

    def test_net_profit_absent_net_margin_zero(self):
        """No 净利 category → net_profit = sum() over empty = Decimal(0).
        Java reduce(ZERO, +) on empty stream returns ZERO, not null. Only the fallback
        path explicitly sets null.
        net_margin = 0 / revenue * 100 = 0, NOT null."""
        from datetime import date
        from decimal import Decimal
        async def fake(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                return [{"total_cost": Decimal("50000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        result = self._run("F", self._build_range(), fake)
        m = self._by_code(result)
        # Path-A with revenue + cost but no 净利 records: net_profit = Decimal(0)
        assert m["NET_PROFIT"]["value"] == 0
        assert m["NET_MARGIN"]["value"] == 0

    def test_total_cost_zero_roi_zero(self):
        """No COST records → total_cost = 0 → ROI = 0 (div-zero defense, Java line 481)."""
        from datetime import date
        from decimal import Decimal
        async def fake(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        result = self._run("F", self._build_range(), fake)
        m = self._by_code(result)
        assert m["ROI"]["value"] == 0
        # ROI = 0 → YELLOW (per _determine_roi_alert: 0 < 20 but >= 0)
        assert m["ROI"]["alertLevel"] == "YELLOW"

    def test_total_cost_positive_roi_computes(self):
        """revenue=100k, cost=50k → ROI = 50000/50000*100 = 100 → GREEN (>=20)."""
        from datetime import date
        from decimal import Decimal
        async def fake(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                return [{"total_cost": Decimal("50000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        result = self._run("F", self._build_range(), fake)
        m = self._by_code(result)
        # grossProfit = 50k, ROI = 50k/50k*100 = 100
        assert m["ROI"]["value"] == 100
        assert m["ROI"]["alertLevel"] == "GREEN"

    def test_alert_level_gross_margin_thresholds(self):
        """Verify GROSS_MARGIN alert thresholds: <15 RED, <25 YELLOW, else GREEN."""
        from datetime import date
        from decimal import Decimal

        # Margin = 10 → RED (<15)
        async def fake_red(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                return [{"total_cost": Decimal("90000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        m = self._by_code(self._run("F", self._build_range(), fake_red))
        assert m["GROSS_MARGIN"]["alertLevel"] == "RED"

        # Margin = 20 → YELLOW (<25)
        async def fake_yellow(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                return [{"total_cost": Decimal("80000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        m = self._by_code(self._run("F", self._build_range(), fake_yellow))
        assert m["GROSS_MARGIN"]["alertLevel"] == "YELLOW"

        # Margin = 30 → GREEN (>=25)
        async def fake_green(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                return [{"total_cost": Decimal("70000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        m = self._by_code(self._run("F", self._build_range(), fake_green))
        assert m["GROSS_MARGIN"]["alertLevel"] == "GREEN"

    def test_alert_level_roi_thresholds(self):
        """Verify ROI alert thresholds: <0 RED, <20 YELLOW, else GREEN."""
        from datetime import date
        from decimal import Decimal

        # ROI < 0 → RED (revenue=50k, cost=80k → grossProfit=-30k → ROI=-30k/80k*100=-37.5)
        async def fake_red(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("50000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                return [{"total_cost": Decimal("80000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        m = self._by_code(self._run("F", self._build_range(), fake_red))
        assert m["ROI"]["alertLevel"] == "RED"

        # ROI between 0 and 20 → YELLOW (revenue=100k, cost=90k → grossProfit=10k → ROI=11.11)
        async def fake_yellow(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [{"actual_amount": Decimal("100000"), "category": "营业收入",
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            if rt == "COST":
                return [{"total_cost": Decimal("90000"), "actual_amount": None,
                         "record_date": date(2025, 6, 1), "upload_id": 1}]
            return []
        m = self._by_code(self._run("F", self._build_range(), fake_yellow))
        assert m["ROI"]["alertLevel"] == "YELLOW"

        # ROI > 20 → GREEN (already covered by test_total_cost_positive_roi_computes)


class TestProfitMetricsSalesFallback:
    """Unit tests for sales fallback path in _get_profit_metrics + _get_profit_trend_chart.

    Mocks _query_finance_data → [] AND _query_finance_sales_fallback → synthetic rows.
    """

    def _run_metrics(self, fake_finance, fake_sales):
        """Run _get_profit_metrics with both seams mocked. Returns metric dicts."""
        import asyncio
        from datetime import date
        from smartbi_compat.api import analysis_finance as af
        from smartbi_compat.date_range import DateRange

        original_finance = af._query_finance_data
        original_sales = af._query_finance_sales_fallback
        try:
            af._query_finance_data = fake_finance
            af._query_finance_sales_fallback = fake_sales
            range_ = DateRange.custom(date(2025, 1, 1), date(2025, 12, 31))
            return asyncio.run(af._get_profit_metrics("F", range_))
        finally:
            af._query_finance_data = original_finance
            af._query_finance_sales_fallback = original_sales

    def _run_trend(self, fake_finance, fake_sales):
        """Run _get_profit_trend_chart with both seams mocked. Returns chart dict."""
        import asyncio
        from datetime import date
        from smartbi_compat.api import analysis_finance as af

        original_finance = af._query_finance_data
        original_sales = af._query_finance_sales_fallback
        try:
            af._query_finance_data = fake_finance
            af._query_finance_sales_fallback = fake_sales
            return asyncio.run(af._get_profit_trend_chart(
                "F", date(2025, 1, 1), date(2025, 12, 31), "MONTH"
            ))
        finally:
            af._query_finance_data = original_finance
            af._query_finance_sales_fallback = original_sales

    def test_no_finance_with_sales_uses_fallback(self):
        """finance empty + sales 100k revenue / 60k cost → metrics computed from sales."""
        from datetime import date
        from decimal import Decimal
        async def fake_finance_empty(_fid, _rt, _s, _e): return []
        async def fake_sales(_fid, _s, _e):
            return [
                {"amount": Decimal("100000"), "cost": Decimal("60000"),
                 "order_date": date(2025, 6, 1)},
            ]
        result = self._run_metrics(fake_finance_empty, fake_sales)
        m = {x["metricCode"]: x for x in result}
        assert m["GROSS_PROFIT"]["value"] == 40000
        # 40000/100000*100 = 40 → GREEN
        assert m["GROSS_MARGIN"]["value"] == 40
        assert m["GROSS_MARGIN"]["alertLevel"] == "GREEN"

    def test_fallback_net_profit_stays_null_in_metrics(self):
        """Java line 404 — fallback path explicitly sets net_profit=null. So metrics
        NET_PROFIT.value=null, formattedValue='N/A', alertLevel=GREEN per Java line 461."""
        from datetime import date
        from decimal import Decimal
        async def fake_finance_empty(_fid, _rt, _s, _e): return []
        async def fake_sales(_fid, _s, _e):
            return [
                {"amount": Decimal("100000"), "cost": Decimal("60000"),
                 "order_date": date(2025, 6, 1)},
            ]
        result = self._run_metrics(fake_finance_empty, fake_sales)
        m = {x["metricCode"]: x for x in result}
        assert m["NET_PROFIT"]["value"] is None
        assert m["NET_PROFIT"]["formattedValue"] == "N/A"
        assert m["NET_PROFIT"]["alertLevel"] == "GREEN"
        # Net margin also null (depends on net_profit)
        assert m["NET_MARGIN"]["value"] is None

    def test_fallback_net_profit_computed_in_trendchart(self):
        """trendChart fallback uses gross*0.70 for netProfit (Java line 1440 quirk).
        Distinct from metrics fallback which sets netProfit=null."""
        from datetime import date
        from decimal import Decimal
        async def fake_finance_empty(_fid, _rt, _s, _e): return []
        async def fake_sales(_fid, _s, _e):
            return [
                {"amount": Decimal("100000"), "cost": Decimal("60000"),
                 "order_date": date(2025, 6, 1)},
            ]
        chart = self._run_trend(fake_finance_empty, fake_sales)
        # 4-key points (sales fallback shape, not 6-key)
        assert len(chart["data"]) == 1
        point = chart["data"][0]
        assert set(point.keys()) == {"period", "grossProfit", "netProfit", "grossMargin"}
        # gross = 40000, net = 40000 * 0.70 = 28000.0 → numeric 28000
        assert point["grossProfit"] == 40000
        assert point["netProfit"] == 28000


class TestProfitTrendChartArithmetic:
    """Unit tests for _get_profit_trend_chart + _build_profit_chart_from_finance_data.

    Verifies period aggregation, anomaly clamps, and full options-emission even
    when data is empty.
    """

    def _run_chart(self, fake_finance, fake_sales=None, period="MONTH"):
        """Run _get_profit_trend_chart with seams mocked. Returns chart dict."""
        import asyncio
        from datetime import date
        from smartbi_compat.api import analysis_finance as af

        original_finance = af._query_finance_data
        original_sales = af._query_finance_sales_fallback
        try:
            af._query_finance_data = fake_finance
            if fake_sales is not None:
                af._query_finance_sales_fallback = fake_sales
            return asyncio.run(af._get_profit_trend_chart(
                "F", date(2025, 1, 1), date(2025, 12, 31), period
            ))
        finally:
            af._query_finance_data = original_finance
            af._query_finance_sales_fallback = original_sales

    def test_empty_data_returns_empty_chartdata(self):
        """All seams empty → data=[] but options.yAxis (2) + options.series (5) full."""
        async def fake_empty(*_a, **_k): return []
        chart = self._run_chart(fake_empty, fake_empty)
        assert chart["data"] == []
        assert chart["chartType"] == "LINE_BAR"
        assert chart["title"] == "利润趋势分析"
        assert len(chart["options"]["yAxis"]) == 2
        assert len(chart["options"]["series"]) == 5

    def test_multi_month_aggregates_by_period_key(self):
        """Two REVENUE rows in different months → 2 chart points sorted by period key."""
        from datetime import date
        from decimal import Decimal
        async def fake_finance(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [
                    {"actual_amount": Decimal("50000"), "category": "营业收入",
                     "record_date": date(2025, 1, 15), "upload_id": 1},
                    {"actual_amount": Decimal("70000"), "category": "营业收入",
                     "record_date": date(2025, 3, 20), "upload_id": 1},
                ]
            if rt == "COST":
                return [
                    {"total_cost": Decimal("30000"), "actual_amount": None,
                     "record_date": date(2025, 1, 15), "upload_id": 1},
                ]
            return []
        chart = self._run_chart(fake_finance)
        assert len(chart["data"]) == 2
        # Sorted by period key
        assert chart["data"][0]["period"] == "2025-01"
        assert chart["data"][1]["period"] == "2025-03"
        # Jan: revenue 50k, cost 30k → gross 20k
        assert chart["data"][0]["revenue"] == 50000
        assert chart["data"][0]["cost"] == 30000
        assert chart["data"][0]["grossProfit"] == 20000
        # Mar: revenue 70k, no cost → cost 0, gross 70k
        assert chart["data"][1]["revenue"] == 70000
        assert chart["data"][1]["cost"] == 0
        assert chart["data"][1]["grossProfit"] == 70000

    def test_negative_revenue_minus_cost_emits_negative_gross(self):
        """cost > revenue in a period → grossProfit < 0 emitted (no clamp; only margin clamps)."""
        from datetime import date
        from decimal import Decimal
        async def fake_finance(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [
                    {"actual_amount": Decimal("50000"), "category": "营业收入",
                     "record_date": date(2025, 6, 15), "upload_id": 1},
                ]
            if rt == "COST":
                return [
                    {"total_cost": Decimal("80000"), "actual_amount": None,
                     "record_date": date(2025, 6, 15), "upload_id": 1},
                ]
            return []
        chart = self._run_chart(fake_finance)
        assert len(chart["data"]) == 1
        point = chart["data"][0]
        assert point["grossProfit"] == -30000
        # margin = -30000/50000 * 100 = -60% → in [-100, 100] range, NOT clamped
        # numeric output may be -60 (int) or -60.0 (float) depending on _decimal_to_number
        assert point["grossMargin"] == -60

    def test_period_key_format_yyyy_mm(self):
        """MONTH period key format = 'yyyy-MM' (zero-padded month)."""
        from datetime import date
        from decimal import Decimal
        # Single record on Jan 5, 2025 → key '2025-01' (not '2025-1')
        async def fake_finance(_fid, rt, _s, _e):
            if rt == "REVENUE":
                return [
                    {"actual_amount": Decimal("1000"), "category": "营业收入",
                     "record_date": date(2025, 1, 5), "upload_id": 1},
                ]
            return []
        chart = self._run_chart(fake_finance)
        assert chart["data"][0]["period"] == "2025-01"


class TestCostHelpers:
    """Cost helper unit tests (PR-A; will be supplanted by PR-B arithmetic class)."""

    def test_new_cost_series_entry_key_order(self):
        from smartbi_compat.api.analysis_finance import _new_cost_series_entry
        entry = _new_cost_series_entry(name="原材料", stack="cost")
        assert list(entry.keys()) == ["name", "stack"]
        assert entry == {"name": "原材料", "stack": "cost"}

    def test_cost_category_constants(self):
        from smartbi_compat.api.analysis_finance import (
            COST_CATEGORY_MATERIAL,
            COST_CATEGORY_LABOR,
            COST_CATEGORY_OVERHEAD,
        )
        assert COST_CATEGORY_MATERIAL == "原材料"
        assert COST_CATEGORY_LABOR == "人工"
        assert COST_CATEGORY_OVERHEAD == "制造费用"
