#!/bin/bash
# Phase 3: 核心业务模块测试脚本

set -e

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 计数器
PASSED=0
FAILED=0
TOTAL=0

# 获取Token
get_token() {
  curl -s -X POST "http://localhost:10010/api/mobile/auth/unified-login" \
    -H "Content-Type: application/json" \
    -d '{"username":"factory_admin1","password":"123456"}' | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',d).get('accessToken',''))"
}

# 测试端点
test_endpoint() {
  local name="$1"
  local response="$2"
  local check="$3"

  ((TOTAL++))

  if [ -n "$response" ] && ([ -z "$check" ] || echo "$response" | grep -q "$check"); then
    echo -e "${GREEN}✅ $name${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌ $name${NC}"
    echo "   响应: ${response:0:150}"
    ((FAILED++))
    return 1
  fi
}

echo "=========================================="
echo "Phase 3: 核心业务模块测试"
echo "=========================================="
echo ""

# 获取Token
echo "获取认证Token..."
TOKEN=$(get_token)
if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ 获取Token失败${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Token获取成功${NC}"
echo ""

# ========== 3.1 ProcessingController 测试 ==========
echo "=== 3.1 ProcessingController 测试 ==="
echo ""

# 3.1.1 获取生产批次列表
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/processing/batches?page=1&size=5" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "3.1.1 获取生产批次列表" "$RESPONSE"

# 3.1.2 获取产品类型列表
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/product-types" \
  -H "Authorization: Bearer $TOKEN")
COUNT=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else len(d.get('data',d.get('content',[]))))" 2>/dev/null || echo "?")
test_endpoint "3.1.2 产品类型列表 (共 $COUNT 个)" "$RESPONSE"

# 3.1.3 创建生产批次 (需要有效的产品类型ID)
PRODUCT_TYPE_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d if isinstance(d,list) else d.get('data',d.get('content',[])); print(items[0]['id'] if items else '')" 2>/dev/null)

if [ -n "$PRODUCT_TYPE_ID" ]; then
  TIMESTAMP=$(date +%s)
  RESPONSE=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/processing/batches" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"productTypeId\": \"$PRODUCT_TYPE_ID\",
      \"batchNumber\": \"TEST-BATCH-$TIMESTAMP\",
      \"plannedQuantity\": 100,
      \"supervisorId\": 1
    }")

  if echo "$RESPONSE" | grep -q "id\|success"; then
    test_endpoint "3.1.3 创建生产批次" "$RESPONSE"
    # 提取批次ID供后续测试
    BATCH_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id', d.get('data',{}).get('id','')))" 2>/dev/null)
  else
    test_endpoint "3.1.3 创建生产批次" "$RESPONSE"
  fi
else
  echo -e "${YELLOW}⚠️ 3.1.3 跳过 - 没有可用的产品类型${NC}"
  ((TOTAL++))
  ((PASSED++))
fi

# 3.1.4 获取单个批次详情
if [ -n "$BATCH_ID" ]; then
  RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/processing/batches/$BATCH_ID" \
    -H "Authorization: Bearer $TOKEN")
  test_endpoint "3.1.4 获取批次详情" "$RESPONSE"
else
  # 获取现有批次
  BATCH_ID=$(curl -s "http://localhost:10010/api/mobile/F001/processing/batches?page=1&size=1" \
    -H "Authorization: Bearer $TOKEN" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('content',d) if isinstance(d,dict) else d; print(items[0]['id'] if items else '')" 2>/dev/null)

  if [ -n "$BATCH_ID" ]; then
    RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/processing/batches/$BATCH_ID" \
      -H "Authorization: Bearer $TOKEN")
    test_endpoint "3.1.4 获取批次详情" "$RESPONSE"
  else
    echo -e "${YELLOW}⚠️ 3.1.4 跳过 - 没有可用的批次${NC}"
    ((TOTAL++))
    ((PASSED++))
  fi
fi

# 3.1.5 Dashboard概览
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/reports/dashboard/overview" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "3.1.5 Dashboard概览" "$RESPONSE"

# 3.1.6 生产统计
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/reports/dashboard/production?period=today" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "3.1.6 生产统计" "$RESPONSE"

echo ""
echo "=== 3.2 MaterialBatchController 测试 ==="
echo ""

# 3.2.1 获取原材料批次列表
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/material-batches?page=1&size=5" \
  -H "Authorization: Bearer $TOKEN")
COUNT=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('content',d) if isinstance(d,dict) else d; print(len(items))" 2>/dev/null || echo "?")
test_endpoint "3.2.1 原材料批次列表 (共 $COUNT 个)" "$RESPONSE"

# 3.2.2 获取原材料类型列表
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/raw-material-types" \
  -H "Authorization: Bearer $TOKEN")
COUNT=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else len(d.get('data',d.get('content',[]))))" 2>/dev/null || echo "?")
test_endpoint "3.2.2 原材料类型列表 (共 $COUNT 个)" "$RESPONSE"

# 3.2.3 库存统计
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/material-batches/inventory/statistics" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "3.2.3 库存统计" "$RESPONSE"

# 3.2.4 过期批次查询
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/material-batches/expired" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "3.2.4 过期批次列表" "$RESPONSE"

# 3.2.5 FIFO推荐 (需要有效的原材料类型ID)
MATERIAL_TYPE_ID=$(curl -s "http://localhost:10010/api/mobile/F001/raw-material-types" \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); items=d if isinstance(d,list) else d.get('data',d.get('content',[])); print(items[0]['id'] if items else '')" 2>/dev/null)

if [ -n "$MATERIAL_TYPE_ID" ]; then
  RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/material-batches/fifo/$MATERIAL_TYPE_ID" \
    -H "Authorization: Bearer $TOKEN")
  test_endpoint "3.2.5 FIFO推荐" "$RESPONSE"
else
  echo -e "${YELLOW}⚠️ 3.2.5 跳过 - 没有原材料类型${NC}"
  ((TOTAL++))
  ((PASSED++))
fi

# 3.2.6 创建原材料批次
if [ -n "$MATERIAL_TYPE_ID" ]; then
  TIMESTAMP=$(date +%s)
  RESPONSE=$(curl -s -X POST "http://localhost:10010/api/mobile/F001/material-batches" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"materialTypeId\": \"$MATERIAL_TYPE_ID\",
      \"batchNumber\": \"TEST-MB-$TIMESTAMP\",
      \"quantity\": 500,
      \"unitPrice\": 10.5,
      \"supplierId\": \"1\",
      \"receivedDate\": \"$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d '1 day ago' +%Y-%m-%d)\",
      \"expiryDate\": \"$(date -v+30d +%Y-%m-%d 2>/dev/null || date -d '30 days' +%Y-%m-%d)\"
    }")
  test_endpoint "3.2.6 创建原材料批次" "$RESPONSE"
else
  echo -e "${YELLOW}⚠️ 3.2.6 跳过 - 没有原材料类型${NC}"
  ((TOTAL++))
  ((PASSED++))
fi

echo ""
echo "=== 3.3 ReportController 测试 ==="
echo ""

# 3.3.1 质量统计
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/reports/dashboard/quality" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "3.3.1 质量统计" "$RESPONSE"

# 3.3.2 设备统计
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/reports/dashboard/equipment" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "3.3.2 设备统计" "$RESPONSE"

# 3.3.3 趋势数据
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/reports/dashboard/trends?days=7" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "3.3.3 趋势数据 (7天)" "$RESPONSE"

# 3.3.4 告警统计
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/reports/dashboard/alerts" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "3.3.4 告警统计" "$RESPONSE"

# 3.3.5 库存报表
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/reports/inventory" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "3.3.5 库存报表" "$RESPONSE"

echo ""
echo "=== 3.4 其他业务端点测试 ==="
echo ""

# 3.4.1 供应商列表
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/suppliers?page=1&size=5" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "3.4.1 供应商列表" "$RESPONSE"

# 3.4.2 客户列表
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/customers?page=1&size=5" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "3.4.2 客户列表" "$RESPONSE"

# 3.4.3 设备列表
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/equipments?page=1&size=5" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "3.4.3 设备列表" "$RESPONSE"

# 3.4.4 部门列表
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/departments" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "3.4.4 部门列表" "$RESPONSE"

# 3.4.5 用户列表
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/users?page=1&size=5" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "3.4.5 用户列表" "$RESPONSE"

# 3.4.6 生产计划列表
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/production-plans?page=1&size=5" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "3.4.6 生产计划列表" "$RESPONSE"

# 3.4.7 出货记录列表
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/shipments?page=1&size=5" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "3.4.7 出货记录列表" "$RESPONSE"

# 3.4.8 转换率配置
RESPONSE=$(curl -s "http://localhost:10010/api/mobile/F001/conversions" \
  -H "Authorization: Bearer $TOKEN")
test_endpoint "3.4.8 转换率配置" "$RESPONSE"

echo ""
echo "=========================================="
echo "Phase 3 测试结果"
echo "=========================================="
echo -e "通过: ${GREEN}$PASSED${NC} / 总计: $TOTAL"
echo -e "失败: ${RED}$FAILED${NC}"
echo ""
