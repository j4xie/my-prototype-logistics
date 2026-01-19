#!/bin/bash
# AI 意图识别 v7.0 自动化测试脚本
# 使用方法: chmod +x test_ai_intent_v7.sh && ./test_ai_intent_v7.sh

API_URL="http://139.196.165.140:10010/api/public/ai-demo/execute"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 计数器
PASS_COUNT=0
FAIL_COUNT=0

# 测试意图识别
test_intent() {
    local input="$1"
    local expected_intent="$2"
    local expected_status="$3"

    result=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"userInput\": \"$input\"}" 2>/dev/null)

    if [[ -z "$result" ]]; then
        echo -e "${RED}✗${NC} 连接失败: $input"
        ((FAIL_COUNT++))
        return 1
    fi

    actual_intent=$(echo "$result" | jq -r '.data.intentCode // "NULL"')
    actual_status=$(echo "$result" | jq -r '.data.status // "NULL"')

    if [[ "$actual_intent" == "$expected_intent" ]]; then
        echo -e "${GREEN}✓${NC} $input"
        echo -e "  意图: $actual_intent (正确)"
        if [[ -n "$expected_status" && "$actual_status" == "$expected_status" ]]; then
            echo -e "  状态: $actual_status (正确)"
        elif [[ -n "$expected_status" && "$actual_status" != "$expected_status" ]]; then
            echo -e "  ${YELLOW}状态: $actual_status (期望: $expected_status)${NC}"
        fi
        ((PASS_COUNT++))
        return 0
    else
        echo -e "${RED}✗${NC} $input"
        echo -e "  意图: $actual_intent (期望: $expected_intent)"
        echo -e "  状态: $actual_status"
        ((FAIL_COUNT++))
        return 1
    fi
}

# 测试状态 (不检查意图)
test_status() {
    local input="$1"
    local expected_status="$2"
    local description="$3"

    result=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"userInput\": \"$input\"}" 2>/dev/null)

    if [[ -z "$result" ]]; then
        echo -e "${RED}✗${NC} 连接失败: $input"
        ((FAIL_COUNT++))
        return 1
    fi

    actual_intent=$(echo "$result" | jq -r '.data.intentCode // "NULL"')
    actual_status=$(echo "$result" | jq -r '.data.status // "NULL"')

    if [[ "$actual_status" == "$expected_status" ]]; then
        echo -e "${GREEN}✓${NC} $input"
        echo -e "  状态: $actual_status (正确) - $description"
        ((PASS_COUNT++))
        return 0
    else
        echo -e "${RED}✗${NC} $input"
        echo -e "  状态: $actual_status (期望: $expected_status)"
        ((FAIL_COUNT++))
        return 1
    fi
}

# 测试分析响应
test_analysis() {
    local input="$1"
    local description="$2"

    result=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"userInput\": \"$input\"}" 2>/dev/null)

    if [[ -z "$result" ]]; then
        echo -e "${RED}✗${NC} 连接失败: $input"
        ((FAIL_COUNT++))
        return 1
    fi

    formatted_text=$(echo "$result" | jq -r '.data.formattedText // "NULL"')
    intent_code=$(echo "$result" | jq -r '.data.intentCode // "NULL"')

    if [[ "$formatted_text" != "NULL" && "$formatted_text" != "null" && -n "$formatted_text" ]]; then
        echo -e "${GREEN}✓${NC} $input"
        echo -e "  意图: $intent_code"
        echo -e "  响应: ${formatted_text:0:80}..."
        ((PASS_COUNT++))
        return 0
    else
        echo -e "${RED}✗${NC} $input"
        echo -e "  意图: $intent_code"
        echo -e "  响应为空或无效"
        ((FAIL_COUNT++))
        return 1
    fi
}

# 测试延迟
test_latency() {
    local input="$1"
    local label="$2"
    local max_ms="$3"

    start_time=$(python3 -c "import time; print(int(time.time() * 1000))")
    curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"userInput\": \"$input\"}" > /dev/null 2>&1
    end_time=$(python3 -c "import time; print(int(time.time() * 1000))")

    latency=$((end_time - start_time))

    if [[ $latency -le $max_ms ]]; then
        echo -e "${GREEN}✓${NC} $label: ${latency}ms (限制: ${max_ms}ms)"
        ((PASS_COUNT++))
    else
        echo -e "${YELLOW}⚠${NC} $label: ${latency}ms (超过限制: ${max_ms}ms)"
        ((FAIL_COUNT++))
    fi
}

# 主测试流程
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       AI 意图识别 v7.0 自动化测试                            ║${NC}"
echo -e "${BLUE}║       服务器: $API_URL              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 检查服务器连接
echo -e "${BLUE}[0] 检查服务器连接...${NC}"
health_check=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL" -X POST \
    -H "Content-Type: application/json" \
    -d '{"userInput": "test"}' 2>/dev/null)

if [[ "$health_check" == "200" ]]; then
    echo -e "${GREEN}✓ 服务器连接正常${NC}"
else
    echo -e "${RED}✗ 服务器连接失败 (HTTP $health_check)${NC}"
    echo "请检查服务器是否正常运行"
    exit 1
fi
echo ""

# Phase 1: 意图识别修复测试
echo -e "${BLUE}[1] Phase 1: 意图识别修复测试 (短语注入 + 域惩罚豁免)${NC}"
echo "────────────────────────────────────────────────────────────────"
test_intent "创建原料批次" "MATERIAL_BATCH_CREATE" "NO_PERMISSION"
test_intent "查询原料批次" "MATERIAL_BATCH_QUERY" "SUCCESS"
test_intent "新建原料批次" "MATERIAL_BATCH_CREATE" "NO_PERMISSION"
test_intent "录入原料批次" "MATERIAL_BATCH_CREATE" "NO_PERMISSION"
test_intent "原料批次列表" "MATERIAL_BATCH_QUERY" "SUCCESS"
test_intent "原料入库" "MATERIAL_BATCH_CREATE" "NO_PERMISSION"
echo ""

# Phase 2: 分析路由测试
echo -e "${BLUE}[2] Phase 2: 分析路由测试 (业务查询)${NC}"
echo "────────────────────────────────────────────────────────────────"
test_analysis "产品状态怎么样" "产品分析"
test_analysis "库存情况如何" "库存分析"
test_analysis "今天出货情况" "出货分析"
echo ""

# Phase 3: 边界测试 (检查状态而不是意图)
echo -e "${BLUE}[3] Phase 3: 边界测试${NC}"
echo "────────────────────────────────────────────────────────────────"
test_status "天气怎么样" "NOT_RECOGNIZED" "非业务问题应该被拒绝"
test_status "你好" "NOT_RECOGNIZED" "闲聊应该被拒绝"
echo ""

# Phase 4: 性能测试
echo -e "${BLUE}[4] Phase 4: 性能测试${NC}"
echo "────────────────────────────────────────────────────────────────"
test_latency "查询原料批次" "简单查询" 3000
test_latency "产品状态怎么样" "分析请求" 10000
echo ""

# 汇总
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                       测试汇总                               ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "通过: ${GREEN}$PASS_COUNT${NC}"
echo -e "失败: ${RED}$FAIL_COUNT${NC}"
total=$((PASS_COUNT + FAIL_COUNT))
if [[ $FAIL_COUNT -eq 0 ]]; then
    echo -e "${GREEN}所有测试通过!${NC}"
    exit 0
else
    echo -e "${YELLOW}有 $FAIL_COUNT 个测试失败，请检查${NC}"
    exit 1
fi
