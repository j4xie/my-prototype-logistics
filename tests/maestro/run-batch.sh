#!/bin/bash
# Batch Maestro test runner - runs tests sequentially on single emulator
# Usage: bash run-batch.sh [test-pattern]

export PATH="$HOME/.maestro/bin:$PATH"
cd "$(dirname "$0")"

TESTS=(
  "14-wm-inbound-workflow.yaml"
  "15-wm-inventory-ops.yaml"
  "16-wm-outbound-workflow.yaml"
  "17-qi-inspection-flow.yaml"
  "18-qi-records-analysis.yaml"
  "19-qi-inspect-list-search.yaml"
  "20-hr-staff-management.yaml"
  "21-hr-whitelist-crud.yaml"
  "22-dp-plan-scheduling.yaml"
  "23-dp-ai-analysis.yaml"
  "24-fa-management-deep.yaml"
  "25-fa-reports-deep.yaml"
  "26-all-roles-refresh.yaml"
  "explore-qi-deep.yaml"
)

PASS=0
FAIL=0
RESULTS=""

for test in "${TESTS[@]}"; do
  echo "========================================"
  echo "Running: $test"
  echo "========================================"
  if maestro test "$test" 2>&1; then
    PASS=$((PASS + 1))
    RESULTS="$RESULTS\nPASS: $test"
  else
    FAIL=$((FAIL + 1))
    RESULTS="$RESULTS\nFAIL: $test"
  fi
  echo ""
done

echo "========================================"
echo "BATCH RESULTS: $PASS passed, $FAIL failed out of ${#TESTS[@]} tests"
echo "========================================"
echo -e "$RESULTS"
