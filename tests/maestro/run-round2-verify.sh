#!/bin/bash
# Round 2 Verification - Run all 12 tests sequentially
# Captures pass/fail status for each test

cd "$(dirname "$0")"
MAESTRO=~/.maestro/bin/maestro
RESULTS_FILE="round2-verify-results.txt"

echo "=== Round 2 Verification $(date) ===" > "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

PASS=0
FAIL=0
TOTAL=0

for test in 14-wm-inbound-workflow.yaml \
            15-wm-inventory-ops.yaml \
            16-wm-outbound-workflow.yaml \
            17-qi-inspection-flow.yaml \
            18-qi-records-analysis.yaml \
            19-qi-inspect-list-search.yaml \
            20-hr-staff-management.yaml \
            21-hr-whitelist-crud.yaml \
            22-dp-plan-scheduling.yaml \
            23-dp-ai-analysis.yaml \
            24-fa-management-deep.yaml \
            25-fa-reports-deep.yaml; do
  TOTAL=$((TOTAL + 1))
  echo "--- Running: $test ---"
  if $MAESTRO test "$test" 2>&1; then
    echo "PASS: $test" >> "$RESULTS_FILE"
    PASS=$((PASS + 1))
    echo ">>> PASS"
  else
    echo "FAIL: $test" >> "$RESULTS_FILE"
    FAIL=$((FAIL + 1))
    echo ">>> FAIL"
  fi
  echo ""
done

echo "" >> "$RESULTS_FILE"
echo "=== Summary: $PASS/$TOTAL PASS, $FAIL FAIL ===" >> "$RESULTS_FILE"
echo ""
echo "=== DONE: $PASS/$TOTAL PASS, $FAIL FAIL ==="
cat "$RESULTS_FILE"
