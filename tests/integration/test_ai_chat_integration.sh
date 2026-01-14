#!/bin/bash
#
# AI Chat 集成测试
# 模拟前端 AIChatScreen 的请求逻辑
#

set -e

API_BASE="http://139.196.165.140:10010"
FACTORY_ID="F001"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}    AI Chat 集成测试${NC}"
echo -e "${BLUE}    模拟前端 AIChatScreen 请求${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# 1. 登录获取 Token
echo -e "${YELLOW}[Step 1] 登录获取 Token...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${API_BASE}/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken')
if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}登录失败: $(echo "$LOGIN_RESPONSE" | jq -r '.message')${NC}"
  exit 1
fi
echo -e "${GREEN}✓ 登录成功，Token: ${TOKEN:0:50}...${NC}"
echo ""

# 测试计数
PASSED=0
FAILED=0

# 测试函数 - 模拟 AIChatScreen.handleSend
test_ai_chat() {
  local TEST_NAME="$1"
  local USER_INPUT="$2"
  local EXPECTED_STATUS="$3"  # COMPLETED, NEED_CLARIFICATION, FAILED
  local SESSION_ID="$4"

  echo -e "${YELLOW}[Test] ${TEST_NAME}${NC}"
  echo -e "  输入: ${USER_INPUT}"

  # 构建请求体 (与前端 aiApiClient.executeIntent 一致)
  local REQUEST_BODY=$(jq -n \
    --arg userInput "$USER_INPUT" \
    --arg sessionId "$SESSION_ID" \
    '{
      intentCode: "",
      userInput: $userInput,
      forceExecute: true,
      enableThinking: false,
      thinkingBudget: 20,
      sessionId: (if $sessionId == "" then null else $sessionId end)
    }')

  # 发送请求 (与前端相同的 endpoint)
  local RESPONSE=$(curl -s -X POST "${API_BASE}/api/mobile/${FACTORY_ID}/ai-intents/execute" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "$REQUEST_BODY")

  # 解析响应
  local SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
  local STATUS=$(echo "$RESPONSE" | jq -r '.data.status')
  local INTENT_CODE=$(echo "$RESPONSE" | jq -r '.data.intentCode')
  local MESSAGE=$(echo "$RESPONSE" | jq -r '.data.message')
  local SUGGESTED_ACTIONS=$(echo "$RESPONSE" | jq -r '.data.suggestedActions | length')
  local NEW_SESSION_ID=$(echo "$RESPONSE" | jq -r '.data.sessionId // .data.metadata.sessionId // empty')

  echo -e "  状态: $STATUS"
  echo -e "  意图: $INTENT_CODE"
  echo -e "  消息: ${MESSAGE:0:80}..."

  if [ "$SUGGESTED_ACTIONS" != "null" ] && [ "$SUGGESTED_ACTIONS" != "0" ]; then
    echo -e "  建议操作数: $SUGGESTED_ACTIONS"
    echo -e "  建议操作:"
    echo "$RESPONSE" | jq -r '.data.suggestedActions[]? | "    - \(.description // .label // .name)"'
  fi

  # 验证结果
  if [ "$SUCCESS" == "true" ]; then
    if [ "$EXPECTED_STATUS" == "$STATUS" ] || [ "$EXPECTED_STATUS" == "ANY" ]; then
      echo -e "  ${GREEN}✓ 测试通过${NC}"
      ((PASSED++))
    else
      echo -e "  ${RED}✗ 测试失败: 期望状态 $EXPECTED_STATUS, 实际 $STATUS${NC}"
      ((FAILED++))
    fi
  else
    echo -e "  ${RED}✗ 请求失败: $(echo "$RESPONSE" | jq -r '.message')${NC}"
    ((FAILED++))
  fi

  echo ""

  # 返回 session ID 供后续测试使用
  echo "$NEW_SESSION_ID"
}

# 测试用例

echo -e "${BLUE}========== 场景 1: 简单问候 ==========${NC}"
test_ai_chat "简单问候" "你好" "ANY"

echo -e "${BLUE}========== 场景 2: 明确意图查询 ==========${NC}"
test_ai_chat "查询生产趋势" "最近的生产趋势分析" "COMPLETED"

echo -e "${BLUE}========== 场景 3: 需要澄清的查询 ==========${NC}"
SESSION_ID=$(test_ai_chat "成本查询(需澄清)" "最近一周的生产成本如何？" "NEED_CLARIFICATION")

echo -e "${BLUE}========== 场景 4: 批次操作 ==========${NC}"
test_ai_chat "暂停批次" "暂停一下正在生产的批次" "ANY"

echo -e "${BLUE}========== 场景 5: 复杂查询 ==========${NC}"
test_ai_chat "多条件查询" "帮我看看3号线今天的产量和合格率" "ANY"

echo -e "${BLUE}========== 场景 6: 库存查询 ==========${NC}"
test_ai_chat "库存查询" "原料库存还有多少？" "ANY"

echo -e "${BLUE}========== 场景 7: 质量查询 ==========${NC}"
test_ai_chat "质量查询" "今天的质检结果怎么样" "ANY"

echo -e "${BLUE}========== 场景 8: 设备告警 ==========${NC}"
test_ai_chat "设备告警查询" "有没有设备告警" "ANY"

echo -e "${BLUE}========== 场景 9: 口语化表达 ==========${NC}"
test_ai_chat "口语化-产量" "帮我瞅瞅今天干了多少活" "ANY"

echo -e "${BLUE}========== 场景 10: 数据导出 ==========${NC}"
test_ai_chat "数据导出" "把这周的数据导出来" "ANY"

# 测试多轮对话 (如果有 session_id)
if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ]; then
  echo -e "${BLUE}========== 场景 11: 多轮对话续接 ==========${NC}"
  echo -e "${YELLOW}使用 Session ID: ${SESSION_ID}${NC}"
  test_ai_chat "多轮对话-选择选项" "总体生产成本" "ANY" "$SESSION_ID"
fi

# 输出测试结果
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}    测试结果汇总${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "  ${GREEN}通过: ${PASSED}${NC}"
echo -e "  ${RED}失败: ${FAILED}${NC}"
echo -e "  总计: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ 所有测试通过！${NC}"
  exit 0
else
  echo -e "${RED}✗ 有测试失败${NC}"
  exit 1
fi
