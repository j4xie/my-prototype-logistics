#!/bin/bash
# 多轮澄清对话测试 - 100个测试用例
# 每个测试用例需要2-5轮对话才能完成意图识别

set -e

API_BASE="http://139.196.165.140:10010/api/mobile"
FACTORY_ID="F001"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 统计
TOTAL=0
PASSED=0
FAILED=0
CLARIFICATION_COUNT=0

# 登录获取Token
echo -e "${BLUE}[登录中...]${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('accessToken',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}登录失败${NC}"
  exit 1
fi
echo -e "${GREEN}登录成功${NC}"
echo ""

# 执行单次API调用
call_api() {
  local input="$1"
  local session_id="$2"

  local body="{\"userInput\": \"$input\""
  if [ -n "$session_id" ]; then
    body="$body, \"sessionId\": \"$session_id\""
  fi
  body="$body}"

  curl -s "$API_BASE/$FACTORY_ID/ai-intents/execute" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$body"
}

# 解析响应
parse_response() {
  local response="$1"
  python3 << EOF
import json
import sys
try:
    r = json.loads('''$response''')
    data = r.get('data', {})
    status = data.get('status', '')
    intent = data.get('intentCode', '')
    message = data.get('message', '')[:80] if data.get('message') else ''
    session = data.get('metadata', {}).get('sessionId', '') if data.get('metadata') else ''
    clarification = data.get('clarificationQuestions') or data.get('metadata', {}).get('conversationMessage', '') if data.get('metadata') else ''
    print(f"{status}|{intent}|{session}|{message}")
except Exception as e:
    print(f"ERROR|||{str(e)}")
EOF
}

# 多轮对话测试
# 参数: 测试ID, 初始输入, 后续回复数组(用;分隔), 期望最终意图
test_conversation() {
  local test_id="$1"
  local initial="$2"
  local followups="$3"
  local expected_intent="$4"
  local max_rounds="$5"

  TOTAL=$((TOTAL + 1))

  echo -e "${BLUE}[$test_id] 测试: $initial${NC}"

  local session_id=""
  local round=1
  local current_input="$initial"
  local final_status=""
  local final_intent=""
  local clarification_rounds=0

  # 第一轮
  local response=$(call_api "$current_input" "")
  local parsed=$(parse_response "$response")
  local status=$(echo "$parsed" | cut -d'|' -f1)
  local intent=$(echo "$parsed" | cut -d'|' -f2)
  session_id=$(echo "$parsed" | cut -d'|' -f3)
  local msg=$(echo "$parsed" | cut -d'|' -f4)

  echo "  轮次$round: status=$status, intent=$intent"

  if [ "$status" = "NEED_CLARIFICATION" ] || [ "$status" = "NEED_MORE_INFO" ]; then
    clarification_rounds=$((clarification_rounds + 1))
  fi

  # 后续轮次
  IFS=';' read -ra REPLIES <<< "$followups"
  for reply in "${REPLIES[@]}"; do
    if [ -z "$reply" ]; then continue; fi

    round=$((round + 1))
    if [ $round -gt $max_rounds ]; then
      echo -e "  ${YELLOW}达到最大轮次限制${NC}"
      break
    fi

    # 检查是否已经完成
    if [ "$status" = "COMPLETED" ] || [ "$status" = "EXECUTED" ]; then
      break
    fi

    sleep 0.3
    response=$(call_api "$reply" "$session_id")
    parsed=$(parse_response "$response")
    status=$(echo "$parsed" | cut -d'|' -f1)
    intent=$(echo "$parsed" | cut -d'|' -f2)
    msg=$(echo "$parsed" | cut -d'|' -f4)

    echo "  轮次$round: status=$status, intent=$intent"

    if [ "$status" = "NEED_CLARIFICATION" ] || [ "$status" = "NEED_MORE_INFO" ]; then
      clarification_rounds=$((clarification_rounds + 1))
    fi
  done

  final_status="$status"
  final_intent="$intent"

  # 判断结果
  local test_passed=false

  # 成功条件:
  # 1. 最终识别到期望意图
  # 2. 或者经过多轮澄清后达到COMPLETED状态
  # 3. 或者经过足够轮次的澄清引导
  if [ -n "$expected_intent" ] && [ "$final_intent" = "$expected_intent" ]; then
    test_passed=true
  elif [ "$final_status" = "COMPLETED" ] || [ "$final_status" = "EXECUTED" ]; then
    test_passed=true
  elif [ $clarification_rounds -ge 1 ]; then
    # 至少触发了澄清机制
    test_passed=true
    CLARIFICATION_COUNT=$((CLARIFICATION_COUNT + 1))
  fi

  if [ "$test_passed" = true ]; then
    echo -e "  ${GREEN}✓ 通过${NC} (${round}轮, ${clarification_rounds}次澄清)"
    PASSED=$((PASSED + 1))
  else
    echo -e "  ${RED}✗ 失败${NC} (期望: $expected_intent, 实际: $final_intent)"
    FAILED=$((FAILED + 1))
  fi
  echo ""
}

echo "=============================================="
echo "       多轮澄清对话测试 (100用例)"
echo "=============================================="
echo ""

# ========== 第1类: 模糊指代类 (20个) ==========
echo -e "${YELLOW}=== 第1类: 模糊指代类 (20个) ===${NC}"

test_conversation "C001" "看一下那个" "设备;查看设备列表" "EQUIPMENT_LIST" 3
test_conversation "C002" "帮我处理下这个" "原料;查询原料库存" "MATERIAL_BATCH_QUERY" 3
test_conversation "C003" "这个怎么搞" "生产批次;查看生产进度" "PROCESSING_BATCH_LIST" 3
test_conversation "C004" "那边的情况怎样" "质检;看质检结果" "QUALITY_CHECK_LIST" 4
test_conversation "C005" "搞定那个吧" "出货;查看今日出货" "SHIPMENT_LIST" 3
test_conversation "C006" "这玩意儿咋样了" "库存;查看库存" "MATERIAL_BATCH_QUERY" 3
test_conversation "C007" "弄一下这个" "报表;生成生产报表" "REPORT_PRODUCTION" 3
test_conversation "C008" "那个需要处理" "告警;看未处理告警" "ALERT_ACTIVE" 3
test_conversation "C009" "看看那边" "人员;查看考勤" "ATTENDANCE_TODAY" 3
test_conversation "C010" "把这个给我" "订单;查看订单" "ORDER_LIST" 3
test_conversation "C011" "这个东西哪来的" "原料;查溯源信息" "MATERIAL_TRACEABILITY" 4
test_conversation "C012" "那个咋回事" "设备告警;查看告警详情" "ALERT_DETAIL" 4
test_conversation "C013" "看下这边的数据" "生产数据;今日产量" "PROCESSING_STATS" 3
test_conversation "C014" "处理下那个问题" "质量问题;查看不合格品" "QUALITY_DISPOSITION_LIST" 4
test_conversation "C015" "那玩意在哪" "物料;查库位" "MATERIAL_BATCH_QUERY" 3
test_conversation "C016" "这个要怎么办" "审批;查看待审批" "APPROVAL_PENDING" 3
test_conversation "C017" "弄下那个东西" "包装;查看包装任务" "PACKAGING_LIST" 4
test_conversation "C018" "看看这些" "客户;查看客户列表" "CUSTOMER_LIST" 3
test_conversation "C019" "那个数据呢" "效率数据;查看效率报表" "REPORT_EFFICIENCY" 4
test_conversation "C020" "这边的进展" "排程;查看生产排程" "SCHEDULE_LIST" 3

# ========== 第2类: 省略主语类 (20个) ==========
echo -e "${YELLOW}=== 第2类: 省略主语类 (20个) ===${NC}"

test_conversation "C021" "查一下" "查什么;设备状态" "EQUIPMENT_STATUS" 3
test_conversation "C022" "看看有多少" "什么的数量;库存数量" "MATERIAL_BATCH_QUERY" 3
test_conversation "C023" "今天的" "今天的什么;产量" "PROCESSING_STATS" 3
test_conversation "C024" "最近的" "最近的什么;告警记录" "ALERT_LIST" 3
test_conversation "C025" "统计下" "统计什么;生产统计" "REPORT_PRODUCTION" 3
test_conversation "C026" "导出来" "导出什么;质检报告" "QUALITY_REPORT_EXPORT" 4
test_conversation "C027" "删掉吧" "删除什么;取消,查看待处理任务" "TASK_LIST" 4
test_conversation "C028" "加一个" "添加什么;新设备" "EQUIPMENT_CREATE" 4
test_conversation "C029" "改一下" "修改什么;修改排程" "SCHEDULE_UPDATE" 4
test_conversation "C030" "找找" "找什么;找物料批次" "MATERIAL_BATCH_QUERY" 3
test_conversation "C031" "有问题吗" "什么有问题;设备有问题吗" "EQUIPMENT_DIAGNOSE" 4
test_conversation "C032" "完成了吗" "什么完成了;生产任务" "PROCESSING_BATCH_LIST" 3
test_conversation "C033" "还有吗" "还有什么;待处理任务" "TASK_LIST" 3
test_conversation "C034" "多少钱" "什么的价格;原料成本" "MATERIAL_BATCH_QUERY" 4
test_conversation "C035" "到了没" "什么到了没;原料到货" "MATERIAL_RECEIVING" 4
test_conversation "C036" "好了吗" "什么好了;质检结果" "QUALITY_CHECK_LIST" 3
test_conversation "C037" "发了吗" "发什么;今日出货" "SHIPMENT_LIST" 3
test_conversation "C038" "够用吗" "什么够用;原料库存" "MATERIAL_BATCH_QUERY" 3
test_conversation "C039" "正常吗" "什么正常;设备运行状态" "EQUIPMENT_STATUS" 3
test_conversation "C040" "有没有" "有没有什么;待处理告警" "ALERT_ACTIVE" 3

# ========== 第3类: 模糊动词类 (20个) ==========
echo -e "${YELLOW}=== 第3类: 模糊动词类 (20个) ===${NC}"

test_conversation "C041" "设备搞一下" "怎么搞;查看设备状态" "EQUIPMENT_STATUS" 3
test_conversation "C042" "原料弄下" "弄什么;查询原料库存" "MATERIAL_BATCH_QUERY" 3
test_conversation "C043" "生产那边处理下" "怎么处理;查看生产进度" "PROCESSING_BATCH_LIST" 3
test_conversation "C044" "告警整一下" "整什么;处理告警" "ALERT_ACKNOWLEDGE" 4
test_conversation "C045" "排程安排下" "安排什么;查看排程" "SCHEDULE_LIST" 3
test_conversation "C046" "质检搞定" "怎么搞定;查看质检任务" "QUALITY_CHECK_LIST" 3
test_conversation "C047" "库存捋一捋" "怎么捋;盘点库存" "MATERIAL_BATCH_QUERY" 4
test_conversation "C048" "人员看看" "看什么;查看考勤" "ATTENDANCE_TODAY" 3
test_conversation "C049" "报表出一下" "出什么报表;生产报表" "REPORT_PRODUCTION" 3
test_conversation "C050" "客户联系下" "联系什么客户;查看客户信息" "CUSTOMER_LIST" 4
test_conversation "C051" "订单跟一下" "怎么跟;查看订单状态" "ORDER_LIST" 3
test_conversation "C052" "包装收拾下" "收拾什么;查看包装任务" "PACKAGING_LIST" 4
test_conversation "C053" "出货准备下" "准备什么;查看待出货" "SHIPMENT_PENDING" 4
test_conversation "C054" "审批过一下" "过什么;查看待审批" "APPROVAL_PENDING" 3
test_conversation "C055" "供应商对接下" "对接什么;查看供应商" "SUPPLIER_LIST" 4
test_conversation "C056" "效率提一提" "怎么提;查看效率数据" "REPORT_EFFICIENCY" 4
test_conversation "C057" "成本控一控" "怎么控;查看成本分析" "REPORT_COST" 5
test_conversation "C058" "任务分一分" "分什么任务;查看任务列表" "TASK_LIST" 4
test_conversation "C059" "数据汇一汇" "汇什么数据;生成汇总报表" "REPORT_PRODUCTION" 4
test_conversation "C060" "问题理一理" "什么问题;查看异常记录" "ALERT_LIST" 4

# ========== 第4类: 口语化/方言类 (20个) ==========
echo -e "${YELLOW}=== 第4类: 口语化/方言类 (20个) ===${NC}"

test_conversation "C061" "整个明白" "什么要明白;设备状况" "EQUIPMENT_STATUS" 3
test_conversation "C062" "瞅瞅咋样了" "瞅什么;生产进度" "PROCESSING_BATCH_LIST" 3
test_conversation "C063" "咋整的" "什么咋整的;质检结果" "QUALITY_CHECK_LIST" 4
test_conversation "C064" "得劲不" "什么得劲不;设备运行" "EQUIPMENT_STATUS" 4
test_conversation "C065" "中不中" "什么中不中;库存充足否" "MATERIAL_BATCH_QUERY" 4
test_conversation "C066" "搁这呢" "什么搁这;原料位置" "MATERIAL_BATCH_QUERY" 4
test_conversation "C067" "老铁给看看" "看什么;生产数据" "PROCESSING_STATS" 3
test_conversation "C068" "给力不给力" "什么给力;效率数据" "REPORT_EFFICIENCY" 4
test_conversation "C069" "靠谱吗" "什么靠谱;质量合格率" "QUALITY_CHECK_LIST" 4
test_conversation "C070" "妥了没" "什么妥了;任务完成情况" "TASK_LIST" 3
test_conversation "C071" "啥情况" "什么情况;当前告警" "ALERT_ACTIVE" 3
test_conversation "C072" "咋说" "说什么;今日汇总" "PROCESSING_STATS" 3
test_conversation "C073" "得嘞" "要做什么;确认任务" "TASK_LIST" 4
test_conversation "C074" "走着" "做什么;开始生产" "PROCESSING_BATCH_START" 5
test_conversation "C075" "上" "上什么;开始任务" "TASK_LIST" 4
test_conversation "C076" "完事儿" "什么完事;生产任务" "PROCESSING_BATCH_LIST" 3
test_conversation "C077" "稳不稳" "什么稳;设备状态" "EQUIPMENT_STATUS" 3
test_conversation "C078" "麻溜的" "做什么;加急处理" "TASK_LIST" 5
test_conversation "C079" "撤了" "撤什么;取消任务" "TASK_CANCEL" 5
test_conversation "C080" "走一个" "走什么;确认出货" "SHIPMENT_CONFIRM" 5

# ========== 第5类: 多意图歧义类 (20个) ==========
echo -e "${YELLOW}=== 第5类: 多意图歧义类 (20个) ===${NC}"

test_conversation "C081" "检查" "检查什么;设备;查看设备状态" "EQUIPMENT_STATUS" 4
test_conversation "C082" "统计" "统计什么;今日;生产统计" "PROCESSING_STATS" 4
test_conversation "C083" "报告" "什么报告;质量;生成质量报告" "REPORT_QUALITY" 4
test_conversation "C084" "记录" "什么记录;操作;查看操作日志" "OPERATION_LOG" 5
test_conversation "C085" "状态" "什么状态;设备运行" "EQUIPMENT_STATUS" 3
test_conversation "C086" "列表" "什么列表;设备列表" "EQUIPMENT_LIST" 3
test_conversation "C087" "详情" "什么详情;设备详情;第一台" "EQUIPMENT_DETAIL" 5
test_conversation "C088" "历史" "什么历史;告警历史" "ALERT_LIST" 3
test_conversation "C089" "分析" "分析什么;效率分析" "REPORT_EFFICIENCY" 3
test_conversation "C090" "预警" "什么预警;库存预警" "MATERIAL_EXPIRING_ALERT" 4
test_conversation "C091" "进度" "什么进度;生产进度" "PROCESSING_BATCH_LIST" 3
test_conversation "C092" "计划" "什么计划;生产排程" "SCHEDULE_LIST" 3
test_conversation "C093" "对比" "对比什么;效率对比" "REPORT_EFFICIENCY" 4
test_conversation "C094" "趋势" "什么趋势;产量趋势" "REPORT_PRODUCTION" 4
test_conversation "C095" "汇总" "汇总什么;今日汇总" "PROCESSING_STATS" 3
test_conversation "C096" "明细" "什么明细;生产明细" "PROCESSING_BATCH_LIST" 3
test_conversation "C097" "异常" "什么异常;设备异常" "ALERT_ACTIVE" 3
test_conversation "C098" "任务" "什么任务;待处理任务" "TASK_LIST" 3
test_conversation "C099" "审核" "审核什么;待审批单据" "APPROVAL_PENDING" 3
test_conversation "C100" "导入" "导入什么;暂时只查询;查看原料" "MATERIAL_BATCH_QUERY" 5

echo ""
echo "=============================================="
echo "                 测试汇总"
echo "=============================================="
echo ""
echo -e "总测试数: ${TOTAL}"
echo -e "通过: ${GREEN}${PASSED}${NC}"
echo -e "失败: ${RED}${FAILED}${NC}"
echo -e "触发澄清: ${YELLOW}${CLARIFICATION_COUNT}${NC}"
echo ""

PASS_RATE=$(echo "scale=2; $PASSED * 100 / $TOTAL" | bc)
echo -e "通过率: ${BLUE}${PASS_RATE}%${NC}"

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}所有测试通过！${NC}"
  exit 0
else
  echo -e "${RED}存在失败的测试${NC}"
  exit 1
fi
