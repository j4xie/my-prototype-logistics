#!/usr/bin/env bash
# record-analysis-sales-goldens.sh — records F999 + F001 goldens for /analysis/sales endpoint
#
# Wraps record-java-golden.mjs (same pattern as record-alerts-goldens.sh).
# Records 3 golden variants:
#   - analysis-sales-F999.json                        (no dimension)
#   - analysis-sales-dimension-salesperson-F999.json  (dimension=salesperson)
#   - analysis-sales-F001.json                        (no dimension, calibration factory)
#
# Triggers for re-recording:
#   - Java DashboardResponse adds/removes fields
#   - Java TreeMap/HashMap sort fix changes ranking output order
#   - F001 calibration data seeded (rankings + trend specs Q8=yes)
#
# Pre-requisites:
#   - SSH tunnel to test env: ssh -N -L 10011:localhost:10011 root@47.100.235.168 &
#   - PHASE2A_TEST_USER_PASSWORD env var set (plaintext from /www/wwwroot/cretas/.env.test)
#   - F999 migration deployed (V20260430_01__phase2a_test_factory_F999.sql)
#
# Usage:
#   PHASE2A_TEST_USER_PASSWORD=<pw> ./scripts/phase2a/record-analysis-sales-goldens.sh
#   BASE_URL=http://localhost:10011 PHASE2A_TEST_USER_PASSWORD=<pw> ./scripts/phase2a/record-analysis-sales-goldens.sh
#
set -euo pipefail

: "${PHASE2A_TEST_USER_PASSWORD:?must set PHASE2A_TEST_USER_PASSWORD env var (plaintext from .env.test)}"

SCRIPT_DIR="$(dirname "$0")"
BASE="${BASE_URL:-http://localhost:10011}"
ENDPOINTS="analysis-sales,analysis-sales-dimension-salesperson"

echo "=== Recording analysis-sales goldens ==="
echo "Base URL : ${BASE}"
echo ""

echo "--- F999 (both dimension variants) ---"
node "${SCRIPT_DIR}/record-java-golden.mjs" \
  --base "${BASE}" \
  --user phase2a_test_user \
  --password "${PHASE2A_TEST_USER_PASSWORD}" \
  --factory F999 \
  --endpoints "${ENDPOINTS}"

echo ""
echo "--- F001 (no dimension) ---"
node "${SCRIPT_DIR}/record-java-golden.mjs" \
  --base "${BASE}" \
  --user phase2a_test_user \
  --password "${PHASE2A_TEST_USER_PASSWORD}" \
  --factory F001 \
  --endpoints "analysis-sales"

echo ""
echo "Done. 3 goldens written under tests/fixtures/java-smartbi-golden/"
