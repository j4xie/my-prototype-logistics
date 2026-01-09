#!/bin/bash

###############################################################################
# 多Handler NEED_MORE_INFO 场景测试
# 测试各类 IntentHandler 的参数缺失处理
###############################################################################

set -e

# 配置
BASE_URL="http://139.196.165.140:10010/api/mobile"
FACTORY_ID="F001"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "多Handler NEED_MORE_INFO 场景测试"
echo "=========================================="
echo ""

# Step 1: 登录获取token
echo "Step 1: 登录获取token..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "factory_admin1",
    "password": "123456"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | sed 's/"accessToken":"\([^"]*\)"/\1/')

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ 登录失败${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ 登录成功${NC}"
echo "Token: ${TOKEN:0:30}..."
echo ""

# 测试计数
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

###############################################################################
# Test Suite 1: MaterialIntentHandler
###############################################################################
echo "=========================================="
echo "Test Suite 1: MaterialIntentHandler"
echo "=========================================="
echo ""

# Test 1.1: MATERIAL_BATCH_QUERY - 缺少 batchId 和 materialTypeId
echo "Test 1.1: MATERIAL_BATCH_QUERY - 缺少必需参数"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "查询原材料库存",
    "deviceId": "test-device-001"
  }')

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q '"status":"NEED_MORE_INFO"'; then
    echo -e "${GREEN}✅ Test 1.1 PASSED - 正确返回 NEED_MORE_INFO${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))

    # 检查澄清问题
    if echo "$RESPONSE" | grep -q 'clarificationQuestions'; then
        echo -e "${GREEN}   包含澄清问题${NC}"
        echo "$RESPONSE" | grep -o '"clarificationQuestions":\[[^]]*\]'
    fi
else
    echo -e "${RED}❌ Test 1.1 FAILED - 未返回 NEED_MORE_INFO${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

# Test 1.2: MATERIAL_BATCH_USE - 缺少 batchId
echo "Test 1.2: MATERIAL_BATCH_USE - 缺少 batchId"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "使用原材料100公斤",
    "deviceId": "test-device-001"
  }')

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q '"status":"NEED_MORE_INFO"' || echo "$RESPONSE" | grep -q '"status":"NEED_CLARIFICATION"'; then
    echo -e "${GREEN}✅ Test 1.2 PASSED - 返回需要更多信息状态${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️  Test 1.2 - 返回其他状态${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

###############################################################################
# Test Suite 2: QualityIntentHandler
###############################################################################
echo "=========================================="
echo "Test Suite 2: QualityIntentHandler"
echo "=========================================="
echo ""

# Test 2.1: QUALITY_CHECK_EXECUTE - 缺少 productionBatchId
echo "Test 2.1: QUALITY_CHECK_EXECUTE - 缺少 productionBatchId"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "执行质检",
    "deviceId": "test-device-001"
  }')

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q '"status":"NEED_MORE_INFO"' || echo "$RESPONSE" | grep -q '"status":"NEED_CLARIFICATION"'; then
    echo -e "${GREEN}✅ Test 2.1 PASSED - 返回需要更多信息状态${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️  Test 2.1 - 返回其他状态${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

# Test 2.2: QUALITY_DISPOSITION_EXECUTE - 缺少 recordId
echo "Test 2.2: QUALITY_DISPOSITION_EXECUTE - 缺少 recordId"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "执行处置动作",
    "deviceId": "test-device-001"
  }')

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q '"status":"NEED_MORE_INFO"' || echo "$RESPONSE" | grep -q '"status":"NEED_CLARIFICATION"'; then
    echo -e "${GREEN}✅ Test 2.2 PASSED - 返回需要更多信息状态${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️  Test 2.2 - 返回其他状态${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

###############################################################################
# Test Suite 3: DataOperationIntentHandler
###############################################################################
echo "=========================================="
echo "Test Suite 3: DataOperationIntentHandler"
echo "=========================================="
echo ""

# Test 3.1: 数据修改 - 缺少 entityId
echo "Test 3.1: 数据修改 - 缺少 entityId"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "修改批次信息",
    "deviceId": "test-device-001"
  }')

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q '"status":"NEED_MORE_INFO"' || echo "$RESPONSE" | grep -q '"status":"NEED_CLARIFICATION"'; then
    echo -e "${GREEN}✅ Test 3.1 PASSED - 返回需要更多信息状态${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️  Test 3.1 - 返回其他状态${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

###############################################################################
# Test Suite 4: HRIntentHandler (考勤相关)
###############################################################################
echo "=========================================="
echo "Test Suite 4: HRIntentHandler"
echo "=========================================="
echo ""

# Test 4.1: 考勤查询 - 可能需要日期范围
echo "Test 4.1: 考勤查询 - 测试参数处理"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "查询考勤记录",
    "deviceId": "test-device-001"
  }')

echo "Response: $RESPONSE"

STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | sed 's/"status":"\([^"]*\)"/\1/')
if [ "$STATUS" = "NEED_MORE_INFO" ] || [ "$STATUS" = "COMPLETED" ]; then
    echo -e "${GREEN}✅ Test 4.1 PASSED - 状态: $STATUS${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️  Test 4.1 - 状态: $STATUS${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

###############################################################################
# Test Suite 5: ShipmentIntentHandler (出货相关)
###############################################################################
echo "=========================================="
echo "Test Suite 5: ShipmentIntentHandler"
echo "=========================================="
echo ""

# Test 5.1: 出货查询 - 可能需要出货ID或日期
echo "Test 5.1: 出货查询 - 测试参数处理"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "查询出货记录",
    "deviceId": "test-device-001"
  }')

echo "Response: $RESPONSE"

STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | sed 's/"status":"\([^"]*\)"/\1/')
if [ "$STATUS" = "NEED_MORE_INFO" ] || [ "$STATUS" = "COMPLETED" ]; then
    echo -e "${GREEN}✅ Test 5.1 PASSED - 状态: $STATUS${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️  Test 5.1 - 状态: $STATUS${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

###############################################################################
# Test Suite 6: ReportIntentHandler (报表相关)
###############################################################################
echo "=========================================="
echo "Test Suite 6: ReportIntentHandler"
echo "=========================================="
echo ""

# Test 6.1: 报表查询 - 可能需要报表类型或日期
echo "Test 6.1: 报表查询 - 测试参数处理"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "查看生产报表",
    "deviceId": "test-device-001"
  }')

echo "Response: $RESPONSE"

STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | sed 's/"status":"\([^"]*\)"/\1/')
if [ "$STATUS" = "NEED_MORE_INFO" ] || [ "$STATUS" = "COMPLETED" ]; then
    echo -e "${GREEN}✅ Test 6.1 PASSED - 状态: $STATUS${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️  Test 6.1 - 状态: $STATUS${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
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
echo -e "${RED}失败: $FAILED_TESTS${NC}"
echo ""

SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
echo "通过率: $SUCCESS_RATE%"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  部分测试失败，请检查上述输出${NC}"
    exit 1
fi
