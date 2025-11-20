#!/bin/bash
#
# MaterialType API E2E测试脚本
# 测试所有13个API端点
#
# 使用方法: ./test-material-types-e2e.sh
#
# Author: Claude (AI Assistant)
# Date: 2025-11-19

set -e  # 遇到错误立即退出

BASE_URL="http://localhost:10010"
FACTORY_ID="CRETAS_2024_001"
API_PATH="/api/mobile/${FACTORY_ID}/materials/types"

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
echo "   MaterialType API E2E 测试"
echo "============================================"
echo "BASE_URL: ${BASE_URL}"
echo "FACTORY_ID: ${FACTORY_ID}"
echo "开始时间: $(date)"
echo "============================================"

# ==============================================
# 测试1: GET - 获取原材料类型列表（分页）
# ==============================================
print_test "1/13" "GET ${API_PATH}"
((TESTS_RUN++))

RESPONSE=$(curl -s "${BASE_URL}${API_PATH}")
SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")
TOTAL=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['data']['totalElements'])" 2>/dev/null || echo "0")

if [ "$SUCCESS" = "True" ] && [ "$TOTAL" -gt 0 ]; then
    print_success "获取到 ${TOTAL} 条原材料类型记录"
else
    print_failure "获取原材料类型列表失败"
fi

# ==============================================
# 测试2: GET - 获取激活的原材料类型
# ==============================================
print_test "2/13" "GET ${API_PATH}/active"
((TESTS_RUN++))

RESPONSE=$(curl -s "${BASE_URL}${API_PATH}/active")
SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")
ACTIVE_COUNT=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('data', [])))")

if [ "$SUCCESS" = "True" ]; then
    print_success "获取到 ${ACTIVE_COUNT} 条激活的原材料类型"
else
    print_failure "获取激活的原材料类型失败"
fi

# ==============================================
# 测试3: GET - 获取类别列表
# ==============================================
print_test "3/13" "GET ${API_PATH}/categories"
((TESTS_RUN++))

RESPONSE=$(curl -s "${BASE_URL}${API_PATH}/categories")
SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")
CATEGORIES=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(', '.join(d.get('data', [])))")

if [ "$SUCCESS" = "True" ]; then
    print_success "获取到类别: ${CATEGORIES}"
else
    print_failure "获取类别列表失败"
fi

# ==============================================
# 测试4: GET - 检查原材料编码
# ==============================================
print_test "4/13" "GET ${API_PATH}/check-code"
((TESTS_RUN++))

# 检查已存在的编码
RESPONSE=$(curl -s "${BASE_URL}${API_PATH}/check-code?materialCode=DY")
EXISTS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('exists', False))")

if [ "$EXISTS" = "True" ]; then
    print_success "DY编码存在检查正确"
else
    print_failure "编码检查失败"
fi

# 检查不存在的编码
RESPONSE=$(curl -s "${BASE_URL}${API_PATH}/check-code?materialCode=NONEXISTENT")
EXISTS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('exists', False))")

if [ "$EXISTS" = "False" ]; then
    print_info "不存在的编码检查正确"
fi

# ==============================================
# 测试5: POST - 创建原材料类型
# ==============================================
print_test "5/13" "POST ${API_PATH}"
((TESTS_RUN++))

NEW_MATERIAL=$(cat <<EOF
{
  "name": "测试原材料_$(date +%s)",
  "materialCode": "TEST_$(date +%s)",
  "category": "测试类别",
  "unit": "kg",
  "storageType": "冷藏",
  "description": "E2E测试创建的原材料"
}
EOF
)

RESPONSE=$(curl -s -X POST "${BASE_URL}${API_PATH}" \
  -H "Content-Type: application/json" \
  -d "$NEW_MATERIAL")

SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")
CREATED_ID=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('id', ''))" 2>/dev/null)

if [ "$SUCCESS" = "True" ] && [ -n "$CREATED_ID" ]; then
    print_success "创建成功, ID: ${CREATED_ID}"
    TEMP_MATERIAL_ID=$CREATED_ID
else
    print_failure "创建原材料类型失败"
    TEMP_MATERIAL_ID=""
fi

# ==============================================
# 测试6: GET - 获取单个原材料类型详情
# ==============================================
print_test "6/13" "GET ${API_PATH}/{id}"
((TESTS_RUN++))

if [ -n "$TEMP_MATERIAL_ID" ]; then
    RESPONSE=$(curl -s "${BASE_URL}${API_PATH}/${TEMP_MATERIAL_ID}")
    SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")
    NAME=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('name', ''))")

    if [ "$SUCCESS" = "True" ]; then
        print_success "获取详情成功: ${NAME}"
    else
        print_failure "获取详情失败"
    fi
else
    print_info "跳过（未创建测试原材料）"
fi

# ==============================================
# 测试7: PUT - 更新原材料类型
# ==============================================
print_test "7/13" "PUT ${API_PATH}/{id}"
((TESTS_RUN++))

if [ -n "$TEMP_MATERIAL_ID" ]; then
    UPDATE_DATA=$(cat <<EOF
{
  "name": "更新后的原材料_$(date +%s)",
  "description": "已更新",
  "storageType": "常温"
}
EOF
    )

    RESPONSE=$(curl -s -X PUT "${BASE_URL}${API_PATH}/${TEMP_MATERIAL_ID}" \
      -H "Content-Type: application/json" \
      -d "$UPDATE_DATA")

    SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")

    if [ "$SUCCESS" = "True" ]; then
        print_success "更新成功"
    else
        print_failure "更新失败"
    fi
else
    print_info "跳过（未创建测试原材料）"
fi

# ==============================================
# 测试8: GET - 搜索原材料类型
# ==============================================
print_test "8/13" "GET ${API_PATH}/search"
((TESTS_RUN++))

RESPONSE=$(curl -s "${BASE_URL}${API_PATH}/search?keyword=DY")
SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")

if [ "$SUCCESS" = "True" ]; then
    SEARCH_COUNT=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('totalElements', 0))")
    print_success "搜索成功，找到 ${SEARCH_COUNT} 条记录"
else
    print_failure "搜索失败"
fi

# ==============================================
# 测试9: GET - 按类别获取原材料类型
# ==============================================
print_test "9/13" "GET ${API_PATH}/category/{category}"
((TESTS_RUN++))

RESPONSE=$(curl -s "${BASE_URL}${API_PATH}/category/海水鱼")
SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")
CATEGORY_COUNT=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('data', [])))")

if [ "$SUCCESS" = "True" ]; then
    print_success "按类别获取成功，找到 ${CATEGORY_COUNT} 条记录"
else
    print_failure "按类别获取失败"
fi

# ==============================================
# 测试10: GET - 按存储方式获取原材料类型
# ==============================================
print_test "10/13" "GET ${API_PATH}/storage-type/{storageType}"
((TESTS_RUN++))

RESPONSE=$(curl -s "${BASE_URL}${API_PATH}/storage-type/冷冻")
SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")
STORAGE_COUNT=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('data', [])))")

if [ "$SUCCESS" = "True" ]; then
    print_success "按存储方式获取成功，找到 ${STORAGE_COUNT} 条记录"
else
    print_failure "按存储方式获取失败"
fi

# ==============================================
# 测试11: GET - 获取低库存原材料
# ==============================================
print_test "11/13" "GET ${API_PATH}/low-stock"
((TESTS_RUN++))

RESPONSE=$(curl -s "${BASE_URL}${API_PATH}/low-stock")
SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")
LOW_STOCK_COUNT=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('data', [])))")

if [ "$SUCCESS" = "True" ]; then
    print_success "获取低库存原材料成功，找到 ${LOW_STOCK_COUNT} 条记录"
else
    print_failure "获取低库存原材料失败"
fi

# ==============================================
# 测试12: PUT - 批量更新状态
# ==============================================
print_test "12/13" "PUT ${API_PATH}/batch/status"
((TESTS_RUN++))

if [ -n "$TEMP_MATERIAL_ID" ]; then
    BATCH_DATA=$(cat <<EOF
{
  "ids": ["${TEMP_MATERIAL_ID}"],
  "isActive": false
}
EOF
    )

    RESPONSE=$(curl -s -X PUT "${BASE_URL}${API_PATH}/batch/status" \
      -H "Content-Type: application/json" \
      -d "$BATCH_DATA")

    SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")
    UPDATE_COUNT=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('count', 0))")

    if [ "$SUCCESS" = "True" ]; then
        print_success "批量更新成功，更新了 ${UPDATE_COUNT} 条记录"
    else
        print_failure "批量更新失败"
    fi
else
    print_info "跳过（未创建测试原材料）"
fi

# ==============================================
# 测试13: DELETE - 删除原材料类型
# ==============================================
print_test "13/13" "DELETE ${API_PATH}/{id}"
((TESTS_RUN++))

if [ -n "$TEMP_MATERIAL_ID" ]; then
    RESPONSE=$(curl -s -X DELETE "${BASE_URL}${API_PATH}/${TEMP_MATERIAL_ID}")
    SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))")

    if [ "$SUCCESS" = "True" ]; then
        print_success "删除成功"
    else
        print_failure "删除失败"
    fi
else
    print_info "跳过（未创建测试原材料）"
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
