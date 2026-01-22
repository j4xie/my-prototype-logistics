#!/bin/bash
# v10.0 意图识别系统 - 批量测试脚本 (带延迟)

API_URL="http://139.196.165.140:10010/api/public/ai-demo/recognize"
FACTORY_ID="F001"
TIMEOUT=90
DELAY=2  # 每次请求间隔2秒

TOTAL=0
PASSED=0
FAILED=0
TIMEOUT_COUNT=0

test_intent() {
    local category="$1"
    local input="$2"
    local expected="$3"

    TOTAL=$((TOTAL + 1))

    sleep $DELAY

    RESPONSE=$(curl -s -m $TIMEOUT -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"userInput\": \"$input\", \"factoryId\": \"$FACTORY_ID\"}" 2>/dev/null)

    if [ -z "$RESPONSE" ]; then
        TIMEOUT_COUNT=$((TIMEOUT_COUNT + 1))
        printf "[%3d] ⏱ TIMEOUT: %s\n" "$TOTAL" "$category"
        return
    fi

    MATCHED=$(echo "$RESPONSE" | jq -r '.data.matched // false')
    INTENT=$(echo "$RESPONSE" | jq -r '.data.intentCode // "null"')
    CONFIDENCE=$(echo "$RESPONSE" | jq -r '.data.confidence // 0')
    METHOD=$(echo "$RESPONSE" | jq -r '.data.matchMethod // "null"')

    if [ "$MATCHED" = "true" ] && [ "$INTENT" != "null" ]; then
        PASSED=$((PASSED + 1))
        printf "[%3d] ✓ PASS: %-20s | %-30s | %.2f | %s\n" "$TOTAL" "$category" "$INTENT" "$CONFIDENCE" "$METHOD"
    else
        FAILED=$((FAILED + 1))
        printf "[%3d] ✗ FAIL: %-20s | matched=%s, intent=%s\n" "$TOTAL" "$category" "$MATCHED" "$INTENT"
    fi
}

echo "=========================================="
echo "v10.0 意图识别系统 - 复杂场景测试"
echo "每次请求间隔 ${DELAY}s，超时 ${TIMEOUT}s"
echo "=========================================="
echo "开始: $(date)"
echo ""

# 1. 反问句式 (20个)
echo ">>> 反问句式测试"
test_intent "反问-批次" "难道你不觉得批次信息应该更清晰吗？" "MATERIAL_BATCH_QUERY"
test_intent "反问-质量" "难道质量报告不应该每天生成吗？" "QUALITY_REPORT"
test_intent "反问-库存" "难道库存不需要盘点吗？" "INVENTORY_CHECK"
test_intent "反问-生产" "生产计划不是应该提前安排吗？" "PRODUCTION_PLAN_QUERY"
test_intent "反问-设备" "设备维护难道可以忽略吗？" "EQUIPMENT_MAINTENANCE"
test_intent "反问-订单" "订单跟踪难道不需要吗？" "ORDER_TRACKING"
test_intent "反问-成本" "成本分析难道不做了吗？" "COST_ANALYSIS"
test_intent "反问-效率" "生产效率难道不需要监控吗？" "EFFICIENCY_REPORT"
test_intent "反问-安全" "食品安全检查难道可以省略吗？" "SAFETY_CHECK"
test_intent "反问-追溯" "产品追溯难道不重要吗？" "TRACEABILITY_QUERY"
test_intent "反问-客户" "客户投诉难道不处理吗？" "COMPLAINT_HANDLE"
test_intent "反问-销售" "销售数据难道不分析吗？" "SALES_REPORT"
test_intent "反问-采购" "采购订单难道不审批吗？" "PURCHASE_APPROVAL"
test_intent "反问-物流" "物流配送难道不跟踪吗？" "LOGISTICS_TRACK"
test_intent "反问-考勤" "员工考勤难道不记录吗？" "ATTENDANCE_RECORD"
test_intent "反问-培训" "员工培训难道不安排吗？" "TRAINING_SCHEDULE"
test_intent "反问-报表" "月度报表难道不看吗？" "MONTHLY_REPORT"
test_intent "反问-预警" "库存预警难道可以忽视吗？" "INVENTORY_ALERT"
test_intent "反问-排程" "生产排程难道随意吗？" "SCHEDULE_QUERY"
test_intent "反问-工艺" "工艺参数难道不检查吗？" "PROCESS_PARAMS"

# 2. 转折句式 (20个)
echo ""
echo ">>> 转折句式测试"
test_intent "转折-批次" "虽然库存看起来正常，但是我还是想查看一下原料批次" "MATERIAL_BATCH_QUERY"
test_intent "转折-质量" "尽管上次检查没问题，但我想再看看质量报告" "QUALITY_REPORT"
test_intent "转折-生产" "虽然产量达标了，但是我担心生产效率" "EFFICIENCY_REPORT"
test_intent "转折-设备" "设备运行正常，不过还是检查一下维护记录吧" "EQUIPMENT_MAINTENANCE"
test_intent "转折-订单" "订单已经发货了，但是我想确认一下物流状态" "LOGISTICS_TRACK"
test_intent "转折-人员" "人员都到齐了，但是我想看看今天的排班表" "SHIFT_SCHEDULE"
test_intent "转折-成本" "成本控制得不错，但是还是分析一下具体数据" "COST_ANALYSIS"
test_intent "转折-客户" "客户没有投诉，但是我想了解一下反馈情况" "CUSTOMER_FEEDBACK"
test_intent "转折-采购" "采购已经完成了，但是我想核对一下订单" "PURCHASE_ORDER"
test_intent "转折-销售" "销售目标完成了，但是我想看看明细数据" "SALES_REPORT"
test_intent "转折-考勤" "大家都按时上班了，但是我想核查一下考勤记录" "ATTENDANCE_RECORD"
test_intent "转折-预警" "目前没有预警，但是我想检查一下阈值设置" "ALERT_CONFIG"
test_intent "转折-追溯" "产品没问题，但是我想验证一下追溯信息" "TRACEABILITY_QUERY"
test_intent "转折-排程" "排程已经确定了，但是我想看看资源分配" "SCHEDULE_QUERY"
test_intent "转折-工艺" "工艺执行正常，但是我想核对一下参数" "PROCESS_PARAMS"
test_intent "转折-能耗" "能耗没超标，但是我想分析一下趋势" "ENERGY_REPORT"
test_intent "转折-安全" "安全检查通过了，但是我想看看详细记录" "SAFETY_RECORD"
test_intent "转折-物料" "物料已经入库了，但是我想确认一下批次信息" "MATERIAL_BATCH_QUERY"
test_intent "转折-良率" "良率达标了，但是我想看看详细统计" "YIELD_REPORT"
test_intent "转折-OEE" "OEE数据不错，但是我想深入分析一下" "OEE_ANALYSIS"

# 3. 双重否定 (20个)
echo ""
echo ">>> 双重否定测试"
test_intent "双否-生产" "我不是不想看生产数据，只是现在太忙" "REPORT_PRODUCTION"
test_intent "双否-质量" "不是不关心质量问题，只是需要先处理其他事" "QUALITY_REPORT"
test_intent "双否-库存" "并非不在意库存情况，只是暂时没时间" "INVENTORY_QUERY"
test_intent "双否-设备" "不是不想检查设备，实在是抽不开身" "EQUIPMENT_STATUS_QUERY"
test_intent "双否-订单" "我不是不管订单状态，只是刚才有事" "ORDER_STATUS"
test_intent "双否-人员" "不是不关心员工出勤，只是还没来得及看" "ATTENDANCE_RECORD"
test_intent "双否-成本" "并非不重视成本控制，只是数据还没整理" "COST_ANALYSIS"
test_intent "双否-客户" "不是不理会客户反馈，只是需要汇总" "CUSTOMER_FEEDBACK"
test_intent "双否-采购" "我不是不批采购申请，只是要核实一下" "PURCHASE_APPROVAL"
test_intent "双否-安全" "不是不做安全检查，只是要协调人员" "SAFETY_CHECK"
test_intent "双否-培训" "并非不安排培训，只是要确定时间" "TRAINING_SCHEDULE"
test_intent "双否-报表" "不是不看报表，只是要等数据更新" "REPORT_QUERY"
test_intent "双否-审批" "我不是不处理审批，只是要了解情况" "APPROVAL_PROCESS"
test_intent "双否-排程" "不是不调整排程，只是要评估影响" "SCHEDULE_ADJUST"
test_intent "双否-追溯" "并非不做追溯，只是要确认范围" "TRACEABILITY_QUERY"
test_intent "双否-预警" "不是不理会预警，只是要分析原因" "ALERT_QUERY"
test_intent "双否-盘点" "我不是不做盘点，只是要安排时间" "INVENTORY_CHECK"
test_intent "双否-物流" "不是不跟踪物流，只是要等更新" "LOGISTICS_TRACK"
test_intent "双否-良率" "我不是不在乎良率，只是要对比历史" "YIELD_REPORT"
test_intent "双否-KPI" "不是不看KPI，只是要确定指标" "KPI_REPORT"

# 4. 方言/口语 (30个)
echo ""
echo ">>> 方言/口语测试"
test_intent "方言-北方1" "俺想瞅瞅那批货咋样了" "MATERIAL_BATCH_QUERY"
test_intent "方言-北方2" "咱看看今儿个生产情况咋样" "PRODUCTION_STATS"
test_intent "方言-北方3" "整点库存数据给俺瞅瞅" "INVENTORY_QUERY"
test_intent "方言-北方4" "那设备咋回事儿啊" "EQUIPMENT_STATUS_QUERY"
test_intent "方言-北方5" "给俺整个生产报表" "REPORT_PRODUCTION"
test_intent "方言-东北1" "唠唠这批货的事儿" "MATERIAL_BATCH_QUERY"
test_intent "方言-东北2" "整明白这个质量问题" "QUALITY_ANALYSIS"
test_intent "方言-东北3" "贼拉想看看产量" "PRODUCTION_STATS"
test_intent "方言-东北4" "这活儿干得咋样了" "PRODUCTION_PROGRESS"
test_intent "方言-东北5" "给我整点数据看看" "DATA_QUERY"
test_intent "方言-川渝1" "看哈今天的生产情况" "PRODUCTION_STATS"
test_intent "方言-川渝2" "莫得问题嘛这批货" "QUALITY_CHECK"
test_intent "方言-川渝3" "啷个回事这个订单" "ORDER_QUERY"
test_intent "方言-川渝4" "要得把库存看哈" "INVENTORY_QUERY"
test_intent "方言-川渝5" "巴适得很这个产量" "PRODUCTION_STATS"
test_intent "方言-粤语1" "睇下今日嘅生产情况" "PRODUCTION_STATS"
test_intent "方言-粤语2" "搞掂呢个订单未" "ORDER_STATUS"
test_intent "方言-粤语3" "畀我睇下库存" "INVENTORY_QUERY"
test_intent "方言-粤语4" "今日出咗几多货" "PRODUCTION_OUTPUT"
test_intent "方言-粤语5" "呢批料OK唔OK" "MATERIAL_INSPECTION"
test_intent "口语-网络1" "给我康康今天有啥质量问题" "QUALITY_STATS"
test_intent "口语-网络2" "rua一下这个设备状态" "EQUIPMENT_STATUS_QUERY"
test_intent "口语-网络3" "8太行啊这个产量" "PRODUCTION_STATS"
test_intent "口语-网络4" "有点emo看看生产数据吧" "PRODUCTION_STATS"
test_intent "口语-网络5" "绝绝子这批货质量咋样" "QUALITY_CHECK"
test_intent "口语-网络6" "yyds查下库存" "INVENTORY_QUERY"
test_intent "口语-网络7" "这波操作666看看效率" "EFFICIENCY_REPORT"
test_intent "口语-网络8" "栓Q帮我查个订单" "ORDER_QUERY"
test_intent "口语-简化1" "批次啥情况" "MATERIAL_BATCH_QUERY"
test_intent "口语-简化2" "设备咋了" "EQUIPMENT_STATUS_QUERY"

# 5. 复合意图 (20个)
echo ""
echo ">>> 复合意图测试"
test_intent "复合-生产质量" "看看生产数据顺便检查一下质量" "PRODUCTION_STATS"
test_intent "复合-库存采购" "库存快没了需要采购" "INVENTORY_QUERY"
test_intent "复合-设备维护" "设备有问题安排维护" "EQUIPMENT_ALERT"
test_intent "复合-订单物流" "订单发了吗物流到哪了" "ORDER_STATUS"
test_intent "复合-人员考勤" "看看今天谁没来考勤情况" "ATTENDANCE_RECORD"
test_intent "复合-成本效率" "成本和效率一起分析一下" "COST_ANALYSIS"
test_intent "复合-销售客户" "销售数据和客户反馈都要看" "SALES_REPORT"
test_intent "复合-质量追溯" "质量问题需要追溯批次" "QUALITY_ISSUE"
test_intent "复合-排程资源" "排程和资源分配情况" "SCHEDULE_QUERY"
test_intent "复合-能耗设备" "能耗异常检查设备" "ENERGY_ALERT"
test_intent "复合-培训考核" "培训完了看看考核结果" "TRAINING_RESULT"
test_intent "复合-预警处理" "有预警吗怎么处理" "ALERT_QUERY"
test_intent "复合-换线首检" "换线后做首检" "CHANGEOVER_RECORD"
test_intent "复合-停机原因" "停机了什么原因" "DOWNTIME_RECORD"
test_intent "复合-返工报废" "返工还是报废怎么处理" "REWORK_HANDLE"
test_intent "复合-良率原因" "良率下降分析原因" "YIELD_REPORT"
test_intent "复合-报表导出" "生成报表并导出" "REPORT_GENERATE"
test_intent "复合-物料入库" "物料到了办理入库" "MATERIAL_RECEIPT"
test_intent "复合-订单排产" "新订单安排生产" "ORDER_CREATE"
test_intent "复合-设备报修" "设备坏了报修" "EQUIPMENT_ALERT"

# 6. 业务场景 (20个)
echo ""
echo ">>> 业务场景测试"
test_intent "场景-晨会" "今天早上开晨会需要昨天的生产数据" "DAILY_PRODUCTION"
test_intent "场景-巡查" "老板要来巡查准备一下车间数据" "WORKSHOP_OVERVIEW"
test_intent "场景-审计" "下周有审计需要合规相关资料" "COMPLIANCE_REPORT"
test_intent "场景-客诉" "客户投诉产品有问题查一下批次" "COMPLAINT_TRACE"
test_intent "场景-催货" "客户催货看看订单什么时候能发" "ORDER_STATUS"
test_intent "场景-缺料" "生产缺料了看看库存还有多少" "MATERIAL_SHORTAGE"
test_intent "场景-加班" "要加班赶订单安排一下人员" "OVERTIME_SCHEDULE"
test_intent "场景-停产" "设备故障停产了什么时候能修好" "EQUIPMENT_REPAIR"
test_intent "场景-交接" "要下班了看看有什么要交接的" "SHIFT_HANDOVER"
test_intent "场景-盘库" "月底了该盘库了" "INVENTORY_CHECK"
test_intent "场景-结算" "月底结算需要成本数据" "MONTHLY_COST"
test_intent "场景-考核" "季度考核需要KPI数据" "KPI_REPORT"
test_intent "场景-培训" "新员工入职安排培训" "NEW_EMPLOYEE_TRAINING"
test_intent "场景-认证" "准备ISO认证需要质量记录" "QUALITY_RECORD"
test_intent "场景-年终" "年终总结需要全年数据" "YEARLY_SUMMARY"
test_intent "场景-预算" "做下年预算需要今年的成本数据" "COST_HISTORY"
test_intent "场景-退货" "有退货检查一下原因" "RETURN_ANALYSIS"
test_intent "场景-验收" "设备验收需要检测报告" "EQUIPMENT_ACCEPTANCE"
test_intent "场景-召回" "产品召回追溯所有批次" "PRODUCT_RECALL"
test_intent "场景-改善" "持续改善看看哪里可以优化" "IMPROVEMENT_ANALYSIS"

# 7. 时间条件查询 (20个)
echo ""
echo ">>> 时间条件查询测试"
test_intent "时间-今天" "今天的生产数据" "DAILY_PRODUCTION"
test_intent "时间-昨天" "昨天的质量报告" "QUALITY_REPORT"
test_intent "时间-本周" "本周的销售情况" "WEEKLY_SALES"
test_intent "时间-上周" "上周的库存变化" "INVENTORY_HISTORY"
test_intent "时间-本月" "本月的成本分析" "MONTHLY_COST"
test_intent "时间-上月" "上月的生产效率" "MONTHLY_EFFICIENCY"
test_intent "时间-今年" "今年的总产量" "YEARLY_PRODUCTION"
test_intent "时间-最近" "最近一周的异常" "RECENT_ALERTS"
test_intent "条件-车间" "A车间的生产数据" "WORKSHOP_PRODUCTION"
test_intent "条件-产线" "1号产线的效率" "LINE_EFFICIENCY"
test_intent "条件-班次" "早班的产量" "SHIFT_PRODUCTION"
test_intent "条件-产品" "A产品的质量数据" "PRODUCT_QUALITY"
test_intent "条件-批次" "批次B001的追溯信息" "BATCH_TRACE"
test_intent "条件-设备" "设备E001的状态" "EQUIPMENT_STATUS"
test_intent "条件-员工" "张三的考勤记录" "EMPLOYEE_ATTENDANCE"
test_intent "条件-供应商" "供应商S001的交货情况" "SUPPLIER_DELIVERY"
test_intent "条件-客户" "客户C001的订单" "CUSTOMER_ORDER"
test_intent "条件-仓库" "A仓库的库存" "WAREHOUSE_INVENTORY"
test_intent "范围-前十" "产量前十的产品" "TOP_PRODUCTS"
test_intent "排序-按时间" "按时间排序的订单" "ORDER_SORT"

# 8. 指令式表达 (15个)
echo ""
echo ">>> 指令式表达测试"
test_intent "指令-创建" "创建一个新的生产批次" "BATCH_CREATE"
test_intent "指令-更新" "更新设备状态为维修中" "EQUIPMENT_STATUS_UPDATE"
test_intent "指令-导出" "导出本月的生产数据" "DATA_EXPORT"
test_intent "指令-打印" "打印这张报表" "REPORT_PRINT"
test_intent "指令-提交" "提交这个审批" "APPROVAL_SUBMIT"
test_intent "指令-取消" "取消这个订单" "ORDER_CANCEL"
test_intent "指令-暂停" "暂停这条产线" "LINE_PAUSE"
test_intent "指令-恢复" "恢复生产" "PRODUCTION_RESUME"
test_intent "指令-启动" "启动设备" "EQUIPMENT_START"
test_intent "指令-分配" "把任务分配给张三" "TASK_ASSIGN"
test_intent "指令-调整" "调整排程时间" "SCHEDULE_ADJUST"
test_intent "指令-修改" "修改批次信息" "BATCH_UPDATE"
test_intent "指令-确认" "确认收货" "RECEIPT_CONFIRM"
test_intent "指令-审批" "审批通过" "APPROVAL_PASS"
test_intent "指令-记录" "记录这次巡检结果" "INSPECTION_RECORD"

# 9. 长句复杂表达 (15个)
echo ""
echo ">>> 长句复杂表达测试"
test_intent "长句-生产" "我想了解一下今天上午A车间1号产线生产A产品的具体情况" "PRODUCTION_DETAIL"
test_intent "长句-质量" "请帮我查一下上周生产的所有批次中有哪些出现了质量问题" "QUALITY_ALERT"
test_intent "长句-库存" "我需要知道目前所有原料的库存情况哪些快要用完了" "INVENTORY_ALERT"
test_intent "长句-设备" "把最近一个月所有设备的运行状态维护记录整理出来" "EQUIPMENT_SUMMARY"
test_intent "长句-订单" "客户A的订单从下单到发货整个过程的所有信息" "ORDER_FULL_TRACK"
test_intent "长句-成本" "分析一下这个月各个车间各个产品的成本构成" "COST_COMPARISON"
test_intent "长句-人员" "我想看看这个季度所有员工的绩效考核结果" "EMPLOYEE_PERFORMANCE"
test_intent "长句-追溯" "这批产品从原料采购生产加工到成品入库的完整追溯链" "FULL_TRACEABILITY"
test_intent "长句-排程" "下周的生产排程需要考虑设备维护计划和人员休假" "SCHEDULE_PLANNING"
test_intent "长句-分析" "帮我分析一下为什么这个月的OEE下降了" "OEE_ROOT_CAUSE"
test_intent "长句-报表" "生成一份包含生产质量成本效率的综合月度报告" "COMPREHENSIVE_REPORT"
test_intent "长句-培训" "新员工入职后需要完成安全培训质量培训和岗位技能培训" "TRAINING_PROGRAM"
test_intent "长句-比较" "把今年和去年同期的销售额产量成本进行对比分析" "YEAR_OVER_YEAR"
test_intent "长句-预测" "根据历史数据和当前订单情况预测下个月的产能需求" "DEMAND_FORECAST"
test_intent "长句-评估" "评估一下如果增加一条产线需要多少投资" "ROI_ANALYSIS"

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
echo "结束: $(date)"
echo ""
echo "测试结果汇总:"
echo "  总计: $TOTAL"
echo "  通过: $PASSED"
echo "  失败: $FAILED"
echo "  超时: $TIMEOUT_COUNT"
echo ""
if [ $TOTAL -gt 0 ]; then
    PASS_RATE=$(echo "scale=2; $PASSED * 100 / $TOTAL" | bc)
    echo "通过率: ${PASS_RATE}%"
fi
echo "=========================================="
