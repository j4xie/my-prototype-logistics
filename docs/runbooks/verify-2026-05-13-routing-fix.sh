#!/bin/bash
# Re-verify nginx routing fix from PR ops/nginx-smartbi-python-routing-fix
# Re-runnable smoke; no DB mutations (POST verifies use deliberately invalid bodies).
# Usage:
#   TOKEN=<f006_admin access token> bash verify-2026-05-13-routing-fix.sh
# To obtain token:
#   curl -s -X POST http://139.196.165.140:8086/api/mobile/auth/unified-login \
#     -H 'Content-Type: application/json' \
#     -d '{"username":"f006_admin","password":"123456","deviceInfo":{"deviceId":"verify","deviceModel":"curl","platform":"linux","osVersion":"linux"}}' \
#     | python -c 'import json,sys;print(json.load(sys.stdin)["data"]["accessToken"])'

set -u
TOKEN="${TOKEN:-$(cat /tmp/f006-token-r1fix.txt 2>/dev/null || echo MISSING)}"
[ "$TOKEN" = "MISSING" ] && { echo "Set TOKEN env var or place token at /tmp/f006-token-r1fix.txt"; exit 1; }
BASE="http://139.196.165.140:8086"
FID="F006"
pass=0; fail=0; total=0

check() {
  local label="$1" method="$2" path="$3" expectFamily="$4" extra="${5:-}"
  total=$((total+1))
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "${BASE}${path}" \
    -H "Authorization: Bearer $TOKEN" $extra)
  local verdict
  case "$expectFamily" in
    "200")
      if [ "$code" = "200" ]; then verdict="PASS"; pass=$((pass+1)); else verdict="FAIL"; fail=$((fail+1)); fi
      ;;
    "4xx-not-404")
      # Anything 4xx other than 404 means routing reached upstream (auth/validation worked).
      if [ "$code" != "404" ] && [ "${code:0:1}" = "4" ]; then verdict="PASS"; pass=$((pass+1));
      elif [ "$code" = "200" ]; then verdict="PASS"; pass=$((pass+1));
      else verdict="FAIL"; fail=$((fail+1)); fi
      ;;
  esac
  printf "%-40s  %-6s  %s\n" "$label" "$code" "$verdict"
}

echo "=== Routing-fix verification ($(date -Iseconds)) ==="
echo "Auth: f006_admin / Factory F006 / Base: $BASE"
echo
printf "%-40s  %-6s  %s\n" "endpoint" "http" "verdict"
printf "%-40s  %-6s  %s\n" "----------------------------------------" "------" "-------"

# GET endpoints — expect 200 Python envelope
check "GET /smart-bi/query-templates" GET "/api/mobile/${FID}/smart-bi/query-templates" "200"
check "GET /smart-bi/datasource/list"  GET "/api/mobile/${FID}/smart-bi/datasource/list" "200"
check "GET /smart-bi/alerts"           GET "/api/mobile/${FID}/smart-bi/alerts" "200"
check "GET /smart-bi/recommendations"  GET "/api/mobile/${FID}/smart-bi/recommendations" "200"
check "GET /smart-bi/data-date-range"  GET "/api/mobile/${FID}/smart-bi/data-date-range" "200"
check "GET /smart-bi/datasource/0/fields" GET "/api/mobile/${FID}/smart-bi/datasource/0/fields" "200"
check "GET /smart-bi/incentive-plan/PERSON/0" GET "/api/mobile/${FID}/smart-bi/incentive-plan/PERSON/0" "200"

# POST verifications — invalid bodies → expect 200/4xx (not 404)
check "POST /smart-bi/query-templates (empty)" POST "/api/mobile/${FID}/smart-bi/query-templates" "4xx-not-404" \
  "-H Content-Type:application/json -d {}"
check "POST /smart-bi/datasource/apply (empty)" POST "/api/mobile/${FID}/smart-bi/datasource/apply" "4xx-not-404" \
  "-H Content-Type:application/json -d {}"
check "POST /smart-bi/datasource/upload (no multipart)" POST "/api/mobile/${FID}/smart-bi/datasource/upload" "4xx-not-404"

echo
echo "Summary: $pass/$total PASS, $fail FAIL"
[ $fail -eq 0 ] || exit 1
