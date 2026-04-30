#!/bin/bash
# scripts/phase2b/record-intent-goldens.sh
#
# Replay tier1 goldens through Java legacy path (usePythonMatcher=false)
# and record JSON responses to tests/fixtures/java-intent-golden/responses/.
#
# Prerequisites:
# - Java backend running on test env (e.g. http://47.100.235.168:10011)
#   with `ai.use-python-matcher=false`. Default is false, so a stock test
#   env should be in legacy mode unless explicitly toggled.
# - Tier 1 jsonl exists: tests/fixtures/java-intent-golden/intent-tier1-50.jsonl
# - JWT token in env JWT_TOKEN (test admin token).
#
# Usage:
#   JWT_TOKEN=eyJhbGc... bash scripts/phase2b/record-intent-goldens.sh
#   JWT_TOKEN=... JAVA_TEST_URL=http://localhost:10011 \
#     bash scripts/phase2b/record-intent-goldens.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TIER1_FILE="$REPO_ROOT/tests/fixtures/java-intent-golden/intent-tier1-50.jsonl"
OUTPUT_DIR="$REPO_ROOT/tests/fixtures/java-intent-golden/responses"

JAVA_TEST_URL="${JAVA_TEST_URL:-http://localhost:10011}"
INTENT_ENDPOINT="${INTENT_ENDPOINT:-/api/mobile/F001/ai/intent/match}"
JWT_TOKEN="${JWT_TOKEN:-}"

if [ -z "$JWT_TOKEN" ]; then
    echo "ERROR: JWT_TOKEN env var not set." >&2
    echo "Usage: JWT_TOKEN=<test admin token> bash $0" >&2
    exit 1
fi

if [ ! -f "$TIER1_FILE" ]; then
    echo "ERROR: $TIER1_FILE not found. Run sample-tier1-goldens.py first." >&2
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

count=0
total=$(wc -l < "$TIER1_FILE")

while IFS= read -r line; do
    [ -z "$line" ] && continue
    count=$((count + 1))
    id=$(echo "$line" | python3 -c 'import sys, json; print(json.loads(sys.stdin.read())["id"])')
    query=$(echo "$line" | python3 -c 'import sys, json; print(json.loads(sys.stdin.read())["query"])')

    echo "[$count/$total] Recording $id: $query"

    response=$(curl -sS -X POST \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"query\":\"$(echo "$query" | sed 's/"/\\"/g')\"}" \
        "$JAVA_TEST_URL$INTENT_ENDPOINT")

    if echo "$response" | python3 -m json.tool > "$OUTPUT_DIR/$id.json" 2>/dev/null; then
        : # pretty-printed JSON
    else
        # Not valid JSON — write raw response so we can inspect
        echo "$response" > "$OUTPUT_DIR/$id.json"
    fi

done < "$TIER1_FILE"

echo "Recorded $count goldens to $OUTPUT_DIR"
