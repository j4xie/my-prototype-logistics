#!/bin/bash

# ========================================
# Processing模块 E2E测试脚本
# 总计19个API测试 (20个API,其中1个在ReportsController)
# ========================================

BASE_URL="http://localhost:10010/api/mobile"
FACTORY_ID="CRETAS_2024_001"
API_PATH="${BASE_URL}/${FACTORY_ID}/processing"

echo "========================================"
echo "Processing模块 - 19个API E2E测试"
echo "Base URL: ${API_PATH}"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# 测试计数器
TOTAL_TESTS=19
PASSED_TESTS=0
FAILED_TESTS=0

# 辅助函数：验证响应
validate_response() {
    local response=$1
    local test_name=$2
    local expected_code=${3:-200}

    echo "Response: ${response}"

    # 检查success字段
    local success=$(echo "$response" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('success', False))" 2>/dev/null)
    local code=$(echo "$response" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('code', 0))" 2>/dev/null)

    if [ "$success" = "True" ] && [ "$code" = "$expected_code" ]; then
        echo -e "${GREEN}✅ Test PASS: ${test_name}${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${RED}❌ Test FAIL: ${test_name}${NC}"
        echo "Expected code: ${expected_code}, Got: ${code}"
        ((FAILED_TESTS++))
        return 1
    fi
}

# ========================================
# Test 1/19: 获取批次列表
# ========================================
echo "Test 1/19: 获取批次列表（分页）"
echo "GET ${API_PATH}/batches?page=0&size=3"

RESPONSE=$(curl -s "${API_PATH}/batches?page=0&size=3")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "GET - 获取批次列表"
echo ""

# ========================================
# Test 2/19: 创建批次
# ========================================
echo "Test 2/19: 创建批次"
echo "POST ${API_PATH}/batches"

RESPONSE=$(curl -s -X POST "${API_PATH}/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "batchNumber": "TEST-BATCH-'$(date +%s)'",
    "productType": "62de0ca0-24df-4f2d-a19b-12dc8ac9bb15",
    "targetQuantity": 500.00,
    "startDate": "'$(date +%Y-%m-%d)'",
    "productionLine": "Line-A",
    "supervisorId": 1,
    "notes": "E2E测试批次",
    "rawMaterials": "[{\"materialId\": \"test-001\", \"quantity\": 100}]"
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

# 提取批次ID
BATCH_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('id', ''))")
echo "Created Batch ID: ${BATCH_ID}"

validate_response "$RESPONSE" "POST - 创建批次" 201
echo ""

# ========================================
# Test 3/19: 获取批次详情
# ========================================
echo "Test 3/19: 获取批次详情"
echo "GET ${API_PATH}/batches/${BATCH_ID}"

RESPONSE=$(curl -s "${API_PATH}/batches/${BATCH_ID}")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "GET - 获取批次详情"
echo ""

# ========================================
# Test 4/19: 更新批次信息
# ========================================
echo "Test 4/19: 更新批次信息"
echo "PUT ${API_PATH}/batches/${BATCH_ID}"

RESPONSE=$(curl -s -X PUT "${API_PATH}/batches/${BATCH_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "targetQuantity": 600.00,
    "notes": "E2E测试批次（已更新）"
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "PUT - 更新批次"
echo ""

# ========================================
# Test 5/19: 开始生产
# ========================================
echo "Test 5/19: 开始生产"
echo "POST ${API_PATH}/batches/${BATCH_ID}/start"

RESPONSE=$(curl -s -X POST "${API_PATH}/batches/${BATCH_ID}/start")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "POST - 开始生产"
echo ""

# ========================================
# Test 6/19: 完成生产
# ========================================
echo "Test 6/19: 完成生产"
echo "POST ${API_PATH}/batches/${BATCH_ID}/complete"

RESPONSE=$(curl -s -X POST "${API_PATH}/batches/${BATCH_ID}/complete" \
  -H "Content-Type: application/json" \
  -d '{
    "actualQuantity": 580.00
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "POST - 完成生产"
echo ""

# ========================================
# Test 7/19: 取消生产（使用新批次）
# ========================================
echo "Test 7/19: 取消生产（创建新批次用于取消）"

# 先创建一个新批次
CANCEL_BATCH=$(curl -s -X POST "${API_PATH}/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "batchNumber": "CANCEL-'$(date +%s)'",
    "targetQuantity": 100,
    "notes": "用于测试取消"
  }')

CANCEL_BATCH_ID=$(echo "$CANCEL_BATCH" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('id', ''))")
echo "Cancel Batch ID: ${CANCEL_BATCH_ID}"

# 取消生产
RESPONSE=$(curl -s -X POST "${API_PATH}/batches/${CANCEL_BATCH_ID}/cancel" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "测试取消功能"
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "POST - 取消生产"
echo ""

# ========================================
# Test 8/19: 记录材料消耗
# ========================================
echo "Test 8/19: 记录材料消耗"
echo "POST ${API_PATH}/batches/${BATCH_ID}/material-consumption"

RESPONSE=$(curl -s -X POST "${API_PATH}/batches/${BATCH_ID}/material-consumption" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "plan-001",
    "quantity": 50.00,
    "recordedBy": 1,
    "notes": "测试消耗记录"
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "POST - 记录材料消耗" 201
echo ""

# ========================================
# Test 9/19: 获取原材料列表
# ========================================
echo "Test 9/19: 获取原材料列表"
echo "GET ${API_PATH}/materials"

RESPONSE=$(curl -s "${API_PATH}/materials")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "GET - 获取原材料列表"
echo ""

# ========================================
# Test 10/19: 记录原料接收
# ========================================
echo "Test 10/19: 记录原料接收"
echo "POST ${API_PATH}/material-receipt"

RESPONSE=$(curl -s -X POST "${API_PATH}/material-receipt" \
  -H "Content-Type: application/json" \
  -d '{
    "batchNumber": "RECEIPT-'$(date +%s)'",
    "rawMaterials": "[{\"materialId\": \"mat-001\", \"quantity\": 1000}]",
    "totalCost": 50000.00,
    "totalWeight": 1000.00,
    "materialCategory": "鱼类",
    "notes": "测试原料接收"
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "POST - 记录原料接收" 201
echo ""

# ========================================
# Test 11/19: 创建质检记录
# ========================================
echo "Test 11/19: 创建质检记录"
echo "POST ${API_PATH}/quality/inspections"

RESPONSE=$(curl -s -X POST "${API_PATH}/quality/inspections" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "'"${BATCH_ID}"'",
    "inspectorId": 1,
    "inspectionType": "final_product",
    "testItems": "{\"freshness\": 90, \"appearance\": 85}",
    "overallResult": "pass",
    "qualityScore": 0.88,
    "notes": "测试质检记录"
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

# 提取质检ID
INSPECTION_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data', {}).get('id', ''))")
echo "Created Inspection ID: ${INSPECTION_ID}"

validate_response "$RESPONSE" "POST - 创建质检记录" 201
echo ""

# ========================================
# Test 12/19: 获取质检记录列表
# ========================================
echo "Test 12/19: 获取质检记录列表"
echo "GET ${API_PATH}/quality/inspections?batchId=${BATCH_ID}"

RESPONSE=$(curl -s "${API_PATH}/quality/inspections?batchId=${BATCH_ID}&page=0&size=10")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "GET - 获取质检记录列表"
echo ""

# ========================================
# Test 13/19: 获取质检记录详情
# ========================================
echo "Test 13/19: 获取质检记录详情"
echo "GET ${API_PATH}/quality/inspections/${INSPECTION_ID}"

RESPONSE=$(curl -s "${API_PATH}/quality/inspections/${INSPECTION_ID}")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "GET - 获取质检记录详情"
echo ""

# ========================================
# Test 14/19: 更新质检记录
# ========================================
echo "Test 14/19: 更新质检记录"
echo "PUT ${API_PATH}/quality/inspections/${INSPECTION_ID}"

RESPONSE=$(curl -s -X PUT "${API_PATH}/quality/inspections/${INSPECTION_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "qualityScore": 0.90,
    "correctiveActions": "已整改完成"
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "PUT - 更新质检记录"
echo ""

# ========================================
# Test 15/19: 审核质检记录
# ========================================
echo "Test 15/19: 审核质检记录"
echo "POST ${API_PATH}/quality/inspections/${INSPECTION_ID}/review"

RESPONSE=$(curl -s -X POST "${API_PATH}/quality/inspections/${INSPECTION_ID}/review" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "reviewNotes": "审核通过,质量优良"
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "POST - 审核质检记录"
echo ""

# ========================================
# Test 16/19: 上传质检照片
# ========================================
echo "Test 16/19: 上传质检照片"
echo "POST ${API_PATH}/quality/inspections/${INSPECTION_ID}/photos"

RESPONSE=$(curl -s -X POST "${API_PATH}/quality/inspections/${INSPECTION_ID}/photos" \
  -H "Content-Type: application/json" \
  -d '{
    "photoUrl": "https://example.com/photos/inspection-001.jpg"
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "POST - 上传质检照片"
echo ""

# ========================================
# Test 17/19: 获取批次成本分析
# ========================================
echo "Test 17/19: 获取批次成本分析"
echo "GET ${API_PATH}/batches/${BATCH_ID}/cost-analysis"

RESPONSE=$(curl -s "${API_PATH}/batches/${BATCH_ID}/cost-analysis")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "GET - 获取批次成本分析"
echo ""

# ========================================
# Test 18/19: AI时间范围成本分析
# ========================================
echo "Test 18/19: AI时间范围成本分析"
echo "POST ${API_PATH}/ai-cost-analysis/time-range"

START_DATE=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d "7 days ago" +%Y-%m-%d)
END_DATE=$(date +%Y-%m-%d)

RESPONSE=$(curl -s -X POST "${API_PATH}/ai-cost-analysis/time-range" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "'"${START_DATE}"'",
    "endDate": "'"${END_DATE}"'",
    "question": "请分析这段时间的成本情况",
    "sessionId": "test-session-001"
  }')

echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "POST - AI时间范围成本分析"
echo ""

# ========================================
# Test 19/19: 删除质检记录
# ========================================
echo "Test 19/19: 删除质检记录"
echo "DELETE ${API_PATH}/quality/inspections/${INSPECTION_ID}"

RESPONSE=$(curl -s -X DELETE "${API_PATH}/quality/inspections/${INSPECTION_ID}")
echo "$RESPONSE" | python3 -c "import sys, json; print(json.dumps(json.load(sys.stdin), indent=2, ensure_ascii=False))"

validate_response "$RESPONSE" "DELETE - 删除质检记录"
echo ""

# ========================================
# 测试总结
# ========================================
echo "========================================"
echo "测试总结"
echo "========================================"
echo "总测试数: ${TOTAL_TESTS}"
echo -e "${GREEN}通过: ${PASSED_TESTS}${NC}"
echo -e "${RED}失败: ${FAILED_TESTS}${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！Processing模块功能完整！${NC}"
    exit 0
else
    echo -e "${RED}❌ 有 ${FAILED_TESTS} 个测试失败${NC}"
    exit 1
fi
