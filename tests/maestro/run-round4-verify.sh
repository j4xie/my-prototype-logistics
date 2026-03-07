#!/bin/bash
# Round 4 Maestro E2E Test Verification
# Tests 39-50: Reports, SmartBI, WS deep, WM alerts, HR CRUD, DP plan detail

cd "$(dirname "$0")"

RESULTS_FILE="round4-verify-results.txt"
echo "=== Round 4 Verification Run ===" > "$RESULTS_FILE"
echo "Date: $(date)" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

PASS_COUNT=0
FAIL_COUNT=0
TOTAL=12

for i in 39 40 41 42 43 44 45 46 47 48 49 50; do
    TEST_FILE=$(ls ${i}-*.yaml 2>/dev/null | head -1)
    if [ -z "$TEST_FILE" ]; then
        echo "[$i] SKIP - file not found" >> "$RESULTS_FILE"
        continue
    fi

    echo "Running test $i: $TEST_FILE ..."
    maestro test "$TEST_FILE" --no-ansi 2>&1 | tail -5 > "/tmp/maestro-r4-${i}.log"

    if grep -q "PASSED" "/tmp/maestro-r4-${i}.log"; then
        echo "[$i] PASS - $TEST_FILE" >> "$RESULTS_FILE"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo "[$i] FAIL - $TEST_FILE" >> "$RESULTS_FILE"
        grep -E "ERROR|FAIL|Exception" "/tmp/maestro-r4-${i}.log" >> "$RESULTS_FILE"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
done

echo "" >> "$RESULTS_FILE"
echo "=== Summary ===" >> "$RESULTS_FILE"
echo "PASS: $PASS_COUNT / $TOTAL" >> "$RESULTS_FILE"
echo "FAIL: $FAIL_COUNT / $TOTAL" >> "$RESULTS_FILE"

cat "$RESULTS_FILE"
