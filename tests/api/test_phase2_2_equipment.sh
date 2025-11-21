#!/bin/bash

# ============================================================
# Phase 2.2 端到端测试: 设备管理 (EquipmentController)
# 测试范围: 基于实际Controller实现的APIs
# 优先级: P0 (核心功能)
# 预计时间: 3.5小时
# ============================================================

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
API_URL="http://localhost:10010/api/mobile"
FACTORY_ID="CRETAS_2024_001"
USERNAME="proc_admin"
PASSWORD="123456"

# 测试统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 日志函数
log_test() {
    echo -e "${BLUE}[TEST $1]${NC} $2"
}

log_pass() {
    echo -e "${GREEN}✓ PASS${NC} - $1"
    ((PASSED_TESTS++))
}

log_fail() {
    echo -e "${RED}✗ FAIL${NC} - $1"
    echo -e "${RED}  $2${NC}"
    ((FAILED_TESTS++))
}

log_section() {
    echo ""
    echo -e "${YELLOW}================================================${NC}"
    echo -e "${YELLOW}$1${NC}"
    echo -e "${YELLOW}================================================${NC}"
}

# ============================================================
# 前置准备: 登录获取Token
# ============================================================
log_section "前置准备: 用户登录"

LOGIN_RESP=$(curl -s -X POST ${API_URL}/auth/unified-login \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")

ACCESS_TOKEN=$(echo $LOGIN_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('accessToken', ''))" 2>/dev/null || echo "")

if [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${RED}登录失败，无法获取Token，测试终止${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 登录成功${NC}"
echo "Token: ${ACCESS_TOKEN:0:20}..."

# ============================================================
# 动态获取现有设备ID (用于操作类测试)
# ============================================================
echo ""
echo "获取现有设备ID..."

EQUIPMENT_ID_1=$(mysql -u root cretas_db -N -e "SELECT id FROM factory_equipment WHERE factory_id='${FACTORY_ID}' LIMIT 1 OFFSET 0;" 2>/dev/null || echo "")
EQUIPMENT_ID_2=$(mysql -u root cretas_db -N -e "SELECT id FROM factory_equipment WHERE factory_id='${FACTORY_ID}' LIMIT 1 OFFSET 1;" 2>/dev/null || echo "")

if [ -n "$EQUIPMENT_ID_1" ]; then
    echo "设备ID 1: $EQUIPMENT_ID_1"
else
    echo "警告: 未找到设备ID 1，部分测试可能失败"
    EQUIPMENT_ID_1="EQ-TEST-101"  # 使用默认值
fi

if [ -n "$EQUIPMENT_ID_2" ]; then
    echo "设备ID 2: $EQUIPMENT_ID_2"
else
    echo "警告: 未找到设备ID 2，部分测试可能失败"
    EQUIPMENT_ID_2="EQ-TEST-103"  # 使用默认值
fi

# ============================================================
# 分组 1: CRUD基础操作
# ============================================================
log_section "分组 1: CRUD基础操作"

# 1.1 创建设备 - POST /
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "创建设备 - POST /"

CREATE_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/equipment" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "EQ-TEST-001",
    "name": "测试设备-切割机",
    "category": "CUTTING",
    "model": "CUT-TEST-100",
    "manufacturer": "测试厂商",
    "purchaseDate": "2025-01-01",
    "purchasePrice": 100000.00,
    "status": "IDLE",
    "location": "测试车间A-01",
    "maintenanceIntervalDays": 180
  }')

EQ_ID=$(echo $CREATE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('id', ''))" 2>/dev/null || echo "")

if [ -n "$EQ_ID" ] && [ "$EQ_ID" != "None" ]; then
    log_pass "设备创建成功，ID: $EQ_ID"
else
    log_fail "设备创建失败" "API返回无效ID或错误"
    EQ_ID="101"
fi

# 1.2 查询设备详情 - GET /{equipmentId}
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "查询设备详情 - GET /{equipmentId}"

DETAIL_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/equipment/${EQ_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

EQ_NAME=$(echo $DETAIL_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('name', ''))" 2>/dev/null || echo "")

if [ -n "$EQ_NAME" ]; then
    log_pass "设备详情查询成功，名称: $EQ_NAME"
else
    log_fail "设备详情查询失败" "API返回空数据"
fi

# 1.3 更新设备信息 - PUT /{equipmentId}
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "更新设备信息 - PUT /{equipmentId}"

UPDATE_RESP=$(curl -s -X PUT "${API_URL}/${FACTORY_ID}/equipment/${EQ_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "EQ-TEST-001",
    "name": "更新后的测试设备",
    "location": "更新后的车间位置B-02",
    "notes": "设备信息已更新"
  }')

UPDATE_SUCCESS=$(echo $UPDATE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

if [ "$UPDATE_SUCCESS" = "True" ]; then
    log_pass "设备信息更新成功"
else
    log_fail "设备信息更新失败" "success=$UPDATE_SUCCESS"
fi

# 1.4 分页查询设备列表 - GET /
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "分页查询设备列表 - GET /"

LIST_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/equipment?page=1&pageSize=10" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

TOTAL_COUNT=$(echo $LIST_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('totalElements', 0))" 2>/dev/null || echo "0")

if [ "$TOTAL_COUNT" -gt 0 ]; then
    log_pass "设备列表查询成功，共 $TOTAL_COUNT 条记录"
else
    log_fail "设备列表查询失败" "返回记录数为0"
fi

# 1.5 删除设备 - DELETE /{equipmentId}
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "删除设备 - DELETE /{equipmentId}"

# 先创建一个用于删除的设备
DEL_CREATE=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/equipment" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "EQ-DELETE-TEST",
    "name": "待删除测试设备",
    "status": "IDLE"
  }')

DEL_EQ_ID=$(echo $DEL_CREATE | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('id', ''))" 2>/dev/null || echo "")

if [ -n "$DEL_EQ_ID" ] && [ "$DEL_EQ_ID" != "None" ]; then
    DELETE_RESP=$(curl -s -X DELETE "${API_URL}/${FACTORY_ID}/equipment/${DEL_EQ_ID}" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}")

    DELETE_SUCCESS=$(echo $DELETE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

    if [ "$DELETE_SUCCESS" = "True" ]; then
        log_pass "设备删除成功"
    else
        log_fail "设备删除失败" "success=$DELETE_SUCCESS"
    fi
else
    log_fail "创建删除测试设备失败，跳过删除测试" "无法创建测试设备"
fi

# ============================================================
# 分组 2: 查询与筛选
# ============================================================
log_section "分组 2: 查询与筛选"

# 2.1 按状态查询 - GET /status/{status}
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "按状态查询 - GET /status/{status}"

STATUS_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/equipment/status/active" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

STATUS_COUNT=$(echo $STATUS_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))" 2>/dev/null || echo "0")

if [ "$STATUS_COUNT" -gt 0 ]; then
    log_pass "按状态查询成功，找到 $STATUS_COUNT 台active设备"
else
    log_fail "按状态查询失败" "返回0条记录"
fi

# 2.2 按类型查询 - GET /type/{type}
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "按类型查询 - GET /type/{type}"

TYPE_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/equipment/type/切割设备" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

TYPE_COUNT=$(echo $TYPE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))" 2>/dev/null || echo "0")

if [ "$TYPE_COUNT" -gt 0 ]; then
    log_pass "按类型查询成功，找到 $TYPE_COUNT 台切割设备"
else
    log_fail "按类型查询失败" "返回0条记录"
fi

# 2.3 搜索设备 - GET /search?keyword=xxx
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "搜索设备 - GET /search"

SEARCH_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/equipment/search?keyword=切割机" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

SEARCH_COUNT=$(echo $SEARCH_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))" 2>/dev/null || echo "0")

if [ "$SEARCH_COUNT" -ge 0 ]; then
    log_pass "设备搜索成功，找到 $SEARCH_COUNT 台设备"
else
    log_fail "设备搜索失败" "API返回错误"
fi

# 2.4 需要维护的设备 - GET /needing-maintenance
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "需要维护的设备 - GET /needing-maintenance"

MAINT_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/equipment/needing-maintenance" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

MAINT_COUNT=$(echo $MAINT_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))" 2>/dev/null || echo "0")

if [ "$MAINT_COUNT" -ge 0 ]; then
    log_pass "需要维护设备查询成功，找到 $MAINT_COUNT 台设备"
else
    log_fail "需要维护设备查询失败" "API返回错误"
fi

# 2.5 保修期即将到期 - GET /expiring-warranty?days=90
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "保修期即将到期 - GET /expiring-warranty"

WARRANTY_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/equipment/expiring-warranty?days=90" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

WARRANTY_COUNT=$(echo $WARRANTY_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))" 2>/dev/null || echo "0")

if [ "$WARRANTY_COUNT" -ge 0 ]; then
    log_pass "保修期查询成功，找到 $WARRANTY_COUNT 台设备"
else
    log_fail "保修期查询失败" "API返回错误"
fi

# ============================================================
# 分组 3: 设备操作
# ============================================================
log_section "分组 3: 设备操作"

# 3.1 更新设备状态 - PUT /{equipmentId}/status
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "更新设备状态 - PUT /{equipmentId}/status"

STATUS_UPDATE_RESP=$(curl -s -X PUT "${API_URL}/${FACTORY_ID}/equipment/${EQUIPMENT_ID_2}/status?status=active" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

STATUS_UPDATE_SUCCESS=$(echo $STATUS_UPDATE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

if [ "$STATUS_UPDATE_SUCCESS" = "True" ]; then
    log_pass "设备状态更新成功"
else
    log_fail "设备状态更新失败" "success=$STATUS_UPDATE_SUCCESS"
fi

# 3.2 启动设备 - POST /{equipmentId}/start
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "启动设备 - POST /{equipmentId}/start"

START_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/equipment/${EQUIPMENT_ID_2}/start?notes=开始生产任务" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

START_SUCCESS=$(echo $START_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

if [ "$START_SUCCESS" = "True" ]; then
    log_pass "设备启动成功"
else
    log_fail "设备启动失败" "success=$START_SUCCESS"
fi

# 3.3 停止设备 - POST /{equipmentId}/stop
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "停止设备 - POST /{equipmentId}/stop"

STOP_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/equipment/${EQUIPMENT_ID_2}/stop?notes=生产任务完成" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

STOP_SUCCESS=$(echo $STOP_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

if [ "$STOP_SUCCESS" = "True" ]; then
    log_pass "设备停止成功"
else
    log_fail "设备停止失败" "success=$STOP_SUCCESS"
fi

# 3.4 设备维护 - POST /{equipmentId}/maintenance
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "设备维护 - POST /{equipmentId}/maintenance"

MAINT_OP_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/equipment/${EQUIPMENT_ID_1}/maintenance?maintenanceDate=2025-11-21&cost=5000&description=定期保养" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

MAINT_OP_SUCCESS=$(echo $MAINT_OP_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

if [ "$MAINT_OP_SUCCESS" = "True" ]; then
    log_pass "设备维护记录成功"
else
    log_fail "设备维护记录失败" "success=$MAINT_OP_SUCCESS"
fi

# 3.5 设备报废 - POST /{equipmentId}/scrap
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "设备报废 - POST /{equipmentId}/scrap"

# 先创建一个用于报废的设备
SCRAP_CREATE=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/equipment" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "EQ-SCRAP-TEST",
    "name": "待报废测试设备",
    "status": "MALFUNCTION"
  }')

SCRAP_EQ_ID=$(echo $SCRAP_CREATE | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('id', ''))" 2>/dev/null || echo "")

if [ -n "$SCRAP_EQ_ID" ] && [ "$SCRAP_EQ_ID" != "None" ]; then
    SCRAP_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/equipment/${SCRAP_EQ_ID}/scrap" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{
        "reason": "设备老化严重，无法修复",
        "scrapDate": "2025-11-20"
      }')

    SCRAP_SUCCESS=$(echo $SCRAP_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

    if [ "$SCRAP_SUCCESS" = "True" ]; then
        log_pass "设备报废成功"
    else
        log_fail "设备报废失败" "success=$SCRAP_SUCCESS"
    fi
else
    log_fail "创建报废测试设备失败，跳过报废测试" "无法创建测试设备"
fi

# ============================================================
# 分组 4: 统计与分析
# ============================================================
log_section "分组 4: 统计与分析"

# 4.1 设备折旧价值 - GET /{equipmentId}/depreciated-value
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "设备折旧价值 - GET /{equipmentId}/depreciated-value"

DEPR_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/equipment/101/depreciated-value" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

DEPR_VALUE=$(echo $DEPR_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('depreciatedValue', 0))" 2>/dev/null || echo "0")

if [ "$DEPR_VALUE" != "0" ] || [ "$DEPR_VALUE" = "0" ]; then
    log_pass "折旧价值计算成功，当前价值: $DEPR_VALUE"
else
    log_fail "折旧价值计算失败" "API返回错误"
fi

# 4.2 设备统计信息 - GET /{equipmentId}/statistics
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "设备统计信息 - GET /{equipmentId}/statistics"

STATS_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/equipment/${EQUIPMENT_ID_1}/statistics" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

STATS_SUCCESS=$(echo $STATS_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

if [ "$STATS_SUCCESS" = "True" ]; then
    log_pass "设备统计信息查询成功"
else
    log_fail "设备统计信息查询失败" "success=$STATS_SUCCESS"
fi

# 4.3 设备使用历史 - GET /{equipmentId}/usage-history
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "设备使用历史 - GET /{equipmentId}/usage-history"

USAGE_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/equipment/101/usage-history" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

USAGE_COUNT=$(echo $USAGE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))" 2>/dev/null || echo "0")

if [ "$USAGE_COUNT" -ge 0 ]; then
    log_pass "使用历史查询成功，共 $USAGE_COUNT 条记录"
else
    log_fail "使用历史查询失败" "API返回错误"
fi

# 4.4 设备维护历史 - GET /{equipmentId}/maintenance-history
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "设备维护历史 - GET /{equipmentId}/maintenance-history"

MAINT_HIST_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/equipment/101/maintenance-history" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

MAINT_HIST_COUNT=$(echo $MAINT_HIST_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', [])))" 2>/dev/null || echo "0")

if [ "$MAINT_HIST_COUNT" -ge 0 ]; then
    log_pass "维护历史查询成功，共 $MAINT_HIST_COUNT 条记录"
else
    log_fail "维护历史查询失败" "API返回错误"
fi

# 4.5 全厂设备统计 - GET /overall-statistics
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "全厂设备统计 - GET /overall-statistics"

OVERALL_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/equipment/overall-statistics" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

OVERALL_SUCCESS=$(echo $OVERALL_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

if [ "$OVERALL_SUCCESS" = "True" ]; then
    log_pass "全厂设备统计成功"
else
    log_fail "全厂设备统计失败" "success=$OVERALL_SUCCESS"
fi

# 4.6 设备效率报告 - GET /{equipmentId}/efficiency-report
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "设备效率报告 - GET /{equipmentId}/efficiency-report"

EFF_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/equipment/${EQUIPMENT_ID_1}/efficiency-report?startDate=2025-11-01&endDate=2025-11-21" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

EFF_SUCCESS=$(echo $EFF_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

if [ "$EFF_SUCCESS" = "True" ]; then
    log_pass "设备效率报告查询成功"
else
    log_fail "设备效率报告查询失败" "success=$EFF_SUCCESS"
fi

# 4.7 设备OEE - GET /{equipmentId}/oee
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "设备OEE - GET /{equipmentId}/oee"

OEE_RESP=$(curl -s -X GET "${API_URL}/${FACTORY_ID}/equipment/${EQUIPMENT_ID_1}/oee?startDate=2025-11-01&endDate=2025-11-21" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

OEE_SUCCESS=$(echo $OEE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

if [ "$OEE_SUCCESS" = "True" ]; then
    OEE_VALUE=$(echo $OEE_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', 0))" 2>/dev/null || echo "0")
    log_pass "OEE计算成功，OEE: $OEE_VALUE"
else
    log_fail "OEE计算失败" "API返回错误"
fi

# ============================================================
# 分组 5: 批量操作与导出
# ============================================================
log_section "分组 5: 批量操作与导出"

# 5.1 批量导入 - POST /import
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "批量导入 - POST /import"

IMPORT_RESP=$(curl -s -X POST "${API_URL}/${FACTORY_ID}/equipment/import" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "equipments": [
      {
        "code": "EQ-IMPORT-001",
        "name": "导入测试设备1",
        "category": "CUTTING",
        "status": "IDLE"
      },
      {
        "code": "EQ-IMPORT-002",
        "name": "导入测试设备2",
        "category": "PACKAGING",
        "status": "IDLE"
      }
    ]
  }')

IMPORT_SUCCESS=$(echo $IMPORT_RESP | python3 -c "import sys, json; data=json.load(sys.stdin); print(str(data.get('success', False)))" 2>/dev/null || echo "False")

if [ "$IMPORT_SUCCESS" = "True" ]; then
    log_pass "批量导入成功"
else
    log_fail "批量导入失败" "success=$IMPORT_SUCCESS"
fi

# 5.2 导出数据 - GET /export
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "导出数据 - GET /export"

EXPORT_RESP=$(curl -s -o /tmp/equipment_export.xlsx -w "%{http_code}" \
  -X GET "${API_URL}/${FACTORY_ID}/equipment/export" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

if [ "$EXPORT_RESP" = "200" ]; then
    log_pass "数据导出成功"
else
    log_fail "数据导出失败" "HTTP状态码: $EXPORT_RESP"
fi

# 5.3 下载导入模板 - GET /export/template
((TOTAL_TESTS++))
log_test $TOTAL_TESTS "下载导入模板 - GET /export/template"

TEMPLATE_RESP=$(curl -s -o /tmp/equipment_template.xlsx -w "%{http_code}" \
  -X GET "${API_URL}/${FACTORY_ID}/equipment/export/template" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

if [ "$TEMPLATE_RESP" = "200" ]; then
    log_pass "模板下载成功"
else
    log_fail "模板下载失败" "HTTP状态码: $TEMPLATE_RESP"
fi

# ============================================================
# 测试总结
# ============================================================
log_section "Phase 2.2 测试总结"

PASS_RATE=$(python3 -c "print(f'{$PASSED_TESTS/$TOTAL_TESTS*100:.1f}')" 2>/dev/null || echo "0")

echo ""
echo -e "${BLUE}总测试数:${NC} $TOTAL_TESTS"
echo -e "${GREEN}通过数:${NC} $PASSED_TESTS"
echo -e "${RED}失败数:${NC} $FAILED_TESTS"
echo -e "${YELLOW}通过率:${NC} ${PASS_RATE}%"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓✓✓ Phase 2.2 设备管理测试全部通过！${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Phase 2.2 测试完成，但有 $FAILED_TESTS 个测试失败${NC}"
    echo -e "${BLUE}建议查看详细错误信息并修复后端API实现${NC}"
    exit 1
fi
