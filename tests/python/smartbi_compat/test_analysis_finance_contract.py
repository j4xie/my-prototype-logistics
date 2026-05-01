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
        """Verify 501 path for un-ported analysisTypes.

        C3 robust pattern: list reflects current main state at time of this PR.
        profit/payable/cost are real impl; receivable + budget remain 501 until their PR-As merge.
        Sister chats merging concurrently must rebase + regenerate this list (drop their endpoint).
        """
        for at in ["receivable", "budget"]:
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


class TestAnalysisFinanceCost:
    """F999 byte-shape gate for cost per-type path (analysisType=cost, real impl).

    Mocks _query_finance_data to return [] (matches F999 empty state).
    Compares response['data'] against recorded golden (flat shape via golden conversion in A.2).
    """

    def test_f999_cost_data_keys_match_golden(self, client, monkeypatch):
        """Sanity: top-level data keys order matches Jackson HashMap order in golden.

        Golden order (Apr 29 recorded): [endDate, trendChart, startDate, structureChart]
        """
        async def fake_query(_factory_id, _record_type, _start, _end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_query,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31&analysisType=cost",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_data_keys = list(resp.json()["data"].keys())

        with io.open(GOLDEN_DIR / "analysis-finance-F999-cost.json", encoding="utf-8") as f:
            golden_data_keys = list(json.load(f)["data"].keys())

        assert py_data_keys == golden_data_keys, (
            f"data key order mismatch:\n"
            f"  python: {py_data_keys}\n"
            f"  golden: {golden_data_keys}"
        )

    def test_f999_cost_byte_shape(self, client, monkeypatch):
        """Full byte-shape compare on data block (envelope skipped via _strip_volatile).

        Mocks _query_finance_data to return [] (F999 empty state).
        Compares response['data'] against recorded golden after stripping volatile keys.
        """
        async def fake_query(_factory_id, _record_type, _start, _end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_query,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance"
            "?startDate=2025-01-01&endDate=2025-12-31&analysisType=cost",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200

        py_data = _strip_volatile(resp.json()["data"])

        with io.open(GOLDEN_DIR / "analysis-finance-F999-cost.json", encoding="utf-8") as f:
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
                f"BYTE SHAPE MISMATCH (cost) on {list(diffs.keys())}\n"
                f"{json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}"
            )


class TestCostHelpers:
    """Cost helper unit tests — helper-level direct coverage (PR-A baseline).

    Companion to TestCostStructureArithmetic + TestCostTrendArithmetic
    (chart-function-level coverage). Defense in depth: same logic exercised
    at two layers — if one layer's mock rots, the other still catches regression.
    """

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

    def test_create_pie_data_item_total_positive(self):
        from smartbi_compat.api.analysis_finance import _create_pie_data_item
        from decimal import Decimal
        item = _create_pie_data_item("原材料", Decimal("60000"), Decimal("100000"))
        assert list(item.keys()) == ["category", "value", "percentage"]
        assert item["category"] == "原材料"
        assert item["value"] == 60000  # int via _decimal_to_number
        # Java setScale(2, HALF_UP): 60.00 → Jackson trims → 60.0; dict-eq tolerates 60 == 60.0
        assert item["percentage"] in (60, 60.0)

    def test_create_pie_data_item_total_zero_returns_zero_percentage(self):
        from smartbi_compat.api.analysis_finance import _create_pie_data_item
        from decimal import Decimal
        item = _create_pie_data_item("原材料", Decimal("0"), Decimal("0"))
        assert item["percentage"] == 0  # Java line 1572 returns BigDecimal.ZERO

    def test_create_pie_data_item_percentage_rounding(self):
        from smartbi_compat.api.analysis_finance import _create_pie_data_item
        from decimal import Decimal
        # 1/3 * 100 = 33.3333... → Java 2-stage:
        # divide(SCALE=4 HALF_UP) = 0.3333, multiply(100) = 33.3300, setScale(2 HALF_UP) = 33.33
        item = _create_pie_data_item("X", Decimal("1"), Decimal("3"))
        assert item["percentage"] == 33.33

    def test_aggregate_cost_by_period_single_month(self):
        from smartbi_compat.api.analysis_finance import _aggregate_cost_by_period
        from decimal import Decimal
        from datetime import date
        rows = [{
            "material_cost": Decimal("60000"),
            "labor_cost": Decimal("30000"),
            "overhead_cost": Decimal("10000"),
            "total_cost": Decimal("100000"),
            "record_date": date(2025, 6, 15),
        }]
        result = _aggregate_cost_by_period(rows, "MONTH")
        assert "2025-06" in result
        slot = result["2025-06"]
        assert slot[0] == Decimal("60000")  # material
        assert slot[1] == Decimal("30000")  # labor
        assert slot[2] == Decimal("10000")  # overhead
        assert slot[3] == Decimal("100000")  # total

    def test_aggregate_cost_by_period_negative_abs_defensive(self):
        from smartbi_compat.api.analysis_finance import _aggregate_cost_by_period
        from decimal import Decimal
        from datetime import date
        # Java P0-1 Bug B: Excel 历史数据可能存负值 cost，所有成本项 .abs() 强制取正
        rows = [{
            "material_cost": Decimal("-50000"),  # negative
            "labor_cost": None,  # None → skip per Rule 1
            "overhead_cost": Decimal("0"),  # zero is valid (not None)
            "total_cost": Decimal("-50000"),
            "record_date": date(2025, 6, 1),
        }]
        result = _aggregate_cost_by_period(rows, "MONTH")
        slot = result["2025-06"]
        assert slot[0] == Decimal("50000")  # abs(-50000)
        assert slot[1] == Decimal("0")  # None skipped, slot remains 0
        assert slot[2] == Decimal("0")  # 0 valid contribution
        assert slot[3] == Decimal("50000")  # abs(-50000)

    @pytest.mark.asyncio
    async def test_get_cost_trend_chart_empty_returns_full_options(self, monkeypatch):
        from smartbi_compat.api.analysis_finance import _get_cost_trend_chart
        from datetime import date

        async def fake_query(factory_id, record_type, start, end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_query,
        )

        result = await _get_cost_trend_chart("F999", date(2025, 1, 1), date(2025, 12, 31))
        assert result["chartType"] == "BAR"
        assert result["title"] == "成本趋势分析"
        assert result["data"] == []
        assert result["options"]["stack"] is True
        assert len(result["options"]["series"]) == 3
        assert result["options"]["series"][0] == {"name": "原材料", "stack": "cost"}
        assert result["options"]["series"][1] == {"name": "人工", "stack": "cost"}
        assert result["options"]["series"][2] == {"name": "制造费用", "stack": "cost"}


class TestCostStructureArithmetic:
    """Unit tests for _get_cost_structure_chart arithmetic branches.

    Direct chart-function-level calls (no HTTP/JWT) — exercises the full
    structure chart computation: aggregation across cost categories, total>0
    gating for chart_data emission, percentage rounding two-stage scale,
    and abs() defensive against negative cost rows.

    Companion to TestCostHelpers which calls _create_pie_data_item directly.
    """

    def _run_chart(self, fake_finance):
        """Run _get_cost_structure_chart with _query_finance_data mocked.

        Returns chart dict from line 1157-1210 with chartType=PIE.
        """
        import asyncio
        from datetime import date
        from smartbi_compat.api import analysis_finance as af

        original = af._query_finance_data
        try:
            af._query_finance_data = fake_finance
            return asyncio.run(af._get_cost_structure_chart(
                "F", date(2025, 1, 1), date(2025, 12, 31)
            ))
        finally:
            af._query_finance_data = original

    def test_total_zero_emits_empty_data(self):
        """All cost fields = 0 → totalCost=0 → chart_data=[] but options complete.

        Java line 1191: `if total_cost > Decimal("0")` gate — false when total=0.
        Empty data list, but showPercentage + 3 colors still emitted.
        """
        async def fake_zero(*_a, **_k):
            return []  # no rows = total 0
        chart = self._run_chart(fake_zero)
        assert chart["chartType"] == "PIE"
        assert chart["title"] == "成本结构分析"
        assert chart["data"] == []
        assert chart["options"]["showPercentage"] is True
        assert chart["options"]["colors"] == ["#5470c6", "#91cc75", "#fac858"]

    def test_three_categories_emit_three_pie_items(self):
        """totalCost>0 → 3 pie items in order [material, labor, overhead].

        Verifies LinkedHashMap order from Java line 521-526 (NOT alphabetic),
        matched by Python list.append sequence.
        """
        from datetime import date
        from decimal import Decimal
        async def fake_positive(*_a, **_k):
            return [{
                "material_cost": Decimal("60000"),
                "labor_cost":    Decimal("30000"),
                "overhead_cost": Decimal("10000"),
                "total_cost":    Decimal("100000"),
                "record_date":   date(2025, 6, 1),
                "upload_id":     1,
            }]
        chart = self._run_chart(fake_positive)
        assert len(chart["data"]) == 3
        # Order: material, labor, overhead (Java COST_CATEGORY_* literals)
        assert chart["data"][0]["category"] == "原材料"
        assert chart["data"][0]["value"]    == 60000
        assert chart["data"][1]["category"] == "人工"
        assert chart["data"][1]["value"]    == 30000
        assert chart["data"][2]["category"] == "制造费用"
        assert chart["data"][2]["value"]    == 10000
        # Percentages: 60/30/10 of 100 → 60.00 / 30.00 / 10.00 (HALF_UP, dict-eq tolerates int)
        assert chart["data"][0]["percentage"] in (60, 60.0)
        assert chart["data"][1]["percentage"] in (30, 30.0)
        assert chart["data"][2]["percentage"] in (10, 10.0)

    def test_percentage_rounding_half_up(self):
        """Percentage HALF_UP at chart-function level — 1/3 ≈ 33.33 (not 33.34).

        Wires to _create_pie_data_item which uses two-stage Decimal arithmetic;
        this test exercises it through the chart path (vs TestCostHelpers which
        calls _create_pie_data_item directly).
        """
        from datetime import date
        from decimal import Decimal
        async def fake_thirds(*_a, **_k):
            # material 1, labor 1, overhead 1 → total 3 → each is 1/3 = 33.33%
            return [{
                "material_cost": Decimal("1"),
                "labor_cost":    Decimal("1"),
                "overhead_cost": Decimal("1"),
                "total_cost":    Decimal("3"),
                "record_date":   date(2025, 6, 1),
                "upload_id":     1,
            }]
        chart = self._run_chart(fake_thirds)
        # Java 2-stage: (1/3).setScale(4, HALF_UP) = 0.3333; * 100 = 33.3300; setScale(2, HALF_UP) = 33.33
        assert chart["data"][0]["percentage"] == 33.33
        assert chart["data"][1]["percentage"] == 33.33
        assert chart["data"][2]["percentage"] == 33.33

    def test_negative_cost_abs_defensive_in_structure(self):
        """Negative cost values in source rows → abs() at structure aggregation.

        Java P0-1 Bug B: Excel 历史数据可能存负值 cost. Python line 1172-1184
        applies `abs(_to_decimal(...))` per category before summing.
        Verified at structure-level (top-level sum), distinct from
        TestCostHelpers.test_aggregate_cost_by_period_negative_abs_defensive
        which tests aggregation per-period.
        """
        from datetime import date
        from decimal import Decimal
        async def fake_negatives(*_a, **_k):
            return [{
                "material_cost": Decimal("-50000"),  # negative
                "labor_cost":    Decimal("-20000"),  # negative
                "overhead_cost": Decimal("-30000"),  # negative
                "total_cost":    Decimal("-100000"),
                "record_date":   date(2025, 6, 1),
                "upload_id":     1,
            }]
        chart = self._run_chart(fake_negatives)
        # All three categories abs()'d → positive → total = 100k → percentages 50/20/30
        assert len(chart["data"]) == 3
        assert chart["data"][0]["value"] == 50000  # abs(-50000)
        assert chart["data"][1]["value"] == 20000  # abs(-20000)
        assert chart["data"][2]["value"] == 30000  # abs(-30000)

    def test_create_pie_data_item_total_zero_value_positive_percentage_zero(self):
        """_create_pie_data_item edge: total=0 with value>0 → percentage=0.

        Java line 220 gate `if total > Decimal("0")` is false when total=0;
        percentage hardcoded to Decimal("0") regardless of value.

        Distinct from TestCostHelpers.test_create_pie_data_item_total_zero_returns_zero_percentage
        which uses value=0 (and total=0). This test uses value>0 to confirm
        the gate decision is total-driven, not value-driven.
        """
        from decimal import Decimal
        from smartbi_compat.api.analysis_finance import _create_pie_data_item
        item = _create_pie_data_item("X", Decimal("50"), Decimal("0"))
        assert item["category"] == "X"
        assert item["value"] == 50  # value still emitted (Java line 1567 unaffected)
        assert item["percentage"] == 0  # gate false → BigDecimal.ZERO

    def test_create_pie_data_item_percentage_calc_two_stage_scale(self):
        """Verify two-stage Decimal arithmetic: scale=4 intermediate, scale=2 final.

        Java line 1571: divide(total, SCALE=4, HALF_UP) → multiply(100) → setScale(2, HALF_UP).

        Test value 1/7 exercises full intermediate scale precision:
          1/7 = 0.142857142857...
          quantize(0.0001, HALF_UP) = 0.1429
          * 100 = 14.2900
          quantize(0.01, HALF_UP) = 14.29
        """
        from decimal import Decimal
        from smartbi_compat.api.analysis_finance import _create_pie_data_item
        item = _create_pie_data_item("X", Decimal("1"), Decimal("7"))
        assert item["value"] == 1
        assert item["percentage"] == 14.29


class TestCostTrendArithmetic:
    """Unit tests for _get_cost_trend_chart + _aggregate_cost_by_period + _get_period_key.

    Verifies period aggregation, sort-by-period-key behavior, stacked series
    structure, abs() defensive at aggregation level, and period_key format
    for MONTH/QUARTER/WEEK/DAY (incl. year-boundary regression for WEEK
    after the C1 calendar-year fix per `python-java-port.md` Rule 2).
    """

    def _run_chart(self, fake_finance, period="MONTH"):
        """Run _get_cost_trend_chart with _query_finance_data mocked.

        Returns chart dict from line 1213-1259 with chartType=BAR.
        """
        import asyncio
        from datetime import date
        from smartbi_compat.api import analysis_finance as af

        original = af._query_finance_data
        try:
            af._query_finance_data = fake_finance
            return asyncio.run(af._get_cost_trend_chart(
                "F", date(2025, 1, 1), date(2025, 12, 31), period
            ))
        finally:
            af._query_finance_data = original

    def test_empty_data_returns_empty_chartdata(self):
        """Empty rows → chart_data=[] but options.stack + options.series (3 entries) full.

        Java line 553-562 emits chart_data per period; with no periods, list is empty.
        Options always emitted (stack=True + 3 series entries for material/labor/overhead).
        """
        async def fake_empty(*_a, **_k): return []
        chart = self._run_chart(fake_empty)
        assert chart["chartType"] == "BAR"
        assert chart["title"] == "成本趋势分析"
        assert chart["data"] == []
        assert chart["options"]["stack"] is True
        assert len(chart["options"]["series"]) == 3
        assert chart["options"]["series"][0] == {"name": "原材料",   "stack": "cost"}
        assert chart["options"]["series"][1] == {"name": "人工",     "stack": "cost"}
        assert chart["options"]["series"][2] == {"name": "制造费用", "stack": "cost"}

    def test_multi_month_aggregates_by_period_key(self):
        """Three rows in different months → 3 chart points sorted by period key.

        Java TreeMap → Python sorted(). Verifies January < March < June key order.
        """
        from datetime import date
        from decimal import Decimal
        async def fake_multi_month(*_a, **_k):
            return [
                {"material_cost": Decimal("10000"), "labor_cost": Decimal("5000"),
                 "overhead_cost": Decimal("2000"), "total_cost": Decimal("17000"),
                 "record_date": date(2025, 6, 15), "upload_id": 1},
                {"material_cost": Decimal("20000"), "labor_cost": Decimal("8000"),
                 "overhead_cost": Decimal("3000"), "total_cost": Decimal("31000"),
                 "record_date": date(2025, 1, 10), "upload_id": 2},
                {"material_cost": Decimal("15000"), "labor_cost": Decimal("6000"),
                 "overhead_cost": Decimal("2500"), "total_cost": Decimal("23500"),
                 "record_date": date(2025, 3, 5), "upload_id": 3},
            ]
        chart = self._run_chart(fake_multi_month)
        assert len(chart["data"]) == 3
        # Sorted ascending by period key (January first, June last)
        assert chart["data"][0]["period"] == "2025-01"
        assert chart["data"][1]["period"] == "2025-03"
        assert chart["data"][2]["period"] == "2025-06"
        # Spot-check materialCost values flow through correctly
        assert chart["data"][0]["materialCost"] == 20000  # Jan
        assert chart["data"][1]["materialCost"] == 15000  # Mar
        assert chart["data"][2]["materialCost"] == 10000  # Jun

    def test_stacked_series_three_categories_per_period(self):
        """Each period emits 5 keys: [period, materialCost, laborCost, overheadCost, totalCost].

        Java line 553-562 LinkedHashMap put-order. Verifies dict shape per period
        + that options.series has exactly 3 (NOT 4 — total isn't a stacked series).
        """
        from datetime import date
        from decimal import Decimal
        async def fake_one_month(*_a, **_k):
            return [{
                "material_cost": Decimal("60000"),
                "labor_cost":    Decimal("30000"),
                "overhead_cost": Decimal("10000"),
                "total_cost":    Decimal("100000"),
                "record_date":   date(2025, 6, 1),
                "upload_id":     1,
            }]
        chart = self._run_chart(fake_one_month)
        assert len(chart["data"]) == 1
        point = chart["data"][0]
        # 5 keys in put-order
        assert list(point.keys()) == ["period", "materialCost", "laborCost", "overheadCost", "totalCost"]
        assert point["period"]       == "2025-06"
        assert point["materialCost"] == 60000
        assert point["laborCost"]    == 30000
        assert point["overheadCost"] == 10000
        assert point["totalCost"]    == 100000
        # Series only stacks the 3 cost categories (not total)
        assert len(chart["options"]["series"]) == 3

    def test_negative_cost_abs_defensive_in_trend_aggregation(self):
        """Negative cost rows → _aggregate_cost_by_period applies .abs() per slot.

        Java P0-1 Bug B (line 1452-1467 setdefault accumulator). Verifies abs()
        at aggregate-helper level, exposed through chart function. Distinct from
        test_negative_cost_abs_defensive_in_structure which tests structure-chart's
        own sum() (also abs-defensive at line 1172-1184 of analysis_finance.py).
        """
        from datetime import date
        from decimal import Decimal
        async def fake_negatives(*_a, **_k):
            return [{
                "material_cost": Decimal("-40000"),
                "labor_cost":    Decimal("-15000"),
                "overhead_cost": Decimal("-5000"),
                "total_cost":    Decimal("-60000"),
                "record_date":   date(2025, 6, 1),
                "upload_id":     1,
            }]
        chart = self._run_chart(fake_negatives)
        assert len(chart["data"]) == 1
        point = chart["data"][0]
        assert point["materialCost"] == 40000  # abs(-40000)
        assert point["laborCost"]    == 15000  # abs(-15000)
        assert point["overheadCost"] == 5000   # abs(-5000)
        assert point["totalCost"]    == 60000  # abs(-60000)

    def test_get_period_key_format_yyyy_mm_yyyy_qN_yyyy_Wnn(self):
        """Direct unit test of _get_period_key for all 4 period types.

        WEEK covers both mid-year (no divergence) and year-boundary cases
        (2024-12-30 / 2027-01-01) where ISO year ≠ calendar year. Verifies
        the C1 fix per `python-java-port.md` Rule 2 (calendar year matches
        Java `date.getYear()`).

        Java FinanceAnalysisServiceImpl.getPeriodKey line 1472-1487.
        """
        from datetime import date
        from smartbi_compat.api.analysis_finance import _get_period_key

        # MONTH: yyyy-MM (zero-padded month) — Java line 1486 default branch
        assert _get_period_key(date(2025, 1, 5), "MONTH")  == "2025-01"
        assert _get_period_key(date(2025, 6, 15), "MONTH") == "2025-06"
        assert _get_period_key(date(2025, 12, 31), "MONTH") == "2025-12"

        # QUARTER: yyyy-Qn — Java line 1483-1485
        assert _get_period_key(date(2025, 1, 5),   "QUARTER") == "2025-Q1"
        assert _get_period_key(date(2025, 4, 15),  "QUARTER") == "2025-Q2"
        assert _get_period_key(date(2025, 8, 20),  "QUARTER") == "2025-Q3"
        assert _get_period_key(date(2025, 11, 10), "QUARTER") == "2025-Q4"

        # WEEK: yyyy-Wnn (ISO week 2-digit zero-padded, calendar year per Rule 2)
        # Mid-year (no boundary divergence; ISO year == calendar year):
        assert _get_period_key(date(2025, 6, 15), "WEEK") == "2025-W24"
        assert _get_period_key(date(2025, 1, 15), "WEEK") == "2025-W03"
        # Year-end boundary (calendar=2024, ISO calendar=(2025, 1, 1)):
        # Java date.getYear()=2024, weekOfYear=1 → "2024-W01"
        # Pre-fix Python emitted "2025-W01" (Rule 2 violation); post-fix correct.
        assert _get_period_key(date(2024, 12, 30), "WEEK") == "2024-W01"
        # Year-start boundary (calendar=2027, ISO calendar=(2026, 53, 5)):
        # Java date.getYear()=2027, weekOfYear=53 → "2027-W53"
        # Pre-fix Python emitted "2026-W53"; post-fix correct.
        assert _get_period_key(date(2027, 1, 1), "WEEK") == "2027-W53"

        # DAY: yyyy-MM-dd — Java line 1474-1476
        assert _get_period_key(date(2025, 6, 15), "DAY") == "2025-06-15"


class TestBudgetAchievementChart:
    """F999 byte-shape gate + arithmetic depth tests for /budget-achievement."""

    def test_f999_budget_achievement_data_keys_match_golden(self, client, monkeypatch):
        """Sanity: data keys order matches Java golden."""
        async def fake_finance_empty(_factory_id, _record_type, _start, _end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_finance_empty,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance/budget-achievement"
            "?year=2025&metric=revenue",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_data_keys = list(resp.json()["data"].keys())

        with io.open(GOLDEN_DIR / "analysis-finance-F999-budget-achievement.json", encoding="utf-8") as f:
            golden_data_keys = list(json.load(f)["data"].keys())

        assert py_data_keys == golden_data_keys, (
            f"data key order mismatch:\n  python: {py_data_keys}\n  golden: {golden_data_keys}"
        )

    def test_f999_budget_achievement_byte_shape(self, client, monkeypatch):
        """Full byte-shape compare on data block for empty F999."""
        async def fake_finance_empty(_factory_id, _record_type, _start, _end):
            return []
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_finance._query_finance_data",
            fake_finance_empty,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance/budget-achievement"
            "?year=2025&metric=revenue",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200

        py_data = _strip_volatile(resp.json()["data"])
        with io.open(GOLDEN_DIR / "analysis-finance-F999-budget-achievement.json", encoding="utf-8") as f:
            golden_data = _strip_volatile(json.load(f)["data"])

        if py_data != golden_data:
            diffs = {}
            for k in set(py_data.keys()) | set(golden_data.keys()):
                if py_data.get(k) != golden_data.get(k):
                    diffs[k] = {"python": py_data.get(k), "golden": golden_data.get(k)}
            pytest.fail(
                f"BYTE SHAPE MISMATCH (budget-achievement) on {list(diffs.keys())}\n"
                f"{json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}"
            )

    def _run_chart(self, fake_finance):
        """Call _get_budget_achievement_chart directly via asyncio."""
        import asyncio
        from smartbi_compat.api import analysis_finance as af
        original = af._query_finance_data
        try:
            af._query_finance_data = fake_finance
            return asyncio.run(af._get_budget_achievement_chart("F", 2025, "revenue"))
        finally:
            af._query_finance_data = original

    def test_budget_amount_always_returned_regardless_of_category(self):
        """audit I-5 fix: Java fall-through returns budget_amount regardless of category match."""
        from datetime import date as d
        from decimal import Decimal
        async def fake(_fid, rt, _s, _e):
            return [
                {"record_date": d(2025, 6, 1), "category": "其他类",
                 "budget_amount": Decimal("100"), "actual_amount": Decimal("80")},
            ]
        chart = self._run_chart(fake)
        june = chart["data"][5]
        assert june["month"] == "6月"
        assert june["budget"] == 100
        assert june["actual"] == 80

    def test_alert_level_thresholds(self):
        """Verify >120 RED, >100 YELLOW, else GREEN."""
        from datetime import date as d
        from decimal import Decimal

        async def fake_red(_fid, _rt, _s, _e):
            return [{"record_date": d(2025, 1, 1), "category": "x",
                     "budget_amount": Decimal("100"), "actual_amount": Decimal("130")}]
        chart = self._run_chart(fake_red)
        assert chart["data"][0]["alertLevel"] == "RED"

        async def fake_yellow(_fid, _rt, _s, _e):
            return [{"record_date": d(2025, 1, 1), "category": "x",
                     "budget_amount": Decimal("100"), "actual_amount": Decimal("110")}]
        chart = self._run_chart(fake_yellow)
        assert chart["data"][0]["alertLevel"] == "YELLOW"

        async def fake_green(_fid, _rt, _s, _e):
            return [{"record_date": d(2025, 1, 1), "category": "x",
                     "budget_amount": Decimal("100"), "actual_amount": Decimal("100")}]
        chart = self._run_chart(fake_green)
        assert chart["data"][0]["alertLevel"] == "GREEN"

    def test_zero_budget_zero_achievement_rate(self):
        """budget=0 → rate=0 (avoid div0) per Java line 1158-1160."""
        from datetime import date as d
        from decimal import Decimal
        async def fake(_fid, _rt, _s, _e):
            return [{"record_date": d(2025, 6, 1), "category": "x",
                     "budget_amount": Decimal("0"), "actual_amount": Decimal("50")}]
        chart = self._run_chart(fake)
        june = chart["data"][5]
        assert june["budget"] == 0
        assert june["actual"] == 50
        assert june["achievementRate"] == 0

    def test_always_emits_12_months(self):
        """Per Java line 1132-1135: pre-fill all 12 months even with 0 records."""
        async def fake_empty(*_): return []
        chart = self._run_chart(fake_empty)
        assert len(chart["data"]) == 12
        for i, point in enumerate(chart["data"], start=1):
            assert point["month"] == f"{i}月"
            assert point["budget"] == 0
            assert point["actual"] == 0
            assert point["alertLevel"] == "GREEN"


class TestYoYMoMComparisonChart:
    """F999 byte-shape gate + arithmetic tests for /yoy-mom."""

    def test_f999_yoy_mom_data_keys_match_golden(self, client, monkeypatch):
        """Sanity: data keys order matches Java golden."""
        async def fake_finance(*_): return []
        async def fake_sales(*_): return []
        monkeypatch.setattr("smartbi_compat.api.analysis_finance._query_finance_data", fake_finance)
        monkeypatch.setattr("smartbi_compat.api.analysis_finance._query_finance_sales_fallback", fake_sales)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance/yoy-mom"
            "?periodType=MONTH&startPeriod=2026-01&metric=revenue",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_data_keys = list(resp.json()["data"].keys())
        with io.open(GOLDEN_DIR / "analysis-finance-F999-yoy-mom.json", encoding="utf-8") as f:
            golden_data_keys = list(json.load(f)["data"].keys())
        assert py_data_keys == golden_data_keys

    def test_f999_yoy_mom_byte_shape(self, client, monkeypatch):
        """Full byte-shape compare on data block.

        F999 golden was recorded with real sales data for 2026-01 (currentValue=9920899.9)
        and no data for 2025-01 (lastYear) or 2025-12 (lastPeriod).
        We inject exactly that shape so Python output matches the Java golden.
        """
        from datetime import date as d
        from decimal import Decimal

        async def fake_finance(*_): return []

        async def fake_sales(_fid, start, _end):
            # 2026-01 → current period: inject amount matching golden's currentValue 9920899.9
            if start == d(2026, 1, 1):
                return [{"amount": Decimal("9920899.9"), "cost": Decimal("0")}]
            # 2025-01 (lastYear) and 2025-12 (lastPeriod) → no data
            return []

        monkeypatch.setattr("smartbi_compat.api.analysis_finance._query_finance_data", fake_finance)
        monkeypatch.setattr("smartbi_compat.api.analysis_finance._query_finance_sales_fallback", fake_sales)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/finance/yoy-mom"
            "?periodType=MONTH&startPeriod=2026-01&metric=revenue",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200
        py_data = _strip_volatile(resp.json()["data"])
        with io.open(GOLDEN_DIR / "analysis-finance-F999-yoy-mom.json", encoding="utf-8") as f:
            golden_data = _strip_volatile(json.load(f)["data"])
        if py_data != golden_data:
            diffs = {k: {"py": py_data.get(k), "g": golden_data.get(k)}
                     for k in set(py_data) | set(golden_data)
                     if py_data.get(k) != golden_data.get(k)}
            pytest.fail(f"BYTE MISMATCH: {json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}")

    def _run_chart(self, fake_sales=None, fake_finance=None, period_type="MONTH",
                    start_period="2026-01", end_period=None, metric="revenue"):
        import asyncio
        from smartbi_compat.api import analysis_finance as af
        orig_sales = af._query_finance_sales_fallback
        orig_finance = af._query_finance_data
        try:
            if fake_sales is not None:
                af._query_finance_sales_fallback = fake_sales
            if fake_finance is not None:
                af._query_finance_data = fake_finance
            return asyncio.run(af._get_yoy_mom_chart(
                "F", period_type, start_period, end_period, metric
            ))
        finally:
            af._query_finance_sales_fallback = orig_sales
            af._query_finance_data = orig_finance

    def test_month_periodtype_yoy_mom_calc(self):
        """yoy = (cur-lastYear)/lastYear*100; mom = (cur-lastMonth)/lastMonth*100."""
        from datetime import date as d
        from decimal import Decimal
        async def fake_sales(_fid, start, _end):
            # Inject different revenue for current/lastYear/lastMonth months
            if start == d(2026, 1, 1): return [{"amount": Decimal("100"), "cost": Decimal("0")}]
            if start == d(2025, 1, 1): return [{"amount": Decimal("80"), "cost": Decimal("0")}]
            if start == d(2025, 12, 1): return [{"amount": Decimal("90"), "cost": Decimal("0")}]
            return []
        chart = self._run_chart(fake_sales=fake_sales)
        point = chart["data"][0]
        assert point["currentValue"] == 100
        assert point["lastYearValue"] == 80
        assert point["lastPeriodValue"] == 90
        # yoy = (100-80)/80*100 = 25
        assert point["yoyGrowthRate"] == 25
        # mom = (100-90)/90*100 = 11.11 (rounded HALF_UP)
        assert point["momGrowthRate"] == 11.11

    def test_quarter_periodtype_dispatches_to_quarter_calc(self):
        async def fake_sales(*_): return []
        chart = self._run_chart(fake_sales=fake_sales, period_type="QUARTER", start_period="2026-Q1")
        assert chart["data"][0]["period"] == "2026-Q1"

    def test_month_range_requires_end_period(self):
        """audit I-8: MONTH_RANGE without endPeriod → HTTP 400."""
        from fastapi import HTTPException
        import asyncio
        from smartbi_compat.api import analysis_finance as af
        async def fake_sales(*_): return []
        orig_sales = af._query_finance_sales_fallback
        try:
            af._query_finance_sales_fallback = fake_sales
            with pytest.raises(HTTPException) as exc_info:
                asyncio.run(af._get_yoy_mom_chart("F", "MONTH_RANGE", "2026-01", None, "revenue"))
            assert exc_info.value.status_code == 400
            assert "endPeriod required" in str(exc_info.value.detail)
        finally:
            af._query_finance_sales_fallback = orig_sales

    def test_unknown_periodtype_falls_back_to_month(self):
        """Unknown periodType → MONTH default + warning log."""
        async def fake_sales(*_): return []
        chart = self._run_chart(fake_sales=fake_sales, period_type="WEIRD", start_period="2026-01")
        # Falls back to MONTH → emits 1 point
        assert len(chart["data"]) == 1
        assert chart["data"][0]["period"] == "2026-01"

    def test_zero_base_growth_rate_zero(self):
        """lastYearValue=0 → yoyGrowthRate=0 (avoid div0 per Java line 1839-1843)."""
        async def fake_sales(*_): return []  # all periods empty → all values 0
        chart = self._run_chart(fake_sales=fake_sales)
        point = chart["data"][0]
        assert point["currentValue"] == 0
        assert point["lastYearValue"] == 0
        assert point["yoyGrowthRate"] == 0
        assert point["momGrowthRate"] == 0

    def test_cost_metric_uses_finance_data_not_sales(self):
        """audit I-6: metric=cost should query _query_finance_data (COST), not sales."""
        from decimal import Decimal
        finance_calls = []
        sales_calls = []
        async def fake_finance(_fid, rt, _s, _e):
            finance_calls.append(rt)
            return [{"total_cost": Decimal("500")}]
        async def fake_sales(*_):
            sales_calls.append(1)
            return []
        chart = self._run_chart(fake_sales=fake_sales, fake_finance=fake_finance, metric="cost")
        # Cost branch should call _query_finance_data with "COST" 3 times (current + lastYear + lastPeriod)
        assert finance_calls == ["COST", "COST", "COST"]
        # Sales should NOT be called for cost metric
        assert sales_calls == []
        # currentValue = 500 (from total_cost sum)
        assert chart["data"][0]["currentValue"] == 500
