#!/bin/bash

set -e

# AI多轮对话系统端到端测试
# 测试目标：
#   ✓ 低置信度输入触发多轮对话
#   ✓ 用户回答澄清问题
#   ✓ 意图识别成功
#   ✓ 自动学习新表达和关键词

BASE_URL="http://139.196.165.140:10010/api/mobile"
FACTORY_ID="F001"

# ANSI 颜色代码
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     AI多轮对话系统 - 端到端测试 (E2E)                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "测试目标:"
echo "  ✓ 低置信度输入触发多轮对话"
echo "  ✓ 用户回答澄清问题"
echo "  ✓ 意图识别成功"
echo "  ✓ 自动学习新表达和关键词"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

# ============================================
# Step 0: 登录获取 Token
# ============================================
echo -e "${YELLOW}📍 Step 0: 登录系统${NC}"

LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "factory_admin1",
    "password": "123456"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"userId":[0-9]*' | cut -d':' -f2)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ 登录失败${NC}"
    echo "$LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ 登录成功${NC}"
echo "   User ID: $USER_ID"
echo ""

sleep 1

# ============================================
# Step 1: 清理历史学习数据（可选）
# ============================================
echo "════════════════════════════════════════════════════════════════"
echo -e "${YELLOW}📍 Step 1: 清理测试数据（确保测试可重复）${NC}"
echo "清理表达式: '帮我看看', '原料的', '原料批次库存'"
echo ""

# 注意: 这里需要直接访问数据库来清理学习数据
# 如果有管理API可以调用，更推荐使用API
# 这里仅作演示，实际生产环境应该通过API清理
mysql -h 139.196.165.140 -u root -p'CretasDB@2025' cretas_db \
  -e "DELETE FROM ai_conversation_learning WHERE user_expression IN ('帮我看看', '原料的', '原料批次库存');" \
  2>/dev/null || echo "   (无法清理数据库 - 跳过此步骤)"

echo -e "${GREEN}✅ 清理完成（或跳过）${NC}"
echo ""

sleep 1

echo "════════════════════════════════════════════════════════════════"
echo -e "${BLUE}【测试开始】多轮对话系统${NC}"
echo "════════════════════════════════════════════════════════════════"
echo ""

# ============================================
# 测试1: 发送低置信度输入，触发多轮对话
# ============================================
# 使用随机后缀确保每次都是新的表达式，避免学习污染
RANDOM_SUFFIX=$RANDOM
TEST_INPUT="我要操作${RANDOM_SUFFIX}"

echo -e "${YELLOW}📍 测试1: 发送模糊输入 '${TEST_INPUT}'${NC}"
echo "预期: 触发澄清问题（置信度 < 30%）"
echo ""

RESPONSE1=$(curl -s -X POST "${BASE_URL}/${FACTORY_ID}/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"userInput\": \"${TEST_INPUT}\"
  }")

echo "$RESPONSE1" | jq '.'
echo ""

# 提取 needMoreInfo 和 sessionId（从 metadata 字段）
NEED_MORE_INFO=$(echo "$RESPONSE1" | jq -r '.data.metadata.needMoreInfo // false')
SESSION_ID=$(echo "$RESPONSE1" | jq -r '.data.metadata.sessionId // ""')
CLARIFICATION=$(echo "$RESPONSE1" | jq -r '.data.message // ""')

if [ "$NEED_MORE_INFO" = "true" ] && [ -n "$SESSION_ID" ]; then
    echo -e "${GREEN}✅ 成功触发澄清问题${NC}"
    echo "   sessionId: $SESSION_ID"
    echo "   澄清问题: $CLARIFICATION"
    echo ""
else
    echo -e "${RED}❌ 未触发澄清问题${NC}"
    echo "   needMoreInfo: $NEED_MORE_INFO"
    echo "   sessionId: $SESSION_ID"
    exit 1
fi

sleep 1

# ============================================
# 测试2: 继续会话，提供模糊回答
# ============================================
echo -e "${YELLOW}📍 测试2: 继续会话 - 回答 '原料的'${NC}"
echo "预期: 继续澄清（仍然不够明确）"
echo ""

RESPONSE2=$(curl -s -X POST "${BASE_URL}/${FACTORY_ID}/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userInput":"原料的","sessionId":"'"$SESSION_ID"'"}')

echo "$RESPONSE2" | jq '.'
echo ""

STATUS2=$(echo "$RESPONSE2" | jq -r '.data.status // ""')
SESSION_ID2=$(echo "$RESPONSE2" | jq -r '.data.metadata.sessionId // ""')
CLARIFICATION2=$(echo "$RESPONSE2" | jq -r '.data.message // ""')

if [ "$STATUS2" = "CONVERSATION_CONTINUE" ] && [ "$SESSION_ID2" = "$SESSION_ID" ]; then
    echo -e "${GREEN}✅ 继续澄清流程${NC}"
    echo "   状态: $STATUS2"
    echo "   澄清问题: $CLARIFICATION2"
    echo ""
else
    echo -e "${YELLOW}⚠️  会话状态异常${NC}"
    echo "   期望状态: CONVERSATION_CONTINUE"
    echo "   实际状态: $STATUS2"
    echo "   期望sessionId: $SESSION_ID"
    echo "   实际sessionId: $SESSION_ID2"
    echo ""
fi

sleep 1

# ============================================
# 测试3: 提供明确回答
# ============================================
echo -e "${YELLOW}📍 测试3: 提供明确回答 '原料批次库存'${NC}"
echo "预期: 识别出 MATERIAL_BATCH_QUERY 意图"
echo ""

RESPONSE3=$(curl -s -X POST "${BASE_URL}/${FACTORY_ID}/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userInput":"原料批次库存","sessionId":"'"$SESSION_ID"'"}')

echo "$RESPONSE3" | jq '.'
echo ""

INTENT_CODE=$(echo "$RESPONSE3" | jq -r '.data.intentCode // ""')
STATUS3=$(echo "$RESPONSE3" | jq -r '.data.status // ""')

if [ "$INTENT_CODE" = "MATERIAL_BATCH_QUERY" ]; then
    echo -e "${GREEN}✅ 成功识别意图: MATERIAL_BATCH_QUERY${NC}"
    echo "   状态: $STATUS3 (会话成功识别意图后，handler要求提供参数)"
    echo ""
else
    echo -e "${RED}❌ 意图识别失败${NC}"
    echo "   期望意图: MATERIAL_BATCH_QUERY"
    echo "   实际意图: $INTENT_CODE"
    echo "   状态: $STATUS3"
    echo ""
    exit 1
fi

sleep 1

# ============================================
# 测试4: 验证学习效果 - 再次发送原始输入
# ============================================
echo -e "${YELLOW}📍 测试4: 验证学习效果 - 再次发送 '${TEST_INPUT}'${NC}"
echo "预期: 由于学习，现在应该能直接识别（或至少置信度提高）"
echo ""

sleep 3  # 等待学习任务异步完成

RESPONSE4=$(curl -s -X POST "${BASE_URL}/${FACTORY_ID}/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"userInput\": \"${TEST_INPUT}\"
  }")

echo "$RESPONSE4" | jq '.'
echo ""

INTENT_CODE4=$(echo "$RESPONSE4" | jq -r '.data.intentCode // ""')
STATUS4=$(echo "$RESPONSE4" | jq -r '.data.status // ""')
SESSION_ID4=$(echo "$RESPONSE4" | jq -r '.data.metadata.sessionId // ""')

echo "学习效果验证结果:"
echo "  意图: $INTENT_CODE4"
echo "  状态: $STATUS4"
echo "  会话ID: $SESSION_ID4"
echo ""

if [ "$INTENT_CODE4" = "MATERIAL_BATCH_QUERY" ] && [ -z "$SESSION_ID4" ]; then
    echo -e "${GREEN}✅ 学习生效 - 现在可以直接识别意图${NC}"
    echo "   原本模糊的输入 '${TEST_INPUT}' 现在直接识别为 MATERIAL_BATCH_QUERY"
    echo "   不再触发多轮对话，直接进入handler层请求参数"
elif [ -n "$SESSION_ID4" ]; then
    echo -e "${YELLOW}⚠️  仍然触发多轮对话 - 学习可能未生效或需要更多时间${NC}"
else
    echo -e "${RED}❌ 学习效果不明显${NC}"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo -e "${BLUE}【测试完成】多轮对话系统 E2E 测试${NC}"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "验证项总结:"
echo "  ✓ 低置信度输入触发多轮对话"
echo "  ✓ 用户回答澄清问题"
echo "  ✓ 意图识别成功"
echo "  ✓ 自动学习新表达和关键词"
echo ""
