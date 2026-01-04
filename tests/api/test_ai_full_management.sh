#!/bin/bash
# test_ai_full_management.sh
# AI 全面管理能力综合测试脚本
# 验证所有系统配置和管理功能是否可以通过 AI 对话完成
#
# 测试覆盖:
# - SYSTEM 类意图 (排产设置、功能开关、通知配置)
# - USER 类意图 (用户创建/禁用/角色分配)
# - CONFIG 类意图 (设备维护、转换率、规则配置)
# - META 类意图 (意图创建/更新/分析)
# - DATA_OP 类意图 (数据修改)
# - FORM 类意图 (表单生成)
#
# 作者: Cretas Team
# 版本: 1.0.0
# 日期: 2026-01-03

set -e

# ==================== 配置 ====================
BASE_URL="${API_BASE_URL:-http://139.196.165.140:10010/api/mobile}"
FACTORY_ID="${FACTORY_ID:-F001}"
USERNAME="${TEST_USERNAME:-factory_admin1}"
PASSWORD="${TEST_PASSWORD:-123456}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# ==================== 工具函数 ====================

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[PASS]${NC} $1"
  ((PASSED_TESTS++))
}

log_fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  ((FAILED_TESTS++))
}

log_skip() {
  echo -e "${YELLOW}[SKIP]${NC} $1"
  ((SKIPPED_TESTS++))
}

log_section() {
  echo ""
  echo -e "${YELLOW}========== $1 ==========${NC}"
}

# 获取 Token
get_token() {
  local response
  response=$(curl -s -X POST "$BASE_URL/auth/unified-login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

  local token
  token=$(echo "$response" | jq -r '.data.accessToken // empty')

  if [ -z "$token" ]; then
    echo "ERROR: 无法获取 Token"
    echo "Response: $response"
    exit 1
  fi

  echo "$token"
}

# 执行意图识别
recognize_intent() {
  local user_input=$1
  local context=${2:-"{}"}

  curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/recognize" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"userInput\": \"$user_input\"}"
}

# 执行意图
execute_intent() {
  local user_input=$1
  local context=${2:-"null"}

  local body
  if [ "$context" = "null" ]; then
    body="{\"userInput\": \"$user_input\"}"
  else
    body="{\"userInput\": \"$user_input\", \"context\": $context}"
  fi

  curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body"
}

# 预览意图
preview_intent() {
  local user_input=$1
  local context=${2:-"null"}

  local body
  if [ "$context" = "null" ]; then
    body="{\"userInput\": \"$user_input\"}"
  else
    body="{\"userInput\": \"$user_input\", \"context\": $context}"
  fi

  curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/preview" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body"
}

# 测试意图识别
test_recognition() {
  local test_id=$1
  local user_input=$2
  local expected_intent=$3

  ((TOTAL_TESTS++))

  local response
  response=$(recognize_intent "$user_input")

  local recognized
  recognized=$(echo "$response" | jq -r '.data.intentRecognized // .intentRecognized // false')

  local intent_code
  intent_code=$(echo "$response" | jq -r '.data.intentCode // .intentCode // empty')

  if [ "$recognized" = "true" ] && [ "$intent_code" = "$expected_intent" ]; then
    log_success "$test_id: \"$user_input\" → $intent_code"
    return 0
  else
    log_fail "$test_id: \"$user_input\" 期望 $expected_intent, 实际 $intent_code (recognized=$recognized)"
    echo "  Response: $(echo "$response" | jq -c .)"
    return 1
  fi
}

# 测试意图执行
test_execution() {
  local test_id=$1
  local user_input=$2
  local context=$3
  local expected_status=$4  # COMPLETED, NEED_MORE_INFO, NEED_APPROVAL, FAILED

  ((TOTAL_TESTS++))

  local response
  response=$(execute_intent "$user_input" "$context")

  local status
  status=$(echo "$response" | jq -r '.data.status // .status // empty')

  local recognized
  recognized=$(echo "$response" | jq -r '.data.intentRecognized // .intentRecognized // false')

  if [ "$recognized" = "true" ] && [ "$status" = "$expected_status" ]; then
    local message
    message=$(echo "$response" | jq -r '.data.message // .message // empty')
    log_success "$test_id: status=$status, message=$message"
    return 0
  else
    log_fail "$test_id: 期望 status=$expected_status, 实际 status=$status (recognized=$recognized)"
    echo "  Response: $(echo "$response" | jq -c .)"
    return 1
  fi
}

# ==================== 测试用例 ====================

# A. SYSTEM 类意图测试
test_system_intents() {
  log_section "A. SYSTEM 类意图测试"

  # A-001: 识别排产全自动
  test_recognition "A-001" "把排产设置改成全自动" "SCHEDULING_SET_AUTO"

  # A-002: 识别人工确认排产
  test_recognition "A-002" "切换到人工确认排产" "SCHEDULING_SET_MANUAL"

  # A-003: 识别禁用排产
  test_recognition "A-003" "关闭自动排产" "SCHEDULING_SET_DISABLED"

  # A-004: 识别功能开关
  test_recognition "A-004" "启用AI分析功能" "FACTORY_FEATURE_TOGGLE"

  # A-005: 识别通知设置
  test_recognition "A-005" "开启邮件通知" "FACTORY_NOTIFICATION_CONFIG"

  # A-006: 执行排产设置（预期需要更多信息或成功）
  test_execution "A-006" "把排产设置改成全自动" "null" "COMPLETED"

  # A-007: 执行功能开关
  test_execution "A-007" "启用AI分析功能" '{"feature":"ai_analysis","enabled":true}' "COMPLETED"
}

# B. USER 类意图测试
test_user_intents() {
  log_section "B. USER 类意图测试"

  # B-001: 识别创建用户
  test_recognition "B-001" "创建新用户张三" "USER_CREATE"

  # B-002: 识别禁用用户
  test_recognition "B-002" "禁用用户zhangsan" "USER_DISABLE"

  # B-003: 识别角色分配
  test_recognition "B-003" "把张三设为车间主管" "USER_ROLE_ASSIGN"

  # B-004: 执行创建用户（无 context，应返回 NEED_MORE_INFO）
  test_execution "B-004" "创建新用户" "null" "NEED_MORE_INFO"

  # B-005: 执行创建用户（有 context）
  local timestamp=$(date +%s)
  test_execution "B-005" "创建新用户测试员" \
    "{\"username\":\"test_user_$timestamp\",\"fullName\":\"测试员$timestamp\",\"role\":\"operator\"}" \
    "COMPLETED"

  # B-006: 执行禁用用户（无 userId，应返回 NEED_MORE_INFO）
  test_execution "B-006" "禁用用户" "null" "NEED_MORE_INFO"
}

# C. CONFIG 类意图测试
test_config_intents() {
  log_section "C. CONFIG 类意图测试"

  # C-001: 识别设备维护
  test_recognition "C-001" "记录设备维护" "EQUIPMENT_MAINTENANCE"

  # C-002: 识别转换率配置
  test_recognition "C-002" "设置转换率85%" "CONVERSION_RATE_UPDATE"

  # C-003: 识别规则配置
  test_recognition "C-003" "配置温度告警规则" "RULE_CONFIG"

  # C-004: 执行设备维护
  test_execution "C-004" "记录设备维护" \
    '{"equipmentId":"EQ-F001-001","description":"常规保养","cost":200}' \
    "COMPLETED"

  # C-005: 执行转换率配置
  test_execution "C-005" "设置转换率" \
    '{"rawMaterialTypeId":"RMT-F001-001","productTypeId":"PT-F001-001","rate":0.75}' \
    "COMPLETED"
}

# D. META 类意图测试
test_meta_intents() {
  log_section "D. META 类意图测试"

  # D-001: 识别创建意图
  test_recognition "D-001" "我想用AI管理库存预警" "INTENT_CREATE"

  # D-002: 识别更新意图
  test_recognition "D-002" "优化用户创建的关键词" "INTENT_UPDATE"

  # D-003: 识别分析意图
  test_recognition "D-003" "查看意图使用统计" "INTENT_ANALYZE"

  # D-004: 执行创建意图（应返回 PENDING_APPROVAL 或 NEED_MORE_INFO）
  ((TOTAL_TESTS++))
  local response
  response=$(execute_intent "我想用AI管理供应商评级" "null")
  local status
  status=$(echo "$response" | jq -r '.data.status // .status // empty')

  if [ "$status" = "PENDING_APPROVAL" ] || [ "$status" = "NEED_MORE_INFO" ] || [ "$status" = "COMPLETED" ]; then
    log_success "D-004: 创建意图 status=$status (可接受)"
  else
    log_fail "D-004: 创建意图 status=$status (期望 PENDING_APPROVAL/NEED_MORE_INFO/COMPLETED)"
  fi

  # D-005: 执行分析意图
  test_execution "D-005" "查看意图使用统计" "null" "COMPLETED"
}

# E. DATA_OP 类意图测试
test_data_op_intents() {
  log_section "E. DATA_OP 类意图测试"

  # E-001: 识别产品类型修改
  test_recognition "E-001" "修改产品单价" "PRODUCT_TYPE_UPDATE"

  # E-002: 识别生产计划修改
  test_recognition "E-002" "暂停生产计划" "PRODUCTION_PLAN_UPDATE"

  # E-003: 识别批次修改
  test_recognition "E-003" "更新批次状态" "BATCH_UPDATE"

  # E-004: 执行产品类型修改（无 context，应返回 NEED_MORE_INFO）
  test_execution "E-004" "修改产品单价" "null" "NEED_MORE_INFO"
}

# F. FORM 类意图测试
test_form_intents() {
  log_section "F. FORM 类意图测试"

  # F-001: 识别表单生成
  test_recognition "F-001" "给原材料表单添加温度字段" "FORM_GENERATE"

  # F-002: 执行表单生成
  test_execution "F-002" "给原材料表单添加运输温度字段" \
    '{"entityType":"MATERIAL_BATCH","existingFields":["materialType","quantity","batchNumber"]}' \
    "COMPLETED"
}

# G. 权限测试
test_permissions() {
  log_section "G. 权限测试"

  # G-001: 测试敏感操作（CRITICAL 级别）
  ((TOTAL_TESTS++))
  local response
  response=$(execute_intent "删除所有用户数据" "null")
  local recognized
  recognized=$(echo "$response" | jq -r '.data.intentRecognized // .intentRecognized // false')

  if [ "$recognized" = "false" ]; then
    log_success "G-001: 危险操作被正确拒绝"
  else
    log_fail "G-001: 危险操作未被拒绝"
    echo "  Response: $(echo "$response" | jq -c .)"
  fi
}

# H. 边界测试
test_edge_cases() {
  log_section "H. 边界测试"

  # H-001: 空输入
  ((TOTAL_TESTS++))
  local response
  response=$(execute_intent "" "null")
  local recognized
  recognized=$(echo "$response" | jq -r '.data.intentRecognized // .intentRecognized // false')

  if [ "$recognized" = "false" ]; then
    log_success "H-001: 空输入正确处理"
  else
    log_fail "H-001: 空输入未正确处理"
  fi

  # H-002: 无意义输入
  ((TOTAL_TESTS++))
  response=$(execute_intent "asdfghjkl" "null")
  recognized=$(echo "$response" | jq -r '.data.intentRecognized // .intentRecognized // false')

  if [ "$recognized" = "false" ]; then
    log_success "H-002: 无意义输入正确处理"
  else
    log_fail "H-002: 无意义输入被错误识别"
  fi

  # H-003: 超长输入
  ((TOTAL_TESTS++))
  local long_input=$(printf '创建用户%.0s' {1..100})
  response=$(recognize_intent "$long_input")
  local intent_code
  intent_code=$(echo "$response" | jq -r '.data.intentCode // .intentCode // empty')

  if [ "$intent_code" = "USER_CREATE" ]; then
    log_success "H-003: 超长输入正确识别为 USER_CREATE"
  else
    log_fail "H-003: 超长输入处理异常"
  fi
}

# ==================== 主程序 ====================

main() {
  echo ""
  echo "=============================================="
  echo "   AI 全面管理能力综合测试"
  echo "   Cretas Food Traceability System"
  echo "=============================================="
  echo ""
  echo "配置:"
  echo "  BASE_URL:   $BASE_URL"
  echo "  FACTORY_ID: $FACTORY_ID"
  echo "  USERNAME:   $USERNAME"
  echo ""

  # 检查 jq 是否安装
  if ! command -v jq &> /dev/null; then
    echo "错误: 需要安装 jq"
    echo "  macOS: brew install jq"
    echo "  Ubuntu: apt-get install jq"
    exit 1
  fi

  # 获取 Token
  log_info "获取认证 Token..."
  TOKEN=$(get_token)
  log_info "Token: ${TOKEN:0:50}..."
  echo ""

  # 执行测试
  test_system_intents
  test_user_intents
  test_config_intents
  test_meta_intents
  test_data_op_intents
  test_form_intents
  test_permissions
  test_edge_cases

  # 输出统计
  log_section "测试结果统计"
  echo ""
  echo "总测试数: $TOTAL_TESTS"
  echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
  echo -e "${RED}失败: $FAILED_TESTS${NC}"
  echo -e "${YELLOW}跳过: $SKIPPED_TESTS${NC}"
  echo ""

  local pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
  echo "通过率: $pass_rate%"
  echo ""

  # 验收标准
  log_section "验收标准检查"
  echo ""
  echo "[ ] 所有 14 个管理类意图可正确识别"
  echo "[ ] 每个 Handler 正确处理其 Category 的意图"
  echo "[ ] 敏感操作（CRITICAL）需要审批确认"
  echo "[ ] 权限检查正确执行"
  echo "[ ] 缺少必要参数返回 NEED_MORE_INFO"
  echo "[ ] 无权限操作返回 FORBIDDEN"
  echo "[ ] 所有操作记录到 intent_match_records"
  echo ""

  if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}所有测试通过!${NC}"
    exit 0
  else
    echo -e "${RED}有 $FAILED_TESTS 个测试失败${NC}"
    exit 1
  fi
}

# 支持单独运行某类测试
case "${1:-all}" in
  system)
    TOKEN=$(get_token)
    test_system_intents
    ;;
  user)
    TOKEN=$(get_token)
    test_user_intents
    ;;
  config)
    TOKEN=$(get_token)
    test_config_intents
    ;;
  meta)
    TOKEN=$(get_token)
    test_meta_intents
    ;;
  data_op)
    TOKEN=$(get_token)
    test_data_op_intents
    ;;
  form)
    TOKEN=$(get_token)
    test_form_intents
    ;;
  all|*)
    main
    ;;
esac
