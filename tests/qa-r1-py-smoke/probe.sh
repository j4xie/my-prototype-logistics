#!/bin/bash
# R1 Python endpoint smoke probe via 139:8086 nginx (prod, read-only)
# Auth: F006 factory_super_admin token (f006_admin / 123456)
# Output: per-endpoint status + size + key shape signals

set -u
TOKEN="$(cat /tmp/f006-token.txt)"
BASE="http://139.196.165.140:8086"
FID="F006"
SD="2026-04-01"
ED="2026-05-01"

OUTFILE="${1:-results.txt}"
> "$OUTFILE"

probe() {
  local name="$1"
  local method="$2"
  local path="$3"
  local extra_curl="${4:-}"

  local resp
  resp=$(curl -s -X "$method" "${BASE}${path}" \
    -H "Authorization: Bearer $TOKEN" \
    ${extra_curl} \
    -w "\n__META__|status=%{http_code}|time=%{time_total}|size=%{size_download}" \
    2>&1)

  local meta="${resp##*__META__}"
  local body="${resp%__META__*}"
  # Trim trailing newline before __META__
  body="${body%$'\n'}"

  # Extract first 300 chars of body to capture envelope keys
  local sample
  sample=$(echo "$body" | head -c 400)

  printf '=== %s ===\n' "$name" | tee -a "$OUTFILE"
  printf 'PATH: %s %s\n' "$method" "$path" | tee -a "$OUTFILE"
  printf 'META:%s\n' "$meta" | tee -a "$OUTFILE"
  printf 'SAMPLE: %s\n' "$sample" | tee -a "$OUTFILE"
  printf '\n' | tee -a "$OUTFILE"
}

# === Phase 2A finance (4) ===
probe "finance-composite" GET "/api/mobile/${FID}/smart-bi/analysis/finance?startDate=${SD}&endDate=${ED}"
probe "finance-budget-achievement" GET "/api/mobile/${FID}/smart-bi/analysis/finance/budget-achievement?startDate=${SD}&endDate=${ED}"
probe "finance-yoy-mom" GET "/api/mobile/${FID}/smart-bi/analysis/finance/yoy-mom?startDate=${SD}&endDate=${ED}&periodType=MONTH"
probe "finance-category-comparison" GET "/api/mobile/${FID}/smart-bi/analysis/finance/category-comparison?startDate=${SD}&endDate=${ED}"

# === Phase 2A core (6) ===
probe "analysis-sales" GET "/api/mobile/${FID}/smart-bi/analysis/sales?startDate=${SD}&endDate=${ED}"
probe "analysis-inventory" GET "/api/mobile/${FID}/smart-bi/analysis/inventory?startDate=${SD}&endDate=${ED}"
probe "analysis-procurement" GET "/api/mobile/${FID}/smart-bi/analysis/procurement?startDate=${SD}&endDate=${ED}"
probe "analysis-region" GET "/api/mobile/${FID}/smart-bi/analysis/region?startDate=${SD}&endDate=${ED}"
probe "analysis-department" GET "/api/mobile/${FID}/smart-bi/analysis/department?startDate=${SD}&endDate=${ED}"
# drilldown is POST — probe with minimal body
probe "analysis-drilldown-post" POST "/api/mobile/${FID}/smart-bi/drill-down" '-H "Content-Type: application/json" -d {"metricCode":"GROSS_PROFIT","startDate":"2026-04-01","endDate":"2026-05-01"}'

# === Phase 2A list (4) ===
probe "query-templates-list" GET "/api/mobile/${FID}/smart-bi/query-templates"
probe "datasource-list" GET "/api/mobile/${FID}/smart-bi/datasource/list"
probe "alerts" GET "/api/mobile/${FID}/smart-bi/alerts"
probe "recommendations" GET "/api/mobile/${FID}/smart-bi/recommendations"

# === Phase 2B (2) ===
probe "analysis-production" GET "/api/mobile/${FID}/smart-bi/analysis/production?startDate=${SD}&endDate=${ED}"
probe "analysis-quality" GET "/api/mobile/${FID}/smart-bi/analysis/quality?startDate=${SD}&endDate=${ED}"

# === 2C Tier 1 config_thresholds (GET only — no mutate on prod) ===
probe "config-thresholds-list" GET "/api/mobile/smartbi-config/thresholds"

# === 2C Tier 2 dashboard (2) ===
probe "dashboard-executive" GET "/api/mobile/${FID}/smart-bi/dashboard/executive?startDate=${SD}&endDate=${ED}"
probe "dashboard" GET "/api/mobile/${FID}/smart-bi/dashboard?startDate=${SD}&endDate=${ED}"
probe "dashboard-data-date-range" GET "/api/mobile/${FID}/smart-bi/data-date-range"

# === 2C Tier 3 datasource sub-routes (GET only; upload/apply are POST/mutate — skip) ===
# These need datasource_id — try without; expect 4xx not 5xx
probe "datasource-fields-missing-id" GET "/api/mobile/${FID}/smart-bi/datasource/0/fields"

# === 2C incentive_plan (GET; needs target_type/id) ===
probe "incentive-plan-missing-id" GET "/api/mobile/${FID}/smart-bi/incentive-plan/PERSON/0"

# === 2C query_templates_write — POST/PUT/DELETE mutate, SKIP on prod ===
# Document as DEFERRED for write-safe env

echo "DONE: results -> $OUTFILE"
