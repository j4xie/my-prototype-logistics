"""Integration tests for GET /api/ota/manifest.

Per spec §2.1 + §6.5. The endpoint speaks Expo Updates v1 protocol — all input
is via headers (NOT body) and all output is multipart/mixed.
"""
from __future__ import annotations

from pathlib import Path


def _default_headers(**overrides) -> dict:
    base = {
        "expo-protocol-version": "1",
        "expo-platform": "android",
        "expo-runtime-version": "1.0.0",
    }
    base.update(overrides)
    return base


def test_missing_protocol_version_returns_400(client, populated_bundle_dir: Path):
    h = _default_headers()
    del h["expo-protocol-version"]
    r = client.get("/api/ota/manifest", headers=h)
    assert r.status_code == 400


def test_protocol_version_0_returns_400(client, populated_bundle_dir: Path):
    r = client.get(
        "/api/ota/manifest", headers=_default_headers(**{"expo-protocol-version": "0"})
    )
    assert r.status_code == 400


def test_missing_platform_returns_400(client, populated_bundle_dir: Path):
    h = _default_headers()
    del h["expo-platform"]
    r = client.get("/api/ota/manifest", headers=h)
    assert r.status_code == 400


def test_unknown_platform_returns_400(client, populated_bundle_dir: Path):
    r = client.get(
        "/api/ota/manifest", headers=_default_headers(**{"expo-platform": "windows"})
    )
    assert r.status_code == 400


def test_missing_runtime_version_returns_400(client, populated_bundle_dir: Path):
    h = _default_headers()
    del h["expo-runtime-version"]
    r = client.get("/api/ota/manifest", headers=h)
    assert r.status_code == 400


def test_unknown_runtime_version_returns_404(client, populated_bundle_dir: Path):
    r = client.get(
        "/api/ota/manifest",
        headers=_default_headers(**{"expo-runtime-version": "99.99.99"}),
    )
    assert r.status_code == 404


def test_default_channel_is_production_when_header_missing(
    client, populated_bundle_dir: Path
):
    """populated_bundle_dir lives under .../production/... — no channel header
    should still resolve to it via default_channel='production'."""
    r = client.get("/api/ota/manifest", headers=_default_headers())
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("multipart/mixed")
    assert 'name="manifest"' in r.text


def test_current_update_id_matches_latest_returns_no_update_directive(
    client, populated_bundle_dir: Path
):
    """Two-step: first request fetches manifest+id, second sends that id and
    must come back with a noUpdateAvailable directive, no manifest part."""
    first = client.get("/api/ota/manifest", headers=_default_headers())
    assert first.status_code == 200
    # Pull the id out of the manifest part body.
    import re

    m = re.search(r'"id":"([0-9a-f-]+)"', first.text)
    assert m, "manifest part should contain an id field"
    update_id = m.group(1)

    second = client.get(
        "/api/ota/manifest",
        headers=_default_headers(**{"expo-current-update-id": update_id}),
    )
    assert second.status_code == 200
    assert '"noUpdateAvailable"' in second.text
    assert 'name="manifest"' not in second.text


def test_expect_signature_header_adds_expo_signature_to_manifest_part(
    client, populated_bundle_dir: Path
):
    r = client.get(
        "/api/ota/manifest",
        headers=_default_headers(
            **{"expo-expect-signature": 'sig, keyid="main", alg="rsa-v1_5-sha256"'}
        ),
    )
    assert r.status_code == 200
    # The signature header lives INSIDE the manifest part, not in HTTP response.
    assert "expo-signature: sig=" in r.text
    assert 'keyid="main"' in r.text


def test_no_expect_signature_omits_expo_signature_part_header(
    client, populated_bundle_dir: Path
):
    r = client.get("/api/ota/manifest", headers=_default_headers())
    assert r.status_code == 200
    assert "expo-signature" not in r.text


# --- chat2 audit Critical 1: path-traversal via header inputs ---


def test_manifest_with_path_traversal_runtime_version_returns_400(
    client, populated_bundle_dir: Path
):
    r = client.get(
        "/api/ota/manifest",
        headers=_default_headers(**{"expo-runtime-version": "../../etc"}),
    )
    assert r.status_code == 400
    assert "etc" not in r.json().get("error", "")  # don't echo the malicious value


def test_manifest_with_path_traversal_channel_returns_400(
    client, populated_bundle_dir: Path
):
    r = client.get(
        "/api/ota/manifest",
        headers=_default_headers(**{"expo-channel-name": "..\\..\\windows"}),
    )
    assert r.status_code == 400


def test_manifest_with_leading_dot_runtime_version_returns_400(
    client, populated_bundle_dir: Path
):
    """Hidden-file probing: `expo-runtime-version: .ssh` must be rejected."""
    r = client.get(
        "/api/ota/manifest", headers=_default_headers(**{"expo-runtime-version": ".ssh"})
    )
    assert r.status_code == 400


# --- chat2 audit Important C: corrupt metadata handling ---


def test_corrupt_metadata_json_returns_500_not_crash(
    client, populated_bundle_dir: Path
):
    """If metadata.json is non-JSON garbage, return 500 with a generic message
    (not a 200-with-stacktrace, not a 500-with-stacktrace exposing paths)."""
    (populated_bundle_dir / "metadata.json").write_bytes(b"this is not json {{{")

    r = client.get("/api/ota/manifest", headers=_default_headers())

    assert r.status_code == 500
    assert "Bundle metadata corrupted" in r.json().get("error", "")
    # Don't leak filesystem paths in the error message.
    assert str(populated_bundle_dir) not in r.text


def test_missing_expo_config_json_returns_500(client, populated_bundle_dir: Path):
    """If expoConfig.json is missing, manifest_builder raises; endpoint catches → 500."""
    (populated_bundle_dir / "expoConfig.json").unlink()

    r = client.get("/api/ota/manifest", headers=_default_headers())

    assert r.status_code == 500


# --- chat2 audit Important E: signature-requested-but-no-key fails loud ---


def test_signature_requested_but_no_private_key_returns_500(
    ota_root, populated_bundle_dir, monkeypatch
):
    """Per chat2 audit Important E: silently dropping the signature when the
    client EXPLICITLY asked for it would cause confusing client-side verify
    failures on the device. Server must fail loud (500) instead."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from ota.api.endpoints import router
    from ota.config import OTASettings, get_settings

    settings_no_key = OTASettings(
        base_path=ota_root,
        private_key_path=None,  # ← signature impossible
        admin_token="x",
        hostname="http://test.local",
        default_channel="production",
    )
    app = FastAPI()
    app.include_router(router, prefix="/api/ota")
    app.dependency_overrides[get_settings] = lambda: settings_no_key

    r = TestClient(app).get(
        "/api/ota/manifest",
        headers=_default_headers(
            **{"expo-expect-signature": 'sig, keyid="main", alg="rsa-v1_5-sha256"'}
        ),
    )
    assert r.status_code == 500
    assert "Private key not loaded" in r.json().get("detail", "")


def test_no_signature_request_with_no_key_still_succeeds(
    ota_root, populated_bundle_dir
):
    """Sanity inverse: if client does NOT request signature, missing private
    key is fine (server can serve unsigned manifests)."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from ota.api.endpoints import router
    from ota.config import OTASettings, get_settings

    settings_no_key = OTASettings(
        base_path=ota_root,
        private_key_path=None,
        admin_token="x",
        hostname="http://test.local",
        default_channel="production",
    )
    app = FastAPI()
    app.include_router(router, prefix="/api/ota")
    app.dependency_overrides[get_settings] = lambda: settings_no_key

    r = TestClient(app).get("/api/ota/manifest", headers=_default_headers())
    assert r.status_code == 200
