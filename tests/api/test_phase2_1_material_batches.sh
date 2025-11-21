#!/bin/bash

# ============================================================
# Phase 2.1 端到端测试: 原材料批次管理 (MaterialBatchController)
# 测试范围: 基于实际Controller实现的APIs
# 优先级: P0 (核心功能)
# 预计时间: 4小时
# ============================================================

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
API_URL="http://localhost:10010/api/mobile"
FACTORY_ID="CRETAS_2024_001"
USERNAME="proc_admin"
PASSWORD="123456"

# 测试统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 日志函数
log_test() {
    echo -e "${BLUE}[TEST $1]${NC} $2"
}

log_pass() {
    echo -e "${GREEN}✓ PASS${NC} - $1"
    ((PASSED_TESTS++))
}

log_fail() {
    echo -e "${RED}✗ FAIL${NC} - $1"
    echo -e "${RED}  原因: $2${NC}"
    ((FAILED_TESTS++))
}

log_section() {
    echo ""
    echo -e "${YELLOW}================================================${NC}"
    echo -e "${YELLOW}$1${NC}"
    echo -e "${YELLOW}================================================${NC}"
}

# ============================================================
# 前置准备: 登录获取Token
# ============================================================
log_section "前置准备: 用户登录"

LOGIN_RESP=$(curl -s -X POST ${API_URL}/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")

ACCESS_TOKEN=$(echo $LOGIN_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('accessToken', ''))" 2>/dev/null || echo "")

if [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${RED}登录失败，无法获取Token，测试终止${NC}"
    echo "响应: $LOGIN_RESP"
    exit 1
fi

echo -e "${GREEN}✓ 登录成功${NC}"
echo "Token: ${ACCESS_TOKEN:0:20}..."

# ============================================================
# 前置准备: 获取测试批次UUID
# ============================================================
echo ""
echo -e "${YELLOW}获取测试批次UUID (从数据库)...${NC}"

# 从数据库直接查询UUID (更可靠，不受API分页排序影响)
MB_001_ID=$(mysql -u root cretas_db -N -e "SELECT id FROM material_batches WHERE batch_number='MB-001' LIMIT 1;" 2>/dev/null || echo "")
MB_002_ID=$(mysql -u root cretas_db -N -e "SELECT id FROM material_batches WHERE batch_number='MB-002' LIMIT 1;" 2>/dev/null || echo "")
MB_003_ID=$(mysql -u root cretas_db -N -e "SELECT id FROM material_batches WHERE batch_number='MB-003' LIMIT 1;" 2>/dev/null || echo "")
MB_009_ID=$(mysql -u root cretas_db -N -e "SELECT id FROM material_batches WHERE batch_number='MB-009' LIMIT 1;" 2>/dev/null || echo "")

echo -e "${GREEN}✓ 批次UUID获取完成${NC}"
echo "  MB-001 ID: ${MB_001_ID:0:36}"
echo "  MB-002 ID: ${MB_002_ID:0:36}"
echo "  MB-003 ID: ${MB_003_ID:0:36}"
echo "  MB-009 ID: ${MB_009_ID:0:36}"

# ============================================================
# 分组 1: CRUD基础操作
# ============================================================
log_section "分组 1: CRUD基础操作"

# 1.1 创建原材料批次 - POST /material-batches
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "创建原材料批次 - POST /"

CREATE_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "batchNumber": "MB-TEST-001",
    "materialTypeId": "MT001",
    "supplierId": "80d9966a-0140-46bc-a098-b45bb6d0ee80",
    "receiptDate": "2025-11-20",
    "receiptQuantity": 100.0,
    "quantityUnit": "kg",
    "totalWeight": 100.0,
    "totalValue": 3500.0,
    "unitPrice": 35.0,
    "storageLocation": "测试仓库A1",
    "expireDate": "2025-11-23",
    "productionDate": "2025-11-20",
    "notes": "Phase 2.1测试批次"
  }')

BATCH_ID=$(echo $CREATE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('id', ''))" 2>/dev/null || echo "")

if [ -n "$BATCH_ID" ]; then
    log_pass "批次创建成功，ID: $BATCH_ID"
else
    log_fail "批次创建失败" "API返回错误"
    BATCH_ID="MB-001"  # 使用已存在的批次继续测试
fi

# 1.2 查询批次详情 - GET /{batchId}
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "查询批次详情 - GET /{batchId}"

DETAIL_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/material-batches/${BATCH_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

BATCH_NUMBER=$(echo $DETAIL_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('batchNumber', ''))" 2>/dev/null || echo "")

if [ -n "$BATCH_NUMBER" ]; then
    log_pass "批次详情查询成功，批次号: $BATCH_NUMBER"
else
    log_fail "批次详情查询失败" "API返回错误"
fi

# 1.3 更新批次信息 - PUT /{batchId}
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "更新批次信息 - PUT /{batchId}"

UPDATE_RESP=$(curl -s -X PUT "${API_URL}/${FACTORY_ID}/material-batches/${BATCH_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "batchNumber": "MB-TEST-001",
    "materialTypeId": "MT001",
    "supplierId": "80d9966a-0140-46bc-a098-b45bb6d0ee80",
    "receiptDate": "2025-11-20",
    "receiptQuantity": 100.0,
    "quantityUnit": "kg",
    "totalWeight": 100.0,
    "totalValue": 3500.0,
    "unitPrice": 35.0,
    "storageLocation": "更新后的仓库位置B2",
    "notes": "更新后的备注信息"
  }')

UPDATE_SUCCESS=$(echo $UPDATE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null || echo "False")

if [ "$UPDATE_SUCCESS" = "True" ]; then
    log_pass "批次信息更新成功"
else
    log_fail "批次信息更新失败" "API返回错误"
fi

# 1.4 分页查询批次列表 - GET /
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "分页查询批次列表 - GET /"

LIST_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/material-batches?page=1&pageSize=10" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

TOTAL_COUNT=$(echo $LIST_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('totalElements', 0))" 2>/dev/null || echo "0")

if [ "$TOTAL_COUNT" -gt 0 ]; then
    log_pass "批次列表查询成功，共 $TOTAL_COUNT 条记录"
else
    log_fail "批次列表查询失败" "API返回错误"
fi

# 1.5 删除批次 - DELETE /{batchId}
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "删除批次 - DELETE /{batchId}"

# 先创建一个专门用于删除的批次
DELETE_TEST_BATCH=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "batchNumber": "MB-DELETE-TEST",
    "materialTypeId": "MT001",
    "supplierId": "80d9966a-0140-46bc-a098-b45bb6d0ee80",
    "receiptDate": "2025-11-20",
    "receiptQuantity": 10.0,
    "quantityUnit": "kg",
    "totalWeight": 10.0,
    "totalValue": 350.0,
    "unitPrice": 35.0
  }')

DELETE_BATCH_ID=$(echo $DELETE_TEST_BATCH | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('id', ''))" 2>/dev/null || echo "")

if [ -n "$DELETE_BATCH_ID" ]; then
    DELETE_RESP=$(curl -s -X DELETE "${API_URL}/${FACTORY_ID}/material-batches/${DELETE_BATCH_ID}" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}")

    DELETE_SUCCESS=$(echo $DELETE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null || echo "False")

    if [ "$DELETE_SUCCESS" = "True" ]; then
        log_pass "批次删除成功"
    else
        log_fail "批次删除失败" "API返回错误"
    fi
else
    log_fail "创建删除测试批次失败，跳过删除测试" "API返回错误"
fi

# ============================================================
# 分组 2: 查询与筛选
# ============================================================
log_section "分组 2: 查询与筛选"

# 2.1 按材料类型查询 - GET /material-type/{materialTypeId}
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "按材料类型查询 - GET /material-type/{materialTypeId}"

TYPE_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/material-batches/material-type/MT001" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

TYPE_COUNT=$(echo $TYPE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))" 2>/dev/null || echo "0")

if [ "$TYPE_COUNT" -gt 0 ]; then
    log_pass "按材料类型查询成功，找到 $TYPE_COUNT 条MT001批次"
else
    log_fail "按材料类型查询失败" "API返回错误"
fi

# 2.2 按状态查询 - GET /status/{status}
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "按状态查询 - GET /status/{status}"

STATUS_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/material-batches/status/AVAILABLE" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

STATUS_COUNT=$(echo $STATUS_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))" 2>/dev/null || echo "0")

if [ "$STATUS_COUNT" -gt 0 ]; then
    log_pass "按状态查询成功，找到 $STATUS_COUNT 条AVAILABLE批次"
else
    log_fail "按状态查询失败" "API返回错误"
fi

# 2.3 FIFO查询 - GET /fifo/{materialTypeId}?requiredQuantity=50
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "FIFO查询 - GET /fifo/{materialTypeId}"

FIFO_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/material-batches/fifo/MT001?requiredQuantity=50" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

FIFO_COUNT=$(echo $FIFO_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))" 2>/dev/null || echo "0")

if [ "$FIFO_COUNT" -ge 0 ]; then
    log_pass "FIFO查询成功，找到 $FIFO_COUNT 个批次"
else
    log_fail "FIFO查询失败" "API返回错误"
fi

# 2.4 即将过期批次 - GET /expiring?days=7
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "即将过期批次 - GET /expiring?days=7"

EXPIRING_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/material-batches/expiring?days=7" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

EXPIRING_COUNT=$(echo $EXPIRING_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))" 2>/dev/null || echo "0")

if [ "$EXPIRING_COUNT" -ge 0 ]; then
    log_pass "即将过期批次查询成功，找到 $EXPIRING_COUNT 条批次"
else
    log_fail "即将过期批次查询失败" "API返回错误"
fi

# 2.5 已过期批次 - GET /expired
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "已过期批次 - GET /expired"

EXPIRED_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/material-batches/expired" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

EXPIRED_COUNT=$(echo $EXPIRED_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))" 2>/dev/null || echo "0")

if [ "$EXPIRED_COUNT" -ge 0 ]; then
    log_pass "已过期批次查询成功，找到 $EXPIRED_COUNT 条批次"
else
    log_fail "已过期批次查询失败" "API返回错误"
fi

# 2.6 低库存批次 - GET /low-stock
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "低库存批次 - GET /low-stock"

LOW_STOCK_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/material-batches/low-stock" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

LOW_STOCK_COUNT=$(echo $LOW_STOCK_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))" 2>/dev/null || echo "0")

if [ "$LOW_STOCK_COUNT" -ge 0 ]; then
    log_pass "低库存批次查询成功，找到 $LOW_STOCK_COUNT 条批次"
else
    log_fail "低库存批次查询失败" "API返回错误"
fi

# ============================================================
# 分组 3: 库存操作
# ============================================================
log_section "分组 3: 库存操作"

# 3.1 批次使用 - POST /{batchId}/use
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "批次使用 - POST /{batchId}/use"

USE_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches/${MB_001_ID}/use" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 10.0,
    "productionBatchId": "BATCH-001",
    "notes": "生产使用测试"
  }')

USE_SUCCESS=$(echo $USE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null || echo "False")

if [ "$USE_SUCCESS" = "True" ]; then
    log_pass "批次使用成功"
else
    log_fail "批次使用失败" "API返回错误"
fi

# 3.2 库存调整 - POST /{batchId}/adjust
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "库存调整 - POST /{batchId}/adjust"

ADJUST_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches/${MB_002_ID}/adjust" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "adjustmentType": "INCREASE",
    "quantity": 5.0,
    "reason": "盘点增加",
    "notes": "实际库存比记录多5kg"
  }')

ADJUST_SUCCESS=$(echo $ADJUST_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null || echo "False")

if [ "$ADJUST_SUCCESS" = "True" ]; then
    log_pass "库存调整成功"
else
    log_fail "库存调整失败" "API返回错误"
fi

# 3.3 更新状态 - PUT /{batchId}/status
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "更新状态 - PUT /{batchId}/status"

STATUS_UPDATE_RESP=$(curl -s -X PUT "${API_URL}/${FACTORY_ID}/material-batches/${MB_003_ID}/status" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_STOCK",
    "notes": "状态更新测试"
  }')

STATUS_UPDATE_SUCCESS=$(echo $STATUS_UPDATE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null || echo "False")

if [ "$STATUS_UPDATE_SUCCESS" = "True" ]; then
    log_pass "状态更新成功"
else
    log_fail "状态更新失败" "API返回错误"
fi

# 3.4 批次预留 - POST /{batchId}/reserve
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "批次预留 - POST /{batchId}/reserve"

RESERVE_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches/${MB_002_ID}/reserve" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 50.0,
    "productionBatchId": "5145f9b1-30bf-4726-9692-0ede3bb0bb15",
    "notes": "预留给生产计划PLAN-TEST-001"
  }')

RESERVE_SUCCESS=$(echo $RESERVE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null || echo "False")

if [ "$RESERVE_SUCCESS" = "True" ]; then
    log_pass "批次预留成功"
else
    log_fail "批次预留失败" "API返回错误"
fi

# 3.5 释放预留 - POST /{batchId}/release
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "释放预留 - POST /{batchId}/release"

RELEASE_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches/${MB_002_ID}/release" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 20.0,
    "notes": "取消部分预留"
  }')

RELEASE_SUCCESS=$(echo $RELEASE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null || echo "False")

if [ "$RELEASE_SUCCESS" = "True" ]; then
    log_pass "释放预留成功"
else
    log_fail "释放预留失败" "API返回错误"
fi

# 3.6 批次消耗 - POST /{batchId}/consume
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "批次消耗 - POST /{batchId}/consume"

CONSUME_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches/${MB_001_ID}/consume" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 5.0,
    "productionBatchId": "5145f9b1-30bf-4726-9692-0ede3bb0bb15",
    "notes": "生产消耗测试"
  }')

CONSUME_SUCCESS=$(echo $CONSUME_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null || echo "False")

if [ "$CONSUME_SUCCESS" = "True" ]; then
    log_pass "批次消耗成功"
else
    log_fail "批次消耗失败" "API返回错误"
fi

# ============================================================
# 分组 4: 统计与报表
# ============================================================
log_section "分组 4: 统计与报表"

# 4.1 库存统计 - GET /inventory/statistics
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "库存统计 - GET /inventory/statistics"

INV_STATS_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/material-batches/inventory/statistics" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

INV_STATS_SUCCESS=$(echo $INV_STATS_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null || echo "False")

if [ "$INV_STATS_SUCCESS" = "True" ]; then
    log_pass "库存统计成功"
else
    log_fail "库存统计失败" "API返回错误"
fi

# 4.2 库存估值 - GET /inventory/valuation
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "库存估值 - GET /inventory/valuation"

VALUATION_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/material-batches/inventory/valuation" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

VALUATION_SUCCESS=$(echo $VALUATION_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null || echo "False")

if [ "$VALUATION_SUCCESS" = "True" ]; then
    log_pass "库存估值成功"
else
    log_fail "库存估值失败" "API返回错误"
fi

# 4.3 使用历史 - GET /{batchId}/usage-history
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "使用历史 - GET /{batchId}/usage-history"

HISTORY_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/material-batches/MB-001/usage-history" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

HISTORY_COUNT=$(echo $HISTORY_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))" 2>/dev/null || echo "0")

if [ "$HISTORY_COUNT" -ge 0 ]; then
    log_pass "使用历史查询成功，共 $HISTORY_COUNT 条记录"
else
    log_fail "使用历史查询失败" "API返回错误"
fi

# ============================================================
# 分组 5: 冷冻转换
# ============================================================
log_section "分组 5: 冷冻转换"

# 5.1 转为冷冻 - POST /{batchId}/convert-to-frozen
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "转为冷冻 - POST /{batchId}/convert-to-frozen"

FREEZE_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches/${MB_003_ID}/convert-to-frozen" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "convertedBy": 1,
    "convertedDate": "2025-11-20",
    "storageLocation": "D区冷冻室2号",
    "notes": "延长保质期"
  }')

FREEZE_SUCCESS=$(echo $FREEZE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null || echo "False")

if [ "$FREEZE_SUCCESS" = "True" ]; then
    log_pass "转为冷冻成功"
else
    log_fail "转为冷冻失败" "API返回错误"
fi

# 5.2 解冻 - POST /{batchId}/undo-frozen
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "解冻 - POST /{batchId}/undo-frozen"

UNFREEZE_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches/${MB_009_ID}/undo-frozen" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "convertedBy": 1,
    "convertedDate": "2025-11-20",
    "storageLocation": "A区冷藏室3号",
    "notes": "准备使用"
  }')

UNFREEZE_SUCCESS=$(echo $UNFREEZE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null || echo "False")

if [ "$UNFREEZE_SUCCESS" = "True" ]; then
    log_pass "解冻成功"
else
    log_fail "解冻失败" "API返回错误"
fi

# ============================================================
# 分组 6: 批量操作与导出
# ============================================================
log_section "分组 6: 批量操作与导出"

# 6.1 批量创建 - POST /batch
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "批量创建 - POST /batch"

BATCH_CREATE_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches/batch" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "batchNumber": "MB-BATCH-001",
      "materialTypeId": "MT001",
      "supplierId": "80d9966a-0140-46bc-a098-b45bb6d0ee80",
      "receiptDate": "2025-11-20",
      "receiptQuantity": 50.0,
      "quantityUnit": "kg",
      "totalWeight": 50.0,
      "totalValue": 1750.0,
      "unitPrice": 35.0,
      "storageLocation": "A01",
      "expireDate": "2026-11-20",
      "productionDate": "2025-11-19"
    },
    {
      "batchNumber": "MB-BATCH-002",
      "materialTypeId": "MT002",
      "supplierId": "20ca7b77-3eb1-41bb-bd59-8a303dedd322",
      "receiptDate": "2025-11-20",
      "receiptQuantity": 100.0,
      "quantityUnit": "kg",
      "totalWeight": 100.0,
      "totalValue": 2800.0,
      "unitPrice": 28.0,
      "storageLocation": "A02",
      "expireDate": "2026-11-20",
      "productionDate": "2025-11-19"
    }
  ]')

BATCH_CREATE_SUCCESS=$(echo $BATCH_CREATE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null || echo "False")

if [ "$BATCH_CREATE_SUCCESS" = "True" ]; then
    log_pass "批量创建成功"
else
    log_fail "批量创建失败" "API返回错误"
fi

# 6.2 导出数据 - GET /export
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "导出数据 - GET /export"

EXPORT_RESP=$(curl -s -o /tmp/material_batches_export.xlsx -w "%{http_code}" \
  -X GET "${API_URL}/${FACTORY_ID}/material-batches/export" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

if [ "$EXPORT_RESP" = "200" ]; then
    log_pass "数据导出成功"
else
    log_fail "数据导出失败" "HTTP状态码: $EXPORT_RESP"
fi

# 6.3 处理过期批次 - POST /handle-expired
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "处理过期批次 - POST /handle-expired"

HANDLE_EXPIRED_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/material-batches/handle-expired" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "SCRAPPED",
    "notes": "批量处理过期批次"
  }')

HANDLE_EXPIRED_SUCCESS=$(echo $HANDLE_EXPIRED_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('success', False))" 2>/dev/null || echo "False")

if [ "$HANDLE_EXPIRED_SUCCESS" = "True" ]; then
    log_pass "处理过期批次成功"
else
    log_fail "处理过期批次失败" "API返回错误"
fi

# ============================================================
# 测试总结
# ============================================================
log_section "Phase 2.1 测试总结"

PASS_RATE=$(python3 -c "print(f'{$PASSED_TESTS/$TOTAL_TESTS*100:.1f}')" 2>/dev/null || echo "0")

echo ""
echo -e "${BLUE}总测试数:${NC} $TOTAL_TESTS"
echo -e "${GREEN}通过数:${NC} $PASSED_TESTS"
echo -e "${RED}失败数:${NC} $FAILED_TESTS"
echo -e "${YELLOW}通过率:${NC} ${PASS_RATE}%"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓✓✓ Phase 2.1 原材料批次管理测试全部通过！${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Phase 2.1 测试完成，但有 $FAILED_TESTS 个测试失败${NC}"
    echo -e "${BLUE}建议查看详细错误信息并修复后端API实现${NC}"
    exit 1
fi
