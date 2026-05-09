#!/usr/bin/env bash
# scripts/record-java-golden-multipart.sh
#
# Record live Java response into tests/fixtures/java-smartbi-golden/<output>
# for endpoints that consume multipart/form-data (e.g. POST /datasource/upload).
#
# Companion to scripts/record-java-golden.sh which only handles JSON request
# bodies. This helper exists because scripts/record-java-golden.sh's curl path
# is `--data "$DATA_JSON"` which is incompatible with multipart `-F` flags.
#
# Usage:
#   JWT_SECRET=<from .env.test> ./scripts/record-java-golden-multipart.sh \
#       <factory_id> <endpoint_path_with_{factoryId}> <output_filename> \
#       <local_file_path> <form_field_name> [extra_form_field=value ...]
#
# Examples:
#   JWT_SECRET=xxx ./scripts/record-java-golden-multipart.sh F999 \
#       '/api/mobile/{factoryId}/smart-bi/datasource/upload' \
#       datasource-upload-schema-F999.json \
#       /tmp/sample.xlsx file 'datasourceName=test_recording'
#
# The script must run on the server (47.100.235.168) because Java test 10011 is
# not exposed publicly. Or use BASE_URL_OVERRIDE to point at an SSH tunnel.

set -euo pipefail

USAGE="Usage: JWT_SECRET=<secret> $0 <factory_id> <endpoint_path> <output_filename> <local_file_path> <form_field_name> [extra_field=value ...]"

FACTORY_ID="${1:?$USAGE}"
ENDPOINT="${2:?$USAGE}"
OUTPUT="${3:?$USAGE}"
LOCAL_FILE="${4:?$USAGE}"
FORM_FIELD="${5:?$USAGE}"
shift 5

: "${JWT_SECRET:?JWT_SECRET env var required (from /www/wwwroot/cretas/.env.test on server)}"

if [[ -n "${BASE_URL_OVERRIDE:-}" ]]; then
    BASE_URL="$BASE_URL_OVERRIDE"
else
    BASE_URL="http://47.100.235.168:10011"
fi

# Generate JWT (1h expiry, factory_super_admin role) — same algorithm as
# record-java-golden.sh
TOKEN=$(JWT_SECRET="$JWT_SECRET" FACTORY_ID="$FACTORY_ID" python3 - <<'PY'
import jwt, os, time
t = jwt.encode({
    "userId": 1,
    "username": "golden_recorder",
    "factoryId": os.environ["FACTORY_ID"],
    "role": "factory_super_admin",
    "exp": int(time.time()) + 3600,
}, os.environ["JWT_SECRET"], algorithm="HS256")
# PyJWT 1.x returned bytes; 2.x returns str — normalize for shell consumption.
if isinstance(t, bytes):
    t = t.decode("utf-8")
print(t)
PY
)

REPO_ROOT="$(git rev-parse --show-toplevel)"
GOLDEN_DIR="$REPO_ROOT/tests/fixtures/java-smartbi-golden"
mkdir -p "$GOLDEN_DIR"

URL="$BASE_URL${ENDPOINT//\{factoryId\}/$FACTORY_ID}"
OUT_PATH="$GOLDEN_DIR/$OUTPUT"

# Build curl -F args: required file + each extra `key=value` extra field.
CURL_FORMS=("-F" "${FORM_FIELD}=@${LOCAL_FILE}")
for extra in "$@"; do
    CURL_FORMS+=("-F" "$extra")
done

echo "Recording: POST (multipart) $URL → $OUT_PATH"

curl -sS --fail -X POST \
    -H "Authorization: Bearer $TOKEN" \
    "${CURL_FORMS[@]}" \
    "$URL" \
    | python3 -c "import json, sys; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))" \
    > "$OUT_PATH"

echo "OK. Top of file:"
head -20 "$OUT_PATH"
