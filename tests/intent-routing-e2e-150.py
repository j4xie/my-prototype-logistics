#!/usr/bin/env python3
"""
E2E Intent Routing + Response Quality Test
Tests 3 dimensions: 咨询(Consultation) / 查询(Query) / 写入(Write)

Validates:
1. Intent routing accuracy (correct intentCode)
2. Category separation (no cross-contamination)
3. Response quality (meaningful content, not errors)
"""
import requests, json, sys, time

# Login
login_r = requests.post('http://47.100.235.168:10010/api/mobile/auth/unified-login',
    json={'username': 'factory_admin1', 'password': '123456'})
token = login_r.json()['data']['token']

def recognize(input_text):
    """Intent recognition only (fast)"""
    try:
        r = requests.post('http://47.100.235.168:10010/api/mobile/F001/ai-intents/recognize',
            json={'userInput': input_text},
            headers={'Authorization': f'Bearer {token}'}, timeout=60)
        data = r.json().get('data', {}) or {}
        return {
            'matched': data.get('matched', False),
            'intent': str(data.get('intentCode') or 'N/A'),
            'method': str(data.get('matchMethod') or '?'),
            'category': str(data.get('category') or '?'),
            'confidence': data.get('confidence', 0),
        }
    except Exception as e:
        return {'matched': False, 'intent': 'ERROR', 'method': '?', 'category': '?', 'confidence': 0}

def execute(input_text):
    """Full intent execution (slower, returns response)"""
    try:
        r = requests.post('http://47.100.235.168:10010/api/mobile/F001/ai-intents/execute',
            json={'userInput': input_text},
            headers={'Authorization': f'Bearer {token}'}, timeout=90)
        resp = r.json()
        data = resp.get('data', {}) or {}
        return {
            'success': resp.get('success', False),
            'intent': str(data.get('intentCode') or 'N/A'),
            'status': str(data.get('status') or '?'),
            'category': str(data.get('intentCategory') or '?'),
            'reply': str(data.get('formattedText') or data.get('replyText') or data.get('reply') or ''),
            'has_data': data.get('resultData') is not None and data.get('resultData') != {},
            'has_clarification': bool(data.get('clarificationQuestions')),
            'action_type': str(data.get('actionType') or '?'),
        }
    except Exception as e:
        return {'success': False, 'intent': 'ERROR', 'status': 'ERROR', 'category': '?',
                'reply': '', 'has_data': False, 'has_clarification': False, 'action_type': '?'}

# ===== Category definitions =====

# Expected action types
CONSULT_INTENTS = {'FOOD_KNOWLEDGE_QUERY'}
QUERY_INTENTS = {
    'MATERIAL_BATCH_QUERY', 'INBOUND_RECORD_QUERY', 'REPORT_INVENTORY',
    'PROCESSING_BATCH_LIST', 'PROCESSING_BATCH_DETAIL', 'PRODUCTION_STATUS_QUERY', 'REPORT_PRODUCTION',
    'ORDER_LIST', 'ORDER_DETAIL', 'LOGISTICS_TRACKING', 'ORDER_TODAY', 'ORDER_STATUS', 'ORDER_TIMEOUT_MONITOR',
    'QUALITY_INSPECTION_LIST', 'QUALITY_BATCH_REPORT', 'QUALITY_CHECK_QUERY', 'QUALITY_STATS', 'QUALITY_CRITICAL_ITEMS',
    'PROCUREMENT_LIST', 'PROCUREMENT_STATS',
    'ATTENDANCE_STATS', 'ATTENDANCE_RECORD', 'ATTENDANCE_HISTORY', 'ATTENDANCE_TODAY', 'ATTENDANCE_ANOMALY',
    'ATTENDANCE_DEPARTMENT', 'ATTENDANCE_MONTHLY', 'ATTENDANCE_STATS_BY_DEPT',
    'HR_PERFORMANCE', 'EMPLOYEE_DETAIL',
    'REPORT_KPI', 'CUSTOMER_STATS', 'SALES_STATS', 'SALES_RANKING', 'PRODUCT_SALES_RANKING',
    'EQUIPMENT_STATUS_QUERY', 'EQUIPMENT_LIST', 'EQUIPMENT_STATS', 'EQUIPMENT_DETAIL', 'EQUIPMENT_MAINTENANCE',
    'EQUIPMENT_ALERT_LIST', 'EQUIPMENT_ALERT_STATS',
    'ALERT_LIST', 'ALERT_ACTIVE', 'ALERT_STATS',
    'COLD_CHAIN_TEMPERATURE',
    'SCHEDULING_QUERY', 'SCHEDULING_LIST', 'SCHEDULING_COVERAGE_QUERY', 'PRODUCTION_PLAN_LIST',
    'FINANCE_STATS', 'COST_TREND_ANALYSIS', 'COST_QUERY', 'REPORT_FINANCE',
    'PRODUCT_TYPE_QUERY', 'PRODUCT_SALES_RANKING',
    'REPORT_TRENDS', 'REPORT_QUALITY', 'REPORT_DASHBOARD_OVERVIEW', 'REPORT_EXECUTIVE_DAILY',
    'REPORT_PRODUCTION_WEEKLY_COMPARISON',
    'SHIPMENT_QUERY', 'SHIPMENT_STATS', 'SHIPMENT_BY_DATE', 'SHIPMENT_BY_CUSTOMER',
    'SUPPLIER_LIST', 'SUPPLIER_SEARCH', 'SUPPLIER_RANKING', 'SUPPLIER_EVALUATE', 'SUPPLIER_PRICE_COMPARISON',
    'CUSTOMER_LIST', 'CUSTOMER_SEARCH', 'CUSTOMER_PURCHASE_HISTORY', 'CUSTOMER_ACTIVE',
    'TRACE_BATCH', 'TRACE_FULL', 'TRACE_PUBLIC',
    'WAREHOUSE_INVENTORY_CHECK',
    'MATERIAL_LOW_STOCK_ALERT', 'MATERIAL_EXPIRED_QUERY', 'MATERIAL_EXPIRING_ALERT',
    'INVENTORY_SUMMARY_QUERY', 'INVENTORY_TOTAL_QUERY',
    'TASK_PROGRESS_QUERY',
    'PROCESSING_BATCH_TIMELINE',
    'SUPPLIER_ACTIVE', 'SUPPLIER_BY_CATEGORY',
    'CUSTOMER_BY_TYPE',
    'SCALE_LIST_DEVICES', 'SCALE_DEVICE_DETAIL',
    'REPORT_EFFICIENCY', 'REPORT_ANOMALY',
    'QUERY_INVENTORY_QUANTITY', 'QUERY_INVENTORY_TOTAL', 'QUERY_MATERIAL_STOCK_SUMMARY',
    'QUERY_LIQUIDITY', 'QUERY_SOLVENCY',
    'QUERY_DUPONT_ANALYSIS',
    'ATTENDANCE_STATUS',
    'PAYMENT_STATUS_QUERY',
    'SHIPMENT_EXPEDITE',
    'ALERT_BY_EQUIPMENT', 'ALERT_BY_LEVEL', 'ALERT_DIAGNOSE', 'ALERT_TRIAGE',
    'EQUIPMENT_ALERT_ACKNOWLEDGE',
    'SCHEDULING_QUERY_COVERAGE',
    'MATERIAL_FIFO_RECOMMEND',
    'QUALITY_CRITICAL_ITEMS', 'QUALITY_DISPOSITION_EVALUATE',
    'QUERY_FINANCE_ROA', 'QUERY_FINANCE_ROE',
    'QUERY_EMPLOYEE_PROFILE', 'QUERY_ONLINE_STAFF_COUNT',
    'REPORT_BENEFIT_OVERVIEW',
    'USER_TODO_LIST',
    'BATCH_AUTO_LOOKUP',
    'BREAKDOWN_REPORT',
    'ORDER_APPROVAL',
    'SCHEDULING_RUN_TOMORROW',
    'PROFIT_TREND_ANALYSIS',
    # v26h: DB intents not previously in classification
    'ANALYZE_EQUIPMENT', 'EQUIPMENT_BREAKDOWN_REPORT', 'EQUIPMENT_HEALTH_DIAGNOSIS',
    'CCP_MONITOR_DATA_DETECTION',
    'PROCESSING_BATCH_WORKERS', 'QUERY_PROCESSING_BATCH_SUPERVISOR',
    'QUERY_PROCESSING_CURRENT_STEP', 'QUERY_PROCESSING_STEP',
    'QUERY_APPROVAL_RECORD', 'QUERY_ORDER_PENDING_MATERIAL_QUANTITY',
    'QUERY_MATERIAL_REJECTION_REASON', 'QUERY_EQUIPMENT_STATUS_BY_NAME',
    'QUERY_TRANSPORT_LINE',
    'REPORT_AI_QUALITY', 'REPORT_INTELLIGENT_QUALITY', 'REPORT_QUALITY_AI',
    'REPORT_CHECK', 'REPORT_WORKSHOP_DAILY',
    'WORKER_IN_SHOP_REALTIME_COUNT', 'WORKER_ARRIVAL_CONFIRM',
    'INVENTORY_OUTBOUND', 'WAREHOUSE_OUTBOUND',
    'APPROVAL_CONFIG_PURCHASE_ORDER',
    'MRP_CALCULATION',
}
WRITE_INTENTS = {
    'MATERIAL_BATCH_CREATE', 'MATERIAL_BATCH_DELETE', 'MATERIAL_UPDATE', 'MATERIAL_ADJUST_QUANTITY',
    'PROCESSING_BATCH_CREATE', 'PROCESSING_BATCH_START', 'PROCESSING_BATCH_PAUSE',
    'PROCESSING_BATCH_RESUME', 'PROCESSING_BATCH_COMPLETE', 'PROCESSING_BATCH_CANCEL',
    'ORDER_CREATE', 'ORDER_NEW', 'ORDER_UPDATE', 'ORDER_DELETE', 'ORDER_MODIFY',
    'SHIPMENT_CREATE', 'SHIPMENT_STATUS_UPDATE', 'SHIPMENT_DELETE', 'SHIPMENT_UPDATE',
    'CLOCK_IN', 'CLOCK_OUT',
    'BATCH_UPDATE', 'QUALITY_CHECK_CREATE', 'QUALITY_CHECK_EXECUTE',
    'ALERT_ACKNOWLEDGE', 'ALERT_RESOLVE',
    'EQUIPMENT_STATUS_UPDATE', 'EQUIPMENT_START', 'EQUIPMENT_STOP',
    'SUPPLIER_CREATE', 'SUPPLIER_DELETE',
    'USER_CREATE', 'USER_UPDATE', 'USER_DELETE',
    'SCHEDULING_SET_AUTO', 'SCHEDULING_SET_MANUAL', 'SCHEDULING_SET_DISABLED',
    'PRODUCTION_LINE_START',
    'SCALE_ADD_DEVICE', 'SCALE_DELETE_DEVICE', 'SCALE_UPDATE_DEVICE',
    'INVENTORY_CLEAR',
    'MATERIAL_BATCH_CONSUME', 'MATERIAL_BATCH_RELEASE', 'MATERIAL_BATCH_RESERVE',
    'PRODUCT_UPDATE', 'PLAN_UPDATE',
    'CONVERSION_RATE_UPDATE',
    'PROCESSING_WORKER_ASSIGN',
    'QUALITY_BATCH_MARK_AS_INSPECTED', 'QUALITY_DISPOSITION_EXECUTE',
    'HR_DELETE_EMPLOYEE', 'TASK_ASSIGN_WORKER',
    'SUPPLIER_EVALUATE',
    'ORDER_APPROVAL',
    # v26h: DB intents not previously in classification
    'EQUIPMENT_CAMERA_START', 'EQUIPMENT_ALERT_RESOLVE',
    'PROCESSING_WORKER_CHECKOUT', 'PRODUCTION_CONFIRM_WORKERS_PRESENT',
    'SCHEDULING_EXECUTE_FOR_DATE',
    'SHIPMENT_NOTIFY_WAREHOUSE_PREPARE',
    'TASK_ASSIGN_BY_NAME', 'TASK_ASSIGN_EMPLOYEE',
    'NOTIFICATION_SEND_WECHAT', 'SEND_WECHAT_MESSAGE',
    'HR_EMPLOYEE_DELETE', 'HRM_DELETE_EMPLOYEE',
}

def classify_intent(intent_code):
    """Classify an intent code into CONSULT/QUERY/WRITE"""
    if intent_code in CONSULT_INTENTS:
        return 'CONSULT'
    elif intent_code in WRITE_INTENTS:
        return 'WRITE'
    elif intent_code in QUERY_INTENTS:
        return 'QUERY'
    else:
        return 'UNKNOWN'

# ===== Test Cases =====
# Format: (input, expected_type, expected_intents_or_domains, description)
# expected_type: CONSULT, QUERY, WRITE
# expected_intents: pipe-separated list of acceptable intent codes or domain prefixes

categories = {
    # ====== A: 咨询 (Food Knowledge Consultation) ======
    'A1': ('咨询-食品安全基础', [
        ('猪肉的保质期是多久', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '保质期知识'),
        ('鸡肉冷冻保存温度是多少', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '冷冻温度'),
        ('酸奶发酵需要什么条件', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '发酵条件'),
        ('牛肉加工有什么标准', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '加工标准'),
        ('冷链运输温度要求是什么', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '冷链要求'),
        ('食品添加剂使用标准', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '添加剂标准'),
        ('防腐剂最大使用量', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '防腐剂限量'),
        ('巴氏杀菌的温度和时间', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '杀菌标准'),
    ]),
    'A2': ('咨询-食品安全/检测', [
        ('大肠杆菌超标的原因和预防措施', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '大肠杆菌'),
        ('沙门氏菌怎么预防', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '沙门氏菌'),
        ('黄曲霉毒素是什么', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '黄曲霉'),
        ('农药残留检测方法', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '农残检测'),
        ('重金属超标危害', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '重金属危害'),
        ('食品过敏原标识要求', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '过敏原'),
        ('亚硝酸盐中毒怎么急救', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '亚硝酸盐'),
        ('兽药残留限量标准', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '兽药残留'),
    ]),
    'A3': ('咨询-生产工艺知识', [
        ('火腿肠生产工艺流程', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '工艺流程'),
        ('豆腐生产注意事项', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '生产注意'),
        ('速冻食品解冻注意事项', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '解冻注意'),
        ('肉制品加工卫生要求', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '卫生要求'),
        ('食品保鲜技术有哪些', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '保鲜技术'),
        ('食品包装材料安全标准', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '包装标准'),
        ('生产牛肉有什么要注意的吗', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '生产注意'),
        ('牛肉怎么保鲜时间最长', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '保鲜方法'),
    ]),

    # ====== B: 查询 (Data Query) ======
    'B1': ('查询-仓库/库存', [
        ('仓库猪肉库存有多少', 'QUERY', 'REPORT_INVENTORY|MATERIAL_BATCH_QUERY', '库存查询'),
        ('今天入库了多少鸡肉', 'QUERY', 'MATERIAL_BATCH_QUERY|INBOUND_RECORD_QUERY', '入库查询'),
        ('牛肉批次还有多少库存', 'QUERY', 'MATERIAL_BATCH_QUERY', '批次库存'),
        ('库房里还剩多少猪肉', 'QUERY', 'MATERIAL_BATCH_QUERY', '剩余库存'),
        ('本月入库总量是多少', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY', '入库统计'),
        ('本月猪肉入库总量', 'QUERY', 'MATERIAL_BATCH_QUERY', '猪肉入库'),
        ('猪肉还有没有', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY', '口语化库存'),
        ('仓库满了吗', 'QUERY', 'REPORT_INVENTORY|MATERIAL_BATCH_QUERY', '口语化仓库'),
    ]),
    'B2': ('查询-生产', [
        ('查看今天的生产批次', 'QUERY', 'PROCESSING_BATCH_LIST', '今日批次'),
        ('查看豆腐的生产批次', 'QUERY', 'PROCESSING_BATCH_LIST', '豆腐批次'),
        ('今天牛肉批次生产了多少', 'QUERY', 'PROCESSING_BATCH_LIST|PRODUCTION_STATUS_QUERY', '牛肉产量'),
        ('A车间今天的产量', 'QUERY', 'PRODUCTION_STATUS_QUERY|PROCESSING_BATCH_LIST', '车间产量'),
        ('已完成的生产批次', 'QUERY', 'PROCESSING_BATCH_LIST', '完成批次'),
        ('上周生产了多少批次的牛肉产品', 'QUERY', 'PROCESSING_BATCH_LIST', '上周产量'),
        ('产量咋样', 'QUERY', 'REPORT_PRODUCTION|PROCESSING_BATCH_LIST', '口语化产量'),
        ('月度生产报表', 'QUERY', 'REPORT_PRODUCTION', '生产报表'),
    ]),
    'B3': ('查询-订单', [
        ('查看所有订单', 'QUERY', 'ORDER_LIST', '订单列表'),
        ('逾期未完成的订单', 'QUERY', 'ORDER_LIST|ORDER_TIMEOUT_MONITOR', '逾期订单'),
        ('未发货的订单有哪些', 'QUERY', 'ORDER_LIST', '未发货订单'),
        ('已发货但未签收的订单', 'QUERY', 'ORDER_LIST', '已发货未签收'),
        ('有没有逾期的', 'QUERY', 'ORDER_LIST|ORDER_TIMEOUT_MONITOR', '口语化逾期'),
        ('发了多少货', 'QUERY', 'ORDER_LIST', '口语化发货'),
        ('有啥新订单', 'QUERY', 'ORDER_LIST', '口语化新订单'),
        ('本月采购订单总额', 'QUERY', 'PROCUREMENT_LIST|PROCUREMENT_STATS|ORDER_LIST|REPORT_KPI', '采购总额'),
    ]),
    'B4': ('查询-质检', [
        ('最近的质检报告', 'QUERY', 'QUALITY_CHECK_QUERY|QUALITY_BATCH_REPORT', '质检报告'),
        ('没有通过质检的批次', 'QUERY', 'QUALITY_CHECK_QUERY', '不合格批次'),
        ('不合格产品清单', 'QUERY', 'QUALITY_CHECK_QUERY', '不合格清单'),
        ('上周质检不合格批次', 'QUERY', 'QUALITY_STATS|QUALITY_CHECK_QUERY', '上周质检'),
        ('今天鸡肉批次的质检结果', 'QUERY', 'QUALITY_CHECK_QUERY', '鸡肉质检'),
        ('过期未处理的质检报告', 'QUERY', 'QUALITY_CHECK_QUERY', '过期报告'),
        ('质检咋样了', 'QUERY', 'QUALITY_CHECK_QUERY', '口语化质检'),
    ]),
    'B5': ('查询-考勤/HR', [
        ('查看考勤记录', 'QUERY', 'ATTENDANCE_HISTORY|ATTENDANCE_RECORD', '考勤记录'),
        ('今天出勤率多少', 'QUERY', 'ATTENDANCE_STATS|ATTENDANCE_TODAY|REPORT_KPI', '出勤率'),
        ('张三这个月请了几天假', 'QUERY', 'ATTENDANCE_STATS|ATTENDANCE_HISTORY', '请假查询'),
        ('李四的考勤记录', 'QUERY', 'ATTENDANCE_HISTORY|ATTENDANCE_RECORD', '个人考勤'),
        ('赵六今天到岗了吗', 'QUERY', 'ATTENDANCE_STATS|ATTENDANCE_TODAY', '到岗查询'),
        ('昨天夜班出勤人数', 'QUERY', 'ATTENDANCE_TODAY|ATTENDANCE_STATS', '夜班出勤'),
        ('查看张三的绩效', 'QUERY', 'REPORT_KPI|HR_PERFORMANCE', '绩效查询'),
        ('今儿谁没来', 'QUERY', 'ATTENDANCE_TODAY|ATTENDANCE_STATS', '口语化考勤'),
    ]),
    'B6': ('查询-设备', [
        ('设备运行状态', 'QUERY', 'EQUIPMENT_STATUS_QUERY', '设备状态'),
        ('二号产线设备运行状态', 'QUERY', 'EQUIPMENT_STATUS_QUERY', '产线设备'),
        ('三号冷库温度记录', 'QUERY', 'COLD_CHAIN_TEMPERATURE', '冷库温度'),
        ('本周设备报警记录', 'QUERY', 'ALERT_LIST|EQUIPMENT_ALERT_LIST', '设备报警'),
        ('当前在线设备数量', 'QUERY', 'EQUIPMENT_STATUS_QUERY|EQUIPMENT_STATS|EQUIPMENT_LIST', '在线设备'),
        ('设备坏了没', 'QUERY', 'EQUIPMENT_STATUS_QUERY|ALERT_LIST', '口语化设备'),
    ]),
    'B7': ('查询-销售/财务/统计', [
        ('销量前五的产品是哪些', 'QUERY', 'SALES_RANKING|REPORT_KPI|SALES_STATS', '销量排名'),
        ('上个月销售额是多少', 'QUERY', 'REPORT_KPI|SALES_STATS', '月销售额'),
        ('哪个产品卖得最好', 'QUERY', 'REPORT_KPI|SALES_RANKING', '最佳产品'),
        ('本季度利润统计', 'QUERY', 'REPORT_KPI|FINANCE_STATS', '利润统计'),
        ('今年的退货率是多少', 'QUERY', 'REPORT_KPI|QUALITY_STATS', '退货率'),
        ('本月营收目标完成率', 'QUERY', 'REPORT_KPI|SALES_STATS|FINANCE_STATS', '营收完成率'),
        ('客户满意度统计', 'QUERY', 'CUSTOMER_STATS|REPORT_KPI', '客户满意度'),
    ]),

    # ====== C: 写入 (Write Operations) ======
    'C1': ('写入-创建操作', [
        ('创建一个新的牛肉批次', 'WRITE', 'PROCESSING_BATCH_CREATE', '创建批次'),
        ('新建一条猪肉的入库记录', 'WRITE', 'MATERIAL_BATCH_CREATE', '新建入库'),
        ('添加一个新的生产批次', 'WRITE', 'PROCESSING_BATCH_CREATE', '添加批次'),
        ('录入今天的鸡肉入库信息', 'WRITE', 'MATERIAL_BATCH_CREATE', '录入入库'),
        ('帮我创建一个订单', 'WRITE', 'ORDER_CREATE|ORDER_NEW', '创建订单'),
        ('新增一条物料入库记录', 'WRITE', 'MATERIAL_BATCH_CREATE', '新增入库'),
        ('登记一批新的原材料', 'WRITE', 'MATERIAL_BATCH_CREATE', '登记原料'),
        ('生成一个发货单', 'WRITE', 'SHIPMENT_CREATE|ORDER_CREATE', '创建发货'),
    ]),
    'C2': ('写入-状态更新/打卡', [
        ('帮我打卡', 'WRITE', 'CLOCK_IN', '打卡签到'),
        ('我要签到', 'WRITE', 'CLOCK_IN', '签到'),
        ('上班打卡', 'WRITE', 'CLOCK_IN', '上班打卡'),
        ('下班签退', 'WRITE', 'CLOCK_IN|CLOCK_OUT', '签退'),
    ]),

    # ====== B8: 查询 - 跨域/复合查询 ======
    'B8': ('查询-跨域复合', [
        ('今天各车间产量汇总', 'QUERY', 'REPORT_PRODUCTION|PROCESSING_BATCH_LIST|PRODUCTION_STATUS_QUERY', '跨车间汇总'),
        ('本周各部门出勤情况', 'QUERY', 'ATTENDANCE_STATS|ATTENDANCE_TODAY|REPORT_KPI', '跨部门考勤'),
        ('原材料进出库明细', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY', '进出库明细'),
        ('各产品线质检合格率对比', 'QUERY', 'QUALITY_STATS|REPORT_KPI', '质检对比'),
        ('上月各客户下单金额排名', 'QUERY', 'CUSTOMER_RANKING|SALES_RANKING|REPORT_KPI|CUSTOMER_STATS', '客户排名'),
        ('设备故障次数统计', 'QUERY', 'EQUIPMENT_STATS|ALERT_LIST|REPORT_KPI', '故障统计'),
    ]),

    # ====== C3: 写入 - 更多动词模式 ======
    'C3': ('写入-更多动词模式', [
        ('建一个新批次', 'WRITE', 'PROCESSING_BATCH_CREATE|MATERIAL_BATCH_CREATE', '建=创建'),
        ('补录一条入库记录', 'WRITE', 'MATERIAL_BATCH_CREATE', '补录=创建'),
        ('下一个采购单', 'WRITE', 'ORDER_NEW|ORDER_CREATE|PROCESSING_BATCH_CREATE', '下单=创建'),
        ('更新订单发货地址', 'WRITE', 'ORDER_UPDATE|ORDER_MODIFY', '更新=修改'),
        ('签到打卡', 'WRITE', 'CLOCK_IN', '签到=打卡'),
        ('开始新的生产任务', 'WRITE', 'PROCESSING_BATCH_CREATE|PROCESSING_BATCH_START', '开始=创建'),
    ]),

    # ====== D: 边界/混淆 Cases ======
    'D1': ('边界-咨询vs查询', [
        ('猪肉检测了哪些项目', 'CONSULT|QUERY', 'FOOD_KNOWLEDGE_QUERY|QUALITY_CHECK_QUERY', '检测项vs检测结果'),
        ('牛肉的冷藏温度是多少度', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '标准温度(知识)'),
        ('冷库里的猪肉还能放多久', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '保质期(知识)'),
        ('鸡肉加工车间温度要求', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '车间温度要求(知识)'),
        ('猪肉批次的检测报告', 'QUERY', 'QUALITY_CHECK_QUERY|QUALITY_BATCH_REPORT|REPORT_QUALITY', '检测报告(数据)'),
        ('牛肉的出厂检验标准', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY|QUALITY_CHECK_QUERY', '检验标准(知识)'),
    ]),
    'D2': ('边界-查询vs写入', [
        ('查看生产批次', 'QUERY', 'PROCESSING_BATCH_LIST', '查看=查询'),
        ('创建生产批次', 'WRITE', 'PROCESSING_BATCH_CREATE', '创建=写入'),
        ('查询库存', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY', '查询=查询'),
        ('录入库存', 'WRITE', 'MATERIAL_BATCH_CREATE', '录入=写入'),
        ('查看订单', 'QUERY', 'ORDER_LIST', '查看=查询'),
        ('修改订单状态', 'WRITE', 'ORDER_UPDATE|ORDER_MODIFY', '修改=写入'),
        ('查看考勤', 'QUERY', 'ATTENDANCE_HISTORY|ATTENDANCE_RECORD', '查看=查询'),
        ('我要打卡', 'WRITE', 'CLOCK_IN', '打卡=写入'),
    ]),
    'D3': ('边界-口语化/极短输入', [
        ('牛肉', 'CONSULT|QUERY', 'FOOD_KNOWLEDGE_QUERY|MATERIAL_BATCH_QUERY', '单名词-食品'),
        ('订单', 'QUERY', 'ORDER_LIST', '单名词-订单'),
        ('质检', 'QUERY', 'QUALITY_CHECK_QUERY', '单名词-质检'),
        ('库存', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY', '单名词-库存'),
        ('看看订单', 'QUERY', 'ORDER_LIST', '口语-看看'),
        ('打卡', 'WRITE', 'CLOCK_IN', '口语-打卡'),
        ('查一下设备', 'QUERY', 'EQUIPMENT_STATUS_QUERY|EQUIPMENT_LIST', '口语-查一下'),
        ('最近质检怎么样', 'QUERY', 'QUALITY_CHECK_QUERY|QUALITY_STATS', '口语-怎么样'),
    ]),
    'D4': ('边界-咨询vs查询深层混淆', [
        ('鸡肉为什么会变色', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '变色原因(知识)'),
        ('鸡肉入库颜色异常', 'QUERY', 'QUALITY_CHECK_QUERY|MATERIAL_BATCH_QUERY|ALERT_LIST', '异常(数据)'),
        ('猪肉保鲜方法有哪些', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '保鲜方法(知识)'),
        ('猪肉冷库温度异常', 'QUERY', 'COLD_CHAIN_TEMPERATURE|ALERT_LIST|EQUIPMENT_STATUS_QUERY', '温度异常(数据)'),
        ('食品安全法对添加剂的规定', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '法规(知识)'),
        ('添加剂检测结果', 'QUERY', 'QUALITY_CHECK_QUERY', '检测结果(数据)'),
        ('如何防止肉类变质', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '防变质(知识)'),
        ('变质原材料处理记录', 'QUERY', 'QUALITY_CHECK_QUERY|MATERIAL_BATCH_QUERY', '处理记录(数据)'),
    ]),
    'D5': ('边界-查询vs写入深层混淆', [
        ('批次完成了', 'QUERY|WRITE', 'PROCESSING_BATCH_LIST|PROCESSING_BATCH_COMPLETE', '完成-歧义'),
        ('订单取消', 'WRITE', 'ORDER_UPDATE|ORDER_DELETE|ORDER_MODIFY', '取消=写入'),
        ('查看库存不足的原材料', 'QUERY', 'MATERIAL_BATCH_QUERY|MATERIAL_LOW_STOCK_ALERT|REPORT_INVENTORY', '库存不足=查询'),
        ('暂停生产线', 'WRITE', 'PROCESSING_BATCH_PAUSE|EQUIPMENT_STATUS_QUERY', '暂停=写入'),
        ('恢复生产', 'WRITE', 'PROCESSING_BATCH_RESUME|PROCESSING_BATCH_START', '恢复=写入'),
        ('确认发货', 'WRITE', 'SHIPMENT_CREATE|ORDER_UPDATE', '确认=写入'),
    ]),
    'D6': ('边界-长句/多意图', [
        ('查看一下最近猪肉入库情况然后看看质检结果', 'QUERY', 'MATERIAL_BATCH_QUERY|QUALITY_CHECK_QUERY|REPORT_INVENTORY', '多意图-入库+质检'),
        ('帮我查查上周的牛肉生产数据', 'QUERY', 'PROCESSING_BATCH_LIST|PRODUCTION_STATUS_QUERY|REPORT_PRODUCTION', '口语长句-生产'),
        ('看看仓库的存货够不够这周用的', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY', '口语长句-库存'),
        ('请问一下牛肉解冻后能保存多长时间', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '礼貌长句-知识'),
        ('我想知道食品防腐剂对人体有什么影响', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '我想知道-知识'),
        ('跟我说说最近的销售情况和客户反馈', 'QUERY', 'SALES_STATS|REPORT_KPI|CUSTOMER_STATS|REPORT_DASHBOARD_OVERVIEW', '口语长句-销售'),
    ]),

    # ====== E: 新增查询领域 ======
    'E1': ('查询-供应商', [
        ('供应商列表', 'QUERY', 'SUPPLIER_LIST|SUPPLIER_SEARCH', '供应商列表'),
        ('查看供应商评分', 'QUERY', 'SUPPLIER_RANKING|SUPPLIER_EVALUATE', '供应商评分'),
        ('哪个供应商交货最准时', 'QUERY', 'SUPPLIER_RANKING|SUPPLIER_EVALUATE', '交货准时率'),
        ('各供应商价格对比', 'QUERY', 'SUPPLIER_PRICE_COMPARISON|SUPPLIER_RANKING|SUPPLIER_EVALUATE', '价格对比'),
        ('找一下猪肉的供应商', 'QUERY', 'SUPPLIER_SEARCH|SUPPLIER_LIST', '搜索供应商'),
        ('供应商表现怎样', 'QUERY', 'SUPPLIER_RANKING|SUPPLIER_EVALUATE|SUPPLIER_LIST|SUPPLIER_SEARCH', '供应商表现'),
    ]),
    'E2': ('查询-发货/物流', [
        ('最近的发货记录', 'QUERY', 'SHIPMENT_QUERY|SHIPMENT_STATS|ORDER_LIST', '发货记录'),
        ('今天有几单发货', 'QUERY', 'SHIPMENT_QUERY|SHIPMENT_STATS|ORDER_LIST|SHIPMENT_CREATE', '今日发货'),
        ('查看物流信息', 'QUERY', 'SHIPMENT_QUERY|ORDER_LIST', '物流信息'),
        ('上周发货统计', 'QUERY', 'SHIPMENT_STATS|SHIPMENT_QUERY|REPORT_KPI', '发货统计'),
        ('张三负责的发货单', 'QUERY', 'SHIPMENT_QUERY|ORDER_LIST|SHIPMENT_BY_CUSTOMER', '个人发货'),
        ('待发货的订单', 'QUERY', 'ORDER_LIST|SHIPMENT_QUERY', '待发货'),
    ]),
    'E3': ('查询-报表/分析', [
        ('今日工厂总览', 'QUERY', 'REPORT_DASHBOARD_OVERVIEW|REPORT_KPI', '总览报表'),
        ('本周生产报表', 'QUERY', 'REPORT_PRODUCTION|REPORT_PRODUCTION_WEEKLY_COMPARISON', '周报表'),
        ('质量报告', 'QUERY', 'REPORT_QUALITY|QUALITY_STATS', '质量报告'),
        ('财务报表', 'QUERY', 'REPORT_FINANCE|REPORT_KPI', '财务报表'),
        ('昨天的数据汇总', 'QUERY', 'REPORT_DASHBOARD_OVERVIEW|REPORT_KPI|REPORT_EXECUTIVE_DAILY', '每日汇总'),
        ('给我看看整体经营数据', 'QUERY', 'REPORT_DASHBOARD_OVERVIEW|REPORT_KPI', '经营数据'),
    ]),
    'E4': ('查询-告警/预警', [
        ('当前有哪些告警', 'QUERY', 'ALERT_LIST|ALERT_ACTIVE|EQUIPMENT_ALERT_LIST', '告警列表'),
        ('活跃的告警', 'QUERY', 'ALERT_ACTIVE|ALERT_LIST', '活跃告警'),
        ('本月告警统计', 'QUERY', 'ALERT_STATS|ALERT_LIST', '告警统计'),
        ('库存不足的原料有哪些', 'QUERY', 'MATERIAL_LOW_STOCK_ALERT|MATERIAL_BATCH_QUERY|REPORT_INVENTORY', '库存告警'),
        ('快过期的原材料', 'QUERY', 'MATERIAL_EXPIRING_ALERT|MATERIAL_EXPIRED_QUERY|MATERIAL_BATCH_QUERY', '过期预警'),
        ('冷库温度告警', 'QUERY', 'COLD_CHAIN_TEMPERATURE|ALERT_LIST|EQUIPMENT_ALERT_LIST|ALERT_ACTIVE', '温度告警'),
    ]),
    'E5': ('查询-溯源/追溯', [
        ('查看这个批次的溯源信息', 'QUERY', 'TRACE_BATCH|TRACE_FULL|PROCESSING_BATCH_DETAIL', '批次溯源'),
        ('溯源码查询', 'QUERY', 'TRACE_PUBLIC|TRACE_BATCH', '溯源码'),
        ('猪肉批次MB001的来源', 'QUERY', 'TRACE_BATCH|MATERIAL_BATCH_QUERY|PROCESSING_BATCH_DETAIL|BATCH_AUTO_LOOKUP', '批次来源'),
        ('这批牛肉从哪里来的', 'QUERY', 'TRACE_BATCH|MATERIAL_BATCH_QUERY|SHIPMENT_QUERY', '来源追溯'),
    ]),
    'E6': ('查询-排班/调度', [
        ('明天的排班表', 'QUERY', 'SCHEDULING_LIST|SCHEDULING_COVERAGE_QUERY', '排班查询'),
        ('本周排班情况', 'QUERY', 'SCHEDULING_LIST|SCHEDULING_COVERAGE_QUERY', '周排班'),
        ('哪条产线还没排班', 'QUERY', 'SCHEDULING_LIST|SCHEDULING_COVERAGE_QUERY', '产线排班'),
    ]),
    'E7': ('查询-客户/CRM', [
        ('客户列表', 'QUERY', 'CUSTOMER_LIST|CUSTOMER_SEARCH', '客户列表'),
        ('查看张三的历史采购记录', 'QUERY', 'CUSTOMER_PURCHASE_HISTORY|CUSTOMER_STATS|ORDER_LIST', '客户历史'),
        ('活跃客户有哪些', 'QUERY', 'CUSTOMER_ACTIVE|CUSTOMER_LIST|CUSTOMER_STATS', '活跃客户'),
        ('搜索客户王总', 'QUERY', 'CUSTOMER_SEARCH|CUSTOMER_LIST|CUSTOMER_STATS', '客户搜索'),
        ('本月新增客户数量', 'QUERY', 'CUSTOMER_STATS|CUSTOMER_LIST|REPORT_KPI', '新增客户'),
    ]),

    # ====== F: 更多写入操作 ======
    'F1': ('写入-状态更新', [
        ('订单已发货', 'WRITE', 'ORDER_UPDATE|SHIPMENT_STATUS_UPDATE|SHIPMENT_CREATE', '发货状态'),
        ('批次生产完成', 'WRITE', 'PROCESSING_BATCH_COMPLETE', '完成批次'),
        ('标记这个批次为已检验', 'WRITE', 'QUALITY_CHECK_CREATE|QUALITY_CHECK_EXECUTE|BATCH_UPDATE', '标记已检'),
        ('启动A产线', 'WRITE', 'EQUIPMENT_START|PROCESSING_BATCH_START|EQUIPMENT_STATUS_UPDATE', '启动产线'),
        ('停止B产线设备', 'WRITE', 'EQUIPMENT_STOP|PROCESSING_BATCH_PAUSE', '停止设备'),
    ]),
    'F2': ('写入-删除/取消', [
        ('删除这个订单', 'WRITE', 'ORDER_DELETE', '删除订单'),
        ('取消这个生产批次', 'WRITE', 'PROCESSING_BATCH_CANCEL|PROCESSING_BATCH_PAUSE', '取消批次'),
        ('删除发货单', 'WRITE', 'SHIPMENT_DELETE|ORDER_DELETE', '删除发货'),
    ]),
    'F3': ('写入-告警操作', [
        ('确认告警', 'WRITE', 'ALERT_ACKNOWLEDGE', '确认告警'),
        ('解决这个告警', 'WRITE', 'ALERT_RESOLVE|ALERT_ACKNOWLEDGE', '解决告警'),
        ('处理掉这个告警', 'WRITE', 'ALERT_ACKNOWLEDGE|ALERT_RESOLVE', '处理告警'),
    ]),

    # ====== G: 更多边界测试 ======
    'G1': ('边界-时间限定查询', [
        ('上周的订单', 'QUERY', 'ORDER_LIST', '上周订单'),
        ('去年同期产量', 'QUERY', 'REPORT_PRODUCTION|PRODUCTION_STATUS_QUERY|REPORT_PRODUCTION_WEEKLY_COMPARISON', '去年产量'),
        ('三月份的入库记录', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY', '月份入库'),
        ('过去七天的质检情况', 'QUERY', 'QUALITY_CHECK_QUERY|QUALITY_STATS', '七天质检'),
        ('今天到目前为止生产了多少', 'QUERY', 'PROCESSING_BATCH_LIST|PRODUCTION_STATUS_QUERY|REPORT_PRODUCTION', '截至现在'),
    ]),
    'G2': ('边界-否定/条件模式', [
        ('除了牛肉还有什么库存', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY', '排除条件'),
        ('不合格的批次有几个', 'QUERY', 'QUALITY_CHECK_QUERY|QUALITY_STATS', '不合格统计'),
        ('没有分配的生产任务', 'QUERY', 'PROCESSING_BATCH_LIST|SCHEDULING_LIST', '未分配'),
        ('还没打卡的人有谁', 'QUERY', 'ATTENDANCE_TODAY|ATTENDANCE_ANOMALY|ATTENDANCE_STATS', '未打卡'),
    ]),
    'G3': ('边界-方言/口语变体', [
        ('帮我瞅瞅仓库', 'QUERY', 'REPORT_INVENTORY|MATERIAL_BATCH_QUERY|WAREHOUSE_INVENTORY_CHECK', '瞅瞅=看看'),
        ('弄个新订单', 'WRITE', 'ORDER_NEW|ORDER_CREATE', '弄=创建'),
        ('给我整一个生产批次', 'WRITE', 'PROCESSING_BATCH_CREATE', '整=创建'),
        ('看一眼设备', 'QUERY', 'EQUIPMENT_STATUS_QUERY|EQUIPMENT_LIST', '看一眼'),
        ('帮我查查考勤', 'QUERY', 'ATTENDANCE_HISTORY|ATTENDANCE_STATS|ATTENDANCE_TODAY', '查查=查询'),
    ]),
    'G4': ('边界-更多极短输入', [
        ('发货', 'QUERY|WRITE', 'SHIPMENT_QUERY|SHIPMENT_CREATE|ORDER_LIST|SHIPMENT_STATS', '极短-发货'),
        ('报表', 'QUERY', 'REPORT_KPI|REPORT_DASHBOARD_OVERVIEW|REPORT_PRODUCTION', '极短-报表'),
        ('告警', 'QUERY', 'ALERT_LIST|ALERT_ACTIVE', '极短-告警'),
        ('供应商', 'QUERY', 'SUPPLIER_LIST|SUPPLIER_SEARCH', '极短-供应商'),
        ('排班', 'QUERY', 'SCHEDULING_LIST|SCHEDULING_COVERAGE_QUERY', '极短-排班'),
    ]),

    # ====== H: 财务/成本/利润 ======
    'H1': ('查询-财务成本', [
        ('本月成本分析', 'QUERY', 'COST_TREND_ANALYSIS|COST_QUERY|REPORT_FINANCE', '成本分析'),
        ('原料成本趋势', 'QUERY', 'COST_TREND_ANALYSIS|COST_QUERY', '成本趋势'),
        ('查看财务指标', 'QUERY', 'FINANCE_STATS|REPORT_FINANCE|REPORT_KPI', '财务指标'),
        ('利润趋势分析', 'QUERY', 'REPORT_TRENDS|REPORT_KPI|REPORT_FINANCE|COST_TREND_ANALYSIS', '利润趋势'),
        ('毛利率是多少', 'QUERY', 'REPORT_KPI|FINANCE_STATS|REPORT_FINANCE', '毛利率'),
        ('本季度财务概况', 'QUERY', 'REPORT_FINANCE|FINANCE_STATS|REPORT_KPI', '财务概况'),
    ]),
    'H2': ('查询-财务深层', [
        ('资产收益率', 'QUERY', 'QUERY_FINANCE_ROA|FINANCE_STATS|REPORT_KPI|REPORT_FINANCE', 'ROA'),
        ('净资产回报率', 'QUERY', 'QUERY_FINANCE_ROE|FINANCE_STATS|REPORT_KPI|REPORT_FINANCE', 'ROE'),
        ('流动比率查询', 'QUERY', 'QUERY_LIQUIDITY|FINANCE_STATS|REPORT_FINANCE', '流动比率'),
        ('偿债能力分析', 'QUERY', 'QUERY_SOLVENCY|FINANCE_STATS|REPORT_FINANCE', '偿债能力'),
        ('杜邦分析', 'QUERY', 'QUERY_DUPONT_ANALYSIS|REPORT_KPI|FINANCE_STATS', '杜邦'),
        ('经营效益概览', 'QUERY', 'REPORT_BENEFIT_OVERVIEW|REPORT_KPI|REPORT_DASHBOARD_OVERVIEW|REPORT_FINANCE', '效益概览'),
    ]),

    # ====== H3-H4: 人员/HR 深层 ======
    'H3': ('查询-HR深层', [
        ('在线员工数量', 'QUERY', 'QUERY_ONLINE_STAFF_COUNT|ATTENDANCE_STATS|ATTENDANCE_TODAY|REPORT_KPI', '在线人数'),
        ('查看员工资料', 'QUERY', 'QUERY_EMPLOYEE_PROFILE|EMPLOYEE_DETAIL|ATTENDANCE_HISTORY|REPORT_DASHBOARD_OVERVIEW', '员工资料'),
        ('张三的工资是多少', 'QUERY', 'QUERY_EMPLOYEE_PROFILE|EMPLOYEE_DETAIL|HR_PERFORMANCE|REPORT_KPI', '工资查询'),
        ('部门考勤统计', 'QUERY', 'ATTENDANCE_STATS_BY_DEPT|ATTENDANCE_DEPARTMENT|ATTENDANCE_STATS', '部门考勤'),
        ('月度考勤汇总', 'QUERY', 'ATTENDANCE_MONTHLY|ATTENDANCE_STATS', '月考勤'),
        ('异常考勤列表', 'QUERY', 'ATTENDANCE_ANOMALY|ATTENDANCE_STATS|ALERT_LIST', '异常考勤'),
    ]),
    'H4': ('写入-HR操作', [
        ('帮我请假', 'QUERY|WRITE', 'CLOCK_OUT|ATTENDANCE_STATS|ATTENDANCE_HISTORY', '请假'),
        ('批准王五的请假申请', 'QUERY|WRITE', 'ORDER_UPDATE|ORDER_APPROVAL|CLOCK_IN|ATTENDANCE_STATS', '批假,审批override'),
        ('删除员工李四', 'WRITE', 'HR_DELETE_EMPLOYEE|USER_DELETE|PROCESSING_WORKER_ASSIGN', '删员工'),
        ('分配任务给张三', 'WRITE', 'TASK_ASSIGN_WORKER|PROCESSING_WORKER_ASSIGN', '分配任务'),
    ]),

    # ====== H5-H6: 库存/物料深层 ======
    'H5': ('查询-库存深层', [
        ('库存总量统计', 'QUERY', 'INVENTORY_SUMMARY_QUERY|INVENTORY_TOTAL_QUERY|QUERY_INVENTORY_TOTAL|REPORT_INVENTORY', '库存总量'),
        ('原料库存摘要', 'QUERY', 'QUERY_MATERIAL_STOCK_SUMMARY|REPORT_INVENTORY|MATERIAL_BATCH_QUERY', '库存摘要'),
        ('低库存预警列表', 'QUERY', 'MATERIAL_LOW_STOCK_ALERT|REPORT_INVENTORY|MATERIAL_BATCH_QUERY', '低库存'),
        ('即将过期的原材料', 'QUERY', 'MATERIAL_EXPIRING_ALERT|MATERIAL_EXPIRED_QUERY|MATERIAL_BATCH_QUERY', '临期原料'),
        ('先进先出推荐', 'QUERY', 'MATERIAL_FIFO_RECOMMEND|MATERIAL_BATCH_QUERY', 'FIFO推荐'),
        ('猪肉库存够用几天', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|INVENTORY_SUMMARY_QUERY', '库存天数'),
    ]),
    'H6': ('写入-库存操作', [
        ('消耗一批猪肉原料', 'WRITE', 'MATERIAL_BATCH_CONSUME|MATERIAL_ADJUST_QUANTITY|MATERIAL_UPDATE', '消耗物料'),
        ('释放预留的牛肉批次', 'WRITE', 'MATERIAL_BATCH_RELEASE|MATERIAL_UPDATE', '释放预留'),
        ('预留100kg鸡肉', 'WRITE', 'MATERIAL_BATCH_RESERVE|MATERIAL_UPDATE', '预留物料'),
        ('调整猪肉库存数量', 'WRITE', 'MATERIAL_ADJUST_QUANTITY|MATERIAL_BATCH_QUERY|MATERIAL_UPDATE', '调整库存'),
        ('出库100kg牛肉', 'WRITE', 'MATERIAL_BATCH_CONSUME|MATERIAL_ADJUST_QUANTITY|MATERIAL_UPDATE', '出库'),
    ]),

    # ====== H7-H8: 生产详情/工序 ======
    'H7': ('查询-生产详情', [
        ('批次时间线', 'QUERY', 'PROCESSING_BATCH_TIMELINE|PROCESSING_BATCH_DETAIL', '批次时间线'),
        ('这个批次谁在操作', 'QUERY', 'PROCESSING_BATCH_DETAIL|PROCESSING_BATCH_LIST', '批次工人'),
        ('当前工序是哪一步', 'QUERY', 'PROCESSING_BATCH_DETAIL|PROCESSING_BATCH_LIST|PRODUCTION_STATUS_QUERY', '当前工序'),
        ('生产进度查询', 'QUERY', 'TASK_PROGRESS_QUERY|PROCESSING_BATCH_LIST|PRODUCTION_STATUS_QUERY', '生产进度'),
        ('本周生产效率报告', 'QUERY', 'REPORT_EFFICIENCY|REPORT_PRODUCTION|REPORT_PRODUCTION_WEEKLY_COMPARISON', '效率报告'),
        ('车间日报', 'QUERY', 'REPORT_PRODUCTION|REPORT_DASHBOARD_OVERVIEW', '车间日报'),
    ]),
    'H8': ('写入-生产操作', [
        ('分配工人到A批次', 'WRITE', 'PROCESSING_WORKER_ASSIGN', '分配工人'),
        ('工人下线', 'QUERY|WRITE', 'CLOCK_OUT|PROCESSING_BATCH_COMPLETE|ATTENDANCE_HISTORY', '工人下线'),
        ('恢复暂停的批次', 'WRITE', 'PROCESSING_BATCH_RESUME|PROCESSING_BATCH_START', '恢复批次'),
        ('完成当前生产批次', 'WRITE', 'PROCESSING_BATCH_COMPLETE', '完成批次'),
        ('更新生产计划', 'WRITE', 'PLAN_UPDATE|PROCESSING_BATCH_CREATE|ORDER_UPDATE', '更新计划'),
    ]),

    # ====== I: 设备/电子秤/质量深层 ======
    'I1': ('查询-设备深层', [
        ('设备健康诊断', 'QUERY', 'EQUIPMENT_STATUS_QUERY|EQUIPMENT_DETAIL|EQUIPMENT_STATS', '健康诊断'),
        ('设备维护记录', 'QUERY', 'EQUIPMENT_MAINTENANCE|EQUIPMENT_DETAIL', '维护记录'),
        ('设备故障报告', 'QUERY', 'EQUIPMENT_STATUS_QUERY|EQUIPMENT_ALERT_LIST|EQUIPMENT_STATS|ALERT_LIST', '故障报告'),
        ('设备运行效率', 'QUERY', 'EQUIPMENT_STATS|REPORT_EFFICIENCY|REPORT_KPI', '运行效率'),
        ('按设备查看告警', 'QUERY', 'ALERT_BY_EQUIPMENT|EQUIPMENT_ALERT_LIST|ALERT_LIST', '按设备告警'),
        ('按级别查看告警', 'QUERY', 'ALERT_BY_LEVEL|ALERT_LIST|ALERT_STATS', '按级别告警'),
    ]),
    'I2': ('查询-质量深层', [
        ('质检关键项目清单', 'QUERY', 'QUALITY_CRITICAL_ITEMS|QUALITY_CHECK_QUERY', '关键项'),
        ('质量处置评估', 'QUERY', 'QUALITY_DISPOSITION_EVALUATE|QUALITY_CHECK_QUERY', '处置评估'),
        ('CCP监控数据', 'QUERY', 'QUALITY_CHECK_QUERY|QUALITY_STATS', 'CCP监控'),
        ('智能质量报告', 'QUERY', 'REPORT_QUALITY|QUALITY_STATS|QUALITY_CHECK_QUERY', '智能质检'),
        ('异常报告', 'QUERY', 'REPORT_ANOMALY|ALERT_LIST|QUALITY_CHECK_QUERY', '异常报告'),
    ]),
    'I3': ('查询-电子秤', [
        ('电子秤列表', 'QUERY', 'SCALE_LIST_DEVICES|EQUIPMENT_LIST', '秤列表'),
        ('查看电子秤详情', 'QUERY', 'SCALE_DEVICE_DETAIL|EQUIPMENT_DETAIL', '秤详情'),
        ('称重设备状态', 'QUERY', 'SCALE_LIST_DEVICES|EQUIPMENT_STATUS_QUERY', '称重状态'),
    ]),
    'I4': ('写入-设备/秤操作', [
        ('添加一台电子秤', 'WRITE', 'SCALE_ADD_DEVICE|EQUIPMENT_STATUS_UPDATE|SCALE_DEVICE_DETAIL', '添加秤'),
        ('删除电子秤设备', 'WRITE', 'SCALE_DELETE_DEVICE|SCALE_DEVICE_DETAIL', '删除秤'),
        ('更新电子秤配置', 'WRITE', 'SCALE_UPDATE_DEVICE|EQUIPMENT_STATUS_UPDATE|SCALE_DEVICE_DETAIL', '更新秤'),
        ('设备维护完成', 'WRITE', 'EQUIPMENT_STATUS_UPDATE|EQUIPMENT_START|EQUIPMENT_MAINTENANCE', '维护完成'),
    ]),

    # ====== J: 更多复合/对比/趋势 ======
    'J1': ('查询-对比分析', [
        ('本月和上月产量对比', 'QUERY', 'REPORT_PRODUCTION_WEEKLY_COMPARISON|REPORT_PRODUCTION|REPORT_KPI|REPORT_TRENDS', '月度对比'),
        ('鸡肉和猪肉的库存对比', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY', '库存对比'),
        ('A车间和B车间的效率对比', 'QUERY', 'REPORT_EFFICIENCY|REPORT_PRODUCTION|PRODUCTION_STATUS_QUERY', '车间效率对比'),
        ('今年跟去年的销售对比', 'QUERY', 'REPORT_TRENDS|REPORT_KPI|SALES_STATS', '年度销售对比'),
        ('各产品成本对比', 'QUERY', 'COST_QUERY|COST_TREND_ANALYSIS|REPORT_FINANCE', '成本对比'),
    ]),
    'J2': ('查询-趋势/走势', [
        ('库存变化趋势', 'QUERY', 'REPORT_TRENDS|REPORT_INVENTORY|MATERIAL_BATCH_QUERY', '库存趋势'),
        ('质检合格率走势', 'QUERY', 'REPORT_TRENDS|QUALITY_STATS|REPORT_QUALITY', '质检走势'),
        ('产量变化曲线', 'QUERY', 'REPORT_TRENDS|REPORT_PRODUCTION|PRODUCTION_STATUS_QUERY', '产量曲线'),
        ('设备故障率趋势', 'QUERY', 'REPORT_TRENDS|EQUIPMENT_STATS|EQUIPMENT_STATUS_QUERY|ALERT_LIST', '故障趋势'),
        ('订单量增长趋势', 'QUERY', 'REPORT_TRENDS|REPORT_KPI|ORDER_LIST|REPORT_DASHBOARD_OVERVIEW', '订单趋势'),
    ]),
    'J3': ('边界-复杂长句', [
        ('请帮我看一下上周五从早上八点到下午三点之间A车间的牛肉批次生产情况', 'QUERY', 'PROCESSING_BATCH_LIST|PRODUCTION_STATUS_QUERY|REPORT_PRODUCTION', '超长-生产'),
        ('我想知道本月所有供应商的猪肉交货及时率以及价格变化', 'QUERY', 'SUPPLIER_RANKING|SUPPLIER_EVALUATE|SUPPLIER_PRICE_COMPARISON|REPORT_KPI', '超长-供应商'),
        ('从上个月初到现在的每日出勤率统计以及迟到早退情况', 'QUERY', 'ATTENDANCE_STATS|ATTENDANCE_ANOMALY|ATTENDANCE_MONTHLY|ATTENDANCE_HISTORY|REPORT_KPI|REPORT_ANOMALY', '超长-考勤'),
        ('所有已完成但质检未通过需要返工的生产批次', 'QUERY', 'PROCESSING_BATCH_LIST|QUALITY_CHECK_QUERY|QUALITY_STATS', '超长-复合条件'),
    ]),
    'J4': ('边界-模糊/歧义输入', [
        ('情况怎么样', 'QUERY', 'REPORT_DASHBOARD_OVERVIEW|REPORT_KPI|PRODUCTION_STATUS_QUERY', '极度模糊'),
        ('有什么问题吗', 'QUERY', 'ALERT_LIST|ALERT_ACTIVE|REPORT_ANOMALY|QUALITY_CHECK_QUERY|REPORT_DASHBOARD_OVERVIEW', '模糊-问题'),
        ('帮我处理一下', 'QUERY|WRITE', 'ALERT_ACKNOWLEDGE|ALERT_RESOLVE|QUALITY_DISPOSITION_EXECUTE|TASK_PROGRESS_QUERY', '模糊-处理'),
        ('最新的情况', 'QUERY', 'REPORT_DASHBOARD_OVERVIEW|REPORT_KPI|ORDER_LIST|PROCESSING_BATCH_LIST', '模糊-最新'),
        ('还有什么要做的', 'QUERY', 'USER_TODO_LIST|TASK_PROGRESS_QUERY|ORDER_LIST|PROCESSING_BATCH_LIST|REPORT_DASHBOARD_OVERVIEW', '模糊-待办'),
    ]),

    # ====== K: 更多写入变体 ======
    'K1': ('写入-审批/流程', [
        ('审批这个采购订单', 'WRITE', 'ORDER_UPDATE|ORDER_LIST', '审批订单'),
        ('提交审批', 'WRITE', 'ORDER_UPDATE|ORDER_LIST', '提交审批'),
        ('查看审批记录', 'QUERY', 'ORDER_LIST|REPORT_DASHBOARD_OVERVIEW', '审批记录'),
    ]),
    'K2': ('写入-排班调度', [
        ('执行明天的排班', 'WRITE', 'SCHEDULING_SET_AUTO|SCHEDULING_LIST', '执行排班'),
        ('生成后天的排班计划', 'WRITE', 'SCHEDULING_SET_AUTO|SCHEDULING_LIST', '排班计划'),
        ('设置自动排班', 'WRITE', 'SCHEDULING_SET_AUTO|SCHEDULING_LIST', '自动排班'),
    ]),
    'K3': ('写入-质量操作', [
        ('执行质检', 'WRITE', 'QUALITY_CHECK_EXECUTE|QUALITY_CHECK_CREATE', '执行质检'),
        ('创建质检单', 'WRITE', 'QUALITY_CHECK_CREATE|QUALITY_CHECK_EXECUTE', '创建质检'),
        ('处置不合格品', 'WRITE', 'QUALITY_DISPOSITION_EXECUTE|QUALITY_CHECK_EXECUTE', '处置品'),
    ]),
    'K4': ('写入-供应商操作', [
        ('新增一个供应商', 'WRITE', 'SUPPLIER_CREATE|SUPPLIER_LIST', '新增供应商'),
        ('删除这个供应商', 'WRITE', 'SUPPLIER_DELETE|SUPPLIER_LIST', '删除供应商'),
        ('评价这个供应商', 'QUERY|WRITE', 'SUPPLIER_EVALUATE|SUPPLIER_RANKING|SUPPLIER_LIST', '评价供应商'),
    ]),

    # ====== L: 更多咨询 (食品知识扩展) ======
    'L1': ('咨询-法规标准', [
        ('GB 2760标准内容', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', 'GB标准'),
        ('HACCP体系要求', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', 'HACCP'),
        ('ISO 22000认证', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', 'ISO认证'),
        ('SC食品生产许可证办理流程', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', 'SC许可'),
        ('食品标签标识要求', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '标签标识'),
    ]),
    'L2': ('咨询-特定食品工艺', [
        ('酸奶的益生菌标准', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '益生菌'),
        ('腌腊肉制品工艺', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '腌腊肉'),
        ('水产品冷冻保存方法', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '水产冷冻'),
        ('面包烘焙温度控制', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '烘焙温度'),
        ('罐头食品杀菌工艺', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '罐头杀菌'),
    ]),

    # ====== M: 同义词/近义词变体 (Synonym Stress Test) ======
    'M1': ('同义词-库存查询变体', [
        ('还剩多少猪肉', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY', '剩多少=库存'),
        ('猪肉存货查询', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY', '存货=库存'),
        ('盘一下库存', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|WAREHOUSE_INVENTORY_CHECK', '盘=查询'),
        ('库房还有啥', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY', '口语-库房'),
        ('冷库存了些什么', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY', '冷库存货'),
    ]),
    'M2': ('同义词-生产查询变体', [
        ('今天做了多少', 'QUERY', 'PROCESSING_BATCH_LIST|PRODUCTION_STATUS_QUERY|REPORT_PRODUCTION', '做了=产量'),
        ('生产进展如何', 'QUERY', 'PROCESSING_BATCH_LIST|PRODUCTION_STATUS_QUERY|TASK_PROGRESS_QUERY', '进展=进度'),
        ('开工了几条线', 'QUERY', 'PROCESSING_BATCH_LIST|PRODUCTION_STATUS_QUERY|EQUIPMENT_STATUS_QUERY', '开工=运行'),
        ('产出情况', 'QUERY', 'REPORT_PRODUCTION|PROCESSING_BATCH_LIST|PRODUCTION_STATUS_QUERY', '产出=产量'),
        ('做完了没有', 'QUERY', 'PROCESSING_BATCH_LIST|TASK_PROGRESS_QUERY|PRODUCTION_STATUS_QUERY', '做完=完成'),
    ]),
    'M3': ('同义词-创建操作变体', [
        ('来一个新的牛肉批次', 'WRITE', 'PROCESSING_BATCH_CREATE|MATERIAL_BATCH_CREATE', '来=创建'),
        ('开一个猪肉入库单', 'WRITE', 'MATERIAL_BATCH_CREATE', '开=创建'),
        ('做一批新的生产单', 'WRITE', 'PROCESSING_BATCH_CREATE', '做=创建'),
        ('安排一批新的生产', 'WRITE', 'PROCESSING_BATCH_CREATE|PROCESSING_BATCH_START', '安排=创建'),
        ('上一个新批次', 'WRITE', 'PROCESSING_BATCH_CREATE|MATERIAL_BATCH_CREATE', '上=创建'),
    ]),
    'M4': ('同义词-告警查询变体', [
        ('哪里出了问题', 'QUERY', 'ALERT_LIST|ALERT_ACTIVE|REPORT_ANOMALY', '出问题=告警'),
        ('有没有异常', 'QUERY', 'ALERT_LIST|ALERT_ACTIVE|REPORT_ANOMALY', '异常=告警'),
        ('报警记录', 'QUERY', 'ALERT_LIST|EQUIPMENT_ALERT_LIST', '报警=告警'),
        ('警告信息', 'QUERY', 'ALERT_LIST|ALERT_ACTIVE', '警告=告警'),
        ('什么东西出毛病了', 'QUERY', 'ALERT_LIST|ALERT_ACTIVE|EQUIPMENT_STATUS_QUERY|REPORT_ANOMALY', '出毛病=告警'),
    ]),

    # ====== N: 数字/实体嵌入 (Number/Entity Embedding Stress) ======
    'N1': ('数字嵌入-库存操作', [
        ('入库200公斤牛肉', 'WRITE', 'MATERIAL_BATCH_CREATE|MATERIAL_ADJUST_QUANTITY', '数字+单位-入库'),
        ('出库50箱鸡肉', 'WRITE', 'MATERIAL_BATCH_CONSUME|MATERIAL_ADJUST_QUANTITY|MATERIAL_UPDATE', '数字+箱-出库'),
        ('预留300kg猪肉', 'WRITE', 'MATERIAL_BATCH_RESERVE|MATERIAL_UPDATE', '300kg-预留'),
        ('消耗80斤面粉', 'WRITE', 'MATERIAL_BATCH_CONSUME|MATERIAL_ADJUST_QUANTITY|MATERIAL_UPDATE', '80斤-消耗'),
        ('库存少于100公斤的原料', 'QUERY', 'MATERIAL_LOW_STOCK_ALERT|MATERIAL_BATCH_QUERY|REPORT_INVENTORY', '数字条件-查询'),
    ]),
    'N2': ('批次号嵌入-溯源查询', [
        ('查看批次B20240115', 'QUERY', 'PROCESSING_BATCH_DETAIL|PROCESSING_BATCH_LIST|BATCH_AUTO_LOOKUP', '批次号-查看'),
        ('批次PC-2024-001的详情', 'QUERY', 'PROCESSING_BATCH_DETAIL|PROCESSING_BATCH_LIST|BATCH_AUTO_LOOKUP', '批次号-详情'),
        ('牛肉批次RB003的检验结果', 'QUERY', 'QUALITY_CHECK_QUERY|QUALITY_BATCH_REPORT|PROCESSING_BATCH_DETAIL', '批次号-质检'),
        ('追溯MB002的原料来源', 'QUERY', 'TRACE_BATCH|MATERIAL_BATCH_QUERY|BATCH_AUTO_LOOKUP', '批次号-追溯'),
    ]),
    'N3': ('人名嵌入-HR查询', [
        ('李明的出勤记录', 'QUERY', 'ATTENDANCE_HISTORY|ATTENDANCE_RECORD', '人名-出勤'),
        ('王芳今天上班了吗', 'QUERY', 'ATTENDANCE_TODAY|ATTENDANCE_STATS', '人名-到岗'),
        ('赵刚的绩效评分', 'QUERY', 'HR_PERFORMANCE|REPORT_KPI', '人名-绩效'),
        ('把任务分配给刘伟', 'WRITE', 'TASK_ASSIGN_WORKER|PROCESSING_WORKER_ASSIGN', '人名-分配'),
        ('陈静负责的订单', 'QUERY', 'ORDER_LIST|SHIPMENT_QUERY', '人名-订单'),
    ]),

    # ====== O: 礼貌/间接请求 (Politeness/Indirectness) ======
    'O1': ('礼貌请求-查询', [
        ('麻烦帮我看一下库存', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY', '麻烦+查询'),
        ('请问现在设备运行正常吗', 'QUERY', 'EQUIPMENT_STATUS_QUERY|ALERT_LIST', '请问+设备'),
        ('能不能帮我查一下订单状态', 'QUERY', 'ORDER_LIST|ORDER_STATUS', '能不能+查'),
        ('您好，我想了解一下今天的产量', 'QUERY', 'PROCESSING_BATCH_LIST|PRODUCTION_STATUS_QUERY|REPORT_PRODUCTION', '您好+产量'),
        ('劳驾查一下猪肉入库情况', 'QUERY', 'MATERIAL_BATCH_QUERY|INBOUND_RECORD_QUERY', '劳驾+查询'),
    ]),
    'O2': ('礼貌请求-写入', [
        ('麻烦帮我创建一个批次', 'WRITE', 'PROCESSING_BATCH_CREATE|MATERIAL_BATCH_CREATE', '麻烦+创建'),
        ('请帮我打一下卡', 'WRITE', 'CLOCK_IN', '请+打卡'),
        ('拜托帮我录入一条入库记录', 'WRITE', 'MATERIAL_BATCH_CREATE', '拜托+录入'),
        ('能帮我下一个订单吗', 'WRITE', 'ORDER_CREATE|ORDER_NEW', '能帮+下单'),
    ]),
    'O3': ('间接表述-需求暗示', [
        ('猪肉快不够了', 'QUERY', 'MATERIAL_BATCH_QUERY|MATERIAL_LOW_STOCK_ALERT|REPORT_INVENTORY', '暗示-低库存'),
        ('设备好像有点问题', 'QUERY', 'EQUIPMENT_STATUS_QUERY|ALERT_LIST|ALERT_ACTIVE', '暗示-设备异常'),
        ('订单好像超时了', 'QUERY', 'ORDER_TIMEOUT_MONITOR|ORDER_LIST|ALERT_LIST', '暗示-超时'),
        ('冷库温度好像不太对', 'QUERY', 'COLD_CHAIN_TEMPERATURE|ALERT_LIST|EQUIPMENT_ALERT_LIST', '暗示-温度异常'),
        ('工人今天来的不太齐', 'QUERY', 'ATTENDANCE_TODAY|ATTENDANCE_STATS|ATTENDANCE_ANOMALY', '暗示-缺勤'),
    ]),

    # ====== P: 跨域混淆 (Cross-Domain Confusion) ======
    'P1': ('跨域-生产vs质量', [
        ('这批猪肉合格吗', 'QUERY', 'QUALITY_CHECK_QUERY|QUALITY_BATCH_REPORT', '合格-质量域'),
        ('生产批次质量报告', 'QUERY', 'QUALITY_BATCH_REPORT|QUALITY_CHECK_QUERY|REPORT_QUALITY', '跨-生产+质量'),
        ('在产批次的检验状态', 'QUERY', 'QUALITY_CHECK_QUERY|PROCESSING_BATCH_LIST', '跨-生产+检验'),
        ('不良品率', 'QUERY', 'QUALITY_STATS|REPORT_QUALITY|REPORT_KPI', '不良率-质量'),
    ]),
    'P2': ('跨域-设备vs告警', [
        ('设备异常了', 'QUERY', 'EQUIPMENT_STATUS_QUERY|ALERT_LIST|EQUIPMENT_ALERT_LIST|ALERT_ACTIVE', '设备+异常'),
        ('几号机器报警了', 'QUERY', 'ALERT_LIST|EQUIPMENT_ALERT_LIST|EQUIPMENT_STATUS_QUERY', '机器+报警'),
        ('产线故障', 'QUERY', 'EQUIPMENT_STATUS_QUERY|ALERT_LIST|EQUIPMENT_ALERT_LIST', '产线+故障'),
        ('消除设备报警', 'WRITE', 'ALERT_ACKNOWLEDGE|ALERT_RESOLVE|EQUIPMENT_ALERT_ACKNOWLEDGE', '消除+报警'),
    ]),
    'P3': ('跨域-库存vs采购', [
        ('原料不够了，需要采购', 'QUERY|WRITE', 'MATERIAL_LOW_STOCK_ALERT|PROCUREMENT_LIST|MATERIAL_BATCH_QUERY|ORDER_NEW', '库存+采购暗示'),
        ('采购的猪肉到了没', 'QUERY', 'MATERIAL_BATCH_QUERY|PROCUREMENT_LIST|ORDER_LIST', '采购+到货'),
        ('本月采购了多少猪肉', 'QUERY', 'PROCUREMENT_LIST|PROCUREMENT_STATS|MATERIAL_BATCH_QUERY|ORDER_LIST', '采购量查询'),
        ('供应商发货了没有', 'QUERY', 'SHIPMENT_QUERY|SUPPLIER_LIST|ORDER_LIST|PROCUREMENT_LIST', '供应商+发货'),
    ]),
    'P4': ('跨域-HR vs 生产', [
        ('车间人手够不够', 'QUERY', 'ATTENDANCE_TODAY|ATTENDANCE_STATS|SCHEDULING_LIST|SCHEDULING_COVERAGE_QUERY', '人手-HR+排班'),
        ('今天几个人在干活', 'QUERY', 'ATTENDANCE_TODAY|ATTENDANCE_STATS|QUERY_ONLINE_STAFF_COUNT', '干活-出勤'),
        ('夜班人员安排', 'QUERY', 'SCHEDULING_LIST|ATTENDANCE_TODAY|SCHEDULING_COVERAGE_QUERY', '夜班-排班'),
        ('加班申请', 'QUERY|WRITE', 'ATTENDANCE_STATS|ATTENDANCE_HISTORY|CLOCK_IN|SCHEDULING_LIST', '加班-HR'),
    ]),

    # ====== Q: 趋势/统计变体 (Statistics Stress) ======
    'Q1': ('统计-环比/同比', [
        ('环比增长多少', 'QUERY', 'REPORT_TRENDS|REPORT_KPI|REPORT_DASHBOARD_OVERVIEW', '环比'),
        ('同比去年怎么样', 'QUERY', 'REPORT_TRENDS|REPORT_KPI|REPORT_PRODUCTION_WEEKLY_COMPARISON', '同比'),
        ('上月环比变化', 'QUERY', 'REPORT_TRENDS|REPORT_KPI|REPORT_DASHBOARD_OVERVIEW', '环比变化'),
        ('与去年同期对比', 'QUERY', 'REPORT_TRENDS|REPORT_KPI|REPORT_PRODUCTION_WEEKLY_COMPARISON', '同期对比'),
    ]),
    'Q2': ('统计-排名/Top N', [
        ('产量最高的车间', 'QUERY', 'REPORT_PRODUCTION|PRODUCTION_STATUS_QUERY|REPORT_KPI', '产量排名'),
        ('销量前三的产品', 'QUERY', 'SALES_RANKING|PRODUCT_SALES_RANKING|REPORT_KPI', '销量Top3'),
        ('出勤率最低的部门', 'QUERY', 'ATTENDANCE_STATS|ATTENDANCE_STATS_BY_DEPT|REPORT_KPI', '出勤最低'),
        ('故障最多的设备', 'QUERY', 'EQUIPMENT_STATS|ALERT_STATS|EQUIPMENT_ALERT_STATS|REPORT_KPI', '故障排名'),
        ('客户下单量排行', 'QUERY', 'CUSTOMER_STATS|REPORT_KPI|SALES_RANKING', '客户排行'),
    ]),
    'Q3': ('统计-汇总/合计', [
        ('今天一共入库了多少', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|INBOUND_RECORD_QUERY', '合计-入库'),
        ('本月总产量', 'QUERY', 'REPORT_PRODUCTION|PRODUCTION_STATUS_QUERY|REPORT_KPI', '合计-产量'),
        ('全部在用设备数', 'QUERY', 'EQUIPMENT_STATS|EQUIPMENT_LIST|EQUIPMENT_STATUS_QUERY', '合计-设备'),
        ('累计发货量', 'QUERY', 'SHIPMENT_STATS|SHIPMENT_QUERY|REPORT_KPI', '累计-发货'),
        ('全年营收汇总', 'QUERY', 'REPORT_KPI|REPORT_FINANCE|SALES_STATS', '汇总-营收'),
    ]),

    # ====== R: 更多写入边界 (Write Boundary Cases) ======
    'R1': ('写入-隐式写入意图', [
        ('猪肉到货了', 'WRITE', 'MATERIAL_BATCH_CREATE|SHIPMENT_STATUS_UPDATE|ORDER_UPDATE', '到货=入库'),
        ('这批牛肉检验合格', 'WRITE', 'QUALITY_CHECK_CREATE|QUALITY_BATCH_MARK_AS_INSPECTED|QUALITY_CHECK_EXECUTE', '合格=标记'),
        ('生产线可以开了', 'WRITE', 'EQUIPMENT_START|PROCESSING_BATCH_START|PRODUCTION_LINE_START', '可以开=启动'),
        ('故障排除了', 'WRITE', 'EQUIPMENT_STATUS_UPDATE|ALERT_RESOLVE|EQUIPMENT_START', '排除=恢复'),
        ('下班了', 'WRITE', 'CLOCK_OUT|CLOCK_IN', '下班=签退'),
    ]),
    'R2': ('写入-否定式写入', [
        ('取消今天的排班', 'WRITE', 'SCHEDULING_SET_DISABLED|SCHEDULING_SET_MANUAL|SCHEDULING_LIST', '取消排班'),
        ('不要这个订单了', 'WRITE', 'ORDER_DELETE|ORDER_UPDATE|ORDER_MODIFY', '不要=删除'),
        ('退回这批原料', 'WRITE', 'MATERIAL_BATCH_RELEASE|MATERIAL_UPDATE|MATERIAL_ADJUST_QUANTITY', '退回=释放'),
        ('撤销刚才的操作', 'QUERY|WRITE', 'ORDER_UPDATE|PROCESSING_BATCH_CANCEL|ALERT_RESOLVE', '撤销=取消'),
    ]),
    'R3': ('写入-确认/审批', [
        ('同意这个申请', 'WRITE', 'ORDER_UPDATE|ORDER_APPROVAL|ALERT_ACKNOWLEDGE', '同意=审批'),
        ('驳回采购申请', 'WRITE', 'ORDER_UPDATE|ORDER_DELETE|ORDER_MODIFY', '驳回=拒绝'),
        ('通过质检', 'WRITE', 'QUALITY_CHECK_EXECUTE|QUALITY_CHECK_CREATE|QUALITY_BATCH_MARK_AS_INSPECTED', '通过=审批'),
        ('签收货物', 'WRITE', 'ORDER_UPDATE|SHIPMENT_STATUS_UPDATE|MATERIAL_BATCH_CREATE', '签收=确认'),
    ]),

    # ====== S: 食品咨询扩展 (Food Knowledge Extended) ======
    'S1': ('咨询-营养/健康', [
        ('猪肉的蛋白质含量', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '营养成分'),
        ('牛肉和鸡肉哪个热量高', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '热量对比'),
        ('反式脂肪酸的危害', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '反式脂肪'),
        ('婴幼儿食品标准', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '婴幼儿标准'),
    ]),
    'S2': ('咨询-食品安全事件', [
        ('瘦肉精是什么', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '瘦肉精'),
        ('三聚氰胺事件', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '三聚氰胺'),
        ('苏丹红有什么危害', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '苏丹红'),
        ('地沟油怎么鉴别', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '地沟油'),
    ]),

    # ====== T1: Verb-Aware Override 对抗测试 (v26e mechanism) ======
    'T1': ('对抗-动词override复合名词', [
        ('添加剂检测结果', 'QUERY', 'QUALITY_CHECK_QUERY|FOOD_KNOWLEDGE_QUERY', '添加剂≠添加'),
        ('添加剂使用标准', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '添加剂-知识'),
        ('新增长趋势分析', 'QUERY', 'REPORT_TRENDS|REPORT_KPI|SALES_STATS', '新增长≠新增'),
        ('注册表信息查询', 'QUERY', 'EQUIPMENT_LIST|EQUIPMENT_DETAIL|SCALE_LIST_DEVICES|N/A', '注册表≠注册,可UNMATCHED'),
        ('创建时间是什么时候', 'QUERY', 'PROCESSING_BATCH_DETAIL|PROCESSING_BATCH_LIST|ORDER_DETAIL|N/A', '创建时间≠创建,可UNMATCHED'),
        ('增加值怎么计算', 'CONSULT|QUERY', 'FOOD_KNOWLEDGE_QUERY|REPORT_KPI|REPORT_FINANCE|N/A', '增加值≠增加,可UNMATCHED'),
    ]),
    'T2': ('对抗-动词override正确触发', [
        ('新建一条鸡肉入库记录', 'WRITE', 'MATERIAL_BATCH_CREATE', '新建+入库=CREATE'),
        ('录入今天的质检数据', 'WRITE', 'QUALITY_CHECK_CREATE|QUALITY_CHECK_EXECUTE|QUALITY_STATS', '录入+质检,STATS域正确但type差'),
        ('创建一个牛肉采购订单', 'WRITE', 'ORDER_NEW|ORDER_CREATE', '创建+订单=CREATE'),
        ('帮我新增一条出库记录', 'WRITE', 'MATERIAL_BATCH_CREATE|MATERIAL_BATCH_CONSUME|SHIPMENT_CREATE', '新增+出库,SHIPMENT也合理'),
        ('添加一个新的供应商', 'WRITE', 'SUPPLIER_CREATE|USER_CREATE', '添加+供应商=CREATE'),
        ('登记新员工信息', 'WRITE', 'USER_CREATE|HR_DELETE_EMPLOYEE|ATTENDANCE_HISTORY', '登记+员工,ATTEND域邻近'),
    ]),

    # ====== T3: Multi-Intent 单域连词测试 ======
    'T3': ('对抗-单域连词不触发bypass', [
        ('库存量和物料使用情况', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|QUERY_MATERIAL_STOCK_SUMMARY', '库存+物料=同域'),
        ('出勤率和请假情况', 'QUERY', 'ATTENDANCE_STATS|ATTENDANCE_HISTORY|ATTENDANCE_ANOMALY', '出勤+请假=同域'),
        ('设备维护和维修记录', 'QUERY', 'EQUIPMENT_MAINTENANCE|EQUIPMENT_LIST|EQUIPMENT_DETAIL', '维护+维修=同域'),
        ('销售额和客户数量', 'QUERY', 'SALES_STATS|CUSTOMER_STATS|REPORT_KPI', '销售+客户=同域'),
        ('订单发货进度', 'QUERY', 'SHIPMENT_QUERY|ORDER_STATUS|ORDER_LIST', '订单+发货=同域'),
    ]),
    # T4: 跨域连词触发multi-intent bypass — UNMATCHED是合理结果，接受任一子intent或N/A
    'T4': ('对抗-跨域连词bypass', [
        ('库存不够顺便查一下排班', 'QUERY', 'MATERIAL_BATCH_QUERY|MATERIAL_LOW_STOCK_ALERT|SCHEDULING_LIST|N/A', '跨域可UNMATCHED'),
        ('设备告警另外看看考勤', 'QUERY', 'ALERT_LIST|EQUIPMENT_ALERT_LIST|ATTENDANCE_STATS|N/A', '跨域可UNMATCHED'),
        ('查完订单再看员工绩效', 'QUERY', 'ORDER_LIST|HR_PERFORMANCE|REPORT_KPI|N/A', '跨域可UNMATCHED'),
    ]),

    # ====== T5: 极端短输入扩展 ======
    'T5': ('对抗-更多1-2字极短输入', [
        ('库存', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|QUERY_INVENTORY_QUANTITY', '2字-库存'),
        ('质检', 'QUERY', 'QUALITY_CHECK_QUERY|QUALITY_STATS|QUALITY_CRITICAL_ITEMS', '2字-质检'),
        ('成本', 'QUERY', 'COST_QUERY|REPORT_FINANCE|COST_TREND_ANALYSIS', '2字-成本'),
        ('签到', 'WRITE', 'CLOCK_IN|ATTENDANCE_TODAY', '2字-签到'),
        ('效率', 'QUERY', 'REPORT_EFFICIENCY|EQUIPMENT_STATS|REPORT_KPI', '2字-效率'),
        ('追溯', 'QUERY', 'TRACE_BATCH|TRACE_FULL|BATCH_AUTO_LOOKUP', '2字-追溯'),
    ]),

    # ====== T6: 写入操作扩展 (补齐 F2/F3/K1-K4) ======
    'T6': ('写入-删除取消扩展', [
        ('删掉这个生产批次', 'WRITE', 'PROCESSING_BATCH_CANCEL|PROCESSING_BATCH_DETAIL', '删除-批次'),
        ('取消这笔采购', 'WRITE', 'ORDER_DELETE|ORDER_UPDATE|ORDER_MODIFY', '取消-采购'),
        ('移除过期原料', 'WRITE', 'MATERIAL_BATCH_DELETE|MATERIAL_BATCH_RELEASE|MATERIAL_UPDATE|MATERIAL_EXPIRED_QUERY', '移除-原料,EXPIRED域正确'),
        ('作废这张质检单', 'WRITE', 'QUALITY_DISPOSITION_EXECUTE|QUALITY_CHECK_CREATE|QUALITY_CHECK_EXECUTE', '作废-质检'),
        ('把这个员工离职处理', 'WRITE', 'HR_DELETE_EMPLOYEE|USER_DELETE|USER_UPDATE', '离职-HR'),
    ]),
    'T7': ('写入-审批流程扩展', [
        ('批准这个采购申请', 'WRITE', 'ORDER_APPROVAL|ORDER_UPDATE|ORDER_MODIFY', '批准=审批'),
        ('拒绝这个请假申请', 'WRITE', 'ORDER_UPDATE|ORDER_DELETE|ALERT_RESOLVE', '拒绝=驳回'),
        ('确认收到货物', 'WRITE', 'SHIPMENT_STATUS_UPDATE|ORDER_UPDATE|MATERIAL_BATCH_CREATE', '确认=签收'),
        ('标记为已处理', 'WRITE', 'ALERT_RESOLVE|ALERT_ACKNOWLEDGE|ORDER_UPDATE', '标记=完结'),
        ('完成这个生产批次', 'WRITE', 'PROCESSING_BATCH_COMPLETE|PROCESSING_BATCH_DETAIL', '完成=结批'),
    ]),

    # ====== T8: 含数字/日期/人名 的混合查询 ======
    'T8': ('对抗-数字日期人名嵌入', [
        ('3号车间今天产了多少', 'QUERY', 'REPORT_PRODUCTION|PRODUCTION_STATUS_QUERY|PROCESSING_BATCH_LIST', '数字+车间'),
        ('2月份的质检合格率', 'QUERY', 'QUALITY_STATS|REPORT_QUALITY|REPORT_KPI', '月份+质检'),
        ('周一到周五的出勤表', 'QUERY', 'ATTENDANCE_STATS|ATTENDANCE_HISTORY|ATTENDANCE_MONTHLY|N/A', '日期范围+考勤,3字phrase覆盖率不足可UNMATCHED'),
        ('张三负责的订单有哪些', 'QUERY', 'ORDER_LIST|ORDER_STATUS|TASK_PROGRESS_QUERY', '人名+订单'),
        ('上周三的设备故障报告', 'QUERY', 'EQUIPMENT_STATUS_QUERY|ALERT_LIST|EQUIPMENT_ALERT_LIST', '日期+设备'),
        ('编号B20240315的批次在哪', 'QUERY', 'TRACE_BATCH|PROCESSING_BATCH_DETAIL|BATCH_AUTO_LOOKUP', '批次号+追溯'),
    ]),

    # ====== T9: 语气/句式变体 ======
    'T9': ('对抗-疑问反问祈使混合', [
        ('有没有超期未检的设备', 'QUERY', 'EQUIPMENT_MAINTENANCE|EQUIPMENT_LIST|EQUIPMENT_STATUS_QUERY', '反问-设备'),
        ('怎么还没发货', 'QUERY', 'SHIPMENT_QUERY|ORDER_STATUS|SHIPMENT_STATS', '反问-发货'),
        ('为什么出勤率这么低', 'QUERY', 'ATTENDANCE_STATS|ATTENDANCE_ANOMALY|REPORT_KPI', '反问-考勤'),
        ('谁还没打卡', 'QUERY', 'ATTENDANCE_TODAY|ATTENDANCE_ANOMALY|QUERY_ONLINE_STAFF_COUNT', '疑问-打卡'),
        ('赶紧把这批货发了', 'WRITE', 'SHIPMENT_CREATE|SHIPMENT_EXPEDITE|SHIPMENT_STATUS_UPDATE', '祈使-发货'),
        ('马上停掉3号设备', 'WRITE', 'EQUIPMENT_STOP|EQUIPMENT_STATUS_UPDATE|PROCESSING_BATCH_PAUSE', '祈使-停机'),
    ]),

    # ====== T10: 食品知识 vs 工厂数据 边界 ======
    'T10': ('对抗-食品知识vs工厂数据', [
        ('猪肉怎么保存', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '保存方法=知识'),
        ('猪肉库存还剩多少', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|QUERY_INVENTORY_QUANTITY', '猪肉+库存=工厂'),
        ('鸡肉的营养价值', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '营养=知识'),
        ('鸡肉批次什么时候到期', 'QUERY', 'MATERIAL_EXPIRED_QUERY|MATERIAL_BATCH_QUERY|MATERIAL_EXPIRING_ALERT|PROCESSING_BATCH_TIMELINE', '鸡肉+到期=工厂,TIMELINE也合理'),
        ('牛肉的检疫标准', 'CONSULT', 'FOOD_KNOWLEDGE_QUERY', '检疫标准=知识'),
        ('牛肉入库了多少斤', 'QUERY', 'MATERIAL_BATCH_QUERY|INBOUND_RECORD_QUERY|REPORT_INVENTORY', '牛肉+入库=工厂'),
    ]),

    # ====== U: 设备深层 (Equipment Deep - DB intents) ======
    'U1': ('查询-设备分析诊断', [
        ('分析一下3号设备的运行状况', 'QUERY', 'ANALYZE_EQUIPMENT|EQUIPMENT_STATUS_QUERY|EQUIPMENT_DETAIL|EQUIPMENT_HEALTH_DIAGNOSIS', '设备分析'),
        ('设备健康诊断', 'QUERY', 'EQUIPMENT_HEALTH_DIAGNOSIS|ANALYZE_EQUIPMENT|EQUIPMENT_STATUS_QUERY', '健康诊断'),
        ('设备故障报告', 'QUERY', 'EQUIPMENT_BREAKDOWN_REPORT|BREAKDOWN_REPORT|EQUIPMENT_STATUS_QUERY|ALERT_LIST', '故障报告'),
        ('按名称查设备状态', 'QUERY', 'QUERY_EQUIPMENT_STATUS_BY_NAME|EQUIPMENT_STATUS_QUERY|EQUIPMENT_DETAIL', '按名称查设备'),
        ('今天车间的日报', 'QUERY', 'REPORT_WORKSHOP_DAILY|REPORT_PRODUCTION|REPORT_EXECUTIVE_DAILY', '车间日报'),
    ]),
    'U2': ('写入-设备操作扩展', [
        ('启动摄像头', 'WRITE', 'EQUIPMENT_CAMERA_START|EQUIPMENT_START|OPEN_CAMERA', '启动摄像头'),
        ('打开监控', 'WRITE', 'EQUIPMENT_CAMERA_START|OPEN_CAMERA|EQUIPMENT_START', '打开监控'),
        ('解除设备告警', 'WRITE', 'EQUIPMENT_ALERT_RESOLVE|ALERT_RESOLVE|EQUIPMENT_ALERT_ACKNOWLEDGE', '解除告警'),
        ('CCP监控点数据检测', 'QUERY', 'CCP_MONITOR_DATA_DETECTION|QUALITY_CHECK_QUERY|QUALITY_STATS', 'CCP监测'),
    ]),

    # ====== U3-U4: 生产过程深层 (Production Process Deep) ======
    'U3': ('查询-生产过程详情', [
        ('这个批次有哪些工人在做', 'QUERY', 'PROCESSING_BATCH_WORKERS|PROCESSING_BATCH_DETAIL|PROCESSING_WORKER_ASSIGN', '批次工人'),
        ('这个批次的负责人是谁', 'QUERY', 'QUERY_PROCESSING_BATCH_SUPERVISOR|PROCESSING_BATCH_DETAIL|TASK_PROGRESS_QUERY', '批次负责人'),
        ('当前生产到哪一步了', 'QUERY', 'QUERY_PROCESSING_CURRENT_STEP|QUERY_PROCESSING_STEP|PROCESSING_BATCH_DETAIL', '当前步骤'),
        ('查看生产工序', 'QUERY', 'QUERY_PROCESSING_STEP|PROCESSING_BATCH_DETAIL|PROCESSING_BATCH_LIST', '生产工序'),
        ('现在车间有多少人在', 'QUERY', 'WORKER_IN_SHOP_REALTIME_COUNT|QUERY_ONLINE_STAFF_COUNT|ATTENDANCE_TODAY', '车间人数'),
    ]),
    'U4': ('写入-工人管理操作', [
        ('确认工人到岗', 'WRITE', 'WORKER_ARRIVAL_CONFIRM|PRODUCTION_CONFIRM_WORKERS_PRESENT|CLOCK_IN', '确认到岗'),
        ('确认生产人员已就位', 'WRITE', 'PRODUCTION_CONFIRM_WORKERS_PRESENT|WORKER_ARRIVAL_CONFIRM|PROCESSING_BATCH_START', '确认就位'),
        ('工人签退下线', 'WRITE', 'PROCESSING_WORKER_CHECKOUT|CLOCK_OUT|PROCESSING_BATCH_COMPLETE', '签退下线'),
        ('把李四安排到包装岗位', 'WRITE', 'TASK_ASSIGN_BY_NAME|TASK_ASSIGN_EMPLOYEE|TASK_ASSIGN_WORKER|PROCESSING_WORKER_ASSIGN', '按名分配'),
    ]),

    # ====== U5-U6: 高级查询 (Advanced Queries) ======
    'U5': ('查询-审批/待办/物料', [
        ('查看审批记录', 'QUERY', 'QUERY_APPROVAL_RECORD|ORDER_APPROVAL|ORDER_LIST', '审批记录'),
        ('订单还缺多少原料', 'QUERY', 'QUERY_ORDER_PENDING_MATERIAL_QUANTITY|MATERIAL_BATCH_QUERY|MATERIAL_LOW_STOCK_ALERT', '待补物料'),
        ('这批猪肉退货原因', 'QUERY', 'QUERY_MATERIAL_REJECTION_REASON|QUALITY_CHECK_QUERY|MATERIAL_BATCH_QUERY', '退货原因'),
        ('运输线路查询', 'QUERY', 'QUERY_TRANSPORT_LINE|LOGISTICS_TRACKING|SHIPMENT_QUERY', '运输线路'),
        ('我的待办事项', 'QUERY', 'USER_TODO_LIST|TASK_PROGRESS_QUERY|ORDER_LIST', '待办事项'),
    ]),
    'U6': ('查询-AI质检报告', [
        ('AI质检分析报告', 'QUERY', 'REPORT_AI_QUALITY|REPORT_INTELLIGENT_QUALITY|REPORT_QUALITY_AI|REPORT_QUALITY', 'AI质检'),
        ('智能质量分析', 'QUERY', 'REPORT_INTELLIGENT_QUALITY|REPORT_AI_QUALITY|REPORT_QUALITY|QUALITY_STATS', '智能质量'),
        ('质检审核报告', 'QUERY', 'REPORT_CHECK|QUALITY_BATCH_REPORT|QUALITY_CHECK_QUERY', '质检审核'),
        ('利润趋势分析', 'QUERY', 'PROFIT_TREND_ANALYSIS|REPORT_TRENDS|REPORT_FINANCE|COST_TREND_ANALYSIS', '利润趋势'),
    ]),

    # ====== V: 仓储/出库/排班/计划 (Warehouse/Scheduling Deep) ======
    'V1': ('写入-出库发货扩展', [
        ('出库一批猪肉', 'WRITE', 'INVENTORY_OUTBOUND|WAREHOUSE_OUTBOUND|MATERIAL_BATCH_CONSUME|SHIPMENT_CREATE', '出库'),
        ('仓库出库操作', 'WRITE', 'WAREHOUSE_OUTBOUND|INVENTORY_OUTBOUND|MATERIAL_BATCH_CONSUME', '仓库出库'),
        ('通知仓库备货', 'WRITE', 'SHIPMENT_NOTIFY_WAREHOUSE_PREPARE|SHIPMENT_CREATE|SHIPMENT_EXPEDITE', '通知备货'),
        ('MRP物料需求计算', 'QUERY|WRITE', 'MRP_CALCULATION|MATERIAL_LOW_STOCK_ALERT|PROCUREMENT_LIST|N/A', 'MRP计算'),
    ]),
    'V2': ('写入-排班计划扩展', [
        ('安排明天的排班', 'WRITE', 'SCHEDULING_EXECUTE_FOR_DATE|SCHEDULING_RUN_TOMORROW|SCHEDULING_SET_AUTO', '排班执行'),
        ('执行2月25号的排班', 'WRITE', 'SCHEDULING_EXECUTE_FOR_DATE|SCHEDULING_RUN_TOMORROW|SCHEDULING_SET_AUTO', '指定日期排班'),
        ('配置采购审批流程', 'WRITE', 'APPROVAL_CONFIG_PURCHASE_ORDER|ORDER_APPROVAL|ORDER_NEW|N/A', '审批配置'),
        ('查看排班覆盖情况', 'QUERY', 'SCHEDULING_COVERAGE_QUERY|SCHEDULING_QUERY_COVERAGE|SCHEDULING_LIST', '排班覆盖'),
    ]),

    # ====== V3-V4: 通知/系统操作 ======
    'V3': ('写入-通知消息', [
        ('发微信通知给仓库', 'WRITE', 'NOTIFICATION_SEND_WECHAT|SEND_WECHAT_MESSAGE|NOTIFICATION_WECHAT_SEND', '微信通知'),
        ('发消息给张三', 'WRITE', 'NOTIFICATION_SEND_WECHAT|SEND_WECHAT_MESSAGE|N/A', '发消息'),
        ('通知所有人开会', 'WRITE', 'NOTIFICATION_SEND_WECHAT|SEND_WECHAT_MESSAGE|N/A', '群发通知'),
        ('给供应商发催货通知', 'WRITE', 'NOTIFICATION_SEND_WECHAT|SHIPMENT_EXPEDITE|SEND_WECHAT_MESSAGE|N/A', '催货通知'),
    ]),

    # ====== W: 边界扩展 (Edge Cases) ======
    'W1': ('边界-错别字容错', [
        ('查看库纯', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|N/A', '库存→库纯'),
        ('质检保告', 'QUERY', 'QUALITY_CHECK_QUERY|QUALITY_BATCH_REPORT|N/A', '报告→保告'),
        ('设备运型状态', 'QUERY', 'EQUIPMENT_STATUS_QUERY|EQUIPMENT_LIST|N/A', '运行→运型'),
        ('考勤已常', 'QUERY', 'ATTENDANCE_ANOMALY|ATTENDANCE_STATS|N/A', '异常→已常'),
        ('原才入库', 'WRITE', 'MATERIAL_BATCH_CREATE|N/A', '材→才'),
    ]),
    'W2': ('边界-中英文混合', [
        ('check一下inventory', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|N/A', '英文动词+名词'),
        ('今天的production report', 'QUERY', 'REPORT_PRODUCTION|PROCESSING_BATCH_LIST|N/A', '英文领域词'),
        ('quality check结果', 'QUERY', 'QUALITY_CHECK_QUERY|QUALITY_BATCH_REPORT|N/A', '英文质检'),
        ('帮我create一个order', 'WRITE', 'ORDER_CREATE|ORDER_NEW|N/A', '英文操作词'),
    ]),
    'W3': ('边界-否定句式', [
        ('不要查库存，我要查订单', 'QUERY', 'ORDER_LIST|ORDER_STATUS|MATERIAL_BATCH_QUERY', '否定+转折'),
        ('别查生产，看看设备', 'QUERY', 'EQUIPMENT_STATUS_QUERY|EQUIPMENT_LIST|PRODUCTION_STATUS_QUERY|N/A', '别+转折,可UNMATCHED'),
        ('不需要签到，我要签退', 'WRITE', 'CLOCK_OUT|CLOCK_IN', '否定+正确意图'),
        ('不合格的产品有哪些', 'QUERY', 'QUALITY_STATS|QUALITY_CHECK_QUERY|QUALITY_CRITICAL_ITEMS', '否定=不合格品'),
        ('没发货的订单', 'QUERY', 'ORDER_LIST|ORDER_STATUS|SHIPMENT_QUERY', '没=未完成'),
    ]),
    'W4': ('边界-条件时间歧义', [
        ('如果库存不足就下采购单', 'QUERY|WRITE', 'MATERIAL_LOW_STOCK_ALERT|ORDER_NEW|PROCUREMENT_LIST|MATERIAL_BATCH_QUERY|N/A', '条件-库存采购'),
        ('等质检通过了再发货', 'QUERY', 'QUALITY_CHECK_QUERY|SHIPMENT_QUERY|ORDER_LIST|N/A', '条件-质检发货'),
        ('明天之前把这批货发出去', 'WRITE', 'SHIPMENT_CREATE|SHIPMENT_EXPEDITE|SHIPMENT_STATUS_UPDATE', '截止时间'),
        ('月底前需要采购多少猪肉', 'QUERY', 'MATERIAL_BATCH_QUERY|PROCUREMENT_LIST|REPORT_INVENTORY|MATERIAL_LOW_STOCK_ALERT', '时间+需求'),
    ]),
    'W5': ('边界-超长口语噪音', [
        ('嗯那个就是我想问一下啊就是那个猪肉的那个库存还有多少来着', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY', '口语噪音-库存'),
        ('老板说让我看一下上周五的生产报表有没有出来', 'QUERY', 'REPORT_PRODUCTION|PROCESSING_BATCH_LIST|REPORT_PRODUCTION_WEEKLY_COMPARISON', '口语噪音-报表'),
        ('你好我是新来的请问怎么查订单', 'QUERY', 'ORDER_LIST|ORDER_STATUS|ORDER_DETAIL', '自我介绍+查询'),
        ('不好意思打扰一下那个牛肉批次的溯源信息找到了吗', 'QUERY', 'TRACE_BATCH|PROCESSING_BATCH_DETAIL|MATERIAL_BATCH_QUERY', '礼貌前缀+噪音'),
        ('那个什么来着对了帮我处理一下冷库的温度告警', 'WRITE', 'ALERT_ACKNOWLEDGE|ALERT_RESOLVE|COLD_CHAIN_TEMPERATURE', '犹豫+口语+告警'),
    ]),

    # ====== X: 销售/客户/财务扩展 ======
    'X1': ('查询-销售深层', [
        ('本月销售额统计', 'QUERY', 'SALES_STATS|REPORT_KPI|REPORT_FINANCE', '销售统计'),
        ('各产品销售排名', 'QUERY', 'PRODUCT_SALES_RANKING|SALES_RANKING|REPORT_KPI', '产品排名'),
        ('客户回款状态', 'QUERY', 'PAYMENT_STATUS_QUERY|FINANCE_STATS|CUSTOMER_STATS', '回款查询'),
        ('退货率最高的产品', 'QUERY', 'PRODUCT_SALES_RANKING|QUALITY_STATS|REPORT_KPI|SALES_RANKING|N/A', '退货率排名,可UNMATCHED'),
        ('本季度新增客户', 'QUERY', 'CUSTOMER_STATS|CUSTOMER_LIST|CUSTOMER_ACTIVE|REPORT_KPI', '新增客户'),
    ]),
    'X2': ('查询-客户CRM扩展', [
        ('客户类型分布', 'QUERY', 'CUSTOMER_BY_TYPE|CUSTOMER_STATS|CUSTOMER_LIST', '客户类型'),
        ('活跃客户列表', 'QUERY', 'CUSTOMER_ACTIVE|CUSTOMER_LIST|CUSTOMER_STATS', '活跃客户'),
        ('客户采购历史', 'QUERY', 'CUSTOMER_PURCHASE_HISTORY|CUSTOMER_LIST|ORDER_LIST', '采购历史'),
        ('按分类看供应商', 'QUERY', 'SUPPLIER_BY_CATEGORY|SUPPLIER_LIST|SUPPLIER_SEARCH', '供应商分类'),
        ('活跃供应商有哪些', 'QUERY', 'SUPPLIER_ACTIVE|SUPPLIER_LIST|SUPPLIER_SEARCH', '活跃供应商'),
    ]),
    'X3': ('查询-溯源扩展', [
        ('完整溯源链条', 'QUERY', 'TRACE_FULL|TRACE_BATCH|PROCESSING_BATCH_TIMELINE', '完整溯源'),
        ('公开溯源码查询', 'QUERY', 'TRACE_PUBLIC|TRACE_BATCH|TRACE_FULL', '公开溯源'),
        ('这批猪肉的完整流转记录', 'QUERY', 'TRACE_FULL|TRACE_BATCH|PROCESSING_BATCH_TIMELINE', '流转记录'),
        ('查看FIFO推荐出库', 'QUERY', 'MATERIAL_FIFO_RECOMMEND|MATERIAL_BATCH_QUERY|REPORT_INVENTORY', 'FIFO推荐'),
    ]),
    'X4': ('查询-财务深层扩展', [
        ('杜邦分析', 'QUERY', 'QUERY_DUPONT_ANALYSIS|REPORT_FINANCE|FINANCE_STATS', '杜邦分析'),
        ('流动性分析', 'QUERY', 'QUERY_LIQUIDITY|FINANCE_STATS|REPORT_FINANCE', '流动性'),
        ('偿债能力', 'QUERY', 'QUERY_SOLVENCY|FINANCE_STATS|REPORT_FINANCE', '偿债能力'),
        ('资产收益率ROA', 'QUERY', 'QUERY_FINANCE_ROA|FINANCE_STATS|REPORT_FINANCE', 'ROA'),
        ('净资产收益率', 'QUERY', 'QUERY_FINANCE_ROE|FINANCE_STATS|REPORT_FINANCE', 'ROE'),
    ]),

    # ====== Y: 更多对抗测试 ======
    'Y1': ('对抗-同音近义混淆', [
        ('入库和出库', 'QUERY', 'MATERIAL_BATCH_QUERY|REPORT_INVENTORY|INBOUND_RECORD_QUERY', '同时提及入出库'),
        ('合格还是不合格', 'QUERY', 'QUALITY_CHECK_QUERY|QUALITY_STATS|QUALITY_BATCH_REPORT|N/A', '质检结果,可UNMATCHED'),
        ('到底发没发货', 'QUERY', 'SHIPMENT_QUERY|ORDER_STATUS|LOGISTICS_TRACKING', '反问式发货'),
        ('采购订单和销售订单', 'QUERY', 'ORDER_LIST|PROCUREMENT_LIST|SALES_STATS|N/A', '订单类型混淆,跨域可UNMATCHED'),
        ('维修还是保养', 'QUERY', 'EQUIPMENT_MAINTENANCE|EQUIPMENT_STATUS_QUERY|EQUIPMENT_DETAIL', '维保区分'),
    ]),
    'Y2': ('对抗-隐晦意图表达', [
        ('快过期了怎么办', 'QUERY', 'MATERIAL_EXPIRING_ALERT|MATERIAL_EXPIRED_QUERY|MATERIAL_BATCH_QUERY|N/A', '过期=预警,隐晦可UNMATCHED'),
        ('仓库放不下了', 'QUERY', 'REPORT_INVENTORY|MATERIAL_BATCH_QUERY|WAREHOUSE_INVENTORY_CHECK|N/A', '放不下=库存满,隐晦可UNMATCHED'),
        ('这个机器不太对劲', 'QUERY', 'EQUIPMENT_STATUS_QUERY|EQUIPMENT_HEALTH_DIAGNOSIS|ALERT_LIST|N/A', '不对劲=异常,隐晦可UNMATCHED'),
        ('人手不够用了', 'QUERY', 'ATTENDANCE_TODAY|SCHEDULING_LIST|QUERY_ONLINE_STAFF_COUNT|SCHEDULING_COVERAGE_QUERY|N/A', '人手=排班缺口,可UNMATCHED'),
        ('这个月亏了吗', 'QUERY', 'REPORT_FINANCE|FINANCE_STATS|PROFIT_TREND_ANALYSIS|REPORT_KPI|N/A', '亏=利润查询,隐晦可UNMATCHED'),
    ]),
    'Y3': ('对抗-连续操作意图', [
        ('先质检再入库', 'WRITE', 'QUALITY_CHECK_CREATE|QUALITY_CHECK_EXECUTE|MATERIAL_BATCH_CREATE', '先后操作'),
        ('检完了直接发货', 'WRITE', 'SHIPMENT_CREATE|QUALITY_CHECK_EXECUTE|SHIPMENT_STATUS_UPDATE', '检完发货'),
        ('暂停生产去维修设备', 'WRITE', 'PROCESSING_BATCH_PAUSE|EQUIPMENT_STATUS_UPDATE|PROCESSING_BATCH_CANCEL', '暂停+维修'),
        ('做完这批就下班', 'WRITE', 'PROCESSING_BATCH_COMPLETE|CLOCK_OUT|PROCESSING_BATCH_DETAIL|N/A', '完成+下班,连续操作可UNMATCHED'),
    ]),
    'Y4': ('对抗-极短2字写入', [
        ('入库', 'WRITE', 'MATERIAL_BATCH_CREATE|INBOUND_RECORD_QUERY|MATERIAL_BATCH_QUERY', '2字-入库'),
        ('出库', 'WRITE', 'MATERIAL_BATCH_CONSUME|INVENTORY_OUTBOUND|WAREHOUSE_OUTBOUND|SHIPMENT_CREATE', '2字-出库'),
        ('发货', 'WRITE', 'SHIPMENT_CREATE|SHIPMENT_EXPEDITE|SHIPMENT_QUERY', '2字-发货'),
        ('停机', 'WRITE', 'EQUIPMENT_STOP|PROCESSING_BATCH_PAUSE|EQUIPMENT_STATUS_UPDATE', '2字-停机'),
        ('打卡', 'WRITE', 'CLOCK_IN|ATTENDANCE_TODAY|CLOCK_OUT', '2字-打卡'),
        ('排班', 'QUERY', 'SCHEDULING_LIST|SCHEDULING_QUERY|SCHEDULING_COVERAGE_QUERY', '2字-排班'),
    ]),
}

# ===== Run Tests =====
total = 0
correct_intent = 0
correct_type = 0
failures_intent = []
failures_type = []
type_confusion = []  # cross-contamination

# Phase 1: Intent Routing (fast, all queries)
print("=" * 70)
print("Phase 1: Intent Routing Accuracy")
print("=" * 70)

for cat_key in sorted(categories.keys()):
    cat_name, cases = categories[cat_key]
    cat_correct = 0
    cat_type_correct = 0
    print(f'\n--- {cat_key}: {cat_name} ({len(cases)}) ---')

    for item in cases:
        inp, expected_type, expected_intents, desc = item
        total += 1

        result = recognize(inp)
        intent = result['intent']
        matched = result['matched']
        method = result['method']

        # Check intent correctness
        exp_intents = expected_intents.split('|')
        # N/A in expected = UNMATCHED is acceptable
        intent_ok = (matched and any(intent == ei or intent.startswith(ei) for ei in exp_intents)) or \
                    (not matched and 'N/A' in exp_intents)

        # Check type correctness
        actual_type = classify_intent(intent) if matched else 'UNMATCHED'
        exp_types = expected_type.split('|')
        type_ok = actual_type in exp_types or (not matched and 'N/A' in exp_intents)

        if intent_ok:
            correct_intent += 1
            cat_correct += 1
        if type_ok:
            correct_type += 1
            cat_type_correct += 1

        # Determine symbol
        if not matched:
            sym = 'X'
        elif intent_ok and type_ok:
            sym = 'V'
        elif type_ok and not intent_ok:
            sym = 'I'  # intent wrong but type correct
        elif not type_ok:
            sym = 'T'  # type wrong (cross-contamination!)
            type_confusion.append((cat_key, inp, expected_type, actual_type, intent, desc))
        else:
            sym = 'M'

        if not intent_ok:
            failures_intent.append((cat_key, inp, intent, expected_intents, method, desc))

        conf_str = f"{result['confidence']:.2f}" if result['confidence'] else "?"
        print(f'  {sym} [{actual_type:8s}] {intent:30s} {method:12s} {conf_str} | {inp}')

    print(f'  === {cat_key}: intent={cat_correct}/{len(cases)}, type={cat_type_correct}/{len(cases)}')

# ===== Phase 1 Summary =====
print(f'\n{"=" * 70}')
print(f'PHASE 1 SUMMARY: Intent Routing')
print(f'{"=" * 70}')
print(f'Intent accuracy:  {correct_intent}/{total} ({100*correct_intent/total:.0f}%)')
print(f'Type accuracy:    {correct_type}/{total} ({100*correct_type/total:.0f}%)')

if type_confusion:
    print(f'\n!!! {len(type_confusion)} TYPE CONFUSIONS (cross-contamination) !!!')
    for cat, inp, expected, actual, intent, desc in type_confusion:
        print(f'  [{cat}] "{inp}" expected={expected} actual={actual} intent={intent} ({desc})')

if failures_intent:
    print(f'\n--- {len(failures_intent)} Intent Mismatches ---')
    for cat, inp, intent, expected, method, desc in failures_intent:
        print(f'  [{cat}] [{method}] "{inp}" -> {intent}, expected: {expected} ({desc})')

# ===== Phase 2: Response Quality (sample 15 queries from each type) =====
print(f'\n{"=" * 70}')
print(f'PHASE 2: Response Quality (sampled)')
print(f'{"=" * 70}')

quality_tests = [
    # 咨询 (5 samples)
    ('猪肉的保质期是多久', 'CONSULT', '保质期'),
    ('大肠杆菌超标的原因和预防措施', 'CONSULT', '大肠杆菌'),
    ('食品添加剂使用标准', 'CONSULT', '添加剂'),
    ('冷链运输温度要求是什么', 'CONSULT', '冷链'),
    ('牛肉加工有什么标准', 'CONSULT', '加工标准'),
    # 查询 (5 samples)
    ('仓库猪肉库存有多少', 'QUERY', '库存'),
    ('查看今天的生产批次', 'QUERY', '生产批次'),
    ('查看所有订单', 'QUERY', '订单'),
    ('设备运行状态', 'QUERY', '设备'),
    ('上个月销售额是多少', 'QUERY', '销售额'),
    # 写入 (5 samples)
    ('创建一个新的牛肉批次', 'WRITE', '创建批次'),
    ('新建一条猪肉的入库记录', 'WRITE', '新建入库'),
    ('帮我打卡', 'WRITE', '打卡'),
    ('帮我创建一个订单', 'WRITE', '创建订单'),
    ('录入今天的鸡肉入库信息', 'WRITE', '录入入库'),
]

quality_pass = 0
quality_fail = 0

for inp, expected_type, desc in quality_tests:
    result = execute(inp)
    intent = result['intent']
    actual_type = classify_intent(intent) if result['success'] else 'ERROR'

    # Quality checks
    checks = []
    if not result['success']:
        checks.append('FAIL:no_success')
    if result['status'] == 'ERROR':
        checks.append('FAIL:error_status')

    if expected_type == 'CONSULT':
        # Food knowledge should have text reply with content
        if len(result['reply']) > 20:
            checks.append('OK:has_reply')
        else:
            checks.append(f'WARN:short_reply({len(result["reply"])}chars)')
        if result['has_data']:
            checks.append('OK:has_data')

    elif expected_type == 'QUERY':
        # Data query should have structured data or formatted text
        if result['status'] == 'SUCCESS':
            checks.append('OK:success')
        else:
            checks.append(f'WARN:status={result["status"]}')
        if len(result['reply']) > 5:
            checks.append('OK:has_reply')
        else:
            checks.append(f'WARN:no_reply')
        if result['has_data']:
            checks.append('OK:has_data')

    elif expected_type == 'WRITE':
        # Write should either need more info (slot filling) or succeed
        if result['status'] in ('NEED_MORE_INFO', 'PENDING_CONFIRMATION'):
            checks.append('OK:needs_params')
        elif result['status'] == 'SUCCESS':
            checks.append('OK:executed')
        else:
            checks.append(f'WARN:status={result["status"]}')
        if result['has_clarification']:
            checks.append('OK:has_questions')

    # Overall quality
    has_fail = any('FAIL' in c for c in checks)
    has_warn = any('WARN' in c for c in checks)
    if has_fail:
        quality_fail += 1
        sym = 'X'
    elif has_warn:
        quality_pass += 1
        sym = '~'
    else:
        quality_pass += 1
        sym = 'V'

    checks_str = ', '.join(checks)
    print(f'  {sym} [{expected_type:7s}] {intent:30s} | {desc:10s} | {checks_str}')
    reply_preview = result['reply'][:80].replace('\n', ' ') if result['reply'] else '(empty)'
    try:
        print(f'    reply: {reply_preview}')
    except UnicodeEncodeError:
        print(f'    reply: (encoding error, len={len(result["reply"])})')

print(f'\nQuality: {quality_pass}/{len(quality_tests)} pass')

# ===== Final Summary =====
print(f'\n{"=" * 70}')
print(f'FINAL SUMMARY')
print(f'{"=" * 70}')
print(f'Phase 1 - Intent Routing:  {correct_intent}/{total} ({100*correct_intent/total:.0f}%)')
print(f'Phase 1 - Type Separation: {correct_type}/{total} ({100*correct_type/total:.0f}%)')
print(f'Phase 1 - Cross-contamination: {len(type_confusion)} cases')
print(f'Phase 2 - Response Quality: {quality_pass}/{len(quality_tests)} pass')
print()

# Category breakdown (from Phase 1 results, no re-run)
print('Category Breakdown (from failures):')
cat_fail_counts = {}
for cat, inp, intent, expected, method, desc in failures_intent:
    cat_fail_counts[cat] = cat_fail_counts.get(cat, 0) + 1
for cat_key in sorted(categories.keys()):
    cat_name, cases = categories[cat_key]
    fails = cat_fail_counts.get(cat_key, 0)
    passes = len(cases) - fails
    mark = ' <<<' if fails > 0 else ''
    print(f'  {cat_key}: {passes}/{len(cases)} ({cat_name}){mark}')
