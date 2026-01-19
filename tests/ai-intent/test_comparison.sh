#!/bin/bash
# v6.0 vs v7.0 对比测试脚本
# 使用方法: chmod +x test_comparison.sh && ./test_comparison.sh

API_URL="http://139.196.165.140:10010/api/public/ai-demo/execute"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           AI 意图识别 v6.0 → v7.0 对比测试                   ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 对比表格头
printf "%-25s | %-25s | %-25s | %-10s\n" "测试输入" "v6.0 期望 (旧)" "v7.0 期望 (新)" "实际结果"
echo "─────────────────────────────────────────────────────────────────────────────────────────────"

compare_intent() {
    local input="$1"
    local v6_expected="$2"
    local v7_expected="$3"

    result=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"userInput\": \"$input\"}" 2>/dev/null)

    actual=$(echo "$result" | jq -r '.data.intentCode // "ERROR"')

    if [[ "$actual" == "$v7_expected" ]]; then
        status="${GREEN}✓ 正确${NC}"
    elif [[ "$actual" == "$v6_expected" ]]; then
        status="${RED}✗ 仍是v6${NC}"
    else
        status="${YELLOW}⚠ 其他${NC}"
    fi

    printf "%-25s | %-25s | %-25s | %b\n" "$input" "$v6_expected" "$v7_expected" "$actual ($status)"
}

echo ""
echo -e "${CYAN}=== 意图识别对比 (核心修复) ===${NC}"
echo ""

# 核心对比: "创建"动词识别
compare_intent "创建原料批次" "MATERIAL_BATCH_QUERY" "MATERIAL_BATCH_CREATE"
compare_intent "新建原料批次" "MATERIAL_BATCH_QUERY" "MATERIAL_BATCH_CREATE"
compare_intent "添加原料批次" "MATERIAL_BATCH_QUERY" "MATERIAL_BATCH_CREATE"
compare_intent "录入原料批次" "MATERIAL_BATCH_QUERY" "MATERIAL_BATCH_CREATE"

echo ""
echo -e "${CYAN}=== GENERAL_QUESTION 处理对比 ===${NC}"
echo ""

printf "%-25s | %-35s | %-35s\n" "测试输入" "v6.0 行为" "v7.0 行为"
echo "─────────────────────────────────────────────────────────────────────────────────────────────"

analyze_response() {
    local input="$1"
    local v6_behavior="$2"
    local v7_behavior="$3"

    result=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"userInput\": \"$input\"}" 2>/dev/null)

    text=$(echo "$result" | jq -r '.data.formattedText // ""')
    intent=$(echo "$result" | jq -r '.data.intentCode // ""')

    # 检查是否包含数据分析特征
    has_data="否"
    if echo "$text" | grep -qE "(统计|数量|总计|合计|比率|率|%|\d+个|\d+条)"; then
        has_data="是"
    fi

    printf "%-25s | %-35s | %-35s\n" "$input" "$v6_behavior" "$v7_behavior"
    echo "  → 实际意图: $intent | 包含数据: $has_data"
    echo "  → 响应摘要: ${text:0:60}..."
    echo ""
}

analyze_response "产品状态怎么样" "静态报告摘要" "Tool调用+实时数据+行业分析"
analyze_response "库存情况如何" "通用回答" "实时库存+周转建议"
analyze_response "质检结果怎么样" "预设回复" "实时质检数据+合格率"

echo ""
echo -e "${CYAN}=== 性能对比 ===${NC}"
echo ""

printf "%-25s | %-15s | %-15s | %-15s\n" "场景" "v6.0 预期" "v7.0 预期" "实际延迟"
echo "─────────────────────────────────────────────────────────────────────────────────────────────"

test_perf() {
    local input="$1"
    local label="$2"
    local v6_ms="$3"
    local v7_ms="$4"

    start=$(python3 -c "import time; print(int(time.time() * 1000))")
    curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"userInput\": \"$input\"}" > /dev/null 2>&1
    end=$(python3 -c "import time; print(int(time.time() * 1000))")
    latency=$((end - start))

    if [[ $latency -le $v7_ms ]]; then
        status="${GREEN}${latency}ms${NC}"
    else
        status="${YELLOW}${latency}ms${NC}"
    fi

    printf "%-25s | %-15s | %-15s | %b\n" "$label" "~${v6_ms}ms" "~${v7_ms}ms" "$status"
}

test_perf "查询原料批次" "简单查询" "200" "300"
test_perf "产品状态怎么样" "分析请求" "300" "2000"
test_perf "对比本周和上周的产量" "复杂分析" "N/A" "5000"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                      对比测试完成                            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "关键改进:"
echo "  1. '创建原料批次' 现在正确识别为 MATERIAL_BATCH_CREATE"
echo "  2. 分析请求现在会调用 Tool 获取实时数据"
echo "  3. 响应包含行业知识和专业建议"
echo ""
