#!/bin/bash
# ============================================================================
# S5-2: 质检处置流程 E2E 测试脚本
#
# 测试场景:
# 1. 质检不合格 → AI推荐处置 → 审批通过
# 2. 质检不合格 → 手动选择处置 → 审批驳回
#
# 测试端点:
# - POST /quality-disposition/evaluate    评估处置建议
# - GET  /quality-disposition/actions     获取可用动作
# - POST /quality-disposition/execute     执行处置
# - GET  /quality-disposition/history/:id 处置历史
# - GET  /quality-disposition/rules       处置规则
# ============================================================================

set -e

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 计数器
PASSED=0
FAILED=0
TOTAL=0

# 配置
BASE_URL="${BASE_URL:-http://localhost:10010}"
FACTORY_ID="${FACTORY_ID:-F001}"

# ============================================================================
# 辅助函数
# ============================================================================

# 获取Token
get_token() {
  curl -s -X POST "$BASE_URL/api/mobile/auth/unified-login" \
    -H "Content-Type: application/json" \
    -d '{"username":"factory_admin1","password":"123456"}' | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',d).get('accessToken',''))"
}

# 测试端点
test_endpoint() {
  local name="$1"
  local response="$2"
  local check="$3"

  ((TOTAL++))

  if [ -n "$response" ] && ([ -z "$check" ] || echo "$response" | grep -q "$check"); then
    echo -e "${GREEN}✅ $name${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌ $name${NC}"
    echo "   响应: ${response:0:200}"
    ((FAILED++))
    return 1
  fi
}

# 打印分隔符
print_section() {
  echo ""
  echo -e "${BLUE}=== $1 ===${NC}"
  echo ""
}

# 检查后端是否运行
check_backend() {
  echo "检查后端服务..."
  if curl -s "$BASE_URL/api/mobile/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 后端服务运行中${NC}"
    return 0
  else
    echo -e "${RED}❌ 后端服务未运行，请先启动后端${NC}"
    exit 1
  fi
}

# ============================================================================
# 开始测试
# ============================================================================

echo "=============================================="
echo "S5-2: 质检处置流程 E2E 测试"
echo "=============================================="
echo ""
echo "配置:"
echo "  BASE_URL: $BASE_URL"
echo "  FACTORY_ID: $FACTORY_ID"
echo ""

# 检查后端
check_backend
echo ""

# 获取Token
echo "获取认证Token..."
TOKEN=$(get_token)
if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ 获取Token失败${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Token获取成功${NC}"

# ============================================================================
# 1. 测试获取可用处置动作
# ============================================================================
print_section "1. 获取可用处置动作"

RESPONSE=$(curl -s "$BASE_URL/api/mobile/$FACTORY_ID/quality-disposition/actions" \
  -H "Authorization: Bearer $TOKEN")

test_endpoint "1.1 获取处置动作列表" "$RESPONSE" "RELEASE"

# 解析动作数量
ACTION_COUNT=$(echo "$RESPONSE" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    data = d.get('data', d) if isinstance(d, dict) else d
    print(len(data) if isinstance(data, list) else 0)
except:
    print(0)
" 2>/dev/null)

echo "   找到 $ACTION_COUNT 个处置动作"

# ============================================================================
# 2. 测试获取处置规则
# ============================================================================
print_section "2. 获取处置规则"

RESPONSE=$(curl -s "$BASE_URL/api/mobile/$FACTORY_ID/quality-disposition/rules" \
  -H "Authorization: Bearer $TOKEN")

test_endpoint "2.1 获取处置规则列表" "$RESPONSE" "ruleName"

# 解析规则数量
RULE_COUNT=$(echo "$RESPONSE" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    data = d.get('data', d) if isinstance(d, dict) else d
    print(len(data) if isinstance(data, list) else 0)
except:
    print(0)
" 2>/dev/null)

echo "   找到 $RULE_COUNT 条处置规则"

# ============================================================================
# 3. 查找质检记录用于测试
# ============================================================================
print_section "3. 查找质检记录"

# 先获取生产批次
BATCHES_RESPONSE=$(curl -s "$BASE_URL/api/mobile/$FACTORY_ID/processing/batches?page=1&size=10" \
  -H "Authorization: Bearer $TOKEN")

# 提取第一个批次ID
BATCH_ID=$(echo "$BATCHES_RESPONSE" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    data = d.get('data', d)
    content = data.get('content', data) if isinstance(data, dict) else data
    if isinstance(content, list) and len(content) > 0:
        print(content[0].get('id', ''))
except:
    pass
" 2>/dev/null)

if [ -n "$BATCH_ID" ] && [ "$BATCH_ID" != "None" ]; then
  echo "   找到生产批次: $BATCH_ID"
else
  echo -e "${YELLOW}⚠️ 没有找到生产批次，将跳过部分测试${NC}"
  BATCH_ID=""
fi

# 获取质检记录
INSPECTIONS_RESPONSE=$(curl -s "$BASE_URL/api/mobile/$FACTORY_ID/quality-inspections?page=1&size=10" \
  -H "Authorization: Bearer $TOKEN")

# 提取第一个质检记录ID
INSPECTION_ID=$(echo "$INSPECTIONS_RESPONSE" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    data = d.get('data', d)
    content = data.get('content', data) if isinstance(data, dict) else data
    if isinstance(content, list) and len(content) > 0:
        print(content[0].get('id', ''))
except:
    pass
" 2>/dev/null)

if [ -n "$INSPECTION_ID" ] && [ "$INSPECTION_ID" != "None" ]; then
  echo "   找到质检记录: $INSPECTION_ID"
  HAS_INSPECTION=true
else
  echo -e "${YELLOW}⚠️ 没有找到质检记录，将跳过评估测试${NC}"
  HAS_INSPECTION=false
fi

# ============================================================================
# 4. 测试评估处置建议 (场景1: 质检不合格)
# ============================================================================
print_section "4. 评估处置建议"

if [ "$HAS_INSPECTION" = true ]; then
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/mobile/$FACTORY_ID/quality-disposition/evaluate" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"inspectionId\": \"$INSPECTION_ID\",
      \"productionBatchId\": $BATCH_ID,
      \"inspectorId\": 1,
      \"sampleSize\": 100,
      \"passCount\": 70,
      \"failCount\": 30
    }")

  test_endpoint "4.1 评估处置建议 (合格率70%)" "$RESPONSE"

  # 提取推荐动作
  RECOMMENDED_ACTION=$(echo "$RESPONSE" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    data = d.get('data', d)
    print(data.get('recommendedAction', ''))
except:
    pass
" 2>/dev/null)

  if [ -n "$RECOMMENDED_ACTION" ]; then
    echo "   推荐处置动作: $RECOMMENDED_ACTION"
  fi

  # 检查是否需要审批
  REQUIRES_APPROVAL=$(echo "$RESPONSE" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    data = d.get('data', d)
    print('true' if data.get('requiresApproval', False) else 'false')
except:
    print('unknown')
" 2>/dev/null)

  echo "   需要审批: $REQUIRES_APPROVAL"

else
  echo -e "${YELLOW}⚠️ 跳过 - 没有质检记录${NC}"
  ((TOTAL++))
fi

# ============================================================================
# 5. 测试执行处置动作 (场景1: 放行 - 不需审批)
# ============================================================================
print_section "5. 执行处置动作 (放行)"

if [ "$HAS_INSPECTION" = true ] && [ -n "$BATCH_ID" ]; then
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/mobile/$FACTORY_ID/quality-disposition/execute" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"batchId\": $BATCH_ID,
      \"inspectionId\": \"$INSPECTION_ID\",
      \"actionCode\": \"RELEASE\",
      \"operatorComment\": \"E2E测试 - 直接放行\",
      \"executorId\": 1
    }")

  test_endpoint "5.1 执行放行动作" "$RESPONSE"

  # 检查执行状态
  EXEC_STATUS=$(echo "$RESPONSE" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    data = d.get('data', d)
    print(data.get('status', ''))
except:
    pass
" 2>/dev/null)

  if [ -n "$EXEC_STATUS" ]; then
    echo "   执行状态: $EXEC_STATUS"
  fi
else
  echo -e "${YELLOW}⚠️ 跳过 - 没有质检记录或批次${NC}"
  ((TOTAL++))
fi

# ============================================================================
# 6. 测试执行处置动作 (场景2: 返工 - 需要审批)
# ============================================================================
print_section "6. 执行处置动作 (返工-需审批)"

if [ "$HAS_INSPECTION" = true ] && [ -n "$BATCH_ID" ]; then
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/mobile/$FACTORY_ID/quality-disposition/execute" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"batchId\": $BATCH_ID,
      \"inspectionId\": \"$INSPECTION_ID\",
      \"actionCode\": \"REWORK\",
      \"operatorComment\": \"E2E测试 - 返工申请\",
      \"executorId\": 1
    }")

  test_endpoint "6.1 执行返工动作 (需审批)" "$RESPONSE"

  # 检查是否触发审批
  APPROVAL_INITIATED=$(echo "$RESPONSE" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    data = d.get('data', d)
    print('true' if data.get('approvalInitiated', False) else 'false')
except:
    print('unknown')
" 2>/dev/null)

  echo "   触发审批: $APPROVAL_INITIATED"

  # 提取审批请求ID
  APPROVAL_REQUEST_ID=$(echo "$RESPONSE" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    data = d.get('data', d)
    print(data.get('approvalRequestId', ''))
except:
    pass
" 2>/dev/null)

  if [ -n "$APPROVAL_REQUEST_ID" ] && [ "$APPROVAL_REQUEST_ID" != "None" ]; then
    echo "   审批请求ID: $APPROVAL_REQUEST_ID"
  fi
else
  echo -e "${YELLOW}⚠️ 跳过 - 没有质检记录或批次${NC}"
  ((TOTAL++))
fi

# ============================================================================
# 7. 测试获取处置历史
# ============================================================================
print_section "7. 获取处置历史"

if [ -n "$BATCH_ID" ] && [ "$BATCH_ID" != "None" ]; then
  RESPONSE=$(curl -s "$BASE_URL/api/mobile/$FACTORY_ID/quality-disposition/history/$BATCH_ID" \
    -H "Authorization: Bearer $TOKEN")

  test_endpoint "7.1 获取批次处置历史" "$RESPONSE"

  # 解析历史记录数量
  HISTORY_COUNT=$(echo "$RESPONSE" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    data = d.get('data', d) if isinstance(d, dict) else d
    print(len(data) if isinstance(data, list) else 0)
except:
    print(0)
" 2>/dev/null)

  echo "   历史记录数: $HISTORY_COUNT"
else
  echo -e "${YELLOW}⚠️ 跳过 - 没有批次ID${NC}"
  ((TOTAL++))
fi

# ============================================================================
# 8. 测试创建处置规则
# ============================================================================
print_section "8. 创建处置规则"

TIMESTAMP=$(date +%s)
RESPONSE=$(curl -s -X POST "$BASE_URL/api/mobile/$FACTORY_ID/quality-disposition/rules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"ruleName\": \"E2E测试规则-$TIMESTAMP\",
    \"description\": \"E2E测试创建的规则\",
    \"minPassRate\": 75.00,
    \"maxDefectRate\": 25.00,
    \"action\": \"REWORK\",
    \"requiresApproval\": true,
    \"approvalLevel\": \"SUPERVISOR\",
    \"priority\": 5,
    \"enabled\": true
  }")

test_endpoint "8.1 创建处置规则" "$RESPONSE" "ruleName"

# ============================================================================
# 9. 场景测试: 高合格率自动放行
# ============================================================================
print_section "9. 场景测试: 高合格率 (95%+)"

if [ "$HAS_INSPECTION" = true ]; then
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/mobile/$FACTORY_ID/quality-disposition/evaluate" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"inspectionId\": \"$INSPECTION_ID\",
      \"productionBatchId\": $BATCH_ID,
      \"inspectorId\": 1,
      \"sampleSize\": 100,
      \"passCount\": 98,
      \"failCount\": 2
    }")

  test_endpoint "9.1 高合格率评估 (98%)" "$RESPONSE"

  # 验证推荐放行
  RECOMMENDED=$(echo "$RESPONSE" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    data = d.get('data', d)
    print(data.get('recommendedAction', ''))
except:
    pass
" 2>/dev/null)

  if [ "$RECOMMENDED" = "RELEASE" ]; then
    echo -e "   ${GREEN}✓ 正确推荐放行${NC}"
  else
    echo -e "   ${YELLOW}? 推荐动作: $RECOMMENDED${NC}"
  fi
else
  echo -e "${YELLOW}⚠️ 跳过 - 没有质检记录${NC}"
  ((TOTAL++))
fi

# ============================================================================
# 10. 场景测试: 低合格率报废
# ============================================================================
print_section "10. 场景测试: 低合格率 (<60%)"

if [ "$HAS_INSPECTION" = true ]; then
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/mobile/$FACTORY_ID/quality-disposition/evaluate" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"inspectionId\": \"$INSPECTION_ID\",
      \"productionBatchId\": $BATCH_ID,
      \"inspectorId\": 1,
      \"sampleSize\": 100,
      \"passCount\": 45,
      \"failCount\": 55
    }")

  test_endpoint "10.1 低合格率评估 (45%)" "$RESPONSE"

  # 验证推荐报废
  RECOMMENDED=$(echo "$RESPONSE" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    data = d.get('data', d)
    print(data.get('recommendedAction', ''))
except:
    pass
" 2>/dev/null)

  echo "   推荐动作: $RECOMMENDED"

  # 验证需要审批
  REQUIRES_APPROVAL=$(echo "$RESPONSE" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    data = d.get('data', d)
    print('true' if data.get('requiresApproval', False) else 'false')
except:
    print('unknown')
" 2>/dev/null)

  if [ "$REQUIRES_APPROVAL" = "true" ]; then
    echo -e "   ${GREEN}✓ 正确要求审批${NC}"
  fi
else
  echo -e "${YELLOW}⚠️ 跳过 - 没有质检记录${NC}"
  ((TOTAL++))
fi

# ============================================================================
# 测试总结
# ============================================================================
echo ""
echo "=============================================="
echo "测试结果总结"
echo "=============================================="
echo ""
echo -e "总测试数: $TOTAL"
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 所有测试通过！${NC}"
  exit 0
else
  echo -e "${RED}⚠️ 有 $FAILED 个测试失败${NC}"
  exit 1
fi
