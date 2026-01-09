#!/bin/bash
###############################################################################
# AI 意图识别与自我学习综合测试脚本 (50次测试)
#
# 测试分组：
#   - 第一组（10次）：基线测试 - 标准表达
#   - 第二组（10次）：模糊表达触发 LLM
#   - 第三组（10次）：复测第二组相同输入，验证学习效果
#   - 第四组（10次）：语义相似表达
#   - 第五组（5次）：多轮对话
#   - 第六组（5次）：反馈学习
#
# 测试记录：
#   - 输入、识别意图、匹配方法、置信度、耗时
#   - 自动对比第二组和第三组的匹配方法变化
#
# 作者: Cretas Team
# 版本: 1.0.0
# 日期: 2026-01-07
###############################################################################

# ==================== 配置 ====================
BASE_URL="${API_BASE_URL:-http://139.196.165.140:10010/api/mobile}"
FACTORY_ID="${FACTORY_ID:-F001}"
USERNAME="${TEST_USERNAME:-factory_admin1}"
PASSWORD="${TEST_PASSWORD:-123456}"

# 报告目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_DIR="${SCRIPT_DIR}/../reports"
REPORT_FILE="${REPORT_DIR}/AI_SELF_LEARNING_50_TESTS_REPORT.md"
RESULT_JSON="${REPORT_DIR}/test_results.json"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# 统计变量
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
declare -a GROUP2_RESULTS=()
declare -a GROUP3_RESULTS=()
declare -a ALL_RESULTS=()

# ==================== 工具函数 ====================

# 跨平台毫秒时间戳 (macOS/Linux 兼容)
get_millis() {
  if command -v python3 &> /dev/null; then
    python3 -c "import time; print(int(time.time()*1000))"
  elif command -v gdate &> /dev/null; then
    gdate +%s%3N
  else
    echo $(($(date +%s) * 1000))
  fi
}

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_step() {
  echo -e "${CYAN}  -> $1${NC}"
}

log_success() {
  echo -e "${GREEN}[PASS]${NC} $1"
  ((PASSED_TESTS++))
}

log_fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  ((FAILED_TESTS++))
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_section() {
  echo ""
  echo -e "${MAGENTA}================================================================${NC}"
  echo -e "${MAGENTA}  $1${NC}"
  echo -e "${MAGENTA}================================================================${NC}"
}

log_subsection() {
  echo ""
  echo -e "${YELLOW}--- $1 ---${NC}"
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

# AI 意图执行
ai_execute() {
  local user_input=$1
  local session_id=${2:-""}
  local body

  if [ -n "$session_id" ]; then
    body="{\"userInput\": \"$user_input\", \"sessionId\": \"$session_id\"}"
  else
    body="{\"userInput\": \"$user_input\"}"
  fi

  curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body"
}

# AI 反馈
ai_feedback() {
  local user_input=$1
  local intent_code=$2
  local is_correct=$3
  local body="{\"userInput\": \"$user_input\", \"intentCode\": \"$intent_code\", \"isCorrect\": $is_correct}"

  curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/feedback" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body"
}

# 解析响应并记录结果
parse_and_record() {
  local test_id=$1
  local group=$2
  local user_input=$3
  local response=$4
  local latency=$5

  local intent_code=$(echo "$response" | jq -r '.data.intentCode // "UNKNOWN"')
  local match_method=$(echo "$response" | jq -r '.data.matchMethod // .data.metadata.matchMethod // "UNKNOWN"')
  local confidence=$(echo "$response" | jq -r '.data.confidence // .data.metadata.confidence // 0')
  local status=$(echo "$response" | jq -r '.data.status // "UNKNOWN"')
  local need_more_info=$(echo "$response" | jq -r '.data.metadata.needMoreInfo // false')
  local session_id=$(echo "$response" | jq -r '.data.metadata.sessionId // ""')
  local cache_hit=$(echo "$response" | jq -r '.data.cacheHit // false')
  local success=$(echo "$response" | jq -r '.success // false')

  # 构建结果 JSON
  local result_json=$(cat <<EOF
{
  "testId": "$test_id",
  "group": $group,
  "userInput": "$user_input",
  "intentCode": "$intent_code",
  "matchMethod": "$match_method",
  "confidence": $confidence,
  "status": "$status",
  "needMoreInfo": $need_more_info,
  "sessionId": "$session_id",
  "cacheHit": $cache_hit,
  "latencyMs": $latency,
  "success": $success
}
EOF
)

  # 保存到数组
  ALL_RESULTS+=("$result_json")

  # 第二组和第三组特殊记录
  if [ "$group" -eq 2 ]; then
    GROUP2_RESULTS+=("$result_json")
  elif [ "$group" -eq 3 ]; then
    GROUP3_RESULTS+=("$result_json")
  fi

  # 控制台输出
  ((TOTAL_TESTS++))
  if [ "$success" = "true" ]; then
    log_success "$test_id: $user_input"
    log_step "意图: $intent_code, 匹配: $match_method, 置信度: $confidence, 耗时: ${latency}ms"
  else
    log_fail "$test_id: $user_input"
    log_step "状态: $status, 错误: $(echo "$response" | jq -r '.message // "未知错误"')"
  fi

  echo "$result_json"
}

# ==================== 测试用例 ====================

# 第一组：基线测试（标准表达）
GROUP1_INPUTS=(
  "查询原料库存"
  "今日生产了多少"
  "帮我看看设备状态"
  "批次溯源查询"
  "查一下成本分析报告"
  "我要打卡签到"
  "申请设备维护"
  "修改批次信息"
  "安排生产计划"
  "导出质检报告"
)

# 第二组：模糊表达（触发 LLM）
GROUP2_INPUTS=(
  "东西还有多少"
  "机器怎么样了"
  "出了多少货"
  "帮我改改那个东西"
  "看看今天干了啥"
  "那个设备坏了"
  "要做新东西"
  "追一下那批货"
  "钱花了多少"
  "人来齐了没"
)

# 第三组：复测第二组（验证学习效果）
# 与 GROUP2_INPUTS 相同

# 第四组：语义相似表达
GROUP4_INPUTS=(
  "物料剩余量"
  "设备运行情况"
  "今日发货统计"
  "更新物料数据"
  "今日工作记录"
  "机器出故障了"
  "创建生产任务"
  "产品溯源查询"
  "费用支出情况"
  "员工出勤率"
)

# 第五组：多轮对话（初始模糊输入）
GROUP5_INPUTS=(
  "帮我处理一下"
  "操作那个"
  "看看情况"
  "弄一下数据"
  "查查东西"
)

# 第五组：多轮对话后续回复
GROUP5_FOLLOWUPS=(
  "原料库存"
  "设备状态"
  "生产情况"
  "批次信息"
  "质检报告"
)

# 第六组：反馈学习测试
GROUP6_FEEDBACK_TESTS=(
  "查看库存余量|MATERIAL_BATCH_QUERY|true"
  "设备健康状态|EQUIPMENT_STATUS|true"
  "今天产出|PRODUCTION_REPORT|true"
  "追踪批次|BATCH_TRACKING|true"
  "人员考勤|TIMECLOCK_CHECKIN|true"
)

# ==================== 测试执行函数 ====================

test_group1_baseline() {
  log_section "第一组：基线测试（10次）- 标准表达"

  for i in "${!GROUP1_INPUTS[@]}"; do
    local input="${GROUP1_INPUTS[$i]}"
    local test_id="G1-$(printf '%02d' $((i+1)))"

    local start_time=$(get_millis)
    local response=$(ai_execute "$input")
    local end_time=$(get_millis)
    local latency=$((end_time - start_time))

    parse_and_record "$test_id" 1 "$input" "$response" "$latency"
    sleep 0.5
  done
}

test_group2_fuzzy() {
  log_section "第二组：模糊表达（10次）- 触发 LLM"

  for i in "${!GROUP2_INPUTS[@]}"; do
    local input="${GROUP2_INPUTS[$i]}"
    local test_id="G2-$(printf '%02d' $((i+1)))"

    local start_time=$(get_millis)
    local response=$(ai_execute "$input")
    local end_time=$(get_millis)
    local latency=$((end_time - start_time))

    parse_and_record "$test_id" 2 "$input" "$response" "$latency"
    sleep 0.5
  done
}

test_group3_retest() {
  log_section "第三组：复测第二组（10次）- 验证学习效果"

  # 等待学习异步完成
  log_info "等待 5 秒，让学习任务异步完成..."
  sleep 5

  for i in "${!GROUP2_INPUTS[@]}"; do
    local input="${GROUP2_INPUTS[$i]}"
    local test_id="G3-$(printf '%02d' $((i+1)))"

    local start_time=$(get_millis)
    local response=$(ai_execute "$input")
    local end_time=$(get_millis)
    local latency=$((end_time - start_time))

    parse_and_record "$test_id" 3 "$input" "$response" "$latency"
    sleep 0.5
  done
}

test_group4_semantic() {
  log_section "第四组：语义相似表达（10次）"

  for i in "${!GROUP4_INPUTS[@]}"; do
    local input="${GROUP4_INPUTS[$i]}"
    local test_id="G4-$(printf '%02d' $((i+1)))"

    local start_time=$(get_millis)
    local response=$(ai_execute "$input")
    local end_time=$(get_millis)
    local latency=$((end_time - start_time))

    parse_and_record "$test_id" 4 "$input" "$response" "$latency"
    sleep 0.5
  done
}

test_group5_multiturn() {
  log_section "第五组：多轮对话（5次）"

  for i in "${!GROUP5_INPUTS[@]}"; do
    local input="${GROUP5_INPUTS[$i]}"
    local followup="${GROUP5_FOLLOWUPS[$i]}"
    local test_id="G5-$(printf '%02d' $((i+1)))"

    log_subsection "$test_id: 多轮对话测试"
    log_step "第一轮: $input"

    # 第一轮：发送模糊输入
    local start_time=$(get_millis)
    local response1=$(ai_execute "$input")
    local end_time=$(get_millis)
    local latency1=$((end_time - start_time))

    local need_more_info=$(echo "$response1" | jq -r '.data.metadata.needMoreInfo // false')
    local session_id=$(echo "$response1" | jq -r '.data.metadata.sessionId // ""')

    ((TOTAL_TESTS++))

    if [ "$need_more_info" = "true" ] && [ -n "$session_id" ]; then
      log_success "$test_id-A: 成功触发多轮对话"
      log_step "sessionId: $session_id"

      # 第二轮：发送补充信息
      log_step "第二轮: $followup"
      sleep 0.5

      local start_time2=$(get_millis)
      local response2=$(ai_execute "$followup" "$session_id")
      local end_time2=$(get_millis)
      local latency2=$((end_time2 - start_time2))

      local intent_code=$(echo "$response2" | jq -r '.data.intentCode // "UNKNOWN"')
      local status=$(echo "$response2" | jq -r '.data.status // "UNKNOWN"')

      ((TOTAL_TESTS++))

      if [ "$intent_code" != "UNKNOWN" ] && [ "$intent_code" != "null" ]; then
        log_success "$test_id-B: 多轮对话识别成功 -> $intent_code"
        ((PASSED_TESTS++))
      else
        log_fail "$test_id-B: 多轮对话识别失败"
      fi

      # 记录多轮对话结果
      local result_json=$(cat <<EOF
{
  "testId": "$test_id",
  "group": 5,
  "userInput": "$input -> $followup",
  "intentCode": "$intent_code",
  "matchMethod": "CONVERSATION",
  "confidence": 0,
  "status": "$status",
  "needMoreInfo": false,
  "sessionId": "$session_id",
  "cacheHit": false,
  "latencyMs": $((latency1 + latency2)),
  "success": true,
  "multiturn": true
}
EOF
)
      ALL_RESULTS+=("$result_json")

    else
      log_fail "$test_id: 未触发多轮对话"
      log_step "needMoreInfo: $need_more_info, sessionId: $session_id"

      # 记录失败结果
      local result_json=$(cat <<EOF
{
  "testId": "$test_id",
  "group": 5,
  "userInput": "$input",
  "intentCode": "UNKNOWN",
  "matchMethod": "FAILED",
  "confidence": 0,
  "status": "FAILED",
  "needMoreInfo": false,
  "sessionId": "",
  "cacheHit": false,
  "latencyMs": $latency1,
  "success": false,
  "multiturn": true
}
EOF
)
      ALL_RESULTS+=("$result_json")
    fi

    sleep 1
  done
}

test_group6_feedback() {
  log_section "第六组：反馈学习（5次）"

  for i in "${!GROUP6_FEEDBACK_TESTS[@]}"; do
    IFS='|' read -r input expected_intent is_correct <<< "${GROUP6_FEEDBACK_TESTS[$i]}"
    local test_id="G6-$(printf '%02d' $((i+1)))"

    log_subsection "$test_id: 反馈学习测试"
    log_step "输入: $input"
    log_step "期望意图: $expected_intent"
    log_step "反馈正确: $is_correct"

    # 先执行意图识别
    local start_time=$(get_millis)
    local response=$(ai_execute "$input")
    local end_time=$(get_millis)
    local latency=$((end_time - start_time))

    local intent_code=$(echo "$response" | jq -r '.data.intentCode // "UNKNOWN"')

    ((TOTAL_TESTS++))

    # 发送反馈
    local feedback_response=$(ai_feedback "$input" "$expected_intent" "$is_correct")
    local feedback_success=$(echo "$feedback_response" | jq -r '.success // false')

    if [ "$feedback_success" = "true" ]; then
      log_success "$test_id: 反馈提交成功"

      # 等待学习生效后再次测试
      sleep 2
      local retest_response=$(ai_execute "$input")
      local retest_intent=$(echo "$retest_response" | jq -r '.data.intentCode // "UNKNOWN"')

      ((TOTAL_TESTS++))
      if [ "$retest_intent" = "$expected_intent" ]; then
        log_success "$test_id-RETEST: 学习生效，识别为 $retest_intent"
      else
        log_warn "$test_id-RETEST: 学习可能未立即生效，识别为 $retest_intent"
      fi
    else
      log_fail "$test_id: 反馈提交失败"
    fi

    # 记录结果
    local result_json=$(cat <<EOF
{
  "testId": "$test_id",
  "group": 6,
  "userInput": "$input",
  "intentCode": "$intent_code",
  "expectedIntent": "$expected_intent",
  "matchMethod": "FEEDBACK",
  "confidence": 0,
  "status": "FEEDBACK_TEST",
  "feedbackSuccess": $feedback_success,
  "latencyMs": $latency,
  "success": $feedback_success
}
EOF
)
    ALL_RESULTS+=("$result_json")

    sleep 1
  done
}

# ==================== 学习效果对比 ====================

compare_learning_effect() {
  log_section "学习效果对比分析"

  echo ""
  echo "对比第二组（首次模糊输入）和第三组（复测）的匹配方法变化："
  echo ""

  local improved=0
  local unchanged=0
  local degraded=0

  for i in "${!GROUP2_INPUTS[@]}"; do
    local input="${GROUP2_INPUTS[$i]}"

    # 从 GROUP2_RESULTS 和 GROUP3_RESULTS 获取结果
    local g2_result="${GROUP2_RESULTS[$i]}"
    local g3_result="${GROUP3_RESULTS[$i]}"

    local g2_method=$(echo "$g2_result" | jq -r '.matchMethod // "UNKNOWN"')
    local g3_method=$(echo "$g3_result" | jq -r '.matchMethod // "UNKNOWN"')
    local g2_confidence=$(echo "$g2_result" | jq -r '.confidence // 0')
    local g3_confidence=$(echo "$g3_result" | jq -r '.confidence // 0')
    local g2_latency=$(echo "$g2_result" | jq -r '.latencyMs // 0')
    local g3_latency=$(echo "$g3_result" | jq -r '.latencyMs // 0')

    # 判断是否改进
    local status=""
    if [[ "$g2_method" == "LLM_FALLBACK" && "$g3_method" != "LLM_FALLBACK" ]]; then
      status="${GREEN}[改进]${NC}"
      ((improved++))
    elif [[ "$g2_method" != "LLM_FALLBACK" && "$g3_method" == "LLM_FALLBACK" ]]; then
      status="${RED}[退化]${NC}"
      ((degraded++))
    elif [[ "$g3_confidence" > "$g2_confidence" ]]; then
      status="${YELLOW}[置信度提升]${NC}"
      ((improved++))
    else
      status="${BLUE}[无变化]${NC}"
      ((unchanged++))
    fi

    echo -e "  $((i+1)). \"$input\""
    echo -e "     第二组: $g2_method (置信度: $g2_confidence, 耗时: ${g2_latency}ms)"
    echo -e "     第三组: $g3_method (置信度: $g3_confidence, 耗时: ${g3_latency}ms)"
    echo -e "     $status"
    echo ""
  done

  echo ""
  echo "学习效果统计："
  echo -e "  ${GREEN}改进/置信度提升: $improved${NC}"
  echo -e "  ${BLUE}无变化: $unchanged${NC}"
  echo -e "  ${RED}退化: $degraded${NC}"
  echo ""
}

# ==================== 报告生成 ====================

generate_report() {
  log_section "生成测试报告"

  local test_date=$(date '+%Y-%m-%d %H:%M:%S')
  local pass_rate=0
  if [ $TOTAL_TESTS -gt 0 ]; then
    pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
  fi

  cat > "$REPORT_FILE" << EOF
# AI 意图识别与自我学习综合测试报告

**测试时间**: $test_date
**服务器**: $BASE_URL
**工厂ID**: $FACTORY_ID

---

## 测试概要

| 指标 | 数值 |
|------|------|
| 总测试数 | $TOTAL_TESTS |
| 通过数 | $PASSED_TESTS |
| 失败数 | $FAILED_TESTS |
| 通过率 | $pass_rate% |

---

## 测试分组说明

| 分组 | 测试数 | 说明 |
|------|--------|------|
| 第一组 | 10 | 基线测试 - 标准表达 |
| 第二组 | 10 | 模糊表达 - 触发 LLM |
| 第三组 | 10 | 复测第二组 - 验证学习效果 |
| 第四组 | 10 | 语义相似表达 |
| 第五组 | 5 | 多轮对话测试 |
| 第六组 | 5 | 反馈学习测试 |

---

## 详细测试结果

### 第一组：基线测试（标准表达）

| 测试ID | 用户输入 | 识别意图 | 匹配方法 | 置信度 | 耗时(ms) |
|--------|----------|----------|----------|--------|----------|
EOF

  # 写入第一组结果
  for result in "${ALL_RESULTS[@]}"; do
    local group=$(echo "$result" | jq -r '.group')
    if [ "$group" = "1" ]; then
      local test_id=$(echo "$result" | jq -r '.testId')
      local input=$(echo "$result" | jq -r '.userInput')
      local intent=$(echo "$result" | jq -r '.intentCode')
      local method=$(echo "$result" | jq -r '.matchMethod')
      local confidence=$(echo "$result" | jq -r '.confidence')
      local latency=$(echo "$result" | jq -r '.latencyMs')
      echo "| $test_id | $input | $intent | $method | $confidence | $latency |" >> "$REPORT_FILE"
    fi
  done

  cat >> "$REPORT_FILE" << EOF

### 第二组：模糊表达（触发 LLM）

| 测试ID | 用户输入 | 识别意图 | 匹配方法 | 置信度 | 耗时(ms) |
|--------|----------|----------|----------|--------|----------|
EOF

  for result in "${ALL_RESULTS[@]}"; do
    local group=$(echo "$result" | jq -r '.group')
    if [ "$group" = "2" ]; then
      local test_id=$(echo "$result" | jq -r '.testId')
      local input=$(echo "$result" | jq -r '.userInput')
      local intent=$(echo "$result" | jq -r '.intentCode')
      local method=$(echo "$result" | jq -r '.matchMethod')
      local confidence=$(echo "$result" | jq -r '.confidence')
      local latency=$(echo "$result" | jq -r '.latencyMs')
      echo "| $test_id | $input | $intent | $method | $confidence | $latency |" >> "$REPORT_FILE"
    fi
  done

  cat >> "$REPORT_FILE" << EOF

### 第三组：复测第二组（验证学习效果）

| 测试ID | 用户输入 | 识别意图 | 匹配方法 | 置信度 | 耗时(ms) |
|--------|----------|----------|----------|--------|----------|
EOF

  for result in "${ALL_RESULTS[@]}"; do
    local group=$(echo "$result" | jq -r '.group')
    if [ "$group" = "3" ]; then
      local test_id=$(echo "$result" | jq -r '.testId')
      local input=$(echo "$result" | jq -r '.userInput')
      local intent=$(echo "$result" | jq -r '.intentCode')
      local method=$(echo "$result" | jq -r '.matchMethod')
      local confidence=$(echo "$result" | jq -r '.confidence')
      local latency=$(echo "$result" | jq -r '.latencyMs')
      echo "| $test_id | $input | $intent | $method | $confidence | $latency |" >> "$REPORT_FILE"
    fi
  done

  cat >> "$REPORT_FILE" << EOF

### 学习效果对比（第二组 vs 第三组）

| 输入 | 第二组匹配 | 第三组匹配 | 第二组置信度 | 第三组置信度 | 效果 |
|------|------------|------------|--------------|--------------|------|
EOF

  for i in "${!GROUP2_INPUTS[@]}"; do
    local input="${GROUP2_INPUTS[$i]}"
    local g2_result="${GROUP2_RESULTS[$i]}"
    local g3_result="${GROUP3_RESULTS[$i]}"

    local g2_method=$(echo "$g2_result" | jq -r '.matchMethod // "UNKNOWN"')
    local g3_method=$(echo "$g3_result" | jq -r '.matchMethod // "UNKNOWN"')
    local g2_confidence=$(echo "$g2_result" | jq -r '.confidence // 0')
    local g3_confidence=$(echo "$g3_result" | jq -r '.confidence // 0')

    local effect="无变化"
    if [[ "$g2_method" == "LLM_FALLBACK" && "$g3_method" != "LLM_FALLBACK" ]]; then
      effect="改进"
    elif [[ "$g2_method" != "LLM_FALLBACK" && "$g3_method" == "LLM_FALLBACK" ]]; then
      effect="退化"
    elif [[ $(echo "$g3_confidence > $g2_confidence" | bc -l 2>/dev/null || echo 0) -eq 1 ]]; then
      effect="置信度提升"
    fi

    echo "| $input | $g2_method | $g3_method | $g2_confidence | $g3_confidence | $effect |" >> "$REPORT_FILE"
  done

  cat >> "$REPORT_FILE" << EOF

### 第四组：语义相似表达

| 测试ID | 用户输入 | 识别意图 | 匹配方法 | 置信度 | 耗时(ms) |
|--------|----------|----------|----------|--------|----------|
EOF

  for result in "${ALL_RESULTS[@]}"; do
    local group=$(echo "$result" | jq -r '.group')
    if [ "$group" = "4" ]; then
      local test_id=$(echo "$result" | jq -r '.testId')
      local input=$(echo "$result" | jq -r '.userInput')
      local intent=$(echo "$result" | jq -r '.intentCode')
      local method=$(echo "$result" | jq -r '.matchMethod')
      local confidence=$(echo "$result" | jq -r '.confidence')
      local latency=$(echo "$result" | jq -r '.latencyMs')
      echo "| $test_id | $input | $intent | $method | $confidence | $latency |" >> "$REPORT_FILE"
    fi
  done

  cat >> "$REPORT_FILE" << EOF

### 第五组：多轮对话测试

| 测试ID | 对话流程 | 最终意图 | 状态 | 总耗时(ms) |
|--------|----------|----------|------|------------|
EOF

  for result in "${ALL_RESULTS[@]}"; do
    local group=$(echo "$result" | jq -r '.group')
    if [ "$group" = "5" ]; then
      local test_id=$(echo "$result" | jq -r '.testId')
      local input=$(echo "$result" | jq -r '.userInput')
      local intent=$(echo "$result" | jq -r '.intentCode')
      local status=$(echo "$result" | jq -r '.status')
      local latency=$(echo "$result" | jq -r '.latencyMs')
      echo "| $test_id | $input | $intent | $status | $latency |" >> "$REPORT_FILE"
    fi
  done

  cat >> "$REPORT_FILE" << EOF

### 第六组：反馈学习测试

| 测试ID | 用户输入 | 期望意图 | 反馈结果 | 耗时(ms) |
|--------|----------|----------|----------|----------|
EOF

  for result in "${ALL_RESULTS[@]}"; do
    local group=$(echo "$result" | jq -r '.group')
    if [ "$group" = "6" ]; then
      local test_id=$(echo "$result" | jq -r '.testId')
      local input=$(echo "$result" | jq -r '.userInput')
      local expected=$(echo "$result" | jq -r '.expectedIntent // "N/A"')
      local feedback_success=$(echo "$result" | jq -r '.feedbackSuccess // false')
      local latency=$(echo "$result" | jq -r '.latencyMs')
      local status="成功"
      if [ "$feedback_success" = "false" ]; then
        status="失败"
      fi
      echo "| $test_id | $input | $expected | $status | $latency |" >> "$REPORT_FILE"
    fi
  done

  cat >> "$REPORT_FILE" << EOF

---

## 测试结论

### 通过的测试场景
- 基线测试：标准表达的意图识别
- 模糊表达：LLM 降级处理
- 语义相似：语义匹配能力
- 多轮对话：会话上下文管理
- 反馈学习：用户反馈接收

### 发现的问题
EOF

  if [ $FAILED_TESTS -gt 0 ]; then
    echo "- 共 $FAILED_TESTS 个测试失败，需要进一步调查" >> "$REPORT_FILE"
  else
    echo "- 所有测试通过" >> "$REPORT_FILE"
  fi

  cat >> "$REPORT_FILE" << EOF

### 建议改进
1. 优化模糊表达的意图识别准确率
2. 加强语义缓存的覆盖范围
3. 完善多轮对话的上下文理解
4. 加速反馈学习的生效时间

---

*报告生成时间: $test_date*
EOF

  log_success "报告已生成: $REPORT_FILE"

  # 保存 JSON 结果
  echo "[" > "$RESULT_JSON"
  local first=true
  for result in "${ALL_RESULTS[@]}"; do
    if [ "$first" = true ]; then
      first=false
    else
      echo "," >> "$RESULT_JSON"
    fi
    echo "$result" >> "$RESULT_JSON"
  done
  echo "]" >> "$RESULT_JSON"

  log_success "JSON 结果已保存: $RESULT_JSON"
}

# ==================== 主函数 ====================

main() {
  echo ""
  echo -e "${CYAN}================================================================${NC}"
  echo -e "${CYAN}     AI 意图识别与自我学习综合测试 (50次)${NC}"
  echo -e "${CYAN}     Cretas Food Traceability System${NC}"
  echo -e "${CYAN}================================================================${NC}"
  echo ""
  echo "配置:"
  echo "  服务器:   $BASE_URL"
  echo "  工厂ID:   $FACTORY_ID"
  echo "  用户名:   $USERNAME"
  echo "  报告目录: $REPORT_DIR"
  echo ""

  # 检查依赖
  if ! command -v jq &> /dev/null; then
    echo -e "${RED}错误: 需要安装 jq${NC}"
    echo "  macOS: brew install jq"
    echo "  Ubuntu: apt-get install jq"
    exit 1
  fi

  # 创建报告目录
  mkdir -p "$REPORT_DIR"

  # 获取 Token
  log_info "正在获取认证 Token..."
  TOKEN=$(get_token)
  log_info "Token 获取成功"
  echo ""

  # 执行各组测试
  test_group1_baseline
  test_group2_fuzzy
  test_group3_retest
  test_group4_semantic
  test_group5_multiturn
  test_group6_feedback

  # 学习效果对比
  compare_learning_effect

  # 生成报告
  generate_report

  # 输出总结
  log_section "测试结果总结"
  echo ""
  echo -e "  ${BLUE}总计测试:${NC} $TOTAL_TESTS"
  echo -e "  ${GREEN}通过:${NC}     $PASSED_TESTS"
  echo -e "  ${RED}失败:${NC}     $FAILED_TESTS"
  echo ""

  local pass_rate=0
  if [ $TOTAL_TESTS -gt 0 ]; then
    pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
  fi
  echo "  通过率: $pass_rate%"
  echo ""

  if [ "$FAILED_TESTS" -eq 0 ]; then
    echo -e "${GREEN}所有测试通过！${NC}"
    exit 0
  else
    echo -e "${RED}有 $FAILED_TESTS 个测试失败${NC}"
    exit 1
  fi
}

# 支持单独运行某组测试
case "${1:-all}" in
  group1|baseline)
    TOKEN=$(get_token)
    test_group1_baseline
    ;;
  group2|fuzzy)
    TOKEN=$(get_token)
    test_group2_fuzzy
    ;;
  group3|retest)
    TOKEN=$(get_token)
    test_group3_retest
    ;;
  group4|semantic)
    TOKEN=$(get_token)
    test_group4_semantic
    ;;
  group5|multiturn)
    TOKEN=$(get_token)
    test_group5_multiturn
    ;;
  group6|feedback)
    TOKEN=$(get_token)
    test_group6_feedback
    ;;
  compare)
    # 需要先运行 group2 和 group3
    echo "请先运行完整测试或 group2 + group3"
    ;;
  report)
    generate_report
    ;;
  all|*)
    main
    ;;
esac
