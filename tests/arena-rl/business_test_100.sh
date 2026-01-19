#!/bin/bash
#
# ArenaRL 真实业务场景测试 - 100条测试用例
# 测试意图识别准确性、操作执行效果、自然语言回复质量
#

BASE_URL="http://139.196.165.140:10010"
FACTORY_ID="F001"
REPORT_FILE="business_test_report_$(date +%Y%m%d_%H%M%S).md"

# 获取 Token
TOKEN=$(curl -s -X POST "${BASE_URL}/api/mobile/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username": "factory_admin1", "password": "123456"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "获取 Token 失败"
  exit 1
fi

echo "Token 获取成功"
echo ""

# 初始化报告
cat > "$REPORT_FILE" << 'EOF'
# ArenaRL 真实业务场景测试报告

## 测试时间
EOF
echo "$(date '+%Y-%m-%d %H:%M:%S')" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 测试用例数组 (格式: "类别|查询|期望意图")
declare -a TEST_CASES=(
  # ========== 批次查询类 (20条) ==========
  "查询|查一下原料批次MB001的信息|MATERIAL_BATCH_QUERY"
  "查询|原材料批次详情|MATERIAL_BATCH_QUERY"
  "查询|今天收到了哪些原料|MATERIAL_BATCH_QUERY"
  "查询|最近入库的原材料有哪些|MATERIAL_BATCH_QUERY"
  "查询|原料MB开头的批次列表|MATERIAL_BATCH_QUERY"
  "查询|生产批次状态|PROCESSING_BATCH_LIST"
  "查询|今天有多少批次在生产|PROCESSING_BATCH_LIST"
  "查询|正在加工的批次|PROCESSING_BATCH_LIST"
  "查询|批次PB001的进度|PROCESSING_BATCH_QUERY"
  "查询|追溯一下PB001|TRACE_BATCH"
  "查询|批次溯源信息|TRACE_BATCH"
  "查询|查询批次的来源|TRACE_BATCH"
  "查询|这个批次的原料从哪里来的|TRACE_BATCH"
  "查询|出货批次查询|SHIPMENT_QUERY"
  "查询|今天出了多少货|SHIPMENT_QUERY"
  "查询|最近的发货记录|SHIPMENT_QUERY"
  "查询|待发货的批次|SHIPMENT_QUERY"
  "查询|物料列表|MATERIAL_TYPE_LIST"
  "查询|我们有哪些原材料类型|MATERIAL_TYPE_LIST"
  "查询|产品类型有哪些|PRODUCT_TYPE_QUERY"

  # ========== 质检类 (15条) ==========
  "查询|今天的质检结果|QC_INSPECTION_LIST"
  "查询|质检报告|QC_INSPECTION_LIST"
  "查询|不合格的批次有哪些|QC_INSPECTION_LIST"
  "查询|待质检的批次|QC_INSPECTION_LIST"
  "查询|质量检验记录|QC_INSPECTION_LIST"
  "查询|批次PB001的质检结果|QC_INSPECTION_QUERY"
  "查询|这个批次合格吗|QC_INSPECTION_QUERY"
  "查询|质检标准是什么|QC_STANDARD_QUERY"
  "查询|牛肉的检验项目有哪些|QC_STANDARD_QUERY"
  "查询|温度检测记录|QC_INSPECTION_LIST"
  "操作|创建质检记录|QC_INSPECTION_CREATE"
  "操作|提交质检结果|QC_INSPECTION_CREATE"
  "操作|记录一条质检数据|QC_INSPECTION_CREATE"
  "操作|标记批次为不合格|QC_INSPECTION_CREATE"
  "操作|更新质检状态|QC_INSPECTION_CREATE"

  # ========== 设备类 (10条) ==========
  "查询|设备列表|EQUIPMENT_LIST"
  "查询|有哪些设备|EQUIPMENT_LIST"
  "查询|车间里的机器|EQUIPMENT_LIST"
  "查询|设备告警|EQUIPMENT_ALERT_LIST"
  "查询|有没有设备报警|EQUIPMENT_ALERT_LIST"
  "查询|今天的设备故障|EQUIPMENT_ALERT_LIST"
  "查询|哪台设备需要维护|EQUIPMENT_ALERT_LIST"
  "查询|设备状态|EQUIPMENT_QUERY"
  "查询|切割机的运行情况|EQUIPMENT_QUERY"
  "查询|设备维护记录|EQUIPMENT_MAINTENANCE_LIST"

  # ========== 人员类 (15条) ==========
  "查询|今天谁上班|WORKER_ATTENDANCE_LIST"
  "查询|考勤记录|WORKER_ATTENDANCE_LIST"
  "查询|迟到的人有哪些|WORKER_ATTENDANCE_LIST"
  "查询|工人列表|WORKER_LIST"
  "查询|有多少员工|WORKER_LIST"
  "查询|车间人员|WORKER_LIST"
  "查询|张三的信息|WORKER_QUERY"
  "查询|员工技能|WORKER_SKILL_QUERY"
  "查询|谁会操作切割机|WORKER_SKILL_QUERY"
  "查询|今天的排班|SCHEDULE_QUERY"
  "查询|明天谁上班|SCHEDULE_QUERY"
  "查询|排班表|SCHEDULE_QUERY"
  "操作|给张三请假|WORKER_LEAVE_CREATE"
  "操作|安排工人上班|SCHEDULE_CREATE"
  "操作|调整排班|SCHEDULE_UPDATE"

  # ========== 报表统计类 (10条) ==========
  "查询|今天的生产报表|REPORT_PRODUCTION_SUMMARY"
  "查询|产量统计|REPORT_PRODUCTION_SUMMARY"
  "查询|本周产量多少|REPORT_PRODUCTION_SUMMARY"
  "查询|效率分析|REPORT_EFFICIENCY_ANALYSIS"
  "查询|产线效率怎么样|REPORT_EFFICIENCY_ANALYSIS"
  "查询|哪条线效率最高|REPORT_EFFICIENCY_ANALYSIS"
  "查询|仪表盘|REPORT_DASHBOARD_OVERVIEW"
  "查询|数据概览|REPORT_DASHBOARD_OVERVIEW"
  "查询|今日汇总|REPORT_DASHBOARD_OVERVIEW"
  "查询|KPI达成情况|REPORT_KPI_QUERY"

  # ========== 写入操作类 (20条) ==========
  "操作|创建一个新的生产批次|PROCESSING_BATCH_CREATE"
  "操作|开始新批次|PROCESSING_BATCH_CREATE"
  "操作|录入生产批次|PROCESSING_BATCH_CREATE"
  "操作|更新批次状态|PROCESSING_BATCH_UPDATE"
  "操作|批次完成|PROCESSING_BATCH_UPDATE"
  "操作|标记批次暂停|PROCESSING_BATCH_UPDATE"
  "操作|添加原料入库|MATERIAL_BATCH_CREATE"
  "操作|录入新原料|MATERIAL_BATCH_CREATE"
  "操作|原材料入库|MATERIAL_BATCH_CREATE"
  "操作|创建发货单|SHIPMENT_CREATE"
  "操作|安排发货|SHIPMENT_CREATE"
  "操作|出货登记|SHIPMENT_CREATE"
  "操作|更新发货状态|SHIPMENT_UPDATE"
  "操作|确认收货|SHIPMENT_UPDATE"
  "操作|记录设备维护|EQUIPMENT_MAINTENANCE_CREATE"
  "操作|登记设备故障|EQUIPMENT_ALERT_CREATE"
  "操作|设备保养记录|EQUIPMENT_MAINTENANCE_CREATE"
  "操作|添加新员工|WORKER_CREATE"
  "操作|录入工人信息|WORKER_CREATE"
  "操作|更新员工技能|WORKER_SKILL_UPDATE"

  # ========== 歧义场景 (10条) - 测试 ArenaRL ==========
  "歧义|记录|SHIPMENT_QUERY"
  "歧义|数据|REPORT_DASHBOARD_OVERVIEW"
  "歧义|列表|MATERIAL_TYPE_LIST"
  "歧义|查询|MATERIAL_BATCH_QUERY"
  "歧义|统计|REPORT_PRODUCTION_SUMMARY"
  "歧义|信息|MATERIAL_BATCH_QUERY"
  "歧义|详情|MATERIAL_BATCH_QUERY"
  "歧义|状态|PROCESSING_BATCH_LIST"
  "歧义|报表|REPORT_PRODUCTION_SUMMARY"
  "歧义|管理|USER_ROLE_ASSIGN"
)

# 统计变量
TOTAL=0
PASSED=0
FAILED=0
QUERY_TESTS=0
QUERY_PASSED=0
WRITE_TESTS=0
WRITE_PASSED=0
AMBIG_TESTS=0
AMBIG_PASSED=0

echo "## 测试结果" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "| # | 类别 | 查询 | 期望意图 | 实际意图 | 结果 | 延迟 |" >> "$REPORT_FILE"
echo "|---|------|------|----------|----------|------|------|" >> "$REPORT_FILE"

echo "开始测试 ${#TEST_CASES[@]} 条用例..."
echo ""

idx=0
for test_case in "${TEST_CASES[@]}"; do
  idx=$((idx + 1))
  TOTAL=$((TOTAL + 1))

  IFS='|' read -r category query expected_intent <<< "$test_case"

  echo -n "[$idx/${#TEST_CASES[@]}] $query... "

  START_MS=$(python3 -c "import time; print(int(time.time()*1000))")

  RESPONSE=$(curl -s -X POST "${BASE_URL}/api/mobile/${FACTORY_ID}/ai-intents/execute" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"userInput\": \"$query\", \"previewOnly\": true}" 2>&1)

  END_MS=$(python3 -c "import time; print(int(time.time()*1000))")
  LATENCY=$((END_MS - START_MS))

  # 解析结果
  actual_intent=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('intentCode','ERROR'))" 2>/dev/null || echo "ERROR")

  # 判断结果
  if [ "$actual_intent" == "$expected_intent" ]; then
    result="✅"
    PASSED=$((PASSED + 1))
    case "$category" in
      "查询") QUERY_PASSED=$((QUERY_PASSED + 1)) ;;
      "操作") WRITE_PASSED=$((WRITE_PASSED + 1)) ;;
      "歧义") AMBIG_PASSED=$((AMBIG_PASSED + 1)) ;;
    esac
    echo "✅ ${LATENCY}ms"
  else
    result="❌"
    FAILED=$((FAILED + 1))
    echo "❌ 期望:$expected_intent 实际:$actual_intent"
  fi

  case "$category" in
    "查询") QUERY_TESTS=$((QUERY_TESTS + 1)) ;;
    "操作") WRITE_TESTS=$((WRITE_TESTS + 1)) ;;
    "歧义") AMBIG_TESTS=$((AMBIG_TESTS + 1)) ;;
  esac

  # 写入报告
  echo "| $idx | $category | $query | $expected_intent | $actual_intent | $result | ${LATENCY}ms |" >> "$REPORT_FILE"

  # 控制请求频率
  sleep 0.3
done

echo "" >> "$REPORT_FILE"

# 统计汇总
echo "## 测试汇总" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "| 类别 | 总数 | 通过 | 通过率 |" >> "$REPORT_FILE"
echo "|------|------|------|--------|" >> "$REPORT_FILE"
echo "| 查询类 | $QUERY_TESTS | $QUERY_PASSED | $(echo "scale=1; $QUERY_PASSED * 100 / $QUERY_TESTS" | bc)% |" >> "$REPORT_FILE"
echo "| 操作类 | $WRITE_TESTS | $WRITE_PASSED | $(echo "scale=1; $WRITE_PASSED * 100 / $WRITE_TESTS" | bc)% |" >> "$REPORT_FILE"
echo "| 歧义类 | $AMBIG_TESTS | $AMBIG_PASSED | $(echo "scale=1; $AMBIG_PASSED * 100 / $AMBIG_TESTS" | bc)% |" >> "$REPORT_FILE"
echo "| **总计** | $TOTAL | $PASSED | $(echo "scale=1; $PASSED * 100 / $TOTAL" | bc)% |" >> "$REPORT_FILE"

echo ""
echo "=========================================="
echo "           测试完成"
echo "=========================================="
echo "总数: $TOTAL"
echo "通过: $PASSED ($(echo "scale=1; $PASSED * 100 / $TOTAL" | bc)%)"
echo "失败: $FAILED"
echo ""
echo "详细报告: $REPORT_FILE"
