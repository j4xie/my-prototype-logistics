"""Byte-shape contract gate for /analysis/inventory per-type endpoint.

Java reference:
  - Controller: SmartBIAnalysisController.getInventoryAnalysis line 411-448
  - Service: InventoryHealthAnalysisServiceImpl line 50-1352

Test pattern (mirrors sister test_analysis_finance_contract.py):
  - JWT_SECRET set in os.environ BEFORE importing production code
  - Load production main via importlib (gets full middleware stack)
  - Hit /api/mobile/F999/smart-bi/analysis/inventory via TestClient with F999 JWT
  - Freeze date.today() to 2026-05-02 (golden record date, Beijing time)
  - Mock _fetch_all to return [] (F999 empty DB) — same empty-data shape as Java
  - Compare response['data'] to recorded golden['response']['data']
  - Strip volatile keys (timestamp/generatedAt/lastUpdated/cacheExpireAt)

Golden source: recorded from test env Java backend (port 10011) with empty F999 DB.
Golden record date: 2026-05-02 (Beijing time, baked into Java timestamp response field).

Note: inventory goldens use wrapper structure {verb, path, factory, response, _meta}
unlike finance goldens which are raw response. Load via golden["response"]["data"].
"""
from __future__ import annotations

import difflib
import importlib.util
import json
import os
import sys
from datetime import date as real_date
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

# Golden record date (Beijing time when goldens were captured from Java test env)
GOLDEN_RECORD_DATE = real_date(2026, 5, 2)


def _load_production_main():
    """Import backend/python/main.py as a module to get production FastAPI app
    with all middleware (JWT auth, CORS, exception handlers) registered.

    Mirrors sister test_analysis_finance_contract.py pattern.
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


class TestAnalysisInventoryTurnover:
    """F999 byte-shape gate for turnover mode (analysisType=turnover)."""

    def test_f999_turnover_byte_shape(self, client, monkeypatch):
        """Full byte-shape compare on data block vs Java golden (empty DB, frozen date)."""
        from smartbi_compat.api import analysis_inventory

        # Freeze date.today() to golden record date
        FROZEN = GOLDEN_RECORD_DATE

        class FrozenDate(real_date):
            @classmethod
            def today(cls):
                return FROZEN

        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        # Mock _fetch_all to return [] (F999 empty DB — same shape as Java with no data)
        async def empty_fetch(*_args):
            return []

        monkeypatch.setattr(analysis_inventory, "_fetch_all", empty_fetch)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/inventory"
            "?startDate=2025-01-01&endDate=2025-01-31&analysisType=turnover",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"

        py_data = _strip_volatile(resp.json()["data"])

        with open(GOLDEN_DIR / "analysis-inventory-F999-turnover.json", encoding="utf-8") as f:
            golden_data = _strip_volatile(json.load(f)["response"]["data"])

        if py_data != golden_data:
            py_str = json.dumps(py_data, ensure_ascii=False, indent=2, sort_keys=True)
            golden_str = json.dumps(golden_data, ensure_ascii=False, indent=2, sort_keys=True)
            diff = "\n".join(difflib.unified_diff(
                golden_str.splitlines(), py_str.splitlines(),
                fromfile="golden", tofile="python", lineterm="", n=5,
            ))
            pytest.fail(f"F999 turnover byte-shape mismatch:\n{diff}")


class TestAnalysisInventoryExpiry:
    """F999 byte-shape gate for expiry mode (analysisType=expiry)."""

    def test_f999_expiry_byte_shape(self, client, monkeypatch):
        """Full byte-shape compare on data block vs Java golden (empty DB, frozen date)."""
        from smartbi_compat.api import analysis_inventory

        FROZEN = GOLDEN_RECORD_DATE

        class FrozenDate(real_date):
            @classmethod
            def today(cls):
                return FROZEN

        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        async def empty_fetch(*_args):
            return []

        monkeypatch.setattr(analysis_inventory, "_fetch_all", empty_fetch)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/inventory"
            "?startDate=2025-01-01&endDate=2025-01-31&analysisType=expiry",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"

        py_data = _strip_volatile(resp.json()["data"])

        with open(GOLDEN_DIR / "analysis-inventory-F999-expiry.json", encoding="utf-8") as f:
            golden_data = _strip_volatile(json.load(f)["response"]["data"])

        if py_data != golden_data:
            py_str = json.dumps(py_data, ensure_ascii=False, indent=2, sort_keys=True)
            golden_str = json.dumps(golden_data, ensure_ascii=False, indent=2, sort_keys=True)
            diff = "\n".join(difflib.unified_diff(
                golden_str.splitlines(), py_str.splitlines(),
                fromfile="golden", tofile="python", lineterm="", n=5,
            ))
            pytest.fail(f"F999 expiry byte-shape mismatch:\n{diff}")


class TestAnalysisInventoryAging:
    """F999 byte-shape gate for aging mode (analysisType=aging)."""

    def test_f999_aging_byte_shape(self, client, monkeypatch):
        """Full byte-shape compare on data block vs Java golden (empty DB, frozen date)."""
        from smartbi_compat.api import analysis_inventory

        FROZEN = GOLDEN_RECORD_DATE

        class FrozenDate(real_date):
            @classmethod
            def today(cls):
                return FROZEN

        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        async def empty_fetch(*_args):
            return []

        monkeypatch.setattr(analysis_inventory, "_fetch_all", empty_fetch)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/inventory"
            "?startDate=2025-01-01&endDate=2025-01-31&analysisType=aging",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"

        py_data = _strip_volatile(resp.json()["data"])

        with open(GOLDEN_DIR / "analysis-inventory-F999-aging.json", encoding="utf-8") as f:
            golden_data = _strip_volatile(json.load(f)["response"]["data"])

        if py_data != golden_data:
            py_str = json.dumps(py_data, ensure_ascii=False, indent=2, sort_keys=True)
            golden_str = json.dumps(golden_data, ensure_ascii=False, indent=2, sort_keys=True)
            diff = "\n".join(difflib.unified_diff(
                golden_str.splitlines(), py_str.splitlines(),
                fromfile="golden", tofile="python", lineterm="", n=5,
            ))
            pytest.fail(f"F999 aging byte-shape mismatch:\n{diff}")


class TestAnalysisInventoryDefaultMode:
    """PR-B contract tests for default mode (analysisType=null → DashboardResponse).
    Per spec §5.2."""

    def test_f999_default_byte_shape(self, client, monkeypatch):
        """Empty F999 (no batches in test DB) → buildEmptyDashboard branch.
        Full byte-shape compare against analysis-inventory-F999.json golden.
        Verifies 3-key outer envelope + 16-key DashboardResponse + 5-key AIInsight."""
        from smartbi_compat.api import analysis_inventory

        FROZEN = GOLDEN_RECORD_DATE

        class FrozenDate(real_date):
            @classmethod
            def today(cls):
                return FROZEN

        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        async def empty_fetch(*_args):
            return []

        monkeypatch.setattr(analysis_inventory, "_fetch_all", empty_fetch)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/inventory"
            "?startDate=2025-01-01&endDate=2025-12-31",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"

        py_data = _strip_volatile(resp.json()["data"])

        with open(GOLDEN_DIR / "analysis-inventory-F999.json", encoding="utf-8") as f:
            golden_data = _strip_volatile(json.load(f)["response"]["data"])

        if py_data != golden_data:
            py_str = json.dumps(py_data, ensure_ascii=False, indent=2, sort_keys=True)
            golden_str = json.dumps(golden_data, ensure_ascii=False, indent=2, sort_keys=True)
            diff = "\n".join(difflib.unified_diff(
                golden_str.splitlines(), py_str.splitlines(),
                fromfile="golden", tofile="python", lineterm="", n=5,
            ))
            pytest.fail(f"F999 default byte-shape mismatch:\n{diff}")

    def test_health_score_asymmetric_null_regression(self):
        """T-INV-9 — When all 4 input metrics are None:
          turnover null → +0 (penalty, Java L835-844 has NO else)
          expiry null → +30 (full pts, Java L862)
          loss null → +20 (full pts, Java L881)
          aging null → +20 (full pts, Java L899)
          Total = 70 (NOT 0).

        Direct call to _get_health_score with mocked sub-services."""
        import asyncio
        import unittest.mock
        from smartbi_compat.api import analysis_inventory

        async def empty_metrics(*_args, **_kw):
            return []

        with unittest.mock.patch.object(analysis_inventory, "_get_turnover_analysis", empty_metrics), \
             unittest.mock.patch.object(analysis_inventory, "_get_expiry_risk_analysis", empty_metrics), \
             unittest.mock.patch.object(analysis_inventory, "_calculate_loss_rate_for_health_score", empty_metrics), \
             unittest.mock.patch.object(analysis_inventory, "_get_aging_metrics", empty_metrics):
            result = asyncio.run(analysis_inventory._get_health_score(
                "F999", GOLDEN_RECORD_DATE, GOLDEN_RECORD_DATE
            ))

        assert result["metricCode"] == "HEALTH_SCORE"
        assert result["value"] == 70, f"T-INV-9 asymmetric: expected 70 (=0+30+20+20), got {result['value']}"
        assert result["alertLevel"] == "YELLOW"
        assert result["formattedValue"] == "70 分"

    def test_empty_dashboard_aiinsight_5_keys(self, client, monkeypatch):
        """Verify AIInsight has 5 keys (level/category/message/relatedEntity/actionSuggestion).
        relatedEntity always None per Lombok @Data emission. Also verifies 16-key dashboard."""
        from smartbi_compat.api import analysis_inventory

        class FrozenDate(real_date):
            @classmethod
            def today(cls):
                return GOLDEN_RECORD_DATE

        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        async def empty_fetch(*_args):
            return []

        monkeypatch.setattr(analysis_inventory, "_fetch_all", empty_fetch)

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/inventory"
            "?startDate=2025-01-01&endDate=2025-12-31",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200

        overview = resp.json()["data"]["overview"]
        assert len(overview) == 16, f"DashboardResponse should have 16 keys, got {len(overview)}"

        ai_insights = overview["aiInsights"]
        assert len(ai_insights) == 1

        insight = ai_insights[0]
        expected_keys = {"level", "category", "message", "relatedEntity", "actionSuggestion"}
        assert set(insight.keys()) == expected_keys, f"AIInsight keys mismatch: {set(insight.keys())}"
        assert insight["relatedEntity"] is None


class TestAnalysisInventoryOverviewAlias:
    """F-1 follow-up: analysisType=overview aliases the empty/default branch.

    Audit ref: docs/qa-audits/2026-05-12-smartbi-cohort-parity-sweep-results.md §5 F-1
    — UI tab calling analysisType=overview previously hit a 501 stub because the
    dispatcher fell through to the catchall. The default mode envelope is literally
    keyed `overview` (see _get_default_mode line 1876-1886), so this alias is
    semantically the same thing under a different request shape.

    Mocking _get_default_mode lets us verify the routing decision in isolation.
    """

    def test_overview_alias_routes_to_default_mode(self, client, monkeypatch):
        """analysisType=overview returns 200 + same payload as empty (sentinel mock)."""
        from unittest.mock import AsyncMock

        sentinel = {"_sentinel": "default-mode-routed", "overview": {}, "endDate": "x", "startDate": "y"}
        mock_default = AsyncMock(return_value=sentinel)
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_inventory._get_default_mode",
            mock_default,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/inventory"
            "?startDate=2025-01-01&endDate=2025-12-31&analysisType=overview",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        body = resp.json()
        assert body["success"] is True, f"expected success=true, got body={body}"
        assert body["data"] == sentinel, "overview must route to default_mode (sentinel mismatch)"
        assert mock_default.await_count == 1, (
            "default_mode must be awaited exactly once for analysisType=overview"
        )

    def test_overview_alias_shape_matches_empty(self, client, monkeypatch):
        """Same sentinel returned for both analysisType=overview AND empty —
        proves the two branches converge on _get_default_mode.
        """
        from unittest.mock import AsyncMock

        sentinel = {"_sentinel": "shared-default", "marker": 7}
        monkeypatch.setattr(
            "smartbi_compat.api.analysis_inventory._get_default_mode",
            AsyncMock(return_value=sentinel),
        )

        url_base = (
            "/api/mobile/F999/smart-bi/analysis/inventory"
            "?startDate=2025-01-01&endDate=2025-12-31"
        )
        headers = {"Authorization": f"Bearer {_make_token('F999')}"}

        resp_empty = client.get(url_base, headers=headers)
        resp_overview = client.get(url_base + "&analysisType=overview", headers=headers)

        assert resp_empty.status_code == 200
        assert resp_overview.status_code == 200
        body_empty = resp_empty.json()
        body_overview = resp_overview.json()
        assert body_empty["data"] == body_overview["data"] == sentinel
        assert body_empty["success"] is body_overview["success"] is True
        # Neither should look like the 501 catchall envelope.
        assert body_empty.get("code") != 501
        assert body_overview.get("code") != 501


# ============================================================
# PR-C: Arithmetic depth tests (12 classes per spec §5.3)
# ============================================================

from decimal import Decimal


class TestInventoryAlertHelpersArithmetic:
    """4 named alert helpers x 4 boundary cases = 16 tests.

    Critical: ExpiryRisk + LossRate use STRICT `>`, NOT `>=`. Boundary value
    routes to YELLOW (not RED) at threshold; routes to GREEN (not YELLOW) at
    lower threshold. Off-by-one on `>` vs `>=` is the exact bug class this
    test catches.
    """

    @pytest.mark.parametrize("rate,expected", [
        ("5.99", "RED"),
        ("6.0", "YELLOW"),
        ("11.99", "YELLOW"),
        ("12.0", "GREEN"),
    ])
    def test_turnover_alert_boundaries(self, rate, expected):
        from smartbi_compat.api.analysis_inventory import _determine_turnover_alert_level
        assert _determine_turnover_alert_level(Decimal(rate)) == expected

    @pytest.mark.parametrize("days,expected", [
        ("60.01", "RED"),
        ("60.0", "YELLOW"),
        ("30.01", "YELLOW"),
        ("30.0", "GREEN"),
    ])
    def test_inventory_days_alert_boundaries(self, days, expected):
        from smartbi_compat.api.analysis_inventory import _determine_inventory_days_alert_level
        assert _determine_inventory_days_alert_level(Decimal(days)) == expected

    @pytest.mark.parametrize("rate,expected", [
        ("15.01", "RED"),
        ("15.0", "YELLOW"),    # strict > 15 for RED
        ("10.01", "YELLOW"),
        ("10.0", "GREEN"),     # strict > 10 for YELLOW
    ])
    def test_expiry_risk_alert_boundaries(self, rate, expected):
        from smartbi_compat.api.analysis_inventory import _determine_expiry_risk_alert_level
        assert _determine_expiry_risk_alert_level(Decimal(rate)) == expected

    @pytest.mark.parametrize("rate,expected", [
        ("5.01", "RED"),
        ("5.0", "YELLOW"),     # strict > 5 for RED
        ("2.01", "YELLOW"),
        ("2.0", "GREEN"),      # strict > 2 for YELLOW
    ])
    def test_loss_rate_alert_boundaries(self, rate, expected):
        from smartbi_compat.api.analysis_inventory import _determine_loss_rate_alert_level
        assert _determine_loss_rate_alert_level(Decimal(rate)) == expected


class TestInventoryLossTrendChartMock:
    """T-INV-8 negative test: _get_loss_trend_chart NOT exported.

    Per spec section 2 line 110-112: getLossTrendChart is one of 4 internal methods
    intentionally NOT ported because controller never dispatches to it.
    Defensive: catch future commits that mistakenly add it."""

    def test_loss_trend_chart_not_exported(self):
        """If this fails, someone added _get_loss_trend_chart - review against
        spec section 2 line 110-112 and getInventoryHealth charts list (only 3 charts:
        aging/expiry/material).
        """
        from smartbi_compat.api import analysis_inventory

        assert not hasattr(analysis_inventory, "_get_loss_trend_chart"), (
            "_get_loss_trend_chart MUST NOT be exported per T-INV-8 spec decision. "
            "If intentionally adding, update spec section 2 line 110-112 and remove this test."
        )


class TestInventoryGetCurrentQuantityFormula:
    """T-INV-13 - _get_current_quantity null-safe arithmetic."""

    def test_receipt_quantity_null_returns_zero(self):
        from smartbi_compat.api.analysis_inventory import _get_current_quantity
        batch = {
            "receipt_quantity": None,
            "used_quantity": Decimal("5"),
            "reserved_quantity": Decimal("2"),
        }
        assert _get_current_quantity(batch) == Decimal("0")

    def test_used_quantity_null_treated_as_zero(self):
        from smartbi_compat.api.analysis_inventory import _get_current_quantity
        batch = {
            "receipt_quantity": Decimal("10"),
            "used_quantity": None,
            "reserved_quantity": Decimal("2"),
        }
        # 10 - 0 - 2 = 8
        assert _get_current_quantity(batch) == Decimal("8")

    def test_reserved_quantity_null_treated_as_zero(self):
        from smartbi_compat.api.analysis_inventory import _get_current_quantity
        batch = {
            "receipt_quantity": Decimal("10"),
            "used_quantity": Decimal("3"),
            "reserved_quantity": None,
        }
        # 10 - 3 - 0 = 7
        assert _get_current_quantity(batch) == Decimal("7")

    def test_all_non_null_subtracts(self):
        from smartbi_compat.api.analysis_inventory import _get_current_quantity
        batch = {
            "receipt_quantity": Decimal("10"),
            "used_quantity": Decimal("3"),
            "reserved_quantity": Decimal("2"),
        }
        # 10 - 3 - 2 = 5
        assert _get_current_quantity(batch) == Decimal("5")


class TestInventoryHealthScoreAsymmetric:
    """T-INV-9 - asymmetric null handling in _get_health_score.

    Java getHealthScore (L824-921) treats null per dimension as:
      - Turnover null  -> +0 (penalty, NO else branch)
      - Expiry null    -> +30 (full points)
      - Loss null      -> +20 (full points)
      - Aging null     -> +20 (full points)

    All 4 None: 0+30+20+20 = 70 (NOT 0).
    All 4 worst: 10+10+5+5 = 30.
    All 4 best: 30+30+20+20 = 100.

    Note: Existing test_health_score_asymmetric_null_regression covers case 1.
    This class extends with 4 remaining boundary cases.
    """

    @staticmethod
    def _run_with_metrics(turnover_val, expiry_val, loss_val, aging_val):
        """Helper: run _get_health_score with mocked metrics returning specified values."""
        import asyncio
        import unittest.mock
        from smartbi_compat.api import analysis_inventory

        async def turnover_metric(*_a, **_k):
            if turnover_val is None:
                return []
            return [{"metricCode": "TURNOVER_RATE", "value": turnover_val}]

        async def expiry_metric(*_a, **_k):
            if expiry_val is None:
                return []
            return [{"metricCode": "EXPIRY_RISK_RATE", "value": expiry_val}]

        async def loss_metric(*_a, **_k):
            if loss_val is None:
                return []
            return [{"metricCode": "LOSS_RATE", "value": loss_val}]

        async def aging_metric(*_a, **_k):
            if aging_val is None:
                return []
            return [{"metricCode": "SLOW_MOVING_RATE", "value": aging_val}]

        with unittest.mock.patch.object(analysis_inventory, "_get_turnover_analysis", turnover_metric), \
             unittest.mock.patch.object(analysis_inventory, "_get_expiry_risk_analysis", expiry_metric), \
             unittest.mock.patch.object(analysis_inventory, "_calculate_loss_rate_for_health_score", loss_metric), \
             unittest.mock.patch.object(analysis_inventory, "_get_aging_metrics", aging_metric):
            return asyncio.run(analysis_inventory._get_health_score(
                "F", real_date(2025, 1, 1), real_date(2025, 12, 31)
            ))

    def test_all_full_points_score_100(self):
        """All 4 dims best values -> 30+30+20+20 = 100."""
        result = self._run_with_metrics(
            turnover_val=Decimal("15"),     # >= 12 -> +30
            expiry_val=Decimal("5"),        # < 10 -> +30
            loss_val=Decimal("1"),          # < 2 -> +20
            aging_val=Decimal("5"),         # < 10 -> +20
        )
        assert result["value"] == 100
        assert result["alertLevel"] == "GREEN"

    def test_all_worst_points_score_30(self):
        """All 4 dims worst values -> 10+10+5+5 = 30."""
        result = self._run_with_metrics(
            turnover_val=Decimal("3"),      # < 6 -> +10
            expiry_val=Decimal("20"),       # >= 15 -> +10
            loss_val=Decimal("8"),          # >= 5 -> +5
            aging_val=Decimal("25"),        # >= 20 -> +5
        )
        assert result["value"] == 30
        assert result["alertLevel"] == "RED"

    def test_turnover_none_alone_subtracts_30(self):
        """turnover None, others best: 0 + 30 + 20 + 20 = 70."""
        result = self._run_with_metrics(
            turnover_val=None,              # +0 (penalty)
            expiry_val=Decimal("5"),        # +30
            loss_val=Decimal("1"),          # +20
            aging_val=Decimal("5"),         # +20
        )
        assert result["value"] == 70

    def test_expiry_none_alone_full_points(self):
        """expiry None alone: rest best, expiry null -> +30 (full pts asymmetric)."""
        result = self._run_with_metrics(
            turnover_val=Decimal("15"),     # +30
            expiry_val=None,                # +30 (asymmetric - full points on null)
            loss_val=Decimal("1"),          # +20
            aging_val=Decimal("5"),         # +20
        )
        assert result["value"] == 100

    def test_loss_and_aging_none_full_points(self):
        """loss + aging None, others best: 30 + 30 + 20 + 20 = 100."""
        result = self._run_with_metrics(
            turnover_val=Decimal("15"),
            expiry_val=Decimal("5"),
            loss_val=None,                  # +20 asymmetric
            aging_val=None,                 # +20 asymmetric
        )
        assert result["value"] == 100


class TestInventoryHealthScoreTierArithmetic:
    """T-INV-15 - boundary tier arithmetic for 4 inline scoring branches in
    _get_health_score. Catches off-by-one on `>=` vs `<` per dimension.

    Strategy: lock 3 dims at full points, vary 4th at threshold boundaries.

    TURNOVER uses `>=` (regular dir): rate=12.0 -> +30 (boundary inclusive).
    EXPIRY/LOSS/AGING use `<` strict: rate=10.0 -> +20 (NOT +30, boundary excludes).
    """

    @staticmethod
    def _run_with_metrics(turnover_val, expiry_val, loss_val, aging_val):
        import asyncio
        import unittest.mock
        from smartbi_compat.api import analysis_inventory

        async def turnover_metric(*_a, **_k):
            if turnover_val is None: return []
            return [{"metricCode": "TURNOVER_RATE", "value": turnover_val}]
        async def expiry_metric(*_a, **_k):
            if expiry_val is None: return []
            return [{"metricCode": "EXPIRY_RISK_RATE", "value": expiry_val}]
        async def loss_metric(*_a, **_k):
            if loss_val is None: return []
            return [{"metricCode": "LOSS_RATE", "value": loss_val}]
        async def aging_metric(*_a, **_k):
            if aging_val is None: return []
            return [{"metricCode": "SLOW_MOVING_RATE", "value": aging_val}]

        with unittest.mock.patch.object(analysis_inventory, "_get_turnover_analysis", turnover_metric), \
             unittest.mock.patch.object(analysis_inventory, "_get_expiry_risk_analysis", expiry_metric), \
             unittest.mock.patch.object(analysis_inventory, "_calculate_loss_rate_for_health_score", loss_metric), \
             unittest.mock.patch.object(analysis_inventory, "_get_aging_metrics", aging_metric):
            return asyncio.run(analysis_inventory._get_health_score(
                "F", real_date(2025, 1, 1), real_date(2025, 12, 31)
            ))

    @pytest.mark.parametrize("turnover,expected_delta", [
        ("11.99", 20),   # < 12 -> +20 (boundary excludes 11.99)
        ("12.0", 30),    # >= 12 -> +30 (boundary inclusive)
        ("5.99", 10),    # < 6 -> +10
        ("6.0", 20),     # >= 6 -> +20 (boundary inclusive)
        ("0.0", 10),
        ("20.0", 30),
    ])
    def test_turnover_dim_tiers(self, turnover, expected_delta):
        # Lock other 3 at full pts: expiry=5(+30), loss=1(+20), aging=5(+20) = 70 baseline
        result = self._run_with_metrics(
            Decimal(turnover), Decimal("5"), Decimal("1"), Decimal("5")
        )
        assert result["value"] == 70 + expected_delta

    @pytest.mark.parametrize("expiry,expected_delta", [
        ("9.99", 30),    # < 10 -> +30
        ("10.0", 20),    # NOT < 10 -> +20 (boundary excludes from full pts)
        ("14.99", 20),   # < 15 -> +20
        ("15.0", 10),    # NOT < 15 -> +10 (boundary excludes from mid pts)
        ("0.0", 30),
        ("100.0", 10),
    ])
    def test_expiry_dim_tiers(self, expiry, expected_delta):
        # Lock other 3 at full pts: turnover=15(+30), loss=1(+20), aging=5(+20) = 70 baseline
        result = self._run_with_metrics(
            Decimal("15"), Decimal(expiry), Decimal("1"), Decimal("5")
        )
        assert result["value"] == 70 + expected_delta

    @pytest.mark.parametrize("loss,expected_delta", [
        ("1.99", 20),    # < 2 -> +20
        ("2.0", 12),     # NOT < 2 -> +12
        ("4.99", 12),    # < 5 -> +12
        ("5.0", 5),      # NOT < 5 -> +5
    ])
    def test_loss_dim_tiers(self, loss, expected_delta):
        # Lock other 3: turnover=15(+30), expiry=5(+30), aging=5(+20) = 80 baseline
        result = self._run_with_metrics(
            Decimal("15"), Decimal("5"), Decimal(loss), Decimal("5")
        )
        assert result["value"] == 80 + expected_delta

    @pytest.mark.parametrize("aging,expected_delta", [
        ("9.99", 20),    # < 10 -> +20
        ("10.0", 12),    # NOT < 10 -> +12
        ("19.99", 12),   # < 20 -> +12
        ("20.0", 5),     # NOT < 20 -> +5
    ])
    def test_aging_dim_tiers(self, aging, expected_delta):
        # Lock other 3: turnover=15(+30), expiry=5(+30), loss=1(+20) = 80 baseline
        result = self._run_with_metrics(
            Decimal("15"), Decimal("5"), Decimal("1"), Decimal(aging)
        )
        assert result["value"] == 80 + expected_delta


class TestInventoryLongAgingFilterBoundary:
    """T-INV-14 - long-aging filter must be `>=` inclusive at 60-day boundary."""

    @pytest.mark.parametrize("age_days,should_include", [
        (59, False),    # < 60 -> EXCLUDED
        (60, True),     # == 60 -> INCLUDED (verifies `>=` not `>`)
        (61, True),     # > 60 -> INCLUDED
    ])
    def test_long_aging_filter_at_60_day_boundary(self, age_days, should_include, monkeypatch):
        import asyncio
        from datetime import timedelta
        from smartbi_compat.api import analysis_inventory

        FROZEN_TODAY = real_date(2026, 5, 2)
        receipt_date = FROZEN_TODAY - timedelta(days=age_days)

        async def fake_batches(*_a, **_k):
            return [{
                "id": 1, "batch_number": "B1",
                "receipt_date": receipt_date,
                "unit_price": Decimal("10"),
                "receipt_quantity": Decimal("5"),
                "used_quantity": Decimal("0"),
                "reserved_quantity": Decimal("0"),
                "material_type_id": "MAT-001",
                "material_type_name": "原料A",
            }]

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return FROZEN_TODAY
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        ranking = asyncio.run(analysis_inventory._get_long_aging_batches_ranking("F", 60))
        if should_include:
            assert len(ranking) == 1, f"age_days={age_days} should be included (>=60)"
        else:
            assert len(ranking) == 0, f"age_days={age_days} should be excluded (<60)"


class TestInventoryAgingBucketBoundaries:
    """4 boundaries x 2 sides = 8 tests for aging bucket assignment.

    Buckets: '0-30天', '31-60天', '61-90天', '90天以上'.
    Logic: age <= 30 -> 0-30; <= 60 -> 31-60; <= 90 -> 61-90; else 90以上.
    """

    @pytest.mark.parametrize("age_days,expected_bucket", [
        (30, "0-30天"),       # boundary: 30 -> first bucket
        (31, "31-60天"),      # boundary: 31 -> second
        (60, "31-60天"),      # boundary: 60 -> second
        (61, "61-90天"),      # boundary: 61 -> third
        (90, "61-90天"),      # boundary: 90 -> third
        (91, "90天以上"),     # boundary: 91 -> fourth
        (200, "90天以上"),    # well past 90
        (None, "90天以上"),   # null receipt_date (T-INV-3)
    ])
    def test_aging_bucket_assignment(self, age_days, expected_bucket, monkeypatch):
        import asyncio
        from datetime import timedelta
        from smartbi_compat.api import analysis_inventory

        FROZEN_TODAY = real_date(2026, 5, 2)
        if age_days is None:
            receipt_date = None
        else:
            receipt_date = FROZEN_TODAY - timedelta(days=age_days)

        async def fake_batches(*_a, **_k):
            return [{
                "id": 1, "receipt_date": receipt_date,
                "unit_price": Decimal("100"),
                "receipt_quantity": Decimal("10"),
                "used_quantity": Decimal("0"),
                "reserved_quantity": Decimal("0"),
            }]

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return FROZEN_TODAY
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        chart = asyncio.run(analysis_inventory._get_inventory_aging_chart("F"))
        bucket_with_value = next(
            (d for d in chart["data"] if d["value"] > 0), None
        )
        assert bucket_with_value is not None, f"No bucket got the batch (age={age_days})"
        assert bucket_with_value["aging"] == expected_bucket, (
            f"age_days={age_days}: expected {expected_bucket}, got {bucket_with_value['aging']}"
        )


class TestInventoryExpiringRankingInlineAlert:
    """Inline 7/15-day ternary alertLevel in _get_expiring_batches_ranking.

    Java semantics (impl line 875-880):
      days <= 7  -> RED
      days <= 15 -> YELLOW
      else        -> GREEN
    """

    @pytest.mark.parametrize("days_until_expiry,expected_alert", [
        (3, "RED"),       # well below 7
        (7, "RED"),       # boundary: <= 7
        (15, "YELLOW"),   # boundary: <= 15
        (20, "GREEN"),    # > 15
    ])
    def test_expiring_alert_thresholds(self, days_until_expiry, expected_alert, monkeypatch):
        import asyncio
        from datetime import timedelta
        from smartbi_compat.api import analysis_inventory

        FROZEN_TODAY = real_date(2026, 5, 2)
        expire_date = FROZEN_TODAY + timedelta(days=days_until_expiry)

        async def fake_expiring(*_a, **_k):
            return [{
                "id": 1, "batch_number": "B1",
                "expire_date": expire_date,
                "unit_price": Decimal("10"),
                "receipt_quantity": Decimal("5"),
                "used_quantity": Decimal("0"),
                "reserved_quantity": Decimal("0"),
                "material_type_id": "MAT-001",
                "material_type_name": "原料A",
            }]

        monkeypatch.setattr(analysis_inventory, "_query_expiring_batches", fake_expiring)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return FROZEN_TODAY
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        ranking = asyncio.run(analysis_inventory._get_expiring_batches_ranking("F"))
        assert len(ranking) >= 1
        assert ranking[0].get("alertLevel") == expected_alert, (
            f"days={days_until_expiry}: expected {expected_alert}, got {ranking[0].get('alertLevel')}"
        )


class TestInventoryLongAgingRankingInlineAlert:
    """Inline 90/120-day ternary alertLevel in _get_long_aging_batches_ranking.

    Java semantics (impl line 1209-1214) - STRICT `>`:
      ageDays > 120 -> RED
      ageDays > 90  -> YELLOW
      else (<=90)   -> GREEN
    """

    @pytest.mark.parametrize("age_days,expected_alert", [
        (90, "GREEN"),     # boundary: NOT > 90 -> GREEN
        (91, "YELLOW"),    # > 90 -> YELLOW
        (120, "YELLOW"),   # boundary: NOT > 120 -> YELLOW
        (121, "RED"),      # > 120 -> RED
    ])
    def test_long_aging_alert_thresholds(self, age_days, expected_alert, monkeypatch):
        import asyncio
        from datetime import timedelta
        from smartbi_compat.api import analysis_inventory

        FROZEN_TODAY = real_date(2026, 5, 2)
        receipt_date = FROZEN_TODAY - timedelta(days=age_days)

        async def fake_batches(*_a, **_k):
            return [{
                "id": 1, "batch_number": "B1",
                "receipt_date": receipt_date,
                "unit_price": Decimal("10"),
                "receipt_quantity": Decimal("5"),
                "used_quantity": Decimal("0"),
                "reserved_quantity": Decimal("0"),
                "material_type_id": "MAT-001",
                "material_type_name": "原料A",
            }]

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return FROZEN_TODAY
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        ranking = asyncio.run(analysis_inventory._get_long_aging_batches_ranking("F", 60))
        assert len(ranking) == 1
        assert ranking[0].get("alertLevel") == expected_alert, (
            f"age_days={age_days}: expected {expected_alert}, got {ranking[0].get('alertLevel')}"
        )


class TestInventoryLinkedHashMapOrder:
    """T-INV-5 - explicit positional list assertion. Catches dict reorder
    regressions that naive `==` comparison would silently pass.

    Coverage:
      - _get_expiry_risk_chart: 5-bucket order (positional list comp on data['status'])
      - _get_inventory_aging_chart: 4-bucket order (positional list comp on data['aging'])
      - _build_material_category_value_chart: top-N sorted desc by value
    """

    def test_expiry_risk_chart_5_bucket_order(self, monkeypatch):
        """Java pre-populates 5 buckets in this LinkedHashMap order."""
        import asyncio
        from datetime import timedelta
        from smartbi_compat.api import analysis_inventory

        FROZEN_TODAY = real_date(2026, 5, 2)

        async def fake_batches(*_a, **_k):
            return [
                # Expires in 3 days -> 紧急（<7天）
                {"id": 1, "expire_date": FROZEN_TODAY + timedelta(days=3),
                 "unit_price": Decimal("10"), "receipt_quantity": Decimal("5"),
                 "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")},
                # Expires in 10 days -> 预警（7-15天）
                {"id": 2, "expire_date": FROZEN_TODAY + timedelta(days=10),
                 "unit_price": Decimal("10"), "receipt_quantity": Decimal("5"),
                 "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")},
                # Expires in 18 days -> 关注（15-30天）
                {"id": 3, "expire_date": FROZEN_TODAY + timedelta(days=18),
                 "unit_price": Decimal("10"), "receipt_quantity": Decimal("5"),
                 "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")},
                # No expire -> 无保质期
                {"id": 4, "expire_date": None,
                 "unit_price": Decimal("10"), "receipt_quantity": Decimal("5"),
                 "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")},
            ]

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return FROZEN_TODAY
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        chart = asyncio.run(analysis_inventory._get_expiry_risk_chart("F"))
        # Explicit positional order assertion (NOT `==` on full dict)
        actual_order = [d["status"] for d in chart["data"]]
        assert actual_order == [
            "正常（>30天）", "关注（15-30天）", "预警（7-15天）",
            "紧急（<7天）", "无保质期",
        ], f"Expected fixed 5-bucket order, got {actual_order}"
        # Defensive: all 5 emitted even when some buckets empty
        assert len(chart["data"]) == 5

    def test_inventory_aging_chart_4_bucket_order(self, monkeypatch):
        """Java pre-populates 4 buckets in this LinkedHashMap order."""
        import asyncio
        from datetime import timedelta
        from smartbi_compat.api import analysis_inventory

        FROZEN_TODAY = real_date(2026, 5, 2)

        async def fake_batches(*_a, **_k):
            return [
                {"id": 1, "receipt_date": FROZEN_TODAY - timedelta(days=7),
                 "unit_price": Decimal("10"), "receipt_quantity": Decimal("5"),
                 "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")},
                {"id": 2, "receipt_date": FROZEN_TODAY - timedelta(days=48),
                 "unit_price": Decimal("10"), "receipt_quantity": Decimal("5"),
                 "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")},
            ]

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return FROZEN_TODAY
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        chart = asyncio.run(analysis_inventory._get_inventory_aging_chart("F"))
        actual_order = [d["aging"] for d in chart["data"]]
        assert actual_order == [
            "0-30天", "31-60天", "61-90天", "90天以上",
        ], f"Expected 4-bucket order, got {actual_order}"
        assert len(chart["data"]) == 4

    def test_material_category_chart_sorted_desc_by_value(self):
        """Material category chart: sort by total value descending."""
        from smartbi_compat.api import analysis_inventory

        batches = [
            {"id": 1, "material_type_id": "MAT-A",
             "unit_price": Decimal("10"), "receipt_quantity": Decimal("1"),
             "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")},
            {"id": 2, "material_type_id": "MAT-B",
             "unit_price": Decimal("100"), "receipt_quantity": Decimal("1"),
             "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")},
            {"id": 3, "material_type_id": "MAT-C",
             "unit_price": Decimal("50"), "receipt_quantity": Decimal("1"),
             "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")},
        ]
        chart = analysis_inventory._build_material_category_value_chart(batches)
        # Verify sorted desc: B (100) > C (50) > A (10)
        actual_values = [d["value"] for d in chart["data"]]
        assert actual_values == sorted(actual_values, reverse=True), (
            f"Material category data not sorted desc: {actual_values}"
        )
        # Verify category names follow same order
        actual_categories = [d["category"] for d in chart["data"]]
        assert actual_categories == ["MAT-B", "MAT-C", "MAT-A"]


class TestInventoryDivByZeroGuards:
    """5 div-by-zero guard sites x 3 cases = 15 tests.

    Sites covered:
      1. _get_turnover_analysis line 560 (Decimal(days_between)) — guarded by `days+1 >= 1`
      2. _get_expiry_risk_analysis line 766-767 (/ total_value) — guard `if total_value > 0`
      3. _get_aging_metrics line 1039-1040 (/ total_value) — guard `if total_value > 0`
      4. _get_inventory_aging_chart line 1078-1079 (/ len(age_days_list)) — implicit
      5. _calculate_loss_rate_for_health_score line 1361-1362 — guard `if total_inventory_value > 0`
    """

    # Site 1: _get_turnover_analysis — days_between always >= 1 (no real zero), 3 cases sanity
    @pytest.mark.parametrize("start,end", [
        ((2025, 6, 1), (2025, 6, 1)),    # 1-day period
        ((2025, 6, 1), (2025, 6, 2)),    # 2-day period
        ((2025, 6, 1), (2025, 6, 30)),   # 30-day period
    ])
    def test_turnover_analysis_no_div_zero_for_short_periods(self, start, end, monkeypatch):
        import asyncio
        from datetime import date as _d
        from smartbi_compat.api import analysis_inventory

        async def fake_consumptions(*_a, **_k):
            return [{"total_cost": Decimal("100")}]
        async def fake_inventory_value(*_a, **_k):
            return Decimal("1000")

        monkeypatch.setattr(analysis_inventory, "_query_material_consumptions_in_range", fake_consumptions)
        monkeypatch.setattr(analysis_inventory, "_query_inventory_value_total", fake_inventory_value)

        result = asyncio.run(analysis_inventory._get_turnover_analysis(
            "F", _d(*start), _d(*end)
        ))
        assert any(m.get("metricCode") == "TURNOVER_RATE" for m in result)

    # Site 2: _get_expiry_risk_analysis — / total_value guarded
    @pytest.mark.parametrize("scenario,expect_zero", [
        ("zero_total", True),       # no batches → total_value=0 → rate=0
        ("tiny_total", False),      # tiny non-zero → computes
        ("normal_total", False),    # normal → computes
    ])
    def test_expiry_risk_div_guard(self, scenario, expect_zero, monkeypatch):
        import asyncio
        from smartbi_compat.api import analysis_inventory

        if scenario == "zero_total":
            async def fake_batches(*_a, **_k): return []
        elif scenario == "tiny_total":
            async def fake_batches(*_a, **_k):
                return [{"unit_price": Decimal("0.01"), "receipt_quantity": Decimal("1"),
                         "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")}]
        else:
            async def fake_batches(*_a, **_k):
                return [{"unit_price": Decimal("100"), "receipt_quantity": Decimal("10"),
                         "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")}]

        async def fake_expiring(*_a, **_k): return []

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)
        monkeypatch.setattr(analysis_inventory, "_query_expiring_batches", fake_expiring)
        monkeypatch.setattr(analysis_inventory, "_query_expired_batches", fake_expiring)

        result = asyncio.run(analysis_inventory._get_expiry_risk_analysis("F"))
        rate_metric = next((m for m in result if m.get("metricCode") == "EXPIRY_RISK_RATE"), None)
        assert rate_metric is not None
        if expect_zero:
            assert rate_metric["value"] == 0

    # Site 3: _get_aging_metrics — / total_value guarded
    @pytest.mark.parametrize("scenario,expect_zero", [
        ("zero_total", True),
        ("tiny_total", False),
        ("normal_total", False),
    ])
    def test_aging_metrics_div_guard(self, scenario, expect_zero, monkeypatch):
        import asyncio
        from smartbi_compat.api import analysis_inventory

        if scenario == "zero_total":
            async def fake_batches(*_a, **_k): return []
        elif scenario == "tiny_total":
            async def fake_batches(*_a, **_k):
                return [{"unit_price": Decimal("0.01"), "receipt_quantity": Decimal("1"),
                         "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0"),
                         "receipt_date": real_date(2025, 1, 1)}]
        else:
            async def fake_batches(*_a, **_k):
                return [{"unit_price": Decimal("100"), "receipt_quantity": Decimal("10"),
                         "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0"),
                         "receipt_date": real_date(2025, 1, 1)}]

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return real_date(2026, 5, 2)
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        result = asyncio.run(analysis_inventory._get_aging_metrics("F"))
        slow = next((m for m in result if m.get("metricCode") == "SLOW_MOVING_RATE"), None)
        assert slow is not None
        if expect_zero:
            assert slow["value"] == 0

    # Site 4: _get_inventory_aging_chart — chart returns successfully for varied batch counts
    @pytest.mark.parametrize("scenario", ["empty_batches", "one_batch", "many_batches"])
    def test_aging_chart_no_exception_for_any_batch_count(self, scenario, monkeypatch):
        import asyncio
        from smartbi_compat.api import analysis_inventory

        if scenario == "empty_batches":
            async def fake_batches(*_a, **_k): return []
        elif scenario == "one_batch":
            async def fake_batches(*_a, **_k):
                return [{"unit_price": Decimal("10"), "receipt_quantity": Decimal("1"),
                         "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0"),
                         "receipt_date": real_date(2025, 6, 1), "id": 1}]
        else:
            async def fake_batches(*_a, **_k):
                return [
                    {"unit_price": Decimal("10"), "receipt_quantity": Decimal("1"),
                     "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0"),
                     "receipt_date": real_date(2025, 6, 1), "id": 1},
                    {"unit_price": Decimal("10"), "receipt_quantity": Decimal("1"),
                     "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0"),
                     "receipt_date": real_date(2025, 7, 1), "id": 2},
                ]

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return real_date(2026, 5, 2)
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        chart = asyncio.run(analysis_inventory._get_inventory_aging_chart("F"))
        assert chart["chartType"] == "BAR"
        assert len(chart["data"]) == 4    # 4 buckets always emitted

    # Site 5: _calculate_loss_rate_for_health_score — / total_inventory_value guarded
    @pytest.mark.parametrize("scenario,expect_zero", [
        ("zero_inventory", True),
        ("tiny_inventory", False),
        ("normal_inventory", False),
    ])
    def test_loss_rate_div_guard(self, scenario, expect_zero, monkeypatch):
        import asyncio
        from smartbi_compat.api import analysis_inventory

        if scenario == "zero_inventory":
            async def fake_batches(*_a, **_k): return []
        elif scenario == "tiny_inventory":
            async def fake_batches(*_a, **_k):
                return [{"id": 1, "unit_price": Decimal("0.01"),
                         "receipt_quantity": Decimal("1"),
                         "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")}]
        else:
            async def fake_batches(*_a, **_k):
                return [{"id": 1, "unit_price": Decimal("100"),
                         "receipt_quantity": Decimal("10"),
                         "used_quantity": Decimal("0"), "reserved_quantity": Decimal("0")}]

        async def fake_adjustments(*_a, **_k): return []

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)
        monkeypatch.setattr(analysis_inventory, "_query_batch_adjustments_in_range", fake_adjustments)

        result = asyncio.run(analysis_inventory._calculate_loss_rate_for_health_score(
            "F", real_date(2025, 1, 1), real_date(2025, 12, 31)
        ))
        rate = next((m for m in result if m.get("metricCode") == "LOSS_RATE"), None)
        assert rate is not None
        if expect_zero:
            assert rate["value"] == 0


class TestInventoryDateArithmetic:
    """Annualization formula + null receipt-date bucketing + days-until-expiry semantics.

    Coverage:
      - 30-day period with consumption=300 -> annualized turnover formula sanity
      - Null receipt_date -> bucketed to '90天以上' (T-INV-3)
      - Expired batch (negative days-until-expiry) -> _get_expiry_risk_analysis
        handles without exception
    """

    def test_annualization_formula_30_days(self, monkeypatch):
        """30-day period: consumption=300, inventory=1000.
        annualized = 300 * 365 / 30 = 3650
        turnover_rate = 3650 / 1000 = 3.65
        Verifies the / Decimal(days_between) divisor works for non-trivial period.
        """
        import asyncio
        from smartbi_compat.api import analysis_inventory

        async def fake_consumptions(*_a, **_k):
            return [{"total_cost": Decimal("300")}]
        async def fake_inventory_value(*_a, **_k):
            return Decimal("1000")

        monkeypatch.setattr(analysis_inventory, "_query_material_consumptions_in_range", fake_consumptions)
        monkeypatch.setattr(analysis_inventory, "_query_inventory_value_total", fake_inventory_value)

        result = asyncio.run(analysis_inventory._get_turnover_analysis(
            "F", real_date(2025, 6, 1), real_date(2025, 6, 30)
        ))
        rate_metric = next((m for m in result if m.get("metricCode") == "TURNOVER_RATE"), None)
        assert rate_metric is not None
        # turnover_rate = (300 * 365 / 30) / 1000 = 3650 / 1000 = 3.65
        # display scale 2 -> 3.65 -> _decimal_to_number -> 3.65
        # alertLevel < 6 -> RED
        assert rate_metric["alertLevel"] == "RED"

    def test_null_receipt_date_lands_in_over_90_bucket(self, monkeypatch):
        """T-INV-3: batch with null receipt_date -> aging bucket '90天以上'."""
        import asyncio
        from smartbi_compat.api import analysis_inventory

        async def fake_batches(*_a, **_k):
            return [{
                "id": 1, "receipt_date": None,    # T-INV-3 trigger
                "unit_price": Decimal("100"),
                "receipt_quantity": Decimal("10"),
                "used_quantity": Decimal("0"),
                "reserved_quantity": Decimal("0"),
            }]

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return real_date(2026, 5, 2)
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        chart = asyncio.run(analysis_inventory._get_inventory_aging_chart("F"))
        over_90 = next((d for d in chart["data"] if d.get("aging") == "90天以上"), None)
        assert over_90 is not None
        assert over_90["value"] > 0, "Null receipt_date batch should land in 90天以上 bucket"

    def test_expired_batch_days_until_negative_no_exception(self, monkeypatch):
        """Expired batch (expire_date in past) — days-until-expiry is negative.
        _get_expiry_risk_analysis must handle without exception."""
        import asyncio
        from smartbi_compat.api import analysis_inventory

        async def fake_batches(*_a, **_k):
            return [{
                "id": 1, "expire_date": real_date(2026, 4, 1),  # 31 days before today
                "unit_price": Decimal("10"),
                "receipt_quantity": Decimal("5"),
                "used_quantity": Decimal("0"),
                "reserved_quantity": Decimal("0"),
            }]
        async def fake_expiring(*_a, **_k): return []

        monkeypatch.setattr(analysis_inventory, "_query_material_batches_by_status", fake_batches)
        monkeypatch.setattr(analysis_inventory, "_query_expiring_batches", fake_expiring)
        monkeypatch.setattr(analysis_inventory, "_query_expired_batches", fake_expiring)

        class FrozenDate(real_date):
            @classmethod
            def today(cls): return real_date(2026, 5, 2)
        monkeypatch.setattr(analysis_inventory, "date", FrozenDate)

        # Just verify no exception when negative days encountered
        result = asyncio.run(analysis_inventory._get_expiry_risk_analysis("F"))
        assert isinstance(result, list)


