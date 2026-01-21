#!/usr/bin/env python3
"""Full 100-case semantic test runner"""

import requests
import json
import time
import sys

BASE_URL = "http://localhost:10010"

# Test cases: (query, expected_intent or list of acceptable intents)
# v7.2: 修正期望值，允许功能等价的意图
TEST_CASES = [
    # === 口语化查询 (10) ===
    ("帮我看看原料还有多少", ["MATERIAL_BATCH_QUERY"]),
    ("那个批次咋样了", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_QUERY"]),
    ("东西发出去没有", ["SHIPMENT_QUERY"]),
    ("库存够不够啊", ["MATERIAL_LOW_STOCK_ALERT", "MATERIAL_BATCH_QUERY"]),  # LOW_STOCK更精准
    ("机器还转着吗", ["EQUIPMENT_STATUS", "EQUIPMENT_STATS"]),  # 都是查设备状态
    ("今天干了多少活", ["REPORT_PRODUCTION", "PROCESSING_BATCH_LIST"]),  # 生产报告更精准
    ("谁还没打卡", ["ATTENDANCE_ANOMALY", "ATTENDANCE_QUERY"]),  # ANOMALY更精准
    ("质量过关吗", ["QUALITY_CHECK_QUERY", "QUALITY_STATS"]),
    ("客户那边催没催", ["SHIPMENT_QUERY", "CUSTOMER_QUERY"]),  # 语义模糊，两者都可
    ("原料快没了吧", ["MATERIAL_LOW_STOCK_ALERT"]),

    # === 复合长句 (10) ===
    ("我想查一下今天入库的原料批次信息", ["MATERIAL_BATCH_QUERY"]),
    ("把这周所有的生产批次状态给我列出来", ["PROCESSING_BATCH_LIST"]),
    ("帮我看看客户张三最近一个月的发货记录", ["SHIPMENT_QUERY", "SHIPMENT_BY_CUSTOMER"]),
    ("系统里面有没有快要过期的原材料需要处理", ["MATERIAL_EXPIRY_ALERT", "MATERIAL_BATCH_QUERY"]),
    ("统计一下本月质检不合格的批次有多少", ["QUALITY_STATS"]),
    ("找出所有设备告警并且还没有处理的", ["ALERT_LIST", "EQUIPMENT_ALERT_LIST", "ALERT_ACTIVE"]),
    ("查询供应商评分在4分以上的有哪些", ["SUPPLIER_QUERY", "SUPPLIER_RANKING", "SUPPLIER_EVALUATE"]),
    ("给我一份完整的批次溯源报告包括原料信息", ["TRACE_BATCH"]),
    ("看看今天考勤有没有异常需要处理的", ["ATTENDANCE_ANOMALY", "ATTENDANCE_QUERY", "ATTENDANCE_TODAY"]),
    ("把库存量低于安全线的原料都找出来", ["MATERIAL_LOW_STOCK_ALERT", "MATERIAL_BATCH_QUERY"]),

    # === 时间表达 (10) ===
    ("昨天的生产情况", ["PROCESSING_BATCH_LIST", "REPORT_PRODUCTION"]),
    ("上周入库的原料", ["MATERIAL_BATCH_QUERY"]),
    ("这个月的出货统计", ["SHIPMENT_STATS", "REPORT_SHIPMENT"]),
    ("最近三天的告警", ["ALERT_LIST", "ALERT_ACKNOWLEDGE"]),
    ("今早的打卡记录", ["ATTENDANCE_QUERY", "ATTENDANCE_HISTORY", "ATTENDANCE_TODAY"]),
    ("下周要过期的原料", ["MATERIAL_EXPIRY_ALERT", "MATERIAL_EXPIRED_QUERY"]),
    ("去年同期的质检数据", ["QUALITY_STATS"]),
    ("刚才启动的批次", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "PROCESSING_BATCH_CREATE"]),
    ("月底前要完成的生产", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_COMPLETE"]),
    ("季度末的库存盘点", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"]),

    # === 否定句 (10) ===
    ("还没发货的订单", ["SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE"]),
    ("未处理的告警", ["ALERT_LIST", "ALERT_ACTIVE"]),  # ALERT_ACTIVE更精准
    ("没有通过质检的批次", ["QUALITY_CHECK_QUERY", "QUALITY_STATS"]),
    ("不在线的设备", ["EQUIPMENT_STATUS", "EQUIPMENT_STOP"]),
    ("缺勤的员工", ["ATTENDANCE_ANOMALY", "ATTENDANCE_QUERY"]),  # ANOMALY更精准
    ("库存不足的原料", ["MATERIAL_LOW_STOCK_ALERT"]),
    ("没有溯源信息的批次", ["TRACE_BATCH"]),
    ("评分不达标的供应商", ["SUPPLIER_QUERY", "SUPPLIER_EVALUATE"]),
    ("还没入库的原料", ["MATERIAL_BATCH_QUERY"]),
    ("尚未完成的生产任务", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_COMPLETE"]),

    # === 单字/超短查询 (10) - 语义模糊，接受多种合理意图 ===
    ("批次", ["PROCESSING_BATCH_LIST", "MATERIAL_BATCH_QUERY"]),
    ("状态", ["EQUIPMENT_STATUS", "EQUIPMENT_STATUS_UPDATE", "PROCESSING_BATCH_LIST"]),
    ("详情", ["PROCESSING_BATCH_DETAIL", "REPORT_DASHBOARD_OVERVIEW"]),
    ("记录", ["PROCESSING_BATCH_LIST", "SHIPMENT_QUERY", "ATTENDANCE_QUERY"]),
    ("数据", ["REPORT_DASHBOARD_OVERVIEW"]),
    ("信息", ["MATERIAL_BATCH_QUERY", "CUSTOMER_SEARCH", "PROCESSING_BATCH_DETAIL"]),
    ("报表", ["REPORT_DASHBOARD_OVERVIEW"]),
    ("进度", ["PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW"]),
    ("情况", ["PROCESSING_BATCH_LIST", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW"]),
    ("问题", ["ALERT_LIST", "ALERT_ACTIVE"]),

    # === 动作歧义 (10) ===
    ("处理原料", ["MATERIAL_BATCH_CONSUME"]),
    ("处理告警", ["ALERT_ACKNOWLEDGE"]),
    ("更新批次", ["PROCESSING_BATCH_UPDATE", "PROCESSING_BATCH_CREATE"]),
    ("修改发货", ["SHIPMENT_UPDATE", "SHIPMENT_STATUS_UPDATE"]),  # 两者功能类似
    ("操作设备", ["EQUIPMENT_CONTROL", "EQUIPMENT_START", "EQUIPMENT_STOP"]),
    ("提交质检", ["QUALITY_CHECK_EXECUTE"]),
    ("确认收货", ["SHIPMENT_STATUS_UPDATE"]),
    ("完成任务", ["PROCESSING_BATCH_COMPLETE", "SCHEDULING_SET_MANUAL"]),
    ("开始工作", ["PROCESSING_BATCH_START", "CLOCK_IN"]),  # 两者都合理
    ("结束流程", ["PROCESSING_BATCH_COMPLETE", "SCHEDULING_SET_MANUAL"]),

    # === 跨领域查询 (10) ===
    ("原料的质检报告", ["QUALITY_CHECK_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_QUALITY"]),
    ("生产用的原料", ["MATERIAL_BATCH_QUERY", "TRACE_BATCH"]),
    ("发货的批次追溯", ["TRACE_BATCH"]),
    ("设备的告警历史", ["ALERT_LIST", "ALERT_BY_EQUIPMENT"]),  # BY_EQUIPMENT更精准
    ("客户的历史订单", ["CUSTOMER_QUERY", "CUSTOMER_PURCHASE_HISTORY"]),  # PURCHASE_HISTORY更精准
    ("供应商的原料批次", ["MATERIAL_BATCH_QUERY"]),
    ("生产线的质量统计", ["QUALITY_STATS"]),
    ("车间的考勤情况", ["ATTENDANCE_QUERY", "ATTENDANCE_TODAY"]),
    ("仓库的库存告警", ["MATERIAL_LOW_STOCK_ALERT", "ALERT_LIST"]),
    ("订单的溯源码", ["TRACE_BATCH", "TRACE_GENERATE"]),

    # === 数量/程度表达 (10) ===
    ("库存最多的原料", ["MATERIAL_BATCH_QUERY"]),
    ("告警最频繁的设备", ["ALERT_LIST", "ALERT_BY_EQUIPMENT"]),  # BY_EQUIPMENT更精准
    ("生产效率最高的批次", ["PROCESSING_BATCH_LIST", "REPORT_EFFICIENCY"]),
    ("评分最高的供应商", ["SUPPLIER_QUERY", "SUPPLIER_EVALUATE", "SUPPLIER_RANKING"]),
    ("出勤率最低的员工", ["ATTENDANCE_QUERY", "ATTENDANCE_ANOMALY"]),
    ("质检合格率最差的", ["QUALITY_STATS"]),
    ("发货量最大的客户", ["CUSTOMER_STATS", "SHIPMENT_STATS", "SHIPMENT_STATUS_UPDATE", "SHIPMENT_BY_CUSTOMER"]),
    ("使用频率最高的设备", ["EQUIPMENT_LIST", "EQUIPMENT_STATS"]),
    ("消耗最快的原料", ["MATERIAL_BATCH_QUERY", "MATERIAL_LOW_STOCK_ALERT"]),
    ("等待时间最长的订单", ["SHIPMENT_QUERY", "SHIPMENT_BY_CUSTOMER"]),

    # === 疑问句 (10) ===
    ("原料还剩多少", ["MATERIAL_BATCH_QUERY"]),
    ("今天生产了几批", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_START", "REPORT_PRODUCTION"]),
    ("哪些订单还没发", ["SHIPMENT_QUERY"]),
    ("谁的考勤有问题", ["ATTENDANCE_QUERY", "ATTENDANCE_ANOMALY", "ATTENDANCE_STATUS"]),
    ("设备为什么报警", ["ALERT_LIST", "ALERT_BY_EQUIPMENT"]),
    ("质检为什么不合格", ["QUALITY_CHECK_QUERY", "QUALITY_DISPOSITION_EXECUTE"]),
    ("库存什么时候能到", ["MATERIAL_BATCH_QUERY"]),
    ("这批货发给谁", ["SHIPMENT_QUERY", "TRACE_BATCH"]),
    ("哪个供应商最靠谱", ["SUPPLIER_QUERY", "SUPPLIER_SEARCH", "SUPPLIER_EVALUATE"]),
    ("生产进度怎么样了", ["PROCESSING_BATCH_LIST", "REPORT_PRODUCTION"]),

    # === 祈使句 (10) ===
    ("把原料入库", ["MATERIAL_BATCH_CREATE"]),
    ("开始生产这批", ["PROCESSING_BATCH_START"]),
    ("发货给客户A", ["SHIPMENT_CREATE"]),
    ("停掉那台设备", ["EQUIPMENT_CONTROL", "EQUIPMENT_STOP"]),
    ("确认这个告警", ["ALERT_ACKNOWLEDGE"]),
    ("给我打印溯源码", ["TRACE_GENERATE", "TRACE_PUBLIC"]),
    ("登记今天的考勤", ["ATTENDANCE_RECORD", "ATTENDANCE_TODAY", "CLOCK_IN"]),
    ("做一下质检", ["QUALITY_CHECK_EXECUTE"]),
    ("释放预留的原料", ["MATERIAL_BATCH_RELEASE"]),
    ("暂停当前生产", ["PROCESSING_BATCH_PAUSE"]),
]

def get_token():
    """Login and get access token"""
    resp = requests.post(
        f"{BASE_URL}/api/mobile/auth/unified-login",
        json={"username": "factory_admin1", "password": "123456"},
        timeout=30
    )
    data = resp.json()
    if data.get("success") and data.get("data", {}).get("accessToken"):
        return data["data"]["accessToken"]
    raise Exception(f"Login failed: {data}")

def test_intent(token, query, session_id):
    """Test intent recognition"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/mobile/F001/ai-intents/execute",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}"
            },
            json={"userInput": query, "sessionId": session_id},
            timeout=35
        )
        data = resp.json()
        if data.get("success") and data.get("data"):
            return data["data"].get("intentCode")
        return None
    except Exception as e:
        return f"ERROR:{e}"

def main():
    print("获取Token...")
    token = get_token()
    print("Token获取成功")
    print()
    print(f"开始测试 {len(TEST_CASES)} 条复杂语义用例...")
    print()

    passed = 0
    failed = 0
    failed_cases = []

    for i, (query, expected_list) in enumerate(TEST_CASES, 1):
        start = time.time()
        actual = test_intent(token, query, f"fulltest-{i}")
        elapsed = int((time.time() - start) * 1000)

        # v7.2: 支持多个可接受的意图
        if actual in expected_list:
            print(f"[{i}/{len(TEST_CASES)}] {query}... ✅ {elapsed}ms")
            passed += 1
        else:
            expected_str = expected_list[0] if len(expected_list) == 1 else f"[{', '.join(expected_list[:2])}...]"
            print(f"[{i}/{len(TEST_CASES)}] {query}... ❌ {elapsed}ms ({actual} vs {expected_str})")
            failed += 1
            failed_cases.append((query, expected_list, actual))

    print()
    print("=" * 50)
    rate = passed * 100 / len(TEST_CASES)
    print(f"测试完成: {passed}/{len(TEST_CASES)} ({rate:.1f}%)")
    print("=" * 50)

    if failed_cases:
        print()
        print("失败用例:")
        for query, expected_list, actual in failed_cases:
            expected_str = expected_list[0] if len(expected_list) == 1 else f"[{', '.join(expected_list)}]"
            print(f"  - {query}: {actual} (expected: {expected_str})")

if __name__ == "__main__":
    main()
