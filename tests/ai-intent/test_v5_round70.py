#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 70
Focus: MILESTONE COMPREHENSIVE MIX #2.
       50 test cases across 10 categories: ultra_short, long_natural,
       dialectal, typo_tolerant, compound, emotional, question_form,
       action_request, domain_jargon, negative_intent.
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

# Round 70 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. ultra_short (5 cases) =====
    ("产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "ultra_short"),
    ("质检", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "QUALITY_CHECK_EXECUTE", None], "ultra_short"),
    ("库存", ["INVENTORY_QUERY", "REPORT_INVENTORY", "INVENTORY_CHECK", None], "ultra_short"),
    ("出勤", ["ATTENDANCE_TODAY", "ATTENDANCE_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "ultra_short"),
    ("设备", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST", "EQUIPMENT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "ultra_short"),

    # ===== 2. long_natural (5 cases) =====
    ("帮我看看今天上午A线的产量数据", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_TRENDS", None], "long_natural"),
    ("把最近一个月的质检报告整理一下", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "REPORT_TRENDS", None], "long_natural"),
    ("车间B的设备有没有故障预警", ["EQUIPMENT_ALERT_LIST", "EQUIPMENT_STATUS_QUERY", "ALERT_LIST", None], "long_natural"),
    ("上个季度跟这个季度的成本对比一下", ["COST_TREND_ANALYSIS", "COST_QUERY", "REPORT_TRENDS", None], "long_natural"),
    ("查一下昨天入库的那批大豆的检验结果", ["MATERIAL_BATCH_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None], "long_natural"),

    # ===== 3. dialectal (5 cases) =====
    ("看看还有啥货", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "dialectal"),
    ("东西到了没", ["SHIPMENT_QUERY", "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "dialectal"),
    ("机器咋了", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "dialectal"),
    ("人来齐了没", ["ATTENDANCE_TODAY", "ATTENDANCE_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "dialectal"),
    ("活儿干完了没", ["PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "dialectal"),

    # ===== 4. typo_tolerant (5 cases) =====
    ("生产质量报告", ["REPORT_QUALITY", "REPORT_PRODUCTION", "QUALITY_CHECK_QUERY", None], "typo_tolerant"),
    ("库存盘点记录", ["INVENTORY_CHECK", "REPORT_INVENTORY", "INVENTORY_QUERY", None], "typo_tolerant"),
    ("设备维修申请", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST", None], "typo_tolerant"),
    ("质检合格率统计", ["QUALITY_STATS", "REPORT_QUALITY", "QUALITY_CHECK_QUERY", None], "typo_tolerant"),
    ("原材料采购计划", ["MRP_CALCULATION", "SUPPLIER_LIST", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", None], "typo_tolerant"),

    # ===== 5. compound (5 cases) =====
    ("先查库存再下单", ["INVENTORY_QUERY", "ORDER_LIST", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "compound"),
    ("质检合格后发货", ["QUALITY_CHECK_QUERY", "SHIPMENT_CREATE", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "compound"),
    ("盘点完成后调整", ["INVENTORY_CHECK", "MATERIAL_ADJUST_QUANTITY", "INVENTORY_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "compound"),
    ("入库检验一起做", ["MATERIAL_BATCH_CREATE", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "compound"),
    ("排产加排班", ["SCHEDULING_SET_MANUAL", "PRODUCTION_STATUS_QUERY", "ATTENDANCE_STATS", "REPORT_DASHBOARD_OVERVIEW", None], "compound"),

    # ===== 6. emotional (5 cases) =====
    ("库存又不对了", ["INVENTORY_QUERY", "INVENTORY_CHECK", "ALERT_LIST", "MATERIAL_LOW_STOCK_ALERT", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "emotional"),
    ("设备总是坏", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_ALERT_LIST", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "emotional"),
    ("质量太差了", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", None], "emotional"),
    ("产量上不去", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "emotional"),
    ("成本太高了", ["COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "emotional"),

    # ===== 7. question_form (5 cases) =====
    ("今天该检什么", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "question_form"),
    ("下一步做什么", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "question_form"),
    ("现在应该生产什么", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "SCHEDULING_SET_MANUAL", "REPORT_DASHBOARD_OVERVIEW", None], "question_form"),
    ("接下来要发哪批货", ["SHIPMENT_QUERY", "PROCESSING_BATCH_LIST", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "question_form"),
    ("还有什么没完成", ["REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", None], "question_form"),

    # ===== 8. action_request (5 cases) =====
    ("帮我查一下", ["REPORT_DASHBOARD_OVERVIEW", "INVENTORY_QUERY", "PRODUCTION_STATUS_QUERY", None], "action_request"),
    ("统计一下", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_TRENDS", None], "action_request"),
    ("汇总今天的", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "action_request"),
    ("算一下成本", ["COST_QUERY", "COST_TREND_ANALYSIS", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "action_request"),
    ("看看有没有异常", ["ALERT_LIST", "ALERT_ACTIVE", "EQUIPMENT_ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "action_request"),

    # ===== 9. domain_jargon (5 cases) =====
    ("OEE数据", ["EQUIPMENT_STATS", "EQUIPMENT_STATUS_QUERY", "REPORT_EFFICIENCY", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None], "domain_jargon"),
    ("FIFO执行", ["MATERIAL_FIFO_RECOMMEND", "INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "domain_jargon"),
    ("SPC控制图", ["REPORT_QUALITY", "QUALITY_CHECK_QUERY", "REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW", None], "domain_jargon"),
    ("CPK指标", ["REPORT_QUALITY", "QUALITY_CHECK_QUERY", "REPORT_KPI", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "domain_jargon"),
    ("HACCP记录", ["FOOD_SAFETY_CERT_QUERY", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", "REPORT_DASHBOARD_OVERVIEW", None], "domain_jargon"),

    # ===== 10. negative_intent (5 cases) =====
    ("没有问题", ["ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "negative_intent"),
    ("不需要了", ["EXECUTE_SWITCH", "REPORT_DASHBOARD_OVERVIEW", None], "negative_intent"),
    ("算了不查了", ["QUERY_RETRY_LAST", "REPORT_DASHBOARD_OVERVIEW", None], "negative_intent"),
    ("取消刚才的", ["CONTINUE_LAST_OPERATION", "QUERY_RETRY_LAST", "REPORT_DASHBOARD_OVERVIEW", None], "negative_intent"),
    ("没事了", ["REPORT_DASHBOARD_OVERVIEW", None], "negative_intent"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 70 ===")
    print(f"Focus: MILESTONE COMPREHENSIVE MIX #2")
    print(f"       (ultra_short, long_natural, dialectal, typo_tolerant, compound,")
    print(f"        emotional, question_form, action_request, domain_jargon, negative_intent)")
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
        'test': 'v5_round70_milestone_comprehensive_mix_2',
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
    report_path = f'tests/ai-intent/reports/v5_round70_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
