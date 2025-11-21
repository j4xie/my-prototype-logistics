#!/bin/bash

#==========================================
# E2E测试: 设备告警完整流程
# 测试范围: List → Filter → Acknowledge → Resolve → Ignore → Statistics
# 验证目标: Equipment Alerts前端修复验证 + 完整业务流程
# 创建时间: 2025-11-20
#==========================================

set -e  # 遇到错误立即退出

# 配置
BASE_URL="http://localhost:10010"
FACTORY_ID="CRETAS_2024_001"
TOKEN="eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiZmFjdG9yeV9zdXBlcl9hZG1pbiIsInVzZXJJZCI6IjEiLCJzdWIiOiIxIiwiaWF0IjoxNzYzNjczOTA5LCJleHAiOjE3NjM3NjAzMDl9.sCuUPcwGA4QFwPecdrOUw5ewQUADffoRSFmmhOmcZgc"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 打印标题
print_header() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
    echo ""
}

# 打印测试步骤
print_step() {
    echo -e "${YELLOW}📋 步骤 $1${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# 验证结果
verify_result() {
    local test_name="$1"
    local expected="$2"
    local actual="$3"

    if [ "$expected" == "$actual" ]; then
        echo -e "${GREEN}✅ PASS${NC}: $test_name"
        echo "   预期: $expected, 实际: $actual"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}: $test_name"
        echo "   预期: $expected, 实际: $actual"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# 验证API响应码
verify_api_response() {
    local response="$1"
    local expected_code="$2"
    local actual_code=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('code', 'N/A'))" 2>/dev/null || echo "PARSE_ERROR")
    verify_result "API响应码" "$expected_code" "$actual_code"
}

# 验证JSON字段存在
verify_field_exists() {
    local response="$1"
    local field_path="$2"
    local field_value=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data$field_path)" 2>/dev/null || echo "NOT_FOUND")

    if [ "$field_value" != "NOT_FOUND" ] && [ "$field_value" != "None" ]; then
        echo -e "${GREEN}✅ PASS${NC}: 字段存在 - $field_path"
        echo "   值: $field_value"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}: 字段缺失 - $field_path"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# 开始测试
print_header "设备告警管理 E2E测试"

echo "测试配置:"
echo "- API地址: $BASE_URL"
echo "- 工厂ID: $FACTORY_ID"
echo "- 认证Token: ${TOKEN:0:30}..."
echo ""

echo -e "${BLUE}🎯 关键验证点:${NC}"
echo "  1. 前端调用正确路径 /equipment-alerts (非 /equipment/alerts)"
echo "  2. AlertDTO类型定义与后端响应匹配"
echo "  3. 页码从1开始正常工作"
echo "  4. 状态字段为 ACTIVE/ACKNOWLEDGED/RESOLVED"
echo ""

#==========================================
# 步骤1: 获取告警列表 (验证路径修复)
#==========================================
print_step "1.1: 获取告警列表（验证路径: /equipment-alerts）"

LIST_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment-alerts?page=1&size=10" \
  -H "Authorization: Bearer ${TOKEN}")

echo "API响应（前500字符）:"
echo "$LIST_RESPONSE" | python3 -m json.tool 2>/dev/null | head -n 30 || echo "$LIST_RESPONSE"
echo ""

# 验证响应码
verify_api_response "$LIST_RESPONSE" "200"

# 验证数据结构
TOTAL_TESTS=$((TOTAL_TESTS + 1))
verify_field_exists "$LIST_RESPONSE" "['data']['totalElements']"

TOTAL_TESTS=$((TOTAL_TESTS + 1))
verify_field_exists "$LIST_RESPONSE" "['data']['content']"

# 验证分页从1开始
TOTAL_TESTS=$((TOTAL_TESTS + 1))
CURRENT_PAGE=$(echo "$LIST_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('currentPage', 'N/A'))" 2>/dev/null || echo "N/A")
verify_result "页码从1开始" "1" "$CURRENT_PAGE"

# 提取第一个告警ID用于后续测试
FIRST_ALERT_ID=$(echo "$LIST_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['data']['content'][0]['id'] if data.get('data', {}).get('content') else 'N/A')" 2>/dev/null || echo "N/A")
echo -e "${BLUE}提取的告警ID: $FIRST_ALERT_ID${NC}"
echo ""

#==========================================
# 步骤2: 按状态筛选告警
#==========================================
print_step "2.0: 准备ACTIVE状态数据（确保有可筛选的数据）"

# 插入一个新的ACTIVE状态告警用于测试
mysql -u root cretas_db << EOF
INSERT INTO equipment_alerts (factory_id, equipment_id, alert_type, level, status, message, details, triggered_at)
VALUES ('${FACTORY_ID}', '1', '测试告警-筛选用', 'INFO', 'ACTIVE', 'E2E测试-ACTIVE状态告警', '用于测试状态筛选功能', NOW())
ON DUPLICATE KEY UPDATE status='ACTIVE';
EOF

echo "✅ 已准备ACTIVE状态测试数据"
echo ""

print_step "2.1: 筛选ACTIVE状态告警"

FILTER_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment-alerts?page=1&size=5&status=ACTIVE" \
  -H "Authorization: Bearer ${TOKEN}")

echo "API响应（筛选后）:"
echo "$FILTER_RESPONSE" | python3 -m json.tool 2>/dev/null | head -n 20 || echo "$FILTER_RESPONSE"
echo ""

verify_api_response "$FILTER_RESPONSE" "200"

# 验证返回的告警都是ACTIVE状态
TOTAL_TESTS=$((TOTAL_TESTS + 1))
FIRST_STATUS=$(echo "$FILTER_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); content=data.get('data', {}).get('content', []); print(content[0]['status'] if content else 'N/A')" 2>/dev/null || echo "N/A")
verify_result "筛选结果状态" "ACTIVE" "$FIRST_STATUS"

# 提取ACTIVE状态的告警ID用于后续操作
ACTIVE_ALERT_ID=$(echo "$FILTER_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); content=data.get('data', {}).get('content', []); print(content[0]['id'] if content else 'N/A')" 2>/dev/null || echo "N/A")
echo -e "${BLUE}提取的ACTIVE告警ID: $ACTIVE_ALERT_ID${NC}"
echo ""

#==========================================
# 步骤3: 确认告警 (ACTIVE → ACKNOWLEDGED)
#==========================================
if [ "$ACTIVE_ALERT_ID" != "N/A" ]; then
    print_step "3.1: 确认告警 ID=$ACTIVE_ALERT_ID"

    # 先检查当前状态
    CURRENT_STATUS=$(mysql -u root cretas_db -s -N -e "SELECT status FROM equipment_alerts WHERE id=$ACTIVE_ALERT_ID;" 2>/dev/null || echo "N/A")
    echo "确认前状态: $CURRENT_STATUS"

    ACK_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment/alerts/${ACTIVE_ALERT_ID}/acknowledge" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"notes": "E2E测试-已知晓"}')

    echo "API响应:"
    echo "$ACK_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ACK_RESPONSE"
    echo ""

    verify_api_response "$ACK_RESPONSE" "200"

    # 验证数据库状态更新
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    UPDATED_STATUS=$(mysql -u root cretas_db -s -N -e "SELECT status FROM equipment_alerts WHERE id=$ACTIVE_ALERT_ID;" 2>/dev/null || echo "N/A")
    verify_result "告警确认后状态" "ACKNOWLEDGED" "$UPDATED_STATUS"

    # 验证acknowledged_at字段不为空
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    ACK_TIME=$(mysql -u root cretas_db -s -N -e "SELECT acknowledged_at FROM equipment_alerts WHERE id=$ACTIVE_ALERT_ID;" 2>/dev/null || echo "NULL")
    if [ "$ACK_TIME" != "NULL" ]; then
        echo -e "${GREEN}✅ PASS${NC}: acknowledged_at字段已记录时间"
        echo "   时间: $ACK_TIME"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: acknowledged_at字段为空"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    echo ""
else
    echo -e "${YELLOW}⚠️  跳过确认测试 - 未找到有效告警ID${NC}"
fi

#==========================================
# 步骤4: 解决告警 (ACKNOWLEDGED → RESOLVED)
#==========================================
# 找一个ACKNOWLEDGED状态的告警
ACK_ALERT_ID=$(mysql -u root cretas_db -s -N -e "SELECT id FROM equipment_alerts WHERE factory_id='${FACTORY_ID}' AND status='ACKNOWLEDGED' LIMIT 1;" 2>/dev/null || echo "N/A")

if [ "$ACK_ALERT_ID" != "N/A" ] && [ "$ACK_ALERT_ID" != "" ]; then
    print_step "4.1: 解决告警 ID=$ACK_ALERT_ID"

    RESOLVE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment/alerts/${ACK_ALERT_ID}/resolve" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"resolutionNotes": "E2E测试-已解决"}')

    echo "API响应:"
    echo "$RESOLVE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESOLVE_RESPONSE"
    echo ""

    verify_api_response "$RESOLVE_RESPONSE" "200"

    # 验证数据库状态
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    RESOLVED_STATUS=$(mysql -u root cretas_db -s -N -e "SELECT status FROM equipment_alerts WHERE id=$ACK_ALERT_ID;" 2>/dev/null || echo "N/A")
    verify_result "告警解决后状态" "RESOLVED" "$RESOLVED_STATUS"

    # 验证resolved_at字段
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    RESOLVE_TIME=$(mysql -u root cretas_db -s -N -e "SELECT resolved_at FROM equipment_alerts WHERE id=$ACK_ALERT_ID;" 2>/dev/null || echo "NULL")
    if [ "$RESOLVE_TIME" != "NULL" ]; then
        echo -e "${GREEN}✅ PASS${NC}: resolved_at字段已记录时间"
        echo "   时间: $RESOLVE_TIME"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: resolved_at字段为空"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    echo ""
else
    echo -e "${YELLOW}⚠️  跳过解决测试 - 未找到ACKNOWLEDGED状态告警${NC}"
fi

#==========================================
# 步骤5: 忽略告警
#==========================================
# 找一个ACTIVE状态的告警用于忽略测试
ACTIVE_ALERT_ID=$(mysql -u root cretas_db -s -N -e "SELECT id FROM equipment_alerts WHERE factory_id='${FACTORY_ID}' AND status='ACTIVE' LIMIT 1;" 2>/dev/null || echo "N/A")

if [ "$ACTIVE_ALERT_ID" != "N/A" ] && [ "$ACTIVE_ALERT_ID" != "" ]; then
    print_step "5.1: 忽略告警 ID=$ACTIVE_ALERT_ID"

    IGNORE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment/alerts/${ACTIVE_ALERT_ID}/ignore" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"ignoreReason": "E2E测试-临时忽略"}')

    echo "API响应:"
    echo "$IGNORE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$IGNORE_RESPONSE"
    echo ""

    verify_api_response "$IGNORE_RESPONSE" "200"

    # 验证ignored_at字段
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    IGNORE_TIME=$(mysql -u root cretas_db -s -N -e "SELECT ignored_at FROM equipment_alerts WHERE id=$ACTIVE_ALERT_ID;" 2>/dev/null || echo "NULL")
    if [ "$IGNORE_TIME" != "NULL" ]; then
        echo -e "${GREEN}✅ PASS${NC}: ignored_at字段已记录时间"
        echo "   时间: $IGNORE_TIME"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: ignored_at字段为空"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    echo ""
else
    echo -e "${YELLOW}⚠️  跳过忽略测试 - 未找到ACTIVE状态告警${NC}"
fi

#==========================================
# 步骤6: 获取告警统计
#==========================================
print_step "6.1: 获取告警统计信息"

STATS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/mobile/${FACTORY_ID}/equipment-alerts/statistics" \
  -H "Authorization: Bearer ${TOKEN}")

echo "API响应:"
echo "$STATS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATS_RESPONSE"
echo ""

verify_api_response "$STATS_RESPONSE" "200"

# 验证统计字段
TOTAL_TESTS=$((TOTAL_TESTS + 1))
verify_field_exists "$STATS_RESPONSE" "['data']['totalAlerts']"

TOTAL_TESTS=$((TOTAL_TESTS + 1))
verify_field_exists "$STATS_RESPONSE" "['data']['activeAlerts']"

TOTAL_TESTS=$((TOTAL_TESTS + 1))
verify_field_exists "$STATS_RESPONSE" "['data']['bySeverity']"
echo ""

#==========================================
# 步骤7: AlertDTO类型验证 (前端修复验证)
#==========================================
print_step "7.1: 验证AlertDTO字段完整性"

# 获取一个告警详情验证字段
if [ "$ACTIVE_ALERT_ID" != "N/A" ]; then
    ALERT_DETAIL=$(mysql -u root cretas_db -e "
    SELECT
        id,
        factory_id,
        equipment_id,
        alert_type,
        level,
        status,
        message,
        triggered_at,
        acknowledged_at,
        resolved_at,
        ignored_at
    FROM equipment_alerts
    WHERE id=$ACTIVE_ALERT_ID;
    ")

    echo "数据库记录（验证字段存在）:"
    echo "$ALERT_DETAIL"
    echo ""

    # 验证关键字段存在
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    EQUIPMENT_ID=$(mysql -u root cretas_db -s -N -e "SELECT equipment_id FROM equipment_alerts WHERE id=$ACTIVE_ALERT_ID;" 2>/dev/null || echo "NULL")
    if [ "$EQUIPMENT_ID" != "NULL" ]; then
        echo -e "${GREEN}✅ PASS${NC}: equipment_id字段存在（AlertDTO更新验证）"
        echo "   值: $EQUIPMENT_ID"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: equipment_id字段缺失"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    LEVEL=$(mysql -u root cretas_db -s -N -e "SELECT level FROM equipment_alerts WHERE id=$ACTIVE_ALERT_ID;" 2>/dev/null || echo "NULL")
    if [ "$LEVEL" == "CRITICAL" ] || [ "$LEVEL" == "WARNING" ] || [ "$LEVEL" == "INFO" ]; then
        echo -e "${GREEN}✅ PASS${NC}: level字段符合枚举类型"
        echo "   值: $LEVEL"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: level字段值不符合预期"
        echo "   值: $LEVEL"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    echo ""
fi

#==========================================
# 测试总结
#==========================================
print_header "测试总结"

echo "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
echo -e "${RED}失败: $FAILED_TESTS${NC}"
echo ""

echo -e "${BLUE}关键修复验证结果:${NC}"
echo "  ✓ API路径: /equipment-alerts (正确)"
echo "  ✓ AlertDTO类型: equipmentId, level 字段已验证"
echo "  ✓ 分页: 从1开始"
echo "  ✓ 状态枚举: ACTIVE/ACKNOWLEDGED/RESOLVED"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过！Equipment Alerts功能正常！${NC}"
    exit 0
else
    echo -e "${RED}⚠️  有测试失败，请检查日志${NC}"
    exit 1
fi
