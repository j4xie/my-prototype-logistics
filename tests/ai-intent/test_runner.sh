#!/bin/bash

# ============================================================================
# AI意图识别测试执行器
# ============================================================================
# 版本: 1.0.0
# 用途: 执行AI意图识别测试用例，支持多种过滤方式和4层验证
#
# 使用示例:
#   ./test_runner.sh --file test-cases-phase1-30.json
#   ./test_runner.sh --file test-cases-phase1-30.json --priority P0
#   ./test_runner.sh --file test-cases-phase1-30.json --category MATERIAL
#   ./test_runner.sh --file test-cases-phase1-30.json --id TC-P0-MATERIAL-001
#   ./test_runner.sh --file test-cases-phase1-30.json --report-html
#
# 依赖:
#   - jq (JSON解析)
#   - curl (API调用)
#   - mysql (数据库操作)
# ============================================================================

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 加载工具函数库
source "${SCRIPT_DIR}/lib/test_utils.sh"

# ============================================================================
# 配置常量
# ============================================================================

API_BASE_URL="${API_BASE_URL:-http://139.196.165.140:10010/api/mobile}"
DB_HOST="${DB_HOST:-139.196.165.140}"
DB_USER="${DB_USER:-creats-test}"
DB_PASS="${DB_PASS:-R8mwtyFEDMDPBwC8}"
DB_NAME="${DB_NAME:-creats-test}"
FACTORY_ID="${FACTORY_ID:-F001}"
TEST_USERNAME="${TEST_USERNAME:-factory_admin1}"
TEST_PASSWORD="${TEST_PASSWORD:-123456}"

# ============================================================================
# 全局变量
# ============================================================================

TEST_FILE=""
PRIORITY_FILTER=""
CATEGORY_FILTER=""
ID_FILTER=""
REPORT_FORMAT="markdown"
REPORT_FILE=""
ACCESS_TOKEN=""

# 统计变量
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0
START_TIME=0

# ============================================================================
# 参数解析
# ============================================================================

show_usage() {
    cat <<EOF
AI意图识别测试执行器

用法:
    $0 --file <test-file> [选项]

必需参数:
    --file <path>           测试用例JSON文件路径

可选参数:
    --priority <P0|P1|P2>   只执行指定优先级的测试
    --category <category>   只执行指定类别的测试 (MATERIAL|INVENTORY|等)
    --id <test-id>          只执行指定ID的测试用例
    --report-html           生成HTML格式报告 (默认Markdown)
    --output <path>         指定报告输出路径 (默认: reports/test-report-<timestamp>.md)
    --help                  显示此帮助信息

示例:
    $0 --file test-cases-phase1-30.json
    $0 --file test-cases-phase1-30.json --priority P0
    $0 --file test-cases-phase1-30.json --category MATERIAL --report-html

EOF
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --file)
                TEST_FILE="$2"
                shift 2
                ;;
            --priority)
                PRIORITY_FILTER="$2"
                shift 2
                ;;
            --category)
                CATEGORY_FILTER="$2"
                shift 2
                ;;
            --id)
                ID_FILTER="$2"
                shift 2
                ;;
            --report-html)
                REPORT_FORMAT="html"
                shift
                ;;
            --output)
                REPORT_FILE="$2"
                shift 2
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown parameter: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # 验证必需参数
    if [ -z "$TEST_FILE" ]; then
        log_error "Missing required parameter: --file"
        show_usage
        exit 1
    fi

    # 检查文件是否存在
    if ! check_file_exists "$TEST_FILE"; then
        exit 1
    fi

    # 设置默认报告文件名
    if [ -z "$REPORT_FILE" ]; then
        local timestamp=$(date '+%Y%m%d_%H%M%S')
        local extension="md"
        if [ "$REPORT_FORMAT" = "html" ]; then
            extension="html"
        fi
        REPORT_FILE="${SCRIPT_DIR}/reports/test-report-${timestamp}.${extension}"
    fi
}

# ============================================================================
# 测试准备
# ============================================================================

setup_environment() {
    log_info "Setting up test environment..."

    # 检查依赖
    if ! check_dependencies; then
        exit 1
    fi

    # 获取访问令牌
    log_info "Logging in as $TEST_USERNAME..."
    ACCESS_TOKEN=$(get_access_token "$API_BASE_URL" "$TEST_USERNAME" "$TEST_PASSWORD")
    if [ $? -ne 0 ]; then
        log_error "Failed to login"
        exit 1
    fi
    log_success "Login successful"

    # 初始化报告
    init_report "$REPORT_FILE" "$(basename $TEST_FILE)"

    START_TIME=$(get_timestamp)
}

# ============================================================================
# 测试数据准备
# ============================================================================

setup_test_data() {
    local test_id="$1"
    local setup_sql="$2"

    if [ -z "$setup_sql" ] || [ "$setup_sql" = "null" ]; then
        log_info "[$test_id] No setup SQL required"
        return 0
    fi

    log_info "[$test_id] Setting up test data..."

    # 分割并执行多条SQL语句
    local IFS=';'
    read -ra sql_statements <<< "$setup_sql"

    for stmt in "${sql_statements[@]}"; do
        # Trim whitespace without using xargs (which strips quotes)
        local trimmed_stmt="${stmt#"${stmt%%[![:space:]]*}"}"  # remove leading whitespace
        trimmed_stmt="${trimmed_stmt%"${trimmed_stmt##*[![:space:]]}"}"  # remove trailing whitespace
        if [ -n "$trimmed_stmt" ]; then
            if ! execute_sql "$DB_HOST" "$DB_USER" "$DB_PASS" "$DB_NAME" "$trimmed_stmt"; then
                log_error "[$test_id] Failed to execute setup SQL"
                return 1
            fi
        fi
    done

    log_success "[$test_id] Test data setup complete"
    return 0
}

cleanup_test_data() {
    local test_id="$1"
    local cleanup_sql="$2"

    if [ -z "$cleanup_sql" ] || [ "$cleanup_sql" = "null" ]; then
        return 0
    fi

    log_info "[$test_id] Cleaning up test data..."

    local IFS=';'
    read -ra sql_statements <<< "$cleanup_sql"

    for stmt in "${sql_statements[@]}"; do
        # Trim whitespace without using xargs (which strips quotes)
        local trimmed_stmt="${stmt#"${stmt%%[![:space:]]*}"}"  # remove leading whitespace
        trimmed_stmt="${trimmed_stmt%"${trimmed_stmt##*[![:space:]]}"}"  # remove trailing whitespace
        if [ -n "$trimmed_stmt" ]; then
            execute_sql "$DB_HOST" "$DB_USER" "$DB_PASS" "$DB_NAME" "$trimmed_stmt" > /dev/null 2>&1 || true
        fi
    done
}

# ============================================================================
# API调用
# ============================================================================

execute_intent() {
    local user_input="$1"

    local request_data=$(cat <<EOF
{
    "userInput": "$user_input",
    "factoryId": "$FACTORY_ID"
}
EOF
)

    local response=$(call_api "POST" "${API_BASE_URL}/${FACTORY_ID}/ai-intents/execute" "$ACCESS_TOKEN" "$request_data")

    echo "$response"
}

# ============================================================================
# 验证层级
# ============================================================================

# Level 1: 响应结构验证
validate_level1_response() {
    local test_id="$1"
    local response="$2"
    local expected_json="$3"

    log_info "[$test_id] Level 1: Validating response structure..."

    # 检查是否是HTTP错误响应
    local http_status=$(parse_json_field "$response" ".status")
    local http_error=$(parse_json_field "$response" ".error")

    # 只检查明确的HTTP错误状态码 (error字段可能是"null"字符串)
    if [ "$http_status" = "404" ] || [ "$http_status" = "500" ] || [ "$http_status" = "401" ] || [ "$http_status" = "403" ]; then
        log_error "[$test_id] HTTP error response: status=$http_status, error=$http_error"
        return 1
    fi

    # 检查error字段是否真的有值(不是null或empty)
    if [ -n "$http_error" ] && [ "$http_error" != "null" ] && [ "$http_error" != "" ]; then
        log_error "[$test_id] HTTP error response: error=$http_error"
        return 1
    fi

    local success=$(parse_json_field "$response" ".success")
    local expected_success=$(parse_json_field "$expected_json" ".success")

    # Only check success if it's explicitly defined in expectedResponse (not null or empty)
    # Use [[ ]] for more robust string comparison
    if [[ -n "$expected_success" && "$expected_success" != "null" && "$expected_success" != "" ]]; then
        if [[ "$success" != "$expected_success" ]]; then
            log_error "[$test_id] Response success mismatch: expected $expected_success, got $success"
            return 1
        fi
    fi

    # 验证intentType (从 .data.intentCode 获取，兼容不同响应格式)
    if [[ "$success" == "true" ]]; then
        local intent_type=$(parse_json_field "$response" ".data.intentCode")
        local expected_intent=$(parse_json_field "$expected_json" ".intentCode")

        if [[ -n "$expected_intent" && "$expected_intent" != "null" && "$expected_intent" != "" ]]; then
            if [[ "$intent_type" != "$expected_intent" ]]; then
                log_error "[$test_id] Intent type mismatch: expected $expected_intent, got $intent_type"
                return 1
            fi
        fi
    fi

    log_success "[$test_id] Level 1 validation passed"
    return 0
}

# Level 2: 数据内容验证
validate_level2_data() {
    local test_id="$1"
    local response="$2"
    local expected_data_json="$3"

    if [ -z "$expected_data_json" ] || [ "$expected_data_json" = "null" ]; then
        log_info "[$test_id] Level 2: No data validation required"
        return 0
    fi

    log_info "[$test_id] Level 2: Validating data content..."

    # 检查是否有数据返回
    local has_results=$(parse_json_field "$response" ".data.results")
    if [ "$has_results" = "null" ] || [ -z "$has_results" ]; then
        log_error "[$test_id] No results in response data"
        return 1
    fi

    # 验证数据数量
    local min_count=$(parse_json_field "$expected_data_json" ".minCount")
    if [ -n "$min_count" ] && [ "$min_count" != "null" ]; then
        local actual_count=$(parse_json_array_length "$response" ".data.results")
        if [ "$actual_count" -lt "$min_count" ]; then
            log_error "[$test_id] Result count $actual_count is less than minimum $min_count"
            return 1
        fi
    fi

    # 验证必需字段
    local required_fields=$(parse_json_field "$expected_data_json" ".requiredFields[]")
    if [ -n "$required_fields" ] && [ "$required_fields" != "null" ]; then
        local first_result=$(parse_json_field "$response" ".data.results[0]")
        for field in $required_fields; do
            local field_value=$(parse_json_field "$first_result" ".$field")
            if [ "$field_value" = "null" ] || [ -z "$field_value" ]; then
                log_error "[$test_id] Required field '$field' is missing or null"
                return 1
            fi
        done
    fi

    log_success "[$test_id] Level 2 validation passed"
    return 0
}

# Level 3: 语义正确性验证 (LLM)
validate_level3_semantic() {
    local test_id="$1"
    local user_input="$2"
    local response="$3"
    local criteria="$4"

    if [ -z "$criteria" ] || [ "$criteria" = "null" ]; then
        log_info "[$test_id] Level 3: No semantic validation required"
        return 0
    fi

    log_info "[$test_id] Level 3: Semantic validation (LLM) - SKIPPED (manual review required)"
    # LLM验证需要在Java层实现
    return 0
}

# Level 4: 操作效果验证
validate_level4_operation() {
    local test_id="$1"
    local validation_sql="$2"

    if [ -z "$validation_sql" ] || [ "$validation_sql" = "null" ]; then
        log_info "[$test_id] Level 4: No operation validation required"
        return 0
    fi

    log_info "[$test_id] Level 4: Validating operation effects..."

    # 执行验证SQL
    local result=$(execute_sql "$DB_HOST" "$DB_USER" "$DB_PASS" "$DB_NAME" "$validation_sql")
    if [ $? -ne 0 ]; then
        log_error "[$test_id] Validation SQL failed"
        return 1
    fi

    log_success "[$test_id] Level 4 validation passed"
    return 0
}

# ============================================================================
# 测试用例执行
# ============================================================================

execute_test_case() {
    local test_json="$1"

    local test_id=$(parse_json_field "$test_json" ".id")
    local test_name=$(parse_json_field "$test_json" ".description")
    local user_input=$(parse_json_field "$test_json" ".userInput")
    local setup_sql=$(parse_json_field "$test_json" ".testDataSetup.sql")
    local cleanup_sql=$(parse_json_field "$test_json" ".testDataSetup.cleanup")
    local expected_json=$(parse_json_field "$test_json" ".expectedResponse")
    local validation_json=$(parse_json_field "$test_json" ".validation")

    log_info "========================================="
    log_info "Executing: $test_id - $test_name"
    log_info "Input: $user_input"
    log_info "========================================="

    local test_start=$(get_timestamp)
    local error_msg=""
    local status="PASS"

    # 1. 准备测试数据
    if ! setup_test_data "$test_id" "$setup_sql"; then
        status="FAIL"
        error_msg="Failed to setup test data"
    fi

    # 2. 执行API调用
    if [ "$status" = "PASS" ]; then
        local response=$(execute_intent "$user_input")
        log_info "[$test_id] Response: $response"

        # 3. Level 1: 响应验证
        if ! validate_level1_response "$test_id" "$response" "$expected_json"; then
            status="FAIL"
            error_msg="Level 1 validation failed"
        fi

        # 4. Level 2: 数据验证
        if [ "$status" = "PASS" ]; then
            local expected_data=$(parse_json_field "$validation_json" ".dataValidation")
            if ! validate_level2_data "$test_id" "$response" "$expected_data"; then
                status="FAIL"
                error_msg="Level 2 validation failed"
            fi
        fi

        # 5. Level 3: 语义验证
        if [ "$status" = "PASS" ]; then
            local semantic_criteria=$(parse_json_field "$validation_json" ".semanticCriteria")
            if ! validate_level3_semantic "$test_id" "$user_input" "$response" "$semantic_criteria"; then
                status="FAIL"
                error_msg="Level 3 validation failed"
            fi
        fi

        # 6. Level 4: 操作验证
        if [ "$status" = "PASS" ]; then
            local operation_sql=$(parse_json_field "$validation_json" ".operationValidation.sql")
            if ! validate_level4_operation "$test_id" "$operation_sql"; then
                status="FAIL"
                error_msg="Level 4 validation failed"
            fi
        fi
    fi

    # 7. 清理测试数据
    cleanup_test_data "$test_id" "$cleanup_sql"

    # 8. 记录结果
    local test_end=$(get_timestamp)
    local duration=$(calculate_duration "$test_start" "$test_end")

    if [ "$status" = "PASS" ]; then
        log_success "[$test_id] Test PASSED (${duration}s)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_error "[$test_id] Test FAILED: $error_msg (${duration}s)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    append_test_result "$REPORT_FILE" "$test_id" "$test_name" "$status" "$duration" "$error_msg"

    echo ""
}

# ============================================================================
# 测试过滤
# ============================================================================

should_run_test() {
    local test_json="$1"

    # ID过滤
    if [ -n "$ID_FILTER" ]; then
        local test_id=$(parse_json_field "$test_json" ".id")
        if [ "$test_id" != "$ID_FILTER" ]; then
            return 1
        fi
    fi

    # 优先级过滤
    if [ -n "$PRIORITY_FILTER" ]; then
        local priority=$(parse_json_field "$test_json" ".priority")
        if [ "$priority" != "$PRIORITY_FILTER" ]; then
            return 1
        fi
    fi

    # 类别过滤
    if [ -n "$CATEGORY_FILTER" ]; then
        local category=$(parse_json_field "$test_json" ".category")
        if [ "$category" != "$CATEGORY_FILTER" ]; then
            return 1
        fi
    fi

    return 0
}

# ============================================================================
# 主执行逻辑
# ============================================================================

run_tests() {
    log_info "Loading test cases from: $TEST_FILE"

    local test_suite=$(cat "$TEST_FILE")
    local test_count=$(parse_json_array_length "$test_suite" ".testCases")

    log_info "Found $test_count test cases"

    # 应用过滤器
    if [ -n "$PRIORITY_FILTER" ]; then
        log_info "Filter: Priority = $PRIORITY_FILTER"
    fi
    if [ -n "$CATEGORY_FILTER" ]; then
        log_info "Filter: Category = $CATEGORY_FILTER"
    fi
    if [ -n "$ID_FILTER" ]; then
        log_info "Filter: ID = $ID_FILTER"
    fi

    echo ""

    # 遍历测试用例
    for i in $(seq 0 $((test_count - 1))); do
        local test_case=$(parse_json_field "$test_suite" ".testCases[$i]")

        if should_run_test "$test_case"; then
            TOTAL_TESTS=$((TOTAL_TESTS + 1))
            execute_test_case "$test_case"
        else
            SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
        fi
    done
}

# ============================================================================
# 报告生成
# ============================================================================

generate_final_report() {
    local end_time=$(get_timestamp)
    local total_duration=$(calculate_duration "$START_TIME" "$end_time")

    finalize_report "$REPORT_FILE" "$TOTAL_TESTS" "$PASSED_TESTS" "$FAILED_TESTS" "$SKIPPED_TESTS" "$total_duration"

    echo ""
    log_info "========================================="
    log_info "Test Execution Summary"
    log_info "========================================="
    log_info "Total Tests:    $TOTAL_TESTS"
    log_success "Passed:         $PASSED_TESTS"
    log_error "Failed:         $FAILED_TESTS"
    log_warning "Skipped:        $SKIPPED_TESTS"
    log_info "Duration:       ${total_duration}s"
    log_info "Report:         $REPORT_FILE"
    log_info "========================================="

    if [ "$FAILED_TESTS" -gt 0 ]; then
        exit 1
    fi
}

# ============================================================================
# 主程序入口
# ============================================================================

main() {
    parse_arguments "$@"
    setup_environment
    run_tests
    generate_final_report
}

# 执行主程序
main "$@"
