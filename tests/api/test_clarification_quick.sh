#!/bin/bash
# 快速澄清对话测试 - 100个测试用例，每个只测首轮是否触发澄清
# 用于验证 clarification 机制是否正常工作

set -e

API_BASE="http://139.196.165.140:10010/api/mobile"
FACTORY_ID="F001"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TOTAL=0
CLARIFIED=0  # 触发澄清
DIRECT=0      # 直接识别
FAILED=0

echo -e "${BLUE}[登录中...]${NC}"
TOKEN=$(curl -s -X POST "$API_BASE/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('accessToken',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}登录失败${NC}"
  exit 1
fi
echo -e "${GREEN}登录成功${NC}"
echo ""

test_single() {
  local id="$1"
  local input="$2"
  local category="$3"

  TOTAL=$((TOTAL + 1))

  local response=$(curl -s "$API_BASE/$FACTORY_ID/ai-intents/execute" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"userInput\": \"$input\"}" --max-time 30 2>/dev/null)

  local status=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',{}); print(d.get('status',''))" 2>/dev/null)
  local intent=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',{}); print(d.get('intentCode','') or '')" 2>/dev/null)
  local has_suggestions=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',{}); print('YES' if d.get('suggestedActions') else 'NO')" 2>/dev/null)

  if [ "$status" = "NEED_CLARIFICATION" ] || [ "$status" = "NEED_MORE_INFO" ]; then
    CLARIFIED=$((CLARIFIED + 1))
    echo -e "[$id] ${GREEN}✓${NC} 触发澄清 | $input"
  elif [ "$status" = "SUCCESS" ] || [ "$status" = "COMPLETED" ] || [ "$status" = "EXECUTED" ]; then
    if [ -n "$intent" ] && [ "$intent" != "None" ]; then
      DIRECT=$((DIRECT + 1))
      echo -e "[$id] ${BLUE}➜${NC} 直接识别 ($intent) | $input"
    else
      CLARIFIED=$((CLARIFIED + 1))
      echo -e "[$id] ${YELLOW}~${NC} LLM对话 | $input"
    fi
  else
    FAILED=$((FAILED + 1))
    echo -e "[$id] ${RED}✗${NC} 状态:$status | $input"
  fi
}

echo "=============================================="
echo "       快速澄清测试 (100用例)"
echo "=============================================="
echo ""

# 模糊指代类 (20)
echo -e "${YELLOW}=== 模糊指代类 ===${NC}"
test_single "001" "看一下那个" "模糊指代"
test_single "002" "帮我处理下这个" "模糊指代"
test_single "003" "这个怎么搞" "模糊指代"
test_single "004" "那边的情况怎样" "模糊指代"
test_single "005" "搞定那个吧" "模糊指代"
test_single "006" "这玩意儿咋样了" "模糊指代"
test_single "007" "弄一下这个" "模糊指代"
test_single "008" "那个需要处理" "模糊指代"
test_single "009" "看看那边" "模糊指代"
test_single "010" "把这个给我" "模糊指代"
test_single "011" "这个东西哪来的" "模糊指代"
test_single "012" "那个咋回事" "模糊指代"
test_single "013" "看下这边的数据" "模糊指代"
test_single "014" "处理下那个问题" "模糊指代"
test_single "015" "那玩意在哪" "模糊指代"
test_single "016" "这个要怎么办" "模糊指代"
test_single "017" "弄下那个东西" "模糊指代"
test_single "018" "看看这些" "模糊指代"
test_single "019" "那个数据呢" "模糊指代"
test_single "020" "这边的进展" "模糊指代"

# 省略主语类 (20)
echo ""
echo -e "${YELLOW}=== 省略主语类 ===${NC}"
test_single "021" "查一下" "省略主语"
test_single "022" "看看有多少" "省略主语"
test_single "023" "今天的" "省略主语"
test_single "024" "最近的" "省略主语"
test_single "025" "统计下" "省略主语"
test_single "026" "导出来" "省略主语"
test_single "027" "删掉吧" "省略主语"
test_single "028" "加一个" "省略主语"
test_single "029" "改一下" "省略主语"
test_single "030" "找找" "省略主语"
test_single "031" "有问题吗" "省略主语"
test_single "032" "完成了吗" "省略主语"
test_single "033" "还有吗" "省略主语"
test_single "034" "多少钱" "省略主语"
test_single "035" "到了没" "省略主语"
test_single "036" "好了吗" "省略主语"
test_single "037" "发了吗" "省略主语"
test_single "038" "够用吗" "省略主语"
test_single "039" "正常吗" "省略主语"
test_single "040" "有没有" "省略主语"

# 模糊动词类 (20)
echo ""
echo -e "${YELLOW}=== 模糊动词类 ===${NC}"
test_single "041" "设备搞一下" "模糊动词"
test_single "042" "原料弄下" "模糊动词"
test_single "043" "生产那边处理下" "模糊动词"
test_single "044" "告警整一下" "模糊动词"
test_single "045" "排程安排下" "模糊动词"
test_single "046" "质检搞定" "模糊动词"
test_single "047" "库存捋一捋" "模糊动词"
test_single "048" "人员看看" "模糊动词"
test_single "049" "报表出一下" "模糊动词"
test_single "050" "客户联系下" "模糊动词"
test_single "051" "订单跟一下" "模糊动词"
test_single "052" "包装收拾下" "模糊动词"
test_single "053" "出货准备下" "模糊动词"
test_single "054" "审批过一下" "模糊动词"
test_single "055" "供应商对接下" "模糊动词"
test_single "056" "效率提一提" "模糊动词"
test_single "057" "成本控一控" "模糊动词"
test_single "058" "任务分一分" "模糊动词"
test_single "059" "数据汇一汇" "模糊动词"
test_single "060" "问题理一理" "模糊动词"

# 口语方言类 (20)
echo ""
echo -e "${YELLOW}=== 口语方言类 ===${NC}"
test_single "061" "整个明白" "口语方言"
test_single "062" "瞅瞅咋样了" "口语方言"
test_single "063" "咋整的" "口语方言"
test_single "064" "得劲不" "口语方言"
test_single "065" "中不中" "口语方言"
test_single "066" "搁这呢" "口语方言"
test_single "067" "老铁给看看" "口语方言"
test_single "068" "给力不给力" "口语方言"
test_single "069" "靠谱吗" "口语方言"
test_single "070" "妥了没" "口语方言"
test_single "071" "啥情况" "口语方言"
test_single "072" "咋说" "口语方言"
test_single "073" "得嘞" "口语方言"
test_single "074" "走着" "口语方言"
test_single "075" "上" "口语方言"
test_single "076" "完事儿" "口语方言"
test_single "077" "稳不稳" "口语方言"
test_single "078" "麻溜的" "口语方言"
test_single "079" "撤了" "口语方言"
test_single "080" "走一个" "口语方言"

# 单词歧义类 (20)
echo ""
echo -e "${YELLOW}=== 单词歧义类 ===${NC}"
test_single "081" "检查" "单词歧义"
test_single "082" "统计" "单词歧义"
test_single "083" "报告" "单词歧义"
test_single "084" "记录" "单词歧义"
test_single "085" "状态" "单词歧义"
test_single "086" "列表" "单词歧义"
test_single "087" "详情" "单词歧义"
test_single "088" "历史" "单词歧义"
test_single "089" "分析" "单词歧义"
test_single "090" "预警" "单词歧义"
test_single "091" "进度" "单词歧义"
test_single "092" "计划" "单词歧义"
test_single "093" "对比" "单词歧义"
test_single "094" "趋势" "单词歧义"
test_single "095" "汇总" "单词歧义"
test_single "096" "明细" "单词歧义"
test_single "097" "异常" "单词歧义"
test_single "098" "任务" "单词歧义"
test_single "099" "审核" "单词歧义"
test_single "100" "导入" "单词歧义"

echo ""
echo "=============================================="
echo "                 测试汇总"
echo "=============================================="
echo ""
echo -e "总测试数: ${TOTAL}"
echo -e "触发澄清/LLM对话: ${GREEN}${CLARIFIED}${NC}"
echo -e "直接识别: ${BLUE}${DIRECT}${NC}"
echo -e "失败: ${RED}${FAILED}${NC}"
echo ""

CLARIFY_RATE=$(echo "scale=1; $CLARIFIED * 100 / $TOTAL" | bc)
echo -e "澄清触发率: ${YELLOW}${CLARIFY_RATE}%${NC}"

SUCCESS_RATE=$(echo "scale=1; ($CLARIFIED + $DIRECT) * 100 / $TOTAL" | bc)
echo -e "成功率: ${GREEN}${SUCCESS_RATE}%${NC}"

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}测试完成！${NC}"
else
  echo -e "${RED}存在失败的测试${NC}"
fi
