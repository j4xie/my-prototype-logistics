#!/usr/bin/env bash
# Cleanup failed V20260513_02 row from flyway_schema_history on cretas_prod_db.
#
# Context: Java prod deploy #4 (2026-05-13) failed because
# V20260513_02__revenue_report_intent.sql omitted created_at/updated_at columns
# (ai_intent_configs requires both NOT NULL no DEFAULT). Flyway logged a
# success=false row, which blocks re-applying the corrected migration.
#
# This script removes that single failed row. Idempotent: re-runs are no-ops.
#
# Usage (ON the 47 prod server):
#   bash /www/wwwroot/cretas/code/scripts/migrations/cleanup-failed-v20260513-02.sh
#
# Or from organizer machine via SSH:
#   ssh root@47.100.235.168 'bash -s' < scripts/migrations/cleanup-failed-v20260513-02.sh
#
# Exit codes:
#   0 — success (row deleted OR was never present)
#   1 — DB error / .env.prod missing / psql not on PATH
#   2 — abort (failed row state unexpected; manual review needed)

set -euo pipefail

ENV_FILE=/www/wwwroot/cretas/.env.prod
DB_HOST=localhost
DB_NAME=cretas_prod_db
DB_USER=cretas
FAILED_VERSION='20260513.02'

if [ ! -f "$ENV_FILE" ]; then
    echo "[cleanup] $ENV_FILE not found — wrong host? aborting." >&2
    exit 1
fi

DB_PASSWORD=$(grep '^DB_PASSWORD=' "$ENV_FILE" | head -n1 | cut -d= -f2-)
if [ -z "$DB_PASSWORD" ]; then
    echo "[cleanup] DB_PASSWORD not set in $ENV_FILE — aborting." >&2
    exit 1
fi
export PGPASSWORD="$DB_PASSWORD"

PSQL=(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q -t -A)

echo "[cleanup] env_file=$ENV_FILE db=$DB_NAME user=$DB_USER version=$FAILED_VERSION"

echo "[cleanup] BEFORE — rows matching version=$FAILED_VERSION:"
"${PSQL[@]}" -c "
    SELECT installed_rank, version, description, success, installed_on
    FROM flyway_schema_history
    WHERE version = '$FAILED_VERSION'
    ORDER BY installed_rank;
"

FAILED_COUNT=$("${PSQL[@]}" -c "
    SELECT COUNT(*)
    FROM flyway_schema_history
    WHERE version = '$FAILED_VERSION' AND success = false;
")
SUCCESS_COUNT=$("${PSQL[@]}" -c "
    SELECT COUNT(*)
    FROM flyway_schema_history
    WHERE version = '$FAILED_VERSION' AND success = true;
")

echo "[cleanup] found failed=$FAILED_COUNT success=$SUCCESS_COUNT"

if [ "$SUCCESS_COUNT" -gt 0 ]; then
    echo "[cleanup] ABORT — found success=true row at version=$FAILED_VERSION. Cleanup not safe." >&2
    echo "[cleanup]        Manual review required: this migration may have partially succeeded." >&2
    exit 2
fi

if [ "$FAILED_COUNT" = "0" ]; then
    echo "[cleanup] no-op — no failed row at version=$FAILED_VERSION (already cleaned or never failed)"
    exit 0
fi

echo "[cleanup] deleting failed row(s) inside transaction..."
"${PSQL[@]}" -c "
    BEGIN;
    DELETE FROM flyway_schema_history
    WHERE version = '$FAILED_VERSION' AND success = false;
    COMMIT;
"

echo "[cleanup] AFTER — rows matching version=$FAILED_VERSION (expect empty):"
"${PSQL[@]}" -c "
    SELECT installed_rank, version, description, success, installed_on
    FROM flyway_schema_history
    WHERE version = '$FAILED_VERSION'
    ORDER BY installed_rank;
"

echo "[cleanup] surrounding 20260513.* rows (sanity check):"
"${PSQL[@]}" -c "
    SELECT installed_rank, version, description, success, installed_on
    FROM flyway_schema_history
    WHERE version LIKE '20260513.%'
    ORDER BY installed_rank;
"

echo "[cleanup] done — next Java deploy can re-apply fixed V20260513_02."
