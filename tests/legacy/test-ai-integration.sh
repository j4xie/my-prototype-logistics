#!/bin/bash

# AI成本分析集成测试脚本
# 测试 Python AI服务 + Java后端 的完整集成

echo "=========================================="
echo "AI成本分析集成测试"
echo "=========================================="
echo ""

# 配置
JAVA_BACKEND="http://localhost:10010"
AI_SERVICE="http://localhost:8085"
FACTORY_ID="F001"
BATCH_ID="1"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试函数
test_endpoint() {
    local name=$1
    local url=$2
    local method=$3
    local data=$4

    echo -n "测试 $name ... "

    if [ "$method" == "POST" ]; then
        response=$(curl -s -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data" \
            -w "\n%{http_code}")
    else
        response=$(curl -s -X GET "$url" -w "\n%{http_code}")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq 200 ]; then
        echo -e "${GREEN}✓ 成功${NC} (HTTP $http_code)"
        echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
        echo ""
        return 0
    else
        echo -e "${RED}✗ 失败${NC} (HTTP $http_code)"
        echo "$body"
        echo ""
        return 1
    fi
}

# 步骤 1: 检查AI服务
echo "=========================================="
echo "步骤 1: 检查AI服务是否运行"
echo "=========================================="
test_endpoint "AI服务健康检查" "$AI_SERVICE/" "GET"
AI_STATUS=$?

if [ $AI_STATUS -ne 0 ]; then
    echo -e "${RED}AI服务未运行！${NC}"
    echo "请先启动AI服务:"
    echo "  cd /Users/jietaoxie/Downloads/cretas-backend-system-main/backend-ai-chat"
    echo "  python main.py"
    exit 1
fi

# 步骤 2: 检查Java后端AI健康检查接口
echo "=========================================="
echo "步骤 2: 检查Java后端AI健康检查接口"
echo "=========================================="
test_endpoint "Java后端AI健康检查" \
    "$JAVA_BACKEND/api/mobile/$FACTORY_ID/processing/ai-service/health" \
    "GET"

# 步骤 3: 获取批次成本数据
echo "=========================================="
echo "步骤 3: 获取批次成本数据"
echo "=========================================="
test_endpoint "批次成本分析" \
    "$JAVA_BACKEND/api/mobile/$FACTORY_ID/processing/batches/$BATCH_ID/cost-analysis" \
    "GET"

# 步骤 4: 测试AI成本分析（第一次调用）
echo "=========================================="
echo "步骤 4: 测试AI成本分析（第一次调用）"
echo "=========================================="
test_endpoint "AI成本分析" \
    "$JAVA_BACKEND/api/mobile/$FACTORY_ID/processing/batches/$BATCH_ID/ai-cost-analysis" \
    "POST" \
    ""

AI_ANALYSIS=$?

# 步骤 5: 测试自定义问题
echo "=========================================="
echo "步骤 5: 测试自定义问题"
echo "=========================================="
test_endpoint "AI成本分析（自定义问题）" \
    "$JAVA_BACKEND/api/mobile/$FACTORY_ID/processing/batches/$BATCH_ID/ai-cost-analysis?customMessage=如何降低人工成本？" \
    "POST" \
    ""

# 步骤 6: 测试多轮对话
echo "=========================================="
echo "步骤 6: 测试多轮对话"
echo "=========================================="

# 第一轮
echo "第一轮对话..."
response=$(curl -s -X POST \
    "$JAVA_BACKEND/api/mobile/$FACTORY_ID/processing/batches/$BATCH_ID/ai-cost-analysis" \
    -H "Content-Type: application/json")

session_id=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('data', {}).get('sessionId', ''))" 2>/dev/null)

if [ -n "$session_id" ]; then
    echo -e "${GREEN}✓ 获取到会话ID: $session_id${NC}"
    echo ""

    # 第二轮（使用相同session_id）
    echo "第二轮对话（使用相同会话）..."
    test_endpoint "AI成本分析（多轮对话）" \
        "$JAVA_BACKEND/api/mobile/$FACTORY_ID/processing/batches/$BATCH_ID/ai-cost-analysis?sessionId=$session_id&customMessage=还有其他建议吗？" \
        "POST" \
        ""

    # 获取会话历史
    echo "获取会话历史..."
    test_endpoint "AI对话历史" \
        "$JAVA_BACKEND/api/mobile/$FACTORY_ID/processing/ai-sessions/$session_id" \
        "GET"
else
    echo -e "${RED}✗ 未能获取会话ID${NC}"
    echo ""
fi

# 测试总结
echo "=========================================="
echo "测试总结"
echo "=========================================="

if [ $AI_STATUS -eq 0 ] && [ $AI_ANALYSIS -eq 0 ]; then
    echo -e "${GREEN}✓ 所有核心测试通过！${NC}"
    echo ""
    echo "AI成本分析功能已成功集成！"
    echo ""
    echo "可用的API端点："
    echo "  1. POST $JAVA_BACKEND/api/mobile/{factoryId}/processing/batches/{batchId}/ai-cost-analysis"
    echo "  2. GET  $JAVA_BACKEND/api/mobile/{factoryId}/processing/ai-sessions/{sessionId}"
    echo "  3. GET  $JAVA_BACKEND/api/mobile/{factoryId}/processing/ai-service/health"
    echo ""
    echo "下一步："
    echo "  1. 在React Native中集成这些API"
    echo "  2. 部署到宝塔服务器"
    exit 0
else
    echo -e "${RED}✗ 部分测试失败${NC}"
    echo ""
    echo "请检查："
    echo "  1. AI服务是否运行在端口 8085"
    echo "  2. Java后端是否运行在端口 10010"
    echo "  3. 数据库中是否有ID为1的批次"
    echo ""
    exit 1
fi
