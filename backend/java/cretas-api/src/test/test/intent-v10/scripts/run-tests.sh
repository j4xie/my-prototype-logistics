#!/bin/bash

# v10.0 意图识别系统测试脚本
# 使用方法: ./run-tests.sh [category] [--parallel]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="$(dirname "$SCRIPT_DIR")"
CASES_DIR="$TEST_DIR/cases"
RESULTS_DIR="$TEST_DIR/results"

# API 配置
ENDPOINT_PUBLIC="http://139.196.165.140:10010/api/public/ai-demo/execute"
ENDPOINT_AUTH="http://139.196.165.140:10010/api/mobile/F001/ai/execute"
LOGIN_ENDPOINT="http://139.196.165.140:10010/api/mobile/auth/unified-login"
FACTORY_ID="F001"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 创建结果目录
mkdir -p "$RESULTS_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="$RESULTS_DIR/test_results_$TIMESTAMP.json"

# 初始化结果
echo '{"timestamp": "'$TIMESTAMP'", "results": [], "summary": {}}' > "$RESULT_FILE"

# 获取登录Token
get_token() {
    local username="$1"
    local password="$2"

    response=$(curl -s "$LOGIN_ENDPOINT" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$username\",\"password\":\"$password\"}")

    echo "$response" | jq -r '.data.accessToken // ""'
}

# 执行单个测试用例
run_test_case() {
    local id="$1"
    local input="$2"
    local expected_intent="$3"
    local token="$4"
    local min_confidence="${5:-0.5}"

    local endpoint="$ENDPOINT_PUBLIC"
    local auth_header=""

    if [[ -n "$token" ]]; then
        endpoint="$ENDPOINT_AUTH"
        auth_header="-H \"Authorization: Bearer $token\""
    fi

    # 执行API调用
    local response
    if [[ -n "$token" ]]; then
        response=$(curl -s "$endpoint" \
            -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d "{\"userInput\":\"$input\"}" \
            --max-time 30)
    else
        response=$(curl -s "$endpoint" \
            -X POST \
            -H "Content-Type: application/json" \
            -d "{\"userInput\":\"$input\"}" \
            --max-time 30)
    fi

    # 解析响应
    local success=$(echo "$response" | jq -r '.success // false')
    local actual_intent=$(echo "$response" | jq -r '.data.intentCode // .data.intent // "UNKNOWN"')
    local confidence=$(echo "$response" | jq -r '.data.confidence // 0')
    local need_clarification=$(echo "$response" | jq -r '.data.needClarification // false')
    local response_text=$(echo "$response" | jq -r '.data.response // .data.message // ""')

    # 判断测试结果
    local passed=false
    local reason=""

    if [[ "$success" != "true" ]]; then
        reason="API call failed"
    elif [[ "$expected_intent" == "NEED_CLARIFICATION" && "$need_clarification" == "true" ]]; then
        passed=true
    elif [[ "$actual_intent" == "$expected_intent" ]]; then
        if (( $(echo "$confidence >= $min_confidence" | bc -l) )); then
            passed=true
        else
            reason="Confidence too low: $confidence < $min_confidence"
        fi
    else
        reason="Intent mismatch: expected $expected_intent, got $actual_intent"
    fi

    # 输出结果
    if [[ "$passed" == "true" ]]; then
        echo -e "${GREEN}✅ [$id] PASS${NC} - Intent: $actual_intent (conf: $confidence)"
    else
        echo -e "${RED}❌ [$id] FAIL${NC} - $reason"
        echo -e "   Input: $input"
        echo -e "   Expected: $expected_intent, Got: $actual_intent"
    fi

    # 返回JSON结果
    echo "{\"id\":\"$id\",\"passed\":$passed,\"expected\":\"$expected_intent\",\"actual\":\"$actual_intent\",\"confidence\":$confidence,\"reason\":\"$reason\"}"
}

# 运行测试类别
run_category() {
    local category_file="$1"
    local category_name=$(basename "$category_file" .json)

    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}Running: $category_name${NC}"
    echo -e "${BLUE}========================================${NC}\n"

    local passed=0
    local failed=0
    local results=()

    # 读取测试用例
    local test_cases=$(cat "$category_file" | jq -c '.testCases[]')

    while IFS= read -r test_case; do
        local id=$(echo "$test_case" | jq -r '.id')
        local input=$(echo "$test_case" | jq -r '.input')
        local expected_intent=$(echo "$test_case" | jq -r '.expectedIntent // .expectedResult // "UNKNOWN"')
        local min_confidence=$(echo "$test_case" | jq -r '.minConfidence // 0.5')
        local username=$(echo "$test_case" | jq -r '.username // ""')
        local password=$(echo "$test_case" | jq -r '.password // ""')

        # 获取Token (如果需要)
        local token=""
        if [[ -n "$username" ]]; then
            token=$(get_token "$username" "$password")
        fi

        # 运行测试
        local result=$(run_test_case "$id" "$input" "$expected_intent" "$token" "$min_confidence")
        local test_passed=$(echo "$result" | jq -r '.passed')

        if [[ "$test_passed" == "true" ]]; then
            ((passed++))
        else
            ((failed++))
        fi

        results+=("$result")

        # 添加延迟避免限流
        sleep 0.5

    done <<< "$test_cases"

    local total=$((passed + failed))
    local rate=0
    if [[ $total -gt 0 ]]; then
        rate=$(echo "scale=1; $passed * 100 / $total" | bc)
    fi

    echo -e "\n${YELLOW}Category Summary: $category_name${NC}"
    echo -e "  Passed: $passed / $total ($rate%)"

    # 返回统计
    echo "{\"category\":\"$category_name\",\"passed\":$passed,\"failed\":$failed,\"total\":$total,\"rate\":$rate}"
}

# 并行运行所有类别
run_parallel() {
    echo -e "${BLUE}Running all test categories in parallel...${NC}\n"

    local pids=()
    local temp_dir=$(mktemp -d)

    for case_file in "$CASES_DIR"/*.json; do
        local category=$(basename "$case_file" .json)
        (
            run_category "$case_file" > "$temp_dir/$category.log" 2>&1
        ) &
        pids+=($!)
    done

    # 等待所有进程完成
    for pid in "${pids[@]}"; do
        wait $pid
    done

    # 合并结果
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}Parallel Execution Complete${NC}"
    echo -e "${BLUE}========================================${NC}\n"

    for log_file in "$temp_dir"/*.log; do
        cat "$log_file"
    done

    rm -rf "$temp_dir"
}

# 运行单个类别
run_single() {
    local category="$1"
    local case_file="$CASES_DIR/$category.json"

    if [[ ! -f "$case_file" ]]; then
        echo -e "${RED}Error: Category file not found: $case_file${NC}"
        exit 1
    fi

    run_category "$case_file"
}

# 运行所有类别（串行）
run_all() {
    echo -e "${BLUE}Running all test categories...${NC}\n"

    local total_passed=0
    local total_failed=0

    for case_file in "$CASES_DIR"/*.json; do
        local result=$(run_category "$case_file")
        local passed=$(echo "$result" | jq -r '.passed')
        local failed=$(echo "$result" | jq -r '.failed')

        ((total_passed += passed))
        ((total_failed += failed))
    done

    local total=$((total_passed + total_failed))
    local rate=0
    if [[ $total -gt 0 ]]; then
        rate=$(echo "scale=1; $total_passed * 100 / $total" | bc)
    fi

    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}FINAL SUMMARY${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "  Total Passed: $total_passed"
    echo -e "  Total Failed: $total_failed"
    echo -e "  Total Cases: $total"
    echo -e "  Pass Rate: ${rate}%"
}

# 显示帮助
show_help() {
    echo "v10.0 Intent Recognition System Test Runner"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  all                Run all test categories (serial)"
    echo "  parallel           Run all test categories in parallel"
    echo "  <category>         Run specific category"
    echo "                     Categories: 01-complex-language, 02-multi-turn-dialogue,"
    echo "                     03-permission-control, 04-self-learning, 05-rag-consultation,"
    echo "                     06-write-operations, 07-response-formatting"
    echo ""
    echo "Examples:"
    echo "  $0 all                       # Run all tests serially"
    echo "  $0 parallel                  # Run all tests in parallel"
    echo "  $0 01-complex-language       # Run complex language tests only"
}

# 主函数
main() {
    case "${1:-all}" in
        "help"|"-h"|"--help")
            show_help
            ;;
        "parallel")
            run_parallel
            ;;
        "all")
            run_all
            ;;
        *)
            run_single "$1"
            ;;
    esac
}

main "$@"
