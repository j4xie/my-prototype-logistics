#!/usr/bin/env bash
# =============================================================================
# run-pr-gate.sh — Local orchestrator for the V1 E2E PR gate suite
# =============================================================================
# Usage:
#   bash tests/v1-e2e/scripts/run-pr-gate.sh
#
# Env vars (with defaults):
#   PG_HOST      — PostgreSQL host              (default: localhost)
#   PG_PORT      — PostgreSQL port              (default: 5432)
#   PG_USER      — PostgreSQL user              (default: cretas_user)
#   PG_DB        — PostgreSQL database          (default: cretas_db)
#   PGPASSWORD   — Password                     (default: cretas_pass)
#   BACKEND_URL  — Java backend health endpoint (default: http://localhost:10010)
#   WEB_URL      — Web-admin base URL           (default: http://localhost:5173)
#
# What it does:
#   1. Validates prerequisites (psql, node, playwright, backend, web-admin)
#   2. Runs seed-and-reset.sh to reset transactional data
#   3. Runs playwright --grep @pr-gate (L1 smoke + G1/G2/G3 chains)
#   4. Prints summary with elapsed time + path to HTML report
# =============================================================================

set -euo pipefail
trap 'echo "ERROR: script failed at line $LINENO (exit $?)" >&2' ERR

# ── Resolve paths relative to this script ─────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Timing (portable — uses bash $SECONDS builtin) ───────────────────────────
START_SECONDS=$SECONDS

# ── Color output (only if stdout is a terminal and TERM is not dumb) ──────────
if [ -t 1 ] && [ "${TERM:-}" != "dumb" ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    RESET='\033[0m'
else
    RED='' GREEN='' YELLOW='' CYAN='' BOLD='' RESET=''
fi

# ── Connection / URL defaults ─────────────────────────────────────────────────
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-cretas_user}"
PG_DB="${PG_DB:-cretas_db}"
export PGPASSWORD="${PGPASSWORD:-cretas_pass}"
BACKEND_URL="${BACKEND_URL:-http://localhost:10010}"
WEB_URL="${WEB_URL:-http://localhost:5173}"

# ── Header ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}============================================================${RESET}"
echo -e "${BOLD}${CYAN}  Cretas V1 E2E — PR Gate Suite${RESET}"
echo -e "${BOLD}${CYAN}============================================================${RESET}"
echo "  Started : $(date '+%Y-%m-%d %H:%M:%S')"
echo "  E2E dir : $E2E_DIR"
echo "  Backend : $BACKEND_URL"
echo "  Web     : $WEB_URL"
echo "  DB      : $PG_USER@$PG_HOST:$PG_PORT/$PG_DB"
echo ""

# ── Helper: print step header ─────────────────────────────────────────────────
step() {
    echo -e "${BOLD}[$1]${RESET} $2"
}

# ── STEP 1: Prerequisites ─────────────────────────────────────────────────────
step "1/4" "Checking prerequisites..."

# 1a. psql — same discovery loop as seed-and-reset.sh
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
PSQL_BIN="${PSQL_BIN_OVERRIDE:-$PSQL_BIN}"

if [[ -z "$PSQL_BIN" ]]; then
    echo -e "${RED}ERROR: psql not found.${RESET}" >&2
    echo "  Add PostgreSQL bin to PATH, or set: export PSQL_BIN_OVERRIDE=/path/to/psql" >&2
    exit 1
fi
echo "  psql    : $PSQL_BIN"
export PSQL_BIN_OVERRIDE="$PSQL_BIN"   # propagate to seed-and-reset.sh so it skips its own loop

# 1b. node >= 18
if ! command -v node &>/dev/null 2>&1; then
    echo -e "${RED}ERROR: node not found in PATH.${RESET}" >&2
    echo "  Install Node.js >= 18 from https://nodejs.org" >&2
    exit 1
fi
NODE_VER=$(node -e "process.stdout.write(process.versions.node)")
NODE_MAJOR="${NODE_VER%%.*}"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
    echo -e "${RED}ERROR: node $NODE_VER found but >= 18 required.${RESET}" >&2
    exit 1
fi
echo "  node    : v$NODE_VER"

# 1c. playwright installed inside tests/v1-e2e
if ! (cd "$E2E_DIR" && npx playwright --version &>/dev/null 2>&1); then
    echo -e "${RED}ERROR: @playwright/test not installed in $E2E_DIR.${RESET}" >&2
    echo "  Run: cd tests/v1-e2e && npm install" >&2
    exit 1
fi
PW_VER=$(cd "$E2E_DIR" && npx playwright --version 2>/dev/null)
echo "  playwright: $PW_VER"

# 1d. Backend health check (timeout 90s for pre-check — Spring Boot cold start needs 30-90s)
echo "  Checking backend health at ${BACKEND_URL}/api/mobile/health..."
if ! bash "$SCRIPT_DIR/wait-for-health.sh" "${BACKEND_URL}/api/mobile/health" 90 2>/dev/null; then
    echo -e "${RED}ERROR: Backend not responding.${RESET}" >&2
    echo "  启动后端: cd backend/java/cretas-api && mvn spring-boot:run" >&2
    exit 1
fi

# 1e. Web-admin port check (timeout 10s for pre-check)
# Parse WEB_URL into host+port, handling both http:// and https:// schemes.
WEB_WITHOUT_SCHEME="${WEB_URL#http://}"
WEB_WITHOUT_SCHEME="${WEB_WITHOUT_SCHEME#https://}"
WEB_HOST="${WEB_WITHOUT_SCHEME%%:*}"
WEB_HOST="${WEB_HOST%%/*}"      # handle no-port case (strip path)
WEB_PORT_RAW="${WEB_WITHOUT_SCHEME##*:}"
WEB_PORT="${WEB_PORT_RAW%%/*}"  # strip path if any
# If no explicit port (e.g. "https://admin.example.com"), default by scheme.
if [[ "$WEB_PORT" == "$WEB_HOST" ]]; then
    if [[ "$WEB_URL" == https://* ]]; then WEB_PORT=443; else WEB_PORT=80; fi
fi
echo "  Checking web-admin at $WEB_HOST:$WEB_PORT..."
if ! bash "$SCRIPT_DIR/wait-for-port.sh" "$WEB_HOST" "$WEB_PORT" 10 2>/dev/null; then
    echo -e "${RED}ERROR: Web-admin not listening on port $WEB_PORT.${RESET}" >&2
    echo "  启动前端: cd web-admin && npm run dev" >&2
    exit 1
fi

echo -e "  ${GREEN}All prerequisites OK.${RESET}"
echo ""

# ── STEP 2: Seed / reset test data ────────────────────────────────────────────
step "2/4" "Seeding test data (seed-and-reset.sh)..."
bash "$SCRIPT_DIR/seed-and-reset.sh"
echo ""

# ── STEP 3: Run Playwright PR gate suite ─────────────────────────────────────
step "3/4" "Running Playwright PR gate tests (@pr-gate)..."
echo ""

cd "$E2E_DIR"

PW_EXIT=0
npx playwright test --grep @pr-gate --reporter=list || PW_EXIT=$?

echo ""

# ── STEP 4: Summary ───────────────────────────────────────────────────────────
step "4/4" "Summary"

ELAPSED=$(( SECONDS - START_SECONDS ))
MINS=$(( ELAPSED / 60 ))
SECS=$(( ELAPSED % 60 ))
REPORT_PATH="$E2E_DIR/playwright-report/index.html"

echo "  Elapsed : ${MINS}m ${SECS}s"
echo "  Report  : $REPORT_PATH"
echo ""

if [[ "$PW_EXIT" -eq 0 ]]; then
    echo -e "${GREEN}${BOLD}  RESULT: ALL TESTS PASSED${RESET}"
else
    echo -e "${RED}${BOLD}  RESULT: TESTS FAILED (exit $PW_EXIT)${RESET}"
    echo "  Open report: npx playwright show-report $E2E_DIR/playwright-report"
fi

echo ""
echo -e "${BOLD}${CYAN}============================================================${RESET}"
echo ""

exit $PW_EXIT
