#!/usr/bin/env bash
# scripts/t6-dryrun-compare.sh
# Phase 2A T6.1 — dual-call dict_eq sidecar.
#
# Periodically calls each in-scope endpoint against BOTH Java (10010) and
# Python (8083) and dict_eq compares (after _strip_volatile). Logs verdict
# per call to NDJSON for later aggregation. Runs while nginx STILL routes
# 100% to Java — pure dark verification.
#
# Output NDJSON schema (per line):
#   {
#     "ts": "...",
#     "endpoint": "...",
#     "java": {"http": int, "lat_s": float, "size": int},
#     "python": {"http": int, "lat_s": float, "size": int},
#     "verdict": "match"|"diverge"|"java_err"|"python_err"|"both_err",
#     "diff": {} | null  # populated only on diverge
#   }
#
# Aggregation script: scripts/lib/dryrun-aggregate.py (TBD; runbook §3.1 GO/NO-GO)
# Source-of-truth spec: docs/superpowers/specs/2026-05-02-phase2a-t6-deploy-runbook.md §3.1
#
# Usage on server 47:
#     export JWT_SECRET="$(grep '^JWT_SECRET=' /www/wwwroot/cretas/.env.prod | cut -d= -f2)"
#     export FACTORY="F999"
#     nohup bash scripts/t6-dryrun-compare.sh \
#         --duration 24h --interval 60 \
#         --endpoints scripts/phase2a/t6-in-scope-endpoints.txt \
#         --output /var/log/cretas-t6-dryrun.ndjson \
#         > /tmp/t6-dryrun.out 2>&1 &
#     disown

set -euo pipefail

DURATION="${DURATION:-24h}"
INTERVAL_SEC="${INTERVAL_SEC:-60}"
ENDPOINTS_FILE="${ENDPOINTS_FILE:-/tmp/t6-in-scope-endpoints.txt}"
JAVA_BASE="${JAVA_BASE:-http://localhost:10010}"
PYTHON_BASE="${PYTHON_BASE:-http://localhost:8083}"
OUTPUT_FILE=""
FACTORY="${FACTORY:-}"
LOCK_FILE="/tmp/t6-dryrun-compare.lock"

usage() {
    cat <<EOF
Usage: JWT_SECRET=<secret> FACTORY=<id> $0 [options]

Required env:
  JWT_SECRET  Java JWT signing secret
  FACTORY     Factory ID (placeholder substituted into endpoints)

Options:
  --duration <Nd|Nh|Ns>     Default: 24h
  --interval <seconds>      Default: 60
  --endpoints <file>        Default: /tmp/t6-in-scope-endpoints.txt
  --java-base <url>         Default: http://localhost:10010
  --python-base <url>       Default: http://localhost:8083
  --output <path>           Default: /var/log/cretas-t6-dryrun-YYYYMMDD.ndjson
  --help                    Show help
EOF
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --duration)    DURATION="$2"; shift 2 ;;
        --interval)    INTERVAL_SEC="$2"; shift 2 ;;
        --endpoints)   ENDPOINTS_FILE="$2"; shift 2 ;;
        --java-base)   JAVA_BASE="$2"; shift 2 ;;
        --python-base) PYTHON_BASE="$2"; shift 2 ;;
        --output)      OUTPUT_FILE="$2"; shift 2 ;;
        --help|-h)     usage ;;
        *) echo "Unknown arg: $1" >&2; usage ;;
    esac
done

[[ -z "$FACTORY" ]] && { echo "ERROR: FACTORY env required" >&2; usage; }
[[ -z "${JWT_SECRET:-}" ]] && { echo "ERROR: JWT_SECRET env required" >&2; usage; }
[[ ! -r "$ENDPOINTS_FILE" ]] && { echo "ERROR: endpoints file not readable: $ENDPOINTS_FILE" >&2; exit 1; }

[[ -z "$OUTPUT_FILE" ]] && OUTPUT_FILE="/var/log/cretas-t6-dryrun-$(date +%Y%m%d).ndjson"

parse_duration() {
    local in="$1"
    local n="${in%[a-zA-Z]}"
    local u="${in#$n}"
    case "$u" in
        d) echo $((n * 86400)) ;;
        h) echo $((n * 3600)) ;;
        m) echo $((n * 60)) ;;
        s|"") echo "$n" ;;
        *) echo "ERROR: bad duration unit: $u" >&2; exit 1 ;;
    esac
}
DURATION_SEC=$(parse_duration "$DURATION")

# Lock
if [[ -f "$LOCK_FILE" ]]; then
    PID=$(cat "$LOCK_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "ERROR: another instance running (PID $PID)" >&2
        exit 1
    fi
    rm -f "$LOCK_FILE"
fi
echo "$$" > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE" /tmp/.t6dryrun_*; exit 0' EXIT INT TERM

# JWT cache (regen every 50min; tokens have 1h expiry)
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
    "username": "t6_dryrun",
    "factoryId": os.environ["FACTORY_ID"],
    "role": "factory_super_admin",
    "exp": int(time.time()) + 3600,
}, os.environ["JWT_SECRET"], algorithm="HS256")
if isinstance(token, bytes):
    token = token.decode("utf-8")
print(token)
PY
)
        JWT_CACHED_AT=$now
    fi
    echo "$JWT_CACHE"
}

# Single-line Python dict_eq comparator. Strips volatile fields per
# convention used by smartbi_compat tests (any *Iso, *Timestamp, traceId,
# requestId, generatedAt etc.). Outputs NDJSON line.
compare_responses() {
    local endpoint="$1" java_body="$2" python_body="$3"
    local java_meta="$4" python_meta="$5"
    JAVA_BODY="$java_body" PY_BODY="$python_body" \
    JAVA_META="$java_meta" PY_META="$python_meta" \
    EP="$endpoint" python3 <<'PY'
# Wrap whole body in try/except so transient failures (e.g. malformed
# meta JSON during Python service restart) don't propagate non-zero exit
# under the script's `set -euo pipefail`. Always emit a valid NDJSON line
# — outer loop tally still works, deploys don't kill ongoing dryrun.
# (Task #27 fix 2026-05-07.)
import json, os, sys, datetime, re

try:
    VOLATILE_KEY_PATTERNS = [
        re.compile(r"timestamp", re.I),
        re.compile(r"^generatedAt$", re.I),
        re.compile(r"^traceId$", re.I),
        re.compile(r"^requestId$", re.I),
        re.compile(r"^lastUpdated$", re.I),
        re.compile(r"Iso$"),
    ]

    # Synthesized-record context: alerts/recommendations endpoints generate fresh
    # UUID `id` + `createdAt` per call (Java + Python both, by design — not stored).
    # Strip these two fields ONLY when the dict shape matches alerts (level+category)
    # or recommendations (actionItems+priority). Avoids stripping legitimate stable
    # IDs in datasource/list, query-templates, etc.
    def _is_synthesized_record(d):
        if not isinstance(d, dict):
            return False
        if "level" in d and "category" in d and "metric" in d:
            return True  # alerts shape
        if "actionItems" in d and "priority" in d:
            return True  # recommendations shape
        return False

    _SYNTHESIZED_VOLATILE_KEYS = {"id", "createdAt"}

    def strip_volatile(obj):
        if isinstance(obj, dict):
            synth = _is_synthesized_record(obj)
            out = {}
            for k, v in obj.items():
                if any(p.search(k) for p in VOLATILE_KEY_PATTERNS):
                    continue
                if synth and k in _SYNTHESIZED_VOLATILE_KEYS:
                    continue
                out[k] = strip_volatile(v)
            return out
        if isinstance(obj, list):
            return [strip_volatile(v) for v in obj]
        return obj

    def safe_load(s):
        try:
            return json.loads(s)
        except Exception:
            return None

    j_body_raw = os.environ.get("JAVA_BODY", "")
    p_body_raw = os.environ.get("PY_BODY", "")
    j_body = safe_load(j_body_raw) if j_body_raw else None
    p_body = safe_load(p_body_raw) if p_body_raw else None

    j_meta = safe_load(os.environ.get("JAVA_META", "")) or {"http": 0, "lat_s": 0, "size": 0}
    p_meta = safe_load(os.environ.get("PY_META", "")) or {"http": 0, "lat_s": 0, "size": 0}

    j_status = j_meta.get("http", 0)
    p_status = p_meta.get("http", 0)

    # Parse-fail detection — body returned (non-empty) but safe_load couldn't
    # decode it. Common causes: HTML error page (e.g. nginx 502 returned with
    # http=200 due to upstream proxy quirk), truncated stream, partial response,
    # or backend returning text/plain instead of application/json. Without this
    # check, two None bodies would compare equal and falsely register as match.
    # (chat 2 PR #119 finding 2026-05-07: pre-task-#27 dryrun crashed iter ~1060
    # at unprotected json.loads — task #27 wrapped it in safe_load, but None==None
    # match-bug was the residual gap this fix addresses.)
    j_parse_failed = bool(j_body_raw) and j_body is None
    p_parse_failed = bool(p_body_raw) and p_body is None

    if not (200 <= j_status < 300) and not (200 <= p_status < 300):
        verdict = "both_err"
        diff = None
    elif not (200 <= j_status < 300):
        verdict = "java_err"
        diff = None
    elif not (200 <= p_status < 300):
        verdict = "python_err"
        diff = None
    elif j_parse_failed or p_parse_failed:
        # http=200 但 body 非 valid JSON — record as compare_err so aggregator
        # buckets it correctly (NOT match, NOT diverge).
        verdict = "compare_err"
        diff = {
            "reason": "json_parse_fail",
            "java_parsed": not j_parse_failed,
            "python_parsed": not p_parse_failed,
            "j_head": j_body_raw[:80] if j_parse_failed else None,
            "p_head": p_body_raw[:80] if p_parse_failed else None,
        }
    else:
        j_clean = strip_volatile(j_body) if j_body else None
        p_clean = strip_volatile(p_body) if p_body else None
        if j_clean == p_clean:
            verdict = "match"
            diff = None
        else:
            verdict = "diverge"
            # Top-level key diff for compactness; full diff in /tmp/.t6dryrun_<hash>
            j_keys = set(j_clean.get("data", {}).keys()) if isinstance(j_clean, dict) and isinstance(j_clean.get("data"), dict) else set()
            p_keys = set(p_clean.get("data", {}).keys()) if isinstance(p_clean, dict) and isinstance(p_clean.get("data"), dict) else set()
            diff = {
                "j_only_keys": sorted(j_keys - p_keys),
                "p_only_keys": sorted(p_keys - j_keys),
            }

    print(json.dumps({
        "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "endpoint": os.environ["EP"],
        "java": j_meta,
        "python": p_meta,
        "verdict": verdict,
        "diff": diff,
    }, ensure_ascii=False))

except Exception as exc:
    # Last-resort fallback so script never exits non-zero. Outer tally
    # treats this as ERRORS bucket (not match/diverge).
    print(json.dumps({
        "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "endpoint": os.environ.get("EP", ""),
        "java": {},
        "python": {},
        "verdict": "compare_err",
        "diff": {"exc": type(exc).__name__, "msg": str(exc)[:200]},
    }, ensure_ascii=False))
PY
}

call_endpoint() {
    local base="$1" path="$2" token="$3" body_file="$4"
    # %{http_code},%{time_total},%{size_download} via curl -w
    local result
    result=$(curl -sS --max-time 30 \
                  -o "$body_file" \
                  -w "%{http_code},%{time_total},%{size_download}" \
                  -H "Authorization: Bearer $token" \
                  "${base}${path}" 2>/dev/null || echo "0,99,0")
    # Convert to JSON meta blob
    IFS=',' read -r http lat size <<<"$result"
    echo "{\"http\":$http,\"lat_s\":$lat,\"size\":$size}"
}

substitute_factory() {
    echo "$1" | sed "s|{factoryId}|$FACTORY|g"
}

echo "[t6-dryrun] start: factory=$FACTORY duration=${DURATION_SEC}s interval=${INTERVAL_SEC}s output=$OUTPUT_FILE" >&2
echo "[t6-dryrun] endpoints: $ENDPOINTS_FILE ($(grep -cv '^[[:space:]]*\(#\|$\)' "$ENDPOINTS_FILE") active)" >&2

START=$(date +%s)
END=$((START + DURATION_SEC))
ITER=0
TOTAL=0
MATCHES=0
DIVERGES=0
ERRORS=0

while [[ "$(date +%s)" -lt "$END" ]]; do
    ITER=$((ITER + 1))
    TOKEN=$(get_jwt)

    while IFS= read -r raw_endpoint; do
        [[ -z "$raw_endpoint" || "$raw_endpoint" =~ ^[[:space:]]*# ]] && continue
        endpoint=$(substitute_factory "$raw_endpoint")
        TOTAL=$((TOTAL + 1))

        JBODY="/tmp/.t6dryrun_j_$$"
        PBODY="/tmp/.t6dryrun_p_$$"
        JMETA=$(call_endpoint "$JAVA_BASE" "$endpoint" "$TOKEN" "$JBODY")
        PMETA=$(call_endpoint "$PYTHON_BASE" "$endpoint" "$TOKEN" "$PBODY")

        # Read bodies (truncate to 1MB to bound memory)
        JBODY_CONTENT=$(head -c 1048576 "$JBODY" 2>/dev/null || echo "")
        PBODY_CONTENT=$(head -c 1048576 "$PBODY" 2>/dev/null || echo "")
        rm -f "$JBODY" "$PBODY"

        LINE=$(compare_responses "$endpoint" "$JBODY_CONTENT" "$PBODY_CONTENT" "$JMETA" "$PMETA")
        echo "$LINE" >> "$OUTPUT_FILE"

        # Tally — handle compare_err (task #27 fix) as ERRORS, never exit-on-error
        case "$LINE" in
            *'"verdict":"match"'*)        MATCHES=$((MATCHES + 1)) ;;
            *'"verdict":"diverge"'*)      DIVERGES=$((DIVERGES + 1)) ;;
            *'"verdict":"compare_err"'*)  ERRORS=$((ERRORS + 1)) ;;
            *)                             ERRORS=$((ERRORS + 1)) ;;
        esac
    done < "$ENDPOINTS_FILE"

    # Periodic summary (every 10 iters)
    if (( ITER % 10 == 0 )); then
        ELAPSED=$(( $(date +%s) - START ))
        PASS_RATE=0
        [[ "$TOTAL" -gt 0 ]] && PASS_RATE=$(( MATCHES * 100 / TOTAL ))
        echo "[t6-dryrun] iter=$ITER elapsed=${ELAPSED}s total=$TOTAL match=$MATCHES diverge=$DIVERGES err=$ERRORS pass_rate=${PASS_RATE}%" >&2
    fi

    sleep "$INTERVAL_SEC"
done

PASS_RATE=0
[[ "$TOTAL" -gt 0 ]] && PASS_RATE=$(( MATCHES * 100 / TOTAL ))
echo "[t6-dryrun] DONE: total=$TOTAL match=$MATCHES diverge=$DIVERGES err=$ERRORS pass_rate=${PASS_RATE}% output=$OUTPUT_FILE" >&2
echo "[t6-dryrun] GO criteria: pass_rate >= 99%, top-5 endpoints 0 diverge, python_err == 0" >&2
