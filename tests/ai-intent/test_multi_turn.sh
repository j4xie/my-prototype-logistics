#!/bin/bash
# 多轮对话测试脚本
# 使用方法: chmod +x test_multi_turn.sh && ./test_multi_turn.sh

API_URL="http://139.196.165.140:10010/api/public/ai-demo/execute"
SESSION_ID="test-multi-turn-$(date +%s)"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  多轮对话测试                                ║${NC}"
echo -e "${BLUE}║       Session ID: $SESSION_ID             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

send_message() {
    local round="$1"
    local input="$2"
    local description="$3"

    echo -e "${CYAN}━━━ 轮次 $round: $description ━━━${NC}"
    echo -e "${YELLOW}用户:${NC} $input"
    echo ""

    result=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"userInput\": \"$input\", \"conversationId\": \"$SESSION_ID\"}" 2>/dev/null)

    if [[ -z "$result" ]]; then
        echo -e "${RED}连接失败${NC}"
        return 1
    fi

    intent=$(echo "$result" | jq -r '.data.intentCode // "NULL"')
    status=$(echo "$result" | jq -r '.data.status // "NULL"')
    text=$(echo "$result" | jq -r '.data.formattedText // "无响应"')

    echo -e "${GREEN}AI:${NC}"
    echo "$text" | head -10
    if [[ $(echo "$text" | wc -l) -gt 10 ]]; then
        echo "... (更多内容省略)"
    fi
    echo ""
    echo -e "  意图: ${BLUE}$intent${NC} | 状态: ${BLUE}$status${NC}"
    echo ""

    sleep 1
}

# 测试场景 1: 上下文保持
echo -e "${BLUE}═══ 测试场景 1: 上下文保持 ═══${NC}"
echo ""

send_message 1 "查询原料批次" "初始查询"
send_message 2 "第一条的详情" "引用上下文"
send_message 3 "它的质检结果呢" "代词引用"

# 测试场景 2: 话题切换
echo ""
echo -e "${BLUE}═══ 测试场景 2: 话题切换 ═══${NC}"
echo ""

SESSION_ID="test-topic-switch-$(date +%s)"

send_message 1 "产品状态怎么样" "产品分析"
send_message 2 "库存呢" "切换到库存"
send_message 3 "出货情况" "切换到出货"

# 测试场景 3: 模糊意图澄清
echo ""
echo -e "${BLUE}═══ 测试场景 3: 模糊意图处理 ═══${NC}"
echo ""

SESSION_ID="test-clarify-$(date +%s)"

send_message 1 "批次" "模糊查询"
send_message 2 "原料批次" "稍微具体"
send_message 3 "查询原料批次" "完整意图"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  多轮对话测试完成                            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
