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

echo "==> Backfilling agg_strategy on $ENV ($DB)"
echo "==> Java port: $JAVA_PORT  Python port: $PY_PORT  Factory: $FACTORY"

# Login on the server (avoids local→server SSH SG timeout).
ssh "$SERVER" bash <<EOF
set -euo pipefail

TOKEN=\$(curl -sf -X POST http://localhost:$JAVA_PORT/api/mobile/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"qhj_prod","password":"123456","factoryId":"$FACTORY"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["accessToken"])')

if [ -z "\$TOKEN" ] || [ "\$TOKEN" = "None" ]; then
  echo "ERROR: failed to obtain JWT" >&2
  exit 1
fi

echo "==> Listing upload IDs from $DB ..."
UPLOAD_IDS=\$(psql -U smartbi_user -d $DB -h localhost -tA -c \
  "SELECT DISTINCT upload_id FROM smart_bi_pg_field_definitions ORDER BY upload_id;")

TOTAL=\$(echo "\$UPLOAD_IDS" | wc -l)
echo "==> Found \$TOTAL uploads to reclassify"

OK=0
FAIL=0
CHANGED=0
for UID in \$UPLOAD_IDS; do
  RESP=\$(curl -sf -X POST \
    "http://localhost:$PY_PORT/api/smartbi/analytics/reclassify/\$UID?rematerialize=false" \
    -H "Authorization: Bearer \$TOKEN" 2>&1) || {
      echo "  upload \$UID: FAIL (\$RESP)" >&2
      FAIL=\$((FAIL + 1))
      continue
    }
  CHANGES=\$(echo "\$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("changes_count", 0))' 2>/dev/null || echo "?")
  echo "  upload \$UID: \$CHANGES changes"
  OK=\$((OK + 1))
  if [ "\$CHANGES" != "0" ] && [ "\$CHANGES" != "?" ]; then
    CHANGED=\$((CHANGED + 1))
  fi
done

echo ""
echo "==> Done: \$OK OK / \$FAIL fail / \$CHANGED uploads with changes"

# Sanity check
echo "==> Final agg_strategy distribution:"
psql -U smartbi_user -d $DB -h localhost -c \
  "SELECT agg_strategy, COUNT(*) FROM smart_bi_pg_field_definitions GROUP BY agg_strategy ORDER BY agg_strategy;"
EOF
