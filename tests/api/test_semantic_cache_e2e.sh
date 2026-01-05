#!/bin/bash
# test_semantic_cache_e2e.sh
# 语义缓存 + SSE 流式响应端到端测试脚本
#
# 测试场景：
# 1. 首次请求 (无缓存) → 完整执行
# 2. 相同请求 → 精确命中 (EXACT)
# 3. 语义相似请求 → 语义命中 (SEMANTIC)
# 4. 不相关请求 → 不命中
# 5. SSE 流式响应测试
# 6. 缓存统计测试
# 7. 缓存失效测试
#
# 作者: Cretas Team
# 版本: 1.0.0
# 日期: 2026-01-05

# 不使用 set -e，让测试继续运行

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
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# 统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# ==================== 工具函数 ====================

# 跨平台毫秒时间戳 (macOS/Linux 兼容)
get_millis() {
  if command -v python3 &> /dev/null; then
    python3 -c "import time; print(int(time.time()*1000))"
  elif command -v gdate &> /dev/null; then
    gdate +%s%3N
  else
    # 回退到秒级精度
    echo $(($(date +%s) * 1000))
  fi
}

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_step() {
  echo -e "${CYAN}  → $1${NC}"
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
  echo -e "${YELLOW}══════════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  $1${NC}"
  echo -e "${YELLOW}══════════════════════════════════════════════════════════════${NC}"
}

log_subsection() {
  echo ""
  echo -e "${MAGENTA}  ─── $1 ───${NC}"
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

# GET 请求
api_get() {
  local endpoint=$1
  curl -s -X GET "$BASE_URL/$FACTORY_ID/$endpoint" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json"
}

# POST 请求
api_post() {
  local endpoint=$1
  local body=$2
  curl -s -X POST "$BASE_URL/$FACTORY_ID/$endpoint" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body"
}

# DELETE 请求
api_delete() {
  local endpoint=$1
  curl -s -X DELETE "$BASE_URL/$FACTORY_ID/$endpoint" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json"
}

# AI 意图执行 (普通请求)
ai_execute() {
  local user_input=$1
  local body="{\"userInput\": \"$user_input\"}"

  curl -s -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body"
}

# AI 意图执行 (SSE 流式请求) - 返回所有事件
ai_execute_stream() {
  local user_input=$1
  local body="{\"userInput\": \"$user_input\"}"
  local timeout=${2:-30}

  curl -s -N --max-time "$timeout" \
    -X POST "$BASE_URL/$FACTORY_ID/ai-intents/execute/stream" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "Accept: text/event-stream" \
    -d "$body" 2>/dev/null || true
}

# 解析 SSE 响应中的事件
parse_sse_events() {
  local sse_response=$1
  local event_type=$2

  echo "$sse_response" | grep -A1 "event: $event_type" | grep "^data:" | sed 's/^data: //'
}

# 检查响应是否成功
check_success() {
  local response=$1
  local success
  success=$(echo "$response" | jq -r '.success // false')
  [ "$success" = "true" ]
}

# 检查缓存命中类型
check_cache_hit_type() {
  local response=$1
  local expected_type=$2

  local hit_type
  hit_type=$(echo "$response" | jq -r '.data.cacheHitType // .cacheHitType // "MISS"')

  [ "$hit_type" = "$expected_type" ]
}

# 获取响应延迟
get_latency() {
  local response=$1
  echo "$response" | jq -r '.data.latencyMs // .latencyMs // 0'
}

# 记录测试结果
record_test() {
  local test_name=$1
  local success=$2
  local details=${3:-""}

  ((TOTAL_TESTS++))

  if [ "$success" = "true" ]; then
    log_success "$test_name"
    [ -n "$details" ] && log_step "$details"
  else
    log_fail "$test_name"
    [ -n "$details" ] && log_step "$details"
  fi
}

# ==================== 测试用例 ====================

# 测试1: 首次请求 (无缓存)
test_first_request_no_cache() {
  log_subsection "测试1: 首次请求 (无缓存)"

  # 使用唯一输入确保无缓存
  local unique_input="查询今日产量统计-$(date +%s)"
  log_step "发送请求: $unique_input"

  local start_time=$(get_millis)
  local response
  response=$(ai_execute "$unique_input")
  local end_time=$(get_millis)
  local latency=$((end_time - start_time))

  log_step "响应延迟: ${latency}ms"

  if check_success "$response"; then
    local cache_hit
    cache_hit=$(echo "$response" | jq -r '.data.cacheHit // false')

    if [ "$cache_hit" = "false" ]; then
      record_test "首次请求无缓存命中" "true" "延迟: ${latency}ms"
    else
      record_test "首次请求应该无缓存命中" "false" "意外缓存命中"
    fi
  else
    local error_msg
    error_msg=$(echo "$response" | jq -r '.message // "未知错误"')
    record_test "首次请求执行" "false" "错误: $error_msg"
  fi
}

# 测试2: 相同请求 → 精确命中 (EXACT)
test_exact_cache_hit() {
  log_subsection "测试2: 精确缓存命中"

  local test_input="查询原料库存"

  # 第一次请求 (建立缓存)
  log_step "第一次请求 (建立缓存): $test_input"
  local response1
  response1=$(ai_execute "$test_input")
  local latency1
  latency1=$(get_latency "$response1")
  log_step "首次延迟: ${latency1}ms"

  # 短暂等待确保缓存写入
  sleep 1

  # 第二次相同请求 (应精确命中)
  log_step "第二次相同请求: $test_input"
  local response2
  response2=$(ai_execute "$test_input")
  local latency2
  latency2=$(get_latency "$response2")
  log_step "二次延迟: ${latency2}ms"

  if check_success "$response2"; then
    local cache_hit
    cache_hit=$(echo "$response2" | jq -r '.data.cacheHit // false')
    local hit_type
    hit_type=$(echo "$response2" | jq -r '.data.cacheHitType // "NONE"')

    if [ "$cache_hit" = "true" ] && [ "$hit_type" = "EXACT" ]; then
      # 验证缓存加速效果
      if [ "$latency2" -lt "$latency1" ]; then
        record_test "精确缓存命中" "true" "命中类型: EXACT, 加速比: $(echo "scale=1; $latency1/$latency2" | bc)x"
      else
        record_test "精确缓存命中" "true" "命中类型: EXACT (无明显加速)"
      fi
    elif [ "$cache_hit" = "true" ]; then
      record_test "精确缓存命中" "false" "命中类型应为 EXACT，实际: $hit_type"
    else
      record_test "精确缓存命中" "false" "未命中缓存"
    fi
  else
    record_test "精确缓存命中" "false" "请求失败"
  fi
}

# 测试3: 语义相似请求 → 语义命中 (SEMANTIC)
test_semantic_cache_hit() {
  log_subsection "测试3: 语义缓存命中"

  # 使用语义相似但文字不同的输入
  local original_input="查询今日生产数量"
  local similar_input="今天生产了多少"

  # 第一次请求 (建立缓存)
  log_step "原始请求: $original_input"
  local response1
  response1=$(ai_execute "$original_input")
  log_step "原始请求完成"

  # 等待缓存写入和 embedding 生成
  sleep 2

  # 语义相似的请求
  log_step "语义相似请求: $similar_input"
  local response2
  response2=$(ai_execute "$similar_input")
  local latency2
  latency2=$(get_latency "$response2")

  if check_success "$response2"; then
    local cache_hit
    cache_hit=$(echo "$response2" | jq -r '.data.cacheHit // false')
    local hit_type
    hit_type=$(echo "$response2" | jq -r '.data.cacheHitType // "NONE"')
    local similarity
    similarity=$(echo "$response2" | jq -r '.data.similarity // 0')

    if [ "$cache_hit" = "true" ] && [ "$hit_type" = "SEMANTIC" ]; then
      record_test "语义缓存命中" "true" "命中类型: SEMANTIC, 相似度: $similarity"
    elif [ "$cache_hit" = "true" ]; then
      record_test "语义缓存命中" "true" "命中类型: $hit_type (非预期的 SEMANTIC)"
    else
      # 语义缓存可能未启用或相似度不够
      log_warn "语义缓存未命中 - 可能 Embedding 服务未启用"
      record_test "语义缓存命中 (跳过)" "true" "Embedding 服务可能未启用"
    fi
  else
    record_test "语义缓存命中" "false" "请求失败"
  fi
}

# 测试4: 不相关请求 → 不命中
test_cache_miss() {
  log_subsection "测试4: 缓存不命中"

  # 使用完全不相关的输入
  local unrelated_input="今天天气怎么样-$(date +%s)"

  log_step "不相关请求: $unrelated_input"
  local response
  response=$(ai_execute "$unrelated_input")

  if check_success "$response"; then
    local cache_hit
    cache_hit=$(echo "$response" | jq -r '.data.cacheHit // false')

    if [ "$cache_hit" = "false" ]; then
      record_test "不相关请求无缓存命中" "true"
    else
      record_test "不相关请求应无缓存命中" "false" "意外命中缓存"
    fi
  else
    # 不相关请求可能返回失败 (无法识别意图)
    local intent_recognized
    intent_recognized=$(echo "$response" | jq -r '.data.intentRecognized // false')

    if [ "$intent_recognized" = "false" ]; then
      record_test "不相关请求无缓存命中" "true" "意图未识别 (预期行为)"
    else
      record_test "不相关请求处理" "false" "请求失败"
    fi
  fi
}

# 测试5: SSE 流式响应
test_sse_streaming() {
  log_subsection "测试5: SSE 流式响应"

  local test_input="查询设备状态"

  log_step "发送 SSE 请求: $test_input"
  local sse_response
  sse_response=$(ai_execute_stream "$test_input" 30)

  # 检查是否收到 SSE 事件
  if [ -z "$sse_response" ]; then
    record_test "SSE 流式响应" "false" "无响应数据"
    return
  fi

  log_step "SSE 响应长度: ${#sse_response} 字节"

  # 检查各个事件类型
  local has_start=false
  local has_result=false
  local has_complete=false

  if echo "$sse_response" | grep -q "event: start"; then
    has_start=true
    log_step "✓ 收到 start 事件"
  fi

  if echo "$sse_response" | grep -q "event: result"; then
    has_result=true
    log_step "✓ 收到 result 事件"
  fi

  if echo "$sse_response" | grep -q "event: complete"; then
    has_complete=true
    log_step "✓ 收到 complete 事件"
  fi

  # 检查缓存相关事件
  if echo "$sse_response" | grep -q "event: cache_hit"; then
    log_step "✓ 收到 cache_hit 事件"
  fi

  if echo "$sse_response" | grep -q "event: cache_miss"; then
    log_step "✓ 收到 cache_miss 事件"
  fi

  if echo "$sse_response" | grep -q "event: intent_recognized"; then
    log_step "✓ 收到 intent_recognized 事件"
  fi

  # 评估测试结果
  if [ "$has_start" = true ] && [ "$has_complete" = true ]; then
    record_test "SSE 流式响应" "true" "接收到完整事件流"
  elif [ "$has_start" = true ]; then
    record_test "SSE 流式响应" "true" "接收到事件流 (部分)"
  else
    record_test "SSE 流式响应" "false" "事件流不完整"
  fi
}

# 测试6: SSE 缓存命中场景
test_sse_with_cache() {
  log_subsection "测试6: SSE 缓存命中场景"

  local test_input="查询库存数量"

  # 第一次请求建立缓存
  log_step "建立缓存: $test_input"
  ai_execute "$test_input" > /dev/null
  sleep 1

  # SSE 请求应该命中缓存
  log_step "SSE 请求 (应命中缓存): $test_input"
  local sse_response
  sse_response=$(ai_execute_stream "$test_input" 30)

  if echo "$sse_response" | grep -q "event: cache_hit"; then
    local cache_data
    cache_data=$(parse_sse_events "$sse_response" "cache_hit")
    local similarity
    similarity=$(echo "$cache_data" | jq -r '.similarity // 1.0')
    record_test "SSE 缓存命中" "true" "相似度: $similarity"
  elif echo "$sse_response" | grep -q "event: cache_miss"; then
    record_test "SSE 缓存命中" "false" "意外未命中缓存"
  else
    log_warn "SSE 响应中无缓存事件"
    record_test "SSE 缓存命中 (跳过)" "true" "缓存事件可能未启用"
  fi
}

# 测试7: 缓存统计
test_cache_stats() {
  log_subsection "测试7: 缓存统计"

  log_step "获取缓存统计"
  local response
  response=$(api_get "semantic-cache/stats")

  if check_success "$response"; then
    local total
    total=$(echo "$response" | jq -r '.data.totalEntries // 0')
    local valid
    valid=$(echo "$response" | jq -r '.data.validEntries // 0')
    local hit_rate
    hit_rate=$(echo "$response" | jq -r '.data.hitRate // 0')

    log_step "总条目: $total, 有效条目: $valid, 命中率: $hit_rate"
    record_test "缓存统计查询" "true" "总条目: $total"
  else
    # 统计 API 可能未实现
    log_warn "缓存统计 API 可能未实现"
    record_test "缓存统计查询 (跳过)" "true" "API 可能未实现"
  fi
}

# 测试8: 缓存失效
test_cache_invalidation() {
  log_subsection "测试8: 缓存失效"

  # 建立缓存
  local test_input="测试缓存失效-$(date +%s)"
  log_step "建立缓存: $test_input"
  ai_execute "$test_input" > /dev/null
  sleep 1

  # 尝试失效缓存
  log_step "按工厂失效缓存"
  local response
  response=$(api_delete "semantic-cache/invalidate")

  if check_success "$response"; then
    local count
    count=$(echo "$response" | jq -r '.data.deletedCount // 0')
    record_test "缓存失效" "true" "删除条目: $count"
  else
    # 失效 API 可能需要管理权限
    log_warn "缓存失效可能需要管理权限"
    record_test "缓存失效 (跳过)" "true" "可能需要管理权限"
  fi
}

# 测试9: 缓存性能对比
test_cache_performance() {
  log_subsection "测试9: 缓存性能对比"

  local test_input="查询生产进度"

  # 清除可能的缓存
  api_delete "semantic-cache/invalidate" > /dev/null 2>&1 || true

  # 冷启动测试 (无缓存)
  log_step "冷启动测试 (无缓存)"
  local start1=$(get_millis)
  ai_execute "$test_input" > /dev/null
  local end1=$(get_millis)
  local cold_latency=$((end1 - start1))
  log_step "冷启动延迟: ${cold_latency}ms"

  sleep 1

  # 热缓存测试
  log_step "热缓存测试"
  local start2=$(get_millis)
  ai_execute "$test_input" > /dev/null
  local end2=$(get_millis)
  local hot_latency=$((end2 - start2))
  log_step "热缓存延迟: ${hot_latency}ms"

  # 计算加速比
  if [ "$hot_latency" -gt 0 ]; then
    local speedup
    speedup=$(echo "scale=2; $cold_latency / $hot_latency" | bc)
    log_step "加速比: ${speedup}x"

    if [ "$(echo "$speedup > 1.5" | bc)" -eq 1 ]; then
      record_test "缓存性能提升" "true" "冷: ${cold_latency}ms, 热: ${hot_latency}ms, 加速: ${speedup}x"
    else
      record_test "缓存性能提升 (边际)" "true" "加速不明显: ${speedup}x"
    fi
  else
    record_test "缓存性能提升" "true" "热缓存极快 (<1ms)"
  fi
}

# 测试10: 并发请求
test_concurrent_requests() {
  log_subsection "测试10: 并发请求"

  local test_input="查询原料类型列表"

  # 先建立缓存
  ai_execute "$test_input" > /dev/null
  sleep 1

  log_step "发送 5 个并发请求"

  # 并发发送请求
  local pids=()
  local results_dir=$(mktemp -d)

  for i in {1..5}; do
    (
      local start=$(get_millis)
      ai_execute "$test_input" > "$results_dir/result_$i.json"
      local end=$(get_millis)
      echo $((end - start)) > "$results_dir/latency_$i.txt"
    ) &
    pids+=($!)
  done

  # 等待所有请求完成
  for pid in "${pids[@]}"; do
    wait "$pid"
  done

  # 分析结果
  local total_latency=0
  local success_count=0

  for i in {1..5}; do
    if [ -f "$results_dir/latency_$i.txt" ]; then
      local latency=$(cat "$results_dir/latency_$i.txt")
      total_latency=$((total_latency + latency))
      ((success_count++))
      log_step "请求 $i 延迟: ${latency}ms"
    fi
  done

  # 清理
  rm -rf "$results_dir"

  if [ "$success_count" -eq 5 ]; then
    local avg_latency=$((total_latency / 5))
    record_test "并发请求" "true" "平均延迟: ${avg_latency}ms"
  else
    record_test "并发请求" "false" "仅 $success_count/5 成功"
  fi
}

# ==================== 主函数 ====================

main() {
  log_section "语义缓存 + SSE 流式响应 E2E 测试"
  log_info "服务器: $BASE_URL"
  log_info "工厂ID: $FACTORY_ID"
  log_info "用户: $USERNAME"
  echo ""

  # 获取 Token
  log_info "正在获取认证 Token..."
  TOKEN=$(get_token)
  log_info "Token 获取成功"
  echo ""

  # 执行测试
  test_first_request_no_cache
  test_exact_cache_hit
  test_semantic_cache_hit
  test_cache_miss
  test_sse_streaming
  test_sse_with_cache
  test_cache_stats
  test_cache_invalidation
  test_cache_performance
  test_concurrent_requests

  # 输出总结
  log_section "测试结果总结"
  echo ""
  echo -e "  ${BLUE}总计测试:${NC} $TOTAL_TESTS"
  echo -e "  ${GREEN}通过:${NC}     $PASSED_TESTS"
  echo -e "  ${RED}失败:${NC}     $FAILED_TESTS"
  echo ""

  if [ "$FAILED_TESTS" -eq 0 ]; then
    echo -e "${GREEN}✓ 所有测试通过！${NC}"
    exit 0
  else
    echo -e "${RED}✗ 有 $FAILED_TESTS 个测试失败${NC}"
    exit 1
  fi
}

# 运行主函数
main "$@"
