#!/usr/bin/env bash
# Mark a previously-pushed OTA bundle as rolled-back.
#
# This touches a `rollback` marker file inside <bundle_dir>/. On the next
# manifest request the server emits a rollBackToEmbedded directive instead
# of the bundle manifest, telling the client to revert to the JS bundle
# baked into the APK at build time.
#
# Usage:
#   export OTA_ADMIN_TOKEN=<hex64>
#   ./scripts/ota/rollback.sh <runtimeVersion> <channel> <timestamp>
#
# Example:
#   ./scripts/ota/rollback.sh 1.0.0 production 1715472000000

set -euo pipefail

RV="${1:?runtimeVersion arg required}"
CHANNEL="${2:?channel arg required}"
TIMESTAMP="${3:?timestamp arg required}"
SERVER_API="${OTA_SERVER_API:-http://47.100.235.168:8083}"
ADMIN_TOKEN="${OTA_ADMIN_TOKEN:?OTA_ADMIN_TOKEN env var required — source ~/.ota-env}"

# Mirror ota.services.storage._VALID_PATH_COMPONENT (defense-in-depth — the
# server validates too, but failing locally is faster than waiting for 422).
SAFE_COMPONENT='^[A-Za-z0-9][A-Za-z0-9._-]*$'

for v in "$RV" "$CHANNEL" "$TIMESTAMP"; do
    if [[ ! "$v" =~ $SAFE_COMPONENT ]]; then
        echo "ERROR: '$v' fails $SAFE_COMPONENT" >&2
        exit 2
    fi
done

HTTP_CODE="$(curl -s -o /tmp/ota-rollback-resp.json -w "%{http_code}" \
    -X POST "$SERVER_API/api/ota/admin/rollback" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"runtimeVersion\":\"$RV\",\"channel\":\"$CHANNEL\",\"timestamp\":\"$TIMESTAMP\"}")"

if [[ "$HTTP_CODE" != "200" ]]; then
    echo "ERROR: /admin/rollback returned $HTTP_CODE" >&2
    cat /tmp/ota-rollback-resp.json >&2 || true
    echo >&2
    exit 4
fi

echo "[rollback] ✓ marker set: rv=$RV channel=$CHANNEL ts=$TIMESTAMP"
echo "[rollback]   next client poll → rollBackToEmbedded directive → device reverts to baked bundle"
