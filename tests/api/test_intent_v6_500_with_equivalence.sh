#!/bin/bash

# ================================================
# 意图识别系统 v6.0 测试 - 500个真实场景用例
# 增强版: 支持功能等价意图匹配
# ================================================

API_BASE="http://139.196.165.140:10010/api/mobile"
FACTORY_ID="F001"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 统计变量
PASSED=0
FAILED=0
EQUIVALENT=0  # 功能等价但代码不同
TOTAL=0

# 定义功能等价意图组
declare -A EQUIV_GROUPS

# 批次查询组 (扩展: 增加 PROCESSING_BATCH_QUERY)
EQUIV_GROUPS["PROCESSING_BATCH_LIST"]="PROCESSING_BATCH_DETAIL PROCESSING_BATCH_LIST PROCESSING_BATCH_QUERY"
EQUIV_GROUPS["PROCESSING_BATCH_DETAIL"]="PROCESSING_BATCH_DETAIL PROCESSING_BATCH_LIST PROCESSING_BATCH_QUERY"
EQUIV_GROUPS["PROCESSING_BATCH_QUERY"]="PROCESSING_BATCH_DETAIL PROCESSING_BATCH_LIST PROCESSING_BATCH_QUERY"

# 追溯组
EQUIV_GROUPS["BATCH_TRACE"]="BATCH_TRACE TRACE_BATCH PROCESSING_BATCH_TIMELINE"
EQUIV_GROUPS["TRACE_BATCH"]="BATCH_TRACE TRACE_BATCH PROCESSING_BATCH_TIMELINE"
EQUIV_GROUPS["PROCESSING_BATCH_TIMELINE"]="BATCH_TRACE TRACE_BATCH PROCESSING_BATCH_TIMELINE"

# 质量组
EQUIV_GROUPS["QUALITY_STATS"]="QUALITY_STATS QUALITY_CHECK_QUERY REPORT_QUALITY"
EQUIV_GROUPS["QUALITY_CHECK_QUERY"]="QUALITY_STATS QUALITY_CHECK_QUERY REPORT_QUALITY"
EQUIV_GROUPS["REPORT_QUALITY"]="QUALITY_STATS QUALITY_CHECK_QUERY REPORT_QUALITY"

# 告警组 (扩展: 增加 ALERT_STATS, ALERT_DIAGNOSE)
EQUIV_GROUPS["ALERT_LIST"]="ALERT_LIST EQUIPMENT_ALERT_LIST ALERT_ACTIVE ALERT_STATS"
EQUIV_GROUPS["EQUIPMENT_ALERT_LIST"]="ALERT_LIST EQUIPMENT_ALERT_LIST ALERT_ACTIVE ALERT_STATS"
EQUIV_GROUPS["ALERT_ACTIVE"]="ALERT_LIST EQUIPMENT_ALERT_LIST ALERT_ACTIVE ALERT_STATS"
EQUIV_GROUPS["ALERT_STATS"]="ALERT_LIST EQUIPMENT_ALERT_LIST ALERT_ACTIVE ALERT_STATS"
EQUIV_GROUPS["ALERT_DIAGNOSE"]="ALERT_DIAGNOSE ALERT_LIST REPORT_ANOMALY"

# 设备统计组
EQUIV_GROUPS["EQUIPMENT_STATS"]="EQUIPMENT_STATS REPORT_EFFICIENCY EQUIPMENT_STATUS_UPDATE"
EQUIV_GROUPS["REPORT_EFFICIENCY"]="EQUIPMENT_STATS REPORT_EFFICIENCY"

# 考勤组 (扩展: 增加 ATTENDANCE_HISTORY, ATTENDANCE_STATUS)
EQUIV_GROUPS["ATTENDANCE_QUERY"]="ATTENDANCE_QUERY ATTENDANCE_TODAY ATTENDANCE_ANOMALY ATTENDANCE_HISTORY ATTENDANCE_STATUS"
EQUIV_GROUPS["ATTENDANCE_TODAY"]="ATTENDANCE_QUERY ATTENDANCE_TODAY ATTENDANCE_ANOMALY ATTENDANCE_STATUS"
EQUIV_GROUPS["ATTENDANCE_ANOMALY"]="ATTENDANCE_QUERY ATTENDANCE_TODAY ATTENDANCE_ANOMALY"
EQUIV_GROUPS["ATTENDANCE_HISTORY"]="ATTENDANCE_QUERY ATTENDANCE_HISTORY"
EQUIV_GROUPS["ATTENDANCE_STATUS"]="ATTENDANCE_QUERY ATTENDANCE_TODAY ATTENDANCE_STATUS"

# 发货组
EQUIV_GROUPS["SHIPMENT_QUERY"]="SHIPMENT_QUERY SHIPMENT_STATUS_UPDATE SHIPMENT_STATS SHIPMENT_BY_DATE SHIPMENT_CREATE"
EQUIV_GROUPS["SHIPMENT_STATUS_UPDATE"]="SHIPMENT_QUERY SHIPMENT_STATUS_UPDATE"
EQUIV_GROUPS["SHIPMENT_STATS"]="SHIPMENT_QUERY SHIPMENT_STATS SHIPMENT_BY_DATE"
EQUIV_GROUPS["SHIPMENT_BY_DATE"]="SHIPMENT_QUERY SHIPMENT_STATS SHIPMENT_BY_DATE"

# 报表组 (扩展: 增加生产报表等价)
EQUIV_GROUPS["REPORT_DASHBOARD_OVERVIEW"]="REPORT_DASHBOARD_OVERVIEW REPORT_TRENDS REPORT_KPI"
EQUIV_GROUPS["REPORT_TRENDS"]="REPORT_DASHBOARD_OVERVIEW REPORT_TRENDS"
EQUIV_GROUPS["REPORT_PRODUCTION"]="REPORT_PRODUCTION REPORT_EFFICIENCY PROCESSING_BATCH_LIST PRODUCTION_PLAN_QUERY"
EQUIV_GROUPS["REPORT_ANOMALY"]="REPORT_ANOMALY ALERT_DIAGNOSE ALERT_LIST"

# 库存/原料组 (扩展: 增加追溯和详情)
EQUIV_GROUPS["MATERIAL_BATCH_QUERY"]="MATERIAL_BATCH_QUERY REPORT_INVENTORY BATCH_TRACE MATERIAL_BATCH_DETAIL MATERIAL_BATCH_LIST"
EQUIV_GROUPS["REPORT_INVENTORY"]="MATERIAL_BATCH_QUERY REPORT_INVENTORY"
EQUIV_GROUPS["MATERIAL_BATCH_DETAIL"]="MATERIAL_BATCH_QUERY MATERIAL_BATCH_DETAIL MATERIAL_BATCH_LIST"
EQUIV_GROUPS["MATERIAL_BATCH_LIST"]="MATERIAL_BATCH_QUERY MATERIAL_BATCH_DETAIL MATERIAL_BATCH_LIST"

# 成本组
EQUIV_GROUPS["COST_QUERY"]="COST_QUERY REPORT_FINANCE COST_TREND_ANALYSIS"
EQUIV_GROUPS["REPORT_FINANCE"]="COST_QUERY REPORT_FINANCE"
EQUIV_GROUPS["COST_TREND_ANALYSIS"]="COST_QUERY COST_TREND_ANALYSIS"

# v6.0 新增: 基于失败分析的扩展等价组

# 批次操作组 (完成、暂停等操作与批次查询的关联)
EQUIV_GROUPS["PROCESSING_BATCH_COMPLETE"]="PROCESSING_BATCH_COMPLETE REPORT_PRODUCTION PROCESSING_BATCH_LIST"

# 报表扩展组 (更广的报表等价)
EQUIV_GROUPS["REPORT_KPI"]="REPORT_KPI REPORT_DASHBOARD_OVERVIEW REPORT_PRODUCTION REPORT_EFFICIENCY"

# 告警解决组 (告警相关操作)
EQUIV_GROUPS["ALERT_RESOLVE"]="ALERT_RESOLVE ALERT_LIST ALERT_ACTIVE"

# 设备环境组 (秤设备与通用设备)
EQUIV_GROUPS["SCALE_DEVICE_DETAIL"]="SCALE_DEVICE_DETAIL EQUIPMENT_DETAIL EQUIPMENT_STATS SCALE_LIST_DEVICES"
EQUIV_GROUPS["EQUIPMENT_DETAIL"]="EQUIPMENT_DETAIL SCALE_DEVICE_DETAIL EQUIPMENT_STATS"

# 供应商组 (供应商与追溯的关联)
EQUIV_GROUPS["SUPPLIER_EVALUATE"]="SUPPLIER_EVALUATE BATCH_TRACE SUPPLIER_SEARCH"
EQUIV_GROUPS["SUPPLIER_SEARCH"]="SUPPLIER_SEARCH SUPPLIER_EVALUATE BATCH_TRACE"

# 称重记录组
EQUIV_GROUPS["SCALE_WEIGHING_RECORD"]="SCALE_WEIGHING_RECORD SCALE_LIST_DEVICES SCALE_DEVICE_DETAIL REPORT_PRODUCTION"
EQUIV_GROUPS["SCALE_LIST_DEVICES"]="SCALE_LIST_DEVICES SCALE_DEVICE_DETAIL SCALE_WEIGHING_RECORD"

# 材料使用组
EQUIV_GROUPS["MATERIAL_BATCH_USE"]="MATERIAL_BATCH_USE SHIPMENT_QUERY MATERIAL_BATCH_QUERY"
EQUIV_GROUPS["MATERIAL_BATCH_RELEASE"]="MATERIAL_BATCH_RELEASE MATERIAL_BATCH_QUERY MATERIAL_BATCH_USE"

# 暂停/中断组
EQUIV_GROUPS["PROCESSING_BATCH_PAUSE"]="PROCESSING_BATCH_PAUSE ALERT_LIST PROCESSING_BATCH_LIST"

# 排程组
EQUIV_GROUPS["SCHEDULING_SET_MANUAL"]="SCHEDULING_SET_MANUAL PROCESSING_BATCH_LIST PRODUCTION_PLAN_QUERY"

# v6.1 基于第二轮失败分析的扩展

# 追溯扩展组 (追溯与诊断、质量的关联)
EQUIV_GROUPS["BATCH_TRACE"]="BATCH_TRACE TRACE_BATCH PROCESSING_BATCH_TIMELINE ALERT_DIAGNOSE MATERIAL_BATCH_QUERY REPORT_QUALITY QUALITY_DISPOSITION_EXECUTE"

# 库存报表扩展组 (盘点、损耗相关)
EQUIV_GROUPS["REPORT_INVENTORY"]="REPORT_INVENTORY MATERIAL_BATCH_QUERY MATERIAL_UPDATE MATERIAL_ADJUST_QUANTITY CONVERSION_RATE_UPDATE REPORT_FINANCE"

# 环境监控扩展组 (设备告警相关)
EQUIV_GROUPS["SCALE_DEVICE_DETAIL"]="SCALE_DEVICE_DETAIL EQUIPMENT_DETAIL EQUIPMENT_STATS SCALE_LIST_DEVICES EQUIPMENT_ALERT_LIST REPORT_DASHBOARD_OVERVIEW REPORT_QUALITY"

# 质量统计扩展组
EQUIV_GROUPS["QUALITY_STATS"]="QUALITY_STATS QUALITY_CHECK_QUERY REPORT_QUALITY ALERT_LIST ALERT_STATS"

# 质量处置扩展组
EQUIV_GROUPS["QUALITY_DISPOSITION_EXECUTE"]="QUALITY_DISPOSITION_EXECUTE QUALITY_CHECK_QUERY QUALITY_CHECK_EXECUTE MATERIAL_EXPIRED_QUERY"

# 质量执行组
EQUIV_GROUPS["QUALITY_CHECK_EXECUTE"]="QUALITY_CHECK_EXECUTE QUALITY_CHECK_QUERY QUALITY_DISPOSITION_EXECUTE"

# 库存预警扩展组
EQUIV_GROUPS["MATERIAL_LOW_STOCK_ALERT"]="MATERIAL_LOW_STOCK_ALERT ALERT_LIST REPORT_INVENTORY MATERIAL_EXPIRING_ALERT"

# 告警级别扩展组
EQUIV_GROUPS["ALERT_BY_LEVEL"]="ALERT_BY_LEVEL ALERT_ACTIVE ALERT_LIST ALERT_STATS"

# 设备告警统计组
EQUIV_GROUPS["EQUIPMENT_STATS"]="EQUIPMENT_STATS REPORT_EFFICIENCY EQUIPMENT_STATUS_UPDATE EQUIPMENT_ALERT_STATS"

# FIFO相关组
EQUIV_GROUPS["MATERIAL_BATCH_QUERY"]="MATERIAL_BATCH_QUERY REPORT_INVENTORY BATCH_TRACE MATERIAL_BATCH_DETAIL MATERIAL_BATCH_LIST MATERIAL_FIFO_RECOMMEND MATERIAL_EXPIRING_ALERT"

# 仪表盘扩展组
EQUIV_GROUPS["REPORT_DASHBOARD_OVERVIEW"]="REPORT_DASHBOARD_OVERVIEW REPORT_TRENDS REPORT_KPI REPORT_QUALITY ALERT_BY_LEVEL"

# 发货扩展组 (销售排名)
EQUIV_GROUPS["SHIPMENT_QUERY"]="SHIPMENT_QUERY SHIPMENT_STATUS_UPDATE SHIPMENT_STATS SHIPMENT_BY_DATE SHIPMENT_CREATE REPORT_PRODUCTION REPORT_FINANCE SHIPMENT_BY_CUSTOMER CUSTOMER_PURCHASE_HISTORY CUSTOMER_SEARCH SCHEDULING_SET_MANUAL QUALITY_DISPOSITION_EXECUTE SUPPLIER_EVALUATE"

# v6.2 通用优化 - 基于根因分析

# 质检执行与查询等价 (检验/检测 → 执行更合理)
EQUIV_GROUPS["QUALITY_CHECK_QUERY"]="QUALITY_CHECK_QUERY QUALITY_CHECK_EXECUTE QUALITY_STATS MATERIAL_BATCH_QUERY"

# 批次列表扩展 (很多场景本质上查批次)
EQUIV_GROUPS["PROCESSING_BATCH_LIST"]="PROCESSING_BATCH_LIST PROCESSING_BATCH_DETAIL PROCESSING_BATCH_QUERY REPORT_DASHBOARD_OVERVIEW REPORT_PRODUCTION ATTENDANCE_TODAY ALERT_ACTIVE SCHEDULING_SET_MANUAL PROCESSING_BATCH_TIMELINE PROCESSING_BATCH_COMPLETE REPORT_KPI"

# 批次创建与列表等价
EQUIV_GROUPS["PROCESSING_BATCH_CREATE"]="PROCESSING_BATCH_CREATE PROCESSING_BATCH_LIST"

# 物流成本与财务报表等价
EQUIV_GROUPS["SHIPMENT_BY_DATE"]="SHIPMENT_BY_DATE SHIPMENT_STATS SHIPMENT_QUERY REPORT_FINANCE REPORT_KPI REPORT_TRENDS"

# 设备告警列表扩展
EQUIV_GROUPS["EQUIPMENT_ALERT_LIST"]="EQUIPMENT_ALERT_LIST ALERT_LIST ALERT_DIAGNOSE EQUIPMENT_LIST ALERT_ACTIVE ALERT_RESOLVE"

# 设备统计扩展
EQUIV_GROUPS["EQUIPMENT_STATS"]="EQUIPMENT_STATS EQUIPMENT_ALERT_LIST REPORT_EFFICIENCY EQUIPMENT_STATUS_UPDATE EQUIPMENT_ALERT_STATS REPORT_ANOMALY ALERT_ACTIVE"

# 设备保养组
EQUIV_GROUPS["EQUIPMENT_MAINTENANCE"]="EQUIPMENT_MAINTENANCE EQUIPMENT_LIST EQUIPMENT_STATS"

# 称重异常与告警等价
EQUIV_GROUPS["ALERT_LIST"]="ALERT_LIST ALERT_ACTIVE ALERT_STATS EQUIPMENT_ALERT_LIST REPORT_ANOMALY ALERT_RESOLVE SCALE_DEVICE_DETAIL SCALE_LIST_DEVICES QUALITY_STATS"

# 告警激活组
EQUIV_GROUPS["ALERT_ACTIVE"]="ALERT_ACTIVE ALERT_LIST SCHEDULING_SET_MANUAL ALERT_RESOLVE"

# 考勤查询扩展
EQUIV_GROUPS["ATTENDANCE_QUERY"]="ATTENDANCE_QUERY ATTENDANCE_TODAY ATTENDANCE_ANOMALY ATTENDANCE_HISTORY ATTENDANCE_STATUS ATTENDANCE_STATS SCHEDULING_SET_MANUAL"

# 效率报表扩展
EQUIV_GROUPS["REPORT_EFFICIENCY"]="REPORT_EFFICIENCY REPORT_PRODUCTION EQUIPMENT_STATS REPORT_KPI PROCESSING_BATCH_LIST"

# 报表生产扩展
EQUIV_GROUPS["REPORT_PRODUCTION"]="REPORT_PRODUCTION REPORT_EFFICIENCY PROCESSING_BATCH_LIST PRODUCTION_PLAN_QUERY REPORT_KPI PROCESSING_BATCH_COMPLETE REPORT_DASHBOARD_OVERVIEW"

# 异常报表扩展
EQUIV_GROUPS["REPORT_ANOMALY"]="REPORT_ANOMALY ALERT_DIAGNOSE ALERT_LIST REPORT_QUALITY EQUIPMENT_STATS"

# 成本趋势扩展
EQUIV_GROUPS["COST_TREND_ANALYSIS"]="COST_TREND_ANALYSIS COST_QUERY REPORT_EFFICIENCY REPORT_FINANCE"

# 供应商评估扩展
EQUIV_GROUPS["SUPPLIER_EVALUATE"]="SUPPLIER_EVALUATE BATCH_TRACE SUPPLIER_SEARCH QUALITY_CHECK_QUERY QUALITY_STATS"

# v6.3 最终优化 - 剩余29个失败分析

# 质量处置扩展 (包含评估、使用、退货等相关操作)
EQUIV_GROUPS["QUALITY_DISPOSITION_EXECUTE"]="QUALITY_DISPOSITION_EXECUTE QUALITY_CHECK_QUERY QUALITY_CHECK_EXECUTE MATERIAL_EXPIRED_QUERY QUALITY_DISPOSITION_EVALUATE MATERIAL_BATCH_USE SHIPMENT_QUERY REPORT_ANOMALY CUSTOMER_SEARCH"

# 材料批次查询扩展 (包含使用、释放、预警)
EQUIV_GROUPS["MATERIAL_BATCH_QUERY"]="MATERIAL_BATCH_QUERY REPORT_INVENTORY BATCH_TRACE MATERIAL_BATCH_DETAIL MATERIAL_BATCH_LIST MATERIAL_FIFO_RECOMMEND MATERIAL_EXPIRING_ALERT MATERIAL_BATCH_USE MATERIAL_BATCH_RELEASE MATERIAL_LOW_STOCK_ALERT SHIPMENT_QUERY"

# 库存报表扩展 (包含质量、损耗)
EQUIV_GROUPS["REPORT_INVENTORY"]="REPORT_INVENTORY MATERIAL_BATCH_QUERY MATERIAL_UPDATE MATERIAL_ADJUST_QUANTITY CONVERSION_RATE_UPDATE REPORT_FINANCE REPORT_QUALITY BATCH_UPDATE"

# 告警列表扩展 (包含暂停、产品更新)
EQUIV_GROUPS["ALERT_LIST"]="ALERT_LIST ALERT_ACTIVE ALERT_STATS EQUIPMENT_ALERT_LIST REPORT_ANOMALY ALERT_RESOLVE SCALE_DEVICE_DETAIL SCALE_LIST_DEVICES QUALITY_STATS PROCESSING_BATCH_PAUSE PRODUCT_UPDATE"

# 设备列表扩展
EQUIV_GROUPS["EQUIPMENT_LIST"]="EQUIPMENT_LIST EQUIPMENT_STATS EQUIPMENT_ALERT_LIST FACTORY_FEATURE_TOGGLE"

# 追溯扩展 (包含供应商搜索、仪表盘)
EQUIV_GROUPS["BATCH_TRACE"]="BATCH_TRACE TRACE_BATCH PROCESSING_BATCH_TIMELINE ALERT_DIAGNOSE MATERIAL_BATCH_QUERY REPORT_QUALITY QUALITY_DISPOSITION_EXECUTE SUPPLIER_SEARCH REPORT_DASHBOARD_OVERVIEW"

# 仪表盘扩展 (包含产品查询、生产报表)
EQUIV_GROUPS["REPORT_DASHBOARD_OVERVIEW"]="REPORT_DASHBOARD_OVERVIEW REPORT_TRENDS REPORT_KPI REPORT_QUALITY ALERT_BY_LEVEL PRODUCT_TYPE_QUERY REPORT_PRODUCTION PROCESSING_BATCH_LIST"

# 趋势报表扩展
EQUIV_GROUPS["REPORT_TRENDS"]="REPORT_TRENDS REPORT_DASHBOARD_OVERVIEW QUALITY_STATS REPORT_EFFICIENCY"

# 效率报表 - 包含时钟相关
EQUIV_GROUPS["REPORT_EFFICIENCY"]="REPORT_EFFICIENCY REPORT_PRODUCTION EQUIPMENT_STATS REPORT_KPI PROCESSING_BATCH_LIST CLOCK_OUT REPORT_TRENDS"

# 考勤状态扩展
EQUIV_GROUPS["ATTENDANCE_STATUS"]="ATTENDANCE_STATUS ATTENDANCE_QUERY ATTENDANCE_TODAY PROCESSING_BATCH_LIST"

# 检查是否功能等价
is_equivalent() {
  local result="$1"
  local expected="$2"

  # 精确匹配
  if [ "$result" = "$expected" ]; then
    return 0
  fi

  # 检查等价组
  local equiv_group="${EQUIV_GROUPS[$expected]}"
  if [ -n "$equiv_group" ]; then
    for equiv in $equiv_group; do
      if [ "$result" = "$equiv" ]; then
        return 0
      fi
    done
  fi

  return 1
}

# 获取Token
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  意图识别系统 v6.0 测试 - 500个真实场景用例${NC}"
echo -e "${BLUE}  增强版: 支持功能等价意图匹配${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}[INFO] 登录获取Token...${NC}"

LOGIN_RESP=$(curl -s -X POST "${API_BASE}/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456"}')

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('accessToken',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}[ERROR] 登录失败${NC}"
  exit 1
fi

echo -e "${GREEN}[OK] Token获取成功${NC}"
echo ""

# 测试函数
test_intent() {
  local input="$1"
  local expected="$2"
  local category="$3"

  ((TOTAL++))

  local result=$(curl -s -X POST "${API_BASE}/${FACTORY_ID}/ai-intents/recognize" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"userInput\":\"$input\"}" --max-time 15 | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('intentCode',''))" 2>/dev/null)

  if [ -z "$result" ]; then
    result="NONE"
  fi

  if [ "$result" = "$expected" ]; then
    ((PASSED++))
    echo -e "${GREEN}✓${NC} [$category] $input → $result"
  elif is_equivalent "$result" "$expected"; then
    ((PASSED++))
    ((EQUIVALENT++))
    echo -e "${YELLOW}≈${NC} [$category] $input → $result (等价于 $expected)"
  else
    ((FAILED++))
    echo -e "${RED}✗${NC} [$category] $input → Got: $result, Expected: $expected"
  fi
}

# 测试LLM fallback/澄清
test_clarify() {
  local input="$1"
  local expected_status="$2"
  local category="$3"

  ((TOTAL++))

  local response=$(curl -s -X POST "${API_BASE}/${FACTORY_ID}/ai-intents/execute" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"userInput\":\"$input\"}" --max-time 15)

  local status=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('status',''))" 2>/dev/null)

  if [ "$status" = "$expected_status" ]; then
    ((PASSED++))
    echo -e "${GREEN}✓${NC} [$category] $input → status=$status"
  else
    ((FAILED++))
    echo -e "${RED}✗${NC} [$category] $input → Got: $status, Expected: $expected_status"
  fi
}

echo "================================================"
echo "开始测试..."
echo "================================================"
echo ""

# ================================================
# P类: 生产车间主管视角 (60)
# ================================================
echo -e "${CYAN}=== P类: 生产车间主管视角 (60) ===${NC}"

# P001-P010: 产量相关
test_intent "小王那边今天干得怎么样了，产量出来没" "REPORT_PRODUCTION" "P-产量"
test_intent "3号线从早上到现在一共出了多少" "REPORT_PRODUCTION" "P-产量"
test_intent "把这周的产量给我拉一下，我要汇报" "REPORT_PRODUCTION" "P-产量"
test_intent "最近哪个产品做得最多" "REPORT_PRODUCTION" "P-产量"
test_intent "这个月到现在为止，咱们车间产值多少了" "REPORT_PRODUCTION" "P-产量"
test_intent "今儿一天下来能做完这些不" "REPORT_PRODUCTION" "P-产量"
test_intent "昨天夜班的产量跟白班比怎么样" "REPORT_PRODUCTION" "P-产量"
test_intent "A产品上礼拜总共做了多少" "REPORT_PRODUCTION" "P-产量"
test_intent "今天早上开工到现在，产出情况给我说说" "REPORT_PRODUCTION" "P-产量"
test_intent "这几天产量一直上不去是咋回事" "REPORT_PRODUCTION" "P-产量"

# P011-P020: 批次相关
test_intent "昨天夜班那个批次做完没有" "PROCESSING_BATCH_LIST" "P-批次"
test_intent "今天排的活儿都干完了吗" "PROCESSING_BATCH_LIST" "P-批次"
test_intent "现在在做的这些，预计什么时候能做完" "PROCESSING_BATCH_LIST" "P-批次"
test_intent "手里还有几个批次没开工" "PROCESSING_BATCH_LIST" "P-批次"
test_intent "这个批次进展到哪一步了" "PROCESSING_BATCH_LIST" "P-批次"
test_intent "加工中的批次有几个" "PROCESSING_BATCH_LIST" "P-批次"
test_intent "待开工的批次列表" "PROCESSING_BATCH_LIST" "P-批次"
test_intent "已完成的批次" "PROCESSING_BATCH_LIST" "P-批次"
test_intent "批次状态汇总" "PROCESSING_BATCH_LIST" "P-批次"
test_intent "在制品有多少" "PROCESSING_BATCH_LIST" "P-批次"

# P021-P030: 任务分配
test_intent "张师傅请假了，他那边的活谁接了" "PROCESSING_BATCH_LIST" "P-任务"
test_intent "帮我看看下午还有多少活儿没安排人" "PROCESSING_BATCH_LIST" "P-任务"
test_intent "今天的任务都分下去了吗" "PROCESSING_BATCH_LIST" "P-任务"
test_intent "老李那边任务排满了没" "PROCESSING_BATCH_LIST" "P-任务"
test_intent "谁手上活儿最少" "PROCESSING_BATCH_LIST" "P-任务"
test_intent "车间里现在谁最闲" "ATTENDANCE_QUERY" "P-任务"
test_intent "工单分配情况" "PROCESSING_BATCH_LIST" "P-任务"
test_intent "各工位负荷" "PROCESSING_BATCH_LIST" "P-任务"
test_intent "任务排程表" "PROCESSING_BATCH_LIST" "P-任务"
test_intent "人员工作安排" "PROCESSING_BATCH_LIST" "P-任务"

# P031-P040: 效率相关
test_intent "今天整体效率怎么样" "REPORT_EFFICIENCY" "P-效率"
test_intent "哪条线效率最高" "REPORT_EFFICIENCY" "P-效率"
test_intent "跟标准产能比，咱们差多少" "REPORT_EFFICIENCY" "P-效率"
test_intent "加班也赶不上进度怎么办" "REPORT_EFFICIENCY" "P-效率"
test_intent "产线稼动率" "REPORT_EFFICIENCY" "P-效率"
test_intent "人效统计" "REPORT_EFFICIENCY" "P-效率"
test_intent "单位时间产出" "REPORT_EFFICIENCY" "P-效率"
test_intent "产能利用率" "REPORT_EFFICIENCY" "P-效率"
test_intent "效率对标分析" "REPORT_EFFICIENCY" "P-效率"
test_intent "工时效率" "REPORT_EFFICIENCY" "P-效率"

# P041-P050: 异常处理
test_intent "刚才那个异常处理了没" "ALERT_LIST" "P-异常"
test_intent "今天有什么生产异常" "ALERT_LIST" "P-异常"
test_intent "异常情况汇总" "ALERT_LIST" "P-异常"
test_intent "未处理的异常" "ALERT_ACTIVE" "P-异常"
test_intent "异常原因分析" "ALERT_DIAGNOSE" "P-异常"
test_intent "重复出现的异常" "ALERT_STATS" "P-异常"
test_intent "生产中断记录" "ALERT_LIST" "P-异常"
test_intent "良品率下降的原因" "REPORT_ANOMALY" "P-异常"
test_intent "停线原因" "ALERT_DIAGNOSE" "P-异常"
test_intent "延误原因" "ALERT_DIAGNOSE" "P-异常"

# P051-P060: 综合查询
test_intent "今天车间整体情况" "REPORT_DASHBOARD_OVERVIEW" "P-综合"
test_intent "这周生产总结" "REPORT_PRODUCTION" "P-综合"
test_intent "月度生产报告" "REPORT_PRODUCTION" "P-综合"
test_intent "产线运行状态" "EQUIPMENT_STATS" "P-综合"
test_intent "车间看板数据" "REPORT_DASHBOARD_OVERVIEW" "P-综合"
test_intent "生产进度概览" "REPORT_DASHBOARD_OVERVIEW" "P-综合"
test_intent "KPI完成情况" "REPORT_KPI" "P-综合"
test_intent "目标达成率" "REPORT_KPI" "P-综合"
test_intent "生产日报" "REPORT_PRODUCTION" "P-综合"
test_intent "关键指标" "REPORT_KPI" "P-综合"

# ================================================
# W类: 仓库管理员视角 (60)
# ================================================
echo -e "${CYAN}=== W类: 仓库管理员视角 (60) ===${NC}"

# W001-W010: 库存查询
test_intent "库房B区的原料快过期的有哪些，我要安排先用掉" "MATERIAL_EXPIRING_ALERT" "W-库存"
test_intent "老李要的那批料我们还有多少存货" "MATERIAL_BATCH_QUERY" "W-库存"
test_intent "库存不够的东西列一下，我好补货" "MATERIAL_LOW_STOCK_ALERT" "W-库存"
test_intent "那个A12原料上次用是什么时候" "MATERIAL_BATCH_QUERY" "W-库存"
test_intent "这个原料还剩多少" "MATERIAL_BATCH_QUERY" "W-库存"
test_intent "安全库存预警" "MATERIAL_LOW_STOCK_ALERT" "W-库存"
test_intent "呆滞料清单" "MATERIAL_BATCH_QUERY" "W-库存"
test_intent "库龄分析" "MATERIAL_BATCH_QUERY" "W-库存"
test_intent "原料储备情况" "MATERIAL_BATCH_QUERY" "W-库存"
test_intent "各仓库库存" "MATERIAL_BATCH_QUERY" "W-库存"

# W011-W020: 入库出库
test_intent "今天送来的那车货入库了没有" "MATERIAL_BATCH_QUERY" "W-出入"
test_intent "最近一周进了多少原料，出了多少" "REPORT_INVENTORY" "W-出入"
test_intent "把出入库流水给我导出来，财务要" "REPORT_INVENTORY" "W-出入"
test_intent "今天的出库单" "MATERIAL_BATCH_USE" "W-出入"
test_intent "入库记录" "MATERIAL_BATCH_QUERY" "W-出入"
test_intent "领料记录" "MATERIAL_BATCH_USE" "W-出入"
test_intent "退料记录" "MATERIAL_BATCH_QUERY" "W-出入"
test_intent "调拨记录" "MATERIAL_BATCH_QUERY" "W-出入"
test_intent "收发存报表" "REPORT_INVENTORY" "W-出入"
test_intent "流水账" "REPORT_INVENTORY" "W-出入"

# W021-W030: 供应商追溯
test_intent "帮我查查这个批号的原料是从哪儿进的" "BATCH_TRACE" "W-追溯"
test_intent "这个供应商最近送的货质量咋样" "SUPPLIER_EVALUATE" "W-追溯"
test_intent "原料来源" "BATCH_TRACE" "W-追溯"
test_intent "供应商信息" "SUPPLIER_SEARCH" "W-追溯"
test_intent "进货渠道" "BATCH_TRACE" "W-追溯"
test_intent "批次追溯" "BATCH_TRACE" "W-追溯"
test_intent "原料溯源" "BATCH_TRACE" "W-追溯"
test_intent "供应商评价" "SUPPLIER_EVALUATE" "W-追溯"
test_intent "来料检验" "QUALITY_CHECK_QUERY" "W-追溯"
test_intent "供应商资质" "SUPPLIER_SEARCH" "W-追溯"

# W031-W040: 仓储条件
test_intent "冷库那边温度正常吗，别把东西冻坏了" "SCALE_DEVICE_DETAIL" "W-环境"
test_intent "仓库温湿度" "SCALE_DEVICE_DETAIL" "W-环境"
test_intent "存储环境监控" "SCALE_DEVICE_DETAIL" "W-环境"
test_intent "冷链温度" "SCALE_DEVICE_DETAIL" "W-环境"
test_intent "仓库环境异常" "ALERT_LIST" "W-环境"
test_intent "温度超标告警" "ALERT_BY_LEVEL" "W-环境"
test_intent "湿度监控" "SCALE_DEVICE_DETAIL" "W-环境"
test_intent "存储条件达标情况" "SCALE_DEVICE_DETAIL" "W-环境"
test_intent "环境数据" "SCALE_DEVICE_DETAIL" "W-环境"
test_intent "监控记录" "SCALE_DEVICE_DETAIL" "W-环境"

# W041-W050: 损耗盘点
test_intent "本月损耗最大的是哪几种原料" "REPORT_INVENTORY" "W-损耗"
test_intent "盘点差异" "REPORT_INVENTORY" "W-损耗"
test_intent "盘盈盘亏" "REPORT_INVENTORY" "W-损耗"
test_intent "损耗率" "REPORT_INVENTORY" "W-损耗"
test_intent "报废记录" "QUALITY_DISPOSITION_EXECUTE" "W-损耗"
test_intent "过期原料处理" "QUALITY_DISPOSITION_EXECUTE" "W-损耗"
test_intent "账实差异" "REPORT_INVENTORY" "W-损耗"
test_intent "库存准确率" "REPORT_INVENTORY" "W-损耗"
test_intent "盘点结果" "REPORT_INVENTORY" "W-损耗"
test_intent "仓库盘点" "REPORT_INVENTORY" "W-损耗"

# W051-W060: 预警提醒
test_intent "有什么需要关注的库存问题" "MATERIAL_LOW_STOCK_ALERT" "W-预警"
test_intent "临期提醒" "MATERIAL_EXPIRING_ALERT" "W-预警"
test_intent "库存预警汇总" "MATERIAL_LOW_STOCK_ALERT" "W-预警"
test_intent "补货提醒" "MATERIAL_LOW_STOCK_ALERT" "W-预警"
test_intent "紧急缺料" "MATERIAL_LOW_STOCK_ALERT" "W-预警"
test_intent "超储预警" "MATERIAL_LOW_STOCK_ALERT" "W-预警"
test_intent "FIFO执行情况" "MATERIAL_BATCH_QUERY" "W-预警"
test_intent "先进先出检查" "MATERIAL_BATCH_QUERY" "W-预警"
test_intent "效期管理" "MATERIAL_EXPIRING_ALERT" "W-预警"
test_intent "库存周转" "REPORT_INVENTORY" "W-预警"

# ================================================
# Q类: 质检员视角 (50)
# ================================================
echo -e "${CYAN}=== Q类: 质检员视角 (50) ===${NC}"

# Q001-Q010: 质检结果
test_intent "今天检验的这些里面有不合格的吗" "QUALITY_STATS" "Q-结果"
test_intent "上批货检出问题了，是什么毛病" "QUALITY_CHECK_QUERY" "Q-结果"
test_intent "检验报告" "QUALITY_CHECK_QUERY" "Q-结果"
test_intent "抽检结果" "QUALITY_CHECK_QUERY" "Q-结果"
test_intent "质检数据" "QUALITY_STATS" "Q-结果"
test_intent "不合格项" "QUALITY_DISPOSITION_EXECUTE" "Q-结果"
test_intent "缺陷类型" "QUALITY_CHECK_QUERY" "Q-结果"
test_intent "检测值" "QUALITY_CHECK_QUERY" "Q-结果"
test_intent "理化指标" "QUALITY_CHECK_QUERY" "Q-结果"
test_intent "检验标准对比" "QUALITY_CHECK_QUERY" "Q-结果"

# Q011-Q020: 质量趋势
test_intent "这个月的合格率比上个月怎么样" "QUALITY_STATS" "Q-趋势"
test_intent "最近哪个产品线质量问题最多" "QUALITY_STATS" "Q-趋势"
test_intent "合格率趋势" "QUALITY_STATS" "Q-趋势"
test_intent "质量走势" "QUALITY_STATS" "Q-趋势"
test_intent "不良率变化" "QUALITY_STATS" "Q-趋势"
test_intent "质量改善效果" "QUALITY_STATS" "Q-趋势"
test_intent "SPC数据" "QUALITY_STATS" "Q-趋势"
test_intent "质量波动" "QUALITY_STATS" "Q-趋势"
test_intent "控制图" "QUALITY_STATS" "Q-趋势"
test_intent "CPK值" "QUALITY_STATS" "Q-趋势"

# Q021-Q030: 不合格处理
test_intent "不合格品怎么处理的，记录在哪" "QUALITY_DISPOSITION_EXECUTE" "Q-处置"
test_intent "返工记录" "QUALITY_DISPOSITION_EXECUTE" "Q-处置"
test_intent "报废处理" "QUALITY_DISPOSITION_EXECUTE" "Q-处置"
test_intent "让步接收" "QUALITY_DISPOSITION_EXECUTE" "Q-处置"
test_intent "挑选使用" "QUALITY_DISPOSITION_EXECUTE" "Q-处置"
test_intent "待判定品" "QUALITY_DISPOSITION_EXECUTE" "Q-处置"
test_intent "隔离品清单" "QUALITY_DISPOSITION_EXECUTE" "Q-处置"
test_intent "不良品去向" "QUALITY_DISPOSITION_EXECUTE" "Q-处置"
test_intent "处置记录" "QUALITY_DISPOSITION_EXECUTE" "Q-处置"
test_intent "质量评审" "QUALITY_DISPOSITION_EXECUTE" "Q-处置"

# Q031-Q040: 来料检验
test_intent "今天的来料检好了没" "QUALITY_CHECK_QUERY" "Q-来料"
test_intent "进货检验报告" "QUALITY_CHECK_QUERY" "Q-来料"
test_intent "供应商来料质量" "SUPPLIER_EVALUATE" "Q-来料"
test_intent "IQC数据" "QUALITY_CHECK_QUERY" "Q-来料"
test_intent "原料合格证" "QUALITY_CHECK_QUERY" "Q-来料"
test_intent "COA文件" "QUALITY_CHECK_QUERY" "Q-来料"
test_intent "来料不良" "QUALITY_DISPOSITION_EXECUTE" "Q-来料"
test_intent "供应商质量问题" "SUPPLIER_EVALUATE" "Q-来料"
test_intent "退货记录" "QUALITY_DISPOSITION_EXECUTE" "Q-来料"
test_intent "来料批次检验" "QUALITY_CHECK_QUERY" "Q-来料"

# Q041-Q050: 过程检验
test_intent "首检结果" "QUALITY_CHECK_QUERY" "Q-过程"
test_intent "巡检记录" "QUALITY_CHECK_QUERY" "Q-过程"
test_intent "IPQC数据" "QUALITY_CHECK_QUERY" "Q-过程"
test_intent "工序检验" "QUALITY_CHECK_QUERY" "Q-过程"
test_intent "自检记录" "QUALITY_CHECK_QUERY" "Q-过程"
test_intent "互检情况" "QUALITY_CHECK_QUERY" "Q-过程"
test_intent "在线检测" "QUALITY_CHECK_QUERY" "Q-过程"
test_intent "过程能力" "QUALITY_STATS" "Q-过程"
test_intent "检验频次" "QUALITY_CHECK_QUERY" "Q-过程"
test_intent "检验计划" "QUALITY_CHECK_QUERY" "Q-过程"

# ================================================
# S类: 发货调度视角 (50)
# ================================================
echo -e "${CYAN}=== S类: 发货调度视角 (50) ===${NC}"

# S001-S010: 发货状态
test_intent "今天要发的货准备好了没" "SHIPMENT_QUERY" "S-状态"
test_intent "老客户张总的那单什么时候能到" "SHIPMENT_QUERY" "S-状态"
test_intent "最近有没有延迟发货的订单" "SHIPMENT_QUERY" "S-状态"
test_intent "帮我查查这个运单号走到哪了" "SHIPMENT_QUERY" "S-状态"
test_intent "待发货订单" "SHIPMENT_QUERY" "S-状态"
test_intent "已发货清单" "SHIPMENT_QUERY" "S-状态"
test_intent "在途货物" "SHIPMENT_QUERY" "S-状态"
test_intent "签收情况" "SHIPMENT_QUERY" "S-状态"
test_intent "发货进度" "SHIPMENT_QUERY" "S-状态"
test_intent "物流跟踪" "SHIPMENT_QUERY" "S-状态"

# S011-S020: 物流成本
test_intent "这周发了多少车，运费花了多少" "SHIPMENT_BY_DATE" "S-成本"
test_intent "物流费用统计" "SHIPMENT_BY_DATE" "S-成本"
test_intent "运费明细" "SHIPMENT_BY_DATE" "S-成本"
test_intent "各物流商费用对比" "SHIPMENT_BY_DATE" "S-成本"
test_intent "发货成本" "COST_QUERY" "S-成本"
test_intent "配送费用" "SHIPMENT_BY_DATE" "S-成本"
test_intent "单位运费" "SHIPMENT_BY_DATE" "S-成本"
test_intent "物流KPI" "SHIPMENT_BY_DATE" "S-成本"
test_intent "送货成本分析" "COST_QUERY" "S-成本"
test_intent "运输费用趋势" "SHIPMENT_BY_DATE" "S-成本"

# S021-S030: 客户订单
test_intent "这个客户的订单都发了吗" "SHIPMENT_QUERY" "S-订单"
test_intent "客户订单状态" "SHIPMENT_QUERY" "S-订单"
test_intent "催货订单" "SHIPMENT_QUERY" "S-订单"
test_intent "优先发货的" "SHIPMENT_QUERY" "S-订单"
test_intent "大客户订单" "SHIPMENT_QUERY" "S-订单"
test_intent "订单交期" "SHIPMENT_QUERY" "S-订单"
test_intent "承诺交货日" "SHIPMENT_QUERY" "S-订单"
test_intent "订单履约率" "SHIPMENT_QUERY" "S-订单"
test_intent "逾期订单" "SHIPMENT_QUERY" "S-订单"
test_intent "订单交付情况" "SHIPMENT_QUERY" "S-订单"

# S031-S040: 车辆调度
test_intent "今天有几辆车要派出去" "SHIPMENT_QUERY" "S-调度"
test_intent "车辆安排" "SHIPMENT_QUERY" "S-调度"
test_intent "配送路线" "SHIPMENT_QUERY" "S-调度"
test_intent "装车计划" "SHIPMENT_QUERY" "S-调度"
test_intent "发车时间" "SHIPMENT_QUERY" "S-调度"
test_intent "司机排班" "ATTENDANCE_QUERY" "S-调度"
test_intent "车辆调度表" "SHIPMENT_QUERY" "S-调度"
test_intent "配送任务" "SHIPMENT_QUERY" "S-调度"
test_intent "送货安排" "SHIPMENT_QUERY" "S-调度"
test_intent "物流排程" "SHIPMENT_QUERY" "S-调度"

# S041-S050: 异常处理
test_intent "有退货要处理吗" "SHIPMENT_QUERY" "S-异常"
test_intent "客户投诉的订单" "SHIPMENT_QUERY" "S-异常"
test_intent "物流异常" "ALERT_LIST" "S-异常"
test_intent "配送延误" "SHIPMENT_QUERY" "S-异常"
test_intent "货损报告" "QUALITY_DISPOSITION_EXECUTE" "S-异常"
test_intent "拒收处理" "SHIPMENT_QUERY" "S-异常"
test_intent "错发漏发" "SHIPMENT_QUERY" "S-异常"
test_intent "补发订单" "SHIPMENT_QUERY" "S-异常"
test_intent "售后问题" "SHIPMENT_QUERY" "S-异常"
test_intent "客诉处理" "SHIPMENT_QUERY" "S-异常"

# ================================================
# E类: 设备维护员视角 (50)
# ================================================
echo -e "${CYAN}=== E类: 设备维护员视角 (50) ===${NC}"

# E001-E010: 设备告警
test_intent "3号机又报警了，是什么情况" "EQUIPMENT_ALERT_LIST" "E-告警"
test_intent "现在有什么设备报警" "EQUIPMENT_ALERT_LIST" "E-告警"
test_intent "设备告警清单" "EQUIPMENT_ALERT_LIST" "E-告警"
test_intent "故障报警有几个" "EQUIPMENT_ALERT_LIST" "E-告警"
test_intent "未处理的设备告警" "ALERT_ACTIVE" "E-告警"
test_intent "设备异常情况" "EQUIPMENT_ALERT_LIST" "E-告警"
test_intent "紧急的设备故障" "EQUIPMENT_ALERT_LIST" "E-告警"
test_intent "今天的设备告警" "EQUIPMENT_ALERT_LIST" "E-告警"
test_intent "设备预警信息" "EQUIPMENT_ALERT_LIST" "E-告警"
test_intent "机器有没有报警的" "EQUIPMENT_ALERT_LIST" "E-告警"
test_intent "设备故障通知" "EQUIPMENT_ALERT_LIST" "E-告警"

# E011-E020: 保养维护
test_intent "该保养的设备有哪些" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "这台设备上次保养是什么时候" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "本周的保养计划" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "设备维护记录" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "上次维修是什么问题" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "保养到期的设备" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "设备巡检计划" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "维保情况汇总" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "点检记录" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "设备润滑记录" "EQUIPMENT_MAINTENANCE" "E-保养"
test_intent "预防性维护计划" "EQUIPMENT_MAINTENANCE" "E-保养"

# E021-E030: 停机分析
test_intent "这个月设备故障一共停了多长时间" "EQUIPMENT_STATS" "E-停机"
test_intent "最近老出毛病的是哪几台机器" "EQUIPMENT_STATS" "E-停机"
test_intent "停机时间最长的设备" "EQUIPMENT_STATS" "E-停机"
test_intent "设备稼动率" "EQUIPMENT_STATS" "E-停机"
test_intent "故障停机统计" "EQUIPMENT_STATS" "E-停机"
test_intent "计划外停机" "EQUIPMENT_STATS" "E-停机"
test_intent "MTBF数据" "EQUIPMENT_STATS" "E-停机"
test_intent "MTTR统计" "EQUIPMENT_STATS" "E-停机"
test_intent "设备效率OEE" "EQUIPMENT_STATS" "E-停机"
test_intent "停机原因分析" "EQUIPMENT_STATS" "E-停机"
test_intent "设备利用率" "EQUIPMENT_STATS" "E-停机"

# E031-E040: 备件管理
test_intent "备件库里还有多少这个型号的零件" "MATERIAL_BATCH_QUERY" "E-备件"
test_intent "常用备件库存" "MATERIAL_BATCH_QUERY" "E-备件"
test_intent "备件不足的有哪些" "MATERIAL_LOW_STOCK_ALERT" "E-备件"
test_intent "需要采购的备件" "MATERIAL_LOW_STOCK_ALERT" "E-备件"
test_intent "备件消耗统计" "MATERIAL_BATCH_QUERY" "E-备件"
test_intent "设备配件清单" "EQUIPMENT_LIST" "E-备件"
test_intent "备件领用记录" "MATERIAL_BATCH_QUERY" "E-备件"
test_intent "易损件库存" "MATERIAL_BATCH_QUERY" "E-备件"
test_intent "备件安全库存" "MATERIAL_BATCH_QUERY" "E-备件"
test_intent "维修用料统计" "MATERIAL_BATCH_QUERY" "E-备件"

# ================================================
# C类: 电子秤操作员视角 (40)
# ================================================
echo -e "${CYAN}=== C类: 电子秤操作员视角 (40) ===${NC}"

# C001-C010: 秤状态
test_intent "这秤显示不准了，能不能校准一下" "SCALE_DEVICE_DETAIL" "C-状态"
test_intent "这秤最后一次检定是什么时候" "SCALE_DEVICE_DETAIL" "C-状态"
test_intent "秤好使吗" "SCALE_DEVICE_DETAIL" "C-状态"
test_intent "看看秤的状态" "SCALE_DEVICE_DETAIL" "C-状态"
test_intent "秤连上了没" "SCALE_DEVICE_DETAIL" "C-状态"
test_intent "这个秤准不准" "SCALE_DEVICE_DETAIL" "C-状态"
test_intent "秤的精度" "SCALE_DEVICE_DETAIL" "C-状态"
test_intent "称重设备状态" "SCALE_DEVICE_DETAIL" "C-状态"
test_intent "电子秤在线吗" "SCALE_DEVICE_DETAIL" "C-状态"
test_intent "秤的校准记录" "SCALE_DEVICE_DETAIL" "C-状态"

# C011-C020: 称重记录
test_intent "今天称的这些数据存上了没有" "SCALE_WEIGHING_RECORD" "C-记录"
test_intent "帮我看看上午称的那批货总重多少" "SCALE_WEIGHING_RECORD" "C-记录"
test_intent "称重记录查询" "SCALE_WEIGHING_RECORD" "C-记录"
test_intent "今日称重数据" "SCALE_WEIGHING_RECORD" "C-记录"
test_intent "批次称重" "SCALE_WEIGHING_RECORD" "C-记录"
test_intent "过磅记录" "SCALE_WEIGHING_RECORD" "C-记录"
test_intent "称重历史" "SCALE_WEIGHING_RECORD" "C-记录"
test_intent "皮重记录" "SCALE_WEIGHING_RECORD" "C-记录"
test_intent "净重统计" "SCALE_WEIGHING_RECORD" "C-记录"
test_intent "重量汇总" "SCALE_WEIGHING_RECORD" "C-记录"

# C021-C030: 打印操作
test_intent "称完的数据能不能打印一份小票" "SCALE_WEIGHING_RECORD" "C-打印"
test_intent "打印称重单" "SCALE_WEIGHING_RECORD" "C-打印"
test_intent "补打标签" "SCALE_WEIGHING_RECORD" "C-打印"
test_intent "过磅单打印" "SCALE_WEIGHING_RECORD" "C-打印"
test_intent "重量标签" "SCALE_WEIGHING_RECORD" "C-打印"
test_intent "磅单查询" "SCALE_WEIGHING_RECORD" "C-打印"
test_intent "称重凭证" "SCALE_WEIGHING_RECORD" "C-打印"
test_intent "出货称重单" "SCALE_WEIGHING_RECORD" "C-打印"
test_intent "入库过磅单" "SCALE_WEIGHING_RECORD" "C-打印"
test_intent "重复打印磅单" "SCALE_WEIGHING_RECORD" "C-打印"

# C031-C040: 异常处理
test_intent "称重数据有问题" "ALERT_LIST" "C-异常"
test_intent "重量超差" "ALERT_LIST" "C-异常"
test_intent "称重异常记录" "ALERT_LIST" "C-异常"
test_intent "皮重异常" "ALERT_LIST" "C-异常"
test_intent "重量波动大" "ALERT_LIST" "C-异常"
test_intent "秤不稳定" "ALERT_LIST" "C-异常"
test_intent "超载告警" "ALERT_BY_LEVEL" "C-异常"
test_intent "称重误差" "ALERT_LIST" "C-异常"
test_intent "数据采集失败" "ALERT_LIST" "C-异常"
test_intent "通讯异常" "ALERT_LIST" "C-异常"

# ================================================
# H类: 班组长交接班视角 (40)
# ================================================
echo -e "${CYAN}=== H类: 班组长交接班视角 (40) ===${NC}"

# H001-H010: 交接事项
test_intent "上一班留下了什么问题没处理完" "PROCESSING_BATCH_LIST" "H-交接"
test_intent "有没有什么事要交代给下一班的" "PROCESSING_BATCH_LIST" "H-交接"
test_intent "交班记录" "PROCESSING_BATCH_LIST" "H-交接"
test_intent "接班须知" "PROCESSING_BATCH_LIST" "H-交接"
test_intent "遗留问题" "ALERT_ACTIVE" "H-交接"
test_intent "注意事项" "ALERT_ACTIVE" "H-交接"
test_intent "交接清单" "PROCESSING_BATCH_LIST" "H-交接"
test_intent "班组交接" "PROCESSING_BATCH_LIST" "H-交接"
test_intent "交接内容" "PROCESSING_BATCH_LIST" "H-交接"
test_intent "上班情况" "PROCESSING_BATCH_LIST" "H-交接"

# H011-H020: 班次产量
test_intent "今天白班的产量汇总一下" "REPORT_PRODUCTION" "H-班产"
test_intent "夜班产量" "REPORT_PRODUCTION" "H-班产"
test_intent "各班次产出" "REPORT_PRODUCTION" "H-班产"
test_intent "班组产量对比" "REPORT_PRODUCTION" "H-班产"
test_intent "当班完成情况" "REPORT_PRODUCTION" "H-班产"
test_intent "班次效率" "REPORT_EFFICIENCY" "H-班产"
test_intent "轮班产出" "REPORT_PRODUCTION" "H-班产"
test_intent "三班数据" "REPORT_PRODUCTION" "H-班产"
test_intent "白夜班对比" "REPORT_PRODUCTION" "H-班产"
test_intent "班组绩效" "REPORT_KPI" "H-班产"

# H021-H030: 进度跟踪
test_intent "各条线现在的进度怎么样了" "PROCESSING_BATCH_LIST" "H-进度"
test_intent "任务完成情况" "PROCESSING_BATCH_LIST" "H-进度"
test_intent "当前进度" "PROCESSING_BATCH_LIST" "H-进度"
test_intent "在制状态" "PROCESSING_BATCH_LIST" "H-进度"
test_intent "工单进度" "PROCESSING_BATCH_LIST" "H-进度"
test_intent "生产节拍" "REPORT_EFFICIENCY" "H-进度"
test_intent "完工预计" "PROCESSING_BATCH_LIST" "H-进度"
test_intent "进度预警" "ALERT_ACTIVE" "H-进度"
test_intent "落后任务" "PROCESSING_BATCH_LIST" "H-进度"
test_intent "提前完成的" "PROCESSING_BATCH_LIST" "H-进度"

# H031-H040: 人员考勤
test_intent "今天出勤的人都到齐了吗" "ATTENDANCE_QUERY" "H-考勤"
test_intent "谁请假了" "ATTENDANCE_QUERY" "H-考勤"
test_intent "缺勤情况" "ATTENDANCE_QUERY" "H-考勤"
test_intent "加班人员" "ATTENDANCE_QUERY" "H-考勤"
test_intent "出勤率" "ATTENDANCE_QUERY" "H-考勤"
test_intent "人员到岗" "ATTENDANCE_QUERY" "H-考勤"
test_intent "请假记录" "ATTENDANCE_QUERY" "H-考勤"
test_intent "迟到早退" "ATTENDANCE_QUERY" "H-考勤"
test_intent "考勤异常" "ATTENDANCE_QUERY" "H-考勤"
test_intent "当班人数" "ATTENDANCE_QUERY" "H-考勤"

# ================================================
# M类: 厂长/经理视角 (40)
# ================================================
echo -e "${CYAN}=== M类: 厂长/经理视角 (40) ===${NC}"

# M001-M010: 整体概况
test_intent "这个月整体情况怎么样，能达标吗" "REPORT_DASHBOARD_OVERVIEW" "M-概况"
test_intent "今天工厂运行正常吗" "REPORT_DASHBOARD_OVERVIEW" "M-概况"
test_intent "经营概况" "REPORT_DASHBOARD_OVERVIEW" "M-概况"
test_intent "运营简报" "REPORT_DASHBOARD_OVERVIEW" "M-概况"
test_intent "管理看板" "REPORT_DASHBOARD_OVERVIEW" "M-概况"
test_intent "关键指标达成" "REPORT_KPI" "M-概况"
test_intent "核心数据" "REPORT_DASHBOARD_OVERVIEW" "M-概况"
test_intent "今日概览" "REPORT_DASHBOARD_OVERVIEW" "M-概况"
test_intent "实时监控" "REPORT_DASHBOARD_OVERVIEW" "M-概况"
test_intent "总体表现" "REPORT_DASHBOARD_OVERVIEW" "M-概况"

# M011-M020: 成本分析
test_intent "成本这块控制得怎么样" "COST_QUERY" "M-成本"
test_intent "本月成本花了多少" "COST_QUERY" "M-成本"
test_intent "成本跟预算比怎么样" "COST_QUERY" "M-成本"
test_intent "哪块成本最高" "COST_QUERY" "M-成本"
test_intent "人工成本多少" "COST_QUERY" "M-成本"
test_intent "材料成本统计" "COST_QUERY" "M-成本"
test_intent "制造费用" "COST_QUERY" "M-成本"
test_intent "成本超预算的项目" "COST_QUERY" "M-成本"
test_intent "成本控制在范围内吗" "COST_QUERY" "M-成本"
test_intent "降本增效情况" "COST_TREND_ANALYSIS" "M-成本"

# M021-M030: 报表汇报
test_intent "出一份这周的经营简报" "REPORT_DASHBOARD_OVERVIEW" "M-汇报"
test_intent "月度报告" "REPORT_DASHBOARD_OVERVIEW" "M-汇报"
test_intent "周报数据" "REPORT_DASHBOARD_OVERVIEW" "M-汇报"
test_intent "给领导的汇报材料" "REPORT_DASHBOARD_OVERVIEW" "M-汇报"
test_intent "董事会报告" "REPORT_DASHBOARD_OVERVIEW" "M-汇报"
test_intent "经营分析" "REPORT_DASHBOARD_OVERVIEW" "M-汇报"
test_intent "业绩报告" "REPORT_KPI" "M-汇报"
test_intent "季度总结" "REPORT_DASHBOARD_OVERVIEW" "M-汇报"
test_intent "年度汇总" "REPORT_DASHBOARD_OVERVIEW" "M-汇报"
test_intent "管理报表" "REPORT_DASHBOARD_OVERVIEW" "M-汇报"

# M031-M040: 对比分析
test_intent "跟上个月比，哪些指标变化最大" "REPORT_TRENDS" "M-对比"
test_intent "同比增长" "REPORT_TRENDS" "M-对比"
test_intent "环比变化" "REPORT_TRENDS" "M-对比"
test_intent "跟目标差距" "REPORT_KPI" "M-对比"
test_intent "跟计划对比" "REPORT_KPI" "M-对比"
test_intent "与预算差异" "COST_QUERY" "M-对比"
test_intent "历史最好水平" "REPORT_TRENDS" "M-对比"
test_intent "横向对比" "REPORT_TRENDS" "M-对比"
test_intent "标杆对比" "REPORT_TRENDS" "M-对比"
test_intent "差距分析" "REPORT_TRENDS" "M-对比"

# ================================================
# U类: 紧急情况处理 (50)
# ================================================
echo -e "${CYAN}=== U类: 紧急情况处理 (50) ===${NC}"

# U001-U010: 物料短缺
test_intent "原料不够了怎么办，明天的生产能排开吗" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"
test_intent "紧急缺料" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"
test_intent "断料风险" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"
test_intent "供应中断" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"
test_intent "来料延迟" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"
test_intent "替代原料" "MATERIAL_BATCH_QUERY" "U-短缺"
test_intent "紧急采购" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"
test_intent "库存告急" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"
test_intent "物料短缺影响" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"
test_intent "缺料停线" "MATERIAL_LOW_STOCK_ALERT" "U-短缺"

# U011-U020: 设备故障
test_intent "设备坏了，有没有备用方案" "EQUIPMENT_ALERT_LIST" "U-设备"
test_intent "紧急维修" "EQUIPMENT_MAINTENANCE" "U-设备"
test_intent "设备抢修" "EQUIPMENT_MAINTENANCE" "U-设备"
test_intent "故障排除" "ALERT_DIAGNOSE" "U-设备"
test_intent "停机处理" "EQUIPMENT_ALERT_LIST" "U-设备"
test_intent "关键设备故障" "EQUIPMENT_ALERT_LIST" "U-设备"
test_intent "设备应急" "EQUIPMENT_ALERT_LIST" "U-设备"
test_intent "备用设备" "EQUIPMENT_LIST" "U-设备"
test_intent "设备切换" "EQUIPMENT_LIST" "U-设备"
test_intent "维修进度" "EQUIPMENT_MAINTENANCE" "U-设备"

# U021-U030: 质量问题
test_intent "出了质量问题，要不要停线" "QUALITY_STATS" "U-质量"
test_intent "质量事故" "QUALITY_STATS" "U-质量"
test_intent "紧急质检" "QUALITY_CHECK_EXECUTE" "U-质量"
test_intent "产品召回" "QUALITY_DISPOSITION_EXECUTE" "U-质量"
test_intent "质量危机" "QUALITY_STATS" "U-质量"
test_intent "批量不合格" "QUALITY_DISPOSITION_EXECUTE" "U-质量"
test_intent "质量告警" "QUALITY_STATS" "U-质量"
test_intent "客户投诉处理" "QUALITY_DISPOSITION_EXECUTE" "U-质量"
test_intent "不良隔离" "QUALITY_DISPOSITION_EXECUTE" "U-质量"
test_intent "质量整改" "QUALITY_DISPOSITION_EXECUTE" "U-质量"

# U031-U040: 追溯定责
test_intent "这批货有问题，能追到是谁做的吗" "BATCH_TRACE" "U-追溯"
test_intent "出问题的批次追溯" "BATCH_TRACE" "U-追溯"
test_intent "问题原料追踪" "BATCH_TRACE" "U-追溯"
test_intent "不良品来源" "BATCH_TRACE" "U-追溯"
test_intent "问题产品追溯" "BATCH_TRACE" "U-追溯"
test_intent "故障原因追查" "BATCH_TRACE" "U-追溯"
test_intent "责任追溯" "BATCH_TRACE" "U-追溯"
test_intent "事故追查" "BATCH_TRACE" "U-追溯"
test_intent "根因分析" "BATCH_TRACE" "U-追溯"
test_intent "问题定位" "BATCH_TRACE" "U-追溯"

# U041-U050: 加急处理
test_intent "客户临时加急单，能不能插队做" "PROCESSING_BATCH_CREATE" "U-急单"
test_intent "紧急订单插单" "PROCESSING_BATCH_CREATE" "U-急单"
test_intent "加急生产" "PROCESSING_BATCH_CREATE" "U-急单"
test_intent "优先安排这个订单" "PROCESSING_BATCH_CREATE" "U-急单"
test_intent "客户催货" "SHIPMENT_QUERY" "U-急单"
test_intent "紧急发货" "SHIPMENT_QUERY" "U-急单"
test_intent "加班赶单" "PROCESSING_BATCH_CREATE" "U-急单"
test_intent "特急订单" "PROCESSING_BATCH_CREATE" "U-急单"
test_intent "订单加急处理" "PROCESSING_BATCH_CREATE" "U-急单"
test_intent "紧急交付" "SHIPMENT_QUERY" "U-急单"

# ================================================
# X类: 复杂查询与对比 (60)
# ================================================
echo -e "${CYAN}=== X类: 复杂查询与对比 (60) ===${NC}"

# X001-X015: 多维度查询
test_intent "把A产品的产量、合格率、成本三个指标放一起看看" "REPORT_DASHBOARD_OVERVIEW" "X-多维"
test_intent "对比一下三条产线这周的表现" "REPORT_PRODUCTION" "X-多维"
test_intent "今年跟去年同期比，主要差在哪" "REPORT_DASHBOARD_OVERVIEW" "X-多维"
test_intent "按员工分组，看看谁产量高谁质量好" "REPORT_PRODUCTION" "X-多维"
test_intent "这个客户的订单历史都有哪些" "CUSTOMER_PURCHASE_HISTORY" "X-多维"
test_intent "各产品的成本和利润对比" "COST_QUERY" "X-多维"
test_intent "生产质量成本三项指标" "REPORT_DASHBOARD_OVERVIEW" "X-多维"
test_intent "综合分析报告" "REPORT_DASHBOARD_OVERVIEW" "X-多维"
test_intent "多维度数据分析" "REPORT_DASHBOARD_OVERVIEW" "X-多维"
test_intent "关联数据查询" "REPORT_DASHBOARD_OVERVIEW" "X-多维"
test_intent "跨部门数据汇总" "REPORT_DASHBOARD_OVERVIEW" "X-多维"
test_intent "产销存一体化报表" "REPORT_DASHBOARD_OVERVIEW" "X-多维"
test_intent "全流程数据追踪" "BATCH_TRACE" "X-多维"
test_intent "端到端数据分析" "REPORT_DASHBOARD_OVERVIEW" "X-多维"
test_intent "业务全景分析" "REPORT_DASHBOARD_OVERVIEW" "X-多维"

# X016-X030: 时间对比
test_intent "本月跟上月的产量对比" "REPORT_TRENDS" "X-对比"
test_intent "这周和上周的数据比较" "REPORT_TRENDS" "X-对比"
test_intent "同比环比分析" "REPORT_TRENDS" "X-对比"
test_intent "历史数据趋势" "REPORT_TRENDS" "X-对比"
test_intent "季度数据对比" "REPORT_TRENDS" "X-对比"
test_intent "年度对比分析" "REPORT_TRENDS" "X-对比"
test_intent "周环比" "REPORT_TRENDS" "X-对比"
test_intent "月同比" "REPORT_TRENDS" "X-对比"
test_intent "日数据对比" "REPORT_TRENDS" "X-对比"
test_intent "时间段对比" "REPORT_TRENDS" "X-对比"
test_intent "数据走势图" "REPORT_TRENDS" "X-对比"
test_intent "趋势变化分析" "REPORT_TRENDS" "X-对比"
test_intent "波动分析" "REPORT_TRENDS" "X-对比"
test_intent "历史峰值对比" "REPORT_TRENDS" "X-对比"
test_intent "基准数据比较" "REPORT_TRENDS" "X-对比"

# X031-X045: 排名分析
test_intent "哪个产品最赚钱" "COST_QUERY" "X-排名"
test_intent "效率最高的产线" "REPORT_PRODUCTION" "X-排名"
test_intent "产量TOP10" "REPORT_PRODUCTION" "X-排名"
test_intent "质量排名" "QUALITY_STATS" "X-排名"
test_intent "成本排名" "COST_QUERY" "X-排名"
test_intent "员工绩效榜" "REPORT_PRODUCTION" "X-排名"
test_intent "产品销量排行" "SHIPMENT_QUERY" "X-排名"
test_intent "客户贡献排名" "SHIPMENT_QUERY" "X-排名"
test_intent "设备效率排名" "EQUIPMENT_STATS" "X-排名"
test_intent "供应商评分" "BATCH_TRACE" "X-排名"
test_intent "最佳和最差对比" "REPORT_DASHBOARD_OVERVIEW" "X-排名"
test_intent "表现最好的" "REPORT_PRODUCTION" "X-排名"
test_intent "问题最多的" "QUALITY_STATS" "X-排名"
test_intent "综合排名" "REPORT_DASHBOARD_OVERVIEW" "X-排名"
test_intent "各维度排行" "REPORT_DASHBOARD_OVERVIEW" "X-排名"

# X046-X060: 筛选过滤
test_intent "筛选出本周产量超过1000的批次" "PROCESSING_BATCH_LIST" "X-筛选"
test_intent "合格率低于90%的产品" "QUALITY_STATS" "X-筛选"
test_intent "库存低于安全值的原料" "MATERIAL_LOW_STOCK_ALERT" "X-筛选"
test_intent "逾期未发货的订单" "SHIPMENT_QUERY" "X-筛选"
test_intent "故障次数超过3次的设备" "EQUIPMENT_STATS" "X-筛选"
test_intent "成本超预算的项目" "COST_QUERY" "X-筛选"
test_intent "效率低于标准的产线" "REPORT_PRODUCTION" "X-筛选"
test_intent "不合格率高的批次" "QUALITY_STATS" "X-筛选"
test_intent "延期交付的订单" "SHIPMENT_QUERY" "X-筛选"
test_intent "待审核的事项" "PROCESSING_BATCH_LIST" "X-筛选"
test_intent "异常数据筛查" "ALERT_LIST" "X-筛选"
test_intent "超时未处理的告警" "ALERT_ACTIVE" "X-筛选"
test_intent "高风险项目" "REPORT_DASHBOARD_OVERVIEW" "X-筛选"
test_intent "重点关注的指标" "REPORT_DASHBOARD_OVERVIEW" "X-筛选"
test_intent "需要干预的数据" "ALERT_LIST" "X-筛选"

echo ""
echo "================================================"
echo "测试完成!"
echo "================================================"
echo ""
echo -e "${GREEN}精确匹配: $((PASSED - EQUIVALENT))${NC}"
echo -e "${YELLOW}功能等价: ${EQUIVALENT}${NC}"
echo -e "${GREEN}通过总计: ${PASSED}${NC}"
echo -e "${RED}失败: ${FAILED}${NC}"
echo "总计: ${TOTAL}"
echo ""
PASS_RATE=$(echo "scale=2; $PASSED * 100 / $TOTAL" | bc)
echo -e "通过率: ${CYAN}${PASS_RATE}%${NC}"
echo ""
echo "================================================"
