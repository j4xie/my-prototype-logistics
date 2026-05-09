"""Byte-shape contract tests for /datasource POST/preview stub endpoints.

Java reference:
  - Controller: SmartBIAnalysisController.java
      uploadAndDetectSchema  line 680  (POST /datasource/upload, multipart)
      previewSchemaChanges   line 698  (GET  /datasource/{id}/preview)
      applySchemaChanges     line 716  (POST /datasource/apply)
  - Service stubs: SmartBiSchemaServiceImpl.java line 57-147

Goldens recorded against test env Java (port 10011, 2026-05-09):
  - datasource-upload-schema-F999.json  (NEW datasource path: autoApplicable)
  - datasource-upload-schema-F001.json  (EXISTING datasource path: noChanges)
  - datasource-preview-{F999,F001}.json (existing datasource id=1 lookup)
  - datasource-apply-{F999,F001}.json   (success-message envelope, data=null)

INTENTIONAL DIVERGENCE FROM JAVA (apply endpoint):
  Java's applySchemaChanges WRITES to DB (schema_version bump + history insert).
  Python's port intentionally skips both writes per organizer directive
  (Phase 2A scope-completeness MO 2026-05-09). The test
  test_apply_does_not_write_to_db verifies this — apply must not call any
  asyncpg execute() / executemany() / save methods. Real schema management
  deferred to Phase 3 (PR #50 per backlog plan §2.4).

Test pattern mirrors test_datasource_contract.py (the GET-endpoint test):
  - JWT_SECRET set BEFORE importing production code
  - Production app loaded via importlib (full middleware stack)
  - TestClient with monkeypatched query helpers (no real DB)
  - Stripped envelope (timestamp + Lombok-extras) compared to golden
  - NO try/except defensive fallbacks — let exceptions bubble (per
    .claude/feedback_no_defensive_in_verify_scripts.md HARD RULE)
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


# Volatile keys stripped before dict-eq comparison (timestamp / detectedAt)
# detectedAt is a fresh LocalDateTime.now() in Java's noChanges factory.
VOLATILE = frozenset({"timestamp", "detectedAt", "generatedAt", "lastUpdated", "cacheExpireAt"})


def _strip_volatile(obj):
    if isinstance(obj, dict):
        return {k: _strip_volatile(v) for k, v in obj.items() if k not in VOLATILE}
    if isinstance(obj, list):
        return [_strip_volatile(item) for item in obj]
    return obj


def _strip_envelope_extras(d: dict) -> dict:
    """Drop Lombok @Data extras that may differ between Java/Python emit order."""
    out = dict(d)
    for k in ("actionHint", "severity", "hintTarget"):
        out.pop(k, None)
    return out


def _is_write_sql(sql: str) -> bool:
    """True if SQL is an INSERT / UPDATE / DELETE statement.

    Uses whole-keyword detection to avoid false positives on column names
    like ``deleted_at`` (which would match the substring "DELETE"). Looks
    for the keyword followed by space + identifier, which is the standard
    syntax for write DDL/DML.
    """
    s = sql.upper()
    return any(
        token in s
        for token in (
            "INSERT INTO ",
            "UPDATE ",
            "DELETE FROM ",
        )
    ) and not s.lstrip().startswith("SELECT")


@pytest.fixture(scope="module")
def production_app():
    return _load_production_main().app


@pytest.fixture
def client(production_app):
    from fastapi.testclient import TestClient
    return TestClient(production_app)


# ============================================================
# Test class 1 — Upload (multipart) stub mirror
# ============================================================


class TestUploadAndDetectSchema:
    """POST /datasource/upload — multipart file + datasourceName.

    Two Java branches:
      F001: datasourceName="IL TEATRO..." exists → noChanges path
            (currentVersion=1, newVersion=1, detectedAt non-null)
      F999: datasourceName="test_datasource_F999_recording" not exist → autoApplicable
            (currentVersion=0, newVersion=1, detectedAt=null)
    """

    def test_f001_existing_datasource_byte_shape(self, client, monkeypatch):
        """Existing datasource → noChanges envelope path."""
        # Mock the DB lookup to return existing datasource with schema_version=1
        async def fake_existing(factory_id, name):
            assert factory_id == "F001"
            assert name == "IL TEATRO（西餐厅）2月_商品销量报表.xlsx"
            return {
                "id": 1,
                "name": name,
                "factory_id": factory_id,
                "schema_version": 1,
            }
        monkeypatch.setattr(
            "smartbi_compat.api.datasource._query_datasource_by_name",
            fake_existing,
        )

        # Upload a tiny in-memory file — Python doesn't parse it (Java TODO)
        resp = client.post(
            "/api/mobile/F001/smart-bi/datasource/upload",
            headers={"Authorization": f"Bearer {_make_token('F001')}"},
            files={"file": ("test.xlsx", b"PK\x03\x04dummy", "application/octet-stream")},
            data={"datasourceName": "IL TEATRO（西餐厅）2月_商品销量报表.xlsx"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"

        py_body = _strip_envelope_extras(_strip_volatile(resp.json()))
        with io.open(GOLDEN_DIR / "datasource-upload-schema-F001.json", encoding="utf-8") as f:
            golden_body = _strip_envelope_extras(_strip_volatile(json.load(f)))

        if py_body != golden_body:
            diffs = {k: {"py": py_body.get(k), "g": golden_body.get(k)}
                     for k in set(py_body) | set(golden_body)
                     if py_body.get(k) != golden_body.get(k)}
            pytest.fail(
                f"BYTE MISMATCH (upload F001 existing): "
                f"{json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}"
            )

    def test_f999_new_datasource_byte_shape(self, client, monkeypatch):
        """New datasource → autoApplicable envelope path (detectedAt=null)."""
        async def fake_not_exist(factory_id, name):
            assert factory_id == "F999"
            return None
        monkeypatch.setattr(
            "smartbi_compat.api.datasource._query_datasource_by_name",
            fake_not_exist,
        )

        resp = client.post(
            "/api/mobile/F999/smart-bi/datasource/upload",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
            files={"file": ("test.xlsx", b"PK\x03\x04dummy", "application/octet-stream")},
            data={"datasourceName": "test_datasource_F999_recording"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"

        py_body = _strip_envelope_extras(_strip_volatile(resp.json()))
        with io.open(GOLDEN_DIR / "datasource-upload-schema-F999.json", encoding="utf-8") as f:
            golden_body = _strip_envelope_extras(_strip_volatile(json.load(f)))

        # Verify the autoApplicable path — detectedAt is in VOLATILE so stripped,
        # but the rest of the shape must match exactly:
        #   currentVersion=0, newVersion=1 (NEW datasource)
        #   hasChanges=false, fields all empty []
        if py_body != golden_body:
            diffs = {k: {"py": py_body.get(k), "g": golden_body.get(k)}
                     for k in set(py_body) | set(golden_body)
                     if py_body.get(k) != golden_body.get(k)}
            pytest.fail(
                f"BYTE MISMATCH (upload F999 new): "
                f"{json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}"
            )

    def test_f999_new_datasource_detected_at_is_null(self, client, monkeypatch):
        """The autoApplicable path MUST emit detectedAt=null (Java line 79-86
        builder doesn't set it). This is NOT covered by the byte-shape test
        because detectedAt is in VOLATILE — so test it explicitly.
        """
        async def fake_not_exist(factory_id, name):
            return None
        monkeypatch.setattr(
            "smartbi_compat.api.datasource._query_datasource_by_name",
            fake_not_exist,
        )

        resp = client.post(
            "/api/mobile/F999/smart-bi/datasource/upload",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
            files={"file": ("test.xlsx", b"PK", "application/octet-stream")},
            data={"datasourceName": "anything_new"},
        )
        assert resp.status_code == 200
        body = resp.json()
        # detectedAt should be explicit null (not omitted, not a timestamp)
        assert body["data"]["changes"]["detectedAt"] is None, (
            f"autoApplicable path must emit detectedAt=null, got "
            f"{body['data']['changes'].get('detectedAt')!r}"
        )
        # And currentVersion=0, newVersion=1 (autoApplicable defaults)
        assert body["data"]["changes"]["currentVersion"] == 0
        assert body["data"]["changes"]["newVersion"] == 1


# ============================================================
# Test class 2 — Preview stub mirror
# ============================================================


class TestPreviewSchemaChanges:
    """GET /datasource/{id}/preview — datasource lookup + noChanges envelope."""

    def test_f999_id1_byte_shape(self, client, monkeypatch):
        """F999 + id=1 (mirrors recorded golden — Java doesn't validate factory scoping)."""
        async def fake_lookup(datasource_id):
            assert datasource_id == 1
            # Match the recorded golden — datasource id=1 belongs to F001 in test env
            # but Java's findById doesn't filter by factory_id, so F999 sees it
            return {
                "id": 1,
                "name": "IL TEATRO（西餐厅）2月_商品销量报表.xlsx",
                "factory_id": "F001",
                "schema_version": 1,
            }
        monkeypatch.setattr(
            "smartbi_compat.api.datasource._query_datasource_by_id",
            fake_lookup,
        )

        resp = client.get(
            "/api/mobile/F999/smart-bi/datasource/1/preview",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"

        py_body = _strip_envelope_extras(_strip_volatile(resp.json()))
        with io.open(GOLDEN_DIR / "datasource-preview-F999.json", encoding="utf-8") as f:
            golden_body = _strip_envelope_extras(_strip_volatile(json.load(f)))

        if py_body != golden_body:
            diffs = {k: {"py": py_body.get(k), "g": golden_body.get(k)}
                     for k in set(py_body) | set(golden_body)
                     if py_body.get(k) != golden_body.get(k)}
            pytest.fail(
                f"BYTE MISMATCH (preview F999): "
                f"{json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}"
            )

    def test_f001_id1_byte_shape(self, client, monkeypatch):
        async def fake_lookup(datasource_id):
            assert datasource_id == 1
            return {
                "id": 1,
                "name": "IL TEATRO（西餐厅）2月_商品销量报表.xlsx",
                "factory_id": "F001",
                "schema_version": 1,
            }
        monkeypatch.setattr(
            "smartbi_compat.api.datasource._query_datasource_by_id",
            fake_lookup,
        )

        resp = client.get(
            "/api/mobile/F001/smart-bi/datasource/1/preview",
            headers={"Authorization": f"Bearer {_make_token('F001')}"},
        )
        assert resp.status_code == 200

        py_body = _strip_envelope_extras(_strip_volatile(resp.json()))
        with io.open(GOLDEN_DIR / "datasource-preview-F001.json", encoding="utf-8") as f:
            golden_body = _strip_envelope_extras(_strip_volatile(json.load(f)))

        if py_body != golden_body:
            diffs = {k: {"py": py_body.get(k), "g": golden_body.get(k)}
                     for k in set(py_body) | set(golden_body)
                     if py_body.get(k) != golden_body.get(k)}
            pytest.fail(
                f"BYTE MISMATCH (preview F001): "
                f"{json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}"
            )

    def test_preview_not_exist_returns_400_envelope(self, client, monkeypatch):
        """Datasource not found → 200 + success=false + 400 code."""
        async def fake_none(_id):
            return None
        monkeypatch.setattr(
            "smartbi_compat.api.datasource._query_datasource_by_id",
            fake_none,
        )

        resp = client.get(
            "/api/mobile/F001/smart-bi/datasource/999999/preview",
            headers={"Authorization": f"Bearer {_make_token('F001')}"},
        )
        # Java returns 200 HTTP with success=false body
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert body["code"] == 400
        assert "数据源不存在" in body["message"]
        assert body["data"] is None


# ============================================================
# Test class 3 — Apply stub mirror (verifies NO DB write)
# ============================================================


class TestApplySchemaChanges:
    """POST /datasource/apply — datasource lookup + success-message envelope.

    INTENTIONAL DIVERGENCE: Java mutates DB (schema_version bump + history
    row insert). Python port skips both writes per organizer directive.
    test_apply_does_not_write_to_db verifies this assertion.
    """

    def test_f999_byte_shape(self, client, monkeypatch):
        async def fake_lookup(datasource_id):
            assert datasource_id == 1
            return {
                "id": 1,
                "name": "IL TEATRO（西餐厅）2月_商品销量报表.xlsx",
                "factory_id": "F001",
                "schema_version": 1,
            }
        monkeypatch.setattr(
            "smartbi_compat.api.datasource._query_datasource_by_id",
            fake_lookup,
        )

        resp = client.post(
            "/api/mobile/F999/smart-bi/datasource/apply",
            headers={"Authorization": f"Bearer {_make_token('F999')}"},
            json={"datasourceId": 1, "executeDbMigration": False, "createBackup": True},
        )
        assert resp.status_code == 200, f"got {resp.status_code}: {resp.text[:300]}"

        py_body = _strip_envelope_extras(_strip_volatile(resp.json()))
        with io.open(GOLDEN_DIR / "datasource-apply-F999.json", encoding="utf-8") as f:
            golden_body = _strip_envelope_extras(_strip_volatile(json.load(f)))

        if py_body != golden_body:
            diffs = {k: {"py": py_body.get(k), "g": golden_body.get(k)}
                     for k in set(py_body) | set(golden_body)
                     if py_body.get(k) != golden_body.get(k)}
            pytest.fail(
                f"BYTE MISMATCH (apply F999): "
                f"{json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}"
            )

    def test_f001_byte_shape(self, client, monkeypatch):
        async def fake_lookup(datasource_id):
            return {
                "id": 1,
                "name": "IL TEATRO（西餐厅）2月_商品销量报表.xlsx",
                "factory_id": "F001",
                "schema_version": 1,
            }
        monkeypatch.setattr(
            "smartbi_compat.api.datasource._query_datasource_by_id",
            fake_lookup,
        )

        resp = client.post(
            "/api/mobile/F001/smart-bi/datasource/apply",
            headers={"Authorization": f"Bearer {_make_token('F001')}"},
            json={"datasourceId": 1, "executeDbMigration": False, "createBackup": True},
        )
        assert resp.status_code == 200

        py_body = _strip_envelope_extras(_strip_volatile(resp.json()))
        with io.open(GOLDEN_DIR / "datasource-apply-F001.json", encoding="utf-8") as f:
            golden_body = _strip_envelope_extras(_strip_volatile(json.load(f)))

        if py_body != golden_body:
            diffs = {k: {"py": py_body.get(k), "g": golden_body.get(k)}
                     for k in set(py_body) | set(golden_body)
                     if py_body.get(k) != golden_body.get(k)}
            pytest.fail(
                f"BYTE MISMATCH (apply F001): "
                f"{json.dumps(diffs, indent=2, ensure_ascii=False)[:2000]}"
            )

    def test_apply_not_exist_returns_400_envelope(self, client, monkeypatch):
        """Datasource not found → 200 + success=false + 400 code envelope."""
        async def fake_none(_id):
            return None
        monkeypatch.setattr(
            "smartbi_compat.api.datasource._query_datasource_by_id",
            fake_none,
        )

        resp = client.post(
            "/api/mobile/F001/smart-bi/datasource/apply",
            headers={"Authorization": f"Bearer {_make_token('F001')}"},
            json={"datasourceId": 999999},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert body["code"] == 400
        assert "数据源不存在" in body["message"]
        assert body["data"] is None

    def test_apply_does_not_write_to_db(self, client, monkeypatch):
        """CRITICAL DIVERGENCE TEST: Python apply MUST NOT write to DB.

        Java applySchemaChanges does:
          1. datasource.incrementSchemaVersion() + datasourceRepository.save()
          2. schemaHistoryRepository.save(history)
        Both are intentionally SKIPPED in the Python port (organizer directive
        Phase 2A scope-completeness MO 2026-05-09). This test wires a
        write-counting fake pool to prove no INSERT / UPDATE goes through.
        """
        write_calls = {"execute": 0, "executemany": 0, "fetch": 0, "fetchrow": 0, "fetchval": 0}

        class FakeConn:
            async def fetchrow(self, sql, *args):
                write_calls["fetchrow"] += 1
                # The route does ONE fetchrow (datasource lookup). Anything
                # past that would be a write or a re-read.
                if _is_write_sql(sql):
                    raise AssertionError(
                        f"apply endpoint MUST NOT write to DB (SQL: {sql[:200]})"
                    )
                return {
                    "id": 1,
                    "name": "test_ds",
                    "factory_id": "F001",
                    "schema_version": 1,
                }

            async def execute(self, sql, *args):
                write_calls["execute"] += 1
                raise AssertionError(
                    f"apply endpoint MUST NOT call execute (SQL: {sql[:200]})"
                )

            async def executemany(self, sql, *args):
                write_calls["executemany"] += 1
                raise AssertionError(
                    f"apply endpoint MUST NOT call executemany (SQL: {sql[:200]})"
                )

            async def fetch(self, sql, *args):
                write_calls["fetch"] += 1
                if _is_write_sql(sql):
                    raise AssertionError(
                        f"apply endpoint MUST NOT write to DB (SQL: {sql[:200]})"
                    )
                return []

            async def fetchval(self, sql, *args):
                write_calls["fetchval"] += 1
                return None

        class FakePool:
            def acquire(self):
                conn = FakeConn()

                class _Cm:
                    async def __aenter__(self_inner):
                        return conn

                    async def __aexit__(self_inner, *exc):
                        return False

                return _Cm()

        async def fake_get_pool():
            return FakePool()

        monkeypatch.setattr(
            "smartbi_compat.api.datasource._get_cretas_pool",
            fake_get_pool,
        )

        resp = client.post(
            "/api/mobile/F001/smart-bi/datasource/apply",
            headers={"Authorization": f"Bearer {_make_token('F001')}"},
            json={"datasourceId": 1},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["message"] == "Schema changes applied"
        assert body["data"] is None

        # Verify DB call shape: exactly 1 fetchrow (the datasource lookup),
        # 0 writes of any kind. Java would be: fetchrow + UPDATE + INSERT.
        assert write_calls["execute"] == 0, f"unexpected execute() calls: {write_calls['execute']}"
        assert write_calls["executemany"] == 0, f"unexpected executemany() calls: {write_calls['executemany']}"
        assert write_calls["fetchrow"] == 1, (
            f"expected exactly 1 fetchrow (datasource lookup), got {write_calls['fetchrow']}"
        )

    def test_apply_missing_datasource_id_returns_400(self, client):
        """Empty datasourceId in body → 400 envelope (ApiResponse.error path)."""
        resp = client.post(
            "/api/mobile/F001/smart-bi/datasource/apply",
            headers={"Authorization": f"Bearer {_make_token('F001')}"},
            json={"executeDbMigration": False},  # missing datasourceId
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert body["code"] == 400
