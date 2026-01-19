#!/bin/bash

# AI意图测试框架 - 工具函数库
# 版本: 1.0.0
# 用途: 提供测试脚本所需的通用工具函数

# ============================================================================
# 颜色输出定义
# ============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# 日志函数
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ============================================================================
# JSON解析函数 (使用jq)
# ============================================================================

check_jq_installed() {
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed. Please install it first."
        echo "  macOS: brew install jq"
        echo "  Linux: sudo apt-get install jq"
        exit 1
    fi
}

parse_json_field() {
    local json="$1"
    local field="$2"
    echo "$json" | jq -r "$field"
}

parse_json_array_length() {
    local json="$1"
    local array_path="$2"
    echo "$json" | jq -r "${array_path} | length"
}

# ============================================================================
# 数据库操作函数
# ============================================================================

execute_sql() {
    local host="$1"
    local user="$2"
    local pass="$3"
    local db="$4"
    local sql="$5"

    # 使用管道传递 SQL 避免 bash 引号转义问题
    echo "$sql" | mysql -h"$host" -u"$user" -p"$pass" "$db" 2>&1
    local exit_code=${PIPESTATUS[1]}

    if [ $exit_code -ne 0 ]; then
        log_error "SQL execution failed"
        return 1
    fi

    return 0
}

execute_sql_file() {
    local host="$1"
    local user="$2"
    local pass="$3"
    local db="$4"
    local sql_file="$5"

    mysql -h"$host" -u"$user" -p"$pass" "$db" < "$sql_file" 2>&1
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        log_error "SQL file execution failed: $sql_file"
        return 1
    fi

    return 0
}

query_count() {
    local host="$1"
    local user="$2"
    local pass="$3"
    local db="$4"
    local table="$5"
    local where_clause="$6"

    local sql="SELECT COUNT(*) FROM $table WHERE $where_clause"
    local result=$(mysql -h"$host" -u"$user" -p"$pass" "$db" -sN -e "$sql" 2>&1)

    echo "$result"
}

# ============================================================================
# API调用函数
# ============================================================================

call_api() {
    local method="$1"
    local url="$2"
    local token="$3"
    local data="$4"

    local response
    if [ -z "$data" ]; then
        response=$(curl -s -X "$method" "$url" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json")
    else
        response=$(curl -s -X "$method" "$url" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi

    echo "$response"
}

get_access_token() {
    local base_url="$1"
    local username="$2"
    local password="$3"

    local login_data=$(cat <<EOF
{
    "username": "$username",
    "password": "$password"
}
EOF
)

    local response=$(curl -s -X POST "${base_url}/auth/unified-login" \
        -H "Content-Type: application/json" \
        -d "$login_data")

    local token=$(echo "$response" | jq -r '.data.accessToken')

    if [ "$token" = "null" ] || [ -z "$token" ]; then
        log_error "Failed to get access token"
        echo "$response" >&2
        return 1
    fi

    echo "$token"
}

# ============================================================================
# 验证函数
# ============================================================================

validate_json_field() {
    local json="$1"
    local field_path="$2"
    local expected_value="$3"

    local actual_value=$(echo "$json" | jq -r "$field_path")

    if [ "$actual_value" = "$expected_value" ]; then
        return 0
    else
        log_error "Validation failed: expected '$expected_value', got '$actual_value'"
        return 1
    fi
}

validate_json_contains() {
    local json="$1"
    local field_path="$2"
    local search_text="$3"

    local actual_value=$(echo "$json" | jq -r "$field_path")

    if echo "$actual_value" | grep -q "$search_text"; then
        return 0
    else
        log_error "Validation failed: '$search_text' not found in '$actual_value'"
        return 1
    fi
}

validate_array_not_empty() {
    local json="$1"
    local array_path="$2"

    local length=$(echo "$json" | jq -r "${array_path} | length")

    if [ "$length" -gt 0 ]; then
        return 0
    else
        log_error "Validation failed: array is empty at path '$array_path'"
        return 1
    fi
}

# ============================================================================
# 报告生成函数
# ============================================================================

init_report() {
    local report_file="$1"
    local test_suite_name="$2"

    cat > "$report_file" <<EOF
# AI意图识别测试报告

**测试套件**: $test_suite_name
**执行时间**: $(date '+%Y-%m-%d %H:%M:%S')
**执行用户**: $(whoami)

---

## 测试摘要

| 指标 | 数值 |
|------|------|
| 总测试数 | TBD |
| 通过数 | TBD |
| 失败数 | TBD |
| 跳过数 | TBD |
| 通过率 | TBD |
| 执行时长 | TBD |

---

## 测试结果详情

EOF
}

append_test_result() {
    local report_file="$1"
    local test_id="$2"
    local test_name="$3"
    local status="$4"
    local duration="$5"
    local error_msg="$6"

    local status_icon
    case "$status" in
        "PASS")
            status_icon="✅"
            ;;
        "FAIL")
            status_icon="❌"
            ;;
        "SKIP")
            status_icon="⏭️"
            ;;
        *)
            status_icon="❓"
            ;;
    esac

    cat >> "$report_file" <<EOF
### $status_icon $test_id - $test_name

- **状态**: $status
- **耗时**: ${duration}s

EOF

    if [ -n "$error_msg" ]; then
        cat >> "$report_file" <<EOF
**错误信息**:
\`\`\`
$error_msg
\`\`\`

EOF
    fi

    echo "---" >> "$report_file"
    echo "" >> "$report_file"
}

finalize_report() {
    local report_file="$1"
    local total="$2"
    local passed="$3"
    local failed="$4"
    local skipped="$5"
    local duration="$6"

    local pass_rate=$(awk "BEGIN {printf \"%.2f\", ($passed/$total)*100}")

    # 更新摘要表格
    sed -i.bak "s/| 总测试数 | TBD |/| 总测试数 | $total |/" "$report_file"
    sed -i.bak "s/| 通过数 | TBD |/| 通过数 | $passed |/" "$report_file"
    sed -i.bak "s/| 失败数 | TBD |/| 失败数 | $failed |/" "$report_file"
    sed -i.bak "s/| 跳过数 | TBD |/| 跳过数 | $skipped |/" "$report_file"
    sed -i.bak "s/| 通过率 | TBD |/| 通过率 | ${pass_rate}% |/" "$report_file"
    sed -i.bak "s/| 执行时长 | TBD |/| 执行时长 | ${duration}s |/" "$report_file"

    # 删除备份文件
    rm -f "${report_file}.bak"

    log_success "Test report generated: $report_file"
}

# ============================================================================
# 时间测量函数
# ============================================================================

get_timestamp() {
    date +%s
}

calculate_duration() {
    local start_time="$1"
    local end_time="$2"
    echo $((end_time - start_time))
}

# ============================================================================
# 文件操作函数
# ============================================================================

check_file_exists() {
    local file="$1"
    if [ ! -f "$file" ]; then
        log_error "File not found: $file"
        return 1
    fi
    return 0
}

read_file_content() {
    local file="$1"
    cat "$file"
}

# ============================================================================
# 依赖检查函数
# ============================================================================

check_dependencies() {
    local missing_deps=()

    # 检查jq
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi

    # 检查curl
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi

    # 检查mysql
    if ! command -v mysql &> /dev/null; then
        missing_deps+=("mysql-client")
    fi

    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        echo ""
        echo "Please install them:"
        echo "  macOS: brew install ${missing_deps[*]}"
        echo "  Ubuntu/Debian: sudo apt-get install ${missing_deps[*]}"
        return 1
    fi

    log_success "All dependencies are installed"
    return 0
}

# ============================================================================
# 导出函数
# ============================================================================

export -f log_info
export -f log_success
export -f log_warning
export -f log_error
export -f check_jq_installed
export -f parse_json_field
export -f parse_json_array_length
export -f execute_sql
export -f execute_sql_file
export -f query_count
export -f call_api
export -f get_access_token
export -f validate_json_field
export -f validate_json_contains
export -f validate_array_not_empty
export -f init_report
export -f append_test_result
export -f finalize_report
export -f get_timestamp
export -f calculate_duration
export -f check_file_exists
export -f read_file_content
export -f check_dependencies
