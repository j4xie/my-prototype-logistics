"""Byte-shape contract gate for /analysis/department composite path (PR-A).

Java reference:
  - Controller: SmartBIAnalysisController.getDepartmentAnalysis line 142-177
  - Service: SmartBIServiceImpl.getComprehensiveAnalysis "department" case line 586-591

Test pattern mirrors sister test_analysis_finance_contract.py:
  - JWT_SECRET set in os.environ BEFORE importing production code
  - Load production main via importlib (gets full middleware stack)
  - Hit /api/mobile/F999/smart-bi/analysis/department via TestClient with F999 JWT
  - Compare response['data'] (composite) to recorded golden['data']
  - Strip volatile keys (generatedAt/lastUpdated/cacheExpireAt/timestamp)

Golden source: recorded via SSH tunnel from test env Java backend (port 10011)
on 2026-05-02 with empty F999 dataset.
"""
from __future__ import annotations

import importlib.util
import io
import json
import os
import sys
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

    Mirrors sister test_analysis_finance_contract.py:45-56.
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


@pytest.fixture
def patched_empty(monkeypatch):
    """Patch both SQL helpers to return empty rows (F999 baseline)."""

    async def _empty_full(factory_id, start_date, end_date):
        return []

    async def _empty_trend(factory_id, start_date, end_date):
        return []

    monkeypatch.setattr(
        "smartbi_compat.api.analysis_department._query_department_full",
        _empty_full,
    )
    monkeypatch.setattr(
        "smartbi_compat.api.analysis_department._query_department_daily_trend",
        _empty_trend,
    )


class TestAnalysisDepartmentComposite:
    """F999 byte-shape gate for department composite path."""

    def test_f999_composite_data_keys_match_golden(self, client, patched_empty):
        """Sanity: top-level data keys order matches Jackson HashMap hash-iter order.

        Golden order (recorded 2026-05-02):
          [completionRates, efficiencyMatrix, dateRange, generatedAt, ranking, trendComparison]
        NOT Java put-order — Jackson actual emit from HashMap.
        """
        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/department"
            "?startDate=2025-01-01&endDate=2025-12-31",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"
        py_data_keys = list(resp.json()["data"].keys())

        with io.open(GOLDEN_DIR / "analysis-department-F999.json", encoding="utf-8") as f:
            golden_data_keys = list(json.load(f)["data"].keys())

        assert py_data_keys == golden_data_keys, (
            f"data key order mismatch:\n"
            f"  python: {py_data_keys}\n"
            f"  golden: {golden_data_keys}"
        )

    def test_f999_composite_byte_shape(self, client, patched_empty):
        """Full byte-shape compare on data block.

        Mocks both SQL helpers to return [] (F999 empty state). Compares
        response['data'] against recorded golden after stripping volatile keys.
        """
        resp = client.get(
            "/api/mobile/F999/smart-bi/analysis/department"
            "?startDate=2025-01-01&endDate=2025-12-31",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"

        py_data = _strip_volatile(resp.json()["data"])

        with io.open(GOLDEN_DIR / "analysis-department-F999.json", encoding="utf-8") as f:
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
                f"BYTE SHAPE MISMATCH on {list(diffs.keys())}\n"
                f"{json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}"
            )

    def test_f999_department_filter_param_ignored(self, client, patched_empty):
        """`?department=销售部` produces SAME shape as no-filter case.

        Mirrors Java prod behavior: composite path always taken (smartBIService
        unconditional @Service); ?department=filter dead code in prod, never
        affects output.
        """
        resp_filtered = client.get(
            "/api/mobile/F999/smart-bi/analysis/department"
            "?startDate=2025-01-01&endDate=2025-12-31&department=%E9%94%80%E5%94%AE%E9%83%A8",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        resp_unfiltered = client.get(
            "/api/mobile/F999/smart-bi/analysis/department"
            "?startDate=2025-01-01&endDate=2025-12-31",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp_filtered.status_code == 200
        assert resp_unfiltered.status_code == 200

        filtered = _strip_volatile(resp_filtered.json())
        unfiltered = _strip_volatile(resp_unfiltered.json())

        assert filtered == unfiltered, (
            "Department filter MUST be IGNORED in composite path (Java prod behavior)"
        )
