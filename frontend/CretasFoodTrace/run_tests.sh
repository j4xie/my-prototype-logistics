#!/bin/bash

# Phase 1-4 自动化测试脚本
# 测试日期: $(date +%Y-%m-%d)

echo "=========================================="
echo "🧪 Phase 1-4 功能测试开始"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试结果统计
PASSED=0
FAILED=0
WARNINGS=0

# 测试函数
test_file_exists() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} 文件存在: $1"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} 文件缺失: $1"
        ((FAILED++))
        return 1
    fi
}

test_code_contains() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} 代码检查通过: $3"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} 代码检查失败: $3"
        ((FAILED++))
        return 1
    fi
}

test_code_warning() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${YELLOW}⚠${NC} 警告: $3"
        ((WARNINGS++))
        return 0
    else
        echo -e "${GREEN}✓${NC} 检查通过: $3"
        ((PASSED++))
        return 1
    fi
}

echo "=========================================="
echo "📋 阶段1: 文件完整性检查"
echo "=========================================="
echo ""

# 检查关键文件
test_file_exists "src/screens/processing/BatchDetailScreen.tsx"
test_file_exists "src/screens/processing/CreateBatchScreen.tsx"
test_file_exists "src/screens/attendance/TimeClockScreen.tsx"
test_file_exists "src/screens/management/ManagementScreen.tsx"
test_file_exists "src/screens/platform/PlatformDashboardScreen.tsx"
test_file_exists "src/navigation/ProcessingStackNavigator.tsx"
test_file_exists "src/navigation/AttendanceStackNavigator.tsx"
test_file_exists "src/navigation/PlatformStackNavigator.tsx"
test_file_exists "src/types/navigation.ts"
test_file_exists "src/services/api/processingApiClient.ts"

echo ""
echo "=========================================="
echo "📋 阶段2: 批次编辑功能代码检查"
echo "=========================================="
echo ""

# 检查 BatchDetailScreen 编辑按钮
test_code_contains "src/screens/processing/BatchDetailScreen.tsx" \
    "navigation.navigate('EditBatch'" \
    "BatchDetailScreen包含EditBatch导航"

# 检查 CreateBatchScreen 编辑模式支持
test_code_contains "src/screens/processing/CreateBatchScreen.tsx" \
    "const isEditMode = !!batchId" \
    "CreateBatchScreen支持编辑模式检测"

test_code_contains "src/screens/processing/CreateBatchScreen.tsx" \
    "loadBatchData" \
    "CreateBatchScreen包含loadBatchData函数"

test_code_contains "src/screens/processing/CreateBatchScreen.tsx" \
    "handleSubmit" \
    "CreateBatchScreen包含handleSubmit函数"

test_code_contains "src/screens/processing/CreateBatchScreen.tsx" \
    "isEditMode ? '编辑批次' : '原料入库'" \
    "CreateBatchScreen标题动态切换"

test_code_contains "src/screens/processing/CreateBatchScreen.tsx" \
    "isEditMode ? '更新批次' : '创建批次'" \
    "CreateBatchScreen按钮文字动态切换"

# 检查 processingAPI 是否有 updateBatch 方法
test_code_contains "src/services/api/processingApiClient.ts" \
    "updateBatch" \
    "processingAPI包含updateBatch方法"

# 检查 ProcessingStackNavigator 是否配置了 EditBatch 路由
test_code_contains "src/navigation/ProcessingStackNavigator.tsx" \
    "EditBatch" \
    "ProcessingStackNavigator配置了EditBatch路由"

echo ""
echo "=========================================="
echo "📋 阶段3: 考勤统计入口代码检查"
echo "=========================================="
echo ""

# 检查 TimeClockScreen 统计入口
test_code_contains "src/screens/attendance/TimeClockScreen.tsx" \
    "统计与查询" \
    "TimeClockScreen包含统计入口Card"

test_code_contains "src/screens/attendance/TimeClockScreen.tsx" \
    "打卡历史" \
    "TimeClockScreen包含打卡历史按钮"

test_code_contains "src/screens/attendance/TimeClockScreen.tsx" \
    "工时统计" \
    "TimeClockScreen包含工时统计按钮"

test_code_contains "src/screens/attendance/TimeClockScreen.tsx" \
    "工作记录" \
    "TimeClockScreen包含工作记录按钮"

test_code_contains "src/screens/attendance/TimeClockScreen.tsx" \
    "navigation.navigate('ClockHistory')" \
    "TimeClockScreen包含ClockHistory导航"

test_code_contains "src/screens/attendance/TimeClockScreen.tsx" \
    "navigation.navigate('TimeStatistics')" \
    "TimeClockScreen包含TimeStatistics导航"

test_code_contains "src/screens/attendance/TimeClockScreen.tsx" \
    "navigation.navigate('WorkRecords')" \
    "TimeClockScreen包含WorkRecords导航"

# 检查 AttendanceStackNavigator 路由配置
test_code_contains "src/navigation/AttendanceStackNavigator.tsx" \
    "ClockHistory" \
    "AttendanceStackNavigator配置了ClockHistory"

test_code_contains "src/navigation/AttendanceStackNavigator.tsx" \
    "TimeStatistics" \
    "AttendanceStackNavigator配置了TimeStatistics"

test_code_contains "src/navigation/AttendanceStackNavigator.tsx" \
    "WorkRecords" \
    "AttendanceStackNavigator配置了WorkRecords"

echo ""
echo "=========================================="
echo "📋 阶段4: 工厂设置入口代码检查"
echo "=========================================="
echo ""

# 检查 ManagementScreen 工厂设置
test_code_contains "src/screens/management/ManagementScreen.tsx" \
    "工厂配置" \
    "ManagementScreen包含工厂配置section"

test_code_contains "src/screens/management/ManagementScreen.tsx" \
    "工厂设置" \
    "ManagementScreen包含工厂设置项"

test_code_contains "src/screens/management/ManagementScreen.tsx" \
    "FactorySettings" \
    "ManagementScreen包含FactorySettings路由"

# 检查是否还有注释
test_code_warning "src/screens/management/ManagementScreen.tsx" \
    "// TODO: Phase 3" \
    "ManagementScreen仍有Phase 3 TODO注释（应该已取消）"

echo ""
echo "=========================================="
echo "📋 阶段5: 平台管理模块代码检查"
echo "=========================================="
echo ""

# 检查 navigation.ts 平台类型定义
test_code_contains "src/types/navigation.ts" \
    "PlatformDashboard: undefined" \
    "navigation.ts包含PlatformDashboard类型"

test_code_contains "src/types/navigation.ts" \
    "FactoryManagement: undefined" \
    "navigation.ts包含FactoryManagement类型"

test_code_contains "src/types/navigation.ts" \
    "AIQuotaManagement: undefined" \
    "navigation.ts包含AIQuotaManagement类型"

# 检查 PlatformStackNavigator 配置
test_code_contains "src/navigation/PlatformStackNavigator.tsx" \
    "PlatformDashboard" \
    "PlatformStackNavigator包含PlatformDashboard"

test_code_contains "src/navigation/PlatformStackNavigator.tsx" \
    "FactoryManagement" \
    "PlatformStackNavigator包含FactoryManagement"

# 检查 MainNavigator 平台Tab配置
test_code_contains "src/navigation/MainNavigator.tsx" \
    "PlatformTab" \
    "MainNavigator配置了PlatformTab"

test_code_contains "src/navigation/MainNavigator.tsx" \
    "user?.userType === 'platform'" \
    "MainNavigator包含平台权限控制"

echo ""
echo "=========================================="
echo "📊 测试结果统计"
echo "=========================================="
echo ""

TOTAL=$((PASSED + FAILED))
if [ $TOTAL -gt 0 ]; then
    SUCCESS_RATE=$((PASSED * 100 / TOTAL))
else
    SUCCESS_RATE=0
fi

echo -e "${BLUE}总测试项:${NC} $TOTAL"
echo -e "${GREEN}通过:${NC} $PASSED"
echo -e "${RED}失败:${NC} $FAILED"
echo -e "${YELLOW}警告:${NC} $WARNINGS"
echo -e "${BLUE}成功率:${NC} $SUCCESS_RATE%"
echo ""

# 生成测试报告
REPORT_FILE="TEST_RESULTS_$(date +%Y%m%d_%H%M%S).txt"
{
    echo "Phase 1-4 自动化测试报告"
    echo "=========================="
    echo "测试时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo "测试结果统计:"
    echo "- 总测试项: $TOTAL"
    echo "- 通过: $PASSED"
    echo "- 失败: $FAILED"
    echo "- 警告: $WARNINGS"
    echo "- 成功率: $SUCCESS_RATE%"
    echo ""
    echo "测试结论:"
    if [ $FAILED -eq 0 ]; then
        echo "✅ 所有代码检查通过！"
    elif [ $FAILED -le 2 ]; then
        echo "⚠️ 有少量问题，建议修复"
    else
        echo "❌ 有较多问题，需要修复"
    fi
} > "$REPORT_FILE"

echo "📄 测试报告已保存到: $REPORT_FILE"
echo ""

# 最终结论
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}=========================================="
    echo "✅ 所有代码检查通过！"
    echo "==========================================${NC}"
    echo ""
    echo "下一步："
    echo "1. 运行 TypeScript 检查: npx tsc --noEmit"
    echo "2. 启动开发服务器: npx expo start"
    echo "3. 进行手动功能测试"
    exit 0
elif [ $FAILED -le 2 ]; then
    echo -e "${YELLOW}=========================================="
    echo "⚠️ 有 $FAILED 项检查失败"
    echo "==========================================${NC}"
    echo ""
    echo "建议修复后再进行功能测试"
    exit 1
else
    echo -e "${RED}=========================================="
    echo "❌ 有 $FAILED 项检查失败"
    echo "==========================================${NC}"
    echo ""
    echo "请修复这些问题后再继续"
    exit 1
fi
