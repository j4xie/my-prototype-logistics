#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 13
Focus: LINGUISTIC EDGE CASES - homophone confusion, domain transfer, elliptical queries,
       compound metrics, negative confirmation, indirect reference, question form variation,
       emoji/punctuation handling, false friend intents.
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

# Round 13 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Homophone Confusion (6 cases) =====
    ("今天检了多少批", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "QUALITY_CHECK_EXECUTE"], "homophone-jian-inspect"),
    ("一共有几件产品", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", None], "homophone-jian-item"),
    ("查一下设备状态", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST"], "homophone-cha-check"),
    ("产量差了多少", ["PRODUCTION_STATUS_QUERY", "REPORT_TRENDS", "REPORT_PRODUCTION"], "homophone-cha-diff"),
    ("给我生成质检报表", ["REPORT_QUALITY", "QUALITY_STATS", "QUALITY_CHECK_QUERY"], "homophone-bao-report"),
    ("这批次包装好了吗", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "PROCESSING_BATCH_COMPLETE", None], "homophone-bao-package"),

    # ===== 2. Domain Transfer (5 cases) =====
    ("产量的ROI是多少", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_FINANCE", None], "domain-finance-prod"),
    ("诊断设备问题", ["EQUIPMENT_STATUS_QUERY", "ALERT_ACTIVE", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_ALERT_LIST"], "domain-medical-equip"),
    ("物料的流动性分析", ["MATERIAL_BATCH_QUERY", "QUERY_LIQUIDITY", "REPORT_INVENTORY", None], "domain-finance-material"),
    ("员工绩效的库存情况", ["ATTENDANCE_STATS", "REPORT_KPI", "REPORT_EFFICIENCY", "REPORT_INVENTORY", None], "domain-mixed-hr"),
    ("供应商的健康度评估", ["SUPPLIER_EVALUATE", "SUPPLIER_LIST"], "domain-medical-supplier"),

    # ===== 3. Elliptical Queries (6 cases) =====
    ("多少", [None], "elliptical-how-much"),
    ("几点", [None, "ATTENDANCE_TODAY"], "elliptical-what-time"),
    ("好了", [None], "elliptical-done"),
    ("有吗", [None], "elliptical-exist"),
    ("在哪", [None, "MATERIAL_BATCH_QUERY", "EQUIPMENT_LIST"], "elliptical-where"),
    ("完成没", [None, "PROCESSING_BATCH_DETAIL", "ORDER_STATUS", "PROCESSING_BATCH_LIST"], "elliptical-complete"),

    # ===== 4. Compound Metric Queries (5 cases) =====
    ("人均产出是多少", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY"], "compound-per-capita"),
    ("吨均成本多少钱", ["REPORT_FINANCE", "REPORT_PRODUCTION", None], "compound-cost-per-ton"),
    ("平均交货周期", ["ORDER_STATUS", "SHIPMENT_QUERY", "SHIPMENT_STATS", "ORDER_LIST", "SUPPLIER_EVALUATE", None], "compound-delivery-cycle"),
    ("单位能耗产量比", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "EQUIPMENT_STATS", None], "compound-energy-eff"),
    ("批次合格率趋势", ["QUALITY_STATS", "REPORT_TRENDS", "REPORT_QUALITY"], "compound-pass-rate-trend"),

    # ===== 5. Negative Confirmation (5 cases) =====
    ("今天没有告警吧", ["ALERT_ACTIVE", "ALERT_LIST"], "negconfirm-no-alerts"),
    ("库存没问题吧", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "negconfirm-stock-ok"),
    ("设备全部正常吧", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST"], "negconfirm-equip-ok"),
    ("没有超期的批次吧", ["PROCESSING_BATCH_LIST", "MATERIAL_BATCH_QUERY", "QUALITY_CHECK_QUERY"], "negconfirm-no-overdue"),
    ("今天没人迟到吧", ["ATTENDANCE_TODAY", "ATTENDANCE_ANOMALY", "ATTENDANCE_STATS"], "negconfirm-no-late"),

    # ===== 6. Indirect Reference (5 cases) =====
    ("上次查的那个批次", ["PROCESSING_BATCH_DETAIL", "TRACE_BATCH", "PROCESSING_BATCH_LIST", None], "indirect-prev-batch"),
    ("刚才说的设备", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", None], "indirect-mentioned-equip"),
    ("同样的报表", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "indirect-same-report"),
    ("那个供应商怎么样", ["SUPPLIER_EVALUATE", "SUPPLIER_RANKING", "SUPPLIER_LIST", None], "indirect-that-supplier"),
    ("这个月的", ["ATTENDANCE_MONTHLY", None, "REPORT_PRODUCTION", "REPORT_FINANCE"], "indirect-this-month"),

    # ===== 7. Question Form Variation (5 cases) =====
    ("产量是多少", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "qform-standard"),
    ("产量多少", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "qform-colloquial"),
    ("多少产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "qform-inverted"),
    ("设备好了没", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST"], "qform-completion"),
    ("设备好没好", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", None], "qform-repetition"),

    # ===== 8. Emoji/Punctuation Handling (5 cases) =====
    ("产量！！！", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "punct-exclamation"),
    ("质检。。。", ["QUALITY_CHECK_QUERY", "QUALITY_STATS"], "punct-ellipsis"),
    ("库存？？？", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "punct-question"),
    ("设备……", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST"], "punct-cn-ellipsis"),
    ("告警！！急", ["ALERT_ACTIVE", "ALERT_LIST"], "punct-urgent"),

    # ===== 9. False Friend Intents (8 cases) =====
    ("设备产量", ["REPORT_PRODUCTION", "EQUIPMENT_STATS", "PRODUCTION_STATUS_QUERY"], "false-equip-prod"),
    ("质检设备", ["EQUIPMENT_LIST", "EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY"], "false-qc-equip"),
    ("库存成本", ["REPORT_FINANCE", "REPORT_INVENTORY"], "false-inv-cost"),
    ("生产报表", ["REPORT_PRODUCTION"], "false-prod-report"),
    ("设备维护记录", ["EQUIPMENT_MAINTENANCE", "EQUIPMENT_STATUS_QUERY"], "false-maint-records"),
    ("物料溯源", ["TRACE_BATCH", "TRACE_FULL", "MATERIAL_BATCH_QUERY"], "false-material-trace"),
    ("供应商订单", ["ORDER_LIST", "ORDER_STATUS", "SUPPLIER_LIST", None], "false-supplier-order"),
    ("批次质检", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "PROCESSING_BATCH_DETAIL"], "false-batch-quality"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 13 ===")
    print(f"Focus: LINGUISTIC EDGE CASES - homophones, domain transfer, elliptical,")
    print(f"       compound metrics, negative confirmation, indirect reference,")
    print(f"       question forms, punctuation, false friend intents")
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
        'test': 'v5_round13_linguistic_edge_cases',
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
    report_path = f'tests/ai-intent/reports/v5_round13_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
