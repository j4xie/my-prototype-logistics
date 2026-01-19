#!/bin/bash
#
# ArenaRL 效果测试脚本
# 测试意图识别和工具选择中 ArenaRL 锦标赛裁决的效果
#
# 测试场景:
# 1. 高歧义场景 - top1-top2 差距小，应触发 ArenaRL
# 2. 低歧义场景 - top1 置信度高，不应触发 ArenaRL
# 3. 边界场景 - 刚好在阈值附近
#

set -e

# 配置
BASE_URL="http://139.196.165.140:10010"
FACTORY_ID="F001"
REPORT_FILE="arena_rl_test_report_$(date +%Y%m%d_%H%M%S).md"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  ArenaRL 效果测试${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. 获取 Token
echo -e "${YELLOW}[Step 1] 获取认证 Token...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username": "factory_admin1", "password": "123456"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}获取 Token 失败${NC}"
  exit 1
fi

echo -e "${GREEN}Token 获取成功${NC}"
echo ""

# 初始化报告
cat > "$REPORT_FILE" << 'EOF'
# ArenaRL 效果测试报告

## 测试时间
EOF
echo "$(date '+%Y-%m-%d %H:%M:%S')" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 测试用例定义
# 格式: "测试名称|用户输入|预期类型(HIGH_AMBIGUITY/LOW_AMBIGUITY/BOUNDARY)"
declare -a TEST_CASES=(
  # 高歧义场景 - 这些查询在多个意图之间有歧义
  "查询批次-高歧义|查询批次|HIGH_AMBIGUITY"
  "查询物料-高歧义|查看物料信息|HIGH_AMBIGUITY"
  "查询生产数据-高歧义|生产数据|HIGH_AMBIGUITY"
  "查询统计-高歧义|统计数据|HIGH_AMBIGUITY"
  "查询库存-高歧义|库存情况|HIGH_AMBIGUITY"

  # 低歧义场景 - 这些查询有明确的意图
  "查询原材料批次-明确|查询原材料批次MB001的详细信息|LOW_AMBIGUITY"
  "创建生产批次-明确|创建一个新的生产批次|LOW_AMBIGUITY"
  "设备告警查询-明确|查看设备告警列表|LOW_AMBIGUITY"
  "质检结果查询-明确|查询今天的质检结果|LOW_AMBIGUITY"
  "考勤记录查询-明确|查看我的考勤记录|LOW_AMBIGUITY"

  # 边界场景 - 可能触发或不触发 ArenaRL
  "查询数据-边界|数据查询|BOUNDARY"
  "查看列表-边界|列表|BOUNDARY"
  "管理操作-边界|管理|BOUNDARY"
)

# 测试结果统计
TOTAL_TESTS=0
HIGH_AMBIGUITY_TRIGGERED=0
HIGH_AMBIGUITY_TOTAL=0
LOW_AMBIGUITY_TRIGGERED=0
LOW_AMBIGUITY_TOTAL=0
BOUNDARY_TRIGGERED=0
BOUNDARY_TOTAL=0

# 详细结果数组
declare -a RESULTS

echo "## 测试用例结果" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "| # | 测试名称 | 用户输入 | 预期类型 | 置信度 | Top1-Top2差距 | ArenaRL触发 | 结果 |" >> "$REPORT_FILE"
echo "|---|----------|----------|----------|--------|---------------|-------------|------|" >> "$REPORT_FILE"

# 执行测试
echo -e "${YELLOW}[Step 2] 执行测试用例...${NC}"
echo ""

test_index=0
for test_case in "${TEST_CASES[@]}"; do
  test_index=$((test_index + 1))

  # 解析测试用例
  IFS='|' read -r test_name user_input expected_type <<< "$test_case"

  echo -e "${BLUE}[$test_index/${#TEST_CASES[@]}] 测试: $test_name${NC}"
  echo "  输入: $user_input"

  # 调用意图识别 API
  RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/ai-intents/execute" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"userInput\": \"$user_input\", \"previewOnly\": true}")

  # 解析响应
  success=$(echo "$RESPONSE" | jq -r '.success // false')
  confidence=$(echo "$RESPONSE" | jq -r '.data.confidence // 0')
  intent_code=$(echo "$RESPONSE" | jq -r '.data.intentCode // "N/A"')
  match_method=$(echo "$RESPONSE" | jq -r '.data.matchMethod // "N/A"')

  # 检查是否有 ArenaRL 相关信息（通过日志或响应字段）
  arena_triggered="否"

  # 尝试获取 top candidates 信息（如果 API 返回）
  top1_conf="N/A"
  top2_conf="N/A"
  gap="N/A"

  # 如果有 topCandidates 字段
  top_candidates=$(echo "$RESPONSE" | jq -r '.data.topCandidates // empty')
  if [ ! -z "$top_candidates" ] && [ "$top_candidates" != "null" ]; then
    top1_conf=$(echo "$RESPONSE" | jq -r '.data.topCandidates[0].confidence // 0')
    top2_conf=$(echo "$RESPONSE" | jq -r '.data.topCandidates[1].confidence // 0')
    if [ "$top1_conf" != "null" ] && [ "$top2_conf" != "null" ]; then
      gap=$(echo "scale=3; $top1_conf - $top2_conf" | bc 2>/dev/null || echo "N/A")
    fi
  fi

  # 检查是否触发 ArenaRL (通过置信度变化或特定字段)
  # ArenaRL 触发条件: top1-top2 < 0.15 且 top1 < 0.85
  if [ "$gap" != "N/A" ] && [ "$top1_conf" != "N/A" ]; then
    gap_check=$(echo "$gap < 0.15" | bc 2>/dev/null || echo "0")
    conf_check=$(echo "$top1_conf < 0.85" | bc 2>/dev/null || echo "0")
    if [ "$gap_check" == "1" ] && [ "$conf_check" == "1" ]; then
      arena_triggered="是"
    fi
  fi

  # 统计
  TOTAL_TESTS=$((TOTAL_TESTS + 1))

  case "$expected_type" in
    "HIGH_AMBIGUITY")
      HIGH_AMBIGUITY_TOTAL=$((HIGH_AMBIGUITY_TOTAL + 1))
      if [ "$arena_triggered" == "是" ]; then
        HIGH_AMBIGUITY_TRIGGERED=$((HIGH_AMBIGUITY_TRIGGERED + 1))
      fi
      ;;
    "LOW_AMBIGUITY")
      LOW_AMBIGUITY_TOTAL=$((LOW_AMBIGUITY_TOTAL + 1))
      if [ "$arena_triggered" == "是" ]; then
        LOW_AMBIGUITY_TRIGGERED=$((LOW_AMBIGUITY_TRIGGERED + 1))
      fi
      ;;
    "BOUNDARY")
      BOUNDARY_TOTAL=$((BOUNDARY_TOTAL + 1))
      if [ "$arena_triggered" == "是" ]; then
        BOUNDARY_TRIGGERED=$((BOUNDARY_TRIGGERED + 1))
      fi
      ;;
  esac

  # 判断结果
  result_status="✅"
  case "$expected_type" in
    "HIGH_AMBIGUITY")
      if [ "$arena_triggered" == "是" ]; then
        result_status="✅ 符合预期"
      else
        result_status="⚠️ 未触发"
      fi
      ;;
    "LOW_AMBIGUITY")
      if [ "$arena_triggered" == "否" ]; then
        result_status="✅ 符合预期"
      else
        result_status="⚠️ 不应触发"
      fi
      ;;
    "BOUNDARY")
      result_status="📊 边界"
      ;;
  esac

  # 输出结果
  echo "  意图: $intent_code (置信度: $confidence, 方法: $match_method)"
  echo "  Top1-Top2 差距: $gap"
  echo "  ArenaRL: $arena_triggered"
  echo ""

  # 写入报告
  echo "| $test_index | $test_name | $user_input | $expected_type | $confidence | $gap | $arena_triggered | $result_status |" >> "$REPORT_FILE"

  # 延迟避免请求过快
  sleep 0.5
done

echo "" >> "$REPORT_FILE"

# 统计汇总
echo "## 测试统计汇总" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "| 场景类型 | 总数 | ArenaRL触发数 | 触发率 |" >> "$REPORT_FILE"
echo "|----------|------|---------------|--------|" >> "$REPORT_FILE"

high_rate="0%"
if [ $HIGH_AMBIGUITY_TOTAL -gt 0 ]; then
  high_rate=$(echo "scale=1; $HIGH_AMBIGUITY_TRIGGERED * 100 / $HIGH_AMBIGUITY_TOTAL" | bc)"%"
fi
echo "| 高歧义场景 | $HIGH_AMBIGUITY_TOTAL | $HIGH_AMBIGUITY_TRIGGERED | $high_rate |" >> "$REPORT_FILE"

low_rate="0%"
if [ $LOW_AMBIGUITY_TOTAL -gt 0 ]; then
  low_rate=$(echo "scale=1; $LOW_AMBIGUITY_TRIGGERED * 100 / $LOW_AMBIGUITY_TOTAL" | bc)"%"
fi
echo "| 低歧义场景 | $LOW_AMBIGUITY_TOTAL | $LOW_AMBIGUITY_TRIGGERED | $low_rate |" >> "$REPORT_FILE"

boundary_rate="0%"
if [ $BOUNDARY_TOTAL -gt 0 ]; then
  boundary_rate=$(echo "scale=1; $BOUNDARY_TRIGGERED * 100 / $BOUNDARY_TOTAL" | bc)"%"
fi
echo "| 边界场景 | $BOUNDARY_TOTAL | $BOUNDARY_TRIGGERED | $boundary_rate |" >> "$REPORT_FILE"

echo "" >> "$REPORT_FILE"

# 结论
echo "## 测试结论" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "### ArenaRL 触发情况分析" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "1. **高歧义场景**: 预期应触发 ArenaRL，实际触发率 $high_rate" >> "$REPORT_FILE"
echo "2. **低歧义场景**: 预期不应触发 ArenaRL，实际触发率 $low_rate" >> "$REPORT_FILE"
echo "3. **边界场景**: 触发率 $boundary_rate" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 打印汇总
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  测试完成 - 汇总${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "总测试数: ${GREEN}$TOTAL_TESTS${NC}"
echo ""
echo -e "高歧义场景: $HIGH_AMBIGUITY_TRIGGERED/$HIGH_AMBIGUITY_TOTAL 触发 ArenaRL ($high_rate)"
echo -e "低歧义场景: $LOW_AMBIGUITY_TRIGGERED/$LOW_AMBIGUITY_TOTAL 触发 ArenaRL ($low_rate)"
echo -e "边界场景: $BOUNDARY_TRIGGERED/$BOUNDARY_TOTAL 触发 ArenaRL ($boundary_rate)"
echo ""
echo -e "详细报告已保存到: ${GREEN}$REPORT_FILE${NC}"
