#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
并行批量测试 - 支持分批运行
用法: python parallel_batch_test.py <batch_id> <total_batches>
例如: python parallel_batch_test.py 1 4  # 运行第1批(共4批)
"""

import requests
import json
import sys
import time
import random
from datetime import datetime
from collections import defaultdict

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

SERVER = 'http://139.196.165.140:10010'
FACTORY_ID = 'F001'

# 意图模板 (简化版)
INTENT_TEMPLATES = {
    "REPORT_DASHBOARD_OVERVIEW": ["查看{time}的销售数据", "帮我看一下{time}业绩", "{time}销售报表"],
    "REPORT_INVENTORY": ["查看{time}库存", "{time}库存情况", "库存有多少"],
    "REPORT_EFFICIENCY": ["{time}生产效率", "效率报告{time}", "产线效率怎么样"],
    "REPORT_KPI": ["KPI指标{time}", "{time}经营指标", "核心指标汇总"],
    "REPORT_FINANCE": ["{time}财务报表", "财务数据{time}", "收支情况{time}"],
    "EQUIPMENT_STATUS_QUERY": ["设备运行状态", "查看设备情况", "设备{time}状态"],
    "EQUIPMENT_MAINTENANCE": ["设备维护记录", "{time}维护保养", "设备检修情况"],
    "PRODUCTION_STATUS_QUERY": ["生产进度{time}", "生产状态查询", "产线运行情况"],
    "PROCESSING_BATCH_TIMELINE": ["生产批次时间线", "批次生产进度", "批次状态跟踪"],
    "ATTENDANCE_TODAY": ["今天出勤情况", "今日打卡统计", "今天谁在"],
    "ATTENDANCE_STATS": ["{time}考勤统计", "考勤数据{time}", "出勤率统计"],
    "QUALITY_CHECK_QUERY": ["质检记录{time}", "质量检验数据", "查看质检报告"],
    "QUALITY_STATS": ["质量统计{time}", "质检合格率", "质量数据分析"],
    "ALERT_LIST": ["告警列表", "当前告警", "有什么告警"],
    "ALERT_STATS": ["告警统计{time}", "{time}告警数量", "告警分析报告"],
    "SHIPMENT_QUERY": ["发货记录{time}", "查看发货情况", "发货进度"],
    "SHIPMENT_STATS": ["发货统计{time}", "{time}出货量", "发货数据分析"],
    "MATERIAL_BATCH_QUERY": ["原料批次{time}", "查看原料信息", "原料入库记录"],
    "MATERIAL_LOW_STOCK_ALERT": ["低库存预警", "库存不足提醒", "缺货预警"],
    "MATERIAL_EXPIRING_ALERT": ["临期原料", "快过期原料", "临期预警"],
    "SUPPLIER_LIST": ["供应商列表", "查看供应商", "供应商名单"],
    "CUSTOMER_PURCHASE_HISTORY": ["客户采购记录", "客户订单历史", "{time}客户采购"],
    "TRACE_FULL": ["完整溯源信息", "产品溯源查询", "溯源记录"],
    "COST_QUERY": ["成本查询{time}", "{time}成本数据", "成本分析"],
}

TIME_VARIANTS = ["今天", "昨天", "本周", "上周", "本月", "上个月", "最近", ""]
PREFIXES = ["帮我查一下", "查一下", "看看", ""]

RELATED_INTENTS = {
    "ALERT_LIST": ["ALERT_ACTIVE", "ALERT_UNPROCESSED", "EQUIPMENT_ALERT_LIST"],
    "EQUIPMENT_STATUS_QUERY": ["EQUIPMENT_LIST", "EQUIPMENT_DETAIL"],
    "TRACE_FULL": ["TRACE_PUBLIC", "TRACE_BATCH", "TRACE_QUERY"],
    "MATERIAL_BATCH_QUERY": ["MATERIAL_BATCH_CREATE", "MATERIAL_QUERY"],
    "SHIPMENT_STATS": ["SHIPMENT_QUERY", "SHIPMENT_BY_DATE"],
    "SUPPLIER_LIST": ["SUPPLIER_EVALUATE", "SUPPLIER_QUERY"],
    "ATTENDANCE_STATS": ["ATTENDANCE_HISTORY", "ATTENDANCE_MONTHLY"],
    "PROCESSING_BATCH_TIMELINE": ["PROCESSING_BATCH_STATUS", "PRODUCTION_STATUS_QUERY"],
    "REPORT_DASHBOARD_OVERVIEW": ["REPORT_QUALITY", "REPORT_PRODUCTION"],
    "QUALITY_CHECK_QUERY": ["QUALITY_STATS", "EQUIPMENT_ALERT_STATS"],
    "QUALITY_STATS": ["QUALITY_CHECK_QUERY", "QUALITY_CRITICAL_ITEMS"],
}

def generate_test_cases(count, seed):
    """生成测试用例"""
    random.seed(seed)
    cases = []
    intents = list(INTENT_TEMPLATES.keys())

    for i in range(count):
        intent = intents[i % len(intents)]
        templates = INTENT_TEMPLATES[intent]
        template = random.choice(templates)
        time_var = random.choice(TIME_VARIANTS)
        prefix = random.choice(PREFIXES)

        text = template.format(time=time_var)
        if prefix and not text.startswith(("查", "看", "帮")):
            text = prefix + text
        text = text.replace("  ", " ").strip()

        cases.append({
            "id": i + 1,
            "userInput": text,
            "expectedIntent": intent,
        })

    random.shuffle(cases)
    return cases

def login():
    """登录"""
    try:
        r = requests.post(
            f'{SERVER}/api/mobile/auth/unified-login',
            json={'username': 'factory_admin1', 'password': '123456', 'factoryId': FACTORY_ID},
            timeout=30
        )
        data = r.json()
        if data.get('success'):
            return data.get('data', {}).get('accessToken')
    except Exception as e:
        print(f"登录失败: {e}")
    return None

def test_intent(case, headers, session_id):
    """测试单个意图"""
    try:
        r = requests.post(
            f'{SERVER}/api/mobile/{FACTORY_ID}/ai-intents/recognize',
            json={'userInput': case['userInput'], 'userId': 1, 'sessionId': session_id, 'topN': 5},
            headers=headers,
            timeout=60
        )
        data = r.json()
        if not data.get('success'):
            return False, None

        actual = data.get('data', {}).get('intentCode')
        expected = case.get('expectedIntent')

        if actual == expected:
            return True, actual
        if expected in RELATED_INTENTS and actual in RELATED_INTENTS[expected]:
            return True, actual
        return False, actual
    except:
        return False, None

def main():
    if len(sys.argv) < 3:
        print("用法: python parallel_batch_test.py <batch_id> <total_batches>")
        sys.exit(1)

    batch_id = int(sys.argv[1])
    total_batches = int(sys.argv[2])
    total_cases = 2000

    # 计算本批次范围
    batch_size = total_cases // total_batches
    start_idx = (batch_id - 1) * batch_size
    end_idx = start_idx + batch_size if batch_id < total_batches else total_cases

    print(f"=== 批次 {batch_id}/{total_batches} ===")
    print(f"范围: {start_idx+1} - {end_idx}")

    # 登录
    token = login()
    if not token:
        print("登录失败")
        sys.exit(1)

    # 生成测试用例 (使用固定seed确保一致性)
    all_cases = generate_test_cases(total_cases, seed=42)
    batch_cases = all_cases[start_idx:end_idx]

    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    session_id = f"batch_{batch_id}_{datetime.now().strftime('%H%M%S')}"

    passed = 0
    for i, case in enumerate(batch_cases, 1):
        ok, actual = test_intent(case, headers, session_id)
        if ok:
            passed += 1

        if i % 50 == 0:
            rate = passed / i * 100
            print(f"[{i}/{len(batch_cases)}] 通过: {passed} ({rate:.1f}%)")

    # 输出结果
    total = len(batch_cases)
    accuracy = passed / total * 100

    print(f"\n=== 批次 {batch_id} 完成 ===")
    print(f"通过: {passed}/{total} ({accuracy:.1f}%)")

    # 保存结果
    result = {
        "batch_id": batch_id,
        "total_batches": total_batches,
        "range": f"{start_idx+1}-{end_idx}",
        "total": total,
        "passed": passed,
        "accuracy": accuracy
    }

    with open(f"reports/batch_{batch_id}_result.json", 'w') as f:
        json.dump(result, f)

    print(f"结果已保存: reports/batch_{batch_id}_result.json")

if __name__ == '__main__':
    main()
