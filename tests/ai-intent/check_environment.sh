#!/bin/bash

# ============================================================================
# AI意图测试框架 - 环境检查脚本
# ============================================================================
# 用途: 检查测试框架所需的所有依赖和配置
# 使用: ./check_environment.sh
# ============================================================================

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 加载工具函数库
source "${SCRIPT_DIR}/lib/test_utils.sh"

# 配置
API_BASE_URL="${API_BASE_URL:-http://139.196.165.140:10010/api/mobile}"
DB_HOST="${DB_HOST:-139.196.165.140}"
DB_USER="${DB_USER:-creats-test}"
DB_PASS="${DB_PASS:-R8mwtyFEDMDPBwC8}"
DB_NAME="${DB_NAME:-creats-test}"
TEST_USERNAME="${TEST_USERNAME:-factory_admin1}"
TEST_PASSWORD="${TEST_PASSWORD:-123456}"

echo "========================================"
echo "AI意图测试框架 - 环境检查"
echo "========================================"
echo ""

# ============================================================================
# 1. 检查依赖工具
# ============================================================================

log_info "Step 1: Checking dependencies..."
echo ""

check_tool() {
    local tool="$1"
    local install_cmd="$2"

    if command -v "$tool" &> /dev/null; then
        local version=$($tool --version 2>&1 | head -n 1)
        log_success "$tool is installed: $version"
        return 0
    else
        log_error "$tool is NOT installed"
        echo "  Install: $install_cmd"
        return 1
    fi
}

all_deps_ok=true

check_tool "jq" "brew install jq (macOS) | apt-get install jq (Linux)" || all_deps_ok=false
check_tool "curl" "brew install curl (macOS) | apt-get install curl (Linux)" || all_deps_ok=false
check_tool "mysql" "brew install mysql-client (macOS) | apt-get install mysql-client (Linux)" || all_deps_ok=false

echo ""

if [ "$all_deps_ok" = false ]; then
    log_error "Some dependencies are missing. Please install them first."
    exit 1
fi

# ============================================================================
# 2. 检查数据库连接
# ============================================================================

log_info "Step 2: Checking database connection..."
echo ""

log_info "Database config:"
echo "  Host: $DB_HOST"
echo "  User: $DB_USER"
echo "  Database: $DB_NAME"
echo ""

# 测试数据库连接
if mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT 1" > /dev/null 2>&1; then
    log_success "Database connection successful"

    # 检查关键表是否存在
    log_info "Checking required tables..."

    tables=("material_batches" "material_types" "users")
    for table in "${tables[@]}"; do
        if mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SHOW TABLES LIKE '$table'" 2>&1 | grep -q "$table"; then
            log_success "  Table '$table' exists"
        else
            log_warning "  Table '$table' NOT found (may cause test failures)"
        fi
    done
else
    log_error "Database connection failed"
    echo "  Please check database credentials and network connectivity"
    all_deps_ok=false
fi

echo ""

# ============================================================================
# 3. 检查API服务
# ============================================================================

log_info "Step 3: Checking API service..."
echo ""

log_info "API config:"
echo "  Base URL: $API_BASE_URL"
echo ""

# 检查健康端点
health_url="${API_BASE_URL}/health"
if curl -s -f "$health_url" > /dev/null 2>&1; then
    log_success "API service is reachable"
else
    log_warning "API health check failed (endpoint may not exist, trying login...)"
fi

# 尝试登录
log_info "Testing authentication..."

login_data=$(cat <<EOF
{
    "username": "$TEST_USERNAME",
    "password": "$TEST_PASSWORD"
}
EOF
)

login_response=$(curl -s -X POST "${API_BASE_URL}/auth/unified-login" \
    -H "Content-Type: application/json" \
    -d "$login_data")

token=$(echo "$login_response" | jq -r '.data.accessToken' 2>/dev/null || echo "null")

if [ "$token" != "null" ] && [ -n "$token" ]; then
    log_success "Authentication successful"
    log_info "  Access token obtained: ${token:0:20}..."
else
    log_error "Authentication failed"
    echo "  Response: $login_response"
    echo "  Please check username/password or API service status"
    all_deps_ok=false
fi

echo ""

# ============================================================================
# 4. 检查测试文件
# ============================================================================

log_info "Step 4: Checking test files..."
echo ""

test_files=(
    "test_runner.sh"
    "lib/test_utils.sh"
    "test-cases-example.json"
)

for file in "${test_files[@]}"; do
    file_path="${SCRIPT_DIR}/${file}"
    if [ -f "$file_path" ]; then
        log_success "  $file exists"

        # 检查可执行权限
        if [[ "$file" == *.sh ]]; then
            if [ -x "$file_path" ]; then
                log_success "    ✓ Executable"
            else
                log_warning "    ✗ Not executable (fixing...)"
                chmod +x "$file_path"
                log_success "    ✓ Fixed permissions"
            fi
        fi
    else
        log_error "  $file NOT found"
        all_deps_ok=false
    fi
done

echo ""

# ============================================================================
# 5. 检查报告目录
# ============================================================================

log_info "Step 5: Checking reports directory..."
echo ""

reports_dir="${SCRIPT_DIR}/reports"
if [ -d "$reports_dir" ]; then
    log_success "Reports directory exists: $reports_dir"

    # 检查写权限
    if [ -w "$reports_dir" ]; then
        log_success "  Directory is writable"
    else
        log_error "  Directory is NOT writable"
        all_deps_ok=false
    fi
else
    log_warning "Reports directory NOT found, creating..."
    mkdir -p "$reports_dir"
    log_success "Reports directory created"
fi

echo ""

# ============================================================================
# 6. 运行快速测试
# ============================================================================

log_info "Step 6: Running quick test..."
echo ""

if [ "$all_deps_ok" = true ]; then
    log_info "Testing intent recognition API..."

    test_request=$(cat <<EOF
{
    "userInput": "你好",
    "factoryId": "F001"
}
EOF
)

    test_response=$(curl -s -X POST "${API_BASE_URL}/F001/ai-intents/execute" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "$test_request")

    test_success=$(echo "$test_response" | jq -r '.success' 2>/dev/null || echo "null")

    if [ "$test_success" = "true" ] || [ "$test_success" = "false" ]; then
        log_success "Quick test completed"
        log_info "  Response: $test_response"
    else
        log_warning "Quick test completed with unexpected response"
        log_info "  Response: $test_response"
    fi
else
    log_warning "Skipping quick test due to previous errors"
fi

echo ""

# ============================================================================
# 总结
# ============================================================================

echo "========================================"
echo "Environment Check Summary"
echo "========================================"
echo ""

if [ "$all_deps_ok" = true ]; then
    log_success "All checks passed!"
    echo ""
    echo "You can now run tests with:"
    echo "  ./test_runner.sh --file test-cases-example.json"
    echo ""
    echo "For more options, see:"
    echo "  ./test_runner.sh --help"
    echo ""
    exit 0
else
    log_error "Some checks failed. Please fix the issues above before running tests."
    echo ""
    echo "Common solutions:"
    echo "  1. Install missing dependencies"
    echo "  2. Check database connection and credentials"
    echo "  3. Verify API service is running"
    echo "  4. Check network connectivity"
    echo ""
    exit 1
fi
