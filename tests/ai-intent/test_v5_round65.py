#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 65
Focus: MULTI-STEP OPERATIONS & WORKFLOW queries for food manufacturing.
       Covers receive-to-store, produce-to-ship, inspect-to-dispose,
       plan-to-execute, issue-to-produce, alert-to-fix, order-to-deliver,
       audit-to-improve, and track-to-report workflows.
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

# Round 65 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Receive to Store (6 cases) =====
    ("收货入库", ["MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", "QUALITY_CHECK_EXECUTE", None], "receive_to_store"),
    ("验收上架", ["MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", "QUALITY_CHECK_EXECUTE", None], "receive_to_store"),
    ("到货入库", ["MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", "QUALITY_CHECK_EXECUTE", None], "receive_to_store"),
    ("检验入库", ["MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", "QUALITY_CHECK_EXECUTE", "QUALITY_CHECK_QUERY", None], "receive_to_store"),
    ("收料登记", ["MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", "QUALITY_CHECK_EXECUTE", None], "receive_to_store"),
    ("卸货入库", ["MATERIAL_BATCH_CREATE", "INVENTORY_QUERY", "QUALITY_CHECK_EXECUTE", None], "receive_to_store"),

    # ===== 2. Produce to Ship (6 cases) =====
    ("生产发货", ["PROCESSING_BATCH_COMPLETE", "SHIPMENT_CREATE", "PROCESSING_BATCH_LIST", None], "produce_to_ship"),
    ("加工完发出去", ["PROCESSING_BATCH_COMPLETE", "SHIPMENT_CREATE", "PROCESSING_BATCH_LIST", None], "produce_to_ship"),
    ("做好就发", ["PROCESSING_BATCH_COMPLETE", "SHIPMENT_CREATE", "PROCESSING_BATCH_LIST", None], "produce_to_ship"),
    ("完工出库", ["PROCESSING_BATCH_COMPLETE", "SHIPMENT_CREATE", "PROCESSING_BATCH_LIST", None], "produce_to_ship"),
    ("成品外发", ["PROCESSING_BATCH_COMPLETE", "SHIPMENT_CREATE", "PROCESSING_BATCH_LIST", None], "produce_to_ship"),
    ("生产到出库", ["PROCESSING_BATCH_COMPLETE", "SHIPMENT_CREATE", "PROCESSING_BATCH_LIST", None], "produce_to_ship"),

    # ===== 3. Inspect to Dispose (5 cases) =====
    ("质检处理", ["QUALITY_CHECK_EXECUTE", "QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", None], "inspect_to_dispose"),
    ("检验处置", ["QUALITY_CHECK_EXECUTE", "QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", None], "inspect_to_dispose"),
    ("检后处理", ["QUALITY_CHECK_EXECUTE", "QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", None], "inspect_to_dispose"),
    ("质检完善后", ["QUALITY_CHECK_EXECUTE", "QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", None], "inspect_to_dispose"),
    ("判定并处理", ["QUALITY_CHECK_EXECUTE", "QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", None], "inspect_to_dispose"),

    # ===== 4. Plan to Execute (6 cases) =====
    ("计划执行", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_START", "PLAN_UPDATE", "SCHEDULING_SET_MANUAL", "PRODUCTION_STATUS_QUERY", None], "plan_to_execute"),
    ("排产后开工", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_START", "PLAN_UPDATE", "SCHEDULING_SET_MANUAL", "PRODUCTION_STATUS_QUERY", None], "plan_to_execute"),
    ("计划落地", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_START", "PLAN_UPDATE", "SCHEDULING_SET_MANUAL", "PRODUCTION_STATUS_QUERY", None], "plan_to_execute"),
    ("按计划生产", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_START", "PLAN_UPDATE", "SCHEDULING_SET_MANUAL", "PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", None], "plan_to_execute"),
    ("方案执行", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_START", "PLAN_UPDATE", "SCHEDULING_SET_MANUAL", "PRODUCTION_STATUS_QUERY", None], "plan_to_execute"),
    ("执行排产", ["PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_START", "PLAN_UPDATE", "SCHEDULING_SET_MANUAL", "PRODUCTION_STATUS_QUERY", None], "plan_to_execute"),

    # ===== 5. Issue to Produce (5 cases) =====
    ("领料生产", ["MATERIAL_BATCH_CONSUME", "PROCESSING_BATCH_START", "PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", None], "issue_to_produce"),
    ("取料加工", ["MATERIAL_BATCH_CONSUME", "PROCESSING_BATCH_START", "PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", None], "issue_to_produce"),
    ("出库投产", ["MATERIAL_BATCH_CONSUME", "PROCESSING_BATCH_START", "PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", None], "issue_to_produce"),
    ("领用后生产", ["MATERIAL_BATCH_CONSUME", "PROCESSING_BATCH_START", "PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", None], "issue_to_produce"),
    ("物料出库生产", ["MATERIAL_BATCH_CONSUME", "PROCESSING_BATCH_START", "PROCESSING_BATCH_CREATE", "PROCESSING_BATCH_LIST", "MATERIAL_BATCH_USE", None], "issue_to_produce"),

    # ===== 6. Alert to Fix (6 cases) =====
    ("告警处理", ["ALERT_RESOLVE", "ALERT_LIST", "ALERT_DIAGNOSE", "EQUIPMENT_MAINTENANCE", None], "alert_to_fix"),
    ("预警排查", ["ALERT_RESOLVE", "ALERT_LIST", "ALERT_DIAGNOSE", "EQUIPMENT_MAINTENANCE", None], "alert_to_fix"),
    ("异常修复", ["ALERT_RESOLVE", "ALERT_LIST", "ALERT_DIAGNOSE", "EQUIPMENT_MAINTENANCE", None], "alert_to_fix"),
    ("故障解决", ["ALERT_RESOLVE", "ALERT_LIST", "ALERT_DIAGNOSE", "EQUIPMENT_MAINTENANCE", "EQUIPMENT_ALERT_RESOLVE", None], "alert_to_fix"),
    ("报警消除", ["ALERT_RESOLVE", "ALERT_LIST", "ALERT_DIAGNOSE", "EQUIPMENT_MAINTENANCE", None], "alert_to_fix"),
    ("问题解决", ["ALERT_RESOLVE", "ALERT_LIST", "ALERT_DIAGNOSE", "EQUIPMENT_MAINTENANCE", None], "alert_to_fix"),

    # ===== 7. Order to Deliver (5 cases) =====
    ("接单发货", ["ORDER_LIST", "SHIPMENT_CREATE", "SHIPMENT_QUERY", "ORDER_STATUS", None], "order_to_deliver"),
    ("订单配送", ["ORDER_LIST", "SHIPMENT_CREATE", "SHIPMENT_QUERY", "ORDER_STATUS", None], "order_to_deliver"),
    ("下单到交付", ["ORDER_LIST", "SHIPMENT_CREATE", "SHIPMENT_QUERY", "ORDER_STATUS", None], "order_to_deliver"),
    ("订单出库", ["ORDER_LIST", "SHIPMENT_CREATE", "SHIPMENT_QUERY", "ORDER_STATUS", None], "order_to_deliver"),
    ("接单安排", ["ORDER_LIST", "SHIPMENT_CREATE", "SHIPMENT_QUERY", "ORDER_STATUS", None], "order_to_deliver"),

    # ===== 8. Audit to Improve (6 cases) =====
    ("审核改进", ["QUALITY_CHECK_QUERY", "QUALITY_DISPOSITION_EXECUTE", "REPORT_QUALITY", "PLAN_UPDATE", None], "audit_to_improve"),
    ("检查整改", ["QUALITY_CHECK_QUERY", "QUALITY_DISPOSITION_EXECUTE", "REPORT_QUALITY", "PLAN_UPDATE", None], "audit_to_improve"),
    ("巡检反馈", ["QUALITY_CHECK_QUERY", "QUALITY_DISPOSITION_EXECUTE", "REPORT_QUALITY", "PLAN_UPDATE", None], "audit_to_improve"),
    ("审计跟进", ["QUALITY_CHECK_QUERY", "QUALITY_DISPOSITION_EXECUTE", "REPORT_QUALITY", "PLAN_UPDATE", "ALERT_ACTIVE", None], "audit_to_improve"),
    ("检查后改善", ["QUALITY_CHECK_QUERY", "QUALITY_DISPOSITION_EXECUTE", "REPORT_QUALITY", "PLAN_UPDATE", None], "audit_to_improve"),
    ("内审闭环", ["QUALITY_CHECK_QUERY", "QUALITY_DISPOSITION_EXECUTE", "REPORT_QUALITY", "PLAN_UPDATE", None], "audit_to_improve"),

    # ===== 9. Track to Report (5 cases) =====
    ("追踪汇报", ["TRACE_BATCH", "TRACE_FULL", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "TRACE_PUBLIC", None], "track_to_report"),
    ("跟进报告", ["TRACE_BATCH", "TRACE_FULL", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "track_to_report"),
    ("追溯总结", ["TRACE_BATCH", "TRACE_FULL", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "track_to_report"),
    ("过程记录", ["TRACE_BATCH", "TRACE_FULL", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "track_to_report"),
    ("全程报告", ["TRACE_BATCH", "TRACE_FULL", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", None], "track_to_report"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 65 ===")
    print(f"Focus: MULTI-STEP OPERATIONS & WORKFLOW queries")
    print(f"       (receive-to-store, produce-to-ship, inspect-to-dispose, plan-to-execute,")
    print(f"        issue-to-produce, alert-to-fix, order-to-deliver, audit-to-improve, track-to-report)")
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
        'test': 'v5_round65_multi_step_workflow',
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
    report_path = f'tests/ai-intent/reports/v5_round65_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
