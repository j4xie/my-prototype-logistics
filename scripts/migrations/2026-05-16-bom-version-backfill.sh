#!/usr/bin/env bash
# 2026-05-16-bom-version-backfill.sh — Sprint 3 Track-H M-BOM-VER-1
#
# Wrapper for BomVersion + ECN DRAFT backfill. Safe-by-default:
#   1. Refuses to apply without --backup flag (forces explicit ack)
#   2. Refuses to skip dry-run unless --skip-dry-run flag passed
#   3. Idempotent SQL (NOT EXISTS guards) — re-runs are no-ops
#
# Usage:
#   ./scripts/migrations/2026-05-16-bom-version-backfill.sh dry-run   # SELECT only
#   ./scripts/migrations/2026-05-16-bom-version-backfill.sh apply --backup
#   ./scripts/migrations/2026-05-16-bom-version-backfill.sh verify
#
# Environment:
#   CRETAS_DB_HOST       (default: localhost)
#   CRETAS_DB_PORT       (default: 5432)
#   CRETAS_DB_NAME       (default: cretas_db)
#   CRETAS_DB_USER       (default: postgres)
#   PGPASSWORD           (read by psql; set externally)
#
# Companion files (same dir):
#   2026-05-16-bom-version-backfill.sql         — main backfill, idempotent
#   2026-05-16-bom-version-backfill-dry-run.sql — read-only preview

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SQL_APPLY="${SCRIPT_DIR}/2026-05-16-bom-version-backfill.sql"
SQL_DRY_RUN="${SCRIPT_DIR}/2026-05-16-bom-version-backfill-dry-run.sql"

DB_HOST="${CRETAS_DB_HOST:-localhost}"
DB_PORT="${CRETAS_DB_PORT:-5432}"
DB_NAME="${CRETAS_DB_NAME:-cretas_db}"
DB_USER="${CRETAS_DB_USER:-postgres}"

CMD="${1:-help}"
shift || true

run_psql() {
    psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -U "$DB_USER" -v ON_ERROR_STOP=1 "$@"
}

dry_run() {
    echo "==> M-BOM-VER-1 dry-run preview ($DB_HOST:$DB_PORT/$DB_NAME)"
    [ -f "$SQL_DRY_RUN" ] || { echo "ERROR: $SQL_DRY_RUN missing" >&2; exit 2; }
    run_psql -f "$SQL_DRY_RUN"
}

apply_backfill() {
    local has_backup_flag=0
    local has_skip_dry_run_flag=0
    for arg in "$@"; do
        case "$arg" in
            --backup)         has_backup_flag=1 ;;
            --skip-dry-run)   has_skip_dry_run_flag=1 ;;
            *) echo "WARN: unknown apply arg '$arg'" >&2 ;;
        esac
    done

    if [ "$has_backup_flag" -ne 1 ]; then
        cat >&2 <<EOF
ERROR: refusing to apply without --backup flag.
Before applying, you MUST take a full backup:
   pg_dump -h $DB_HOST -p $DB_PORT -d $DB_NAME -F c -f \\
       backups/cretas_db-pre-bom-version-backfill-\$(date +%Y%m%d-%H%M).dump

Then re-run:
   ./2026-05-16-bom-version-backfill.sh apply --backup
EOF
        exit 2
    fi

    if [ "$has_skip_dry_run_flag" -ne 1 ]; then
        echo "==> Running dry-run preview first (use --skip-dry-run to bypass)"
        dry_run
        echo
        read -rp "Proceed with apply? (yes/no) " ans
        if [ "$ans" != "yes" ]; then
            echo "Aborted."
            exit 0
        fi
    fi

    echo "==> Applying M-BOM-VER-1 backfill on $DB_HOST:$DB_PORT/$DB_NAME"
    [ -f "$SQL_APPLY" ] || { echo "ERROR: $SQL_APPLY missing" >&2; exit 2; }
    run_psql -f "$SQL_APPLY"
    echo "==> Apply complete. Run './2026-05-16-bom-version-backfill.sh verify' to check."
}

verify_backfill() {
    echo "==> M-BOM-VER-1 post-apply verification ($DB_HOST:$DB_PORT/$DB_NAME)"
    run_psql <<'SQL'
SELECT
    (SELECT COUNT(*) FROM bom_recipes  WHERE deleted_at IS NULL) AS recipes_alive,
    (SELECT COUNT(*) FROM bom_versions WHERE deleted_at IS NULL) AS versions_alive,
    (SELECT COUNT(*) FROM bom_versions
        WHERE deleted_at IS NULL AND status = 'APPROVED' AND effective_to IS NULL)
                                                                 AS approved_current,
    (SELECT COUNT(*) FROM bom_versions WHERE status = 'OBSOLETE') AS obsoleted,
    (SELECT COUNT(*) FROM engineering_change_notices
        WHERE reason_detail LIKE 'Backfilled from BomChangeLog%' AND deleted_at IS NULL)
                                                                 AS draft_ecns_backfilled;

-- Every is_current=true BomRecipe MUST have exactly 1 APPROVED+current BomVersion.
SELECT 'BOMS WITHOUT EXACTLY 1 APPROVED CURRENT VERSION:' AS issue;
SELECT r.id, r.recipe_code, COUNT(v.id) AS approved_current
FROM bom_recipes r
LEFT JOIN bom_versions v ON v.bom_recipe_id = r.id
                          AND v.status = 'APPROVED'
                          AND v.effective_to IS NULL
                          AND v.deleted_at IS NULL
WHERE r.deleted_at IS NULL AND r.is_current = TRUE
GROUP BY r.id, r.recipe_code
HAVING COUNT(v.id) <> 1
LIMIT 20;
SQL
    echo "==> Verification complete. Expect:"
    echo "    - versions_alive >= recipes_alive"
    echo "    - approved_current == (recipes_alive WHERE is_current=true)"
    echo "    - empty result for 'BOMS WITHOUT EXACTLY 1 APPROVED CURRENT VERSION'"
}

show_help() {
    cat <<EOF
Usage: $0 {dry-run|apply|verify|help} [flags]

Commands:
  dry-run   — read-only preview of insert candidates (no writes)
  apply     — actually backfill. Requires --backup flag. Prompts for confirm
              unless --skip-dry-run is also passed.
  verify    — post-apply count + invariant check

Env vars (override defaults):
  CRETAS_DB_HOST=$DB_HOST
  CRETAS_DB_PORT=$DB_PORT
  CRETAS_DB_NAME=$DB_NAME
  CRETAS_DB_USER=$DB_USER
  PGPASSWORD (set externally)

Examples:
  ./2026-05-16-bom-version-backfill.sh dry-run
  ./2026-05-16-bom-version-backfill.sh apply --backup
  ./2026-05-16-bom-version-backfill.sh verify
EOF
}

case "$CMD" in
    dry-run)  dry_run ;;
    apply)    apply_backfill "$@" ;;
    verify)   verify_backfill ;;
    help|--help|-h|*) show_help ;;
esac
