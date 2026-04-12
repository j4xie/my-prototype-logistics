#!/usr/bin/env bash
# Canvas Security E2E Test Suite — Run all journeys
# Usage: bash tests/canvas-security-e2e/run-all.sh
# Prereq: SSH tunnel must be open: ssh -L 10011:localhost:10011 root@47.100.235.168 -N &
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PASS_COUNT=0
FAIL_COUNT=0
JOURNEY_RESULTS=()

run_journey() {
  local name=$1
  local script=$2
  echo ""
  echo "=========================================="
  echo "  $name"
  echo "=========================================="
  if node "$DIR/$script" 2>&1; then
    JOURNEY_RESULTS+=("$name: OK")
  else
    JOURNEY_RESULTS+=("$name: FAILURES")
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
  PASS_COUNT=$((PASS_COUNT + 1))
}

# Clean token cache from previous runs
rm -f "$DIR/results/.token-cache.json"

echo "Canvas Security E2E Test Suite"
echo "API: ${E2E_API_BASE:-http://localhost:10011/api/mobile}"
echo "Web: ${E2E_WEB_URL:-http://139.196.165.140:8086}"
echo "Time: $(date)"
echo ""

# Phase 1: Setup (must run first)
run_journey "J0: Environment Setup" "j0-setup.mjs"

# Phase 2: Lifecycle (creates test data for J3)
run_journey "J1: Canvas Lifecycle" "j1-lifecycle.mjs"
sleep 5  # Rate limit cooldown (test backend enforces 60s per user, 5s between journeys helps)

# Phase 3: Independent journeys
run_journey "J2: Editor 7 Tabs" "j2-editor-tabs.mjs"
sleep 5
run_journey "J3: Consumer Form" "j3-consumer.mjs"
sleep 5
run_journey "J4: Cross-Tenant Security" "j4-cross-tenant.mjs"
sleep 5
run_journey "J5: Permission Ladder" "j5-permission-ladder.mjs"
sleep 5
run_journey "J6: AI Agent" "j6-ai-agent.mjs"

echo ""
echo "=========================================="
echo "  SUMMARY"
echo "=========================================="
for r in "${JOURNEY_RESULTS[@]}"; do
  echo "  $r"
done
echo ""

# Aggregate all result JSONs
node -e "
const fs = require('fs');
const path = require('path');
const dir = path.join(path.resolve('$DIR'), 'results');
let pass=0, fail=0, warn=0, total=0;
try {
  fs.readdirSync(dir).filter(f=>f.endsWith('.json')).forEach(f => {
    const d = JSON.parse(fs.readFileSync(dir+'/'+f));
    pass += d.pass||0; fail += d.fail||0; warn += d.warn||0; total += d.total||0;
  });
} catch(e) { console.error('Result aggregation error:', e.message); }
console.log('TOTAL: ' + pass + '/' + total + ' PASS, ' + fail + ' FAIL, ' + warn + ' WARN');
if (fail > 0) { console.log('EXIT: 1 (failures detected)'); process.exit(1); }
else { console.log('EXIT: 0 (all clear)'); }
"
