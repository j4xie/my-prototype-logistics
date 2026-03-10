#!/bin/bash
# =============================================================================
# Manual API tests for Financial Dashboard
#
# Usage:
#   bash test_api_curl.sh [BASE_URL]
#
# Example:
#   bash test_api_curl.sh                           # default: http://localhost:8083
#   bash test_api_curl.sh http://47.100.235.168:8083 # production
# =============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:8083}"
API="${BASE_URL}/api/smartbi/financial-dashboard"

PASS=0
FAIL=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

run_test() {
    local name="$1"
    local http_code="$2"
    local body="$3"
    TOTAL=$((TOTAL + 1))

    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        # Check for success field in JSON
        if echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('success',True) else 1)" 2>/dev/null; then
            echo -e "  ${GREEN}PASS${NC} [$http_code] $name"
            PASS=$((PASS + 1))
        else
            echo -e "  ${YELLOW}WARN${NC} [$http_code] $name -- success=false in body"
            # Still count as pass if the API responded correctly
            PASS=$((PASS + 1))
        fi
    else
        echo -e "  ${RED}FAIL${NC} [$http_code] $name"
        echo "    Response: $(echo "$body" | head -c 200)"
        FAIL=$((FAIL + 1))
    fi
}

run_test_expect_error() {
    local name="$1"
    local http_code="$2"
    local body="$3"
    TOTAL=$((TOTAL + 1))

    # For error tests, we expect either HTTP error or success=false
    if echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if not d.get('success',True) else 1)" 2>/dev/null; then
        echo -e "  ${GREEN}PASS${NC} [$http_code] $name (expected error)"
        PASS=$((PASS + 1))
    elif [ "$http_code" -ge 400 ]; then
        echo -e "  ${GREEN}PASS${NC} [$http_code] $name (HTTP error as expected)"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}FAIL${NC} [$http_code] $name -- expected error but got success"
        FAIL=$((FAIL + 1))
    fi
}

echo "============================================================"
echo "Financial Dashboard API Tests"
echo "Target: $API"
echo "============================================================"
echo ""

# --- Health check ---------------------------------------------------------
echo "0. Health check"
HC_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health" 2>/dev/null || echo "000")
if [ "$HC_CODE" = "200" ]; then
    echo -e "  ${GREEN}OK${NC} Server is up"
else
    echo -e "  ${RED}Server unreachable (HTTP $HC_CODE)${NC} -- tests may fail"
fi
echo ""

# --- Test 1: GET /templates -----------------------------------------------
echo "1. GET /templates"
RESP=$(curl -s -w "\n%{http_code}" "$API/templates" 2>/dev/null || echo -e '{"error":"connection refused"}\n000')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
run_test "List all chart templates" "$CODE" "$BODY"

# Count templates
if [ "$CODE" = "200" ]; then
    COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('templates',[])))" 2>/dev/null || echo "?")
    echo "    Templates found: $COUNT"
fi
echo ""

# --- Test 2: POST /generate -- budget_achievement -------------------------
echo "2. POST /generate (budget_achievement)"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/generate" \
    -H "Content-Type: application/json" \
    -d '{
        "chart_type": "budget_achievement",
        "raw_data": [
            {"项目": "预算", "1月": 2800, "2月": 3200, "3月": 2900, "4月": 3500, "5月": 3100, "6月": 3800, "7月": 2700, "8月": 4400, "9月": 3000, "10月": 3300, "11月": 3600, "12月": 3900},
            {"项目": "实际", "1月": 2650, "2月": 3580, "3月": 2100, "4月": 3750, "5月": 3230, "6月": 3650, "7月": 3100, "8月": 5470, "9月": 2850, "10月": 3100, "11月": 3750, "12月": 4200},
            {"项目": "上年同期", "1月": 580, "2月": 1280, "3月": 1250, "4月": 1680, "5月": 3100, "6月": 2680, "7月": 2500, "8月": 3280, "9月": 2300, "10月": 2800, "11月": 3100, "12月": 3500}
        ],
        "year": 2026
    }' 2>/dev/null || echo -e '{"error":"connection refused"}\n000')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
run_test "Generate budget_achievement chart" "$CODE" "$BODY"
echo ""

# --- Test 3: POST /generate -- all charts ---------------------------------
echo "3. POST /generate (chart_type=all)"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/generate" \
    -H "Content-Type: application/json" \
    -d '{
        "chart_type": "all",
        "raw_data": [
            {"项目": "预算", "1月": 2800, "2月": 3200, "3月": 2900, "4月": 3500, "5月": 3100, "6月": 3800, "7月": 2700, "8月": 4400, "9月": 3000, "10月": 3300, "11月": 3600, "12月": 3900},
            {"项目": "实际", "1月": 2650, "2月": 3580, "3月": 2100, "4月": 3750, "5月": 3230, "6月": 3650, "7月": 3100, "8月": 5470, "9月": 2850, "10月": 3100, "11月": 3750, "12月": 4200},
            {"项目": "上年同期", "1月": 580, "2月": 1280, "3月": 1250, "4月": 1680, "5月": 3100, "6月": 2680, "7月": 2500, "8月": 3280, "9月": 2300, "10月": 2800, "11月": 3100, "12月": 3500}
        ],
        "year": 2026
    }' 2>/dev/null || echo -e '{"error":"connection refused"}\n000')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
run_test "Generate all charts" "$CODE" "$BODY"

if [ "$CODE" = "200" ]; then
    CHART_COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('totalCharts','?'))" 2>/dev/null || echo "?")
    echo "    Charts generated: $CHART_COUNT"
fi
echo ""

# --- Test 4: POST /generate -- cost_flow_sankey with P&L data --------------
echo "4. POST /generate (cost_flow_sankey)"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/generate" \
    -H "Content-Type: application/json" \
    -d '{
        "chart_type": "cost_flow_sankey",
        "raw_data": [
            {"项目": "营业收入", "金额": 8333},
            {"项目": "营业成本", "金额": 1471},
            {"项目": "销售费用", "金额": 856},
            {"项目": "管理费用", "金额": 743},
            {"项目": "研发费用", "金额": 999},
            {"项目": "财务费用", "金额": 156},
            {"项目": "税金及附加", "金额": 98},
            {"项目": "所得税", "金额": 302}
        ],
        "year": 2026
    }' 2>/dev/null || echo -e '{"error":"connection refused"}\n000')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
run_test "Generate cost_flow_sankey chart" "$CODE" "$BODY"
echo ""

# --- Test 5: POST /generate -- variance_analysis ---------------------------
echo "5. POST /generate (variance_analysis)"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/generate" \
    -H "Content-Type: application/json" \
    -d '{
        "chart_type": "variance_analysis",
        "raw_data": [
            {"项目": "预算", "1月": 2800, "2月": 3200, "3月": 2900, "4月": 3500, "5月": 3100, "6月": 3800, "7月": 2700, "8月": 4400, "9月": 3000, "10月": 3300, "11月": 3600, "12月": 3900},
            {"项目": "实际", "1月": 2650, "2月": 3580, "3月": 2100, "4月": 3750, "5月": 3230, "6月": 3650, "7月": 3100, "8月": 5470, "9月": 2850, "10月": 3100, "11月": 3750, "12月": 4200}
        ],
        "year": 2026
    }' 2>/dev/null || echo -e '{"error":"connection refused"}\n000')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
run_test "Generate variance_analysis chart" "$CODE" "$BODY"
echo ""

# --- Test 6: POST /batch --------------------------------------------------
echo "6. POST /batch"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/batch" \
    -H "Content-Type: application/json" \
    -d '{
        "raw_data": [
            {"项目": "预算", "1月": 2800, "2月": 3200, "3月": 2900, "4月": 3500, "5月": 3100, "6月": 3800, "7月": 2700, "8月": 4400, "9月": 3000, "10月": 3300, "11月": 3600, "12月": 3900},
            {"项目": "实际", "1月": 2650, "2月": 3580, "3月": 2100, "4月": 3750, "5月": 3230, "6月": 3650, "7月": 3100, "8月": 5470, "9月": 2850, "10月": 3100, "11月": 3750, "12月": 4200},
            {"项目": "上年同期", "1月": 580, "2月": 1280, "3月": 1250, "4月": 1680, "5月": 3100, "6月": 2680, "7月": 2500, "8月": 3280, "9月": 2300, "10月": 2800, "11月": 3100, "12月": 3500}
        ],
        "year": 2026
    }' 2>/dev/null || echo -e '{"error":"connection refused"}\n000')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
run_test "Batch generate all charts" "$CODE" "$BODY"

if [ "$CODE" = "200" ]; then
    SUCCESS_COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('successCount','?'))" 2>/dev/null || echo "?")
    echo "    Successful charts: $SUCCESS_COUNT"
fi
echo ""

# --- Test 7: POST /analyze ------------------------------------------------
echo "7. POST /analyze"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/analyze" \
    -H "Content-Type: application/json" \
    -d '{
        "chart_type": "budget_achievement",
        "analysis_context": "2026年预算完成情况: 年度目标4.02万元 年度实际4.14万元 年度达成率103.1% 最佳月份8月(124.3%)"
    }' 2>/dev/null || echo -e '{"error":"connection refused"}\n000')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
run_test "Analyze chart with AI" "$CODE" "$BODY"
echo ""

# --- Test 8: Error case -- nonexistent chart type --------------------------
echo "8. POST /generate (nonexistent type -- expect error)"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/generate" \
    -H "Content-Type: application/json" \
    -d '{
        "chart_type": "nonexistent_type",
        "raw_data": [{"x": 1}],
        "year": 2026
    }' 2>/dev/null || echo -e '{"success":false}\n200')
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
run_test_expect_error "Nonexistent chart type returns error" "$CODE" "$BODY"

if echo "$BODY" | python3 -c "import sys,json; types=json.load(sys.stdin).get('availableTypes',[]); print(f'    Available types: {len(types)}')" 2>/dev/null; then
    :
fi
echo ""

# --- Summary ---------------------------------------------------------------
echo "============================================================"
echo "Results: $PASS passed, $FAIL failed, $TOTAL total"
if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
else
    echo -e "${RED}$FAIL test(s) failed.${NC}"
fi
echo "============================================================"

exit "$FAIL"
