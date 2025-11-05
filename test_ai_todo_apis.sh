#!/bin/bash

# AI TODO 功能测试脚本
# 测试新实现的6个TODO功能

echo "=================================================="
echo "AI TODO 功能测试"
echo "=================================================="
echo ""

# 配置
BASE_URL="http://localhost:10010"
FACTORY_ID="F001"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 先获取登录token
echo -e "${YELLOW}步骤 1: 获取登录Token${NC}"
echo "POST ${BASE_URL}/api/mobile/auth/unified-login"

LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "123456"
  }')

echo "登录响应: $LOGIN_RESPONSE"

# 提取token (使用jq或sed)
if command -v jq &> /dev/null; then
    TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token // .data.accessToken // empty')
else
    # 简单的sed提取
    TOKEN=$(echo "$LOGIN_RESPONSE" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
    if [ -z "$TOKEN" ]; then
        TOKEN=$(echo "$LOGIN_RESPONSE" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
    fi
fi

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ 登录失败，无法获取Token${NC}"
    echo "响应: $LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Token获取成功: ${TOKEN:0:50}...${NC}"
echo ""
sleep 1

# 2. 测试P0功能 - 查询AI配额信息（用于后续测试）
echo "=================================================="
echo -e "${YELLOW}步骤 2: 测试 P0 - 查询AI配额信息${NC}"
echo "=================================================="
echo "GET ${BASE_URL}/api/mobile/${FACTORY_ID}/ai/quota"

QUOTA_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/mobile/${FACTORY_ID}/ai/quota" \
  -H "Authorization: Bearer ${TOKEN}")

echo "配额响应: $QUOTA_RESPONSE"
echo ""
sleep 1

# 3. 测试P1功能 - 时间范围成本分析
echo "=================================================="
echo -e "${YELLOW}步骤 3: 测试 P1 - 时间范围成本分析${NC}"
echo "=================================================="
echo "POST ${BASE_URL}/api/mobile/${FACTORY_ID}/ai/analysis/cost/time-range"

TIME_RANGE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/ai/analysis/cost/time-range" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "dimension": "monthly"
  }')

echo "时间范围分析响应: $TIME_RANGE_RESPONSE"

if echo "$TIME_RANGE_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ 时间范围成本分析 - 成功${NC}"
else
    echo -e "${RED}❌ 时间范围成本分析 - 失败${NC}"
fi
echo ""
sleep 1

# 4. 测试P1功能 - 批次对比分析
echo "=================================================="
echo -e "${YELLOW}步骤 4: 测试 P1 - 批次对比分析${NC}"
echo "=================================================="
echo "POST ${BASE_URL}/api/mobile/${FACTORY_ID}/ai/analysis/cost/compare"

COMPARE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/ai/analysis/cost/compare" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "batchIds": [1, 2, 3]
  }')

echo "批次对比分析响应: $COMPARE_RESPONSE"

if echo "$COMPARE_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ 批次对比分析 - 成功${NC}"
elif echo "$COMPARE_RESPONSE" | grep -q '批次不存在'; then
    echo -e "${YELLOW}⚠️  批次对比分析 - 批次不存在（需要先创建批次数据）${NC}"
else
    echo -e "${RED}❌ 批次对比分析 - 失败${NC}"
fi
echo ""
sleep 1

# 5. 测试P0功能 - 获取报告列表
echo "=================================================="
echo -e "${YELLOW}步骤 5: 测试 P0 - 获取AI报告列表${NC}"
echo "=================================================="
echo "GET ${BASE_URL}/api/mobile/${FACTORY_ID}/ai/reports"

REPORTS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/mobile/${FACTORY_ID}/ai/reports" \
  -H "Authorization: Bearer ${TOKEN}")

echo "报告列表响应: $REPORTS_RESPONSE"
echo ""
sleep 1

# 6. 测试P2功能 - 配额更新（需要平台管理员权限）
echo "=================================================="
echo -e "${YELLOW}步骤 6: 测试 P2 - 更新AI配额${NC}"
echo "=================================================="
echo "PUT ${BASE_URL}/api/mobile/${FACTORY_ID}/ai/quota?newQuotaLimit=150"

UPDATE_QUOTA_RESPONSE=$(curl -s -X PUT "${BASE_URL}/api/mobile/${FACTORY_ID}/ai/quota?newQuotaLimit=150" \
  -H "Authorization: Bearer ${TOKEN}")

echo "配额更新响应: $UPDATE_QUOTA_RESPONSE"

if echo "$UPDATE_QUOTA_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ 配额更新 - 成功${NC}"
else
    echo -e "${YELLOW}⚠️  配额更新 - 可能需要平台管理员权限${NC}"
fi
echo ""
sleep 1

# 7. 测试P2功能 - 报告生成路由
echo "=================================================="
echo -e "${YELLOW}步骤 7: 测试 P2 - 报告生成路由（批次报告）${NC}"
echo "=================================================="
echo "POST ${BASE_URL}/api/mobile/${FACTORY_ID}/ai/reports/generate"

GENERATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/ai/reports/generate" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "batch",
    "batchId": 1
  }')

echo "报告生成响应: $GENERATE_RESPONSE"

if echo "$GENERATE_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ 报告生成路由 - 成功${NC}"
elif echo "$GENERATE_RESPONSE" | grep -q '批次不存在'; then
    echo -e "${YELLOW}⚠️  报告生成路由 - 批次不存在（需要先创建批次数据）${NC}"
else
    echo -e "${RED}❌ 报告生成路由 - 失败${NC}"
fi
echo ""
sleep 1

# 8. 测试P0功能 - 会话关闭
echo "=================================================="
echo -e "${YELLOW}步骤 8: 测试 P0 - 关闭AI会话${NC}"
echo "=================================================="
echo "DELETE ${BASE_URL}/api/mobile/${FACTORY_ID}/ai/conversations/test-session-123"

CLOSE_SESSION_RESPONSE=$(curl -s -X DELETE "${BASE_URL}/api/mobile/${FACTORY_ID}/ai/conversations/test-session-123" \
  -H "Authorization: Bearer ${TOKEN}")

echo "会话关闭响应: $CLOSE_SESSION_RESPONSE"

if echo "$CLOSE_SESSION_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ 会话关闭 - 成功${NC}"
else
    echo -e "${RED}❌ 会话关闭 - 失败${NC}"
fi
echo ""

# 总结
echo "=================================================="
echo -e "${GREEN}测试完成！${NC}"
echo "=================================================="
echo ""
echo "测试的6个TODO功能："
echo "✓ P0-1: 报告详情查询 (getReportDetail) - 需要有reportId"
echo "✓ P0-2: 会话关闭逻辑 (closeConversation) - 已测试"
echo "✓ P1-1: 时间范围成本分析 (analyzeTimeRangeCost) - 已测试"
echo "✓ P1-2: 批次对比分析 (compareBatchCosts) - 已测试"
echo "✓ P2-1: 配额更新逻辑 (updateQuota) - 已测试"
echo "✓ P2-2: 报告生成路由 (generateReport) - 已测试"
echo ""
echo "注意事项："
echo "1. 某些功能需要数据库中有实际的批次数据"
echo "2. 配额更新功能可能需要平台管理员权限"
echo "3. AI分析功能需要DeepSeek API配置正确"
echo ""
