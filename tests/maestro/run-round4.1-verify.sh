#!/bin/bash
# Round 4.1 Verification — run all 12 Round 4 tests (39-50) sequentially
# Includes stabilization delay between tests to prevent emulator stress

MAESTRO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$MAESTRO_DIR"

# Find ADB
ADB_PATH=""
if [ -f "$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" ]; then
    ADB_PATH="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
elif [ -f "$(cygpath "$LOCALAPPDATA" 2>/dev/null)/Android/Sdk/platform-tools/adb.exe" ]; then
    ADB_PATH="$(cygpath "$LOCALAPPDATA")/Android/Sdk/platform-tools/adb.exe"
fi

PASS=0
FAIL=0
RESULTS=""

for i in 39 40 41 42 43 44 45 46 47 48 49 50; do
    FILE=$(ls ${i}-*.yaml 2>/dev/null | head -1)
    if [ -z "$FILE" ]; then
        echo "[$i] SKIP — file not found"
        continue
    fi
    echo "========================================="
    echo "[$i] Running: $FILE"
    echo "========================================="

    # Force-stop app and wait before each test (emulator stability)
    if [ -n "$ADB_PATH" ]; then
        "$ADB_PATH" shell am force-stop com.cretas.foodtrace 2>/dev/null
    fi
    sleep 3

    OUTPUT=$(~/.maestro/bin/maestro test --no-ansi "$FILE" 2>&1)
    EXIT_CODE=$?

    # Count WARNED and COMPLETED optional taps
    WARNED=$(echo "$OUTPUT" | grep -c "WARNED" || true)
    OPTIONAL_COMPLETED=$(echo "$OUTPUT" | grep "Tap on (Optional)" | grep -c "COMPLETED" || true)

    if [ $EXIT_CODE -eq 0 ]; then
        PASS=$((PASS + 1))
        RESULTS="$RESULTS\n[$i] PASS ($OPTIONAL_COMPLETED completed, $WARNED warned) - $FILE"
        echo "[$i] PASS ($OPTIONAL_COMPLETED completed, $WARNED warned)"
    else
        FAIL=$((FAIL + 1))
        RESULTS="$RESULTS\n[$i] FAIL - $FILE"
        echo "[$i] FAIL"
        echo "$OUTPUT" | grep -E "FAILED|not found" | head -3
    fi
    echo ""

    # Stabilization delay between tests (8s prevents emulator degradation)
    sleep 8
done

echo "========================================="
echo "=== Round 4.1 Verification Summary ==="
echo "========================================="
echo "PASS: $PASS / $((PASS + FAIL))"
echo "FAIL: $FAIL / $((PASS + FAIL))"
echo ""
echo -e "$RESULTS"
