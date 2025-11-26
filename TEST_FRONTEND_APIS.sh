#!/bin/bash

#############################################################################
# 前端 API 集成测试脚本
# 测试前端到宝塔服务器的完整链路
#############################################################################

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

API_BASE="http://localhost:10010"
FACTORY_ID="CRETAS_2024_001"

TOTAL=0
PASSED=0
FAILED=0

test_api() {
    local name=$1
    local method=$2
    local endpoint=$3
    local token=$4
    local data=$5

    TOTAL=$((TOTAL + 1))
    echo -e "\n${YELLOW}▶ [$TOTAL] $name${NC}"

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$API_BASE$endpoint" \
            -H "Authorization: Bearer $token")
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE$endpoint" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
        echo -e "${GREEN}✅ PASS (HTTP $http_code)${NC}"
        PASSED=$((PASSED + 1))

        # 显示部分响应
        if [ ! -z "$body" ]; then
            echo "响应预览:"
            echo "$body" | python3 -m json.tool 2>/dev/null | head -15 || echo "$body" | head -5
        fi
    else
        echo -e "${RED}❌ FAIL (HTTP $http_code)${NC}"
        echo "错误信息: $(echo $body | head -c 100)"
        FAILED=$((FAILED + 1))
    fi
}

#############################################################################
# 主测试流程
#############################################################################

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🚀 前端 API 集成测试${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}API 服务器: $API_BASE${NC}"
echo -e "${BLUE}工厂 ID: $FACTORY_ID${NC}\n"

# 【步骤1】登录获取 Token
echo -e "${BLUE}【步骤1】登录获取 Token${NC}"

LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/api/mobile/auth/unified-login" \
    -H "Content-Type: application/json" \
    -d '{"username":"super_admin","password":"123456"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('accessToken', ''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ 登录失败，无法继续测试${NC}"
    echo "响应: $LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ 登录成功${NC}"
echo -e "Token: ${TOKEN:0:50}...${NC}\n"

# 【步骤2】业务接口测试
echo -e "${BLUE}【步骤2】业务接口测试${NC}"

test_api "材料批次列表" "GET" \
    "/api/mobile/$FACTORY_ID/material-batches?page=1&pageSize=10" \
    "$TOKEN"

test_api "生产批次列表" "GET" \
    "/api/mobile/$FACTORY_ID/production-batches?page=1&pageSize=10" \
    "$TOKEN"

test_api "设备列表" "GET" \
    "/api/mobile/$FACTORY_ID/equipment?page=1&pageSize=10" \
    "$TOKEN"

test_api "质检记录列表" "GET" \
    "/api/mobile/$FACTORY_ID/quality-inspections?page=1&pageSize=10" \
    "$TOKEN"

# 【步骤3】AI 集成接口测试（最关键）
echo -e "\n${BLUE}【步骤3】AI 成本分析接口测试（最关键）${NC}"

test_api "AI 批次成本分析" "POST" \
    "/api/mobile/$FACTORY_ID/ai/analysis/cost/batch" \
    "$TOKEN" \
    '{"batchId":"BATCH_TEST_001","costData":{"totalMaterialCost":1000,"totalLaborCost":500,"totalEquipmentCost":300}}'

test_api "AI 时间范围分析" "POST" \
    "/api/mobile/$FACTORY_ID/ai/analysis/cost/time-range" \
    "$TOKEN" \
    '{"startDate":"2025-11-01","endDate":"2025-11-22","timeUnit":"day"}'

# 【步骤4】AI 服务直接接口测试
echo -e "\n${BLUE}【步骤4】AI 服务直接接口测试${NC}"

echo -e "\n${YELLOW}▶ AI 健康检查${NC}"
AI_HEALTH=$(curl -s -w "\n%{http_code}" http://localhost:8085/)
AI_CODE=$(echo "$AI_HEALTH" | tail -n1)
if [[ "$AI_CODE" =~ ^2[0-9][0-9]$ ]]; then
    echo -e "${GREEN}✅ AI 服务正常 (HTTP $AI_CODE)${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ AI 服务异常 (HTTP $AI_CODE)${NC}"
    FAILED=$((FAILED + 1))
fi
TOTAL=$((TOTAL + 1))

# 【测试总结】
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}📊 测试总结${NC}"
echo -e "${BLUE}========================================${NC}"

echo -e "总测试数: ${BLUE}$TOTAL${NC}"
echo -e "通过: ${GREEN}$PASSED${NC}"
echo -e "失败: ${RED}$FAILED${NC}"

PASS_RATE=$((PASSED * 100 / TOTAL))
echo -e "通过率: ${BLUE}$PASS_RATE%${NC}"

echo ""
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}🎉 所有测试都通过了！${NC}"
    echo -e "${GREEN}前端 → Java 后端 → AI 服务完全集成！${NC}"
    echo -e "${GREEN}========================================${NC}"
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}⚠️  有 $FAILED 个测试失败${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
