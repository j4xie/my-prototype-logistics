#!/bin/bash

#############################################################################
#  完整的系统集成测试脚本
#  测试所有关键组件和接口是否都连接到服务器
#
#  测试内容：
#  1. 基础服务检查（Java、AI、MySQL）
#  2. 认证接口（登录）
#  3. 业务接口（批次、材料、设备等）
#  4. AI 集成接口（成本分析）
#############################################################################

set -e

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
JAVA_HOST="localhost"
JAVA_PORT="10010"
AI_HOST="localhost"
AI_PORT="8085"
MYSQL_HOST="localhost"
MYSQL_USER="root"
MYSQL_DB="cretas_db"
FACTORY_ID="CRETAS_2024_001"

# 计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试结果记录
declare -A TEST_RESULTS

#############################################################################
# 辅助函数
#############################################################################

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_subheader() {
    echo -e "${YELLOW}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_failure() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local headers=$4
    local data=$5

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    print_subheader "[$TOTAL_TESTS] $name"

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$url" $headers)
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "$url" $headers -d "$data")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" =~ ^[2][0-9][0-9]$ ]]; then
        print_success "$name (HTTP $http_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        TEST_RESULTS["$name"]="✅ PASS (HTTP $http_code)"
        return 0
    else
        print_failure "$name (HTTP $http_code)"
        echo "  响应: $(echo $body | head -c 100)..."
        FAILED_TESTS=$((FAILED_TESTS + 1))
        TEST_RESULTS["$name"]="❌ FAIL (HTTP $http_code)"
        return 1
    fi
}

#############################################################################
# 主测试流程
#############################################################################

print_header "🚀 白垩纪系统完整集成测试"

print_info "测试时间: $(date '+%Y-%m-%d %H:%M:%S')"
print_info "测试服务器: 139.196.165.140"
print_info "测试工厂: $FACTORY_ID"

#############################################################################
# 第1部分：基础服务检查
#############################################################################

print_header "第1部分：基础服务检查"

# 检查 Java 后端
print_subheader "检查 Java 后端 (10010)"
if lsof -i :$JAVA_PORT > /dev/null 2>&1; then
    print_success "Java 后端运行中"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    print_failure "Java 后端未运行"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 检查 AI 服务
print_subheader "检查 AI 服务 (8085)"
if lsof -i :$AI_PORT > /dev/null 2>&1; then
    print_success "AI 服务运行中"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    print_failure "AI 服务未运行"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 检查 MySQL
print_subheader "检查 MySQL"
if mysql -u $MYSQL_USER -e "SELECT 1" > /dev/null 2>&1; then
    print_success "MySQL 运行中"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    print_failure "MySQL 未运行"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

#############################################################################
# 第2部分：认证接口测试
#############################################################################

print_header "第2部分：认证接口测试"

# 登录测试
test_endpoint \
    "用户登录接口" \
    "POST" \
    "http://$JAVA_HOST:$JAVA_PORT/api/mobile/auth/unified-login" \
    "-H 'Content-Type: application/json'" \
    '{"username":"super_admin","password":"123456"}'

# 从登录响应中获取 Token
LOGIN_RESPONSE=$(curl -s -X POST http://$JAVA_HOST:$JAVA_PORT/api/mobile/auth/unified-login \
    -H 'Content-Type: application/json' \
    -d '{"username":"super_admin","password":"123456"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('data', {}).get('accessToken', ''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    print_failure "无法获取有效的 Token，后续认证测试将跳过"
    print_info "登录响应: $LOGIN_RESPONSE"
else
    print_success "获取到有效的 Token: ${TOKEN:0:30}..."
fi

echo ""

#############################################################################
# 第3部分：业务接口测试（需要认证）
#############################################################################

if [ -n "$TOKEN" ]; then
    print_header "第3部分：业务接口测试"

    HEADERS="-H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json'"

    # 批次管理接口
    test_endpoint \
        "查询材料批次列表" \
        "GET" \
        "http://$JAVA_HOST:$JAVA_PORT/api/mobile/$FACTORY_ID/material-batches?page=1&pageSize=10" \
        "$HEADERS" \
        ""

    # 生产批次接口
    test_endpoint \
        "查询生产批次列表" \
        "GET" \
        "http://$JAVA_HOST:$JAVA_PORT/api/mobile/$FACTORY_ID/production-batches?page=1&pageSize=10" \
        "$HEADERS" \
        ""

    # 设备接口
    test_endpoint \
        "查询设备列表" \
        "GET" \
        "http://$JAVA_HOST:$JAVA_PORT/api/mobile/$FACTORY_ID/equipment?page=1&pageSize=10" \
        "$HEADERS" \
        ""

    # 质检接口
    test_endpoint \
        "查询质检记录列表" \
        "GET" \
        "http://$JAVA_HOST:$JAVA_PORT/api/mobile/$FACTORY_ID/quality-inspections?page=1&pageSize=10" \
        "$HEADERS" \
        ""

    # 成本分析接口（AI 集成）
    test_endpoint \
        "AI 批次成本分析" \
        "POST" \
        "http://$JAVA_HOST:$JAVA_PORT/api/mobile/$FACTORY_ID/ai/analysis/cost/batch" \
        "$HEADERS" \
        '{"batchId":"BATCH_TEST_001","costData":{"totalMaterialCost":1000,"totalLaborCost":500,"totalEquipmentCost":300}}'

    # 时间范围分析接口
    test_endpoint \
        "AI 时间范围成本分析" \
        "POST" \
        "http://$JAVA_HOST:$JAVA_PORT/api/mobile/$FACTORY_ID/ai/analysis/cost/time-range" \
        "$HEADERS" \
        "{\"startDate\":\"2025-11-01\",\"endDate\":\"2025-11-22\",\"timeUnit\":\"day\"}"

    echo ""

    #########################################################################
    # 第4部分：AI 服务直接接口测试
    #########################################################################

    print_header "第4部分：AI 服务直接接口测试"

    # AI 健康检查
    test_endpoint \
        "AI 服务健康检查" \
        "GET" \
        "http://$AI_HOST:$AI_PORT/" \
        "" \
        ""

    # AI 对话接口
    test_endpoint \
        "AI 对话接口" \
        "POST" \
        "http://$AI_HOST:$AI_PORT/api/ai/chat" \
        "-H 'Content-Type: application/json'" \
        '{"message":"请介绍一下自己","user_id":"test_factory"}'

    # AI 食品加工分析接口
    test_endpoint \
        "AI 食品加工分析" \
        "POST" \
        "http://$AI_HOST:$AI_PORT/api/ai/food-processing-analysis" \
        "-H 'Content-Type: application/json'" \
        '{"batch_id":"BATCH_001","raw_material_cost":1000,"labor_cost":500,"equipment_cost":300,"processing_weight":100}'

    echo ""
fi

#############################################################################
# 测试总结
#############################################################################

print_header "📊 测试总结"

echo -e "总测试数: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
echo -e "失败: ${RED}$FAILED_TESTS${NC}"
echo ""

PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
echo -e "通过率: ${BLUE}$PASS_RATE%${NC}"

echo ""
print_subheader "详细结果："
for test_name in "${!TEST_RESULTS[@]}"; do
    echo "  ${TEST_RESULTS[$test_name]} - $test_name"
done

echo ""
if [ $FAILED_TESTS -eq 0 ]; then
    print_header "🎉 所有测试都通过了！系统集成完成！"
    exit 0
else
    print_header "⚠️  有 $FAILED_TESTS 个测试失败"
    exit 1
fi
