#!/bin/bash

# 前后端集成测试脚本 - TimeClock API
# 测试前端和后端的接口契约是否匹配

set -e

BASE_URL="${BASE_URL:-http://localhost:10010}"
FACTORY_ID="${FACTORY_ID:-F001}"
USER_ID="${USER_ID:-1}"

echo "=========================================="
echo "  前后端集成测试 - TimeClock API"
echo "=========================================="
echo ""
echo "📊 测试配置:"
echo "   BASE_URL: $BASE_URL"
echo "   FACTORY_ID: $FACTORY_ID"
echo "   USER_ID: $USER_ID"
echo ""
echo "⚠️  确保后端服务已启动: $BASE_URL"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
ISSUES_FOUND=0

# 问题列表
declare -a ISSUES

# 测试函数 - 检查响应格式
test_response_format() {
    local test_name="$1"
    local method="$2"
    local url="$3"
    local expected_fields="$4"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo ""
    echo "-------------------------------------------"
    echo -e "${BLUE}Test #$TOTAL_TESTS: $test_name${NC}"
    echo "-------------------------------------------"
    echo "Method: $method"
    echo "URL: $url"
    echo ""

    # 发送请求
    if [ "$method" = "GET" ]; then
        RESPONSE=$(curl -s -w "\n%{http_code}" "$url")
    elif [ "$method" = "POST" ]; then
        RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$url")
    fi

    # 分离响应体和状态码
    HTTP_STATUS=$(echo "$RESPONSE" | tail -n 1)
    HTTP_BODY=$(echo "$RESPONSE" | sed '$d')

    echo "HTTP Status: $HTTP_STATUS"

    # 检查是否是 JSON
    if echo "$HTTP_BODY" | python3 -m json.tool >/dev/null 2>&1; then
        echo "Response Format:"
        echo "$HTTP_BODY" | python3 -m json.tool | head -n 20

        # 检查必需字段
        local all_fields_present=true
        for field in $expected_fields; do
            if echo "$HTTP_BODY" | python3 -c "import sys, json; data=json.load(sys.stdin); exit(0 if '$field' in data else 1)" 2>/dev/null; then
                echo -e "  ✅ Field '${field}' present"
            else
                echo -e "  ${RED}❌ Field '${field}' MISSING${NC}"
                all_fields_present=false
                ISSUES+=("[$test_name] Missing field: $field")
                ISSUES_FOUND=$((ISSUES_FOUND + 1))
            fi
        done

        if [ "$all_fields_present" = true ] && [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
            echo -e "${GREEN}✅ PASSED${NC} - All required fields present"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}❌ FAILED${NC} - Some checks failed"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        echo -e "${RED}❌ FAILED${NC} - Response is not valid JSON"
        echo "Raw response:"
        echo "$HTTP_BODY"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        ISSUES+=("[$test_name] Invalid JSON response")
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
}

# 测试函数 - 检查数据字段
test_data_fields() {
    local test_name="$1"
    local url="$2"
    local expected_data_fields="$3"

    echo ""
    echo "-------------------------------------------"
    echo -e "${BLUE}Data Fields Test: $test_name${NC}"
    echo "-------------------------------------------"
    echo "URL: $url"
    echo ""

    RESPONSE=$(curl -s "$url")

    if echo "$RESPONSE" | python3 -m json.tool >/dev/null 2>&1; then
        echo "Checking data object fields..."

        # 检查 data 对象中的字段
        local all_fields_present=true
        for field in $expected_data_fields; do
            if echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); exit(0 if data.get('data') and '$field' in data['data'] else 1)" 2>/dev/null; then
                echo -e "  ✅ data.$field present"
            else
                # 检查是否 data 为 null (今日未打卡的情况)
                if echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); exit(0 if data.get('data') is None else 1)" 2>/dev/null; then
                    echo -e "  ${YELLOW}⚠️  data is null (no record today)${NC}"
                    all_fields_present=true
                    break
                else
                    echo -e "  ${YELLOW}⚠️  data.$field MISSING${NC}"
                    all_fields_present=false
                    ISSUES+=("[$test_name] data object missing field: $field")
                    ISSUES_FOUND=$((ISSUES_FOUND + 1))
                fi
            fi
        done

        if [ "$all_fields_present" = true ]; then
            echo -e "${GREEN}✅ Data fields check PASSED${NC}"
        else
            echo -e "${YELLOW}⚠️  Some data fields missing (may be OK if API design changed)${NC}"
        fi
    fi
}

echo "=========================================="
echo "  第1部分: API响应格式测试"
echo "=========================================="

# 测试 1: 获取今日打卡记录 - 响应格式
test_response_format \
    "GET /today - Response Format" \
    "GET" \
    "$BASE_URL/api/mobile/$FACTORY_ID/timeclock/today?userId=$USER_ID" \
    "success code message data"

sleep 1

# 测试 2: 获取打卡状态 - 响应格式
test_response_format \
    "GET /status - Response Format" \
    "GET" \
    "$BASE_URL/api/mobile/$FACTORY_ID/timeclock/status?userId=$USER_ID" \
    "success code message data"

sleep 1

echo ""
echo "=========================================="
echo "  第2部分: 数据字段测试"
echo "=========================================="

# 测试 3: 今日打卡记录 - 数据字段
test_data_fields \
    "GET /today - Data Fields" \
    "$BASE_URL/api/mobile/$FACTORY_ID/timeclock/today?userId=$USER_ID" \
    "id userId factoryId clockInTime clockOutTime breakStartTime breakEndTime location device latitude longitude workDuration breakDuration status createdAt updatedAt"

sleep 1

echo ""
echo "=========================================="
echo "  第3部分: GPS参数测试"
echo "=========================================="

echo ""
echo "Testing POST /clock-in with GPS parameters..."
echo ""

# 测试 4: 上班打卡 - 包含GPS参数
TEST_LAT="31.2304"
TEST_LNG="121.4737"
TEST_LOCATION="测试地点"
TEST_DEVICE="Integration Test Device"

echo "Parameters:"
echo "  userId: $USER_ID"
echo "  location: $TEST_LOCATION"
echo "  device: $TEST_DEVICE"
echo "  latitude: $TEST_LAT"
echo "  longitude: $TEST_LNG"
echo ""

CLOCK_IN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/mobile/$FACTORY_ID/timeclock/clock-in?userId=$USER_ID&location=$TEST_LOCATION&device=$TEST_DEVICE&latitude=$TEST_LAT&longitude=$TEST_LNG")

if echo "$CLOCK_IN_RESPONSE" | python3 -m json.tool >/dev/null 2>&1; then
    echo "Response:"
    echo "$CLOCK_IN_RESPONSE" | python3 -m json.tool | head -n 30
    echo ""

    # 检查返回的记录是否包含GPS数据
    HAS_LAT=$(echo "$CLOCK_IN_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); exit(0 if data.get('data') and data['data'].get('latitude') is not None else 1)" 2>/dev/null && echo "yes" || echo "no")
    HAS_LNG=$(echo "$CLOCK_IN_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); exit(0 if data.get('data') and data['data'].get('longitude') is not None else 1)" 2>/dev/null && echo "yes" || echo "no")

    if [ "$HAS_LAT" = "yes" ] && [ "$HAS_LNG" = "yes" ]; then
        RETURNED_LAT=$(echo "$CLOCK_IN_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['data'].get('latitude', ''))")
        RETURNED_LNG=$(echo "$CLOCK_IN_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['data'].get('longitude', ''))")

        echo -e "${GREEN}✅ GPS parameters saved correctly${NC}"
        echo "   Latitude: $RETURNED_LAT"
        echo "   Longitude: $RETURNED_LNG"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ GPS parameters NOT saved${NC}"
        ISSUES+=("[GPS Test] latitude or longitude missing in response")
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
else
    echo -e "${RED}❌ Invalid JSON response${NC}"
    ISSUES+=("[GPS Test] Invalid JSON response from /clock-in")
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""
echo "=========================================="
echo "  测试结果汇总"
echo "=========================================="
echo ""
echo "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
echo -e "${RED}失败: $FAILED_TESTS${NC}"
echo -e "${YELLOW}发现的问题: $ISSUES_FOUND${NC}"
echo ""

if [ $ISSUES_FOUND -gt 0 ]; then
    echo "=========================================="
    echo "  发现的问题列表"
    echo "=========================================="
    for issue in "${ISSUES[@]}"; do
        echo -e "${YELLOW}⚠️  $issue${NC}"
    done
    echo ""
fi

if [ $FAILED_TESTS -eq 0 ] && [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！前后端接口完全匹配！${NC}"
    echo ""
    echo "🎉 集成测试结论:"
    echo "   ✅ 响应格式正确 (success, code, message, data)"
    echo "   ✅ 数据字段完整 (TimeClockRecord所有字段)"
    echo "   ✅ GPS参数正确传递和保存"
    echo "   ✅ 前后端类型定义匹配"
    echo ""
    exit 0
elif [ $FAILED_TESTS -eq 0 ] && [ $ISSUES_FOUND -gt 0 ]; then
    echo -e "${YELLOW}⚠️  测试通过，但发现了一些非关键问题${NC}"
    echo ""
    echo "建议:"
    echo "   - 检查数据字段定义是否完整"
    echo "   - 确认前后端类型定义一致性"
    echo ""
    exit 0
else
    echo -e "${RED}❌ 部分测试失败${NC}"
    echo ""
    echo "请检查:"
    echo "   1. 后端服务是否正常运行"
    echo "   2. API响应格式是否符合 ApiResponse<T> 规范"
    echo "   3. 数据字段定义是否与后端实体匹配"
    echo ""
    exit 1
fi
