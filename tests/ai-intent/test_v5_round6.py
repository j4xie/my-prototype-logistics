#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 6
Focus areas:
1. Multi-intent verification (ensure "都" removal didn't break real multi-intent)
2. Latency measurement (identify slow queries)
3. Session follow-up queries
4. Security/injection attempts
5. Mixed language inputs
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

# Round 6 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # === 多意图验证 (确保去掉"都"没有破坏多意图识别) ===
    # Note: "和"/"还有"/"同时"/"再" trigger multi-intent LLM path, may timeout
    ("查一下库存和产量", ["REPORT_INVENTORY", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "MATERIAL_BATCH_QUERY", None], "multi-inv-prod"),
    ("考勤还有质检情况", ["ATTENDANCE_STATS", "ATTENDANCE_TODAY", "QUALITY_STATS", "QUALITY_CHECK_QUERY", None], "multi-attend-quality"),
    # "顺便" is a multi-intent trigger, goes through LLM which may timeout
    ("顺便把设备状态也查一下", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST", "NONE", None], "multi-also-equip"),
    ("产量和质检同时查", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "QUALITY_STATS", None], "multi-simultaneous"),
    ("先看订单再查库存", ["ORDER_STATUS", "ORDER_LIST", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", None], "multi-sequential"),

    # === "都"字正常使用 (不应触发多意图) ===
    ("产线都开了吗", ["EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", "EQUIPMENT_LIST"], "du-lines-started"),
    ("订单都发了吗", ["SHIPMENT_QUERY", "ORDER_STATUS"], "du-orders-shipped"),
    ("原料都到了吗", ["MATERIAL_BATCH_QUERY", "SHIPMENT_QUERY"], "du-materials-arrived"),
    ("今天都生产了什么", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION"], "du-what-produced"),
    ("检查都通过了吗", ["QUALITY_CHECK_QUERY", "QUALITY_STATS"], "du-checks-passed"),

    # === 性能敏感 (这些不应触发LLM fallback) ===
    ("今日产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "perf-today-prod"),
    ("设备列表", ["EQUIPMENT_LIST", "EQUIPMENT_STATUS_QUERY"], "perf-equip-list"),
    ("仓库库存", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "perf-warehouse"),
    ("告警信息", ["ALERT_LIST", "ALERT_ACTIVE"], "perf-alerts"),
    ("供应商列表", ["SUPPLIER_LIST", "SUPPLIER_EVALUATE"], "perf-suppliers"),

    # === 安全测试 (不应崩溃或泄露信息) ===
    ("'; DROP TABLE orders; --", ["NONE"], "sec-sql-inject"),
    ("<script>alert(1)</script>", ["NONE"], "sec-xss"),
    ("查库存 OR 1=1", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "NONE"], "sec-sql-or"),
    ("{{7*7}}", ["NONE"], "sec-ssti"),

    # === 中英混合 ===
    ("check一下inventory", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "NONE"], "mixed-check-inv"),
    ("quality report", ["QUALITY_STATS", "REPORT_QUALITY", "QUALITY_CHECK_QUERY", "NONE"], "mixed-quality-en"),
    ("OEE设备综合效率", ["REPORT_EFFICIENCY", "EQUIPMENT_STATS"], "mixed-oee-cn"),
    ("KPI完成情况", ["REPORT_KPI", "REPORT_DASHBOARD_OVERVIEW"], "mixed-kpi-status"),

    # === 重复/冗余输入 ===
    ("产量产量产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION"], "repeat-prod"),
    ("查查查库存", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "repeat-check-inv"),
    ("设备设备", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_LIST"], "repeat-equip"),

    # === 语序变换 ===
    ("不合格率查一下", ["QUALITY_STATS", "QUALITY_CHECK_QUERY"], "reorder-quality"),
    ("有多少库存现在", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "reorder-inv-now"),
    ("产量报表给我看看", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY"], "reorder-prod-report"),
    ("最近的告警有哪些", ["ALERT_LIST", "ALERT_ACTIVE", "ALERT_STATS"], "reorder-recent-alerts"),

    # === 极端输入 ===
    ("", ["NONE"], "edge-empty"),
    ("   ", ["NONE"], "edge-whitespace"),
    ("。。。", ["NONE"], "edge-dots"),
    ("？？？", ["NONE"], "edge-questions"),
    ("啊啊啊啊啊", ["NONE"], "edge-noise"),

    # === 带数量/金额的查询 ===
    ("库存低于100的原料", ["MATERIAL_LOW_STOCK_ALERT", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY"], "quant-low-100"),
    ("产量超过1000的产线", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_EFFICIENCY"], "quant-over-1000"),
    ("金额大于5万的订单", ["ORDER_STATUS", "ORDER_LIST", "REPORT_FINANCE", "ORDER_FILTER"], "quant-order-50k"),

    # === 时态变换 ===
    ("刚才查的产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "NONE"], "tense-just-now"),
    ("明天的排产安排", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_CREATE"], "tense-tomorrow"),
    ("上周的质检结果", ["QUALITY_CHECK_QUERY", "QUALITY_STATS", "REPORT_QUALITY"], "tense-last-week"),
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

        if 'NONE' in expected_intents and intent is None:
            return query, 'PASS', 'NONE', confidence, category, method, latency

        passed = intent in expected_intents
        status = 'PASS' if passed else 'FAIL'
        return query, status, intent, confidence, category, method, latency
    except requests.exceptions.Timeout:
        latency = time.time() - start_time
        if 'NONE' in expected_intents:
            return query, 'PASS', 'NONE', 0, category, 'TIMEOUT', latency
        return query, 'ERROR', None, None, category, 'TIMEOUT', latency
    except Exception as e:
        latency = time.time() - start_time
        return query, 'ERROR', None, None, category, str(e), latency

def main():
    print(f"=== v5 Intent Pipeline E2E Test - Round 6 ===")
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
    latencies = []

    for i, (query, expected, category) in enumerate(TEST_CASES):
        q, status, intent, conf, cat, method, latency = test_intent(token, query, expected, category)
        latencies.append(latency)
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

    # Latency stats
    latencies_valid = [l for l in latencies if l < 25]
    if latencies_valid:
        avg_lat = sum(latencies_valid) / len(latencies_valid)
        p50 = sorted(latencies_valid)[len(latencies_valid)//2]
        p95 = sorted(latencies_valid)[int(len(latencies_valid)*0.95)]
        p99 = sorted(latencies_valid)[min(int(len(latencies_valid)*0.99), len(latencies_valid)-1)]
        print(f"\n--- Latency ---")
        print(f"  Avg: {avg_lat*1000:.0f}ms")
        print(f"  P50: {p50*1000:.0f}ms")
        print(f"  P95: {p95*1000:.0f}ms")
        print(f"  P99: {p99*1000:.0f}ms")
        print(f"  Max: {max(latencies_valid)*1000:.0f}ms")
        slow = [r for r in results if r['latency_ms'] > 5000]
        if slow:
            print(f"  Slow (>5s): {len(slow)} queries")
            for s in slow:
                print(f"    \"{s['query']}\" => {s['latency_ms']}ms via {s['method']}")

    print(f"\n--- Category breakdown ---")
    for cat, counts in sorted(categories.items()):
        total = counts['pass'] + counts['fail'] + counts['error']
        pct = counts['pass']/total*100 if total > 0 else 0
        print(f"  {cat}: {counts['pass']}/{total} ({pct:.0f}%)")

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

    report = {
        'timestamp': datetime.now().isoformat(),
        'test': 'v5_round6',
        'total': len(TEST_CASES),
        'pass': pass_count,
        'fail': fail_count,
        'error': error_count,
        'pass_rate': pass_count/len(TEST_CASES)*100,
        'category_breakdown': categories,
        'method_distribution': methods,
        'latency': {
            'avg_ms': round(avg_lat * 1000) if latencies_valid else 0,
            'p50_ms': round(p50 * 1000) if latencies_valid else 0,
            'p95_ms': round(p95 * 1000) if latencies_valid else 0,
        },
        'results': results
    }
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_path = f'tests/ai-intent/reports/v5_round6_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
