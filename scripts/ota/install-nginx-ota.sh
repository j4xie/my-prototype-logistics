#!/usr/bin/env bash
# Phase 4: insert the /api/ota/ location block into the api.cretaceousfuture.com
# nginx config on gateway server 139 and reload nginx. Idempotent.
#
# Pipeline (5 steps):
#   1. SSH 139, verify config file exists + OTA block not already present
#   2. Timestamp-backup the current config
#   3. Insert the OTA snippet immediately ABOVE the `location /` catch-all
#   4. `nginx -t` — if fail, restore backup, exit 1
#   5. `nginx -s reload`, then external curl health check via api.cretaceousfuture.com
#
# Usage (run from repo root, after PR #375 merged and Python redeployed):
#   ./scripts/ota/install-nginx-ota.sh
#
# Env overrides:
#   OTA_NGINX_SERVER       (default: root@139.196.165.140)
#   OTA_NGINX_CONF_PATH    (default: /www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf)
#   OTA_PUBLIC_HOST        (default: api.cretaceousfuture.com — used for the post-reload health check)

set -euo pipefail

SERVER="${OTA_NGINX_SERVER:-root@139.196.165.140}"
CONF_PATH="${OTA_NGINX_CONF_PATH:-/www/server/panel/vhost/nginx/api.cretaceousfuture.com.conf}"
PUBLIC_HOST="${OTA_PUBLIC_HOST:-api.cretaceousfuture.com}"

# Path to the committed snippet (repo source of truth — uploaded via scp).
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SNIPPET_PATH="$REPO_ROOT/nginx/api.cretaceousfuture.com.ota.snippet.conf"

if [[ ! -f "$SNIPPET_PATH" ]]; then
    echo "ERROR: snippet not found at $SNIPPET_PATH" >&2
    exit 2
fi

echo "[install-nginx-ota] 1/5 verifying server config..."
ssh "$SERVER" "test -f '$CONF_PATH'" || {
    echo "ERROR: $CONF_PATH missing on $SERVER" >&2
    exit 2
}

if ssh "$SERVER" "grep -q 'location /api/ota/' '$CONF_PATH'"; then
    echo "[install-nginx-ota] OTA location block already present in $CONF_PATH — nothing to do"
    exit 0
fi

echo "[install-nginx-ota] 2/5 uploading snippet to /tmp on $SERVER..."
scp -q "$SNIPPET_PATH" "$SERVER:/tmp/ota-nginx-snippet.conf"

TS="$(date +%Y%m%d_%H%M%S)"
echo "[install-nginx-ota] 3/5 backing up + inserting block (backup tag .bak.phase4_${TS})..."
# shellcheck disable=SC2087 -- heredoc intentionally expands $CONF_PATH + $TS
ssh "$SERVER" bash -s <<REMOTE_EOF
set -euo pipefail
CONF='$CONF_PATH'
BACKUP="\$CONF.bak.phase4_${TS}"
cp "\$CONF" "\$BACKUP"
echo "[remote] backup: \$BACKUP"

# Insert the snippet immediately before the first '    location / {' line
# (the catch-all to cretas_backend). Using awk for multi-line aware insertion
# rather than sed (sed -i is gnarly with multi-line patterns).
SNIPPET=/tmp/ota-nginx-snippet.conf
awk -v snippet="\$SNIPPET" '
    /^[[:space:]]+location \/ {/ && !inserted {
        while ((getline line < snippet) > 0) print "    " line
        close(snippet)
        print ""
        inserted = 1
    }
    { print }
' "\$CONF" > "\$CONF.new"

# Sanity: confirm the new file is strictly larger than backup AND contains our block
NEW_SIZE=\$(stat -c %s "\$CONF.new")
OLD_SIZE=\$(stat -c %s "\$BACKUP")
if [[ \$NEW_SIZE -le \$OLD_SIZE ]]; then
    echo "[remote] ERROR: new config not larger than backup — awk probably did not insert"
    rm "\$CONF.new"
    exit 1
fi
if ! grep -q 'location /api/ota/' "\$CONF.new"; then
    echo "[remote] ERROR: new config missing OTA block — awk failed"
    rm "\$CONF.new"
    exit 1
fi
mv "\$CONF.new" "\$CONF"
echo "[remote] inserted OTA block; old=\$OLD_SIZE new=\$NEW_SIZE bytes"
REMOTE_EOF

echo "[install-nginx-ota] 4/5 nginx -t..."
if ! ssh "$SERVER" "nginx -t" 2>&1; then
    echo "ERROR: nginx -t failed — restoring backup" >&2
    ssh "$SERVER" "cp '$CONF_PATH.bak.phase4_${TS}' '$CONF_PATH'"
    exit 1
fi

echo "[install-nginx-ota] 5/5 nginx -s reload..."
ssh "$SERVER" "nginx -s reload"
ssh "$SERVER" "rm -f /tmp/ota-nginx-snippet.conf"

echo
echo "[install-nginx-ota] ✓ live — testing external health probe..."
sleep 2  # let nginx settle on the reload
HTTP_CODE="$(curl -s -o /tmp/ota-health-probe.json -w "%{http_code}" \
    "https://${PUBLIC_HOST}/api/ota/health" || echo "curl-failed")"
if [[ "$HTTP_CODE" == "200" ]]; then
    echo "[install-nginx-ota] ✓ https://${PUBLIC_HOST}/api/ota/health returned 200:"
    cat /tmp/ota-health-probe.json
    echo
else
    echo "WARN: external health probe got HTTP $HTTP_CODE (expected 200)" >&2
    echo "WARN: this can be a transient warm-up or a JWT middleware exemption miss" >&2
    echo "WARN: response body:" >&2
    cat /tmp/ota-health-probe.json >&2 || true
    echo >&2
    echo "WARN: not auto-reverting — nginx -t passed. Manually verify and rollback if needed:" >&2
    echo "      ssh $SERVER \"cp '$CONF_PATH.bak.phase4_${TS}' '$CONF_PATH' && nginx -s reload\"" >&2
fi
rm -f /tmp/ota-health-probe.json
