#!/bin/bash
# Restaurant E2E Verification — Parallel on 2 emulators
# Usage: bash run-restaurant-verify.sh
#
# Emulator-5556 (Medium_Phone): Restaurant tests (51-55, 57)
# Emulator-5554 (Pixel_9a): Factory regression test (56)

MAESTRO="$HOME/.maestro/bin/maestro"
DIR="$(cd "$(dirname "$0")" && pwd)"
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"

echo "=== Restaurant E2E Verification ==="
echo "Time: $(date)"
echo ""

# Parallel execution: restaurant on 5556, factory on 5554
echo "--- Running restaurant tests on emulator-5556 ---"
(
  export ANDROID_SERIAL=emulator-5556
  for test in 51 52 53 54 55 57; do
    echo ""
    echo ">>> Test $test on emulator-5556"
    "$MAESTRO" test "$DIR/$test-restaurant-"*.yaml 2>&1 | tail -5
    echo ">>> Test $test result: $?"
  done
) &
PID_RESTAURANT=$!

echo "--- Running factory regression on emulator-5554 ---"
(
  export ANDROID_SERIAL=emulator-5554
  echo ""
  echo ">>> Test 56 (factory regression) on emulator-5554"
  "$MAESTRO" test "$DIR/56-factory-regression.yaml" 2>&1 | tail -5
  echo ">>> Test 56 result: $?"
) &
PID_FACTORY=$!

# Wait for both
wait $PID_RESTAURANT
RESULT_R=$?
wait $PID_FACTORY
RESULT_F=$?

echo ""
echo "=== Results ==="
echo "Restaurant tests (5556): $([ $RESULT_R -eq 0 ] && echo 'PASS' || echo 'FAIL')"
echo "Factory regression (5554): $([ $RESULT_F -eq 0 ] && echo 'PASS' || echo 'FAIL')"
echo "Done: $(date)"
