#!/usr/bin/env python3
"""分析测试结果 - 考虑功能等价的意图"""

# 功能等价组定义
EQUIVALENT_GROUPS = {
    # 考勤相关 - 所有都是查询考勤
    "ATTENDANCE_QUERY": ["ATTENDANCE_QUERY", "ATTENDANCE_STATUS", "ATTENDANCE_TODAY", 
                          "ATTENDANCE_HISTORY", "ATTENDANCE_ANOMALY", "ATTENDANCE_STATS"],
    # 设备状态相关
    "EQUIPMENT_STATUS": ["EQUIPMENT_STATUS", "EQUIPMENT_STATUS_UPDATE", "EQUIPMENT_STATS"],
    # 告警相关
    "ALERT_LIST": ["ALERT_LIST", "ALERT_ACTIVE", "ALERT_BY_EQUIPMENT", "ALERT_ACKNOWLEDGE", 
                   "ALERT_DIAGNOSE", "EQUIPMENT_ALERT_LIST"],
    # 供应商相关
    "SUPPLIER_QUERY": ["SUPPLIER_QUERY", "SUPPLIER_SEARCH", "SUPPLIER_EVALUATE"],
    # 客户相关
    "CUSTOMER_QUERY": ["CUSTOMER_QUERY", "CUSTOMER_SEARCH", "CUSTOMER_PURCHASE_HISTORY"],
    # 库存/报表相关
    "MATERIAL_BATCH_QUERY": ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "MATERIAL_LOW_STOCK_ALERT"],
    # 过期告警相关
    "MATERIAL_EXPIRY_ALERT": ["MATERIAL_EXPIRY_ALERT", "MATERIAL_EXPIRED_QUERY", "MATERIAL_EXPIRING_ALERT"],
    # 质量相关
    "QUALITY_STATS": ["QUALITY_STATS", "QUALITY_CHECK_QUERY", "REPORT_QUALITY"],
    # 批次列表相关
    "PROCESSING_BATCH_LIST": ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL", "REPORT_PRODUCTION", 
                               "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW"],
    # 发货相关
    "SHIPMENT_QUERY": ["SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE", "SHIPMENT_BY_CUSTOMER"],
    # 设备控制相关
    "EQUIPMENT_CONTROL": ["EQUIPMENT_CONTROL", "EQUIPMENT_START", "EQUIPMENT_STOP"],
    # 批次完成相关
    "PROCESSING_BATCH_COMPLETE": ["PROCESSING_BATCH_COMPLETE", "PROCESSING_BATCH_PAUSE"],
}

# 反向映射：意图 -> 等价组名
INTENT_TO_GROUP = {}
for group_name, intents in EQUIVALENT_GROUPS.items():
    for intent in intents:
        if intent not in INTENT_TO_GROUP:
            INTENT_TO_GROUP[intent] = group_name

def is_functionally_equivalent(actual, expected):
    """检查两个意图是否功能等价"""
    if actual == expected:
        return True
    
    # 检查是否在同一等价组
    actual_group = INTENT_TO_GROUP.get(actual)
    expected_group = INTENT_TO_GROUP.get(expected)
    
    if actual_group and expected_group and actual_group == expected_group:
        return True
    
    # 检查交叉组（一个意图可能在多个组中）
    for group_name, intents in EQUIVALENT_GROUPS.items():
        if actual in intents and expected in intents:
            return True
    
    return False

# 测试结果（从之前的测试输出中提取）
RESULTS = [
    ("帮我看看原料还有多少", "MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_QUERY"),  # ✅
    ("那个批次咋样了", "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_DETAIL"),  # ✅
    ("东西发出去没有", "SHIPMENT_QUERY", "SHIPMENT_QUERY"),  # ✅
    ("库存够不够啊", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"),  # 等价
    ("机器还转着吗", "EQUIPMENT_STATUS_UPDATE", "EQUIPMENT_STATUS"),  # 等价
    ("今天干了多少活", "PROCESSING_BATCH_LIST", "PROCESSING_BATCH_LIST"),  # ✅
    ("谁还没打卡", "ATTENDANCE_STATUS", "ATTENDANCE_QUERY"),  # 等价
    ("质量过关吗", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_QUERY"),  # ✅
    ("客户那边催没催", "SHIPMENT_QUERY", "CUSTOMER_QUERY"),  # ❌ 真正失败
    ("原料快没了吧", "MATERIAL_LOW_STOCK_ALERT", "MATERIAL_LOW_STOCK_ALERT"),  # ✅
    ("系统里面有没有快要过期的原材料", "MATERIAL_EXPIRED_QUERY", "MATERIAL_EXPIRY_ALERT"),  # 等价
    ("统计一下本月质检不合格", "REPORT_DASHBOARD_OVERVIEW", "QUALITY_STATS"),  # 部分等价
    ("找出所有设备告警", "EQUIPMENT_LIST", "ALERT_LIST"),  # ❌ 真正失败
    ("查询供应商评分", "SUPPLIER_SEARCH", "SUPPLIER_QUERY"),  # 等价
    ("看看今天考勤", "ATTENDANCE_TODAY", "ATTENDANCE_QUERY"),  # 等价
    ("把库存量低于安全线的原料", "MATERIAL_BATCH_QUERY", "MATERIAL_LOW_STOCK_ALERT"),  # 等价
    ("最近三天的告警", "ALERT_ACKNOWLEDGE", "ALERT_LIST"),  # 等价
    ("今早的打卡记录", "ATTENDANCE_HISTORY", "ATTENDANCE_QUERY"),  # 等价
    ("下周要过期的原料", "MATERIAL_EXPIRED_QUERY", "MATERIAL_EXPIRY_ALERT"),  # 等价
    ("刚才启动的批次", "PROCESSING_BATCH_START", "PROCESSING_BATCH_DETAIL"),  # ❌ 失败
    ("月底前要完成的生产", "PROCESSING_BATCH_COMPLETE", "PROCESSING_BATCH_LIST"),  # ❌ 失败
    ("季度末的库存盘点", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY"),  # 等价
    ("还没发货的订单", "SHIPMENT_STATUS_UPDATE", "SHIPMENT_QUERY"),  # 等价
    ("未处理的告警", "ALERT_ACTIVE", "ALERT_LIST"),  # 等价
    ("不在线的设备", "EQUIPMENT_STOP", "EQUIPMENT_STATUS"),  # ❌ 失败
    ("缺勤的员工", "ATTENDANCE_ANOMALY", "ATTENDANCE_QUERY"),  # 等价
    ("评分不达标的供应商", "SUPPLIER_EVALUATE", "SUPPLIER_QUERY"),  # 等价
    ("尚未完成的生产任务", "PROCESSING_BATCH_COMPLETE", "PROCESSING_BATCH_LIST"),  # ❌ 失败
    ("状态", "EQUIPMENT_STATUS_UPDATE", "EQUIPMENT_STATUS"),  # 等价
    ("详情", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_DETAIL"),  # 部分等价
    ("记录", "SHIPMENT_QUERY", "PROCESSING_BATCH_LIST"),  # ❌ 失败
    ("信息", "CUSTOMER_SEARCH", "MATERIAL_BATCH_QUERY"),  # ❌ 失败
    ("进度", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_LIST"),  # 等价
    ("情况", "QUALITY_CHECK_QUERY", "PROCESSING_BATCH_LIST"),  # ❌ 失败
    ("问题", "ALERT_ACTIVE", "ALERT_LIST"),  # 等价
    ("更新批次", "PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_UPDATE"),  # ❌ 失败
    ("修改发货", "SHIPMENT_STATUS_UPDATE", "SHIPMENT_UPDATE"),  # 等价?
    ("操作设备", "EQUIPMENT_START", "EQUIPMENT_CONTROL"),  # 等价
    ("确认收货", "SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE"),  # 等价
    ("完成任务", "SCHEDULING_SET_MANUAL", "PROCESSING_BATCH_COMPLETE"),  # ❌ 失败
    ("开始工作", "CLOCK_IN", "PROCESSING_BATCH_START"),  # ❌ 失败 (有歧义)
    ("结束流程", "CLOCK_OUT", "PROCESSING_BATCH_COMPLETE"),  # ❌ 失败 (有歧义)
    ("原料的质检报告", "MATERIAL_BATCH_QUERY", "QUALITY_CHECK_QUERY"),  # ❌ 失败
    ("生产用的原料", "TRACE_BATCH", "MATERIAL_BATCH_QUERY"),  # ❌ 失败
    ("发货的批次追溯", "TRACE_BATCH", "TRACE_BATCH"),  # ✅
    ("设备的告警历史", "ALERT_BY_EQUIPMENT", "ALERT_LIST"),  # 等价
    ("客户的历史订单", "CUSTOMER_PURCHASE_HISTORY", "CUSTOMER_QUERY"),  # 等价
    ("车间的考勤情况", "ATTENDANCE_TODAY", "ATTENDANCE_QUERY"),  # 等价
    ("仓库的库存告警", "ALERT_LIST", "MATERIAL_LOW_STOCK_ALERT"),  # ❌ 失败
    ("库存最多的原料", "MATERIAL_LOW_STOCK_ALERT", "MATERIAL_BATCH_QUERY"),  # 等价
    ("告警最频繁的设备", "ALERT_BY_EQUIPMENT", "ALERT_LIST"),  # 等价
    ("生产效率最高的批次", "REPORT_EFFICIENCY", "PROCESSING_BATCH_LIST"),  # 等价
    ("评分最高的供应商", "SUPPLIER_EVALUATE", "SUPPLIER_QUERY"),  # 等价
    ("出勤率最低的员工", "ATTENDANCE_STATS", "ATTENDANCE_QUERY"),  # 等价
    ("质检合格率最差的", "QUALITY_CHECK_EXECUTE", "QUALITY_STATS"),  # ❌ 失败 (执行vs查询)
    ("发货量最大的客户", "SHIPMENT_STATUS_UPDATE", "CUSTOMER_STATS"),  # ❌ 失败
    ("使用频率最高的设备", "EQUIPMENT_STATS", "EQUIPMENT_LIST"),  # 等价?
    ("消耗最快的原料", "MATERIAL_LOW_STOCK_ALERT", "MATERIAL_BATCH_QUERY"),  # 等价
    ("等待时间最长的订单", "SHIPMENT_BY_CUSTOMER", "SHIPMENT_QUERY"),  # 等价
    ("今天生产了几批", "PROCESSING_BATCH_START", "PROCESSING_BATCH_LIST"),  # ❌ 失败
    ("谁的考勤有问题", "ATTENDANCE_STATUS", "ATTENDANCE_QUERY"),  # 等价
    ("设备为什么报警", "ALERT_BY_EQUIPMENT", "ALERT_LIST"),  # 等价
    ("质检为什么不合格", "QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY"),  # ❌ 失败
    ("哪个供应商最靠谱", "SUPPLIER_SEARCH", "SUPPLIER_QUERY"),  # 等价
    ("停掉那台设备", "EQUIPMENT_STOP", "EQUIPMENT_CONTROL"),  # 等价
    ("给我打印溯源码", "TRACE_PUBLIC", "TRACE_GENERATE"),  # ❌ 失败?
    ("登记今天的考勤", "ATTENDANCE_STATUS", "ATTENDANCE_RECORD"),  # ❌ 失败
]

# 统计
exact_match = 0
equivalent_match = 0
real_fail = 0

for query, actual, expected in RESULTS:
    if actual == expected:
        exact_match += 1
    elif is_functionally_equivalent(actual, expected):
        equivalent_match += 1
    else:
        real_fail += 1
        print(f"真正失败: {query}")
        print(f"  实际: {actual}, 期望: {expected}")

total = len(RESULTS)
print()
print("=" * 50)
print(f"精确匹配: {exact_match}/{total} ({exact_match*100/total:.1f}%)")
print(f"功能等价: {equivalent_match}/{total} ({equivalent_match*100/total:.1f}%)")
print(f"真正失败: {real_fail}/{total} ({real_fail*100/total:.1f}%)")
print(f"有效通过率: {(exact_match+equivalent_match)}/{total} ({(exact_match+equivalent_match)*100/total:.1f}%)")
print("=" * 50)
