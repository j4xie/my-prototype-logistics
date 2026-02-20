#!/bin/bash

# 快速验证测试 - 每个类别运行2个测试用例

ENDPOINT="http://139.196.165.140:10010/api/public/ai-demo/execute"

echo "=========================================="
echo "v10.0 意图识别系统 - 快速验证测试"
echo "=========================================="
echo ""

# 测试函数
test_intent() {
    local id="$1"
    local input="$2"
    local expected="$3"

    echo -n "[$id] Testing: ${input:0:40}... "

    response=$(curl -s "$ENDPOINT" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "{\"userInput\":\"$input\"}" \
        --max-time 15)

    if [[ $? -ne 0 ]]; then
        echo "❌ FAIL (curl error)"
        return 1
    fi

    success=$(echo "$response" | jq -r '.success // false')
    intent=$(echo "$response" | jq -r '.data.intentCode // .data.intent // "UNKNOWN"')
    confidence=$(echo "$response" | jq -r '.data.confidence // 0')

    if [[ "$success" != "true" ]]; then
        echo "❌ FAIL (API error)"
        return 1
    fi

    if [[ "$intent" == "$expected" ]] || [[ "$intent" == *"$expected"* ]]; then
        echo "✅ PASS - $intent (conf: $confidence)"
        return 0
    else
        echo "❌ FAIL - Expected: $expected, Got: $intent"
        return 1
    fi
}

passed=0
failed=0

echo "1. 复杂语言模式测试"
echo "-------------------"
test_intent "L001" "难道今天没有任何原料到货吗？" "MATERIAL" && ((passed++)) || ((failed++))
test_intent "L011" "虽然上个月的产量达标了，但是不合格品率好像上升了" "QUALITY" && ((passed++)) || ((failed++))
echo ""

echo "2. 多轮对话测试"
echo "-------------------"
test_intent "M001" "我要领一些原料" "MATERIAL" && ((passed++)) || ((failed++))
test_intent "M016" "我想看看这批货的情况" "CLARIFICATION" && ((passed++)) || ((failed++))
echo ""

echo "3. 写入操作测试"
echo "-------------------"
test_intent "W001" "帮我创建一条原料入库记录：带鱼500公斤" "MATERIAL" && ((passed++)) || ((failed++))
test_intent "W016" "把批次MB-2026-0122-001的状态从待检改为合格" "MATERIAL" && ((passed++)) || ((failed++))
echo ""

echo "4. RAG/咨询测试"
echo "-------------------"
test_intent "R001" "带鱼的标准储存温度是多少？保质期一般多长时间？" "RAG" && ((passed++)) || ((failed++))
test_intent "R002" "来料检验的标准流程是什么？" "RAG" && ((passed++)) || ((failed++))
echo ""

echo "=========================================="
echo "快速验证结果"
echo "=========================================="
echo "通过: $passed"
echo "失败: $failed"
echo "总计: $((passed + failed))"
echo "通过率: $(echo "scale=1; $passed * 100 / ($passed + $failed)" | bc)%"
echo ""

if [[ $failed -gt 0 ]]; then
    echo "⚠️ 存在失败用例，请检查API服务状态"
    exit 1
else
    echo "✅ 快速验证通过，可以运行完整测试"
    exit 0
fi
