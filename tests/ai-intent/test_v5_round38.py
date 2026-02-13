#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 38
Focus: NATURAL CONVERSATIONAL LANGUAGE - the way real factory workers would
       actually speak in daily operations, with casual phrasing, urgency,
       complaints, slang, and contextual references.
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

# Round 38 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Casual Phrasing (6 cases) =====
    ("帮忙看下今天干了多少", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "casual"),
    ("那个批次咋样了", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", None], "casual"),
    ("库房东西够不够", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "INVENTORY_LIST", "REPORT_INVENTORY", None], "casual"),
    ("机器没毛病吧", ["EQUIPMENT_STATUS_QUERY", "ALERT_LIST", None], "casual"),
    ("人都来了没", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", None], "casual"),
    ("货发了吗", ["SHIPMENT_QUERY", "ORDER_LIST", "ORDER_STATUS", None], "casual"),

    # ===== 2. Question with Context (6 cases) =====
    ("老板问产量呢", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "context"),
    ("客户要报告", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "QUALITY_CHECK_QUERY", None], "context"),
    ("领导要看数据", ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", None], "context"),
    ("审计需要记录", ["REPORT_DASHBOARD_OVERVIEW", "QUALITY_CHECK_QUERY", None], "context"),
    ("开会用的报表", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "context"),
    ("月底要交的材料", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "MATERIAL_BATCH_QUERY", None], "context"),

    # ===== 3. Urgency Expression (6 cases) =====
    ("赶紧查", ["QUERY_RETRY_LAST", None], "urgency"),
    ("快看看", ["REPORT_DASHBOARD_OVERVIEW", None], "urgency"),
    ("马上要", [None], "urgency"),
    ("等着用呢", [None], "urgency"),
    ("急", [None], "urgency"),
    ("尽快给我", [None], "urgency"),

    # ===== 4. Complaint Style (6 cases) =====
    ("怎么还没好", ["ALERT_ACTIVE", None], "complaint"),
    ("又出问题了", ["ALERT_LIST", "EQUIPMENT_STATUS_QUERY", None], "complaint"),
    ("这也太慢了", [None], "complaint"),
    ("一直在等", [None], "complaint"),
    ("催了好几次了", [None], "complaint"),
    ("什么情况啊", [None, "ALERT_LIST", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW"], "complaint"),

    # ===== 5. Instruction Style (5 cases) =====
    ("把数据拉出来", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "instruction"),
    ("整理一下", [None], "instruction"),
    ("汇总给我", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "instruction"),
    ("发到群里", [None], "instruction"),
    ("打出来", [None, "REPORT_DASHBOARD_OVERVIEW"], "instruction"),

    # ===== 6. Confirmation Seeking (6 cases) =====
    ("对不对", [None], "confirmation"),
    ("是这样吗", [None], "confirmation"),
    ("确认一下", [None], "confirmation"),
    ("没问题吧", [None], "confirmation"),
    ("准确吗", [None], "confirmation"),
    ("靠谱不", [None], "confirmation"),

    # ===== 7. Estimation/Rough (5 cases) =====
    ("大概多少", [None, "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW"], "estimation"),
    ("差不多够了吧", [None, "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY"], "estimation"),
    ("估计能完成吗", ["PROCESSING_BATCH_COMPLETE", None, "PRODUCTION_STATUS_QUERY"], "estimation"),
    ("有没有个数", [None, "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW"], "estimation"),
    ("大致情况", [None, "REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY"], "estimation"),

    # ===== 8. Contextual Reference (5 cases) =====
    ("上次那个", [None], "contextual_ref"),
    ("刚才说的", [None], "contextual_ref"),
    ("之前的那个批次", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL", None], "contextual_ref"),
    ("前面查的", ["QUERY_RETRY_LAST", None], "contextual_ref"),
    ("那个表", ["FORM_GENERATION", None, "REPORT_DASHBOARD_OVERVIEW"], "contextual_ref"),

    # ===== 9. Worker Slang (5 cases) =====
    ("开机了没", ["EQUIPMENT_START", "EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", None], "slang"),
    ("下料了吗", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "MATERIAL_BATCH_QUERY", None], "slang"),
    ("封口检查", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", None], "slang"),
    ("翻包", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", None], "slang"),
    ("码垛完了没", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "SHIPMENT_QUERY", None], "slang"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 38 ===")
    print(f"Focus: NATURAL CONVERSATIONAL LANGUAGE - the way real factory")
    print(f"       workers would actually speak in daily operations")
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
        'test': 'v5_round38_natural_conversational',
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
    report_path = f'tests/ai-intent/reports/v5_round38_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
