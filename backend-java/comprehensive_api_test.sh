#!/bin/bash
# 综合API测试脚本 - 测试所有主要模块

BASE_URL="http://localhost:10010"
FACTORY_ID="CRETAS_2024_001"

# 测试计数器
declare -A MODULE_RESULTS

test_api() {
    local module="$1"
    local name="$2"
    local url="$3"

    response=$(curl -s "$url" 2>/dev/null)
    code=$(echo "$response" | grep -o '"code":[0-9]*' | head -1 | cut -d':' -f2)

    if [ "$code" = "200" ]; then
        echo "  ✅ $name"
        MODULE_RESULTS["${module}_passed"]=$((${MODULE_RESULTS["${module}_passed"]:-0} + 1))
    else
        echo "  ❌ $name (Code: $code)"
        MODULE_RESULTS["${module}_failed"]=$((${MODULE_RESULTS["${module}_failed"]:-0} + 1))
    fi
    MODULE_RESULTS["${module}_total"]=$((${MODULE_RESULTS["${module}_total"]:-0} + 1))
}

print_module_summary() {
    local module="$1"
    local total=${MODULE_RESULTS["${module}_total"]:-0}
    local passed=${MODULE_RESULTS["${module}_passed"]:-0}
    local failed=${MODULE_RESULTS["${module}_failed"]:-0}

    if [ $total -gt 0 ]; then
        local percent=$(awk "BEGIN {printf \"%.1f\", ($passed/$total)*100}")
        echo "  📊 $module: $passed/$total 通过 ($percent%)"
    fi
}

echo "================================================================================"
echo "综合API测试 - 所有主要模块"
echo "================================================================================"
echo ""

# ============================================================================
echo "1️⃣  SUPPLIERS API"
echo "--------------------------------------------------------------------------------"
test_api "SUPPLIERS" "获取供应商列表" "${BASE_URL}/api/mobile/${FACTORY_ID}/suppliers?page=1&size=5"
test_api "SUPPLIERS" "获取活跃供应商" "${BASE_URL}/api/mobile/${FACTORY_ID}/suppliers/active"
test_api "SUPPLIERS" "搜索供应商" "${BASE_URL}/api/mobile/${FACTORY_ID}/suppliers/search?keyword=海鲜"
test_api "SUPPLIERS" "检查供应商代码" "${BASE_URL}/api/mobile/${FACTORY_ID}/suppliers/check-code?supplierCode=SUP001"
test_api "SUPPLIERS" "供应商评级分布" "${BASE_URL}/api/mobile/${FACTORY_ID}/suppliers/rating-distribution"
test_api "SUPPLIERS" "有欠款供应商" "${BASE_URL}/api/mobile/${FACTORY_ID}/suppliers/outstanding-balance"
print_module_summary "SUPPLIERS"
echo ""

# ============================================================================
echo "2️⃣  CUSTOMERS API"
echo "--------------------------------------------------------------------------------"
test_api "CUSTOMERS" "获取客户列表" "${BASE_URL}/api/mobile/${FACTORY_ID}/customers?page=1&size=5"
test_api "CUSTOMERS" "获取活跃客户" "${BASE_URL}/api/mobile/${FACTORY_ID}/customers/active"
test_api "CUSTOMERS" "搜索客户" "${BASE_URL}/api/mobile/${FACTORY_ID}/customers/search?keyword=餐饮"
test_api "CUSTOMERS" "按行业查询" "${BASE_URL}/api/mobile/${FACTORY_ID}/customers/by-industry?industry=餐饮业"
test_api "CUSTOMERS" "检查客户代码" "${BASE_URL}/api/mobile/${FACTORY_ID}/customers/check-code?customerCode=CUST003"
test_api "CUSTOMERS" "客户评级分布" "${BASE_URL}/api/mobile/${FACTORY_ID}/customers/rating-distribution"
print_module_summary "CUSTOMERS"
echo ""

# ============================================================================
echo "3️⃣  MATERIAL TYPES API"
echo "--------------------------------------------------------------------------------"
test_api "MATERIAL_TYPES" "获取材料类型列表" "${BASE_URL}/api/mobile/${FACTORY_ID}/material-types?page=1&size=10"
test_api "MATERIAL_TYPES" "获取活跃材料类型" "${BASE_URL}/api/mobile/${FACTORY_ID}/material-types/active"
test_api "MATERIAL_TYPES" "搜索材料类型" "${BASE_URL}/api/mobile/${FACTORY_ID}/material-types/search?keyword=鱼"
print_module_summary "MATERIAL_TYPES"
echo ""

# ============================================================================
echo "4️⃣  PRODUCT TYPES API"
echo "--------------------------------------------------------------------------------"
test_api "PRODUCT_TYPES" "获取产品类型列表" "${BASE_URL}/api/mobile/${FACTORY_ID}/product-types?page=1&size=10"
test_api "PRODUCT_TYPES" "获取活跃产品类型" "${BASE_URL}/api/mobile/${FACTORY_ID}/product-types/active"
test_api "PRODUCT_TYPES" "搜索产品类型" "${BASE_URL}/api/mobile/${FACTORY_ID}/product-types/search?keyword=鱼"
print_module_summary "PRODUCT_TYPES"
echo ""

# ============================================================================
echo "5️⃣  MATERIAL BATCHES API"
echo "--------------------------------------------------------------------------------"
test_api "MATERIAL_BATCHES" "获取原料批次列表" "${BASE_URL}/api/mobile/${FACTORY_ID}/material-batches?page=1&size=5"
test_api "MATERIAL_BATCHES" "获取今日批次" "${BASE_URL}/api/mobile/${FACTORY_ID}/material-batches/today"
test_api "MATERIAL_BATCHES" "按供应商查询" "${BASE_URL}/api/mobile/${FACTORY_ID}/material-batches/by-supplier?supplierId=SUP_TEST_001"
test_api "MATERIAL_BATCHES" "按材料类型查询" "${BASE_URL}/api/mobile/${FACTORY_ID}/material-batches/by-material-type?materialTypeId=MAT_TYPE_001"
test_api "MATERIAL_BATCHES" "统计信息" "${BASE_URL}/api/mobile/${FACTORY_ID}/material-batches/statistics"
print_module_summary "MATERIAL_BATCHES"
echo ""

# ============================================================================
echo "6️⃣  PRODUCTION PLANS API"
echo "--------------------------------------------------------------------------------"
test_api "PRODUCTION_PLANS" "获取生产计划列表" "${BASE_URL}/api/mobile/${FACTORY_ID}/production-plans?page=1&size=5"
test_api "PRODUCTION_PLANS" "获取今日计划" "${BASE_URL}/api/mobile/${FACTORY_ID}/production-plans/today"
test_api "PRODUCTION_PLANS" "按状态查询" "${BASE_URL}/api/mobile/${FACTORY_ID}/production-plans/by-status?status=IN_PROGRESS"
test_api "PRODUCTION_PLANS" "统计信息" "${BASE_URL}/api/mobile/${FACTORY_ID}/production-plans/statistics"
print_module_summary "PRODUCTION_PLANS"
echo ""

# ============================================================================
echo "7️⃣  PROCESSING BATCHES API"
echo "--------------------------------------------------------------------------------"
test_api "PROCESSING_BATCHES" "获取加工批次列表" "${BASE_URL}/api/mobile/${FACTORY_ID}/processing-batches?page=1&size=5"
test_api "PROCESSING_BATCHES" "获取今日批次" "${BASE_URL}/api/mobile/${FACTORY_ID}/processing-batches/today"
test_api "PROCESSING_BATCHES" "按状态查询" "${BASE_URL}/api/mobile/${FACTORY_ID}/processing-batches/by-status?status=PROCESSING"
test_api "PROCESSING_BATCHES" "统计信息" "${BASE_URL}/api/mobile/${FACTORY_ID}/processing-batches/statistics"
print_module_summary "PROCESSING_BATCHES"
echo ""

# ============================================================================
echo "8️⃣  QUALITY INSPECTIONS API"
echo "--------------------------------------------------------------------------------"
test_api "QUALITY_INSPECTIONS" "获取质检列表" "${BASE_URL}/api/mobile/${FACTORY_ID}/quality-inspections?page=1&size=5"
test_api "QUALITY_INSPECTIONS" "按状态查询" "${BASE_URL}/api/mobile/${FACTORY_ID}/quality-inspections/by-status?status=PASSED"
test_api "QUALITY_INSPECTIONS" "按批次查询" "${BASE_URL}/api/mobile/${FACTORY_ID}/quality-inspections/by-batch?batchId=BATCH_001"
test_api "QUALITY_INSPECTIONS" "统计信息" "${BASE_URL}/api/mobile/${FACTORY_ID}/quality-inspections/statistics"
print_module_summary "QUALITY_INSPECTIONS"
echo ""

# ============================================================================
echo "9️⃣  EQUIPMENT API"
echo "--------------------------------------------------------------------------------"
test_api "EQUIPMENT" "获取设备列表" "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment?page=1&size=5"
test_api "EQUIPMENT" "获取活跃设备" "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment/active"
test_api "EQUIPMENT" "按状态查询" "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment/by-status?status=RUNNING"
test_api "EQUIPMENT" "统计信息" "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment/statistics"
print_module_summary "EQUIPMENT"
echo ""

# ============================================================================
echo "🔟 EQUIPMENT ALERTS API"
echo "--------------------------------------------------------------------------------"
test_api "EQUIPMENT_ALERTS" "获取设备警报" "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment-alerts?page=1&size=5"
test_api "EQUIPMENT_ALERTS" "按状态查询" "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment-alerts/by-status?status=PENDING"
test_api "EQUIPMENT_ALERTS" "统计信息" "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment-alerts/statistics"
print_module_summary "EQUIPMENT_ALERTS"
echo ""

# ============================================================================
echo "1️⃣1️⃣ TIMECLOCK API"
echo "--------------------------------------------------------------------------------"
test_api "TIMECLOCK" "获取今日打卡记录" "${BASE_URL}/api/mobile/${FACTORY_ID}/timeclock/today"
test_api "TIMECLOCK" "获取打卡历史" "${BASE_URL}/api/mobile/${FACTORY_ID}/timeclock/history?page=1&size=10"
test_api "TIMECLOCK" "获取打卡统计" "${BASE_URL}/api/mobile/${FACTORY_ID}/timeclock/statistics"
print_module_summary "TIMECLOCK"
echo ""

# ============================================================================
echo "1️⃣2️⃣ DEPARTMENTS API"
echo "--------------------------------------------------------------------------------"
test_api "DEPARTMENTS" "获取部门列表" "${BASE_URL}/api/mobile/${FACTORY_ID}/departments"
test_api "DEPARTMENTS" "获取活跃部门" "${BASE_URL}/api/mobile/${FACTORY_ID}/departments/active"
print_module_summary "DEPARTMENTS"
echo ""

# ============================================================================
echo "1️⃣3️⃣ WORK TYPES API"
echo "--------------------------------------------------------------------------------"
test_api "WORK_TYPES" "获取工种列表" "${BASE_URL}/api/mobile/${FACTORY_ID}/work-types"
test_api "WORK_TYPES" "获取活跃工种" "${BASE_URL}/api/mobile/${FACTORY_ID}/work-types/active"
print_module_summary "WORK_TYPES"
echo ""

# ============================================================================
echo "1️⃣4️⃣ REPORTS API"
echo "--------------------------------------------------------------------------------"
test_api "REPORTS" "人员报表" "${BASE_URL}/api/mobile/${FACTORY_ID}/reports/personnel"
test_api "REPORTS" "生产报表" "${BASE_URL}/api/mobile/${FACTORY_ID}/reports/production"
test_api "REPORTS" "质量报表" "${BASE_URL}/api/mobile/${FACTORY_ID}/reports/quality"
test_api "REPORTS" "设备报表" "${BASE_URL}/api/mobile/${FACTORY_ID}/reports/equipment"
print_module_summary "REPORTS"
echo ""

# ============================================================================
# 计算总体统计
echo ""
echo "================================================================================"
echo "总体测试结果"
echo "================================================================================"

TOTAL_TESTS=0
TOTAL_PASSED=0
TOTAL_FAILED=0

for key in "${!MODULE_RESULTS[@]}"; do
    if [[ $key == *"_total" ]]; then
        TOTAL_TESTS=$((TOTAL_TESTS + ${MODULE_RESULTS[$key]}))
    elif [[ $key == *"_passed" ]]; then
        TOTAL_PASSED=$((TOTAL_PASSED + ${MODULE_RESULTS[$key]}))
    elif [[ $key == *"_failed" ]]; then
        TOTAL_FAILED=$((TOTAL_FAILED + ${MODULE_RESULTS[$key]}))
    fi
done

echo "总测试数: $TOTAL_TESTS"
echo "通过: $TOTAL_PASSED ✅"
echo "失败: $TOTAL_FAILED ❌"

if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$(awk "BEGIN {printf \"%.1f\", ($TOTAL_PASSED/$TOTAL_TESTS)*100}")
    echo "通过率: $PASS_RATE%"
fi

echo "================================================================================"
