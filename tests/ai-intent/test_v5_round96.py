#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 96
Focus: BATCH TRACEABILITY & GENEALOGY queries for food manufacturing.
       Covers trace_forward, trace_backward, trace_full, batch_genealogy,
       lot_tracking, material_trace, process_trace, recall_trace, and blockchain.
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

# Round 96 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. trace_forward (6 cases) =====
    ("正向追溯", ["TRACE_BATCH", "TRACE_FULL", "TRACE_PUBLIC", "PROCESSING_BATCH_LIST", "SHIPMENT_QUERY", None], "trace_forward"),
    ("批次去向", ["TRACE_BATCH", "TRACE_FULL", "PROCESSING_BATCH_DETAIL", "SHIPMENT_QUERY", "PROCESSING_BATCH_LIST", None], "trace_forward"),
    ("产品流向", ["TRACE_BATCH", "TRACE_FULL", "SHIPMENT_QUERY", "PROCESSING_BATCH_LIST", None], "trace_forward"),
    ("下游客户", ["CUSTOMER_SEARCH", "SHIPMENT_QUERY", "TRACE_BATCH", None], "trace_forward"),
    ("发货去向", ["SHIPMENT_QUERY", "TRACE_BATCH", "TRACE_FULL", None], "trace_forward"),
    ("成品追踪", ["TRACE_BATCH", "TRACE_FULL", "PROCESSING_BATCH_LIST", "SHIPMENT_QUERY", "INVENTORY_QUERY", None], "trace_forward"),

    # ===== 2. trace_backward (5 cases) =====
    ("反向追溯", ["TRACE_BATCH", "TRACE_FULL", "TRACE_PUBLIC", "MATERIAL_BATCH_QUERY", None], "trace_backward"),
    ("原料来源", ["MATERIAL_BATCH_QUERY", "TRACE_BATCH", "TRACE_FULL", "INVENTORY_QUERY", None], "trace_backward"),
    ("供应商追踪", ["MATERIAL_BATCH_QUERY", "TRACE_BATCH", "CUSTOMER_SEARCH", None], "trace_backward"),
    ("原料批次", ["MATERIAL_BATCH_QUERY", "TRACE_BATCH", "PROCESSING_BATCH_DETAIL", "INVENTORY_QUERY", None], "trace_backward"),
    ("来源查询", ["TRACE_BATCH", "TRACE_FULL", "MATERIAL_BATCH_QUERY", None], "trace_backward"),

    # ===== 3. trace_full (6 cases) =====
    ("全链追溯", ["TRACE_FULL", "TRACE_BATCH", "TRACE_PUBLIC", None], "trace_full"),
    ("完整追溯", ["TRACE_FULL", "TRACE_BATCH", "TRACE_PUBLIC", None], "trace_full"),
    ("追溯报告", ["TRACE_FULL", "TRACE_BATCH", "TRACE_PUBLIC", "REPORT_DASHBOARD_OVERVIEW", None], "trace_full"),
    ("追溯码查询", ["TRACE_BATCH", "TRACE_FULL", "TRACE_PUBLIC", None], "trace_full"),
    ("扫码追溯", ["TRACE_BATCH", "TRACE_FULL", "TRACE_PUBLIC", None], "trace_full"),
    ("二维码溯源", ["TRACE_BATCH", "TRACE_FULL", "TRACE_PUBLIC", None], "trace_full"),

    # ===== 4. batch_genealogy (5 cases) =====
    ("批次家谱", ["TRACE_BATCH", "TRACE_FULL", "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", None], "batch_genealogy"),
    ("批次关系", ["TRACE_BATCH", "TRACE_FULL", "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", None], "batch_genealogy"),
    ("父批次", ["TRACE_BATCH", "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "MATERIAL_BATCH_QUERY", None], "batch_genealogy"),
    ("子批次", ["TRACE_BATCH", "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "MATERIAL_BATCH_QUERY", None], "batch_genealogy"),
    ("批次拆分", ["TRACE_BATCH", "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "MATERIAL_BATCH_QUERY", None], "batch_genealogy"),

    # ===== 5. lot_tracking (6 cases) =====
    ("批号跟踪", ["TRACE_BATCH", "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "MATERIAL_BATCH_QUERY", None], "lot_tracking"),
    ("生产批号", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL", "TRACE_BATCH", "MATERIAL_BATCH_QUERY", None], "lot_tracking"),
    ("入库批号", ["MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", "PROCESSING_BATCH_LIST", "TRACE_BATCH", None], "lot_tracking"),
    ("发货批号", ["SHIPMENT_QUERY", "TRACE_BATCH", "PROCESSING_BATCH_LIST", "MATERIAL_BATCH_QUERY", None], "lot_tracking"),
    ("批号规则", ["TRACE_BATCH", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", "RULE_CONFIG", None], "lot_tracking"),
    ("批号查重", ["TRACE_BATCH", "PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL", "MATERIAL_BATCH_QUERY", None], "lot_tracking"),

    # ===== 6. material_trace (5 cases) =====
    ("原料追溯", ["MATERIAL_BATCH_QUERY", "TRACE_BATCH", "TRACE_FULL", "INVENTORY_QUERY", None], "material_trace"),
    ("原料检验记录", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "MATERIAL_BATCH_QUERY", "TRACE_BATCH", None], "material_trace"),
    ("原料入厂", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "TRACE_BATCH", None], "material_trace"),
    ("原料使用记录", ["MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_USE", "TRACE_BATCH", "PROCESSING_BATCH_DETAIL", "INVENTORY_QUERY", None], "material_trace"),
    ("原料库存", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", None], "material_trace"),

    # ===== 7. process_trace (6 cases) =====
    ("工序追溯", ["TRACE_BATCH", "TRACE_FULL", "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", None], "process_trace"),
    ("加工记录", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "TRACE_BATCH", None], "process_trace"),
    ("生产参数", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "TRACE_BATCH", "REPORT_DASHBOARD_OVERVIEW", None], "process_trace"),
    ("操作员记录", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "process_trace"),
    ("环境记录", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "process_trace"),
    ("设备使用记录", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "process_trace"),

    # ===== 8. recall_trace (5 cases) =====
    ("召回追溯", ["TRACE_BATCH", "TRACE_FULL", "ALERT_LIST", None], "recall_trace"),
    ("问题批次", ["TRACE_BATCH", "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "ALERT_LIST", "QUALITY_CHECK_QUERY", "QUALITY_STATS", None], "recall_trace"),
    ("影响范围", ["TRACE_BATCH", "TRACE_FULL", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "recall_trace"),
    ("召回通知", ["ALERT_LIST", "TRACE_BATCH", "SHIPMENT_QUERY", None], "recall_trace"),
    ("召回进度", ["TRACE_BATCH", "TRACE_FULL", "ALERT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "recall_trace"),

    # ===== 9. blockchain (6 cases) =====
    ("区块链溯源", ["TRACE_PUBLIC", "TRACE_BATCH", "TRACE_FULL", None], "blockchain"),
    ("防伪验证", ["TRACE_PUBLIC", "TRACE_BATCH", "QUALITY_CHECK_QUERY", None], "blockchain"),
    ("溯源上链", ["TRACE_PUBLIC", "TRACE_BATCH", "TRACE_FULL", None], "blockchain"),
    ("数据存证", ["TRACE_PUBLIC", "TRACE_BATCH", "REPORT_DASHBOARD_OVERVIEW", None], "blockchain"),
    ("消费者扫码", ["TRACE_PUBLIC", "TRACE_BATCH", "CUSTOMER_SEARCH", None], "blockchain"),
    ("公开追溯", ["TRACE_PUBLIC", "TRACE_BATCH", "TRACE_FULL", None], "blockchain"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 96 ===")
    print(f"Focus: BATCH TRACEABILITY & GENEALOGY queries")
    print(f"       (trace_forward, trace_backward, trace_full, batch_genealogy,")
    print(f"        lot_tracking, material_trace, process_trace, recall_trace, blockchain)")
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
        'test': 'v5_round96_batch_traceability_genealogy',
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
    report_path = f'tests/ai-intent/reports/v5_round96_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
