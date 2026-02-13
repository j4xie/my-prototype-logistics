#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 12
Focus: SEMANTIC ROBUSTNESS - synonym variance, context disambiguation, implicit intent,
       mixed language, conversational follow-ups, measurement queries, temporal precision,
       role-based queries, correction/refinement patterns.
"""

import requests
import json
import sys
import time
from datetime import datetime
from collections import Counter

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

# Round 12 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Synonym Robustness (8 cases) =====
    # Same intent expressed with very different vocabulary
    ("仓储情况怎么样", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW"], "synonym-storage1"),
    ("库房状态查一下", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "EQUIPMENT_STATUS_QUERY"], "synonym-storage2"),
    ("储存量还剩多少", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "synonym-storage3"),
    ("人力配置如何", ["ATTENDANCE_STATS", "ATTENDANCE_TODAY", "REPORT_EFFICIENCY"], "synonym-hr1"),
    ("员工到岗情况", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS"], "synonym-hr2"),
    ("工人出勤率", ["ATTENDANCE_STATS", "ATTENDANCE_TODAY"], "synonym-hr3"),
    ("机器运行状况", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_STATS", "EQUIPMENT_LIST"], "synonym-equip1"),
    ("产线设备怎样", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "EQUIPMENT_STATS"], "synonym-equip2"),

    # ===== 2. Context-Dependent Disambiguation (6 cases) =====
    ("状态", [None], "context-bare-status"),
    ("设备状态", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST"], "context-equip-status"),
    ("订单状态", ["ORDER_STATUS", "ORDER_LIST"], "context-order-status"),
    ("批次状态", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL"], "context-batch-status"),
    ("记录", [None], "context-bare-record"),
    ("出勤记录", ["ATTENDANCE_STATS", "ATTENDANCE_TODAY", "ATTENDANCE_HISTORY"], "context-attend-record"),

    # ===== 3. Implicit Intent (6 cases) =====
    # User states observation/symptom, system should infer intent
    ("原料快过期了", ["MATERIAL_BATCH_QUERY", "ALERT_LIST", "MATERIAL_EXPIRING_ALERT", "MATERIAL_LOW_STOCK_ALERT"], "implicit-expiry"),
    ("温度超标了", ["COLD_CHAIN_TEMPERATURE", "ALERT_ACTIVE", "ALERT_LIST"], "implicit-temp"),
    ("工人迟到了", ["ATTENDANCE_TODAY", "ALERT_LIST", "ATTENDANCE_STATS", "ATTENDANCE_HISTORY"], "implicit-late"),
    ("这批货有问题", ["QUALITY_CHECK_QUERY", "ALERT_ACTIVE", "QUALITY_STATS", "PROCESSING_BATCH_DETAIL", "ALERT_LIST", None], "implicit-quality"),
    ("设备异响", ["EQUIPMENT_STATUS_QUERY", "ALERT_ACTIVE", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_ALERT_LIST", None], "implicit-equip-noise"),
    ("库存告急", ["REPORT_INVENTORY", "ALERT_ACTIVE", "MATERIAL_LOW_STOCK_ALERT", "MATERIAL_BATCH_QUERY", "ALERT_LIST"], "implicit-stock-low"),

    # ===== 4. Mixed Language (5 cases) =====
    ("check一下inventory", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", None], "mixed-check-inv"),
    ("OEE和yield分析", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "QUALITY_STATS", None], "mixed-oee-yield"),
    ("update供应商rating", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST", None], "mixed-supplier-rate"),
    ("quality report导出", ["REPORT_QUALITY", "QUALITY_STATS", "QUALITY_CHECK_QUERY", None], "mixed-quality-export"),
    ("equipment maintenance记录", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY", None], "mixed-equip-maint"),

    # ===== 5. Conversational Follow-up Style (5 cases) =====
    ("那质检呢", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", None], "conv-quality"),
    ("库存也看看", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "conv-inventory"),
    ("设备那边呢", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", None], "conv-equipment"),
    ("出勤情况呢", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS"], "conv-attendance"),
    ("订单方面呢", ["ORDER_STATUS", "ORDER_LIST", None], "conv-order"),

    # ===== 6. Measurement/Unit Queries (5 cases) =====
    ("今天用了多少吨面粉", ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY"], "unit-material-ton"),
    ("废品率几个点", ["QUALITY_STATS", "REPORT_QUALITY", "REPORT_PRODUCTION"], "unit-scrap-rate"),
    ("良率多少", ["QUALITY_STATS", "REPORT_PRODUCTION", "REPORT_QUALITY"], "unit-yield"),
    ("OEE百分比", ["REPORT_EFFICIENCY", "EQUIPMENT_STATS"], "unit-oee-pct"),
    ("日产能多少吨", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY"], "unit-daily-capacity"),

    # ===== 7. Temporal Precision (5 cases) =====
    ("昨天下午三点的产量", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY"], "temporal-hour"),
    ("上周五的出勤", ["ATTENDANCE_STATS", "ATTENDANCE_TODAY", "ATTENDANCE_HISTORY"], "temporal-friday"),
    ("月初到现在的销售额", ["REPORT_FINANCE", "REPORT_TRENDS"], "temporal-month-range"),
    ("本季度质检数据", ["QUALITY_STATS", "REPORT_QUALITY", "QUALITY_CHECK_QUERY"], "temporal-quarter"),
    ("今年一月份的库存", ["REPORT_INVENTORY", "REPORT_TRENDS", "MATERIAL_BATCH_QUERY"], "temporal-jan"),

    # ===== 8. Role-Based Queries (5 cases) =====
    ("张主管的班组今天产量", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY"], "role-supervisor"),
    ("仓管员的操作记录", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "SHIPMENT_QUERY", "PROCESSING_BATCH_TIMELINE"], "role-warehouse"),
    ("质检员检了多少批", ["QUALITY_STATS", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE"], "role-inspector"),
    ("设备工程师的维护单", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY"], "role-engineer"),
    ("调度员排班情况", ["ATTENDANCE_STATS", "ATTENDANCE_TODAY", "PROCESSING_BATCH_LIST"], "role-dispatcher"),

    # ===== 9. Correction/Refinement (5 cases) =====
    ("不是产量，是良率", ["QUALITY_STATS", "REPORT_QUALITY", "REPORT_PRODUCTION", None], "correct-yield"),
    ("换成月度的", ["ATTENDANCE_MONTHLY", None], "correct-ambiguous"),
    ("看设备的，不是人的", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "EQUIPMENT_STATS", None], "correct-equipment"),
    ("要质检的，不是生产的", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", None], "correct-quality"),
    ("改成库存报表", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "correct-inventory"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 12 ===")
    print(f"Focus: SEMANTIC ROBUSTNESS - synonyms, disambiguation, implicit intent,")
    print(f"       mixed language, conversational, measurements, temporal, role, corrections")
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

    if error_count > 0:
        print(f"\n--- Error queries ---")
        for r in results:
            if r['status'] == 'ERROR':
                print(f"  \"{r['query']}\" => {r['method']} [{r['category']}] [{r['latency_ms']}ms]")

    methods = {}
    for r in results:
        m = r.get('method') or 'NONE'
        methods[m] = methods.get(m, 0) + 1
    print(f"\n--- Match method distribution ---")
    for m, c in sorted(methods.items(), key=lambda x: -x[1]):
        print(f"  {m}: {c}")

    # Latency stats
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
        'test': 'v5_round12_semantic_robustness',
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
    report_path = f'tests/ai-intent/reports/v5_round12_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
