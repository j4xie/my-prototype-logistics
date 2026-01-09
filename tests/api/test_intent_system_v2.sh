#!/bin/bash
# 意图识别系统全面测试脚本 V2
# 修正：使用实际数据库中的意图代码
# 测试范围：6层识别 + 规则匹配 + 自学习 + LLM Fallback + Tool Calling

SERVER="http://localhost:10010"
FACTORY_ID="F001"
TOKEN=""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 统计变量
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
declare -A LAYER_HITS
LAYER_HITS[EXACT]=0
LAYER_HITS[KEYWORD]=0
LAYER_HITS[SEMANTIC]=0
LAYER_HITS[FUSION]=0
LAYER_HITS[LLM]=0
LAYER_HITS[NONE]=0

# 日志文件
LOG_FILE="/tmp/intent_test_v2_$(date +%Y%m%d_%H%M%S).log"

log() { echo -e "$1" | tee -a "$LOG_FILE"; }

# 登录获取Token
login() {
    log "${BLUE}[INFO] 登录获取Token...${NC}"
    RESP=$(curl -s -X POST "$SERVER/api/mobile/auth/unified-login" \
        -H "Content-Type: application/json" \
        -d '{"username": "factory_admin1", "password": "123456"}')

    if echo "$RESP" | grep -q '"code":200'; then
        TOKEN=$(echo "$RESP" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
        log "${GREEN}[OK] 登录成功${NC}"
        return 0
    else
        log "${RED}[ERROR] 登录失败${NC}"
        return 1
    fi
}

# 测试单个意图识别
test_intent() {
    local input="$1"
    local expected_intent="$2"
    local category="$3"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    RESP=$(curl -s -X POST "$SERVER/api/mobile/$FACTORY_ID/ai-intents/recognize" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"userInput\": \"$input\"}" 2>/dev/null)

    local matched=$(echo "$RESP" | grep -o '"matched":[^,]*' | cut -d':' -f2)
    local intent_code=$(echo "$RESP" | grep -o '"intentCode":"[^"]*"' | cut -d'"' -f4)
    local match_method=$(echo "$RESP" | grep -o '"matchMethod":"[^"]*"' | cut -d'"' -f4)

    # 统计匹配层
    case "$match_method" in
        "EXACT") LAYER_HITS[EXACT]=$((LAYER_HITS[EXACT] + 1)) ;;
        "KEYWORD") LAYER_HITS[KEYWORD]=$((LAYER_HITS[KEYWORD] + 1)) ;;
        "SEMANTIC") LAYER_HITS[SEMANTIC]=$((LAYER_HITS[SEMANTIC] + 1)) ;;
        "FUSION") LAYER_HITS[FUSION]=$((LAYER_HITS[FUSION] + 1)) ;;
        "LLM") LAYER_HITS[LLM]=$((LAYER_HITS[LLM] + 1)) ;;
        *) LAYER_HITS[NONE]=$((LAYER_HITS[NONE] + 1)) ;;
    esac

    # 判断测试结果
    local passed=false
    if [ "$expected_intent" = "ANY" ] && [ "$matched" = "true" ]; then
        passed=true
    elif [ "$expected_intent" = "NONE" ] && [ "$matched" = "false" ]; then
        passed=true
    elif [ "$intent_code" = "$expected_intent" ]; then
        passed=true
    fi

    if $passed; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -n "."
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -n "F"
        echo "[$category] '$input' => 期望: $expected_intent, 实际: $intent_code ($match_method)" >> "$LOG_FILE"
    fi
}

# 测试意图执行（含Tool Calling）
test_execute() {
    local input="$1"
    local category="$2"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    RESP=$(curl -s -X POST "$SERVER/api/mobile/$FACTORY_ID/ai-intents/execute" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"userInput\": \"$input\"}" 2>/dev/null)

    if echo "$RESP" | grep -q '"success":true'; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -n "E"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -n "X"
        echo "[$category] EXECUTE '$input' 失败" >> "$LOG_FILE"
    fi
}

# ==================== 测试用例集 (使用正确的意图代码) ====================

# 1. 生产批次控制 (50个用例)
test_processing_batch() {
    log "\n${YELLOW}=== 测试生产批次控制 (50个用例) ===${NC}"

    # PROCESSING_BATCH_START
    test_intent "开始生产" "PROCESSING_BATCH_START" "生产"
    test_intent "启动生产" "PROCESSING_BATCH_START" "生产"
    test_intent "启动生产线" "PROCESSING_BATCH_START" "生产"
    test_intent "帮我启动生产线" "PROCESSING_BATCH_START" "生产"
    test_intent "开工" "PROCESSING_BATCH_START" "生产"
    test_intent "开始干活" "PROCESSING_BATCH_START" "生产"
    test_intent "开始作业" "PROCESSING_BATCH_START" "生产"

    # PROCESSING_BATCH_PAUSE
    test_intent "暂停生产" "PROCESSING_BATCH_PAUSE" "生产"
    test_intent "停一下生产" "PROCESSING_BATCH_PAUSE" "生产"
    test_intent "帮我停一下生产线" "PROCESSING_BATCH_PAUSE" "生产"
    test_intent "生产暂停" "PROCESSING_BATCH_PAUSE" "生产"
    test_intent "中断生产" "PROCESSING_BATCH_PAUSE" "生产"
    test_intent "停生产线" "PROCESSING_BATCH_PAUSE" "生产"

    # PROCESSING_BATCH_RESUME
    test_intent "恢复生产" "PROCESSING_BATCH_RESUME" "生产"
    test_intent "继续生产" "PROCESSING_BATCH_RESUME" "生产"
    test_intent "重新开始" "PROCESSING_BATCH_RESUME" "生产"
    test_intent "接着生产" "PROCESSING_BATCH_RESUME" "生产"

    # PROCESSING_BATCH_COMPLETE
    test_intent "完成生产" "PROCESSING_BATCH_COMPLETE" "生产"
    test_intent "生产完成" "PROCESSING_BATCH_COMPLETE" "生产"
    test_intent "结束生产" "PROCESSING_BATCH_COMPLETE" "生产"
    test_intent "完工" "PROCESSING_BATCH_COMPLETE" "生产"
    test_intent "收工" "PROCESSING_BATCH_COMPLETE" "生产"

    # PROCESSING_BATCH_LIST (查询)
    test_intent "批次列表" "PROCESSING_BATCH_LIST" "生产"
    test_intent "生产列表" "PROCESSING_BATCH_LIST" "生产"
    test_intent "所有批次" "PROCESSING_BATCH_LIST" "生产"
    test_intent "查看生产批次" "PROCESSING_BATCH_LIST" "生产"

    # PROCESSING_BATCH_DETAIL
    test_intent "批次详情" "PROCESSING_BATCH_DETAIL" "生产"
    test_intent "生产详情" "PROCESSING_BATCH_DETAIL" "生产"
    test_intent "查看批次" "PROCESSING_BATCH_DETAIL" "生产"

    # PROCESSING_BATCH_CREATE
    test_intent "创建生产" "PROCESSING_BATCH_CREATE" "生产"
    test_intent "新建生产" "PROCESSING_BATCH_CREATE" "生产"
    test_intent "开新批次" "PROCESSING_BATCH_CREATE" "生产"
    test_intent "新生产批次" "PROCESSING_BATCH_CREATE" "生产"
    test_intent "创建批次" "PROCESSING_BATCH_CREATE" "生产"

    # PROCESSING_BATCH_CANCEL
    test_intent "取消生产" "PROCESSING_BATCH_CANCEL" "生产"
    test_intent "撤销生产" "PROCESSING_BATCH_CANCEL" "生产"
    test_intent "删除批次" "PROCESSING_BATCH_CANCEL" "生产"

    # PROCESSING_BATCH_TIMELINE
    test_intent "批次时间线" "PROCESSING_BATCH_TIMELINE" "生产"
    test_intent "生产历史" "PROCESSING_BATCH_TIMELINE" "生产"
    test_intent "批次记录" "PROCESSING_BATCH_TIMELINE" "生产"

    # PROCESSING_WORKER_ASSIGN
    test_intent "分配员工" "PROCESSING_WORKER_ASSIGN" "生产"
    test_intent "员工分配" "PROCESSING_WORKER_ASSIGN" "生产"
    test_intent "指派员工" "PROCESSING_WORKER_ASSIGN" "生产"

    # 口语化测试
    test_intent "帮我看下生产情况" "ANY" "生产"
    test_intent "生产进度怎么样" "ANY" "生产"
    test_intent "今天生产多少了" "ANY" "生产"
    test_intent "产量统计" "ANY" "生产"
}

# 2. 设备管理 (40个用例)
test_equipment() {
    log "\n${YELLOW}=== 测试设备管理 (40个用例) ===${NC}"

    # EQUIPMENT_LIST
    test_intent "设备列表" "EQUIPMENT_LIST" "设备"
    test_intent "查看设备" "EQUIPMENT_LIST" "设备"
    test_intent "设备查询" "EQUIPMENT_LIST" "设备"
    test_intent "所有设备" "EQUIPMENT_LIST" "设备"
    test_intent "设备清单" "EQUIPMENT_LIST" "设备"

    # EQUIPMENT_DETAIL
    test_intent "设备详情" "EQUIPMENT_DETAIL" "设备"
    test_intent "设备信息" "EQUIPMENT_DETAIL" "设备"
    test_intent "查看设备详情" "EQUIPMENT_DETAIL" "设备"
    test_intent "设备状态" "EQUIPMENT_DETAIL" "设备"

    # EQUIPMENT_STOP
    test_intent "停止设备" "EQUIPMENT_STOP" "设备"
    test_intent "关闭设备" "EQUIPMENT_STOP" "设备"
    test_intent "把设备停一下" "EQUIPMENT_STOP" "设备"
    test_intent "停一下设备" "EQUIPMENT_STOP" "设备"
    test_intent "关掉设备" "EQUIPMENT_STOP" "设备"

    # EQUIPMENT_START
    test_intent "启动设备" "EQUIPMENT_START" "设备"
    test_intent "开设备" "EQUIPMENT_START" "设备"
    test_intent "打开设备" "EQUIPMENT_START" "设备"
    test_intent "设备启动" "EQUIPMENT_START" "设备"
    test_intent "开启设备" "EQUIPMENT_START" "设备"

    # EQUIPMENT_MAINTENANCE
    test_intent "设备维护" "EQUIPMENT_MAINTENANCE" "设备"
    test_intent "维护设备" "EQUIPMENT_MAINTENANCE" "设备"
    test_intent "保养设备" "EQUIPMENT_MAINTENANCE" "设备"
    test_intent "设备保养" "EQUIPMENT_MAINTENANCE" "设备"
    test_intent "检修设备" "EQUIPMENT_MAINTENANCE" "设备"

    # EQUIPMENT_STATS
    test_intent "设备统计" "EQUIPMENT_STATS" "设备"
    test_intent "设备概况" "EQUIPMENT_STATS" "设备"
    test_intent "设备汇总" "EQUIPMENT_STATS" "设备"

    # EQUIPMENT_ALERT_LIST
    test_intent "设备告警" "EQUIPMENT_ALERT_LIST" "设备"
    test_intent "告警列表" "EQUIPMENT_ALERT_LIST" "设备"
    test_intent "设备警报" "EQUIPMENT_ALERT_LIST" "设备"
    test_intent "告警查询" "EQUIPMENT_ALERT_LIST" "设备"

    # EQUIPMENT_STATUS_UPDATE
    test_intent "更新设备状态" "EQUIPMENT_STATUS_UPDATE" "设备"
    test_intent "修改设备状态" "EQUIPMENT_STATUS_UPDATE" "设备"

    # 口语化
    test_intent "帮我看下设备" "ANY" "设备"
    test_intent "机器怎么样" "ANY" "设备"
    test_intent "设备正常吗" "ANY" "设备"
    test_intent "有没有设备故障" "ANY" "设备"
}

# 3. 原材料管理 (30个用例)
test_material() {
    log "\n${YELLOW}=== 测试原材料管理 (30个用例) ===${NC}"

    # MATERIAL_BATCH_QUERY
    test_intent "查询原料" "MATERIAL_BATCH_QUERY" "原材料"
    test_intent "原料批次" "MATERIAL_BATCH_QUERY" "原材料"
    test_intent "原料信息" "MATERIAL_BATCH_QUERY" "原材料"
    test_intent "库存查询" "MATERIAL_BATCH_QUERY" "原材料"
    test_intent "原材料查询" "MATERIAL_BATCH_QUERY" "原材料"

    # MATERIAL_BATCH_USE
    test_intent "使用原料" "MATERIAL_BATCH_USE" "原材料"
    test_intent "领用原料" "MATERIAL_BATCH_USE" "原材料"
    test_intent "出库原料" "MATERIAL_BATCH_USE" "原材料"
    test_intent "消耗原料" "MATERIAL_BATCH_USE" "原材料"

    # MATERIAL_BATCH_RESERVE
    test_intent "预留原料" "MATERIAL_BATCH_RESERVE" "原材料"
    test_intent "预订原料" "MATERIAL_BATCH_RESERVE" "原材料"
    test_intent "锁定原料" "MATERIAL_BATCH_RESERVE" "原材料"

    # MATERIAL_BATCH_RELEASE
    test_intent "释放原料" "MATERIAL_BATCH_RELEASE" "原材料"
    test_intent "取消预留" "MATERIAL_BATCH_RELEASE" "原材料"
    test_intent "解锁原料" "MATERIAL_BATCH_RELEASE" "原材料"

    # MATERIAL_LOW_STOCK_ALERT
    test_intent "低库存预警" "MATERIAL_LOW_STOCK_ALERT" "原材料"
    test_intent "库存不足预警" "MATERIAL_LOW_STOCK_ALERT" "原材料"
    test_intent "缺货预警" "MATERIAL_LOW_STOCK_ALERT" "原材料"

    # MATERIAL_EXPIRING_ALERT
    test_intent "即将过期" "MATERIAL_EXPIRING_ALERT" "原材料"
    test_intent "过期预警" "MATERIAL_EXPIRING_ALERT" "原材料"
    test_intent "临期原料" "MATERIAL_EXPIRING_ALERT" "原材料"

    # MATERIAL_EXPIRED_QUERY
    test_intent "已过期" "MATERIAL_EXPIRED_QUERY" "原材料"
    test_intent "过期批次" "MATERIAL_EXPIRED_QUERY" "原材料"

    # MATERIAL_FIFO_RECOMMEND
    test_intent "先进先出" "MATERIAL_FIFO_RECOMMEND" "原材料"
    test_intent "FIFO" "MATERIAL_FIFO_RECOMMEND" "原材料"
    test_intent "原料推荐" "MATERIAL_FIFO_RECOMMEND" "原材料"

    # MATERIAL_ADJUST_QUANTITY
    test_intent "调整库存" "MATERIAL_ADJUST_QUANTITY" "原材料"
    test_intent "修改数量" "MATERIAL_ADJUST_QUANTITY" "原材料"
    test_intent "盘点调整" "MATERIAL_ADJUST_QUANTITY" "原材料"
}

# 4. 告警管理 (25个用例)
test_alert() {
    log "\n${YELLOW}=== 测试告警管理 (25个用例) ===${NC}"

    # ALERT_LIST
    test_intent "告警列表" "ALERT_LIST" "告警"
    test_intent "查看告警" "ALERT_LIST" "告警"
    test_intent "告警记录" "ALERT_LIST" "告警"

    # ALERT_ACTIVE
    test_intent "活跃告警" "ALERT_ACTIVE" "告警"
    test_intent "当前告警" "ALERT_ACTIVE" "告警"
    test_intent "未处理告警" "ALERT_ACTIVE" "告警"
    test_intent "机器今天有啥问题吗" "ALERT_ACTIVE" "告警"

    # ALERT_ACKNOWLEDGE
    test_intent "确认告警" "ALERT_ACKNOWLEDGE" "告警"
    test_intent "处理告警" "ALERT_ACKNOWLEDGE" "告警"
    test_intent "告警确认" "ALERT_ACKNOWLEDGE" "告警"

    # ALERT_RESOLVE
    test_intent "解决告警" "ALERT_RESOLVE" "告警"
    test_intent "告警已解决" "ALERT_RESOLVE" "告警"
    test_intent "关闭告警" "ALERT_RESOLVE" "告警"

    # ALERT_BY_LEVEL
    test_intent "按级别告警" "ALERT_BY_LEVEL" "告警"
    test_intent "严重告警" "ALERT_BY_LEVEL" "告警"
    test_intent "紧急告警" "ALERT_BY_LEVEL" "告警"

    # ALERT_DIAGNOSE
    test_intent "告警诊断" "ALERT_DIAGNOSE" "告警"
    test_intent "故障诊断" "ALERT_DIAGNOSE" "告警"
    test_intent "问题分析" "ALERT_DIAGNOSE" "告警"

    # ALERT_STATS
    test_intent "告警统计数据" "ALERT_STATS" "告警"
    test_intent "告警数量统计" "ALERT_STATS" "告警"

    # ALERT_TRIAGE
    test_intent "告警分级" "ALERT_TRIAGE" "告警"
    test_intent "智能分级" "ALERT_TRIAGE" "告警"
    test_intent "告警优先级" "ALERT_TRIAGE" "告警"
}

# 5. 质检管理 (20个用例)
test_quality() {
    log "\n${YELLOW}=== 测试质检管理 (20个用例) ===${NC}"

    # QUALITY_CHECK_QUERY
    test_intent "质检项查询" "QUALITY_CHECK_QUERY" "质检"
    test_intent "查询质检项" "QUALITY_CHECK_QUERY" "质检"
    test_intent "质检项列表" "QUALITY_CHECK_QUERY" "质检"

    # QUALITY_CHECK_EXECUTE
    test_intent "执行质检" "QUALITY_CHECK_EXECUTE" "质检"
    test_intent "提交质检" "QUALITY_CHECK_EXECUTE" "质检"
    test_intent "质检记录" "QUALITY_CHECK_EXECUTE" "质检"
    test_intent "检测结果" "QUALITY_CHECK_EXECUTE" "质检"

    # QUALITY_CRITICAL_ITEMS
    test_intent "关键质检项" "QUALITY_CRITICAL_ITEMS" "质检"
    test_intent "关键质检" "QUALITY_CRITICAL_ITEMS" "质检"
    test_intent "必检项" "QUALITY_CRITICAL_ITEMS" "质检"

    # QUALITY_STATS
    test_intent "质检统计" "QUALITY_STATS" "质检"
    test_intent "质量统计数据" "QUALITY_STATS" "质检"
    test_intent "质检合格率" "QUALITY_STATS" "质检"

    # QUALITY_DISPOSITION_EXECUTE
    test_intent "执行处置" "QUALITY_DISPOSITION_EXECUTE" "质检"
    test_intent "返工" "QUALITY_DISPOSITION_EXECUTE" "质检"
    test_intent "报废" "QUALITY_DISPOSITION_EXECUTE" "质检"
    test_intent "放行" "QUALITY_DISPOSITION_EXECUTE" "质检"

    # 口语化
    test_intent "质检情况" "ANY" "质检"
    test_intent "有没有质量问题" "ANY" "质检"
}

# 6. 出货/发货 (20个用例)
test_shipment() {
    log "\n${YELLOW}=== 测试出货/发货 (20个用例) ===${NC}"

    # SHIPMENT_QUERY
    test_intent "查询出货" "SHIPMENT_QUERY" "出货"
    test_intent "出货记录" "SHIPMENT_QUERY" "出货"
    test_intent "出货单查询" "SHIPMENT_QUERY" "出货"

    # SHIPMENT_CREATE
    test_intent "创建出货" "SHIPMENT_CREATE" "出货"
    test_intent "新建出货" "SHIPMENT_CREATE" "出货"
    test_intent "发货" "SHIPMENT_CREATE" "出货"
    test_intent "出货登记" "SHIPMENT_CREATE" "出货"

    # SHIPMENT_BY_CUSTOMER
    test_intent "客户出货" "SHIPMENT_BY_CUSTOMER" "出货"
    test_intent "客户发货" "SHIPMENT_BY_CUSTOMER" "出货"
    test_intent "查询客户订单" "SHIPMENT_BY_CUSTOMER" "出货"

    # SHIPMENT_BY_DATE
    test_intent "今天出货" "SHIPMENT_BY_DATE" "出货"
    test_intent "昨天出货" "SHIPMENT_BY_DATE" "出货"
    test_intent "本周出货" "SHIPMENT_BY_DATE" "出货"

    # SHIPMENT_STATS
    test_intent "出货统计" "SHIPMENT_STATS" "出货"
    test_intent "发货统计" "SHIPMENT_STATS" "出货"
    test_intent "出货报表" "SHIPMENT_STATS" "出货"

    # SHIPMENT_STATUS_UPDATE
    test_intent "出货状态" "SHIPMENT_STATUS_UPDATE" "出货"
    test_intent "发货状态" "SHIPMENT_STATUS_UPDATE" "出货"
    test_intent "确认送达" "SHIPMENT_STATUS_UPDATE" "出货"
}

# 7. 报表 (20个用例)
test_report() {
    log "\n${YELLOW}=== 测试报表 (20个用例) ===${NC}"

    # REPORT_PRODUCTION
    test_intent "生产报表" "REPORT_PRODUCTION" "报表"
    test_intent "产量统计" "REPORT_PRODUCTION" "报表"
    test_intent "生产统计" "REPORT_PRODUCTION" "报表"

    # REPORT_QUALITY
    test_intent "质量报表" "REPORT_QUALITY" "报表"
    test_intent "质量统计" "REPORT_QUALITY" "报表"
    test_intent "合格率报表" "REPORT_QUALITY" "报表"

    # REPORT_INVENTORY
    test_intent "库存报表" "REPORT_INVENTORY" "报表"
    test_intent "库存统计" "REPORT_INVENTORY" "报表"

    # REPORT_FINANCE
    test_intent "财务报表" "REPORT_FINANCE" "报表"
    test_intent "成本报表" "REPORT_FINANCE" "报表"
    test_intent "收支统计" "REPORT_FINANCE" "报表"

    # REPORT_EFFICIENCY
    test_intent "效率报表" "REPORT_EFFICIENCY" "报表"
    test_intent "效率分析" "REPORT_EFFICIENCY" "报表"
    test_intent "产能分析" "REPORT_EFFICIENCY" "报表"

    # REPORT_KPI
    test_intent "KPI" "REPORT_KPI" "报表"
    test_intent "绩效指标" "REPORT_KPI" "报表"
    test_intent "关键指标" "REPORT_KPI" "报表"

    # REPORT_DASHBOARD_OVERVIEW
    test_intent "仪表盘" "REPORT_DASHBOARD_OVERVIEW" "报表"
    test_intent "总览" "REPORT_DASHBOARD_OVERVIEW" "报表"
    test_intent "工厂概况" "REPORT_DASHBOARD_OVERVIEW" "报表"
}

# 8. 考勤 (20个用例)
test_attendance() {
    log "\n${YELLOW}=== 测试考勤 (20个用例) ===${NC}"

    # CLOCK_IN
    test_intent "打卡" "CLOCK_IN" "考勤"
    test_intent "签到" "CLOCK_IN" "考勤"
    test_intent "上班打卡" "CLOCK_IN" "考勤"

    # CLOCK_OUT
    test_intent "下班打卡" "CLOCK_OUT" "考勤"
    test_intent "签退" "CLOCK_OUT" "考勤"

    # ATTENDANCE_TODAY
    test_intent "今日考勤" "ATTENDANCE_TODAY" "考勤"
    test_intent "考勤情况" "ATTENDANCE_TODAY" "考勤"
    test_intent "今天考勤" "ATTENDANCE_TODAY" "考勤"

    # ATTENDANCE_HISTORY
    test_intent "考勤历史" "ATTENDANCE_HISTORY" "考勤"
    test_intent "历史考勤" "ATTENDANCE_HISTORY" "考勤"
    test_intent "历史打卡" "ATTENDANCE_HISTORY" "考勤"

    # ATTENDANCE_STATS
    test_intent "考勤统计" "ATTENDANCE_STATS" "考勤"
    test_intent "出勤统计" "ATTENDANCE_STATS" "考勤"
    test_intent "迟到次数" "ATTENDANCE_STATS" "考勤"

    # ATTENDANCE_ANOMALY
    test_intent "考勤异常" "ATTENDANCE_ANOMALY" "考勤"
    test_intent "迟到记录" "ATTENDANCE_ANOMALY" "考勤"
    test_intent "早退记录" "ATTENDANCE_ANOMALY" "考勤"

    # ATTENDANCE_MONTHLY
    test_intent "月度考勤" "ATTENDANCE_MONTHLY" "考勤"
    test_intent "本月考勤" "ATTENDANCE_MONTHLY" "考勤"
}

# 9. 客户/供应商 (20个用例)
test_crm() {
    log "\n${YELLOW}=== 测试客户/供应商 (20个用例) ===${NC}"

    # CUSTOMER_LIST
    test_intent "客户列表" "CUSTOMER_LIST" "CRM"
    test_intent "所有客户" "CUSTOMER_LIST" "CRM"
    test_intent "客户名单" "CUSTOMER_LIST" "CRM"

    # CUSTOMER_SEARCH
    test_intent "查询客户" "CUSTOMER_SEARCH" "CRM"
    test_intent "搜索客户" "CUSTOMER_SEARCH" "CRM"
    test_intent "找客户" "CUSTOMER_SEARCH" "CRM"

    # CUSTOMER_STATS
    test_intent "客户统计" "CUSTOMER_STATS" "CRM"
    test_intent "客户分析" "CUSTOMER_STATS" "CRM"

    # SUPPLIER_LIST
    test_intent "供应商列表" "SUPPLIER_LIST" "CRM"
    test_intent "所有供应商" "SUPPLIER_LIST" "CRM"

    # SUPPLIER_SEARCH
    test_intent "查询供应商" "SUPPLIER_SEARCH" "CRM"
    test_intent "搜索供应商" "SUPPLIER_SEARCH" "CRM"

    # SUPPLIER_EVALUATE
    test_intent "供应商评估" "SUPPLIER_EVALUATE" "CRM"
    test_intent "评估供应商" "SUPPLIER_EVALUATE" "CRM"

    # SUPPLIER_RANKING
    test_intent "供应商排名" "SUPPLIER_RANKING" "CRM"
    test_intent "最佳供应商" "SUPPLIER_RANKING" "CRM"
}

# 10. 闲聊/通用问题 (20个用例)
test_conversational() {
    log "\n${YELLOW}=== 测试闲聊/通用问题 (20个用例) ===${NC}"

    # 纯闲聊 - 应该不匹配
    test_intent "你好" "NONE" "闲聊"
    test_intent "谢谢" "NONE" "闲聊"
    test_intent "再见" "NONE" "闲聊"
    test_intent "帮帮我" "NONE" "闲聊"
    test_intent "在吗" "NONE" "闲聊"

    # 通用问题 - 应该路由到LLM
    test_intent "如何提高效率" "NONE" "通用"
    test_intent "为什么产量低" "NONE" "通用"
    test_intent "有什么建议" "NONE" "通用"
    test_intent "怎么改进" "NONE" "通用"

    # 带前缀的操作
    test_intent "帮我查库存" "ANY" "混合"
    test_intent "帮我看设备" "ANY" "混合"
    test_intent "帮我查生产" "ANY" "混合"

    # 边界测试
    test_intent "查" "ANY" "边界"
    test_intent "看看" "ANY" "边界"
    test_intent "怎么查库存" "ANY" "边界"
}

# 11. Tool Calling 执行测试 (20个用例)
test_tool_calling() {
    log "\n${YELLOW}=== 测试 Tool Calling 执行 (20个用例) ===${NC}"

    test_execute "设备列表" "Tool"
    test_execute "批次列表" "Tool"
    test_execute "告警列表" "Tool"
    test_execute "客户列表" "Tool"
    test_execute "供应商列表" "Tool"
    test_execute "低库存预警" "Tool"
    test_execute "即将过期" "Tool"
    test_execute "今日考勤" "Tool"
    test_execute "考勤统计" "Tool"
    test_execute "生产报表" "Tool"
    test_execute "质检统计" "Tool"
    test_execute "设备统计" "Tool"
    test_execute "告警统计" "Tool"
    test_execute "仪表盘" "Tool"
    test_execute "KPI" "Tool"
    test_execute "效率报表" "Tool"
    test_execute "出货统计" "Tool"
    test_execute "客户统计" "Tool"
    test_execute "活跃告警" "Tool"
    test_execute "先进先出" "Tool"
}

# 打印报告
print_report() {
    log "\n${BLUE}============================================${NC}"
    log "${BLUE}      意图识别系统测试报告 V2${NC}"
    log "${BLUE}============================================${NC}"
    log ""
    log "测试时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log "测试服务: $SERVER"
    log ""
    log "${YELLOW}--- 测试统计 ---${NC}"
    log "总测试数: $TOTAL_TESTS"
    log "${GREEN}通过: $PASSED_TESTS${NC}"
    log "${RED}失败: $FAILED_TESTS${NC}"

    if [ $TOTAL_TESTS -gt 0 ]; then
        PASS_RATE=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
        log "通过率: ${CYAN}${PASS_RATE}%${NC}"
    fi

    log ""
    log "${YELLOW}--- 匹配层分布 ---${NC}"
    log "Layer 1 (精确表达): ${LAYER_HITS[EXACT]}"
    log "Layer 3 (关键词):   ${LAYER_HITS[KEYWORD]}"
    log "Layer 4 (语义):     ${LAYER_HITS[SEMANTIC]}"
    log "Layer 4 (融合):     ${LAYER_HITS[FUSION]}"
    log "Layer 5 (LLM):      ${LAYER_HITS[LLM]}"
    log "未匹配:             ${LAYER_HITS[NONE]}"
    log ""
    log "详细日志: $LOG_FILE"
    log "${BLUE}============================================${NC}"
}

# 主函数
main() {
    log "${BLUE}========================================${NC}"
    log "${BLUE}  意图识别系统测试 V2 - 使用正确意图代码${NC}"
    log "${BLUE}========================================${NC}"

    if ! login; then
        log "${RED}登录失败，测试终止${NC}"
        exit 1
    fi

    # 刷新缓存
    log "\n${BLUE}[INFO] 刷新意图缓存...${NC}"
    curl -s -X POST "$SERVER/api/mobile/$FACTORY_ID/ai-intents/cache/refresh" \
        -H "Authorization: Bearer $TOKEN" > /dev/null

    # 运行所有测试
    test_processing_batch  # 50
    test_equipment         # 40
    test_material          # 30
    test_alert             # 25
    test_quality           # 20
    test_shipment          # 20
    test_report            # 20
    test_attendance        # 20
    test_crm               # 20
    test_conversational    # 20
    test_tool_calling      # 20
    # 总计约 285 个用例

    echo ""
    print_report
}

main "$@"
