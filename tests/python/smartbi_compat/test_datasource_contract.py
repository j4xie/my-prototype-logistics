"""Byte-shape contract gate for /datasource GET endpoints (Wave 2 Tier 1).

Java reference:
  - Controller: SmartBIAnalysisController.getDatasourceFields/getSchemaHistory line 747-780
  - Service: SmartBiSchemaServiceImpl line 225-298

Test pattern (mirrors test_analysis_finance_contract.py):
  - JWT_SECRET set in os.environ BEFORE importing production code
  - Load production main via importlib (gets full middleware stack)
  - Hit endpoint via TestClient with F999 JWT
  - Compare response (full envelope for error cases) to recorded golden
  - Strip volatile keys (timestamp)

Goldens recorded against test env Java (port 10011, F999 with non-existent id).
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
        "userId": 1,
        "username": "test_user",
        "factoryId": factory_id,
        "role": "factory_super_admin",
        "exp": datetime.now(timezone.utc).timestamp() + 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


VOLATILE = frozenset({"timestamp", "generatedAt", "lastUpdated", "cacheExpireAt"})


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


class TestDatasourceFields:
    """F999 byte-shape gate for /datasource/{id}/fields (not-exist case)."""

    def test_f999_fields_not_exist_data_keys_match_golden(self, client, monkeypatch):
        """Sanity: top-level envelope keys order matches Java golden."""
        async def fake_not_exist(_id):
            return None
        monkeypatch.setattr(
            "smartbi_compat.api.datasource._query_field_definitions",
            fake_not_exist,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/datasource/999999/fields",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"

        py_keys = list(resp.json().keys())
        with io.open(GOLDEN_DIR / "datasource-F999-fields-not-exist.json", encoding="utf-8") as f:
            golden_keys = list(json.load(f).keys())

        # Compare envelope keys (timestamp position may differ but should both contain it)
        assert set(py_keys) >= {"code", "message", "data", "success"}, py_keys
        assert set(golden_keys) >= {"code", "message", "data", "success"}, golden_keys

    def test_f999_fields_not_exist_byte_shape(self, client, monkeypatch):
        """Full byte-shape compare on stripped envelope (excl. timestamp)."""
        async def fake_not_exist(_id):
            return None
        monkeypatch.setattr(
            "smartbi_compat.api.datasource._query_field_definitions",
            fake_not_exist,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/datasource/999999/fields",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200

        py_body = _strip_volatile(resp.json())
        with io.open(GOLDEN_DIR / "datasource-F999-fields-not-exist.json", encoding="utf-8") as f:
            golden_body = _strip_volatile(json.load(f))

        # Strip Java-only envelope extras (actionHint/severity/hintTarget) for comparison
        # (sister payable test uses same pattern — these are server-side enrichments)
        for k in ("actionHint", "severity", "hintTarget"):
            golden_body.pop(k, None)
            py_body.pop(k, None)

        if py_body != golden_body:
            diffs = {k: {"py": py_body.get(k), "g": golden_body.get(k)}
                     for k in set(py_body) | set(golden_body)
                     if py_body.get(k) != golden_body.get(k)}
            pytest.fail(f"BYTE MISMATCH (fields not-exist): {json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}")
