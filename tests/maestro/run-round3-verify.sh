#!/bin/bash
# Round 3 Verification - Run all 12 new tests (27-38) sequentially
# Captures pass/fail status for each test

cd "$(dirname "$0")"
MAESTRO=~/.maestro/bin/maestro
RESULTS_FILE="round3-verify-results.txt"

echo "=== Round 3 Verification $(date) ===" > "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

PASS=0
FAIL=0
TOTAL=0

# P1 Priority tests first
for test in 27-fa-device-equipment.yaml \
            28-fa-profile-settings.yaml \
            29-wm-inventory-advanced.yaml \
            31-hr-attendance-deep.yaml \
            33-qi-analysis-report.yaml \
            35-dp-ai-schedule-deep.yaml \
            30-wm-profile-alerts.yaml \
            32-hr-department-analytics.yaml \
            34-qi-profile-clockin.yaml \
            36-dp-personnel-profile.yaml \
            37-fa-ai-analysis.yaml \
            38-fa-config-inventory.yaml; do
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
