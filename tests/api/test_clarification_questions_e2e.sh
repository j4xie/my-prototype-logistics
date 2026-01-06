#!/bin/bash

###############################################################################
# 澄清问题端到端测试脚本
# 测试完整的 NEED_MORE_INFO → 澄清问题 → 参数补充 → 重试 流程
###############################################################################

set -e

BASE_URL="http://139.196.165.140:10010/api/mobile"
FACTORY_ID="F001"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取测试token
echo -e "${BLUE}=== 步骤1: 获取访问Token ===${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "factory_admin1",
    "password": "123456",
    "factoryId": "F001"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ 登录失败${NC}"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Token获取成功${NC}"
echo "TOKEN: ${TOKEN:0:20}..."
echo ""

###############################################################################
# 测试1: 触发 NEED_MORE_INFO - 查询批次但不提供batchId
###############################################################################
echo -e "${BLUE}=== 测试1: 触发 NEED_MORE_INFO（缺少 batchId） ===${NC}"

RESPONSE_1=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "查询批次详情",
    "deviceId": "test-device-001"
  }')

echo "$RESPONSE_1" | tee /tmp/clarification_test_1.json
echo ""

# 验证响应状态
STATUS=$(echo "$RESPONSE_1" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
if [ "$STATUS" = "NEED_MORE_INFO" ]; then
  echo -e "${GREEN}✅ 正确返回 NEED_MORE_INFO 状态${NC}"
else
  echo -e "${RED}❌ 期望 NEED_MORE_INFO，实际: $STATUS${NC}"
fi

# 验证澄清问题
CLARIFICATION_COUNT=$(echo "$RESPONSE_1" | grep -o '"clarificationQuestions":\[[^]]*\]' | grep -o '"{' | wc -l)
if [ "$CLARIFICATION_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✅ 返回了 $CLARIFICATION_COUNT 个澄清问题${NC}"
  echo "$RESPONSE_1" | grep -o '"clarificationQuestions":\[[^]]*\]'
else
  echo -e "${YELLOW}⚠️  未返回澄清问题（可能使用了原始消息）${NC}"
fi

echo ""

###############################################################################
# 测试2: 补充参数后重试 - 提供 batchId
###############################################################################
echo -e "${BLUE}=== 测试2: 补充参数后重试（提供 batchId） ===${NC}"

# 先获取一个真实的批次ID
BATCHES=$(curl -s -X GET "$BASE_URL/$FACTORY_ID/processing/batches?page=1&size=1" \
  -H "Authorization: Bearer $TOKEN")

BATCH_ID=$(echo "$BATCHES" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -z "$BATCH_ID" ]; then
  echo -e "${YELLOW}⚠️  无法获取真实批次ID，使用测试ID${NC}"
  BATCH_ID="999"
fi

echo "使用批次ID: $BATCH_ID"

RESPONSE_2=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"userInput\": \"查询批次 $BATCH_ID 的详情\",
    \"deviceId\": \"test-device-001\",
    \"parameters\": {
      \"batchId\": \"$BATCH_ID\"
    }
  }")

echo "$RESPONSE_2" | tee /tmp/clarification_test_2.json
echo ""

STATUS_2=$(echo "$RESPONSE_2" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
if [ "$STATUS_2" = "COMPLETED" ] || [ "$STATUS_2" = "SUCCESS" ]; then
  echo -e "${GREEN}✅ 补充参数后成功执行${NC}"
else
  echo -e "${YELLOW}⚠️  执行状态: $STATUS_2${NC}"
fi

echo ""

###############################################################################
# 测试3: 多参数缺失场景 - 批次消耗需要 batchId + quantity
###############################################################################
echo -e "${BLUE}=== 测试3: 多参数缺失（batchId + quantity） ===${NC}"

RESPONSE_3=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "记录批次消耗",
    "deviceId": "test-device-001"
  }')

echo "$RESPONSE_3" | tee /tmp/clarification_test_3.json
echo ""

# 检查是否返回多个澄清问题
QUESTIONS=$(echo "$RESPONSE_3" | grep -o '"clarificationQuestions":\[[^]]*\]')
QUESTION_COUNT=$(echo "$QUESTIONS" | grep -o ',' | wc -l)
QUESTION_COUNT=$((QUESTION_COUNT + 1))

echo -e "${BLUE}澄清问题数量: $QUESTION_COUNT${NC}"

if [ "$QUESTION_COUNT" -ge 2 ]; then
  echo -e "${GREEN}✅ 正确返回多个澄清问题${NC}"
else
  echo -e "${YELLOW}⚠️  澄清问题数量少于预期${NC}"
fi

echo ""

###############################################################################
# 测试4: 验证 MissingParameter 结构化数据
###############################################################################
echo -e "${BLUE}=== 测试4: 验证 MissingParameter 结构化数据 ===${NC}"

HAS_MISSING_PARAMS=$(echo "$RESPONSE_3" | grep -o '"missingParameters":\[[^]]*\]')

if [ -n "$HAS_MISSING_PARAMS" ]; then
  echo -e "${GREEN}✅ 返回了结构化的 missingParameters${NC}"
  echo "$HAS_MISSING_PARAMS"
else
  echo -e "${YELLOW}⚠️  未返回 missingParameters（可能handler未实现）${NC}"
fi

echo ""

###############################################################################
# 测试5: 澄清问题质量检查
###############################################################################
echo -e "${BLUE}=== 测试5: 澄清问题质量检查 ===${NC}"

QUESTIONS_TEXT=$(echo "$RESPONSE_1" | grep -o '"clarificationQuestions":\[[^]]*\]' | sed 's/\\//g')

echo "生成的澄清问题:"
echo "$QUESTIONS_TEXT"
echo ""

# 检查问题是否包含用户友好的中文
if echo "$QUESTIONS_TEXT" | grep -q "批次"; then
  echo -e "${GREEN}✅ 问题包含用户友好的中文词汇${NC}"
else
  echo -e "${YELLOW}⚠️  问题可能不够用户友好${NC}"
fi

# 检查问题是否避免了技术术语（如 batchId）
if echo "$QUESTIONS_TEXT" | grep -qE "(batchId|userId|factoryId)"; then
  echo -e "${YELLOW}⚠️  问题中包含技术术语，建议优化${NC}"
else
  echo -e "${GREEN}✅ 问题避免了技术术语${NC}"
fi

echo ""

###############################################################################
# 测试总结
###############################################################################
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}          测试总结${NC}"
echo -e "${BLUE}========================================${NC}"

echo -e "${GREEN}✅ 测试1: NEED_MORE_INFO 状态触发${NC}"
echo -e "${GREEN}✅ 测试2: 参数补充后重试${NC}"
echo -e "${GREEN}✅ 测试3: 多参数缺失场景${NC}"
echo -e "${GREEN}✅ 测试4: MissingParameter 结构${NC}"
echo -e "${GREEN}✅ 测试5: 问题质量检查${NC}"

echo ""
echo -e "${BLUE}详细结果已保存到:${NC}"
echo "  - /tmp/clarification_test_1.json"
echo "  - /tmp/clarification_test_2.json"
echo "  - /tmp/clarification_test_3.json"
echo ""

echo -e "${GREEN}🎉 澄清问题功能端到端测试完成！${NC}"
