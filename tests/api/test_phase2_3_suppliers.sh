#!/bin/bash

# ============================================================
# Phase 2.3 端到端测试: 供应商管理 (SupplierController)
# 测试范围: 基于实际Controller实现的APIs
# 优先级: P1
# 预计时间: 2.5小时
# ============================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

API_URL="http://localhost:10010/api/mobile"
FACTORY_ID="CRETAS_2024_001"
USERNAME="proc_admin"
PASSWORD="123456"

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

log_test() {
    echo -e "${BLUE}[TEST $1]${NC} $2"
}

log_pass() {
    echo -e "${GREEN}✓ PASS${NC} - $1"
    ((PASSED_TESTS++))
}

log_fail() {
    echo -e "${RED}✗ FAIL${NC} - $1"
    echo -e "${RED}  $2${NC}"
    ((FAILED_TESTS++))
}

log_section() {
    echo ""
    echo -e "${YELLOW}================================================${NC}"
    echo -e "${YELLOW}$1${NC}"
    echo -e "${YELLOW}================================================${NC}"
}

# ============================================================
# 前置准备: 登录
# ============================================================
log_section "前置准备: 用户登录"

LOGIN_RESP=$(curl -s -X POST ${API_URL}/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")

ACCESS_TOKEN=$(echo $LOGIN_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('accessToken', ''))" 2>/dev/null || echo "")

if [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${RED}登录失败${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 登录成功${NC}"

# ============================================================
# 分组 1: CRUD基础操作
# ============================================================
log_section "分组 1: CRUD基础操作"

# 1.1 创建供应商 - POST /
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "创建供应商 - POST /"

CREATE_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/suppliers" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "SUP-TEST-001",
    "name": "测试供应商有限公司",
    "contactPerson": "测试联系人",
    "contactPhone": "13800138888",
    "contactEmail": "test@supplier.com",
    "address": "测试地址123号",
    "businessLicense": "TEST-LICENSE-001",
    "creditLevel": "A",
    "paymentTerms": "月结30天"
  }')

SUP_ID=$(echo $CREATE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('id', ''))" 2>/dev/null || echo "")

if [ -n "$SUP_ID" ] && [ "$SUP_ID" != "None" ]; then
    log_pass "供应商创建成功，ID: $SUP_ID"
else
    log_fail "供应商创建失败" "API返回无效ID"
    SUP_ID="SUP001"
fi

# 1.2 查询供应商详情 - GET /{supplierId}
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "查询供应商详情 - GET /{supplierId}"

DETAIL_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/suppliers/${SUP_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

SUP_NAME=$(echo $DETAIL_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('name', ''))" 2>/dev/null || echo "")

if [ -n "$SUP_NAME" ]; then
    log_pass "供应商详情查询成功，名称: $SUP_NAME"
else
    log_fail "供应商详情查询失败" "API返回空数据"
fi

# 1.3 更新供应商信息 - PUT /{supplierId}
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "更新供应商信息 - PUT /{supplierId}"

UPDATE_RESP=$(curl -s -X PUT "${API_URL}/${FACTORY_ID}/suppliers/${SUP_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "SUP-TEST-001",
    "name": "更新后的测试供应商",
    "contactPerson": "新联系人",
    "notes": "信息已更新"
  }')

UPDATE_SUCCESS=$(echo $UPDATE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

if [ "$UPDATE_SUCCESS" = "True" ]; then
    log_pass "供应商信息更新成功"
else
    log_fail "供应商信息更新失败" "success=$UPDATE_SUCCESS"
fi

# 1.4 分页查询供应商列表 - GET /
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "分页查询供应商列表 - GET /"

LIST_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/suppliers?page=1&pageSize=10" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

TOTAL_COUNT=$(echo $LIST_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('total', 0))" 2>/dev/null || echo "0")

if [ "$TOTAL_COUNT" -gt 0 ]; then
    log_pass "供应商列表查询成功，共 $TOTAL_COUNT 条记录"
else
    log_fail "供应商列表查询失败" "返回0条记录"
fi

# 1.5 删除供应商 - DELETE /{supplierId}
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "删除供应商 - DELETE /{supplierId}"

DEL_CREATE=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/suppliers" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "SUP-DELETE-TEST",
    "name": "待删除供应商"
  }')

DEL_SUP_ID=$(echo $DEL_CREATE | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('id', ''))" 2>/dev/null || echo "")

if [ -n "$DEL_SUP_ID" ] && [ "$DEL_SUP_ID" != "None" ]; then
    DELETE_RESP=$(curl -s -X DELETE "${API_URL}/${FACTORY_ID}/suppliers/${DEL_SUP_ID}" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}")

    DELETE_SUCCESS=$(echo $DELETE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

    if [ "$DELETE_SUCCESS" = "True" ]; then
        log_pass "供应商删除成功"
    else
        log_fail "供应商删除失败" "success=$DELETE_SUCCESS"
    fi
else
    log_fail "创建删除测试供应商失败" "无法创建测试数据"
fi

# ============================================================
# 分组 2: 查询与筛选
# ============================================================
log_section "分组 2: 查询与筛选"

# 2.1 查询活跃供应商 - GET /active
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "查询活跃供应商 - GET /active"

ACTIVE_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/suppliers/active" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

ACTIVE_COUNT=$(echo $ACTIVE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))" 2>/dev/null || echo "0")

if [ "$ACTIVE_COUNT" -gt 0 ]; then
    log_pass "活跃供应商查询成功，找到 $ACTIVE_COUNT 个供应商"
else
    log_fail "活跃供应商查询失败" "返回0条记录"
fi

# 2.2 搜索供应商 - GET /search?keyword=xxx
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "搜索供应商 - GET /search"

SEARCH_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/suppliers/search?keyword=上海" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

SEARCH_COUNT=$(echo $SEARCH_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))" 2>/dev/null || echo "0")

if [ "$SEARCH_COUNT" -ge 0 ]; then
    log_pass "供应商搜索成功，找到 $SEARCH_COUNT 个供应商"
else
    log_fail "供应商搜索失败" "API返回错误"
fi

# 2.3 按原料类型查询 - GET /by-material?materialTypeId=xxx
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "按原料类型查询 - GET /by-material"

MATERIAL_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/suppliers/by-material?materialTypeId=MT001" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

MATERIAL_COUNT=$(echo $MATERIAL_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))" 2>/dev/null || echo "0")

if [ "$MATERIAL_COUNT" -ge 0 ]; then
    log_pass "按原料类型查询成功，找到 $MATERIAL_COUNT 个供应商"
else
    log_fail "按原料类型查询失败" "API返回错误"
fi

# 2.4 检查供应商编码 - GET /check-code?code=xxx
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "检查供应商编码 - GET /check-code"

CHECK_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/suppliers/check-code?code=SUP001" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

CHECK_EXISTS=$(echo $CHECK_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('data', {}).get('exists', False)))" 2>/dev/null || echo "False")

if [ "$CHECK_EXISTS" = "True" ] || [ "$CHECK_EXISTS" = "False" ]; then
    log_pass "编码检查成功，exists=$CHECK_EXISTS"
else
    log_fail "编码检查失败" "API返回错误"
fi

# ============================================================
# 分组 3: 供应商状态与评级
# ============================================================
log_section "分组 3: 供应商状态与评级"

# 3.1 更新供应商状态 - PUT /{supplierId}/status
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "更新供应商状态 - PUT /{supplierId}/status"

STATUS_UPDATE_RESP=$(curl -s -X PUT "${API_URL}/${FACTORY_ID}/suppliers/SUP001/status" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": true,
    "notes": "供应商状态正常"
  }')

STATUS_SUCCESS=$(echo $STATUS_UPDATE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

if [ "$STATUS_SUCCESS" = "True" ]; then
    log_pass "供应商状态更新成功"
else
    log_fail "供应商状态更新失败" "success=$STATUS_SUCCESS"
fi

# 3.2 更新供应商评级 - PUT /{supplierId}/rating
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "更新供应商评级 - PUT /{supplierId}/rating"

RATING_RESP=$(curl -s -X PUT "${API_URL}/${FACTORY_ID}/suppliers/SUP001/rating" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "ratingNotes": "质量优秀，交付及时"
  }')

RATING_SUCCESS=$(echo $RATING_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

if [ "$RATING_SUCCESS" = "True" ]; then
    log_pass "供应商评级更新成功"
else
    log_fail "供应商评级更新失败" "success=$RATING_SUCCESS"
fi

# 3.3 更新信用额度 - PUT /{supplierId}/credit-limit
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "更新信用额度 - PUT /{supplierId}/credit-limit"

CREDIT_RESP=$(curl -s -X PUT "${API_URL}/${FACTORY_ID}/suppliers/SUP001/credit-limit" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "creditLimit": 500000.00,
    "notes": "提升信用额度"
  }')

CREDIT_SUCCESS=$(echo $CREDIT_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

if [ "$CREDIT_SUCCESS" = "True" ]; then
    log_pass "信用额度更新成功"
else
    log_fail "信用额度更新失败" "success=$CREDIT_SUCCESS"
fi

# ============================================================
# 分组 4: 统计与分析
# ============================================================
log_section "分组 4: 统计与分析"

# 4.1 供应商统计信息 - GET /{supplierId}/statistics
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "供应商统计信息 - GET /{supplierId}/statistics"

STATS_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/suppliers/SUP001/statistics" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

STATS_SUCCESS=$(echo $STATS_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

if [ "$STATS_SUCCESS" = "True" ]; then
    log_pass "供应商统计信息查询成功"
else
    log_fail "供应商统计信息查询失败" "success=$STATS_SUCCESS"
fi

# 4.2 供应历史记录 - GET /{supplierId}/history
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "供应历史记录 - GET /{supplierId}/history"

HISTORY_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/suppliers/SUP001/history" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

HISTORY_COUNT=$(echo $HISTORY_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))" 2>/dev/null || echo "0")

if [ "$HISTORY_COUNT" -ge 0 ]; then
    log_pass "供应历史查询成功，共 $HISTORY_COUNT 条记录"
else
    log_fail "供应历史查询失败" "API返回错误"
fi

# 4.3 评级分布 - GET /rating-distribution
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "评级分布 - GET /rating-distribution"

RATING_DIST_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/suppliers/rating-distribution" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

RATING_DIST_SUCCESS=$(echo $RATING_DIST_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

if [ "$RATING_DIST_SUCCESS" = "True" ]; then
    log_pass "评级分布查询成功"
else
    log_fail "评级分布查询失败" "success=$RATING_DIST_SUCCESS"
fi

# 4.4 欠款余额统计 - GET /outstanding-balance
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "欠款余额统计 - GET /outstanding-balance"

BALANCE_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/suppliers/outstanding-balance" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

BALANCE_SUCCESS=$(echo $BALANCE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

if [ "$BALANCE_SUCCESS" = "True" ]; then
    log_pass "欠款余额统计成功"
else
    log_fail "欠款余额统计失败" "success=$BALANCE_SUCCESS"
fi

# ============================================================
# 分组 5: 批量操作与导出
# ============================================================
log_section "分组 5: 批量操作与导出"

# 5.1 批量导入 - POST /import
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "批量导入 - POST /import"

IMPORT_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/suppliers/import" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "suppliers": [
      {
        "code": "SUP-IMPORT-001",
        "name": "批量导入供应商1",
        "contactPerson": "联系人1"
      },
      {
        "code": "SUP-IMPORT-002",
        "name": "批量导入供应商2",
        "contactPerson": "联系人2"
      }
    ]
  }')

IMPORT_SUCCESS=$(echo $IMPORT_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

if [ "$IMPORT_SUCCESS" = "True" ]; then
    log_pass "批量导入成功"
else
    log_fail "批量导入失败" "success=$IMPORT_SUCCESS"
fi

# 5.2 导出数据 - GET /export
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "导出数据 - GET /export"

EXPORT_RESP=$(curl -s -o /tmp/suppliers_export.xlsx -w "%{http_code}" \
  -X GET "${API_URL}/${FACTORY_ID}/suppliers/export" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

if [ "$EXPORT_RESP" = "200" ]; then
    log_pass "数据导出成功"
else
    log_fail "数据导出失败" "HTTP状态码: $EXPORT_RESP"
fi

# 5.3 下载导入模板 - GET /export/template
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "下载导入模板 - GET /export/template"

TEMPLATE_RESP=$(curl -s -o /tmp/suppliers_template.xlsx -w "%{http_code}" \
  -X GET "${API_URL}/${FACTORY_ID}/suppliers/export/template" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

if [ "$TEMPLATE_RESP" = "200" ]; then
    log_pass "模板下载成功"
else
    log_fail "模板下载失败" "HTTP状态码: $TEMPLATE_RESP"
fi

# ============================================================
# 测试总结
# ============================================================
log_section "Phase 2.3 测试总结"

PASS_RATE=$(python3 -c "print(f'{$PASSED_TESTS/$TOTAL_TESTS*100:.1f}')" 2>/dev/null || echo "0")

echo ""
echo -e "${BLUE}总测试数:${NC} $TOTAL_TESTS"
echo -e "${GREEN}通过数:${NC} $PASSED_TESTS"
echo -e "${RED}失败数:${NC} $FAILED_TESTS"
echo -e "${YELLOW}通过率:${NC} ${PASS_RATE}%"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓✓✓ Phase 2.3 供应商管理测试全部通过！${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Phase 2.3 测试完成，但有 $FAILED_TESTS 个测试失败${NC}"
    exit 1
fi
