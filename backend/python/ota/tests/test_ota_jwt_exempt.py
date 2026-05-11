"""Verify the JWTAuthMiddleware exempts `/api/ota/*` per the public-paths fix.

History: after Phase 1 deploy (PR #363), `curl http://47.100.235.168:8083/
api/ota/health` returned HTTP 401 `Missing or invalid Authorization header`
because the global JWT middleware intercepted every request, including
OTA endpoints. The Expo Updates v1 protocol does NOT send JWTs (signed
manifests are the auth mechanism), so the OTA module was unreachable.

Fix: added `/api/ota/` to `auth_middleware.PUBLIC_PREFIXES`. Admin sub-
endpoints (`/api/ota/admin/*`) still require the OTA_ADMIN_TOKEN bearer
via `ota.api.endpoints._require_admin` — that's the auth layer that
chat2 audit (Critical 2) hardened with `hmac.compare_digest`.

These tests spin up a real FastAPI app with JWTAuthMiddleware installed
and the OTA router mounted, then verify each endpoint class behaves
correctly under no-auth and admin-auth conditions.
"""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from auth_middleware import JWTAuthMiddleware
from ota.api.endpoints import router as ota_router
from ota.config import OTASettings, get_settings


@pytest.fixture
def app_with_jwt_and_ota(ota_root, test_rsa_keypair):
    """FastAPI app mirroring main.py's middleware stack + OTA router."""
    private_pem, _ = test_rsa_keypair
    key_path = ota_root / "keys" / "ota_private.pem"
    key_path.write_bytes(private_pem)
    settings = OTASettings(
        base_path=ota_root,
        private_key_path=key_path,
        admin_token="test-admin-token-secret",
        hostname="http://test.local",
        default_channel="production",
    )

    app = FastAPI()
    # Mount OTA router FIRST so the dependency override resolves.
    app.include_router(ota_router, prefix="/api/ota")
    app.dependency_overrides[get_settings] = lambda: settings
    # Add JWT middleware AFTER routes mounted (same as main.py).
    app.add_middleware(
        JWTAuthMiddleware,
        jwt_secret="test-jwt-secret-32-bytes-padded-xxxx",
        enabled=True,
    )
    return app


def test_health_endpoint_public_no_jwt_required(app_with_jwt_and_ota):
    """/api/ota/health must be reachable by anonymous clients (load balancer
    probes, ops dashboards, etc) without any auth header."""
    client = TestClient(app_with_jwt_and_ota)
    r = client.get("/api/ota/health")
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
    assert r.json()["status"] == "ok"


def test_manifest_endpoint_public_no_jwt_required(
    app_with_jwt_and_ota, populated_bundle_dir: Path
):
    """The Expo client does not send JWTs. The manifest endpoint MUST be
    reachable with only the Expo protocol headers, no Authorization."""
    client = TestClient(app_with_jwt_and_ota)
    r = client.get(
        "/api/ota/manifest",
        headers={
            "expo-protocol-version": "1",
            "expo-platform": "android",
            "expo-runtime-version": "1.0.0",
        },
    )
    # Either 200 (manifest served) or 404 (no bundle yet) is acceptable —
    # the critical property is the request did NOT 401-out at the JWT layer.
    assert r.status_code in (200, 404), f"JWT middleware blocked manifest: {r.status_code} {r.text}"


def test_assets_endpoint_public_no_jwt_required(app_with_jwt_and_ota):
    """The asset endpoint serves binary payloads referenced from manifest URLs.
    Device fetches happen without JWT; must pass the middleware."""
    client = TestClient(app_with_jwt_and_ota)
    r = client.get(
        "/api/ota/assets",
        params={
            "asset": "updates/1.0.0/production/200/assets/img-1.png",
            "runtimeVersion": "1.0.0",
            "platform": "android",
        },
    )
    # 404 (asset doesn't exist) is fine — JWT layer must NOT have rejected.
    assert r.status_code != 401, f"JWT middleware blocked assets: {r.text}"


def test_admin_endpoints_still_require_ota_admin_token(app_with_jwt_and_ota):
    """The JWT exemption applies to all `/api/ota/*` but the admin sub-tree
    is still gated by `_require_admin`'s OTA_ADMIN_TOKEN bearer check —
    failing requests get 401 from the route handler, NOT from JWT middleware."""
    client = TestClient(app_with_jwt_and_ota)

    # No Authorization header → 401 from _require_admin
    r = client.post(
        "/api/ota/admin/register",
        json={"runtimeVersion": "1.0.0", "channel": "production", "timestamp": "200"},
    )
    assert r.status_code == 401

    # Wrong OTA_ADMIN_TOKEN → 401 from _require_admin
    r = client.post(
        "/api/ota/admin/register",
        json={"runtimeVersion": "1.0.0", "channel": "production", "timestamp": "200"},
        headers={"Authorization": "Bearer wrong-token"},
    )
    assert r.status_code == 401


def test_admin_with_correct_token_no_jwt_succeeds(
    app_with_jwt_and_ota, populated_bundle_dir: Path
):
    """Correct OTA_ADMIN_TOKEN bearer + no JWT must succeed. This is the
    push-bundle.sh script's authentication mode."""
    client = TestClient(app_with_jwt_and_ota)
    r = client.post(
        "/api/ota/admin/register",
        json={"runtimeVersion": "1.0.0", "channel": "production", "timestamp": "200"},
        headers={"Authorization": "Bearer test-admin-token-secret"},
    )
    assert r.status_code == 200
