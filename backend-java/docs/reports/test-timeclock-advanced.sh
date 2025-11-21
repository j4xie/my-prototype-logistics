#!/bin/bash

# TimeClock Advanced E2E Test
# Verifies Statistics, Department View, Edit Record, and Export

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:10010}"
FACTORY_ID="${FACTORY_ID:-F001}"
USER_ID="${USER_ID:-1}"
TODAY=$(date +%Y-%m-%d)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper function to extract JSON field
get_json_field() {
    echo "$1" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('$2', ''))" 2>/dev/null
}

# Helper function to extract data field from ApiResponse
get_data_field() {
    echo "$1" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('$2', ''))" 2>/dev/null
}

# Test function
test_api() {
    local test_num="$1"
    local test_name="$2"
    local method="$3"
    local url="$4"
    local body="$5"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo ""
    echo "-------------------------------------------"
    echo -e "${BLUE}Test #$test_num: $test_name${NC}"
    echo "-------------------------------------------"
    echo "Method: $method"
    echo "URL: $url"
    if [ ! -z "$body" ]; then
        echo "Body: $body"
    fi
    echo ""

    # Send request
    if [ "$method" = "GET" ]; then
        RESPONSE=$(curl -s -w "\n%{http_code}" "$url")
    elif [ "$method" = "POST" ]; then
        RESPONSE=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -d "$body" "$url")
    elif [ "$method" = "PUT" ]; then
        RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT -H "Content-Type: application/json" -d "$body" "$url")
    fi

    # Split response body and status code
    HTTP_STATUS=$(echo "$RESPONSE" | tail -n 1)
    HTTP_BODY=$(echo "$RESPONSE" | sed '$d')

    echo "HTTP Status: $HTTP_STATUS"
    
    # Check if valid JSON
    if echo "$HTTP_BODY" | python3 -m json.tool >/dev/null 2>&1; then
        echo "Response (truncated):"
        echo "$HTTP_BODY" | python3 -m json.tool | head -n 20
        
        SUCCESS=$(get_json_field "$HTTP_BODY" "success")
        
        if [ "$HTTP_STATUS" = "200" ] && [ "$SUCCESS" = "True" ]; then
            echo -e "${GREEN}✅ PASSED${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            return 0
        else
            echo -e "${RED}❌ FAILED${NC} - HTTP $HTTP_STATUS or success=false"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
    else
        echo -e "${RED}❌ FAILED${NC} - Invalid JSON response"
        echo "Raw response: $HTTP_BODY"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

echo "=========================================="
echo "  TimeClock Advanced Verification"
echo "=========================================="
echo ""

# 1. Clock In to ensure we have a record for today
echo "Preparing: Clocking in..."
curl -s -X POST "$BASE_URL/api/mobile/$FACTORY_ID/timeclock/clock-in?userId=$USER_ID&location=Test&device=Test&latitude=0&longitude=0" > /dev/null
sleep 1

# 2. Get Today's Record to extract ID
echo "Preparing: Getting record ID..."
RESP=$(curl -s "$BASE_URL/api/mobile/$FACTORY_ID/timeclock/today?userId=$USER_ID")
RECORD_ID=$(echo "$RESP" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "Record ID: $RECORD_ID"

if [ -z "$RECORD_ID" ] || [ "$RECORD_ID" = "None" ]; then
    echo -e "${RED}❌ Failed to get record ID. Cannot proceed.${NC}"
    exit 1
fi

# Test 1: Get Attendance Statistics
test_api \
    "1" \
    "Get Attendance Statistics" \
    "GET" \
    "$BASE_URL/api/mobile/$FACTORY_ID/timeclock/statistics?userId=$USER_ID&startDate=$TODAY&endDate=$TODAY"

# Test 2: Get Department Attendance
test_api \
    "2" \
    "Get Department Attendance" \
    "GET" \
    "$BASE_URL/api/mobile/$FACTORY_ID/timeclock/department?date=$TODAY"

# Test 3: Edit Clock Record (Update status to 'working')
test_api \
    "3" \
    "Edit Clock Record" \
    "PUT" \
    "$BASE_URL/api/mobile/$FACTORY_ID/timeclock/records/$RECORD_ID" \
    '{"status": "working_edited"}'

# Test 4: Export Records
test_api \
    "4" \
    "Export Attendance Records" \
    "GET" \
    "$BASE_URL/api/mobile/$FACTORY_ID/timeclock/export?userId=$USER_ID&startDate=$TODAY&endDate=$TODAY"

echo ""
echo "=========================================="
echo "  Test Results Summary"
echo "=========================================="
echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All advanced tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
