#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 50
Focus: COMPREHENSIVE MIX - milestone round combining all domains.
       Covers production, quality, inventory, equipment, order,
       HR/attendance, finance, supplier, alert/system, traceability.
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

# Round 50 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Production (5 cases) =====
    ("A线今天产了多少",
     ["PRODUCTION_STATS", "BATCH_QUERY", "REPORT_PRODUCTION", "PRODUCTION_LINE_STATUS", None],
     "production"),
    ("产量达标了吗",
     ["PRODUCTION_STATS", "REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_KPI", None],
     "production"),
    ("哪条线效率最高",
     ["PRODUCTION_LINE_STATUS", "PRODUCTION_STATS", "REPORT_PRODUCTION", "EQUIPMENT_OEE_QUERY", "REPORT_EFFICIENCY", None],
     "production"),
    ("生产异常了",
     ["ALERT_LIST", "PRODUCTION_LINE_STATUS", "ALERT_DIAGNOSE", "PRODUCTION_STATS", None],
     "production"),
    ("今天的排产",
     ["SCHEDULING_QUERY", "PRODUCTION_PLAN_QUERY", "PRODUCTION_STATS", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None],
     "production"),

    # ===== 2. Quality (5 cases) =====
    ("质检通过率多少",
     ["QUALITY_STATS", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "QUALITY_CHECK_LIST", None],
     "quality"),
    ("有不合格品吗",
     ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", "QUALITY_STATS", "ALERT_LIST", None],
     "quality"),
    ("检验报告出来了吗",
     ["REPORT_QUALITY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "FOOD_SAFETY_CERT_QUERY", "QUALITY_STATS", None],
     "quality"),
    ("质量最好的批次",
     ["QUALITY_STATS", "QUALITY_CHECK_QUERY", "BATCH_QUERY", "REPORT_QUALITY", None],
     "quality"),
    ("食品安全检查",
     ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_STATS", None],
     "quality"),

    # ===== 3. Inventory (5 cases) =====
    ("仓库还有多少货",
     ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "INVENTORY_STATS", "REPORT_INVENTORY", None],
     "inventory"),
    ("哪些东西快用完了",
     ["INVENTORY_ALERT", "INVENTORY_QUERY", "ALERT_LIST", "MATERIAL_BATCH_QUERY", "MATERIAL_LOW_STOCK_ALERT", None],
     "inventory"),
    ("今天入了多少料",
     ["INVENTORY_INBOUND", "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "INVENTORY_STATS", None],
     "inventory"),
    ("库存金额多少",
     ["INVENTORY_STATS", "INVENTORY_QUERY", "REPORT_INVENTORY", "COST_QUERY", None],
     "inventory"),
    ("先进先出执行情况",
     ["INVENTORY_QUERY", "INVENTORY_STATS", "TRACEABILITY_QUERY", "MATERIAL_BATCH_QUERY", "MATERIAL_FIFO_RECOMMEND", None],
     "inventory"),

    # ===== 4. Equipment (5 cases) =====
    ("设备都正常吗",
     ["EQUIPMENT_STATUS", "EQUIPMENT_LIST", "ALERT_LIST", "PRODUCTION_LINE_STATUS", "EQUIPMENT_STATUS_QUERY", None],
     "equipment"),
    ("哪台机器坏了",
     ["EQUIPMENT_STATUS", "EQUIPMENT_FAULT", "ALERT_LIST", "EQUIPMENT_LIST", "EQUIPMENT_MAINTENANCE", None],
     "equipment"),
    ("维修安排",
     ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_FAULT", "EQUIPMENT_STATUS", "SCHEDULING_QUERY", None],
     "equipment"),
    ("设备效率怎么样",
     ["EQUIPMENT_OEE_QUERY", "EQUIPMENT_STATUS", "REPORT_PRODUCTION", "PRODUCTION_STATS", "REPORT_EFFICIENCY", None],
     "equipment"),
    ("需要保养的设备",
     ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS", "EQUIPMENT_LIST", "ALERT_LIST", None],
     "equipment"),

    # ===== 5. Order (5 cases) =====
    ("新订单有几个",
     ["ORDER_QUERY", "ORDER_LIST", "ORDER_STATS", "REPORT_DASHBOARD_OVERVIEW", None],
     "order"),
    ("哪个订单最急",
     ["ORDER_QUERY", "ORDER_LIST", "ORDER_PRIORITY", "ALERT_LIST", None],
     "order"),
    ("发货了没有",
     ["ORDER_QUERY", "ORDER_SHIPPING", "ORDER_STATUS", "INVENTORY_OUTBOUND", "SHIPMENT_QUERY", None],
     "order"),
    ("客户催单了",
     ["ORDER_QUERY", "ALERT_LIST", "ORDER_LIST", "CUSTOMER_STATS", "ORDER_STATUS", None],
     "order"),
    ("订单完成情况",
     ["ORDER_STATS", "ORDER_QUERY", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", "ORDER_UPDATE", None],
     "order"),

    # ===== 6. HR/Attendance (5 cases) =====
    ("今天出勤怎么样",
     ["ATTENDANCE_QUERY", "ATTENDANCE_STATS", "HR_STATS", "REPORT_ATTENDANCE", "ATTENDANCE_TODAY", None],
     "hr_attendance"),
    ("加班多少小时",
     ["ATTENDANCE_QUERY", "ATTENDANCE_STATS", "HR_STATS", "OVERTIME_QUERY", None],
     "hr_attendance"),
    ("哪个部门缺人",
     ["HR_STATS", "ATTENDANCE_STATS", "ATTENDANCE_QUERY", "REPORT_ATTENDANCE", None],
     "hr_attendance"),
    ("请假的有谁",
     ["ATTENDANCE_QUERY", "ATTENDANCE_STATS", "HR_STATS", "LEAVE_QUERY", None],
     "hr_attendance"),
    ("绩效排名",
     ["HR_STATS", "REPORT_PERSONNEL", "PERFORMANCE_QUERY", "ATTENDANCE_STATS", "REPORT_KPI", None],
     "hr_attendance"),

    # ===== 7. Finance (5 cases) =====
    ("这个月成本多少",
     ["COST_QUERY", "COST_STATS", "REPORT_COST", "REPORT_DASHBOARD_OVERVIEW", "REPORT_FINANCE", None],
     "finance"),
    ("利润怎么样",
     ["COST_STATS", "COST_QUERY", "REPORT_COST", "REPORT_DASHBOARD_OVERVIEW", None],
     "finance"),
    ("费用超标了吗",
     ["COST_QUERY", "COST_STATS", "ALERT_LIST", "REPORT_COST", None],
     "finance"),
    ("营收情况",
     ["COST_STATS", "REPORT_DASHBOARD_OVERVIEW", "REPORT_COST", "COST_QUERY", None],
     "finance"),
    ("预算还剩多少",
     ["COST_QUERY", "COST_STATS", "REPORT_COST", "REPORT_DASHBOARD_OVERVIEW", None],
     "finance"),

    # ===== 8. Supplier (5 cases) =====
    ("供应商评分看看",
     ["SUPPLIER_EVALUATE", "SUPPLIER_QUERY", "SUPPLIER_LIST", "REPORT_QUALITY", "SUPPLIER_RANKING", None],
     "supplier"),
    ("哪家货最好",
     ["SUPPLIER_EVALUATE", "SUPPLIER_QUERY", "QUALITY_STATS", "SUPPLIER_LIST", None],
     "supplier"),
    ("采购进度",
     ["PROCUREMENT_QUERY", "SUPPLIER_QUERY", "ORDER_QUERY", "MATERIAL_BATCH_QUERY", None],
     "supplier"),
    ("原料价格变了没",
     ["PROCUREMENT_QUERY", "SUPPLIER_QUERY", "COST_QUERY", "MATERIAL_BATCH_QUERY", None],
     "supplier"),
    ("合同快到期了",
     ["SUPPLIER_QUERY", "SUPPLIER_EVALUATE", "ALERT_LIST", "PROCUREMENT_QUERY", None],
     "supplier"),

    # ===== 9. Alert/System (5 cases) =====
    ("有什么告警",
     ["ALERT_LIST", "ALERT_DIAGNOSE", "PRODUCTION_LINE_STATUS", "EQUIPMENT_STATUS", None],
     "alert_system"),
    ("系统正常吗",
     ["SYSTEM_STATUS", "ALERT_LIST", "EQUIPMENT_STATUS", "REPORT_DASHBOARD_OVERVIEW", "ALERT_ACTIVE", None],
     "alert_system"),
    ("最近的异常",
     ["ALERT_LIST", "ALERT_DIAGNOSE", "QUALITY_STATS", "PRODUCTION_LINE_STATUS", None],
     "alert_system"),
    ("需要处理的事项",
     ["ALERT_LIST", "ORDER_QUERY", "APPROVAL_QUERY", "TASK_QUERY", None],
     "alert_system"),
    ("通知看一下",
     ["ALERT_LIST", "NOTIFICATION_QUERY", "APPROVAL_QUERY", "SYSTEM_STATUS", "FACTORY_NOTIFICATION_CONFIG", None],
     "alert_system"),

    # ===== 10. Traceability (5 cases) =====
    ("这批货从哪来的",
     ["TRACEABILITY_QUERY", "MATERIAL_BATCH_QUERY", "BATCH_QUERY", "SUPPLIER_QUERY", "SUPPLIER_LIST", None],
     "traceability"),
    ("追溯一下这个批次",
     ["TRACEABILITY_QUERY", "BATCH_QUERY", "MATERIAL_BATCH_QUERY", "QUALITY_CHECK_QUERY", "TRACE_BATCH", None],
     "traceability"),
    ("溯源码查询",
     ["TRACEABILITY_QUERY", "BATCH_QUERY", "MATERIAL_BATCH_QUERY", "LABEL_QUERY", "TRACE_BATCH", None],
     "traceability"),
    ("食品追溯报告",
     ["TRACEABILITY_QUERY", "REPORT_QUALITY", "FOOD_SAFETY_CERT_QUERY", "BATCH_QUERY", "TRACE_PUBLIC", None],
     "traceability"),
    ("问题产品追踪",
     ["TRACEABILITY_QUERY", "QUALITY_DISPOSITION_EXECUTE", "ALERT_DIAGNOSE", "BATCH_QUERY", None],
     "traceability"),
]

def test_intent(token, query, expected_intents, category):
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    start_time = time.time()
    try:
        r = requests.post(
            f'{SERVER}/api/mobile/{FACTORY_ID}/ai-intents/recognize',
            headers=headers,
            json={'userInput': query},
            timeout=25
        )
        latency = time.time() - start_time
        data = r.json()
        if not data.get('success'):
            return query, 'ERROR', None, None, category, data.get('message', 'unknown'), latency

        intent_data = data.get('data', {})
        intent = intent_data.get('intentCode', 'NONE')
        confidence = intent_data.get('confidence', 0)
        method = intent_data.get('matchMethod', 'unknown')

        passed = intent in expected_intents
        status = 'PASS' if passed else 'FAIL'
        return query, status, intent, confidence, category, method, latency
    except requests.exceptions.Timeout:
        latency = time.time() - start_time
        return query, 'ERROR', None, None, category, 'TIMEOUT', latency
    except Exception as e:
        latency = time.time() - start_time
        return query, 'ERROR', None, None, category, str(e), latency

def main():
    print(f"=== v5 Intent Pipeline E2E Test - Round 50 ===")
    print(f"Focus: COMPREHENSIVE MIX - milestone round combining all domains")
    print(f"       (production, quality, inventory, equipment, order,")
    print(f"        HR/attendance, finance, supplier, alert/system, traceability)")
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
    categories = {}

    for i, (query, expected, category) in enumerate(TEST_CASES):
        q, status, intent, conf, cat, method, latency = test_intent(token, query, expected, category)
        results.append({
            'query': q, 'status': status, 'intent': intent,
            'confidence': conf, 'expected': expected, 'category': cat,
            'method': method, 'latency_ms': round(latency * 1000)
        })

        cat_group = cat.split('-')[0]
        if cat_group not in categories:
            categories[cat_group] = {'pass': 0, 'fail': 0, 'error': 0}

        if status == 'PASS':
            pass_count += 1
            categories[cat_group]['pass'] += 1
            icon = 'OK'
        elif status == 'FAIL':
            fail_count += 1
            categories[cat_group]['fail'] += 1
            icon = 'FAIL'
        else:
            error_count += 1
            categories[cat_group]['error'] += 1
            icon = 'ERR'

        conf_str = f"{conf:.2f}" if conf is not None else "N/A"
        lat_str = f"{latency*1000:.0f}ms"
        print(f"  [{icon}] [{cat}] \"{q}\" => {intent} ({conf_str}) via {method} [{lat_str}]" +
              (f"  (expected: {expected})" if status != 'PASS' else ""))
        time.sleep(0.1)

    print(f"\n{'='*60}")
    print(f"Results: {pass_count} PASS / {fail_count} FAIL / {error_count} ERROR out of {len(TEST_CASES)}")
    print(f"Pass rate: {pass_count/len(TEST_CASES)*100:.1f}%")

    print(f"\n--- Category breakdown ---")
    for cat, counts in sorted(categories.items()):
        total = counts['pass'] + counts['fail'] + counts['error']
        pct = counts['pass']/total*100 if total > 0 else 0
        status_icon = "[OK]" if pct == 100 else "[WEAK]" if pct >= 60 else "[CRITICAL]"
        print(f"  {status_icon} {cat}: {counts['pass']}/{total} ({pct:.0f}%)")

    if fail_count > 0:
        print(f"\n--- Failed queries ---")
        for r in results:
            if r['status'] == 'FAIL':
                print(f"  \"{r['query']}\" => {r['intent']} (expected {r['expected']}) [{r['category']}] via {r['method']} [{r['latency_ms']}ms]")

    methods = {}
    for r in results:
        m = r.get('method') or 'NONE'
        methods[m] = methods.get(m, 0) + 1
    print(f"\n--- Match method distribution ---")
    for m, c in sorted(methods.items(), key=lambda x: -x[1]):
        print(f"  {m}: {c}")

    latencies = [r['latency_ms'] for r in results]
    latencies.sort()
    avg_lat = sum(latencies) / len(latencies)
    p50 = latencies[len(latencies) // 2]
    p90 = latencies[int(len(latencies) * 0.9)]
    p99 = latencies[int(len(latencies) * 0.99)]
    print(f"\n--- Latency stats ---")
    print(f"  Avg: {avg_lat:.0f}ms | P50: {p50}ms | P90: {p90}ms | P99: {p99}ms")

    report = {
        'timestamp': datetime.now().isoformat(),
        'test': 'v5_round50_comprehensive_milestone',
        'total': len(TEST_CASES),
        'pass': pass_count,
        'fail': fail_count,
        'error': error_count,
        'pass_rate': pass_count/len(TEST_CASES)*100,
        'category_breakdown': categories,
        'method_distribution': methods,
        'results': results
    }
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_path = f'tests/ai-intent/reports/v5_round50_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
