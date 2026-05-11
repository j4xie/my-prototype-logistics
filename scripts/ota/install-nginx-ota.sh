#!/usr/bin/env bash
# Phase 4: install the ota.cretaceousfuture.com nginx vhost on gateway 139
# and reload nginx. Idempotent.
#
# Why a separate subdomain (not piggy-back on api.cretaceousfuture.com):
# see header comment in nginx/ota.cretaceousfuture.com.conf — failure-domain
# isolation + APK-baked URL is forever + Expo-style semantic.
#
# Pipeline (5 steps):
#   1. SSH 139, verify cert files exist (added by acme.sh DNS-01 on cutover)
#   2. scp the committed vhost conf to /www/server/panel/vhost/nginx/
#   3. nginx -t — if fail, rm the new conf, exit 1 (no reload)
#   4. nginx -s reload
#   5. External HTTPS health probe via https://ota.cretaceousfuture.com/api/ota/health
#
# Usage (run from repo root, after PR #375 merged and Python redeployed):
#   ./scripts/ota/install-nginx-ota.sh
#
# Env overrides:
#   OTA_NGINX_SERVER       (default: root@139.196.165.140)
#   OTA_VHOST_DIR          (default: /www/server/panel/vhost/nginx)
#   OTA_PUBLIC_HOST        (default: ota.cretaceousfuture.com — used for health probe)

set -euo pipefail

SERVER="${OTA_NGINX_SERVER:-root@139.196.165.140}"
VHOST_DIR="${OTA_VHOST_DIR:-/www/server/panel/vhost/nginx}"
PUBLIC_HOST="${OTA_PUBLIC_HOST:-ota.cretaceousfuture.com}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VHOST_SRC="$REPO_ROOT/nginx/ota.cretaceousfuture.com.conf"
VHOST_DEST="${VHOST_DIR}/ota.cretaceousfuture.com.conf"
CERT_DIR="${VHOST_DIR%/nginx}/cert"

if [[ ! -f "$VHOST_SRC" ]]; then
    echo "ERROR: vhost source not found at $VHOST_SRC" >&2
    exit 2
fi

echo "[install-nginx-ota] 1/5 verifying cert files on $SERVER..."
ssh "$SERVER" "test -f '${CERT_DIR}/ota.cretaceousfuture.com.pem' && test -f '${CERT_DIR}/ota.cretaceousfuture.com.key'" || {
    echo "ERROR: cert files missing under $CERT_DIR" >&2
    echo "       Acquire first via acme.sh:" >&2
    echo "       ssh $SERVER 'export Ali_Key=...; export Ali_Secret=...; \\" >&2
    echo "                    ~/.acme.sh/acme.sh --issue --dns dns_ali -d $PUBLIC_HOST'" >&2
    exit 2
}

if ssh "$SERVER" "test -f '$VHOST_DEST'"; then
    echo "[install-nginx-ota] vhost already installed at $VHOST_DEST — refreshing"
    TS="$(date +%Y%m%d_%H%M%S)"
    ssh "$SERVER" "cp '$VHOST_DEST' '${VHOST_DEST}.bak.phase4_${TS}'"
    echo "  backup: ${VHOST_DEST}.bak.phase4_${TS}"
fi

echo "[install-nginx-ota] 2/5 uploading vhost conf to $VHOST_DEST"
scp -q "$VHOST_SRC" "$SERVER:$VHOST_DEST"

echo "[install-nginx-ota] 3/5 nginx -t..."
if ! ssh "$SERVER" "nginx -t" 2>&1; then
    echo "ERROR: nginx -t failed — removing the bad vhost so reload won't break the server" >&2
    ssh "$SERVER" "rm '$VHOST_DEST'"
    exit 1
fi

echo "[install-nginx-ota] 4/5 nginx -s reload..."
ssh "$SERVER" "nginx -s reload"

echo
echo "[install-nginx-ota] 5/5 external HTTPS health probe..."
sleep 2  # let nginx settle on the reload
HTTP_CODE="$(curl -s -o /tmp/ota-health-probe.json -w "%{http_code}" \
    "https://${PUBLIC_HOST}/api/ota/health" || echo "curl-failed")"
if [[ "$HTTP_CODE" == "200" ]]; then
    echo "[install-nginx-ota] ✓ https://${PUBLIC_HOST}/api/ota/health returned 200:"
    cat /tmp/ota-health-probe.json
    echo
else
    echo "WARN: external health probe got HTTP $HTTP_CODE (expected 200)" >&2
    echo "WARN: response body:" >&2
    cat /tmp/ota-health-probe.json >&2 || true
    echo >&2
    echo "WARN: not auto-reverting — nginx -t passed. Manually verify and rollback if needed:" >&2
    echo "      ssh $SERVER \"rm '$VHOST_DEST' && nginx -s reload\"" >&2
fi
rm -f /tmp/ota-health-probe.json
