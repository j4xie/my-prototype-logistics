#!/bin/bash

# ================================================
# 意图识别系统 v5.0 测试 - 470个全新用例
# 覆盖11个类别: A-K (L类已移除-意图不存在)
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
TOTAL=0

# 分类统计已移除（bash不支持中文key）

# 获取Token
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  意图识别系统 v5.0 测试 - 470个用例${NC}"
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

# ==================== A类: 精确短语匹配 (50个) ====================
echo -e "${CYAN}=== A类: 精确短语匹配测试 (50) ===${NC}"

# 发货类 (10)
test_intent "帮我查下发货情况" "SHIPMENT_QUERY" "A-发货"
test_intent "看看发货记录" "SHIPMENT_QUERY" "A-发货"
test_intent "最近的发货单" "SHIPMENT_QUERY" "A-发货"
test_intent "出货情况汇总" "SHIPMENT_QUERY" "A-发货"
test_intent "发货明细查询" "SHIPMENT_QUERY" "A-发货"
test_intent "物流配送记录" "SHIPMENT_QUERY" "A-发货"
test_intent "今天的发货" "SHIPMENT_BY_DATE" "A-发货"
test_intent "昨天发了多少货" "SHIPMENT_BY_DATE" "A-发货"
test_intent "本周发货统计" "SHIPMENT_BY_DATE" "A-发货"
test_intent "上个月的出货量" "SHIPMENT_BY_DATE" "A-发货"

# 生产类 (10)
test_intent "今日生产进度" "DAILY_PRODUCTION_QUERY" "A-生产"
test_intent "当天产量多少" "DAILY_PRODUCTION_QUERY" "A-生产"
test_intent "今天做了多少" "DAILY_PRODUCTION_QUERY" "A-生产"
test_intent "正在生产的批次" "PROCESSING_BATCH_LIST" "A-生产"
test_intent "生产订单列表" "PROCESSING_BATCH_LIST" "A-生产"
test_intent "车间生产情况" "PROCESSING_BATCH_LIST" "A-生产"
test_intent "全部批次信息" "PROCESSING_BATCH_LIST" "A-生产"
test_intent "登记生产批次" "PROCESSING_BATCH_CREATE" "A-生产"
test_intent "安排生产任务" "PROCESSING_BATCH_CREATE" "A-生产"
test_intent "新建生产批次" "PROCESSING_BATCH_CREATE" "A-生产"

# 原料类 (10)
test_intent "原料批次列表" "MATERIAL_BATCH_QUERY" "A-原料"
test_intent "物料库存情况" "MATERIAL_BATCH_QUERY" "A-原料"
test_intent "仓库原料查询" "MATERIAL_BATCH_QUERY" "A-原料"
test_intent "材料清单汇总" "MATERIAL_BATCH_QUERY" "A-原料"
test_intent "原料数量统计" "MATERIAL_BATCH_QUERY" "A-原料"
test_intent "物料批次明细" "MATERIAL_BATCH_QUERY" "A-原料"
test_intent "库存不足预警" "MATERIAL_LOW_STOCK_ALERT" "A-原料"
test_intent "即将到期的物料" "MATERIAL_EXPIRING_ALERT" "A-原料"
test_intent "已失效物料" "MATERIAL_EXPIRED_QUERY" "A-原料"
test_intent "应该用哪批原料" "MATERIAL_FIFO_RECOMMEND" "A-原料"

# 质检类 (10)
test_intent "检验数据分析" "QUALITY_STATS" "A-质检"
test_intent "品质怎么样" "QUALITY_STATS" "A-质检"
test_intent "质量统计报告" "QUALITY_STATS" "A-质检"
test_intent "做质量检查" "QUALITY_CHECK_EXECUTE" "A-质检"
test_intent "检查产品质量" "QUALITY_CHECK_EXECUTE" "A-质检"
test_intent "执行质检流程" "QUALITY_CHECK_EXECUTE" "A-质检"
test_intent "处理不合格品" "QUALITY_DISPOSITION_EXECUTE" "A-质检"
test_intent "次品怎么处理" "QUALITY_DISPOSITION_EXECUTE" "A-质检"
test_intent "不合格品处理" "QUALITY_DISPOSITION_EXECUTE" "A-质检"
test_intent "质检记录查询" "QUALITY_CHECK_QUERY" "A-质检"

# 秤设备类 (10)
test_intent "电子秤列表" "SCALE_LIST_DEVICES" "A-秤"
test_intent "称重记录查询" "SCALE_RECORD_QUERY" "A-秤"
test_intent "秤的详细状态" "SCALE_DEVICE_DETAIL" "A-秤"
test_intent "读取秤重量" "SCALE_DEVICE_DETAIL" "A-秤"
test_intent "看看有哪些秤" "SCALE_LIST_DEVICES" "A-秤"
test_intent "称重设备清单" "SCALE_LIST_DEVICES" "A-秤"
test_intent "IoT秤管理" "SCALE_LIST_DEVICES" "A-秤"
test_intent "秤的称重数据" "SCALE_DATA_QUERY" "A-秤"
test_intent "最近称重记录" "SCALE_RECORD_QUERY" "A-秤"
test_intent "秤设备概览" "SCALE_LIST_DEVICES" "A-秤"

# ==================== B类: 关键词匹配+负向词 (80个) ====================
echo ""
echo -e "${CYAN}=== B类: 关键词匹配+负向词测试 (80) ===${NC}"

# B001-020: 秤类负向词排除DELETE (20)
test_intent "秤有几个" "SCALE_LIST_DEVICES" "B-秤"
test_intent "智能秤有哪些" "SCALE_LIST_DEVICES" "B-秤"
test_intent "查看所有秤" "SCALE_LIST_DEVICES" "B-秤"
test_intent "列出全部秤" "SCALE_LIST_DEVICES" "B-秤"
test_intent "秤的清单" "SCALE_LIST_DEVICES" "B-秤"
test_intent "工厂有多少秤" "SCALE_LIST_DEVICES" "B-秤"
test_intent "称重设备一览" "SCALE_LIST_DEVICES" "B-秤"
test_intent "秤设备统计" "SCALE_LIST_DEVICES" "B-秤"
test_intent "现有的秤" "SCALE_LIST_DEVICES" "B-秤"
test_intent "可用的秤列表" "SCALE_LIST_DEVICES" "B-秤"
test_intent "在线的秤" "SCALE_LIST_DEVICES" "B-秤"
test_intent "秤都有什么" "SCALE_LIST_DEVICES" "B-秤"
test_intent "哪些秤在用" "SCALE_LIST_DEVICES" "B-秤"
test_intent "秤设备总数" "SCALE_LIST_DEVICES" "B-秤"
test_intent "联网的秤" "SCALE_LIST_DEVICES" "B-秤"
test_intent "秤的数量" "SCALE_LIST_DEVICES" "B-秤"
test_intent "查秤" "SCALE_LIST_DEVICES" "B-秤"
test_intent "看秤" "SCALE_LIST_DEVICES" "B-秤"
test_intent "秤列表" "SCALE_LIST_DEVICES" "B-秤"
test_intent "所有秤" "SCALE_LIST_DEVICES" "B-秤"

# B021-040: 告警类负向词排除ACKNOWLEDGE (20)
test_intent "待处理的告警" "ALERT_ACTIVE" "B-告警"
test_intent "未解决的警报" "ALERT_ACTIVE" "B-告警"
test_intent "活跃告警" "ALERT_ACTIVE" "B-告警"
test_intent "当前告警" "ALERT_ACTIVE" "B-告警"
test_intent "正在发生的警报" "ALERT_ACTIVE" "B-告警"
test_intent "进行中的告警" "ALERT_ACTIVE" "B-告警"
test_intent "未处理告警" "ALERT_ACTIVE" "B-告警"
test_intent "最新告警" "ALERT_ACTIVE" "B-告警"
test_intent "实时告警" "ALERT_ACTIVE" "B-告警"
test_intent "紧急告警" "ALERT_ACTIVE" "B-告警"
test_intent "还有什么告警" "ALERT_ACTIVE" "B-告警"
test_intent "现有告警" "ALERT_ACTIVE" "B-告警"
test_intent "待解决警报" "ALERT_ACTIVE" "B-告警"
test_intent "尚未关闭的告警" "ALERT_ACTIVE" "B-告警"
test_intent "今日告警" "ALERT_ACTIVE" "B-告警"
test_intent "告警情况" "ALERT_QUERY" "B-告警"
test_intent "告警统计" "ALERT_STATS" "B-告警"
test_intent "历史告警" "ALERT_HISTORY" "B-告警"
test_intent "告警记录" "ALERT_QUERY" "B-告警"
test_intent "告警列表" "ALERT_LIST" "B-告警"

# B041-060: 原料类负向词排除RESERVE (20)
test_intent "原料清单" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "物料统计" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "查询原料" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "原料有哪些" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "查看物料" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "原料库存查询" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "物料列表" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "原料汇总" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "材料情况" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "原料总量" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "仓库物料" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "原料概览" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "物料明细" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "原料状态" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "物料数据" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "原料信息" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "查原料" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "看原料" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "原料批次" "MATERIAL_BATCH_QUERY" "B-原料"
test_intent "物料批次" "MATERIAL_BATCH_QUERY" "B-原料"

# B061-080: 多关键词组合递减收益 (20)
test_intent "设备状态和告警" "EQUIPMENT_STATUS_QUERY" "B-组合"
test_intent "生产批次进度" "PROCESSING_BATCH_LIST" "B-组合"
test_intent "原料库存预警" "MATERIAL_LOW_STOCK_ALERT" "B-组合"
test_intent "质检结果统计" "QUALITY_STATS" "B-组合"
test_intent "发货记录查询" "SHIPMENT_QUERY" "B-组合"
test_intent "设备运行统计" "EQUIPMENT_STATS" "B-组合"
test_intent "生产效率报表" "REPORT_PRODUCTION" "B-组合"
test_intent "原料批次追溯" "MATERIAL_BATCH_QUERY" "B-组合"
test_intent "质量检测报告" "QUALITY_CHECK_QUERY" "B-组合"
test_intent "发货物流状态" "SHIPMENT_QUERY" "B-组合"
test_intent "设备维护计划" "EQUIPMENT_MAINTENANCE_QUERY" "B-组合"
test_intent "生产计划安排" "PROCESSING_BATCH_CREATE" "B-组合"
test_intent "原料入库记录" "MATERIAL_INBOUND_QUERY" "B-组合"
test_intent "质检不合格处理" "QUALITY_DISPOSITION_EXECUTE" "B-组合"
test_intent "发货订单明细" "SHIPMENT_QUERY" "B-组合"
test_intent "设备故障告警" "EQUIPMENT_ALERT_QUERY" "B-组合"
test_intent "生产完成情况" "PROCESSING_BATCH_LIST" "B-组合"
test_intent "原料消耗统计" "MATERIAL_BATCH_QUERY" "B-组合"
test_intent "质量趋势分析" "QUALITY_STATS" "B-组合"
test_intent "发货时间统计" "SHIPMENT_BY_DATE" "B-组合"

# ==================== C类: 语义相似度测试 (60个) ====================
echo ""
echo -e "${CYAN}=== C类: 语义相似度测试 (60) ===${NC}"

# C001-015: 同义词变体 (15)
test_intent "发运记录" "SHIPMENT_QUERY" "C-同义"
test_intent "送货单" "SHIPMENT_QUERY" "C-同义"
test_intent "出库单" "SHIPMENT_QUERY" "C-同义"
test_intent "配送单" "SHIPMENT_QUERY" "C-同义"
test_intent "运输记录" "SHIPMENT_QUERY" "C-同义"
test_intent "交货记录" "SHIPMENT_QUERY" "C-同义"
test_intent "装车单" "SHIPMENT_QUERY" "C-同义"
test_intent "提货单" "SHIPMENT_QUERY" "C-同义"
test_intent "货运单" "SHIPMENT_QUERY" "C-同义"
test_intent "物流单" "SHIPMENT_QUERY" "C-同义"
test_intent "托运单" "SHIPMENT_QUERY" "C-同义"
test_intent "派送单" "SHIPMENT_QUERY" "C-同义"
test_intent "快递单" "SHIPMENT_QUERY" "C-同义"
test_intent "出货凭证" "SHIPMENT_QUERY" "C-同义"
test_intent "发运凭证" "SHIPMENT_QUERY" "C-同义"

# C016-030: 口语表达 (15)
test_intent "这批货咋样了" "PROCESSING_BATCH_LIST" "C-口语"
test_intent "货发了没" "SHIPMENT_QUERY" "C-口语"
test_intent "东西做完了吗" "PROCESSING_BATCH_LIST" "C-口语"
test_intent "料够不够" "MATERIAL_BATCH_QUERY" "C-口语"
test_intent "机器有事儿没" "EQUIPMENT_STATUS_QUERY" "C-口语"
test_intent "秤好使不" "SCALE_DEVICE_DETAIL" "C-口语"
test_intent "质量咋样" "QUALITY_STATS" "C-口语"
test_intent "今儿干了多少" "DAILY_PRODUCTION_QUERY" "C-口语"
test_intent "告警有没有" "ALERT_QUERY" "C-口语"
test_intent "库里还有啥" "MATERIAL_BATCH_QUERY" "C-口语"
test_intent "活儿干完没" "PROCESSING_BATCH_LIST" "C-口语"
test_intent "发出去了吗" "SHIPMENT_QUERY" "C-口语"
test_intent "检了没" "QUALITY_CHECK_QUERY" "C-口语"
test_intent "机子转着呢吗" "EQUIPMENT_STATUS_QUERY" "C-口语"
test_intent "单子出了没" "SHIPMENT_QUERY" "C-口语"

# C031-045: 语义区分 (15)
test_intent "设备状况" "EQUIPMENT_STATUS_QUERY" "C-区分"
test_intent "设备问题" "EQUIPMENT_ALERT_QUERY" "C-区分"
test_intent "生产情况" "PROCESSING_BATCH_LIST" "C-区分"
test_intent "生产问题" "PROCESSING_BATCH_LIST" "C-区分"
test_intent "原料状况" "MATERIAL_BATCH_QUERY" "C-区分"
test_intent "原料问题" "MATERIAL_LOW_STOCK_ALERT" "C-区分"
test_intent "质量情况" "QUALITY_STATS" "C-区分"
test_intent "质量问题" "QUALITY_CHECK_QUERY" "C-区分"
test_intent "发货状况" "SHIPMENT_QUERY" "C-区分"
test_intent "发货问题" "SHIPMENT_QUERY" "C-区分"
test_intent "告警情况" "ALERT_QUERY" "C-区分"
test_intent "告警问题" "ALERT_QUERY" "C-区分"
test_intent "秤的状况" "SCALE_DEVICE_DETAIL" "C-区分"
test_intent "秤的问题" "SCALE_DEVICE_DETAIL" "C-区分"
test_intent "报表状况" "REPORT_DASHBOARD_OVERVIEW" "C-区分"

# C046-060: 行业术语变体 (15)
test_intent "WIP查询" "PROCESSING_BATCH_LIST" "C-术语"
test_intent "BOM物料" "MATERIAL_BATCH_QUERY" "C-术语"
test_intent "QC结果" "QUALITY_CHECK_QUERY" "C-术语"
test_intent "OEE数据" "EQUIPMENT_STATS" "C-术语"
test_intent "SPC图表" "QUALITY_STATS" "C-术语"
test_intent "MES状态" "EQUIPMENT_STATUS_QUERY" "C-术语"
test_intent "ERP订单" "PROCESSING_BATCH_LIST" "C-术语"
test_intent "FIFO推荐" "MATERIAL_FIFO_RECOMMEND" "C-术语"
test_intent "IoT设备" "EQUIPMENT_LIST" "C-术语"
test_intent "AGV状态" "EQUIPMENT_STATUS_QUERY" "C-术语"
test_intent "PLC数据" "EQUIPMENT_STATUS_QUERY" "C-术语"
test_intent "SCADA监控" "EQUIPMENT_STATUS_QUERY" "C-术语"
test_intent "KPI报表" "REPORT_DASHBOARD_OVERVIEW" "C-术语"
test_intent "SLA统计" "REPORT_PRODUCTION" "C-术语"
test_intent "DOC管理" "REPORT_DASHBOARD_OVERVIEW" "C-术语"

# ==================== D类: 负向关键词排斥 (40个) ====================
echo ""
echo -e "${CYAN}=== D类: 负向关键词排斥测试 (40) ===${NC}"

# D001-010: 秤类排除DELETE (10)
test_intent "列出秤" "SCALE_LIST_DEVICES" "D-排斥"
test_intent "秤的列表" "SCALE_LIST_DEVICES" "D-排斥"
test_intent "所有的秤" "SCALE_LIST_DEVICES" "D-排斥"
test_intent "查看秤" "SCALE_LIST_DEVICES" "D-排斥"
test_intent "秤有多少" "SCALE_LIST_DEVICES" "D-排斥"
test_intent "秤的数目" "SCALE_LIST_DEVICES" "D-排斥"
test_intent "秤设备查询" "SCALE_LIST_DEVICES" "D-排斥"
test_intent "查询秤" "SCALE_LIST_DEVICES" "D-排斥"
test_intent "秤的清单列表" "SCALE_LIST_DEVICES" "D-排斥"
test_intent "看看秤" "SCALE_LIST_DEVICES" "D-排斥"

# D011-020: 告警类排除ACKNOWLEDGE (10)
test_intent "活跃的告警" "ALERT_ACTIVE" "D-排斥"
test_intent "当前的警报" "ALERT_ACTIVE" "D-排斥"
test_intent "未处理的告警" "ALERT_ACTIVE" "D-排斥"
test_intent "进行中告警" "ALERT_ACTIVE" "D-排斥"
test_intent "正在发生警报" "ALERT_ACTIVE" "D-排斥"
test_intent "实时告警信息" "ALERT_ACTIVE" "D-排斥"
test_intent "最新的告警" "ALERT_ACTIVE" "D-排斥"
test_intent "紧急的警报" "ALERT_ACTIVE" "D-排斥"
test_intent "待处理告警" "ALERT_ACTIVE" "D-排斥"
test_intent "还未关闭告警" "ALERT_ACTIVE" "D-排斥"

# D021-030: 原料类排除RESERVE (10)
test_intent "查询原料库存" "MATERIAL_BATCH_QUERY" "D-排斥"
test_intent "原料查看" "MATERIAL_BATCH_QUERY" "D-排斥"
test_intent "物料列表查询" "MATERIAL_BATCH_QUERY" "D-排斥"
test_intent "原料清单查看" "MATERIAL_BATCH_QUERY" "D-排斥"
test_intent "查看物料统计" "MATERIAL_BATCH_QUERY" "D-排斥"
test_intent "原料有什么" "MATERIAL_BATCH_QUERY" "D-排斥"
test_intent "物料查询统计" "MATERIAL_BATCH_QUERY" "D-排斥"
test_intent "原料情况查看" "MATERIAL_BATCH_QUERY" "D-排斥"
test_intent "查原料清单" "MATERIAL_BATCH_QUERY" "D-排斥"
test_intent "看原料列表" "MATERIAL_BATCH_QUERY" "D-排斥"

# D031-040: 生产类排除CREATE (10)
test_intent "取消生产" "PROCESSING_BATCH_CANCEL" "D-排斥"
test_intent "作废批次" "PROCESSING_BATCH_CANCEL" "D-排斥"
test_intent "取消这个批次" "PROCESSING_BATCH_CANCEL" "D-排斥"
test_intent "生产任务作废" "PROCESSING_BATCH_CANCEL" "D-排斥"
test_intent "撤销生产计划" "PROCESSING_BATCH_CANCEL" "D-排斥"
test_intent "开始生产" "PROCESSING_BATCH_START" "D-排斥"
test_intent "启动批次" "PROCESSING_BATCH_START" "D-排斥"
test_intent "完成生产" "PROCESSING_BATCH_COMPLETE" "D-排斥"
test_intent "结束批次" "PROCESSING_BATCH_COMPLETE" "D-排斥"
test_intent "暂停生产" "PROCESSING_BATCH_PAUSE" "D-排斥"

# ==================== E类: 领域检测 (30个) ====================
echo ""
echo -e "${CYAN}=== E类: 领域检测测试 (30) ===${NC}"

# E001-006: SCALE领域 (6)
test_intent "秤" "SCALE_LIST_DEVICES" "E-领域"
test_intent "称重" "SCALE_DEVICE_DETAIL" "E-领域"
test_intent "电子秤" "SCALE_DEVICE_DETAIL" "E-领域"
test_intent "智能秤" "SCALE_LIST_DEVICES" "E-领域"
test_intent "IoT秤" "SCALE_LIST_DEVICES" "E-领域"
test_intent "秤设备" "SCALE_LIST_DEVICES" "E-领域"

# E007-012: ALERT领域 (6)
test_intent "告警" "ALERT_QUERY" "E-领域"
test_intent "预警" "ALERT_QUERY" "E-领域"
test_intent "警报" "ALERT_QUERY" "E-领域"
test_intent "异常" "ALERT_QUERY" "E-领域"
test_intent "报警" "ALERT_QUERY" "E-领域"
test_intent "告警信息" "ALERT_QUERY" "E-领域"

# E013-018: MATERIAL领域 (6)
test_intent "原料" "MATERIAL_BATCH_QUERY" "E-领域"
test_intent "物料" "MATERIAL_BATCH_QUERY" "E-领域"
test_intent "材料" "MATERIAL_BATCH_QUERY" "E-领域"
test_intent "原材料" "MATERIAL_BATCH_QUERY" "E-领域"
test_intent "辅料" "MATERIAL_BATCH_QUERY" "E-领域"
test_intent "库存" "REPORT_INVENTORY" "E-领域"

# E019-024: PROCESSING领域 (6)
test_intent "生产" "PROCESSING_BATCH_LIST" "E-领域"
test_intent "批次" "PROCESSING_BATCH_LIST" "E-领域"
test_intent "加工" "PROCESSING_RECORD_QUERY" "E-领域"
test_intent "产量" "DAILY_PRODUCTION_QUERY" "E-领域"
test_intent "产出" "DAILY_PRODUCTION_QUERY" "E-领域"
test_intent "生产线" "PROCESSING_BATCH_LIST" "E-领域"

# E025-030: QUALITY领域 (6)
test_intent "质检" "QUALITY_CHECK_QUERY" "E-领域"
test_intent "品质" "QUALITY_STATS" "E-领域"
test_intent "质量" "QUALITY_CHECK_QUERY" "E-领域"
test_intent "检验" "QUALITY_CHECK_QUERY" "E-领域"
test_intent "合格率" "QUALITY_STATS" "E-领域"
test_intent "不良品" "QUALITY_DISPOSITION_EXECUTE" "E-领域"

# ==================== F类: 操作类型检测 (30个) ====================
echo ""
echo -e "${CYAN}=== F类: 操作类型检测测试 (30) ===${NC}"

# F001-008: QUERY操作 (8)
test_intent "查询设备" "EQUIPMENT_LIST" "F-操作"
test_intent "列出批次" "PROCESSING_BATCH_LIST" "F-操作"
test_intent "有哪些原料" "MATERIAL_BATCH_QUERY" "F-操作"
test_intent "显示告警" "ALERT_LIST" "F-操作"
test_intent "获取发货" "SHIPMENT_QUERY" "F-操作"
test_intent "搜索质检" "QUALITY_CHECK_QUERY" "F-操作"
test_intent "查找秤" "SCALE_LIST_DEVICES" "F-操作"
test_intent "统计报表" "REPORT_DASHBOARD_OVERVIEW" "F-操作"

# F009-016: CREATE操作 (8)
test_intent "新建批次" "PROCESSING_BATCH_CREATE" "F-操作"
test_intent "创建发货单" "SHIPMENT_CREATE" "F-操作"
test_intent "添加设备" "EQUIPMENT_CREATE" "F-操作"
test_intent "新增原料" "MATERIAL_INBOUND_QUERY" "F-操作"
test_intent "录入质检" "QUALITY_CHECK_EXECUTE" "F-操作"
test_intent "登记批次" "PROCESSING_BATCH_CREATE" "F-操作"
test_intent "建立发货" "SHIPMENT_CREATE" "F-操作"
test_intent "生成报表" "REPORT_PRODUCTION" "F-操作"

# F017-024: UPDATE操作 (8)
test_intent "修改设备" "EQUIPMENT_UPDATE" "F-操作"
test_intent "更新批次" "PROCESSING_BATCH_UPDATE" "F-操作"
test_intent "调整原料" "MATERIAL_BATCH_QUERY" "F-操作"
test_intent "编辑发货" "SHIPMENT_UPDATE" "F-操作"
test_intent "变更质检" "QUALITY_CHECK_QUERY" "F-操作"
test_intent "设置告警" "ALERT_SETTINGS" "F-操作"
test_intent "改生产" "PROCESSING_BATCH_UPDATE" "F-操作"
test_intent "更改状态" "EQUIPMENT_STATUS_QUERY" "F-操作"

# F025-030: DELETE操作 (6)
test_intent "删除设备" "EQUIPMENT_DELETE" "F-操作"
test_intent "取消批次" "PROCESSING_BATCH_CANCEL" "F-操作"
test_intent "作废发货" "SHIPMENT_CANCEL" "F-操作"
test_intent "移除原料" "MATERIAL_BATCH_QUERY" "F-操作"
test_intent "清除告警" "ALERT_ACKNOWLEDGE" "F-操作"
test_intent "撤销质检" "QUALITY_CHECK_QUERY" "F-操作"

# ==================== G类: 问题类型分类 (30个) ====================
echo ""
echo -e "${CYAN}=== G类: 问题类型分类测试 (30) ===${NC}"

# G001-010: GENERAL_QUESTION (10)
test_clarify "如何提高产量" "SUCCESS" "G-问题"
test_clarify "为什么效率低" "SUCCESS" "G-问题"
test_clarify "什么是FIFO" "SUCCESS" "G-问题"
test_clarify "怎么优化生产" "SUCCESS" "G-问题"
test_clarify "为何质量下降" "SUCCESS" "G-问题"
test_clarify "如何减少浪费" "SUCCESS" "G-问题"
test_clarify "什么影响产能" "SUCCESS" "G-问题"
test_clarify "怎样提升效率" "SUCCESS" "G-问题"
test_clarify "为什么会报警" "SUCCESS" "G-问题"
test_clarify "如何改善质量" "SUCCESS" "G-问题"

# G011-020: CONVERSATIONAL (10)
test_clarify "你好" "SUCCESS" "G-闲聊"
test_clarify "谢谢" "SUCCESS" "G-闲聊"
test_clarify "在吗" "SUCCESS" "G-闲聊"
test_clarify "你是谁" "SUCCESS" "G-闲聊"
test_clarify "帮帮我" "NEED_CLARIFICATION" "G-闲聊"
test_clarify "明白了" "SUCCESS" "G-闲聊"
test_clarify "好的" "SUCCESS" "G-闲聊"
test_clarify "收到" "SUCCESS" "G-闲聊"
test_clarify "辛苦了" "SUCCESS" "G-闲聊"
test_clarify "再见" "SUCCESS" "G-闲聊"

# G021-030: OPERATIONAL_COMMAND (10)
test_intent "查库存" "REPORT_INVENTORY" "G-指令"
test_intent "创建批次" "PROCESSING_BATCH_CREATE" "G-指令"
test_intent "看发货" "SHIPMENT_QUERY" "G-指令"
test_intent "查设备" "EQUIPMENT_LIST" "G-指令"
test_intent "看告警" "ALERT_QUERY" "G-指令"
test_intent "查质检" "QUALITY_CHECK_QUERY" "G-指令"
test_intent "看秤" "SCALE_LIST_DEVICES" "G-指令"
test_intent "查原料" "MATERIAL_BATCH_QUERY" "G-指令"
test_intent "看报表" "REPORT_DASHBOARD_OVERVIEW" "G-指令"
test_intent "查生产" "PROCESSING_BATCH_LIST" "G-指令"

# ==================== H类: LLM Fallback边界 (40个) ====================
echo ""
echo -e "${CYAN}=== H类: LLM Fallback边界测试 (40) ===${NC}"

# H001-010: 不触发LLM (conf≥0.95) (10)
test_intent "发货查询" "SHIPMENT_QUERY" "H-高置信"
test_intent "库存查询" "REPORT_INVENTORY" "H-高置信"
test_intent "设备状态" "EQUIPMENT_STATUS_QUERY" "H-高置信"
test_intent "告警列表" "ALERT_LIST" "H-高置信"
test_intent "质检记录" "QUALITY_CHECK_QUERY" "H-高置信"
test_intent "生产批次" "PROCESSING_BATCH_LIST" "H-高置信"
test_intent "原料批次" "MATERIAL_BATCH_QUERY" "H-高置信"
test_intent "秤列表" "SCALE_LIST_DEVICES" "H-高置信"
test_intent "今日生产" "DAILY_PRODUCTION_QUERY" "H-高置信"
test_intent "设备列表" "EQUIPMENT_LIST" "H-高置信"

# H011-020: 触发LLM验证 (0.5<conf<0.65) (10)
test_clarify "看看那个" "NEED_CLARIFICATION" "H-中置信"
test_clarify "处理一下" "NEED_CLARIFICATION" "H-中置信"
test_clarify "查查" "NEED_CLARIFICATION" "H-中置信"
test_clarify "弄弄" "NEED_CLARIFICATION" "H-中置信"
test_clarify "搞一下" "NEED_CLARIFICATION" "H-中置信"
test_clarify "看看" "NEED_CLARIFICATION" "H-中置信"
test_clarify "找找" "NEED_CLARIFICATION" "H-中置信"
test_clarify "整整" "NEED_CLARIFICATION" "H-中置信"
test_clarify "弄下" "NEED_CLARIFICATION" "H-中置信"
test_clarify "搞下" "NEED_CLARIFICATION" "H-中置信"

# H021-030: 触发LLM兜底 (conf<0.5) (10)
test_clarify "今天天气怎么样" "SUCCESS" "H-低置信"
test_clarify "明天会下雨吗" "SUCCESS" "H-低置信"
test_clarify "你觉得呢" "SUCCESS" "H-低置信"
test_clarify "随便聊聊" "SUCCESS" "H-低置信"
test_clarify "有意思" "SUCCESS" "H-低置信"
test_clarify "无聊了" "SUCCESS" "H-低置信"
test_clarify "讲个笑话" "SUCCESS" "H-低置信"
test_clarify "唱首歌" "SUCCESS" "H-低置信"
test_clarify "写首诗" "SUCCESS" "H-低置信"
test_clarify "聊聊天" "SUCCESS" "H-低置信"

# H031-040: 边界值测试 (10)
test_intent "设备情况怎么样" "EQUIPMENT_STATUS_QUERY" "H-边界"
test_intent "生产进度如何" "PROCESSING_BATCH_LIST" "H-边界"
test_intent "原料够不够用" "MATERIAL_BATCH_QUERY" "H-边界"
test_intent "质量有问题吗" "QUALITY_CHECK_QUERY" "H-边界"
test_intent "发货正常吗" "SHIPMENT_QUERY" "H-边界"
test_intent "告警严重吗" "ALERT_QUERY" "H-边界"
test_intent "秤准不准" "SCALE_DEVICE_DETAIL" "H-边界"
test_intent "效率高不高" "REPORT_PRODUCTION" "H-边界"
test_intent "库存足够吗" "REPORT_INVENTORY" "H-边界"
test_intent "进度快不快" "PROCESSING_BATCH_LIST" "H-边界"

# ==================== I类: 多轮对话澄清 (40个) ====================
echo ""
echo -e "${CYAN}=== I类: 多轮对话澄清测试 (40) ===${NC}"

# I001-010: 省略主语类 (10)
test_clarify "查一下" "NEED_CLARIFICATION" "I-澄清"
test_clarify "看一下" "NEED_CLARIFICATION" "I-澄清"
test_clarify "统计下" "NEED_CLARIFICATION" "I-澄清"
test_clarify "导出来" "NEED_CLARIFICATION" "I-澄清"
test_clarify "加一个" "NEED_CLARIFICATION" "I-澄清"
test_clarify "改一下" "NEED_CLARIFICATION" "I-澄清"
test_clarify "删掉吧" "NEED_CLARIFICATION" "I-澄清"
test_clarify "有多少" "NEED_CLARIFICATION" "I-澄清"
test_clarify "好了吗" "NEED_CLARIFICATION" "I-澄清"
test_clarify "完成了吗" "NEED_CLARIFICATION" "I-澄清"

# I011-020: 模糊指代类 (10)
test_clarify "处理下这个" "NEED_CLARIFICATION" "I-澄清"
test_clarify "那个怎么搞" "NEED_CLARIFICATION" "I-澄清"
test_clarify "这边的情况" "NEED_CLARIFICATION" "I-澄清"
test_clarify "那边怎样" "NEED_CLARIFICATION" "I-澄清"
test_clarify "这玩意儿" "NEED_CLARIFICATION" "I-澄清"
test_clarify "那东西" "NEED_CLARIFICATION" "I-澄清"
test_clarify "弄一下这个" "NEED_CLARIFICATION" "I-澄清"
test_clarify "看看那边" "NEED_CLARIFICATION" "I-澄清"
test_clarify "这个给我" "NEED_CLARIFICATION" "I-澄清"
test_clarify "把那个" "NEED_CLARIFICATION" "I-澄清"

# I021-030: 模糊动词类 (10)
test_clarify "设备搞一下" "NEED_CLARIFICATION" "I-澄清"
test_clarify "原料弄下" "NEED_CLARIFICATION" "I-澄清"
test_clarify "生产那边处理下" "NEED_CLARIFICATION" "I-澄清"
test_clarify "告警整一下" "NEED_CLARIFICATION" "I-澄清"
test_clarify "排程安排下" "NEED_CLARIFICATION" "I-澄清"
test_clarify "质检搞定" "NEED_CLARIFICATION" "I-澄清"
test_clarify "库存捋一捋" "NEED_CLARIFICATION" "I-澄清"
test_clarify "人员看看" "NEED_CLARIFICATION" "I-澄清"
test_clarify "报表出一下" "NEED_CLARIFICATION" "I-澄清"
test_clarify "客户联系下" "NEED_CLARIFICATION" "I-澄清"

# I031-040: 口语方言类 (10)
test_clarify "整个明白" "NEED_CLARIFICATION" "I-澄清"
test_clarify "瞅瞅咋样了" "NEED_CLARIFICATION" "I-澄清"
test_clarify "咋整的" "NEED_CLARIFICATION" "I-澄清"
test_clarify "得劲不" "NEED_CLARIFICATION" "I-澄清"
test_clarify "中不中" "NEED_CLARIFICATION" "I-澄清"
test_clarify "搁这呢" "NEED_CLARIFICATION" "I-澄清"
test_clarify "给力不给力" "NEED_CLARIFICATION" "I-澄清"
test_clarify "靠谱吗" "NEED_CLARIFICATION" "I-澄清"
test_clarify "妥了没" "NEED_CLARIFICATION" "I-澄清"
test_clarify "稳不稳" "NEED_CLARIFICATION" "I-澄清"

# ==================== J类: 自学习机制 (50个) ====================
echo ""
echo -e "${CYAN}=== J类: 自学习机制测试 (50) ===${NC}"

# J001-015: 高置信度匹配 (15)
test_intent "显示所有设备清单" "EQUIPMENT_LIST" "J-学习"
test_intent "我要看全部机器" "EQUIPMENT_LIST" "J-学习"
test_intent "查看今日的产量数据" "DAILY_PRODUCTION_QUERY" "J-学习"
test_intent "统计一下发货情况" "SHIPMENT_QUERY" "J-学习"
test_intent "列出所有原料批次" "MATERIAL_BATCH_QUERY" "J-学习"
test_intent "展示质检结果报告" "QUALITY_CHECK_QUERY" "J-学习"
test_intent "查询告警信息列表" "ALERT_LIST" "J-学习"
test_intent "获取秤设备数据" "SCALE_DATA_QUERY" "J-学习"
test_intent "显示生产批次进度" "PROCESSING_BATCH_LIST" "J-学习"
test_intent "查看库存报表" "REPORT_INVENTORY" "J-学习"
test_intent "统计设备运行数据" "EQUIPMENT_STATS" "J-学习"
test_intent "列出发货单明细" "SHIPMENT_QUERY" "J-学习"
test_intent "查询原料库存量" "MATERIAL_BATCH_QUERY" "J-学习"
test_intent "获取质量统计数据" "QUALITY_STATS" "J-学习"
test_intent "显示所有告警记录" "ALERT_QUERY" "J-学习"

# J016-030: 中置信度匹配 (15)
test_intent "机器状态怎样" "EQUIPMENT_STATUS_QUERY" "J-学习"
test_intent "产品做好了没" "PROCESSING_BATCH_LIST" "J-学习"
test_intent "东西发走了吗" "SHIPMENT_QUERY" "J-学习"
test_intent "材料还有没" "MATERIAL_BATCH_QUERY" "J-学习"
test_intent "检测过了吗" "QUALITY_CHECK_QUERY" "J-学习"
test_intent "有警告吗" "ALERT_QUERY" "J-学习"
test_intent "称了多少" "SCALE_DATA_QUERY" "J-学习"
test_intent "产线忙不忙" "PROCESSING_BATCH_LIST" "J-学习"
test_intent "仓库有货吗" "REPORT_INVENTORY" "J-学习"
test_intent "设备转着呢" "EQUIPMENT_STATUS_QUERY" "J-学习"
test_intent "单子出了" "SHIPMENT_QUERY" "J-学习"
test_intent "料够用" "MATERIAL_BATCH_QUERY" "J-学习"
test_intent "品质OK" "QUALITY_STATS" "J-学习"
test_intent "有异常" "ALERT_QUERY" "J-学习"
test_intent "秤好使" "SCALE_DEVICE_DETAIL" "J-学习"

# J031-040: 用户正向反馈 (10)
test_intent "设备运行状态概览" "EQUIPMENT_STATUS_QUERY" "J-反馈"
test_intent "生产批次完成进度" "PROCESSING_BATCH_LIST" "J-反馈"
test_intent "发货订单追踪查询" "SHIPMENT_QUERY" "J-反馈"
test_intent "原料库存盘点清单" "MATERIAL_BATCH_QUERY" "J-反馈"
test_intent "质量检测合格统计" "QUALITY_STATS" "J-反馈"
test_intent "告警事件处理记录" "ALERT_QUERY" "J-反馈"
test_intent "称重设备在线状态" "SCALE_LIST_DEVICES" "J-反馈"
test_intent "生产效率分析报表" "REPORT_PRODUCTION" "J-反馈"
test_intent "库存预警提醒" "MATERIAL_LOW_STOCK_ALERT" "J-反馈"
test_intent "设备维护保养计划" "EQUIPMENT_MAINTENANCE_QUERY" "J-反馈"

# J041-050: 用户负向反馈 (10)
test_intent "机台运转情况" "EQUIPMENT_STATUS_QUERY" "J-反馈"
test_intent "工单执行状态" "PROCESSING_BATCH_LIST" "J-反馈"
test_intent "物流配送进度" "SHIPMENT_QUERY" "J-反馈"
test_intent "物资存储情况" "MATERIAL_BATCH_QUERY" "J-反馈"
test_intent "品控检测结果" "QUALITY_CHECK_QUERY" "J-反馈"
test_intent "异常报警汇总" "ALERT_QUERY" "J-反馈"
test_intent "电子秤读数记录" "SCALE_RECORD_QUERY" "J-反馈"
test_intent "产能利用率报告" "REPORT_PRODUCTION" "J-反馈"
test_intent "原料消耗预警" "MATERIAL_LOW_STOCK_ALERT" "J-反馈"
test_intent "设备保修记录" "EQUIPMENT_MAINTENANCE_QUERY" "J-反馈"

# ==================== K类: 版本控制回滚 (20个) ====================
echo ""
echo -e "${CYAN}=== K类: 版本控制回滚测试 (20) ===${NC}"

# K001-010: 配置回滚 (10)
test_intent "设备运维管理" "EQUIPMENT_MAINTENANCE_QUERY" "K-版本"
test_intent "产线作业进度" "PROCESSING_BATCH_LIST" "K-版本"
test_intent "出库发运记录" "SHIPMENT_QUERY" "K-版本"
test_intent "物料领用清单" "MATERIAL_BATCH_QUERY" "K-版本"
test_intent "品质管控数据" "QUALITY_STATS" "K-版本"
test_intent "告警通知中心" "ALERT_LIST" "K-版本"
test_intent "计量设备管理" "SCALE_LIST_DEVICES" "K-版本"
test_intent "生产计划看板" "PROCESSING_BATCH_LIST" "K-版本"
test_intent "仓储管理报表" "REPORT_INVENTORY" "K-版本"
test_intent "设备健康监测" "EQUIPMENT_STATUS_QUERY" "K-版本"

# K011-020: 平台级提升 (10)
test_intent "全厂设备一览" "EQUIPMENT_LIST" "K-版本"
test_intent "车间生产汇总" "PROCESSING_BATCH_LIST" "K-版本"
test_intent "发货业务统计" "SHIPMENT_QUERY" "K-版本"
test_intent "原辅料库存表" "MATERIAL_BATCH_QUERY" "K-版本"
test_intent "质量管理系统" "QUALITY_CHECK_QUERY" "K-版本"
test_intent "预警监控平台" "ALERT_QUERY" "K-版本"
test_intent "智能称重系统" "SCALE_LIST_DEVICES" "K-版本"
test_intent "制造执行系统" "PROCESSING_BATCH_LIST" "K-版本"
test_intent "经营分析报表" "REPORT_DASHBOARD_OVERVIEW" "K-版本"
test_intent "资产管理系统" "EQUIPMENT_LIST" "K-版本"

# L类已移除 - 这些意图(DATA_EXPORT_*, FORM_*, SYSTEM_*)系统未定义

# ==================== 测试结果汇总 ====================
echo ""
echo "================================================"
echo -e "${BLUE}                 测试结果汇总${NC}"
echo "================================================"
echo ""
echo -e "总测试数: ${TOTAL}"
echo -e "通过: ${GREEN}${PASSED}${NC}"
echo -e "失败: ${RED}${FAILED}${NC}"
echo ""

# 计算通过率
if [ $TOTAL -gt 0 ]; then
  PASS_RATE=$(echo "scale=2; $PASSED * 100 / $TOTAL" | bc)
  echo -e "通过率: ${YELLOW}${PASS_RATE}%${NC}"
fi

echo ""
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}全部测试通过！${NC}"
else
  echo -e "${YELLOW}存在失败的测试，请检查${NC}"
fi
