#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 80
Focus: MILESTONE COMPREHENSIVE MIX #3.
       Covers polite requests, urgent tone, chained queries, abbreviations,
       number queries, context switches, confirmations, status updates,
       help/guide, and mixed language inputs.
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

# Round 80 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Polite Request (5 cases) =====
    ("麻烦帮我看看产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "polite_request"),
    ("请查一下库存", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "polite_request"),
    ("能帮我看看设备状态吗", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", "REPORT_DASHBOARD_OVERVIEW", None], "polite_request"),
    ("劳烦查看质检记录", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "polite_request"),
    ("请问今天出勤情况", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "polite_request"),

    # ===== 2. Urgent Tone (5 cases) =====
    ("赶紧查产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "urgent_tone"),
    ("快看看设备怎么了", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_DETAIL", "EQUIPMENT_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "urgent_tone"),
    ("立刻查库存", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "urgent_tone"),
    ("马上查质检", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "urgent_tone"),
    ("急需成本数据", ["COST_QUERY", "REPORT_COST", "REPORT_FINANCE", "REPORT_DASHBOARD_OVERVIEW", None], "urgent_tone"),

    # ===== 3. Chained Query (5 cases) =====
    ("查完库存再看成本", ["INVENTORY_QUERY", "COST_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "chained_query"),
    ("先看质检再看产量", ["QUALITY_CHECK_QUERY", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "chained_query"),
    ("出勤和效率一起看", ["ATTENDANCE_STATS", "ATTENDANCE_TODAY", "REPORT_EFFICIENCY", "REPORT_DASHBOARD_OVERVIEW", None], "chained_query"),
    ("设备状态和告警", ["EQUIPMENT_STATUS_QUERY", "ALERT_LIST", "EQUIPMENT_MAINTENANCE", "REPORT_DASHBOARD_OVERVIEW", None], "chained_query"),
    ("订单和发货情况", ["ORDER_LIST", "SHIPMENT_QUERY", "SHIPMENT_STATUS_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "chained_query"),

    # ===== 4. Abbreviation (5 cases) =====
    ("QC记录", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "abbreviation"),
    ("BOM清单", ["PRODUCTION_STATUS_QUERY", "MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "abbreviation"),
    ("WIP数量", ["PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "abbreviation"),
    ("FG库存", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "abbreviation"),
    ("MO状态", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "abbreviation"),

    # ===== 5. Number Query (5 cases) =====
    ("B2026-001批次", ["PROCESSING_BATCH_DETAIL", "TRACE_BATCH", "PROCESSING_BATCH_LIST", "MATERIAL_BATCH_QUERY", None], "number_query"),
    ("设备编号E003", ["EQUIPMENT_DETAIL", "EQUIPMENT_STATUS_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "number_query"),
    ("订单SO-20260210", ["ORDER_LIST", "ORDER_DETAIL", "SHIPMENT_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "number_query"),
    ("工号10086的考勤", ["ATTENDANCE_TODAY", "ATTENDANCE_STATS", "HR_EMPLOYEE_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "number_query"),
    ("物料M-F001", ["MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", "TRACE_BATCH", "REPORT_DASHBOARD_OVERVIEW", None], "number_query"),

    # ===== 6. Context Switch (5 cases) =====
    ("不查这个了，看质检", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_LIST", "QUALITY_CHECK_EXECUTE", "EXECUTE_SWITCH", "CONDITION_SWITCH", "REPORT_DASHBOARD_OVERVIEW", None], "context_switch"),
    ("换个话题，查库存", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "EXECUTE_SWITCH", "CONDITION_SWITCH", "REPORT_DASHBOARD_OVERVIEW", None], "context_switch"),
    ("刚才那个不要了，看产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "EXECUTE_SWITCH", "CONDITION_SWITCH", "REPORT_DASHBOARD_OVERVIEW", None], "context_switch"),
    ("转到设备管理", ["EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", "EXECUTE_SWITCH", "CONDITION_SWITCH", "REPORT_DASHBOARD_OVERVIEW", None], "context_switch"),
    ("切换到成本", ["COST_QUERY", "REPORT_COST", "EXECUTE_SWITCH", "CONDITION_SWITCH", "REPORT_DASHBOARD_OVERVIEW", None], "context_switch"),

    # ===== 7. Confirmation (5 cases) =====
    ("确认这批质检通过", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", None], "confirmation"),
    ("批准发货", ["SHIPMENT_CREATE", "SHIPMENT_STATUS_UPDATE", "ORDER_UPDATE", "MATERIAL_BATCH_QUERY", None], "confirmation"),
    ("同意入库", ["MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", "PLAN_UPDATE", None], "confirmation"),
    ("审批通过", ["PLAN_UPDATE", "QUALITY_DISPOSITION_EXECUTE", "REPORT_DASHBOARD_OVERVIEW", None], "confirmation"),
    ("确认收货", ["SHIPMENT_STATUS_UPDATE", "MATERIAL_BATCH_CREATE", "MATERIAL_BATCH_QUERY", "INVENTORY_QUERY", None], "confirmation"),

    # ===== 8. Status Update (5 cases) =====
    ("更新设备状态", ["EQUIPMENT_STATUS_UPDATE", "EQUIPMENT_STATUS_QUERY", "EQUIPMENT_DETAIL", "REPORT_DASHBOARD_OVERVIEW", None], "status_update"),
    ("修改订单状态", ["ORDER_UPDATE", "ORDER_STATUS", "ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "status_update"),
    ("变更批次状态", ["PROCESSING_BATCH_COMPLETE", "PROCESSING_BATCH_DETAIL", "PROCESSING_BATCH_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "status_update"),
    ("更新进度", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_COMPLETE", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "status_update"),
    ("标记完成", ["PROCESSING_BATCH_COMPLETE", "PRODUCTION_STATUS_QUERY", "ORDER_UPDATE", "REPORT_DASHBOARD_OVERVIEW", None], "status_update"),

    # ===== 9. Help/Guide (5 cases) =====
    ("怎么用这个系统", ["REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "CONFIG_RESET", None], "help_guide"),
    ("操作说明", ["REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "CONFIG_RESET", None], "help_guide"),
    ("新手引导", ["REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "CONFIG_RESET", None], "help_guide"),
    ("使用帮助", ["REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "CONFIG_RESET", None], "help_guide"),
    ("功能介绍", ["REPORT_DASHBOARD_OVERVIEW", "FORM_GENERATION", "CONFIG_RESET", None], "help_guide"),

    # ===== 10. Mixed Language (5 cases) =====
    ("check产量", ["PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "mixed_lang"),
    ("update库存", ["INVENTORY_QUERY", "MATERIAL_BATCH_QUERY", "MATERIAL_ADJUST_QUANTITY", "REPORT_INVENTORY", "REPORT_DASHBOARD_OVERVIEW", None], "mixed_lang"),
    ("query订单", ["ORDER_LIST", "ORDER_DETAIL", "REPORT_DASHBOARD_OVERVIEW", None], "mixed_lang"),
    ("export报表", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_INVENTORY", None], "mixed_lang"),
    ("scan二维码", ["TRACE_BATCH", "TRACE_PUBLIC", "TRACE_FULL", "REPORT_DASHBOARD_OVERVIEW", None], "mixed_lang"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 80 ===")
    print(f"Focus: MILESTONE COMPREHENSIVE MIX #3")
    print(f"       (polite_request, urgent_tone, chained_query, abbreviation, number_query,")
    print(f"        context_switch, confirmation, status_update, help_guide, mixed_lang)")
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
        'test': 'v5_round80_milestone_comprehensive_mix_3',
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
    report_path = f'tests/ai-intent/reports/v5_round80_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
