#!/bin/bash
# Comprehensive AI Endpoint Test Script

TOKEN=$(curl -s http://139.196.165.140:10010/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "FATAL: Could not get auth token"
  exit 1
fi

BASE="http://139.196.165.140:10010/api/mobile"
AUTH="Authorization: Bearer $TOKEN"
PASS=0
FAIL=0
PARTIAL=0

test_endpoint() {
  local name="$1"
  local method="$2"
  local url="$3"
  local data="$4"
  local timeout="${5:-15}"

  if [ "$method" = "POST" ]; then
    R=$(curl -s -w "\nHTTPCODE:%{http_code}" "$url" -H "$AUTH" -H "Content-Type: application/json" -d "$data" --max-time "$timeout" 2>/dev/null)
  else
    R=$(curl -s -w "\nHTTPCODE:%{http_code}" "$url" -H "$AUTH" --max-time "$timeout" 2>/dev/null)
  fi

  CODE=$(echo "$R" | grep "HTTPCODE:" | sed 's/HTTPCODE://')
  BODY=$(echo "$R" | grep -v "HTTPCODE:")

  SUCCESS=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success','unknown'))" 2>/dev/null)
  MSG=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message','')[:100])" 2>/dev/null)

  if [ "$CODE" = "200" ] && [ "$SUCCESS" = "True" ]; then
    echo "PASS | $name | HTTP $CODE | $MSG"
    PASS=$((PASS+1))
  elif [ "$CODE" = "200" ]; then
    echo "PARTIAL | $name | HTTP $CODE | success=$SUCCESS | $MSG"
    PARTIAL=$((PARTIAL+1))
  else
    echo "FAIL | $name | HTTP $CODE | $MSG"
    if [ ${#BODY} -lt 300 ]; then
      echo "  Body: $BODY"
    else
      echo "  Body: ${BODY:0:300}..."
    fi
    FAIL=$((FAIL+1))
  fi
}

echo "============================================"
echo "AI ENDPOINT TEST - POST BUG-FIX VERIFICATION"
echo "============================================"
echo ""

# 1. AI Health (BUG-3 fix: port 8083)
test_endpoint "1. AI Health Check" GET "$BASE/ai/health"

# 2. Cost Analysis
test_endpoint "2. Cost Analysis" POST "$BASE/F001/ai/analysis/cost" '{"batchId":"BATCH-20260201-001","analysisType":"cost"}' 30

# 3. Quality Analysis
test_endpoint "3. Quality Analysis" POST "$BASE/F001/ai/analysis/quality" '{"batchId":"BATCH-20260201-001","analysisType":"quality"}' 30

# 4. AI Chat
test_endpoint "4. AI Chat" POST "$BASE/F001/ai/chat" '{"message":"summarize production"}' 30

# 5. Production Batches (BUG-1 fix: QUALIFIED enum)
test_endpoint "5. Production Batches" GET "$BASE/F001/production/batches?page=1&size=5"

# 6. Processing Batch Info (BUG-2 fix: parseBatchId)
test_endpoint "6. Processing Batch Info" GET "$BASE/F001/processing/batches/1"

# 7. Processing Stage Records
test_endpoint "7. Processing Stages" GET "$BASE/F001/processing/batches/1/stages"

# 8. Quality Inspections
test_endpoint "8. Quality Inspections" GET "$BASE/F001/quality/inspections?page=1&size=5"

# 9. Equipment Alerts
test_endpoint "9. Equipment Alerts" GET "$BASE/F001/equipment/alerts?page=1&size=5"

# 10. Reports - Anomalies
test_endpoint "10. Reports Anomalies" GET "$BASE/F001/reports/anomalies?page=0&size=5"

# 11. Reports - Dashboard Summary
test_endpoint "11. Dashboard Summary" GET "$BASE/F001/reports/dashboard/summary"

# 12. Reports - Dashboard Alerts (BUG-1 fix: QUALIFIED)
test_endpoint "12. Dashboard Alerts" GET "$BASE/F001/reports/dashboard/alerts"

# 13. AI Intent Analysis
test_endpoint "13. Intent Analysis" POST "$BASE/F001/ai/intent/analyze" '{"text":"check production report"}' 30

# 14. AI Report Generation
test_endpoint "14. Report Generation" POST "$BASE/F001/ai/report/generate" '{"reportType":"production_daily","startDate":"2026-02-01","endDate":"2026-02-08"}' 30

# 15. Scheduling Suggestions
test_endpoint "15. Scheduling" GET "$BASE/F001/scheduling/suggestions"

# 16. AI Quota Config
test_endpoint "16. AI Quota Config" GET "$BASE/F001/ai/quota/config"

# 17. SmartBI Uploads
test_endpoint "17. SmartBI Uploads" GET "$BASE/F001/smartbi/uploads"

# 18. Material Consumptions
test_endpoint "18. Material Consumptions" GET "$BASE/F001/materials/consumptions?page=1&size=5"

# 19. Factory Settings
test_endpoint "19. Factory Settings" GET "$BASE/F001/settings"

# 20. Conversations
test_endpoint "20. Conversations" GET "$BASE/F001/ai/conversations"

# 21. AI Intent Configs
test_endpoint "21. Intent Configs" GET "$BASE/F001/ai/intent/configs"

echo ""
echo "============================================"
echo "RESULTS: $PASS PASS | $PARTIAL PARTIAL | $FAIL FAIL"
echo "Total: $((PASS+PARTIAL+FAIL)) endpoints tested"
echo "============================================"
