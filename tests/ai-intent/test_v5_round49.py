#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 49
Focus: PRODUCTION PROCESS DETAIL queries.
       Covers batch operations, production monitor, yield/output,
       process control, efficiency, waste/loss, batch detail,
       product info, and line management.
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

# Round 49 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Batch Operations (6 cases) =====
    ("开始新批次", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_START", "PROCESSING_BATCH_LIST", None], "batch_operations"),
    ("暂停生产", ["PROCESSING_BATCH_PAUSE", "PROCESSING_BATCH_CANCEL", "PRODUCTION_STATUS_QUERY", None], "batch_operations"),
    ("恢复生产", ["PROCESSING_BATCH_START", "PROCESSING_BATCH_PAUSE", "PROCESSING_BATCH_RESUME", "PRODUCTION_STATUS_QUERY", None], "batch_operations"),
    ("完成批次", ["PROCESSING_BATCH_COMPLETE", None], "batch_operations"),
    ("批次合并", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL", None], "batch_operations"),
    ("批次拆分", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL", None], "batch_operations"),

    # ===== 2. Production Monitor (6 cases) =====
    ("产线监控", ["PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "production_monitor"),
    ("实时产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", None], "production_monitor"),
    ("生产进度", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", None], "production_monitor"),
    ("在线产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", None], "production_monitor"),
    ("当前产能", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_EFFICIENCY", None], "production_monitor"),
    ("产线速度", ["PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_EFFICIENCY", None], "production_monitor"),

    # ===== 3. Yield/Output (6 cases) =====
    ("产量统计", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "yield_output"),
    ("班产量", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "yield_output"),
    ("日产量", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "REPORT_TRENDS", None], "yield_output"),
    ("月产量汇总", ["REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "yield_output"),
    ("产品产量", ["REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", "PRODUCT_TYPE_QUERY", None], "yield_output"),
    ("产线产量对比", ["REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_EFFICIENCY", None], "yield_output"),

    # ===== 4. Process Control (5 cases) =====
    ("工艺参数", ["PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY", None], "process_control"),
    ("温度控制", ["PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", "COLD_CHAIN_TEMPERATURE", None], "process_control"),
    ("时间控制", ["PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", None], "process_control"),
    ("配比控制", ["PRODUCTION_STATUS_QUERY", "QUALITY_CHECK_QUERY", None], "process_control"),
    ("工艺标准", ["PRODUCTION_STATUS_QUERY", "QUALITY_CHECK_QUERY", None], "process_control"),

    # ===== 5. Efficiency (6 cases) =====
    ("生产效率", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "efficiency"),
    ("人均效率", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", None], "efficiency"),
    ("产线效率", ["REPORT_EFFICIENCY", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "efficiency"),
    ("换线时间", ["REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", None], "efficiency"),
    ("稼动率", ["REPORT_EFFICIENCY", "EQUIPMENT_STATUS_QUERY", "REPORT_PRODUCTION", None], "efficiency"),
    ("节拍时间", ["REPORT_EFFICIENCY", "PRODUCTION_STATUS_QUERY", None], "efficiency"),

    # ===== 6. Waste/Loss (5 cases) =====
    ("废品率", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "QUALITY_CHECK_QUERY", "QUALITY_STATS", None], "waste_loss"),
    ("损耗统计", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "waste_loss"),
    ("边角料", ["REPORT_PRODUCTION", None], "waste_loss"),
    ("返工率", ["REPORT_PRODUCTION", "REPORT_EFFICIENCY", "QUALITY_CHECK_QUERY", None], "waste_loss"),
    ("报废统计", ["REPORT_PRODUCTION", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", None], "waste_loss"),

    # ===== 7. Batch Detail (6 cases) =====
    ("批次详情", ["PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", None], "batch_detail"),
    ("批次记录", ["PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_TIMELINE", None], "batch_detail"),
    ("生产记录", ["PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", "PROCESSING_BATCH_DETAIL", None], "batch_detail"),
    ("操作记录", ["PROCESSING_BATCH_TIMELINE", "PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL", None], "batch_detail"),
    ("工序记录", ["PROCESSING_BATCH_TIMELINE", "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", None], "batch_detail"),
    ("批次时间线", ["PROCESSING_BATCH_TIMELINE", "PROCESSING_BATCH_DETAIL", None], "batch_detail"),

    # ===== 8. Product Info (5 cases) =====
    ("产品信息", ["PRODUCT_TYPE_QUERY", "PRODUCT_UPDATE", "MATERIAL_BATCH_QUERY", None], "product_info"),
    ("产品规格", ["PRODUCT_TYPE_QUERY", "PRODUCT_UPDATE", None], "product_info"),
    ("产品配方", ["PRODUCT_TYPE_QUERY", "PRODUCT_UPDATE", None], "product_info"),
    ("产品目录", ["PRODUCT_TYPE_QUERY", "PRODUCT_UPDATE", None], "product_info"),
    ("新产品", ["PRODUCT_UPDATE", "PRODUCT_TYPE_QUERY", None], "product_info"),

    # ===== 9. Line Management (5 cases) =====
    ("产线管理", ["EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "line_management"),
    ("换线安排", ["PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_EFFICIENCY", None], "line_management"),
    ("产线清洁", ["EQUIPMENT_STATUS_QUERY", "PRODUCTION_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", None], "line_management"),
    ("产线校验", ["EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", None], "line_management"),
    ("产线分配", ["PRODUCTION_STATUS_QUERY", "EQUIPMENT_STATUS_QUERY", "REPORT_EFFICIENCY", None], "line_management"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 49 ===")
    print(f"Focus: PRODUCTION PROCESS DETAIL queries")
    print(f"       (batch operations, production monitor, yield/output,")
    print(f"        process control, efficiency, waste/loss, batch detail,")
    print(f"        product info, line management)")
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
        'test': 'v5_round49_production_process_detail',
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
    report_path = f'tests/ai-intent/reports/v5_round49_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
