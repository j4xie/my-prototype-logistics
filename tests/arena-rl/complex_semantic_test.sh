#!/bin/bash
#
# ArenaRL 复杂语义场景测试 - 100个用例
# 覆盖: 口语化表达、复合句、时间表达、否定句、歧义句、上下文依赖等
#

BASE_URL="http://139.196.165.140:10010"
FACTORY_ID="F001"
REPORT_FILE="complex_semantic_report_$(date +%Y%m%d_%H%M%S).md"

# 获取 Token
TOKEN=$(curl -s -X POST "${BASE_URL}/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username": "factory_admin1", "password": "123456"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "获取 Token 失败"
  exit 1
fi

echo "Token 获取成功"

# 复杂测试用例 (格式: "查询|期望意图|难度|类别")
# 难度: easy/medium/hard/extreme
# 类别: colloquial/compound/time/negation/ambiguous/context/typo/multi-intent
declare -a TEST_CASES=(
  # ========== 1. 口语化表达 (Colloquial) ==========
  "帮我看看原料还有多少|MATERIAL_BATCH_QUERY|medium|colloquial"
  "那个批次咋样了|PROCESSING_BATCH_LIST|hard|colloquial"
  "东西发出去没有|SHIPMENT_QUERY|hard|colloquial"
  "库存够不够啊|MATERIAL_LOW_STOCK_ALERT|medium|colloquial"
  "机器还转着吗|EQUIPMENT_LIST|hard|colloquial"
  "今天干了多少活|PROCESSING_BATCH_LIST|medium|colloquial"
  "谁还没打卡|ATTENDANCE_ANOMALY|medium|colloquial"
  "质量过关吗|QUALITY_CHECK_QUERY|medium|colloquial"
  "客户那边催没催|SHIPMENT_QUERY|hard|colloquial"
  "原料快没了吧|MATERIAL_LOW_STOCK_ALERT|medium|colloquial"

  # ========== 2. 复合句/长句 (Compound) ==========
  "我想查一下今天入库的原料批次信息|MATERIAL_BATCH_QUERY|medium|compound"
  "把这周所有的生产批次状态给我列出来|PROCESSING_BATCH_LIST|medium|compound"
  "帮我看看客户张三最近一个月的发货记录|SHIPMENT_BY_CUSTOMER|hard|compound"
  "系统里面有没有快要过期的原材料需要处理|MATERIAL_EXPIRING_ALERT|medium|compound"
  "统计一下本月质检不合格的批次有多少|QUALITY_STATS|hard|compound"
  "找出所有设备告警并且还没有处理的|ALERT_ACTIVE|medium|compound"
  "查询供应商评分在4分以上的有哪些|SUPPLIER_RANKING|hard|compound"
  "给我一份完整的批次溯源报告包括原料信息|TRACE_FULL|medium|compound"
  "看看今天考勤有没有异常需要处理的|ATTENDANCE_ANOMALY|medium|compound"
  "把库存量低于安全线的原料都找出来|MATERIAL_LOW_STOCK_ALERT|medium|compound"

  # ========== 3. 时间表达 (Time) ==========
  "昨天的生产情况|PROCESSING_BATCH_LIST|easy|time"
  "上周入库的原料|MATERIAL_BATCH_QUERY|medium|time"
  "这个月的出货统计|SHIPMENT_STATS|easy|time"
  "最近三天的告警|ALERT_LIST|medium|time"
  "今早的打卡记录|ATTENDANCE_TODAY|easy|time"
  "下周要过期的原料|MATERIAL_EXPIRING_ALERT|medium|time"
  "去年同期的质检数据|QUALITY_STATS|hard|time"
  "刚才启动的批次|PROCESSING_BATCH_LIST|medium|time"
  "月底前要完成的生产|PROCESSING_BATCH_LIST|hard|time"
  "季度末的库存盘点|MATERIAL_BATCH_QUERY|hard|time"

  # ========== 4. 否定/条件句 (Negation) ==========
  "还没发货的订单|SHIPMENT_QUERY|medium|negation"
  "未处理的告警|ALERT_ACTIVE|easy|negation"
  "没有通过质检的批次|QUALITY_CHECK_QUERY|medium|negation"
  "不在线的设备|EQUIPMENT_LIST|medium|negation"
  "缺勤的员工|ATTENDANCE_ANOMALY|medium|negation"
  "库存不足的原料|MATERIAL_LOW_STOCK_ALERT|easy|negation"
  "没有溯源信息的批次|TRACE_BATCH|hard|negation"
  "评分不达标的供应商|SUPPLIER_RANKING|hard|negation"
  "还没入库的原料|MATERIAL_BATCH_QUERY|medium|negation"
  "尚未完成的生产任务|PROCESSING_BATCH_LIST|medium|negation"

  # ========== 5. 歧义查询 (Ambiguous) ==========
  "批次|PROCESSING_BATCH_LIST|hard|ambiguous"
  "状态|PROCESSING_BATCH_LIST|extreme|ambiguous"
  "详情|MATERIAL_BATCH_QUERY|extreme|ambiguous"
  "记录|SHIPMENT_QUERY|hard|ambiguous"
  "数据|REPORT_DASHBOARD_OVERVIEW|extreme|ambiguous"
  "信息|MATERIAL_BATCH_QUERY|extreme|ambiguous"
  "报表|REPORT_DASHBOARD_OVERVIEW|hard|ambiguous"
  "进度|PROCESSING_BATCH_LIST|hard|ambiguous"
  "情况|PROCESSING_BATCH_LIST|extreme|ambiguous"
  "问题|ALERT_ACTIVE|extreme|ambiguous"

  # ========== 6. 动作歧义 (Action Ambiguity) ==========
  "处理原料|MATERIAL_BATCH_CONSUME|hard|ambiguous"
  "处理告警|ALERT_ACKNOWLEDGE|medium|ambiguous"
  "更新批次|PROCESSING_BATCH_LIST|hard|ambiguous"
  "修改发货|SHIPMENT_STATUS_UPDATE|medium|ambiguous"
  "操作设备|EQUIPMENT_START|hard|ambiguous"
  "提交质检|QUALITY_CHECK_EXECUTE|medium|ambiguous"
  "确认收货|SHIPMENT_STATUS_UPDATE|hard|ambiguous"
  "完成任务|PROCESSING_BATCH_COMPLETE|medium|ambiguous"
  "开始工作|CLOCK_IN|hard|ambiguous"
  "结束流程|PROCESSING_BATCH_COMPLETE|hard|ambiguous"

  # ========== 7. 领域交叉 (Cross-Domain) ==========
  "原料的质检报告|QUALITY_CHECK_QUERY|hard|cross-domain"
  "生产用的原料|MATERIAL_BATCH_QUERY|medium|cross-domain"
  "发货的批次追溯|TRACE_BATCH|hard|cross-domain"
  "设备的告警历史|ALERT_BY_EQUIPMENT|medium|cross-domain"
  "客户的历史订单|CUSTOMER_PURCHASE_HISTORY|medium|cross-domain"
  "供应商的原料批次|MATERIAL_BATCH_QUERY|hard|cross-domain"
  "生产线的质量统计|QUALITY_STATS|hard|cross-domain"
  "车间的考勤情况|ATTENDANCE_DEPARTMENT|medium|cross-domain"
  "仓库的库存告警|MATERIAL_LOW_STOCK_ALERT|medium|cross-domain"
  "订单的溯源码|TRACE_BATCH|hard|cross-domain"

  # ========== 8. 数量/程度表达 (Quantitative) ==========
  "库存最多的原料|MATERIAL_BATCH_QUERY|medium|quantitative"
  "告警最频繁的设备|ALERT_BY_EQUIPMENT|hard|quantitative"
  "生产效率最高的批次|PROCESSING_BATCH_LIST|hard|quantitative"
  "评分最高的供应商|SUPPLIER_RANKING|medium|quantitative"
  "出勤率最低的员工|ATTENDANCE_STATS|hard|quantitative"
  "质检合格率最差的|QUALITY_STATS|hard|quantitative"
  "发货量最大的客户|CUSTOMER_STATS|hard|quantitative"
  "使用频率最高的设备|EQUIPMENT_STATS|hard|quantitative"
  "消耗最快的原料|MATERIAL_BATCH_QUERY|hard|quantitative"
  "等待时间最长的订单|SHIPMENT_QUERY|hard|quantitative"

  # ========== 9. 疑问句式 (Question) ==========
  "原料还剩多少|MATERIAL_BATCH_QUERY|easy|question"
  "今天生产了几批|PROCESSING_BATCH_LIST|medium|question"
  "哪些订单还没发|SHIPMENT_QUERY|medium|question"
  "谁的考勤有问题|ATTENDANCE_ANOMALY|medium|question"
  "设备为什么报警|ALERT_DIAGNOSE|medium|question"
  "质检为什么不合格|QUALITY_CHECK_QUERY|hard|question"
  "库存什么时候能到|MATERIAL_BATCH_QUERY|hard|question"
  "这批货发给谁|SHIPMENT_QUERY|medium|question"
  "哪个供应商最靠谱|SUPPLIER_RANKING|medium|question"
  "生产进度怎么样了|PROCESSING_BATCH_LIST|easy|question"

  # ========== 10. 祈使句/指令 (Imperative) ==========
  "把原料入库|MATERIAL_BATCH_CREATE|easy|imperative"
  "开始生产这批|PROCESSING_BATCH_START|easy|imperative"
  "发货给客户A|SHIPMENT_CREATE|medium|imperative"
  "停掉那台设备|EQUIPMENT_STOP|medium|imperative"
  "确认这个告警|ALERT_ACKNOWLEDGE|easy|imperative"
  "给我打印溯源码|TRACE_BATCH|medium|imperative"
  "登记今天的考勤|CLOCK_IN|medium|imperative"
  "做一下质检|QUALITY_CHECK_EXECUTE|easy|imperative"
  "释放预留的原料|MATERIAL_BATCH_RELEASE|medium|imperative"
  "暂停当前生产|PROCESSING_BATCH_PAUSE|easy|imperative"
)

# 统计变量
TOTAL=0
PASSED=0
FAILED=0
TOTAL_LATENCY=0
declare -A CATEGORY_PASSED
declare -A CATEGORY_TOTAL
declare -A DIFFICULTY_PASSED
declare -A DIFFICULTY_TOTAL

# 执行测试
echo ""
echo "开始测试 ${#TEST_CASES[@]} 条复杂语义用例..."
echo ""

# 初始化报告
cat > "$REPORT_FILE" << EOF
# ArenaRL 复杂语义测试报告

## 测试时间
$(date '+%Y-%m-%d %H:%M:%S')

## 测试结果

| # | 查询 | 期望 | 实际 | 匹配 | 延迟 | 难度 | 类别 |
|---|------|------|------|------|------|------|------|
EOF

for i in "${!TEST_CASES[@]}"; do
  IFS='|' read -r QUERY EXPECTED DIFFICULTY CATEGORY <<< "${TEST_CASES[$i]}"

  ((TOTAL++))
  ((CATEGORY_TOTAL[$CATEGORY]++))
  ((DIFFICULTY_TOTAL[$DIFFICULTY]++))

  # 计时
  START_TIME=$(python3 -c 'import time; print(int(time.time() * 1000))')

  # 发送请求
  RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/ai-intents/execute" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "{\"userInput\": \"${QUERY}\", \"sessionId\": \"complex-test-${i}\"}" 2>/dev/null)

  END_TIME=$(python3 -c 'import time; print(int(time.time() * 1000))')
  LATENCY=$((END_TIME - START_TIME))
  TOTAL_LATENCY=$((TOTAL_LATENCY + LATENCY))

  # 解析结果
  ACTUAL=$(echo "$RESPONSE" | grep -o '"intentCode":"[^"]*' | head -1 | cut -d'"' -f4)

  if [ -z "$ACTUAL" ]; then
    ACTUAL="NO_MATCH"
  fi

  # 判断是否通过
  if [ "$ACTUAL" == "$EXPECTED" ]; then
    STATUS="✅"
    ((PASSED++))
    ((CATEGORY_PASSED[$CATEGORY]++))
    ((DIFFICULTY_PASSED[$DIFFICULTY]++))
  else
    STATUS="❌"
    ((FAILED++))
  fi

  # 输出进度
  echo "[${TOTAL}/${#TEST_CASES[@]}] ${QUERY}... ${STATUS} ${LATENCY}ms"

  # 写入报告
  echo "| ${TOTAL} | ${QUERY} | ${EXPECTED} | ${ACTUAL} | ${STATUS} | ${LATENCY}ms | ${DIFFICULTY} | ${CATEGORY} |" >> "$REPORT_FILE"
done

# 计算统计
AVG_LATENCY=$((TOTAL_LATENCY / TOTAL))
PASS_RATE=$(echo "scale=1; $PASSED * 100 / $TOTAL" | bc)

# 写入汇总
cat >> "$REPORT_FILE" << EOF

## 汇总统计

| 指标 | 值 |
|------|-----|
| 总测试数 | ${TOTAL} |
| 通过数 | ${PASSED} |
| 失败数 | ${FAILED} |
| 通过率 | ${PASS_RATE}% |
| 平均延迟 | ${AVG_LATENCY}ms |

## 按难度统计

| 难度 | 通过/总数 | 通过率 |
|------|----------|--------|
| easy | ${DIFFICULTY_PASSED[easy]:-0}/${DIFFICULTY_TOTAL[easy]:-0} | $(echo "scale=1; ${DIFFICULTY_PASSED[easy]:-0} * 100 / ${DIFFICULTY_TOTAL[easy]:-1}" | bc)% |
| medium | ${DIFFICULTY_PASSED[medium]:-0}/${DIFFICULTY_TOTAL[medium]:-0} | $(echo "scale=1; ${DIFFICULTY_PASSED[medium]:-0} * 100 / ${DIFFICULTY_TOTAL[medium]:-1}" | bc)% |
| hard | ${DIFFICULTY_PASSED[hard]:-0}/${DIFFICULTY_TOTAL[hard]:-0} | $(echo "scale=1; ${DIFFICULTY_PASSED[hard]:-0} * 100 / ${DIFFICULTY_TOTAL[hard]:-1}" | bc)% |
| extreme | ${DIFFICULTY_PASSED[extreme]:-0}/${DIFFICULTY_TOTAL[extreme]:-0} | $(echo "scale=1; ${DIFFICULTY_PASSED[extreme]:-0} * 100 / ${DIFFICULTY_TOTAL[extreme]:-1}" | bc)% |

## 按类别统计

| 类别 | 通过/总数 | 通过率 |
|------|----------|--------|
| colloquial | ${CATEGORY_PASSED[colloquial]:-0}/${CATEGORY_TOTAL[colloquial]:-0} | $(echo "scale=1; ${CATEGORY_PASSED[colloquial]:-0} * 100 / ${CATEGORY_TOTAL[colloquial]:-1}" | bc)% |
| compound | ${CATEGORY_PASSED[compound]:-0}/${CATEGORY_TOTAL[compound]:-0} | $(echo "scale=1; ${CATEGORY_PASSED[compound]:-0} * 100 / ${CATEGORY_TOTAL[compound]:-1}" | bc)% |
| time | ${CATEGORY_PASSED[time]:-0}/${CATEGORY_TOTAL[time]:-0} | $(echo "scale=1; ${CATEGORY_PASSED[time]:-0} * 100 / ${CATEGORY_TOTAL[time]:-1}" | bc)% |
| negation | ${CATEGORY_PASSED[negation]:-0}/${CATEGORY_TOTAL[negation]:-0} | $(echo "scale=1; ${CATEGORY_PASSED[negation]:-0} * 100 / ${CATEGORY_TOTAL[negation]:-1}" | bc)% |
| ambiguous | ${CATEGORY_PASSED[ambiguous]:-0}/${CATEGORY_TOTAL[ambiguous]:-0} | $(echo "scale=1; ${CATEGORY_PASSED[ambiguous]:-0} * 100 / ${CATEGORY_TOTAL[ambiguous]:-1}" | bc)% |
| cross-domain | ${CATEGORY_PASSED[cross-domain]:-0}/${CATEGORY_TOTAL[cross-domain]:-0} | $(echo "scale=1; ${CATEGORY_PASSED[cross-domain]:-0} * 100 / ${CATEGORY_TOTAL[cross-domain]:-1}" | bc)% |
| quantitative | ${CATEGORY_PASSED[quantitative]:-0}/${CATEGORY_TOTAL[quantitative]:-0} | $(echo "scale=1; ${CATEGORY_PASSED[quantitative]:-0} * 100 / ${CATEGORY_TOTAL[quantitative]:-1}" | bc)% |
| question | ${CATEGORY_PASSED[question]:-0}/${CATEGORY_TOTAL[question]:-0} | $(echo "scale=1; ${CATEGORY_PASSED[question]:-0} * 100 / ${CATEGORY_TOTAL[question]:-1}" | bc)% |
| imperative | ${CATEGORY_PASSED[imperative]:-0}/${CATEGORY_TOTAL[imperative]:-0} | $(echo "scale=1; ${CATEGORY_PASSED[imperative]:-0} * 100 / ${CATEGORY_TOTAL[imperative]:-1}" | bc)% |

## 失败用例分析

EOF

# 输出失败用例
echo "" >> "$REPORT_FILE"
echo "| 查询 | 期望 | 实际 | 难度 | 类别 |" >> "$REPORT_FILE"
echo "|------|------|------|------|------|" >> "$REPORT_FILE"

for i in "${!TEST_CASES[@]}"; do
  IFS='|' read -r QUERY EXPECTED DIFFICULTY CATEGORY <<< "${TEST_CASES[$i]}"

  # 重新请求获取实际结果（简化版，实际应该缓存）
  RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/ai-intents/execute" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "{\"userInput\": \"${QUERY}\", \"sessionId\": \"fail-check-${i}\"}" 2>/dev/null)

  ACTUAL=$(echo "$RESPONSE" | grep -o '"intentCode":"[^"]*' | head -1 | cut -d'"' -f4)

  if [ "$ACTUAL" != "$EXPECTED" ] && [ -n "$ACTUAL" ]; then
    echo "| ${QUERY} | ${EXPECTED} | ${ACTUAL} | ${DIFFICULTY} | ${CATEGORY} |" >> "$REPORT_FILE"
  fi
done

echo ""
echo "=========================================="
echo "测试完成: ${PASSED}/${TOTAL} (${PASS_RATE}%)"
echo "平均延迟: ${AVG_LATENCY}ms"
echo "报告: ${REPORT_FILE}"
echo "=========================================="
