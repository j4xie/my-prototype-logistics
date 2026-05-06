#!/usr/bin/env bash
# scripts/baseline-java-metrics.sh
#
# Java baseline metrics collection for Phase 2A T6 cutover.
#
# Runs continuous sampling against in-scope Java endpoints and writes per-request
# CSV records (timestamp, endpoint, http_status, latency_seconds, response_bytes).
# Companion Python aggregator (scripts/lib/baseline-aggregate.py) computes
# p50/p95/p99/error_rate/qps from the raw CSV.
#
# Source-of-truth spec: docs/superpowers/specs/2026-05-02-phase2a-t6-deploy-runbook.md §6
#
# Usage:
#   JWT_SECRET=xxx ./scripts/baseline-java-metrics.sh \
#       --factory F001 \
#       --duration 7d \
#       --interval 60 \
#       --output /var/log/baseline-java-metrics-20260515.csv \
#       --endpoints /tmp/t6-in-scope-endpoints.txt
#
# All flags except --duration / --output have env-var fallbacks (FACTORY,
# INTERVAL_SEC, ENDPOINTS_FILE, JAVA_BASE).

set -euo pipefail

# ============================================================
# Defaults + arg parse
# ============================================================
FACTORY="${FACTORY:-}"
DURATION="${DURATION:-7d}"
INTERVAL_SEC="${INTERVAL_SEC:-60}"
OUTPUT_FILE=""
ENDPOINTS_FILE="${ENDPOINTS_FILE:-/tmp/t6-in-scope-endpoints.txt}"
JAVA_BASE="${JAVA_BASE:-http://localhost:10010}"
LOCK_FILE="/tmp/baseline-java-metrics.lock"

usage() {
    cat <<EOF
Usage: JWT_SECRET=<secret> $0 --factory <id> [options]

Required:
  --factory <id>            Factory ID for JWT (e.g., F001)
  JWT_SECRET (env var)      Java JWT signing secret (read from /www/wwwroot/cretas/.env.prod)

Options:
  --duration <Nd|Nh|Ns>     Run duration. Default: 7d. Examples: 7d, 24h, 3600s
  --interval <seconds>      Sample interval seconds. Default: 60
  --output <path>           CSV output. Default: /var/log/baseline-java-metrics-YYYYMMDD.csv
  --endpoints <file>        Newline-separated endpoint paths. Default: /tmp/t6-in-scope-endpoints.txt
  --java-base <url>         Java upstream base URL. Default: http://localhost:10010
  --help                    Show this help
EOF
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --factory)    FACTORY="$2"; shift 2 ;;
        --duration)   DURATION="$2"; shift 2 ;;
        --interval)   INTERVAL_SEC="$2"; shift 2 ;;
        --output)     OUTPUT_FILE="$2"; shift 2 ;;
        --endpoints)  ENDPOINTS_FILE="$2"; shift 2 ;;
        --java-base)  JAVA_BASE="$2"; shift 2 ;;
        --help|-h)    usage ;;
        *) echo "Unknown arg: $1" >&2; usage ;;
    esac
done

# Required
[[ -z "$FACTORY" ]] && { echo "ERROR: --factory required" >&2; usage; }
[[ -z "${JWT_SECRET:-}" ]] && { echo "ERROR: JWT_SECRET env var required" >&2; usage; }
[[ ! -r "$ENDPOINTS_FILE" ]] && { echo "ERROR: endpoints file not readable: $ENDPOINTS_FILE" >&2; exit 1; }

# Default output
[[ -z "$OUTPUT_FILE" ]] && OUTPUT_FILE="/var/log/baseline-java-metrics-$(date +%Y%m%d).csv"

# ============================================================
# Duration parser (7d / 24h / 60s → seconds)
# ============================================================
parse_duration() {
    local input="$1"
    local num unit
    num="${input%[a-zA-Z]}"
    unit="${input#$num}"
    case "$unit" in
        d) echo $((num * 86400)) ;;
        h) echo $((num * 3600)) ;;
        m) echo $((num * 60)) ;;
        s|"") echo "$num" ;;
        *) echo "ERROR: bad duration unit: $unit" >&2; exit 1 ;;
    esac
}

DURATION_SEC=$(parse_duration "$DURATION")

# ============================================================
# Lock file (single instance per host)
# ============================================================
if [[ -f "$LOCK_FILE" ]]; then
    PID=$(cat "$LOCK_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "ERROR: another instance running (PID $PID, lockfile $LOCK_FILE)" >&2
        exit 1
    fi
    echo "WARN: stale lockfile, removing" >&2
    rm -f "$LOCK_FILE"
fi
echo "$$" > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"; exit 0' EXIT INT TERM

# ============================================================
# CSV header (idempotent — only write if file is new or empty)
# ============================================================
if [[ ! -s "$OUTPUT_FILE" ]]; then
    echo "timestamp_iso,endpoint,http_status,latency_seconds,response_bytes" > "$OUTPUT_FILE"
fi

# ============================================================
# JWT generator (regenerate periodically; tokens have 1h expiry)
# ============================================================
# Cache token, regen every 50min to leave 10min buffer.
JWT_CACHE=""
JWT_CACHED_AT=0
get_jwt() {
    local now elapsed
    now=$(date +%s)
    elapsed=$((now - JWT_CACHED_AT))
    if [[ -z "$JWT_CACHE" || "$elapsed" -gt 3000 ]]; then
        JWT_CACHE=$(JWT_SECRET="$JWT_SECRET" FACTORY_ID="$FACTORY" python3 - <<'PY'
import jwt, os, time
token = jwt.encode({
    "userId": 1,
    "username": "baseline_collector",
    "factoryId": os.environ["FACTORY_ID"],
    "role": "factory_super_admin",
    "exp": int(time.time()) + 3600,
}, os.environ["JWT_SECRET"], algorithm="HS256")
# PyJWT 1.x returns bytes from encode(); decode to str so curl Authorization
# header gets "eyJ..." not "b'eyJ...'" (server venv38 has pyjwt 1.6.1).
# Same fix as scripts/t6-dryrun-compare.sh after T6.1 pre-flight bug.
if isinstance(token, bytes):
    token = token.decode("utf-8")
print(token)
PY
)
        JWT_CACHED_AT=$now
    fi
    echo "$JWT_CACHE"
}

# ============================================================
# Per-endpoint sampler
# ============================================================
# curl skip-on-fail: log to stderr but don't exit. Records "0,99,0" status to
# preserve sampling cadence (downstream aggregator can detect 0 status).
sample_endpoint() {
    local endpoint="$1" token="$2" ts result
    ts=$(date -Iseconds)
    # %{http_code},%{time_total},%{size_download} via curl -w
    result=$(curl -sS --max-time 30 \
                  -o /dev/null \
                  -w "%{http_code},%{time_total},%{size_download}" \
                  -H "Authorization: Bearer $token" \
                  "${JAVA_BASE}${endpoint}" 2>/dev/null || echo "0,99,0")
    echo "$ts,$endpoint,$result" >> "$OUTPUT_FILE"
}

# ============================================================
# Main loop
# ============================================================
echo "[baseline] start: factory=$FACTORY duration=${DURATION_SEC}s interval=${INTERVAL_SEC}s output=$OUTPUT_FILE" >&2
echo "[baseline] endpoints from: $ENDPOINTS_FILE ($(wc -l < "$ENDPOINTS_FILE") lines)" >&2

START=$(date +%s)
END=$((START + DURATION_SEC))
ITER=0

while [[ "$(date +%s)" -lt "$END" ]]; do
    ITER=$((ITER + 1))
    TOKEN=$(get_jwt)

    # Iterate endpoints (skip blank + comment lines starting with #)
    while IFS= read -r endpoint; do
        [[ -z "$endpoint" || "$endpoint" =~ ^[[:space:]]*# ]] && continue
        sample_endpoint "$endpoint" "$TOKEN"
    done < "$ENDPOINTS_FILE"

    # Periodic progress (every 60 iters ~= 1h at default interval)
    if (( ITER % 60 == 0 )); then
        ROWS=$(wc -l < "$OUTPUT_FILE")
        ELAPSED=$(( $(date +%s) - START ))
        echo "[baseline] iter=$ITER elapsed=${ELAPSED}s rows=$ROWS" >&2
    fi

    sleep "$INTERVAL_SEC"
done

ROWS=$(wc -l < "$OUTPUT_FILE")
echo "[baseline] DONE: iter=$ITER total_rows=$ROWS output=$OUTPUT_FILE" >&2
echo "[baseline] next: scripts/lib/baseline-aggregate.py --input $OUTPUT_FILE" >&2
