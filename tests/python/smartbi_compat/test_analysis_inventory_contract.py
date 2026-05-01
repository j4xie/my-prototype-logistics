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


class TestAnalysisInventoryDefault:
    """Default mode (no analysisType) returns 501 envelope — PR-B will replace with real impl."""

    def test_f999_default_returns_501(self, client):
        """Verify dispatcher 501 path for default (no analysisType) request.

        PR-A contract: default getInventoryHealth not yet ported → 501 envelope.
        PR-B will replace with real DashboardResponse impl.
        """
        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/inventory"
            "?startDate=2025-01-01&endDate=2025-01-31",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        body = resp.json()
        assert body["success"] is False, (
            f"expected success=false for default mode, got: {body.get('success')}"
        )
        assert body["code"] == 501, (
            f"expected code=501 for default mode, got: {body.get('code')}"
        )
