#!/usr/bin/env bash
# scripts/record-java-golden.sh
#
# Record live Java response into tests/fixtures/java-smartbi-golden/<output>.
# Reusable across sister chats (cost / receivable / budget per-type).
#
# Usage:
#   JWT_SECRET=<from .env.test> ./scripts/record-java-golden.sh \
#       <factory_id> <endpoint_path_with_{factoryId}> <output_filename> [--prod]
#
# Examples:
#   JWT_SECRET=xxx ./scripts/record-java-golden.sh F999 \
#       '/api/mobile/{factoryId}/smart-bi/analysis/finance?startDate=2025-01-01&endDate=2025-12-31&analysisType=profit' \
#       analysis-finance-F999-profit.json
#
# Defaults to test env (47.100.235.168:10011); pass --prod for prod env (10010).
# Override with BASE_URL_OVERRIDE env var (e.g., http://127.0.0.1:10011 for SSH tunnel).

set -euo pipefail

USAGE="Usage: JWT_SECRET=<secret> $0 <factory_id> <endpoint_path> <output_filename> [--prod]"

FACTORY_ID="${1:?$USAGE}"
ENDPOINT="${2:?$USAGE}"
OUTPUT="${3:?$USAGE}"

# Parse optional flags after 3 required positional args.
# Backward compat: --prod still accepted as 4th positional or as flag.
shift 3
METHOD="GET"
DATA_JSON=""
ENV_FLAG="test"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --method)    METHOD="$2"; shift 2;;
        --data-json) DATA_JSON="$2"; shift 2;;
        --prod)      ENV_FLAG="--prod"; shift;;
        *)           echo "Unknown flag: $1" >&2; exit 1;;
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

echo "Recording: $METHOD $URL → $OUT_PATH"

# Pretty-print to file (preserve non-ASCII, sorted on top-level by Python — matches Jackson-style write)
if [[ "$METHOD" == "POST" ]]; then
    curl -sS --fail -X POST \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        --data "$DATA_JSON" "$URL" \
        | python3 -c "import json, sys; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))" \
        > "$OUT_PATH"
else
    curl -sS --fail -H "Authorization: Bearer $TOKEN" "$URL" \
        | python3 -c "import json, sys; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))" \
        > "$OUT_PATH"
fi

echo "OK. Top of file:"
head -20 "$OUT_PATH"
