#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v4 Intent Pipeline E2E Test - Round 2
Different query phrasings to stress-test beyond the original 50.
Focuses on colloquial language, edge cases, and cross-category ambiguity.
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

def get_token():
    r = requests.post(f'{SERVER}/api/mobile/auth/unified-login', json={
        'username': 'factory_admin1', 'password': '123456'
    })
    data = r.json()
    if data.get('success'):
        return data['data']['accessToken']
    raise Exception(f"Login failed: {data}")

# Round 2 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # === 口语化/变体表达 ===
    ("今天谁请假了", ["ATTENDANCE_TODAY", "ATTENDANCE_ANOMALY"], "colloquial-attendance"),
    ("现在车间有多少人", ["ATTENDANCE_TODAY"], "colloquial-headcount"),
    ("帮我查下仓库还有多少面粉", ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY"], "colloquial-material"),
    ("机器坏了怎么报修", ["EQUIPMENT_MAINTENANCE"], "colloquial-equipment"),
    ("这批货什么时候到", ["SHIPMENT_QUERY", "ORDER_LIST"], "colloquial-shipment"),
    ("上个月赚了多少钱", ["REPORT_FINANCE"], "colloquial-finance"),
    ("谁今天迟到了", ["ATTENDANCE_TODAY", "ATTENDANCE_HISTORY", "ATTENDANCE_ANOMALY"], "colloquial-late"),
    ("原料快过期了吗", ["MATERIAL_EXPIRING_ALERT"], "colloquial-expiring"),
    ("今天质量检查过了没", ["QUALITY_CHECK_QUERY", "QUALITY_STATS"], "colloquial-quality"),

    # === 报表/统计类 ===
    ("本月销售额多少", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_FINANCE", "SHIPMENT_STATS"], "report-sales"),
    ("这周生产了多少", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY"], "report-weekly-prod"),
    ("看看利润趋势", ["REPORT_TRENDS", "REPORT_FINANCE"], "report-profit-trend"),
    ("月度KPI达标了吗", ["REPORT_KPI"], "report-kpi"),
    ("效率分析报告", ["REPORT_EFFICIENCY"], "report-efficiency"),
    ("库存周转率", ["REPORT_INVENTORY"], "report-inventory-turnover"),

    # === 生产批次类 ===
    ("当前在产的批次", ["PROCESSING_BATCH_LIST"], "batch-current"),
    ("新开一个批次", ["PROCESSING_BATCH_CREATE"], "batch-new"),
    ("批次BN001的进度", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY"], "batch-detail"),
    ("今天开了几个批次", ["PROCESSING_BATCH_LIST", "REPORT_PRODUCTION"], "batch-count"),
    ("生产完成了多少", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "batch-completion"),

    # === 设备类 ===
    ("A线设备正常吗", ["EQUIPMENT_STATUS_QUERY"], "equip-line-status"),
    ("设备保养到期了吗", ["EQUIPMENT_MAINTENANCE"], "equip-maintenance-due"),
    ("查看所有设备", ["EQUIPMENT_LIST"], "equip-list-all"),
    ("设备开机率多少", ["EQUIPMENT_STATS"], "equip-utilization"),
    ("哪个设备需要维修", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY"], "equip-need-repair"),

    # === 考勤类 ===
    ("今天到了多少人", ["ATTENDANCE_TODAY"], "attend-count"),
    ("上班签到", ["CLOCK_IN"], "attend-clockin"),
    ("我要下班了", ["CLOCK_OUT"], "attend-clockout"),
    ("本周考勤怎么样", ["ATTENDANCE_HISTORY", "ATTENDANCE_STATS"], "attend-weekly"),
    ("张三这个月迟到几次", ["ATTENDANCE_HISTORY"], "attend-person-hist"),

    # === 质量类 ===
    ("最近质检数据", ["QUALITY_CHECK_QUERY", "QUALITY_STATS"], "quality-recent"),
    ("做一次质检", ["QUALITY_CHECK_EXECUTE"], "quality-execute"),
    ("合格率统计", ["QUALITY_STATS"], "quality-pass-rate"),
    ("不合格产品有哪些", ["QUALITY_CHECK_QUERY", "QUALITY_STATS"], "quality-defects"),

    # === 告警类 ===
    ("有什么告警", ["ALERT_LIST", "ALERT_ACTIVE"], "alert-any"),
    ("未处理的告警", ["ALERT_ACTIVE", "ALERT_LIST"], "alert-active"),
    ("告警统计数据", ["ALERT_STATS"], "alert-stats"),

    # === 发货/订单类 ===
    ("查看发货记录", ["SHIPMENT_QUERY"], "shipment-history"),
    ("本月出货量", ["SHIPMENT_STATS"], "shipment-monthly"),
    ("有新订单吗", ["ORDER_LIST"], "order-new"),
    ("订单列表", ["ORDER_LIST"], "order-list"),

    # === 原料/仓库类 ===
    ("哪些原料库存不足", ["MATERIAL_LOW_STOCK_ALERT"], "material-low"),
    ("登记一批新原料", ["MATERIAL_BATCH_CREATE"], "material-register"),
    ("查看原料批次信息", ["MATERIAL_BATCH_QUERY"], "material-batch-info"),
    ("仓库出库记录", ["SHIPMENT_QUERY", "MATERIAL_BATCH_QUERY"], "warehouse-outbound"),

    # === 溯源类 ===
    ("产品溯源查询", ["TRACE_FULL", "TRACE_BATCH"], "trace-full"),
    ("追踪这个批次", ["TRACE_BATCH"], "trace-batch"),

    # === 供应商/客户类 ===
    ("供应商有哪些", ["SUPPLIER_LIST"], "supplier-list"),
    ("客户购买记录", ["CUSTOMER_PURCHASE_HISTORY"], "customer-history"),

    # === 边界测试 ===
    ("帮我查一下", ["NONE"], "edge-vague"),  # Too vague, should be NONE or clarification
]

def test_intent(token, query, expected_intents, category):
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

        # Handle NONE expected
        if 'NONE' in expected_intents and intent is None:
            return query, 'PASS', 'NONE', confidence, category, method

        passed = intent in expected_intents
        status = 'PASS' if passed else 'FAIL'
        return query, status, intent, confidence, category, method
    except Exception as e:
        return query, 'ERROR', None, None, category, str(e)

def main():
    print(f"=== v4 Intent Pipeline E2E Test - Round 2 ===")
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
        time.sleep(0.1)

    print(f"\n{'='*60}")
    print(f"Results: {pass_count} PASS / {fail_count} FAIL / {error_count} ERROR out of {len(TEST_CASES)}")
    print(f"Pass rate: {pass_count/len(TEST_CASES)*100:.1f}%")

    if fail_count > 0:
        print(f"\n--- Failed queries ---")
        for r in results:
            if r['status'] == 'FAIL':
                print(f"  \"{r['query']}\" => {r['intent']} (expected {r['expected']}) [{r['category']}] via {r['method']}")

    # Categorize by match method
    methods = {}
    for r in results:
        m = r.get('method') or 'NONE'
        methods[m] = methods.get(m, 0) + 1
    print(f"\n--- Match method distribution ---")
    for m, c in sorted(methods.items(), key=lambda x: -x[1]):
        print(f"  {m}: {c}")

    # Save report
    report = {
        'timestamp': datetime.now().isoformat(),
        'test': 'v4_round2',
        'total': len(TEST_CASES),
        'pass': pass_count,
        'fail': fail_count,
        'error': error_count,
        'pass_rate': pass_count/len(TEST_CASES)*100,
        'method_distribution': methods,
        'results': results
    }
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_path = f'tests/ai-intent/reports/v4_round2_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
