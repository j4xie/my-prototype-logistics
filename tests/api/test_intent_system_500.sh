#!/bin/bash
# 意图识别系统全面测试脚本 - 500个用例
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
LOG_FILE="/tmp/intent_test_500_$(date +%Y%m%d_%H%M%S).log"

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

# ==================== 测试用例集 (500个) ====================

# 1. 生产批次控制 (70个用例)
test_processing_batch() {
    log "\n${YELLOW}=== 测试生产批次控制 (70个用例) ===${NC}"

    # PROCESSING_BATCH_START (15个)
    test_intent "开始生产" "PROCESSING_BATCH_START" "生产"
    test_intent "启动生产" "PROCESSING_BATCH_START" "生产"
    test_intent "启动生产线" "PROCESSING_BATCH_START" "生产"
    test_intent "帮我启动生产线" "PROCESSING_BATCH_START" "生产"
    test_intent "开工" "PROCESSING_BATCH_START" "生产"
    test_intent "开始干活" "PROCESSING_BATCH_START" "生产"
    test_intent "开始作业" "PROCESSING_BATCH_START" "生产"
    test_intent "生产开始" "PROCESSING_BATCH_START" "生产"
    test_intent "把生产开起来" "PROCESSING_BATCH_START" "生产"
    test_intent "开始运行" "PROCESSING_BATCH_START" "生产"
    test_intent "生产线启动" "PROCESSING_BATCH_START" "生产"
    test_intent "开动生产" "PROCESSING_BATCH_START" "生产"
    test_intent "帮我开工" "PROCESSING_BATCH_START" "生产"
    test_intent "现在开始生产" "PROCESSING_BATCH_START" "生产"
    test_intent "立即开始生产" "PROCESSING_BATCH_START" "生产"

    # PROCESSING_BATCH_PAUSE (12个)
    test_intent "暂停生产" "PROCESSING_BATCH_PAUSE" "生产"
    test_intent "停一下生产线" "PROCESSING_BATCH_PAUSE" "生产"
    test_intent "帮我停一下生产线" "PROCESSING_BATCH_PAUSE" "生产"
    test_intent "生产暂停" "PROCESSING_BATCH_PAUSE" "生产"
    test_intent "中断生产" "PROCESSING_BATCH_PAUSE" "生产"
    test_intent "停生产线" "PROCESSING_BATCH_PAUSE" "生产"
    test_intent "生产线停一下" "PROCESSING_BATCH_PAUSE" "生产"
    test_intent "把生产停了" "PROCESSING_BATCH_PAUSE" "生产"
    test_intent "停掉生产" "PROCESSING_BATCH_PAUSE" "生产"
    test_intent "生产暂停一下" "PROCESSING_BATCH_PAUSE" "生产"
    test_intent "暂停一下生产" "PROCESSING_BATCH_PAUSE" "生产"
    test_intent "暂停作业" "PROCESSING_BATCH_PAUSE" "生产"

    # PROCESSING_BATCH_RESUME (8个)
    test_intent "恢复生产" "PROCESSING_BATCH_RESUME" "生产"
    test_intent "继续生产" "PROCESSING_BATCH_RESUME" "生产"
    test_intent "重新开始" "PROCESSING_BATCH_RESUME" "生产"
    test_intent "接着生产" "PROCESSING_BATCH_RESUME" "生产"
    test_intent "生产恢复" "PROCESSING_BATCH_RESUME" "生产"
    test_intent "继续做" "PROCESSING_BATCH_RESUME" "生产"
    test_intent "恢复作业" "PROCESSING_BATCH_RESUME" "生产"
    test_intent "重启生产" "PROCESSING_BATCH_RESUME" "生产"

    # PROCESSING_BATCH_COMPLETE (8个)
    test_intent "完成生产" "PROCESSING_BATCH_COMPLETE" "生产"
    test_intent "生产完成" "PROCESSING_BATCH_COMPLETE" "生产"
    test_intent "结束生产" "PROCESSING_BATCH_COMPLETE" "生产"
    test_intent "完工" "PROCESSING_BATCH_COMPLETE" "生产"
    test_intent "收工" "PROCESSING_BATCH_COMPLETE" "生产"
    test_intent "做完了" "PROCESSING_BATCH_COMPLETE" "生产"
    test_intent "生产好了" "PROCESSING_BATCH_COMPLETE" "生产"
    test_intent "结束作业" "PROCESSING_BATCH_COMPLETE" "生产"

    # PROCESSING_BATCH_LIST (8个)
    test_intent "批次列表" "PROCESSING_BATCH_LIST" "生产"
    test_intent "生产列表" "PROCESSING_BATCH_LIST" "生产"
    test_intent "所有批次" "PROCESSING_BATCH_LIST" "生产"
    test_intent "查看所有生产批次" "PROCESSING_BATCH_LIST" "生产"
    test_intent "生产批次列表" "PROCESSING_BATCH_LIST" "生产"
    test_intent "全部批次" "PROCESSING_BATCH_LIST" "生产"
    test_intent "批次清单" "PROCESSING_BATCH_LIST" "生产"
    test_intent "列出批次" "PROCESSING_BATCH_LIST" "生产"

    # PROCESSING_BATCH_DETAIL (5个)
    test_intent "批次详情" "PROCESSING_BATCH_DETAIL" "生产"
    test_intent "生产详情" "PROCESSING_BATCH_DETAIL" "生产"
    test_intent "查看批次详情" "PROCESSING_BATCH_DETAIL" "生产"
    test_intent "批次信息" "PROCESSING_BATCH_DETAIL" "生产"
    test_intent "生产批次详情" "PROCESSING_BATCH_DETAIL" "生产"

    # PROCESSING_BATCH_CREATE (6个)
    test_intent "创建生产" "PROCESSING_BATCH_CREATE" "生产"
    test_intent "新建生产" "PROCESSING_BATCH_CREATE" "生产"
    test_intent "开新批次" "PROCESSING_BATCH_CREATE" "生产"
    test_intent "新生产批次" "PROCESSING_BATCH_CREATE" "生产"
    test_intent "创建批次" "PROCESSING_BATCH_CREATE" "生产"
    test_intent "新建批次" "PROCESSING_BATCH_CREATE" "生产"

    # PROCESSING_BATCH_CANCEL (4个)
    test_intent "取消生产" "PROCESSING_BATCH_CANCEL" "生产"
    test_intent "撤销生产" "PROCESSING_BATCH_CANCEL" "生产"
    test_intent "删除批次" "PROCESSING_BATCH_CANCEL" "生产"
    test_intent "取消批次" "PROCESSING_BATCH_CANCEL" "生产"

    # PROCESSING_BATCH_TIMELINE (4个)
    test_intent "批次时间线" "PROCESSING_BATCH_TIMELINE" "生产"
    test_intent "生产历史" "PROCESSING_BATCH_TIMELINE" "生产"
    test_intent "批次记录" "PROCESSING_BATCH_TIMELINE" "生产"
    test_intent "生产时间线" "PROCESSING_BATCH_TIMELINE" "生产"
}

# 2. 设备管理 (60个用例)
test_equipment() {
    log "\n${YELLOW}=== 测试设备管理 (60个用例) ===${NC}"

    # EQUIPMENT_LIST (10个)
    test_intent "设备列表" "EQUIPMENT_LIST" "设备"
    test_intent "查看设备" "EQUIPMENT_LIST" "设备"
    test_intent "设备查询" "EQUIPMENT_LIST" "设备"
    test_intent "所有设备" "EQUIPMENT_LIST" "设备"
    test_intent "设备清单" "EQUIPMENT_LIST" "设备"
    test_intent "全部设备" "EQUIPMENT_LIST" "设备"
    test_intent "设备一览" "EQUIPMENT_LIST" "设备"
    test_intent "查设备" "EQUIPMENT_LIST" "设备"
    test_intent "看设备" "EQUIPMENT_LIST" "设备"
    test_intent "设备都有哪些" "EQUIPMENT_LIST" "设备"

    # EQUIPMENT_DETAIL (6个)
    test_intent "设备详情" "EQUIPMENT_DETAIL" "设备"
    test_intent "设备信息" "EQUIPMENT_DETAIL" "设备"
    test_intent "设备状态" "EQUIPMENT_DETAIL" "设备"
    test_intent "单个设备" "EQUIPMENT_DETAIL" "设备"
    test_intent "设备详细信息" "EQUIPMENT_DETAIL" "设备"
    test_intent "查看某个设备" "EQUIPMENT_DETAIL" "设备"

    # EQUIPMENT_STOP (10个)
    test_intent "停止设备" "EQUIPMENT_STOP" "设备"
    test_intent "关闭设备" "EQUIPMENT_STOP" "设备"
    test_intent "把设备停一下" "EQUIPMENT_STOP" "设备"
    test_intent "停一下设备" "EQUIPMENT_STOP" "设备"
    test_intent "关掉设备" "EQUIPMENT_STOP" "设备"
    test_intent "设备停止" "EQUIPMENT_STOP" "设备"
    test_intent "关设备" "EQUIPMENT_STOP" "设备"
    test_intent "停设备" "EQUIPMENT_STOP" "设备"
    test_intent "把设备停了" "EQUIPMENT_STOP" "设备"
    test_intent "设备关闭" "EQUIPMENT_STOP" "设备"

    # EQUIPMENT_START (10个)
    test_intent "启动设备" "EQUIPMENT_START" "设备"
    test_intent "开设备" "EQUIPMENT_START" "设备"
    test_intent "打开设备" "EQUIPMENT_START" "设备"
    test_intent "设备启动" "EQUIPMENT_START" "设备"
    test_intent "开启设备" "EQUIPMENT_START" "设备"
    test_intent "把设备开起来" "EQUIPMENT_START" "设备"
    test_intent "启动机器" "EQUIPMENT_START" "设备"
    test_intent "开机器" "EQUIPMENT_START" "设备"
    test_intent "设备开一下" "EQUIPMENT_START" "设备"
    test_intent "启动一下设备" "EQUIPMENT_START" "设备"

    # EQUIPMENT_MAINTENANCE (8个)
    test_intent "设备维护" "EQUIPMENT_MAINTENANCE" "设备"
    test_intent "维护设备" "EQUIPMENT_MAINTENANCE" "设备"
    test_intent "保养设备" "EQUIPMENT_MAINTENANCE" "设备"
    test_intent "设备保养" "EQUIPMENT_MAINTENANCE" "设备"
    test_intent "检修设备" "EQUIPMENT_MAINTENANCE" "设备"
    test_intent "设备检修" "EQUIPMENT_MAINTENANCE" "设备"
    test_intent "保养一下" "EQUIPMENT_MAINTENANCE" "设备"
    test_intent "维护一下设备" "EQUIPMENT_MAINTENANCE" "设备"

    # EQUIPMENT_STATS (6个)
    test_intent "设备统计" "EQUIPMENT_STATS" "设备"
    test_intent "设备概况" "EQUIPMENT_STATS" "设备"
    test_intent "设备汇总" "EQUIPMENT_STATS" "设备"
    test_intent "设备数据" "EQUIPMENT_STATS" "设备"
    test_intent "设备运行统计" "EQUIPMENT_STATS" "设备"
    test_intent "设备使用统计" "EQUIPMENT_STATS" "设备"

    # EQUIPMENT_ALERT_LIST (6个)
    test_intent "设备警报" "EQUIPMENT_ALERT_LIST" "设备"
    test_intent "设备故障" "EQUIPMENT_ALERT_LIST" "设备"
    test_intent "设备异常" "EQUIPMENT_ALERT_LIST" "设备"
    test_intent "设备问题" "EQUIPMENT_ALERT_LIST" "设备"
    test_intent "设备有什么问题" "EQUIPMENT_ALERT_LIST" "设备"
    test_intent "设备出问题了吗" "EQUIPMENT_ALERT_LIST" "设备"

    # EQUIPMENT_ALERT_STATS (4个)
    test_intent "设备告警统计" "EQUIPMENT_ALERT_STATS" "设备"
    test_intent "故障统计" "EQUIPMENT_ALERT_STATS" "设备"
    test_intent "设备故障统计" "EQUIPMENT_ALERT_STATS" "设备"
    test_intent "设备异常统计" "EQUIPMENT_ALERT_STATS" "设备"
}

# 3. 原材料管理 (50个用例)
test_material() {
    log "\n${YELLOW}=== 测试原材料管理 (50个用例) ===${NC}"

    # MATERIAL_BATCH_QUERY (10个)
    test_intent "查询原料" "MATERIAL_BATCH_QUERY" "原材料"
    test_intent "原料批次" "MATERIAL_BATCH_QUERY" "原材料"
    test_intent "原料信息" "MATERIAL_BATCH_QUERY" "原材料"
    test_intent "库存查询" "MATERIAL_BATCH_QUERY" "原材料"
    test_intent "原材料查询" "MATERIAL_BATCH_QUERY" "原材料"
    test_intent "原料库存" "MATERIAL_BATCH_QUERY" "原材料"
    test_intent "查原料" "MATERIAL_BATCH_QUERY" "原材料"
    test_intent "看原料" "MATERIAL_BATCH_QUERY" "原材料"
    test_intent "原材料信息" "MATERIAL_BATCH_QUERY" "原材料"
    test_intent "物料查询" "MATERIAL_BATCH_QUERY" "原材料"

    # MATERIAL_BATCH_USE (8个)
    test_intent "使用原料" "MATERIAL_BATCH_USE" "原材料"
    test_intent "领用原料" "MATERIAL_BATCH_USE" "原材料"
    test_intent "出库原料" "MATERIAL_BATCH_USE" "原材料"
    test_intent "消耗原料" "MATERIAL_BATCH_USE" "原材料"
    test_intent "原料出库" "MATERIAL_BATCH_USE" "原材料"
    test_intent "领料" "MATERIAL_BATCH_USE" "原材料"
    test_intent "用原料" "MATERIAL_BATCH_USE" "原材料"
    test_intent "取原料" "MATERIAL_BATCH_USE" "原材料"

    # MATERIAL_BATCH_RESERVE (6个)
    test_intent "预留原料" "MATERIAL_BATCH_RESERVE" "原材料"
    test_intent "预订原料" "MATERIAL_BATCH_RESERVE" "原材料"
    test_intent "锁定原料" "MATERIAL_BATCH_RESERVE" "原材料"
    test_intent "原料预留" "MATERIAL_BATCH_RESERVE" "原材料"
    test_intent "预约原料" "MATERIAL_BATCH_RESERVE" "原材料"
    test_intent "保留原料" "MATERIAL_BATCH_RESERVE" "原材料"

    # MATERIAL_BATCH_RELEASE (5个)
    test_intent "释放原料" "MATERIAL_BATCH_RELEASE" "原材料"
    test_intent "取消预留" "MATERIAL_BATCH_RELEASE" "原材料"
    test_intent "解锁原料" "MATERIAL_BATCH_RELEASE" "原材料"
    test_intent "原料释放" "MATERIAL_BATCH_RELEASE" "原材料"
    test_intent "取消锁定" "MATERIAL_BATCH_RELEASE" "原材料"

    # MATERIAL_LOW_STOCK_ALERT (6个)
    test_intent "低库存预警" "MATERIAL_LOW_STOCK_ALERT" "原材料"
    test_intent "库存不足预警" "MATERIAL_LOW_STOCK_ALERT" "原材料"
    test_intent "缺货预警" "MATERIAL_LOW_STOCK_ALERT" "原材料"
    test_intent "库存不足" "MATERIAL_LOW_STOCK_ALERT" "原材料"
    test_intent "低库存" "MATERIAL_LOW_STOCK_ALERT" "原材料"
    test_intent "缺货" "MATERIAL_LOW_STOCK_ALERT" "原材料"

    # MATERIAL_EXPIRING_ALERT (5个)
    test_intent "即将过期" "MATERIAL_EXPIRING_ALERT" "原材料"
    test_intent "过期预警" "MATERIAL_EXPIRING_ALERT" "原材料"
    test_intent "临期原料" "MATERIAL_EXPIRING_ALERT" "原材料"
    test_intent "快过期" "MATERIAL_EXPIRING_ALERT" "原材料"
    test_intent "临期预警" "MATERIAL_EXPIRING_ALERT" "原材料"

    # MATERIAL_EXPIRED_QUERY (4个)
    test_intent "已过期" "MATERIAL_EXPIRED_QUERY" "原材料"
    test_intent "过期批次" "MATERIAL_EXPIRED_QUERY" "原材料"
    test_intent "过期原料" "MATERIAL_EXPIRED_QUERY" "原材料"
    test_intent "已过期原料" "MATERIAL_EXPIRED_QUERY" "原材料"

    # MATERIAL_FIFO_RECOMMEND (3个)
    test_intent "先进先出" "MATERIAL_FIFO_RECOMMEND" "原材料"
    test_intent "FIFO" "MATERIAL_FIFO_RECOMMEND" "原材料"
    test_intent "原料推荐" "MATERIAL_FIFO_RECOMMEND" "原材料"

    # MATERIAL_ADJUST_QUANTITY (3个)
    test_intent "调整库存" "MATERIAL_ADJUST_QUANTITY" "原材料"
    test_intent "修改数量" "MATERIAL_ADJUST_QUANTITY" "原材料"
    test_intent "盘点调整" "MATERIAL_ADJUST_QUANTITY" "原材料"
}

# 4. 告警管理 (40个用例)
test_alert() {
    log "\n${YELLOW}=== 测试告警管理 (40个用例) ===${NC}"

    # ALERT_LIST (6个)
    test_intent "查看告警" "ALERT_LIST" "告警"
    test_intent "告警记录" "ALERT_LIST" "告警"
    test_intent "所有告警" "ALERT_LIST" "告警"
    test_intent "告警查询" "ALERT_LIST" "告警"
    test_intent "全部告警" "ALERT_LIST" "告警"
    test_intent "警报列表" "ALERT_LIST" "告警"

    # ALERT_ACTIVE (8个)
    test_intent "活跃告警" "ALERT_ACTIVE" "告警"
    test_intent "当前告警" "ALERT_ACTIVE" "告警"
    test_intent "未处理告警" "ALERT_ACTIVE" "告警"
    test_intent "机器今天有啥问题吗" "ALERT_ACTIVE" "告警"
    test_intent "有什么告警" "ALERT_ACTIVE" "告警"
    test_intent "现在有告警吗" "ALERT_ACTIVE" "告警"
    test_intent "待处理告警" "ALERT_ACTIVE" "告警"
    test_intent "进行中告警" "ALERT_ACTIVE" "告警"

    # ALERT_ACKNOWLEDGE (6个)
    test_intent "确认告警" "ALERT_ACKNOWLEDGE" "告警"
    test_intent "处理告警" "ALERT_ACKNOWLEDGE" "告警"
    test_intent "告警确认" "ALERT_ACKNOWLEDGE" "告警"
    test_intent "我知道了" "ALERT_ACKNOWLEDGE" "告警"
    test_intent "收到告警" "ALERT_ACKNOWLEDGE" "告警"
    test_intent "确认收到" "ALERT_ACKNOWLEDGE" "告警"

    # ALERT_RESOLVE (6个)
    test_intent "解决告警" "ALERT_RESOLVE" "告警"
    test_intent "告警已解决" "ALERT_RESOLVE" "告警"
    test_intent "关闭告警" "ALERT_RESOLVE" "告警"
    test_intent "告警处理完毕" "ALERT_RESOLVE" "告警"
    test_intent "修复完成" "ALERT_RESOLVE" "告警"
    test_intent "问题已解决" "ALERT_RESOLVE" "告警"

    # ALERT_BY_LEVEL (5个)
    test_intent "按级别告警" "ALERT_BY_LEVEL" "告警"
    test_intent "严重告警" "ALERT_BY_LEVEL" "告警"
    test_intent "高级别告警" "ALERT_BY_LEVEL" "告警"
    test_intent "危险告警" "ALERT_BY_LEVEL" "告警"
    test_intent "重要告警" "ALERT_BY_LEVEL" "告警"

    # ALERT_DIAGNOSE (5个)
    test_intent "告警诊断" "ALERT_DIAGNOSE" "告警"
    test_intent "故障诊断" "ALERT_DIAGNOSE" "告警"
    test_intent "问题分析" "ALERT_DIAGNOSE" "告警"
    test_intent "诊断一下" "ALERT_DIAGNOSE" "告警"
    test_intent "分析原因" "ALERT_DIAGNOSE" "告警"

    # ALERT_TRIAGE (4个)
    test_intent "告警分级" "ALERT_TRIAGE" "告警"
    test_intent "智能分级" "ALERT_TRIAGE" "告警"
    test_intent "告警优先级" "ALERT_TRIAGE" "告警"
    test_intent "分级处理" "ALERT_TRIAGE" "告警"
}

# 5. 质检管理 (35个用例)
test_quality() {
    log "\n${YELLOW}=== 测试质检管理 (35个用例) ===${NC}"

    # QUALITY_CHECK_QUERY (8个)
    test_intent "质检项查询" "QUALITY_CHECK_QUERY" "质检"
    test_intent "查询质检项" "QUALITY_CHECK_QUERY" "质检"
    test_intent "质检项列表" "QUALITY_CHECK_QUERY" "质检"
    test_intent "质检查询" "QUALITY_CHECK_QUERY" "质检"
    test_intent "检验项目" "QUALITY_CHECK_QUERY" "质检"
    test_intent "检测项目" "QUALITY_CHECK_QUERY" "质检"
    test_intent "质检项目" "QUALITY_CHECK_QUERY" "质检"
    test_intent "查质检" "QUALITY_CHECK_QUERY" "质检"

    # QUALITY_CHECK_EXECUTE (8个)
    test_intent "执行质检" "QUALITY_CHECK_EXECUTE" "质检"
    test_intent "提交质检" "QUALITY_CHECK_EXECUTE" "质检"
    test_intent "质检记录" "QUALITY_CHECK_EXECUTE" "质检"
    test_intent "检测结果" "QUALITY_CHECK_EXECUTE" "质检"
    test_intent "做质检" "QUALITY_CHECK_EXECUTE" "质检"
    test_intent "开始质检" "QUALITY_CHECK_EXECUTE" "质检"
    test_intent "质量检测" "QUALITY_CHECK_EXECUTE" "质检"
    test_intent "进行质检" "QUALITY_CHECK_EXECUTE" "质检"

    # QUALITY_CRITICAL_ITEMS (5个)
    test_intent "关键质检项" "QUALITY_CRITICAL_ITEMS" "质检"
    test_intent "关键质检" "QUALITY_CRITICAL_ITEMS" "质检"
    test_intent "必检项" "QUALITY_CRITICAL_ITEMS" "质检"
    test_intent "重要检测项" "QUALITY_CRITICAL_ITEMS" "质检"
    test_intent "必须检查" "QUALITY_CRITICAL_ITEMS" "质检"

    # QUALITY_STATS (6个)
    test_intent "质检统计" "QUALITY_STATS" "质检"
    test_intent "质检合格率" "QUALITY_STATS" "质检"
    test_intent "质量数据" "QUALITY_STATS" "质检"
    test_intent "检测合格率" "QUALITY_STATS" "质检"
    test_intent "质检数据" "QUALITY_STATS" "质检"
    test_intent "质量合格率" "QUALITY_STATS" "质检"

    # QUALITY_DISPOSITION_EXECUTE (8个)
    test_intent "执行处置" "QUALITY_DISPOSITION_EXECUTE" "质检"
    test_intent "返工" "QUALITY_DISPOSITION_EXECUTE" "质检"
    test_intent "报废" "QUALITY_DISPOSITION_EXECUTE" "质检"
    test_intent "放行" "QUALITY_DISPOSITION_EXECUTE" "质检"
    test_intent "处理不合格品" "QUALITY_DISPOSITION_EXECUTE" "质检"
    test_intent "不合格处理" "QUALITY_DISPOSITION_EXECUTE" "质检"
    test_intent "产品处置" "QUALITY_DISPOSITION_EXECUTE" "质检"
    test_intent "返工处理" "QUALITY_DISPOSITION_EXECUTE" "质检"
}

# 6. 出货/发货 (35个用例)
test_shipment() {
    log "\n${YELLOW}=== 测试出货/发货 (35个用例) ===${NC}"

    # SHIPMENT_QUERY (8个)
    test_intent "查询出货" "SHIPMENT_QUERY" "出货"
    test_intent "出货记录" "SHIPMENT_QUERY" "出货"
    test_intent "出货单查询" "SHIPMENT_QUERY" "出货"
    test_intent "发货记录" "SHIPMENT_QUERY" "出货"
    test_intent "查发货" "SHIPMENT_QUERY" "出货"
    test_intent "出货查询" "SHIPMENT_QUERY" "出货"
    test_intent "发货查询" "SHIPMENT_QUERY" "出货"
    test_intent "查出货" "SHIPMENT_QUERY" "出货"

    # SHIPMENT_CREATE (8个)
    test_intent "创建出货" "SHIPMENT_CREATE" "出货"
    test_intent "新建出货" "SHIPMENT_CREATE" "出货"
    test_intent "发货" "SHIPMENT_CREATE" "出货"
    test_intent "出货登记" "SHIPMENT_CREATE" "出货"
    test_intent "新增出货" "SHIPMENT_CREATE" "出货"
    test_intent "录入发货" "SHIPMENT_CREATE" "出货"
    test_intent "登记发货" "SHIPMENT_CREATE" "出货"
    test_intent "创建发货单" "SHIPMENT_CREATE" "出货"

    # SHIPMENT_BY_DATE (7个)
    test_intent "今天出货" "SHIPMENT_BY_DATE" "出货"
    test_intent "昨天出货" "SHIPMENT_BY_DATE" "出货"
    test_intent "本周出货" "SHIPMENT_BY_DATE" "出货"
    test_intent "今日发货" "SHIPMENT_BY_DATE" "出货"
    test_intent "本月出货" "SHIPMENT_BY_DATE" "出货"
    test_intent "近期出货" "SHIPMENT_BY_DATE" "出货"
    test_intent "最近发货" "SHIPMENT_BY_DATE" "出货"

    # SHIPMENT_STATS (6个)
    test_intent "出货统计" "SHIPMENT_STATS" "出货"
    test_intent "出货报表" "SHIPMENT_STATS" "出货"
    test_intent "发货数据" "SHIPMENT_STATS" "出货"
    test_intent "出货汇总" "SHIPMENT_STATS" "出货"
    test_intent "发货报表" "SHIPMENT_STATS" "出货"
    test_intent "出货量" "SHIPMENT_STATS" "出货"

    # SHIPMENT_STATUS_UPDATE (6个)
    test_intent "出货状态" "SHIPMENT_STATUS_UPDATE" "出货"
    test_intent "发货状态" "SHIPMENT_STATUS_UPDATE" "出货"
    test_intent "确认送达" "SHIPMENT_STATUS_UPDATE" "出货"
    test_intent "更新出货状态" "SHIPMENT_STATUS_UPDATE" "出货"
    test_intent "出货进度" "SHIPMENT_STATUS_UPDATE" "出货"
    test_intent "物流状态" "SHIPMENT_STATUS_UPDATE" "出货"
}

# 7. 报表 (35个用例)
test_report() {
    log "\n${YELLOW}=== 测试报表 (35个用例) ===${NC}"

    # REPORT_PRODUCTION (6个)
    test_intent "生产报表" "REPORT_PRODUCTION" "报表"
    test_intent "产量统计" "REPORT_PRODUCTION" "报表"
    test_intent "生产统计" "REPORT_PRODUCTION" "报表"
    test_intent "产量报表" "REPORT_PRODUCTION" "报表"
    test_intent "生产数据" "REPORT_PRODUCTION" "报表"
    test_intent "产量数据" "REPORT_PRODUCTION" "报表"

    # REPORT_QUALITY (5个)
    test_intent "质量报表" "REPORT_QUALITY" "报表"
    test_intent "质量统计" "REPORT_QUALITY" "报表"
    test_intent "合格率报表" "REPORT_QUALITY" "报表"
    test_intent "质量数据报表" "REPORT_QUALITY" "报表"
    test_intent "品质报表" "REPORT_QUALITY" "报表"

    # REPORT_INVENTORY (5个)
    test_intent "库存报表" "REPORT_INVENTORY" "报表"
    test_intent "库存统计" "REPORT_INVENTORY" "报表"
    test_intent "库存数据" "REPORT_INVENTORY" "报表"
    test_intent "仓库报表" "REPORT_INVENTORY" "报表"
    test_intent "存货报表" "REPORT_INVENTORY" "报表"

    # REPORT_FINANCE (5个)
    test_intent "财务报表" "REPORT_FINANCE" "报表"
    test_intent "成本报表" "REPORT_FINANCE" "报表"
    test_intent "收支统计" "REPORT_FINANCE" "报表"
    test_intent "财务数据" "REPORT_FINANCE" "报表"
    test_intent "成本统计" "REPORT_FINANCE" "报表"

    # REPORT_EFFICIENCY (5个)
    test_intent "效率报表" "REPORT_EFFICIENCY" "报表"
    test_intent "效率分析" "REPORT_EFFICIENCY" "报表"
    test_intent "产能分析" "REPORT_EFFICIENCY" "报表"
    test_intent "效率数据" "REPORT_EFFICIENCY" "报表"
    test_intent "生产效率" "REPORT_EFFICIENCY" "报表"

    # REPORT_KPI (5个)
    test_intent "KPI" "REPORT_KPI" "报表"
    test_intent "绩效指标" "REPORT_KPI" "报表"
    test_intent "关键指标" "REPORT_KPI" "报表"
    test_intent "KPI报表" "REPORT_KPI" "报表"
    test_intent "业绩指标" "REPORT_KPI" "报表"

    # REPORT_DASHBOARD_OVERVIEW (4个)
    test_intent "仪表盘" "REPORT_DASHBOARD_OVERVIEW" "报表"
    test_intent "总览" "REPORT_DASHBOARD_OVERVIEW" "报表"
    test_intent "工厂概况" "REPORT_DASHBOARD_OVERVIEW" "报表"
    test_intent "数据总览" "REPORT_DASHBOARD_OVERVIEW" "报表"
}

# 8. 考勤 (35个用例)
test_attendance() {
    log "\n${YELLOW}=== 测试考勤 (35个用例) ===${NC}"

    # CLOCK_IN (8个)
    test_intent "打卡" "CLOCK_IN" "考勤"
    test_intent "签到" "CLOCK_IN" "考勤"
    test_intent "上班打卡" "CLOCK_IN" "考勤"
    test_intent "我要打卡" "CLOCK_IN" "考勤"
    test_intent "帮我打卡" "CLOCK_IN" "考勤"
    test_intent "上班签到" "CLOCK_IN" "考勤"
    test_intent "上班了" "CLOCK_IN" "考勤"
    test_intent "到了" "CLOCK_IN" "考勤"

    # CLOCK_OUT (5个)
    test_intent "签退" "CLOCK_OUT" "考勤"
    test_intent "下班签退" "CLOCK_OUT" "考勤"
    test_intent "下班了" "CLOCK_OUT" "考勤"
    test_intent "我要下班" "CLOCK_OUT" "考勤"
    test_intent "下班签到" "CLOCK_OUT" "考勤"

    # ATTENDANCE_TODAY (6个)
    test_intent "今日考勤" "ATTENDANCE_TODAY" "考勤"
    test_intent "考勤情况" "ATTENDANCE_TODAY" "考勤"
    test_intent "今天考勤" "ATTENDANCE_TODAY" "考勤"
    test_intent "今天出勤" "ATTENDANCE_TODAY" "考勤"
    test_intent "今日出勤" "ATTENDANCE_TODAY" "考勤"
    test_intent "谁来了" "ATTENDANCE_TODAY" "考勤"

    # ATTENDANCE_HISTORY (5个)
    test_intent "考勤历史" "ATTENDANCE_HISTORY" "考勤"
    test_intent "历史考勤" "ATTENDANCE_HISTORY" "考勤"
    test_intent "历史打卡" "ATTENDANCE_HISTORY" "考勤"
    test_intent "打卡记录" "ATTENDANCE_HISTORY" "考勤"
    test_intent "考勤记录" "ATTENDANCE_HISTORY" "考勤"

    # ATTENDANCE_STATS (5个)
    test_intent "考勤统计" "ATTENDANCE_STATS" "考勤"
    test_intent "出勤统计" "ATTENDANCE_STATS" "考勤"
    test_intent "迟到次数" "ATTENDANCE_STATS" "考勤"
    test_intent "出勤率" "ATTENDANCE_STATS" "考勤"
    test_intent "考勤数据" "ATTENDANCE_STATS" "考勤"

    # ATTENDANCE_ANOMALY (4个)
    test_intent "考勤异常" "ATTENDANCE_ANOMALY" "考勤"
    test_intent "迟到记录" "ATTENDANCE_ANOMALY" "考勤"
    test_intent "早退记录" "ATTENDANCE_ANOMALY" "考勤"
    test_intent "缺勤记录" "ATTENDANCE_ANOMALY" "考勤"

    # ATTENDANCE_MONTHLY (2个)
    test_intent "月度考勤" "ATTENDANCE_MONTHLY" "考勤"
    test_intent "本月考勤" "ATTENDANCE_MONTHLY" "考勤"
}

# 9. 客户/供应商 (35个用例)
test_crm() {
    log "\n${YELLOW}=== 测试客户/供应商 (35个用例) ===${NC}"

    # CUSTOMER_LIST (6个)
    test_intent "客户列表" "CUSTOMER_LIST" "CRM"
    test_intent "所有客户" "CUSTOMER_LIST" "CRM"
    test_intent "客户名单" "CUSTOMER_LIST" "CRM"
    test_intent "客户清单" "CUSTOMER_LIST" "CRM"
    test_intent "全部客户" "CUSTOMER_LIST" "CRM"
    test_intent "查看客户" "CUSTOMER_LIST" "CRM"

    # CUSTOMER_SEARCH (6个)
    test_intent "查询客户" "CUSTOMER_SEARCH" "CRM"
    test_intent "搜索客户" "CUSTOMER_SEARCH" "CRM"
    test_intent "找客户" "CUSTOMER_SEARCH" "CRM"
    test_intent "查客户" "CUSTOMER_SEARCH" "CRM"
    test_intent "客户查询" "CUSTOMER_SEARCH" "CRM"
    test_intent "客户搜索" "CUSTOMER_SEARCH" "CRM"

    # CUSTOMER_STATS (5个)
    test_intent "客户统计" "CUSTOMER_STATS" "CRM"
    test_intent "客户分析" "CUSTOMER_STATS" "CRM"
    test_intent "客户数据" "CUSTOMER_STATS" "CRM"
    test_intent "客户报表" "CUSTOMER_STATS" "CRM"
    test_intent "客户情况" "CUSTOMER_STATS" "CRM"

    # SUPPLIER_LIST (6个)
    test_intent "供应商列表" "SUPPLIER_LIST" "CRM"
    test_intent "所有供应商" "SUPPLIER_LIST" "CRM"
    test_intent "供应商名单" "SUPPLIER_LIST" "CRM"
    test_intent "供应商清单" "SUPPLIER_LIST" "CRM"
    test_intent "全部供应商" "SUPPLIER_LIST" "CRM"
    test_intent "查看供应商" "SUPPLIER_LIST" "CRM"

    # SUPPLIER_SEARCH (5个)
    test_intent "查询供应商" "SUPPLIER_SEARCH" "CRM"
    test_intent "搜索供应商" "SUPPLIER_SEARCH" "CRM"
    test_intent "找供应商" "SUPPLIER_SEARCH" "CRM"
    test_intent "查供应商" "SUPPLIER_SEARCH" "CRM"
    test_intent "供应商查询" "SUPPLIER_SEARCH" "CRM"

    # SUPPLIER_EVALUATE (4个)
    test_intent "供应商评估" "SUPPLIER_EVALUATE" "CRM"
    test_intent "评估供应商" "SUPPLIER_EVALUATE" "CRM"
    test_intent "供应商评价" "SUPPLIER_EVALUATE" "CRM"
    test_intent "供应商评分" "SUPPLIER_EVALUATE" "CRM"

    # SUPPLIER_RANKING (3个)
    test_intent "供应商排名" "SUPPLIER_RANKING" "CRM"
    test_intent "最佳供应商" "SUPPLIER_RANKING" "CRM"
    test_intent "供应商排行" "SUPPLIER_RANKING" "CRM"
}

# 10. 闲聊/通用问题 (35个用例)
test_conversational() {
    log "\n${YELLOW}=== 测试闲聊/通用问题 (35个用例) ===${NC}"

    # 纯闲聊 - 应该不匹配 (10个)
    test_intent "你好" "NONE" "闲聊"
    test_intent "谢谢" "NONE" "闲聊"
    test_intent "再见" "NONE" "闲聊"
    test_intent "帮帮我" "NONE" "闲聊"
    test_intent "在吗" "NONE" "闲聊"
    test_intent "嗨" "NONE" "闲聊"
    test_intent "早上好" "NONE" "闲聊"
    test_intent "晚安" "NONE" "闲聊"
    test_intent "好的" "NONE" "闲聊"
    test_intent "明白了" "NONE" "闲聊"

    # 通用问题 - 应该路由到LLM (10个)
    test_intent "如何提高效率" "NONE" "通用"
    test_intent "为什么产量低" "NONE" "通用"
    test_intent "有什么建议" "NONE" "通用"
    test_intent "怎么改进" "NONE" "通用"
    test_intent "什么是最佳实践" "NONE" "通用"
    test_intent "如何优化" "NONE" "通用"
    test_intent "有什么好方法" "NONE" "通用"
    test_intent "怎么做更好" "NONE" "通用"
    test_intent "能给点建议吗" "NONE" "通用"
    test_intent "怎么解决这个问题" "NONE" "通用"

    # 带前缀的操作 (10个)
    test_intent "帮我查库存" "ANY" "混合"
    test_intent "帮我看设备" "ANY" "混合"
    test_intent "帮我查生产" "ANY" "混合"
    test_intent "帮我查告警" "ANY" "混合"
    test_intent "帮我看报表" "ANY" "混合"
    test_intent "帮我查客户" "ANY" "混合"
    test_intent "帮我看考勤" "ANY" "混合"
    test_intent "帮我查质检" "ANY" "混合"
    test_intent "帮我看出货" "ANY" "混合"
    test_intent "帮我查供应商" "ANY" "混合"

    # 边界测试 (5个)
    test_intent "查" "ANY" "边界"
    test_intent "看看" "ANY" "边界"
    test_intent "统计" "ANY" "边界"
    test_intent "报表" "ANY" "边界"
    test_intent "列表" "ANY" "边界"
}

# 11. Tool Calling 执行测试 (30个用例)
test_tool_calling() {
    log "\n${YELLOW}=== 测试 Tool Calling 执行 (30个用例) ===${NC}"

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
    test_execute "查询原料" "Tool"
    test_execute "质检查询" "Tool"
    test_execute "出货记录" "Tool"
    test_execute "库存报表" "Tool"
    test_execute "财务报表" "Tool"
    test_execute "考勤历史" "Tool"
    test_execute "供应商评估" "Tool"
    test_execute "告警诊断" "Tool"
    test_execute "设备维护" "Tool"
    test_execute "生产历史" "Tool"
}

# 12. 员工/人力资源 (25个用例)
test_hr() {
    log "\n${YELLOW}=== 测试员工/人力资源 (25个用例) ===${NC}"

    # PROCESSING_WORKER_ASSIGN (6个)
    test_intent "分配员工" "PROCESSING_WORKER_ASSIGN" "HR"
    test_intent "员工分配" "PROCESSING_WORKER_ASSIGN" "HR"
    test_intent "指派员工" "PROCESSING_WORKER_ASSIGN" "HR"
    test_intent "安排员工" "PROCESSING_WORKER_ASSIGN" "HR"
    test_intent "派工" "PROCESSING_WORKER_ASSIGN" "HR"
    test_intent "人员分配" "PROCESSING_WORKER_ASSIGN" "HR"

    # CLOCK_IN (原 PROCESSING_WORKER_CHECKIN)
    test_intent "员工签到" "CLOCK_IN" "HR"
    test_intent "工人签到" "CLOCK_IN" "HR"
    test_intent "上工签到" "CLOCK_IN" "HR"
    test_intent "生产签到" "CLOCK_IN" "HR"
    test_intent "工位签到" "CLOCK_IN" "HR"

    # CLOCK_OUT (原 PROCESSING_WORKER_CHECKOUT)
    test_intent "员工签退" "CLOCK_OUT" "HR"
    test_intent "工人签退" "CLOCK_OUT" "HR"
    test_intent "下工签退" "CLOCK_OUT" "HR"
    test_intent "生产签退" "CLOCK_OUT" "HR"
    test_intent "工位签退" "CLOCK_OUT" "HR"

    # 员工查询相关 (9个)
    test_intent "员工列表" "ANY" "HR"
    test_intent "查看员工" "ANY" "HR"
    test_intent "员工信息" "ANY" "HR"
    test_intent "工人列表" "ANY" "HR"
    test_intent "人员列表" "ANY" "HR"
    test_intent "谁在上班" "ANY" "HR"
    test_intent "在岗人员" "ANY" "HR"
    test_intent "今天谁上班" "ANY" "HR"
    test_intent "当前员工" "ANY" "HR"
}

# 13. 秤/称重设备 (20个用例)
# 优化8: 修正期望意图代码
test_scale() {
    log "\n${YELLOW}=== 测试秤/称重设备 (20个用例) ===${NC}"

    # SCALE_LIST_DEVICES (原 SCALE_LIST)
    test_intent "秤列表" "SCALE_LIST_DEVICES" "秤"
    test_intent "称重设备" "SCALE_LIST_DEVICES" "秤"
    test_intent "查看秤" "SCALE_LIST_DEVICES" "秤"
    test_intent "所有秤" "SCALE_LIST_DEVICES" "秤"
    test_intent "称重设备列表" "SCALE_LIST_DEVICES" "秤"

    # SCALE_DEVICE_DETAIL (原 SCALE_STATUS)
    test_intent "秤状态" "SCALE_DEVICE_DETAIL" "秤"
    test_intent "称重状态" "SCALE_DEVICE_DETAIL" "秤"
    test_intent "秤的情况" "SCALE_DEVICE_DETAIL" "秤"

    # SCALE_DEVICE_DETAIL (原 SCALE_READ_WEIGHT)
    test_intent "读取重量" "SCALE_DEVICE_DETAIL" "秤"
    test_intent "称重" "SCALE_DEVICE_DETAIL" "秤"
    test_intent "读秤" "SCALE_DEVICE_DETAIL" "秤"
    test_intent "取重量" "SCALE_DEVICE_DETAIL" "秤"
    test_intent "看重量" "SCALE_DEVICE_DETAIL" "秤"

    # SCALE_ADD_DEVICE
    test_intent "添加秤" "SCALE_ADD_DEVICE" "秤"
    test_intent "新增秤" "SCALE_ADD_DEVICE" "秤"
    test_intent "添加称重设备" "SCALE_ADD_DEVICE" "秤"

    # SCALE_UPDATE_DEVICE
    test_intent "更新秤" "SCALE_UPDATE_DEVICE" "秤"
    test_intent "修改秤" "SCALE_UPDATE_DEVICE" "秤"
    test_intent "编辑秤" "SCALE_UPDATE_DEVICE" "秤"
    test_intent "秤配置" "SCALE_UPDATE_DEVICE" "秤"
}

# 打印报告
print_report() {
    log "\n${BLUE}============================================${NC}"
    log "${BLUE}      意图识别系统测试报告 - 500用例${NC}"
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
    log "${BLUE}  意图识别系统测试 - 500个用例${NC}"
    log "${BLUE}========================================${NC}"

    if ! login; then
        log "${RED}登录失败，测试终止${NC}"
        exit 1
    fi

    # 刷新缓存
    log "\n${BLUE}[INFO] 刷新意图缓存...${NC}"
    curl -s -X POST "$SERVER/api/mobile/$FACTORY_ID/ai-intents/cache/refresh" \
        -H "Authorization: Bearer $TOKEN" > /dev/null

    # 运行所有测试 (约505个)
    test_processing_batch  # 70
    test_equipment         # 60
    test_material          # 50
    test_alert             # 40
    test_quality           # 35
    test_shipment          # 35
    test_report            # 35
    test_attendance        # 35
    test_crm               # 35
    test_conversational    # 35
    test_tool_calling      # 30
    test_hr                # 25
    test_scale             # 20
    # 总计: 505 个用例

    echo ""
    print_report
}

main "$@"
