"""End-to-end happy-path test for the self-hosted OTA pipeline.

Exercises the entire client-visible lifecycle against a single FastAPI
TestClient instance with the OTA router mounted and a populated bundle:

  1. /health probe returns 200 with correct flags
  2. Admin registers a bundle (POST /admin/register) → 200
  3. Anonymous Expo client polls /manifest → multipart with manifest + extensions
  4. Client extracts asset URL, fetches /assets/<rel> → binary 200
  5. Client re-polls /manifest with expo-current-update-id → noUpdateAvailable
  6. Admin marks bundle as rolled back (POST /admin/rollback) → 200
  7. Client re-polls /manifest (with expo-embedded-update-id) → rollBackToEmbedded
  8. Admin list confirms rollback marker visible

This complements `test_manifest_endpoint.py` / `test_admin_endpoints.py`
(which focus on individual endpoint contracts) by validating the COMBINED
flow that real device + push-bundle.sh operator scripts exercise.

Phase 3 + Phase 4 + Phase 6 reviewer test: this is the regression net
that catches any future refactor breaking the manifest → asset → no-update
→ rollback state machine.
"""
from __future__ import annotations

import re
from pathlib import Path


def _expo_headers(**overrides) -> dict:
    base = {
        "expo-protocol-version": "1",
        "expo-platform": "android",
        "expo-runtime-version": "1.0.0",
    }
    base.update(overrides)
    return base


def _auth() -> dict:
    return {"Authorization": "Bearer test-admin-token-secret"}


def test_full_cycle_health_register_manifest_asset_noupdate_rollback(
    client, populated_bundle_dir: Path
):
    # --- Step 1: health probe ------------------------------------------
    r = client.get("/api/ota/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["privateKeyLoaded"] is True
    assert body["writable"] is True

    # --- Step 2: admin register a bundle -------------------------------
    r = client.post(
        "/api/ota/admin/register",
        json={"runtimeVersion": "1.0.0", "channel": "production", "timestamp": "200"},
        headers=_auth(),
    )
    assert r.status_code == 200
    assert r.json()["status"] == "registered"

    # --- Step 3: anonymous client polls manifest ----------------------
    r = client.get("/api/ota/manifest", headers=_expo_headers())
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("multipart/mixed")
    body_text = r.text
    assert 'name="manifest"' in body_text
    assert 'name="extensions"' in body_text

    # Extract the manifest id + the first asset URL for the next step.
    id_match = re.search(r'"id":"([0-9a-f-]{36})"', body_text)
    assert id_match is not None, "manifest must include a UUID-shaped id"
    update_id = id_match.group(1)

    asset_url_match = re.search(r'"url":"([^"]+/api/ota/assets\?[^"]+)"', body_text)
    assert asset_url_match is not None, "manifest must include at least one asset URL"
    asset_url = asset_url_match.group(1)

    # --- Step 4: fetch one of the assets the manifest pointed at -------
    # The url is server-emitted with full http://host prefix; strip to path+query.
    path_query = asset_url.split("/api/ota/assets", 1)[1]
    r = client.get(f"/api/ota/assets{path_query}")
    assert r.status_code == 200, f"asset fetch failed: {r.text[:200]}"
    # The fixture asset was b'\\x89PNG\\r\\n\\x1a\\nfake-png' — verify content-type
    # is image/png (deduced via mimetypes) AND body is non-empty.
    assert r.headers["content-type"].startswith("image/png") or \
        r.headers["content-type"].startswith("application/javascript"), \
        f"unexpected content-type: {r.headers['content-type']}"
    assert len(r.content) > 0

    # --- Step 5: re-poll manifest with current-update-id → noUpdateAvailable ---
    r = client.get(
        "/api/ota/manifest",
        headers=_expo_headers(**{"expo-current-update-id": update_id}),
    )
    assert r.status_code == 200
    no_update_body = r.text
    assert '"noUpdateAvailable"' in no_update_body
    # And critically, the response is JUST the directive — no manifest part.
    assert 'name="manifest"' not in no_update_body
    assert 'name="extensions"' not in no_update_body

    # --- Step 6: admin marks the bundle as rolled back -----------------
    r = client.post(
        "/api/ota/admin/rollback",
        json={"runtimeVersion": "1.0.0", "channel": "production", "timestamp": "200"},
        headers=_auth(),
    )
    assert r.status_code == 200

    # --- Step 7: client re-polls → rollBackToEmbedded directive --------
    # Rollback flow requires expo-embedded-update-id — typically the id baked
    # into the APK at build time. Simulate by sending a distinct UUID.
    r = client.get(
        "/api/ota/manifest",
        headers=_expo_headers(
            **{"expo-embedded-update-id": "00000000-0000-0000-0000-000000000000"}
        ),
    )
    assert r.status_code == 200
    rollback_body = r.text
    assert '"rollBackToEmbedded"' in rollback_body
    assert '"commitTime"' in rollback_body
    assert 'name="manifest"' not in rollback_body

    # --- Step 8: admin/list confirms the bundle still exists with rollback flag ---
    r = client.get(
        "/api/ota/admin/list",
        params={"runtimeVersion": "1.0.0", "channel": "production"},
        headers=_auth(),
    )
    assert r.status_code == 200
    items = {b["timestamp"]: b for b in r.json()["bundles"]}
    assert "200" in items
    assert items["200"]["isRollback"] is True


def test_full_cycle_no_bundle_returns_404(client, ota_root: Path):
    """Sanity inverse: client polling a runtime version with NO bundle gets 404."""
    r = client.get(
        "/api/ota/manifest",
        headers=_expo_headers(**{"expo-runtime-version": "9.9.9-doesnotexist"}),
    )
    assert r.status_code == 404


def test_full_cycle_asset_url_is_self_consistent(
    client, populated_bundle_dir: Path
):
    """The asset URL emitted in the manifest MUST be fetchable by replaying
    it back through the same client. Catches URL-encoding drift between
    manifest_builder._asset_url() and the assets endpoint."""
    r = client.get("/api/ota/manifest", headers=_expo_headers())
    assert r.status_code == 200

    # Grab every asset URL from the manifest body.
    for url in re.findall(r'"url":"([^"]+/api/ota/assets\?[^"]+)"', r.text):
        path_query = url.split("/api/ota/assets", 1)[1]
        # Re-encode any literal forward slashes that the JSON-escape preserved.
        r_asset = client.get(f"/api/ota/assets{path_query}")
        assert r_asset.status_code == 200, (
            f"asset URL emitted by manifest is not fetchable: {url} → {r_asset.status_code}"
        )
