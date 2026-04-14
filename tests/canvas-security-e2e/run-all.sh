#!/usr/bin/env bash
# Canvas Security E2E Test Suite — Run all journeys
# Usage: bash tests/canvas-security-e2e/run-all.sh
# Prereq: SSH tunnel must be open: ssh -L 10011:localhost:10011 root@47.100.235.168 -N &
#
# Exit codes:
#   0 — all journeys passed with 0 FAIL and 0 WARN (WARN is treated as failure per E2E skill rules)
#   1 — any journey had FAIL or WARN in its results JSON
#   2 — runner infrastructure error (missing results dir, JSON parse fail, etc.)
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
JOURNEY_OK=0
JOURNEY_FAIL=0
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
    JOURNEY_OK=$((JOURNEY_OK + 1))
  else
    JOURNEY_RESULTS+=("$name: FAILURES")
    JOURNEY_FAIL=$((JOURNEY_FAIL + 1))
  fi
}

# Clean token cache from previous runs
rm -f "$DIR/results/.token-cache.json"

# R3 P1a: optional CANVAS_E2E_RUN_ID env var to isolate runs without cp/mv.
# When set (e.g. "R3-run1"), helpers write *-results-${RUN_ID}.json and this
# script aggregates only those files. When unset, legacy *-results.json path.
RUN_ID="${CANVAS_E2E_RUN_ID:-}"
export CANVAS_E2E_RUN_ID
if [ -n "$RUN_ID" ]; then
  # Clean any prior run with the same RUN_ID to avoid stale mix
  rm -f "$DIR/results/"*"-results-${RUN_ID}.json"
fi

echo "Canvas Security E2E Test Suite"
echo "API: ${E2E_API_BASE:-http://localhost:10011/api/mobile}"
echo "Web: ${E2E_WEB_URL:-http://localhost:5173}"
echo "Run ID: ${RUN_ID:-<default>}"
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
echo "  JOURNEY SUMMARY ($JOURNEY_OK OK / $JOURNEY_FAIL FAIL)"
echo "=========================================="
for r in "${JOURNEY_RESULTS[@]}"; do
  echo "  $r"
done
echo ""

# Aggregate all result JSONs (test-level, not journey-level)
# WARN is treated as failure per E2E skill rules (references/test-rules.md:379)
# R3 P1a: when CANVAS_E2E_RUN_ID is set, aggregate only -${RUN_ID}.json files;
# when unset, aggregate legacy *-results.json files.
node -e "
const fs = require('fs');
const path = require('path');
// \$DIR from bash is Git Bash style (/c/Users/...); pass through Node's fs which accepts both.
// DO NOT use path.resolve — it would mangle /c/Users/... into C:\c\Users\... on Windows.
const dir = '$DIR' + '/results';
// Normalize Git Bash path for Node.js on Windows
const normalizedDir = dir.replace(/^\\/([a-z])\\//, '\$1:/');
const runId = process.env.CANVAS_E2E_RUN_ID || '';
const suffix = runId ? '-results-' + runId + '.json' : '-results.json';
let pass=0, fail=0, warn=0, total=0;
let journeyCount = 0;
try {
  // Only read journey result files for the current run (exclude tokens, other runs, metadata)
  const allFiles = fs.readdirSync(normalizedDir);
  const files = runId
    ? allFiles.filter(f => f.endsWith(suffix))
    : allFiles.filter(f => f.endsWith('-results.json') && !f.match(/-results-[^/]+\\.json\$/));
  if (files.length === 0) {
    console.error('ERROR: No ' + suffix + ' files found in ' + normalizedDir);
    console.error('Journeys may have failed before rc.save() was called.');
    process.exit(2);
  }
  files.forEach(f => {
    const d = JSON.parse(fs.readFileSync(normalizedDir+'/'+f));
    pass += d.pass||0; fail += d.fail||0; warn += d.warn||0; total += d.total||0;
    journeyCount++;
  });
} catch(e) {
  console.error('ERROR: Result aggregation failed:', e.message);
  process.exit(2);
}
console.log('');
console.log('==========================================');
console.log('  TEST-LEVEL SUMMARY (' + journeyCount + ' journeys aggregated)');
console.log('==========================================');
console.log('  Total assertions : ' + total);
console.log('  PASS             : ' + pass);
console.log('  FAIL             : ' + fail);
console.log('  WARN             : ' + warn);
console.log('');
if (fail > 0 || warn > 0) {
  console.log('EXIT: 1 (FAIL=' + fail + ', WARN=' + warn + ' — WARN treated as failure per E2E skill rules)');
  process.exit(1);
}
console.log('EXIT: 0 (all clear — 0 FAIL, 0 WARN)');
"
