#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 90
Focus: MILESTONE COMPREHENSIVE MIX #5.
       Covers typo/misspelling, partial input, duplicate requests, multi-intent,
       system commands, greeting/chat, numeric-only, punctuation-heavy,
       code-switch, and edge-case queries.
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

# Round 90 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Typo/Misspelling (5 cases) =====
    ("查看库寸", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "typo_misspell"),
    ("生产进读", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "typo_misspell"),
    ("质检记绿", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "typo_misspell"),
    ("设备维秀", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_DETAIL", "REPORT_DASHBOARD_OVERVIEW", None], "typo_misspell"),
    ("考勤同计", ["ATTENDANCE_STATS", "ATTENDANCE_TODAY", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "typo_misspell"),

    # ===== 2. Partial Input (5 cases) =====
    ("查产", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "partial_input"),
    ("看库", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "partial_input"),
    ("质检", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "partial_input"),
    ("设备", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_DETAIL", "EQUIPMENT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "partial_input"),
    ("排班", ["SCHEDULING_AUTO", "ATTENDANCE_STATS", "ATTENDANCE_TODAY", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "partial_input"),

    # ===== 3. Duplicate Request (5 cases) =====
    ("查查产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "duplicate_request"),
    ("看看库存", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "duplicate_request"),
    ("查一查订单", ["ORDER_LIST", "ORDER_DETAIL", "REPORT_DASHBOARD_OVERVIEW", None], "duplicate_request"),
    ("搜搜设备", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_DETAIL", "EQUIPMENT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "duplicate_request"),
    ("找找质检", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "duplicate_request"),

    # ===== 4. Multi-Intent (5 cases) =====
    ("查产量和库存", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "multi_intent"),
    ("看设备和质检", ["EQUIPMENT_STATUS_QUERY", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "EQUIPMENT_MAINTENANCE", "REPORT_DASHBOARD_OVERVIEW", None], "multi_intent"),
    ("查订单发货状态", ["ORDER_LIST", "ORDER_DETAIL", "SHIPMENT_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "multi_intent"),
    ("考勤和排班一起", ["ATTENDANCE_STATS", "ATTENDANCE_TODAY", "SCHEDULING_AUTO", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "multi_intent"),
    ("质检完了再入库", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_DISPOSITION_EXECUTE", "MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "multi_intent"),

    # ===== 5. System Command (5 cases) =====
    ("刷新数据", ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "INVENTORY_QUERY", None], "system_command"),
    ("返回首页", ["REPORT_DASHBOARD_OVERVIEW", None], "system_command"),
    ("退出登录", ["REPORT_DASHBOARD_OVERVIEW", None], "system_command"),
    ("切换语言", ["REPORT_DASHBOARD_OVERVIEW", None], "system_command"),
    ("清除缓存", ["REPORT_DASHBOARD_OVERVIEW", "INVENTORY_CLEAR", None], "system_command"),

    # ===== 6. Greeting/Chat (5 cases) =====
    ("你好", ["REPORT_DASHBOARD_OVERVIEW", None], "greeting_chat"),
    ("谢谢", ["REPORT_DASHBOARD_OVERVIEW", None], "greeting_chat"),
    ("辛苦了", ["REPORT_DASHBOARD_OVERVIEW", None], "greeting_chat"),
    ("再见", ["REPORT_DASHBOARD_OVERVIEW", None], "greeting_chat"),
    ("你是谁", ["REPORT_DASHBOARD_OVERVIEW", None], "greeting_chat"),

    # ===== 7. Numeric-Only (5 cases) =====
    ("12345", ["REPORT_DASHBOARD_OVERVIEW", "TRACE_BATCH", "PROCESSING_BATCH_DETAIL", "ORDER_DETAIL", None], "numeric_only"),
    ("2026", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_TRENDS", None], "numeric_only"),
    ("100", ["REPORT_DASHBOARD_OVERVIEW", "TRACE_BATCH", "PROCESSING_BATCH_DETAIL", None], "numeric_only"),
    ("50.5", ["REPORT_DASHBOARD_OVERVIEW", None], "numeric_only"),
    ("B001", ["REPORT_DASHBOARD_OVERVIEW", "TRACE_BATCH", "PROCESSING_BATCH_DETAIL", "MATERIAL_BATCH_QUERY", None], "numeric_only"),

    # ===== 8. Punctuation-Heavy (5 cases) =====
    ("产量？？？", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "punctuation_heavy"),
    ("快！！查！！", ["REPORT_DASHBOARD_OVERVIEW", "PRODUCTION_STATUS_QUERY", "INVENTORY_QUERY", None], "punctuation_heavy"),
    ("库存……", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "punctuation_heavy"),
    ("质检！", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "punctuation_heavy"),
    ("设备？", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_DETAIL", "EQUIPMENT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "punctuation_heavy"),

    # ===== 9. Code-Switch (5 cases) =====
    ("查production数据", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "PROCESSING_BATCH_LIST", "PRODUCT_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "code_switch"),
    ("inventory查询", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "code_switch"),
    ("check质量", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "QUALITY_CHECK_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "code_switch"),
    ("report生成", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_INVENTORY", "REPORT_FINANCE", "REPORT_QUALITY", None], "code_switch"),
    ("alert处理", ["ALERT_LIST", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "code_switch"),

    # ===== 10. Edge Case (5 cases) =====
    ("空", ["REPORT_DASHBOARD_OVERVIEW", None], "edge_case"),
    ("。", ["REPORT_DASHBOARD_OVERVIEW", None], "edge_case"),
    ("啊", ["REPORT_DASHBOARD_OVERVIEW", None], "edge_case"),
    ("嗯嗯", ["REPORT_DASHBOARD_OVERVIEW", None], "edge_case"),
    ("哦", ["REPORT_DASHBOARD_OVERVIEW", None], "edge_case"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 90 ===")
    print(f"Focus: MILESTONE COMPREHENSIVE MIX #5")
    print(f"       (typo_misspell, partial_input, duplicate_request, multi_intent, system_command,")
    print(f"        greeting_chat, numeric_only, punctuation_heavy, code_switch, edge_case)")
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
        'test': 'v5_round90_milestone_comprehensive_mix_5',
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
    report_path = f'tests/ai-intent/reports/v5_round90_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
