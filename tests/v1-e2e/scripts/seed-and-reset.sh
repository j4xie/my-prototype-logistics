#!/usr/bin/env bash
# =============================================================================
# seed-and-reset.sh — Reset transactional data for F_E2E_TEST, reseed master
# =============================================================================
# Usage:
#   bash tests/v1-e2e/scripts/seed-and-reset.sh
#
# Env vars (with defaults):
#   PG_HOST      — PostgreSQL host        (default: localhost)
#   PG_PORT      — PostgreSQL port        (default: 5432)
#   PG_USER      — PostgreSQL user        (default: cretas_user)
#   PG_DB        — PostgreSQL database    (default: cretas_db)
#   PGPASSWORD   — Password (required; set to cretas_pass for local dev)
#
# What it does:
#   1. DELETE FROM all transactional tables WHERE factory_id='F_E2E_TEST'
#      (child tables before parents to respect FK order)
#   2. Replay seed-e2e-factory.sql (master data, idempotent)
#   3. Replay demo-orders.sql (3 demo sales orders)
#   4. Print verification counts
#
# Safe to run multiple times — produces the same 3 orders on each run.
# =============================================================================

set -euo pipefail

# ── Resolve script dir so fixtures can be found relative to this file ─────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$(cd "$SCRIPT_DIR/../fixtures" && pwd)"

SEED_MASTER_SQL="$FIXTURES_DIR/seed-e2e-factory.sql"
DEMO_ORDERS_SQL="$FIXTURES_DIR/demo-orders.sql"

# ── Connection defaults ────────────────────────────────────────────────────────
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-cretas_user}"
PG_DB="${PG_DB:-cretas_db}"
export PGPASSWORD="${PGPASSWORD:-cretas_pass}"

# ── Locate psql binary ────────────────────────────────────────────────────────
# Searches common locations so the script works on both Linux and Windows/Git-Bash.
PSQL_BIN=""
for candidate in \
    "psql" \
    "/usr/bin/psql" \
    "/usr/local/bin/psql" \
    "/c/Program Files/PostgreSQL/17/bin/psql" \
    "/c/Program Files/PostgreSQL/16/bin/psql" \
    "/c/Program Files/PostgreSQL/15/bin/psql" \
    "/opt/homebrew/bin/psql"; do
    if command -v "$candidate" &>/dev/null 2>&1; then
        PSQL_BIN="$candidate"
        break
    elif [[ -x "$candidate" ]]; then
        PSQL_BIN="$candidate"
        break
    fi
done

if [[ -z "$PSQL_BIN" ]]; then
    echo "ERROR: psql not found. Add PostgreSQL bin to PATH or set PSQL_BIN env var." >&2
    exit 1
fi

# Allow caller to override: PSQL_BIN=/custom/path/psql bash seed-and-reset.sh
PSQL_BIN="${PSQL_BIN_OVERRIDE:-$PSQL_BIN}"

# ── psql wrapper: stops on first SQL error (-v ON_ERROR_STOP=1) ───────────────
psql_run() {
    "$PSQL_BIN" \
        -h "$PG_HOST" \
        -p "$PG_PORT" \
        -U "$PG_USER" \
        -d "$PG_DB" \
        -v ON_ERROR_STOP=1 \
        "$@"
}

# ── Verify fixture files exist ────────────────────────────────────────────────
if [[ ! -f "$SEED_MASTER_SQL" ]]; then
    echo "ERROR: master data fixture not found: $SEED_MASTER_SQL" >&2
    exit 1
fi
if [[ ! -f "$DEMO_ORDERS_SQL" ]]; then
    echo "ERROR: demo orders fixture not found: $DEMO_ORDERS_SQL" >&2
    exit 1
fi

echo "============================================================"
echo " seed-and-reset.sh — F_E2E_TEST"
echo " Host : $PG_HOST:$PG_PORT  DB: $PG_DB  User: $PG_USER"
echo "============================================================"

# ── Step 1: Truncate transactional tables (child → parent, scoped to F_E2E_TEST)
# Note: using DELETE FROM with WHERE so other factories are unaffected.
# Table names verified against entity @Table annotations and pg_tables query.
# Tables the plan mentioned as "invoices/invoice_items" are actually
# "invoice_records" in this schema (no invoice_items table exists).
echo ""
echo "[1/3] Deleting transactional data for factory F_E2E_TEST..."

psql_run <<'SQL'
BEGIN;

-- ── Child tables first ──────────────────────────────────────────────────────

-- Sales order items
DELETE FROM sales_order_items
WHERE sales_order_id IN (
    SELECT id FROM sales_orders WHERE factory_id = 'F_E2E_TEST'
);

-- Purchase order items
DELETE FROM purchase_order_items
WHERE purchase_order_id IN (
    SELECT id FROM purchase_orders WHERE factory_id = 'F_E2E_TEST'
);

-- Purchase receive items (children of purchase_receive_records)
-- Note: receive_record_id FKs to purchase_receive_records.id
DELETE FROM purchase_receive_items
WHERE receive_record_id IN (
    SELECT id FROM purchase_receive_records WHERE factory_id = 'F_E2E_TEST'
);

-- Internal transfer items
-- Note: internal_transfers uses source_factory_id/target_factory_id (no factory_id col)
--       internal_transfer_items FK column is "transfer_id" (not internal_transfer_id)
DELETE FROM internal_transfer_items
WHERE transfer_id IN (
    SELECT id FROM internal_transfers
    WHERE source_factory_id = 'F_E2E_TEST' OR target_factory_id = 'F_E2E_TEST'
);

-- Factory material requisition items
DELETE FROM factory_material_requisition_items
WHERE requisition_id IN (
    SELECT id FROM factory_material_requisitions WHERE factory_id = 'F_E2E_TEST'
);

-- ── Parent / standalone transactional tables ────────────────────────────────

DELETE FROM sales_orders                   WHERE factory_id = 'F_E2E_TEST';
-- Purchase receive records must be deleted BEFORE purchase_orders (FK: purchase_order_id).
DELETE FROM purchase_receive_records       WHERE factory_id = 'F_E2E_TEST';
DELETE FROM purchase_orders                WHERE factory_id = 'F_E2E_TEST';
DELETE FROM internal_transfers
    WHERE source_factory_id = 'F_E2E_TEST' OR target_factory_id = 'F_E2E_TEST';
DELETE FROM factory_material_requisitions  WHERE factory_id = 'F_E2E_TEST';
DELETE FROM production_plans               WHERE factory_id = 'F_E2E_TEST';
DELETE FROM employee_process_segments      WHERE factory_id = 'F_E2E_TEST';
DELETE FROM invoice_records                WHERE factory_id = 'F_E2E_TEST';
DELETE FROM payment_records                WHERE factory_id = 'F_E2E_TEST';
DELETE FROM bom_change_logs                WHERE factory_id = 'F_E2E_TEST';
-- product_sample_tracking_records has its own factory_id column
-- (FK col is named "sample_id", not "product_sample_id")
DELETE FROM product_sample_tracking_records WHERE factory_id = 'F_E2E_TEST';

COMMIT;
SQL

echo "   Done — transactional tables cleared."

# ── Step 2: Replay master data (idempotent) ───────────────────────────────────
echo ""
echo "[2/3] Replaying master data (seed-e2e-factory.sql)..."
psql_run -f "$SEED_MASTER_SQL"
echo "   Done — master data seeded."

# ── Step 3: Insert demo orders ────────────────────────────────────────────────
echo ""
echo "[3/3] Inserting demo sales orders (demo-orders.sql)..."
psql_run -f "$DEMO_ORDERS_SQL"
echo "   Done — demo orders inserted."

# ── Verification ──────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo " Verification"
echo "============================================================"
psql_run -t -A -F' | ' <<'SQL'
SELECT
    order_number,
    status,
    total_amount,
    paid_amount,
    to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
FROM sales_orders
WHERE factory_id = 'F_E2E_TEST'
  AND order_number IN ('DEMO_SO_001', 'DEMO_SO_002', 'DEMO_SO_003')
ORDER BY order_number;
SQL

echo ""
echo " Total F_E2E_TEST sales_orders:"
psql_run -t -A <<'SQL'
SELECT COUNT(*) FROM sales_orders WHERE factory_id = 'F_E2E_TEST';
SQL

echo ""
echo "============================================================"
echo " seed-and-reset.sh COMPLETE"
echo "============================================================"
