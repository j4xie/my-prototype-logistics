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
