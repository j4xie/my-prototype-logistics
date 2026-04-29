#!/usr/bin/env bash
# 2026-04-25-backfill-enrichment-cache.sh
#
# Backfill smart_bi_pg_analysis_results.enrichment_cache (KPI-only,
# _partial:true) for every existing upload by invoking the new
# /precompute-cache endpoint. Idempotent.
#
# Why: Apr 25 2026 Option F deleted all 235 enrichment_cache rows from
# prod. After Task C ships the γ-2c afterCommit hook, NEW uploads will
# auto-populate the cache, but existing uploads (252 prod / 145 test)
# will keep first-visit-timeouts on 200K-row POS files. This script
# fills them in one shot.
#
# Usage:
#   ./scripts/migrations/2026-04-25-backfill-enrichment-cache.sh test
#   ./scripts/migrations/2026-04-25-backfill-enrichment-cache.sh prod
#
# Requirements:
#   - Python backend reachable (8084 test / 8083 prod)
#   - psql installed locally OR run remotely on server
#   - INTERNAL_API_SECRET available in the live python process env
#     (read from /proc/<pid>/environ — same pattern as agg-strategy backfill)

set -euo pipefail

ENV="${1:-test}"
case "$ENV" in
  test)
    PY_PORT=8084
    DB="smartbi_db"
    ;;
  prod)
    PY_PORT=8083
    DB="smartbi_prod_db"
    ;;
  *)
    echo "Usage: $0 {test|prod}" >&2
    exit 2
    ;;
esac

SERVER="root@47.100.235.168"
SMARTBI_PG_PASSWORD="${SMARTBI_PG_PASSWORD:-smartbi_secure_password_2025}"

echo "==> Backfilling enrichment_cache (_partial:true, KPI-only) on $ENV ($DB)"
echo "==> Python port: $PY_PORT"
echo "==> Mode: X-Internal-Secret + X-Factory-Id (bypasses JWT + rate limit)"
echo "==> Endpoint: POST /api/smartbi/analytics/precompute-cache/{upload_id}"

# Run on the server (uses INTERNAL_API_SECRET from live process env).
ssh "$SERVER" bash <<EOF
set -euo pipefail
export PGPASSWORD='$SMARTBI_PG_PASSWORD'

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

# Pre-flight: how many uploads exist + how many already have a cache?
echo ""
echo "==> Pre-flight counts:"
psql -U smartbi_user -d $DB -h localhost -c \
  "SELECT COUNT(*) as total_completed_uploads FROM smart_bi_pg_excel_uploads WHERE upload_status='COMPLETED';"
psql -U smartbi_user -d $DB -h localhost -c \
  "SELECT COUNT(*) as existing_enrichment_cache FROM smart_bi_pg_analysis_results WHERE analysis_type='enrichment_cache';"

# Build factory→[uploads] map. Only COMPLETED uploads with field_definitions
# (otherwise quick_summary will return 暂无数据 and we'd skip anyway).
echo ""
echo "==> Listing uploads grouped by factory (COMPLETED + has field_definitions)..."
FACTORY_LIST=\$(psql -U smartbi_user -d $DB -h localhost -tA -c \
  "SELECT DISTINCT u.factory_id FROM smart_bi_pg_excel_uploads u
   WHERE u.upload_status='COMPLETED'
     AND u.id IN (SELECT DISTINCT upload_id FROM smart_bi_pg_field_definitions)
   ORDER BY u.factory_id;")

TOTAL_OK=0
TOTAL_FAIL=0
TOTAL_SKIP=0

for FACTORY_ID in \$FACTORY_LIST; do
  echo ""
  echo "=== Factory: \$FACTORY_ID ==="

  UPLOAD_IDS=\$(psql -U smartbi_user -d $DB -h localhost -tA -c \
    "SELECT DISTINCT u.id FROM smart_bi_pg_excel_uploads u
     WHERE u.factory_id='\$FACTORY_ID' AND u.upload_status='COMPLETED'
       AND u.id IN (SELECT DISTINCT upload_id FROM smart_bi_pg_field_definitions)
     ORDER BY u.id;")

  COUNT=\$(echo "\$UPLOAD_IDS" | grep -c . || echo 0)
  echo "  \$COUNT uploads to precompute"

  OK=0
  FAIL=0
  SKIP=0
  for UPLOAD_ID in \$UPLOAD_IDS; do
    HTTP_CODE=\$(curl -s -o /tmp/precompute_resp.json -w "%{http_code}" \
      -X POST \
      "http://localhost:$PY_PORT/api/smartbi/analytics/precompute-cache/\$UPLOAD_ID" \
      -H "X-Internal-Secret: \$INTERNAL_SECRET" \
      -H "X-Factory-Id: \$FACTORY_ID" \
      -H "Content-Type: application/json" 2>&1)
    if [ "\$HTTP_CODE" != "200" ]; then
      echo "    upload \$UPLOAD_ID: HTTP \$HTTP_CODE" >&2
      FAIL=\$((FAIL + 1))
      continue
    fi
    SUCCESS=\$(python3 -c 'import sys,json; d=json.load(open("/tmp/precompute_resp.json")); print(d.get("success", False))' 2>/dev/null || echo False)
    if [ "\$SUCCESS" = "True" ]; then
      OK=\$((OK + 1))
    else
      MSG=\$(python3 -c 'import sys,json; d=json.load(open("/tmp/precompute_resp.json")); print(d.get("message", "?"))' 2>/dev/null || echo "?")
      echo "    upload \$UPLOAD_ID: skip (\$MSG)"
      SKIP=\$((SKIP + 1))
    fi
  done

  echo "  Subtotal: \$OK ok / \$FAIL fail / \$SKIP skip"
  TOTAL_OK=\$((TOTAL_OK + OK))
  TOTAL_FAIL=\$((TOTAL_FAIL + FAIL))
  TOTAL_SKIP=\$((TOTAL_SKIP + SKIP))
done

echo ""
echo "==> Grand total: \$TOTAL_OK ok / \$TOTAL_FAIL fail / \$TOTAL_SKIP skip"

# Sanity check
echo ""
echo "==> Final enrichment_cache row count:"
psql -U smartbi_user -d $DB -h localhost -c \
  "SELECT COUNT(*) as total_caches,
          COUNT(*) FILTER (WHERE (analysis_result->>'_partial')::boolean = true) as partial_caches,
          COUNT(*) FILTER (WHERE (analysis_result->>'_partial')::boolean = false OR analysis_result->'_partial' IS NULL) as full_caches
   FROM smart_bi_pg_analysis_results
   WHERE analysis_type='enrichment_cache';"
EOF
