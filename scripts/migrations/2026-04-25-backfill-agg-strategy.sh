#!/usr/bin/env bash
# 2026-04-25-backfill-agg-strategy.sh
#
# Backfill smart_bi_pg_field_definitions.agg_strategy for every existing
# upload by invoking the /reclassify endpoint per upload. Idempotent.
#
# Usage:
#   ./scripts/migrations/2026-04-25-backfill-agg-strategy.sh test
#   ./scripts/migrations/2026-04-25-backfill-agg-strategy.sh prod
#
# Requirements:
#   - Java backend reachable on the env's port (10011 test / 10010 prod)
#   - Python backend reachable (8084 test / 8083 prod)
#   - psql installed locally OR run remotely on server (set RUN_LOCATION)
#   - Test creds: qhj_prod/123456 (works in both envs)

set -euo pipefail

ENV="${1:-test}"
case "$ENV" in
  test)
    JAVA_PORT=10011
    PY_PORT=8084
    DB="smartbi_db"
    FACTORY="F001"
    ;;
  prod)
    JAVA_PORT=10010
    PY_PORT=8083
    DB="smartbi_prod_db"
    FACTORY="RES_3101_009"
    ;;
  *)
    echo "Usage: $0 {test|prod}" >&2
    exit 2
    ;;
esac

SERVER="root@47.100.235.168"
SMARTBI_PG_PASSWORD="${SMARTBI_PG_PASSWORD:-smartbi_secure_password_2025}"

echo "==> Backfilling agg_strategy on $ENV ($DB)"
echo "==> Java port: $JAVA_PORT  Python port: $PY_PORT"
echo "==> Mode: X-Internal-Secret + X-Factory-Id (bypasses JWT + rate limit)"

# Run on the server (uses INTERNAL_API_SECRET from systemd / restart-test.sh).
ssh "$SERVER" bash <<EOF
set -euo pipefail
export PGPASSWORD='$SMARTBI_PG_PASSWORD'

# Discover the internal secret from the live process env.
# PY_PORT already encodes the env (8083 prod / 8084 test), so the same
# pgrep works for both — earlier code had a redundant if/else fork.
PY_PID=\$(pgrep -f "uvicorn main:app --host 0.0.0.0 --port $PY_PORT" | head -1)
if [ -z "\$PY_PID" ]; then
  echo "ERROR: Python ($PY_PORT) process not found" >&2
  exit 1
fi
INTERNAL_SECRET=\$(tr '\0' '\n' < /proc/\$PY_PID/environ | grep '^INTERNAL_API_SECRET=' | cut -d= -f2)
if [ -z "\$INTERNAL_SECRET" ]; then
  echo "ERROR: INTERNAL_API_SECRET not in process env" >&2
  exit 1
fi
echo "==> Using INTERNAL_API_SECRET (PID \$PY_PID, secret length \${#INTERNAL_SECRET})"

# Build factory→[uploads] map
echo "==> Listing uploads grouped by factory..."
FACTORY_LIST=\$(psql -U smartbi_user -d $DB -h localhost -tA -c \
  "SELECT DISTINCT u.factory_id FROM smart_bi_pg_excel_uploads u WHERE u.id IN (SELECT DISTINCT upload_id FROM smart_bi_pg_field_definitions) ORDER BY u.factory_id;")

TOTAL_OK=0
TOTAL_FAIL=0
TOTAL_CHANGED=0

for FACTORY_ID in \$FACTORY_LIST; do
  echo ""
  echo "=== Factory: \$FACTORY_ID ==="

  UPLOAD_IDS=\$(psql -U smartbi_user -d $DB -h localhost -tA -c \
    "SELECT DISTINCT u.id FROM smart_bi_pg_excel_uploads u WHERE u.factory_id='\$FACTORY_ID' AND u.id IN (SELECT DISTINCT upload_id FROM smart_bi_pg_field_definitions) ORDER BY u.id;")

  COUNT=\$(echo "\$UPLOAD_IDS" | wc -l)
  echo "  \$COUNT uploads to reclassify"

  OK=0
  FAIL=0
  CHANGED=0
  for UPLOAD_ID in \$UPLOAD_IDS; do
    RESP=\$(curl -sf -X POST \
      "http://localhost:$PY_PORT/api/smartbi/analytics/reclassify/\$UPLOAD_ID?rematerialize=false" \
      -H "X-Internal-Secret: \$INTERNAL_SECRET" \
      -H "X-Factory-Id: \$FACTORY_ID" 2>&1) || {
        echo "    upload \$UPLOAD_ID: FAIL" >&2
        FAIL=\$((FAIL + 1))
        continue
      }
    CHANGES=\$(echo "\$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("changes_count", 0))' 2>/dev/null || echo "?")
    OK=\$((OK + 1))
    if [ "\$CHANGES" != "0" ] && [ "\$CHANGES" != "?" ]; then
      CHANGED=\$((CHANGED + 1))
    fi
  done

  echo "  Subtotal: \$OK OK / \$FAIL fail / \$CHANGED with changes"
  TOTAL_OK=\$((TOTAL_OK + OK))
  TOTAL_FAIL=\$((TOTAL_FAIL + FAIL))
  TOTAL_CHANGED=\$((TOTAL_CHANGED + CHANGED))
done

echo ""
echo "==> Grand total: \$TOTAL_OK OK / \$TOTAL_FAIL fail / \$TOTAL_CHANGED uploads with changes"

# Sanity check
echo ""
echo "==> Final agg_strategy distribution:"
psql -U smartbi_user -d $DB -h localhost -c \
  "SELECT agg_strategy, COUNT(*) FROM smart_bi_pg_field_definitions GROUP BY agg_strategy ORDER BY agg_strategy;"
EOF
