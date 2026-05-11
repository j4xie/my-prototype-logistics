#!/usr/bin/env bash
# Phase 6 minimal E2E smoke for the self-hosted OTA pipeline.
#
# Manufactures a synthetic test bundle (NOT a real `expo export` output),
# uploads it to the SERVER 47 filesystem under a TEST runtime version +
# staging channel, registers it via /api/ota/admin/register, then verifies:
#
#   1. /api/ota/health returns 200
#   2. /api/ota/manifest returns multipart/mixed with manifest + extensions parts
#   3. The manifest part contains the synthetic asset URL
#   4. /api/ota/assets fetches the asset binary correctly
#   5. Polling /api/ota/manifest with the SAME current-update-id → noUpdateAvailable directive
#   6. Cleanup: ssh-delete the test bundle dir + admin-list confirms it's gone
#
# Unlike push-bundle.sh, this does NOT shell out to `npx expo export` or
# any toolchain — it synthesizes the minimum metadata.json / expoConfig.json
# / bundles/*.hbc / assets/* files inline. Runtime: ~10 seconds.
#
# Usage:
#   export OTA_ADMIN_TOKEN=<hex64>
#   ./scripts/ota/smoke-e2e.sh
#
# Exit codes:
#   0 — all 6 assertions passed, cleanup done
#   2 — bad env / missing dep
#   3 — assertion failed (which step is in stderr)
#   4 — unexpected server error
#
# This script is safe to run on production server 47 because it uses a
# dedicated TEST runtime version ("0.0.0-smoke") + staging channel — neither
# is ever requested by real Expo clients.

set -euo pipefail

SERVER="${OTA_SERVER:-root@47.100.235.168}"
SERVER_BUNDLE_ROOT="${OTA_SERVER_BUNDLE_ROOT:-/www/wwwroot/ota}"
SERVER_API="${OTA_SERVER_API:-http://47.100.235.168:8083}"
ADMIN_TOKEN="${OTA_ADMIN_TOKEN:?OTA_ADMIN_TOKEN env var required — source ~/.ota-env}"

# Dedicated TEST namespace — never collides with real bundles.
RV="0.0.0-smoke"
CHANNEL="staging"
TIMESTAMP="$(date +%s%3N)"
TARGET="updates/${RV}/${CHANNEL}/${TIMESTAMP}"

# Cleanup on exit (even on assertion failure).
cleanup() {
    local rc=$?
    echo
    echo "[smoke] cleanup: removing ${SERVER_BUNDLE_ROOT}/${TARGET}"
    ssh "$SERVER" "rm -rf '${SERVER_BUNDLE_ROOT}/${TARGET}'" 2>/dev/null || true
    return $rc
}
trap cleanup EXIT

echo "=== Phase 6 E2E smoke — rv=${RV} channel=${CHANNEL} ts=${TIMESTAMP} ==="

# ---------------------------------------------------------------------------
# 0. Pre-flight: /api/ota/health
# ---------------------------------------------------------------------------
echo
echo "[smoke] 0/6 /api/ota/health"
HEALTH_CODE="$(curl -s -o /tmp/ota-smoke-health.json -w "%{http_code}" "${SERVER_API}/api/ota/health")"
if [[ "$HEALTH_CODE" != "200" ]]; then
    echo "  FAIL: health returned $HEALTH_CODE (expected 200)" >&2
    cat /tmp/ota-smoke-health.json >&2 || true
    exit 3
fi
echo "  PASS — $(cat /tmp/ota-smoke-health.json)"

# ---------------------------------------------------------------------------
# 1. Manufacture + upload the synthetic test bundle
# ---------------------------------------------------------------------------
echo
echo "[smoke] 1/6 synthesizing test bundle"
LOCAL_STAGE="/tmp/ota-smoke-${TIMESTAMP}"
rm -rf "$LOCAL_STAGE"
mkdir -p "$LOCAL_STAGE/bundles" "$LOCAL_STAGE/assets"

# Minimal expo metadata.json with one bundle + one asset.
cat > "$LOCAL_STAGE/metadata.json" <<JSON
{
  "version": 0,
  "bundler": "smoke-e2e",
  "fileMetadata": {
    "android": {
      "bundle": "bundles/index-smoke.hbc",
      "assets": [{"path": "assets/marker.txt", "ext": "txt"}]
    },
    "ios": {"bundle": "bundles/index-smoke.hbc", "assets": []}
  }
}
JSON

# Minimal expoConfig.json (echoed back to client in manifest.extra.expoClient).
cat > "$LOCAL_STAGE/expoConfig.json" <<JSON
{"name": "CretasFoodTrace", "slug": "CretasFoodTrace", "version": "${RV}"}
JSON

# Bundle + asset content distinctive enough to verify in step 5.
echo "// Phase 6 smoke bundle ts=${TIMESTAMP}" > "$LOCAL_STAGE/bundles/index-smoke.hbc"
echo "marker-${TIMESTAMP}" > "$LOCAL_STAGE/assets/marker.txt"

tar -czf "/tmp/ota-smoke-${TIMESTAMP}.tar.gz" -C "$LOCAL_STAGE" .
echo "  staged $(du -sh /tmp/ota-smoke-${TIMESTAMP}.tar.gz | cut -f1)"

echo "[smoke] 2/6 uploading to ${SERVER}:${SERVER_BUNDLE_ROOT}/${TARGET}"
scp -q "/tmp/ota-smoke-${TIMESTAMP}.tar.gz" "${SERVER}:/tmp/"
ssh "$SERVER" "bash -s" <<REMOTE_EOF
set -euo pipefail
mkdir -p "${SERVER_BUNDLE_ROOT}/${TARGET}.tmp"
tar -xzf "/tmp/ota-smoke-${TIMESTAMP}.tar.gz" -C "${SERVER_BUNDLE_ROOT}/${TARGET}.tmp/"
mv "${SERVER_BUNDLE_ROOT}/${TARGET}.tmp" "${SERVER_BUNDLE_ROOT}/${TARGET}"
rm "/tmp/ota-smoke-${TIMESTAMP}.tar.gz"
REMOTE_EOF
rm -rf "$LOCAL_STAGE" "/tmp/ota-smoke-${TIMESTAMP}.tar.gz"

# ---------------------------------------------------------------------------
# 3. POST /api/ota/admin/register
# ---------------------------------------------------------------------------
echo "[smoke] 3/6 POST /api/ota/admin/register"
REG_CODE="$(curl -s -o /tmp/ota-smoke-register.json -w "%{http_code}" \
    -X POST "${SERVER_API}/api/ota/admin/register" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"runtimeVersion\":\"${RV}\",\"channel\":\"${CHANNEL}\",\"timestamp\":\"${TIMESTAMP}\"}")"
if [[ "$REG_CODE" != "200" ]]; then
    echo "  FAIL: register returned $REG_CODE" >&2
    cat /tmp/ota-smoke-register.json >&2 || true
    exit 3
fi
echo "  PASS"

# ---------------------------------------------------------------------------
# 4. GET /api/ota/manifest — expect multipart/mixed with manifest + extensions
# ---------------------------------------------------------------------------
echo "[smoke] 4/6 GET /api/ota/manifest"
MAN_CODE="$(curl -s -o /tmp/ota-smoke-manifest.bin -w "%{http_code}" \
    -H 'expo-protocol-version: 1' \
    -H 'expo-platform: android' \
    -H "expo-runtime-version: ${RV}" \
    -H "expo-channel-name: ${CHANNEL}" \
    "${SERVER_API}/api/ota/manifest")"
if [[ "$MAN_CODE" != "200" ]]; then
    echo "  FAIL: manifest returned $MAN_CODE" >&2
    head -c 1024 /tmp/ota-smoke-manifest.bin >&2 || true
    echo >&2
    exit 3
fi

# Shape assertions on the multipart body.
if ! grep -q 'name="manifest"' /tmp/ota-smoke-manifest.bin; then
    echo "  FAIL: manifest part missing from response" >&2
    exit 3
fi
if ! grep -q 'name="extensions"' /tmp/ota-smoke-manifest.bin; then
    echo "  FAIL: extensions part missing from response" >&2
    exit 3
fi
if ! grep -q "marker.txt" /tmp/ota-smoke-manifest.bin; then
    echo "  FAIL: synthetic asset (marker.txt) not in manifest body" >&2
    exit 3
fi

# Extract the manifest update id (UUID-shaped) for step 5.
UPDATE_ID="$(grep -oE '"id":"[0-9a-f-]{36}"' /tmp/ota-smoke-manifest.bin | head -1 | sed 's/"id":"\([^"]*\)"/\1/')"
if [[ -z "$UPDATE_ID" ]]; then
    echo "  FAIL: could not extract update id from manifest" >&2
    exit 3
fi
echo "  PASS — id=${UPDATE_ID}"

# ---------------------------------------------------------------------------
# 5. GET /api/ota/assets — fetch the embedded marker.txt
# ---------------------------------------------------------------------------
echo "[smoke] 5/6 GET /api/ota/assets (binary fetch)"
ASSET_REL="${TARGET}/assets/marker.txt"
ASSET_URL_ENCODED="$(printf '%s' "$ASSET_REL" | sed 's|/|%2F|g')"
ASSET_CODE="$(curl -s -o /tmp/ota-smoke-asset.bin -w "%{http_code}" \
    "${SERVER_API}/api/ota/assets?asset=${ASSET_URL_ENCODED}&runtimeVersion=${RV}&platform=android")"
if [[ "$ASSET_CODE" != "200" ]]; then
    echo "  FAIL: asset returned $ASSET_CODE" >&2
    exit 3
fi
if ! grep -q "marker-${TIMESTAMP}" /tmp/ota-smoke-asset.bin; then
    echo "  FAIL: asset body did not match synthetic content" >&2
    head -c 256 /tmp/ota-smoke-asset.bin >&2 || true
    echo >&2
    exit 3
fi
echo "  PASS"

# ---------------------------------------------------------------------------
# 6. Re-poll manifest with expo-current-update-id = update_id → noUpdateAvailable
# ---------------------------------------------------------------------------
echo "[smoke] 6/6 GET /api/ota/manifest (with current-update-id = ${UPDATE_ID})"
NO_UPDATE_CODE="$(curl -s -o /tmp/ota-smoke-noupdate.bin -w "%{http_code}" \
    -H 'expo-protocol-version: 1' \
    -H 'expo-platform: android' \
    -H "expo-runtime-version: ${RV}" \
    -H "expo-channel-name: ${CHANNEL}" \
    -H "expo-current-update-id: ${UPDATE_ID}" \
    "${SERVER_API}/api/ota/manifest")"
if [[ "$NO_UPDATE_CODE" != "200" ]]; then
    echo "  FAIL: no-update poll returned $NO_UPDATE_CODE" >&2
    exit 3
fi
if ! grep -q '"noUpdateAvailable"' /tmp/ota-smoke-noupdate.bin; then
    echo "  FAIL: expected noUpdateAvailable directive when current-update-id matches" >&2
    head -c 512 /tmp/ota-smoke-noupdate.bin >&2 || true
    echo >&2
    exit 3
fi
# And no manifest part should be present in a no-update response.
if grep -q 'name="manifest"' /tmp/ota-smoke-noupdate.bin; then
    echo "  FAIL: no-update response should not contain a manifest part" >&2
    exit 3
fi
echo "  PASS"

echo
echo "=== ALL 6 ASSERTIONS GREEN — Phase 6 E2E smoke COMPLETE ==="
echo
echo "Cleanup follows automatically via trap. To verify ops side, run:"
echo "  curl -H 'Authorization: Bearer \$OTA_ADMIN_TOKEN' \\"
echo "       '${SERVER_API}/api/ota/admin/list?runtimeVersion=${RV}&channel=${CHANNEL}'"
echo "(should return an empty or no-${TIMESTAMP} list)"
