"""Integration tests for /api/ota/admin/* endpoints.

Per spec §2.3 + §6.7. All admin endpoints require Bearer-token auth.
"""
from __future__ import annotations

from pathlib import Path

import pytest


def _auth(token: str = "test-admin-token-secret") -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_register_requires_bearer_token(client, populated_bundle_dir: Path):
    body = {"runtimeVersion": "1.0.0", "channel": "production", "timestamp": "200"}

    r = client.post("/api/ota/admin/register", json=body)
    assert r.status_code == 401  # no Authorization header

    r2 = client.post(
        "/api/ota/admin/register", json=body, headers=_auth("wrong-token")
    )
    assert r2.status_code == 401

    r3 = client.post("/api/ota/admin/register", json=body, headers=_auth())
    assert r3.status_code == 200


def test_register_validates_directory_exists(client, populated_bundle_dir: Path):
    """If timestamp dir doesn't exist, register should 404."""
    r = client.post(
        "/api/ota/admin/register",
        json={"runtimeVersion": "1.0.0", "channel": "production", "timestamp": "9999"},
        headers=_auth(),
    )
    assert r.status_code == 404


def test_register_rejects_missing_metadata_json(client, ota_root: Path):
    """A bundle dir without metadata.json must be rejected."""
    empty = ota_root / "updates" / "1.0.0" / "production" / "300"
    empty.mkdir(parents=True)
    # no metadata.json placed

    r = client.post(
        "/api/ota/admin/register",
        json={"runtimeVersion": "1.0.0", "channel": "production", "timestamp": "300"},
        headers=_auth(),
    )
    assert r.status_code == 400


def test_rollback_creates_rollback_marker_file(client, populated_bundle_dir: Path):
    r = client.post(
        "/api/ota/admin/rollback",
        json={"runtimeVersion": "1.0.0", "channel": "production", "timestamp": "200"},
        headers=_auth(),
    )
    assert r.status_code == 200
    assert (populated_bundle_dir / "rollback").is_file()


def test_list_returns_newest_first(client, ota_root: Path):
    rv_channel = ota_root / "updates" / "1.0.0" / "production"
    rv_channel.mkdir(parents=True)
    for ts in ("100", "200", "300"):
        (rv_channel / ts).mkdir()

    r = client.get(
        "/api/ota/admin/list",
        params={"runtimeVersion": "1.0.0", "channel": "production"},
        headers=_auth(),
    )
    assert r.status_code == 200
    items = r.json()["bundles"]
    assert [b["timestamp"] for b in items] == ["300", "200", "100"]


# --- chat2 audit Critical 2: BundleRef must reject malicious path components ---


@pytest.mark.parametrize(
    "field,bad_value",
    [
        ("runtimeVersion", "../../etc"),
        ("runtimeVersion", ".."),
        ("runtimeVersion", "."),
        ("runtimeVersion", ".ssh"),
        ("runtimeVersion", "1.0.0/../../etc"),
        ("channel", "..\\windows"),
        ("channel", ""),
        ("channel", "a;rm -rf /"),
        ("timestamp", "../../etc/pwn"),
        ("timestamp", "/etc/passwd"),
        ("timestamp", "200\x00.txt"),
    ],
)
def test_register_rejects_malicious_bundle_ref(client, field: str, bad_value: str):
    body = {"runtimeVersion": "1.0.0", "channel": "production", "timestamp": "200"}
    body[field] = bad_value
    r = client.post("/api/ota/admin/register", json=body, headers=_auth())
    # Pydantic returns 422 for pattern/validator failures, regardless of admin auth.
    assert r.status_code == 422, f"expected 422 for {field}={bad_value!r}, got {r.status_code}"


def test_rollback_rejects_malicious_timestamp(client):
    r = client.post(
        "/api/ota/admin/rollback",
        json={"runtimeVersion": "1.0.0", "channel": "production", "timestamp": "../../etc/pwn"},
        headers=_auth(),
    )
    assert r.status_code == 422


def test_list_includes_rollback_status(client, ota_root: Path):
    rv_channel = ota_root / "updates" / "1.0.0" / "production"
    rv_channel.mkdir(parents=True)
    (rv_channel / "200").mkdir()
    (rv_channel / "300").mkdir()
    (rv_channel / "300" / "rollback").touch()

    r = client.get(
        "/api/ota/admin/list",
        params={"runtimeVersion": "1.0.0", "channel": "production"},
        headers=_auth(),
    )
    assert r.status_code == 200
    items = {b["timestamp"]: b for b in r.json()["bundles"]}
    assert items["300"]["isRollback"] is True
    assert items["200"]["isRollback"] is False
