#!/usr/bin/env bash
# scripts/record-java-golden.sh
#
# Record live Java response into tests/fixtures/java-smartbi-golden/<output>.
# Reusable across sister chats (cost / receivable / budget per-type).
#
# Usage:
#   JWT_SECRET=<from .env.test> ./scripts/record-java-golden.sh \
#       <factory_id> <endpoint_path_with_{factoryId}> <output_filename> \
#       [--method POST --data-json '...'] [--prod] \
#       [--strict-byte | --strict-byte-only]
#
# Examples:
#   # Default — dict-eq pretty-printed JSON only (Phase 2A backward compat):
#   JWT_SECRET=xxx ./scripts/record-java-golden.sh F999 \
#       '/api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31&analysisType=profit' \
#       analysis-finance-F999-profit.json
#
#   # Strict-byte — record BOTH .json (dict-eq) and .json.bytes (raw bytes):
#   JWT_SECRET=xxx ./scripts/record-java-golden.sh F999 \
#       '/api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31&analysisType=profit' \
#       analysis-finance-F999-profit.json --strict-byte
#
#   # Strict-byte ONLY — skip the dict-eq pretty-print, record only .json.bytes:
#   JWT_SECRET=xxx ./scripts/record-java-golden.sh F999 \
#       '/api/mobile/{factoryId}/smart-bi/analysis/finance?...' \
#       analysis-finance-F999-profit.json --strict-byte-only
#
# Output naming:
#   <output>          — dict-eq golden (pretty-printed via Python parse-emit roundtrip).
#   <output>.bytes    — strict-byte golden (raw HTTP response body, no transformation).
#
# Defaults to test env (47.100.235.168:10011); pass --prod for prod env (10010).
# Override with BASE_URL_OVERRIDE env var (e.g., http://127.0.0.1:10011 for SSH tunnel).
#
# See docs/superpowers/specs/2026-05-15-strict-byte-gate-test-infrastructure-spec.md
# §4 for the design rationale (dict-eq vs strict-byte parity gates).

set -euo pipefail

USAGE="Usage: JWT_SECRET=<secret> $0 <factory_id> <endpoint_path> <output_filename> [--method M --data-json D] [--prod] [--strict-byte|--strict-byte-only]"

FACTORY_ID="${1:?$USAGE}"
ENDPOINT="${2:?$USAGE}"
OUTPUT="${3:?$USAGE}"

# Parse optional flags after 3 required positional args.
# Backward compat: --prod still accepted as 4th positional or as flag.
shift 3
METHOD="GET"
DATA_JSON=""
ENV_FLAG="test"
STRICT_MODE="off"  # off | strict-byte (both) | strict-byte-only
while [[ $# -gt 0 ]]; do
    case "$1" in
        --method)            METHOD="$2"; shift 2;;
        --data-json)         DATA_JSON="$2"; shift 2;;
        --prod)              ENV_FLAG="--prod"; shift;;
        --strict-byte)       STRICT_MODE="strict-byte"; shift;;
        --strict-byte-only)  STRICT_MODE="strict-byte-only"; shift;;
        *)                   echo "Unknown flag: $1" >&2; exit 1;;
    esac
done

: "${JWT_SECRET:?JWT_SECRET env var required (from /www/wwwroot/cretas/.env.test on server)}"

if [[ -n "${BASE_URL_OVERRIDE:-}" ]]; then
    BASE_URL="$BASE_URL_OVERRIDE"
elif [[ "$ENV_FLAG" == "--prod" ]]; then
    BASE_URL="http://47.100.235.168:10010"
else
    BASE_URL="http://47.100.235.168:10011"
fi

# Generate JWT (1h expiry, factory_super_admin role)
TOKEN=$(JWT_SECRET="$JWT_SECRET" FACTORY_ID="$FACTORY_ID" python3 - <<'PY'
import jwt, os, time
print(jwt.encode({
    "userId": 1,
    "username": "golden_recorder",
    "factoryId": os.environ["FACTORY_ID"],
    "role": "factory_super_admin",
    "exp": int(time.time()) + 3600,
}, os.environ["JWT_SECRET"], algorithm="HS256"))
PY
)

REPO_ROOT="$(git rev-parse --show-toplevel)"
GOLDEN_DIR="$REPO_ROOT/tests/fixtures/java-smartbi-golden"
mkdir -p "$GOLDEN_DIR"

URL="$BASE_URL${ENDPOINT//\{factoryId\}/$FACTORY_ID}"
OUT_PATH="$GOLDEN_DIR/$OUTPUT"
BYTES_PATH="$OUT_PATH.bytes"

echo "Recording: $METHOD $URL"
echo "  mode=$STRICT_MODE"
[[ "$STRICT_MODE" != "strict-byte-only" ]] && echo "  → $OUT_PATH (dict-eq)"
[[ "$STRICT_MODE" != "off" ]]              && echo "  → $BYTES_PATH (strict-byte)"

# Capture raw response to a temp file before any transformation.
# This preserves Java's exact HTTP response body bytes for strict-byte mode,
# and serves as input to the pretty-printer for dict-eq mode.
RAW_TMP=$(mktemp)
trap 'rm -f "$RAW_TMP"' EXIT

if [[ "$METHOD" == "POST" ]]; then
    curl -sS --fail -X POST \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        --data "$DATA_JSON" "$URL" \
        --output "$RAW_TMP"
else
    curl -sS --fail -H "Authorization: Bearer $TOKEN" "$URL" \
        --output "$RAW_TMP"
fi

# Dict-eq output: pretty-print (preserve non-ASCII; matches Jackson-style write).
# Skipped only when --strict-byte-only.
if [[ "$STRICT_MODE" != "strict-byte-only" ]]; then
    python3 -c "import json, sys; print(json.dumps(json.load(open(sys.argv[1], encoding='utf-8')), indent=2, ensure_ascii=False))" "$RAW_TMP" \
        > "$OUT_PATH"
fi

# Strict-byte output: raw HTTP body bytes, no transformation.
# Emitted for --strict-byte and --strict-byte-only.
if [[ "$STRICT_MODE" != "off" ]]; then
    cp "$RAW_TMP" "$BYTES_PATH"
fi

# Show top of whichever file was just written (prefer dict-eq if present).
if [[ -f "$OUT_PATH" ]]; then
    echo "OK. Top of $OUT_PATH:"
    head -20 "$OUT_PATH"
else
    echo "OK. First 200 bytes of $BYTES_PATH:"
    head -c 200 "$BYTES_PATH"; echo
fi
