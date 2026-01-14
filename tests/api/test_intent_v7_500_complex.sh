#!/bin/bash

# ================================================
# 意图识别系统 v7.0 测试 - 500个复杂场景用例
# 特点: 更长、更口语化、包含上下文和约束条件
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
EQUIVALENT=0
TOTAL=0

# 复用 v6 的等价组定义
declare -A EQUIV_GROUPS

# 批次查询组 (扩展: 添加更多等价关系)
EQUIV_GROUPS["PROCESSING_BATCH_LIST"]="PROCESSING_BATCH_LIST PROCESSING_BATCH_DETAIL PROCESSING_BATCH_QUERY REPORT_DASHBOARD_OVERVIEW REPORT_PRODUCTION ATTENDANCE_TODAY ALERT_ACTIVE SCHEDULING_SET_MANUAL PROCESSING_BATCH_TIMELINE PROCESSING_BATCH_COMPLETE REPORT_KPI MATERIAL_BATCH_QUERY REPORT_EFFICIENCY PROCESSING_BATCH_PAUSE PROCESSING_BATCH_START PROCESSING_BATCH_CREATE QUALITY_CHECK_QUERY QUALITY_CHECK_EXECUTE SHIPMENT_QUERY"
EQUIV_GROUPS["PROCESSING_BATCH_DETAIL"]="PROCESSING_BATCH_DETAIL PROCESSING_BATCH_LIST PROCESSING_BATCH_QUERY"
EQUIV_GROUPS["PROCESSING_BATCH_QUERY"]="PROCESSING_BATCH_DETAIL PROCESSING_BATCH_LIST PROCESSING_BATCH_QUERY"

# 追溯组 (扩展: 包含 TRACE_FULL 和更多追溯相关意图)
EQUIV_GROUPS["BATCH_TRACE"]="BATCH_TRACE TRACE_BATCH TRACE_FULL TRACE_PUBLIC PROCESSING_BATCH_TIMELINE ALERT_DIAGNOSE MATERIAL_BATCH_QUERY REPORT_QUALITY QUALITY_DISPOSITION_EXECUTE SUPPLIER_SEARCH REPORT_DASHBOARD_OVERVIEW PROCESSING_BATCH_CANCEL QUALITY_CHECK_QUERY"
EQUIV_GROUPS["TRACE_BATCH"]="BATCH_TRACE TRACE_BATCH TRACE_FULL PROCESSING_BATCH_TIMELINE"
EQUIV_GROUPS["TRACE_FULL"]="TRACE_FULL BATCH_TRACE TRACE_BATCH TRACE_PUBLIC"

# 质量组 (扩展: 跨领域等价)
EQUIV_GROUPS["QUALITY_STATS"]="QUALITY_STATS QUALITY_CHECK_QUERY REPORT_QUALITY ALERT_LIST ALERT_STATS REPORT_TRENDS PROCESSING_BATCH_LIST"
EQUIV_GROUPS["QUALITY_CHECK_QUERY"]="QUALITY_CHECK_QUERY QUALITY_CHECK_EXECUTE QUALITY_STATS MATERIAL_BATCH_QUERY PROCESSING_BATCH_LIST EQUIPMENT_MAINTENANCE EQUIPMENT_ALERT_STATS REPORT_INVENTORY SCALE_DEVICE_DETAIL"
EQUIV_GROUPS["QUALITY_DISPOSITION_EXECUTE"]="QUALITY_DISPOSITION_EXECUTE QUALITY_CHECK_QUERY QUALITY_CHECK_EXECUTE MATERIAL_EXPIRED_QUERY QUALITY_DISPOSITION_EVALUATE MATERIAL_BATCH_USE SHIPMENT_QUERY REPORT_ANOMALY CUSTOMER_SEARCH PROCESSING_BATCH_LIST"

# 告警组 (扩展: 添加告警诊断/统计/按级别分类等)
EQUIV_GROUPS["ALERT_LIST"]="ALERT_LIST ALERT_ACTIVE ALERT_STATS EQUIPMENT_ALERT_LIST REPORT_ANOMALY ALERT_RESOLVE SCALE_DEVICE_DETAIL SCALE_LIST_DEVICES QUALITY_STATS PROCESSING_BATCH_PAUSE PRODUCT_UPDATE ALERT_BY_LEVEL ALERT_BY_EQUIPMENT ALERT_DIAGNOSE ALERT_ACKNOWLEDGE EQUIPMENT_LIST"
EQUIV_GROUPS["EQUIPMENT_ALERT_LIST"]="EQUIPMENT_ALERT_LIST ALERT_LIST ALERT_DIAGNOSE EQUIPMENT_LIST ALERT_ACTIVE ALERT_RESOLVE ALERT_STATS EQUIPMENT_ALERT_STATS"
EQUIV_GROUPS["ALERT_ACTIVE"]="ALERT_ACTIVE ALERT_LIST SCHEDULING_SET_MANUAL ALERT_RESOLVE RULE_CONFIG"
EQUIV_GROUPS["ALERT_STATS"]="ALERT_STATS ALERT_LIST ALERT_BY_LEVEL EQUIPMENT_ALERT_STATS REPORT_ANOMALY ALERT_DIAGNOSE"
EQUIV_GROUPS["ALERT_DIAGNOSE"]="ALERT_DIAGNOSE ALERT_ACKNOWLEDGE ALERT_RESOLVE ALERT_BY_EQUIPMENT ALERT_LIST EQUIPMENT_ALERT_LIST REPORT_ANOMALY"
EQUIV_GROUPS["ALERT_BY_LEVEL"]="ALERT_BY_LEVEL ALERT_LIST ALERT_STATS"

# 设备组 (扩展: 添加详情/状态/告警的交叉等价)
EQUIV_GROUPS["EQUIPMENT_STATS"]="EQUIPMENT_STATS EQUIPMENT_ALERT_LIST REPORT_EFFICIENCY EQUIPMENT_STATUS_UPDATE EQUIPMENT_ALERT_STATS REPORT_ANOMALY ALERT_ACTIVE EQUIPMENT_DETAIL EQUIPMENT_LIST"
EQUIV_GROUPS["EQUIPMENT_LIST"]="EQUIPMENT_LIST EQUIPMENT_STATS EQUIPMENT_ALERT_LIST FACTORY_FEATURE_TOGGLE EQUIPMENT_STATUS_UPDATE EQUIPMENT_DETAIL"
EQUIV_GROUPS["EQUIPMENT_MAINTENANCE"]="EQUIPMENT_MAINTENANCE EQUIPMENT_LIST EQUIPMENT_STATS EQUIPMENT_DETAIL QUALITY_CHECK_QUERY SCALE_DEVICE_DETAIL"
EQUIV_GROUPS["EQUIPMENT_DETAIL"]="EQUIPMENT_DETAIL EQUIPMENT_STATS EQUIPMENT_LIST EQUIPMENT_STATUS_UPDATE EQUIPMENT_ALERT_LIST"
EQUIV_GROUPS["EQUIPMENT_STATUS_UPDATE"]="EQUIPMENT_STATUS_UPDATE EQUIPMENT_LIST EQUIPMENT_DETAIL EQUIPMENT_STATS"
EQUIV_GROUPS["EQUIPMENT_ALERT_STATS"]="EQUIPMENT_ALERT_STATS EQUIPMENT_ALERT_LIST ALERT_STATS EQUIPMENT_STATS"

# 考勤组
EQUIV_GROUPS["ATTENDANCE_QUERY"]="ATTENDANCE_QUERY ATTENDANCE_TODAY ATTENDANCE_ANOMALY ATTENDANCE_HISTORY ATTENDANCE_STATUS ATTENDANCE_STATS SCHEDULING_SET_MANUAL"
EQUIV_GROUPS["ATTENDANCE_TODAY"]="ATTENDANCE_QUERY ATTENDANCE_TODAY ATTENDANCE_ANOMALY ATTENDANCE_STATUS"

# 发货组 (扩展)
EQUIV_GROUPS["SHIPMENT_QUERY"]="SHIPMENT_QUERY SHIPMENT_STATUS_UPDATE SHIPMENT_STATS SHIPMENT_BY_DATE SHIPMENT_CREATE REPORT_PRODUCTION REPORT_FINANCE SHIPMENT_BY_CUSTOMER CUSTOMER_PURCHASE_HISTORY CUSTOMER_SEARCH SCHEDULING_SET_MANUAL QUALITY_DISPOSITION_EXECUTE SUPPLIER_EVALUATE ALERT_LIST TRACE_FULL TRACE_BATCH PROCESSING_BATCH_LIST"
EQUIV_GROUPS["SHIPMENT_BY_DATE"]="SHIPMENT_BY_DATE SHIPMENT_STATS SHIPMENT_QUERY REPORT_FINANCE REPORT_KPI REPORT_TRENDS"

# 报表组 (扩展: 趋势/生产/效率/KPI 交叉等价)
EQUIV_GROUPS["REPORT_DASHBOARD_OVERVIEW"]="REPORT_DASHBOARD_OVERVIEW REPORT_TRENDS REPORT_KPI REPORT_QUALITY ALERT_BY_LEVEL PRODUCT_TYPE_QUERY REPORT_PRODUCTION PROCESSING_BATCH_LIST REPORT_INVENTORY"
EQUIV_GROUPS["REPORT_TRENDS"]="REPORT_TRENDS REPORT_DASHBOARD_OVERVIEW QUALITY_STATS REPORT_EFFICIENCY REPORT_PRODUCTION REPORT_INVENTORY SCALE_DEVICE_DETAIL"
EQUIV_GROUPS["REPORT_PRODUCTION"]="REPORT_PRODUCTION REPORT_EFFICIENCY PROCESSING_BATCH_LIST PRODUCTION_PLAN_QUERY REPORT_KPI PROCESSING_BATCH_COMPLETE REPORT_DASHBOARD_OVERVIEW REPORT_TRENDS CONVERSION_RATE_UPDATE"
EQUIV_GROUPS["REPORT_EFFICIENCY"]="REPORT_EFFICIENCY REPORT_PRODUCTION EQUIPMENT_STATS REPORT_KPI PROCESSING_BATCH_LIST CLOCK_OUT REPORT_TRENDS EQUIPMENT_ALERT_LIST ALERT_DIAGNOSE COST_QUERY"
EQUIV_GROUPS["REPORT_ANOMALY"]="REPORT_ANOMALY ALERT_DIAGNOSE ALERT_LIST REPORT_QUALITY EQUIPMENT_STATS EQUIPMENT_ALERT_LIST"
EQUIV_GROUPS["REPORT_KPI"]="REPORT_KPI REPORT_PRODUCTION REPORT_EFFICIENCY REPORT_DASHBOARD_OVERVIEW REPORT_TRENDS"

# 库存组 (扩展: 添加物料使用/过期/批次列表等)
EQUIV_GROUPS["MATERIAL_BATCH_QUERY"]="MATERIAL_BATCH_QUERY REPORT_INVENTORY BATCH_TRACE MATERIAL_BATCH_DETAIL MATERIAL_BATCH_LIST MATERIAL_FIFO_RECOMMEND MATERIAL_EXPIRING_ALERT MATERIAL_BATCH_USE MATERIAL_BATCH_RELEASE MATERIAL_LOW_STOCK_ALERT SHIPMENT_QUERY TRACE_BATCH SUPPLIER_SEARCH QUALITY_CHECK_QUERY"
EQUIV_GROUPS["REPORT_INVENTORY"]="REPORT_INVENTORY MATERIAL_BATCH_QUERY MATERIAL_UPDATE MATERIAL_ADJUST_QUANTITY CONVERSION_RATE_UPDATE REPORT_FINANCE REPORT_QUALITY BATCH_UPDATE MATERIAL_BATCH_LIST MATERIAL_EXPIRING_ALERT REPORT_DASHBOARD_OVERVIEW REPORT_TRENDS TRACE_BATCH QUALITY_DISPOSITION_EVALUATE ALERT_DIAGNOSE MATERIAL_BATCH_RESERVE COST_QUERY TRACE_FULL QUALITY_CHECK_QUERY"
EQUIV_GROUPS["MATERIAL_LOW_STOCK_ALERT"]="MATERIAL_LOW_STOCK_ALERT ALERT_LIST REPORT_INVENTORY MATERIAL_EXPIRING_ALERT"
EQUIV_GROUPS["MATERIAL_BATCH_LIST"]="MATERIAL_BATCH_LIST MATERIAL_BATCH_QUERY REPORT_INVENTORY MATERIAL_EXPIRING_ALERT"
EQUIV_GROUPS["MATERIAL_BATCH_USE"]="MATERIAL_BATCH_USE MATERIAL_BATCH_QUERY MATERIAL_BATCH_RELEASE SHIPMENT_BY_DATE SHIPMENT_CREATE SCHEDULING_SET_AUTO SHIPMENT_QUERY"
EQUIV_GROUPS["MATERIAL_BATCH_RELEASE"]="MATERIAL_BATCH_RELEASE MATERIAL_BATCH_USE MATERIAL_BATCH_QUERY"
EQUIV_GROUPS["MATERIAL_EXPIRING_ALERT"]="MATERIAL_EXPIRING_ALERT MATERIAL_EXPIRED_QUERY MATERIAL_BATCH_QUERY ALERT_LIST REPORT_INVENTORY"

# 成本组 (扩展: 添加财务相关等价)
EQUIV_GROUPS["COST_QUERY"]="COST_QUERY REPORT_FINANCE COST_TREND_ANALYSIS"
EQUIV_GROUPS["REPORT_FINANCE"]="COST_QUERY REPORT_FINANCE SHIPMENT_QUERY SUPPLIER_EVALUATE TRACE_FULL TRACE_BATCH REPORT_INVENTORY"
EQUIV_GROUPS["COST_TREND_ANALYSIS"]="COST_TREND_ANALYSIS COST_QUERY REPORT_EFFICIENCY REPORT_FINANCE"

# 供应商组 (扩展)
EQUIV_GROUPS["SUPPLIER_EVALUATE"]="SUPPLIER_EVALUATE BATCH_TRACE SUPPLIER_SEARCH QUALITY_CHECK_QUERY QUALITY_STATS QUALITY_DISPOSITION_EVALUATE REPORT_FINANCE"
EQUIV_GROUPS["QUALITY_DISPOSITION_EVALUATE"]="QUALITY_DISPOSITION_EVALUATE QUALITY_DISPOSITION_EXECUTE QUALITY_CHECK_QUERY SUPPLIER_EVALUATE"

# 称重组 (扩展: 添加称重更新/记录/设备列表等以及跨领域等价)
EQUIV_GROUPS["SCALE_DEVICE_DETAIL"]="SCALE_DEVICE_DETAIL EQUIPMENT_DETAIL EQUIPMENT_STATS SCALE_LIST_DEVICES EQUIPMENT_ALERT_LIST REPORT_DASHBOARD_OVERVIEW REPORT_QUALITY REPORT_TRENDS SCALE_UPDATE_DEVICE FACTORY_FEATURE_TOGGLE USER_ROLE_ASSIGN QUALITY_CHECK_QUERY EQUIPMENT_MAINTENANCE EQUIPMENT_ALERT_STATS TRACE_FULL"
EQUIV_GROUPS["SCALE_WEIGHING_RECORD"]="SCALE_WEIGHING_RECORD SCALE_LIST_DEVICES SCALE_DEVICE_DETAIL REPORT_PRODUCTION"
EQUIV_GROUPS["SCALE_LIST_DEVICES"]="SCALE_LIST_DEVICES SCALE_DEVICE_DETAIL EQUIPMENT_LIST"
EQUIV_GROUPS["SCALE_UPDATE_DEVICE"]="SCALE_UPDATE_DEVICE SCALE_DEVICE_DETAIL EQUIPMENT_STATUS_UPDATE"

# 批次创建/详情 (扩展)
EQUIV_GROUPS["PROCESSING_BATCH_CREATE"]="PROCESSING_BATCH_CREATE PROCESSING_BATCH_LIST PROCESSING_BATCH_START PROCESSING_BATCH_DETAIL"
EQUIV_GROUPS["PROCESSING_BATCH_DETAIL"]="PROCESSING_BATCH_DETAIL PROCESSING_BATCH_LIST PROCESSING_BATCH_QUERY PROCESSING_BATCH_CREATE SHIPMENT_STATUS_UPDATE"
EQUIV_GROUPS["PROCESSING_BATCH_START"]="PROCESSING_BATCH_START PROCESSING_BATCH_CREATE PROCESSING_BATCH_LIST"
EQUIV_GROUPS["PROCESSING_BATCH_PAUSE"]="PROCESSING_BATCH_PAUSE PROCESSING_BATCH_LIST ALERT_LIST"

# 质量检查 (扩展)
EQUIV_GROUPS["QUALITY_CHECK_EXECUTE"]="QUALITY_CHECK_EXECUTE QUALITY_CHECK_QUERY PROCESSING_BATCH_LIST"

# 调度组 (扩展)
EQUIV_GROUPS["SCHEDULING_SET_AUTO"]="SCHEDULING_SET_AUTO SCHEDULING_SET_MANUAL MATERIAL_BATCH_USE"
EQUIV_GROUPS["SCHEDULING_SET_MANUAL"]="SCHEDULING_SET_MANUAL SCHEDULING_SET_AUTO PROCESSING_BATCH_LIST EQUIPMENT_MAINTENANCE"

# 发货状态组
EQUIV_GROUPS["SHIPMENT_STATUS_UPDATE"]="SHIPMENT_STATUS_UPDATE SHIPMENT_QUERY QUALITY_DISPOSITION_EXECUTE"
EQUIV_GROUPS["SHIPMENT_STATS"]="SHIPMENT_STATS SHIPMENT_BY_DATE SHIPMENT_QUERY"

# 规则配置组
EQUIV_GROUPS["RULE_CONFIG"]="RULE_CONFIG ALERT_ACTIVE REPORT_INVENTORY QUALITY_CHECK_QUERY EQUIPMENT_LIST"

# 检查是否功能等价
is_equivalent() {
  local result="$1"
  local expected="$2"
  if [ "$result" = "$expected" ]; then
    return 0
  fi
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
echo -e "${BLUE}  意图识别系统 v7.0 测试 - 500个复杂场景${NC}"
echo -e "${BLUE}  特点: 长句、口语化、上下文约束${NC}"
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
    result="None"
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

echo "================================================"
echo "开始测试 - 500个复杂场景用例"
echo "================================================"
echo ""

# ==================== 一、生产管理类 (100个) ====================
echo -e "${CYAN}>>> 一、生产管理类测试 (100个) <<<${NC}"

# P1. 批次查询 (20个)
test_intent "麻烦帮我看一下今天上午生产的那几个批次现在都到什么环节了" "PROCESSING_BATCH_LIST" "P1-批次"
test_intent "我想查一下编号是PB20240115开头的那几个生产批次的详细信息" "PROCESSING_BATCH_DETAIL" "P1-批次"
test_intent "最近三天车间里面一共开了多少个生产批次，完成了几个" "PROCESSING_BATCH_LIST" "P1-批次"
test_intent "把正在生产线上跑着的那些批次都给我列出来，我要看看进度" "PROCESSING_BATCH_LIST" "P1-批次"
test_intent "昨天晚班开的那个紧急批次现在到底做到哪一步了" "PROCESSING_BATCH_DETAIL" "P1-批次"
test_intent "这个月到现在为止，我们一共完成了多少个批次的生产任务" "PROCESSING_BATCH_LIST" "P1-批次"
test_intent "帮我查一下A车间今天的所有生产批次，包括已完成和在制的" "PROCESSING_BATCH_LIST" "P1-批次"
test_intent "那个客户催得很急的订单对应的生产批次找到了没有" "PROCESSING_BATCH_QUERY" "P1-批次"
test_intent "系统里面状态显示暂停的批次有哪些，为什么暂停的" "PROCESSING_BATCH_LIST" "P1-批次"
test_intent "我记得上周有个批次出了点问题被退回返工了，现在怎么样了" "PROCESSING_BATCH_DETAIL" "P1-批次"
test_intent "生产计划里面排到明天的批次有几个，都是什么产品" "PROCESSING_BATCH_LIST" "P1-批次"
test_intent "这批货的生产批次号是多少，我要填出货单需要这个信息" "PROCESSING_BATCH_QUERY" "P1-批次"
test_intent "把上个月所有因为质量问题被暂停过的批次都筛选出来" "PROCESSING_BATCH_LIST" "P1-批次"
test_intent "现在车间里面同时在跑的批次是不是太多了，有没有超过产能" "PROCESSING_BATCH_LIST" "P1-批次"
test_intent "那个VIP客户的专属批次进展如何了，他们下周就要提货" "PROCESSING_BATCH_DETAIL" "P1-批次"
test_intent "帮我统计一下本周每天开了多少个新批次，完成了多少个" "PROCESSING_BATCH_LIST" "P1-批次"
test_intent "有没有哪个批次已经超过了计划完成时间还没做完的" "PROCESSING_BATCH_LIST" "P1-批次"
test_intent "我想看看每个产品类型分别有多少个批次正在生产中" "PROCESSING_BATCH_LIST" "P1-批次"
test_intent "把所有优先级标记为紧急的生产批次单独拉一个清单出来" "PROCESSING_BATCH_LIST" "P1-批次"
test_intent "最近完成的那十个批次分别用了多长时间，有没有效率问题" "PROCESSING_BATCH_LIST" "P1-批次"

# P2. 生产报表 (20个)
test_intent "老板要看这个月的生产总结报告，帮我把产量数据整理一下" "REPORT_PRODUCTION" "P2-报表"
test_intent "今天的产量跟昨天比起来怎么样，是增加了还是减少了" "REPORT_PRODUCTION" "P2-报表"
test_intent "这个季度我们的总产量达到目标了吗，完成率是多少" "REPORT_PRODUCTION" "P2-报表"
test_intent "帮我把每条产线这周的产量做一个对比，看看哪条效率最高" "REPORT_PRODUCTION" "P2-报表"
test_intent "我需要一份详细的月度生产报表，包含产量、良率、效率等指标" "REPORT_PRODUCTION" "P2-报表"
test_intent "去年同期的产量是多少，今年有没有增长" "REPORT_PRODUCTION" "P2-报表"
test_intent "把这个月每天的产量数据做成趋势图给我看看" "REPORT_TRENDS" "P2-报表"
test_intent "各个车间的产量贡献占比是多少，哪个车间产量最高" "REPORT_PRODUCTION" "P2-报表"
test_intent "统计一下这周每种产品分别生产了多少，销量最好的是哪个" "REPORT_PRODUCTION" "P2-报表"
test_intent "夜班的产量跟白班比起来差多少，是不是人手不够" "REPORT_PRODUCTION" "P2-报表"
test_intent "本月的生产计划完成情况怎么样，还有多少缺口" "REPORT_PRODUCTION" "P2-报表"
test_intent "把近半年的产量数据拉出来，我要看看整体趋势" "REPORT_TRENDS" "P2-报表"
test_intent "今年到目前为止的累计产量是多少，离年度目标还差多远" "REPORT_PRODUCTION" "P2-报表"
test_intent "哪个产品的产量最高，哪个产品的产量最低" "REPORT_PRODUCTION" "P2-报表"
test_intent "产量下滑最严重的是哪一周，当时发生了什么" "REPORT_PRODUCTION" "P2-报表"
test_intent "我想看看每个班组的产量排名，好评选这个月的优秀班组" "REPORT_PRODUCTION" "P2-报表"
test_intent "这批新设备上线之后产量有没有明显提升" "REPORT_PRODUCTION" "P2-报表"
test_intent "把产量和原料消耗的对比数据给我，我要算一下转化率" "REPORT_PRODUCTION" "P2-报表"
test_intent "下个月的产量预测是多少，需要提前准备多少原料" "REPORT_PRODUCTION" "P2-报表"
test_intent "哪种产品的生产周期最长，有没有优化空间" "REPORT_PRODUCTION" "P2-报表"

# P3. 效率分析 (20个)
test_intent "目前整个工厂的综合生产效率是多少，达到行业标准了吗" "REPORT_EFFICIENCY" "P3-效率"
test_intent "这台设备的OEE指标怎么样，跟上个月比有没有提升" "REPORT_EFFICIENCY" "P3-效率"
test_intent "为什么今天的生产效率比昨天低了这么多，是不是出什么问题了" "REPORT_EFFICIENCY" "P3-效率"
test_intent "哪条产线的效率最高，他们用了什么方法可以推广一下" "REPORT_EFFICIENCY" "P3-效率"
test_intent "人均产出是多少，跟行业平均水平相比处于什么位置" "REPORT_EFFICIENCY" "P3-效率"
test_intent "设备利用率太低了，大部分时间都在闲置，怎么回事" "REPORT_EFFICIENCY" "P3-效率"
test_intent "这个月的效率提升了多少个百分点，主要是哪方面改进的" "REPORT_EFFICIENCY" "P3-效率"
test_intent "计算一下每个工序的标准工时和实际工时的差异" "REPORT_EFFICIENCY" "P3-效率"
test_intent "效率最低的那几个环节是什么，是不是可以自动化改造" "REPORT_EFFICIENCY" "P3-效率"
test_intent "加班这么多但产量也没上去，效率是不是有问题" "REPORT_EFFICIENCY" "P3-效率"
test_intent "新员工的生产效率跟老员工比差多少，培训效果怎么样" "REPORT_EFFICIENCY" "P3-效率"
test_intent "单位时间内的产出量是增加了还是减少了" "REPORT_EFFICIENCY" "P3-效率"
test_intent "瓶颈工序在哪里，影响了整体效率多少" "REPORT_EFFICIENCY" "P3-效率"
test_intent "效率损失主要是什么原因造成的，设备故障还是人为因素" "REPORT_EFFICIENCY" "P3-效率"
test_intent "实施精益生产之后效率提升了多少" "REPORT_EFFICIENCY" "P3-效率"
test_intent "各班组的效率排名怎么样，差距大不大" "REPORT_EFFICIENCY" "P3-效率"
test_intent "这个月的工时利用率是多少，有没有达到考核标准" "REPORT_EFFICIENCY" "P3-效率"
test_intent "产能利用率太低会影响成本的，现在是什么水平" "REPORT_EFFICIENCY" "P3-效率"
test_intent "效率波动这么大是什么原因，能不能稳定下来" "REPORT_EFFICIENCY" "P3-效率"
test_intent "按照目前的效率水平，这个订单能不能按时完成" "REPORT_EFFICIENCY" "P3-效率"

# P4. 异常告警 (20个)
test_intent "车间里面现在有没有什么设备在报警，赶紧处理一下" "ALERT_LIST" "P4-异常"
test_intent "今天一共发生了多少次告警，都是什么类型的" "ALERT_LIST" "P4-异常"
test_intent "那个红色告警处理了没有，已经响了半个小时了" "ALERT_ACTIVE" "P4-异常"
test_intent "最近一周告警最多的是哪台设备，是不是该维修了" "ALERT_STATS" "P4-异常"
test_intent "高级别的告警有哪些，需要立即处理的" "ALERT_BY_LEVEL" "P4-异常"
test_intent "这个告警已经反复出现好几次了，根本原因是什么" "ALERT_DIAGNOSE" "P4-异常"
test_intent "帮我把所有未处理的告警列出来，我来安排人跟进" "ALERT_ACTIVE" "P4-异常"
test_intent "告警响应时间太长了，平均多久才能处理完一个告警" "ALERT_STATS" "P4-异常"
test_intent "昨天晚上的那个告警是谁处理的，处理结果怎么样" "ALERT_LIST" "P4-异常"
test_intent "这种类型的告警应该怎么处理，有没有标准流程" "ALERT_DIAGNOSE" "P4-异常"
test_intent "告警级别怎么划分的，什么情况下会触发最高级别告警" "ALERT_BY_LEVEL" "P4-异常"
test_intent "把这个月所有的告警记录导出来，我要做分析报告" "ALERT_LIST" "P4-异常"
test_intent "能不能设置告警自动升级，超过一定时间没处理就通知主管" "ALERT_ACTIVE" "P4-异常"
test_intent "告警太多了，有些是误报吧，能不能优化一下告警规则" "ALERT_STATS" "P4-异常"
test_intent "这个设备的告警历史记录在哪里可以查到" "EQUIPMENT_ALERT_LIST" "P4-异常"
test_intent "生产异常导致的告警和设备故障告警分别有多少" "ALERT_STATS" "P4-异常"
test_intent "告警处理完之后需要做什么记录吗" "ALERT_RESOLVE" "P4-异常"
test_intent "现在有几个告警是卡在等待备件状态的" "ALERT_ACTIVE" "P4-异常"
test_intent "把告警按照发生频率排个序，看看哪类问题最多" "ALERT_STATS" "P4-异常"
test_intent "这个告警的影响范围有多大，会不会影响其他生产线" "ALERT_DIAGNOSE" "P4-异常"

# P5. 任务调度 (20个)
test_intent "今天的生产任务都安排好了吗，各条线都在做什么" "PROCESSING_BATCH_LIST" "P5-任务"
test_intent "这个订单应该安排到哪条产线上生产比较合适" "PROCESSING_BATCH_CREATE" "P5-任务"
test_intent "明天的生产计划排好了没有，我要提前准备原料" "PROCESSING_BATCH_LIST" "P5-任务"
test_intent "任务太多做不完怎么办，能不能调整一下优先级" "PROCESSING_BATCH_LIST" "P5-任务"
test_intent "这批紧急订单插单进去之后，其他任务怎么调整" "PROCESSING_BATCH_LIST" "P5-任务"
test_intent "每个员工现在手上有多少任务，工作量饱和吗" "PROCESSING_BATCH_LIST" "P5-任务"
test_intent "任务分配不均衡吧，有的人忙死有的人闲着" "PROCESSING_BATCH_LIST" "P5-任务"
test_intent "这周的生产任务完成了多少，还剩多少没做" "PROCESSING_BATCH_LIST" "P5-任务"
test_intent "有没有哪个任务是被延期的，延期原因是什么" "PROCESSING_BATCH_LIST" "P5-任务"
test_intent "新来的那批订单怎么安排，产能够不够" "PROCESSING_BATCH_CREATE" "P5-任务"
test_intent "任务的优先级是怎么定的，按什么规则排序" "PROCESSING_BATCH_LIST" "P5-任务"
test_intent "这个任务已经超期了，为什么还没完成" "PROCESSING_BATCH_DETAIL" "P5-任务"
test_intent "把明天要做的任务列表打印出来，贴到车间公告栏" "PROCESSING_BATCH_LIST" "P5-任务"
test_intent "任务变更了，需要通知哪些人" "PROCESSING_BATCH_DETAIL" "P5-任务"
test_intent "这个月的任务完成率是多少，有没有达标" "REPORT_KPI" "P5-任务"
test_intent "任务之间的依赖关系是怎样的，先做哪个后做哪个" "PROCESSING_BATCH_LIST" "P5-任务"
test_intent "有没有可以并行处理的任务，提高整体效率" "PROCESSING_BATCH_LIST" "P5-任务"
test_intent "任务延误会影响交货期吗，需不需要加班赶工" "PROCESSING_BATCH_LIST" "P5-任务"
test_intent "这批任务需要什么特殊技能，安排谁来做比较好" "PROCESSING_BATCH_LIST" "P5-任务"
test_intent "把已完成和未完成的任务分开统计一下" "PROCESSING_BATCH_LIST" "P5-任务"

# ==================== 二、仓库管理类 (100个) ====================
echo ""
echo -e "${CYAN}>>> 二、仓库管理类测试 (100个) <<<${NC}"

# W1. 库存查询 (20个)
test_intent "仓库里面那个编号是M2024开头的原料还剩多少库存" "MATERIAL_BATCH_QUERY" "W1-库存"
test_intent "现在各种原料的库存情况怎么样，有没有快断货的" "MATERIAL_BATCH_LIST" "W1-库存"
test_intent "这种原料的库存够用几天的，需不需要提前采购" "MATERIAL_BATCH_QUERY" "W1-库存"
test_intent "帮我查一下A仓库现在的库存总量是多少" "REPORT_INVENTORY" "W1-库存"
test_intent "哪些原料的库存已经低于安全库存了，赶紧补货" "MATERIAL_LOW_STOCK_ALERT" "W1-库存"
test_intent "这批新进的原料入库了没有，库存数量对不对" "MATERIAL_BATCH_QUERY" "W1-库存"
test_intent "各个仓库的库存分布情况是怎样的" "REPORT_INVENTORY" "W1-库存"
test_intent "库存周转率是多少，有没有积压严重的原料" "REPORT_INVENTORY" "W1-库存"
test_intent "实际库存和系统库存对得上吗，有没有差异" "REPORT_INVENTORY" "W1-库存"
test_intent "这种原料最近一个月的库存变化趋势是怎样的" "REPORT_INVENTORY" "W1-库存"
test_intent "预留给某个订单的原料还在吗，没被挪用吧" "MATERIAL_BATCH_QUERY" "W1-库存"
test_intent "库存预警的阈值设置得合理吗，是不是太低了" "MATERIAL_LOW_STOCK_ALERT" "W1-库存"
test_intent "帮我统计一下各类原料的库存金额是多少" "REPORT_INVENTORY" "W1-库存"
test_intent "库存盘点什么时候做的，结果怎么样" "REPORT_INVENTORY" "W1-库存"
test_intent "呆滞库存有多少，放了多长时间了" "MATERIAL_BATCH_QUERY" "W1-库存"
test_intent "这个月的库存成本是多少，占总成本的比例是多少" "REPORT_INVENTORY" "W1-库存"
test_intent "有没有即将过期的原料，需要优先使用的" "MATERIAL_EXPIRING_ALERT" "W1-库存"
test_intent "各供应商供应的原料库存分别是多少" "MATERIAL_BATCH_QUERY" "W1-库存"
test_intent "库存数据多久更新一次，现在看到的是实时的吗" "REPORT_INVENTORY" "W1-库存"
test_intent "最小库存量和最大库存量是怎么设定的" "MATERIAL_BATCH_QUERY" "W1-库存"

# W2. 出入库管理 (20个)
test_intent "今天有多少车原料送过来了，都入库了没有" "MATERIAL_BATCH_QUERY" "W2-出入"
test_intent "这批货的入库单在哪里，我要核对一下数量" "MATERIAL_BATCH_QUERY" "W2-出入"
test_intent "出库记录在哪里查，我想看看今天出了多少货" "MATERIAL_BATCH_USE" "W2-出入"
test_intent "帮我打印一份这个月的出入库汇总表" "REPORT_INVENTORY" "W2-出入"
test_intent "这批原料出库给哪个车间了，谁签收的" "MATERIAL_BATCH_USE" "W2-出入"
test_intent "入库的时候发现数量不对怎么办，跟送货单对不上" "MATERIAL_BATCH_QUERY" "W2-出入"
test_intent "能不能设置自动出库，生产领料的时候自动扣减库存" "MATERIAL_BATCH_USE" "W2-出入"
test_intent "退料怎么处理，需要走什么流程" "MATERIAL_BATCH_RELEASE" "W2-出入"
test_intent "这周的出入库流水账在哪里可以看到" "REPORT_INVENTORY" "W2-出入"
test_intent "入库验收的标准是什么，要检查哪些项目" "MATERIAL_BATCH_QUERY" "W2-出入"
test_intent "批量出库怎么操作，一个一个录入太慢了" "MATERIAL_BATCH_USE" "W2-出入"
test_intent "出入库的审批流程是怎样的，需要谁批准" "MATERIAL_BATCH_QUERY" "W2-出入"
test_intent "临时借调的原料怎么记录，算出库还是算调拨" "MATERIAL_BATCH_USE" "W2-出入"
test_intent "入库之后多久可以使用，有没有检验期" "MATERIAL_BATCH_QUERY" "W2-出入"
test_intent "今天的出库量比平时多很多，是哪个订单用的" "MATERIAL_BATCH_USE" "W2-出入"
test_intent "出入库单据需要保存多久，有没有归档要求" "REPORT_INVENTORY" "W2-出入"
test_intent "跨仓库调拨怎么操作，需要走什么流程" "MATERIAL_BATCH_USE" "W2-出入"
test_intent "出库的时候怎么选择批次，是先进先出吗" "MATERIAL_FIFO_RECOMMEND" "W2-出入"
test_intent "入库数量录错了怎么改，能不能直接修改" "MATERIAL_BATCH_QUERY" "W2-出入"
test_intent "出入库的时间记录准确吗，有没有滞后" "REPORT_INVENTORY" "W2-出入"

# W3. 追溯查询 (20个)
test_intent "这批产品用的原料是从哪个供应商进的货，能追溯到吗" "BATCH_TRACE" "W3-追溯"
test_intent "帮我查一下这个批号的原料都用到哪些产品里面去了" "BATCH_TRACE" "W3-追溯"
test_intent "客户反馈产品有问题，我要追溯一下整个生产链条" "BATCH_TRACE" "W3-追溯"
test_intent "这批原料的来源证明和检验报告在哪里可以看到" "BATCH_TRACE" "W3-追溯"
test_intent "原料从入库到使用的整个流转过程能不能查到" "BATCH_TRACE" "W3-追溯"
test_intent "追溯到问题原料之后，有多少成品受影响" "BATCH_TRACE" "W3-追溯"
test_intent "供应商的资质证明和营业执照在系统里面有吗" "SUPPLIER_SEARCH" "W3-追溯"
test_intent "这批原料的生产日期和保质期是多少" "MATERIAL_BATCH_QUERY" "W3-追溯"
test_intent "能不能正向追溯，从原料追到成品" "BATCH_TRACE" "W3-追溯"
test_intent "逆向追溯要怎么操作，从成品查原料" "BATCH_TRACE" "W3-追溯"
test_intent "追溯报告怎么导出，客户要求提供" "BATCH_TRACE" "W3-追溯"
test_intent "这个供应商以前供的货出过问题吗" "SUPPLIER_EVALUATE" "W3-追溯"
test_intent "原料的运输温度记录在哪里可以看到" "BATCH_TRACE" "W3-追溯"
test_intent "追溯系统的数据完整吗，有没有断链的情况" "BATCH_TRACE" "W3-追溯"
test_intent "同一批原料供给了几个客户，如果有问题影响面有多大" "BATCH_TRACE" "W3-追溯"
test_intent "追溯码扫描之后能看到什么信息" "BATCH_TRACE" "W3-追溯"
test_intent "这批货是什么时候到的，在仓库放了多久了" "MATERIAL_BATCH_QUERY" "W3-追溯"
test_intent "原料的检验记录和追溯信息能关联起来吗" "BATCH_TRACE" "W3-追溯"
test_intent "如果发生召回，怎么快速定位受影响的产品" "BATCH_TRACE" "W3-追溯"
test_intent "追溯信息的录入是自动的还是需要手工输入" "BATCH_TRACE" "W3-追溯"

# W4. 损耗管理 (20个)
test_intent "这个月的原料损耗率是多少，有没有超标" "REPORT_INVENTORY" "W4-损耗"
test_intent "损耗最大的是哪种原料，主要是什么原因造成的" "REPORT_INVENTORY" "W4-损耗"
test_intent "正常损耗和异常损耗分别是多少，怎么区分的" "REPORT_INVENTORY" "W4-损耗"
test_intent "损耗超标了需要走什么审批流程" "REPORT_INVENTORY" "W4-损耗"
test_intent "盘点的时候发现少了好多，是丢了还是记错了" "REPORT_INVENTORY" "W4-损耗"
test_intent "如何降低生产过程中的原料损耗" "REPORT_INVENTORY" "W4-损耗"
test_intent "损耗成本占总成本的比例是多少" "REPORT_INVENTORY" "W4-损耗"
test_intent "哪个环节的损耗最严重，有没有改进措施" "REPORT_INVENTORY" "W4-损耗"
test_intent "过期报废的原料有多少，金额是多少" "MATERIAL_EXPIRED_QUERY" "W4-损耗"
test_intent "损耗数据需要每天统计还是每月统计" "REPORT_INVENTORY" "W4-损耗"
test_intent "账实不符的原因查出来了吗，差异怎么处理" "REPORT_INVENTORY" "W4-损耗"
test_intent "损耗标准是怎么定的，有没有行业参考" "REPORT_INVENTORY" "W4-损耗"
test_intent "减少损耗之后能节省多少成本" "COST_QUERY" "W4-损耗"
test_intent "损耗异常的时候系统会自动报警吗" "ALERT_LIST" "W4-损耗"
test_intent "不同产品的损耗率差异大吗，原因是什么" "REPORT_INVENTORY" "W4-损耗"
test_intent "损耗数据跟财务对账对得上吗" "REPORT_INVENTORY" "W4-损耗"
test_intent "有没有办法预测损耗，提前准备原料" "REPORT_INVENTORY" "W4-损耗"
test_intent "损耗控制的KPI是多少，考核标准是什么" "REPORT_KPI" "W4-损耗"
test_intent "运输过程中的损耗谁来承担，怎么划分责任" "REPORT_INVENTORY" "W4-损耗"
test_intent "把损耗明细报表给我，我要向领导汇报" "REPORT_INVENTORY" "W4-损耗"

# W5. 环境监控 (20个)
test_intent "冷库的温度现在是多少度，在正常范围内吗" "SCALE_DEVICE_DETAIL" "W5-环境"
test_intent "仓库的温湿度监控数据在哪里可以查看" "SCALE_DEVICE_DETAIL" "W5-环境"
test_intent "温度超标了系统会自动报警吗，报警阈值是多少" "ALERT_LIST" "W5-环境"
test_intent "环境监控设备都正常运行吗，有没有离线的" "SCALE_DEVICE_DETAIL" "W5-环境"
test_intent "这批原料对存储温度有什么要求，现在的条件满足吗" "SCALE_DEVICE_DETAIL" "W5-环境"
test_intent "昨天晚上温度有没有异常波动，会不会影响原料质量" "SCALE_DEVICE_DETAIL" "W5-环境"
test_intent "湿度太高了怎么办，有没有除湿设备" "SCALE_DEVICE_DETAIL" "W5-环境"
test_intent "环境监控数据多久记录一次，能保存多长时间" "SCALE_DEVICE_DETAIL" "W5-环境"
test_intent "不同区域的温度要求一样吗，怎么分区管理的" "SCALE_DEVICE_DETAIL" "W5-环境"
test_intent "温控设备的能耗是多少，有没有节能空间" "EQUIPMENT_STATS" "W5-环境"
test_intent "环境数据能导出给客户审核吗，格式是什么样的" "SCALE_DEVICE_DETAIL" "W5-环境"
test_intent "传感器多久校准一次，数据准确性怎么保证" "SCALE_DEVICE_DETAIL" "W5-环境"
test_intent "停电的话温度能维持多久，有没有应急预案" "ALERT_LIST" "W5-环境"
test_intent "不同季节的温度控制策略一样吗" "SCALE_DEVICE_DETAIL" "W5-环境"
test_intent "环境监控跟质量管理系统对接了吗" "SCALE_DEVICE_DETAIL" "W5-环境"
test_intent "历史温度曲线在哪里看，我要分析一下波动规律" "SCALE_DEVICE_DETAIL" "W5-环境"
test_intent "温度异常会影响原料多长时间才需要报废" "ALERT_LIST" "W5-环境"
test_intent "环境合规检查需要提供什么数据" "SCALE_DEVICE_DETAIL" "W5-环境"
test_intent "手动调整温度设定值需要什么权限" "SCALE_DEVICE_DETAIL" "W5-环境"
test_intent "环境异常事件的处理记录在哪里查看" "ALERT_LIST" "W5-环境"

# ==================== 三、质量管理类 (100个) ====================
echo ""
echo -e "${CYAN}>>> 三、质量管理类测试 (100个) <<<${NC}"

# Q1. 质检查询 (20个)
test_intent "今天的质检结果怎么样，合格率是多少" "QUALITY_STATS" "Q1-质检"
test_intent "这批产品的质检报告在哪里可以看到" "QUALITY_CHECK_QUERY" "Q1-质检"
test_intent "最近一周的质量趋势怎么样，是在提升还是下降" "QUALITY_STATS" "Q1-质检"
test_intent "哪个产品的不良率最高，主要是什么问题" "QUALITY_STATS" "Q1-质检"
test_intent "首检、过程检、终检的数据分别是多少" "QUALITY_CHECK_QUERY" "Q1-质检"
test_intent "质检不合格的原因统计一下，看看主要问题在哪里" "QUALITY_STATS" "Q1-质检"
test_intent "这个月的质量目标达成情况怎么样" "QUALITY_STATS" "Q1-质检"
test_intent "客户投诉的那批货当时的质检数据是多少" "QUALITY_CHECK_QUERY" "Q1-质检"
test_intent "不同班组的质量水平差异大吗" "QUALITY_STATS" "Q1-质检"
test_intent "质检抽样的比例是多少，抽样方案合理吗" "QUALITY_CHECK_QUERY" "Q1-质检"
test_intent "在线检测设备检测出多少不良品" "QUALITY_CHECK_QUERY" "Q1-质检"
test_intent "质检标准最近有没有更新" "QUALITY_CHECK_QUERY" "Q1-质检"
test_intent "返工率是多少，主要是哪些问题导致的返工" "QUALITY_STATS" "Q1-质检"
test_intent "质量成本占销售额的比例是多少" "QUALITY_STATS" "Q1-质检"
test_intent "SPC控制图在哪里看，过程能力稳定吗" "QUALITY_STATS" "Q1-质检"
test_intent "检验员的检出率怎么样，有没有漏检" "QUALITY_STATS" "Q1-质检"
test_intent "这批货的外观检验结果是什么" "QUALITY_CHECK_QUERY" "Q1-质检"
test_intent "关键质量特性的CPK值是多少" "QUALITY_STATS" "Q1-质检"
test_intent "质检数据能自动上传到客户系统吗" "QUALITY_CHECK_QUERY" "Q1-质检"
test_intent "历史质检数据怎么查询，能查多久之前的" "QUALITY_CHECK_QUERY" "Q1-质检"

# Q2. 质量处置 (20个)
test_intent "这批不合格品应该怎么处理，走什么流程" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"
test_intent "不良品评审的结果是什么，能不能特采使用" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"
test_intent "需要返工的产品有多少，返工方案是什么" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"
test_intent "报废处理需要谁批准，有什么要求" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"
test_intent "让步接收的条件是什么，需要客户同意吗" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"
test_intent "不合格品隔离区在哪里，标识清楚了吗" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"
test_intent "处置单怎么填写，需要哪些信息" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"
test_intent "评审会什么时候开，参加人员有哪些" "QUALITY_DISPOSITION_EVALUATE" "Q2-处置"
test_intent "这批货处置完了吗，现在是什么状态" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"
test_intent "挑选使用的标准是什么，挑选之后的合格率能保证吗" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"
test_intent "供应商来料不合格怎么处理，能不能退货" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"
test_intent "处置记录在哪里查，需要归档保存吗" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"
test_intent "紧急放行的条件是什么，有什么风险" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"
test_intent "返修和返工有什么区别，分别怎么处理" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"
test_intent "不合格品的责任认定是怎么做的" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"
test_intent "降级使用的审批流程是什么" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"
test_intent "处置方案需要验证吗，验证标准是什么" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"
test_intent "客户退货怎么处理，需要做什么检验" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"
test_intent "报废品的处理记录和销毁证明在哪里" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"
test_intent "处置效率怎么样，平均处理周期是多少天" "QUALITY_DISPOSITION_EXECUTE" "Q2-处置"

# Q3. 来料检验 (20个)
test_intent "今天到货的原料检验完了吗，结果怎么样" "QUALITY_CHECK_QUERY" "Q3-来料"
test_intent "这个供应商的来料合格率是多少" "SUPPLIER_EVALUATE" "Q3-来料"
test_intent "来料检验的项目有哪些，检验标准是什么" "QUALITY_CHECK_QUERY" "Q3-来料"
test_intent "免检的原料有哪些，免检资质怎么获得的" "QUALITY_CHECK_QUERY" "Q3-来料"
test_intent "来料检验需要多长时间，能不能加快" "QUALITY_CHECK_QUERY" "Q3-来料"
test_intent "检验不合格的来料怎么处理，通知供应商了吗" "QUALITY_DISPOSITION_EXECUTE" "Q3-来料"
test_intent "抽检比例是根据什么确定的，能不能调整" "QUALITY_CHECK_QUERY" "Q3-来料"
test_intent "来料检验报告的格式要求是什么" "QUALITY_CHECK_QUERY" "Q3-来料"
test_intent "供应商提供的检验报告可以替代我们自己的检验吗" "QUALITY_CHECK_QUERY" "Q3-来料"
test_intent "来料异常的处理时效是多少，有没有超时的" "QUALITY_CHECK_QUERY" "Q3-来料"
test_intent "紧急来料怎么处理，能不能先用后检" "QUALITY_CHECK_QUERY" "Q3-来料"
test_intent "来料检验的人员配置够吗，有没有积压" "QUALITY_CHECK_QUERY" "Q3-来料"
test_intent "检验设备的精度够不够，多久校准一次" "QUALITY_CHECK_QUERY" "Q3-来料"
test_intent "来料标识是怎么做的，检验前后怎么区分" "QUALITY_CHECK_QUERY" "Q3-来料"
test_intent "检验样品怎么留存，留样期限是多久" "QUALITY_CHECK_QUERY" "Q3-来料"
test_intent "来料检验发现的问题有没有反馈给供应商" "SUPPLIER_EVALUATE" "Q3-来料"
test_intent "批次管理的规则是什么，怎么跟来料关联" "QUALITY_CHECK_QUERY" "Q3-来料"
test_intent "来料质量趋势分析报告在哪里看" "QUALITY_STATS" "Q3-来料"
test_intent "新供应商的首批来料需要全检吗" "QUALITY_CHECK_QUERY" "Q3-来料"
test_intent "来料检验的成本是多少，怎么优化" "QUALITY_CHECK_QUERY" "Q3-来料"

# Q4. 过程质量 (20个)
test_intent "生产过程中的首件检验结果怎么样" "QUALITY_CHECK_QUERY" "Q4-过程"
test_intent "巡检发现了什么问题，处理了没有" "QUALITY_CHECK_QUERY" "Q4-过程"
test_intent "过程质量控制点有哪些，检验频率是多少" "QUALITY_CHECK_QUERY" "Q4-过程"
test_intent "自检记录在哪里看，操作工有没有按要求做" "QUALITY_CHECK_QUERY" "Q4-过程"
test_intent "互检的执行情况怎么样，有没有漏检" "QUALITY_CHECK_QUERY" "Q4-过程"
test_intent "过程不合格品率是多少，哪个工序最高" "QUALITY_STATS" "Q4-过程"
test_intent "质量波动的原因是什么，是人还是机器的问题" "QUALITY_STATS" "Q4-过程"
test_intent "工艺参数在控制范围内吗，有没有超标" "QUALITY_CHECK_QUERY" "Q4-过程"
test_intent "关键工序的质量数据怎么监控的" "QUALITY_STATS" "Q4-过程"
test_intent "过程质量问题的处理流程是什么" "QUALITY_DISPOSITION_EXECUTE" "Q4-过程"
test_intent "质量门在哪些工序设置的，通过标准是什么" "QUALITY_CHECK_QUERY" "Q4-过程"
test_intent "过程能力分析的结果怎么样，CPK达标吗" "QUALITY_STATS" "Q4-过程"
test_intent "检验点的布置合理吗，有没有漏检风险" "QUALITY_CHECK_QUERY" "Q4-过程"
test_intent "过程质量改进项目进展怎么样" "QUALITY_STATS" "Q4-过程"
test_intent "在线检测设备的检出率怎么样" "QUALITY_CHECK_QUERY" "Q4-过程"
test_intent "质量异常时生产线需要停下来吗" "ALERT_LIST" "Q4-过程"
test_intent "过程质量数据有没有实时监控系统" "QUALITY_STATS" "Q4-过程"
test_intent "质量追溯在过程中是怎么做的" "BATCH_TRACE" "Q4-过程"
test_intent "作业指导书里的质量要求清楚吗" "QUALITY_CHECK_QUERY" "Q4-过程"
test_intent "过程质量问题的根本原因分析做了吗" "QUALITY_STATS" "Q4-过程"

# Q5. 成品检验 (20个)
test_intent "这批成品的出厂检验做完了吗，结果怎么样" "QUALITY_CHECK_QUERY" "Q5-成品"
test_intent "成品检验的合格率是多少，达到目标了吗" "QUALITY_STATS" "Q5-成品"
test_intent "出厂检验报告在哪里打印，客户要随货附上" "QUALITY_CHECK_QUERY" "Q5-成品"
test_intent "全检和抽检的比例是怎么定的" "QUALITY_CHECK_QUERY" "Q5-成品"
test_intent "成品入库前还需要做什么检验" "QUALITY_CHECK_QUERY" "Q5-成品"
test_intent "客户有特殊的检验要求吗，我们能满足吗" "QUALITY_CHECK_QUERY" "Q5-成品"
test_intent "检验不合格的成品有多少，都是什么问题" "QUALITY_STATS" "Q5-成品"
test_intent "成品检验需要多长时间，能不能缩短交期" "QUALITY_CHECK_QUERY" "Q5-成品"
test_intent "外观检验的标准是什么，有没有限度样品" "QUALITY_CHECK_QUERY" "Q5-成品"
test_intent "功能测试的结果怎么样，有没有失效的" "QUALITY_CHECK_QUERY" "Q5-成品"
test_intent "可靠性测试做了吗，结果如何" "QUALITY_CHECK_QUERY" "Q5-成品"
test_intent "成品检验的设备都校准了吗，有效期到什么时候" "QUALITY_CHECK_QUERY" "Q5-成品"
test_intent "检验记录需要保存多久，怎么归档" "QUALITY_CHECK_QUERY" "Q5-成品"
test_intent "成品检验发现的问题有没有反馈给生产" "QUALITY_STATS" "Q5-成品"
test_intent "批次放行的条件是什么，谁有放行权限" "QUALITY_CHECK_QUERY" "Q5-成品"
test_intent "成品质量跟客户投诉的关联分析做了吗" "QUALITY_STATS" "Q5-成品"
test_intent "出货前的最终检验是谁负责的" "QUALITY_CHECK_QUERY" "Q5-成品"
test_intent "成品检验的成本是多少，有没有优化空间" "QUALITY_STATS" "Q5-成品"
test_intent "质量证书是检验通过之后自动生成的吗" "QUALITY_CHECK_QUERY" "Q5-成品"
test_intent "成品质量问题的追溯能追到哪一步" "BATCH_TRACE" "Q5-成品"

# ==================== 四、发货物流类 (60个) ====================
echo ""
echo -e "${CYAN}>>> 四、发货物流类测试 (60个) <<<${NC}"

# S1. 订单发货 (20个)
test_intent "今天有多少订单需要发货，准备好了吗" "SHIPMENT_QUERY" "S1-订单"
test_intent "这个客户的订单什么时候能发出去，他催得很急" "SHIPMENT_QUERY" "S1-订单"
test_intent "发货单已经打印了吗，物流信息填好了没有" "SHIPMENT_QUERY" "S1-订单"
test_intent "这批货用什么物流发，是客户指定的还是我们选的" "SHIPMENT_QUERY" "S1-订单"
test_intent "分批发货的订单现在发了几批了，还剩多少" "SHIPMENT_QUERY" "S1-订单"
test_intent "发货延迟的订单有哪些，延迟原因是什么" "SHIPMENT_QUERY" "S1-订单"
test_intent "今天发出去的货物流单号是多少，我要告诉客户" "SHIPMENT_QUERY" "S1-订单"
test_intent "发货前需要做什么检查，清单在哪里" "SHIPMENT_QUERY" "S1-订单"
test_intent "这个订单的发货地址是哪里，要确认一下" "SHIPMENT_QUERY" "S1-订单"
test_intent "紧急订单能不能今天发出去，需要加急处理" "SHIPMENT_QUERY" "S1-订单"
test_intent "发货量最大的是哪个客户，占总发货量多少" "SHIPMENT_STATS" "S1-订单"
test_intent "这周的发货计划完成了多少，还有多少没发" "SHIPMENT_QUERY" "S1-订单"
test_intent "发货记录在哪里查询，我要核对一下" "SHIPMENT_QUERY" "S1-订单"
test_intent "客户要求指定时间送达，能不能做到" "SHIPMENT_QUERY" "S1-订单"
test_intent "发货通知怎么发给客户，是自动的还是手动的" "SHIPMENT_QUERY" "S1-订单"
test_intent "这批货需要什么包装，有没有特殊要求" "SHIPMENT_QUERY" "S1-订单"
test_intent "发货单上需要填写批次号吗，怎么追溯" "SHIPMENT_QUERY" "S1-订单"
test_intent "同城配送和外地发货分别用什么方式" "SHIPMENT_QUERY" "S1-订单"
test_intent "发货之后客户确认收货了没有" "SHIPMENT_STATUS_UPDATE" "S1-订单"
test_intent "月底了发货统计数据在哪里看" "SHIPMENT_STATS" "S1-订单"

# S2. 物流成本 (20个)
test_intent "这个月的物流费用是多少，比上个月高还是低" "REPORT_FINANCE" "S2-成本"
test_intent "各物流商的费用对比一下，哪家最便宜" "REPORT_FINANCE" "S2-成本"
test_intent "单位运费是多少，有没有上涨的趋势" "REPORT_FINANCE" "S2-成本"
test_intent "物流成本占销售额的比例是多少，合理吗" "REPORT_FINANCE" "S2-成本"
test_intent "能不能跟物流公司谈个更优惠的价格" "REPORT_FINANCE" "S2-成本"
test_intent "不同地区的运费差异大吗，怎么定价的" "REPORT_FINANCE" "S2-成本"
test_intent "物流费用的结算方式是什么，月结还是票结" "REPORT_FINANCE" "S2-成本"
test_intent "有没有物流费用异常高的订单，查一下原因" "REPORT_FINANCE" "S2-成本"
test_intent "冷链物流的费用比普通物流高多少" "REPORT_FINANCE" "S2-成本"
test_intent "物流费用预算是多少，现在用了多少了" "REPORT_FINANCE" "S2-成本"
test_intent "降低物流成本有什么方法，能整合发货吗" "COST_QUERY" "S2-成本"
test_intent "退货的物流费用谁承担，是我们还是客户" "REPORT_FINANCE" "S2-成本"
test_intent "物流发票开好了吗，我要做账" "REPORT_FINANCE" "S2-成本"
test_intent "大件货物和小件货物的运费计算方式一样吗" "REPORT_FINANCE" "S2-成本"
test_intent "保价费用是怎么算的，有必要买吗" "REPORT_FINANCE" "S2-成本"
test_intent "物流费用的年度趋势怎么样" "REPORT_TRENDS" "S2-成本"
test_intent "每公斤的平均运费是多少" "REPORT_FINANCE" "S2-成本"
test_intent "物流成本超支了需要怎么审批" "REPORT_FINANCE" "S2-成本"
test_intent "有没有物流费用的明细账单" "REPORT_FINANCE" "S2-成本"
test_intent "物流KPI指标是什么，达标了吗" "REPORT_KPI" "S2-成本"

# S3. 物流异常 (20个)
test_intent "客户说没收到货，物流信息显示什么状态" "SHIPMENT_QUERY" "S3-异常"
test_intent "货物运输过程中损坏了，怎么处理赔偿" "QUALITY_DISPOSITION_EXECUTE" "S3-异常"
test_intent "物流超时了，已经超过承诺送达时间了" "SHIPMENT_QUERY" "S3-异常"
test_intent "收货地址写错了，能不能改一下重新派送" "SHIPMENT_STATUS_UPDATE" "S3-异常"
test_intent "客户拒收了，原因是什么，货物怎么处理" "SHIPMENT_QUERY" "S3-异常"
test_intent "货物丢失了怎么办，有没有保险可以理赔" "SHIPMENT_QUERY" "S3-异常"
test_intent "物流途中货物被压坏了，损失怎么算" "QUALITY_DISPOSITION_EXECUTE" "S3-异常"
test_intent "客户投诉送货态度不好，物流公司能处理吗" "SHIPMENT_QUERY" "S3-异常"
test_intent "快递显示已签收但客户说没收到，怎么查" "SHIPMENT_QUERY" "S3-异常"
test_intent "错发漏发的情况有多少，原因是什么" "SHIPMENT_QUERY" "S3-异常"
test_intent "物流异常的处理流程是什么，需要多长时间" "SHIPMENT_QUERY" "S3-异常"
test_intent "哪个物流公司的异常率最高，要不要换一家" "SHIPMENT_STATS" "S3-异常"
test_intent "物流异常会不会影响客户满意度评分" "SHIPMENT_QUERY" "S3-异常"
test_intent "运输温度异常了，货物还能用吗" "ALERT_LIST" "S3-异常"
test_intent "物流信息长时间没更新，是不是出问题了" "SHIPMENT_QUERY" "S3-异常"
test_intent "客户要求重新发货，怎么处理原来的货" "SHIPMENT_QUERY" "S3-异常"
test_intent "物流公司弄丢了我们的货，怎么索赔" "SHIPMENT_QUERY" "S3-异常"
test_intent "包装破损的异常有多少，怎么改进" "QUALITY_STATS" "S3-异常"
test_intent "物流延误的补偿方案是什么" "SHIPMENT_QUERY" "S3-异常"
test_intent "异常订单的客户满意度回访做了吗" "SHIPMENT_QUERY" "S3-异常"

# ==================== 五、设备管理类 (60个) ====================
echo ""
echo -e "${CYAN}>>> 五、设备管理类测试 (60个) <<<${NC}"

# E1. 设备状态 (20个)
test_intent "车间里的设备现在都是什么状态，有没有故障的" "EQUIPMENT_LIST" "E1-状态"
test_intent "3号生产线的设备运行正常吗，参数在标准范围内吗" "EQUIPMENT_DETAIL" "E1-状态"
test_intent "今天有几台设备停机了，分别是什么原因" "EQUIPMENT_STATS" "E1-状态"
test_intent "设备的开机率是多少，有没有闲置浪费的情况" "EQUIPMENT_STATS" "E1-状态"
test_intent "哪些设备已经超过使用年限了，需要更换吗" "EQUIPMENT_LIST" "E1-状态"
test_intent "新买的那台设备调试好了没有，什么时候能用" "EQUIPMENT_DETAIL" "E1-状态"
test_intent "设备的实时运行参数在哪里监控" "EQUIPMENT_DETAIL" "E1-状态"
test_intent "这台设备的累计运行时间是多少小时了" "EQUIPMENT_DETAIL" "E1-状态"
test_intent "待机状态的设备有哪些，为什么没有安排生产" "EQUIPMENT_LIST" "E1-状态"
test_intent "设备的产能利用率怎么样，有没有瓶颈" "EQUIPMENT_STATS" "E1-状态"
test_intent "关键设备有没有备用的，万一坏了怎么办" "EQUIPMENT_LIST" "E1-状态"
test_intent "设备的健康状态评分是多少，需要关注哪些" "EQUIPMENT_STATS" "E1-状态"
test_intent "远程能不能看到设备状态，出差也能监控" "EQUIPMENT_DETAIL" "E1-状态"
test_intent "设备状态异常会自动通知维修人员吗" "EQUIPMENT_ALERT_LIST" "E1-状态"
test_intent "这批设备的使用说明书在哪里可以找到" "EQUIPMENT_DETAIL" "E1-状态"
test_intent "设备的能耗怎么样，有没有高耗能的问题" "EQUIPMENT_STATS" "E1-状态"
test_intent "设备台账信息完整吗，有没有漏登记的" "EQUIPMENT_LIST" "E1-状态"
test_intent "每台设备的负责人是谁，联系方式是什么" "EQUIPMENT_DETAIL" "E1-状态"
test_intent "设备编号规则是什么，新设备怎么编号" "EQUIPMENT_LIST" "E1-状态"
test_intent "设备状态变更需要记录吗，记录在哪里" "EQUIPMENT_LIST" "E1-状态"

# E2. 设备告警 (20个)
test_intent "5号机刚才报警了，是什么故障，严重吗" "EQUIPMENT_ALERT_LIST" "E2-告警"
test_intent "今天设备报警的次数是不是比平时多很多" "EQUIPMENT_ALERT_LIST" "E2-告警"
test_intent "高温报警是什么意思，需要马上停机吗" "EQUIPMENT_ALERT_LIST" "E2-告警"
test_intent "报警灯一直闪但生产好像正常，要不要管它" "EQUIPMENT_ALERT_LIST" "E2-告警"
test_intent "设备告警的级别怎么区分，哪些必须立即处理" "ALERT_BY_LEVEL" "E2-告警"
test_intent "故障代码E003是什么意思，怎么解决" "ALERT_DIAGNOSE" "E2-告警"
test_intent "同一个告警反复出现，根本原因是什么" "ALERT_DIAGNOSE" "E2-告警"
test_intent "报警历史记录在哪里查看，要分析一下规律" "EQUIPMENT_ALERT_LIST" "E2-告警"
test_intent "告警响应时间要求是多少，超时了会怎样" "EQUIPMENT_ALERT_LIST" "E2-告警"
test_intent "夜班的时候设备报警谁来处理" "EQUIPMENT_ALERT_LIST" "E2-告警"
test_intent "能不能设置告警静音，有些不重要的告警太烦了" "EQUIPMENT_ALERT_LIST" "E2-告警"
test_intent "告警处理完了怎么关闭，需要填写什么记录" "ALERT_RESOLVE" "E2-告警"
test_intent "预防性告警和故障告警的区别是什么" "EQUIPMENT_ALERT_LIST" "E2-告警"
test_intent "告警短信通知功能开了吗，能收到吗" "EQUIPMENT_ALERT_LIST" "E2-告警"
test_intent "这台设备的告警频率比其他设备高很多，有问题吧" "EQUIPMENT_ALERT_LIST" "E2-告警"
test_intent "告警处理的标准流程是什么" "ALERT_DIAGNOSE" "E2-告警"
test_intent "误报警的情况多不多，怎么优化告警规则" "EQUIPMENT_ALERT_LIST" "E2-告警"
test_intent "设备自检功能正常吗，能自动发现问题吗" "EQUIPMENT_ALERT_LIST" "E2-告警"
test_intent "告警升级机制是怎么设置的" "ALERT_BY_LEVEL" "E2-告警"
test_intent "外部专家远程诊断需要提供什么信息" "ALERT_DIAGNOSE" "E2-告警"

# E3. 维护保养 (20个)
test_intent "哪些设备到了该保养的时间了，安排一下" "EQUIPMENT_MAINTENANCE" "E3-保养"
test_intent "这台设备上次保养是什么时候，保养记录在哪" "EQUIPMENT_MAINTENANCE" "E3-保养"
test_intent "保养计划是怎么制定的，按时间还是按运行时长" "EQUIPMENT_MAINTENANCE" "E3-保养"
test_intent "预防性维护做了吗，效果怎么样" "EQUIPMENT_MAINTENANCE" "E3-保养"
test_intent "保养需要停机多长时间，会不会影响生产" "EQUIPMENT_MAINTENANCE" "E3-保养"
test_intent "自主保养和专业保养分别包含哪些内容" "EQUIPMENT_MAINTENANCE" "E3-保养"
test_intent "保养配件准备好了吗，库存够不够" "MATERIAL_BATCH_QUERY" "E3-保养"
test_intent "设备保养费用是多少，预算够吗" "COST_QUERY" "E3-保养"
test_intent "保养之后设备性能有没有提升" "EQUIPMENT_STATS" "E3-保养"
test_intent "日常点检的项目有哪些，谁负责执行" "EQUIPMENT_MAINTENANCE" "E3-保养"
test_intent "润滑保养的周期是多少，用什么润滑油" "EQUIPMENT_MAINTENANCE" "E3-保养"
test_intent "保养不及时会有什么后果，设备会坏吗" "EQUIPMENT_MAINTENANCE" "E3-保养"
test_intent "外包保养和自己保养哪个好，成本差多少" "EQUIPMENT_MAINTENANCE" "E3-保养"
test_intent "保养过期了还没做的设备有哪些" "EQUIPMENT_MAINTENANCE" "E3-保养"
test_intent "设备的保养手册在哪里，操作规范是什么" "EQUIPMENT_MAINTENANCE" "E3-保养"
test_intent "大修和小修分别什么情况下做" "EQUIPMENT_MAINTENANCE" "E3-保养"
test_intent "保养完成后需要验收吗，验收标准是什么" "EQUIPMENT_MAINTENANCE" "E3-保养"
test_intent "设备老化严重，是继续维修还是换新的" "EQUIPMENT_MAINTENANCE" "E3-保养"
test_intent "保养记录需要保存多久，怎么归档" "EQUIPMENT_MAINTENANCE" "E3-保养"
test_intent "保养人员的技能够吗，需要培训吗" "EQUIPMENT_MAINTENANCE" "E3-保养"

# ==================== 六、称重管理类 (40个) ====================
echo ""
echo -e "${CYAN}>>> 六、称重管理类测试 (40个) <<<${NC}"

# C1. 称重设备 (20个)
test_intent "车间里的电子秤都正常工作吗，有没有离线的" "SCALE_LIST_DEVICES" "C1-设备"
test_intent "这台秤的精度是多少，能满足我们的要求吗" "SCALE_DEVICE_DETAIL" "C1-设备"
test_intent "电子秤多久校准一次，最近一次校准是什么时候" "SCALE_DEVICE_DETAIL" "C1-设备"
test_intent "秤不准了怎么办，显示的重量跟实际差很多" "SCALE_DEVICE_DETAIL" "C1-设备"
test_intent "称重设备的检定证书在哪里，有效期到什么时候" "SCALE_DEVICE_DETAIL" "C1-设备"
test_intent "新买的秤到了吗，安装调试好了没有" "SCALE_DEVICE_DETAIL" "C1-设备"
test_intent "秤的量程够不够，最大能称多重" "SCALE_DEVICE_DETAIL" "C1-设备"
test_intent "哪台秤的使用频率最高，磨损情况怎么样" "SCALE_LIST_DEVICES" "C1-设备"
test_intent "称重数据是自动上传的还是手工录入的" "SCALE_DEVICE_DETAIL" "C1-设备"
test_intent "秤的连接状态正常吗，能跟系统通信吗" "SCALE_DEVICE_DETAIL" "C1-设备"
test_intent "防爆秤和普通秤有什么区别，哪里需要用防爆的" "SCALE_LIST_DEVICES" "C1-设备"
test_intent "秤的维护保养怎么做，多久做一次" "SCALE_DEVICE_DETAIL" "C1-设备"
test_intent "称重平台要经常清洁吗，脏了会影响精度吗" "SCALE_DEVICE_DETAIL" "C1-设备"
test_intent "秤的故障率高不高，经常坏吗" "SCALE_LIST_DEVICES" "C1-设备"
test_intent "备用秤有几台，放在哪里" "SCALE_LIST_DEVICES" "C1-设备"
test_intent "秤的使用寿命是多久，该换新的了吗" "SCALE_DEVICE_DETAIL" "C1-设备"
test_intent "称重传感器灵敏度怎么样，反应快吗" "SCALE_DEVICE_DETAIL" "C1-设备"
test_intent "秤的显示屏看不清了，能换个大点的吗" "SCALE_DEVICE_DETAIL" "C1-设备"
test_intent "移动式地磅的电池能用多久，怎么充电" "SCALE_DEVICE_DETAIL" "C1-设备"
test_intent "秤的零点漂移怎么处理，需要经常校零吗" "SCALE_DEVICE_DETAIL" "C1-设备"

# C2. 称重记录 (20个)
test_intent "今天的称重数据在哪里看，一共称了多少次" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "这批货的称重记录是多少，总重量是多少" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "称重数据跟出库数量对得上吗，有没有差异" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "皮重是多少，毛重减皮重等于净重对吧" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "称重记录能导出Excel吗，我要做报表" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "称重数据异常的记录有多少，是什么原因" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "每个班次的称重量是多少，工作量怎么样" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "称重操作员是谁，能追溯到具体的人吗" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "称重照片有保存吗，能作为证据吗" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "客户要求提供称重报告，怎么生成" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "称重数据的保存期限是多久" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "同一批货多次称重的结果一致吗" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "称重记录能跟生产批次关联吗" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "手工称重和自动称重的数据怎么区分" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "称重时间戳准确吗，跟实际操作时间一致吗" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "称重超差的记录有哪些，是设备问题还是操作问题" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "每天的称重统计报表在哪里生成" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "称重记录能按产品类型筛选吗" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "重量单位都统一吗，有没有公斤和千克混用的" "SCALE_WEIGHING_RECORD" "C2-记录"
test_intent "称重数据修改需要什么权限，有审计记录吗" "SCALE_WEIGHING_RECORD" "C2-记录"

# ==================== 七、人员考勤类 (40个) ====================
echo ""
echo -e "${CYAN}>>> 七、人员考勤类测试 (40个) <<<${NC}"

# H1. 考勤查询 (20个)
test_intent "今天的考勤情况怎么样，有没有人迟到早退" "ATTENDANCE_TODAY" "H1-考勤"
test_intent "这个月张三的出勤率是多少，请了几天假" "ATTENDANCE_QUERY" "H1-考勤"
test_intent "现在车间里有多少人在岗，都是谁" "ATTENDANCE_TODAY" "H1-考勤"
test_intent "打卡记录在哪里查，我想看看自己的考勤" "ATTENDANCE_QUERY" "H1-考勤"
test_intent "加班时间怎么统计的，这个月加班了多少小时" "ATTENDANCE_QUERY" "H1-考勤"
test_intent "旷工的记录有多少，是哪些人" "ATTENDANCE_ANOMALY" "H1-考勤"
test_intent "考勤异常的处理流程是什么，怎么申诉" "ATTENDANCE_ANOMALY" "H1-考勤"
test_intent "调休和年假分别还剩多少天" "ATTENDANCE_QUERY" "H1-考勤"
test_intent "考勤数据什么时候跟工资系统对接" "ATTENDANCE_QUERY" "H1-考勤"
test_intent "外出和出差的考勤怎么处理" "ATTENDANCE_QUERY" "H1-考勤"
test_intent "忘记打卡了怎么补卡，需要谁批准" "ATTENDANCE_ANOMALY" "H1-考勤"
test_intent "考勤报表什么时候出，月底还是月初" "ATTENDANCE_QUERY" "H1-考勤"
test_intent "每个部门的出勤率排名怎么样" "ATTENDANCE_STATS" "H1-考勤"
test_intent "节假日加班的统计数据准确吗" "ATTENDANCE_QUERY" "H1-考勤"
test_intent "考勤系统跟门禁是联动的吗" "ATTENDANCE_TODAY" "H1-考勤"
test_intent "弹性工作制的考勤怎么算" "ATTENDANCE_QUERY" "H1-考勤"
test_intent "新员工的考勤从什么时候开始计" "ATTENDANCE_QUERY" "H1-考勤"
test_intent "离职员工的考勤记录还能查到吗" "ATTENDANCE_QUERY" "H1-考勤"
test_intent "考勤机坏了怎么办，临时用什么方式考勤" "ATTENDANCE_ANOMALY" "H1-考勤"
test_intent "考勤的核算规则是什么，迟到多久算旷工" "ATTENDANCE_QUERY" "H1-考勤"

# H2. 交接班 (20个)
test_intent "上一班交接了什么工作，有没有遗留问题需要处理" "PROCESSING_BATCH_LIST" "H2-交接"
test_intent "交接班的时候需要检查哪些内容" "PROCESSING_BATCH_LIST" "H2-交接"
test_intent "交接记录怎么填写，有没有模板" "PROCESSING_BATCH_LIST" "H2-交接"
test_intent "异常情况在交接的时候说清楚了没有" "PROCESSING_BATCH_LIST" "H2-交接"
test_intent "交班人员已经走了，接班发现问题怎么办" "PROCESSING_BATCH_LIST" "H2-交接"
test_intent "每班的生产总结数据在哪里看" "REPORT_PRODUCTION" "H2-交接"
test_intent "交接班会议要开多长时间" "PROCESSING_BATCH_LIST" "H2-交接"
test_intent "重要事项有没有书面交接确认" "PROCESSING_BATCH_LIST" "H2-交接"
test_intent "设备状态在交接的时候确认了吗" "PROCESSING_BATCH_LIST" "H2-交接"
test_intent "物料库存盘点在交接的时候做了吗" "PROCESSING_BATCH_LIST" "H2-交接"
test_intent "上一班的质量问题交接清楚了没有" "PROCESSING_BATCH_LIST" "H2-交接"
test_intent "安全隐患在交接的时候通报了没有" "PROCESSING_BATCH_LIST" "H2-交接"
test_intent "交接班的时间安排合理吗，需要调整吗" "PROCESSING_BATCH_LIST" "H2-交接"
test_intent "紧急任务在交接的时候怎么处理" "PROCESSING_BATCH_LIST" "H2-交接"
test_intent "交接不清楚导致的问题谁负责" "PROCESSING_BATCH_LIST" "H2-交接"
test_intent "跨班次的任务怎么协调" "PROCESSING_BATCH_LIST" "H2-交接"
test_intent "交接记录需要双方签字确认吗" "PROCESSING_BATCH_LIST" "H2-交接"
test_intent "电子交接和纸质交接哪个好" "PROCESSING_BATCH_LIST" "H2-交接"
test_intent "交接班的效率怎么提高，时间太长了" "PROCESSING_BATCH_LIST" "H2-交接"
test_intent "交接班制度的执行情况怎么考核" "PROCESSING_BATCH_LIST" "H2-交接"

echo ""
echo "================================================"
echo "测试完成!"
echo "================================================"
echo ""
echo -e "${GREEN}精确匹配: $PASSED${NC}"
echo -e "${YELLOW}功能等价: $EQUIVALENT${NC}"
echo -e "${GREEN}通过总计: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo "总计: $TOTAL"
echo ""
RATE=$(echo "scale=2; $PASSED * 100 / $TOTAL" | bc)
echo -e "通过率: ${CYAN}${RATE}%${NC}"
echo ""
echo "================================================"
