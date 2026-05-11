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
