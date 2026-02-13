#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v5 Intent Pipeline E2E Test - Round 41
Focus: WORKFLOW & BUSINESS PROCESS queries.
       Covers order-to-delivery, purchase-to-pay, production flow, quality flow,
       approval workflow, inventory flow, traceability flow, alert workflow, and report workflow.
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

# Round 41 test cases: (query, acceptable_intents, category)
TEST_CASES = [
    # ===== 1. Order-to-Delivery (6 cases) =====
    ("从接单到发货全流程", ["ORDER_LIST", "ORDER_STATUS", "SHIPMENT_QUERY", "REPORT_DASHBOARD_OVERVIEW", None], "order_to_delivery"),
    ("订单跟踪", ["ORDER_STATUS", "ORDER_LIST", "SHIPMENT_QUERY", None], "order_to_delivery"),
    ("发货流程", ["SHIPMENT_QUERY", "SHIPMENT_CREATE", "ORDER_STATUS", None], "order_to_delivery"),
    ("订单执行进度", ["ORDER_STATUS", "ORDER_LIST", "REPORT_PRODUCTION", None], "order_to_delivery"),
    ("客户订单状态", ["ORDER_STATUS", "ORDER_LIST", "CUSTOMER_PURCHASE_HISTORY", None], "order_to_delivery"),
    ("交付完成率", ["ORDER_STATUS", "SHIPMENT_QUERY", "REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "PRODUCTION_STATUS_QUERY", None], "order_to_delivery"),

    # ===== 2. Purchase-to-Pay (6 cases) =====
    ("采购申请流程", ["MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_CREATE", "SUPPLIER_QUERY", None], "purchase_to_pay"),
    ("采购单审批", ["MATERIAL_BATCH_QUERY", "SUPPLIER_QUERY", "ORDER_LIST", None], "purchase_to_pay"),
    ("供应商付款", ["SUPPLIER_QUERY", "REPORT_FINANCE", None], "purchase_to_pay"),
    ("采购入库流程", ["MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_CREATE", "REPORT_INVENTORY", None], "purchase_to_pay"),
    ("验收入库", ["MATERIAL_BATCH_QUERY", "MATERIAL_BATCH_CREATE", "QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", None], "purchase_to_pay"),
    ("付款确认", ["REPORT_FINANCE", "SUPPLIER_QUERY", None], "purchase_to_pay"),

    # ===== 3. Production Flow (6 cases) =====
    ("投料到完工流程", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", "REPORT_PRODUCTION", "PROCESSING_BATCH_COMPLETE", None], "production_flow"),
    ("生产工序跟踪", ["PRODUCTION_STATUS_QUERY", "PROCESSING_BATCH_LIST", None], "production_flow"),
    ("半成品流转", ["PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "MATERIAL_BATCH_QUERY", None], "production_flow"),
    ("在制品统计", ["PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", "REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "production_flow"),
    ("完工入库", ["PROCESSING_BATCH_COMPLETE", "PROCESSING_BATCH_LIST", "MATERIAL_BATCH_CREATE", None], "production_flow"),
    ("产品下线", ["PROCESSING_BATCH_COMPLETE", "PROCESSING_BATCH_LIST", "PRODUCTION_STATUS_QUERY", None], "production_flow"),

    # ===== 4. Quality Flow (5 cases) =====
    ("来料检验流程", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "MATERIAL_BATCH_QUERY", None], "quality_flow"),
    ("过程质检", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", None], "quality_flow"),
    ("成品检验流程", ["QUALITY_CHECK_QUERY", "QUALITY_CHECK_EXECUTE", "REPORT_QUALITY", None], "quality_flow"),
    ("不合格品处理流程", ["QUALITY_DISPOSITION_EXECUTE", "QUALITY_CHECK_QUERY", "REPORT_QUALITY", None], "quality_flow"),
    ("质量改进", ["QUALITY_CHECK_QUERY", "REPORT_QUALITY", "REPORT_TRENDS", None], "quality_flow"),

    # ===== 5. Approval Workflow (6 cases) =====
    ("待审批事项", ["ORDER_LIST", "MATERIAL_BATCH_QUERY", "REPORT_DASHBOARD_OVERVIEW", "ALERT_LIST", None], "approval_workflow"),
    ("审批进度", ["ORDER_STATUS", "REPORT_DASHBOARD_OVERVIEW", None], "approval_workflow"),
    ("我的审批", ["ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", None], "approval_workflow"),
    ("审批历史", ["ORDER_LIST", "REPORT_DASHBOARD_OVERVIEW", "PROCESSING_BATCH_TIMELINE", None], "approval_workflow"),
    ("退回重审", ["ORDER_STATUS", "QUALITY_DISPOSITION_EXECUTE", None], "approval_workflow"),
    ("加急审批", ["ORDER_STATUS", "ALERT_LIST", None], "approval_workflow"),

    # ===== 6. Inventory Flow (5 cases) =====
    ("收发存流程", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", None], "inventory_flow"),
    ("调拨流程", ["MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", None], "inventory_flow"),
    ("退货流程", ["ORDER_STATUS", "MATERIAL_BATCH_QUERY", "REPORT_INVENTORY", "QUALITY_DISPOSITION_EXECUTE", None], "inventory_flow"),
    ("报废流程", ["QUALITY_DISPOSITION_EXECUTE", "REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", None], "inventory_flow"),
    ("盘亏处理", ["REPORT_INVENTORY", "MATERIAL_BATCH_QUERY", "ALERT_LIST", None], "inventory_flow"),

    # ===== 7. Traceability Flow (6 cases) =====
    ("正向追溯", ["TRACE_BATCH", "TRACE_FULL", "TRACE_PUBLIC", None], "traceability_flow"),
    ("反向追溯", ["TRACE_BATCH", "TRACE_FULL", "TRACE_PUBLIC", None], "traceability_flow"),
    ("批次全程追溯", ["TRACE_FULL", "TRACE_BATCH", "TRACE_PUBLIC", None], "traceability_flow"),
    ("原料到成品追溯", ["TRACE_FULL", "TRACE_BATCH", "MATERIAL_BATCH_QUERY", None], "traceability_flow"),
    ("问题产品召回", ["TRACE_BATCH", "TRACE_FULL", "QUALITY_DISPOSITION_EXECUTE", "ALERT_LIST", None], "traceability_flow"),
    ("追溯链查看", ["TRACE_FULL", "TRACE_BATCH", "TRACE_PUBLIC", None], "traceability_flow"),

    # ===== 8. Alert Workflow (5 cases) =====
    ("告警处理流程", ["ALERT_LIST", "ALERT_ACKNOWLEDGE", None], "alert_workflow"),
    ("告警升级流程", ["ALERT_LIST", "ALERT_ACKNOWLEDGE", None], "alert_workflow"),
    ("告警关闭", ["ALERT_ACKNOWLEDGE", "ALERT_LIST", None], "alert_workflow"),
    ("告警分析", ["ALERT_LIST", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "ALERT_STATS", None], "alert_workflow"),
    ("告警趋势", ["ALERT_LIST", "REPORT_TRENDS", "REPORT_DASHBOARD_OVERVIEW", "ALERT_STATS", None], "alert_workflow"),

    # ===== 9. Report Workflow (5 cases) =====
    ("日报生成", ["REPORT_PRODUCTION", "REPORT_DASHBOARD_OVERVIEW", None], "report_workflow"),
    ("周报汇总", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_TRENDS", None], "report_workflow"),
    ("月报提交", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_FINANCE", None], "report_workflow"),
    ("报表审核", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_QUALITY", None], "report_workflow"),
    ("数据汇报", ["REPORT_DASHBOARD_OVERVIEW", "REPORT_PRODUCTION", "REPORT_TRENDS", None], "report_workflow"),
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
    print(f"=== v5 Intent Pipeline E2E Test - Round 41 ===")
    print(f"Focus: WORKFLOW & BUSINESS PROCESS queries")
    print(f"       (order-to-delivery, purchase-to-pay, production flow, quality flow,")
    print(f"        approval, inventory, traceability, alerts, reports)")
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
        'test': 'v5_round41_workflow_business_process',
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
    report_path = f'tests/ai-intent/reports/v5_round41_{ts}.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nReport saved: {report_path}")

if __name__ == '__main__':
    main()
