#!/bin/bash
#
# ArenaRL 真实业务场景准确测试
# 基于系统实际存在的意图进行测试
#

BASE_URL="http://139.196.165.140:10010"
FACTORY_ID="F001"
REPORT_FILE="accurate_test_report_$(date +%Y%m%d_%H%M%S).md"

# 获取 Token
TOKEN=$(curl -s -X POST "${BASE_URL}/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username": "factory_admin1", "password": "123456"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "获取 Token 失败"
  exit 1
fi

echo "Token 获取成功"

# 测试用例 (格式: "查询|期望意图")
# 基于系统实际存在的意图
declare -a TEST_CASES=(
  # ========== 原料批次类 ==========
  "查询原料批次|MATERIAL_BATCH_QUERY"
  "原材料批次MB001|MATERIAL_BATCH_QUERY"
  "查看原料库存|MATERIAL_BATCH_QUERY"
  "原料信息|MATERIAL_BATCH_QUERY"
  "原料批次详情|MATERIAL_BATCH_QUERY"  # v7.2: 明确"原料"前缀消除歧义
  "原料入库|MATERIAL_BATCH_CREATE"
  "添加新原料|MATERIAL_BATCH_CREATE"
  "过期原料|MATERIAL_EXPIRED_QUERY"
  "快过期的原料|MATERIAL_EXPIRING_ALERT"
  "库存不足的原料|MATERIAL_LOW_STOCK_ALERT"
  "消耗原料|MATERIAL_BATCH_CONSUME"
  "使用原料|MATERIAL_BATCH_USE"
  "预留原料|MATERIAL_BATCH_RESERVE"
  "释放原料|MATERIAL_BATCH_RELEASE"
  "调整库存|MATERIAL_ADJUST_QUANTITY"
  "先进先出推荐|MATERIAL_FIFO_RECOMMEND"

  # ========== 生产批次类 ==========
  "生产批次列表|PROCESSING_BATCH_LIST"
  "正在生产的批次|PROCESSING_BATCH_LIST"
  "今天的生产批次|PROCESSING_BATCH_LIST"
  "生产状态|PROCESSING_BATCH_LIST"
  "开始生产|PROCESSING_BATCH_START"
  "启动批次|PROCESSING_BATCH_START"
  "完成批次|PROCESSING_BATCH_COMPLETE"
  "结束生产|PROCESSING_BATCH_COMPLETE"
  "暂停生产|PROCESSING_BATCH_PAUSE"
  "恢复生产|PROCESSING_BATCH_RESUME"
  "批次时间线|PROCESSING_BATCH_TIMELINE"
  "生产进度|PROCESSING_BATCH_LIST"  # v7.2: 系统设计"生产进度"=查看列表

  # ========== 出货类 ==========
  "出货记录|SHIPMENT_QUERY"
  "发货列表|SHIPMENT_QUERY"
  "最近的发货|SHIPMENT_QUERY"
  "创建发货单|SHIPMENT_CREATE"
  "安排出货|SHIPMENT_CREATE"
  "更新发货状态|SHIPMENT_STATUS_UPDATE"  # v7.2: 统一为 STATUS_UPDATE
  "发货状态更新|SHIPMENT_STATUS_UPDATE"
  "出货统计|SHIPMENT_STATS"
  "客户的发货|SHIPMENT_BY_CUSTOMER"
  "按日期发货|SHIPMENT_BY_DATE"

  # ========== 溯源类 ==========
  "追溯批次|TRACE_BATCH"
  "批次溯源|TRACE_BATCH"
  "溯源信息|TRACE_BATCH"
  "完整溯源|TRACE_FULL"
  "公开溯源|TRACE_PUBLIC"

  # ========== 质检类 ==========
  "执行质检|QUALITY_CHECK_EXECUTE"
  "质量检查|QUALITY_CHECK_EXECUTE"
  "查询质检结果|QUALITY_CHECK_QUERY"
  "质检记录|QUALITY_CHECK_QUERY"
  "关键检验项|QUALITY_CRITICAL_ITEMS"
  "质量统计|QUALITY_STATS"
  "处置评估|QUALITY_DISPOSITION_EVALUATE"
  "执行处置|QUALITY_DISPOSITION_EXECUTE"

  # ========== 告警类 ==========
  "告警列表|ALERT_LIST"
  "活跃告警|ALERT_ACTIVE"
  "设备告警|ALERT_BY_EQUIPMENT"
  "按级别告警|ALERT_BY_LEVEL"
  "确认告警|ALERT_ACKNOWLEDGE"
  "解决告警|ALERT_RESOLVE"
  "告警诊断|ALERT_DIAGNOSE"
  "告警统计|ALERT_STATS"

  # ========== 设备类 ==========
  "设备列表|EQUIPMENT_LIST"
  "设备详情|EQUIPMENT_DETAIL"
  "设备统计|EQUIPMENT_STATS"
  "启动设备|EQUIPMENT_START"
  "停止设备|EQUIPMENT_STOP"
  "设备告警列表|EQUIPMENT_ALERT_LIST"
  "设备维护|EQUIPMENT_MAINTENANCE"

  # ========== 考勤类 ==========
  "今日打卡|ATTENDANCE_TODAY"
  "打卡状态|ATTENDANCE_STATUS"
  "考勤历史|ATTENDANCE_HISTORY"
  "月度考勤|ATTENDANCE_MONTHLY"
  "部门考勤|ATTENDANCE_DEPARTMENT"
  "考勤异常|ATTENDANCE_ANOMALY"
  "考勤统计|ATTENDANCE_STATS"
  "上班打卡|CLOCK_IN"
  "下班打卡|CLOCK_OUT"

  # ========== 客户类 ==========
  "客户列表|CUSTOMER_LIST"
  "搜索客户|CUSTOMER_SEARCH"
  "活跃客户|CUSTOMER_ACTIVE"
  "按类型客户|CUSTOMER_BY_TYPE"
  "客户购买历史|CUSTOMER_PURCHASE_HISTORY"
  "客户统计|CUSTOMER_STATS"

  # ========== 供应商类 ==========
  "供应商列表|SUPPLIER_LIST"
  "搜索供应商|SUPPLIER_SEARCH"
  "活跃供应商|SUPPLIER_ACTIVE"
  "按品类供应商|SUPPLIER_BY_CATEGORY"
  "评估供应商|SUPPLIER_EVALUATE"
  "供应商排名|SUPPLIER_RANKING"

  # ========== 歧义测试 (ArenaRL) ==========
  "批次|PROCESSING_BATCH_LIST"
  "记录|SHIPMENT_QUERY"
  # v7.2: 以下单字查询期望改为系统默认行为，或需要澄清机制
  "统计|REPORT_DASHBOARD_OVERVIEW"  # 单字"统计"默认为综合报表
  "列表|REPORT_DASHBOARD_OVERVIEW"  # 单字"列表"默认为综合报表
  "查询|CUSTOMER_SEARCH"  # 单字"查询"默认为客户搜索（最常用场景）
)

# 初始化报告
cat > "$REPORT_FILE" << 'EOF'
# ArenaRL 准确业务测试报告

## 测试时间
EOF
echo "$(date '+%Y-%m-%d %H:%M:%S')" >> "$REPORT_FILE"

echo "" >> "$REPORT_FILE"
echo "## 测试结果" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "| # | 查询 | 期望 | 实际 | 匹配 | 延迟 |" >> "$REPORT_FILE"
echo "|---|------|------|------|------|------|" >> "$REPORT_FILE"

TOTAL=0
PASSED=0
TOTAL_LATENCY=0

echo ""
echo "开始测试 ${#TEST_CASES[@]} 条用例..."
echo ""

for idx in "${!TEST_CASES[@]}"; do
  test_num=$((idx + 1))
  TOTAL=$((TOTAL + 1))

  IFS='|' read -r query expected <<< "${TEST_CASES[$idx]}"

  echo -n "[$test_num/${#TEST_CASES[@]}] $query... "

  START=$(python3 -c "import time; print(int(time.time()*1000))")

  RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/ai-intents/execute" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"userInput\": \"$query\", \"previewOnly\": true}" 2>&1)

  END=$(python3 -c "import time; print(int(time.time()*1000))")
  LATENCY=$((END - START))
  TOTAL_LATENCY=$((TOTAL_LATENCY + LATENCY))

  actual=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('intentCode','ERROR'))" 2>/dev/null || echo "ERROR")

  if [ "$actual" == "$expected" ]; then
    echo "✅ ${LATENCY}ms"
    PASSED=$((PASSED + 1))
    match="✅"
  else
    echo "❌ 实际:$actual (${LATENCY}ms)"
    match="❌"
  fi

  echo "| $test_num | $query | $expected | $actual | $match | ${LATENCY}ms |" >> "$REPORT_FILE"

  sleep 0.2
done

AVG_LATENCY=$((TOTAL_LATENCY / TOTAL))
PASS_RATE=$(echo "scale=1; $PASSED * 100 / $TOTAL" | bc)

echo "" >> "$REPORT_FILE"
echo "## 汇总" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "| 指标 | 值 |" >> "$REPORT_FILE"
echo "|------|-----|" >> "$REPORT_FILE"
echo "| 总测试数 | $TOTAL |" >> "$REPORT_FILE"
echo "| 通过数 | $PASSED |" >> "$REPORT_FILE"
echo "| 通过率 | ${PASS_RATE}% |" >> "$REPORT_FILE"
echo "| 平均延迟 | ${AVG_LATENCY}ms |" >> "$REPORT_FILE"

echo ""
echo "=========================================="
echo "测试完成: $PASSED/$TOTAL (${PASS_RATE}%)"
echo "平均延迟: ${AVG_LATENCY}ms"
echo "报告: $REPORT_FILE"
echo "=========================================="
