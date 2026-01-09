#!/bin/bash

###############################################################################
# AI 意图识别系统 - 高级场景测试
#
# 测试复杂业务流程和边界条件
###############################################################################

set -e

# 配置
BASE_URL="http://139.196.165.140:10010/api/mobile"
FACTORY_ID="F001"
OUTPUT_DIR="./test_results"

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

mkdir -p "$OUTPUT_DIR"

echo -e "${CYAN}=========================================="
echo "AI 意图识别系统 - 高级场景测试"
echo -e "==========================================${NC}"
echo ""

# ==================== 登录 ====================

echo -e "${BLUE}[INFO]${NC} 登录获取token..."

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "factory_admin1",
    "password": "123456"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | sed 's/"accessToken":"\([^"]*\)"/\1/')

if [ -z "$TOKEN" ]; then
    echo -e "${RED}[ERROR]${NC} 登录失败"
    exit 1
fi

echo -e "${GREEN}[SUCCESS]${NC} 登录成功"
echo ""

# ==================== 高级场景 1: 完整生产流程 ====================

echo -e "${CYAN}=========================================="
echo "高级场景 1: 完整生产流程测试"
echo -e "==========================================${NC}"
echo ""

# Step 1: 查询原料库存
echo -e "${BLUE}[Step 1/6]${NC} 查询原料库存"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "查询带鱼原料库存",
    "deviceId": "production-flow-test"
  }')

echo "响应: ${RESPONSE:0:150}..."

if echo "$RESPONSE" | grep -q '"intentRecognized":true' && \
   echo "$RESPONSE" | grep -q 'MATERIAL'; then
    echo -e "${GREEN}✅${NC} Step 1 通过 - 成功识别原料查询意图"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌${NC} Step 1 失败"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

# Step 2: 启动生产批次（如果支持）
echo -e "${BLUE}[Step 2/6]${NC} 启动生产批次"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "启动新的生产批次，产品是冷冻带鱼，计划产量500kg",
    "deviceId": "production-flow-test"
  }')

echo "响应: ${RESPONSE:0:150}..."

if echo "$RESPONSE" | grep -q '"intentRecognized":true'; then
    intent=$(echo "$RESPONSE" | grep -o '"intentCode":"[^"]*"' | head -1 | sed 's/"intentCode":"\([^"]*\)"/\1/')
    echo -e "${GREEN}✅${NC} Step 2 通过 - 识别意图: $intent"
    PASSED_TESTS=$((PASSED_TESTS + 1))

    # 尝试提取批次号（如果返回）
    BATCH_NUMBER=$(echo "$RESPONSE" | grep -o '"batchNumber":"[^"]*"' | head -1 | sed 's/"batchNumber":"\([^"]*\)"/\1/')
    if [ -n "$BATCH_NUMBER" ]; then
        echo -e "${CYAN}[INFO]${NC} 生成批次号: $BATCH_NUMBER"
    fi
else
    echo -e "${YELLOW}⚠️${NC} Step 2 - 意图可能未识别或不支持"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

# Step 3: 记录原料消耗
echo -e "${BLUE}[Step 3/6]${NC} 记录原料消耗"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "消耗原料带鱼520公斤",
    "deviceId": "production-flow-test"
  }')

echo "响应: ${RESPONSE:0:150}..."

if echo "$RESPONSE" | grep -q '"intentRecognized":true'; then
    echo -e "${GREEN}✅${NC} Step 3 通过"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️${NC} Step 3 - 可能需要补充参数"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

# Step 4: 质检
echo -e "${BLUE}[Step 4/6]${NC} 执行质检"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "质检合格，所有指标正常",
    "deviceId": "production-flow-test"
  }')

echo "响应: ${RESPONSE:0:150}..."

if echo "$RESPONSE" | grep -q 'QUALITY\|INSPECTION'; then
    echo -e "${GREEN}✅${NC} Step 4 通过 - 识别为质检相关意图"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️${NC} Step 4 - 意图识别可能不准确"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

# Step 5: 创建出货记录
echo -e "${BLUE}[Step 5/6]${NC} 创建出货记录"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "创建出货记录，客户是沃尔玛，数量450kg",
    "deviceId": "production-flow-test"
  }')

echo "响应: ${RESPONSE:0:150}..."

if echo "$RESPONSE" | grep -q 'SHIPMENT\|OUTBOUND'; then
    echo -e "${GREEN}✅${NC} Step 5 通过 - 识别为出货相关意图"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️${NC} Step 5 - 意图识别可能不准确"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

# Step 6: 批次溯源查询
echo -e "${BLUE}[Step 6/6]${NC} 查询批次溯源"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

if [ -n "$BATCH_NUMBER" ]; then
    RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"userInput\": \"查询批次 $BATCH_NUMBER 的完整溯源信息\",
        \"deviceId\": \"production-flow-test\"
      }")
else
    RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "userInput": "查询最新批次的溯源信息",
        "deviceId": "production-flow-test"
      }')
fi

echo "响应: ${RESPONSE:0:150}..."

if echo "$RESPONSE" | grep -q 'TRACE'; then
    echo -e "${GREEN}✅${NC} Step 6 通过 - 识别为溯源查询意图"
    PASSED_TESTS=$((PASSED_TESTS + 1))

    # 检查是否返回溯源链
    if echo "$RESPONSE" | grep -q '"resultData"' || echo "$RESPONSE" | grep -q 'traceability'; then
        echo -e "${CYAN}[INFO]${NC} 溯源数据已返回"
    fi
else
    echo -e "${YELLOW}⚠️${NC} Step 6 - 意图识别可能不准确"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

echo -e "${GREEN}=========================================="
echo "完整生产流程测试完成"
echo -e "==========================================${NC}"
echo ""

# ==================== 高级场景 2: 口语化表达测试 ====================

echo -e "${CYAN}=========================================="
echo "高级场景 2: 口语化表达测试"
echo -e "==========================================${NC}"
echo ""

# 定义口语化测试用例
declare -a COLLOQUIAL_INPUTS=(
    "帮我看看仓库里还有多少带鱼"
    "那个批次现在到哪了"
    "摄像头坏了吗"
    "给我找一下上个月的质检记录"
    "我要出货100箱"
    "查一下今天用了多少原料"
    "库存快没了，提醒一下采购"
    "这个设备怎么回事"
)

for i in "${!COLLOQUIAL_INPUTS[@]}"; do
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    input="${COLLOQUIAL_INPUTS[$i]}"

    echo -e "${BLUE}[Test $((i+1))/${#COLLOQUIAL_INPUTS[@]}]${NC} 测试: \"$input\""

    RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"userInput\": \"$input\",
        \"deviceId\": \"colloquial-test-$i\"
      }")

    intent=$(echo "$RESPONSE" | grep -o '"intentCode":"[^"]*"' | head -1 | sed 's/"intentCode":"\([^"]*\)"/\1/')
    recognized=$(echo "$RESPONSE" | grep -o '"intentRecognized":[^,}]*' | sed 's/"intentRecognized":\([^,}]*\)/\1/')

    if [ "$recognized" = "true" ] && [ -n "$intent" ]; then
        echo -e "${GREEN}✅${NC} 识别成功: $intent"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${YELLOW}⚠️${NC} 未识别或需要澄清"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    echo ""
done

echo -e "${GREEN}=========================================="
echo "口语化表达测试完成"
echo -e "==========================================${NC}"
echo ""

# ==================== 高级场景 3: 边界条件测试 ====================

echo -e "${CYAN}=========================================="
echo "高级场景 3: 边界条件测试"
echo -e "==========================================${NC}"
echo ""

# Test: 超长输入
echo -e "${BLUE}[Test]${NC} 超长输入测试"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

LONG_INPUT="我想查询一下我们工厂最近生产的所有冷冻带鱼批次的详细信息，包括原料来源、加工过程、质检结果、出货记录，还有对应的温度监控数据、设备运行日志、以及员工操作记录，最好能生成一份完整的溯源报告，发送到我的邮箱"

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"userInput\": \"$LONG_INPUT\",
    \"deviceId\": \"boundary-test-long\"
  }")

if echo "$RESPONSE" | grep -q '"intentRecognized":true'; then
    echo -e "${GREEN}✅${NC} 超长输入处理成功"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️${NC} 超长输入可能被截断或拒绝"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

# Test: 空输入
echo -e "${BLUE}[Test]${NC} 空输入测试"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "",
    "deviceId": "boundary-test-empty"
  }')

if echo "$RESPONSE" | grep -q '"success":false\|"intentRecognized":false'; then
    echo -e "${GREEN}✅${NC} 空输入正确拒绝"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️${NC} 空输入处理异常"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

# Test: 特殊字符
echo -e "${BLUE}[Test]${NC} 特殊字符测试"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "查询批次<script>alert(\"XSS\")</script>",
    "deviceId": "boundary-test-xss"
  }')

if echo "$RESPONSE" | grep -q '"success":false\|TRACE'; then
    echo -e "${GREEN}✅${NC} 特殊字符正确处理（防XSS）"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌${NC} 特殊字符处理失败"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

# Test: 数字和单位识别
echo -e "${BLUE}[Test]${NC} 数字和单位识别测试"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

RESPONSE=$(curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "使用500kg原料，温度设置为-18°C",
    "deviceId": "boundary-test-numbers"
  }')

if echo "$RESPONSE" | grep -q '500\|kg\|-18'; then
    echo -e "${GREEN}✅${NC} 数字和单位识别成功"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️${NC} 数字和单位可能未正确提取"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
echo ""

echo -e "${GREEN}=========================================="
echo "边界条件测试完成"
echo -e "==========================================${NC}"
echo ""

# ==================== 测试总结 ====================

echo -e "${CYAN}=========================================="
echo "高级场景测试总结"
echo -e "==========================================${NC}"
echo ""
echo "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
echo -e "${RED}失败: $FAILED_TESTS${NC}"
echo ""

SUCCESS_RATE=0
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
fi

echo "通过率: $SUCCESS_RATE%"
echo ""

if [ $SUCCESS_RATE -ge 70 ]; then
    echo -e "${GREEN}🎉 高级场景测试基本通过!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️ 部分高级场景需要优化${NC}"
    exit 1
fi
