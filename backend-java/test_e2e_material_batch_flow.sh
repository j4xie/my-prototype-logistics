#!/bin/bash

#==========================================
# E2E测试: 原材料批次完整流程
# 测试范围: Create → Convert to Frozen → Undo → Verify Database
# 创建时间: 2025-11-20
#==========================================

set -e  # 遇到错误立即退出

# 配置
BASE_URL="http://localhost:10010"
FACTORY_ID="CRETAS_2024_001"
BATCH_ID="1d3b647d-5615-474f-a966-39c7b4dfa2ec"
TEST_USER_ID=1

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
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

# 验证数据库状态
verify_db_status() {
    local expected_status="$1"
    local actual_status=$(mysql -u root cretas_db -s -N -e "SELECT status FROM material_batches WHERE id='$BATCH_ID';")
    verify_result "数据库状态验证" "$expected_status" "$actual_status"
}

# 验证API响应码
verify_api_response() {
    local response="$1"
    local expected_code="$2"
    local actual_code=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('code', 'N/A'))" 2>/dev/null || echo "PARSE_ERROR")
    verify_result "API响应码" "$expected_code" "$actual_code"
}

# 开始测试
print_header "原材料批次管理 E2E测试"

echo "测试配置:"
echo "- API地址: $BASE_URL"
echo "- 工厂ID: $FACTORY_ID"
echo "- 批次ID: $BATCH_ID"
echo "- 操作人ID: $TEST_USER_ID"
echo ""

#==========================================
# 测试前准备: 确保批次存在且为FRESH状态
#==========================================
print_step "1.1: 准备测试数据 - 重置批次为FRESH状态"

mysql -u root cretas_db << EOF
UPDATE material_batches
SET status='FRESH',
    storage_location='A区-01货架',
    notes=NULL,
    updated_at=NOW()
WHERE id='$BATCH_ID';
EOF

# 验证初始状态
INITIAL_STATUS=$(mysql -u root cretas_db -s -N -e "SELECT status FROM material_batches WHERE id='$BATCH_ID';")
echo "初始状态: $INITIAL_STATUS"
verify_result "初始状态准备" "FRESH" "$INITIAL_STATUS"
echo ""

#==========================================
# 步骤2: 转为冻品 (FRESH → FROZEN)
#==========================================
print_step "2.1: 调用API - 转为冻品"

CONVERT_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/material-batches/${BATCH_ID}/convert-to-frozen" \
  -H 'Content-Type: application/json' \
  -d "{\"convertedBy\":${TEST_USER_ID},\"convertedDate\":\"2025-11-20\",\"storageLocation\":\"冷冻库-F区\",\"notes\":\"E2E测试-转冻品\"}")

echo "API响应:"
echo "$CONVERT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CONVERT_RESPONSE"
echo ""

# 验证API响应
verify_api_response "$CONVERT_RESPONSE" "200"

# 验证数据库状态
print_step "2.2: 验证转换后数据库状态"
verify_db_status "FROZEN"

# 验证storage_location更新
STORAGE_LOCATION=$(mysql -u root cretas_db -s -N -e "SELECT storage_location FROM material_batches WHERE id='$BATCH_ID';")
verify_result "存储位置更新" "冷冻库-F区" "$STORAGE_LOCATION"

# 验证notes记录
print_step "2.3: 验证操作记录（notes字段）"
NOTES=$(mysql -u root cretas_db -s -N -e "SELECT notes FROM material_batches WHERE id='$BATCH_ID';")
if [[ "$NOTES" == *"转冻品操作"* ]]; then
    echo -e "${GREEN}✅ PASS${NC}: notes字段包含转冻品记录"
    echo "   记录: $NOTES"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC}: notes字段缺少转冻品记录"
    echo "   实际: $NOTES"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

#==========================================
# 步骤3: 10分钟内撤销 (应该成功)
#==========================================
print_step "3.1: 10分钟内撤销转冻品（应该成功）"

sleep 2  # 等待2秒模拟用户操作间隔

UNDO_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/material-batches/${BATCH_ID}/undo-frozen" \
  -H 'Content-Type: application/json' \
  -d "{\"operatorId\":${TEST_USER_ID},\"reason\":\"E2E测试-撤销操作\"}")

echo "API响应:"
echo "$UNDO_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$UNDO_RESPONSE"
echo ""

# 验证API响应
verify_api_response "$UNDO_RESPONSE" "200"

# 验证数据库状态恢复
print_step "3.2: 验证撤销后数据库状态恢复"
verify_db_status "FRESH"

# 验证storage_location恢复
RESTORED_LOCATION=$(mysql -u root cretas_db -s -N -e "SELECT storage_location FROM material_batches WHERE id='$BATCH_ID';")
verify_result "存储位置恢复" "A区-01货架" "$RESTORED_LOCATION"
echo ""

#==========================================
# 步骤4: 超时撤销测试 (应该失败)
#==========================================
print_step "4.1: 再次转为冻品"

CONVERT2_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/material-batches/${BATCH_ID}/convert-to-frozen" \
  -H 'Content-Type: application/json' \
  -d "{\"convertedBy\":${TEST_USER_ID},\"convertedDate\":\"2025-11-20\",\"storageLocation\":\"冷冻库-F区\",\"notes\":\"测试超时\"}")

verify_api_response "$CONVERT2_RESPONSE" "200"
verify_db_status "FROZEN"

print_step "4.2: 修改转换时间为11分钟前（模拟超时）"

# 修改notes中的时间戳为11分钟前（使用本地时间，与后端LocalDateTime.now()一致）
ELEVEN_MIN_AGO=$(date -v-11M +"%Y-%m-%dT%H:%M:%S" 2>/dev/null || date -d '11 minutes ago' +"%Y-%m-%dT%H:%M:%S")

mysql -u root cretas_db << EOF
UPDATE material_batches
SET notes = CONCAT('[${ELEVEN_MIN_AGO}] 转冻品操作 - 操作人ID:${TEST_USER_ID}, 转换日期:2025-11-20, 备注: 测试超时')
WHERE id = '${BATCH_ID}';
EOF

echo "已修改转换时间为: $ELEVEN_MIN_AGO"
echo ""

print_step "4.3: 尝试撤销（应该失败 - 超过10分钟）"

TIMEOUT_UNDO_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/material-batches/${BATCH_ID}/undo-frozen" \
  -H 'Content-Type: application/json' \
  -d "{\"operatorId\":${TEST_USER_ID},\"reason\":\"尝试超时撤销\"}")

echo "API响应:"
echo "$TIMEOUT_UNDO_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$TIMEOUT_UNDO_RESPONSE"
echo ""

# 验证应该返回400错误
TIMEOUT_CODE=$(echo "$TIMEOUT_UNDO_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('code', 'N/A'))" 2>/dev/null || echo "PARSE_ERROR")
if [ "$TIMEOUT_CODE" == "400" ] || [ "$TIMEOUT_CODE" == "500" ]; then
    echo -e "${GREEN}✅ PASS${NC}: 超时撤销正确被拒绝 (响应码: $TIMEOUT_CODE)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC}: 超时撤销未被拒绝 (响应码: $TIMEOUT_CODE)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 验证数据库状态未变化（仍为FROZEN）
print_step "4.4: 验证超时后状态未变化（仍为FROZEN）"
verify_db_status "FROZEN"
echo ""

#==========================================
# 步骤5: 数据完整性验证
#==========================================
print_step "5.1: 验证批次数据完整性"

mysql -u root cretas_db -e "
SELECT
    id,
    batch_number,
    status,
    storage_location,
    updated_at
FROM material_batches
WHERE id='$BATCH_ID';
" | head -n 10

echo ""

#==========================================
# 测试总结
#==========================================
print_header "测试总结"

echo "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
echo -e "${RED}失败: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}⚠️  有测试失败，请检查日志${NC}"
    exit 1
fi
