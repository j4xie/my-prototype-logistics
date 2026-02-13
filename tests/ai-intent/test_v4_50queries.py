#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v4 Intent Pipeline E2E Test - 50 queries
Tests phrase mapping fixes (Part A) and new phrase additions (Part B).
"""

import requests
import json
import sys
import time
from datetime import datetime

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SERVER = 'http://47.100.235.168:10010'
FACTORY_ID = 'F001'

# Login to get token
def get_token():
    r = requests.post(f'{SERVER}/api/mobile/auth/unified-login', json={
        'username': 'factory_admin1', 'password': '123456'
    })
    data = r.json()
    if data.get('success'):
        return data['data']['accessToken']
    raise Exception(f"Login failed: {data}")

# Test cases: (query, expected_intents, category)
# expected_intents is a list of acceptable intents
TEST_CASES = [
    # === Part A: Previously wrong phrase matches ===
    # A1: "建生产批次" should be CREATE
    ("帮我建一个生产批次", ["PROCESSING_BATCH_CREATE"], "A1-create-batch"),
    ("建一个生产批次", ["PROCESSING_BATCH_CREATE"], "A1-create-batch"),
    ("帮我建生产批次", ["PROCESSING_BATCH_CREATE"], "A1-create-batch"),
    # A2: "入库记录" should be QUERY
    ("原料出入库记录", ["MATERIAL_BATCH_QUERY"], "A2-inbound-record"),
    ("入库记录", ["MATERIAL_BATCH_QUERY"], "A2-inbound-record"),
    # A3: "低库存提醒" should be ALERT
    ("低库存提醒", ["MATERIAL_LOW_STOCK_ALERT"], "A3-low-stock"),
    ("低库存预警", ["MATERIAL_LOW_STOCK_ALERT"], "A3-low-stock"),
    # A4: "盘点库存" should be QUERY
    ("盘点库存", ["MATERIAL_BATCH_QUERY"], "A4-inventory-check"),
    # A5: "发货量" should be STATS
    ("最近发货量怎么样", ["SHIPMENT_STATS"], "A5-shipment-stats"),
    ("发货量", ["SHIPMENT_STATS"], "A5-shipment-stats"),
    ("发货量对比", ["SHIPMENT_STATS"], "A5-shipment-stats"),
    # A6: "谁没来" should be ATTENDANCE_TODAY
    ("谁还没来上班", ["ATTENDANCE_TODAY"], "A6-who-absent"),
    ("谁没来", ["ATTENDANCE_TODAY"], "A6-who-absent"),
    # A8: "出勤率" should be STATS
    ("上个月出勤率", ["ATTENDANCE_STATS"], "A8-attendance-rate"),
    ("工人出勤率", ["ATTENDANCE_STATS"], "A8-attendance-rate"),
    ("出勤率", ["ATTENDANCE_STATS"], "A8-attendance-rate"),

    # === Part B: Previously NONE responses ===
    # B1: 待发货 → ORDER_LIST
    ("待发货的订单有几个", ["ORDER_LIST"], "B1-pending-shipment"),
    ("待发货订单", ["ORDER_LIST"], "B1-pending-shipment"),
    # B2: 排产 → PROCESSING_BATCH_CREATE
    ("帮我安排一下明天的排产", ["PROCESSING_BATCH_CREATE"], "B2-scheduling"),
    ("安排排产", ["PROCESSING_BATCH_CREATE"], "B2-scheduling"),
    ("排产", ["PROCESSING_BATCH_CREATE"], "B2-scheduling"),
    # B3: 产量对比 → REPORT_PRODUCTION
    ("这周产量比上周怎样", ["REPORT_PRODUCTION"], "B3-production-compare"),
    ("产量对比", ["REPORT_PRODUCTION"], "B3-production-compare"),
    # B4: 客户下单 → ORDER_LIST
    ("客户下单了没", ["ORDER_LIST"], "B4-customer-order"),
    ("客户下单", ["ORDER_LIST"], "B4-customer-order"),
    # B5: 上线人数 → ATTENDANCE_TODAY
    ("上线人数", ["ATTENDANCE_TODAY"], "B5-headcount"),
    ("上岗人数", ["ATTENDANCE_TODAY"], "B5-headcount"),
    ("到岗几人", ["ATTENDANCE_TODAY"], "B5-headcount"),

    # === Regression tests: queries that previously passed ===
    ("今天出勤情况", ["ATTENDANCE_TODAY"], "reg-attendance"),
    ("今天谁来了", ["ATTENDANCE_TODAY"], "reg-attendance"),
    ("今天到岗情况", ["ATTENDANCE_TODAY"], "reg-attendance"),
    ("查看设备运行状态", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS"], "reg-equipment"),
    ("设备故障率统计", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATS"], "reg-equipment"),
    ("今天产量多少", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "reg-production"),
    ("生产批次列表", ["PROCESSING_BATCH_LIST"], "reg-batch-list"),
    ("质检合格率", ["QUALITY_STATS"], "reg-quality"),
    ("发货进度", ["SHIPMENT_QUERY"], "reg-shipment"),
    ("库存有多少", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "reg-inventory"),
    ("打卡", ["CLOCK_IN"], "reg-clockin"),
    ("下班了", ["CLOCK_OUT"], "reg-clockout"),
    ("告警列表", ["ALERT_LIST", "ALERT_ACTIVE"], "reg-alert"),
    ("原料入库", ["MATERIAL_BATCH_CREATE"], "reg-material-create"),
    ("新建批次", ["PROCESSING_BATCH_CREATE"], "reg-batch-create"),
    ("考勤历史", ["ATTENDANCE_HISTORY"], "reg-attendance-hist"),
    ("供应商列表", ["SUPPLIER_LIST"], "reg-supplier"),
    ("临期原料", ["MATERIAL_EXPIRING_ALERT"], "reg-expiring"),
    ("KPI指标", ["REPORT_KPI"], "reg-kpi"),
    ("财务报表", ["REPORT_FINANCE"], "reg-finance"),
    ("生产效率", ["REPORT_EFFICIENCY"], "reg-efficiency"),
    ("设备列表", ["EQUIPMENT_LIST"], "reg-equip-list"),
]

def test_intent(token, query, expected_intents, category):
    """Call the AI intent API and check if result matches expected."""
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    try:
        r = requests.post(
            f'{SERVER}/api/mobile/{FACTORY_ID}/ai-intents/recognize',
            headers=headers,
            json={'userInput': query},
            timeout=15
        )
        data = r.json()
        if not data.get('success'):
            return query, 'ERROR', None, None, category, data.get('message', 'unknown')

        intent_data = data.get('data', {})
        intent = intent_data.get('intentCode', 'NONE')
        confidence = intent_data.get('confidence', 0)
        method = intent_data.get('matchMethod', 'unknown')

        passed = intent in expected_intents
        status = 'PASS' if passed else 'FAIL'
        return query, status, intent, confidence, category, method
    except Exception as e:
        return query, 'ERROR', None, None, category, str(e)

def main():
    print(f"=== v4 Intent Pipeline E2E Test ===")
    print(f"Server: {SERVER}")
    print(f"Time: {datetime.now().isoformat()}")
    print(f"Total queries: {len(TEST_CASES)}")
    print()

    token = get_token()
    print(f"Token acquired.\n")

    results = []
    pass_count = 0
    fail_count = 0
    error_count = 0

    for i, (query, expected, category) in enumerate(TEST_CASES):
        q, status, intent, conf, cat, method = test_intent(token, query, expected, category)
        results.append({
            'query': q, 'status': status, 'intent': intent,
            'confidence': conf, 'expected': expected, 'category': cat, 'method': method
        })

        if status == 'PASS':
            pass_count += 1
            icon = 'OK'
        elif status == 'FAIL':
            fail_count += 1
            icon = 'FAIL'
        else:
            error_count += 1
            icon = 'ERR'

        conf_str = f"{conf:.2f}" if conf is not None else "N/A"
        print(f"  [{icon}] [{cat}] \"{q}\" => {intent} ({conf_str}) via {method}" +
              (f"  (expected: {expected})" if status != 'PASS' else ""))
        time.sleep(0.1)  # Rate limit

    print(f"\n{'='*60}")
    print(f"Results: {pass_count} PASS / {fail_count} FAIL / {error_count} ERROR out of {len(TEST_CASES)}")
    print(f"Pass rate: {pass_count/len(TEST_CASES)*100:.1f}%")

    if fail_count > 0:
        print(f"\n--- Failed queries ---")
        for r in results:
            if r['status'] == 'FAIL':
                print(f"  \"{r['query']}\" => {r['intent']} (expected {r['expected']}) via {r['method']}")

    # Save results
    report = {
        'timestamp': datetime.now().isoformat(),
        'total': len(TEST_CASES),
        'pass': pass_count,
        'fail': fail_count,
        'error': error_count,
        'pass_rate': pass_count/len(TEST_CASES)*100,
        'results': results
    }
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_path = f'tests/ai-intent/reports/v4_test_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
