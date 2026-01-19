#!/bin/bash

# ============================================================
# AI Intent API Test Runner
# 直接通过 API 测试意图识别和参数提取功能
# 无需本地数据库，直接调用服务器 API
# ============================================================

set -e

# Configuration
SERVER_URL="http://139.196.165.140:10010"
USERNAME="factory_admin1"
PASSWORD="123456"
FACTORY_ID="F001"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Results array
declare -a TEST_RESULTS

# ============================================================
# Helper Functions
# ============================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Get auth token
get_token() {
    log_info "获取认证 Token..."

    local response=$(curl -s -X POST "${SERVER_URL}/api/mobile/auth/unified-login" \
        -H "Content-Type: application/json" \
        -d "{\"username\": \"${USERNAME}\", \"password\": \"${PASSWORD}\"}")

    # Extract token
    TOKEN=$(echo "$response" | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"//')

    if [ -z "$TOKEN" ]; then
        echo "Failed to get token. Response: $response"
        exit 1
    fi

    log_success "Token 获取成功"
}

# Execute intent API call
execute_intent() {
    local user_input="$1"
    local expected_intent="$2"

    local response=$(curl -s -X POST "${SERVER_URL}/api/mobile/${FACTORY_ID}/ai-intents/execute" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d "{\"userInput\": \"${user_input}\"}")

    echo "$response"
}

# Test a single intent
run_test() {
    local test_id="$1"
    local description="$2"
    local user_input="$3"
    local expected_intent="$4"
    local expected_status="$5"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "测试 ${test_id}: ${description}"
    log_info "用户输入: ${user_input}"
    log_info "期望意图: ${expected_intent}"

    local response=$(execute_intent "$user_input" "$expected_intent")

    # Check if response contains expected intent
    local actual_intent=$(echo "$response" | grep -o '"intentCode":"[^"]*"' | head -1 | sed 's/"intentCode":"//;s/"//')
    local actual_status=$(echo "$response" | grep -o '"status":"[^"]*"' | head -1 | sed 's/"status":"//;s/"//')

    # Also check matchResult for intent
    if [ -z "$actual_intent" ]; then
        actual_intent=$(echo "$response" | grep -o '"matchedIntentCode":"[^"]*"' | head -1 | sed 's/"matchedIntentCode":"//;s/"//')
    fi

    local result="FAIL"
    local reason=""

    # Validate
    if [ "$actual_intent" = "$expected_intent" ]; then
        if [ -n "$expected_status" ] && [ "$actual_status" != "$expected_status" ]; then
            reason="状态不匹配: 期望 ${expected_status}, 实际 ${actual_status}"
        else
            result="PASS"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        fi
    else
        reason="意图不匹配: 期望 ${expected_intent}, 实际 ${actual_intent}"
    fi

    if [ "$result" = "PASS" ]; then
        log_success "测试通过 - 意图: ${actual_intent}, 状态: ${actual_status}"
    else
        log_fail "测试失败 - ${reason}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    # Store result
    TEST_RESULTS+=("${test_id}|${result}|${reason}")

    # Print response snippet
    echo "响应摘要: $(echo "$response" | head -c 300)..."
}

# Test parameter extraction rule learning
test_parameter_learning() {
    local test_id="$1"
    local description="$2"
    local intent_code="$3"
    local user_input="$4"
    local expected_param="$5"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "参数提取测试 ${test_id}: ${description}"
    log_info "用户输入: ${user_input}"

    # First call - should trigger LLM extraction
    log_info "第一次调用 (可能触发 LLM 提取)..."
    local response1=$(execute_intent "$user_input" "$intent_code")

    # Check for parameter extraction rules endpoint
    log_info "查询学习到的规则..."
    local rules=$(curl -s -X GET "${SERVER_URL}/api/mobile/${FACTORY_ID}/ai-intents/params/rules/${intent_code}" \
        -H "Authorization: Bearer ${TOKEN}")

    echo "学习规则: $(echo "$rules" | head -c 200)..."

    # Second call with different value - should use learned rules
    log_info "第二次调用 (应该使用学习规则)..."
    local response2=$(execute_intent "$user_input" "$intent_code")

    local result="PASS"
    local reason=""

    # Check if rule was learned (rules response contains data)
    if echo "$rules" | grep -q "patternType"; then
        log_success "规则学习成功"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        result="FAIL"
        reason="未检测到学习规则"
        log_fail "规则学习失败"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    TEST_RESULTS+=("${test_id}|${result}|${reason}")
}

# ============================================================
# Test Cases
# ============================================================

run_phase1_tests() {
    echo ""
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║        Phase 1: 基础意图识别测试                       ║"
    echo "╚════════════════════════════════════════════════════════╝"

    # Material batch queries
    run_test "TC-INTENT-001" "原料批次查询" \
        "查询所有带鱼原材料批次" \
        "MATERIAL_BATCH_QUERY" \
        "COMPLETED"

    run_test "TC-INTENT-002" "口语化原料查询" \
        "看看还剩多少虾仁" \
        "MATERIAL_BATCH_QUERY" \
        "COMPLETED"

    run_test "TC-INTENT-003" "库存查询" \
        "帮我查一下今天的库存情况" \
        "MATERIAL_BATCH_QUERY" \
        "COMPLETED"

    # Quality inspection
    run_test "TC-INTENT-004" "质检结果查询" \
        "查看批次B001的质检结果" \
        "QUALITY_INSPECTION_RESULT_QUERY" \
        "COMPLETED"

    run_test "TC-INTENT-005" "口语化质检查询" \
        "这批货检验过了吗" \
        "QUALITY_INSPECTION_RESULT_QUERY" \
        "COMPLETED"

    # Shipment
    run_test "TC-INTENT-006" "出货记录查询" \
        "查询今天的出货记录" \
        "SHIPMENT_RECORD_QUERY" \
        "COMPLETED"

    run_test "TC-INTENT-007" "口语化出货查询" \
        "今天发了多少货" \
        "SHIPMENT_RECORD_QUERY" \
        "COMPLETED"

    # Traceability
    run_test "TC-INTENT-008" "批次溯源查询" \
        "溯源批次BATCH-001的完整信息" \
        "BATCH_TRACE_QUERY" \
        "COMPLETED"

    run_test "TC-INTENT-009" "口语化溯源查询" \
        "这批货是从哪来的" \
        "BATCH_TRACE_QUERY" \
        "COMPLETED"

    # User management
    run_test "TC-INTENT-010" "用户创建" \
        "创建新用户,用户名testuser,姓名测试用户,角色为操作员" \
        "USER_CREATE" \
        ""

    run_test "TC-INTENT-011" "用户查询" \
        "查看所有操作员账号" \
        "USER_LIST_QUERY" \
        "COMPLETED"
}

run_phase2_tests() {
    echo ""
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║        Phase 2: 操作类意图测试                         ║"
    echo "╚════════════════════════════════════════════════════════╝"

    # Material operations
    run_test "TC-OP-001" "原料入库操作" \
        "新到一批带鱼500公斤" \
        "MATERIAL_BATCH_CREATE" \
        ""

    run_test "TC-OP-002" "原料使用操作" \
        "使用100公斤带鱼" \
        "MATERIAL_BATCH_USE" \
        ""

    # Quality inspection operations
    run_test "TC-OP-003" "执行质检" \
        "对批次B001执行质检" \
        "QUALITY_INSPECTION_EXECUTE" \
        ""

    # Shipment operations
    run_test "TC-OP-004" "创建出货记录" \
        "发货给客户A,100箱带鱼罐头" \
        "SHIPMENT_RECORD_CREATE" \
        ""
}

run_phase3_tests() {
    echo ""
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║        Phase 3: 参数提取规则学习测试                   ║"
    echo "╚════════════════════════════════════════════════════════╝"

    # Test parameter extraction learning for USER_CREATE
    test_parameter_learning "TC-PARAM-001" \
        "用户创建参数学习" \
        "USER_CREATE" \
        "创建新用户,用户名zhangsan123,姓名张三,角色为操作员" \
        "username"

    # Test with different input pattern
    test_parameter_learning "TC-PARAM-002" \
        "原料入库参数学习" \
        "MATERIAL_BATCH_CREATE" \
        "入库500公斤带鱼,批次号为BATCH-TEST-001" \
        "quantity"
}

# ============================================================
# Generate Report
# ============================================================

generate_report() {
    local report_file="reports/api-test-report-$(date +%Y%m%d_%H%M%S).md"
    mkdir -p reports

    cat > "$report_file" << EOF
# AI意图识别 API 测试报告

**测试时间**: $(date '+%Y-%m-%d %H:%M:%S')
**服务器**: ${SERVER_URL}
**测试账号**: ${USERNAME}

---

## 测试摘要

| 指标 | 数值 |
|------|------|
| 总测试数 | ${TOTAL_TESTS} |
| 通过数 | ${PASSED_TESTS} |
| 失败数 | ${FAILED_TESTS} |
| 通过率 | $(echo "scale=2; ${PASSED_TESTS} * 100 / ${TOTAL_TESTS}" | bc)% |

---

## 测试结果详情

EOF

    for result in "${TEST_RESULTS[@]}"; do
        IFS='|' read -r test_id status reason <<< "$result"
        if [ "$status" = "PASS" ]; then
            echo "### ✅ ${test_id}" >> "$report_file"
            echo "- **状态**: PASS" >> "$report_file"
        else
            echo "### ❌ ${test_id}" >> "$report_file"
            echo "- **状态**: FAIL" >> "$report_file"
            echo "- **原因**: ${reason}" >> "$report_file"
        fi
        echo "" >> "$report_file"
    done

    echo "---" >> "$report_file"
    echo "" >> "$report_file"
    echo "*报告生成完毕*" >> "$report_file"

    log_info "测试报告已生成: ${report_file}"
}

# ============================================================
# Main
# ============================================================

main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║        AI Intent Recognition API Test Suite            ║"
    echo "║        Phase 1-3 测试                                  ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo ""

    # Get auth token first
    get_token

    # Run all phases
    run_phase1_tests
    run_phase2_tests
    run_phase3_tests

    # Summary
    echo ""
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║                    测试摘要                            ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo ""
    echo "总测试数: ${TOTAL_TESTS}"
    echo "通过: ${PASSED_TESTS}"
    echo "失败: ${FAILED_TESTS}"
    echo "通过率: $(echo "scale=2; ${PASSED_TESTS} * 100 / ${TOTAL_TESTS}" | bc)%"
    echo ""

    # Generate report
    generate_report

    # Exit with appropriate code
    if [ ${FAILED_TESTS} -gt 0 ]; then
        exit 1
    fi
    exit 0
}

# Run main
main "$@"
