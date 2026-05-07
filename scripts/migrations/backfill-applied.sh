#!/usr/bin/env bash
# Backfill smartbi_migrations tracker with already-applied V*.sql files.
#
# Spec: docs/superpowers/specs/2026-05-07-smartbi-migration-runner-spec.md §3.5
# One-time: run once per env after V20260507_01__smartbi_migrations_tracker.sql
#           is applied. Marks every existing V*.sql as already-applied so the
#           runner doesn't try to re-execute them.
#
# Usage:   backfill-applied.sh <test|prod>
# Exit:    0 success, 1 db error, 2 usage error
#
# PK is filename (not version) — see review 2026-05-07: historic dupe
# V20260427_01 across two unrelated files. ON CONFLICT (filename) DO NOTHING
# treats both as distinct rows.

set -euo pipefail

ENV="${1:-}"
case "$ENV" in
  test) DB=smartbi_db ;;
  prod) DB=smartbi_prod_db ;;
  *) echo "Usage: $0 <test|prod>" >&2; exit 2 ;;
esac

# Resolve migrations dir relative to this script (works on dev box and server).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGS_DIR="$(cd "$SCRIPT_DIR/../../backend/python/smartbi/database/migrations" && pwd)"

if [ ! -d "$MIGS_DIR" ]; then
    echo "[backfill] migrations dir not found: $MIGS_DIR" >&2
    exit 1
fi

echo "[backfill] env=$ENV db=$DB"
echo "[backfill] scanning $MIGS_DIR for V*.sql"

count=0
skipped=0
for f in "$MIGS_DIR"/V*.sql; do
    [ -f "$f" ] || continue
    fname=$(basename "$f")
    ver=$(echo "$fname" | grep -oE '^V[0-9]+_[0-9]+' || true)
    if [ -z "$ver" ]; then
        echo "[backfill] skip $fname (cannot parse version)"
        skipped=$((skipped + 1))
        continue
    fi
    checksum=$(sha256sum "$f" | cut -d' ' -f1)
    sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -q -c "
        INSERT INTO smartbi_migrations (filename, version, checksum, applied_by)
        VALUES ('$fname', '$ver', '$checksum', 'backfill-2026-05-07')
        ON CONFLICT (filename) DO NOTHING
    " >/dev/null
    count=$((count + 1))
done

echo "[backfill] processed $count V-prefix migrations (skipped $skipped non-parseable)"

actual=$(sudo -u postgres psql -d "$DB" -tAc "SELECT COUNT(*) FROM smartbi_migrations")
echo "[backfill] tracker now has $actual rows"
