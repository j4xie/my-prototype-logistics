#!/usr/bin/env bash
# scripts/active-e2e/parity-assertion/run-parity-tests.sh
#
# Active E2E framework v1 — pytest harness over Chat F/G strict-byte fixtures.
#
# This is a thin wrapper that invokes the existing pytest suite but with the
# right env (live JWT, BASE_URL pointing at the env under test) and the right
# selection of markers / files.
#
# Reuses:
#   - tests/python/smartbi_compat/conftest.py (comparator_mode fixture, marker registration)
#   - backend/python/smartbi_compat/_strict_byte/ (dispatcher.py + strict_diff.py + decimal_helpers.py)
#   - tests/fixtures/java-smartbi-golden/*.json (dict-eq) + *.json.bytes (strict-byte)
#
# Usage:
#   JWT_SECRET=<...> BASE_URL=http://47.100.235.168:8083 \
#     bash scripts/active-e2e/parity-assertion/run-parity-tests.sh
#
#   # Strict-byte mode only:
#   JWT_SECRET=<...> BASE_URL=http://47.100.235.168:8083 \
#     bash scripts/active-e2e/parity-assertion/run-parity-tests.sh --strict-byte
#
#   # Run subset (e.g. only finance + sales contract tests):
#   JWT_SECRET=<...> BASE_URL=http://47.100.235.168:8083 \
#     bash scripts/active-e2e/parity-assertion/run-parity-tests.sh \
#       --tests "test_analysis_finance_contract.py test_analysis_sales_contract.py"

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
TEST_DIR="$REPO_ROOT/tests/python/smartbi_compat"

MODE_FILTER=""
TEST_FILES=""
EXTRA_ARGS=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --strict-byte)  MODE_FILTER="-m strict_byte"; shift ;;
        --dict-eq)      MODE_FILTER="-m 'not strict_byte'"; shift ;;
        --tests)        TEST_FILES="$2"; shift 2 ;;
        --)             shift; EXTRA_ARGS="$*"; break ;;
        *)              EXTRA_ARGS="$EXTRA_ARGS $1"; shift ;;
    esac
done

if [[ -z "${JWT_SECRET:-}" ]]; then
    echo "ERROR: JWT_SECRET env required" >&2
    exit 1
fi

# Default BASE_URL = local Python test env. Override for prod / canary.
export BASE_URL="${BASE_URL:-http://47.100.235.168:8084}"

cd "$REPO_ROOT"

# Resolve test target — full smartbi_compat suite by default, or specific files.
TARGETS=""
if [[ -n "$TEST_FILES" ]]; then
    for f in $TEST_FILES; do
        TARGETS="$TARGETS $TEST_DIR/$f"
    done
else
    TARGETS="$TEST_DIR/"
fi

echo "Active E2E parity assertion:"
echo "  test dir:    $TEST_DIR"
echo "  base url:    $BASE_URL"
echo "  marker filter: ${MODE_FILTER:-<none — all markers>}"
echo "  targets:     $TARGETS"
echo

# Use python -m pytest so the project's pythonpath rules in conftest.py kick in.
# Verbose + summary so failures are easy to spot in CI / ping output.
exec python -m pytest \
    $TARGETS \
    -v --tb=short \
    -ra \
    $MODE_FILTER \
    $EXTRA_ARGS
