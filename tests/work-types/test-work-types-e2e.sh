#!/bin/bash
#
# WorkType API E2E测试脚本
# 测试所有8个MVP核心API端点
#
# 使用方法: ./test-work-types-e2e.sh
#
# Author: Claude (AI Assistant)
# Date: 2025-11-19

set -e  # 遇到错误立即退出

BASE_URL="http://localhost:10010"
FACTORY_ID="CRETAS_2024_001"
API_PATH="/api/mobile/${FACTORY_ID}/work-types"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数器
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# 打印测试标题
print_test() {
    echo ""
    echo "=========================================="
    echo "测试 $1: $2"
    echo "=========================================="
}

# 打印成功
print_success() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

# 打印失败
print_failure() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((TESTS_FAILED++))
}

# 打印信息
print_info() {
    echo -e "${YELLOW}ℹ️  INFO${NC}: $1"
}

echo "============================================"
echo "   WorkType API E2E 测试"
echo "============================================"
echo "BASE_URL: ${BASE_URL}"
echo "FACTORY_ID: ${FACTORY_ID}"
echo "开始时间: $(date)"
echo "============================================"

# ==============================================
# 测试1: GET - 获取工种列表（分页）
# ==============================================
print_test "1/8" "GET ${API_PATH}"
((TESTS_RUN++))

RESPONSE=$(curl -s "${BASE_URL}${API_PATH}")
SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")
TOTAL=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['data']['totalElements'])" 2>/dev/null || echo "0")

if [ "$SUCCESS" = "True" ]; then
    print_success "获取到 ${TOTAL} 条工种记录"
else
    print_failure "获取工种列表失败"
fi

# ==============================================
# 测试2: POST - 创建工种
# ==============================================
print_test "2/8" "POST ${API_PATH}"
((TESTS_RUN++))

NEW_WORKTYPE=$(cat <<EOF
{
  "typeCode": "TEST_$(date +%s)",
  "typeName": "测试工种_$(date +%s)",
  "department": "processing",
  "description": "E2E测试工种",
  "colorCode": "#3498db"
}
EOF
)

RESPONSE=$(curl -s -X POST "${BASE_URL}${API_PATH}" \
  -H "Content-Type: application/json" \
  -d "$NEW_WORKTYPE")

SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")
CREATED_ID=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('id', ''))" 2>/dev/null)

if [ "$SUCCESS" = "True" ] && [ -n "$CREATED_ID" ]; then
    print_success "创建成功, ID: ${CREATED_ID:0:8}..."
    TEMP_WORKTYPE_ID=$CREATED_ID
else
    print_failure "创建工种失败"
    TEMP_WORKTYPE_ID=""
fi

# ==============================================
# 测试3: GET - 获取单个工种详情
# ==============================================
print_test "3/8" "GET ${API_PATH}/{id}"
((TESTS_RUN++))

if [ -n "$TEMP_WORKTYPE_ID" ]; then
    RESPONSE=$(curl -s "${BASE_URL}${API_PATH}/${TEMP_WORKTYPE_ID}")
    SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")
    NAME=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('typeName', ''))")

    if [ "$SUCCESS" = "True" ]; then
        print_success "获取详情成功: ${NAME}"
    else
        print_failure "获取详情失败"
    fi
else
    print_info "跳过（未创建测试工种）"
fi

# ==============================================
# 测试4: PUT - 更新工种
# ==============================================
print_test "4/8" "PUT ${API_PATH}/{id}"
((TESTS_RUN++))

if [ -n "$TEMP_WORKTYPE_ID" ]; then
    UPDATE_DATA=$(cat <<EOF
{
  "description": "更新后的描述",
  "colorCode": "#e74c3c"
}
EOF
    )

    RESPONSE=$(curl -s -X PUT "${BASE_URL}${API_PATH}/${TEMP_WORKTYPE_ID}" \
      -H "Content-Type: application/json" \
      -d "$UPDATE_DATA")

    SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")

    if [ "$SUCCESS" = "True" ]; then
        print_success "更新成功"
    else
        print_failure "更新失败"
    fi
else
    print_info "跳过（未创建测试工种）"
fi

# ==============================================
# 测试5: GET - 获取激活的工种列表
# ==============================================
print_test "5/8" "GET ${API_PATH}/active"
((TESTS_RUN++))

RESPONSE=$(curl -s "${BASE_URL}${API_PATH}/active")
SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")
ACTIVE_COUNT=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('data', [])))")

if [ "$SUCCESS" = "True" ]; then
    print_success "获取到 ${ACTIVE_COUNT} 条激活的工种"
else
    print_failure "获取激活的工种失败"
fi

# ==============================================
# 测试6: GET - 按部门获取工种
# ==============================================
print_test "6/8" "GET ${API_PATH}/department/{department}"
((TESTS_RUN++))

RESPONSE=$(curl -s "${BASE_URL}${API_PATH}/department/processing")
SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")

if [ "$SUCCESS" = "True" ]; then
    DEPT_COUNT=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('data', [])))")
    print_success "按部门查询成功，找到 ${DEPT_COUNT} 条记录"
else
    print_failure "按部门查询失败"
fi

# ==============================================
# 测试7: GET - 搜索工种
# ==============================================
print_test "7/8" "GET ${API_PATH}/search"
((TESTS_RUN++))

RESPONSE=$(curl -s "${BASE_URL}${API_PATH}/search?keyword=测试")
SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")

if [ "$SUCCESS" = "True" ]; then
    SEARCH_COUNT=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('data', [])))")
    print_success "搜索成功，找到 ${SEARCH_COUNT} 条记录"
else
    print_failure "搜索失败"
fi

# ==============================================
# 测试8: DELETE - 删除工种
# ==============================================
print_test "8/8" "DELETE ${API_PATH}/{id}"
((TESTS_RUN++))

if [ -n "$TEMP_WORKTYPE_ID" ]; then
    RESPONSE=$(curl -s -X DELETE "${BASE_URL}${API_PATH}/${TEMP_WORKTYPE_ID}")
    SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")

    if [ "$SUCCESS" = "True" ]; then
        print_success "删除成功"
    else
        print_failure "删除失败"
    fi
else
    print_info "跳过（未创建测试工种）"
fi

# ==============================================
# 测试总结
# ==============================================
echo ""
echo "============================================"
echo "              测试总结"
echo "============================================"
echo "总测试数: ${TESTS_RUN}"
echo -e "${GREEN}通过: ${TESTS_PASSED}${NC}"
echo -e "${RED}失败: ${TESTS_FAILED}${NC}"
echo "通过率: $(python3 -c "print(f'{${TESTS_PASSED}/${TESTS_RUN}*100:.1f}%')")"
echo "完成时间: $(date)"
echo "============================================"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}❌ 有测试失败！${NC}"
    exit 1
fi
