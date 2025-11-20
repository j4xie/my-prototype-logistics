#!/bin/bash
#
# Supplier API E2E测试脚本
# 测试所有8个MVP核心API端点
#
# 使用方法: ./test-suppliers-e2e.sh
#
# Author: Claude (AI Assistant)
# Date: 2025-11-19

set -e  # 遇到错误立即退出

BASE_URL="http://localhost:10010"
FACTORY_ID="CRETAS_2024_001"
API_PATH="/api/mobile/${FACTORY_ID}/suppliers"

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
echo "   Supplier API E2E 测试"
echo "============================================"
echo "BASE_URL: ${BASE_URL}"
echo "FACTORY_ID: ${FACTORY_ID}"
echo "开始时间: $(date)"
echo "============================================"

# ==============================================
# 测试1: GET - 获取供应商列表（分页）
# ==============================================
print_test "1/8" "GET ${API_PATH}"
((TESTS_RUN++))

RESPONSE=$(curl -s "${BASE_URL}${API_PATH}")
SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")
TOTAL=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['data']['totalElements'])" 2>/dev/null || echo "0")

if [ "$SUCCESS" = "True" ] && [ "$TOTAL" -gt 0 ]; then
    print_success "获取到 ${TOTAL} 条供应商记录"
else
    print_failure "获取供应商列表失败"
fi

# ==============================================
# 测试2: POST - 创建供应商
# ==============================================
print_test "2/8" "POST ${API_PATH}"
((TESTS_RUN++))

NEW_SUPPLIER=$(cat <<EOF
{
  "supplierCode": "TEST_$(date +%s)",
  "name": "测试供应商_$(date +%s)",
  "contactPerson": "测试联系人",
  "contactPhone": "+8613800000000",
  "address": "测试地址",
  "businessType": "测试业务",
  "creditLevel": "A",
  "deliveryArea": "测试区域",
  "paymentTerms": "测试条款"
}
EOF
)

RESPONSE=$(curl -s -X POST "${BASE_URL}${API_PATH}" \
  -H "Content-Type: application/json" \
  -d "$NEW_SUPPLIER")

SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")
CREATED_ID=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('id', ''))" 2>/dev/null)

if [ "$SUCCESS" = "True" ] && [ -n "$CREATED_ID" ]; then
    print_success "创建成功, ID: ${CREATED_ID:0:8}..."
    TEMP_SUPPLIER_ID=$CREATED_ID
else
    print_failure "创建供应商失败"
    TEMP_SUPPLIER_ID=""
fi

# ==============================================
# 测试3: GET - 获取单个供应商详情
# ==============================================
print_test "3/8" "GET ${API_PATH}/{id}"
((TESTS_RUN++))

if [ -n "$TEMP_SUPPLIER_ID" ]; then
    RESPONSE=$(curl -s "${BASE_URL}${API_PATH}/${TEMP_SUPPLIER_ID}")
    SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")
    NAME=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('name', ''))")

    if [ "$SUCCESS" = "True" ]; then
        print_success "获取详情成功: ${NAME}"
    else
        print_failure "获取详情失败"
    fi
else
    print_info "跳过（未创建测试供应商）"
fi

# ==============================================
# 测试4: PUT - 更新供应商
# ==============================================
print_test "4/8" "PUT ${API_PATH}/{id}"
((TESTS_RUN++))

if [ -n "$TEMP_SUPPLIER_ID" ]; then
    UPDATE_DATA=$(cat <<EOF
{
  "address": "更新后的地址",
  "contactPhone": "+8613900000001"
}
EOF
    )

    RESPONSE=$(curl -s -X PUT "${BASE_URL}${API_PATH}/${TEMP_SUPPLIER_ID}" \
      -H "Content-Type: application/json" \
      -d "$UPDATE_DATA")

    SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")

    if [ "$SUCCESS" = "True" ]; then
        print_success "更新成功"
    else
        print_failure "更新失败"
    fi
else
    print_info "跳过（未创建测试供应商）"
fi

# ==============================================
# 测试5: GET - 获取激活的供应商列表
# ==============================================
print_test "5/8" "GET ${API_PATH}/active"
((TESTS_RUN++))

RESPONSE=$(curl -s "${BASE_URL}${API_PATH}/active")
SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")
ACTIVE_COUNT=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('data', [])))")

if [ "$SUCCESS" = "True" ]; then
    print_success "获取到 ${ACTIVE_COUNT} 条激活的供应商"
else
    print_failure "获取激活的供应商失败"
fi

# ==============================================
# 测试6: GET - 搜索供应商
# ==============================================
print_test "6/8" "GET ${API_PATH}/search"
((TESTS_RUN++))

RESPONSE=$(curl -s "${BASE_URL}${API_PATH}/search?keyword=SUP")
SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")

if [ "$SUCCESS" = "True" ]; then
    SEARCH_COUNT=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('data', [])))")
    print_success "搜索成功，找到 ${SEARCH_COUNT} 条记录"
else
    print_failure "搜索失败"
fi

# ==============================================
# 测试7: PUT - 切换供应商状态
# ==============================================
print_test "7/8" "PUT ${API_PATH}/{id}/status"
((TESTS_RUN++))

if [ -n "$TEMP_SUPPLIER_ID" ]; then
    STATUS_DATA=$(cat <<EOF
{
  "isActive": false
}
EOF
    )

    RESPONSE=$(curl -s -X PUT "${BASE_URL}${API_PATH}/${TEMP_SUPPLIER_ID}/status" \
      -H "Content-Type: application/json" \
      -d "$STATUS_DATA")

    SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")
    IS_ACTIVE=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('isActive', True))")

    if [ "$SUCCESS" = "True" ] && [ "$IS_ACTIVE" = "False" ]; then
        print_success "状态切换成功"
    else
        print_failure "状态切换失败"
    fi
else
    print_info "跳过（未创建测试供应商）"
fi

# ==============================================
# 测试8: DELETE - 删除供应商
# ==============================================
print_test "8/8" "DELETE ${API_PATH}/{id}"
((TESTS_RUN++))

if [ -n "$TEMP_SUPPLIER_ID" ]; then
    RESPONSE=$(curl -s -X DELETE "${BASE_URL}${API_PATH}/${TEMP_SUPPLIER_ID}")
    SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")

    if [ "$SUCCESS" = "True" ]; then
        print_success "删除成功"
    else
        print_failure "删除失败"
    fi
else
    print_info "跳过（未创建测试供应商）"
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
