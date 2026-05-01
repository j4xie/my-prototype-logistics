"""Byte-shape contract gate for /query-templates POST/PUT/DELETE write endpoints.

Java reference:
  - Controller: SmartBIAnalysisController.java:965-1009
Spec: docs/superpowers/specs/2026-05-01-phase2a-query-templates-design.md (v2, 243928c3e)

Test pattern (mirrors test_datasource_contract.py):
  - JWT_SECRET set in os.environ BEFORE importing production code
  - Load production main via importlib (gets full middleware stack)
  - monkeypatch.setattr the module-level _create/_update/_delete functions
  - Compare response (after stripping volatile fields) to recorded golden
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


def _strip_volatile_qt(obj):
    """Strip envelope.timestamp + data.createdAt + data.updatedAt.

    Per spec §4.2 — these are volatile per-request values that won't byte-match
    across recordings. The remaining fields (code/message/data.id/data.name/...)
    are byte-shape contract.
    """
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k == "timestamp":
                continue
            if k == "data" and isinstance(v, dict):
                v = {ek: ev for ek, ev in v.items()
                     if ek not in {"createdAt", "updatedAt"}}
            out[k] = _strip_volatile_qt(v) if isinstance(v, (dict, list)) else v
        return out
    if isinstance(obj, list):
        return [_strip_volatile_qt(x) for x in obj]
    return obj


@pytest.fixture(scope="module")
def production_app():
    return _load_production_main().app


@pytest.fixture
def client(production_app):
    from fastapi.testclient import TestClient
    return TestClient(production_app)


class TestQueryTemplatesWriteContract:
    """Byte-shape gate for POST/PUT/DELETE."""

    def test_post_happy_byte_shape(self, client, monkeypatch):
        with io.open(GOLDEN_DIR / "query-templates-F999-post-happy.json", encoding="utf-8") as f:
            golden = json.load(f)

        def fake_create(factory_id, body):
            assert factory_id == "F999"
            return golden["data"]

        monkeypatch.setattr(
            "smartbi_compat.api.query_templates_write._create_template",
            fake_create,
        )

        resp = client.post(
            "/api/mobile/F999/smart-bi/query-templates",
            json={"name": "x", "category": "x", "description": "x",
                  "queryTemplate": "x", "parameters": "[]"},
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, resp.text
        assert _strip_volatile_qt(resp.json()) == _strip_volatile_qt(golden)

    def test_put_happy_byte_shape(self, client, monkeypatch):
        with io.open(GOLDEN_DIR / "query-templates-F999-put-happy.json", encoding="utf-8") as f:
            golden = json.load(f)

        def fake_update(factory_id, template_id, body):
            assert factory_id == "F999"
            assert template_id == 45
            return golden["data"]

        monkeypatch.setattr(
            "smartbi_compat.api.query_templates_write._update_template",
            fake_update,
        )

        resp = client.put(
            "/api/mobile/F999/smart-bi/query-templates/45",
            json={"name": "golden_put", "category": "updated",
                  "description": "PUT happy golden",
                  "queryTemplate": "SELECT 2", "parameters": "[\"u\"]"},
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, resp.text
        assert _strip_volatile_qt(resp.json()) == _strip_volatile_qt(golden)

    def test_delete_happy_byte_shape(self, client, monkeypatch):
        with io.open(GOLDEN_DIR / "query-templates-F999-delete-happy.json", encoding="utf-8") as f:
            golden = json.load(f)

        def fake_delete(factory_id, template_id):
            assert factory_id == "F999"
            assert template_id == 45
            return True

        monkeypatch.setattr(
            "smartbi_compat.api.query_templates_write._delete_template",
            fake_delete,
        )

        resp = client.delete(
            "/api/mobile/F999/smart-bi/query-templates/45",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, resp.text
        assert _strip_volatile_qt(resp.json()) == _strip_volatile_qt(golden)

    def test_put_delete_not_found_shape_identity(self, client, monkeypatch):
        """Spec §4.1 — PUT/DELETE not-found + cross-factory all return identical envelope.

        Single golden double-used for 4 scenarios:
        - PUT id=999999 (truly missing)
        - DELETE id=999999 (truly missing)
        - PUT id=42 from cross-factory (exists in another factory)
        - DELETE id=42 from cross-factory
        """
        with io.open(GOLDEN_DIR / "query-templates-F999-not-found.json", encoding="utf-8") as f:
            golden = json.load(f)

        def fake_update_none(factory_id, template_id, body):
            return None

        def fake_delete_false(factory_id, template_id):
            return False

        monkeypatch.setattr(
            "smartbi_compat.api.query_templates_write._update_template",
            fake_update_none,
        )
        monkeypatch.setattr(
            "smartbi_compat.api.query_templates_write._delete_template",
            fake_delete_false,
        )

        token = _make_token("F999")

        # 4 scenarios — all must produce identical (modulo volatile timestamp) envelope
        for method, path in [
            ("PUT", "/api/mobile/F999/smart-bi/query-templates/999999"),    # truly missing
            ("DELETE", "/api/mobile/F999/smart-bi/query-templates/999999"),  # truly missing
            ("PUT", "/api/mobile/F999/smart-bi/query-templates/42"),         # cross-factory
            ("DELETE", "/api/mobile/F999/smart-bi/query-templates/42"),      # cross-factory
        ]:
            if method == "PUT":
                resp = client.put(
                    path,
                    json={"name": "x", "category": "x",
                          "queryTemplate": "x", "parameters": "[]"},
                    headers={"Authorization": f"Bearer {token}"},
                )
            else:
                resp = client.delete(
                    path,
                    headers={"Authorization": f"Bearer {token}"},
                )
            assert resp.status_code == 200, f"{method} {path}: {resp.text}"
            stripped_actual = _strip_volatile_qt(resp.json())
            stripped_golden = _strip_volatile_qt(golden)
            assert stripped_actual == stripped_golden, (
                f"{method} {path} envelope mismatch\n"
                f"actual: {stripped_actual}\ngolden: {stripped_golden}"
            )

    def test_post_hijack_byte_shape_lock(self, client, monkeypatch):
        """T6 defensive lock — verbatim mirror of Java JPA merge hijack behavior.

        F001 client POSTs with id=46 (where 46 is F999-owned).
        Java response: HTTP 200, success=true, data.factoryId="F001" (overwritten),
        data.createdAt=null (JPA merge transient entity quirk), updatedAt=fresh NOW.

        This test does NOT fix the bug. It locks current behavior so a future Java
        fix changes will alert via failing test. See spec §7.2.
        """
        with io.open(GOLDEN_DIR / "query-templates-F001-hijack.json", encoding="utf-8") as f:
            golden = json.load(f)

        def fake_create(factory_id, body):
            assert factory_id == "F001"
            assert body.get("id") == 46
            return golden["data"]

        monkeypatch.setattr(
            "smartbi_compat.api.query_templates_write._create_template",
            fake_create,
        )

        resp = client.post(
            "/api/mobile/F001/smart-bi/query-templates",
            json={"id": 46, "name": "hijacked_golden", "category": "evil",
                  "description": "T6 hijack golden",
                  "queryTemplate": "DROP", "parameters": "[\"x\"]"},
            headers={"Authorization": f"Bearer {_make_token('F001')}"},
        )
        assert resp.status_code == 200, resp.text
        actual = resp.json()
        # Pinpoint check: T6 verbatim mirror MUST set createdAt to null in merge path
        assert actual["data"]["createdAt"] is None, (
            "T6 verbatim mirror BROKEN: createdAt should be null when id-in-body merge "
            "path triggered (Java JPA returns transient entity with null createdAt). "
            "If this test fails after a Java fix, update the hijack golden + remove "
            "the explicit `entity['createdAt'] = None` override in _create_template."
        )
        assert _strip_volatile_qt(actual) == _strip_volatile_qt(golden)
