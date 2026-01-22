#!/bin/bash
# v10.0 意图识别系统 - 300个复杂场景测试
# 测试覆盖: 反问句、转折句、双重否定、方言、口语、嵌套意图、模糊表达等

API_URL="http://139.196.165.140:10010/api/public/ai-demo/recognize"
FACTORY_ID="F001"
TIMEOUT=60

# 统计变量
TOTAL=0
PASSED=0
FAILED=0
TIMEOUT_COUNT=0

# 结果文件
RESULT_FILE="/tmp/v10_test_results_$(date +%Y%m%d_%H%M%S).json"
echo "[]" > "$RESULT_FILE"

test_intent() {
    local category="$1"
    local input="$2"
    local expected_intents="$3"  # 逗号分隔的可接受意图列表

    TOTAL=$((TOTAL + 1))

    # 发送请求
    RESPONSE=$(curl -s -m $TIMEOUT -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"userInput\": \"$input\", \"factoryId\": \"$FACTORY_ID\"}" 2>/dev/null)

    if [ -z "$RESPONSE" ]; then
        TIMEOUT_COUNT=$((TIMEOUT_COUNT + 1))
        echo "[$TOTAL] TIMEOUT: $category - $input"
        return
    fi

    # 解析结果
    MATCHED=$(echo "$RESPONSE" | jq -r '.data.matched // false')
    INTENT=$(echo "$RESPONSE" | jq -r '.data.intentCode // "null"')
    CONFIDENCE=$(echo "$RESPONSE" | jq -r '.data.confidence // 0')
    METHOD=$(echo "$RESPONSE" | jq -r '.data.matchMethod // "null"')

    # 检查是否匹配预期意图
    PASS=false
    if [ "$MATCHED" = "true" ]; then
        IFS=',' read -ra EXPECTED_ARRAY <<< "$expected_intents"
        for exp in "${EXPECTED_ARRAY[@]}"; do
            if [ "$INTENT" = "$exp" ]; then
                PASS=true
                break
            fi
        done
    fi

    if [ "$PASS" = true ]; then
        PASSED=$((PASSED + 1))
        echo "[$TOTAL] ✓ PASS: $category | $INTENT ($CONFIDENCE) [$METHOD]"
    else
        FAILED=$((FAILED + 1))
        echo "[$TOTAL] ✗ FAIL: $category | Expected: $expected_intents | Got: $INTENT ($MATCHED)"
    fi
}

echo "=========================================="
echo "v10.0 意图识别系统 - 300个复杂场景测试"
echo "=========================================="
echo "开始时间: $(date)"
echo ""

# ==========================================
# 第1类: 反问句式 (30个)
# ==========================================
echo ">>> 测试类别: 反问句式 (30个)"

test_intent "反问-批次" "难道你不觉得批次信息应该更清晰吗？" "MATERIAL_BATCH_QUERY,PROCESSING_BATCH_LIST,PROCESSING_BATCH_DETAIL"
test_intent "反问-质量" "难道质量报告不应该每天生成吗？" "QUALITY_REPORT,QUALITY_STATS,REPORT_QUALITY"
test_intent "反问-库存" "难道库存不需要盘点吗？" "INVENTORY_CHECK,INVENTORY_QUERY,WAREHOUSE_INVENTORY"
test_intent "反问-生产" "生产计划不是应该提前安排吗？" "PRODUCTION_PLAN_QUERY,SCHEDULE_QUERY,APS_SCHEDULE_VIEW"
test_intent "反问-设备" "设备维护难道可以忽略吗？" "EQUIPMENT_MAINTENANCE,EQUIPMENT_STATUS_QUERY,EQUIPMENT_STATUS_UPDATE"
test_intent "反问-人员" "人员排班难道不重要吗？" "SHIFT_SCHEDULE,WORKER_ASSIGNMENT,HR_SCHEDULE"
test_intent "反问-订单" "订单跟踪难道不需要吗？" "ORDER_TRACKING,ORDER_QUERY,ORDER_STATUS"
test_intent "反问-原料" "原料检验难道可以跳过吗？" "MATERIAL_INSPECTION,QUALITY_CHECK,MATERIAL_BATCH_QUERY"
test_intent "反问-成本" "成本分析难道不做了吗？" "COST_ANALYSIS,REPORT_COST,FINANCIAL_REPORT"
test_intent "反问-效率" "生产效率难道不需要监控吗？" "EFFICIENCY_REPORT,PRODUCTION_STATS,REPORT_PRODUCTION"
test_intent "反问-安全" "食品安全检查难道可以省略吗？" "SAFETY_CHECK,QUALITY_INSPECTION,COMPLIANCE_CHECK"
test_intent "反问-追溯" "产品追溯难道不重要吗？" "TRACEABILITY_QUERY,BATCH_TRACE,PRODUCT_TRACE"
test_intent "反问-客户" "客户投诉难道不处理吗？" "COMPLAINT_HANDLE,CRM_COMPLAINT,CUSTOMER_FEEDBACK"
test_intent "反问-销售" "销售数据难道不分析吗？" "SALES_REPORT,REPORT_SALES,SALES_ANALYSIS"
test_intent "反问-采购" "采购订单难道不审批吗？" "PURCHASE_APPROVAL,PROCUREMENT_ORDER,PURCHASE_ORDER"
test_intent "反问-仓储" "仓库温度难道不监控吗？" "WAREHOUSE_TEMP,STORAGE_MONITOR,ENVIRONMENT_MONITOR"
test_intent "反问-物流" "物流配送难道不跟踪吗？" "LOGISTICS_TRACK,SHIPMENT_TRACKING,DELIVERY_STATUS"
test_intent "反问-考勤" "员工考勤难道不记录吗？" "ATTENDANCE_RECORD,TIMECLOCK_QUERY,HR_ATTENDANCE"
test_intent "反问-培训" "员工培训难道不安排吗？" "TRAINING_SCHEDULE,HR_TRAINING,EMPLOYEE_TRAINING"
test_intent "反问-报表" "月度报表难道不看吗？" "MONTHLY_REPORT,REPORT_MONTHLY,REPORT_SUMMARY"
test_intent "反问-预警" "库存预警难道可以忽视吗？" "INVENTORY_ALERT,STOCK_WARNING,ALERT_QUERY"
test_intent "反问-审批" "请假申请难道不批吗？" "LEAVE_APPROVAL,HR_LEAVE,APPROVAL_PROCESS"
test_intent "反问-盘点" "资产盘点难道不做吗？" "ASSET_INVENTORY,EQUIPMENT_CHECK,INVENTORY_CHECK"
test_intent "反问-合规" "合规检查难道不重要吗？" "COMPLIANCE_CHECK,AUDIT_QUERY,REGULATION_CHECK"
test_intent "反问-排程" "生产排程难道随意吗？" "SCHEDULE_QUERY,APS_SCHEDULE_VIEW,PRODUCTION_SCHEDULE"
test_intent "反问-工艺" "工艺参数难道不检查吗？" "PROCESS_PARAMS,RECIPE_QUERY,PROCESS_CHECK"
test_intent "反问-能耗" "能耗统计难道不做吗？" "ENERGY_REPORT,UTILITY_STATS,ENERGY_MONITOR"
test_intent "反问-异常" "生产异常难道不处理吗？" "EXCEPTION_HANDLE,ALERT_HANDLE,PRODUCTION_EXCEPTION"
test_intent "反问-交接" "班次交接难道不记录吗？" "SHIFT_HANDOVER,SHIFT_RECORD,HANDOVER_LOG"
test_intent "反问-检测" "产品检测难道可以省略吗？" "PRODUCT_TEST,QUALITY_TEST,INSPECTION_QUERY"

# ==========================================
# 第2类: 转折句式 (30个)
# ==========================================
echo ""
echo ">>> 测试类别: 转折句式 (30个)"

test_intent "转折-批次" "虽然库存看起来正常，但是我还是想查看一下原料批次" "MATERIAL_BATCH_QUERY,INVENTORY_QUERY"
test_intent "转折-质量" "尽管上次检查没问题，但我想再看看质量报告" "QUALITY_REPORT,QUALITY_STATS"
test_intent "转折-生产" "虽然产量达标了，但是我担心生产效率" "EFFICIENCY_REPORT,PRODUCTION_STATS"
test_intent "转折-设备" "设备运行正常，不过还是检查一下维护记录吧" "EQUIPMENT_MAINTENANCE,EQUIPMENT_STATUS_QUERY"
test_intent "转折-订单" "订单已经发货了，但是我想确认一下物流状态" "LOGISTICS_TRACK,SHIPMENT_TRACKING,ORDER_STATUS"
test_intent "转折-人员" "人员都到齐了，但是我想看看今天的排班表" "SHIFT_SCHEDULE,WORKER_ASSIGNMENT"
test_intent "转折-成本" "成本控制得不错，但是还是分析一下具体数据" "COST_ANALYSIS,REPORT_COST"
test_intent "转折-客户" "客户没有投诉，但是我想了解一下反馈情况" "CUSTOMER_FEEDBACK,CRM_QUERY"
test_intent "转折-采购" "采购已经完成了，但是我想核对一下订单" "PURCHASE_ORDER,PROCUREMENT_QUERY"
test_intent "转折-仓储" "仓库空间够用，但是我想看看库存分布" "WAREHOUSE_INVENTORY,INVENTORY_DISTRIBUTION"
test_intent "转折-销售" "销售目标完成了，但是我想看看明细数据" "SALES_REPORT,SALES_DETAIL"
test_intent "转折-考勤" "大家都按时上班了，但是我想核查一下考勤记录" "ATTENDANCE_RECORD,TIMECLOCK_QUERY"
test_intent "转折-培训" "培训结束了，但是我想看看考核结果" "TRAINING_RESULT,HR_TRAINING"
test_intent "转折-预警" "目前没有预警，但是我想检查一下阈值设置" "ALERT_CONFIG,ALERT_THRESHOLD"
test_intent "转折-追溯" "产品没问题，但是我想验证一下追溯信息" "TRACEABILITY_QUERY,BATCH_TRACE"
test_intent "转折-排程" "排程已经确定了，但是我想看看资源分配" "SCHEDULE_QUERY,RESOURCE_ALLOCATION"
test_intent "转折-工艺" "工艺执行正常，但是我想核对一下参数" "PROCESS_PARAMS,RECIPE_QUERY"
test_intent "转折-能耗" "能耗没超标，但是我想分析一下趋势" "ENERGY_REPORT,ENERGY_TREND"
test_intent "转折-安全" "安全检查通过了，但是我想看看详细记录" "SAFETY_RECORD,SAFETY_CHECK"
test_intent "转折-审批" "审批已经完成了，但是我想查看审批流程" "APPROVAL_HISTORY,APPROVAL_QUERY"
test_intent "转折-物料" "物料已经入库了，但是我想确认一下批次信息" "MATERIAL_BATCH_QUERY,MATERIAL_RECEIPT"
test_intent "转折-产线" "产线在运行，但是我想了解一下运行状况" "PRODUCTION_LINE_STATUS,LINE_MONITOR"
test_intent "转折-报废" "没有报废记录，但是我想查看一下历史数据" "SCRAP_HISTORY,WASTE_REPORT"
test_intent "转折-返工" "返工率很低，但是我想分析一下原因" "REWORK_ANALYSIS,REWORK_REPORT"
test_intent "转折-良率" "良率达标了，但是我想看看详细统计" "YIELD_REPORT,YIELD_STATS"
test_intent "转折-OEE" "OEE数据不错，但是我想深入分析一下" "OEE_ANALYSIS,OEE_REPORT"
test_intent "转折-停机" "没有停机记录，但是我想查看历史停机" "DOWNTIME_HISTORY,EQUIPMENT_DOWNTIME"
test_intent "转折-换线" "换线完成了，但是我想记录一下换线时间" "CHANGEOVER_RECORD,LINE_CHANGE"
test_intent "转折-首检" "首检通过了，但是我想看看检验报告" "FIRST_INSPECTION,INSPECTION_REPORT"
test_intent "转折-巡检" "巡检没发现问题，但是我想看看巡检记录" "PATROL_RECORD,INSPECTION_LOG"

# ==========================================
# 第3类: 双重否定 (30个)
# ==========================================
echo ""
echo ">>> 测试类别: 双重否定 (30个)"

test_intent "双否-生产" "我不是不想看生产数据，只是现在太忙" "REPORT_PRODUCTION,PRODUCTION_STATS"
test_intent "双否-质量" "不是不关心质量问题，只是需要先处理其他事" "QUALITY_REPORT,QUALITY_STATS"
test_intent "双否-库存" "并非不在意库存情况，只是暂时没时间" "INVENTORY_QUERY,WAREHOUSE_INVENTORY"
test_intent "双否-设备" "不是不想检查设备，实在是抽不开身" "EQUIPMENT_STATUS_QUERY,EQUIPMENT_CHECK"
test_intent "双否-订单" "我不是不管订单状态，只是刚才有事" "ORDER_STATUS,ORDER_QUERY"
test_intent "双否-人员" "不是不关心员工出勤，只是还没来得及看" "ATTENDANCE_RECORD,HR_ATTENDANCE"
test_intent "双否-成本" "并非不重视成本控制，只是数据还没整理" "COST_ANALYSIS,REPORT_COST"
test_intent "双否-客户" "不是不理会客户反馈，只是需要汇总" "CUSTOMER_FEEDBACK,CRM_QUERY"
test_intent "双否-采购" "我不是不批采购申请，只是要核实一下" "PURCHASE_APPROVAL,PROCUREMENT_ORDER"
test_intent "双否-安全" "不是不做安全检查，只是要协调人员" "SAFETY_CHECK,SAFETY_INSPECTION"
test_intent "双否-培训" "并非不安排培训，只是要确定时间" "TRAINING_SCHEDULE,HR_TRAINING"
test_intent "双否-报表" "不是不看报表，只是要等数据更新" "REPORT_QUERY,REPORT_SUMMARY"
test_intent "双否-审批" "我不是不处理审批，只是要了解情况" "APPROVAL_PROCESS,APPROVAL_QUERY"
test_intent "双否-排程" "不是不调整排程，只是要评估影响" "SCHEDULE_ADJUST,SCHEDULE_QUERY"
test_intent "双否-追溯" "并非不做追溯，只是要确认范围" "TRACEABILITY_QUERY,BATCH_TRACE"
test_intent "双否-预警" "不是不理会预警，只是要分析原因" "ALERT_QUERY,ALERT_ANALYSIS"
test_intent "双否-盘点" "我不是不做盘点，只是要安排时间" "INVENTORY_CHECK,ASSET_INVENTORY"
test_intent "双否-物流" "不是不跟踪物流，只是要等更新" "LOGISTICS_TRACK,SHIPMENT_TRACKING"
test_intent "双否-工艺" "并非不检查工艺，只是要准备资料" "PROCESS_CHECK,PROCESS_PARAMS"
test_intent "双否-能耗" "不是不关注能耗，只是要收集数据" "ENERGY_MONITOR,ENERGY_REPORT"
test_intent "双否-良率" "我不是不在乎良率，只是要对比历史" "YIELD_REPORT,YIELD_STATS"
test_intent "双否-返工" "不是不处理返工，只是要确定原因" "REWORK_HANDLE,REWORK_ANALYSIS"
test_intent "双否-报废" "并非不统计报废，只是要分类汇总" "SCRAP_REPORT,WASTE_REPORT"
test_intent "双否-停机" "不是不记录停机，只是要核实时间" "DOWNTIME_RECORD,EQUIPMENT_DOWNTIME"
test_intent "双否-换线" "我不是不关心换线，只是要协调产线" "CHANGEOVER_RECORD,LINE_CHANGE"
test_intent "双否-首检" "不是不做首检，只是要等产品" "FIRST_INSPECTION,INSPECTION_QUERY"
test_intent "双否-巡检" "并非不安排巡检，只是要确定路线" "PATROL_SCHEDULE,INSPECTION_PLAN"
test_intent "双否-交接" "不是不做交接，只是要整理内容" "SHIFT_HANDOVER,HANDOVER_LOG"
test_intent "双否-OEE" "我不是不关注OEE，只是要理解数据" "OEE_REPORT,OEE_ANALYSIS"
test_intent "双否-KPI" "不是不看KPI，只是要确定指标" "KPI_REPORT,PERFORMANCE_STATS"

# ==========================================
# 第4类: 方言/口语表达 (40个)
# ==========================================
echo ""
echo ">>> 测试类别: 方言/口语表达 (40个)"

# 北方方言
test_intent "方言-北方1" "俺想瞅瞅那批货咋样了" "MATERIAL_BATCH_QUERY,INVENTORY_QUERY,EQUIPMENT_STATUS_UPDATE"
test_intent "方言-北方2" "咱看看今儿个生产情况咋样" "PRODUCTION_STATS,REPORT_PRODUCTION"
test_intent "方言-北方3" "整点库存数据给俺瞅瞅" "INVENTORY_QUERY,WAREHOUSE_INVENTORY"
test_intent "方言-北方4" "那设备咋回事儿啊" "EQUIPMENT_STATUS_QUERY,EQUIPMENT_CHECK"
test_intent "方言-北方5" "给俺整个生产报表" "REPORT_PRODUCTION,PRODUCTION_REPORT"
test_intent "方言-北方6" "瞅瞅工人干活咋样" "WORKER_PERFORMANCE,PRODUCTION_STATS"
test_intent "方言-北方7" "那订单啥时候能发" "ORDER_STATUS,SHIPMENT_SCHEDULE"
test_intent "方言-北方8" "整整这个月的数据" "MONTHLY_REPORT,REPORT_MONTHLY"

# 东北方言
test_intent "方言-东北1" "唠唠这批货的事儿" "MATERIAL_BATCH_QUERY,BATCH_DETAIL"
test_intent "方言-东北2" "整明白这个质量问题" "QUALITY_ANALYSIS,QUALITY_REPORT"
test_intent "方言-东北3" "嘎哈呢这设备" "EQUIPMENT_STATUS_QUERY,EQUIPMENT_CHECK"
test_intent "方言-东北4" "贼拉想看看产量" "PRODUCTION_STATS,YIELD_REPORT"
test_intent "方言-东北5" "这活儿干得咋样了" "PRODUCTION_PROGRESS,WORK_STATUS"
test_intent "方言-东北6" "给我整点数据看看" "DATA_QUERY,REPORT_QUERY"
test_intent "方言-东北7" "那玩意儿啥情况" "STATUS_QUERY,EQUIPMENT_STATUS_QUERY"
test_intent "方言-东北8" "整个报表瞅瞅" "REPORT_QUERY,REPORT_SUMMARY"

# 四川/西南方言
test_intent "方言-川渝1" "看哈今天的生产情况" "PRODUCTION_STATS,REPORT_PRODUCTION"
test_intent "方言-川渝2" "搞快点把数据整出来" "DATA_EXPORT,REPORT_GENERATE"
test_intent "方言-川渝3" "龟儿子的设备又出问题了" "EQUIPMENT_ALERT,EQUIPMENT_STATUS_QUERY"
test_intent "方言-川渝4" "莫得问题嘛这批货" "QUALITY_CHECK,MATERIAL_BATCH_QUERY"
test_intent "方言-川渝5" "啷个回事这个订单" "ORDER_QUERY,ORDER_STATUS"
test_intent "方言-川渝6" "要得，把库存看哈" "INVENTORY_QUERY,WAREHOUSE_INVENTORY"
test_intent "方言-川渝7" "巴适得很这个产量" "PRODUCTION_STATS,YIELD_REPORT"
test_intent "方言-川渝8" "安逸，看哈质量报告" "QUALITY_REPORT,QUALITY_STATS"

# 广东/粤语
test_intent "方言-粤语1" "睇下今日嘅生产情况" "PRODUCTION_STATS,REPORT_PRODUCTION"
test_intent "方言-粤语2" "搞掂呢个订单未" "ORDER_STATUS,ORDER_COMPLETE"
test_intent "方言-粤语3" "点解呢个设备有问题" "EQUIPMENT_ANALYSIS,EQUIPMENT_STATUS_QUERY"
test_intent "方言-粤语4" "畀我睇下库存" "INVENTORY_QUERY,WAREHOUSE_INVENTORY"
test_intent "方言-粤语5" "唔该帮我check下质量" "QUALITY_CHECK,QUALITY_INSPECTION"
test_intent "方言-粤语6" "今日出咗几多货" "PRODUCTION_OUTPUT,SHIPMENT_QUERY"
test_intent "方言-粤语7" "呢批料OK唔OK" "MATERIAL_INSPECTION,QUALITY_CHECK"
test_intent "方言-粤语8" "搵下呢个批次嘅资料" "BATCH_QUERY,MATERIAL_BATCH_QUERY"

# 口语化/网络用语
test_intent "口语-网络1" "给我康康今天有啥质量问题" "QUALITY_STATS,QUALITY_REPORT"
test_intent "口语-网络2" "rua一下这个设备状态" "EQUIPMENT_STATUS_QUERY,EQUIPMENT_CHECK"
test_intent "口语-网络3" "8太行啊这个产量" "PRODUCTION_STATS,YIELD_REPORT"
test_intent "口语-网络4" "有点emo，看看生产数据吧" "PRODUCTION_STATS,REPORT_PRODUCTION"
test_intent "口语-网络5" "绝绝子，这批货质量咋样" "QUALITY_CHECK,MATERIAL_BATCH_QUERY"
test_intent "口语-网络6" "yyds，查下库存" "INVENTORY_QUERY,WAREHOUSE_INVENTORY"
test_intent "口语-网络7" "这波操作666，看看效率" "EFFICIENCY_REPORT,PRODUCTION_STATS"
test_intent "口语-网络8" "栓Q，帮我查个订单" "ORDER_QUERY,ORDER_STATUS"

# ==========================================
# 第5类: 嵌套/复合意图 (30个)
# ==========================================
echo ""
echo ">>> 测试类别: 嵌套/复合意图 (30个)"

test_intent "复合-生产质量" "看看生产数据，顺便检查一下质量" "PRODUCTION_STATS,QUALITY_CHECK,REPORT_PRODUCTION"
test_intent "复合-库存采购" "库存快没了，需要采购" "INVENTORY_QUERY,PURCHASE_REQUEST,PROCUREMENT_ORDER"
test_intent "复合-设备维护" "设备有问题，安排维护" "EQUIPMENT_ALERT,EQUIPMENT_MAINTENANCE"
test_intent "复合-订单物流" "订单发了吗，物流到哪了" "ORDER_STATUS,LOGISTICS_TRACK,SHIPMENT_TRACKING"
test_intent "复合-人员考勤" "看看今天谁没来，考勤情况" "ATTENDANCE_RECORD,HR_ATTENDANCE,WORKER_STATUS"
test_intent "复合-成本效率" "成本和效率一起分析一下" "COST_ANALYSIS,EFFICIENCY_REPORT"
test_intent "复合-销售客户" "销售数据和客户反馈都要看" "SALES_REPORT,CUSTOMER_FEEDBACK"
test_intent "复合-质量追溯" "质量问题，需要追溯批次" "QUALITY_ISSUE,TRACEABILITY_QUERY,BATCH_TRACE"
test_intent "复合-排程资源" "排程和资源分配情况" "SCHEDULE_QUERY,RESOURCE_ALLOCATION"
test_intent "复合-能耗设备" "能耗异常，检查设备" "ENERGY_ALERT,EQUIPMENT_CHECK"
test_intent "复合-培训考核" "培训完了，看看考核结果" "TRAINING_RESULT,HR_TRAINING"
test_intent "复合-审批流程" "这个审批走到哪了" "APPROVAL_STATUS,APPROVAL_PROCESS"
test_intent "复合-预警处理" "有预警吗，怎么处理" "ALERT_QUERY,ALERT_HANDLE"
test_intent "复合-盘点差异" "盘点有差异，分析原因" "INVENTORY_CHECK,VARIANCE_ANALYSIS"
test_intent "复合-换线首检" "换线后做首检" "CHANGEOVER_RECORD,FIRST_INSPECTION"
test_intent "复合-停机原因" "停机了，什么原因" "DOWNTIME_RECORD,DOWNTIME_ANALYSIS"
test_intent "复合-返工报废" "返工还是报废，怎么处理" "REWORK_HANDLE,SCRAP_DECISION"
test_intent "复合-OEE分析" "OEE数据和详细分析" "OEE_REPORT,OEE_ANALYSIS"
test_intent "复合-良率原因" "良率下降，分析原因" "YIELD_REPORT,YIELD_ANALYSIS"
test_intent "复合-巡检异常" "巡检发现异常怎么办" "PATROL_RECORD,EXCEPTION_HANDLE"
test_intent "复合-交接内容" "交接班，有什么要注意的" "SHIFT_HANDOVER,HANDOVER_CONTENT"
test_intent "复合-报表导出" "生成报表并导出" "REPORT_GENERATE,DATA_EXPORT"
test_intent "复合-工艺调整" "工艺参数需要调整" "PROCESS_PARAMS,PROCESS_ADJUST"
test_intent "复合-物料入库" "物料到了，办理入库" "MATERIAL_RECEIPT,WAREHOUSE_RECEIVE"
test_intent "复合-订单排产" "新订单，安排生产" "ORDER_CREATE,PRODUCTION_SCHEDULE"
test_intent "复合-质检放行" "质检通过，可以放行吗" "QUALITY_PASS,RELEASE_DECISION"
test_intent "复合-设备报修" "设备坏了，报修" "EQUIPMENT_ALERT,MAINTENANCE_REQUEST"
test_intent "复合-人员调配" "人手不够，需要调配" "WORKER_SHORTAGE,WORKER_ASSIGNMENT"
test_intent "复合-产能评估" "产能够不够，评估一下" "CAPACITY_CHECK,CAPACITY_ANALYSIS"
test_intent "复合-合规审计" "合规检查，准备审计" "COMPLIANCE_CHECK,AUDIT_PREPARE"

# ==========================================
# 第6类: 模糊/不完整表达 (30个)
# ==========================================
echo ""
echo ">>> 测试类别: 模糊/不完整表达 (30个)"

test_intent "模糊-那个" "那个...就是那个数据" "DATA_QUERY,REPORT_QUERY"
test_intent "模糊-这个" "这个怎么看" "STATUS_QUERY,REPORT_QUERY"
test_intent "模糊-情况" "看看情况" "STATUS_QUERY,OVERVIEW_QUERY"
test_intent "模糊-数据" "给我数据" "DATA_QUERY,REPORT_QUERY"
test_intent "模糊-报表" "要报表" "REPORT_QUERY,REPORT_GENERATE"
test_intent "模糊-查一下" "帮我查一下" "DATA_QUERY,STATUS_QUERY"
test_intent "模糊-看看" "让我看看" "VIEW_QUERY,OVERVIEW_QUERY"
test_intent "模糊-怎么样" "今天怎么样" "DAILY_SUMMARY,STATUS_QUERY"
test_intent "模糊-有没有" "有没有问题" "ALERT_QUERY,STATUS_CHECK"
test_intent "模糊-多少" "有多少" "COUNT_QUERY,STATS_QUERY"
test_intent "模糊-什么时候" "什么时候能好" "SCHEDULE_QUERY,ETA_QUERY"
test_intent "模糊-谁" "谁负责这个" "RESPONSIBILITY_QUERY,ASSIGNMENT_QUERY"
test_intent "模糊-哪里" "在哪里" "LOCATION_QUERY,POSITION_QUERY"
test_intent "模糊-为什么" "为什么会这样" "CAUSE_ANALYSIS,REASON_QUERY"
test_intent "模糊-可以吗" "可以吗" "PERMISSION_CHECK,APPROVAL_QUERY"
test_intent "模糊-行不行" "行不行" "FEASIBILITY_CHECK,APPROVAL_QUERY"
test_intent "模糊-好了吗" "好了吗" "COMPLETION_CHECK,STATUS_QUERY"
test_intent "模糊-完了吗" "完了吗" "COMPLETION_CHECK,PROGRESS_QUERY"
test_intent "模糊-还要" "还要多久" "ETA_QUERY,DURATION_QUERY"
test_intent "模糊-差不多" "差不多了吧" "PROGRESS_QUERY,STATUS_QUERY"
test_intent "模糊-大概" "大概什么情况" "OVERVIEW_QUERY,SUMMARY_QUERY"
test_intent "模糊-应该" "应该没问题吧" "STATUS_CHECK,CONFIRMATION_QUERY"
test_intent "模糊-可能" "可能有问题" "ALERT_CHECK,ISSUE_QUERY"
test_intent "模糊-好像" "好像不太对" "ANOMALY_CHECK,ISSUE_QUERY"
test_intent "模糊-感觉" "感觉有点问题" "ISSUE_QUERY,ANOMALY_CHECK"
test_intent "模糊-不对" "这个不对吧" "VALIDATION_CHECK,ERROR_QUERY"
test_intent "模糊-奇怪" "有点奇怪" "ANOMALY_CHECK,ISSUE_QUERY"
test_intent "模糊-正常" "正常吗" "STATUS_CHECK,NORMAL_CHECK"
test_intent "模糊-够不够" "够不够" "SUFFICIENCY_CHECK,INVENTORY_CHECK"
test_intent "模糊-来得及" "来得及吗" "DEADLINE_CHECK,SCHEDULE_QUERY"

# ==========================================
# 第7类: 带时间/条件的查询 (30个)
# ==========================================
echo ""
echo ">>> 测试类别: 带时间/条件的查询 (30个)"

test_intent "时间-今天" "今天的生产数据" "DAILY_PRODUCTION,PRODUCTION_STATS"
test_intent "时间-昨天" "昨天的质量报告" "QUALITY_REPORT,DAILY_QUALITY"
test_intent "时间-本周" "本周的销售情况" "WEEKLY_SALES,SALES_REPORT"
test_intent "时间-上周" "上周的库存变化" "INVENTORY_HISTORY,WEEKLY_INVENTORY"
test_intent "时间-本月" "本月的成本分析" "MONTHLY_COST,COST_ANALYSIS"
test_intent "时间-上月" "上月的生产效率" "MONTHLY_EFFICIENCY,EFFICIENCY_REPORT"
test_intent "时间-今年" "今年的总产量" "YEARLY_PRODUCTION,PRODUCTION_STATS"
test_intent "时间-去年" "去年同期对比" "YEAR_COMPARISON,HISTORICAL_COMPARE"
test_intent "时间-最近" "最近一周的异常" "RECENT_ALERTS,ALERT_HISTORY"
test_intent "时间-之前" "三天前的订单" "ORDER_HISTORY,ORDER_QUERY"
test_intent "条件-车间" "A车间的生产数据" "WORKSHOP_PRODUCTION,PRODUCTION_STATS"
test_intent "条件-产线" "1号产线的效率" "LINE_EFFICIENCY,PRODUCTION_STATS"
test_intent "条件-班次" "早班的产量" "SHIFT_PRODUCTION,PRODUCTION_STATS"
test_intent "条件-产品" "A产品的质量数据" "PRODUCT_QUALITY,QUALITY_STATS"
test_intent "条件-批次" "批次B001的追溯信息" "BATCH_TRACE,TRACEABILITY_QUERY"
test_intent "条件-设备" "设备E001的状态" "EQUIPMENT_STATUS,EQUIPMENT_STATUS_QUERY"
test_intent "条件-员工" "张三的考勤记录" "EMPLOYEE_ATTENDANCE,ATTENDANCE_RECORD"
test_intent "条件-供应商" "供应商S001的交货情况" "SUPPLIER_DELIVERY,PROCUREMENT_QUERY"
test_intent "条件-客户" "客户C001的订单" "CUSTOMER_ORDER,ORDER_QUERY"
test_intent "条件-仓库" "A仓库的库存" "WAREHOUSE_INVENTORY,INVENTORY_QUERY"
test_intent "范围-大于" "产量超过1000的记录" "PRODUCTION_FILTER,PRODUCTION_QUERY"
test_intent "范围-小于" "良率低于95%的批次" "YIELD_FILTER,YIELD_QUERY"
test_intent "范围-之间" "10号到15号的数据" "DATE_RANGE_QUERY,DATA_QUERY"
test_intent "范围-前十" "产量前十的产品" "TOP_PRODUCTS,PRODUCTION_RANKING"
test_intent "范围-最大" "库存最多的物料" "MAX_INVENTORY,INVENTORY_RANKING"
test_intent "范围-最小" "效率最低的产线" "MIN_EFFICIENCY,EFFICIENCY_RANKING"
test_intent "排序-按时间" "按时间排序的订单" "ORDER_SORT,ORDER_QUERY"
test_intent "排序-按数量" "按产量排序" "PRODUCTION_SORT,PRODUCTION_RANKING"
test_intent "分组-按车间" "按车间统计产量" "WORKSHOP_STATS,PRODUCTION_BY_WORKSHOP"
test_intent "分组-按产品" "按产品分类的质量数据" "PRODUCT_QUALITY_STATS,QUALITY_BY_PRODUCT"

# ==========================================
# 第8类: 业务场景对话 (30个)
# ==========================================
echo ""
echo ">>> 测试类别: 业务场景对话 (30个)"

test_intent "场景-晨会" "今天早上开晨会，需要昨天的生产数据" "DAILY_PRODUCTION,PRODUCTION_STATS"
test_intent "场景-巡查" "老板要来巡查，准备一下车间数据" "WORKSHOP_OVERVIEW,PRODUCTION_STATS"
test_intent "场景-审计" "下周有审计，需要合规相关资料" "COMPLIANCE_REPORT,AUDIT_PREPARE"
test_intent "场景-客诉" "客户投诉产品有问题，查一下批次" "COMPLAINT_TRACE,BATCH_TRACE"
test_intent "场景-催货" "客户催货，看看订单什么时候能发" "ORDER_STATUS,SHIPMENT_SCHEDULE"
test_intent "场景-缺料" "生产缺料了，看看库存还有多少" "MATERIAL_SHORTAGE,INVENTORY_QUERY"
test_intent "场景-加班" "要加班赶订单，安排一下人员" "OVERTIME_SCHEDULE,WORKER_ASSIGNMENT"
test_intent "场景-停产" "设备故障停产了，什么时候能修好" "EQUIPMENT_REPAIR,MAINTENANCE_ETA"
test_intent "场景-交接" "要下班了，看看有什么要交接的" "SHIFT_HANDOVER,HANDOVER_CONTENT"
test_intent "场景-盘库" "月底了，该盘库了" "INVENTORY_CHECK,STOCK_COUNT"
test_intent "场景-结算" "月底结算，需要成本数据" "MONTHLY_COST,COST_SETTLEMENT"
test_intent "场景-考核" "季度考核，需要KPI数据" "KPI_REPORT,PERFORMANCE_STATS"
test_intent "场景-培训" "新员工入职，安排培训" "NEW_EMPLOYEE_TRAINING,TRAINING_SCHEDULE"
test_intent "场景-认证" "准备ISO认证，需要质量记录" "QUALITY_RECORD,CERTIFICATION_PREPARE"
test_intent "场景-投标" "要投标，需要产能证明" "CAPACITY_REPORT,PRODUCTION_CAPABILITY"
test_intent "场景-展会" "参加展会，准备产品资料" "PRODUCT_INFO,PRODUCT_CATALOG"
test_intent "场景-年终" "年终总结，需要全年数据" "YEARLY_SUMMARY,ANNUAL_REPORT"
test_intent "场景-预算" "做下年预算，需要今年的成本数据" "COST_HISTORY,BUDGET_PREPARE"
test_intent "场景-扩产" "准备扩产，评估一下产能" "CAPACITY_ANALYSIS,EXPANSION_PLAN"
test_intent "场景-新品" "新品试产，记录工艺参数" "TRIAL_PRODUCTION,PROCESS_RECORD"
test_intent "场景-退货" "有退货，检查一下原因" "RETURN_ANALYSIS,QUALITY_ISSUE"
test_intent "场景-索赔" "供应商物料有问题，准备索赔" "SUPPLIER_CLAIM,QUALITY_EVIDENCE"
test_intent "场景-验收" "设备验收，需要检测报告" "EQUIPMENT_ACCEPTANCE,TEST_REPORT"
test_intent "场景-报关" "出口报关，准备相关资料" "EXPORT_DOCUMENT,COMPLIANCE_DOCUMENT"
test_intent "场景-召回" "产品召回，追溯所有批次" "PRODUCT_RECALL,BATCH_TRACE_ALL"
test_intent "场景-降本" "降本增效，分析成本结构" "COST_BREAKDOWN,COST_OPTIMIZATION"
test_intent "场景-改善" "持续改善，看看哪里可以优化" "IMPROVEMENT_ANALYSIS,OPTIMIZATION_SUGGEST"
test_intent "场景-对标" "和行业对标，需要我们的数据" "BENCHMARK_DATA,INDUSTRY_COMPARE"
test_intent "场景-汇报" "向总部汇报，准备月度数据" "MONTHLY_SUMMARY,HEADQUARTERS_REPORT"
test_intent "场景-检查" "食品安全检查，准备记录" "FOOD_SAFETY_RECORD,INSPECTION_PREPARE"

# ==========================================
# 第9类: 指令/命令式表达 (25个)
# ==========================================
echo ""
echo ">>> 测试类别: 指令/命令式表达 (25个)"

test_intent "指令-创建" "创建一个新的生产批次" "BATCH_CREATE,MATERIAL_BATCH_CREATE"
test_intent "指令-更新" "更新设备状态为维修中" "EQUIPMENT_STATUS_UPDATE,STATUS_UPDATE"
test_intent "指令-删除" "删除这条记录" "RECORD_DELETE,DATA_DELETE"
test_intent "指令-导出" "导出本月的生产数据" "DATA_EXPORT,REPORT_EXPORT"
test_intent "指令-打印" "打印这张报表" "REPORT_PRINT,PRINT_COMMAND"
test_intent "指令-发送" "把报告发给经理" "REPORT_SEND,EMAIL_SEND"
test_intent "指令-提交" "提交这个审批" "APPROVAL_SUBMIT,SUBMIT_REQUEST"
test_intent "指令-取消" "取消这个订单" "ORDER_CANCEL,CANCEL_REQUEST"
test_intent "指令-暂停" "暂停这条产线" "LINE_PAUSE,PRODUCTION_PAUSE"
test_intent "指令-恢复" "恢复生产" "PRODUCTION_RESUME,LINE_RESUME"
test_intent "指令-启动" "启动设备" "EQUIPMENT_START,START_COMMAND"
test_intent "指令-停止" "停止这个任务" "TASK_STOP,STOP_COMMAND"
test_intent "指令-分配" "把任务分配给张三" "TASK_ASSIGN,WORKER_ASSIGNMENT"
test_intent "指令-调整" "调整排程时间" "SCHEDULE_ADJUST,TIME_ADJUST"
test_intent "指令-修改" "修改批次信息" "BATCH_UPDATE,INFO_MODIFY"
test_intent "指令-确认" "确认收货" "RECEIPT_CONFIRM,CONFIRM_ACTION"
test_intent "指令-审批" "审批通过" "APPROVAL_PASS,APPROVE_ACTION"
test_intent "指令-拒绝" "拒绝这个申请" "REQUEST_REJECT,REJECT_ACTION"
test_intent "指令-记录" "记录这次巡检结果" "INSPECTION_RECORD,LOG_ACTION"
test_intent "指令-通知" "通知相关人员" "NOTIFY_ACTION,SEND_NOTIFICATION"
test_intent "指令-提醒" "提醒我明天检查" "REMINDER_SET,SET_REMINDER"
test_intent "指令-标记" "标记为已完成" "MARK_COMPLETE,STATUS_MARK"
test_intent "指令-归档" "归档这批记录" "ARCHIVE_ACTION,DATA_ARCHIVE"
test_intent "指令-同步" "同步最新数据" "DATA_SYNC,SYNC_ACTION"
test_intent "指令-刷新" "刷新页面数据" "DATA_REFRESH,REFRESH_ACTION"

# ==========================================
# 第10类: 长句/复杂表达 (25个)
# ==========================================
echo ""
echo ">>> 测试类别: 长句/复杂表达 (25个)"

test_intent "长句-生产" "我想了解一下今天上午A车间1号产线生产A产品的具体情况包括产量良率和效率" "PRODUCTION_DETAIL,PRODUCTION_STATS"
test_intent "长句-质量" "请帮我查一下上周生产的所有批次中有哪些出现了质量问题需要特别关注的" "QUALITY_ALERT,BATCH_QUALITY_ISSUE"
test_intent "长句-库存" "我需要知道目前所有原料的库存情况哪些快要用完了需要提前采购的" "INVENTORY_ALERT,LOW_STOCK_QUERY"
test_intent "长句-设备" "把最近一个月所有设备的运行状态维护记录和故障情况都整理出来给我" "EQUIPMENT_SUMMARY,MAINTENANCE_HISTORY"
test_intent "长句-订单" "客户A的订单从下单到发货整个过程的所有信息我都要看一下确保没有问题" "ORDER_FULL_TRACK,ORDER_DETAIL"
test_intent "长句-成本" "分析一下这个月各个车间各个产品的成本构成和上个月对比有什么变化" "COST_COMPARISON,COST_BY_WORKSHOP"
test_intent "长句-人员" "我想看看这个季度所有员工的绩效考核结果培训完成情况和出勤记录" "EMPLOYEE_PERFORMANCE,HR_SUMMARY"
test_intent "长句-追溯" "这批产品从原料采购生产加工到成品入库的完整追溯链都要查清楚" "FULL_TRACEABILITY,COMPLETE_TRACE"
test_intent "长句-排程" "下周的生产排程需要考虑设备维护计划人员休假和客户订单的优先级" "SCHEDULE_PLANNING,COMPREHENSIVE_SCHEDULE"
test_intent "长句-分析" "帮我分析一下为什么这个月的OEE下降了主要是哪些因素影响的" "OEE_ROOT_CAUSE,OEE_ANALYSIS"
test_intent "长句-预警" "设置一个预警当库存低于安全库存或者设备运行时间超过维护周期时通知我" "ALERT_CONFIG,MULTI_ALERT_SET"
test_intent "长句-报表" "生成一份包含生产质量成本效率的综合月度报告并按车间分别统计" "COMPREHENSIVE_REPORT,MONTHLY_SUMMARY"
test_intent "长句-审批" "这个采购申请需要经过部门主管采购经理和财务总监三级审批" "MULTI_LEVEL_APPROVAL,APPROVAL_FLOW"
test_intent "长句-培训" "新员工入职后需要完成安全培训质量培训和岗位技能培训才能上岗" "TRAINING_PROGRAM,ONBOARDING_TRAINING"
test_intent "长句-盘点" "年终盘点需要核对所有物料的账面数量和实际数量找出差异原因" "ANNUAL_INVENTORY,INVENTORY_VARIANCE"
test_intent "长句-认证" "ISO认证需要准备质量手册程序文件和过去一年的质量记录" "ISO_PREPARATION,CERTIFICATION_DOC"
test_intent "长句-改善" "针对上次客户投诉的问题制定改善措施并跟踪执行效果" "IMPROVEMENT_PLAN,CORRECTIVE_ACTION"
test_intent "长句-比较" "把今年和去年同期的销售额产量成本进行对比分析增长或下降的原因" "YEAR_OVER_YEAR,TREND_ANALYSIS"
test_intent "长句-预测" "根据历史数据和当前订单情况预测下个月的产能需求和物料需求" "DEMAND_FORECAST,CAPACITY_PLANNING"
test_intent "长句-评估" "评估一下如果增加一条产线需要多少投资多长时间能收回成本" "ROI_ANALYSIS,INVESTMENT_EVALUATION"
test_intent "长句-协调" "生产部和仓库的交接流程需要优化减少等待时间提高效率" "PROCESS_OPTIMIZATION,WORKFLOW_IMPROVE"
test_intent "长句-监控" "实时监控所有车间的温度湿度和关键设备的运行参数" "REAL_TIME_MONITOR,ENVIRONMENT_MONITOR"
test_intent "长句-汇总" "把所有分厂的数据汇总起来形成集团层面的统一报表" "DATA_CONSOLIDATION,GROUP_REPORT"
test_intent "长句-对账" "和供应商对账核对本月的送货数量金额和付款情况" "SUPPLIER_RECONCILIATION,PAYMENT_CHECK"
test_intent "长句-规划" "制定明年的生产计划考虑市场需求产能限制和资源配置" "ANNUAL_PLANNING,PRODUCTION_PLAN"

# ==========================================
# 输出测试总结
# ==========================================
echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
echo "结束时间: $(date)"
echo ""
echo "测试结果汇总:"
echo "  总计: $TOTAL"
echo "  通过: $PASSED ($(echo "scale=2; $PASSED * 100 / $TOTAL" | bc)%)"
echo "  失败: $FAILED ($(echo "scale=2; $FAILED * 100 / $TOTAL" | bc)%)"
echo "  超时: $TIMEOUT_COUNT"
echo ""
echo "通过率: $(echo "scale=2; $PASSED * 100 / $TOTAL" | bc)%"
echo "=========================================="
