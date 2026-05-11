#!/usr/bin/env bash
# Patch /etc/systemd/system/cretas-python.service on server 47 to load
# /www/wwwroot/cretas/.env.ota in addition to .env.prod.
#
# Per docs/superpowers/specs/2026-05-11-self-hosted-ota-spec.md §5 Q3 resolution:
# the OTA admin token + key paths live in a SEPARATE .env.ota file so they can
# rotate independently from the rest of the prod env.
#
# Idempotent — re-running is safe; greps the unit file first.
#
# Usage:
#   ./scripts/ota/install-systemd-env-ota.sh
#
# Steve runs this after the OTA PR merges to apply the systemd change on server 47.

set -euo pipefail

SERVER="${OTA_SERVER:-root@47.100.235.168}"

ssh "$SERVER" 'bash -s' <<'REMOTE_EOF'
set -euo pipefail

SVC=/etc/systemd/system/cretas-python.service
ENV_OTA=/www/wwwroot/cretas/.env.ota

if [ ! -f "$SVC" ]; then
  echo "ERROR: $SVC not found on this server" >&2
  exit 1
fi

if [ ! -f "$ENV_OTA" ]; then
  echo "ERROR: $ENV_OTA missing — run Q1+Q2 openssl setup first" >&2
  exit 1
fi

if grep -qE "^EnvironmentFile=$ENV_OTA\$" "$SVC"; then
  echo "[install-systemd-env-ota] EnvironmentFile=$ENV_OTA already present in $SVC"
else
  # Insert the new EnvironmentFile line directly after the existing .env.prod line.
  sed -i '\|^EnvironmentFile=/www/wwwroot/cretas/\.env\.prod$|a EnvironmentFile=/www/wwwroot/cretas/.env.ota' "$SVC"
  echo "[install-systemd-env-ota] Patched $SVC"
  grep '^EnvironmentFile=' "$SVC"
fi

systemctl daemon-reload
systemctl restart cretas-python
echo
echo "[install-systemd-env-ota] cretas-python restarted; status follows:"
systemctl status cretas-python --no-pager | head -8

echo
echo "[install-systemd-env-ota] Health check:"
sleep 2
curl -sf http://localhost:8083/api/ota/health || echo "(OTA router not yet registered in main.py — expected until micro-PR ships)"
REMOTE_EOF
