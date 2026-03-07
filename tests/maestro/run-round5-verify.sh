#!/bin/bash
# Round 5 Maestro E2E Test Verification
# Tests 58-75: Restaurant deep navigation + cross-role gaps + in-depth page interaction
# Phase A (58-64): Deep navigation into sub-screens
# Phase B (65-75): Stay on ONE page and exercise all UI elements

MAESTRO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$MAESTRO_DIR"

# Find ADB
ADB_PATH=""
if [ -f "$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" ]; then
    ADB_PATH="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
elif [ -f "$(cygpath "$LOCALAPPDATA" 2>/dev/null)/Android/Sdk/platform-tools/adb.exe" ]; then
    ADB_PATH="$(cygpath "$LOCALAPPDATA")/Android/Sdk/platform-tools/adb.exe"
fi

# Parse optional wave filter
WAVE="all"
if [ "$1" == "a" ] || [ "$1" == "A" ]; then
    WAVE="a"
    echo "Running Phase A only (tests 58-64)"
elif [ "$1" == "b" ] || [ "$1" == "B" ]; then
    WAVE="b"
    echo "Running Phase B only (tests 65-75)"
fi

PASS=0
FAIL=0
WARN=0
RESULTS=""

# Build test list based on wave
TESTS=""
case $WAVE in
    a) TESTS="58 59 60 61 62 63 64" ;;
    b) TESTS="65 66 67 68 69 70 71 72 73 74 75" ;;
    *) TESTS="58 59 60 61 62 63 64 65 66 67 68 69 70 71 72 73 74 75" ;;
esac

TOTAL=$(echo $TESTS | wc -w | tr -d ' ')

for i in $TESTS; do
    FILE=$(ls ${i}-*.yaml 2>/dev/null | head -1)
    if [ -z "$FILE" ]; then
        echo "[$i] SKIP — file not found"
        continue
    fi
    echo "========================================="
    echo "[$i] Running: $FILE"
    echo "========================================="

    # Force-stop app, clean up Maestro port forwards, and wait (emulator stability)
    if [ -n "$ADB_PATH" ]; then
        "$ADB_PATH" shell am force-stop com.cretas.foodtrace 2>/dev/null
        "$ADB_PATH" forward --remove-all 2>/dev/null
    fi
    sleep 5

    OUTPUT=$(~/.maestro/bin/maestro test --no-ansi "$FILE" 2>&1)
    EXIT_CODE=$?

    # Count WARNED and COMPLETED optional taps (-a handles binary data in Maestro output)
    WARNED=$(echo "$OUTPUT" | grep -ac "WARNED" || true)
    OPTIONAL_COMPLETED=$(echo "$OUTPUT" | grep -a "Optional" | grep -ac "COMPLETED" || true)

    if [ $EXIT_CODE -eq 0 ]; then
        if [ "$WARNED" -gt 12 ]; then
            WARN=$((WARN + 1))
            RESULTS="$RESULTS\n[$i] WARN ($OPTIONAL_COMPLETED ok, $WARNED warned) - $FILE"
            echo "[$i] WARN ($OPTIONAL_COMPLETED ok, $WARNED warned) — many optional taps missed"
        else
            PASS=$((PASS + 1))
            RESULTS="$RESULTS\n[$i] PASS ($OPTIONAL_COMPLETED ok, $WARNED warned) - $FILE"
            echo "[$i] PASS ($OPTIONAL_COMPLETED ok, $WARNED warned)"
        fi
    else
        FAIL=$((FAIL + 1))
        RESULTS="$RESULTS\n[$i] FAIL - $FILE"
        echo "[$i] FAIL"
        echo "$OUTPUT" | grep -aE "FAILED|not found|Error" | head -5
    fi
    echo ""

    # Stabilization delay between tests (8s prevents emulator degradation)
    sleep 8
done

echo "========================================="
echo "=== Round 5 Verification Summary ==="
echo "========================================="
echo "PASS: $PASS / $TOTAL"
echo "WARN: $WARN / $TOTAL (passed but many optional taps missed)"
echo "FAIL: $FAIL / $TOTAL"
echo ""
echo -e "$RESULTS"
echo ""
echo "Phase A (58-64): Restaurant deep + WS/DP gaps"
echo "Phase B (65-75): In-depth page interaction"
echo ""
echo "Usage: $0 [a|b]  — run only Phase A or Phase B"
