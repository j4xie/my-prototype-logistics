#!/usr/bin/env bash
# record-alerts-goldens.sh — convenience wrapper for record-java-golden.mjs
#
# Records F999 alert endpoint Java responses for byte-shape goldens. Reusable for
# any future Phase 2A endpoint that uses F999 — just override ENDPOINTS env var.
#
# Pre-requisites:
#   - SSH tunnel to test env: ssh -N -L 10011:localhost:10011 root@47.100.235.168 &
#   - PHASE2A_TEST_USER_PASSWORD env var set (plaintext from /www/wwwroot/cretas/.env.test)
#   - F999 migration deployed (V20260430_01__phase2a_test_factory_F999.sql)
#
# Usage:
#   PHASE2A_TEST_USER_PASSWORD=<pw> ./scripts/phase2a/record-alerts-goldens.sh
#   ENDPOINTS=alerts ./scripts/phase2a/record-alerts-goldens.sh
#
set -euo pipefail

: "${PHASE2A_TEST_USER_PASSWORD:?must set PHASE2A_TEST_USER_PASSWORD env var (plaintext from .env.test)}"

exec node "$(dirname "$0")/record-java-golden.mjs" \
  --base "${BASE_URL:-http://localhost:10011}" \
  --user phase2a_test_user \
  --password "${PHASE2A_TEST_USER_PASSWORD}" \
  --factory F999 \
  --endpoints "${ENDPOINTS:-alerts,alerts-category-sales}"
