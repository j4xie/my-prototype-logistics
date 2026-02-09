#!/bin/bash
# AI Endpoint Test v2 - Correct paths from controller source

TOKEN=$(curl -s http://139.196.165.140:10010/api/mobile/auth/unified-login \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "FATAL: Could not get auth token"
  exit 1
fi
echo "Token obtained (${#TOKEN} chars)"

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
    EXTRA=$(echo "$BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data=d.get('data')
if isinstance(data,list): print(f'count={len(data)}')
elif isinstance(data,dict):
  if 'totalElements' in data: print(f'total={data[\"totalElements\"]}')
  elif 'content' in data and isinstance(data['content'],list): print(f'items={len(data[\"content\"])}')
  else: print(f'keys={list(data.keys())[:5]}')
else: print(type(data).__name__)
" 2>/dev/null)
    echo "PASS | $name | HTTP $CODE | $EXTRA"
    PASS=$((PASS+1))
  elif [ "$CODE" = "200" ]; then
    echo "PARTIAL | $name | HTTP $CODE | success=$SUCCESS | $MSG"
    PARTIAL=$((PARTIAL+1))
  else
    echo "FAIL | $name | HTTP $CODE | $MSG"
    echo "  Body: ${BODY:0:200}"
    FAIL=$((FAIL+1))
  fi
}

echo ""
echo "============================================"
echo "AI ENDPOINT TEST v2 - CORRECT PATHS"
echo "============================================"
echo ""

# === CORE AI ENDPOINTS (AIController: /api/mobile/{factoryId}/ai) ===

# 1. AI Health
test_endpoint "1. AI Health" GET "$BASE/F001/ai/health"

# 2. AI Cost Analysis (correct: /analysis/cost/batch)
test_endpoint "2. Cost Analysis" POST "$BASE/F001/ai/analysis/cost/batch" '{"batchNumber":"BATCH-20260201-001"}' 30

# 3. AI Chat (POST /chat or /conversations)
test_endpoint "3. AI Chat" POST "$BASE/F001/ai/chat" '{"message":"summarize today production","sessionId":"test-session"}' 30

# 4. AI Report Generation (correct: /reports/generate)
test_endpoint "4. AI Report Gen" POST "$BASE/F001/ai/reports/generate" '{"reportType":"production_daily","startDate":"2026-02-01","endDate":"2026-02-08"}' 30

# 5. AI Conversations List
test_endpoint "5. Conversations" GET "$BASE/F001/ai/conversations"

# === PROCESSING (ProcessingController: /api/mobile/{factoryId}/processing) ===

# 6. Processing Batches List
test_endpoint "6. Processing Batches" GET "$BASE/F001/processing/batches?page=0&size=5"

# 7. Processing Batch Detail
test_endpoint "7. Batch Detail" GET "$BASE/F001/processing/batches/1"

# 8. Processing Stages
test_endpoint "8. Batch Stages" GET "$BASE/F001/processing/batches/1/stages"

# === MATERIAL CONSUMPTIONS ===

# 9. Material Consumptions (correct: /processing/material-consumptions)
test_endpoint "9. Material Consumptions" GET "$BASE/F001/processing/material-consumptions?page=0&size=5"

# === EQUIPMENT ALERTS (correct: /equipment-alerts) ===

# 10. Equipment Alerts
test_endpoint "10. Equipment Alerts" GET "$BASE/F001/equipment-alerts?page=0&size=5"

# === REPORTS ===

# 11. Reports Anomalies
test_endpoint "11. Report Anomalies" GET "$BASE/F001/reports/anomalies?page=0&size=5"

# 12. Reports Dashboard Overview (correct: /dashboard/overview)
test_endpoint "12. Dashboard Overview" GET "$BASE/F001/reports/dashboard/overview"

# 13. Reports Dashboard Alerts
test_endpoint "13. Dashboard Alerts" GET "$BASE/F001/reports/dashboard/alerts"

# === MOBILE DASHBOARD ===

# 14. Mobile Dashboard (correct: /dashboard/{factoryId})
test_endpoint "14. Mobile Dashboard" GET "$BASE/dashboard/F001"

# === AI INTENT ===

# 15. Intent Analysis Statistics (correct: /intent-analysis/statistics)
test_endpoint "15. Intent Statistics" GET "$BASE/F001/intent-analysis/statistics"

# === AI QUOTA CONFIGS (correct: /ai-quota-configs) ===

# 16. AI Quota Configs
test_endpoint "16. AI Quota Configs" GET "$BASE/F001/ai-quota-configs"

# === SMARTBI (correct: /smart-bi) ===

# 17. SmartBI - Get uploads
test_endpoint "17. SmartBI Uploads" GET "$BASE/F001/smart-bi/uploads"

# === AI INTENT CONFIGS (correct: /ai-intents) ===

# 18. AI Intent Configs
test_endpoint "18. AI Intent Configs" GET "$BASE/F001/ai-intents"

# === SCHEDULING (correct: /scheduling) ===

# 19. Scheduling Pending Batches
test_endpoint "19. Sched Pending" GET "$BASE/F001/scheduling/pending-batches"

# 20. Scheduling Workers Recommend
test_endpoint "20. Sched Recommend" POST "$BASE/F001/scheduling/workers/recommend" '{"batchId":1,"requiredSkills":["cutting"]}' 15

# === FACTORY SETTINGS ===

# 21. Factory Settings
test_endpoint "21. Factory Settings" GET "$BASE/F001/settings"

# === QUALITY ===

# 22. Quality - Try common paths
test_endpoint "22a. Quality Inspections" GET "$BASE/F001/quality/inspections?page=0&size=5"
test_endpoint "22b. Quality Checks" GET "$BASE/F001/quality-checks?page=0&size=5"
test_endpoint "22c. Quality Items" GET "$BASE/F001/quality/check-items?page=0&size=5"

echo ""
echo "============================================"
echo "RESULTS: $PASS PASS | $PARTIAL PARTIAL | $FAIL FAIL"
echo "Total: $((PASS+PARTIAL+FAIL)) endpoints tested"
echo "============================================"
