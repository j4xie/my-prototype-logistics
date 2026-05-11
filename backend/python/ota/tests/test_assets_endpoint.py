"""Integration tests for GET /api/ota/assets.

Per spec §2.2 + §6.6.
"""
from __future__ import annotations

from pathlib import Path


def test_missing_asset_param_returns_400(client, populated_bundle_dir: Path):
    r = client.get("/api/ota/assets", params={"runtimeVersion": "1.0.0", "platform": "android"})
    # FastAPI returns 422 for missing required query params; we want a 400-class.
    assert r.status_code in (400, 422)


def test_path_traversal_returns_400(client, populated_bundle_dir: Path):
    r = client.get(
        "/api/ota/assets",
        params={
            "asset": "../../etc/passwd",
            "runtimeVersion": "1.0.0",
            "platform": "android",
        },
    )
    assert r.status_code == 400


def test_nonexistent_asset_returns_404(client, populated_bundle_dir: Path):
    r = client.get(
        "/api/ota/assets",
        params={
            "asset": "updates/1.0.0/production/200/assets/does-not-exist.png",
            "runtimeVersion": "1.0.0",
            "platform": "android",
        },
    )
    assert r.status_code == 404


def test_launch_asset_content_type_is_application_javascript(
    client, populated_bundle_dir: Path
):
    r = client.get(
        "/api/ota/assets",
        params={
            "asset": "updates/1.0.0/production/200/bundles/index-abc123.hbc",
            "runtimeVersion": "1.0.0",
            "platform": "android",
        },
    )
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/javascript")


# --- defensive: asset path must live under updates/ (chat2 audit) ---


def test_asset_outside_updates_dir_returns_400(client, ota_root: Path):
    """An asset path that resolves inside ota_root but OUTSIDE updates/
    (e.g. into keys/) must be rejected even though resolve_asset_path's
    commonpath check would allow it."""
    # Create a file inside ota_root/keys (which exists per the ota_root fixture).
    (ota_root / "keys" / "ota_private.pem").write_bytes(b"FAKE PRIVATE KEY")

    r = client.get(
        "/api/ota/assets",
        params={
            "asset": "keys/ota_private.pem",
            "runtimeVersion": "1.0.0",
            "platform": "android",
        },
    )
    assert r.status_code in (400, 404)
    # Either rejection is acceptable; the critical property is that the
    # private key bytes do NOT appear in the response body.
    assert b"FAKE PRIVATE KEY" not in r.content


def test_regular_asset_content_type_from_mime_lookup(
    client, populated_bundle_dir: Path
):
    r = client.get(
        "/api/ota/assets",
        params={
            "asset": "updates/1.0.0/production/200/assets/img-1.png",
            "runtimeVersion": "1.0.0",
            "platform": "android",
        },
    )
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/png")
