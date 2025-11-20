#!/bin/bash

# ========================================
# Phase D: 全面验证测试
# 测试P0+P1+P2修复 + 核心API功能
# ========================================

BASE_URL="http://localhost:10010/api/mobile"
FACTORY_ID="CRETAS_2024_001"
PASS=0
FAIL=0
TOTAL=0

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 测试函数
test_api() {
    local name="$1"
    local url="$2"
    local expected_code="${3:-200}"
    
    TOTAL=$((TOTAL + 1))
    echo -n "  [$TOTAL] $name ... "
    
    response=$(curl -s "$url")
    api_code=$(echo "$response" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('code', 'N/A'))" 2>/dev/null || echo "ERROR")
    
    if [ "$api_code" = "$expected_code" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASS=$((PASS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (Got: $api_code, Expected: $expected_code)"
        FAIL=$((FAIL + 1))
        
        # 显示错误信息
        error_msg=$(echo "$response" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('message', ''))" 2>/dev/null || echo "")
        if [ -n "$error_msg" ] && [ "$error_msg" != "N/A" ]; then
            echo -e "${YELLOW}      → $error_msg${NC}"
        fi
        return 1
    fi
}

echo "========================================="
echo "🧪 Phase D: 全面验证测试"
echo "========================================="
echo ""

# ========== Section 1: P0修复回归测试 ==========
echo -e "${BLUE}📋 Section 1: P0修复回归测试${NC}"
echo "验证Equipment/TimeClock/Customer修复"
echo "-----------------------------------------"

test_api "Equipment List (equipmentId String类型)" \
    "$BASE_URL/$FACTORY_ID/equipment?page=1&size=10"

test_api "TimeClock Today (LocalDate修复)" \
    "$BASE_URL/$FACTORY_ID/timeclock/today?userId=1"

test_api "Customer List (null rating处理)" \
    "$BASE_URL/$FACTORY_ID/customers?page=1&size=10"

echo ""

# ========== Section 2: P1修复回归测试 ==========
echo -e "${BLUE}📋 Section 2: P1修复回归测试${NC}"
echo "验证MaterialTypes分页修复"
echo "-----------------------------------------"

test_api "MaterialTypes List page=1 (分页修复)" \
    "$BASE_URL/$FACTORY_ID/materials/types?page=1&size=10"

test_api "MaterialTypes Search (分页修复)" \
    "$BASE_URL/$FACTORY_ID/materials/types/search?keyword=LY&page=1&size=20"

echo ""

# ========== Section 3: P2修复回归测试 ==========
echo -e "${BLUE}📋 Section 3: P2修复回归测试${NC}"
echo "验证Customer Statistics null处理"
echo "-----------------------------------------"

test_api "Customer Statistics (NullPointerException修复)" \
    "$BASE_URL/$FACTORY_ID/customers/CUST_TEST_005/statistics"

test_api "Customer Search (之前超时问题)" \
    "$BASE_URL/$FACTORY_ID/customers/search?keyword=test&page=1&size=10"

test_api "ProductType Search (之前超时问题)" \
    "$BASE_URL/$FACTORY_ID/product-types/search?keyword=test&page=1&size=10"

echo ""

# ========== Section 4: Statistics/History端点验证 ==========
echo -e "${BLUE}📋 Section 4: Statistics/History端点验证${NC}"
echo "验证所有统计和历史端点"
echo "-----------------------------------------"

test_api "TimeClock History" \
    "$BASE_URL/$FACTORY_ID/timeclock/history?userId=1&startDate=2025-11-01&endDate=2025-11-20&page=1&size=10"

test_api "TimeClock Statistics" \
    "$BASE_URL/$FACTORY_ID/timeclock/statistics?userId=1&startDate=2025-11-01&endDate=2025-11-20"

test_api "MaterialBatch Inventory Statistics" \
    "$BASE_URL/$FACTORY_ID/material-batches/inventory/statistics"

test_api "ProductionPlan Statistics" \
    "$BASE_URL/$FACTORY_ID/production-plans/statistics?startDate=2025-11-01&endDate=2025-11-20"

test_api "Supplier Statistics" \
    "$BASE_URL/$FACTORY_ID/suppliers/SUP_TEST_003/statistics"

test_api "Supplier History" \
    "$BASE_URL/$FACTORY_ID/suppliers/SUP_TEST_003/history?page=1&size=10"

test_api "Processing Quality Statistics" \
    "$BASE_URL/$FACTORY_ID/processing/quality/statistics?startDate=2025-11-01&endDate=2025-11-20"

echo ""

# ========== Section 5: 核心CRUD功能测试 ==========
echo -e "${BLUE}📋 Section 5: 核心CRUD功能测试${NC}"
echo "验证基础数据管理功能"
echo "-----------------------------------------"

test_api "Supplier List" \
    "$BASE_URL/$FACTORY_ID/suppliers?page=1&size=10"

test_api "Customer List" \
    "$BASE_URL/$FACTORY_ID/customers?page=1&size=10"

test_api "ProductionPlan List" \
    "$BASE_URL/$FACTORY_ID/production-plans?page=1&size=10"

test_api "MaterialBatch List" \
    "$BASE_URL/$FACTORY_ID/material-batches?page=1&size=10"

test_api "Department List" \
    "$BASE_URL/$FACTORY_ID/departments?page=1&size=10"

test_api "ProductType List" \
    "$BASE_URL/$FACTORY_ID/product-types?page=1&size=10"

test_api "RawMaterialType List" \
    "$BASE_URL/$FACTORY_ID/raw-material-types?page=1&size=10"

echo ""

# ========== Section 6: 搜索功能测试 ==========
echo -e "${BLUE}📋 Section 6: 搜索功能测试${NC}"
echo "验证搜索性能和准确性"
echo "-----------------------------------------"

test_api "MaterialTypes Search" \
    "$BASE_URL/$FACTORY_ID/materials/types/search?keyword=鱼&page=1&size=20"

test_api "Customer Search" \
    "$BASE_URL/$FACTORY_ID/customers/search?keyword=test&page=1&size=10"

test_api "Supplier Search" \
    "$BASE_URL/$FACTORY_ID/suppliers/search?keyword=test&page=1&size=10"

test_api "ProductType Search" \
    "$BASE_URL/$FACTORY_ID/product-types/search?keyword=test&page=1&size=10"

echo ""

# ========== Section 7: 报表模块测试 ==========
echo -e "${BLUE}📋 Section 7: 报表模块测试${NC}"
echo "验证报表生成功能"
echo "-----------------------------------------"

test_api "Report Dashboard" \
    "$BASE_URL/$FACTORY_ID/reports/dashboard"

test_api "Production Report" \
    "$BASE_URL/$FACTORY_ID/reports/production?startDate=2025-11-01&endDate=2025-11-20"

test_api "Quality Report" \
    "$BASE_URL/$FACTORY_ID/reports/quality?startDate=2025-11-01&endDate=2025-11-20"

test_api "Finance Report" \
    "$BASE_URL/$FACTORY_ID/reports/finance?startDate=2025-11-01&endDate=2025-11-20"

test_api "Processing Dashboard" \
    "$BASE_URL/$FACTORY_ID/processing/dashboard"

echo ""

# ========== Section 8: 其他关键端点 ==========
echo -e "${BLUE}📋 Section 8: 其他关键端点测试${NC}"
echo "验证系统配置和辅助功能"
echo "-----------------------------------------"

test_api "Whitelist List" \
    "$BASE_URL/$FACTORY_ID/whitelist?page=1&size=10"

test_api "Conversion List" \
    "$BASE_URL/$FACTORY_ID/conversions?page=1&size=10"

test_api "Customer Rating Distribution" \
    "$BASE_URL/$FACTORY_ID/customers/rating-distribution"

echo ""

# ========== 测试总结 ==========
echo "========================================="
echo -e "${BLUE}📊 测试总结${NC}"
echo "========================================="
echo "总测试数: $TOTAL"
echo -e "${GREEN}通过: $PASS${NC}"
echo -e "${RED}失败: $FAIL${NC}"
echo -n "通过率: "

if [ $TOTAL -gt 0 ]; then
    pass_rate=$((PASS * 100 / TOTAL))
    if [ $pass_rate -ge 95 ]; then
        echo -e "${GREEN}$pass_rate%${NC}"
    elif [ $pass_rate -ge 80 ]; then
        echo -e "${YELLOW}$pass_rate%${NC}"
    else
        echo -e "${RED}$pass_rate%${NC}"
    fi
else
    echo "0%"
fi

echo ""

# 结果判断
if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}⚠️  有 $FAIL 个测试失败${NC}"
    exit 1
fi
