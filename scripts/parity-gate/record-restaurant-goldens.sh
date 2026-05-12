#!/bin/bash
# record-restaurant-goldens.sh — drive parity gate for restaurant tenants.
#
# Runs the Phase 2A dict-eq compare against Java prod vs Python prod for the
# T6.6 restaurant /analysis/production + /analysis/quality endpoints across
# 4 analysisType branches per endpoint × N restaurant factory_ids.
#
# Total runs at default settings:
#   2 factories × 4 prod-types  = 8 production goldens
#   2 factories × 4 quality-types = 8 quality goldens
#   = 16 endpoint-runs per invocation
#
# analysisType vocabulary differs per endpoint (verified 2026-05-11 against
# main HEAD d5cd41802a):
#   production: oee | efficiency | equipment | overview     (defaults to oee)
#   quality:    fpy | defect | rework | overview            (defaults to fpy)
#
# Env overrides (all optional; defaults sized for prod parity post-cutover):
#   FACTORIES     — space-separated factory_ids (default: 2 real chains)
#   JAVA_BASE     — Java backend base URL (default: prod 10010)
#   PYTHON_BASE   — Python backend base URL (default: prod 8083)
#   DATE_RANGE    — query string (default: 2026-01 month)
#   REPORTS_DIR   — output dir (default: ./reports/restaurant-parity)
#   GATE_RATE     — pass threshold (default: 99.945, T6.1 dryrun bar)
#   JWT_SECRET    — required env var per fetch_endpoint.make_jwt_token
#
# Exit code:
#   0 = every endpoint-run hit the gate (or hit it with warnings only)
#   1 = ≥1 endpoint-run failed the gate
#
# Per .claude/rules/python-java-port.md Rule 4 Phase 2A dict-eq standard;
# Pattern A int-collapse + scale-4 trailing-zero are tolerated as MATCH.

set -u
set -o pipefail

# ── Configuration ───────────────────────────────────────────────────
# Default factory_ids are restaurant rows that exist in BOTH registries:
#   - cretas_prod_db.factories (tenant + JWT auth + RBAC) — required for tenant
#     detector to return RESTAURANT (else falls through to FACTORY → Phase 2D
#     defer NotImplementedError)
#   - smartbi_prod_db (fact_pos_transaction / restaurant_reviews / etc.) — at
#     least one has Silver data so M3 / N2 / N3 / N4 emit non-trivial values
#
# R_GML_DEMO  — 桂满陇 江浙菜, 16213 fact_pos_transaction rows (verified
#               PR #365 §3.2 audit). Restaurant type confirmed.
# RES_3101_009 — QHJ_PROD (青花椒 prod), RESTAURANT type, zero Silver data
#                today but matches the brief intent for "real QHJ".
#
# The 14 R_*_REAL chain catalog seeds (Sub-ETL-3 V20260511_02) only exist in
# smartbi_prod_db.restaurant_chain_catalog, not in cretas_prod_db.factories,
# so they currently fall through to FACTORY tenant. Onboarding decision
# pending Steve — flagged in PR #365 audit doc §4.
FACTORIES_DEFAULT="RES_3101_009 R_GML_DEMO"
TYPES_PRODUCTION=("oee" "efficiency" "equipment" "overview")
TYPES_QUALITY=("fpy" "defect" "rework" "overview")
DATE_RANGE_DEFAULT="startDate=2026-01-01&endDate=2026-01-31"

FACTORIES="${FACTORIES:-${FACTORIES_DEFAULT}}"
JAVA_BASE="${JAVA_BASE:-http://47.100.235.168:10010}"
PYTHON_BASE="${PYTHON_BASE:-http://47.100.235.168:8083}"
DATE_RANGE="${DATE_RANGE:-${DATE_RANGE_DEFAULT}}"
REPORTS_DIR="${REPORTS_DIR:-./reports/restaurant-parity}"
GATE_RATE="${GATE_RATE:-99.945}"
# Comma-separated pattern letters (A / A2 / B / C) to tolerate per PR #378.
# Restaurant runs need TOLERATE_PATTERNS=B (Java mock vs Python tenant envelope
# is structural-only divergence per Sub-A spec §6.1). Empty = strict default.
TOLERATE_PATTERNS="${TOLERATE_PATTERNS:-}"

# Blue-Green fallback (Task B / PR #403 §6) — when ON the harness probes both
# 10010 (blue) and 10020 (green) on the Java host and uses whichever answers
# /api/mobile/health. Prevents 88/88 false-positive Connection refused when
# the BG slot flips mid-task. Default ON because every prod parity run since
# 2026-05-07 has hit at least one BG flip. Set to 0 to disable.
JAVA_BG_FALLBACK="${JAVA_BG_FALLBACK:-1}"

# Resolve script-local path to compare.py so we can be invoked from anywhere.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPARE_PY="${SCRIPT_DIR}/compare.py"

if [[ ! -x "${COMPARE_PY}" && ! -f "${COMPARE_PY}" ]]; then
  echo "ERROR: compare.py not found at ${COMPARE_PY}" >&2
  exit 2
fi

if [[ -z "${JWT_SECRET:-}" ]]; then
  echo "ERROR: JWT_SECRET env var required (see fetch_endpoint.make_jwt_token)" >&2
  exit 2
fi

mkdir -p "${REPORTS_DIR}"

echo "== restaurant parity-gate run =="
echo "  factories:        ${FACTORIES}"
echo "  java_base:        ${JAVA_BASE}"
echo "  python_base:      ${PYTHON_BASE}"
echo "  date_range:       ${DATE_RANGE}"
echo "  reports_dir:      ${REPORTS_DIR}"
echo "  gate_rate:        ${GATE_RATE}%"
echo "  tolerate_pattern: ${TOLERATE_PATTERNS:-<strict>}"
echo "  java_bg_fallback: ${JAVA_BG_FALLBACK}"
echo ""

# ── Run loop ────────────────────────────────────────────────────────
TOTAL=0
PASSED=0
FAILED=0
FAILED_REPORTS=()

run_one() {
  local endpoint_name="$1"   # "production" | "quality"
  local factory="$2"
  local analysis_type="$3"

  local report_path="${REPORTS_DIR}/${endpoint_name}_${factory}_${analysis_type}.json"
  TOTAL=$((TOTAL + 1))

  local tolerate_arg=()
  if [[ -n "${TOLERATE_PATTERNS}" ]]; then
    tolerate_arg=(--tolerate-divergence-patterns "${TOLERATE_PATTERNS}")
  fi

  local bg_arg=()
  if [[ "${JAVA_BG_FALLBACK}" == "1" ]]; then
    bg_arg=(--java-bg-fallback)
  fi

  python "${COMPARE_PY}" \
    --factory "${factory}" \
    --endpoint "/api/mobile/{factory_id}/smart-bi/analysis/${endpoint_name}" \
    --params "analysisType=${analysis_type}&${DATE_RANGE}" \
    --java-base "${JAVA_BASE}" \
    --python-base "${PYTHON_BASE}" \
    --output "${report_path}" \
    --gate-rate "${GATE_RATE}" \
    --timeout 30 \
    "${tolerate_arg[@]}" \
    "${bg_arg[@]}"
  local rc=$?

  if [[ ${rc} -eq 0 ]]; then
    PASSED=$((PASSED + 1))
    echo "  PASS  ${endpoint_name} ${factory} ${analysis_type}"
  else
    FAILED=$((FAILED + 1))
    FAILED_REPORTS+=("${report_path}")
    echo "  FAIL  ${endpoint_name} ${factory} ${analysis_type}  → ${report_path}"
  fi
}

for factory in ${FACTORIES}; do
  echo "--- factory: ${factory} ---"
  for t in "${TYPES_PRODUCTION[@]}"; do
    run_one "production" "${factory}" "${t}"
  done
  for t in "${TYPES_QUALITY[@]}"; do
    run_one "quality" "${factory}" "${t}"
  done
done

# ── Summary ─────────────────────────────────────────────────────────
echo ""
echo "== summary =="
echo "  total:  ${TOTAL}"
echo "  passed: ${PASSED}"
echo "  failed: ${FAILED}"
if [[ ${#FAILED_REPORTS[@]} -gt 0 ]]; then
  echo ""
  echo "Failing reports (inspect REAL_BUG diverges in the .html siblings):"
  for r in "${FAILED_REPORTS[@]}"; do
    echo "  - ${r}"
    echo "    + ${r%.json}.html"
  done
fi

# Aggregate via jq if available (per-factory match rates).
if command -v jq >/dev/null 2>&1; then
  echo ""
  echo "== aggregate match_rate by factory =="
  for factory in ${FACTORIES}; do
    avg=$(jq -s 'map(.match_rate) | add / length' "${REPORTS_DIR}/"*"_${factory}_"*.json 2>/dev/null || echo "n/a")
    printf "  %-30s avg match_rate = %s%%\n" "${factory}" "${avg}"
  done
fi

echo ""
echo "Reports: ${REPORTS_DIR}/"

if [[ ${FAILED} -gt 0 ]]; then
  exit 1
fi
exit 0
