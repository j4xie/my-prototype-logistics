#!/bin/bash

##############################################################################
# Dashboard & Reports API 测试脚本
#
# 功能: 测试Phase 1实现的7个API端点
# 作者: Claude Code
# 日期: 2025-11-18
#
# 使用方法:
#   chmod +x test_dashboard_apis.sh
#   ./test_dashboard_apis.sh
#
# 前提条件:
#   1. 后端服务已启动 (http://localhost:10010)
#   2. 已获取有效的JWT token
##############################################################################

# 配置
BASE_URL="http://localhost:10010"
FACTORY_ID="F001"
JWT_TOKEN="YOUR_JWT_TOKEN_HERE"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo ""
echo "========================================="
echo "  Dashboard & Reports API 测试"
echo "========================================="
echo ""
echo "基础URL: $BASE_URL"
echo "工厂ID: $FACTORY_ID"
echo ""

##############################################################################
# 辅助函数
##############################################################################

# 测试API端点
test_api() {
    local test_name="$1"
    local endpoint="$2"
    local method="${3:-GET}"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -e "${BLUE}[$TOTAL_TESTS] 测试: $test_name${NC}"
    echo "   端点: $method $endpoint"

    # 执行请求
    response=$(curl -s -w "\n%{http_code}" -X $method "$endpoint" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json" 2>&1)

    # 提取HTTP状态码和响应体
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    # 检查响应
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}   ✓ 成功${NC} (HTTP $http_code)"

        # 检查是否包含success字段
        if echo "$body" | grep -q '"success":true'; then
            echo -e "${GREEN}   ✓ 响应格式正确${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${YELLOW}   ⚠ 响应格式异常${NC}"
            echo "$body" | head -n5
        fi
    else
        echo -e "${RED}   ✗ 失败${NC} (HTTP $http_code)"
        echo "$body" | head -n10
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    echo ""
    sleep 0.5
}

##############################################################################
# 测试用例
##############################################################################

echo "========================================="
echo "  仪表板API测试 (6个端点)"
echo "========================================="
echo ""

# 1. 生产概览 - 今日
test_api \
    "生产概览 - 今日" \
    "$BASE_URL/api/mobile/$FACTORY_ID/processing/dashboard/overview?period=today"

# 2. 生产概览 - 本周
test_api \
    "生产概览 - 本周" \
    "$BASE_URL/api/mobile/$FACTORY_ID/processing/dashboard/overview?period=week"

# 3. 生产统计
test_api \
    "生产统计" \
    "$BASE_URL/api/mobile/$FACTORY_ID/processing/dashboard/production?startDate=2025-01-01&endDate=2025-11-18"

# 4. 设备统计
test_api \
    "设备统计" \
    "$BASE_URL/api/mobile/$FACTORY_ID/processing/dashboard/equipment"

# 5. 质量统计
test_api \
    "质量统计" \
    "$BASE_URL/api/mobile/$FACTORY_ID/processing/dashboard/quality?period=month"

# 6. 告警统计
test_api \
    "告警统计" \
    "$BASE_URL/api/mobile/$FACTORY_ID/processing/dashboard/alerts?period=week"

# 7. 趋势分析 - 生产
test_api \
    "趋势分析 - 生产" \
    "$BASE_URL/api/mobile/$FACTORY_ID/processing/dashboard/trends?period=month&metric=production"

# 8. 趋势分析 - 质量
test_api \
    "趋势分析 - 质量" \
    "$BASE_URL/api/mobile/$FACTORY_ID/processing/dashboard/trends?period=month&metric=quality"

echo ""
echo "========================================="
echo "  报表API测试 (1个端点)"
echo "========================================="
echo ""

# 9. 时间范围成本分析 - 按天分组
test_api \
    "成本分析 - 按天分组" \
    "$BASE_URL/api/mobile/$FACTORY_ID/processing/reports/cost-analysis/time-range?startDate=2025-01-01&endDate=2025-11-18&groupBy=day"

# 10. 时间范围成本分析 - 按周分组
test_api \
    "成本分析 - 按周分组" \
    "$BASE_URL/api/mobile/$FACTORY_ID/processing/reports/cost-analysis/time-range?startDate=2025-01-01&endDate=2025-11-18&groupBy=week"

# 11. 时间范围成本分析 - 按月分组
test_api \
    "成本分析 - 按月分组" \
    "$BASE_URL/api/mobile/$FACTORY_ID/processing/reports/cost-analysis/time-range?startDate=2025-01-01&endDate=2025-11-18&groupBy=month"

##############################################################################
# 测试结果统计
##############################################################################

echo ""
echo "========================================="
echo "  测试结果统计"
echo "========================================="
echo ""
echo "总测试数: $TOTAL_TESTS"
echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
echo -e "失败: ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ 所有测试通过！${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}✗ 部分测试失败${NC}"
    echo ""
    echo "可能的原因:"
    echo "  1. 后端服务未启动 (http://localhost:10010)"
    echo "  2. JWT token无效或过期"
    echo "  3. 工厂ID (F001) 不存在"
    echo "  4. 数据库连接失败"
    echo ""
    exit 1
fi
