#!/bin/bash

# MaterialBatch模块E2E测试脚本
# 测试所有23个Material Batch管理API

set -e  # Exit on error

# 配置
BASE_URL="http://localhost:10010"
FACTORY_ID="CRETAS_2024_001"
API_BASE="${BASE_URL}/api/mobile/${FACTORY_ID}/material-batches"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 计数器
PASSED=0
FAILED=0
TOTAL=23

# 辅助函数
print_test() {
    echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}测试 $1/$TOTAL: $2${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

check_response() {
    local response="$1"
    local test_name="$2"

    if echo "$response" | jq -e '.success == true' > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED: $test_name${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED: $test_name${NC}"
        echo "Response: $response"
        ((FAILED++))
        return 1
    fi
}

# 存储测试数据
BATCH_ID=""
BATCH_NUMBER="BATCH-TEST-$(date +%s)"

echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}   MaterialBatch 模块 E2E 测试 - 23个API${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"

# ========== 基础CRUD操作 (1-6) ==========

# API 1: 获取原料批次列表（空列表）
print_test 1 "获取原料批次列表"
RESPONSE=$(curl -s "${API_BASE}?page=0&size=10")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
check_response "$RESPONSE" "获取原料批次列表"

# API 2: 创建原料批次
print_test 2 "创建原料批次"
RESPONSE=$(curl -s -X POST "${API_BASE}" \
  -H "Content-Type: application/json" \
  -d "{
    \"batchNumber\": \"${BATCH_NUMBER}\",
    \"materialTypeId\": \"MATERIAL_TYPE_001\",
    \"inboundQuantity\": 1000.00,
    \"unitPrice\": 15.50,
    \"inboundDate\": \"2025-11-15\",
    \"expiryDate\": \"2026-11-15\",
    \"productionDate\": \"2025-11-10\",
    \"supplierId\": \"SUPPLIER_001\",
    \"qualityGrade\": \"A\",
    \"storageLocation\": \"仓库A-货架1\",
    \"notes\": \"测试批次\",
    \"createdBy\": 1
  }")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
if check_response "$RESPONSE" "创建原料批次"; then
    BATCH_ID=$(echo "$RESPONSE" | jq -r '.data.id')
    echo -e "批次ID: ${GREEN}${BATCH_ID}${NC}"
fi

# API 3: 批量创建原料批次
print_test 3 "批量创建原料批次"
RESPONSE=$(curl -s -X POST "${API_BASE}/batch" \
  -H "Content-Type: application/json" \
  -d "{
    \"batches\": [
      {
        \"batchNumber\": \"BATCH-BULK-001\",
        \"materialTypeId\": \"MATERIAL_TYPE_001\",
        \"inboundQuantity\": 500.00,
        \"unitPrice\": 14.00,
        \"inboundDate\": \"2025-11-16\"
      },
      {
        \"batchNumber\": \"BATCH-BULK-002\",
        \"materialTypeId\": \"MATERIAL_TYPE_002\",
        \"inboundQuantity\": 800.00,
        \"unitPrice\": 12.00,
        \"inboundDate\": \"2025-11-17\"
      }
    ],
    \"createdBy\": 1
  }")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
check_response "$RESPONSE" "批量创建原料批次"

# API 4: 获取批次详情
print_test 4 "获取批次详情"
if [ -n "$BATCH_ID" ]; then
    RESPONSE=$(curl -s "${API_BASE}/${BATCH_ID}")
    echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
    check_response "$RESPONSE" "获取批次详情"
else
    echo -e "${RED}✗ SKIPPED: 批次ID为空${NC}"
    ((FAILED++))
fi

# API 5: 更新批次
print_test 5 "更新批次"
if [ -n "$BATCH_ID" ]; then
    RESPONSE=$(curl -s -X PUT "${API_BASE}/${BATCH_ID}" \
      -H "Content-Type: application/json" \
      -d "{
        \"unitPrice\": 16.00,
        \"storageLocation\": \"仓库B-货架2\",
        \"notes\": \"已更新\",
        \"updatedBy\": 1
      }")
    echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
    check_response "$RESPONSE" "更新批次"
else
    echo -e "${RED}✗ SKIPPED: 批次ID为空${NC}"
    ((FAILED++))
fi

# ========== 材料操作 (7-12) ==========

# API 7: 预留批次材料
print_test 7 "预留批次材料"
if [ -n "$BATCH_ID" ]; then
    RESPONSE=$(curl -s -X POST "${API_BASE}/${BATCH_ID}/reserve?quantity=100.00&productionPlanId=PLAN-001")
    echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
    check_response "$RESPONSE" "预留批次材料"
else
    echo -e "${RED}✗ SKIPPED: 批次ID为空${NC}"
    ((FAILED++))
fi

# API 8: 释放预留材料
print_test 8 "释放预留材料"
if [ -n "$BATCH_ID" ]; then
    RESPONSE=$(curl -s -X POST "${API_BASE}/${BATCH_ID}/release?quantity=50.00&productionPlanId=PLAN-001")
    echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
    check_response "$RESPONSE" "释放预留材料"
else
    echo -e "${RED}✗ SKIPPED: 批次ID为空${NC}"
    ((FAILED++))
fi

# API 9: 消耗批次材料
print_test 9 "消耗批次材料"
if [ -n "$BATCH_ID" ]; then
    RESPONSE=$(curl -s -X POST "${API_BASE}/${BATCH_ID}/consume?quantity=30.00&productionPlanId=PLAN-001")
    echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
    check_response "$RESPONSE" "消耗批次材料"
else
    echo -e "${RED}✗ SKIPPED: 批次ID为空${NC}"
    ((FAILED++))
fi

# API 10: 直接使用批次材料
print_test 10 "直接使用批次材料"
if [ -n "$BATCH_ID" ]; then
    RESPONSE=$(curl -s -X POST "${API_BASE}/${BATCH_ID}/use?quantity=20.00")
    echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
    check_response "$RESPONSE" "直接使用批次材料"
else
    echo -e "${RED}✗ SKIPPED: 批次ID为空${NC}"
    ((FAILED++))
fi

# API 11: 调整批次数量
print_test 11 "调整批次数量"
if [ -n "$BATCH_ID" ]; then
    RESPONSE=$(curl -s -X POST "${API_BASE}/${BATCH_ID}/adjust" \
      -H "Content-Type: application/json" \
      -d "{
        \"adjustmentQuantity\": -10.00,
        \"adjustmentType\": \"damage\",
        \"reason\": \"部分损坏\",
        \"adjustedBy\": 1
      }")
    echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
    check_response "$RESPONSE" "调整批次数量"
else
    echo -e "${RED}✗ SKIPPED: 批次ID为空${NC}"
    ((FAILED++))
fi

# API 12: 更新批次状态
print_test 12 "更新批次状态"
if [ -n "$BATCH_ID" ]; then
    RESPONSE=$(curl -s -X PUT "${API_BASE}/${BATCH_ID}/status" \
      -H "Content-Type: application/json" \
      -d "{
        \"status\": \"available\"
      }")
    echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
    check_response "$RESPONSE" "更新批次状态"
else
    echo -e "${RED}✗ SKIPPED: 批次ID为空${NC}"
    ((FAILED++))
fi

# ========== 查询筛选 (13-15) ==========

# API 13: 按材料类型获取批次
print_test 13 "按材料类型获取批次"
RESPONSE=$(curl -s "${API_BASE}/material-type/MATERIAL_TYPE_001")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
check_response "$RESPONSE" "按材料类型获取批次"

# API 14: 按状态获取批次
print_test 14 "按状态获取批次"
RESPONSE=$(curl -s "${API_BASE}/status/available")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
check_response "$RESPONSE" "按状态获取批次"

# API 15: 获取FIFO批次
print_test 15 "获取FIFO批次（先进先出分配）"
RESPONSE=$(curl -s "${API_BASE}/fifo/MATERIAL_TYPE_001?quantity=200.00")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
check_response "$RESPONSE" "获取FIFO批次"

# ========== 过期管理 (16-18) ==========

# API 16: 获取即将过期批次
print_test 16 "获取即将过期批次"
RESPONSE=$(curl -s "${API_BASE}/expiring?days=365")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
check_response "$RESPONSE" "获取即将过期批次"

# API 17: 获取已过期批次
print_test 17 "获取已过期批次"
RESPONSE=$(curl -s "${API_BASE}/expired")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
check_response "$RESPONSE" "获取已过期批次"

# API 18: 处理过期批次
print_test 18 "处理过期批次"
RESPONSE=$(curl -s -X POST "${API_BASE}/handle-expired")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
check_response "$RESPONSE" "处理过期批次"

# ========== 统计报表 (19-23) ==========

# API 19: 获取批次使用历史
print_test 19 "获取批次使用历史"
if [ -n "$BATCH_ID" ]; then
    RESPONSE=$(curl -s "${API_BASE}/${BATCH_ID}/usage-history")
    echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
    check_response "$RESPONSE" "获取批次使用历史"
else
    echo -e "${RED}✗ SKIPPED: 批次ID为空${NC}"
    ((FAILED++))
fi

# API 20: 获取低库存批次
print_test 20 "获取低库存批次"
RESPONSE=$(curl -s "${API_BASE}/low-stock?threshold=100.00")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
check_response "$RESPONSE" "获取低库存批次"

# API 21: 获取库存统计
print_test 21 "获取库存统计"
RESPONSE=$(curl -s "${API_BASE}/inventory/statistics")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
check_response "$RESPONSE" "获取库存统计"

# API 22: 获取库存价值
print_test 22 "获取库存价值"
RESPONSE=$(curl -s "${API_BASE}/inventory/valuation")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
check_response "$RESPONSE" "获取库存价值"

# API 23: 导出库存报表
print_test 23 "导出库存报表"
RESPONSE=$(curl -s "${API_BASE}/export?format=json")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
check_response "$RESPONSE" "导出库存报表"

# API 6: 删除批次 (最后执行)
print_test 6 "删除批次"
if [ -n "$BATCH_ID" ]; then
    RESPONSE=$(curl -s -X DELETE "${API_BASE}/${BATCH_ID}")
    echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"
    check_response "$RESPONSE" "删除批次"
else
    echo -e "${RED}✗ SKIPPED: 批次ID为空${NC}"
    ((FAILED++))
fi

# ========== 测试总结 ==========

echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}   测试完成${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "总测试数: ${TOTAL}"
echo -e "${GREEN}通过: ${PASSED}${NC}"
echo -e "${RED}失败: ${FAILED}${NC}"
echo -e "成功率: $(( PASSED * 100 / TOTAL ))%"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}\n"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}✗ 部分测试失败${NC}"
    exit 1
fi
