#!/bin/bash

###############################################################################
# 精准 NEED_MORE_INFO 测试
# 使用 forceExecute + 缺失参数触发参数验证
###############################################################################

set -e

BASE_URL="http://139.196.165.140:10010/api/mobile"
FACTORY_ID="F001"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "精准 NEED_MORE_INFO 参数验证测试"
echo "=========================================="
echo ""

# 登录
echo "登录获取token..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username": "factory_admin1", "password": "123456"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | sed 's/"accessToken":"\([^"]*\)"/\1/')

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ 登录失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 登录成功${NC}"
echo ""

TOTAL_TESTS=0
PASSED_TESTS=0

###############################################################################
# Test 1: MATERIAL_BATCH_QUERY - 强制执行但缺少参数
###############################################################################
echo -e "${BLUE}=========================================="
echo "Test 1: MATERIAL_BATCH_QUERY - 缺少 batchId"
echo -e "==========================================${NC}"

TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "查询原材料批次",
    "intentCode": "MATERIAL_BATCH_QUERY",
    "forceExecute": true,
    "context": {},
    "deviceId": "test-device-001"
  }')

echo "Request: intentCode=MATERIAL_BATCH_QUERY, forceExecute=true, context={}"
echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | sed 's/"status":"\([^"]*\)"/\1/')
MESSAGE=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | sed 's/"message":"\([^"]*\)"/\1/')

if [ "$STATUS" = "NEED_MORE_INFO" ]; then
    echo -e "${GREEN}✅ Test 1 PASSED - 返回 NEED_MORE_INFO${NC}"
    echo "   Message: $MESSAGE"

    # 检查澄清问题
    if echo "$RESPONSE" | grep -q 'clarificationQuestions'; then
        echo -e "${GREEN}   ✓ 包含澄清问题:${NC}"
        echo "$RESPONSE" | grep -o '"clarificationQuestions":\[[^]]*\]' | sed 's/\\"/"/g'
    fi

    # 检查缺失参数
    if echo "$RESPONSE" | grep -q 'missingParameters'; then
        echo -e "${GREEN}   ✓ 包含缺失参数列表:${NC}"
        echo "$RESPONSE" | grep -o '"missingParameters":\[[^]]*\]' | sed 's/\\"/"/g'
    fi

    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ Test 1 FAILED - 状态: $STATUS${NC}"
fi
echo ""

###############################################################################
# Test 2: TRACE_BATCH - 缺少 batchId (已知会触发 NEED_MORE_INFO)
###############################################################################
echo -e "${BLUE}=========================================="
echo "Test 2: TRACE_BATCH - 缺少 batchId"
echo -e "==========================================${NC}"

TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "批次溯源",
    "intentCode": "TRACE_BATCH",
    "forceExecute": true,
    "context": {},
    "deviceId": "test-device-001"
  }')

echo "Request: intentCode=TRACE_BATCH, forceExecute=true, context={}"
echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | sed 's/"status":"\([^"]*\)"/\1/')

if [ "$STATUS" = "NEED_MORE_INFO" ]; then
    echo -e "${GREEN}✅ Test 2 PASSED - 返回 NEED_MORE_INFO${NC}"

    if echo "$RESPONSE" | grep -q '"clarificationQuestions":\["请问批次号是多少？"\]'; then
        echo -e "${GREEN}   ✓ 澄清问题正确: 请问批次号是多少？${NC}"
    fi

    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ Test 2 FAILED - 状态: $STATUS${NC}"
fi
echo ""

###############################################################################
# Test 3: QUALITY_CHECK_EXECUTE - 缺少 productionBatchId
###############################################################################
echo -e "${BLUE}=========================================="
echo "Test 3: QUALITY_CHECK_EXECUTE - 缺少 productionBatchId"
echo -e "==========================================${NC}"

TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "执行质检",
    "intentCode": "QUALITY_CHECK_EXECUTE",
    "forceExecute": true,
    "context": {},
    "deviceId": "test-device-001"
  }')

echo "Request: intentCode=QUALITY_CHECK_EXECUTE, forceExecute=true, context={}"
echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | sed 's/"status":"\([^"]*\)"/\1/')

if [ "$STATUS" = "NEED_MORE_INFO" ]; then
    echo -e "${GREEN}✅ Test 3 PASSED - 返回 NEED_MORE_INFO${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️  Test 3 - 状态: $STATUS (可能此handler不检查必需参数)${NC}"
fi
echo ""

###############################################################################
# Test 4: MATERIAL_BATCH_USE - 有 batchId 但缺少 quantity
###############################################################################
echo -e "${BLUE}=========================================="
echo "Test 4: MATERIAL_BATCH_USE - 有 batchId 但缺少 quantity"
echo -e "==========================================${NC}"

TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "使用原材料",
    "intentCode": "MATERIAL_BATCH_USE",
    "forceExecute": true,
    "context": {
      "batchId": "MB-F001-001"
    },
    "deviceId": "test-device-001"
  }')

echo "Request: intentCode=MATERIAL_BATCH_USE, context={batchId: MB-F001-001}"
echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | sed 's/"status":"\([^"]*\)"/\1/')

if [ "$STATUS" = "NEED_MORE_INFO" ]; then
    echo -e "${GREEN}✅ Test 4 PASSED - 返回 NEED_MORE_INFO${NC}"

    # 检查是否提示缺少 quantity
    if echo "$RESPONSE" | grep -qi 'quantity'; then
        echo -e "${GREEN}   ✓ 提示缺少 quantity${NC}"
    fi

    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️  Test 4 - 状态: $STATUS${NC}"
fi
echo ""

###############################################################################
# Test 5: DATA_OP 数据修改 - 缺少 entityId
###############################################################################
echo -e "${BLUE}=========================================="
echo "Test 5: 数据修改 - 缺少 entityId"
echo -e "==========================================${NC}"

TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "修改批次信息",
    "forceExecute": true,
    "context": {
      "entityType": "PRODUCTION_BATCH",
      "updates": {
        "quantity": 200
      }
    },
    "deviceId": "test-device-001"
  }')

echo "Request: entityType=PRODUCTION_BATCH, updates={quantity:200}, 缺少entityId"
echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | sed 's/"status":"\([^"]*\)"/\1/')

if [ "$STATUS" = "NEED_MORE_INFO" ] || [ "$STATUS" = "FAILED" ]; then
    echo -e "${GREEN}✅ Test 5 PASSED - 返回 $STATUS (拒绝执行)${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️  Test 5 - 状态: $STATUS${NC}"
fi
echo ""

###############################################################################
# Test 6: 补充参数后重试 TRACE_BATCH
###############################################################################
echo -e "${BLUE}=========================================="
echo "Test 6: TRACE_BATCH - 补充 batchId 后重试"
echo -e "==========================================${NC}"

TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 先获取一个真实的批次ID
BATCHES=$(curl -s -X GET "$BASE_URL/$FACTORY_ID/processing/batches?page=1&size=1" \
  -H "Authorization: Bearer $TOKEN")

BATCH_NUMBER=$(echo "$BATCHES" | grep -o '"batchNumber":"[^"]*"' | head -1 | sed 's/"batchNumber":"\([^"]*\)"/\1/')

if [ -n "$BATCH_NUMBER" ]; then
    echo "使用真实批次号: $BATCH_NUMBER"

    RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"userInput\": \"查询批次溯源\",
        \"intentCode\": \"TRACE_BATCH\",
        \"forceExecute\": true,
        \"context\": {
          \"batchNumber\": \"$BATCH_NUMBER\"
        },
        \"deviceId\": \"test-device-001\"
      }")

    echo "Request: intentCode=TRACE_BATCH, context={batchNumber: $BATCH_NUMBER}"
    echo "Response:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    echo ""

    STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | sed 's/"status":"\([^"]*\)"/\1/')

    if [ "$STATUS" = "COMPLETED" ]; then
        echo -e "${GREEN}✅ Test 6 PASSED - 补充参数后成功执行 (COMPLETED)${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${YELLOW}⚠️  Test 6 - 状态: $STATUS${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Test 6 SKIPPED - 无法获取真实批次号${NC}"
fi
echo ""

###############################################################################
# Test 7: QUALITY_DISPOSITION_EXECUTE - 缺少必填参数
###############################################################################
echo -e "${BLUE}=========================================="
echo "Test 7: QUALITY_DISPOSITION_EXECUTE - 缺少 productionBatchId/action"
echo -e "==========================================${NC}"

TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "执行质检处置",
    "forceExecute": true,
    "intentCode": "QUALITY_DISPOSITION_EXECUTE",
    "context": {}
  }')

echo "Request: intentCode=QUALITY_DISPOSITION_EXECUTE, context={}"
echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | sed 's/"status":"\([^"]*\)"/\1/')
MESSAGE=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | sed 's/"message":"\([^"]*\)"/\1/')

if [ "$STATUS" = "NEED_MORE_INFO" ]; then
    echo -e "${GREEN}✅ Test 7 PASSED - 返回 NEED_MORE_INFO${NC}"
    echo "   Message: $MESSAGE"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ Test 7 FAILED - 期望 NEED_MORE_INFO, 实际: $STATUS${NC}"
fi
echo ""

###############################################################################
# Test 8: MATERIAL_BATCH_RESERVE - 缺少必填参数
###############################################################################
echo -e "${BLUE}=========================================="
echo "Test 8: MATERIAL_BATCH_RESERVE - 缺少 batchId/quantity"
echo -e "==========================================${NC}"

TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "预留原材料",
    "forceExecute": true,
    "intentCode": "MATERIAL_BATCH_RESERVE",
    "context": {}
  }')

echo "Request: intentCode=MATERIAL_BATCH_RESERVE, context={}"
echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | sed 's/"status":"\([^"]*\)"/\1/')
MESSAGE=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | sed 's/"message":"\([^"]*\)"/\1/')

if [ "$STATUS" = "NEED_MORE_INFO" ]; then
    echo -e "${GREEN}✅ Test 8 PASSED - 返回 NEED_MORE_INFO${NC}"
    echo "   Message: $MESSAGE"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ Test 8 FAILED - 期望 NEED_MORE_INFO, 实际: $STATUS${NC}"
fi
echo ""

###############################################################################
# Test 9: SHIPMENT_CREATE - 缺少必填参数
###############################################################################
echo -e "${BLUE}=========================================="
echo "Test 9: SHIPMENT_CREATE - 缺少必填字段"
echo -e "==========================================${NC}"

TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "创建出货记录",
    "forceExecute": true,
    "intentCode": "SHIPMENT_CREATE",
    "context": {}
  }')

echo "Request: intentCode=SHIPMENT_CREATE, context={}"
echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | sed 's/"status":"\([^"]*\)"/\1/')
MESSAGE=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | sed 's/"message":"\([^"]*\)"/\1/')

if [ "$STATUS" = "NEED_MORE_INFO" ]; then
    echo -e "${GREEN}✅ Test 9 PASSED - 返回 NEED_MORE_INFO${NC}"
    echo "   Message: $MESSAGE"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ Test 9 FAILED - 期望 NEED_MORE_INFO, 实际: $STATUS${NC}"
fi
echo ""

###############################################################################
# 测试总结
###############################################################################
echo "=========================================="
echo "测试总结"
echo "=========================================="
echo ""
echo "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
echo -e "${RED}失败: $((TOTAL_TESTS - PASSED_TESTS))${NC}"
echo ""

SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
echo "通过率: $SUCCESS_RATE%"
echo ""

if [ $SUCCESS_RATE -ge 80 ]; then
    echo -e "${GREEN}🎉 测试基本通过!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  部分handler可能未实现 NEED_MORE_INFO 逻辑${NC}"
    exit 1
fi
