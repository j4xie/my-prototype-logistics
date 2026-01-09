#!/bin/bash

# ================================================
# 意图识别系统 v4.0 测试 - 500个新用例
# ================================================

API_BASE="http://139.196.165.140:10010/api/mobile"
FACTORY_ID="F001"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 统计变量
PASSED=0
FAILED=0
TOTAL=0

# 获取Token
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  意图识别系统 v4.0 测试 - 500个用例${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}[INFO] 登录获取Token...${NC}"

LOGIN_RESP=$(curl -s -X POST "${API_BASE}/auth/unified-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"factory_admin1","password":"123456"}')

TOKEN=$(echo "$LOGIN_RESP" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)

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
    -d "{\"userInput\":\"$input\"}" | grep -o '"intentCode":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -z "$result" ]; then
    result="NONE"
  fi

  if [ "$result" = "$expected" ]; then
    ((PASSED++))
    echo -e "${GREEN}✓${NC} [$category] $input → $result"
  else
    ((FAILED++))
    echo -e "${RED}✗${NC} [$category] $input → Got: $result, Expected: $expected"
  fi
}

echo "================================================"
echo "开始测试..."
echo "================================================"
echo ""

# ==================== 设备类 (50个) ====================
echo -e "${YELLOW}=== 设备管理 (50) ===${NC}"

# EQUIPMENT_LIST (15)
test_intent "显示设备清单" "EQUIPMENT_LIST" "设备"
test_intent "我想看看设备" "EQUIPMENT_LIST" "设备"
test_intent "调出设备信息" "EQUIPMENT_LIST" "设备"
test_intent "有多少台设备" "EQUIPMENT_LIST" "设备"
test_intent "展示全部机器" "EQUIPMENT_LIST" "设备"
test_intent "获取设备数据" "EQUIPMENT_LIST" "设备"
test_intent "看一下设备" "EQUIPMENT_LIST" "设备"
test_intent "设备汇总" "EQUIPMENT_LIST" "设备"
test_intent "机器都有什么" "EQUIPMENT_LIST" "设备"
test_intent "车间里有几台设备" "EQUIPMENT_LIST" "设备"
test_intent "给我设备数量" "EQUIPMENT_LIST" "设备"
test_intent "机台一览" "EQUIPMENT_LIST" "设备"
test_intent "厂里设备" "EQUIPMENT_LIST" "设备"
test_intent "生产设备情况" "EQUIPMENT_LIST" "设备"
test_intent "工厂机器汇总" "EQUIPMENT_LIST" "设备"

# EQUIPMENT_DETAIL (10)
test_intent "设备详细信息" "EQUIPMENT_DETAIL" "设备"
test_intent "查看某台设备" "EQUIPMENT_DETAIL" "设备"
test_intent "设备具体参数" "EQUIPMENT_DETAIL" "设备"
test_intent "机器详情" "EQUIPMENT_DETAIL" "设备"
test_intent "设备规格" "EQUIPMENT_DETAIL" "设备"
test_intent "某个设备的信息" "EQUIPMENT_DETAIL" "设备"
test_intent "设备基本情况" "EQUIPMENT_DETAIL" "设备"
test_intent "机台详细资料" "EQUIPMENT_DETAIL" "设备"
test_intent "设备型号查询" "EQUIPMENT_DETAIL" "设备"
test_intent "具体设备状态" "EQUIPMENT_DETAIL" "设备"

# EQUIPMENT_START (5)
test_intent "把设备打开" "EQUIPMENT_START" "设备"
test_intent "开启机器" "EQUIPMENT_START" "设备"
test_intent "设备上电" "EQUIPMENT_START" "设备"
test_intent "启用设备" "EQUIPMENT_START" "设备"
test_intent "让设备运转起来" "EQUIPMENT_START" "设备"

# EQUIPMENT_STOP (5)
test_intent "把设备关了" "EQUIPMENT_STOP" "设备"
test_intent "机器停下来" "EQUIPMENT_STOP" "设备"
test_intent "关掉设备" "EQUIPMENT_STOP" "设备"
test_intent "设备下电" "EQUIPMENT_STOP" "设备"
test_intent "让机器停止运转" "EQUIPMENT_STOP" "设备"

# EQUIPMENT_STATS (5)
test_intent "设备使用率" "EQUIPMENT_STATS" "设备"
test_intent "机器运行统计" "EQUIPMENT_STATS" "设备"
test_intent "设备效率数据" "EQUIPMENT_STATS" "设备"
test_intent "设备运行时长统计" "EQUIPMENT_STATS" "设备"
test_intent "机器利用率" "EQUIPMENT_STATS" "设备"

# EQUIPMENT_ALERT_LIST (5)
test_intent "设备有什么问题" "EQUIPMENT_ALERT_LIST" "设备"
test_intent "机器报警信息" "EQUIPMENT_ALERT_LIST" "设备"
test_intent "设备异常汇总" "EQUIPMENT_ALERT_LIST" "设备"
test_intent "哪些设备有故障" "EQUIPMENT_ALERT_LIST" "设备"
test_intent "机器警告列表" "EQUIPMENT_ALERT_LIST" "设备"

# EQUIPMENT_MAINTENANCE (5)
test_intent "设备该保养了" "EQUIPMENT_MAINTENANCE" "设备"
test_intent "机器维修计划" "EQUIPMENT_MAINTENANCE" "设备"
test_intent "设备保养记录" "EQUIPMENT_MAINTENANCE" "设备"
test_intent "机台维护情况" "EQUIPMENT_MAINTENANCE" "设备"
test_intent "设备检修安排" "EQUIPMENT_MAINTENANCE" "设备"

# ==================== 电子秤类 (40个) ====================
echo ""
echo -e "${YELLOW}=== 电子秤管理 (40) ===${NC}"

# SCALE_LIST_DEVICES (15)
test_intent "看看有哪些秤" "SCALE_LIST_DEVICES" "秤"
test_intent "称重设备清单" "SCALE_LIST_DEVICES" "秤"
test_intent "工厂里的秤" "SCALE_LIST_DEVICES" "秤"
test_intent "IoT秤列表" "SCALE_LIST_DEVICES" "秤"
test_intent "智能秤有几个" "SCALE_LIST_DEVICES" "秤"
test_intent "物联网秤" "SCALE_LIST_DEVICES" "秤"
test_intent "所有称重设备" "SCALE_LIST_DEVICES" "秤"
test_intent "地磅列表" "SCALE_LIST_DEVICES" "秤"
test_intent "台秤清单" "SCALE_LIST_DEVICES" "秤"
test_intent "我们有多少秤" "SCALE_LIST_DEVICES" "秤"
test_intent "电子称一览" "SCALE_LIST_DEVICES" "秤"
test_intent "看下秤的情况" "SCALE_LIST_DEVICES" "秤"
test_intent "称重设备汇总" "SCALE_LIST_DEVICES" "秤"
test_intent "秤都在哪里" "SCALE_LIST_DEVICES" "秤"
test_intent "称重器材列表" "SCALE_LIST_DEVICES" "秤"

# SCALE_DEVICE_DETAIL (10)
test_intent "秤的详细信息" "SCALE_DEVICE_DETAIL" "秤"
test_intent "查看某个秤" "SCALE_DEVICE_DETAIL" "秤"
test_intent "秤的参数" "SCALE_DEVICE_DETAIL" "秤"
test_intent "这个秤的状态" "SCALE_DEVICE_DETAIL" "秤"
test_intent "秤具体是什么型号" "SCALE_DEVICE_DETAIL" "秤"
test_intent "秤的精度" "SCALE_DEVICE_DETAIL" "秤"
test_intent "秤的量程" "SCALE_DEVICE_DETAIL" "秤"
test_intent "秤连接状态" "SCALE_DEVICE_DETAIL" "秤"
test_intent "秤在线吗" "SCALE_DEVICE_DETAIL" "秤"
test_intent "秤是否正常" "SCALE_DEVICE_DETAIL" "秤"

# SCALE_ADD_DEVICE (5)
test_intent "新增一个秤" "SCALE_ADD_DEVICE" "秤"
test_intent "添加称重设备" "SCALE_ADD_DEVICE" "秤"
test_intent "注册新秤" "SCALE_ADD_DEVICE" "秤"
test_intent "录入电子秤" "SCALE_ADD_DEVICE" "秤"
test_intent "接入一台秤" "SCALE_ADD_DEVICE" "秤"

# SCALE_UPDATE_DEVICE (5)
test_intent "修改秤配置" "SCALE_UPDATE_DEVICE" "秤"
test_intent "更新秤参数" "SCALE_UPDATE_DEVICE" "秤"
test_intent "调整秤设置" "SCALE_UPDATE_DEVICE" "秤"
test_intent "秤信息变更" "SCALE_UPDATE_DEVICE" "秤"
test_intent "编辑秤资料" "SCALE_UPDATE_DEVICE" "秤"

# SCALE_DELETE_DEVICE (5)
test_intent "删掉这个秤" "SCALE_DELETE_DEVICE" "秤"
test_intent "移除秤设备" "SCALE_DELETE_DEVICE" "秤"
test_intent "把秤去掉" "SCALE_DELETE_DEVICE" "秤"
test_intent "注销秤" "SCALE_DELETE_DEVICE" "秤"
test_intent "秤不用了删除" "SCALE_DELETE_DEVICE" "秤"

# ==================== 告警类 (45个) ====================
echo ""
echo -e "${YELLOW}=== 告警管理 (45) ===${NC}"

# ALERT_LIST (10)
test_intent "有什么告警" "ALERT_LIST" "告警"
test_intent "系统警报" "ALERT_LIST" "告警"
test_intent "预警信息汇总" "ALERT_LIST" "告警"
test_intent "异常提醒" "ALERT_LIST" "告警"
test_intent "所有报警" "ALERT_LIST" "告警"
test_intent "警报都有哪些" "ALERT_LIST" "告警"
test_intent "告警清单" "ALERT_LIST" "告警"
test_intent "报警汇总" "ALERT_LIST" "告警"
test_intent "系统异常列表" "ALERT_LIST" "告警"
test_intent "预警消息" "ALERT_LIST" "告警"

# ALERT_ACTIVE (10)
test_intent "正在报警的" "ALERT_ACTIVE" "告警"
test_intent "现在有哪些告警" "ALERT_ACTIVE" "告警"
test_intent "当前的异常" "ALERT_ACTIVE" "告警"
test_intent "实时告警" "ALERT_ACTIVE" "告警"
test_intent "进行中的警报" "ALERT_ACTIVE" "告警"
test_intent "还没处理的告警" "ALERT_ACTIVE" "告警"
test_intent "待解决的告警" "ALERT_ACTIVE" "告警"
test_intent "未关闭的警报" "ALERT_ACTIVE" "告警"
test_intent "正在发生的异常" "ALERT_ACTIVE" "告警"
test_intent "活动中的告警" "ALERT_ACTIVE" "告警"

# ALERT_ACKNOWLEDGE (5)
test_intent "确认收到告警" "ALERT_ACKNOWLEDGE" "告警"
test_intent "我知道这个告警了" "ALERT_ACKNOWLEDGE" "告警"
test_intent "标记告警已读" "ALERT_ACKNOWLEDGE" "告警"
test_intent "告警我看到了" "ALERT_ACKNOWLEDGE" "告警"
test_intent "确认这个警报" "ALERT_ACKNOWLEDGE" "告警"

# ALERT_RESOLVE (5)
test_intent "告警已处理" "ALERT_RESOLVE" "告警"
test_intent "关闭这个告警" "ALERT_RESOLVE" "告警"
test_intent "问题已解决" "ALERT_RESOLVE" "告警"
test_intent "告警可以关了" "ALERT_RESOLVE" "告警"
test_intent "完成告警处理" "ALERT_RESOLVE" "告警"

# ALERT_STATS (5)
test_intent "告警统计数据" "ALERT_STATS" "告警"
test_intent "报警次数统计" "ALERT_STATS" "告警"
test_intent "告警趋势" "ALERT_STATS" "告警"
test_intent "异常发生频率" "ALERT_STATS" "告警"
test_intent "警报数量分析" "ALERT_STATS" "告警"

# ALERT_BY_LEVEL (5)
test_intent "严重告警" "ALERT_BY_LEVEL" "告警"
test_intent "高级别警报" "ALERT_BY_LEVEL" "告警"
test_intent "紧急告警" "ALERT_BY_LEVEL" "告警"
test_intent "一般性告警" "ALERT_BY_LEVEL" "告警"
test_intent "按严重程度看告警" "ALERT_BY_LEVEL" "告警"

# ALERT_DIAGNOSE (5)
test_intent "分析告警原因" "ALERT_DIAGNOSE" "告警"
test_intent "告警怎么回事" "ALERT_DIAGNOSE" "告警"
test_intent "为什么会报警" "ALERT_DIAGNOSE" "告警"
test_intent "诊断这个异常" "ALERT_DIAGNOSE" "告警"
test_intent "告警根因分析" "ALERT_DIAGNOSE" "告警"

# ==================== 考勤类 (40个) ====================
echo ""
echo -e "${YELLOW}=== 考勤管理 (40) ===${NC}"

# CLOCK_IN (10)
test_intent "我来上班了" "CLOCK_IN" "考勤"
test_intent "签个到" "CLOCK_IN" "考勤"
test_intent "记录上班" "CLOCK_IN" "考勤"
test_intent "开始工作" "CLOCK_IN" "考勤"
test_intent "打个卡" "CLOCK_IN" "考勤"
test_intent "到岗了" "CLOCK_IN" "考勤"
test_intent "我到了" "CLOCK_IN" "考勤"
test_intent "报到" "CLOCK_IN" "考勤"
test_intent "上工" "CLOCK_IN" "考勤"
test_intent "来上班打卡" "CLOCK_IN" "考勤"

# CLOCK_OUT (10)
test_intent "我要走了" "CLOCK_OUT" "考勤"
test_intent "下班签退" "CLOCK_OUT" "考勤"
test_intent "结束工作" "CLOCK_OUT" "考勤"
test_intent "收工打卡" "CLOCK_OUT" "考勤"
test_intent "离开公司" "CLOCK_OUT" "考勤"
test_intent "退勤" "CLOCK_OUT" "考勤"
test_intent "我先撤了" "CLOCK_OUT" "考勤"
test_intent "今天干完了" "CLOCK_OUT" "考勤"
test_intent "回家打卡" "CLOCK_OUT" "考勤"
test_intent "下班了帮我签退" "CLOCK_OUT" "考勤"

# ATTENDANCE_TODAY (5)
test_intent "今天谁来了" "ATTENDANCE_TODAY" "考勤"
test_intent "当天出勤" "ATTENDANCE_TODAY" "考勤"
test_intent "今日到岗情况" "ATTENDANCE_TODAY" "考勤"
test_intent "今天的打卡" "ATTENDANCE_TODAY" "考勤"
test_intent "本日考勤" "ATTENDANCE_TODAY" "考勤"

# ATTENDANCE_HISTORY (5)
test_intent "过去的打卡记录" "ATTENDANCE_HISTORY" "考勤"
test_intent "以前的考勤" "ATTENDANCE_HISTORY" "考勤"
test_intent "查查出勤历史" "ATTENDANCE_HISTORY" "考勤"
test_intent "签到签退记录" "ATTENDANCE_HISTORY" "考勤"
test_intent "之前的打卡情况" "ATTENDANCE_HISTORY" "考勤"

# ATTENDANCE_STATS (5)
test_intent "出勤率统计" "ATTENDANCE_STATS" "考勤"
test_intent "考勤数据分析" "ATTENDANCE_STATS" "考勤"
test_intent "打卡统计" "ATTENDANCE_STATS" "考勤"
test_intent "员工出勤情况统计" "ATTENDANCE_STATS" "考勤"
test_intent "考勤汇总数据" "ATTENDANCE_STATS" "考勤"

# ATTENDANCE_ANOMALY (5)
test_intent "谁迟到了" "ATTENDANCE_ANOMALY" "考勤"
test_intent "考勤异常人员" "ATTENDANCE_ANOMALY" "考勤"
test_intent "缺勤情况" "ATTENDANCE_ANOMALY" "考勤"
test_intent "早退记录" "ATTENDANCE_ANOMALY" "考勤"
test_intent "旷工人员" "ATTENDANCE_ANOMALY" "考勤"

# ==================== 生产批次类 (45个) ====================
echo ""
echo -e "${YELLOW}=== 生产批次 (45) ===${NC}"

# PROCESSING_BATCH_LIST (10)
test_intent "生产任务列表" "PROCESSING_BATCH_LIST" "生产"
test_intent "所有生产批次" "PROCESSING_BATCH_LIST" "生产"
test_intent "加工任务汇总" "PROCESSING_BATCH_LIST" "生产"
test_intent "正在生产的批次" "PROCESSING_BATCH_LIST" "生产"
test_intent "生产计划列表" "PROCESSING_BATCH_LIST" "生产"
test_intent "批次都有哪些" "PROCESSING_BATCH_LIST" "生产"
test_intent "生产订单" "PROCESSING_BATCH_LIST" "生产"
test_intent "今天的生产批次" "PROCESSING_BATCH_LIST" "生产"
test_intent "车间生产情况" "PROCESSING_BATCH_LIST" "生产"
test_intent "全部批次信息" "PROCESSING_BATCH_LIST" "生产"

# PROCESSING_BATCH_DETAIL (5)
test_intent "这个批次的详情" "PROCESSING_BATCH_DETAIL" "生产"
test_intent "批次具体信息" "PROCESSING_BATCH_DETAIL" "生产"
test_intent "某个批次的状态" "PROCESSING_BATCH_DETAIL" "生产"
test_intent "批次进度查询" "PROCESSING_BATCH_DETAIL" "生产"
test_intent "查看批次资料" "PROCESSING_BATCH_DETAIL" "生产"

# PROCESSING_BATCH_CREATE (5)
test_intent "新建生产任务" "PROCESSING_BATCH_CREATE" "生产"
test_intent "创建加工批次" "PROCESSING_BATCH_CREATE" "生产"
test_intent "开一个新批次" "PROCESSING_BATCH_CREATE" "生产"
test_intent "登记生产批次" "PROCESSING_BATCH_CREATE" "生产"
test_intent "安排生产任务" "PROCESSING_BATCH_CREATE" "生产"

# PROCESSING_BATCH_START (5)
test_intent "批次开始生产" "PROCESSING_BATCH_START" "生产"
test_intent "启动这个批次" "PROCESSING_BATCH_START" "生产"
test_intent "开工" "PROCESSING_BATCH_START" "生产"
test_intent "生产任务开始" "PROCESSING_BATCH_START" "生产"
test_intent "批次上线生产" "PROCESSING_BATCH_START" "生产"

# PROCESSING_BATCH_PAUSE (5)
test_intent "批次暂停一下" "PROCESSING_BATCH_PAUSE" "生产"
test_intent "先停一下生产" "PROCESSING_BATCH_PAUSE" "生产"
test_intent "暂时中止生产" "PROCESSING_BATCH_PAUSE" "生产"
test_intent "生产任务暂停" "PROCESSING_BATCH_PAUSE" "生产"
test_intent "批次挂起" "PROCESSING_BATCH_PAUSE" "生产"

# PROCESSING_BATCH_RESUME (5)
test_intent "继续生产" "PROCESSING_BATCH_RESUME" "生产"
test_intent "批次恢复运行" "PROCESSING_BATCH_RESUME" "生产"
test_intent "重新开始生产" "PROCESSING_BATCH_RESUME" "生产"
test_intent "批次取消暂停" "PROCESSING_BATCH_RESUME" "生产"
test_intent "恢复加工任务" "PROCESSING_BATCH_RESUME" "生产"

# PROCESSING_BATCH_COMPLETE (5)
test_intent "批次生产完了" "PROCESSING_BATCH_COMPLETE" "生产"
test_intent "完成这个批次" "PROCESSING_BATCH_COMPLETE" "生产"
test_intent "生产任务结束" "PROCESSING_BATCH_COMPLETE" "生产"
test_intent "批次完工" "PROCESSING_BATCH_COMPLETE" "生产"
test_intent "加工完成" "PROCESSING_BATCH_COMPLETE" "生产"

# PROCESSING_BATCH_CANCEL (5)
test_intent "取消这个批次" "PROCESSING_BATCH_CANCEL" "生产"
test_intent "作废生产任务" "PROCESSING_BATCH_CANCEL" "生产"
test_intent "批次不做了" "PROCESSING_BATCH_CANCEL" "生产"
test_intent "撤销批次" "PROCESSING_BATCH_CANCEL" "生产"
test_intent "删除这个生产计划" "PROCESSING_BATCH_CANCEL" "生产"

# ==================== 出货类 (40个) ====================
echo ""
echo -e "${YELLOW}=== 出货管理 (40) ===${NC}"

# SHIPMENT_QUERY (10)
test_intent "查一下出货" "SHIPMENT_QUERY" "出货"
test_intent "发货记录查询" "SHIPMENT_QUERY" "出货"
test_intent "出货订单" "SHIPMENT_QUERY" "出货"
test_intent "看看发了什么货" "SHIPMENT_QUERY" "出货"
test_intent "物流订单查询" "SHIPMENT_QUERY" "出货"
test_intent "出货情况如何" "SHIPMENT_QUERY" "出货"
test_intent "配送订单" "SHIPMENT_QUERY" "出货"
test_intent "发货单查询" "SHIPMENT_QUERY" "出货"
test_intent "查询出货信息" "SHIPMENT_QUERY" "出货"
test_intent "看下发货" "SHIPMENT_QUERY" "出货"

# SHIPMENT_CREATE (10)
test_intent "新建出货单" "SHIPMENT_CREATE" "出货"
test_intent "安排一批发货" "SHIPMENT_CREATE" "出货"
test_intent "创建发货任务" "SHIPMENT_CREATE" "出货"
test_intent "登记出货" "SHIPMENT_CREATE" "出货"
test_intent "录入发货单" "SHIPMENT_CREATE" "出货"
test_intent "准备发货" "SHIPMENT_CREATE" "出货"
test_intent "开一张出货单" "SHIPMENT_CREATE" "出货"
test_intent "新增发货记录" "SHIPMENT_CREATE" "出货"
test_intent "发个货" "SHIPMENT_CREATE" "出货"
test_intent "安排出货" "SHIPMENT_CREATE" "出货"

# SHIPMENT_STATS (5)
test_intent "发货数量统计" "SHIPMENT_STATS" "出货"
test_intent "出货量分析" "SHIPMENT_STATS" "出货"
test_intent "发货报表" "SHIPMENT_STATS" "出货"
test_intent "本月出货统计" "SHIPMENT_STATS" "出货"
test_intent "发货数据汇总" "SHIPMENT_STATS" "出货"

# SHIPMENT_BY_DATE (5)
test_intent "今天发了多少货" "SHIPMENT_BY_DATE" "出货"
test_intent "昨天的发货" "SHIPMENT_BY_DATE" "出货"
test_intent "本周出货" "SHIPMENT_BY_DATE" "出货"
test_intent "某天的发货记录" "SHIPMENT_BY_DATE" "出货"
test_intent "按日期查出货" "SHIPMENT_BY_DATE" "出货"

# SHIPMENT_BY_CUSTOMER (5)
test_intent "某个客户的出货" "SHIPMENT_BY_CUSTOMER" "出货"
test_intent "给谁发过货" "SHIPMENT_BY_CUSTOMER" "出货"
test_intent "客户发货记录" "SHIPMENT_BY_CUSTOMER" "出货"
test_intent "查某客户的发货" "SHIPMENT_BY_CUSTOMER" "出货"
test_intent "发给这个客户的货" "SHIPMENT_BY_CUSTOMER" "出货"

# SHIPMENT_UPDATE (5)
test_intent "修改发货单" "SHIPMENT_UPDATE" "出货"
test_intent "更新出货信息" "SHIPMENT_UPDATE" "出货"
test_intent "变更发货内容" "SHIPMENT_UPDATE" "出货"
test_intent "调整出货数量" "SHIPMENT_UPDATE" "出货"
test_intent "编辑发货记录" "SHIPMENT_UPDATE" "出货"

# ==================== 原料类 (40个) ====================
echo ""
echo -e "${YELLOW}=== 原料管理 (40) ===${NC}"

# MATERIAL_BATCH_QUERY (10)
test_intent "原料有哪些" "MATERIAL_BATCH_QUERY" "原料"
test_intent "物料批次" "MATERIAL_BATCH_QUERY" "原料"
test_intent "查看原材料" "MATERIAL_BATCH_QUERY" "原料"
test_intent "原料库存情况" "MATERIAL_BATCH_QUERY" "原料"
test_intent "物料信息" "MATERIAL_BATCH_QUERY" "原料"
test_intent "原料批次列表" "MATERIAL_BATCH_QUERY" "原料"
test_intent "仓库原料" "MATERIAL_BATCH_QUERY" "原料"
test_intent "材料清单" "MATERIAL_BATCH_QUERY" "原料"
test_intent "原料数量" "MATERIAL_BATCH_QUERY" "原料"
test_intent "原材料库存" "MATERIAL_BATCH_QUERY" "原料"

# MATERIAL_LOW_STOCK_ALERT (5)
test_intent "哪些原料快没了" "MATERIAL_LOW_STOCK_ALERT" "原料"
test_intent "库存不足预警" "MATERIAL_LOW_STOCK_ALERT" "原料"
test_intent "原料缺货" "MATERIAL_LOW_STOCK_ALERT" "原料"
test_intent "物料低库存" "MATERIAL_LOW_STOCK_ALERT" "原料"
test_intent "需要补货的原料" "MATERIAL_LOW_STOCK_ALERT" "原料"

# MATERIAL_EXPIRING_ALERT (5)
test_intent "哪些原料快过期" "MATERIAL_EXPIRING_ALERT" "原料"
test_intent "即将到期的物料" "MATERIAL_EXPIRING_ALERT" "原料"
test_intent "原料保质期预警" "MATERIAL_EXPIRING_ALERT" "原料"
test_intent "快要过期的材料" "MATERIAL_EXPIRING_ALERT" "原料"
test_intent "临期原料" "MATERIAL_EXPIRING_ALERT" "原料"

# MATERIAL_EXPIRED_QUERY (5)
test_intent "过期的原料" "MATERIAL_EXPIRED_QUERY" "原料"
test_intent "已失效物料" "MATERIAL_EXPIRED_QUERY" "原料"
test_intent "超期原材料" "MATERIAL_EXPIRED_QUERY" "原料"
test_intent "过了保质期的" "MATERIAL_EXPIRED_QUERY" "原料"
test_intent "不能用的原料" "MATERIAL_EXPIRED_QUERY" "原料"

# MATERIAL_BATCH_RESERVE (5)
test_intent "预留一批原料" "MATERIAL_BATCH_RESERVE" "原料"
test_intent "锁定这批物料" "MATERIAL_BATCH_RESERVE" "原料"
test_intent "原料占用" "MATERIAL_BATCH_RESERVE" "原料"
test_intent "保留材料" "MATERIAL_BATCH_RESERVE" "原料"
test_intent "预定原料" "MATERIAL_BATCH_RESERVE" "原料"

# MATERIAL_FIFO_RECOMMEND (5)
test_intent "先进先出推荐" "MATERIAL_FIFO_RECOMMEND" "原料"
test_intent "应该用哪批原料" "MATERIAL_FIFO_RECOMMEND" "原料"
test_intent "FIFO原料推荐" "MATERIAL_FIFO_RECOMMEND" "原料"
test_intent "哪批原料该先用" "MATERIAL_FIFO_RECOMMEND" "原料"
test_intent "推荐使用的原料" "MATERIAL_FIFO_RECOMMEND" "原料"

# MATERIAL_ADJUST_QUANTITY (5)
test_intent "调整原料数量" "MATERIAL_ADJUST_QUANTITY" "原料"
test_intent "修改库存" "MATERIAL_ADJUST_QUANTITY" "原料"
test_intent "盘点调整" "MATERIAL_ADJUST_QUANTITY" "原料"
test_intent "原料数量变更" "MATERIAL_ADJUST_QUANTITY" "原料"
test_intent "校正物料数量" "MATERIAL_ADJUST_QUANTITY" "原料"

# ==================== 质检类 (35个) ====================
echo ""
echo -e "${YELLOW}=== 质量检测 (35) ===${NC}"

# QUALITY_CHECK_QUERY (10)
test_intent "质检项目" "QUALITY_CHECK_QUERY" "质检"
test_intent "检验项目有哪些" "QUALITY_CHECK_QUERY" "质检"
test_intent "质量检查项" "QUALITY_CHECK_QUERY" "质检"
test_intent "检测标准" "QUALITY_CHECK_QUERY" "质检"
test_intent "质检指标" "QUALITY_CHECK_QUERY" "质检"
test_intent "查看质检项" "QUALITY_CHECK_QUERY" "质检"
test_intent "检验内容" "QUALITY_CHECK_QUERY" "质检"
test_intent "质量要求" "QUALITY_CHECK_QUERY" "质检"
test_intent "检查什么" "QUALITY_CHECK_QUERY" "质检"
test_intent "品质检验项目" "QUALITY_CHECK_QUERY" "质检"

# QUALITY_CHECK_EXECUTE (10)
test_intent "执行质检" "QUALITY_CHECK_EXECUTE" "质检"
test_intent "开始检验" "QUALITY_CHECK_EXECUTE" "质检"
test_intent "做质量检查" "QUALITY_CHECK_EXECUTE" "质检"
test_intent "进行质检" "QUALITY_CHECK_EXECUTE" "质检"
test_intent "检验这批货" "QUALITY_CHECK_EXECUTE" "质检"
test_intent "质量检测" "QUALITY_CHECK_EXECUTE" "质检"
test_intent "做个检验" "QUALITY_CHECK_EXECUTE" "质检"
test_intent "检查产品质量" "QUALITY_CHECK_EXECUTE" "质检"
test_intent "品质检验" "QUALITY_CHECK_EXECUTE" "质检"
test_intent "质检操作" "QUALITY_CHECK_EXECUTE" "质检"

# QUALITY_STATS (5)
test_intent "质检合格率" "QUALITY_STATS" "质检"
test_intent "质量统计" "QUALITY_STATS" "质检"
test_intent "检验数据分析" "QUALITY_STATS" "质检"
test_intent "质检通过率" "QUALITY_STATS" "质检"
test_intent "品质数据" "QUALITY_STATS" "质检"

# QUALITY_DISPOSITION_EXECUTE (5)
test_intent "处理不合格品" "QUALITY_DISPOSITION_EXECUTE" "质检"
test_intent "不良品处置" "QUALITY_DISPOSITION_EXECUTE" "质检"
test_intent "次品怎么处理" "QUALITY_DISPOSITION_EXECUTE" "质检"
test_intent "质量问题处置" "QUALITY_DISPOSITION_EXECUTE" "质检"
test_intent "执行处置方案" "QUALITY_DISPOSITION_EXECUTE" "质检"

# QUALITY_CRITICAL_ITEMS (5)
test_intent "关键质检项" "QUALITY_CRITICAL_ITEMS" "质检"
test_intent "重要检验指标" "QUALITY_CRITICAL_ITEMS" "质检"
test_intent "核心质量点" "QUALITY_CRITICAL_ITEMS" "质检"
test_intent "主要质检内容" "QUALITY_CRITICAL_ITEMS" "质检"
test_intent "关键品质要求" "QUALITY_CRITICAL_ITEMS" "质检"

# ==================== 报表类 (35个) ====================
echo ""
echo -e "${YELLOW}=== 报表分析 (35) ===${NC}"

# REPORT_DASHBOARD_OVERVIEW (7)
test_intent "数据看板" "REPORT_DASHBOARD_OVERVIEW" "报表"
test_intent "总体概况" "REPORT_DASHBOARD_OVERVIEW" "报表"
test_intent "综合报表" "REPORT_DASHBOARD_OVERVIEW" "报表"
test_intent "首页数据" "REPORT_DASHBOARD_OVERVIEW" "报表"
test_intent "整体情况" "REPORT_DASHBOARD_OVERVIEW" "报表"
test_intent "大屏展示" "REPORT_DASHBOARD_OVERVIEW" "报表"
test_intent "汇总看板" "REPORT_DASHBOARD_OVERVIEW" "报表"

# REPORT_PRODUCTION (7)
test_intent "生产报表" "REPORT_PRODUCTION" "报表"
test_intent "产量数据" "REPORT_PRODUCTION" "报表"
test_intent "生产统计报告" "REPORT_PRODUCTION" "报表"
test_intent "产出报表" "REPORT_PRODUCTION" "报表"
test_intent "加工数据报表" "REPORT_PRODUCTION" "报表"
test_intent "生产情况报告" "REPORT_PRODUCTION" "报表"
test_intent "产能报表" "REPORT_PRODUCTION" "报表"

# REPORT_INVENTORY (7)
test_intent "库存报表" "REPORT_INVENTORY" "报表"
test_intent "库存数据" "REPORT_INVENTORY" "报表"
test_intent "存货报告" "REPORT_INVENTORY" "报表"
test_intent "仓储报表" "REPORT_INVENTORY" "报表"
test_intent "库存汇总" "REPORT_INVENTORY" "报表"
test_intent "物料库存报表" "REPORT_INVENTORY" "报表"
test_intent "库存分析报告" "REPORT_INVENTORY" "报表"

# REPORT_QUALITY (7)
test_intent "质量报表" "REPORT_QUALITY" "报表"
test_intent "品质数据报告" "REPORT_QUALITY" "报表"
test_intent "质检报表" "REPORT_QUALITY" "报表"
test_intent "合格率报表" "REPORT_QUALITY" "报表"
test_intent "质量分析报告" "REPORT_QUALITY" "报表"
test_intent "检验报表" "REPORT_QUALITY" "报表"
test_intent "品质报告" "REPORT_QUALITY" "报表"

# REPORT_EFFICIENCY (7)
test_intent "效率报表" "REPORT_EFFICIENCY" "报表"
test_intent "产能利用率" "REPORT_EFFICIENCY" "报表"
test_intent "生产效率分析" "REPORT_EFFICIENCY" "报表"
test_intent "设备效率报告" "REPORT_EFFICIENCY" "报表"
test_intent "OEE报表" "REPORT_EFFICIENCY" "报表"
test_intent "效率数据" "REPORT_EFFICIENCY" "报表"
test_intent "效率分析报告" "REPORT_EFFICIENCY" "报表"

# ==================== 客户类 (30个) ====================
echo ""
echo -e "${YELLOW}=== 客户管理 (30) ===${NC}"

# CUSTOMER_LIST (7)
test_intent "客户名单" "CUSTOMER_LIST" "客户"
test_intent "所有客户" "CUSTOMER_LIST" "客户"
test_intent "客户清单" "CUSTOMER_LIST" "客户"
test_intent "客户资料" "CUSTOMER_LIST" "客户"
test_intent "合作客户" "CUSTOMER_LIST" "客户"
test_intent "客户都有谁" "CUSTOMER_LIST" "客户"
test_intent "客户档案" "CUSTOMER_LIST" "客户"

# CUSTOMER_SEARCH (6)
test_intent "找客户" "CUSTOMER_SEARCH" "客户"
test_intent "搜索客户" "CUSTOMER_SEARCH" "客户"
test_intent "查找某个客户" "CUSTOMER_SEARCH" "客户"
test_intent "客户检索" "CUSTOMER_SEARCH" "客户"
test_intent "根据名字找客户" "CUSTOMER_SEARCH" "客户"
test_intent "客户筛选" "CUSTOMER_SEARCH" "客户"

# CUSTOMER_ACTIVE (5)
test_intent "活跃的客户" "CUSTOMER_ACTIVE" "客户"
test_intent "最近下单的客户" "CUSTOMER_ACTIVE" "客户"
test_intent "有交易的客户" "CUSTOMER_ACTIVE" "客户"
test_intent "常来的客户" "CUSTOMER_ACTIVE" "客户"
test_intent "活跃客户列表" "CUSTOMER_ACTIVE" "客户"

# CUSTOMER_STATS (6)
test_intent "客户数据统计" "CUSTOMER_STATS" "客户"
test_intent "客户分析" "CUSTOMER_STATS" "客户"
test_intent "客户数量" "CUSTOMER_STATS" "客户"
test_intent "客户分布" "CUSTOMER_STATS" "客户"
test_intent "客户增长情况" "CUSTOMER_STATS" "客户"
test_intent "客户汇总数据" "CUSTOMER_STATS" "客户"

# CUSTOMER_PURCHASE_HISTORY (6)
test_intent "客户购买记录" "CUSTOMER_PURCHASE_HISTORY" "客户"
test_intent "客户订单历史" "CUSTOMER_PURCHASE_HISTORY" "客户"
test_intent "客户采购记录" "CUSTOMER_PURCHASE_HISTORY" "客户"
test_intent "这个客户买过什么" "CUSTOMER_PURCHASE_HISTORY" "客户"
test_intent "客户交易历史" "CUSTOMER_PURCHASE_HISTORY" "客户"
test_intent "客户消费记录" "CUSTOMER_PURCHASE_HISTORY" "客户"

# ==================== 供应商类 (25个) ====================
echo ""
echo -e "${YELLOW}=== 供应商管理 (25) ===${NC}"

# SUPPLIER_LIST (5)
test_intent "供应商名单" "SUPPLIER_LIST" "供应商"
test_intent "所有供应商" "SUPPLIER_LIST" "供应商"
test_intent "供货商清单" "SUPPLIER_LIST" "供应商"
test_intent "合作供应商" "SUPPLIER_LIST" "供应商"
test_intent "供应商都有哪些" "SUPPLIER_LIST" "供应商"

# SUPPLIER_SEARCH (5)
test_intent "找供应商" "SUPPLIER_SEARCH" "供应商"
test_intent "搜索供货商" "SUPPLIER_SEARCH" "供应商"
test_intent "查找某个供应商" "SUPPLIER_SEARCH" "供应商"
test_intent "供应商检索" "SUPPLIER_SEARCH" "供应商"
test_intent "筛选供应商" "SUPPLIER_SEARCH" "供应商"

# SUPPLIER_ACTIVE (5)
test_intent "活跃供应商" "SUPPLIER_ACTIVE" "供应商"
test_intent "最近供货的" "SUPPLIER_ACTIVE" "供应商"
test_intent "有往来的供应商" "SUPPLIER_ACTIVE" "供应商"
test_intent "常合作的供货商" "SUPPLIER_ACTIVE" "供应商"
test_intent "活跃供货方" "SUPPLIER_ACTIVE" "供应商"

# SUPPLIER_RANKING (5)
test_intent "供应商排名" "SUPPLIER_RANKING" "供应商"
test_intent "供货商评分" "SUPPLIER_RANKING" "供应商"
test_intent "供应商排行" "SUPPLIER_RANKING" "供应商"
test_intent "最佳供应商" "SUPPLIER_RANKING" "供应商"
test_intent "供应商等级" "SUPPLIER_RANKING" "供应商"

# SUPPLIER_EVALUATE (5)
test_intent "评价供应商" "SUPPLIER_EVALUATE" "供应商"
test_intent "供应商考核" "SUPPLIER_EVALUATE" "供应商"
test_intent "供货商评估" "SUPPLIER_EVALUATE" "供应商"
test_intent "供应商打分" "SUPPLIER_EVALUATE" "供应商"
test_intent "考评供应商" "SUPPLIER_EVALUATE" "供应商"

# ==================== 用户管理类 (20个) ====================
echo ""
echo -e "${YELLOW}=== 用户管理 (20) ===${NC}"

# USER_CREATE (7)
test_intent "新建用户" "USER_CREATE" "用户"
test_intent "添加员工账号" "USER_CREATE" "用户"
test_intent "注册新用户" "USER_CREATE" "用户"
test_intent "创建账号" "USER_CREATE" "用户"
test_intent "开通用户" "USER_CREATE" "用户"
test_intent "新增系统用户" "USER_CREATE" "用户"
test_intent "录入新员工" "USER_CREATE" "用户"

# USER_DISABLE (7)
test_intent "禁用这个用户" "USER_DISABLE" "用户"
test_intent "停用账号" "USER_DISABLE" "用户"
test_intent "冻结用户" "USER_DISABLE" "用户"
test_intent "关闭账号" "USER_DISABLE" "用户"
test_intent "用户停权" "USER_DISABLE" "用户"
test_intent "暂停这个用户" "USER_DISABLE" "用户"
test_intent "封禁账号" "USER_DISABLE" "用户"

# USER_ROLE_ASSIGN (6)
test_intent "给用户分配角色" "USER_ROLE_ASSIGN" "用户"
test_intent "设置用户权限" "USER_ROLE_ASSIGN" "用户"
test_intent "调整用户角色" "USER_ROLE_ASSIGN" "用户"
test_intent "授予角色" "USER_ROLE_ASSIGN" "用户"
test_intent "变更用户权限" "USER_ROLE_ASSIGN" "用户"
test_intent "角色分配" "USER_ROLE_ASSIGN" "用户"

# ==================== 溯源类 (15个) ====================
echo ""
echo -e "${YELLOW}=== 溯源追踪 (15) ===${NC}"

# TRACE_BATCH (5)
test_intent "追踪这个批次" "TRACE_BATCH" "溯源"
test_intent "批次来源" "TRACE_BATCH" "溯源"
test_intent "批次追溯" "TRACE_BATCH" "溯源"
test_intent "查批次流向" "TRACE_BATCH" "溯源"
test_intent "批次从哪来" "TRACE_BATCH" "溯源"

# TRACE_FULL (5)
test_intent "全链路追溯" "TRACE_FULL" "溯源"
test_intent "完整溯源信息" "TRACE_FULL" "溯源"
test_intent "从头到尾追踪" "TRACE_FULL" "溯源"
test_intent "全流程追溯" "TRACE_FULL" "溯源"
test_intent "端到端溯源" "TRACE_FULL" "溯源"

# TRACE_PUBLIC (5)
test_intent "生成溯源码" "TRACE_PUBLIC" "溯源"
test_intent "公开溯源信息" "TRACE_PUBLIC" "溯源"
test_intent "消费者可查的溯源" "TRACE_PUBLIC" "溯源"
test_intent "对外溯源" "TRACE_PUBLIC" "溯源"
test_intent "产品溯源二维码" "TRACE_PUBLIC" "溯源"

# ==================== 系统配置类 (20个) ====================
echo ""
echo -e "${YELLOW}=== 系统配置 (20) ===${NC}"

# SCHEDULING_SET_AUTO (5)
test_intent "开启自动排产" "SCHEDULING_SET_AUTO" "系统"
test_intent "排产改为自动" "SCHEDULING_SET_AUTO" "系统"
test_intent "自动化排程" "SCHEDULING_SET_AUTO" "系统"
test_intent "智能排产" "SCHEDULING_SET_AUTO" "系统"
test_intent "启用自动排产" "SCHEDULING_SET_AUTO" "系统"

# SCHEDULING_SET_MANUAL (5)
test_intent "改为人工排产" "SCHEDULING_SET_MANUAL" "系统"
test_intent "手动排产模式" "SCHEDULING_SET_MANUAL" "系统"
test_intent "排产需要确认" "SCHEDULING_SET_MANUAL" "系统"
test_intent "人工确认排程" "SCHEDULING_SET_MANUAL" "系统"
test_intent "半自动排产" "SCHEDULING_SET_MANUAL" "系统"

# FACTORY_FEATURE_TOGGLE (5)
test_intent "开关某个功能" "FACTORY_FEATURE_TOGGLE" "系统"
test_intent "启用功能" "FACTORY_FEATURE_TOGGLE" "系统"
test_intent "禁用功能" "FACTORY_FEATURE_TOGGLE" "系统"
test_intent "功能开关设置" "FACTORY_FEATURE_TOGGLE" "系统"
test_intent "切换功能状态" "FACTORY_FEATURE_TOGGLE" "系统"

# RULE_CONFIG (5)
test_intent "配置规则" "RULE_CONFIG" "系统"
test_intent "规则设置" "RULE_CONFIG" "系统"
test_intent "业务规则配置" "RULE_CONFIG" "系统"
test_intent "修改规则" "RULE_CONFIG" "系统"
test_intent "规则管理" "RULE_CONFIG" "系统"

# ==================== LLM兜底测试 (20个) ====================
echo ""
echo -e "${YELLOW}=== LLM兜底测试 (20) ===${NC}"

# 这些是模糊查询，期望LLM能正确理解并返回合适的意图
test_intent "厂里现在什么情况" "REPORT_DASHBOARD_OVERVIEW" "LLM"
test_intent "给我看看数据" "REPORT_DASHBOARD_OVERVIEW" "LLM"
test_intent "最近怎么样" "REPORT_DASHBOARD_OVERVIEW" "LLM"
test_intent "产线运转正常吗" "EQUIPMENT_LIST" "LLM"
test_intent "原材料够用吗" "MATERIAL_LOW_STOCK_ALERT" "LLM"
test_intent "有没有什么问题" "ALERT_ACTIVE" "LLM"
test_intent "今天生产了多少" "REPORT_PRODUCTION" "LLM"
test_intent "品质怎么样" "QUALITY_STATS" "LLM"
test_intent "谁在上班" "ATTENDANCE_TODAY" "LLM"
test_intent "发出去多少货了" "SHIPMENT_STATS" "LLM"
test_intent "库存够不够" "REPORT_INVENTORY" "LLM"
test_intent "机器有问题吗" "EQUIPMENT_ALERT_LIST" "LLM"
test_intent "效率怎么样" "REPORT_EFFICIENCY" "LLM"
test_intent "有没有要过期的" "MATERIAL_EXPIRING_ALERT" "LLM"
test_intent "客户满意度如何" "CUSTOMER_STATS" "LLM"
test_intent "供应商表现怎样" "SUPPLIER_RANKING" "LLM"
test_intent "生产进度如何" "PROCESSING_BATCH_LIST" "LLM"
test_intent "异常情况汇报" "ALERT_LIST" "LLM"
test_intent "今天忙不忙" "REPORT_DASHBOARD_OVERVIEW" "LLM"
test_intent "有什么需要处理的" "ALERT_ACTIVE" "LLM"

echo ""
echo "================================================"
echo -e "${BLUE}测试完成!${NC}"
echo "================================================"
echo ""
echo -e "总计: ${TOTAL}"
echo -e "${GREEN}通过: ${PASSED}${NC}"
echo -e "${RED}失败: ${FAILED}${NC}"
echo ""

if [ $TOTAL -gt 0 ]; then
  PASS_RATE=$(echo "scale=2; $PASSED * 100 / $TOTAL" | bc)
  echo -e "通过率: ${PASS_RATE}%"
fi
